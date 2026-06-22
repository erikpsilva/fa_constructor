<?php include ROOT . '/admin/includes/auth_check.php'; ?>
<?php
if ($_SESSION['usuario']['nivel_acesso'] !== 'admin') {
    header('Location: ' . BASE_URL . '/admin/inicio');
    exit;
}

require_once ROOT . '/core/Database.php';

// Garante que sempre exista um registro de Header e de Footer (cria na primeira visita).
function ensureTemplateSection(string $type, string $title): array {
    $page = Database::fetch("SELECT * FROM pages WHERE type = ? LIMIT 1", [$type]);
    if ($page) {
        return $page;
    }

    $id = Database::insert(
        "INSERT INTO pages (title, slug, type, status, is_home) VALUES (?, ?, ?, 'published', 0)",
        [$title, $type, $type]
    );

    return Database::fetch("SELECT * FROM pages WHERE id = ?", [$id]);
}

$header = ensureTemplateSection('header', 'Header');
$footer = ensureTemplateSection('footer', 'Footer');
?>
<!DOCTYPE html>
<html>
<head>
<title>FA Constructor - Admin - Topo e Rodapé</title>
<?php include ROOT . '/admin/includes/assets.php'; ?>
</head>
<body>

<?php include ROOT . '/admin/includes/header/header.php'; ?>

<div class="adminLayout">
    <?php include ROOT . '/admin/includes/sidebar/sidebar.php'; ?>
    <main class="adminLayout__content">

        <section class="adminHeaderFooter">
            <h2>Topo e Rodapé</h2>
            <p class="adminHeaderFooter__hint">
                Conteúdo usado em todas as páginas do site. Edite com o mesmo construtor de seções, colunas e elementos das páginas normais.
            </p>

            <div class="row">
                <div class="col-md-6">
                    <div class="adminHeaderFooter__card">
                        <h3>Header</h3>
                        <p>Topo do site — logo, menu de navegação, etc.</p>
                        <a href="<?= BASE_URL ?>/admin/editor/<?= (int) $header['id'] ?>" class="btn btn--primary btn--full">
                            Editar Header
                        </a>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="adminHeaderFooter__card">
                        <h3>Footer</h3>
                        <p>Rodapé do site — direitos autorais, links, redes sociais, etc.</p>
                        <a href="<?= BASE_URL ?>/admin/editor/<?= (int) $footer['id'] ?>" class="btn btn--primary btn--full">
                            Editar Footer
                        </a>
                    </div>
                </div>
            </div>
        </section>

    </main>
</div>

<?php include ROOT . '/admin/includes/footer/footer.php'; ?>
<?php include ROOT . '/admin/includes/scripts.php'; ?>

</body>
</html>
