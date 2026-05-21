<?php include ROOT . '/admin/includes/auth_check.php'; ?>
<?php
if ($_SESSION['usuario']['nivel_acesso'] !== 'admin') {
    header('Location: ' . BASE_URL . '/admin/inicio');
    exit;
}

require_once ROOT . '/core/Database.php';
$usuarios = Database::fetchAll("SELECT id, nome_completo, email, cpf, nivel_acesso, created_at FROM admin_usuarios ORDER BY created_at DESC");
?>
<!DOCTYPE html>
<html>
<head>
<title>FA Constructor - Admin - Gerenciar Usuários</title>
<?php include ROOT . '/admin/includes/assets.php'; ?>
</head>
<body>

<?php include ROOT . '/admin/includes/header/header.php'; ?>

<div class="adminLayout">
    <?php include ROOT . '/admin/includes/sidebar/sidebar.php'; ?>
    <main class="adminLayout__content">

        <section class="gerenciarUsuarios">
            <div class="row">
                <div class="col-md-12">
                    <h2>Gerenciar <span>Usuários</span></h2>
                </div>
            </div>

            <div class="row">
                <div class="col-md-12">
                    <table class="adminTable">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>E-mail</th>
                                <th>Nível</th>
                                <th>Cadastrado em</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($usuarios as $u):
                                $partes    = explode(' ', $u['nome_completo'], 2);
                                $nome      = $partes[0];
                                $sobrenome = $partes[1] ?? '';
                            ?>
                            <tr>
                                <td><?= htmlspecialchars($u['nome_completo']) ?></td>
                                <td><?= htmlspecialchars($u['email']) ?></td>
                                <td><span class="badge badge--<?= $u['nivel_acesso'] ?>"><?= strtoupper($u['nivel_acesso']) ?></span></td>
                                <td><?= date('d/m/Y', strtotime($u['created_at'])) ?></td>
                                <td class="adminTable__actions">
                                    <button class="btn btn--sm btn--secondary btnEditarUsuario"
                                        data-id="<?= $u['id'] ?>"
                                        data-nome="<?= htmlspecialchars($nome) ?>"
                                        data-sobrenome="<?= htmlspecialchars($sobrenome) ?>"
                                        data-email="<?= htmlspecialchars($u['email']) ?>"
                                        data-cpf="<?= htmlspecialchars($u['cpf']) ?>"
                                        data-nivel="<?= $u['nivel_acesso'] ?>">
                                        Editar
                                    </button>
                                    <?php if ((int)$u['id'] !== (int)$_SESSION['usuario']['id']): ?>
                                    <button class="btn btn--sm btn--danger btnExcluirUsuario"
                                        data-id="<?= $u['id'] ?>"
                                        data-nome="<?= htmlspecialchars($u['nome_completo']) ?>">
                                        Excluir
                                    </button>
                                    <?php else: ?>
                                    <button class="btn btn--sm btn--danger" disabled title="Você não pode excluir sua própria conta">
                                        Excluir
                                    </button>
                                    <?php endif; ?>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

    </main>
</div>

<!-- Modal Editar -->
<div class="modal" id="modalEditar">
    <div class="modal__box">
        <div class="modal__header">
            <h3>Editar Usuário</h3>
            <button class="modal__close" id="fecharModalEditar">&times;</button>
        </div>
        <div class="modal__body">
            <input type="hidden" id="editUserId" />
            <div class="formGroup">
                <div class="row">
                    <div class="col-md-6">
                        <div class="formGroup__item">
                            <label>Nome</label>
                            <input class="input" type="text" id="editNome" placeholder="Nome" />
                            <span class="errorText">Digite um nome válido</span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="formGroup__item">
                            <label>Sobrenome</label>
                            <input class="input" type="text" id="editSobrenome" placeholder="Sobrenome" />
                            <span class="errorText">Digite um sobrenome válido</span>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="formGroup__item">
                            <label>E-mail</label>
                            <input class="input" type="text" id="editEmail" placeholder="E-mail" />
                            <span class="errorText">Digite um e-mail válido</span>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="formGroup__item">
                            <label>CPF</label>
                            <input class="input" type="text" id="editCpf" placeholder="___.___.___-__" />
                            <span class="errorText">CPF inválido</span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="formGroup__item">
                            <label>Nível de acesso</label>
                            <select class="input" id="editNivel">
                                <option value="admin">ADMIN</option>
                                <option value="editor">EDITOR</option>
                                <option value="leitor">LEITOR</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="formGroup__item">
                            <label>Nova senha <small>(deixe vazio para manter)</small></label>
                            <input class="input" type="password" id="editSenha" placeholder="Entre 6 e 20 caracteres" />
                            <span class="errorText">A senha deve ter entre 6 e 20 caracteres</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal__footer">
            <button class="btn btn--secondary" id="cancelarEditar">Cancelar</button>
            <button class="btn btn--primary" id="confirmarEditar">Salvar</button>
        </div>
    </div>
</div>

<!-- Modal Excluir -->
<div class="modal" id="modalExcluir">
    <div class="modal__box modal__box--sm">
        <div class="modal__header">
            <h3>Excluir Usuário</h3>
            <button class="modal__close" id="fecharModalExcluir">&times;</button>
        </div>
        <div class="modal__body">
            <p>Tem certeza que deseja excluir o usuário <strong id="nomeExcluir"></strong>? Esta ação não pode ser desfeita.</p>
            <input type="hidden" id="excluirUserId" />
        </div>
        <div class="modal__footer">
            <button class="btn btn--secondary" id="cancelarExcluir">Cancelar</button>
            <button class="btn btn--danger" id="confirmarExcluir">Excluir</button>
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
echo '<script src="' . ADMIN_BASE_URL . '/pages/gerenciarusuarios/gerenciarusuarios.js?v' . $version . '"></script>';
?>

</body>
</html>
