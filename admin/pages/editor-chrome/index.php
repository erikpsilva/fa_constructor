<?php include ROOT . '/admin/includes/auth_check.php'; ?>
<?php
if ($_SESSION['usuario']['nivel_acesso'] !== 'admin') {
    header('Location: ' . BASE_URL . '/admin/inicio');
    exit;
}

$type = $routeParam ?? '';
if (!in_array($type, ['header', 'footer'], true)) {
    http_response_code(404);
    exit;
}

$html    = renderTemplateSection($type);
$version = time();
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, user-scalable=no">
    <link rel="stylesheet" href="<?= BASE_URL ?>/styles/style.min.css?v=<?= $version ?>">
    <style>body { margin: 0; }</style>
</head>
<body>
<?php if ($html): ?>
    <?= $html ?>
<?php else: ?>
    <p style="padding:16px;font-family:sans-serif;font-size:13px;color:#999;">
        Nenhum conteúdo configurado ainda em <?= $type === 'header' ? 'Header' : 'Rodapé' ?>.
    </p>
<?php endif; ?>
<?php include ROOT . '/includes/scripts.php'; ?>
</body>
</html>
