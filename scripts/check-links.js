const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []) {
    fs.readdirSync(dir).forEach(file => {
        const dirFile = path.join(dir, file);
        if (fs.statSync(dirFile).isDirectory()) {
            if (!dirFile.includes('node_modules') && !dirFile.includes('.git')) {
                filelist = walk(dirFile, filelist);
            }
        } else if (dirFile.endsWith('.html')) {
            filelist.push(dirFile);
        }
    });
    return filelist;
}

const htmlFiles = walk(path.join(__dirname, '..'));
let invalidLinks = [];

htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const matches = [...content.matchAll(/href=["'](\/[^"']*)["']/g)].map(m => m[1]);

    matches.forEach(rawLink => {
        if (rawLink === '/') return;

        const link = rawLink.split('?')[0].split('#')[0];

        // Netlify resolves these to either .html or /index.html
        const p1 = path.join(__dirname, '..', link + '.html');
        const p2 = path.join(__dirname, '..', link, 'index.html');
        const p3 = path.join(__dirname, '..', link); // if link includes .html

        if (!fs.existsSync(p1) && !fs.existsSync(p2) && !fs.existsSync(p3)) {
            invalidLinks.push({ file: path.relative(path.join(__dirname, '..'), file), link });
        }
    });
});

if (invalidLinks.length > 0) {
    console.log("Found broken internal links:");
    console.table(invalidLinks);
    process.exit(1);
} else {
    console.log("All local links OK!");
}
