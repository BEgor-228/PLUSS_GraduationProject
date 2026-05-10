from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("mapapp", "0013_userblockstate"),
    ]

    operations = [
        migrations.AddField(
            model_name="userdistrictpreference",
            name="child_age_max",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userdistrictpreference",
            name="child_age_min",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userdistrictpreference",
            name="prefer_aoop",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="userdistrictpreference",
            name="preferred_accessibility_codes",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="userdistrictpreference",
            name="preferred_condition_codes",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="userdistrictpreference",
            name="preferred_institution_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="user_preferences_by_type",
                to="mapapp.institutiontype",
            ),
        ),
        migrations.AddField(
            model_name="userdistrictpreference",
            name="school_class_from",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="userdistrictpreference",
            name="school_class_to",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
    ]
