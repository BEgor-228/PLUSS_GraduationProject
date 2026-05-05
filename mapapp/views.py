import json
import re

from django.contrib.auth import authenticate, get_user_model, login as auth_login, logout as auth_logout
from django.contrib.auth.models import Group
from django.db import IntegrityError, connection, transaction
from django.db.models import Count, Q
from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import (
    ActionLog,
    AccessibilityCriterionType,
    AdmissionType,
    AoopProgram,
    ConditionType,
    Director,
    District,
    Favorite,
    Institution,
    InstitutionReview,
    InstitutionType,
    Link,
    ProfileNotification,
)


def index(request: HttpRequest):
    return render(request, "mapapp/index.html")


def profile_page(request: HttpRequest):
    user = request.user
    ctx: dict = {"profile_role": "guest"}
    if user.is_authenticated:
        is_admin = user.is_superuser or user.groups.filter(name="administrators").exists()
        login_base = (user.username or "").split("@")[0].strip()
        initials_source = login_base or (user.get_full_name() or user.email or "U")
        letters = [ch for ch in initials_source if ch.isalnum()]
        profile_initials = "".join(letters[:2]).upper() if letters else "U"
        ctx = {
            "profile_role": "admin" if is_admin else "portal",
            "display_name": user.get_full_name() or user.username,
            "display_email": user.email,
            "profile_initials": profile_initials,
        }
        if is_admin:
            now = timezone.now()
            month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            total_institutions = Institution.objects.count()
            institutions_month_delta = Institution.objects.filter(created_at__gte=month_start).count()
            User = get_user_model()
            total_users = User.objects.count()
            users_month_delta = User.objects.filter(date_joined__gte=month_start).count()
            type_distribution_qs = (
                Institution.objects.values("type__name_ru")
                .annotate(total=Count("id"))
                .order_by("-total")
            )
            type_distribution = [
                {
                    "name": row["type__name_ru"] or "Без типа",
                    "count": row["total"],
                }
                for row in type_distribution_qs
            ]
            admin_users_qs = User.objects.order_by("-date_joined").values(
                "id", "username", "first_name", "last_name", "email"
            )
            admin_users = []
            for row in admin_users_qs:
                full_name = " ".join(part for part in [row["first_name"], row["last_name"]] if part).strip()
                display_name = full_name or row["username"] or "Пользователь"
                initials_letters = [ch for ch in display_name if ch.isalnum()]
                initials = "".join(initials_letters[:2]).upper() if initials_letters else "U"
                admin_users.append(
                    {
                        "id": row["id"],
                        "display_name": display_name,
                        "username": row["username"] or "",
                        "email": row["email"] or "",
                        "initials": initials,
                        "is_current_user": row["id"] == user.id,
                    }
                )
            ctx.update(
                {
                    "admin_total_institutions": total_institutions,
                    "admin_institutions_month_delta": institutions_month_delta,
                    "admin_total_users": total_users,
                    "admin_users_month_delta": users_month_delta,
                    "admin_type_distribution": type_distribution,
                    "admin_users": admin_users,
                }
            )
        if not is_admin:
            ctx["settings_first_name"] = user.first_name or ""
            ctx["settings_username"] = user.username or ""
            ctx["settings_email"] = user.email or ""
            favorites = (
                Favorite.objects.filter(user=user)
                .select_related("institution__district", "institution__type")
                .order_by("-created_at")
            )
            favorite_cards = []
            for fav in favorites:
                inst = fav.institution
                favorite_cards.append(
                    {
                        "id": inst.id,
                        "district_id": inst.district_id,
                        "name": inst.name,
                        "district_name": inst.district.name if inst.district_id else "",
                        "type_name": inst.type.name_ru if inst.type_id else "",
                        "range_min": inst.range_min,
                        "range_max": inst.range_max,
                    }
                )
            ctx["favorite_institutions"] = favorite_cards
            ctx["favorites_count"] = len(favorite_cards)
            notifications_qs = (
                ProfileNotification.objects.filter(user=user)
                .select_related("institution", "action_log")
                .order_by("-created_at")[:20]
            )
            ctx["notifications"] = [
                {
                    "institution_name": n.institution.name if n.institution_id else "Учреждение",
                    "message": n.message,
                    "created_at": n.created_at,
                }
                for n in notifications_qs
            ]
            ctx["notifications_count"] = len(ctx["notifications"])
    return render(request, "mapapp/profile.html", ctx)


def district_page(request: HttpRequest, district_id: int):
    district = get_object_or_404(District, pk=district_id)
    return render(request, "mapapp/district.html", {"district": district})


