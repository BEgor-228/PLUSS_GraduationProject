<?php
session_start();
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

if (!isset($_GET['id'])) {
    echo json_encode(['error' => 'Director ID is required']);
    exit;
}

$directorId = (int)$_GET['id'];

try {
    $pdo = Database::getInstance();
    
    $sql = "SELECT id, full_name, phone, email FROM directors WHERE id = ?";
    
    // Используем метод query() и берем первый элемент
    $directors = Database::query($sql, [$directorId]);
    
    if (empty($directors)) {
        echo json_encode(['error' => 'Director not found']);
        exit;
    }
    
    $director = $directors[0];
    
    echo json_encode(['director' => $director]);
    
} catch (Exception $e) {
    error_log("Error in get_director: " . $e->getMessage());
    echo json_encode(['error' => 'Internal server error']);
}
?>