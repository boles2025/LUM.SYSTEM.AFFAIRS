const fs = require('fs');
const transcriptPath = 'C:/Users/Boles/.gemini/antigravity/brain/f6af407a-0326-4960-a859-ab1b693294fe/.system_generated/logs/transcript_full.jsonl';
const content = fs.readFileSync(transcriptPath, 'utf8');
const lines = content.split('\n').filter(Boolean);

// Find step 527
const step = JSON.parse(lines[526]);
const stepContent = JSON.stringify(step);

// Find the SA_html code and everything around it
const idx = stepContent.indexOf('function SA_html');
if (idx >= 0) {
  // Get a large chunk to find the full functions
  const chunk = stepContent.slice(Math.max(0, idx - 200), idx + 15000);
  const decoded = chunk.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  console.log(decoded.slice(0, 8000));
}
