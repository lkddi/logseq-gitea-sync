#!/usr/bin/env python3
"""Generate a simple 256x256 logo.png for the plugin."""
from PIL import Image, ImageDraw

SIZE = 256
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded square background (Gitea-ish green-teal)
margin = 16
radius = 48
d.rounded_rectangle([margin, margin, SIZE - margin, SIZE - margin], radius=radius, fill=(24, 160, 139, 255))

# Draw a simple git-branch-like glyph: two dots + a line + a node
def circle(cx, cy, r, fill):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

# branch dots (left column)
circle(84, 88, 18, (255, 255, 255, 255))
circle(84, 168, 18, (255, 255, 255, 255))
# trunk line
d.line([84, 106, 84, 150], fill=(255, 255, 255, 255), width=10)
d.line([84, 106, 172, 88], fill=(255, 255, 255, 255), width=10)
# head dot (right)
circle(172, 88, 18, (255, 255, 255, 255))
# little arrow tip on the line to suggest "push"
d.polygon([(172, 60), (196, 88), (172, 116)], fill=(255, 255, 255, 255))

img.save("logo.png")
print("logo.png written")
