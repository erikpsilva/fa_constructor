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

    // Fecha o menu mobile ao clicar num link.
    $(document).on('click', '.plugin-menu__item a', function () {
        $(this).closest('.plugin-menu').removeClass('plugin-menu--open');
    });

});