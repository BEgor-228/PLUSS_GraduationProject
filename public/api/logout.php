<?php
session_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  jsonResponse(['error' => 'Method not allowed'], 405);
}

session_destroy();
jsonResponse(['success' => true]);

function jsonResponse($data, $status = 200)
{
  http_response_code($status);
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}
?>