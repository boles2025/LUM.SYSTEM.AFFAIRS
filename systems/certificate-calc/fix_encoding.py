import os

filepath = 'index.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

try:
    # Attempt to fix double encoding: text was UTF-8 but read as latin-1 and then saved as UTF-8
    # Actually wait. If the file was saved as UTF-8 with these weird characters, the characters in the string are already the weird ones.
    # Let's convert string -> latin1 bytes -> utf-8 string
    fixed_content = content.encode('latin1').decode('utf-8')
    
    with open('index_fixed.html', 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    print("Successfully fixed encoding and saved to index_fixed.html")
except Exception as e:
    print(f"Error during decoding: {e}")
