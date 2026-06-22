<?php include ROOT . '/admin/includes/auth_check.php'; ?>
<?php
if ($_SESSION['usuario']['nivel_acesso'] !== 'admin') {
    header('Location: ' . BASE_URL . '/admin/inicio');
    exit;
}

$pageId = (int) ($routeParam ?? 0);
if (!$pageId) {
    header('Location: ' . BASE_URL . '/admin/paginas');
    exit;
}

require_once ROOT . '/core/Database.php';
$page = Database::fetch("SELECT * FROM pages WHERE id = ?", [$pageId]);
if (!$page) {
    header('Location: ' . BASE_URL . '/admin/paginas');
    exit;
}

$sections = Database::fetchAll(
    "SELECT * FROM page_sections WHERE page_id = ? ORDER BY sort_order ASC",
    [$pageId]
);

foreach ($sections as &$section) {
    $section['id']         = (int) $section['id'];
    $section['page_id']    = (int) $section['page_id'];
    $section['sort_order'] = (int) $section['sort_order'];
    $section['styles']     = json_decode($section['styles'] ?? '{}', true) ?: (object)[];
    $section['columns']    = Database::fetchAll(
        "SELECT * FROM section_columns WHERE section_id = ? ORDER BY sort_order ASC",
        [$section['id']]
    );
    foreach ($section['columns'] as &$column) {
        $column['id']         = (int) $column['id'];
        $column['section_id'] = (int) $column['section_id'];
        $column['col_size']   = (int) $column['col_size'];
        $column['sort_order'] = (int) $column['sort_order'];
        $column['styles']     = json_decode($column['styles'] ?? '{}', true) ?: (object)[];
        $column['elements']   = Database::fetchAll(
            "SELECT * FROM column_elements WHERE column_id = ? ORDER BY sort_order ASC",
            [$column['id']]
        );
        foreach ($column['elements'] as &$element) {
            $element['id']         = (int) $element['id'];
            $element['column_id']  = (int) $element['column_id'];
            $element['sort_order'] = (int) $element['sort_order'];
            $element['content']    = json_decode($element['content'] ?? '{}') ?? new stdClass();
        }
    }
}
unset($section, $column, $element);

// Páginas disponíveis para o componente de Menu linkar (selecionar página em vez de digitar URL).
$allPages = Database::fetchAll(
    "SELECT id, title, slug FROM pages WHERE type = 'page' ORDER BY title ASC"
);
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, user-scalable=no">
    <title>FA Constructor - Editor - <?= htmlspecialchars($page['title']) ?></title>
    <link rel="icon" href="<?= ADMIN_BASE_URL ?>/images/favicon.png" type="image/x-icon" />
    <link rel="stylesheet" href="https://cdn.quilljs.com/1.3.7/quill.snow.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap">
    <?php
    $version = time();
    echo '<link rel="stylesheet" href="' . ADMIN_BASE_URL . '/styles/style.min.css?v=' . $version . '">';
    ?>
</head>
<body class="editorBody">

<div class="pageEditor">

    <!-- Top bar -->
    <?php
    $backUrl   = BASE_URL . '/admin/paginas';
    $backLabel = '← Páginas';
    if (($page['type'] ?? 'page') !== 'page') {
        $backUrl   = BASE_URL . '/admin/header-footer';
        $backLabel = '← Topo e Rodapé';
    }
    ?>
    <div class="pageEditor__topbar">
        <div class="pageEditor__topbar-left">
            <a href="<?= $backUrl ?>" class="btn btn--sm btn--secondary"><?= $backLabel ?></a>
            <span class="pageEditor__topbar-title"><?= htmlspecialchars($page['title']) ?></span>
        </div>
        <div class="pageEditor__topbar-right">
            <span id="saveIndicator"></span>
        </div>
    </div>

    <!-- Body -->
    <div class="pageEditor__body">

        <!-- Painel esquerdo (ferramentas) -->
        <aside class="pageEditor__panel">
            <div id="editorPanel"></div>
        </aside>

        <!-- Preview central -->
        <div class="pageEditor__preview">
            <div class="previewFrame">
                <?php if (($page['type'] ?? 'page') === 'page'): ?>
                    <div class="previewChromeWrap">
                        <span class="previewChromeWrap__label">Header (visualização)</span>
                        <iframe class="previewChrome" id="previewHeaderChrome"
                                src="<?= BASE_URL ?>/admin/editor-chrome/header" scrolling="no"></iframe>
                    </div>
                <?php endif; ?>

                <div id="editorCanvas"></div>

                <?php if (($page['type'] ?? 'page') === 'page'): ?>
                    <div class="previewChromeWrap">
                        <span class="previewChromeWrap__label">Rodapé (visualização)</span>
                        <iframe class="previewChrome" id="previewFooterChrome"
                                src="<?= BASE_URL ?>/admin/editor-chrome/footer" scrolling="no"></iframe>
                    </div>
                <?php endif; ?>
            </div>
        </div>

    </div>
</div>

<script type="text/javascript" src="https://code.jquery.com/jquery-3.4.1.min.js"></script>
<script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script>
<?php echo '<script src="' . ADMIN_BASE_URL . '/scripts/plugins/slick.js?v=' . $version . '"></script>'; ?>
<script>
    var ADMIN_BASE_URL = "<?= ADMIN_BASE_URL ?>";
    var BASE_URL       = "<?= BASE_URL ?>";
    var PAGE_ID        = <?= $pageId ?>;
    var PAGE_DATA      = <?= json_encode(array_values($sections)) ?>;
    var ALL_PAGES      = <?= json_encode(array_values($allPages)) ?>;
</script>
<?php echo '<script src="' . ADMIN_BASE_URL . '/pages/editor/editor.js?v=' . $version . '"></script>'; ?>

</body>
</html>
