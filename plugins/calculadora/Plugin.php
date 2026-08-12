<?php

require_once ROOT . '/plugins/PluginBase.php';

// Calculadora de impacto: ocupa a seção inteira (texto de um lado, painel de
// cálculo do outro). O usuário escolhe um valor e uma frequência, e o resultado
// mostra quantos animais aquele valor ajuda, por espécie.
//
// A conta (feita em scripts/common.js): valor × 12 se for mensal, dividido pelo
// custo por animal, distribuído pelos percentuais de cada espécie.
class CalculadoraPlugin extends PluginBase {

    public function render(): string {
        $animais = $this->animaisValidos();
        $valores = $this->valoresValidos();

        if (!$animais) {
            return '';
        }

        $h = $this->config['header'] ?? [];
        $f = $this->config['form']   ?? [];

        return '<div class="plugin-calculadora" style="' . e($this->buildCssVars()) . '"'
             . ' data-calc=\'' . $this->buildCalcJson($animais) . '\'>'
             . '<div class="plugin-calculadora__inner">'
             . $this->renderTexto($h)
             . '<div class="plugin-calculadora__panel">'
             . $this->renderForm($f, $valores)
             . $this->renderResultado($animais)
             . '</div></div></div>';
    }

    private function animaisValidos(): array {
        return array_values(array_filter(
            $this->config['animals'] ?? [],
            fn($a) => trim($a['name'] ?? '') !== ''
        ));
    }

    private function valoresValidos(): array {
        $valores = array_map('intval', $this->config['values'] ?? []);
        return array_values(array_filter($valores, fn($v) => $v > 0));
    }

    private function renderTexto(array $h): string {
        $tarja  = trim($h['eyebrow'] ?? '');
        $titulo = trim($h['title'] ?? '');
        $texto  = trim($h['text'] ?? '');

        if ($tarja === '' && $titulo === '' && $texto === '') {
            return '';
        }

        $html = '<div class="plugin-calculadora__texto">';
        if ($tarja !== '') {
            $html .= '<p class="plugin-calculadora__eyebrow">' . e($tarja) . '</p>';
        }
        if ($titulo !== '') {
            // Permite destacar parte do título, como no site original.
            $html .= '<h2 class="plugin-calculadora__title">' . strip_tags($titulo, '<br><strong><b><em><i><u>') . '</h2>';
        }
        if ($texto !== '') {
            $html .= '<div class="plugin-calculadora__text">' . $this->richText($texto) . '</div>';
        }

        return $html . '</div>';
    }

    private function renderForm(array $f, array $valores): string {
        $ativo = max(0, min(count($valores) - 1, (int) ($f['default_index'] ?? 1)));

        $html = '<div class="plugin-calculadora__form">'
              . '<h3 class="plugin-calculadora__label">' . e($f['label_valor'] ?? 'Escolha um valor') . '</h3>'
              . '<div class="plugin-calculadora__values">';

        foreach ($valores as $i => $valor) {
            $html .= '<button type="button" class="plugin-calculadora__value' . ($i === $ativo ? ' is-active' : '') . '"'
                   . ' data-value="' . $valor . '">R$' . $valor . '</button>';
        }

        $html .= '</div>'
               . '<input type="text" class="plugin-calculadora__input" placeholder="' . e($f['placeholder'] ?? 'Outro valor (R$)') . '" aria-label="Outro valor">';

        if (!empty($f['show_frequency'])) {
            $html .= '<h3 class="plugin-calculadora__label plugin-calculadora__label--spaced">' . e($f['label_frequencia'] ?? 'Frequência') . '</h3>'
                   . '<div class="plugin-calculadora__frequency">'
                   . '<button type="button" class="plugin-calculadora__freq is-active" data-freq="mensal">' . e($f['label_mensal'] ?? 'Mensal') . '</button>'
                   . '<button type="button" class="plugin-calculadora__freq" data-freq="unica">' . e($f['label_unica'] ?? 'Única') . '</button>'
                   . '</div>';
        }

        if (trim($f['button_text'] ?? '') !== '') {
            $html .= '<a class="plugin-calculadora__donate" href="' . e($this->resolveUrl($f)) . '"'
                   . (!empty($f['target_blank']) ? ' target="_blank" rel="noopener"' : '')
                   . ' data-label-mensal="' . e($f['button_text']) . '"'
                   . ' data-label-unica="' . e(trim($f['button_text_unica'] ?? '') ?: $f['button_text']) . '">'
                   . e($f['button_text']) . '</a>';
        }

        return $html . '</div>';
    }

