const fs = require('fs');
const c = fs.readFileSync('d:/شغل جامعة اللوتس/شامل/systems/certificate-calc/index.html', 'utf8');

// Extract the main inline script block
const lines = c.split('\n');
let inScript = false;
let scriptContent = [];
let startLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '<script>' && i > 1170) {
    inScript = true;
    startLine = i + 1;
    scriptContent = [];
    console.log('Script block starts at HTML line', i + 1);
    break;
  }
}

if (startLine > 0) {
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].trim() === '</script>') {
      console.log('Script block ends at HTML line', i + 1);
      break;
    }
    scriptContent.push(lines[i]);
  }
  
  const js = scriptContent.join('\n');
  
  // Try to parse it with node
  try {
    const vm = require('vm');
    new vm.Script(js);
    console.log('✅ JavaScript syntax is VALID');
  } catch(e) {
    console.log('❌ JavaScript syntax ERROR:', e.message);
    // Find the problem line
    const match = e.message.match(/(\d+)/);
    if (match) {
      const errLine = parseInt(match[1]);
      console.log('Error near script line', errLine);
      const jLines = js.split('\n');
      for (let i = Math.max(0, errLine-3); i < Math.min(jLines.length, errLine+3); i++) {
        console.log((i+1) + ': ' + jLines[i].trim().substring(0, 100));
      }
    }
  }
}
