-- Привязка «Аттестат» (attestat) ко всем учреждениям высшего образования (type_id = vo).
--
-- Требования:
--   python manage.py migrate
--   python manage.py seed_reference_data   -- создаёт admission_types, в т.ч. attestat
--
-- Безопасно для повторного запуска (ON CONFLICT DO NOTHING).

BEGIN;

INSERT INTO mapapp_institution_admission (institution_id, admissiontype_id)
SELECT i.id, 'attestat'
FROM mapapp_institution i
WHERE i.type_id = 'vo'
ON CONFLICT (institution_id, admissiontype_id) DO NOTHING;

COMMIT;

-- Проверка:
-- SELECT i.name, array_agg(a.admissiontype_id ORDER BY a.admissiontype_id) AS admission
-- FROM mapapp_institution i
-- LEFT JOIN mapapp_institution_admission a ON a.institution_id = i.id
-- WHERE i.type_id = 'vo'
-- GROUP BY i.id, i.name
-- ORDER BY i.name;
