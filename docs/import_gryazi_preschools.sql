-- Импорт детских садов Грязинского округа (PostgreSQL, схема Django mapapp_*)
--
-- Требования перед запуском:
--   1. Выполнены миграции Django (python manage.py migrate)
--   2. Заполнены справочники (python manage.py seed_reference_data)
--
-- Правила заполнения:
--   type_id = preschool, range_min=2, range_max=8 (возраст в годах)
--   name — краткое название; description — полное официальное
--   admission, conditions, accessibility_criteria — не заполняются
--   АООП: aoop_url (первая/единственная программа) + названия в mapapp_aoopprogram
--   Телефон — не указан в источнике (NULL)
--
-- Примечания:
--   МАДОУ д/с № 8 «Родничок» — aoop_url = вторая ссылка из источника (ЗПР)

BEGIN;

ALTER TABLE mapapp_institution
    ALTER COLUMN website TYPE VARCHAR(500),
    ALTER COLUMN aoop_url TYPE VARCHAR(500);

-- ---------------------------------------------------------------------------
-- 1. Заведующие
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_director (full_name, phone, email, created_at, updated_at)
VALUES
    ('Кочкина Виктория Владимировна', NULL, '1detskii.sad@mail.ru', NOW(), NOW()),
    ('Конопелкина Елена Александровна', NULL, 'malyshok-grz@mail.ru', NOW(), NOW()),
    ('Богданова Светлана Сергеевна', NULL, 'ds-raduga-gryazi@yandex.ru', NOW(), NOW()),
    ('Фалькович Татьяна Николаевна', NULL, 'detsad-rodnichek@yandex.ru', NOW(), NOW()),
    ('Чурилова Татьяна Александровна', NULL, 'ds9gr48.tchurilowa@yandex.ru', NOW(), NOW()),
    ('Субботина Ирина Васильевна', NULL, 'dubravushka10@mail.ru', NOW(), NOW()),
    ('Ли Диана Владимировна', NULL, 'detskijsadv11@mail.ru', NOW(), NOW()),
    ('Суринова Елена Константиновна', NULL, 'syrinova79@mail.ru', NOW(), NOW()),
    ('Беззубцева Светлана Анатольевна', NULL, 'rodsenyavka@yandex.ru', NOW(), NOW()),
    ('Ульшина Ирина Ивановна', NULL, 'svetliachek48@yandex.ru', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- 2. Временная таблица
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _gryazi_preschool_import (
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    website         VARCHAR(500),
    aoop_url        VARCHAR(500),
    address         TEXT,
    director_name   VARCHAR(150)
) ON COMMIT DROP;

INSERT INTO _gryazi_preschool_import (name, description, website, aoop_url, address, director_name) VALUES
(
    'МБДОУ д/с № 1 г. Грязи',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад № 1 г. Грязи Грязинского муниципального округа Липецкой области.',
    'https://ds1-gryazi-r42.gosweb.gosuslugi.ru/',
    'https://ds1-gryazi-r42.gosweb.gosuslugi.ru/svedeniya-ob-obrazovatelnoy-organizatsii/dokumenty/adaptirovannaya-obrazovatelnaya-programma-doshkolnogo-obrazovaniya-dlya-detey-s-tyazhelymi-narusheniyami-rechi-mbdou-ds-1-g-gryazi.html',
    '399055, Липецкая область, г. Грязи, ул. Станционная, д. 1',
    'Кочкина Виктория Владимировна'
),
(
    'МБДОУ д/с №2 «Малышок» г. Грязи',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад №2 «Малышок» г. Грязи Грязинского муниципального района Липецкой области.',
    'https://ds2griazy.gosuslugi.ru/',
    NULL,
    '399053, г. Грязи, ул. Коммунальная, д. 16',
    'Конопелкина Елена Александровна'
),
(
    'МБДОУ д/с №3 «Радуга» г. Грязи',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад №3 «Радуга» г. Грязи Грязинского муниципального района Липецкой области.',
    'https://dou3gryazi.gosuslugi.ru/',
    NULL,
    '399058, Липецкая область, г. Грязи, ул. Некрасова, д. 1',
    'Богданова Светлана Сергеевна'
),
(
    'МАДОУ д/с № 8 «Родничок» г. Грязи',
    'Муниципальное автономное дошкольное образовательное учреждение детский сад № 8 «Родничок» г. Грязи Грязинского муниципального района Липецкой области.',
    'https://rod8gryazi.gosuslugi.ru/',
    'https://rod8gryazi.gosuslugi.ru/svedeniya-ob-obrazovatelnoy-organizatsii/dokumenty/adaptirovannaya-obrazovatelnaya-programma-doshkolnogo-obrazovaniya-dlya-detey-s-zaderzhkoy-psihicheskogo-razvitiya-madou-ds-8-rodnichok-g-gryazi.html',
    '399059, Липецкая область, г. Грязи, ул. Гастелло, д. 5',
    'Фалькович Татьяна Николаевна'
),
(
    'МАДОУ д/с № 9 г. Грязи',
    'Муниципальное автономное дошкольное образовательное учреждение детский сад общеразвивающего вида № 9 «Василек» г. Грязи Грязинского муниципального района Липецкой области.',
    'https://ds-9vasilek-gryazi-r42.gosweb.gosuslugi.ru/',
    'https://ds-9vasilek-gryazi-r42.gosweb.gosuslugi.ru/svedeniya-ob-obrazovatelnoy-organizatsii/dokumenty/adaptirovannaya-obrazovatelnaya-programma.html',
    '399059, Липецкая область, г. Грязи, ул. Гризодубовой, д. 31а',
    'Чурилова Татьяна Александровна'
),
(
    'МБДОУ д/с № 10 г. Грязи',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад № 10 г. Грязи Грязинского муниципального района Липецкой области.',
    'https://ds-10dubravushka-gryazi-r42.gosweb.gosuslugi.ru/',
    NULL,
    '399057, Липецкая область, г. Грязи, ул. Бурденко, д. 10б',
    'Субботина Ирина Васильевна'
),
(
    'МБДОУ д/с № 11 г.Грязи',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад №11 «Рябинка» г. Грязи Грязинского муниципального округа Липецкой области.',
    'https://ds11-ryabinka.gosuslugi.ru/',
    NULL,
    '399050, г. Грязи, ул. Правды, д. 59а | 399056, г. Грязи, ул. Красногвардейская, д. 9',
    'Ли Диана Владимировна'
),
(
    'МБДОУ д/с «Радуга» с.Б.Самовец',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад «Радуга» с. Большой Самовец Грязинского муниципального района Липецкой области.',
    'https://dssamovets.gosuslugi.ru/',
    'https://dssamovets.gosuslugi.ru/netcat_files/19/8/AOP_Samovets.pdf',
    '399082, Липецкая область, Грязинский район, с. Б.Самовец, ул. Октябрьская, д. 19а',
    'Суринова Елена Константиновна'
),
(
    'МБДОУ д/с «Росточек» с. Синявка',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад «Росточек» с. Синявка Грязинского муниципального округа Липецкой области.',
    'https://ds-rostochek48.gosuslugi.ru/',
    NULL,
    'Липецкая область, Грязинский район, с. Синявка, ул. Центральная площадь, д. 6',
    'Беззубцева Светлана Анатольевна'
),
(
    'МБДОУ д/с «Светлячок» с.Ярлуково',
    'Муниципальное бюджетное дошкольное образовательное учреждение детский сад «Светлячок» с. Ярлуково Грязинского муниципального района Липецкой области.',
    'https://ds-svetlyachok-yarlukovo-r42.gosweb.gosuslugi.ru/',
    NULL,
    '399072, Липецкая область, Грязинский район, с. Ярлуково, ул. Советская, д. 11А',
    'Ульшина Ирина Ивановна'
);

-- ---------------------------------------------------------------------------
-- 3. Вставка учреждений
-- ---------------------------------------------------------------------------
INSERT INTO mapapp_institution (
    name, description, range_min, range_max, website, aoop_url, address,
    district_id, type_id, director_id, created_at, updated_at
)
SELECT
    g.name,
    g.description,
    2,
    8,
    g.website,
    g.aoop_url,
    g.address,
    d.id,
    'preschool',
    dir.id,
    NOW(),
    NOW()
FROM _gryazi_preschool_import g
JOIN mapapp_district d ON d.name = 'Грязинский округ'
LEFT JOIN mapapp_director dir ON dir.full_name = g.director_name
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Программы АООП
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _gryazi_preschool_aoop (
    institution_name VARCHAR(255) NOT NULL,
    program_name     VARCHAR(255) NOT NULL
) ON COMMIT DROP;

INSERT INTO _gryazi_preschool_aoop (institution_name, program_name) VALUES
    ('МБДОУ д/с № 1 г. Грязи', 'Адаптированная образовательная программа дошкольного образования для детей с тяжелыми нарушениями речи МБДОУ д/с № 1 г. Грязи'),
    ('МАДОУ д/с № 8 «Родничок» г. Грязи', 'Адаптированная образовательная программа дошкольного образования для детей с задержкой психического развития МАДОУ д/с № 8 «Родничок» г. Грязи'),
    ('МАДОУ д/с № 9 г. Грязи', 'Адаптированная образовательная программа дошкольного образования детей с задержкой психического развития'),
    ('МБДОУ д/с «Радуга» с.Б.Самовец', 'Адаптированная образовательная программа дошкольного образования');

INSERT INTO mapapp_aoopprogram (name, institution_id, created_at)
SELECT a.program_name, i.id, NOW()
FROM _gryazi_preschool_aoop a
JOIN mapapp_institution i ON i.name = a.institution_name
WHERE NOT EXISTS (
    SELECT 1 FROM mapapp_aoopprogram p
    WHERE p.institution_id = i.id AND p.name = a.program_name
);

COMMIT;

-- Проверка:
-- SELECT COUNT(*) FROM mapapp_institution i
-- JOIN mapapp_district d ON d.id = i.district_id
-- WHERE i.type_id = 'preschool' AND d.name = 'Грязинский округ';
