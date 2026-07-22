import sys

filepath = 'index.html'
with open(filepath, 'rb') as f:
    raw = f.read()

print(f"File size: {len(raw)} bytes")

# Check for garbled pattern (mozjibake)
pattern_garbled = 'Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹'.encode('utf-8')
idx = raw.find(pattern_garbled)
if idx >= 0:
    print(f"Found garbled 'المجموع' at byte {idx}")
else:
    pattern_correct = 'المجموع'.encode('utf-8')
    idx = raw.find(pattern_correct)
    if idx >= 0:
        print(f"Found correct 'المجموع' at byte {idx}")
    else:
        print("Neither found")

# Try to decode as utf-8 to see if it's valid
try:
    content = raw.decode('utf-8')
    print("File is valid UTF-8")
    # Check if the text looks like mojibake
    if 'Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹' in content:
        print("Contains mojibake - attempting fix")
        # Attempt the latin-1 fix
        fixed = content.encode('latin-1').decode('utf-8')
        with open('index_fixed_final.html', 'w', encoding='utf-8') as f:
            f.write(fixed)
        print("Fixed and saved to index_fixed_final.html")
    else:
        print("No mojibake detected")
        # Still, check our Arabic additions
        if 'عربي' in content:
            print("Our Arabic additions are correct!")
except Exception as e:
    print(f"Error: {e}")
