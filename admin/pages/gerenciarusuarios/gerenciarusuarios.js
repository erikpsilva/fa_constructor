$(document).ready(function () {

    // ── Editar ────────────────────────────────────────────────
    $(document).on('click', '.btnEditarUsuario', function () {
        const btn = $(this);
        $('#editUserId').val(btn.data('id'));
        $('#editNome').val(btn.data('nome'));
        $('#editSobrenome').val(btn.data('sobrenome'));
        $('#editEmail').val(btn.data('email'));
        $('#editCpf').val(btn.data('cpf'));
        $('#editNivel').val(btn.data('nivel'));
        $('#editSenha').val('');
        limparErrosEditar();
        abrirModal('#modalEditar');
    });

    $('#fecharModalEditar, #cancelarEditar').on('click', function () {
        fecharModal('#modalEditar');
    });

    $('#confirmarEditar').on('click', function () {
        limparErrosEditar();
        const nome      = $('#editNome').val().trim();
        const sobrenome = $('#editSobrenome').val().trim();
        const email     = $('#editEmail').val().trim();
        const cpf       = $('#editCpf').val().replace(/\D/g, '');
        const nivel     = $('#editNivel').val();
        const senha     = $('#editSenha').val();
        let erro = false;

        if (nome.length < 3)      { $('#editNome').closest('.formGroup__item').addClass('error'); erro = true; }
        if (sobrenome.length < 3) { $('#editSobrenome').closest('.formGroup__item').addClass('error'); erro = true; }
        if (!validarEmail(email)) { $('#editEmail').closest('.formGroup__item').addClass('error'); erro = true; }
        if (cpf.length !== 11)    { $('#editCpf').closest('.formGroup__item').addClass('error'); erro = true; }
        if (senha !== '' && (senha.length < 6 || senha.length > 20)) {
            $('#editSenha').closest('.formGroup__item').addClass('error');
            erro = true;
        }
        if (erro) return;

        $('#confirmarEditar').prop('disabled', true).text('Salvando...');

        $.post(ADMIN_BASE_URL + '/services/admin_update_user.php', {
            userId:             $('#editUserId').val(),
            userNameVal:        nome,
            userLastNameVal:    sobrenome,
            userEmailVal:       email,
            userCpfVal:         cpf,
            userLevelAccessVal: nivel,
            userPasswordVal:    senha
        })
        .done(function (res) {
            if (res.success) {
                fecharModal('#modalEditar');
                location.reload();
            } else {
                alert(res.message || 'Erro ao salvar.');
            }
        })
        .fail(function () { alert('Erro ao conectar com o servidor.'); })
        .always(function () { $('#confirmarEditar').prop('disabled', false).text('Salvar'); });
    });

    // ── Excluir ───────────────────────────────────────────────
    $(document).on('click', '.btnExcluirUsuario', function () {
        const btn = $(this);
        $('#excluirUserId').val(btn.data('id'));
        $('#nomeExcluir').text(btn.data('nome'));
        abrirModal('#modalExcluir');
    });

    $('#fecharModalExcluir, #cancelarExcluir').on('click', function () {
        fecharModal('#modalExcluir');
    });

    $('#confirmarExcluir').on('click', function () {
        $('#confirmarExcluir').prop('disabled', true).text('Excluindo...');

        $.post(ADMIN_BASE_URL + '/services/delete_user.php', {
            userId: $('#excluirUserId').val()
        })
        .done(function (res) {
            if (res.success) {
                fecharModal('#modalExcluir');
                location.reload();
            } else {
                alert(res.message || 'Erro ao excluir.');
            }
        })
        .fail(function () { alert('Erro ao conectar com o servidor.'); })
        .always(function () { $('#confirmarExcluir').prop('disabled', false).text('Excluir'); });
    });

    // ── Helpers ───────────────────────────────────────────────
    function abrirModal(seletor) {
        $(seletor).addClass('modal--open');
        $('body').addClass('modal-open');
    }

    function fecharModal(seletor) {
        $(seletor).removeClass('modal--open');
        $('body').removeClass('modal-open');
    }

    function limparErrosEditar() {
        $('#modalEditar .formGroup__item').removeClass('error');
    }

    function validarEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Fecha modal ao clicar fora
    $(document).on('click', '.modal', function (e) {
        if ($(e.target).hasClass('modal')) {
            fecharModal('.modal--open');
        }
    });
});