    private function renderResultado(array $animais): string {
        $valores = $this->valoresValidos();
        $ativo = max(0, min(count($valores) - 1, (int) ($this->config['form']['default_index'] ?? 1)));
        $valorAtivo = $valores[$ativo] ?? 0;
        $html = '<div class="plugin-calculadora__result">'
              . '<p class="plugin-calculadora__resultTitle">Com <strong>R$<span class="plugin-calculadora__resultAmount">' . $valorAtivo . '</span> por mês</strong>, você ajuda a:</p>';

        $ajuda = trim($this->config['form']['tooltip'] ?? '');
        if ($ajuda !== '') {
            $html .= '<div class="plugin-calculadora__tooltip">'
                   . '<button type="button" class="plugin-calculadora__help" aria-label="Como calculamos">?</button>'
                   . '<div class="plugin-calculadora__tooltipBox" role="tooltip">' . $this->richText($ajuda) . '</div>'
                   . '</div>';
        }

        foreach ($animais as $i => $animal) {
            $html .= '<div class="plugin-calculadora__animal" data-index="' . $i . '">';

            $icon = trim($animal['icon'] ?? '') ?: 'fa-solid fa-paw';
            if (!preg_match('/^fa-(?:solid|regular|brands) fa-[a-z0-9-]+$/', $icon)) $icon = 'fa-solid fa-paw';
            $html .= '<i class="plugin-calculadora__animalIcon ' . e($icon) . '" aria-hidden="true"></i>';

            $html .= '<strong class="plugin-calculadora__number">0</strong>'
                   . '<span class="plugin-calculadora__animalName">' . e($animal['name']) . '</span>'
                   . '</div>';
        }

        return $html . '</div>';
    }

    private function richText(string $html): string {
        $html = strip_tags($html, '<p><br><strong><b><em><i><u><ul><ol><li>');
        return preg_replace('/\s+(?:style|class|id|on\w+)=(?:"[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $html) ?? '';
    }

    private function resolveUrl(array $f): string {
        if (($f['link_type'] ?? 'url') === 'page') {
            $pageId = (int) ($f['page_id'] ?? 0);
            if ($pageId > 0) {
                $page = Database::fetch("SELECT slug FROM pages WHERE id = ? AND type = 'page'", [$pageId]);
                if ($page) {
                    return BASE_URL . '/' . $page['slug'];
                }
            }
            return '#';
        }

        $url = trim($f['url'] ?? '');
        return $url !== '' ? $url : '#';
    }

    // Config que o JS precisa para calcular. Vai num data-attribute do próprio
    // elemento (e não numa variável global como no site original), para poder
    // existir mais de uma calculadora na mesma página.
    private function buildCalcJson(array $animais): string {
        return json_encode([
            'cost'       => max(0.01, (float) ($this->config['form']['cost_per_animal'] ?? 15)),
            'multiplier' => max(1, (int) ($this->config['form']['monthly_multiplier'] ?? 12)),
            'pcts'       => array_map(fn($a) => (float) ($a['pct'] ?? 0) / 100, $animais),
        ], JSON_HEX_APOS | JSON_HEX_QUOT);
    }

    private function buildCssVars(): string {
        $s = $this->config['style'] ?? [];

        $vars = [
            '--calc-accent'      => $s['accent']        ?: '#ae272c',
            '--calc-eyebrow'     => $s['eyebrow_color'] ?: '#ae272c',
            '--calc-title'       => $s['title_color']   ?: '#111111',
            '--calc-text'        => $s['text_color']    ?: '#555555',
            '--calc-panel-bg'    => $s['panel_bg']      ?: '#ffffff',
            '--calc-panel-radius' => max(0, (int) ($s['panel_radius'] ?? 14)) . 'px',
            '--calc-panel-pad'   => max(0, (int) ($s['panel_padding'] ?? 28)) . 'px',
            '--calc-number'      => $s['number_color']  ?: '#111111',
            '--calc-gap'         => max(0, (int) ($s['gap'] ?? 32)) . 'px',
            '--calc-panel-shadow' => !empty($s['panel_shadow']) ? '0 8px 30px rgba(0,0,0,0.10)' : 'none',
        ];

        $css = '';
        foreach ($vars as $chave => $valor) {
            $css .= $chave . ':' . $valor . ';';
        }

        return $css;
    }

    public function getDefaultConfig(): array {
        return [
            'header' => [
                'eyebrow' => 'Calculadora de impacto',
                'title'   => '<p>Veja quantos animais <strong>você pode ajudar.</strong></p>',
                'text'    => '<p>Seu apoio forma pessoas e impulsiona mudanças reais.<br>Use a calculadora e veja o impacto da sua doação.</p>',
            ],
            'animals' => [],
            'values'  => [30, 60, 120],
            'form' => [
                'label_valor'        => 'Escolha um valor',
                'placeholder'        => 'Outro valor (R$)',
                'default_index'      => 1,
                'show_frequency'     => true,
                'label_frequencia'   => 'Frequência',
                'label_mensal'       => 'Mensal',
                'label_unica'        => 'Única',
                'monthly_multiplier' => 12,
                'cost_per_animal'    => 15,
                'button_text'        => 'FAZER DOAÇÃO MENSAL',
                'button_text_unica'  => 'FAZER DOAÇÃO',
                'link_type'          => 'url',
                'page_id'            => '',
                'url'                => '',
                'target_blank'       => false,
                'tooltip'            => '<p>Trata-se de uma simplificação baseada em estimativas, que deve ser interpretada com cautela.</p>',
            ],
            'style' => [
                'accent' => '#ae272c', 'eyebrow_color' => '#ae272c', 'title_color' => '#111111',
                'text_color' => '#555555', 'panel_bg' => '#ffffff', 'panel_radius' => 14,
                'panel_padding' => 28, 'panel_shadow' => true, 'number_color' => '#111111', 'gap' => 32,
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Calculadora de impacto';
    }
}
