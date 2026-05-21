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

$elementId  = (int) ($_POST['element_id'] ?? 0);
$contentRaw = $_POST['content'] ?? '{}';

// Garante JSON válido
$content = json_decode($contentRaw, true);
if ($content === null) $content = [];
$contentJson = json_encode($content);

// UPDATE
if ($elementId > 0) {
    $stmt = $pdo->prepare("UPDATE column_elements SET content = ? WHERE id = ?");
    $stmt->execute([$contentJson, $elementId]);
    echo json_encode(['success' => true]);
    exit;
}

// CREATE
$columnId   = (int) ($_POST['column_id']   ?? 0);
$pluginType = trim($_POST['plugin_type']   ?? '');

if ($columnId <= 0 || empty($pluginType)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados inválidos.']);
    exit;
}

$stmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM column_elements WHERE column_id = ?");
$stmt->execute([$columnId]);
$sortOrder = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare("INSERT INTO column_elements (column_id, plugin_type, content, sort_order) VALUES (?, ?, ?, ?)");
$stmt->execute([$columnId, $pluginType, $contentJson, $sortOrder]);

echo json_encode([
    'success' => true,
    'element' => [
        'id'          => (int) $pdo->lastInsertId(),
        'column_id'   => $columnId,
        'plugin_type' => $pluginType,
        'content'     => $content,
        'sort_order'  => $sortOrder
    ]
]);
