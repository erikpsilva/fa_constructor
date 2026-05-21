<?php

if (session_status() === PHP_SESSION_NONE) session_start();
header('Content-Type: application/json');

require_once dirname(__FILE__, 4) . '/config/api_security.php';
validateApiAccess($ALLOWED_ORIGINS);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido.']);
    exit;
}

if (empty($_SESSION['usuario']) || $_SESSION['usuario']['nivel_acesso'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit;
}

require_once dirname(__FILE__, 4) . '/config/database.php';
$pdo = getDbConnection();

$columnId = (int) ($_POST['column_id'] ?? 0);
if ($columnId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Coluna inválida.']);
    exit;
}

if (isset($_POST['styles'])) {
    $decoded = json_decode($_POST['styles'], true);
    if (json_last_error() === JSON_ERROR_NONE) {
        $pdo->prepare("UPDATE section_columns SET styles = ? WHERE id = ?")->execute([$_POST['styles'], $columnId]);
    }
}

echo json_encode(['success' => true]);
