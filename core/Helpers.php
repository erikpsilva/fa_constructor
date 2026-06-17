<?php

function redirect(string $url): void {
    header('Location: ' . $url);
    exit;
}

function e(string $str): string {
    return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
}

function asset(string $path): string {
    return BASE_URL . '/' . ltrim($path, '/');
}

function adminAsset(string $path): string {
    return ADMIN_BASE_URL . '/' . ltrim($path, '/');
}

function isLoggedIn(): bool {
    return !empty($_SESSION['usuario']);
}

function currentUser(): ?array {
    return $_SESSION['usuario'] ?? null;
}

function getSetting(string $key, string $default = ''): string {
    static $cache = [];
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }
    $row = Database::fetch("SELECT `value` FROM settings WHERE `key` = ?", [$key]);
    $cache[$key] = $row ? $row['value'] : $default;
    return $cache[$key];
}

function setSetting(string $key, string $value): void {
    Database::execute(
        "INSERT INTO settings (`key`, `value`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [$key, $value]
    );
}

function jsonResponse(bool $success, string $message, array $data = []): void {
    header('Content-Type: application/json');
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
    exit;
}

function buildInlineStyles(array $st): string {
    $css = '';
    if (!empty($st['bg_color']))     $css .= 'background-color:' . $st['bg_color'] . ';';
    if (!empty($st['bg_image'])) {
        $css .= "background-image:url('" . $st['bg_image'] . "');";
        $css .= 'background-repeat:' . ($st['bg_repeat'] ?? 'no-repeat') . ';';
        $css .= 'background-position:' . ($st['bg_position_x'] ?? 'center') . ' ' . ($st['bg_position_y'] ?? 'center') . ';';
    }
    if (!empty($st['width_value']))  $css .= 'width:'  . $st['width_value']  . ($st['width_unit']  ?? 'px') . ';';
    if (!empty($st['height_value'])) $css .= 'height:' . $st['height_value'] . ($st['height_unit'] ?? 'px') . ';';

    $p = $st['padding'] ?? [];
    if (!empty($p['top']) || !empty($p['right']) || !empty($p['bottom']) || !empty($p['left']))
        $css .= 'padding:' . ($p['top']??0) . 'px ' . ($p['right']??0) . 'px ' . ($p['bottom']??0) . 'px ' . ($p['left']??0) . 'px;';

    $m = $st['margin'] ?? [];
    if (!empty($m['top']))    $css .= 'margin-top:'    . $m['top']    . 'px;';
    if (!empty($m['right']))  $css .= 'margin-right:'  . $m['right']  . 'px;';
    if (!empty($m['bottom'])) $css .= 'margin-bottom:' . $m['bottom'] . 'px;';
    if (!empty($m['left']))   $css .= 'margin-left:'   . $m['left']   . 'px;';

    if (!empty($st['floating'])) $css .= 'position:absolute;z-index:' . ($st['z_index'] ?? 0) . ';';

    if (!empty($st['border_width']))
        $css .= 'border:' . $st['border_width'] . 'px solid ' . ($st['border_color'] ?? '#000000') . ';';

    $br = $st['border_radius'] ?? [];
    if (!empty($br['tl']) || !empty($br['tr']) || !empty($br['br']) || !empty($br['bl']))
        $css .= 'border-radius:' . ($br['tl']??0) . 'px ' . ($br['tr']??0) . 'px ' . ($br['br']??0) . 'px ' . ($br['bl']??0) . 'px;';

    $sh = $st['shadow'] ?? [];
    if (!empty($sh['enabled'])) {
        $rad   = deg2rad($sh['angle'] ?? 0);
        $ox    = (int) round(sin($rad) * ($sh['distance'] ?? 0));
        $oy    = (int) round(cos($rad) * ($sh['distance'] ?? 0));
        $alpha = number_format(($sh['opacity'] ?? 0) / 100, 2);
        $hex   = ltrim($sh['color'] ?? '000000', '#');
        $r     = hexdec(substr($hex, 0, 2));
        $g     = hexdec(substr($hex, 2, 2));
        $b     = hexdec(substr($hex, 4, 2));
        $css .= "box-shadow:{$ox}px {$oy}px " . ($sh['size'] ?? 0) . "px rgba({$r},{$g},{$b},{$alpha});";
    }

    return $css;
}

