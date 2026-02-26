<?php
session_start();
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $pdo = Database::getInstance();
    
    $search = $_GET['search'] ?? '';
    
    $sql = "SELECT id, full_name, phone, email FROM directors WHERE 1=1";
    $params = [];
    
    if (!empty($search)) {
        $sql .= " AND full_name ILIKE ?";
        $params[] = "%$search%";
    }
    
    $sql .= " ORDER BY full_name";
    
    $directors = Database::query($sql, $params);
    
    echo json_encode(['directors' => $directors]);
    
} catch (Exception $e) {
    error_log("Error in get_directors: " . $e->getMessage());
    echo json_encode(['error' => 'Internal server error']);
}
?>