from django.core.management.base import BaseCommand
from mapapp.models import (
    AccessibilityCriterionType,
    AdmissionType,
    ConditionType,
    District,
    InstitutionType,
)


class Command(BaseCommand):
    help = "Fill reference dictionaries and districts."

    def handle(self, *args, **options):
        institution_types = [
            ("preschool", "Дошкольное образовательное учреждение", "Детские сады, ясли"),
            ("school", "Общеобразовательная школа", "Средние общеобразовательные школы"),
            ("school_internat", "Школа-интернат", "Школы-интернаты с круглосуточным пребыванием"),
            ("spo", "Среднее профессиональное образование", "Колледжи, техникумы"),
            ("vo", "Высшее образование", "Университеты, институты, академии"),
        ]
        condition_types = [
            ("hearing_impairment", "Нарушения слуха", "Для детей с нарушениями слуха"),
            ("vision_impairment", "Нарушения зрения", "Для детей с нарушениями зрения"),
            (
                "musculoskeletal_impairment",
                "Нарушения опорно-двигательного аппарата",
                "Для детей с НОДА",
            ), 
            ("speech_impairment", "Нарушения речи", "Для детей с тяжелыми нарушениями речи"),
            ("mental_retardation", "Умственная отсталость", "Для детей с интеллектуальными нарушениями"),
            ("autism", "Расстройства аутистического спектра", "Для детей с РАС"),
            ("multiple_disorders", "Множественные нарушения развития", "Для детей со сложными дефектами"),
        ]
        admission_types = [
            ("certificate", "Свидетельство об обучении", "Для детей с ОВЗ, получающих свидетельство"),
            ("attestat", "Аттестат", "Для детей, получающих аттестат государственного образца"),
        ]
        accessibility_criteria_types = [
            ("ramps_lifts", "Нормативные пандусы и подъемники", ""),
            (
                "entrance_groups_doorways",
                "Входные группы и дверные проемы",
                "Ширина двери не менее 90 см, пороги отсутствуют или до 1.4 см",
            ),
            (
                "tactile_pedestrian_indicators",
                "Тактильно-пешеходные указатели",
                "Тактильная плитка и рифленая поверхность для навигации",
            ),
            ("braille_signage", "Информационные таблички со шрифтом Брайля", ""),
            ("accessible_sanitary_facilities", "Оборудованные санитарно-гигиенические помещения", ""),
            ("assistant_call_system", "Система вызова помощника", ""),
            (
                "contrast_marking",
                "Контрастная маркировка",
                "Маркировка опасных участков ярким контрастным цветом",
            ),
            ("safety_zones_evacuation_routes", "Зоны безопасности и пути эвакуации", ""),
            ("acoustic_systems_induction_loops", "Акустические системы и индукционные петли", ""),
        ]
        districts = [
            "г. Липецк",
            "г. Елец",
            "Воловский округ",
            "Грязинский округ",
            "Данковский округ",
            "Добринский округ",
            "Добровский округ",
            "Долгоруковский округ",
            "Елецкий округ",
            "Задонский округ",
            "Измалковский округ",
            "Краснинский округ",
            "Лебедянский округ",
            "Лев-Толстовский район",
            "Липецкий округ",
            "Становлянский округ",
            "Тербунский округ",
            "Усманский округ",
            "Хлевенский округ",
            "Чаплыгинский округ",
        ]

        for code, name_ru, description in institution_types:
            InstitutionType.objects.update_or_create(
                code=code,
                defaults={"name_ru": name_ru, "description": description},
            )

        for code, name_ru, description in condition_types:
            ConditionType.objects.update_or_create(
                code=code,
                defaults={"name_ru": name_ru, "description": description},
            )

        for code, name_ru, description in admission_types:
            AdmissionType.objects.update_or_create(
                code=code,
                defaults={"name_ru": name_ru, "description": description},
            )

        for code, name_ru, description in accessibility_criteria_types:
            AccessibilityCriterionType.objects.update_or_create(
                code=code,
                defaults={"name_ru": name_ru, "description": description},
            )

        for name in districts:
            District.objects.get_or_create(name=name)

        self.stdout.write(self.style.SUCCESS("Reference data seeded successfully."))
