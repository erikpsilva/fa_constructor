<?php
$siteName = getSetting('site_name', '');
$logoUrl  = getSetting('site_logo', '');

$menuItems = Database::fetchAll(
    "SELECT mi.* FROM menu_items mi
     JOIN menus m ON mi.menu_id = m.id
     WHERE m.location = 'primary' AND mi.parent_id IS NULL
     ORDER BY mi.sort_order ASC"
);

$hasHeader = $siteName || $logoUrl || $menuItems;
?>
<?php if ($hasHeader): ?>
<header class="siteHeader">
    <?php if ($logoUrl || $siteName): ?>
    <div class="siteHeader__brand">
        <?php if ($logoUrl): ?>
            <a href="<?= BASE_URL ?>">
                <img src="<?= e($logoUrl) ?>" alt="<?= e($siteName) ?>" class="siteHeader__logo" />
            </a>
        <?php else: ?>
            <a href="<?= BASE_URL ?>" class="siteHeader__name"><?= e($siteName) ?></a>
        <?php endif; ?>
    </div>
    <?php endif; ?>

    <?php if ($menuItems): ?>
    <nav class="siteHeader__nav">
        <ul>
            <?php foreach ($menuItems as $item): ?>
                <li><a href="<?= e($item['url']) ?>"><?= e($item['label']) ?></a></li>
            <?php endforeach; ?>
        </ul>
    </nav>
    <?php endif; ?>
</header>
<?php endif; ?>