// Instancia o plugin do elemento e devolve o HTML renderizado. Usado pelo render
// público (renderSections) e por elementos que aninham outros, como o Grid.
function renderPluginElement(array $element): string {
    $pluginType = $element['plugin_type'] ?? '';
    if ($pluginType === '') {
        return '';
    }

    $pluginPath = ROOT . '/plugins/' . $pluginType . '/Plugin.php';
    if (!file_exists($pluginPath)) {
        return '';
    }

    require_once ROOT . '/plugins/PluginBase.php';
    require_once $pluginPath;
    $className = ucfirst($pluginType) . 'Plugin';
    if (!class_exists($className)) {
        return '';
    }

    return (new $className($element['content'] ?? []))->render();
}

// Busca a árvore completa (seções → colunas → elementos) de uma página, já com
// styles/content decodificados. Usado pelo Router (conteúdo da página) e por
// renderTemplateSection() (header/footer dinâmicos).
function loadPageSectionsTree(int $pageId): array {
    $sections = Database::fetchAll(
        "SELECT * FROM page_sections WHERE page_id = ? ORDER BY sort_order ASC",
        [$pageId]
    );

    foreach ($sections as &$section) {
        $section['id']      = (int) $section['id'];
        $section['styles']  = json_decode($section['styles'] ?? '{}', true) ?: [];
        $section['columns'] = Database::fetchAll(
            "SELECT * FROM section_columns WHERE section_id = ? ORDER BY sort_order ASC",
            [$section['id']]
        );
        foreach ($section['columns'] as &$column) {
            $column['id']       = (int) $column['id'];
            $column['col_size'] = (int) $column['col_size'];
            $column['styles']   = json_decode($column['styles'] ?? '{}', true) ?: [];
            $column['elements'] = Database::fetchAll(
                "SELECT * FROM column_elements WHERE column_id = ? ORDER BY sort_order ASC",
                [$column['id']]
            );
            foreach ($column['elements'] as &$element) {
                $element['content'] = json_decode($element['content'] ?? '{}', true) ?? [];
            }
            unset($element);
        }
        unset($column);
    }
    unset($section);

    return $sections;
}

// Renderiza a lista de seções (vindas de loadPageSectionsTree) em HTML.
// Usado tanto pelo conteúdo principal da página quanto pelo header/footer dinâmicos.
function renderSections(array $sections): string {
    $html = '';

    foreach ($sections as $section) {
        $type     = $section['container_type'] ?? 'container';
        $secStyle = buildInlineStyles($section['styles'] ?? []);

        $colsHtml = '';
        foreach ($section['columns'] as $column) {
            $colStyle  = buildInlineStyles($column['styles'] ?? []);
            $colsHtml .= '<div class="col-' . $column['col_size'] . '"'
                       . ($colStyle ? ' style="' . e($colStyle) . '"' : '') . '>';
            foreach ($column['elements'] as $element) {
                $colsHtml .= renderPluginElement($element);
            }
            $colsHtml .= '</div>';
        }

        $cols5 = count($section['columns']) === 5
              && count(array_filter($section['columns'], fn($c) => (int) $c['col_size'] === 2)) === 5;
        $rowHtml = '<div class="row' . ($cols5 ? ' justify-content-center' : '') . '">' . $colsHtml . '</div>';

        $inner = ($type === 'container' || $type === 'full-inner')
            ? '<div class="container">' . $rowHtml . '</div>'
            : $rowHtml;

        $html .= '<section class="pageSection pageSection--' . e($type) . '"'
               . ($secStyle ? ' style="' . e($secStyle) . '"' : '') . '>'
               . $inner . '</section>';
    }

    return $html;
}

// Renderiza o conteúdo dinâmico do Header ou Footer (pages.type = 'header'|'footer').
// Devolve string vazia se não houver uma página publicada desse tipo ainda
// (ex: antes do primeiro acesso à tela admin/header-footer, que cria os registros).
function renderTemplateSection(string $type): string {
    $page = Database::fetch(
        "SELECT * FROM pages WHERE type = ? AND status = 'published' LIMIT 1",
        [$type]
    );
    if (!$page) {
        return '';
    }

    return renderSections(loadPageSectionsTree((int) $page['id']));
}
