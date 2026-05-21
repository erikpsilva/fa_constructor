import gulp from 'gulp';
import less from 'gulp-less';
import cleanCSS from 'gulp-clean-css';
import rename from 'gulp-rename';
import browserSync from 'browser-sync';

const bs = browserSync.create();

// Compila o LESS da raiz
const compileLessRoot = () =>
    gulp.src('styles/style.min.less')
        .pipe(less())
        .pipe(cleanCSS())
        .pipe(rename('style.min.css'))
        .pipe(gulp.dest('styles'))
        .pipe(bs.stream());

// Compila o LESS do admin
const compileLessAdmin = () =>
    gulp.src('admin/styles/style.min.less')
        .pipe(less())
        .pipe(cleanCSS())
        .pipe(rename('style.min.css'))
        .pipe(gulp.dest('admin/styles'))
        .pipe(bs.stream());

// Inicia o BrowserSync como proxy do XAMPP
const serve = (done) => {
    bs.init({
        proxy: 'localhost/project_php_start',
        open: true,
        notify: false,
    });
    done();
};

// Reload ao mudar PHP ou JS
const reload = (done) => {
    bs.reload();
    done();
};

const watchOpts = { usePolling: true, interval: 300 };

// Watch
const watch = () => {
    // Qualquer .less fora de node_modules recompila o entry point correspondente
    gulp.watch(
        ['styles/**/*.less', 'pages/**/*.less', 'includes/**/*.less'],
        watchOpts,
        compileLessRoot
    );
    gulp.watch(
        ['admin/**/*.less', '!admin/node_modules/**'],
        watchOpts,
        compileLessAdmin
    );
    gulp.watch(
        ['**/*.php', 'pages/**/*.js', 'admin/**/*.js', 'scripts/**/*.js'],
        watchOpts,
        reload
    );
};

export default gulp.series(
    gulp.parallel(compileLessRoot, compileLessAdmin),
    serve,
    watch
);
