import re

html_path = 'index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# Replace <style> block
style_pattern = re.compile(r'<style>.*?</style>', re.DOTALL)
html = style_pattern.sub('<link rel="stylesheet" href="css/style.css">', html)

# Replace <script> block and insert dependencies
script_pattern = re.compile(r'<script>\s*// marked\.setOptions.*?</script>', re.DOTALL)
script_tags = """
    <script src="js/data.js"></script>
    <script src="js/ui.js"></script>
    <script src="js/preview.js"></script>
    <script src="js/main.js"></script>
"""
html = script_pattern.sub(script_tags, html)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("Replacement successful")
