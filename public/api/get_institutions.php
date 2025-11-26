<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$districtId = $_GET['district_id'] ?? null;
if (!$districtId || !is_numeric($districtId)) {
    jsonResponse(['error' => 'district_id required and must be integer'], 400);
}

$sql = "
    SELECT 
        i.id, i.name, i.description, i.range_min, i.range_max, i.website, i.aoop_url,
        d.full_name as director_name, d.phone as director_phone, d.email as director_email,
        d.id as director_id,
        it.code as type_code, it.name_ru as type_name,
        array_agg(DISTINCT ct.code) FILTER (WHERE ct.code IS NOT NULL) as condition_codes,
        array_agg(DISTINCT at.code) FILTER (WHERE at.code IS NOT NULL) as admission_codes,
        json_agg(json_build_object('id', ap.id, 'name', ap.name)) FILTER (WHERE ap.name IS NOT NULL) as aoop_programs
    FROM institutions i
    LEFT JOIN directors d ON i.director_id = d.id
    LEFT JOIN institution_types it ON i.type_code = it.code
    LEFT JOIN institution_conditions ic ON i.id = ic.institution_id
    LEFT JOIN condition_types ct ON ic.condition_code = ct.code
    LEFT JOIN institution_admission ia ON i.id = ia.institution_id
    LEFT JOIN admission_types at ON ia.admission_code = at.code
    LEFT JOIN aoop_programs ap ON i.id = ap.institution_id
    WHERE i.district_id = ?
";

$params = [(int)$districtId];

if (!empty($_GET['type']) && is_array($_GET['type'])) {
    $typesList = array_map('trim', $_GET['type']);
    if (!empty($typesList)) {
        $placeholders = implode(',', array_fill(0, count($typesList), '?'));
        $sql .= " AND i.type_code IN ($placeholders)";
        $params = array_merge($params, $typesList);
    }
}

if (!empty($_GET['condition']) && is_array($_GET['condition'])) {
    $conditionsList = array_map('trim', $_GET['condition']);
    if (!empty($conditionsList)) {
        $placeholders = implode(',', array_fill(0, count($conditionsList), '?'));
        $sql .= " AND EXISTS (
            SELECT 1 FROM institution_conditions ic2 
            JOIN condition_types ct2 ON ic2.condition_code = ct2.code 
            WHERE ic2.institution_id = i.id AND ct2.code IN ($placeholders)
        )";
        $params = array_merge($params, $conditionsList);
    }
}

if (!empty($_GET['aoop'])) {
    $sql .= " AND EXISTS (SELECT 1 FROM aoop_programs ap WHERE ap.institution_id = i.id)";
}

if (!empty($_GET['age']) && is_array($_GET['age'])) {
    $ageFilters = [];
    foreach ($_GET['age'] as $age) {
        $age = trim($age);
        if ($age === '3-4') $ageFilters[] = "(i.range_min <= 4 AND i.range_max >= 3)";
        elseif ($age === '5-6') $ageFilters[] = "(i.range_min <= 6 AND i.range_max >= 5)";
        elseif ($age === '7+') $ageFilters[] = "i.range_min >= 7";
    }
    if ($ageFilters) {
        $sql .= " AND (" . implode(' OR ', $ageFilters) . ")";
    }
}

$sql .= " GROUP BY i.id, d.id, d.full_name, d.phone, d.email, it.code, it.name_ru
          ORDER BY i.name";

try {
    $institutions = Database::query($sql, $params);

    $typeMap = [
        'Дошкольное образовательное учреждение' => 'preschool',
        'Общеобразовательная школа' => 'school',
        'Школа-интернат' => 'school_internat',
        'Среднее профессиональное образование' => 'spo',
        'Высшее образование' => 'vo'
    ];

    foreach ($institutions as &$inst) {
        $conditionCodes = $inst['condition_codes'] ? trim($inst['condition_codes'], '{}') : '';
        $inst['conditions'] = $conditionCodes ? explode(',', $conditionCodes) : [];

        $admissionCodes = $inst['admission_codes'] ? trim($inst['admission_codes'], '{}') : '';
        $inst['conditionsAdmission'] = $admissionCodes ? explode(',', $admissionCodes) : [];

        $aoopRaw = $inst['aoop_programs'] ? json_decode($inst['aoop_programs'], true) : [];
        $inst['aoop_programs'] = [];
        if ($aoopRaw) {
            $seenIds = [];
            foreach ($aoopRaw as $prog) {
                if (!in_array($prog['id'], $seenIds)) {
                    $inst['aoop_programs'][] = $prog;
                    $seenIds[] = $prog['id'];
                }
            }
        }

        $inst['director'] = [
            'id' => $inst['director_id'] ?? null,
            'name' => $inst['director_name'] ?? '',
            'phone' => $inst['director_phone'] ?? '',
            'email' => $inst['director_email'] ?? ''
        ];
        $inst['type'] = $typeMap[$inst['type_name']] ?? $inst['type_code'];
        $inst['district_id'] = (int)$districtId;
        unset($inst['condition_codes'], $inst['admission_codes'], $inst['type_name'], $inst['director_name'], $inst['director_phone'], $inst['director_email'], $inst['director_id']);
    }

    jsonResponse(['institutions' => $institutions]);
} catch (Exception $e) {
    error_log("Error in get_institutions: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>