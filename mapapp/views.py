import json
import re

from django.contrib.auth import authenticate, get_user_model, login as auth_login, logout as auth_logout
from django.contrib.auth.models import Group
from django.db import IntegrityError, connection, transaction
from django.db.models import Q
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
    InstitutionType,
    Link,
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
        if not is_admin:
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


def _serialize_institution(inst: Institution, favorite_ids: set[int] | None = None):
    is_favorite = bool(favorite_ids and inst.id in favorite_ids)
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
    favorite_ids = _get_favorite_ids_for_request(request)
    return JsonResponse({"institutions": [_serialize_institution(inst, favorite_ids) for inst in queryset]})


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
    favorite_ids = _get_favorite_ids_for_request(request)
    institutions = [_serialize_institution(inst, favorite_ids) for inst in queryset]
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
    favorite_ids = _get_favorite_ids_for_request(request)
    return JsonResponse({"institution": _serialize_institution(inst, favorite_ids)})


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
    ActionLog.objects.create(
        administrator=admin,
        action="UPDATE",
        entity="institutions",
        record_id=inst.id,
        old_data=old_data,
        new_data=data,
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
