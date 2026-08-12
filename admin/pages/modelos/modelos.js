$(document).ready(function () {

    // ── Excluir modelo ────────────────────────────────────────
    $(document).on('click', '.btnExcluirModelo', function () {
        const btn = $(this);
        $('#excluirModeloId').val(btn.data('id'));
        $('#tituloModeloExcluir').text('"' + btn.data('title') + '"');
        abrirModal('#modalExcluirModelo');
    });

    $('#fecharModalExcluirModelo, #cancelarExcluirModelo').on('click', function () {
        fecharModal('#modalExcluirModelo');
    });

    $('#confirmarExcluirModelo').on('click', function () {
        const btn = $(this);
        btn.prop('disabled', true).text('Excluindo...');

        $.post(ADMIN_BASE_URL + '/services/delete_template.php', {
            id: $('#excluirModeloId').val()
        })
        .done(function (res) {
            if (res.success) {
                fecharModal('#modalExcluirModelo');
                location.reload();
            } else {
                alert(res.message || 'Erro ao excluir.');
            }
        })
        .fail(function () { alert('Erro ao conectar com o servidor.'); })
        .always(function () {
            btn.prop('disabled', false).text('Excluir');
        });
    });

    // Fecha modal ao clicar fora
    $(document).on('click', '.modal', function (e) {
        if ($(e.target).hasClass('modal')) fecharModal('.modal--open');
    });

    // ── Helpers ───────────────────────────────────────────────
    function abrirModal(sel)  { $(sel).addClass('modal--open'); $('body').addClass('modal-open'); }
    function fecharModal(sel) { $(sel).removeClass('modal--open'); $('body').removeClass('modal-open'); }
});
