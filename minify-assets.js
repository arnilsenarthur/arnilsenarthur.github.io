const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

async function minifyAssets() {
    const distDir = 'dist';

    // Minify JavaScript files
    const jsFiles = [
        'js/animations.js',
        'js/background.js',
        'js/landing.js',
        'js/pagesystem.js',
        'js/game.js',
        'js/timeline-3d.js'
    ];

    for (const jsFile of jsFiles) {
        const filePath = path.join(distDir, jsFile);
        if (fs.existsSync(filePath)) {
            try {
                const code = fs.readFileSync(filePath, 'utf8');
                const result = await minify(code);
                fs.writeFileSync(filePath, result.code);
                console.log(`Minified JS: ${jsFile}`);
            } catch (error) {
                console.error(`Error minifying ${jsFile}:`, error.message);
            }
        }
    }

    // Minify CSS files
    const cssFiles = [
        'css/style.css',
        'css/window.css',
        'css/game.css'
    ];

    const cleanCSS = new CleanCSS({
        level: {
            1: { all: true },
            2: { all: true }
        }
    });

    for (const cssFile of cssFiles) {
        const filePath = path.join(distDir, cssFile);
        if (fs.existsSync(filePath)) {
            try {
                const css = fs.readFileSync(filePath, 'utf8');
                const result = cleanCSS.minify(css);
                fs.writeFileSync(filePath, result.styles);
                console.log(`Minified CSS: ${cssFile}`);
            } catch (error) {
                console.error(`Error minifying ${cssFile}:`, error.message);
            }
        }
    }

    console.log('Asset minification complete!');
}

minifyAssets().catch(console.error);