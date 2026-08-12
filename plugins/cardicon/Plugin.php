<?php

require_once ROOT . '/plugins/PluginBase.php';

// Card com ícone: imagem com um selo de ícone por cima, título, texto e botão.
// Diferente do Card comum por ter o selo sobre a foto e um título separado do texto.
// O botão é delegado ao ButtonPlugin (mesmo shape de content), e o visual da caixa
// usa o buildInlineStyles() genérico de Seção/Coluna.
class CardiconPlugin extends PluginBase {

    public function render(): string {
        $image  = $this->config['image']  ?? [];
        $badge  = $this->config['badge']  ?? [];
        $title  = $this->config['title']  ?? [];
        $text   = $this->config['text']   ?? [];
        $button = $this->config['button'] ?? [];
        $card   = $this->config['card']   ?? [];

        $temImagem = !empty($image['show'])  && trim($image['url'] ?? '') !== '';
        $temSelo   = !empty($badge['show'])  && sanitizeIconClass($badge['icon'] ?? '') !== '';
        $temTitulo = !empty($title['show'])  && trim($title['content'] ?? '') !== '';
        $temTexto  = !empty($text['show'])   && trim($text['content'] ?? '') !== '';
        $temBotao  = !empty($button['show']) && trim($button['text'] ?? '') !== '';

        if (!$temImagem && !$temSelo && !$temTitulo && !$temTexto && !$temBotao) {
            return '';
        }

        $rootStyle = buildInlineStyles($card['styles'] ?? []);
        $html      = '<div class="plugin-cardicon"' . ($rootStyle ? ' style="' . e($rootStyle) . '"' : '') . '>';

        // O selo mora dentro do bloco da mídia porque é ancorado nela. Sem imagem, o
        // bloco continua existindo só para o selo ter onde se posicionar.
        if ($temImagem || $temSelo) {
            $html .= '<div class="plugin-cardicon__media">';

            if ($temImagem) {
                $altura = (int) ($image['height'] ?? 0);
                $css    = $altura > 0 ? 'height:' . $altura . 'px;object-fit:cover;' : '';
                $css   .= $this->imagemRadiusCss($card, $temTitulo || $temTexto || $temBotao);

                $html .= '<img class="plugin-cardicon__image" src="' . e(trim($image['url'])) . '"'
                       . ' alt="' . e($image['alt'] ?? '') . '"'
                       . ($css ? ' style="' . e($css) . '"' : '') . '>';
            }

            if ($temSelo) {
                $html .= $this->renderBadge($badge);
            }

            $html .= '</div>';
        }

        if ($temTitulo || $temTexto || $temBotao) {
            $html .= '<div class="plugin-cardicon__body"' . $this->paddingAttr($card) . '>';

            if ($temTitulo) {
                $html .= '<div class="plugin-cardicon__title" style="' . e($this->textoStyle($title, 18, true)) . '">'
                       . nl2br(e(trim($title['content']))) . '</div>';
            }

            if ($temTexto) {
                $html .= '<div class="plugin-cardicon__text" style="' . e($this->textoStyle($text, 15, false)) . '">'
                       . nl2br(e(trim($text['content']))) . '</div>';
            }

            if ($temBotao) {
                $html .= renderPluginElement(['plugin_type' => 'button', 'content' => $button]);
            }

            $html .= '</div>';
        }

        return $html . '</div>';
    }

    // A imagem herda os cantos DE CIMA do card, para não vazar por fora do
    // arredondamento. O raio vai direto na <img> (e não com overflow no wrapper) de
    // propósito: assim o selo continua livre para passar da borda se o usuário quiser.
    // Quando não há corpo abaixo, a imagem é o card inteiro e leva os 4 cantos.
    private function imagemRadiusCss(array $card, bool $temCorpo): string {
        $styles = $card['styles'] ?? [];
        $br     = $styles['border_radius'] ?? [];
        $borda  = (int) ($styles['border_width'] ?? 0);

        // Desconta a borda: com borda, o canto interno é menor que o externo — é o
        // mesmo cálculo que o navegador faz sozinho quando usa overflow no pai.
        $r = fn($v) => max(0, (int) ($v ?? 0) - $borda);

        $tl = $r($br['tl'] ?? 0);
        $tr = $r($br['tr'] ?? 0);
        $bl = $temCorpo ? 0 : $r($br['bl'] ?? 0);
        $brr = $temCorpo ? 0 : $r($br['br'] ?? 0);

        if ($tl === 0 && $tr === 0 && $bl === 0 && $brr === 0) {
            return '';
        }

        return 'border-radius:' . $tl . 'px ' . $tr . 'px ' . $brr . 'px ' . $bl . 'px;';
    }

