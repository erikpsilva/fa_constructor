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

if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nenhuma imagem enviada.']);
    exit;
}

$file        = $_FILES['image'];
$allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
$ext         = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

if (!in_array($ext, $allowedExts, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Formato de imagem não permitido. Use jpg, png, gif ou webp.']);
    exit;
}

if ($file['size'] > 5 * 1024 * 1024) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Imagem maior que 5MB.']);
    exit;
}

$uploadDir = dirname(__FILE__, 4) . '/uploads/media/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$fileName = 'img_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$destPath = $uploadDir . $fileName;

if (!move_uploaded_file($file['tmp_name'], $destPath)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar a imagem.']);
    exit;
}

$host    = $_SERVER['HTTP_HOST'] ?? 'localhost';
$scheme  = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$baseUrl = (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false)
    ? $scheme . '://' . $host . '/fa_constructor'
    : 'https://www.meusite.com.br';

echo json_encode(['success' => true, 'url' => $baseUrl . '/uploads/media/' . $fileName]);