@require_GET
def institution_create_page(request: HttpRequest):
    if not _require_admin(request):
        return redirect("index")

    district_id = request.GET.get("district_id")
    initial_data = {"district_id": int(district_id)} if district_id and district_id.isdigit() else {}
    districts = District.objects.order_by("name").values("id", "name")
    return render(
        request,
        "mapapp/institution_form.html",
        {"initial_data": initial_data, "districts": districts, "mode": "create"},
    )


@require_GET
def institution_edit_page(request: HttpRequest, institution_id: int):
    if not _require_admin(request):
        return redirect("index")

    inst = get_object_or_404(
        Institution.objects.select_related("director", "type").prefetch_related(
            "conditions", "admission", "aoop_programs"
        ),
        pk=institution_id,
    )
    districts = District.objects.order_by("name").values("id", "name")
    return render(
        request,
        "mapapp/institution_form.html",
        {"initial_data": _serialize_institution(inst), "districts": districts, "mode": "edit"},
    )


def _parse_json(request: HttpRequest):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return None


def _authenticate_with_login_or_email(request: HttpRequest, login_value: str, password: str):
    User = get_user_model()
    login_value = (login_value or "").strip()
    if not login_value:
        return None
    user = authenticate(request, username=login_value, password=password)
    if user:
        return user
    by_email = User.objects.filter(email__iexact=login_value).first()
    if by_email:
        return authenticate(request, username=by_email.username, password=password)
    return None


