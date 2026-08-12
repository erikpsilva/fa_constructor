<?php

require_once ROOT . '/plugins/PanelsPluginBase.php';

// Abas: títulos lado a lado, um conteúdo visível por vez. A troca de aba é feita
// em scripts/common.js (clique no botão da aba).
class TabsPlugin extends PanelsPluginBase {

    public function render(): string {
        $items = $this->items();
        if (!$items) {
            return '';
        }

        $rootStyle = $this->buildRootStyle() . $this->buildCssVars();

        $nav    = '';
        $panels = '';

        foreach (array_values($items) as $i => $item) {
            $active = $i === 0 ? ' is-active' : '';
            $title  = htmlspecialchars($this->itemTitle($item, $i), ENT_QUOTES, 'UTF-8');

            $nav .= '<button type="button" class="plugin-tabs__tab' . $active . '" data-tab="' . $i . '"'
                  . ' style="' . e($this->paddingCss('header_padding', ['top' => 12, 'right' => 20, 'bottom' => 12, 'left' => 20])) . '">'
                  . $title . '</button>';

            $panels .= '<div class="plugin-tabs__panel' . $active . '" data-tab="' . $i . '"'
                     . ' style="' . e($this->paddingCss('content_padding', ['top' => 20, 'right' => 20, 'bottom' => 20, 'left' => 20])) . '">'
                     . $this->renderElements($item['elements'] ?? [])
                     . '</div>';
        }

        return '<div class="plugin-tabs" style="' . e($rootStyle) . '">'
             . '<div class="plugin-tabs__nav">' . $nav . '</div>'
             . '<div class="plugin-tabs__panels">' . $panels . '</div>'
             . '</div>';
    }

    public function getName(): string {
        return 'Abas';
    }
}
