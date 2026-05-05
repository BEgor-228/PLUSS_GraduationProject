from django.conf import settings
from django.db import models


class District(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]


class InstitutionType(models.Model):
    code = models.CharField(max_length=20, primary_key=True)
    name_ru = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class ConditionType(models.Model):
    code = models.CharField(max_length=50, primary_key=True)
    name_ru = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class AdmissionType(models.Model):
    code = models.CharField(max_length=20, primary_key=True)
    name_ru = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class AccessibilityCriterionType(models.Model):
    code = models.CharField(max_length=60, primary_key=True)
    name_ru = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Director(models.Model):
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_name"]


class Institution(models.Model):
    name = models.CharField(max_length=255)
    district = models.ForeignKey(District, on_delete=models.PROTECT, related_name="institutions")
    type = models.ForeignKey(InstitutionType, on_delete=models.PROTECT)
    director = models.OneToOneField(Director, on_delete=models.SET_NULL, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    range_min = models.IntegerField(blank=True, null=True)
    range_max = models.IntegerField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    aoop_url = models.URLField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    conditions = models.ManyToManyField(ConditionType, blank=True, related_name="institutions")
    admission = models.ManyToManyField(AdmissionType, blank=True, related_name="institutions")
    accessibility_criteria = models.ManyToManyField(
        AccessibilityCriterionType, blank=True, related_name="institutions"
    )

    class Meta:
        ordering = ["name"]


class AoopProgram(models.Model):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="aoop_programs")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)


class ActionLog(models.Model):
    administrator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=20)
    entity = models.CharField(max_length=50)
    record_id = models.IntegerField(blank=True, null=True)
    old_data = models.JSONField(blank=True, null=True)
    new_data = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Link(models.Model):
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name="links")
    linksTo = models.CharField(max_length=20, blank=True, null=True)
    linkToInstitution = models.TextField(blank=True, null=True)


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "institution"], name="uniq_user_institution_favorite"),
        ]


class ProfileNotification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile_notifications",
    )
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="profile_notifications",
    )
    action_log = models.ForeignKey(
        ActionLog,
        on_delete=models.CASCADE,
        related_name="profile_notifications",
    )
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "action_log"],
                name="uniq_profile_notification_per_user_action",
            ),
        ]


class InstitutionReview(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "На модерации"),
        (STATUS_APPROVED, "Одобрен"),
        (STATUS_REJECTED, "Отклонен"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="institution_reviews",
    )
    institution = models.ForeignKey(
        Institution,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    rating = models.DecimalField(max_digits=3, decimal_places=2)
    criteria_scores = models.JSONField(default=dict, blank=True)
    comment = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
