<?php
session_start();

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

jsonResponse(['loggedIn' => isset($_SESSION['admin_id'])]);

function jsonResponse($data, $status = 200)
{
  http_response_code($status);
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}
?>