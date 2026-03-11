from PIL import Image, ImageDraw

def create_icon(size, filename):
    # Base image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Scale coordinates from 64x64 base to 'size'
    scale = size / 64.0

    # Draw background white rectangle with black stroke
    x0 = int(12 * scale)
    y0 = int(8 * scale)
    x1 = int((12 + 40) * scale)
    y1 = int((8 + 48) * scale)
    r = int(4 * scale)

    # Draw outline (stroke)
    outline_width = int(4 * scale)

    # Using rounded_rectangle to match SVG rx=4
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill="#ffffff", outline="#000000", width=outline_width)

    # Draw internal lines (black rectangles)
    # 1. x=20, y=20, w=24, h=4, rx=2
    lx0 = int(20 * scale)
    ly0 = int(20 * scale)
    lx1 = int((20 + 24) * scale)
    ly1 = int((20 + 4) * scale)
    lr = int(2 * scale)
    draw.rounded_rectangle([lx0, ly0, lx1, ly1], radius=lr, fill="#000000")

    # 2. x=20, y=30, w=18, h=4, rx=2
    lx0 = int(20 * scale)
    ly0 = int(30 * scale)
    lx1 = int((20 + 18) * scale)
    ly1 = int((30 + 4) * scale)
    draw.rounded_rectangle([lx0, ly0, lx1, ly1], radius=lr, fill="#000000")

    # 3. x=20, y=40, w=20, h=4, rx=2
    lx0 = int(20 * scale)
    ly0 = int(40 * scale)
    lx1 = int((20 + 20) * scale)
    ly1 = int((40 + 4) * scale)
    draw.rounded_rectangle([lx0, ly0, lx1, ly1], radius=lr, fill="#000000")

    img.save(filename)

# Generate 192x192, 512x512, and 16x16 (favicon)
create_icon(192, 'icon-192.png')
create_icon(512, 'icon-512.png')
create_icon(32, 'favicon.png')
