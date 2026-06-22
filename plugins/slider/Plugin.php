<?php

require_once ROOT . '/plugins/PluginBase.php';

class SliderPlugin extends PluginBase {

    public function render(): string {
        $images = $this->config['images'] ?? [];
        if (!$images) {
            return '';
        }

        $slidesHtml = '';
        foreach ($images as $image) {
            $url = $image['url'] ?? '';
            if (!$url) {
                continue;
            }

            $alt = htmlspecialchars($image['alt'] ?? '', ENT_QUOTES, 'UTF-8');
            $img = '<img src="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '" alt="' . $alt . '">';

            $link = trim($image['link_url'] ?? '');
            if ($link) {
                $img = '<a href="' . htmlspecialchars($link, ENT_QUOTES, 'UTF-8') . '">' . $img . '</a>';
            }

            $slidesHtml .= '<div class="plugin-slider__slide">' . $img . '</div>';
        }

        if ($slidesHtml === '') {
            return '';
        }

        $settingsJson = htmlspecialchars(json_encode($this->buildSlickSettings()), ENT_QUOTES, 'UTF-8');
        $styleAttr    = $this->buildStyleAttr();
        return '<div class="plugin-slider"' . $styleAttr . ' data-slick="' . $settingsJson . '">' . $slidesHtml . '</div>';
    }

    // Cor das setas/bolinhas é configurável (não usa @primary do LESS) — assim o
    // editor e a página publicada sempre mostram exatamente a mesma cor, já que
    // os dois bundles (admin e público) têm um @primary diferente entre si.
    private function buildStyleAttr(): string {
        $s     = $this->config['settings'] ?? [];
        $color = $s['accent_color'] ?? '#222222';
        if (!preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $color)) {
            $color = '#222222';
        }
        [$r, $g, $b] = self::hexToRgb($color);

        $css = '--slider-accent:' . $color . ';'
             . '--slider-arrow-bg:rgba(' . $r . ',' . $g . ',' . $b . ',0.35);';

        if (!empty($s['bg_color'])) {
            $css .= 'background-color:' . $s['bg_color'] . ';';
        }
        if (!empty($s['border_radius'])) {
            $css .= 'border-radius:' . (int) $s['border_radius'] . 'px;overflow:hidden;';
        }

        return ' style="' . htmlspecialchars($css, ENT_QUOTES, 'UTF-8') . '"';
    }

    private static function hexToRgb(string $hex): array {
        $hex = ltrim($hex, '#');
        if (strlen($hex) === 3) {
            $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
        }
        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }

    private function buildSlickSettings(): array {
        $s    = $this->config['settings'] ?? [];
        $fade = !empty($s['fade']);

        return [
            'slidesToShow'   => $fade ? 1 : max(1, (int) ($s['slides_to_show']   ?? 1)),
            'slidesToScroll' => $fade ? 1 : max(1, (int) ($s['slides_to_scroll'] ?? 1)),
            'autoplay'       => !empty($s['autoplay']),
            'autoplaySpeed'  => max(500, (int) ($s['autoplay_speed'] ?? 3000)),
            'speed'          => max(100, (int) ($s['speed'] ?? 500)),
            'infinite'       => $s['infinite'] ?? true,
            'arrows'         => $s['arrows_desktop'] ?? true,
            'dots'           => $s['dots_desktop']   ?? true,
            'fade'           => $fade,
            // Breakpoint igual ao @tablet-small (styles/modules/variables.less) — abaixo
            // de 767px o Slick troca pra essas configurações de setas/bolinhas no mobile.
            'responsive'     => [
                [
                    'breakpoint' => 767,
                    'settings'   => [
                        'arrows' => $s['arrows_mobile'] ?? true,
                        'dots'   => $s['dots_mobile']   ?? true,
                    ],
                ],
            ],
        ];
    }

    public function getDefaultConfig(): array {
        return [
            'images'   => [],
            'settings' => [
                'slides_to_show'   => 1,
                'slides_to_scroll' => 1,
                'autoplay'         => false,
                'autoplay_speed'   => 3000,
                'speed'            => 500,
                'infinite'         => true,
                'arrows_desktop'   => true,
                'arrows_mobile'    => true,
                'dots_desktop'     => true,
                'dots_mobile'      => true,
                'fade'             => false,
                'accent_color'     => '#222222',
                'bg_color'         => '',
                'border_radius'    => 0,
            ],
        ];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Slider';
    }
}
