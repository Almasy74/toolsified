const fs = require('fs');
const path = require('path');

let count = 0;

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!fullPath.includes('node_modules') && !fullPath.includes('.git')) {
                walk(fullPath);
            }
        } else if (fullPath.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let newContent = content.replace(/href=\"\/?style\.css(\?v=\d+\.\d+)?\"/g, 'href="/style.css?v=2.2"');
            if (newContent !== content) {
                fs.writeFileSync(fullPath, newContent, 'utf8');
                count++;
            }
        }
    }
}

walk('f:/toolsified');
console.log(`${count} HTML files updated with new style.css cache buster (?v=2.2).`);
