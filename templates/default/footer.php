<?php $siteName = getSetting('site_name', ''); ?>
<?php if ($siteName): ?>
<footer class="siteFooter">
    <p>&copy; <?= date('Y') ?> <?= e($siteName) ?>. Todos os direitos reservados.</p>
</footer>
<?php endif; ?>
