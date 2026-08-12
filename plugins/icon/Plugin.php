<?php

require_once ROOT . '/plugins/PluginBase.php';

// Ícone do Font Awesome. O ícone em si é uma <i> com as classes do FA; o resto
// (tamanho, cores, fundo, borda, link) é configurado no editor.
class IconPlugin extends PluginBase {

    public function render(): string {
        $icon = sanitizeIconClass($this->config['icon'] ?? '');
        if ($icon === '') {
            return '';
        }

        $align = $this->config['align'] ?? 'left';
        if (!in_array($align, ['left', 'center', 'right'], true)) {
            $align = 'left';
        }

        // Cor normal/hover como CSS var: hover precisa de regra própria e style
        // inline venceria o :hover (mesma técnica do Menu/Botão).
        $vars = '--icon-color:' . $this->colorOr($this->config['color'] ?? '', '#333333') . ';'
              . '--icon-hover:' . $this->colorOr($this->config['hover_color'] ?? '', $this->colorOr($this->config['color'] ?? '', '#333333')) . ';';

        $inner = '<i class="' . e($icon) . '" style="' . e($this->buildIconStyle()) . '" aria-hidden="true"></i>';

        $label = trim($this->config['label'] ?? '');
        if ($label !== '') {
            $inner .= '<span class="plugin-icon__label">' . e($label) . '</span>';
        }

        $url = $this->resolveUrl();
        if ($url !== null) {
            $target = !empty($this->config['target_blank']) ? ' target="_blank" rel="noopener"' : '';
            $inner  = '<a class="plugin-icon__link" href="' . e($url) . '"' . $target . '>' . $inner . '</a>';
        }

        return '<div class="plugin-icon plugin-icon--' . $align . '" style="' . e($vars) . '">'
             . $inner . '</div>';
    }

    private function colorOr(string $cor, string $padrao): string {
        return preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $cor) ? $cor : $padrao;
    }

    private function buildIconStyle(): string {
        $css = 'font-size:' . max(8, (int) ($this->config['size'] ?? 32)) . 'px;';

        if (!empty($this->config['bg_color'])) {
            $css .= 'background-color:' . $this->colorOr($this->config['bg_color'], '#eeeeee') . ';';
        }

        $p = (int) ($this->config['padding'] ?? 0);
        if ($p > 0) {
            $css .= 'padding:' . $p . 'px;';
        }

        $bw = (int) ($this->config['border_width'] ?? 0);
        if ($bw > 0) {
            $css .= 'border:' . $bw . 'px solid ' . $this->colorOr($this->config['border_color'] ?? '', '#333333') . ';';
        }

        $br = (int) ($this->config['border_radius'] ?? 0);
        if ($br > 0) {
            $css .= 'border-radius:' . $br . 'px;';
        }

        $rot = (int) ($this->config['rotate'] ?? 0);
        if ($rot !== 0) {
            $css .= 'transform:rotate(' . $rot . 'deg);';
        }

        return $css;
    }

    // Mesmo esquema de link do Botão/Menu; null = ícone sem link (não vira <a>).
    private function resolveUrl(): ?string {
        $tipo = $this->config['link_type'] ?? 'none';

        if ($tipo === 'page') {
            $pageId = (int) ($this->config['page_id'] ?? 0);
            if ($pageId > 0) {
                $page = Database::fetch("SELECT slug FROM pages WHERE id = ? AND type = 'page'", [$pageId]);
                if ($page) {
                    return BASE_URL . '/' . $page['slug'];
                }
            }
            return '#';
        }

        if ($tipo === 'url') {
            $url = trim($this->config['url'] ?? '');
            return $url !== '' ? $url : '#';
        }

        return null;
    }

    public function getDefaultConfig(): array {
        return [
            'icon'          => 'fa-solid fa-star',
            'label'         => '',
            'size'          => 32,
            'color'         => '#333333',
            'hover_color'   => '',
            'align'         => 'left',
            'bg_color'      => '',
            'padding'       => 0,
            'border_width'  => 0,
            'border_color'  => '#333333',
            'border_radius' => 0,
            'rotate'        => 0,
            'link_type'     => 'none',
            'page_id'       => '',
            'url'           => '',
            'target_blank'  => false,
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Ícone';
    }
}
