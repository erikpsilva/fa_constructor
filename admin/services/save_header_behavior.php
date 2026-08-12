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

$enabled = ($_POST['enabled'] ?? '0') === '1' ? '1' : '0';
$offset  = (string) max(0, min(5000, (int) ($_POST['offset'] ?? 180)));
$scale   = (string) max(50, min(100, (int) ($_POST['scale'] ?? 75)));
$shadow  = ($_POST['shadow'] ?? '0') === '1' ? '1' : '0';
$bg      = trim($_POST['bg_color'] ?? '#111111');
$color   = trim($_POST['text_color'] ?? '#ffffff');

if (!preg_match('/^#[0-9a-f]{6}$/i', $bg) || !preg_match('/^#[0-9a-f]{6}$/i', $color)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Cor inválida.']);
    exit;
}

require_once dirname(__FILE__, 3) . '/config/database.php';
$pdo = getDbConnection();
$values = [
    'header_sticky_enabled' => $enabled,
    'header_sticky_offset'  => $offset,
    'header_sticky_scale'   => $scale,
    'header_sticky_bg'      => $bg,
    'header_sticky_color'   => $color,
    'header_sticky_shadow'  => $shadow,
];

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare(
        "INSERT INTO settings (`key`, `value`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)"
    );
    foreach ($values as $key => $value) {
        $stmt->execute([$key, $value]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Não foi possível salvar as configurações.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Comportamento do Header salvo.']);
