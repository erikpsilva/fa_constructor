<?php $headerHtml = renderTemplateSection('header'); ?>
<?php if ($headerHtml !== ''): ?>
    <?= $headerHtml ?>
<?php else: ?>
    <?php
    $siteName = getSetting('site_name', '');
    $logoUrl  = getSetting('site_logo', '');
    ?>
    <?php if ($siteName || $logoUrl): ?>
    <header class="siteHeader">
        <div class="siteHeader__brand">
            <?php if ($logoUrl): ?>
                <a href="<?= BASE_URL ?>">
                    <img src="<?= e($logoUrl) ?>" alt="<?= e($siteName) ?>" class="siteHeader__logo" />
                </a>
            <?php else: ?>
                <a href="<?= BASE_URL ?>" class="siteHeader__name"><?= e($siteName) ?></a>
            <?php endif; ?>
        </div>
    </header>
    <?php endif; ?>
<?php endif; ?>
