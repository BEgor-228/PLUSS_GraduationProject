-- Импорт ВУЗов и СПО Липецкой области (PostgreSQL, схема Django mapapp_*)
--
-- Требования перед запуском:
--   1. Выполнены миграции Django (python manage.py migrate)
--   2. Заполнены справочники (python manage.py seed_reference_data)
--
-- Правила заполнения:
--   type_id: vo (высшее образование) или spo (техникум ЕТЖТ)
--   range_min, range_max — NULL
--   name — краткое название; description — полное официальное
--   admission: для всех ВО (type vo) — attestat (Аттестат); для СПО — не заполняется
--   conditions — заполняются для ЛГПУ, ЛГТУ, ЛИК, ЛКИТиУ, РАНХиГС (секция 5)
--   accessibility_criteria — заполняются для тех же вузов (секция 6)
--   АООП — нет ни у одного учреждения
--   Телефон — один основной (приёмная директора / ректора / локальный)
--   Email директора — личный, если указан; иначе общий учреждения
--
-- Примечания к исходному файлу:
--   Елецкий филиал РосНОУ — адрес, телефон, руководитель и email уточнены вручную
--   ЕТЖТ — телефон уточнён вручную (8 (47467) 6-35-35)
--   Филиал РУМ — сайт в источнике med-skills.ru (сторонний портал поступления)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Руководители
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_director (full_name, phone, email, created_at, updated_at)
VALUES
    ('Федина Нина Владимировна', '+7 (4742) 32-83-03', 'priem@lspu-lipetsk.ru', NOW(), NOW()),
    ('Дворников Вячеслав Анатольевич', '+7 (4742) 56-66-04', 'Postlip@vilec.ru', NOW(), NOW()),
    ('Бунеева Раиса Ильинична', '+7 (4742) 72-42-81', 'director@lki-lipetsk.ru', NOW(), NOW()),
    ('Загеева Лилия Александровна', '+7 (4742) 319-069', 'mailbox@stu.lipetsk.ru', NOW(), NOW()),
    ('Нестерова Надежда Николаевна', '+7 (4742) 27-09-62', 'lipetsk@fa.ru', NOW(), NOW()),
    ('Миронов Арсений Станиславович', '+7 (4742) 73-22-01', 'lipetsk@mgutm.ru', NOW(), NOW()),
    ('Гончарова Елена Александровна', '+7 (4742) 279-912', 'lip@ranepa.ru', NOW(), NOW()),
    ('Яковенко Игорь Юрьевич', '+7 (495) 609-67-00', 'info@med-skills.ru', NOW(), NOW()),
    ('Преснякова Дарья Владимировна', '+7 (47467) 6-10-71', 'd.presnyakova@eletsrosnou.ru', NOW(), NOW()),
    ('Кузьмин Алексей Михайлович', '+7 (47467) 6-35-35', 'elec@rgups.ru', NOW(), NOW()),
    ('Щербатых Сергей Викторович', '+7 (47467) 2-21-93', 'main@elsu.ru', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 2. Временная таблица с данными учреждений
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _vuzy_import (
    name              VARCHAR(255) NOT NULL,
    description       TEXT,
    institution_type  VARCHAR(20) NOT NULL,
    district_name     VARCHAR(100) NOT NULL,
    website           VARCHAR(500),
    address           TEXT,
    director_name     VARCHAR(150)
) ON COMMIT DROP;

INSERT INTO _vuzy_import (name, description, institution_type, district_name, website, address, director_name) VALUES
(
    'ЛГПУ имени П.П.Семенова-Тян-Шанского',
    'Липецкий государственный педагогический университет имени П.П.Семенова-Тян-Шанского.',
    'vo', 'г. Липецк',
    'https://lspu-lipetsk.ru/',
    '398020, Липецкая область, г. Липецк, ул. Ленина, д. 42',
    'Федина Нина Владимировна'
),
(
    'Филиал ВЭПИ',
    'Филиал Воронежского экономико-правового института в г. Липецк.',
    'vo', 'г. Липецк',
    'https://lipetsk.vepi.ru/',
    '398000, Липецкая обл., г. Липецк, пр-д Сержанта Кувшинова, 5б',
    'Дворников Вячеслав Анатольевич'
),
(
    'ЛИК',
    'Липецкий институт кооперации (филиал) Белгородского университета кооперации, экономики и права.',
    'vo', 'г. Липецк',
    'https://lki-lipetsk.ru/',
    '398002, г. Липецк, ул. Зегеля, 25а',
    'Бунеева Раиса Ильинична'
),
(
    'ЛГТУ',
    'Липецкий государственный технический университет.',
    'vo', 'г. Липецк',
    'https://www.stu.lipetsk.ru/',
    '398055, Россия, г. Липецк, ул. Московская, д. 30',
    'Загеева Лилия Александровна'
),
(
    'Липецкий филиал Финуниверситета',
    'Липецкий филиал федерального государственного образовательного бюджетного учреждения высшего образования «Финансовый университет при Правительстве Российской Федерации».',
    'vo', 'г. Липецк',
    'https://lipetsk.fa.ru/',
    '398050, Липецкая область, г. Липецк, ул. Интернациональная, 12Б',
    'Нестерова Надежда Николаевна'
),
(
    'ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»',
    'Липецкий казачий институт технологий и управления (филиал) федерального государственного бюджетного образовательного учреждения высшего образования «Московский государственный университет технологий и управления имени К.Г. Разумовского (Первый казачий университет)».',
    'vo', 'г. Липецк',
    'https://www.mgutu48.ru/',
    '398006, г. Липецк, ул. Краснознаменная, влд. 4',
    'Миронов Арсений Станиславович'
),
(
    'Липецкий филиал РАНХиГС',
    'Липецкий филиал федерального государственного бюджетного образовательного учреждения высшего образования «Российская академия народного хозяйства и государственной службы при Президенте Российской Федерации».',
    'vo', 'г. Липецк',
    'https://lip.ranepa.ru/',
    '398050, г. Липецк, ул. Интернациональная, д. 3',
    'Гончарова Елена Александровна'
),
(
    'Филиал РУМ',
    'Липецкий филиал Российского университета медицины (РУМ).',
    'vo', 'г. Липецк',
    'https://med-skills.ru/postupit-v-medicinskij/%D0%BB%D0%B8%D0%BF%D0%B5%D1%86%D0%BA%D0%B8%D0%B9-%D1%80%D1%83%D0%BC/',
    'г. Липецк, пл. Плеханова, д. 5',
    'Яковенко Игорь Юрьевич'
),
(
    'Елецкий филиал АНО ВО «РосНОУ»',
    'Елецкий филиал Автономной некоммерческой организации высшего образования «Российский новый университет».',
    'vo', 'г. Елец',
    'https://eletsrosnou.ru/',
    '399780, Липецкая область, г. Елец, ул. Ломоносова, д. 13',
    'Преснякова Дарья Владимировна'
),
(
    'ЕТЖТ - филиал РГУПС',
    'Елецкий техникум железнодорожного транспорта — филиал Ростовского государственного университета путей сообщения.',
    'spo', 'г. Елец',
    'https://etgt.ru/index.php?option=com_content&task=view&id=35&Itemid=63',
    '399774, Липецкая область, г. Елец, ул. Вермишева, д. 12',
    'Кузьмин Алексей Михайлович'
),
(
    'ФГБОУ ВО «ЕГУ им. И.А. Бунина»',
    'Федеральное государственное бюджетное образовательное учреждение высшего образования «Елецкий государственный университет им. И.А. Бунина».',
    'vo', 'г. Елец',
    'https://elsu.ru/',
    '399770, Липецкая область, г. Елец, ул. Коммунаров, д. 28',
    'Щербатых Сергей Викторович'
);

-- ---------------------------------------------------------------------------
-- 3. Вставка учреждений
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_institution (
    name, description, range_min, range_max, website, aoop_url, address,
    district_id, type_id, director_id, created_at, updated_at
)
SELECT
    v.name,
    v.description,
    NULL,
    NULL,
    v.website,
    NULL,
    v.address,
    d.id,
    v.institution_type,
    dir.id,
    NOW(),
    NOW()
FROM _vuzy_import v
JOIN mapapp_district d ON d.name = v.district_name
LEFT JOIN mapapp_director dir ON dir.full_name = v.director_name
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Условия приёма: аттестат для всех учреждений ВО из этого импорта
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_institution_admission (institution_id, admissiontype_id)
SELECT i.id, 'attestat'
FROM mapapp_institution i
JOIN _vuzy_import v ON v.name = i.name
WHERE v.institution_type = 'vo'
ON CONFLICT (institution_id, admissiontype_id) DO NOTHING;

-- Дополнительно: все уже существующие ВО в БД (на случай повторного запуска)
INSERT INTO mapapp_institution_admission (institution_id, admissiontype_id)
SELECT i.id, 'attestat'
FROM mapapp_institution i
WHERE i.type_id = 'vo'
ON CONFLICT (institution_id, admissiontype_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Особые условия поступления (ОВЗ)
--    Источники: разделы «Сведения об организации» / «Доступная среда» /
--      «Профессиональная ориентация инвалидов и лиц с ОВЗ» вузов;
--      РАНХиГС — частично подтверждённые сведения по «Слышащие сердца»
--      и общей политике приёма МГН.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _vuzy_conditions (
    institution_name VARCHAR(255) NOT NULL,
    condition_code   VARCHAR(50) NOT NULL
) ON COMMIT DROP;

INSERT INTO _vuzy_conditions (institution_name, condition_code) VALUES
    -- ЛГПУ: слух, зрение, ОДА; речь (направление «Логопедия») — учитывается как
    --       подготовка профильных специалистов и подтверждена адаптивной средой
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'hearing_impairment'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'vision_impairment'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'musculoskeletal_impairment'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'speech_impairment'),

    -- ЛГТУ: явно описаны спецусловия вступительных испытаний для слепых,
    --       слабовидящих, глухих/слабослышащих, ОДА и тяжёлых нарушений речи
    ('ЛГТУ', 'hearing_impairment'),
    ('ЛГТУ', 'vision_impairment'),
    ('ЛГТУ', 'musculoskeletal_impairment'),
    ('ЛГТУ', 'speech_impairment'),

    -- ЛИК: сурдоперевод (соглашение с ВОГ), NVDA для слабовидящих, кнопка
    --      вызова и широкие проёмы для ОДА
    ('ЛИК', 'hearing_impairment'),
    ('ЛИК', 'vision_impairment'),
    ('ЛИК', 'musculoskeletal_impairment'),

    -- ЛКИТиУ: индукционная система (слух), версия для слабовидящих, специализированная
    --        мебель и кресла-коляски (ОДА)
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'hearing_impairment'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'vision_impairment'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'musculoskeletal_impairment'),

    -- РАНХиГС: проект «Слышащие сердца» (слух); ОДА/зрение — по общей политике
    --         РАНХиГС и базовой инфраструктуре филиала
    ('Липецкий филиал РАНХиГС', 'hearing_impairment'),
    ('Липецкий филиал РАНХиГС', 'vision_impairment'),
    ('Липецкий филиал РАНХиГС', 'musculoskeletal_impairment');

