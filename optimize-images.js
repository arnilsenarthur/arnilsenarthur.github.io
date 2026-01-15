const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeImages() {
    const srcDir = 'src/static/img';
    const distDir = 'dist/img';

    // Ensure dist/img exists
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    const walkFiles = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const out = [];
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                out.push(...walkFiles(fullPath));
            } else if (entry.isFile()) {
                out.push(fullPath);
            }
        }
        return out;
    };

    const files = walkFiles(srcDir);
    let optimizedCount = 0;

    for (const file of files) {
        const srcPath = file;
        const relativePath = path.relative(srcDir, srcPath);
        const distPath = path.join(distDir, relativePath);
        const distFolder = path.dirname(distPath);

        if (!fs.existsSync(distFolder)) {
            fs.mkdirSync(distFolder, { recursive: true });
        }

        if (fs.statSync(srcPath).isFile()) {
            const ext = path.extname(srcPath).toLowerCase();

            try {
                if (ext === '.png') {
                    // Optimize PNG with better compression
                    await sharp(srcPath)
                        .png({
                            quality: 80,
                            compressionLevel: 9,
                            palette: true,
                            colors: 256
                        })
                        .toFile(distPath);
                    console.log(`✓ Optimized PNG: ${relativePath}`);
                    optimizedCount++;
                } else if (ext === '.jpg' || ext === '.jpeg') {
                    // Optimize JPEG
                    await sharp(srcPath)
                        .jpeg({
                            quality: 80,
                            progressive: true,
                            mozjpeg: true
                        })
                        .toFile(distPath);
                    console.log(`✓ Optimized JPEG: ${relativePath}`);
                    optimizedCount++;
                } else if (ext === '.gif') {
                    // Convert GIF to WebP for better compression
                    const webpPath = distPath.replace(/\.gif$/i, '.webp');
                    await sharp(srcPath)
                        .webp({
                            quality: 80,
                            effort: 6
                        })
                        .toFile(webpPath);
                    // Also copy original GIF
                    fs.copyFileSync(srcPath, distPath);
                    console.log(`✓ Converted GIF to WebP: ${relativePath}`);
                    optimizedCount++;
                } else {
                    // Copy other files as-is
                    fs.copyFileSync(srcPath, distPath);
                }
            } catch (error) {
                console.error(`✗ Error processing ${relativePath}:`, error.message);
                // Copy file as-is if optimization fails
                fs.copyFileSync(srcPath, distPath);
            }
        }
    }

    console.log(`Image optimization complete! Processed ${optimizedCount} images.`);
}

optimizeImages().catch(console.error);
