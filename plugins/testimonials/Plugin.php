<?php

require_once ROOT . '/plugins/PluginBase.php';

// Carrossel de depoimentos: ocupa a seção inteira (tarja, título e o carrossel).
// O carrossel roda no Slick, que já vem no projeto — as opções vão no data-slick,
// mesmo padrão do plugin Slider.
class TestimonialsPlugin extends PluginBase {

    public function render(): string {
        $itens = $this->itensValidos();
        if (!$itens) {
            return '';
        }

        $h  = $this->config['header'] ?? [];
        $st = $this->config['style']  ?? [];

        $html = '<div class="plugin-depoimentos" style="' . e($this->buildCssVars()) . '">';
        $html .= $this->renderHeader($h);

        $html .= '<div class="plugin-depoimentos__slider" data-slick=\'' . $this->buildSlickJson() . '\'>';
        foreach ($itens as $item) {
            $html .= $this->renderItem($item, $st);
        }
        $html .= '</div></div>';

        return $html;
    }

    // Um depoimento sem texto não vira card (evita slide em branco no carrossel).
    private function itensValidos(): array {
        return array_values(array_filter(
            $this->config['items'] ?? [],
            fn($i) => trim($i['text'] ?? '') !== ''
        ));
    }

    private function renderHeader(array $h): string {
        $tarja  = trim($h['eyebrow'] ?? '');
        $titulo = trim($h['title'] ?? '');

        if ($tarja === '' && $titulo === '') {
            return '';
        }

        // ?? resolvido antes do in_array: usar $h['align'] no ramo verdadeiro do
        // ternário dispara "Undefined array key" quando a chave não existe.
        $align = $h['align'] ?? 'center';
        if (!in_array($align, ['left', 'center', 'right'], true)) {
            $align = 'center';
        }

        $html  = '<div class="plugin-depoimentos__header" style="text-align:' . $align . ';">';

        if ($tarja !== '') {
            $html .= '<p class="plugin-depoimentos__eyebrow">' . e($tarja) . '</p>';
        }
        if ($titulo !== '') {
            // Permite <strong> no título (destaque de parte da frase), como no site
            // original — por isso não escapa tudo, só limita as tags.
            $html .= '<h2 class="plugin-depoimentos__title">' . strip_tags($titulo, '<strong><b><em><br>') . '</h2>';
        }

        return $html . '</div>';
    }

    private function renderItem(array $item, array $st): string {
        $nome = trim($item['name'] ?? '');

        $html = '<div class="plugin-depoimentos__slide"><article class="plugin-depoimentos__card">'
              . '<div class="plugin-depoimentos__quote">' . nl2br(e(trim($item['text']))) . '</div>';

        if ($nome !== '' || trim($item['role'] ?? '') !== '') {
            $html .= '<div class="plugin-depoimentos__author">';

            if ($nome !== '' && !empty($st['show_avatar'])) {
                $html .= '<span class="plugin-depoimentos__avatar">' . e($this->iniciais($nome)) . '</span>';
            }

            $html .= '<p class="plugin-depoimentos__person">';
            if ($nome !== '') {
                $html .= '<strong>' . e($nome) . '</strong>';
            }
            foreach (['role', 'extra'] as $campo) {
                $valor = trim($item[$campo] ?? '');
                if ($valor !== '') {
                    $html .= '<span>' . e($valor) . '</span>';
                }
            }
            $html .= '</p></div>';
        }

        if (!empty($st['show_more'])) {
            $html .= '<button class="plugin-depoimentos__more" type="button">'
                   . e(trim($st['more_label'] ?? '') ?: 'Ver mais') . '</button>';
        }

        return $html . '</article></div>';
    }

