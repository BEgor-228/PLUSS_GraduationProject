import os
import time

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.db import IntegrityError

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

        User = get_user_model()
        admin_group, _ = Group.objects.get_or_create(name="administrators")
        admin = User.objects.filter(username=login).first()
        created = admin is None
        if created:
            admin = User(username=login)

        admin.first_name = full_name
        admin.email = email
        admin.set_password(password)
        admin.is_staff = True

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
        admin.groups.add(admin_group)

        if created:
            self.stdout.write(self.style.SUCCESS(f"Admin '{login}' created from env."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Admin '{login}' updated from env."))
