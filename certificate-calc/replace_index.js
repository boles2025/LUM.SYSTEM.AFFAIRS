const fs = require('fs');
let text = fs.readFileSync('index_fixed3.html', 'utf8');
if (text.startsWith('?')) {
    text = text.substring(1);
}
fs.writeFileSync('index.html', text, 'utf8');
console.log('Fixed index.html saved');
