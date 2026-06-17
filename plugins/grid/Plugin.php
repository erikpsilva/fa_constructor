<?php

require_once ROOT . '/plugins/PluginBase.php';

class GridPlugin extends PluginBase {

    public function render(): string {
        $columns = $this->config['columns'] ?? [];
        if (!$columns) {
            return '';
        }

        $colsHtml = '';
        foreach ($columns as $column) {
            $colSize      = (int) ($column['col_size'] ?? 12);
            $colStyle     = buildInlineStyles($column['styles'] ?? []);
            $elementsHtml = '';
            foreach (($column['elements'] ?? []) as $element) {
                $elementsHtml .= renderPluginElement($element);
            }
            $colsHtml .= '<div class="col-' . $colSize . '"' . ($colStyle ? ' style="' . $colStyle . '"' : '') . '>' . $elementsHtml . '</div>';
        }

        return '<div class="row plugin-grid__row">' . $colsHtml . '</div>';
    }

    public function getDefaultConfig(): array {
        return ['columns' => []];
    }

    public function getEditorFields(): array {
        return [];
    }

    public function getName(): string {
        return 'Grid';
    }
}
