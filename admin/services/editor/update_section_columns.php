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

$sectionId   = (int) ($_POST['section_id'] ?? 0);
$newColCount = max(1, min(6, (int) ($_POST['col_count'] ?? 1)));

if ($sectionId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Seção inválida.']);
    exit;
}

$newColSize = (int) (12 / $newColCount);

// Colunas atuais ordenadas
$stmt = $pdo->prepare("SELECT id FROM section_columns WHERE section_id = ? ORDER BY sort_order ASC");
$stmt->execute([$sectionId]);
$currentIds   = $stmt->fetchAll(PDO::FETCH_COLUMN);
$currentCount = count($currentIds);

if ($newColCount > $currentCount) {
    // Atualiza col_size das colunas existentes
    $pdo->prepare("UPDATE section_columns SET col_size = ? WHERE section_id = ?")
        ->execute([$newColSize, $sectionId]);

    // Insere novas colunas vazias
    for ($i = $currentCount; $i < $newColCount; $i++) {
        $pdo->prepare("INSERT INTO section_columns (section_id, col_size, sort_order) VALUES (?, ?, ?)")
            ->execute([$sectionId, $newColSize, $i]);
    }

} elseif ($newColCount < $currentCount) {
    $keepIds   = array_slice($currentIds, 0, $newColCount);
    $removeIds = array_slice($currentIds, $newColCount);
    $lastKeep  = end($keepIds);

    // Sort_order máximo na última coluna mantida
    $stmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), -1) FROM column_elements WHERE column_id = ?");
    $stmt->execute([$lastKeep]);
    $maxOrder = (int) $stmt->fetchColumn();

    // Move elementos das colunas removidas para a última coluna mantida
    foreach ($removeIds as $removeId) {
        $stmt = $pdo->prepare("SELECT id FROM column_elements WHERE column_id = ? ORDER BY sort_order ASC");
        $stmt->execute([$removeId]);
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $elId) {
            $maxOrder++;
            $pdo->prepare("UPDATE column_elements SET column_id = ?, sort_order = ? WHERE id = ?")
                ->execute([$lastKeep, $maxOrder, $elId]);
        }
        $pdo->prepare("DELETE FROM section_columns WHERE id = ?")->execute([$removeId]);
    }

    $pdo->prepare("UPDATE section_columns SET col_size = ? WHERE section_id = ?")
        ->execute([$newColSize, $sectionId]);

} else {
    // Mesmo número, só recalcula col_size
    $pdo->prepare("UPDATE section_columns SET col_size = ? WHERE section_id = ?")
        ->execute([$newColSize, $sectionId]);
}

// Retorna colunas atualizadas com elementos
$stmt = $pdo->prepare("SELECT * FROM section_columns WHERE section_id = ? ORDER BY sort_order ASC");
$stmt->execute([$sectionId]);
$columns = $stmt->fetchAll();

foreach ($columns as &$col) {
    $col['id']         = (int) $col['id'];
    $col['section_id'] = (int) $col['section_id'];
    $col['col_size']   = (int) $col['col_size'];
    $col['sort_order'] = (int) $col['sort_order'];
    $col['styles']     = json_decode($col['styles'] ?? '{}') ?? new stdClass();

    $stmt2 = $pdo->prepare("SELECT * FROM column_elements WHERE column_id = ? ORDER BY sort_order ASC");
    $stmt2->execute([$col['id']]);
    $col['elements'] = $stmt2->fetchAll();

    foreach ($col['elements'] as &$el) {
        $el['id']         = (int) $el['id'];
        $el['column_id']  = (int) $el['column_id'];
        $el['sort_order'] = (int) $el['sort_order'];
        $el['content']    = json_decode($el['content'] ?? '{}') ?? new stdClass();
    }
    unset($el);
}
unset($col);

echo json_encode(['success' => true, 'columns' => $columns]);
