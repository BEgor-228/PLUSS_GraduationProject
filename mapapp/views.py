import json

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
        ctx = {
            "profile_role": "admin" if is_admin else "portal",
            "display_name": user.get_full_name() or user.username,
            "display_email": user.email,
        }
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


def _serialize_institution(inst: Institution):
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
        "director": {
            "id": inst.director.id if inst.director else None,
            "name": inst.director.full_name if inst.director else "",
            "phone": inst.director.phone if inst.director else "",
            "email": inst.director.email if inst.director else "",
        },
    }


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
        .prefetch_related("conditions", "admission", "aoop_programs")
        .order_by("name")
    )
    return JsonResponse({"institutions": [_serialize_institution(inst) for inst in queryset]})


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
    return JsonResponse({"institution": _serialize_institution(inst)})


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
