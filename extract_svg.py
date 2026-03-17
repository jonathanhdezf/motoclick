import re

with open(r'c:\Users\ACER\.gemini\antigravity\brain\4a58fe22-4ac0-47c9-a137-01160a756fe2\.system_generated\logs\overview.txt', 'r', encoding='utf-8') as f:
    content = f.read()

m = re.search(r'(<svg id="Capa_1".*?</svg>)', content, re.DOTALL)
if m:
    with open('assets/moto-flotante.svg', 'w', encoding='utf-8') as out:
        out.write(m.group(1))
    print("SVG extracted successfully.")
else:
    print("SVG not found.")
