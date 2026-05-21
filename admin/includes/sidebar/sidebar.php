<aside class="sidebar">
    <nav class="sidebar__nav">
        <ul class="sidebar__menu">

            <li class="sidebar__item">
                <a href="<?= BASE_URL ?>/admin/inicio"
                   class="sidebar__link <?= ($subRoute === 'inicio') ? 'sidebar__link--active' : '' ?>">
                    In&iacute;cio
                </a>
            </li>

            <li class="sidebar__section">
                Dados e usu&aacute;rios
            </li>

            <li class="sidebar__item">
                <a href="<?= BASE_URL ?>/admin/meusdados"
                   class="sidebar__link <?= ($subRoute === 'meusdados') ? 'sidebar__link--active' : '' ?>">
                    Meus Dados
                </a>
            </li>

            <?php if ($_SESSION['usuario']['nivel_acesso'] === 'admin'): ?>
            <li class="sidebar__item">
                <a href="<?= BASE_URL ?>/admin/cadastrarusuario"
                   class="sidebar__link <?= ($subRoute === 'cadastrarusuario') ? 'sidebar__link--active' : '' ?>">
                    Cadastrar Usu&aacute;rio
                </a>
            </li>
            <li class="sidebar__item">
                <a href="<?= BASE_URL ?>/admin/gerenciarusuarios"
                   class="sidebar__link <?= ($subRoute === 'gerenciarusuarios') ? 'sidebar__link--active' : '' ?>">
                    Gerenciar Usu&aacute;rios
                </a>
            </li>

            <li class="sidebar__section">
                Criador de site
            </li>

            <li class="sidebar__item">
                <a href="<?= BASE_URL ?>/admin/paginas"
                   class="sidebar__link <?= ($subRoute === 'paginas') ? 'sidebar__link--active' : '' ?>">
                    P&aacute;ginas
                </a>
            </li>
            <?php endif; ?>

        </ul>
    </nav>
</aside>

<div class="sidebar__overlay" id="sidebarOverlay"></div>
