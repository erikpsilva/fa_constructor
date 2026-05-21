<?php

define('ROOT', dirname(__DIR__));

require_once ROOT . '/config/database.php';

$_host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
$_scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';

if (strpos($_host, 'localhost') !== false || strpos($_host, '127.0.0.1') !== false) {
    define('BASE_URL', $_scheme . '://' . $_host . '/fa_constructor');
} else {
    define('BASE_URL', 'https://www.meusite.com.br');
}
unset($_host, $_scheme);

define('ADMIN_BASE_URL', BASE_URL . '/admin');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

spl_autoload_register(function (string $class): void {
    $path = ROOT . '/core/' . $class . '.php';
    if (file_exists($path)) {
        require_once $path;
    }
});

require_once ROOT . '/core/Helpers.php';
