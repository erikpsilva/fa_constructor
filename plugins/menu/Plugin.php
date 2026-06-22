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
            $url    = $this->resolveItemUrl($item);
            $label  = htmlspecialchars($item['label'] ?? '', ENT_QUOTES, 'UTF-8');
            $target = !empty($item['target_blank']) ? ' target="_blank" rel="noopener"' : '';
            $itemsHtml .= '<li class="plugin-menu__item"><a href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '"' . $target . '>' . $label . '</a></li>';
        }

        if ($itemsHtml === '') {
            return '';
        }

        $styleAttr = $this->buildStyleAttr();

        return '<nav class="plugin-menu"' . $styleAttr . '>'
             . '<button type="button" class="plugin-menu__burger" aria-label="Abrir menu"><span></span><span></span><span></span></button>'
             . '<ul class="plugin-menu__list">' . $itemsHtml . '</ul>'
             . '</nav>';
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
                'align'        => 'left',
                'gap'          => 24,
                'text_color'   => '#222222',
                'hover_color'  => '#ae272c',
                'font_size'    => 16,
                'burger_color' => '#222222',
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
