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
        return '<div class="plugin-slider" data-slick="' . $settingsJson . '">' . $slidesHtml . '</div>';
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