    // Iniciais do avatar: primeira letra do primeiro e do último nome.
    private function iniciais(string $nome): string {
        $partes = preg_split('/\s+/', trim($nome), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (!$partes) {
            return '';
        }

        $primeira = mb_strtoupper(mb_substr($partes[0], 0, 1));
        $ultima   = count($partes) > 1 ? mb_strtoupper(mb_substr(end($partes), 0, 1)) : '';

        return $primeira . $ultima;
    }

    // Cores/tamanhos como CSS vars: hover e estado ativo (setas/bolinhas do Slick)
    // precisam de regra própria, e style inline venceria o :hover.
    private function buildCssVars(): string {
        $st = $this->config['style'] ?? [];

        $vars = [
            '--dep-bg'          => $st['section_bg']   ?: 'transparent',
            '--dep-accent'      => $st['accent']       ?: '#ae272c',
            '--dep-eyebrow'     => $st['eyebrow_color'] ?: '#ae272c',
            '--dep-title'       => $st['title_color']  ?: '#111111',
            '--dep-card-bg'     => $st['card_bg']      ?: '#ffffff',
            '--dep-card-radius' => max(0, (int) ($st['card_radius'] ?? 10)) . 'px',
            '--dep-card-pad'    => max(0, (int) ($st['card_padding'] ?? 28)) . 'px',
            '--dep-quote'       => $st['quote_color']  ?: '#555555',
            '--dep-quote-size'  => max(10, (int) ($st['quote_size'] ?? 15)) . 'px',
            '--dep-name'        => $st['name_color']   ?: '#111111',
            '--dep-avatar-bg'   => $st['avatar_bg']    ?: '#f3d9dc',
            '--dep-avatar-color' => $st['avatar_color'] ?: '#ae272c',
            '--dep-gap'         => max(0, (int) ($st['gap'] ?? 16)) . 'px',
            '--dep-card-border' => ($st['card_border_width'] ?? 0) > 0
                ? (int) $st['card_border_width'] . 'px solid ' . ($st['card_border_color'] ?: '#e0e0e0')
                : 'none',
            '--dep-card-shadow' => !empty($st['card_shadow']) ? '0 6px 24px rgba(0,0,0,0.10)' : 'none',
        ];

        $css = '';
        foreach ($vars as $chave => $valor) {
            $css .= $chave . ':' . $valor . ';';
        }

        return $css;
    }

    // As opções do Slick vão em snake_case no banco e camelCase no data-slick,
    // mesma conversão do plugin Slider.
    private function buildSlickJson(): string {
        $s = $this->config['slider'] ?? [];

        return json_encode([
            'slidesToShow'   => max(1, (int) ($s['slides_desktop'] ?? 3)),
            'slidesToScroll' => 1,
            'infinite'       => ($s['infinite'] ?? true) !== false,
            'arrows'         => ($s['arrows'] ?? true) !== false,
            'dots'           => ($s['dots'] ?? true) !== false,
            'autoplay'       => !empty($s['autoplay']),
            'autoplaySpeed'  => max(1000, (int) ($s['autoplay_speed'] ?? 5000)),
            'responsive'     => [
                ['breakpoint' => 992, 'settings' => ['slidesToShow' => max(1, (int) ($s['slides_tablet'] ?? 2))]],
                ['breakpoint' => 768, 'settings' => ['slidesToShow' => max(1, (int) ($s['slides_mobile'] ?? 1)), 'arrows' => false]],
            ],
        ], JSON_HEX_APOS | JSON_HEX_QUOT);
    }

    public function getDefaultConfig(): array {
        return [
            'header' => ['eyebrow' => 'Depoimentos', 'title' => 'Quem apoia, <strong>recomenda!</strong>', 'align' => 'center'],
            'items'  => [],
            'slider' => [
                'slides_desktop' => 3, 'slides_tablet' => 2, 'slides_mobile' => 1,
                'arrows' => true, 'dots' => true, 'infinite' => true,
                'autoplay' => false, 'autoplay_speed' => 5000,
            ],
            'style' => [
                'section_bg' => '', 'accent' => '#ae272c',
                'eyebrow_color' => '#ae272c', 'title_color' => '#111111',
                'card_bg' => '#ffffff', 'card_radius' => 10, 'card_padding' => 28,
                'card_border_width' => 0, 'card_border_color' => '#e0e0e0', 'card_shadow' => true,
                'quote_color' => '#555555', 'quote_size' => 15,
                'name_color' => '#111111', 'avatar_bg' => '#f3d9dc', 'avatar_color' => '#ae272c',
                'gap' => 16, 'show_avatar' => true, 'show_more' => true, 'more_label' => 'Ver mais',
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Depoimentos';
    }
}
