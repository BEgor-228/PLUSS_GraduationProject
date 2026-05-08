from django.db import migrations, models


def dedupe_institution_names(apps, schema_editor):
    Institution = apps.get_model("mapapp", "Institution")
    duplicates = (
        Institution.objects.values("name")
        .annotate(total=models.Count("id"))
        .filter(total__gt=1)
    )
    max_len = 255
    for group in duplicates:
        base_name = (group.get("name") or "").strip()
        items = list(Institution.objects.filter(name=group["name"]).order_by("id"))
        if not items:
            continue
        for inst in items[1:]:
            suffix = f" ({inst.id})"
            trimmed_base = base_name[: max_len - len(suffix)]
            new_name = f"{trimmed_base}{suffix}"
            inst.name = new_name
            inst.save(update_fields=["name"])


class Migration(migrations.Migration):
    dependencies = [
        ("mapapp", "0010_unique_user_institution_review"),
    ]

    operations = [
        migrations.RunPython(dedupe_institution_names, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="institution",
            name="name",
            field=models.CharField(max_length=255, unique=True),
        ),
    ]
