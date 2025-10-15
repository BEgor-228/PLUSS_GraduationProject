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

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['id'])) {
    jsonResponse(['error' => 'Invalid JSON or missing id'], 400);
}

$instId = (int) $input['id'];
if ($instId <= 0) {
    jsonResponse(['error' => 'Invalid id'], 400);
}

try {
    $pdo = Database::getInstance();

    // Fetch old data for log
    $oldSql = "
        SELECT
            i.*, d.full_name as director_name, d.phone as director_phone, d.email as director_email,
            array_agg(DISTINCT ct.code) FILTER (WHERE ct.code IS NOT NULL) as condition_codes,
            array_agg(DISTINCT at.code) FILTER (WHERE at.code IS NOT NULL) as admission_codes,
            json_agg(json_build_object('id', ap.id, 'name', ap.name, 'url', ap.url)) FILTER (WHERE ap.name IS NOT NULL) as aoop_programs
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
    $oldData = Database::query($oldSql, [$instId]);

    if (empty($oldData)) {
        jsonResponse(['error' => 'Institution not found'], 404);
    }

    $oldInst = $oldData[0];
    $oldJson = [
        'name' => $oldInst['name'],
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
        'conditions' => $oldInst['condition_codes'] ? explode(',', trim($oldInst['condition_codes'], '{}')) : [],
        'conditionsAdmission' => $oldInst['admission_codes'] ? explode(',', trim($oldInst['admission_codes'], '{}')) : [],
        'aoop_programs' => $oldInst['aoop_programs'] ? json_decode($oldInst['aoop_programs'], true) : []
    ];

    $directorId = null;
    if (!empty($input['director']['name'])) {
        if (isset($input['director']['id'])) {
            $directorSql = "UPDATE directors SET full_name = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING id";
            Database::execute($directorSql, [
                $input['director']['name'],
                $input['director']['phone'] ?? null,
                $input['director']['email'] ?? null,
                $input['director']['id']
            ]);
            $directorId = $input['director']['id'];
        } else {
            $directorId = Database::fetchOne("INSERT INTO directors (full_name, phone, email) VALUES (?, ?, ?) RETURNING id", [
                $input['director']['name'],
                $input['director']['phone'] ?? null,
                $input['director']['email'] ?? null
            ]);
        }
    }

    $updateSql = "
        UPDATE institutions
        SET name = ?, district_id = ?, type_code = ?, director_id = ?, description = ?,
        range_min = ?, range_max = ?, website = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ";
    Database::execute($updateSql, [
        $input['name'],
        (int) $input['district_id'],
        $input['type'],
        $directorId,
        $input['description'] ?? null,
        $input['range']['min'] ?? null,
        $input['range']['max'] ?? null,
        $input['website'] ?? null,
        $instId
    ]);

    Database::execute("DELETE FROM institution_conditions WHERE institution_id = ?", [$instId]);
    Database::execute("DELETE FROM institution_admission WHERE institution_id = ?", [$instId]);
    Database::execute("DELETE FROM aoop_programs WHERE institution_id = ?", [$instId]);

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

    // Log action
    $newJson = $input;
    $newJson['id'] = $instId;
    $logSql = "INSERT INTO action_log (administrator_id, action, entity, record_id, old_data, new_data) VALUES (?, 'UPDATE', 'institutions', ?, ?::jsonb, ?::jsonb)";
    Database::execute($logSql, [$_SESSION['admin_id'], $instId, json_encode($oldJson), json_encode($newJson)]);

    jsonResponse(['success' => true]);
} catch (Exception $e) {
    error_log("Error in update_institution: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}