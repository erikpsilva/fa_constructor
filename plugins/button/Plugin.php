<?php

require_once ROOT . '/plugins/PluginBase.php';

class ButtonPlugin extends PluginBase {

    public function render(): string {
        $text = trim($this->config['text'] ?? '');
        if ($text === '') {
            return '';
        }

        $align = in_array($this->config['align'] ?? 'left', ['left', 'center', 'right'], true)
            ? $this->config['align'] : 'left';

        $url       = $this->resolveUrl();
        $target    = !empty($this->config['target_blank']) ? ' target="_blank" rel="noopener"' : '';
        $label     = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        $geometry  = $this->buildGeometryStyle();
        $colorVars = $this->buildColorVarsAttr();

        return '<div class="plugin-button plugin-button--' . $align . '"' . $colorVars . '>'
             . '<a class="plugin-button__link" href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '"' . $target
             . ($geometry ? ' style="' . $geometry . '"' : '') . '>' . $label . '</a>'
             . '</div>';
    }

    private function resolveUrl(): string {
        if (($this->config['link_type'] ?? 'url') === 'page') {
            $pageId = (int) ($this->config['page_id'] ?? 0);
            if ($pageId > 0) {
                $page = Database::fetch("SELECT slug FROM pages WHERE id = ? AND type = 'page'", [$pageId]);
                if ($page) {
                    return BASE_URL . '/' . $page['slug'];
                }
            }
            return '#';
        }

        $url = trim($this->config['url'] ?? '');
        return $url !== '' ? $url : '#';
    }

    // Largura/altura/padding/margem/borda/sombra não precisam de hover, então vão
    // direto como style inline (cor de fundo/texto não entram aqui, ver buildColorVarsAttr).
    private function buildGeometryStyle(): string {
        $css = '';

        if (!empty($this->config['width_value'])) {
            $css .= 'width:' . (int) $this->config['width_value'] . ($this->config['width_unit'] ?? 'px') . ';';
        }
        if (!empty($this->config['height_value'])) {
            $css .= 'height:' . (int) $this->config['height_value'] . ($this->config['height_unit'] ?? 'px') . ';';
        }

        $p = $this->config['padding'] ?? [];
        if (!empty($p['top']) || !empty($p['right']) || !empty($p['bottom']) || !empty($p['left'])) {
            $css .= 'padding:' . ($p['top']??0) . 'px ' . ($p['right']??0) . 'px ' . ($p['bottom']??0) . 'px ' . ($p['left']??0) . 'px;';
        }

        $m = $this->config['margin'] ?? [];
        if (!empty($m['top']) || !empty($m['right']) || !empty($m['bottom']) || !empty($m['left'])) {
            $css .= 'margin:' . ($m['top']??0) . 'px ' . ($m['right']??0) . 'px ' . ($m['bottom']??0) . 'px ' . ($m['left']??0) . 'px;';
        }

        if (!empty($this->config['border_width'])) {
            $css .= 'border:' . (int) $this->config['border_width'] . 'px solid ' . ($this->config['border_color'] ?? '#000000') . ';';
        }

        $br = $this->config['border_radius'] ?? [];
        if (!empty($br['tl']) || !empty($br['tr']) || !empty($br['br']) || !empty($br['bl'])) {
            $css .= 'border-radius:' . ($br['tl']??0) . 'px ' . ($br['tr']??0) . 'px ' . ($br['br']??0) . 'px ' . ($br['bl']??0) . 'px;';
        }

        $sh = $this->config['shadow'] ?? [];
        if (!empty($sh['enabled'])) {
            $rad   = deg2rad($sh['angle'] ?? 135);
            $ox    = (int) round(sin($rad) * ($sh['distance'] ?? 0));
            $oy    = (int) round(cos($rad) * ($sh['distance'] ?? 0));
            $alpha = number_format(($sh['opacity'] ?? 30) / 100, 2);
            $hex   = ltrim($sh['color'] ?? '#000000', '#');
            $r     = hexdec(substr($hex, 0, 2));
            $g     = hexdec(substr($hex, 2, 2));
            $b     = hexdec(substr($hex, 4, 2));
            $css  .= "box-shadow:{$ox}px {$oy}px " . ($sh['size'] ?? 0) . "px rgba({$r},{$g},{$b},{$alpha});";
        }

        return $css;
    }

    // Cor de fundo/texto (normal e hover) viram CSS custom properties no wrapper,
    // porque hover não pode ser feito com style inline — precisa de uma regra CSS
    // própria (:hover) consumindo essas variáveis (ver styles/modules/common.less).
    private function buildColorVarsAttr(): string {
        $vars = [
            '--btn-bg'          => $this->config['bg_color']         ?: '#ae272c',
            '--btn-color'       => $this->config['text_color']       ?: '#ffffff',
            '--btn-hover-bg'    => $this->config['hover_bg_color']   ?: '#8a1f23',
            '--btn-hover-color' => $this->config['hover_text_color'] ?: '#ffffff',
        ];

        $css = '';
        foreach ($vars as $key => $value) {
            $css .= $key . ':' . $value . ';';
        }

        return ' style="' . htmlspecialchars($css, ENT_QUOTES, 'UTF-8') . '"';
    }

    public function getDefaultConfig(): array {
        return [
            'text'             => 'Clique aqui',
            'link_type'        => 'url',
            'page_id'          => '',
            'url'              => '',
            'target_blank'     => false,
            'align'            => 'left',
            'width_value'      => '',
            'width_unit'       => 'px',
            'height_value'     => '',
            'height_unit'      => 'px',
            'padding'          => ['top' => 12, 'right' => 24, 'bottom' => 12, 'left' => 24],
            'margin'           => ['top' => 0, 'right' => 0, 'bottom' => 0, 'left' => 0],
            'bg_color'         => '#ae272c',
            'text_color'       => '#ffffff',
            'hover_bg_color'   => '#8a1f23',
            'hover_text_color' => '#ffffff',
            'border_width'     => 0,
            'border_color'     => '#000000',
            'border_radius'    => ['tl' => 4, 'tr' => 4, 'br' => 4, 'bl' => 4],
            'shadow'           => ['enabled' => false, 'color' => '#000000', 'size' => 0, 'distance' => 0, 'angle' => 135, 'opacity' => 30],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Botão';
    }
}
