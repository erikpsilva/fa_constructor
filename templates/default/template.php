<?php
$siteName = getSetting('site_name', '');
$version  = time();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, user-scalable=no">
    <title><?= e($page['title']) ?><?= $siteName ? ' - ' . e($siteName) : '' ?></title>
    <link rel="icon" href="<?= asset('images/favicon.png') ?>" type="image/x-icon" />
    <link rel="stylesheet" href="<?= asset('styles/style.min.css') ?>?v=<?= $version ?>">
</head>
<body>

<?php include ROOT . '/templates/default/header.php'; ?>

<main class="pageContent">
    <?php foreach ($sections as $section):
        $type     = $section['container_type'] ?? 'container';
        $secStyle = buildInlineStyles($section['styles']);

        // Monta colunas
        $colsHtml = '';
        foreach ($section['columns'] as $column):
            $colStyle  = buildInlineStyles($column['styles']);
            $colsHtml .= '<div class="col-' . $column['col_size'] . '"'
                       . ($colStyle ? ' style="' . e($colStyle) . '"' : '') . '>';

            foreach ($column['elements'] as $element):
                $pluginPath = ROOT . '/plugins/' . $element['plugin_type'] . '/Plugin.php';
                if (!file_exists($pluginPath)) continue;
                require_once ROOT . '/plugins/PluginBase.php';
                require_once $pluginPath;
                $className = ucfirst($element['plugin_type']) . 'Plugin';
                if (!class_exists($className)) continue;
                $colsHtml .= (new $className($element['content']))->render();
            endforeach;

            $colsHtml .= '</div>';
        endforeach;

        // Monta row — 5 colunas de col-2 ficam centralizadas (igual ao critério do editor JS)
        $cols5 = count($section['columns']) === 5
              && count(array_filter($section['columns'], fn($c) => (int)$c['col_size'] === 2)) === 5;
        $rowHtml = '<div class="row' . ($cols5 ? ' justify-content-center' : '') . '">'
                 . $colsHtml . '</div>';

        // Envolve conteúdo em .container para tipos que centralizam o conteúdo
        $inner = ($type === 'container' || $type === 'full-inner')
            ? '<div class="container">' . $rowHtml . '</div>'
            : $rowHtml;
    ?>
        <section class="pageSection pageSection--<?= e($type) ?>"<?= $secStyle ? ' style="' . e($secStyle) . '"' : '' ?>>
            <?= $inner ?>
        </section>
    <?php endforeach; ?>
</main>

<?php include ROOT . '/templates/default/footer.php'; ?>

<script src="<?= asset('scripts/common.js') ?>?v=<?= $version ?>"></script>

</body>
</html>
