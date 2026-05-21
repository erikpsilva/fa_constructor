<?php include ROOT . '/admin/includes/auth_check.php'; ?>
<?php
if ($_SESSION['usuario']['nivel_acesso'] !== 'admin') {
    header('Location: ' . BASE_URL . '/admin/inicio');
    exit;
}

require_once ROOT . '/core/Database.php';
$paginas   = Database::fetchAll(
    "SELECT p.*, t.name AS template_name
     FROM pages p
     LEFT JOIN templates t ON p.template_id = t.id
     ORDER BY p.is_home DESC, p.created_at DESC"
);
$templates = Database::fetchAll("SELECT id, name FROM templates ORDER BY name ASC");
?>
<!DOCTYPE html>
<html>
<head>
<title>FA Constructor - Admin - Páginas</title>
<?php include ROOT . '/admin/includes/assets.php'; ?>
</head>
<body>

<?php include ROOT . '/admin/includes/header/header.php'; ?>

<div class="adminLayout">
    <?php include ROOT . '/admin/includes/sidebar/sidebar.php'; ?>
    <main class="adminLayout__content">

        <section class="adminPaginas">
            <div class="row">
                <div class="col-md-8">
                    <h2>Páginas</h2>
                </div>
                <div class="col-md-4 adminPaginas__header-action">
                    <button class="btn btn--primary" id="btnNovaPagina">+ Nova Página</button>
                </div>
            </div>

            <div class="row">
                <div class="col-md-12">
                    <?php if (empty($paginas)): ?>
                        <div class="adminPaginas__empty">
                            <p>Nenhuma página criada ainda. Clique em <strong>+ Nova Página</strong> para começar.</p>
                        </div>
                    <?php else: ?>
                    <table class="adminTable">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Slug</th>
                                <th>Template</th>
                                <th>Status</th>
                                <th>Inicial</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($paginas as $p): ?>
                            <tr>
                                <td><?= htmlspecialchars($p['title']) ?></td>
                                <td><code>/<?= htmlspecialchars($p['slug']) ?></code></td>
                                <td><?= htmlspecialchars($p['template_name'] ?? '—') ?></td>
                                <td>
                                    <span class="badge badge--status-<?= $p['status'] ?>">
                                        <?= $p['status'] === 'published' ? 'Publicada' : 'Rascunho' ?>
                                    </span>
                                </td>
                                <td>
                                    <?php if ($p['is_home']): ?>
                                        <span class="badge badge--home">Inicial</span>
                                    <?php else: ?>
                                        <span class="adminTable__dash">—</span>
                                    <?php endif; ?>
                                </td>
                                <td class="adminTable__actions">
                                    <a href="<?= BASE_URL ?>/admin/editor/<?= $p['id'] ?>"
                                       class="btn btn--sm btn--secondary">
                                        Editar página
                                    </a>
                                    <button class="btn btn--sm btn--gray btnEditarPagina"
                                        data-id="<?= $p['id'] ?>"
                                        data-title="<?= htmlspecialchars($p['title']) ?>"
                                        data-slug="<?= htmlspecialchars($p['slug']) ?>"
                                        data-template="<?= (int)$p['template_id'] ?>"
                                        data-status="<?= $p['status'] ?>"
                                        data-is-home="<?= $p['is_home'] ?>">
                                        Configurações
                                    </button>
                                    <button class="btn btn--sm btn--danger btnExcluirPagina"
                                        data-id="<?= $p['id'] ?>"
                                        data-title="<?= htmlspecialchars($p['title']) ?>">
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

<!-- Modal Nova / Editar Página -->
<div class="modal" id="modalPagina">
    <div class="modal__box">
        <div class="modal__header">
            <h3 id="modalPaginaTitulo">Nova Página</h3>
            <button class="modal__close" id="fecharModalPagina">&times;</button>
        </div>
        <div class="modal__body">
            <input type="hidden" id="paginaId" value="" />
            <div class="formGroup">
                <div class="row">
                    <div class="col-md-12">
                        <div class="formGroup__item">
                            <label>Nome da página</label>
                            <input class="input" type="text" id="paginaTitle" placeholder="Ex: Início, Sobre, Contato" />
                            <span class="errorText">O nome é obrigatório</span>
                        </div>
                    </div>
                    <div class="col-md-12">
                        <div class="formGroup__item">
                            <label>Slug <small>(URL da página)</small></label>
                            <input class="input" type="text" id="paginaSlug" placeholder="ex: inicio" />
                            <span class="errorText">O slug é obrigatório</span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="formGroup__item">
                            <label>Template</label>
                            <select class="input" id="paginaTemplate">
                                <option value="">— Sem template —</option>
                                <?php foreach ($templates as $t): ?>
                                    <option value="<?= $t['id'] ?>"><?= htmlspecialchars($t['name']) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="formGroup__item">
                            <label>Status</label>
                            <select class="input" id="paginaStatus">
                                <option value="draft">Rascunho</option>
                                <option value="published">Publicada</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-12">
                        <div class="formGroup__item formGroup__item--check">
                            <label class="checkLabel">
                                <input type="checkbox" id="paginaIsHome" value="1" />
                                <span>Definir como página inicial do site</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--secondary" id="cancelarModalPagina">Cancelar</button>
            <button class="btn btn--primary" id="confirmarModalPagina">Salvar</button>
        </div>
    </div>
</div>

<!-- Modal Excluir -->
<div class="modal" id="modalExcluirPagina">
    <div class="modal__box modal__box--sm">
        <div class="modal__header">
            <h3>Excluir Página</h3>
            <button class="modal__close" id="fecharModalExcluirPagina">&times;</button>
        </div>
        <div class="modal__body">
            <p>Tem certeza que deseja excluir a página <strong id="tituloPaginaExcluir"></strong>? Esta ação não pode ser desfeita.</p>
            <input type="hidden" id="excluirPaginaId" />
        </div>
        <div class="modal__footer">
            <button class="btn btn--secondary" id="cancelarExcluirPagina">Cancelar</button>
            <button class="btn btn--danger" id="confirmarExcluirPagina">Excluir</button>
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
echo '<script src="' . ADMIN_BASE_URL . '/pages/paginas/paginas.js?v' . $version . '"></script>';
?>

</body>
</html>
