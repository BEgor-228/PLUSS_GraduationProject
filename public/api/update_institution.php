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
if (!$input || empty($input['id'])) {
    jsonResponse(['error' => 'Invalid JSON or missing id'], 400);
}

$instId = (int)$input['id'];
if ($instId <= 0) {
    jsonResponse(['error' => 'Invalid id'], 400);
}

try {
    $pdo = Database::getInstance();

    $directorId = null;
    if (!empty($input['director']['name'])) {
        $directorSql = "
            INSERT INTO directors (full_name, phone, email) VALUES (?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET 
                full_name = EXCLUDED.full_name, 
                phone = EXCLUDED.phone, 
                email = EXCLUDED.email,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id
        ";
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
        (int)$input['district_id'],
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

    jsonResponse(['success' => true]);
} catch (Exception $e) {
    error_log("Error in update_institution: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>