-- ============================================================
-- Образовательные учреждения Липецкой области
-- ============================================================

-- 1. СПРАВОЧНИК: Районы
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_districts_name ON districts(name);

COMMENT ON TABLE districts IS 'Районы Липецкой области';


-- 2. СПРАВОЧНИК: Типы учреждений
CREATE TABLE IF NOT EXISTS institution_types (
    code VARCHAR(20) PRIMARY KEY,
    name_ru VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE institution_types IS 'Справочник типов образовательных учреждений';


-- 3. СПРАВОЧНИК: Типы особых условий
CREATE TABLE IF NOT EXISTS condition_types (
    code VARCHAR(50) PRIMARY KEY,
    name_ru VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE condition_types IS 'Справочник типов особых условий обучения';


-- 4. СПРАВОЧНИК: Типы условий приема
CREATE TABLE IF NOT EXISTS admission_types (
    code VARCHAR(20) PRIMARY KEY,
    name_ru VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE admission_types IS 'Справочник типов документов для приема';


-- 5. СУЩНОСТЬ: Директора
CREATE TABLE IF NOT EXISTS directors (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_director_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE INDEX idx_directors_name ON directors(full_name);
CREATE INDEX idx_directors_email ON directors(email);

COMMENT ON TABLE directors IS 'Директора образовательных учреждений';
COMMENT ON COLUMN directors.full_name IS 'ФИО директора';


-- 6. ОСНОВНАЯ СУЩНОСТЬ: Учреждения
CREATE TABLE IF NOT EXISTS institutions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
    type_code VARCHAR(20) NOT NULL REFERENCES institution_types(code) ON DELETE RESTRICT,
    director_id INTEGER REFERENCES directors(id) ON DELETE SET NULL,
    description TEXT,
    range_min INTEGER,
    range_max INTEGER,
    website VARCHAR(500),
    aoop_url VARCHAR(500), -- НОВОЕ ПОЛЕ: общая ссылка на АООП для всех программ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_range_valid CHECK (range_min IS NULL OR range_max IS NULL OR range_min <= range_max),
    CONSTRAINT check_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX idx_institutions_district ON institutions(district_id);
CREATE INDEX idx_institutions_type ON institutions(type_code);
CREATE INDEX idx_institutions_director ON institutions(director_id);
CREATE INDEX idx_institutions_range ON institutions(range_min, range_max);

COMMENT ON TABLE institutions IS 'Образовательные учреждения';
COMMENT ON COLUMN institutions.range_min IS 'Минимум диапазона (возраст для дошкольных, класс для школ)';
COMMENT ON COLUMN institutions.range_max IS 'Максимум диапазона (возраст для дошкольных, класс для школ)';


-- 7. СВЯЗЬ: Учреждения - Особые условия (многие-ко-многим)
CREATE TABLE IF NOT EXISTS institution_conditions (
    institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    condition_code VARCHAR(50) NOT NULL REFERENCES condition_types(code) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (institution_id, condition_code)
);

CREATE INDEX idx_inst_conditions_type ON institution_conditions(condition_code);

COMMENT ON TABLE institution_conditions IS 'Связь учреждений с особыми условиями обучения';


-- 8. СВЯЗЬ: Учреждения - Условия приема (многие-ко-многим)
CREATE TABLE IF NOT EXISTS institution_admission (
    institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    admission_code VARCHAR(20) NOT NULL REFERENCES admission_types(code) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (institution_id, admission_code)
);

CREATE INDEX idx_inst_admission_type ON institution_admission(admission_code);

COMMENT ON TABLE institution_admission IS 'Связь учреждений с типами документов для приема';


-- 9. СВЯЗАННАЯ СУЩНОСТЬ: АООП программы
CREATE TABLE IF NOT EXISTS aoop_programs (
    id SERIAL PRIMARY KEY,
    institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    -- url VARCHAR(500), -- УДАЛЕННЫЙ СТОЛБЕЦ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_aoop_name_not_empty CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE INDEX idx_aoop_institution ON aoop_programs(institution_id);

COMMENT ON TABLE aoop_programs IS 'АООП программы учреждений';

-- Таблица администраторов
CREATE TABLE IF NOT EXISTS administrators (
    id SERIAL PRIMARY KEY,
    login VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица журнала действий
CREATE TABLE IF NOT EXISTS action_log (
    id SERIAL PRIMARY KEY,
    administrator_id INTEGER NOT NULL REFERENCES administrators(id),
    action VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
    entity VARCHAR(50) NOT NULL, -- Таблица
    record_id INTEGER,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS links (
    id SERIAL PRIMARY KEY,
    district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    linksTo VARCHAR(20),
    linkToInstitution TEXT
);
CREATE INDEX idx_links_linksTo ON links(linksTo);

-- ============================================================
-- ТРИГГЕРЫ для автоматического обновления updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_directors_updated_at 
    BEFORE UPDATE ON directors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_institutions_updated_at 
    BEFORE UPDATE ON institutions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ЗАПОЛНЕНИЕ СПРАВОЧНИКОВ
-- ============================================================

-- Типы учреждений
INSERT INTO institution_types (code, name_ru, description) VALUES
    ('preschool', 'Дошкольное образовательное учреждение', 'Детские сады, ясли'),
    ('school', 'Общеобразовательная школа', 'Средние общеобразовательные школы'),
    ('school_internat', 'Школа-интернат', 'Школы-интернаты с круглосуточным пребыванием'),
    ('spo', 'Среднее профессиональное образование', 'Колледжи, техникумы'),
    ('vo', 'Высшее образование', 'Университеты, институты, академии')
ON CONFLICT (code) DO NOTHING;

-- Типы особых условий
INSERT INTO condition_types (code, name_ru, description) VALUES
    ('hearing_impairment', 'Нарушения слуха', 'Для детей с нарушениями слуха'),
    ('vision_impairment', 'Нарушения зрения', 'Для детей с нарушениями зрения'),
    ('musculoskeletal_impairment', 'Нарушения опорно-двигательного аппарата', 'Для детей с НОДА'),
    ('speech_impairment', 'Нарушения речи', 'Для детей с тяжелыми нарушениями речи'),
    ('mental_retardation', 'Умственная отсталость', 'Для детей с интеллектуальными нарушениями'),
    ('autism', 'Расстройства аутистического спектра', 'Для детей с РАС'),
    ('multiple_disorders', 'Множественные нарушения развития', 'Для детей со сложными дефектами')
ON CONFLICT (code) DO NOTHING;

-- Типы условий приема
INSERT INTO admission_types (code, name_ru, description) VALUES
    ('certificate', 'Свидетельство об обучении', 'Для детей с ОВЗ, получающих свидетельство'),
    ('attestat', 'Аттестат', 'Для детей, получающих аттестат государственного образца')
ON CONFLICT (code) DO NOTHING;

-- Районы Липецкой области
INSERT INTO districts (name) VALUES
    ('г. Липецк'),
    ('г. Елец'),
    ('Воловский район'),
    ('Грязинский район'),
    ('Данковский район'),
    ('Добринский район'),
    ('Добровский район'),
    ('Долгоруковский район'),
    ('Елецкий район'),
    ('Задонский район'),
    ('Измалковский район'),
    ('Краснинский район'),
    ('Лебедянский район'),
    ('Лев-Толстовский район'),
    ('Липецкий район'),
    ('Становлянский район'),
    ('Тербунский район'),
    ('Усманский район'),
    ('Хлевенский район'),
    ('Чаплыгинский район')
ON CONFLICT (name) DO NOTHING;
