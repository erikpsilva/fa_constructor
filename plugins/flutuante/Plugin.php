<?php

require_once ROOT . '/plugins/PluginBase.php';

// Bloco flutuante: uma caixa que sai do fluxo normal e fica por cima do resto da
// seção (um texto sobre o banner, por exemplo). Aceita qualquer plugin dentro.
//
// A posição é guardada em PORCENTAGEM da seção, e não em pixels — é isso que faz o
// bloco continuar no mesmo lugar proporcional quando a tela muda de tamanho.
class FlutuantePlugin extends PluginBase {

    public function render(): string {
        $itens = $this->config['items'] ?? [];
        $elementos = $itens[0]['elements'] ?? [];

        $conteudo = '';
        foreach ($elementos as $elemento) {
            $conteudo .= renderPluginElement($elemento);
        }

        if (trim($conteudo) === '') {
            return '';
        }

        $pos = $this->config['position'] ?? [];
        $box = $this->config['box'] ?? [];

        $classes = 'plugin-flutuante';
        if (($pos['mode'] ?? 'float') !== 'float') {
            // Modo normal: fica no fluxo, útil para desligar a flutuação sem perder
            // o resto da configuração.
            $classes .= ' plugin-flutuante--normal';
        }
        if (!empty($pos['hide_mobile'])) {
            $classes .= ' plugin-flutuante--hide-mobile';
        }

        return '<div class="' . $classes . '" style="' . e($this->buildStyle($pos, $box)) . '">'
             . '<div class="plugin-flutuante__inner">' . $conteudo . '</div>'
             . '</div>';
    }

    private function buildStyle(array $pos, array $box): string {
        $css = '';

        if (($pos['mode'] ?? 'float') === 'float') {
            $x = $this->limita($pos['x'] ?? 50);
            $y = $this->limita($pos['y'] ?? 50);

            // left/top marcam o ponto de ancoragem do bloco dentro da seção, e o
            // translate desloca o bloco pelo próprio tamanho conforme a âncora
            // escolhida — assim "centro" fica realmente centrado, e não com o canto
            // superior esquerdo no meio.
            $css .= 'left:' . $x . '%;top:' . $y . '%;'
                  . 'transform:translate(' . $this->deslocamento($pos['anchor_x'] ?? 'center') . ','
                  . $this->deslocamento($pos['anchor_y'] ?? 'center') . ');'
                  . 'z-index:' . (int) ($pos['z_index'] ?? 10) . ';';

            // Posição própria no celular (opcional), via CSS vars lidas na media query.
            if (!empty($pos['mobile_override'])) {
                $css .= '--flut-x-mobile:' . $this->limita($pos['x_mobile'] ?? 50) . '%;'
                      . '--flut-y-mobile:' . $this->limita($pos['y_mobile'] ?? 50) . '%;';
            }
        }

        if (!empty($box['width_value'])) {
            $css .= 'width:' . (int) $box['width_value'] . ($box['width_unit'] ?? 'px') . ';';
        }
        if (!empty($box['max_width'])) {
            $css .= 'max-width:' . (int) $box['max_width'] . 'px;';
        }
        if (!empty($box['height_value'])) {
            $css .= 'height:' . (int) $box['height_value'] . ($box['height_unit'] ?? 'px') . ';';
        }

        $p = $box['padding'] ?? [];
        if (!empty($p['top']) || !empty($p['right']) || !empty($p['bottom']) || !empty($p['left'])) {
            $css .= 'padding:' . ($p['top'] ?? 0) . 'px ' . ($p['right'] ?? 0) . 'px '
                  . ($p['bottom'] ?? 0) . 'px ' . ($p['left'] ?? 0) . 'px;';
        }

        // Fundo, borda, cantos e sombra usam o mesmo motor de Seção/Coluna.
        return $css . buildInlineStyles($box['styles'] ?? []);
    }

    private function limita($valor): float {
        return max(-50, min(150, round((float) $valor, 2)));
    }

    private function deslocamento(string $ancora): string {
        return match ($ancora) {
            'start' => '0',
            'end'   => '-100%',
            default => '-50%',
        };
    }

    public function getDefaultConfig(): array {
        return [
            'items'    => [],
            'position' => [
                'mode' => 'float', 'x' => 50, 'y' => 50,
                'anchor_x' => 'center', 'anchor_y' => 'center', 'z_index' => 10,
                'hide_mobile' => false, 'mobile_override' => false, 'x_mobile' => 50, 'y_mobile' => 50,
            ],
            'box' => [
                'width_value' => '', 'width_unit' => '%', 'max_width' => '',
                'height_value' => '', 'height_unit' => 'px',
                'padding' => ['top' => 24, 'right' => 24, 'bottom' => 24, 'left' => 24],
                'styles' => [
                    'bg_color' => '#ffffff',
                    'border_width' => 0, 'border_color' => '#e0e0e0',
                    'border_radius' => ['tl' => 10, 'tr' => 10, 'br' => 10, 'bl' => 10],
                    'shadow' => ['enabled' => true, 'color' => '#000000', 'size' => 24, 'distance' => 8, 'angle' => 0, 'opacity' => 18],
                ],
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Bloco flutuante';
    }
}
