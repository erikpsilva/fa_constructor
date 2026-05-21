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

$columnId  = (int) ($_POST['column_id'] ?? 0);
$orderJson = $_POST['order'] ?? '[]';
$order     = json_decode($orderJson, true);

if (!$columnId || !is_array($order)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados inválidos.']);
    exit;
}

require_once dirname(__FILE__, 4) . '/config/database.php';
$pdo = getDbConnection();

foreach ($order as $index => $elementId) {
    $stmt = $pdo->prepare("UPDATE column_elements SET sort_order = ? WHERE id = ? AND column_id = ?");
    $stmt->execute([$index + 1, (int) $elementId, $columnId]);
}

echo json_encode(['success' => true]);
