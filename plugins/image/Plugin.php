<?php

require_once ROOT . '/plugins/PluginBase.php';

class ImagePlugin extends PluginBase {

    public function render(): string {
        $url = $this->config['image_url'] ?? '';
        if (!$url) {
            return '';
        }

        $alt   = htmlspecialchars($this->config['alt'] ?? '', ENT_QUOTES, 'UTF-8');
        $align = $this->config['align'] ?? 'center';
        if (!in_array($align, ['left', 'center', 'right'], true)) {
            $align = 'center';
        }

        $css = '';
        if (!empty($this->config['width_value'])) {
            $css .= 'width:' . (int) $this->config['width_value'] . ($this->config['width_unit'] ?? '%') . ';';
        }
        if (!empty($this->config['border_radius'])) {
            $css .= 'border-radius:' . (int) $this->config['border_radius'] . 'px;';
        }
        $imgStyle = $css ? ' style="' . $css . '"' : '';

        $img = '<img src="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '" alt="' . $alt . '"' . $imgStyle . '>';

        $link = trim($this->config['link_url'] ?? '');
        if ($link) {
            $img = '<a href="' . htmlspecialchars($link, ENT_QUOTES, 'UTF-8') . '">' . $img . '</a>';
        }

        // A margem vai no wrapper, e não na <img>: é ele que ocupa a largura da coluna
        // e faz o alinhamento, então é dele que o espaçamento externo tem que sair.
        $wrapperStyle = $this->buildMarginStyle();

        return '<div class="plugin-image plugin-image--' . $align . '"'
             . ($wrapperStyle ? ' style="' . $wrapperStyle . '"' : '') . '>' . $img . '</div>';
    }

    private function buildMarginStyle(): string {
        $m = $this->config['margin'] ?? [];
        if (empty($m['top']) && empty($m['right']) && empty($m['bottom']) && empty($m['left'])) {
            return '';
        }

        return sprintf(
            'margin:%dpx %dpx %dpx %dpx;',
            $m['top'] ?? 0, $m['right'] ?? 0, $m['bottom'] ?? 0, $m['left'] ?? 0
        );
    }

    public function getDefaultConfig(): array {
        return [
            'image_url'   => '',
            'alt'         => '',
            'link_url'    => '',
            'align'       => 'center',
            'width_value'   => '',
            'width_unit'    => '%',
            'border_radius' => 0,
            'margin'        => ['top' => 0, 'right' => 0, 'bottom' => 0, 'left' => 0],
        ];
    }

    public function getEditorFields(): array {
        return [
            ['key' => 'image_url', 'label' => 'Imagem', 'type' => 'image'],
            ['key' => 'alt',       'label' => 'Texto alternativo', 'type' => 'text'],
            ['key' => 'link_url',  'label' => 'Link', 'type' => 'text'],
        ];
    }

    public function getName(): string {
        return 'Imagem';
    }
}
