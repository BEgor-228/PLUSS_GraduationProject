<?php
session_start();
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}
if (!isset($_SESSION['admin_id'])) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$id = $input['id'] ?? null;
if (!$id || !is_numeric($id)) {
    jsonResponse(['error' => 'Invalid id'], 400);
}
try {
    $pdo = Database::getInstance();

    $oldSql = "
        SELECT
            i.*, i.address, d.id as director_id_val, d.full_name as director_name, d.phone as director_phone, d.email as director_email,
            array_agg(DISTINCT ct.code) FILTER (WHERE ct.code IS NOT NULL) as condition_codes,
            array_agg(DISTINCT at.code) FILTER (WHERE at.code IS NOT NULL) as admission_codes,
            json_agg(json_build_object('id', ap.id, 'name', ap.name)) FILTER (WHERE ap.name IS NOT NULL) as aoop_programs
        FROM institutions i
        LEFT JOIN directors d ON i.director_id = d.id
        LEFT JOIN institution_conditions ic ON i.id = ic.institution_id
        LEFT JOIN condition_types ct ON ic.condition_code = ct.code
        LEFT JOIN institution_admission ia ON i.id = ia.institution_id
        LEFT JOIN admission_types at ON ia.admission_code = at.code
        LEFT JOIN aoop_programs ap ON i.id = ap.institution_id
        WHERE i.id = ?
        GROUP BY i.id, d.id, d.full_name, d.phone, d.email
    ";
    $oldData = Database::query($oldSql, [(int) $id]);
    if (empty($oldData)) {
        jsonResponse(['error' => 'Institution not found'], 404);
    }
    $oldInst = $oldData[0];

    $directorId = $oldInst['director_id_val'] ?? null;

    $oldJson = [
        'id' => (int) $oldInst['id'],
        'name' => $oldInst['name'],
        'address' => $oldInst['address'] ?? null,
        'district_id' => (int) $oldInst['district_id'],
        'type' => $oldInst['type_code'],
        'director' => [
            'name' => $oldInst['director_name'] ?? '',
            'phone' => $oldInst['director_phone'] ?? '',
            'email' => $oldInst['director_email'] ?? ''
        ],
        'description' => $oldInst['description'],
        'range' => [
            'min' => $oldInst['range_min'],
            'max' => $oldInst['range_max']
        ],
        'website' => $oldInst['website'],
        'aoop_url' => $oldInst['aoop_url'],
        'conditions' => $oldInst['condition_codes'] ? explode(',', trim($oldInst['condition_codes'], '{}')) : [],
        'conditionsAdmission' => $oldInst['admission_codes'] ? explode(',', trim($oldInst['admission_codes'], '{}')) : [],
        'aoop_programs' => $oldInst['aoop_programs'] ? json_decode($oldInst['aoop_programs'], true) : []
    ];

    $result = Database::execute("DELETE FROM institutions WHERE id = ?", [(int) $id]);
    if ($result === 0) {
        jsonResponse(['error' => 'Institution not found'], 404);
    }

    if ($directorId) {
        Database::execute("DELETE FROM directors WHERE id = ?", [(int) $directorId]);
    }

    $logSql = "INSERT INTO action_log (administrator_id, action, entity, record_id, old_data) VALUES (?, 'DELETE', 'institutions', ?, ?::jsonb)";
    Database::execute($logSql, [$_SESSION['admin_id'], (int) $id, json_encode($oldJson)]);

    jsonResponse(['success' => true]);
} catch (Exception $e) {
    error_log("Error in delete_institution: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>