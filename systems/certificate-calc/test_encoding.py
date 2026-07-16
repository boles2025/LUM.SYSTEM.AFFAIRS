import os

filepath = 'index.html'
with open(filepath, 'rb') as f:
    content = f.read(1000)

print(content)
