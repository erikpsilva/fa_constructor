$(document).ready(function () {
    $('#headerStickyEnabled').on('change', function () {
        $('#headerStickyControls').toggle(this.checked);
    });

    $('#btnSaveHeaderBehavior').on('click', function () {
        const $button = $(this);
        $button.prop('disabled', true).text('Salvando...');
        $('#headerBehaviorSaved').text('');

        $.post(ADMIN_BASE_URL + '/services/save_header_behavior.php', {
            enabled:    $('#headerStickyEnabled').is(':checked') ? '1' : '0',
            offset:     $('#headerStickyOffset').val(),
            scale:      $('#headerStickyScale').val(),
            bg_color:   $('#headerStickyBg').val(),
            text_color: $('#headerStickyColor').val(),
            shadow:     $('#headerStickyShadow').is(':checked') ? '1' : '0',
        }).done(function (res) {
            if (res.success) {
                $('#headerBehaviorSaved').text('Salvo ✓');
            } else {
                alert(res.message || 'Erro ao salvar o comportamento do Header.');
            }
        }).fail(function () {
            alert('Erro ao conectar com o servidor.');
        }).always(function () {
            $button.prop('disabled', false).text('Salvar comportamento');
        });
    });
});
