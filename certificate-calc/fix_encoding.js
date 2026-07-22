const fs = require('fs');

try {
    const text = fs.readFileSync('index.html', 'utf8');
    // The text contains characters like Ù†Ø¸Ø§Ù… which are the latin1 representation of utf-8 bytes
    // We convert the string back to a buffer using binary encoding (latin1)
    const buffer = Buffer.from(text, 'binary');
    // Then we decode the buffer as utf8
    const fixedText = buffer.toString('utf8');
    
    fs.writeFileSync('index_fixed.html', fixedText, 'utf8');
    console.log('Successfully fixed encoding and saved to index_fixed.html');
} catch (e) {
    console.error('Error:', e);
}
