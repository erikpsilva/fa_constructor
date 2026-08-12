<?php include ROOT . '/admin/includes/auth_check.php'; ?>
<?php
if ($_SESSION['usuario']['nivel_acesso'] !== 'admin') {
    header('Location: ' . BASE_URL . '/admin/inicio');
    exit;
}

require_once ROOT . '/core/Database.php';

// Modelos são linhas de `pages` com type='template' — mesmo mecanismo do Header/Footer.
// Nunca ficam públicos: o Router filtra type='page' em todas as rotas do site.
$modelos = Database::fetchAll(
    "SELECT p.*, (SELECT COUNT(*) FROM page_sections s WHERE s.page_id = p.id) AS total_secoes
     FROM pages p
     WHERE p.type = 'template'
     ORDER BY p.created_at DESC"
);
?>
<!DOCTYPE html>
<html>
<head>
<title>FA Constructor - Admin - Modelos</title>
<?php include ROOT . '/admin/includes/assets.php'; ?>
</head>
<body>

<?php include ROOT . '/admin/includes/header/header.php'; ?>

<div class="adminLayout">
    <?php include ROOT . '/admin/includes/sidebar/sidebar.php'; ?>
    <main class="adminLayout__content">

        <section class="adminModelos">
            <h2>Modelos</h2>
            <p class="adminModelos__hint">
                Modelos são páginas prontas guardadas para reaproveitar. Para criar um, abra qualquer
                página no editor e clique em <strong>Salvar como modelo</strong>. Depois, ao criar uma
                <a href="<?= BASE_URL ?>/admin/paginas">página nova</a>, escolha o modelo como ponto de
                partida — o conteúdo é copiado, e editar a página não altera o modelo.
            </p>

            <div class="row">
                <div class="col-md-12">
                    <?php if (empty($modelos)): ?>
                        <div class="adminModelos__empty">
                            <p>Nenhum modelo salvo ainda. Abra uma página no editor e use <strong>Salvar como modelo</strong>.</p>
                        </div>
                    <?php else: ?>
                    <table class="adminTable">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Seções</th>
                                <th>Criado em</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($modelos as $m): ?>
                            <tr>
                                <td><?= htmlspecialchars($m['title']) ?></td>
                                <td><?= (int) $m['total_secoes'] ?></td>
                                <td><?= date('d/m/Y H:i', strtotime($m['created_at'])) ?></td>
                                <td class="adminTable__actions">
                                    <a href="<?= BASE_URL ?>/admin/editor/<?= (int) $m['id'] ?>"
                                       class="btn btn--sm btn--secondary">
                                        Editar modelo
                                    </a>
                                    <button class="btn btn--sm btn--danger btnExcluirModelo"
                                        data-id="<?= (int) $m['id'] ?>"
                                        data-title="<?= htmlspecialchars($m['title']) ?>">
                                        Excluir
                                    </button>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                    <?php endif; ?>
                </div>
            </div>
        </section>

    </main>
</div>

<!-- Modal Excluir -->
<div class="modal" id="modalExcluirModelo">
    <div class="modal__box modal__box--sm">
        <div class="modal__header">
            <h3>Excluir Modelo</h3>
            <button class="modal__close" id="fecharModalExcluirModelo">&times;</button>
        </div>
        <div class="modal__body">
            <p>Tem certeza que deseja excluir o modelo <strong id="tituloModeloExcluir"></strong>?
               As páginas já criadas a partir dele não são afetadas.</p>
            <input type="hidden" id="excluirModeloId" />
        </div>
        <div class="modal__footer">
            <button class="btn btn--secondary" id="cancelarExcluirModelo">Cancelar</button>
            <button class="btn btn--danger" id="confirmarExcluirModelo">Excluir</button>
        </div>
    </div>
</div>

<?php include ROOT . '/admin/includes/footer/footer.php'; ?>
<?php include ROOT . '/admin/includes/scripts.php'; ?>

<script>
    var ADMIN_BASE_URL = "<?= ADMIN_BASE_URL ?>";
    var BASE_URL       = "<?= BASE_URL ?>";
</script>

<?php
$version = time();
echo '<script src="' . ADMIN_BASE_URL . '/pages/modelos/modelos.js?v' . $version . '"></script>';
?>

</body>
</html>
