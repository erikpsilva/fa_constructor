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

$id          = (int) ($_POST['id']          ?? 0);
$title       = trim($_POST['title']         ?? '');
$slug        = trim($_POST['slug']          ?? '');
$template_id = (int) ($_POST['template_id'] ?? 0);
$status      = trim($_POST['status']        ?? 'draft');
$is_home     = isset($_POST['is_home']) && $_POST['is_home'] === '1' ? 1 : 0;

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Página inválida.']);
    exit;
}

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

// Slug único (exceto a própria página)
$stmt = $pdo->prepare("SELECT id FROM pages WHERE slug = ? AND id != ? LIMIT 1");
$stmt->execute([$slug, $id]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Já existe outra página com esse slug.']);
    exit;
}

// Verifica homepage em outra página
if ($is_home) {
    $stmt = $pdo->prepare("SELECT title FROM pages WHERE is_home = 1 AND id != ? LIMIT 1");
    $stmt->execute([$id]);
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

$stmt = $pdo->prepare("UPDATE pages SET title = ?, slug = ?, template_id = ?, status = ?, is_home = ? WHERE id = ?");
$stmt->execute([
    $title,
    $slug,
    $template_id ?: null,
    $status,
    $is_home,
    $id
]);

echo json_encode(['success' => true, 'message' => 'Página atualizada com sucesso.']);
