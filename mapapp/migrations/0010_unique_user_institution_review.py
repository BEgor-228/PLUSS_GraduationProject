from django.db import migrations, models


def dedupe_reviews(apps, schema_editor):
    InstitutionReview = apps.get_model("mapapp", "InstitutionReview")
    duplicates = (
        InstitutionReview.objects.values("user_id", "institution_id")
        .annotate(total=models.Count("id"))
        .filter(total__gt=1)
    )
    for group in duplicates:
        review_ids = list(
            InstitutionReview.objects.filter(
                user_id=group["user_id"],
                institution_id=group["institution_id"],
            )
            .order_by("-created_at", "-id")
            .values_list("id", flat=True)
        )
        ids_to_delete = review_ids[1:]
        if ids_to_delete:
            InstitutionReview.objects.filter(id__in=ids_to_delete).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("mapapp", "0009_review_status_disapproved"),
    ]

    operations = [
        migrations.RunPython(dedupe_reviews, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="institutionreview",
            constraint=models.UniqueConstraint(
                fields=("user", "institution"),
                name="uniq_user_institution_review",
            ),
        ),
    ]
