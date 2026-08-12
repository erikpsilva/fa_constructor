<?php

require_once ROOT . '/plugins/PluginBase.php';

// Card pré-montado: imagem + texto + botão, cada parte podendo ser ligada/desligada.
// Não reinventa nada — o botão é renderizado pelo próprio ButtonPlugin (mesmo shape
// de content) e o visual da caixa (fundo/borda/cantos/sombra) usa o mesmo
// buildInlineStyles() genérico de Seção/Coluna.
class CardPlugin extends PluginBase {

    public function render(): string {
        $image  = $this->config['image']  ?? [];
        $text   = $this->config['text']   ?? [];
        $button = $this->config['button'] ?? [];
        $card   = $this->config['card']   ?? [];

        $showImage  = !empty($image['show'])  && trim($image['url']  ?? '') !== '';
        $showText   = !empty($text['show'])   && trim($text['content'] ?? '') !== '';
        $showButton = !empty($button['show']) && trim($button['text'] ?? '') !== '';

        if (!$showImage && !$showText && !$showButton) {
            return '';
        }

        $rootStyle = buildInlineStyles($card['styles'] ?? []);
        $html      = '<div class="plugin-card"' . ($rootStyle ? ' style="' . e($rootStyle) . '"' : '') . '>';

        if ($showImage) {
            $html .= '<div class="plugin-card__media">'
                   . '<img class="plugin-card__image" src="' . e(trim($image['url']))
                   . '" alt="' . e($image['alt'] ?? '') . '"'
                   . $this->buildImageStyle($image) . '>'
                   . '</div>';
        }

        if ($showText || $showButton) {
            $bodyStyle = $this->buildBodyStyle($card);
            $html .= '<div class="plugin-card__body"' . ($bodyStyle ? ' style="' . e($bodyStyle) . '"' : '') . '>';

            if ($showText) {
                $textStyle = $this->buildTextStyle($text);
                $html .= '<div class="plugin-card__text"' . ($textStyle ? ' style="' . e($textStyle) . '"' : '') . '>'
                       . nl2br(e(trim($text['content'])))
                       . '</div>';
            }

            // Delega ao ButtonPlugin: o content do botão do card tem exatamente o mesmo
            // shape de um elemento 'button', então link, cores, hover e geometria
            // funcionam sem duplicar nada.
            if ($showButton) {
                $html .= renderPluginElement(['plugin_type' => 'button', 'content' => $button]);
            }

            $html .= '</div>';
        }

        return $html . '</div>';
    }

    private function buildImageStyle(array $image): string {
        $height = (int) ($image['height'] ?? 0);
        return $height > 0 ? ' style="height:' . $height . 'px;object-fit:cover;"' : '';
    }

    // O padding fica no corpo, e não na raiz do card, para a imagem poder encostar
    // nas bordas (é o visual esperado de um card com foto no topo).
    private function buildBodyStyle(array $card): string {
        $p = $card['padding'] ?? [];
        if (empty($p['top']) && empty($p['right']) && empty($p['bottom']) && empty($p['left'])) {
            return '';
        }

        return 'padding:' . ($p['top'] ?? 0) . 'px ' . ($p['right'] ?? 0) . 'px '
             . ($p['bottom'] ?? 0) . 'px ' . ($p['left'] ?? 0) . 'px;';
    }

    private function buildTextStyle(array $text): string {
        $css = '';

        if (!empty($text['font_size'])) {
            $css .= 'font-size:' . fluidFontSize((int) $text['font_size'], $text['font_size_min'] ?? null) . ';';
        }

        $color = $text['color'] ?? '';
        if ($color && preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $color)) {
            $css .= 'color:' . $color . ';';
        }

        // Resolve o ?? ANTES do in_array: usar $text['align'] no ramo verdadeiro do
        // ternário dispara "Undefined array key" quando a chave não existe (o card
        // guarda sub-arrays que o merge raso do PluginBase não completa).
        $align = $text['align'] ?? 'left';
        if (!in_array($align, ['left', 'center', 'right'], true)) {
            $align = 'left';
        }
        $css .= 'text-align:' . $align . ';';

        if (!empty($text['bold'])) {
            $css .= 'font-weight:700;';
        }

        return $css;
    }

    public function getDefaultConfig(): array {
        return [
            'image'  => ['show' => true, 'url' => '', 'alt' => '', 'height' => 200],
            'text'   => ['show' => true, 'content' => 'Título do card', 'font_size' => 20, 'color' => '#222222', 'align' => 'left', 'bold' => true],
            // Mesmo shape de content do plugin 'button' (ver ButtonPlugin::getDefaultConfig).
            'button' => [
                'show'             => true,
                'text'             => 'Saiba mais',
                'link_type'        => 'url',
                'page_id'          => '',
                'url'              => '',
                'target_blank'     => false,
                'align'            => 'left',
                'padding'          => ['top' => 10, 'right' => 20, 'bottom' => 10, 'left' => 20],
                'bg_color'         => '#ae272c',
                'text_color'       => '#ffffff',
                'hover_bg_color'   => '#8a1f23',
                'hover_text_color' => '#ffffff',
                'border_radius'    => ['tl' => 4, 'tr' => 4, 'br' => 4, 'bl' => 4],
            ],
            'card'   => [
                'padding' => ['top' => 24, 'right' => 24, 'bottom' => 24, 'left' => 24],
                // Mesmo shape de page_sections.styles / section_columns.styles.
                'styles'  => [
                    'bg_color'      => '#ffffff',
                    'border_width'  => 0,
                    'border_color'  => '#e0e0e0',
                    'border_radius' => ['tl' => 8, 'tr' => 8, 'br' => 8, 'bl' => 8],
                    // Ângulo 0 = sombra projetada para baixo (buildInlineStyles usa
                    // cos(ângulo) no eixo Y, então 180 jogaria a sombra para cima).
                    'shadow'        => ['enabled' => true, 'color' => '#000000', 'size' => 18, 'distance' => 4, 'angle' => 0, 'opacity' => 12],
                ],
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Card';
    }
}
