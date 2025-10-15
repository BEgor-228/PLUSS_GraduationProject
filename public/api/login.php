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
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['login']) || empty($input['password'])) {
    jsonResponse(['error' => 'Invalid JSON or missing credentials'], 400);
}
$login = trim($input['login']);
$password = $input['password'];
try {
    $pdo = Database::getInstance();
    $stmt = $pdo->prepare("SELECT id, password_hash FROM administrators WHERE login = ?");
    $stmt->execute([$login]);
    $admin = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($admin && password_verify($password, $admin['password_hash'])) {
        $_SESSION['admin_id'] = $admin['id'];
        $updateStmt = $pdo->prepare("UPDATE administrators SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $updateStmt->execute([$admin['id']]);
        jsonResponse(['success' => true]);
    } else {
        jsonResponse(['error' => 'Invalid credentials'], 401);
    }
} catch (Exception $e) {
    error_log("Error in login: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>