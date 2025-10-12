<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Database.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

try {
    $districts = Database::query("SELECT id, name FROM districts ORDER BY name");

    $districtMap = [];
    foreach ($districts as $district) {
        $districtMap[$district['id']] = $district['name'];
    }

    jsonResponse(['districts' => $districtMap]);
} catch (Exception $e) {
    error_log("Error in get_districts: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
?>