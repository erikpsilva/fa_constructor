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

$userId  = (int) ($_POST['userId'] ?? 0);
$selfId  = (int) $_SESSION['usuario']['id'];

if ($userId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Usuário inválido.']);
    exit;
}

if ($userId === $selfId) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Você não pode excluir sua própria conta.']);
    exit;
}

require_once dirname(__FILE__, 3) . '/config/database.php';
$pdo = getDbConnection();

$stmt = $pdo->prepare("DELETE FROM admin_usuarios WHERE id = ?");
$stmt->execute([$userId]);

if ($stmt->rowCount() === 0) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Usuário não encontrado.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Usuário excluído com sucesso.']);
