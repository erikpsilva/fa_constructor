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

$pageId = (int) ($_POST['page_id'] ?? 0);
$name   = trim($_POST['name'] ?? '');

if ($pageId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Página inválida.']);
    exit;
}

if ($name === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'O nome do modelo é obrigatório.']);
    exit;
}

require_once dirname(__FILE__, 3) . '/config/database.php';
require_once dirname(__FILE__, 3) . '/core/Database.php';
require_once dirname(__FILE__, 3) . '/core/Helpers.php';

// Só páginas normais viram modelo (Header/Footer têm o próprio fluxo e não fazem
// sentido como ponto de partida de uma página inteira).
$page = Database::fetch("SELECT * FROM pages WHERE id = ? AND type = 'page'", [$pageId]);

if (!$page) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Página não encontrada.']);
    exit;
}

// Nome de modelo único, para não confundir na hora de escolher na lista.
$existing = Database::fetch(
    "SELECT id FROM pages WHERE type = 'template' AND title = ? LIMIT 1",
    [$name]
);

if ($existing) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Já existe um modelo com esse nome.']);
    exit;
}

// O modelo é uma linha normal de `pages` com type='template' — mesmo mecanismo já usado
// por Header/Footer. Fica sempre em draft e o Router filtra type='page', então nunca é
// acessível publicamente, mesmo tendo um slug.
$templatePageId = (int) Database::insert(
    "INSERT INTO pages (title, slug, type, status, is_home)
     VALUES (?, ?, 'template', 'draft', 0)",
    [$name, uniquePageSlug('modelo-' . $name)]
);

clonePageTree($pageId, $templatePageId);

echo json_encode([
    'success'   => true,
    'message'   => 'Modelo salvo com sucesso.',
    'modelo_id' => $templatePageId,
    'name'      => $name,
]);
