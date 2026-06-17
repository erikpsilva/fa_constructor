<?php

class Router {
    private array $segments;

    public function __construct() {
        $url   = $_GET['url'] ?? '';
        $clean = preg_replace('/[^a-zA-Z0-9_\-\/]/', '', $url);
        $this->segments = array_values(array_filter(explode('/', $clean)));
    }

    public function dispatch(): void {
        $first = $this->segments[0] ?? null;

        if ($first === 'admin') {
            $this->dispatchAdmin();
            return;
        }

        // URL raiz → carrega homepage definida no banco
        if ($first === null) {
            $this->dispatchHome();
            return;
        }

        $page = Database::fetch(
            "SELECT p.*, t.slug AS template_slug
             FROM pages p
             LEFT JOIN templates t ON p.template_id = t.id
             WHERE p.slug = ? AND p.status = 'published' AND p.type = 'page'",
            [$first]
        );

        if ($page) {
            $this->renderPage($page);
            return;
        }

        $filePath = ROOT . '/pages/' . $first . '/index.php';
        if (file_exists($filePath)) {
            include $filePath;
            return;
        }

        $this->render404();
    }

    private function dispatchHome(): void {
        $page = Database::fetch(
            "SELECT p.*, t.slug AS template_slug
             FROM pages p
             LEFT JOIN templates t ON p.template_id = t.id
             WHERE p.is_home = 1 AND p.status = 'published' AND p.type = 'page'
             LIMIT 1"
        );

        if ($page) {
            $this->renderPage($page);
            return;
        }

        // Fallback para arquivo estático
        $filePath = ROOT . '/pages/inicio/index.php';
        if (file_exists($filePath)) {
            include $filePath;
            return;
        }

        $this->render404();
    }

    private function dispatchAdmin(): void {
        $subRoute   = isset($this->segments[1]) && $this->segments[1] !== ''
            ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $this->segments[1])
            : 'inicio';

        $routeParam = isset($this->segments[2]) && $this->segments[2] !== ''
            ? preg_replace('/[^a-zA-Z0-9_\-]/', '', $this->segments[2])
            : null;

        $path = ROOT . '/admin/pages/' . $subRoute . '/index.php';

        if (file_exists($path)) {
            include $path;
        } else {
            include ROOT . '/admin/pages/login/index.php';
        }
    }

    private function renderPage(array $page): void {
        $sections = loadPageSectionsTree((int) $page['id']);

        $templateSlug = $page['template_slug'] ?? 'default';
        $templatePath = ROOT . '/templates/' . $templateSlug . '/template.php';

        if (!file_exists($templatePath)) {
            $templatePath = ROOT . '/templates/default/template.php';
        }

        include $templatePath;
    }

    private function render404(): void {
        http_response_code(404);
        $custom = ROOT . '/pages/404/index.php';
        if (file_exists($custom)) {
            include $custom;
        } else {
            echo '<h1>404 - Página não encontrada</h1>';
        }
    }
}