def _repair_auth_user_pk_sequence():
    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('auth_user', 'id'),
                COALESCE((SELECT MAX(id) FROM auth_user), 1),
                (SELECT MAX(id) IS NOT NULL FROM auth_user)
            )
            """
        )


def _create_user_with_repaired_sequence(**kwargs):
    User = get_user_model()
    try:
        return User.objects.create_user(**kwargs)
    except IntegrityError as exc:
        if "auth_user_pkey" not in str(exc):
            raise
        _repair_auth_user_pk_sequence()
        return User.objects.create_user(**kwargs)


def _get_reviews_aggregates_for_institutions(institution_ids: list[int]) -> dict[int, dict]:
    if not institution_ids:
        return {}

    reviews = InstitutionReview.objects.filter(institution_id__in=institution_ids).only(
        "institution_id", "rating", "criteria_scores"
    )

    inst_rating_sum: dict[int, float] = {}
    inst_rating_count: dict[int, int] = {}

    criteria_sum: dict[int, dict[str, float]] = {}
    criteria_count: dict[int, dict[str, int]] = {}

    for review in reviews:
        inst_id = review.institution_id
        inst_rating_sum[inst_id] = inst_rating_sum.get(inst_id, 0.0) + float(review.rating or 0)
        inst_rating_count[inst_id] = inst_rating_count.get(inst_id, 0) + 1

        criteria_scores = review.criteria_scores or {}
        if isinstance(criteria_scores, dict):
            for code, score in criteria_scores.items():
                try:
                    score_int = int(score)
                except (TypeError, ValueError):
                    continue
                code_s = str(code)
                criteria_sum.setdefault(inst_id, {}).setdefault(code_s, 0.0)
                criteria_count.setdefault(inst_id, {}).setdefault(code_s, 0)
                criteria_sum[inst_id][code_s] += float(score_int)
                criteria_count[inst_id][code_s] += 1

    aggregates: dict[int, dict] = {}
    for inst_id in institution_ids:
        rating_avg = None
        if inst_rating_count.get(inst_id):
            rating_avg = round(inst_rating_sum[inst_id] / inst_rating_count[inst_id], 2)

        avg_criteria: dict[str, float] = {}
        codes_for_inst = criteria_sum.get(inst_id, {})
        for code, sum_value in codes_for_inst.items():
            cnt = criteria_count.get(inst_id, {}).get(code, 0)
            if cnt:
                avg_criteria[code] = round(sum_value / cnt, 2)

        aggregates[inst_id] = {
            "avg_institution_rating": rating_avg,
            "avg_accessibility_criteria": avg_criteria,
        }

    return aggregates


def _serialize_institution(
    inst: Institution, favorite_ids: set[int] | None = None, review_aggs: dict[int, dict] | None = None
):
    is_favorite = bool(favorite_ids and inst.id in favorite_ids)
    review_agg = (review_aggs or {}).get(inst.id) if review_aggs else None
    return {
        "id": inst.id,
        "name": inst.name,
        "address": inst.address,
        "description": inst.description,
        "range_min": inst.range_min,
        "range_max": inst.range_max,
        "website": inst.website,
        "aoop_url": inst.aoop_url,
        "district_id": inst.district_id,
        "type": inst.type_id,
        "conditions": list(inst.conditions.values_list("code", flat=True)),
        "conditionsAdmission": list(inst.admission.values_list("code", flat=True)),
        "accessibility_criteria": list(inst.accessibility_criteria.values_list("code", flat=True)),
        "aoop_programs": [{"id": p.id, "name": p.name} for p in inst.aoop_programs.all()],
        "is_favorite": is_favorite,
        "avg_institution_rating": review_agg.get("avg_institution_rating") if review_agg else None,
        "avg_accessibility_criteria": (review_agg.get("avg_accessibility_criteria") if review_agg else {}) or {},
        "director": {
            "id": inst.director.id if inst.director else None,
            "name": inst.director.full_name if inst.director else "",
            "phone": inst.director.phone if inst.director else "",
            "email": inst.director.email if inst.director else "",
        },
    }


def _get_favorite_ids_for_request(request: HttpRequest) -> set[int]:
    user = request.user
    if not user.is_authenticated:
        return set()
    if user.is_superuser or user.groups.filter(name="administrators").exists():
        return set()
    return set(Favorite.objects.filter(user=user).values_list("institution_id", flat=True))


def _normalize_search_value(value: str) -> str:
    if not value:
        return ""
    value = value.lower().replace("ё", "е").replace("№", "")
    return re.sub(r"[^a-zа-я0-9]", "", value)


def _matches_age_bucket(inst_payload: dict, age_bucket: str) -> bool:
    range_min = inst_payload.get("range_min")
    range_max = inst_payload.get("range_max")
    if range_min is None or range_max is None:
        return False
    if "-" in age_bucket:
        min_str, max_str = age_bucket.split("-", 1)
        try:
            min_value = float(min_str)
            max_value = float(max_str)
        except ValueError:
            return False
        return range_min <= max_value and range_max >= min_value
    if "+" in age_bucket:
        try:
            min_value = int(age_bucket.replace("+", ""))
        except ValueError:
            return False
        return range_max >= min_value
    return False


def _search_match(inst_payload: dict, search_term: str) -> bool:
    if not search_term:
        return True
    q = _normalize_search_value(search_term)
    if not q:
        return True

    name = _normalize_search_value(inst_payload.get("name") or "")
    desc = _normalize_search_value(inst_payload.get("description") or "")
    director_name = _normalize_search_value(((inst_payload.get("director") or {}).get("name")) or "")
    website = _normalize_search_value(inst_payload.get("website") or "")
    inst_number_match = re.search(r"\d+", inst_payload.get("name") or "")
    query_number_match = re.search(r"\d+", search_term or "")
    inst_number = inst_number_match.group(0) if inst_number_match else None
    query_number = query_number_match.group(0) if query_number_match else None

    if q in name or q in desc or q in director_name or q in website:
        return True
    if query_number and inst_number and query_number == inst_number:
        return True

    synonyms = {
        "preschool": ["детсад", "детскийсад", "садик", "дс", "сад"],
        "school": ["школа", "шк", "сош", "лицей", "гимназия"],
        "school_internat": ["интернат", "школаинтернат"],
        "spo": ["спо", "техникум", "колледж", "училище"],
        "vo": ["во", "вуз", "университет", "институт", "академия"],
    }
    normalized_term = _normalize_search_value(search_term)
    for type_code, words in synonyms.items():
        if any(word in normalized_term for word in words) and inst_payload.get("type") == type_code:
            if not query_number:
                return True
            if inst_number and query_number == inst_number:
                return True
    return False


def _calc_relevance(
    inst_payload: dict,
    selected_types: list[str],
    selected_ages: list[str],
    selected_conditions: list[str],
    selected_accessibility: list[str],
    aoop_selected: bool,
) -> float:
    weights = {
        "type": 0.5,
        "conditions": 0.15,
        "age": 0.15,
        "aoop": 0.1,
        "accessibility": 0.1,
    }
    inst_conditions = inst_payload.get("conditions") or []
    inst_accessibility = inst_payload.get("accessibility_criteria") or []
    inst_aoop = inst_payload.get("aoop_programs") or []

    type_score = 1.0 if not selected_types else (1.0 if inst_payload.get("type") in selected_types else 0.0)
    conditions_score = (
        1.0
        if not selected_conditions
        else sum(1 for c in selected_conditions if c in inst_conditions) / len(selected_conditions)
    )
    age_score = (
        1.0
        if not selected_ages
        else sum(1 for age in selected_ages if _matches_age_bucket(inst_payload, age)) / len(selected_ages)
    )
    aoop_score = 1.0 if not aoop_selected else (1.0 if len(inst_aoop) > 0 else 0.0)
    accessibility_score = (
        1.0
        if not selected_accessibility
        else sum(1 for c in selected_accessibility if c in inst_accessibility) / len(selected_accessibility)
    )
    return (
        weights["type"] * type_score
        + weights["conditions"] * conditions_score
        + weights["age"] * age_score
        + weights["aoop"] * aoop_score
        + weights["accessibility"] * accessibility_score
    )


def _value_changed(old_value, new_value) -> bool:
    return (old_value or "") != (new_value or "")


def _build_institution_update_message(old_data: dict | None, new_data: dict | None, institution_name: str) -> str:
    old_payload = old_data or {}
    new_payload = new_data or {}
    changed_parts: list[str] = []

    if _value_changed(old_payload.get("name"), new_payload.get("name")):
        changed_parts.append("название")
    if _value_changed(old_payload.get("description"), new_payload.get("description")):
        changed_parts.append("описание")
    if _value_changed(old_payload.get("address"), new_payload.get("address")):
        changed_parts.append("адрес")
    if _value_changed(old_payload.get("website"), new_payload.get("website")):
        changed_parts.append("сайт")
    if _value_changed(old_payload.get("aoop_url"), new_payload.get("aoop_url")):
        changed_parts.append("ссылка на АООП")
    if _value_changed(old_payload.get("district_id"), new_payload.get("district_id")):
        changed_parts.append("округ")
    if _value_changed(old_payload.get("type"), new_payload.get("type")):
        changed_parts.append("тип учреждения")

    old_min = (old_payload.get("range") or {}).get("min") if isinstance(old_payload.get("range"), dict) else old_payload.get("range_min")
    old_max = (old_payload.get("range") or {}).get("max") if isinstance(old_payload.get("range"), dict) else old_payload.get("range_max")
    new_min = (new_payload.get("range") or {}).get("min") if isinstance(new_payload.get("range"), dict) else new_payload.get("range_min")
    new_max = (new_payload.get("range") or {}).get("max") if isinstance(new_payload.get("range"), dict) else new_payload.get("range_max")
    if _value_changed(old_min, new_min) or _value_changed(old_max, new_max):
        changed_parts.append("возрастной диапазон")

    old_director = old_payload.get("director") or {}
    new_director = new_payload.get("director") or {}
    if any(
        _value_changed(old_director.get(key), new_director.get(key))
        for key in ("name", "phone", "email")
    ):
        changed_parts.append("данные директора")

    old_conditions = old_payload.get("conditions") or []
    new_conditions = new_payload.get("conditions") or []
    if sorted(old_conditions) != sorted(new_conditions):
        changed_parts.append("условия обучения")

    old_admission = old_payload.get("conditionsAdmission") or []
    new_admission = new_payload.get("conditionsAdmission") or []
    if sorted(old_admission) != sorted(new_admission):
        changed_parts.append("формы поступления")

    old_accessibility = old_payload.get("accessibility_criteria") or []
    new_accessibility = new_payload.get("accessibility_criteria") or []
    if sorted(old_accessibility) != sorted(new_accessibility):
        changed_parts.append("критерии доступности")

    old_aoop = sorted((p.get("name") or "").strip() for p in (old_payload.get("aoop_programs") or []) if isinstance(p, dict))
    new_aoop = sorted((p.get("name") or "").strip() for p in (new_payload.get("aoop_programs") or []) if isinstance(p, dict))
    if old_aoop != new_aoop:
        changed_parts.append("программы АООП")

    if not changed_parts:
        return f'В учреждение "{institution_name}" внесены изменения.'
    return f'В учреждении "{institution_name}" обновлены: {", ".join(changed_parts)}.'


@require_GET
def get_districts(request: HttpRequest):
    districts = District.objects.order_by("name").values("id", "name")
    district_map = {row["id"]: row["name"] for row in districts}
    return JsonResponse({"districts": district_map})


@require_GET
def get_links(request: HttpRequest):
    district_id = request.GET.get("district_id")
    if not district_id:
        return JsonResponse({"error": "district_id required"}, status=400)
    links = Link.objects.filter(district_id=district_id).order_by("id").values(
        "linksTo", "linkToInstitution"
    )
    payload = [{"linksto": l["linksTo"], "linktoinstitution": l["linkToInstitution"]} for l in links]
    return JsonResponse({"links": payload})


@require_GET
def get_institutions(request: HttpRequest):
    district_id = request.GET.get("district_id")
    if not district_id:
        return JsonResponse({"error": "district_id required and must be integer"}, status=400)

    queryset = (
        Institution.objects.filter(district_id=district_id)
        .select_related("director", "type")
        .prefetch_related("conditions", "admission", "aoop_programs", "accessibility_criteria")
        .order_by("name")
    )
    institution_ids = list(queryset.values_list("id", flat=True))
    review_aggs = _get_reviews_aggregates_for_institutions(institution_ids)
    favorite_ids = _get_favorite_ids_for_request(request)
    return JsonResponse(
        {"institutions": [_serialize_institution(inst, favorite_ids, review_aggs) for inst in queryset]}
    )


@require_GET
def search_institutions(request: HttpRequest):
    district_id = request.GET.get("district_id")
    if not district_id:
        return JsonResponse({"error": "district_id required"}, status=400)

    selected_types = [v for v in request.GET.getlist("type") if v]
    selected_ages = [v for v in request.GET.getlist("age") if v]
    selected_conditions = [v for v in request.GET.getlist("condition") if v]
    selected_accessibility = [v for v in request.GET.getlist("accessibility") if v]
    aoop_selected = request.GET.get("aoop") in {"1", "true", "yes"}
    search_term = (request.GET.get("q") or "").strip()

    queryset = (
        Institution.objects.filter(district_id=district_id)
        .select_related("director", "type")
        .prefetch_related("conditions", "admission", "aoop_programs", "accessibility_criteria")
    )
    institution_ids = list(queryset.values_list("id", flat=True))
    review_aggs = _get_reviews_aggregates_for_institutions(institution_ids)
    favorite_ids = _get_favorite_ids_for_request(request)
    institutions = [_serialize_institution(inst, favorite_ids, review_aggs) for inst in queryset]
    institutions = [inst for inst in institutions if _search_match(inst, search_term)]
    ranked_with_relevance = [
        (
            inst,
            _calc_relevance(
                inst,
                selected_types,
                selected_ages,
                selected_conditions,
                selected_accessibility,
                aoop_selected,
            ),
        )
        for inst in institutions
    ]
    ranked_with_relevance.sort(key=lambda pair: pair[1], reverse=True)
    ranked = []
    for inst, relevance in ranked_with_relevance:
        inst_with_score = dict(inst)
        inst_with_score["relevance"] = round(float(relevance), 3)
        ranked.append(inst_with_score)
    return JsonResponse({"institutions": ranked})


@require_GET
def get_institution(request: HttpRequest):
    inst_id = request.GET.get("id")
    if not inst_id:
        return JsonResponse({"error": "id required and must be integer"}, status=400)
    inst = get_object_or_404(
        Institution.objects.select_related("director", "type").prefetch_related(
            "conditions", "admission", "aoop_programs"
        ),
        pk=inst_id,
    )
    review_aggs = _get_reviews_aggregates_for_institutions([inst.id])
    favorite_ids = _get_favorite_ids_for_request(request)
    return JsonResponse({"institution": _serialize_institution(inst, favorite_ids, review_aggs)})


def _require_portal_user(request: HttpRequest):
    user = request.user
    if not user.is_authenticated:
        return None
    if user.is_superuser or user.groups.filter(name="administrators").exists():
        return None
    return user


@require_GET
def get_favorites(request: HttpRequest):
    user = _require_portal_user(request)
    if not user:
        return JsonResponse({"favorite_ids": []})
    favorite_ids = list(Favorite.objects.filter(user=user).values_list("institution_id", flat=True))
    return JsonResponse({"favorite_ids": favorite_ids})


@csrf_exempt
@require_POST
def update_profile(request: HttpRequest):
    user = _require_portal_user(request)
    if not user:
        return JsonResponse({"error": "Portal user role is required"}, status=403)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    first_name = (data.get("first_name") or "").strip()
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()

    if not first_name:
        return JsonResponse({"error": "Имя не может быть пустым"}, status=400)
    if not username:
        return JsonResponse({"error": "Логин не может быть пустым"}, status=400)
    if not email:
        return JsonResponse({"error": "Почта не может быть пустой"}, status=400)

    User = get_user_model()
    username_taken = User.objects.filter(username=username).exclude(id=user.id).exists()
    if username_taken:
        return JsonResponse({"error": "Этот username уже занят"}, status=409)
    email_taken = User.objects.filter(email__iexact=email).exclude(id=user.id).exists()
    if email_taken:
        return JsonResponse({"error": "Эта почта уже используется"}, status=409)

    user.first_name = first_name
    user.username = username
    user.email = email
    user.save(update_fields=["first_name", "username", "email"])
    return JsonResponse(
        {
            "success": True,
            "profile": {
                "first_name": user.first_name,
                "username": user.username,
                "email": user.email,
            },
        }
    )


@csrf_exempt
@require_POST
def add_favorite(request: HttpRequest):
    user = _require_portal_user(request)
    if not user:
        return JsonResponse({"error": "Portal user role is required"}, status=403)
    data = _parse_json(request) or {}
    institution_id = data.get("institution_id")
    if not institution_id:
        return JsonResponse({"error": "institution_id is required"}, status=400)
    institution = Institution.objects.filter(pk=institution_id).first()
    if not institution:
        return JsonResponse({"error": "Institution not found"}, status=404)
    Favorite.objects.get_or_create(user=user, institution=institution)
    return JsonResponse({"success": True, "is_favorite": True})


@csrf_exempt
@require_POST
def remove_favorite(request: HttpRequest):
    user = _require_portal_user(request)
    if not user:
        return JsonResponse({"error": "Portal user role is required"}, status=403)
    data = _parse_json(request) or {}
    institution_id = data.get("institution_id")
    if not institution_id:
        return JsonResponse({"error": "institution_id is required"}, status=400)
    Favorite.objects.filter(user=user, institution_id=institution_id).delete()
    return JsonResponse({"success": True, "is_favorite": False})


@require_GET
def get_directors(request: HttpRequest):
    search = request.GET.get("search", "")
    qs = Director.objects.all()
    if search:
        qs = qs.filter(full_name__icontains=search)
    directors = list(qs.order_by("full_name").values("id", "full_name", "phone", "email"))
    return JsonResponse({"directors": directors})


@require_GET
def get_director(request: HttpRequest):
    director_id = request.GET.get("id")
    if not director_id:
        return JsonResponse({"error": "Director ID is required"}, status=400)
    director = get_object_or_404(Director, pk=director_id)
    return JsonResponse(
        {"director": {"id": director.id, "full_name": director.full_name, "phone": director.phone, "email": director.email}}
    )


@csrf_exempt
@require_POST
def login(request: HttpRequest):
    data = _parse_json(request)
    if not data or not data.get("login") or not data.get("password"):
        return JsonResponse({"error": "Invalid JSON or missing credentials"}, status=400)

    user = _authenticate_with_login_or_email(request, data["login"], data["password"])
    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)
    is_admin = user.is_superuser or user.groups.filter(name="administrators").exists()
    if not is_admin:
        return JsonResponse({"error": "Admin role is required"}, status=403)

    auth_login(request, user)
    return JsonResponse({"success": True})


@csrf_exempt
@require_POST
def logout(request: HttpRequest):
    auth_logout(request)
    return JsonResponse({"success": True})


@require_GET
def check_session(request: HttpRequest):
    user = request.user
    is_authenticated = bool(user and user.is_authenticated)
    is_admin = is_authenticated and (user.is_superuser or user.groups.filter(name="administrators").exists())
    payload = {
        "loggedIn": bool(is_admin),
        "adminLoggedIn": bool(is_admin),
        "portalLoggedIn": bool(is_authenticated and not is_admin),
    }
    if is_authenticated and not is_admin:
        payload["portalUserName"] = user.get_full_name() or user.username
    return JsonResponse(payload)


@csrf_exempt
@require_POST
def register(request: HttpRequest):
    data = _parse_json(request)
    required = ("login", "email", "password", "full_name")
    if not data or any(not data.get(field) for field in required):
        return JsonResponse({"error": "Invalid JSON or missing fields: login, email, password, full_name"}, status=400)

    User = get_user_model()
    email_s = data["email"].strip()
    login_s = email_s
    if User.objects.filter(Q(username=login_s) | Q(email=email_s)).exists():
        return JsonResponse({"error": "Login or email already exists"}, status=409)

    admin_group, _ = Group.objects.get_or_create(name="administrators")
    user = _create_user_with_repaired_sequence(
        username=login_s,
        email=email_s,
        password=data["password"],
        first_name=data["full_name"].strip(),
    )
    user.groups.add(admin_group)
    user.is_staff = True
    user.last_login = timezone.now()
    user.save(update_fields=["is_staff", "last_login"])
    auth_login(request, user)
    return JsonResponse({"success": True, "id": user.id}, status=201)


@csrf_exempt
@require_POST
def register_portal_user(request: HttpRequest):
    data = _parse_json(request)
    required = ("email", "password", "full_name")
    if not data or any(not data.get(field) for field in required):
        return JsonResponse({"error": "Invalid JSON or missing fields: email, password, full_name"}, status=400)

    User = get_user_model()
    email_s = data["email"].strip()
    login_s = email_s
    if User.objects.filter(Q(username=login_s) | Q(email=email_s)).exists():
        return JsonResponse({"error": "Login or email already exists"}, status=409)

    portal_group, _ = Group.objects.get_or_create(name="portal_users")
    user = _create_user_with_repaired_sequence(
        username=login_s,
        email=email_s,
        password=data["password"],
        first_name=data["full_name"].strip(),
    )
    user.groups.add(portal_group)
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])
    auth_login(request, user)
    return JsonResponse({"success": True, "id": user.id}, status=201)


@csrf_exempt
@require_POST
def login_portal_user(request: HttpRequest):
    data = _parse_json(request)
    if not data or not data.get("login") or not data.get("password"):
        return JsonResponse({"error": "Invalid JSON or missing credentials"}, status=400)

    user = _authenticate_with_login_or_email(request, data["login"], data["password"])
    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)
    is_admin = user.is_superuser or user.groups.filter(name="administrators").exists()
    if is_admin:
        return JsonResponse({"error": "Portal user role is required"}, status=403)

    auth_login(request, user)
    return JsonResponse({"success": True})


def _upsert_director(data):
    director_data = data.get("director") or {}
    if not director_data.get("name"):
        return None
    director_id = director_data.get("id")
    if director_id:
        director = Director.objects.filter(id=director_id).first()
        if director:
            director.full_name = director_data.get("name")
            director.phone = director_data.get("phone")
            director.email = director_data.get("email")
            director.save()
            return director
    return Director.objects.create(
        full_name=director_data.get("name"),
        phone=director_data.get("phone"),
        email=director_data.get("email"),
    )


def _sync_relations(inst: Institution, data):
    conditions = data.get("conditions", [])
    admissions = data.get("conditionsAdmission", [])
    accessibility_criteria = data.get("accessibility_criteria", [])
    inst.conditions.set(ConditionType.objects.filter(code__in=conditions))
    inst.admission.set(AdmissionType.objects.filter(code__in=admissions))
    inst.accessibility_criteria.set(
        AccessibilityCriterionType.objects.filter(code__in=accessibility_criteria)
    )
    inst.aoop_programs.all().delete()
    AoopProgram.objects.bulk_create(
        [AoopProgram(institution=inst, name=p.get("name", "")) for p in data.get("aoop_programs", []) if p.get("name")]
    )


def _require_admin(request: HttpRequest):
    user = request.user
    if not user.is_authenticated:
        return None
    if user.is_superuser or user.groups.filter(name="administrators").exists():
        return user
    return None


@csrf_exempt
@require_POST
def delete_user(request: HttpRequest):
    admin = _require_admin(request)
    if not admin:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    data = _parse_json(request) or {}
    user_id = data.get("user_id")
    if not user_id:
        return JsonResponse({"error": "user_id is required"}, status=400)
    User = get_user_model()
    target = User.objects.filter(id=user_id).first()
    if not target:
        return JsonResponse({"error": "User not found"}, status=404)
    if target.id == admin.id:
        return JsonResponse({"error": "Нельзя удалить текущего администратора"}, status=400)
    if target.is_superuser:
        return JsonResponse({"error": "Нельзя удалить суперпользователя"}, status=400)
    target.delete()
    return JsonResponse({"success": True})


@csrf_exempt
@require_POST
def create_review(request: HttpRequest):
    user = _require_portal_user(request)
    if not user:
        return JsonResponse({"error": "Только зарегистрированный пользователь может оставить отзыв"}, status=403)

    data = _parse_json(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    institution_id = data.get("institution_id")
    comment = (data.get("comment") or "").strip()
    institution_rating = data.get("institution_rating")
    criteria_ratings = data.get("criteria_ratings")

    if not institution_id:
        return JsonResponse({"error": "institution_id is required"}, status=400)
    institution = Institution.objects.filter(pk=institution_id).first()
    if not institution:
        return JsonResponse({"error": "Учреждение не найдено"}, status=404)
    if criteria_ratings is None:
        criteria_ratings = {}
    if not isinstance(criteria_ratings, dict):
        return JsonResponse({"error": "criteria_ratings must be an object"}, status=400)
    try:
        institution_rating_value = int(institution_rating)
    except (TypeError, ValueError):
        return JsonResponse({"error": "Оценка учреждения должна быть целым числом от 1 до 5"}, status=400)
    if institution_rating_value < 1 or institution_rating_value > 5:
        return JsonResponse({"error": "Оценка учреждения должна быть от 1 до 5"}, status=400)

    institution_criteria_codes = set(
        institution.accessibility_criteria.values_list("code", flat=True)
    )
    normalized_scores: dict[str, int] = {}
    for code, score in criteria_ratings.items():
        if str(code) not in institution_criteria_codes:
            return JsonResponse({"error": f"Критерий {code} не относится к этому учреждению"}, status=400)
        try:
            rating_value = int(score)
        except (TypeError, ValueError):
            return JsonResponse({"error": f"Некорректная оценка для критерия {code}"}, status=400)
        if rating_value < 1 or rating_value > 5:
            return JsonResponse({"error": f"Оценка для критерия {code} должна быть от 1 до 5"}, status=400)
        normalized_scores[str(code)] = rating_value

    if institution_criteria_codes and set(normalized_scores.keys()) != institution_criteria_codes:
        return JsonResponse({"error": "Оцените все критерии доступности этого учреждения"}, status=400)

    review = InstitutionReview.objects.create(
        user=user,
        institution=institution,
        rating=institution_rating_value,
        criteria_scores=normalized_scores,
        comment=comment,
        status=InstitutionReview.STATUS_PENDING,
    )
    return JsonResponse(
        {
            "success": True,
            "review_id": review.id,
            "status": review.status,
            "rating": float(review.rating),
        },
        status=201,
    )


@csrf_exempt
@require_POST
@transaction.atomic
def create_institution(request: HttpRequest):
    admin = _require_admin(request)
    if not admin:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    data = _parse_json(request)
    if not data:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    director = _upsert_director(data)
    inst = Institution.objects.create(
        name=data.get("name"),
        district_id=data.get("district_id"),
        type_id=data.get("type"),
        director=director,
        description=data.get("description"),
        range_min=(data.get("range") or {}).get("min"),
        range_max=(data.get("range") or {}).get("max"),
        website=data.get("website"),
        aoop_url=data.get("aoop_url"),
        address=data.get("address"),
    )
    _sync_relations(inst, data)
    ActionLog.objects.create(administrator=admin, action="CREATE", entity="institutions", record_id=inst.id, new_data=data)
    return JsonResponse({"id": inst.id}, status=201)


@csrf_exempt
@require_POST
@transaction.atomic
def update_institution(request: HttpRequest):
    admin = _require_admin(request)
    if not admin:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    data = _parse_json(request)
    if not data or not data.get("id"):
        return JsonResponse({"error": "Invalid JSON or missing id"}, status=400)

    inst = get_object_or_404(Institution, id=data["id"])
    old_data = _serialize_institution(inst)
    director = _upsert_director(data)

    inst.name = data.get("name")
    inst.district_id = data.get("district_id")
    inst.type_id = data.get("type")
    inst.director = director
    inst.description = data.get("description")
    inst.range_min = (data.get("range") or {}).get("min")
    inst.range_max = (data.get("range") or {}).get("max")
    inst.website = data.get("website")
    inst.aoop_url = data.get("aoop_url")
    inst.address = data.get("address")
    inst.save()

    _sync_relations(inst, data)
    action_log = ActionLog.objects.create(
        administrator=admin,
        action="UPDATE",
        entity="institutions",
        record_id=inst.id,
        old_data=old_data,
        new_data=data,
    )
    favorite_user_ids = list(Favorite.objects.filter(institution=inst).values_list("user_id", flat=True))
    if favorite_user_ids:
        notification_text = _build_institution_update_message(
            old_data=action_log.old_data,
            new_data=action_log.new_data,
            institution_name=inst.name,
        )
        ProfileNotification.objects.bulk_create(
            [
                ProfileNotification(
                    user_id=user_id,
                    institution=inst,
                    action_log=action_log,
                    message=notification_text,
                )
                for user_id in favorite_user_ids
            ],
            ignore_conflicts=True,
        )
    return JsonResponse({"success": True})


@csrf_exempt
@require_POST
@transaction.atomic
def delete_institution(request: HttpRequest):
    admin = _require_admin(request)
    if not admin:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    data = _parse_json(request) or {}
    inst_id = data.get("id")
    if not inst_id:
        return JsonResponse({"error": "Invalid id"}, status=400)

    inst = get_object_or_404(
        Institution.objects.select_related("director").prefetch_related("conditions", "admission", "aoop_programs"),
        id=inst_id,
    )
    old_data = _serialize_institution(inst)
    director = inst.director
    inst.delete()
    if director:
        director.delete()

    ActionLog.objects.create(administrator=admin, action="DELETE", entity="institutions", record_id=inst_id, old_data=old_data)
    return JsonResponse({"success": True})