    private function renderBadge(array $badge): string {
        $posicao = in_array($badge['position'] ?? 'left', ['left', 'center', 'right'], true)
            ? $badge['position'] : 'left';

        $tamanho = max(20, (int) ($badge['size'] ?? 64));
        $raio    = isset($badge['border_radius']) ? (int) $badge['border_radius'] : 50;

        $css = 'width:' . $tamanho . 'px;height:' . $tamanho . 'px;'
             . 'background-color:' . $this->cor($badge['bg_color'] ?? '', '#ffffff') . ';'
             . 'color:' . $this->cor($badge['color'] ?? '', '#ae272c') . ';'
             . 'font-size:' . max(10, (int) ($badge['icon_size'] ?? round($tamanho * 0.45))) . 'px;'
             // Raio em % deixa o selo redondo em qualquer tamanho; 0 = quadrado.
             . 'border-radius:' . min(50, max(0, $raio)) . '%;'
             . 'top:' . (int) ($badge['offset_y'] ?? 16) . 'px;';

        if ($posicao !== 'center') {
            $css .= $posicao . ':' . (int) ($badge['offset_x'] ?? 16) . 'px;';
        }

        if (!empty($badge['shadow'])) {
            $css .= 'box-shadow:0 4px 12px rgba(0,0,0,0.18);';
        }

        return '<span class="plugin-cardicon__badge plugin-cardicon__badge--' . $posicao . '" style="' . e($css) . '">'
             . '<i class="' . e(sanitizeIconClass($badge['icon'])) . '" aria-hidden="true"></i>'
             . '</span>';
    }

    private function paddingAttr(array $card): string {
        $p = $card['padding'] ?? [];
        if (empty($p['top']) && empty($p['right']) && empty($p['bottom']) && empty($p['left'])) {
            return '';
        }

        return ' style="padding:' . ($p['top'] ?? 0) . 'px ' . ($p['right'] ?? 0) . 'px '
             . ($p['bottom'] ?? 0) . 'px ' . ($p['left'] ?? 0) . 'px;"';
    }

    private function textoStyle(array $t, int $tamanhoPadrao, bool $negritoPadrao): string {
        $align = $t['align'] ?? 'left';
        if (!in_array($align, ['left', 'center', 'right'], true)) {
            $align = 'left';
        }

        $css = 'font-size:' . fluidFontSize(max(8, (int) ($t['font_size'] ?? $tamanhoPadrao)), $t['font_size_min'] ?? null) . ';'
             . 'color:' . $this->cor($t['color'] ?? '', '#222222') . ';'
             . 'text-align:' . $align . ';';

        $negrito = array_key_exists('bold', $t) ? !empty($t['bold']) : $negritoPadrao;
        if ($negrito) {
            $css .= 'font-weight:700;';
        }

        if (!empty($t['uppercase'])) {
            $css .= 'text-transform:uppercase;';
        }

        return $css;
    }

    private function cor(string $valor, string $padrao): string {
        return preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $valor) ? $valor : $padrao;
    }

    public function getDefaultConfig(): array {
        return [
            'image' => ['show' => true, 'url' => '', 'alt' => '', 'height' => 200],
            'badge' => [
                'show' => true, 'icon' => 'fa-solid fa-flask', 'position' => 'left',
                'size' => 64, 'icon_size' => 28, 'color' => '#ae272c', 'bg_color' => '#ffffff',
                'border_radius' => 50, 'offset_x' => 16, 'offset_y' => 16, 'shadow' => true,
            ],
            'title' => ['show' => true, 'content' => 'Título do card', 'font_size' => 18, 'color' => '#111111', 'align' => 'left', 'bold' => true, 'uppercase' => true],
            'text'  => ['show' => true, 'content' => 'Uma frase curta explicando do que se trata este card.', 'font_size' => 15, 'color' => '#555555', 'align' => 'left', 'bold' => false],
            // Mesmo shape de content do plugin 'button' — nasce com cara de link + seta.
            'button' => [
                'show' => true, 'text' => 'CONHECER CAMPANHA', 'link_type' => 'url', 'page_id' => '', 'url' => '',
                'target_blank' => false, 'align' => 'left', 'font_size' => 14,
                'icon' => 'fa-solid fa-arrow-right', 'icon_position' => 'right', 'icon_gap' => 8, 'icon_size' => '',
                'padding' => ['top' => 0, 'right' => 0, 'bottom' => 0, 'left' => 0],
                'bg_color' => '#ffffff', 'text_color' => '#ae272c',
                'hover_bg_color' => '#ffffff', 'hover_text_color' => '#8a1f23',
                'border_radius' => ['tl' => 0, 'tr' => 0, 'br' => 0, 'bl' => 0],
            ],
            'card' => [
                'padding' => ['top' => 24, 'right' => 24, 'bottom' => 24, 'left' => 24],
                'styles'  => [
                    'bg_color'      => '#ffffff',
                    'border_width'  => 0,
                    'border_color'  => '#e0e0e0',
                    'border_radius' => ['tl' => 10, 'tr' => 10, 'br' => 10, 'bl' => 10],
                    'shadow'        => ['enabled' => true, 'color' => '#000000', 'size' => 20, 'distance' => 6, 'angle' => 0, 'opacity' => 12],
                ],
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Card com ícones';
    }
}
