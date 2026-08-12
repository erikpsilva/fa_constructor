<?php

require_once ROOT . '/plugins/PluginBase.php';

// Base comum de Tabs e Accordion: os dois são "uma lista de itens com título e
// conteúdo livre", mudando só como o conteúdo é exibido (abas lado a lado x
// sanfona). O shape do content é idêntico nos dois:
//   { items: [ {id, title, elements:[ {id, plugin_type, content} ]} ], settings: {...} }
// Os ids dos itens e dos elementos aninhados são sintéticos (gerados no client),
// exatamente como no Grid — não são linhas do banco, vivem dentro deste JSON.
abstract class PanelsPluginBase extends PluginBase {

    protected function items(): array {
        return $this->config['items'] ?? [];
    }

    protected function settings(): array {
        return $this->config['settings'] ?? [];
    }

    // Fundo/borda/cantos/sombra da caixa — mesmo motor genérico de Seção/Coluna.
    protected function buildRootStyle(): string {
        return buildInlineStyles($this->settings()['styles'] ?? []);
    }

    // Cores de título/ativo e fonte viram CSS custom properties: estado ativo e hover
    // precisam de regra CSS própria, e style inline sempre venceria o :hover.
    protected function buildCssVars(): string {
        $s = $this->settings();

        $vars = [
            '--panels-title-color'  => $s['title_color']  ?? '#333333',
            '--panels-title-bg'     => $s['title_bg']     ?? '#f2f2f2',
            '--panels-active-color' => $s['active_color'] ?? '#ffffff',
            '--panels-active-bg'    => $s['active_bg']    ?? '#ae272c',
            '--panels-font-size'    => fluidFontSize(max(10, (int) ($s['font_size'] ?? 16))),
            '--panels-gap'          => (int) ($s['gap'] ?? 8) . 'px',
            '--panels-divider'      => $s['divider_color'] ?? '#e0e0e0',
        ];

        $css = '';
        foreach ($vars as $key => $value) {
            $css .= $key . ':' . $value . ';';
        }

        return $css;
    }

    protected function paddingCss(string $key, array $fallback): string {
        $p = $this->settings()[$key] ?? $fallback;

        return 'padding:' . (int) ($p['top'] ?? 0) . 'px ' . (int) ($p['right'] ?? 0) . 'px '
             . (int) ($p['bottom'] ?? 0) . 'px ' . (int) ($p['left'] ?? 0) . 'px;';
    }

    // Renderiza os elementos aninhados de um item reusando o resolvedor global de
    // plugins — igual ao GridPlugin, então qualquer plugin funciona aqui dentro.
    protected function renderElements(array $elements): string {
        $html = '';
        foreach ($elements as $element) {
            $html .= renderPluginElement($element);
        }
        return $html;
    }

    protected function itemTitle(array $item, int $index): string {
        $title = trim($item['title'] ?? '');
        return $title !== '' ? $title : 'Item ' . ($index + 1);
    }

    public function getDefaultConfig(): array {
        return [
            'items'    => [],
            'settings' => [
                'title_color'    => '#333333',
                'title_bg'       => '#f2f2f2',
                'active_color'   => '#ffffff',
                'active_bg'      => '#ae272c',
                'divider_color'  => '#e0e0e0',
                'font_size'      => 16,
                'gap'            => 8,
                'header_padding'  => ['top' => 12, 'right' => 20, 'bottom' => 12, 'left' => 20],
                'content_padding' => ['top' => 20, 'right' => 20, 'bottom' => 20, 'left' => 20],
                'styles' => [
                    'bg_color'      => '#ffffff',
                    'border_width'  => 1,
                    'border_color'  => '#e0e0e0',
                    'border_radius' => ['tl' => 6, 'tr' => 6, 'br' => 6, 'bl' => 6],
                    'shadow'        => ['enabled' => false, 'color' => '#000000', 'size' => 0, 'distance' => 0, 'angle' => 0, 'opacity' => 30],
                ],
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }
}
