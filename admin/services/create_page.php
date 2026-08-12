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
$status      = trim($_POST['status']      ?? 'draft');
$is_home     = isset($_POST['is_home']) && $_POST['is_home'] === '1' ? 1 : 0;

// Modelo (pages.type = 'template') usado como ponto de partida do conteúdo da página.
// Opcional: 0 = começar em branco.
$source_template_id = (int) ($_POST['source_template_id'] ?? 0);

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

// Valida o modelo antes de criar a página, para não deixar uma página órfã caso o
// modelo tenha sido excluído entre o carregamento da tela e o envio do formulário.
if ($source_template_id > 0) {
    $stmt = $pdo->prepare("SELECT id FROM pages WHERE id = ? AND type = 'template' LIMIT 1");
    $stmt->execute([$source_template_id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'O modelo selecionado não existe mais.']);
        exit;
    }
}

// Sem `template_id`: o arquivo de layout não é mais escolhido pelo usuário e o Router
// cai no template 'default' quando a coluna é nula.
$stmt = $pdo->prepare("INSERT INTO pages (title, slug, status, is_home) VALUES (?, ?, ?, ?)");
$stmt->execute([
    $title,
    $slug,
    $status,
    $is_home
]);

$newPageId = (int) $pdo->lastInsertId();

// Copia seções/colunas/elementos do modelo para a página recém-criada.
if ($source_template_id > 0) {
    require_once dirname(__FILE__, 3) . '/core/Database.php';
    require_once dirname(__FILE__, 3) . '/core/Helpers.php';
    clonePageTree($source_template_id, $newPageId);
}

echo json_encode([
    'success' => true,
    'message' => 'Página criada com sucesso.',
    'page_id' => $newPageId,
]);
