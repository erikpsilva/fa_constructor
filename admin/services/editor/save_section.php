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

$sectionId     = (int) ($_POST['section_id'] ?? 0);
$name          = trim($_POST['name'] ?? '');
$validTypes    = ['container', 'full', 'full-inner'];
$containerType = in_array($_POST['container_type'] ?? '', $validTypes) ? $_POST['container_type'] : null;

// ── UPDATE ────────────────────────────────────────────────────
if ($sectionId > 0) {
    $sets  = [];
    $binds = [];

    if ($name !== '') {
        $sets[]  = 'name = ?';
        $binds[] = $name;
    }
    if ($containerType !== null) {
        $sets[]  = 'container_type = ?';
        $binds[] = $containerType;
    }

    if (isset($_POST['styles'])) {
        $decoded = json_decode($_POST['styles'], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $sets[]  = 'styles = ?';
            $binds[] = $_POST['styles'];
        }
    }

    if (!empty($sets)) {
        $binds[] = $sectionId;
        $pdo->prepare("UPDATE page_sections SET " . implode(', ', $sets) . " WHERE id = ?")->execute($binds);
    }

    echo json_encode(['success' => true]);
    exit;
}

// ── CREATE ────────────────────────────────────────────────────
if (empty($name)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nome da seção é obrigatório.']);
    exit;
}

$pageId        = (int) ($_POST['page_id'] ?? 0);
$colCount      = max(1, min(6, (int) ($_POST['col_count'] ?? 1)));
$containerType = $containerType ?? 'container';

if ($pageId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Página inválida.']);
    exit;
}

$stmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM page_sections WHERE page_id = ?");
$stmt->execute([$pageId]);
$sortOrder = (int) $stmt->fetchColumn();

$stmt = $pdo->prepare("INSERT INTO page_sections (page_id, name, sort_order, container_type) VALUES (?, ?, ?, ?)");
$stmt->execute([$pageId, $name, $sortOrder, $containerType]);
$sectionId = (int) $pdo->lastInsertId();

$colSize = (int) (12 / $colCount);
$columns = [];

for ($i = 0; $i < $colCount; $i++) {
    $stmt = $pdo->prepare("INSERT INTO section_columns (section_id, col_size, sort_order) VALUES (?, ?, ?)");
    $stmt->execute([$sectionId, $colSize, $i]);
    $columns[] = [
        'id'         => (int) $pdo->lastInsertId(),
        'section_id' => $sectionId,
        'col_size'   => $colSize,
        'sort_order' => $i,
        'elements'   => []
    ];
}

echo json_encode([
    'success' => true,
    'section' => [
        'id'             => $sectionId,
        'page_id'        => $pageId,
        'name'           => $name,
        'sort_order'     => $sortOrder,
        'container_type' => $containerType,
        'columns'        => $columns
    ]
]);
