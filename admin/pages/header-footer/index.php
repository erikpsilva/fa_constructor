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

$stickyEnabled = getSetting('header_sticky_enabled', '0') === '1';
$stickyOffset  = (int) getSetting('header_sticky_offset', '180');
$stickyScale   = (int) getSetting('header_sticky_scale', '75');
$stickyBg      = getSetting('header_sticky_bg', '#111111');
$stickyColor   = getSetting('header_sticky_color', '#ffffff');
$stickyShadow  = getSetting('header_sticky_shadow', '1') === '1';
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

            <div class="adminHeaderFooter__behavior">
                <h3>Header fixo e compacto</h3>
                <p>Fixa o Header no topo depois da rolagem escolhida e reduz todos os elementos proporcionalmente.</p>

                <div class="formGroup">
                    <div class="formGroup__item formGroup__item--check">
                        <label class="checkLabel">
                            <input type="checkbox" id="headerStickyEnabled" <?= $stickyEnabled ? 'checked' : '' ?>>
                            Ativar Header fixo ao rolar
                        </label>
                    </div>

                    <div id="headerStickyControls" <?= $stickyEnabled ? '' : 'style="display:none"' ?>>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="formGroup__item">
                                    <label>Fixar depois de rolar (px)</label>
                                    <input class="input" type="number" id="headerStickyOffset" min="0" max="5000" value="<?= $stickyOffset ?>">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="formGroup__item">
                                    <label>Tamanho compacto (%)</label>
                                    <input class="input" type="number" id="headerStickyScale" min="50" max="100" value="<?= $stickyScale ?>">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="formGroup__item formGroup__item--check adminHeaderFooter__shadowCheck">
                                    <label class="checkLabel">
                                        <input type="checkbox" id="headerStickyShadow" <?= $stickyShadow ? 'checked' : '' ?>>
                                        Usar sombra
                                    </label>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="formGroup__item">
                                    <label>Fundo no modo compacto</label>
                                    <input class="input adminHeaderFooter__color" type="color" id="headerStickyBg" value="<?= e($stickyBg) ?>">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="formGroup__item">
                                    <label>Cor do menu e hambúrguer</label>
                                    <input class="input adminHeaderFooter__color" type="color" id="headerStickyColor" value="<?= e($stickyColor) ?>">
                                </div>
                            </div>
                        </div>
                    </div>

                    <button type="button" class="btn btn--success" id="btnSaveHeaderBehavior">Salvar comportamento</button>
                    <span class="adminHeaderFooter__saved" id="headerBehaviorSaved"></span>
                </div>
            </div>
        </section>

    </main>
</div>

<?php include ROOT . '/admin/includes/footer/footer.php'; ?>
<?php include ROOT . '/admin/includes/scripts.php'; ?>

<script>var ADMIN_BASE_URL = "<?= ADMIN_BASE_URL ?>";</script>
<script src="<?= ADMIN_BASE_URL ?>/pages/header-footer/header-footer.js?v<?= time() ?>"></script>

</body>
</html>
