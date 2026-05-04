from django.contrib import admin

from .models import (
    ActionLog,
    AccessibilityCriterionType,
    AdmissionType,
    AoopProgram,
    ConditionType,
    Director,
    District,
    Institution,
    InstitutionType,
    Link,
)

admin.site.register(District)
admin.site.register(InstitutionType)
admin.site.register(ConditionType)
admin.site.register(AdmissionType)
admin.site.register(AccessibilityCriterionType)
admin.site.register(Director)
admin.site.register(Institution)
admin.site.register(AoopProgram)
admin.site.register(ActionLog)
admin.site.register(Link)
