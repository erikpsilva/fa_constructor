$( document ).ready(function() {

    // Inicializa todos os sliders de imagens (plugin "slider").
    // As opções (slidesToShow, autoplay, arrows, dots, etc.) vêm do atributo data-slick de cada slider.
    if ($.fn.slick) {
        $('.plugin-slider').each(function () {
            $(this).slick();
        });
    }

    // Menu de navegação (plugin "menu"): abre/fecha o menu hambúrguer no mobile.
    $(document).on('click', '.plugin-menu__burger', function () {
        $(this).closest('.plugin-menu').toggleClass('plugin-menu--open');
    });

    // Submenu (lista ou mega menu): a setinha abre/fecha. No desktop o hover já abre
    // pelo CSS, mas no toque hover não existe — por isso o botão próprio.
    $(document).on('click', '.plugin-menu__caret', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $item = $(this).closest('.plugin-menu__item');
        // Fecha os outros submenus abertos do mesmo menu antes de abrir este.
        $item.siblings('.plugin-menu__item').removeClass('is-open');
        $item.toggleClass('is-open');
    });

    // Fecha o menu mobile ao clicar num link (inclusive de subitem).
    $(document).on('click', '.plugin-menu__link, .plugin-menu__sublink', function () {
        $(this).closest('.plugin-menu')
            .removeClass('plugin-menu--open')
            .find('.plugin-menu__item').removeClass('is-open');
    });

    // Clicar fora fecha qualquer submenu aberto.
    $(document).on('click', function (e) {
        if (!$(e.target).closest('.plugin-menu').length) {
            $('.plugin-menu__item').removeClass('is-open');
        }
    });

    // Abas (plugin "tabs"): mostra o painel correspondente à aba clicada.
    // O closest('.plugin-tabs') garante que abas aninhadas dentro de outra aba
    // só afetem o próprio grupo.
    $(document).on('click', '.plugin-tabs__tab', function () {
        var $tab   = $(this);
        var $tabs  = $tab.closest('.plugin-tabs');
        var index  = $tab.data('tab');

        $tabs.children('.plugin-tabs__nav').children('.plugin-tabs__tab').removeClass('is-active');
        $tab.addClass('is-active');

        $tabs.children('.plugin-tabs__panels').children('.plugin-tabs__panel').each(function () {
            $(this).toggleClass('is-active', $(this).data('tab') === index);
        });
    });

    // Sanfona (plugin "accordion"): abre/fecha o item clicado.
    $(document).on('click', '.plugin-accordion__header', function () {
        $(this).closest('.plugin-accordion__item').toggleClass('is-open');
    });

    // Carrossel de depoimentos (plugin "testimonials"): as opções vêm do data-slick,
    // igual ao plugin de slider.
    if ($.fn.slick) {
        $('.plugin-depoimentos__slider').each(function () {
            $(this).slick();
        });
    }

    // "Ver mais": abre o depoimento inteiro num modal, para o card poder ficar curto.
    $(document).on('click', '.plugin-depoimentos__more', function () {
        var $card = $(this).closest('.plugin-depoimentos__card');
        var $modal = $('.plugin-depoimentos-modal');

        if (!$modal.length) {
            $modal = $(
                '<div class="plugin-depoimentos-modal">' +
                    '<div class="plugin-depoimentos-modal__overlay"></div>' +
                    '<div class="plugin-depoimentos-modal__box">' +
                        '<button class="plugin-depoimentos-modal__close" type="button" aria-label="Fechar">&times;</button>' +
                        '<div class="plugin-depoimentos-modal__quote"></div>' +
                        '<div class="plugin-depoimentos-modal__author"></div>' +
                    '</div>' +
                '</div>'
            );
            $('body').append($modal);
        }

        $modal.find('.plugin-depoimentos-modal__quote').html($card.find('.plugin-depoimentos__quote').html());
        $modal.find('.plugin-depoimentos-modal__author').html($card.find('.plugin-depoimentos__author').html());
        $modal.addClass('is-open');
        $('body').css('overflow', 'hidden');
    });

    $(document).on('click', '.plugin-depoimentos-modal__overlay, .plugin-depoimentos-modal__close', function () {
        $('.plugin-depoimentos-modal').removeClass('is-open');
        $('body').css('overflow', '');
    });

    // ─── Calculadora de impacto (plugin "calculadora") ──────────────────────
    // Cada calculadora lê a própria config do data-calc, então pode existir mais
    // de uma na mesma página.
    function calcularCalculadora($calc) {
        var cfg = $calc.data('calc') || {};
        var custo = parseFloat(cfg.cost) || 15;
        var pcts  = cfg.pcts || [];

        var $ativo = $calc.find('.plugin-calculadora__value.is-active');
        var valor  = $ativo.length
            ? parseInt($ativo.data('value'), 10) || 0
            : parseInt(($calc.find('.plugin-calculadora__input').val() || '').replace(/\D/g, ''), 10) || 0;

        // Mensal considera o total do ano, para o número refletir o impacto real.
        var mensal = $calc.find('.plugin-calculadora__freq[data-freq="mensal"]').hasClass('is-active');
        var total  = mensal ? valor * (parseInt(cfg.multiplier, 10) || 12) : valor;

        $calc.find('.plugin-calculadora__resultAmount').text(valor);

        $calc.find('.plugin-calculadora__animal').each(function () {
            var i = parseInt($(this).data('index'), 10);
            var quantidade = (total * (pcts[i] || 0)) / custo;
            animarNumero($(this).find('.plugin-calculadora__number'), quantidade);
        });
    }

    function formatarQuantidade(n) {
        var arredondado = Math.round(n * 10) / 10;
        return arredondado % 1 === 0 ? arredondado.toString() : arredondado.toFixed(1);
    }

    function animarNumero($el, ate) {
        var de = parseFloat($el.text()) || 0;
        if (de === ate) return;
        $({ n: de }).animate({ n: ate }, {
            duration: 450,
            easing: 'swing',
            step: function () { $el.text(formatarQuantidade(this.n)); },
            complete: function () { $el.text(formatarQuantidade(ate)); }
        });
    }

    function atualizarBotaoDoacao($calc) {
        var $btn = $calc.find('.plugin-calculadora__donate');
        if (!$btn.length) return;
        var mensal = $calc.find('.plugin-calculadora__freq[data-freq="mensal"]').hasClass('is-active');
        $btn.text(mensal ? $btn.data('label-mensal') : $btn.data('label-unica'));
    }

    $('.plugin-calculadora').each(function () {
        calcularCalculadora($(this));
    });

    $(document).on('click', '.plugin-calculadora__value', function () {
        var $calc = $(this).closest('.plugin-calculadora');
        $calc.find('.plugin-calculadora__value').removeClass('is-active');
        $(this).addClass('is-active');
        $calc.find('.plugin-calculadora__input').val('');
        calcularCalculadora($calc);
    });

    $(document).on('click', '.plugin-calculadora__freq', function () {
        var $calc = $(this).closest('.plugin-calculadora');
        $calc.find('.plugin-calculadora__freq').removeClass('is-active');
        $(this).addClass('is-active');
        calcularCalculadora($calc);
        atualizarBotaoDoacao($calc);
    });

    // Campo "outro valor": só dígitos, formatado como R$ 1.234 (sem centavos).
    $(document).on('keydown', '.plugin-calculadora__input', function (e) {
        var permitidas = [8, 46, 37, 38, 39, 40, 9];
        if (permitidas.indexOf(e.which) !== -1 || e.ctrlKey || e.metaKey) return;
        var digito = (e.which >= 48 && e.which <= 57) || (e.which >= 96 && e.which <= 105);
        if (!digito) e.preventDefault();
    }).on('input', '.plugin-calculadora__input', function () {
        var $calc = $(this).closest('.plugin-calculadora');
        var cru   = this.value.replace(/\D/g, '');

        $calc.find('.plugin-calculadora__value').removeClass('is-active');

        if (!cru) {
            $(this).val('');
            calcularCalculadora($calc);
            return;
        }

        var caret = this.selectionStart;
        var antes = this.value.length;
        var texto = 'R$ ' + parseInt(cru, 10).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

        $(this).val(texto);
        var novo = Math.max(3, caret + (texto.length - antes));
        this.setSelectionRange(novo, novo);

        calcularCalculadora($calc);
    });

});
