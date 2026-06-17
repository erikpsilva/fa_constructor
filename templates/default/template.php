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
    <?= renderSections($sections) ?>
</main>

<?php include ROOT . '/templates/default/footer.php'; ?>

<?php include ROOT . '/includes/scripts.php'; ?>

</body>
</html>
