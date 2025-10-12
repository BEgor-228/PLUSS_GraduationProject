<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$id = $input['id'] ?? null;

if (!$id || !is_numeric($id)) {
    jsonResponse(['error' => 'Invalid id'], 400);
}

try {
    $result = Database::execute("DELETE FROM institutions WHERE id = ?", [(int)$id]);
    if ($result === 0) {
        jsonResponse(['error' => 'Institution not found'], 404);
    }
    jsonResponse(['success' => true]);
} catch (Exception $e) {
    error_log("Error in delete_institution: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>