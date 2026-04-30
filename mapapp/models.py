from django.contrib.auth.hashers import check_password, make_password
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

    class Meta:
        ordering = ["name"]


class AoopProgram(models.Model):
    institution = models.ForeignKey(Institution, on_delete=models.CASCADE, related_name="aoop_programs")
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)


class Administrator(models.Model):
    login = models.CharField(max_length=50, unique=True)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255)
    full_name = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    def set_password(self, raw_password: str) -> None:
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password_hash)


class ActionLog(models.Model):
    administrator = models.ForeignKey(Administrator, on_delete=models.PROTECT)
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
