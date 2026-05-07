from django.db import migrations, models


def migrate_rejected_to_disapproved(apps, schema_editor):
    InstitutionReview = apps.get_model("mapapp", "InstitutionReview")
    InstitutionReview.objects.filter(status="rejected").update(status="disapproved")


class Migration(migrations.Migration):
    dependencies = [
        ("mapapp", "0008_institutionreview"),
    ]

    operations = [
        migrations.RunPython(migrate_rejected_to_disapproved, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="institutionreview",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "На модерации"),
                    ("approved", "Одобрен"),
                    ("disapproved", "Отклонен"),
                ],
                default="pending",
                max_length=20,
            ),
        ),
    ]
