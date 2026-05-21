<?php

if (session_status() === PHP_SESSION_NONE) session_start();

header('Content-Type: application/json');

require_once dirname(__FILE__, 3) . '/config/api_security.php';
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

$id = (int) ($_POST['id'] ?? 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Página inválida.']);
    exit;
}

require_once dirname(__FILE__, 3) . '/config/database.php';
$pdo = getDbConnection();

$stmt = $pdo->prepare("DELETE FROM pages WHERE id = ?");
$stmt->execute([$id]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Página não encontrada.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Página excluída com sucesso.']);
