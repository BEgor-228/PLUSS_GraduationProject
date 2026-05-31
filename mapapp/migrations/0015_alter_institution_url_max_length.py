from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("mapapp", "0014_userdistrictpreference_portal_main_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="institution",
            name="website",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.AlterField(
            model_name="institution",
            name="aoop_url",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
    ]
