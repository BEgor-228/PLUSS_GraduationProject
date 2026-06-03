-- Импорт школ г. Ельца (PostgreSQL, схема Django mapapp_*)
--
-- Требования перед запуском:
--   1. Выполнены миграции Django (python manage.py migrate)
--   2. Заполнены справочники (python manage.py seed_reference_data)
--
-- Правила заполнения:
--   СОШ / средняя / гимназия / лицей  -> range_min=5,  range_max=11
--   ООШ / основная                    -> range_min=1,  range_max=9
--   Школа № 18, № 19                  -> range_min=1,  range_max=11
--   admission — не заполняются
--   conditions — заполняются для СШ №12, Гимназии №11 и Гимназии №97 (см. секцию 5)
--   accessibility_criteria — заполняются для тех же школ (см. секцию 6)
--   АООП: aoop_url + названия программ из исходного файла
--
-- Примечания к исходному файлу:
--   МБОУ «Школа № 18 г. Ельца» — официальный сайт в источнике не указан, website = NULL
--   МБОУ «СШ №24 …» — две адаптированные программы (ТНР и ЗПР), aoop_url = PDF ТНР

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Директора (телефон из источника, один основной номер)
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_director (full_name, phone, email, created_at, updated_at)
VALUES
    ('Гришанова Ольга Васильевна', '+7 (47467) 2-73-46', 'sc1el@schools48.ru', NOW(), NOW()),
    ('Алехина Ирина Юрьевна', '+7 (47467) 2-46-35', 'sc5el@schools48.ru', NOW(), NOW()),
    ('Краюшкина Елена Юрьевна', '+7 (47467) 2-34-62', 'sc8el@schools48.ru', NOW(), NOW()),
    ('Позняк Татьяна Владимировна', '+7 (47467) 5-46-71', 'sc10el@schools48.ru', NOW(), NOW()),
    ('Камышанова Татьяна Геннадьевна', '+7 (47467) 4-07-43', 'sc11el@schools48.ru', NOW(), NOW()),
    ('Феодори Наталия Александровна', '+7 (47467) 5-78-92', 'sc12el@schools48.ru', NOW(), NOW()),
    ('Ролдугина Ирина Анатольевна', '+7 (47467) 2-55-00', 'sc15el@schools48.ru', NOW(), NOW()),
    ('Демина Оксана Николаевна', '+7 (47467) 6-40-16', 'sc17el@schools48.ru', NOW(), NOW()),
    ('Анчуков Игорь Петрович', '+7 (47467) 6-70-40', 'sc18el@schools48.ru', NOW(), NOW()),
    ('Сергеева Алла Александровна', '+7 (47467) 2-46-08', 'sc19el@schools48.ru', NOW(), NOW()),
    ('Красова Светлана Васильевна', '+7 (47467) 5-90-84', 'sc23el@schools48.ru', NOW(), NOW()),
    ('Портнова Елена Владимировна', '+7 (47467) 6-29-09', 'sc24el@schools48.ru', NOW(), NOW()),
    ('Пирогова Вера Алексеевна', '+7 (47467) 4-65-36', 'sc97el@schools48.ru', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 2. Временная таблица с данными учреждений
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _yelets_import (
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    range_min       INTEGER NOT NULL,
    range_max       INTEGER NOT NULL,
    website         VARCHAR(500),
    aoop_url        VARCHAR(500),
    address         TEXT,
    director_name   VARCHAR(150)
) ON COMMIT DROP;

INSERT INTO _yelets_import (name, description, range_min, range_max, website, aoop_url, address, director_name) VALUES
(
    'МБОУ СШ №1 им. М. М. Пришвина',
    'Муниципальное бюджетное общеобразовательное учреждение "Средняя школа №1 им. М. М. Пришвина".',
    5, 11,
    'https://sh1-elec-r42.gosweb.gosuslugi.ru/',
    'https://sh1-elec-r42.gosweb.gosuslugi.ru/netcat_files/33/46/RP_9.1.zip',
    'Корпус №1: 399770, Липецкая область, г. Елец, ул. Советская, д.121 | Корпус №2: 399776, г. Елец, ул. 3-й Ламской переулок, д. 43-а | Корпус №3: 399770, г. Елец, ул. Профинтерна, д. 2-а',
    'Гришанова Ольга Васильевна'
),
(
    'МБОУ «Лицей № 5 г. Ельца»',
    'Муниципальное бюджетное общеобразовательное учреждение "Лицей №5 города Ельца".',
    5, 11,
    'https://lic5-elec-r42.gosweb.gosuslugi.ru/', NULL,
    '399774, Липецкая обл., г. Елец, ул. Спутников, д.9',
    'Алехина Ирина Юрьевна'
),
(
    'МБОУ «Средняя школа № 8 г. Ельца»',
    'Муниципальное бюджетное общеобразовательное учреждение "Средняя школа № 8 г. Ельца".',
    5, 11,
    'https://sh8-elec-r42.gosweb.gosuslugi.ru/', NULL,
    'Корпус №1: 399772, г. Елец, ул. А. Гайтеровой, д.1А | Корпус №2: 399772, г. Елец, ул. Ефремовская, д.1',
    'Краюшкина Елена Юрьевна'
),
(
    'МБОУ "СШ №10 с углубленным изучением отдельных предметов"',
    'Муниципальное бюджетное общеобразовательное учреждение "Средняя школа №10 с углубленным изучением отдельных предметов".',
    5, 11,
    'https://sh10-elec-r42.gosweb.gosuslugi.ru/', NULL,
    '399774, Липецкая область, городской округ город Елец, ул. Юбилейная, д. 7а',
    'Позняк Татьяна Владимировна'
),
(
    'МБОУ "Гимназия № 11 г. Ельца"',
    'Муниципальное бюджетное общеобразовательное учреждение "Гимназия № 11 города Ельца".',
    5, 11,
    'https://gimnaziya11.gosuslugi.ru/', NULL,
    '399774, Липецкая обл., г. Елец, ул. Радиотехническая, д.3',
    'Камышанова Татьяна Геннадьевна'
),
(
    'МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"',
    'Мунициальное автономное общеобразовательное учреждение "Средняя школа №12 им. Героя Российской Федерации В.А. Дорохина" Липецкой области.',
    5, 11,
    'https://sh12-elec-r42.gosweb.gosuslugi.ru/', NULL,
    '399778, Липецкая область, г. Елец, мкрн. Александровский, д. 15',
    'Феодори Наталия Александровна'
),
(
    'МБОУ «Основная школа № 15 г. Ельца»',
    'Муниципальное бюджетное общеобразовательное учреждение "Основная школа №15 города Ельца".',
    1, 9,
    'https://elschool15.gosuslugi.ru/', NULL,
    '399770, г. Елец, ул. Мира, д. 83 (корпус №1) | г. Елец, ул. Мира, д. 84 (корпус №2)',
    'Ролдугина Ирина Анатольевна'
),
(
    'МБОУ «Основная школа № 17 им. Т.Н. Хренникова»',
    'Муниципальное бюджетное общеобразовательное учреждение "Основная школа № 17 им. Т.Н. Хренникова".',
    1, 9,
    'https://sc17el.gosuslugi.ru/', NULL,
    'Корпус №1: г. Елец, ул. Алеши Оборотова, д.4 | Корпус №2: г. Елец, ул. Рязано-Уральская, д.43 | Корпус №3: г. Елец, ул. Верхняя, д.17',
    'Демина Оксана Николаевна'
),
(
    'МБОУ «Школа № 18 г. Ельца»',
    'Муниципальное бюджетное общеобразовательное учреждение «Школа № 18 города Ельца».',
    1, 11,
    NULL, NULL,
    'Липецкая обл., г. Елец, ул. Кротевича, д. 6А',
    'Анчуков Игорь Петрович'
),
(
    'МБОУ «Школа № 19 г. Ельца»',
    'Муниципальное бюджетное общеобразовательное учреждение «Школа № 19 города Ельца».',
    1, 11,
    'https://sc19elets.gosuslugi.ru/', NULL,
    'г. Елец, ул. М.Горького, д.113 (корпус 1) | г. Елец, ул. М.Горького, д.107 (корпус 2)',
    'Сергеева Алла Александровна'
),
(
    'МБОУ «Средняя школа № 23 г. Ельца»',
    'Муниципальное бюджетное общеобразовательное учреждение "Средняя школа №23 города Ельца".',
    5, 11,
    'https://sc23-elec.gosuslugi.ru/', NULL,
    '399785, г. Елец, ул. Известковая, 71а (корпус 1) | 399773, г. Елец, ул. Вермишева, 1 (корпус 2)',
    'Красова Светлана Васильевна'
),
(
    'МБОУ «СШ №24 им.Героя Российской Федерации Н.И.Семочкина»',
    'Муниципальное бюджетное общеобразовательное учреждение «СШ №24 им. Героя Российской Федерации Н.И. Семочкина».',
    5, 11,
    'https://sh24-elec.gosuslugi.ru/',
    'https://sh24elec.gosuslugi.ru/netcat_files/33/46/Adaptirovannaya_programma_TNR.pdf',
    '399784, Липецкая область, г. Елец, ул. Гагарина, д.20 а.',
    'Портнова Елена Владимировна'
),
(
    'МБОУ "Гимназия № 97 г. Ельца"',
    'Муниципальное бюджетное общеобразовательное учреждение "Гимназия № 97 г. Ельца".',
    5, 11,
    'https://gimn97-elec-r42.gosweb.gosuslugi.ru/', NULL,
    '399773, Липецкая область, г. Елец, ул. Клубная, д.10',
    'Пирогова Вера Алексеевна'
);

-- ---------------------------------------------------------------------------
-- 3. Вставка учреждений
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_institution (
    name, description, range_min, range_max, website, aoop_url, address,
    district_id, type_id, director_id, created_at, updated_at
)
SELECT
    y.name,
    y.description,
    y.range_min,
    y.range_max,
    y.website,
    y.aoop_url,
    y.address,
    d.id,
    'school',
    dir.id,
    NOW(),
    NOW()
FROM _yelets_import y
CROSS JOIN mapapp_district d
LEFT JOIN mapapp_director dir ON dir.full_name = y.director_name
WHERE d.name = 'г. Елец'
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Программы АООП (названия из исходного файла)
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_aoopprogram (name, institution_id, created_at)
SELECT
    'Рабочие программы для обучающихся с умственной отсталостью',
    i.id,
    NOW()
FROM mapapp_institution i
WHERE i.name = 'МБОУ СШ №1 им. М. М. Пришвина'
  AND NOT EXISTS (
      SELECT 1 FROM mapapp_aoopprogram p WHERE p.institution_id = i.id
  );

INSERT INTO mapapp_aoopprogram (name, institution_id, created_at)
SELECT
    'Адаптированная программа ТНР на 2025 - 2026 учебный год',
    i.id,
    NOW()
FROM mapapp_institution i
WHERE i.name = 'МБОУ «СШ №24 им.Героя Российской Федерации Н.И.Семочкина»'
  AND NOT EXISTS (
      SELECT 1 FROM mapapp_aoopprogram p
      WHERE p.institution_id = i.id
        AND p.name = 'Адаптированная программа ТНР на 2025 - 2026 учебный год'
  );

INSERT INTO mapapp_aoopprogram (name, institution_id, created_at)
SELECT
    'Адаптированная программа ЗПР на 2025 - 2026 учебный год',
    i.id,
    NOW()
FROM mapapp_institution i
WHERE i.name = 'МБОУ «СШ №24 им.Героя Российской Федерации Н.И.Семочкина»'
  AND NOT EXISTS (
      SELECT 1 FROM mapapp_aoopprogram p
      WHERE p.institution_id = i.id
        AND p.name = 'Адаптированная программа ЗПР на 2025 - 2026 учебный год'
  );

-- ---------------------------------------------------------------------------
-- 5. Особые условия поступления (ОВЗ)
--    Источники: разделы «Доступная среда» и «Образование» на сайтах школ
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _yelets_conditions (
    institution_name VARCHAR(255) NOT NULL,
    condition_code   VARCHAR(50) NOT NULL
) ON COMMIT DROP;

INSERT INTO _yelets_conditions (institution_name, condition_code) VALUES
    -- МАОУ "СШ№12 им. В.А.Дорохина" — нарушения слуха, зрения, ОДА
    ('МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"', 'hearing_impairment'),
    ('МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"', 'vision_impairment'),
    ('МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"', 'musculoskeletal_impairment'),

    -- МБОУ "Гимназия № 11 г. Ельца" — все категории, кроме РАС (включая ЗПР и множественные)
    ('МБОУ "Гимназия № 11 г. Ельца"', 'hearing_impairment'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'vision_impairment'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'musculoskeletal_impairment'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'speech_impairment'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'mental_retardation'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'multiple_disorders'),

    -- МБОУ "Гимназия № 97 г. Ельца" — нарушения слуха, зрения, ОДА
    ('МБОУ "Гимназия № 97 г. Ельца"', 'hearing_impairment'),
    ('МБОУ "Гимназия № 97 г. Ельца"', 'vision_impairment'),
    ('МБОУ "Гимназия № 97 г. Ельца"', 'musculoskeletal_impairment');

INSERT INTO mapapp_institution_conditions (institution_id, conditiontype_id)
SELECT i.id, c.condition_code
FROM _yelets_conditions c
JOIN mapapp_institution i ON i.name = c.institution_name
ON CONFLICT (institution_id, conditiontype_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Критерии физической доступности
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _yelets_accessibility (
    institution_name VARCHAR(255) NOT NULL,
    criterion_code   VARCHAR(60) NOT NULL
) ON COMMIT DROP;

INSERT INTO _yelets_accessibility (institution_name, criterion_code) VALUES
    -- СШ №12: пандус, тифлотехника (без Брайля/индукции/эвакуации)
    ('МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"', 'ramps_lifts'),
    ('МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"', 'entrance_groups_doorways'),
    ('МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"', 'tactile_pedestrian_indicators'),
    ('МАОУ "СШ№12 им.Героя Российской Федерации В.А.Дорохина"', 'accessible_sanitary_facilities'),

    -- Гимназия №11: подробная доступная среда (без акустики/эвакуации)
    ('МБОУ "Гимназия № 11 г. Ельца"', 'ramps_lifts'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'entrance_groups_doorways'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'tactile_pedestrian_indicators'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'braille_signage'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'accessible_sanitary_facilities'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'assistant_call_system'),
    ('МБОУ "Гимназия № 11 г. Ельца"', 'contrast_marking'),

    -- Гимназия №97: доступная среда без Брайля/индукции/эвакуации
    ('МБОУ "Гимназия № 97 г. Ельца"', 'ramps_lifts'),
    ('МБОУ "Гимназия № 97 г. Ельца"', 'entrance_groups_doorways'),
    ('МБОУ "Гимназия № 97 г. Ельца"', 'tactile_pedestrian_indicators'),
    ('МБОУ "Гимназия № 97 г. Ельца"', 'accessible_sanitary_facilities'),
    ('МБОУ "Гимназия № 97 г. Ельца"', 'assistant_call_system'),
    ('МБОУ "Гимназия № 97 г. Ельца"', 'contrast_marking');

INSERT INTO mapapp_institution_accessibility_criteria (institution_id, accessibilitycriteriontype_id)
SELECT i.id, a.criterion_code
FROM _yelets_accessibility a
JOIN mapapp_institution i ON i.name = a.institution_name
ON CONFLICT (institution_id, accessibilitycriteriontype_id) DO NOTHING;

COMMIT;

-- Проверка после вставки:
-- SELECT COUNT(*) FROM mapapp_institution i
-- JOIN mapapp_district d ON d.id = i.district_id
-- WHERE d.name = 'г. Елец';
--
-- SELECT i.name, p.name AS aoop_program
-- FROM mapapp_institution i
-- JOIN mapapp_district d ON d.id = i.district_id
-- LEFT JOIN mapapp_aoopprogram p ON p.institution_id = i.id
-- WHERE d.name = 'г. Елец'
-- ORDER BY i.name, p.name;
