from django.db import migrations


def repair_auth_user_pk_sequence(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('auth_user', 'id'),
                COALESCE((SELECT MAX(id) FROM auth_user), 1),
                (SELECT MAX(id) IS NOT NULL FROM auth_user)
            )
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("mapapp", "0003_alter_actionlog_administrator_delete_portaluser_and_more"),
    ]

    operations = [
        migrations.RunPython(repair_auth_user_pk_sequence, migrations.RunPython.noop),
    ]
