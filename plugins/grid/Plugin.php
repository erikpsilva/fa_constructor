<?php

require_once ROOT . '/plugins/PluginBase.php';

class GridPlugin extends PluginBase {

    public function render(): string {
        $columns = $this->config['columns'] ?? [];
        if (!$columns) {
            return '';
        }

        $responsive = $this->config['responsive'] ?? [];
        $responsiveEnabled = !empty($responsive['enabled']);
        $responsiveClass = 'plugin-grid-responsive-' . substr(md5(json_encode($this->config)), 0, 12);
        $responsiveRules = '';

        $colsHtml = '';
        foreach ($columns as $index => $column) {
            $colSize      = (int) ($column['col_size'] ?? 12);
            $colStyle     = buildInlineStyles($column['styles'] ?? []);
            $elementsHtml = '';
            foreach (($column['elements'] ?? []) as $element) {
                $elementsHtml .= renderPluginElement($element);
            }
            $colsHtml .= '<div class="col-12 col-md-' . $colSize . ' plugin-grid__column"' . ($colStyle ? ' style="' . $colStyle . '"' : '') . '>' . $elementsHtml . '</div>';

            if ($responsiveEnabled) {
                $selector = '.' . $responsiveClass . '>.plugin-grid__column:nth-child(' . ($index + 1) . ')';
                if (!empty($column['hide_responsive'])) {
                    $responsiveRules .= $selector . '{display:none!important;}';
                } else {
                    $responsiveSize = max(1, min(12, (int) ($column['responsive_size'] ?? 12)));
                    $percentage = number_format(($responsiveSize / 12) * 100, 6, '.', '');
                    $responsiveRules .= $selector
                        . '{flex:0 0 ' . $percentage . '%;max-width:' . $percentage . '%;}';
                }
            }
        }

        $responsiveCss = '';
        if ($responsiveEnabled) {
            $breakpoint = max(320, min(2000, (int) ($responsive['breakpoint'] ?? 991)));
            $responsiveCss = '<style>@media(max-width:' . $breakpoint . 'px){' . $responsiveRules . '}</style>';
        }

        return $responsiveCss . '<div class="row plugin-grid__row ' . $responsiveClass . '">' . $colsHtml . '</div>';
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
