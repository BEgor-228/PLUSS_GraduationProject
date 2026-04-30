import os
import time

from django.core.management.base import BaseCommand
from django.db import IntegrityError

from mapapp.models import Administrator


class Command(BaseCommand):
    help = "Create or update application admin from environment variables."

    def handle(self, *args, **options):
        login = (os.getenv("ADMIN_LOGIN") or os.getenv("DB_USER") or "").strip()
        password = os.getenv("ADMIN_PASSWORD") or os.getenv("DB_PASS")

        if not login or not password:
            self.stdout.write(
                self.style.WARNING(
                    "Skip ensure_admin_from_env: ADMIN_LOGIN/ADMIN_PASSWORD or DB_USER/DB_PASS are not set."
                )
            )
            return

        email = (os.getenv("ADMIN_EMAIL") or f"{login}@local").strip()
        full_name = (os.getenv("ADMIN_FULL_NAME") or "Администратор").strip()

        admin = Administrator.objects.filter(login=login).first()
        created = admin is None
        if created:
            admin = Administrator(login=login)

        admin.full_name = full_name
        admin.email = email
        admin.set_password(password)

        try:
            admin.save()
        except IntegrityError:
            fallback_email = f"{login}.{int(time.time())}@local"
            admin.email = fallback_email
            admin.save()
            self.stdout.write(
                self.style.WARNING(
                    f"Email '{email}' already exists, fallback email '{fallback_email}' was used."
                )
            )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Admin '{login}' created from env."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Admin '{login}' updated from env."))
