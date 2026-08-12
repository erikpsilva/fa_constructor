<?php
$headerHtml     = renderTemplateSection('header');
$stickyEnabled = getSetting('header_sticky_enabled', '0') === '1';
$stickyOffset  = max(0, min(5000, (int) getSetting('header_sticky_offset', '180')));
$stickyScale   = max(50, min(100, (int) getSetting('header_sticky_scale', '75')));
$stickyBg      = getSetting('header_sticky_bg', '#111111');
$stickyColor   = getSetting('header_sticky_color', '#ffffff');
$stickyShadow  = getSetting('header_sticky_shadow', '1') === '1';
$scaleDecimal  = $stickyScale / 100;
$inverseWidth  = 100 / $scaleDecimal;
?>
<?php if ($headerHtml !== ''): ?>
    <div class="dynamicHeader<?= $stickyEnabled ? ' dynamicHeader--enabled' : '' ?>"
         data-sticky-offset="<?= $stickyOffset ?>"
         style="--header-compact-scale:<?= $scaleDecimal ?>;--header-compact-width:<?= round($inverseWidth, 4) ?>%;--header-compact-bg:<?= e($stickyBg) ?>;--header-compact-color:<?= e($stickyColor) ?>;--header-compact-shadow:<?= $stickyShadow ? '0 6px 18px rgba(0,0,0,.18)' : 'none' ?>;">
        <div class="dynamicHeader__content"><?= $headerHtml ?></div>
    </div>
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
