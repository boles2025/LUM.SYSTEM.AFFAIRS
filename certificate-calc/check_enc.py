import sys, os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

with open('debug2.txt', 'w', encoding='utf-8') as d:
    with open('index.html', 'rb') as f:
        raw = f.read()
    d.write(f'size: {len(raw)}\n')
    
    # Try to decode as UTF-8
    try:
        text = raw.decode('utf-8')
        d.write('Valid UTF-8\n')
        
        # Check for mojibake pattern (garbled Arabic)
        # The garbled version of "المجموع" would be "Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹"
        garbled_count = text.count('\u00d8\u00a7\u00d9\u201e\u00d9\u2026\u00d8\u00ac\u00d9\u2026\u00d9\u02c6\u00d8\u00b9')
        d.write(f'Garbled count: {garbled_count}\n')
        
        # Check if we have correct Arabic
        correct_count = text.count('\u0627\u0644\u0645\u062c\u0645\u0648\u0639')
        d.write(f'Correct count: {correct_count}\n')
        
        # Check for our new additions
        if '"عربي"' in text:
            d.write('Found Arabic additions\n')
            idx = text.index('"عربي"')
            d.write(f'  at position {idx}\n')
            d.write(f'  context: {text[idx-20:idx+40]}\n')
    except Exception as e:
        d.write(f'Error: {e}\n')
    
    d.write('Done\n')
