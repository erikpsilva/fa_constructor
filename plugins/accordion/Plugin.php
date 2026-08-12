<?php

require_once ROOT . '/plugins/PanelsPluginBase.php';

// Sanfona: cada item tem um cabeçalho clicável que abre/fecha o conteúdo.
// O toggle é feito em scripts/common.js.
class AccordionPlugin extends PanelsPluginBase {

    public function render(): string {
        $items = $this->items();
        if (!$items) {
            return '';
        }

        $settings  = $this->settings();
        $rootStyle = $this->buildRootStyle() . $this->buildCssVars();
        // Sem isso, um accordion todo fechado não teria como ser aberto por quem
        // só lê a página com JS desativado.
        $firstOpen = ($settings['first_open'] ?? true) ? true : false;

        $html = '';
        foreach (array_values($items) as $i => $item) {
            $open  = ($firstOpen && $i === 0) ? ' is-open' : '';
            $title = htmlspecialchars($this->itemTitle($item, $i), ENT_QUOTES, 'UTF-8');

            $html .= '<div class="plugin-accordion__item' . $open . '">'
                   . '<button type="button" class="plugin-accordion__header"'
                   . ' style="' . e($this->paddingCss('header_padding', ['top' => 12, 'right' => 20, 'bottom' => 12, 'left' => 20])) . '">'
                   . '<span class="plugin-accordion__title">' . $title . '</span>'
                   . '<span class="plugin-accordion__icon" aria-hidden="true"></span>'
                   . '</button>'
                   . '<div class="plugin-accordion__body">'
                   . '<div class="plugin-accordion__content"'
                   . ' style="' . e($this->paddingCss('content_padding', ['top' => 20, 'right' => 20, 'bottom' => 20, 'left' => 20])) . '">'
                   . $this->renderElements($item['elements'] ?? [])
                   . '</div></div></div>';
        }

        return '<div class="plugin-accordion" style="' . e($rootStyle) . '">' . $html . '</div>';
    }

    public function getDefaultConfig(): array {
        return array_replace_recursive(parent::getDefaultConfig(), [
            'settings' => ['first_open' => true],
        ]);
    }

    public function getName(): string {
        return 'Sanfona';
    }
}
