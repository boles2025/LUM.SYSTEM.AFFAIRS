import sys
with open('debug_out.txt', 'w', encoding='utf-8') as d:
    d.write('started\n')
    with open('index.html', 'rb') as f:
        raw = f.read()
    d.write(f'size: {len(raw)}\n')
    garbled = '\u00d8\u00a7\u00d9\u201e\u00d9\u2026\u00d8\u00ac\u00d9\u2026\u00d9\u02c6\u00d8\u00b9'.encode('utf-8')
    idx = raw.find(garbled)
    d.write(f'garbled at {idx}\n')
    correct = '\u0627\u0644\u0645\u062c\u0645\u0648\u0639'.encode('utf-8')
    idx2 = raw.find(correct)
    d.write(f'correct at {idx2}\n')
    d.write('done\n')
