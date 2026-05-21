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
