<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$instId = $_GET['id'] ?? null;
if (!$instId || !is_numeric($instId)) {
    jsonResponse(['error' => 'id required and must be integer'], 400);
}

try {
    $sql = "
        SELECT 
            i.id, i.name, i.description, i.range_min, i.range_max, i.website, i.aoop_url, i.district_id,
            d.full_name as director_name, d.phone as director_phone, d.email as director_email,
            d.id as director_id,
            it.code as type_code, it.name_ru as type_name,
            array_agg(DISTINCT ct.code) FILTER (WHERE ct.code IS NOT NULL) as condition_codes,
            array_agg(DISTINCT at.code) FILTER (WHERE at.code IS NOT NULL) as admission_codes,
            (SELECT json_agg(json_build_object('id', ap.id, 'name', ap.name)) FROM aoop_programs ap WHERE ap.institution_id = i.id) as aoop_programs
        FROM institutions i
        LEFT JOIN directors d ON i.director_id = d.id
        LEFT JOIN institution_types it ON i.type_code = it.code
        LEFT JOIN institution_conditions ic ON i.id = ic.institution_id
        LEFT JOIN condition_types ct ON ic.condition_code = ct.code
        LEFT JOIN institution_admission ia ON i.id = ia.institution_id
        LEFT JOIN admission_types at ON ia.admission_code = at.code
        WHERE i.id = :inst_id
        GROUP BY i.id, d.id, d.full_name, d.phone, d.email, it.code, it.name_ru
    ";

    $params = [':inst_id' => (int)$instId];

    $institutions = Database::query($sql, $params);

    if (empty($institutions)) {
        jsonResponse(['error' => 'Institution not found'], 404);
    }

    $inst = $institutions[0];

    // Преобразование
    $typeMap = [
        'Дошкольное образовательное учреждение' => 'preschool',
        'Общеобразовательная школа' => 'school',
        'Школа-интернат' => 'school_internat',
        'Среднее профессиональное образование' => 'spo',
        'Высшее образование' => 'vo'
    ];

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
    unset($inst['condition_codes'], $inst['admission_codes'], $inst['type_name'], $inst['director_name'], $inst['director_phone'], $inst['director_email'], $inst['director_id']);
    jsonResponse(['institution' => $inst]);
} catch (Exception $e) {
    error_log("Error in get_institution: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>