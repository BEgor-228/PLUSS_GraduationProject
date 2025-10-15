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
if (!$input || empty($input['login']) || empty($input['email']) || empty($input['password']) || empty($input['full_name'])) {
    jsonResponse(['error' => 'Invalid JSON or missing fields: login, email, password, full_name'], 400);
}
$login = trim($input['login']);
$email = trim($input['email']);
$password = $input['password'];
$full_name = trim($input['full_name']);
if (strlen($login) < 3 || strlen($password) < 6) {
    jsonResponse(['error' => 'Login must be at least 3 characters, password at least 6'], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(['error' => 'Invalid email format'], 400);
}
try {
    $pdo = Database::getInstance();
    // Check if login or email already exists
    $checkSql = "SELECT id FROM administrators WHERE login = ? OR email = ?";
    $existing = Database::query($checkSql, [$login, $email]);
    if (!empty($existing)) {
        jsonResponse(['error' => 'Login or email already exists'], 409);
    }
    // Generate password hash
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
    // Insert new admin
    $insertSql = "INSERT INTO administrators (login, email, password_hash, full_name) VALUES (?, ?, ?, ?) RETURNING id";
    $adminId = Database::fetchOne($insertSql, [$login, $email, $password_hash, $full_name]);
    if ($adminId) {
        $_SESSION['admin_id'] = $adminId;
        jsonResponse(['success' => true, 'id' => $adminId], 201);
    } else {
        jsonResponse(['error' => 'Failed to create admin'], 500);
    }
} catch (Exception $e) {
    error_log("Error in register: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>