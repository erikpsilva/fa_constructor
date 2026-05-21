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

$sectionId = (int) ($_POST['section_id'] ?? 0);

if ($sectionId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Seção inválida.']);
    exit;
}

require_once dirname(__FILE__, 4) . '/config/database.php';
$pdo = getDbConnection();

$stmt = $pdo->prepare("DELETE FROM page_sections WHERE id = ?");
$stmt->execute([$sectionId]);

echo json_encode(['success' => true, 'message' => 'Seção excluída.']);
