import os

filepath = 'index.html'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

try:
    fixed_content = content.encode('cp1252').decode('utf-8')
    with open('index_fixed2.html', 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    print("Successfully fixed encoding and saved to index_fixed2.html")
except Exception as e:
    print(f"Error during decoding: {e}")
