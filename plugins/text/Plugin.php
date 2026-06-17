<?php

require_once ROOT . '/plugins/PluginBase.php';

class TextPlugin extends PluginBase {

    public function render(): string {
        $style = $this->buildWrapperStyle();

        // New format: {html} from Quill
        if (isset($this->config['html'])) {
            $html = $this->config['html'];
            return '<div class="plugin-text"' . $style . '>' . $html . '</div>';
        }

        // Legacy format: {text, bold}
        $text   = htmlspecialchars($this->config['text'] ?? '', ENT_QUOTES, 'UTF-8');
        $weight = !empty($this->config['bold']) ? '600' : '400';
        return '<p style="font-weight:' . $weight . '">' . nl2br($text) . '</p>';
    }

    private function buildWrapperStyle(): string {
        $css = '';
        if (!empty($this->config['font_size'])) {
            $css .= 'font-size:' . (int) $this->config['font_size'] . 'px;';
        }
        $color = $this->config['text_color'] ?? '';
        if ($color && preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $color)) {
            $css .= 'color:' . $color . ';';
        }
        $m = $this->config['margin'] ?? [];
        if (!empty($m['top']) || !empty($m['right']) || !empty($m['bottom']) || !empty($m['left'])) {
            $css .= sprintf(
                'margin:%dpx %dpx %dpx %dpx;',
                $m['top'] ?? 0, $m['right'] ?? 0, $m['bottom'] ?? 0, $m['left'] ?? 0
            );
        }
        return $css ? ' style="' . $css . '"' : '';
    }

    public function getDefaultConfig(): array {
        return ['html' => ''];
    }

    public function getEditorFields(): array {
        return [
            ['key' => 'html', 'label' => 'Conteúdo', 'type' => 'quill'],
        ];
    }

    public function getName(): string {
        return 'Texto';
    }
}
