$(document).ready(function () {

    // ── Nova página ───────────────────────────────────────────
    $('#btnNovaPagina').on('click', function () {
        resetModalPagina();
        $('#modalPaginaTitulo').text('Nova Página');
        abrirModal('#modalPagina');
    });

    // ── Editar página ─────────────────────────────────────────
    $(document).on('click', '.btnEditarPagina', function () {
        const btn = $(this);
        resetModalPagina();
        $('#modalPaginaTitulo').text('Editar Página');
        $('#paginaId').val(btn.data('id'));
        $('#paginaTitle').val(btn.data('title'));
        $('#paginaSlug').val(btn.data('slug'));
        $('#paginaTemplate').val(btn.data('template'));
        $('#paginaStatus').val(btn.data('status'));
        $('#paginaIsHome').prop('checked', btn.data('is-home') == 1);
        abrirModal('#modalPagina');
    });

    // Auto-gera slug ao digitar o título (só quando criar — campo vazio)
    $('#paginaTitle').on('input', function () {
        if ($('#paginaId').val() === '') {
            $('#paginaSlug').val(slugify($(this).val()));
        }
    });

    $('#fecharModalPagina, #cancelarModalPagina').on('click', function () {
        fecharModal('#modalPagina');
    });

    $('#confirmarModalPagina').on('click', function () {
        limparErros('#modalPagina');
        const id      = $('#paginaId').val();
        const title   = $('#paginaTitle').val().trim();
        const slug    = $('#paginaSlug').val().trim();
        const isHome  = $('#paginaIsHome').is(':checked') ? '1' : '0';
        let erro = false;

        if (!title) { marcarErro('#paginaTitle'); erro = true; }
        if (!slug)  { marcarErro('#paginaSlug');  erro = true; }
        if (erro) return;

        const url = id
            ? ADMIN_BASE_URL + '/services/update_page.php'
            : ADMIN_BASE_URL + '/services/create_page.php';

        $('#confirmarModalPagina').prop('disabled', true).text('Salvando...');

        $.post(url, {
            id:          id,
            title:       title,
            slug:        slug,
            template_id: $('#paginaTemplate').val(),
            status:      $('#paginaStatus').val(),
            is_home:     isHome
        })
        .done(function (res) {
            if (res.success) {
                fecharModal('#modalPagina');
                location.reload();
            } else {
                alert(res.message || 'Erro ao salvar.');
            }
        })
        .fail(function () { alert('Erro ao conectar com o servidor.'); })
        .always(function () {
            $('#confirmarModalPagina').prop('disabled', false).text('Salvar');
        });
    });

    // ── Excluir página ────────────────────────────────────────
    $(document).on('click', '.btnExcluirPagina', function () {
        const btn = $(this);
        $('#excluirPaginaId').val(btn.data('id'));
        $('#tituloPaginaExcluir').text('"' + btn.data('title') + '"');
        abrirModal('#modalExcluirPagina');
    });

    $('#fecharModalExcluirPagina, #cancelarExcluirPagina').on('click', function () {
        fecharModal('#modalExcluirPagina');
    });

    $('#confirmarExcluirPagina').on('click', function () {
        $('#confirmarExcluirPagina').prop('disabled', true).text('Excluindo...');

        $.post(ADMIN_BASE_URL + '/services/delete_page.php', {
            id: $('#excluirPaginaId').val()
        })
        .done(function (res) {
            if (res.success) {
                fecharModal('#modalExcluirPagina');
                location.reload();
            } else {
                alert(res.message || 'Erro ao excluir.');
            }
        })
        .fail(function () { alert('Erro ao conectar com o servidor.'); })
        .always(function () {
            $('#confirmarExcluirPagina').prop('disabled', false).text('Excluir');
        });
    });

    // Fecha modal ao clicar fora
    $(document).on('click', '.modal', function (e) {
        if ($(e.target).hasClass('modal')) fecharModal('.modal--open');
    });

    // ── Helpers ───────────────────────────────────────────────
    function abrirModal(sel)  { $(sel).addClass('modal--open'); $('body').addClass('modal-open'); }
    function fecharModal(sel) { $(sel).removeClass('modal--open'); $('body').removeClass('modal-open'); }

    function resetModalPagina() {
        $('#paginaId').val('');
        $('#paginaTitle').val('');
        $('#paginaSlug').val('');
        $('#paginaTemplate').val('');
        $('#paginaStatus').val('draft');
        $('#paginaIsHome').prop('checked', false);
        limparErros('#modalPagina');
    }

    function marcarErro(sel) {
        $(sel).closest('.formGroup__item').addClass('error');
    }

    function limparErros(ctx) {
        $(ctx + ' .formGroup__item').removeClass('error');
    }

    function slugify(str) {
        const map = {
            'á':'a','à':'a','ã':'a','â':'a','ä':'a',
            'é':'e','è':'e','ê':'e','ë':'e',
            'í':'i','ì':'i','î':'i','ï':'i',
            'ó':'o','ò':'o','õ':'o','ô':'o','ö':'o',
            'ú':'u','ù':'u','û':'u','ü':'u',
            'ç':'c','ñ':'n'
        };
        return str.toLowerCase()
            .replace(/[áàãâäéèêëíìîïóòõôöúùûüçñ]/g, m => map[m] || m)
            .replace(/[^a-z0-9\s\-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
});
