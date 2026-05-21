<?php

require_once ROOT . '/plugins/PluginBase.php';

class TextPlugin extends PluginBase {

    public function render(): string {
        // New format: {html} from Quill
        if (isset($this->config['html'])) {
            $html = $this->config['html'];
            return '<div class="plugin-text">' . $html . '</div>';
        }

        // Legacy format: {text, bold}
        $text   = htmlspecialchars($this->config['text'] ?? '', ENT_QUOTES, 'UTF-8');
        $weight = !empty($this->config['bold']) ? '600' : '400';
        return '<p style="font-weight:' . $weight . '">' . nl2br($text) . '</p>';
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
