<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    jsonResponse(['error' => 'Invalid JSON'], 400);
}

if (empty($input['name']) || empty($input['district_id']) || empty($input['type'])) {
    jsonResponse(['error' => 'Missing required fields: name, district_id, type'], 400);
}

$districtId = (int)$input['district_id'];
if ($districtId <= 0) {
    jsonResponse(['error' => 'Invalid district_id'], 400);
}

try {
    $pdo = Database::getInstance();

    $directorId = null;
    if (!empty($input['director']['name'])) {
        $directorSql = "INSERT INTO directors (full_name, phone, email) VALUES (?, ?, ?) RETURNING id";
        $directorId = Database::fetchOne($directorSql, [
            $input['director']['name'],
            $input['director']['phone'] ?? null,
            $input['director']['email'] ?? null
        ]);
    }

    $instSql = "
        INSERT INTO institutions (name, district_id, type_code, director_id, description, range_min, range_max, website)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
    ";
    $instId = Database::fetchOne($instSql, [
        $input['name'],
        $districtId,
        $input['type'],
        $directorId,
        $input['description'] ?? null,
        $input['range']['min'] ?? null,
        $input['range']['max'] ?? null,
        $input['website'] ?? null
    ]);

    if (!empty($input['conditions'])) {
        $condSql = "INSERT INTO institution_conditions (institution_id, condition_code) VALUES (?, ?) ON CONFLICT DO NOTHING";
        foreach ($input['conditions'] as $cond) {
            Database::execute($condSql, [$instId, $cond]);
        }
    }

    if (!empty($input['conditionsAdmission'])) {
        $admSql = "INSERT INTO institution_admission (institution_id, admission_code) VALUES (?, ?) ON CONFLICT DO NOTHING";
        foreach ($input['conditionsAdmission'] as $adm) {
            Database::execute($admSql, [$instId, $adm]);
        }
    }

    if (!empty($input['aoop_programs'])) {
        $aoopSql = "INSERT INTO aoop_programs (institution_id, name, url) VALUES (?, ?, ?) ON CONFLICT DO NOTHING";
        foreach ($input['aoop_programs'] as $prog) {
            Database::execute($aoopSql, [$instId, $prog['name'], $prog['url']]);
        }
    }

    jsonResponse(['id' => $instId], 201);
} catch (Exception $e) {
    error_log("Error in create_institution: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>