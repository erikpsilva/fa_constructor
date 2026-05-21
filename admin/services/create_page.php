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

$title       = trim($_POST['title']       ?? '');
$slug        = trim($_POST['slug']        ?? '');
$template_id = (int) ($_POST['template_id'] ?? 0);
$status      = trim($_POST['status']      ?? 'draft');
$is_home     = isset($_POST['is_home']) && $_POST['is_home'] === '1' ? 1 : 0;

if (empty($title)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'O nome da página é obrigatório.']);
    exit;
}

if (empty($slug)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'O slug da página é obrigatório.']);
    exit;
}

if (!in_array($status, ['published', 'draft'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Status inválido.']);
    exit;
}

require_once dirname(__FILE__, 3) . '/config/database.php';
$pdo = getDbConnection();

// Slug único
$stmt = $pdo->prepare("SELECT id FROM pages WHERE slug = ? LIMIT 1");
$stmt->execute([$slug]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Já existe uma página com esse slug.']);
    exit;
}

// Verifica homepage existente
if ($is_home) {
    $stmt = $pdo->prepare("SELECT title FROM pages WHERE is_home = 1 LIMIT 1");
    $stmt->execute();
    $existing = $stmt->fetch();
    if ($existing) {
        http_response_code(409);
        echo json_encode([
            'success' => false,
            'message' => 'A página "' . $existing['title'] . '" já está definida como página inicial. Edite-a para remover essa definição primeiro.'
        ]);
        exit;
    }
}

$stmt = $pdo->prepare("INSERT INTO pages (title, slug, template_id, status, is_home) VALUES (?, ?, ?, ?, ?)");
$stmt->execute([
    $title,
    $slug,
    $template_id ?: null,
    $status,
    $is_home
]);

echo json_encode(['success' => true, 'message' => 'Página criada com sucesso.']);
