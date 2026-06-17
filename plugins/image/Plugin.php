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

        return '<div class="plugin-image plugin-image--' . $align . '">' . $img . '</div>';
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
