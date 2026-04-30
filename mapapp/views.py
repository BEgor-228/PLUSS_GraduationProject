import json

from django.db import transaction
from django.db.models import Q
from django.http import HttpRequest, JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import (
    ActionLog,
    Administrator,
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


def _parse_json(request: HttpRequest):
    try:
        return json.loads(request.body.decode("utf-8")) if request.body else {}
    except json.JSONDecodeError:
        return None


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

    admin = Administrator.objects.filter(login=data["login"].strip()).first()
    if not admin or not admin.check_password(data["password"]):
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    request.session["admin_id"] = admin.id
    admin.last_login = timezone.now()
    admin.save(update_fields=["last_login", "updated_at"])
    return JsonResponse({"success": True})


@csrf_exempt
@require_POST
def logout(request: HttpRequest):
    request.session.flush()
    return JsonResponse({"success": True})


@require_GET
def check_session(request: HttpRequest):
    return JsonResponse({"loggedIn": bool(request.session.get("admin_id"))})


@csrf_exempt
@require_POST
def register(request: HttpRequest):
    data = _parse_json(request)
    required = ("login", "email", "password", "full_name")
    if not data or any(not data.get(field) for field in required):
        return JsonResponse({"error": "Invalid JSON or missing fields: login, email, password, full_name"}, status=400)

    if Administrator.objects.filter(Q(login=data["login"]) | Q(email=data["email"])).exists():
        return JsonResponse({"error": "Login or email already exists"}, status=409)

    admin = Administrator(login=data["login"].strip(), email=data["email"].strip(), full_name=data["full_name"].strip())
    admin.set_password(data["password"])
    admin.save()
    request.session["admin_id"] = admin.id
    return JsonResponse({"success": True, "id": admin.id}, status=201)


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
    inst.conditions.set(ConditionType.objects.filter(code__in=conditions))
    inst.admission.set(AdmissionType.objects.filter(code__in=admissions))
    inst.aoop_programs.all().delete()
    AoopProgram.objects.bulk_create(
        [AoopProgram(institution=inst, name=p.get("name", "")) for p in data.get("aoop_programs", []) if p.get("name")]
    )


def _require_admin(request: HttpRequest):
    admin_id = request.session.get("admin_id")
    if not admin_id:
        return None
    return Administrator.objects.filter(id=admin_id).first()


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