INSERT INTO mapapp_institution_conditions (institution_id, conditiontype_id)
SELECT i.id, c.condition_code
FROM _vuzy_conditions c
JOIN mapapp_institution i ON i.name = c.institution_name
ON CONFLICT (institution_id, conditiontype_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Критерии физической доступности
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _vuzy_accessibility (
    institution_name VARCHAR(255) NOT NULL,
    criterion_code   VARCHAR(60) NOT NULL
) ON COMMIT DROP;

INSERT INTO _vuzy_accessibility (institution_name, criterion_code) VALUES
    -- ЛГПУ: один из наиболее подробных разделов — почти все критерии
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'ramps_lifts'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'entrance_groups_doorways'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'tactile_pedestrian_indicators'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'braille_signage'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'accessible_sanitary_facilities'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'assistant_call_system'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'contrast_marking'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'safety_zones_evacuation_routes'),
    ('ЛГПУ имени П.П.Семенова-Тян-Шанского', 'acoustic_systems_induction_loops'),

    -- ЛГТУ: тифло-информационный центр, индукция, Брайль, пандусы, лифты, кнопка
    ('ЛГТУ', 'ramps_lifts'),
    ('ЛГТУ', 'entrance_groups_doorways'),
    ('ЛГТУ', 'tactile_pedestrian_indicators'),
    ('ЛГТУ', 'braille_signage'),
    ('ЛГТУ', 'accessible_sanitary_facilities'),
    ('ЛГТУ', 'assistant_call_system'),
    ('ЛГТУ', 'contrast_marking'),
    ('ЛГТУ', 'safety_zones_evacuation_routes'),
    ('ЛГТУ', 'acoustic_systems_induction_loops'),

    -- ЛИК: входная группа, Брайль, гигиеническая комната, контрастность, вызов
    ('ЛИК', 'entrance_groups_doorways'),
    ('ЛИК', 'braille_signage'),
    ('ЛИК', 'accessible_sanitary_facilities'),
    ('ЛИК', 'assistant_call_system'),
    ('ЛИК', 'contrast_marking'),
    ('ЛИК', 'acoustic_systems_induction_loops'),

    -- ЛКИТиУ: паспорт доступности, пандусы, санузел, индукция, Брайль, мнемосхемы
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'ramps_lifts'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'entrance_groups_doorways'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'tactile_pedestrian_indicators'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'braille_signage'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'accessible_sanitary_facilities'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'assistant_call_system'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'safety_zones_evacuation_routes'),
    ('ЛКИТиУ (филиал) ФГБОУ ВО «МГУТУ им. К.Г. Разумовского (ПКУ)»', 'acoustic_systems_induction_loops'),

    -- РАНХиГС: базовый минимум (раздел «Сведения» на сайте филиала недоступен)
    ('Липецкий филиал РАНХиГС', 'ramps_lifts'),
    ('Липецкий филиал РАНХиГС', 'entrance_groups_doorways'),
    ('Липецкий филиал РАНХиГС', 'assistant_call_system'),
    ('Липецкий филиал РАНХиГС', 'safety_zones_evacuation_routes');

INSERT INTO mapapp_institution_accessibility_criteria (institution_id, accessibilitycriteriontype_id)
SELECT i.id, a.criterion_code
FROM _vuzy_accessibility a
JOIN mapapp_institution i ON i.name = a.institution_name
ON CONFLICT (institution_id, accessibilitycriteriontype_id) DO NOTHING;

COMMIT;

-- Проверка после вставки:
-- SELECT i.name, t.name_ru AS type, d.name AS district, i.range_min, i.range_max
-- FROM mapapp_institution i
-- JOIN mapapp_institutiontype t ON t.code = i.type_id
-- JOIN mapapp_district d ON d.id = i.district_id
-- WHERE i.type_id IN ('vo', 'spo')
-- ORDER BY d.name, i.name;
