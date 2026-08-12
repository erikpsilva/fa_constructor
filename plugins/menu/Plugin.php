<?php

require_once ROOT . '/plugins/PluginBase.php';

class MenuPlugin extends PluginBase {

    public function render(): string {
        $items = $this->config['items'] ?? [];
        if (!$items) {
            return '';
        }

        $itemsHtml = '';
        foreach ($items as $item) {
            $itemsHtml .= $this->renderItem($item);
        }

        if ($itemsHtml === '') {
            return '';
        }

        return '<nav class="plugin-menu"' . $this->buildStyleAttr() . '>'
             . '<button type="button" class="plugin-menu__burger" aria-label="Abrir menu"><span></span><span></span><span></span></button>'
             . '<ul class="plugin-menu__list">' . $itemsHtml . '</ul>'
             . '</nav>';
    }

    private function renderItem(array $item): string {
        $filhos  = $this->submenuChildren($item);
        $tipo    = $filhos ? ($item['submenu'] ?? 'dropdown') : 'none';
        // O modificador --dropdown/--mega define onde o painel ancora (no item ou no
        // <nav>), então precisa estar no <li> — CSS não consegue olhar o filho.
        $classes = 'plugin-menu__item'
                 . ($filhos ? ' plugin-menu__item--has-sub plugin-menu__item--' . ($tipo === 'mega' ? 'mega' : 'dropdown') : '');

        $html = '<li class="' . $classes . '">'
              . '<div class="plugin-menu__itemTop">'
              . $this->renderLink($item, 'plugin-menu__link');

        if ($filhos) {
            // Botão próprio para abrir/fechar no mobile — no desktop o submenu abre no
            // hover, mas no toque não existe hover, então precisa de algo clicável que
            // não seja o link (senão navegaria antes de mostrar os subitens).
            $html .= '<button type="button" class="plugin-menu__caret" aria-label="Abrir submenu"></button>';
        }

        $html .= '</div>';

        if ($filhos) {
            $cols = max(1, min(4, (int) ($item['mega_columns'] ?? 3)));
            $sub  = '<div class="plugin-menu__sub plugin-menu__sub--' . ($tipo === 'mega' ? 'mega' : 'dropdown') . '"'
                  . ($tipo === 'mega' ? ' style="--menu-mega-cols:' . $cols . ';"' : '') . '>'
                  . '<ul class="plugin-menu__sublist">';

            foreach ($filhos as $filho) {
                $sub .= '<li class="plugin-menu__subitem">'
                      . $this->renderLink($filho, 'plugin-menu__sublink')
                      . '</li>';
            }

            $html .= $sub . '</ul></div>';
        }

        return $html . '</li>';
    }

    // Só considera subitens que tenham algum texto — um subitem em branco criado sem
    // querer no editor não deve fazer o item virar um submenu.
    private function submenuChildren(array $item): array {
        if (($item['submenu'] ?? 'none') === 'none') {
            return [];
        }

        return array_values(array_filter(
            $item['children'] ?? [],
            fn($f) => trim($f['label'] ?? '') !== ''
        ));
    }

    private function renderLink(array $item, string $class): string {
        $url    = $this->resolveItemUrl($item);
        $label  = htmlspecialchars($item['label'] ?? '', ENT_QUOTES, 'UTF-8');
        $target = !empty($item['target_blank']) ? ' target="_blank" rel="noopener"' : '';

        return '<a class="' . $class . '" href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '"' . $target . '>' . $label . '</a>';
    }

    // Nunca retorna vazio/nulo — um item sem link configurado ainda assim aparece
    // no menu (com "#"), igual o preview do editor já fazia. Antes, um item sem
    // URL preenchida era simplesmente descartado do render, podendo esvaziar o
    // menu inteiro (e parecer que as cores configuradas não estavam sendo aplicadas).
    private function resolveItemUrl(array $item): string {
        if (($item['link_type'] ?? 'url') === 'page') {
            $pageId = (int) ($item['page_id'] ?? 0);
            if ($pageId > 0) {
                $page = Database::fetch("SELECT slug FROM pages WHERE id = ? AND type = 'page'", [$pageId]);
                if ($page) {
                    return BASE_URL . '/' . $page['slug'];
                }
            }
            return '#';
        }

        $url = trim($item['url'] ?? '');
        return $url !== '' ? $url : '#';
    }

    private function buildStyleAttr(): string {
        $s = $this->config['settings'] ?? [];

        $vars = [
            '--menu-align'     => in_array(($s['align'] ?? 'left'), ['left', 'center', 'right'], true) ? $s['align'] : 'left',
            '--menu-gap'       => max(0, (int) ($s['gap']        ?? 24)) . 'px',
            '--menu-color'     => $s['text_color']  ?: '#222222',
            '--menu-hover'     => $s['hover_color'] ?: '#ae272c',
            '--menu-fontsize'  => max(10, (int) ($s['font_size'] ?? 16)) . 'px',
            '--menu-burger'    => $s['burger_color'] ?: '#222222',
            // Submenu (dropdown e mega menu)
            '--submenu-bg'       => $s['sub_bg']        ?: '#ffffff',
            '--submenu-color'    => $s['sub_color']     ?: '#222222',
            '--submenu-hover'    => $s['sub_hover']     ?: '#ae272c',
            '--submenu-hover-bg' => $s['sub_hover_bg']  ?: 'transparent',
            '--submenu-fontsize' => max(10, (int) ($s['sub_font_size'] ?? 15)) . 'px',
            '--submenu-radius'   => max(0, (int) ($s['sub_radius']  ?? 6)) . 'px',
            '--submenu-padding'  => max(0, (int) ($s['sub_padding'] ?? 16)) . 'px',
            '--submenu-border'   => ($s['sub_border_width'] ?? 0) > 0
                ? (int) $s['sub_border_width'] . 'px solid ' . ($s['sub_border_color'] ?: '#e0e0e0')
                : 'none',
            '--submenu-shadow'   => !empty($s['sub_shadow']) ? '0 8px 24px rgba(0,0,0,0.14)' : 'none',
        ];

        $css = '';
        foreach ($vars as $key => $value) {
            $css .= $key . ':' . $value . ';';
        }

        return ' style="' . htmlspecialchars($css, ENT_QUOTES, 'UTF-8') . '"';
    }

    public function getDefaultConfig(): array {
        return [
            'items'    => [],
            'settings' => [
                'align'            => 'left',
                'gap'              => 24,
                'text_color'       => '#222222',
                'hover_color'      => '#ae272c',
                'font_size'        => 16,
                'burger_color'     => '#222222',
                'sub_bg'           => '#ffffff',
                'sub_color'        => '#222222',
                'sub_hover'        => '#ae272c',
                'sub_hover_bg'     => '',
                'sub_font_size'    => 15,
                'sub_radius'       => 6,
                'sub_padding'      => 16,
                'sub_border_width' => 0,
                'sub_border_color' => '#e0e0e0',
                'sub_shadow'       => true,
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Menu';
    }
}
