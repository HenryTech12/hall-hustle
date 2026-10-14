"""
Generates the illustrated demo images used by the demo-seed endpoint.

    python -m scripts.make_seed_images

Output: app/static/demo/room_1..6.jpg and need_1..2.jpg. These are flat
illustrations, not photos, and carry a small "Sample image" label so nobody
mistakes them for real listings. Replace them with real photos if you like:
keep the same file names and re-run the seed endpoint.
"""
import os

from PIL import Image, ImageDraw, ImageFont, ImageOps

OUT = os.path.join(os.path.dirname(__file__), "..", "app", "static", "demo")
S = 2  # draw at 2x then downsample for smooth edges
W = H = 900 * S

PALETTES = [
    dict(wall="#F2E3C6", floor="#B98B5E", bed="#2E4A62", blanket="#E86A4B", accent="#FFC02B", sky="#BFE3F5"),
    dict(wall="#DDEBE4", floor="#C9A27A", bed="#3C5A4B", blanket="#F2B84B", accent="#D9533C", sky="#CFE8F7"),
    dict(wall="#EBD9E6", floor="#A98467", bed="#5B3F7A", blanket="#8FD0B6", accent="#F27D5B", sky="#D9ECFA"),
    dict(wall="#E3E8F0", floor="#B79B7B", bed="#26394F", blanket="#6FB5A6", accent="#FFC02B", sky="#BDDCF2"),
    dict(wall="#F6E7D3", floor="#9C7656", bed="#7A2E3B", blanket="#F4D58D", accent="#2E7D6B", sky="#CBE6F6"),
    dict(wall="#E8EFD9", floor="#C2A27C", bed="#33485E", blanket="#E3735B", accent="#7EC4A6", sky="#C4E4F4"),
]


def shade(hexcol, f):
    """f < 1 darkens, f > 1 lightens (towards white)."""
    rgb = [int(hexcol[i:i + 2], 16) for i in (1, 3, 5)]
    if f <= 1:
        rgb = [int(c * f) for c in rgb]
    else:
        rgb = [int(c + (255 - c) * (f - 1)) for c in rgb]
    return "#%02X%02X%02X" % tuple(rgb)


def font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def r(d, box, fill, radius=0):
    x0, y0, x1, y1 = [v * S for v in box]
    if radius:
        d.rounded_rectangle((x0, y0, x1, y1), radius=radius * S, fill=fill)
    else:
        d.rectangle((x0, y0, x1, y1), fill=fill)


def label(img):
    d = ImageDraw.Draw(img)
    f = font(13 * S)
    d.text((22 * S, 868 * S), "Sample image", fill="#6B5B4A", font=f)


def room(idx: int):
    p = PALETTES[idx % len(PALETTES)]
    img = Image.new("RGB", (W, H), p["wall"])
    d = ImageDraw.Draw(img)

    # floor + skirting
    r(d, (0, 610, 900, 900), p["floor"])
    r(d, (0, 598, 900, 616), shade(p["wall"], 0.82))
    for x in range(0, 900, 90):
        r(d, (x, 616, x + 2, 900), shade(p["floor"], 0.9))

    # window with sky gradient, frame and curtains
    r(d, (560, 110, 820, 400), "#FFFFFF")
    for i in range(270):
        t = i / 270
        c = tuple(int(int(p["sky"][j:j + 2], 16) * (1 - t * 0.12)) for j in (1, 3, 5))
        r(d, (572, 122 + i, 808, 123 + i), c)
    r(d, (687, 122, 693, 388), "#FFFFFF")
    r(d, (572, 250, 808, 256), "#FFFFFF")
    d.ellipse((730 * S, 150 * S, 780 * S, 200 * S), fill="#FFE9A8")  # sun
    r(d, (540, 100, 580, 420), p["accent"], 6)
    r(d, (800, 100, 840, 420), p["accent"], 6)

    # poster
    r(d, (110, 150, 270, 300), "#FFFFFF", 6)
    r(d, (122, 162, 258, 288), p["blanket"], 4)
    d.polygon([(122 * S, 288 * S), (190 * S, 205 * S), (258 * S, 288 * S)], fill=p["bed"])

    # bed
    r(d, (60, 470, 470, 640), p["bed"], 14)  # frame/headboard
    r(d, (80, 520, 450, 610), "#FFFFFF", 16)  # mattress
    r(d, (80, 560, 450, 612), p["blanket"], 14)  # blanket
    for x in range(110, 440, 60):
        r(d, (x, 562, x + 18, 610), shade(p["blanket"], 1.45))
    r(d, (95, 500, 205, 545), "#F7F7F7", 18)  # pillow
    r(d, (70, 640, 90, 690), "#3B2A1E")
    r(d, (440, 640, 460, 690), "#3B2A1E")

    # desk + laptop + lamp
    r(d, (520, 560, 860, 585), "#6B4A32", 4)
    r(d, (540, 585, 560, 720), "#6B4A32")
    r(d, (820, 585, 840, 720), "#6B4A32")
    r(d, (610, 505, 740, 560), "#2B2F36", 6)
    r(d, (618, 512, 732, 552), "#8EC9F0", 3)
    r(d, (596, 560, 756, 568), "#4A4F57", 3)
    d.line((800 * S, 560 * S, 800 * S, 470 * S), fill="#33373D", width=6 * S)
    d.polygon([(772 * S, 470 * S), (828 * S, 470 * S), (812 * S, 430 * S), (788 * S, 430 * S)], fill=p["accent"])

    # chair
    r(d, (640, 600, 720, 622), p["accent"], 6)
    r(d, (676, 622, 684, 700), "#3B2A1E")

    # rug + plant
    d.ellipse((230 * S, 740 * S, 620 * S, 850 * S), fill=p["accent"])
    d.ellipse((260 * S, 755 * S, 590 * S, 836 * S), fill=p["blanket"])
    r(d, (800, 640, 860, 720), "#C46A3E", 6)
    for ang, (dx, dy) in enumerate([(-22, -50), (0, -70), (22, -48), (-8, -38), (12, -34)]):
        d.ellipse(((830 + dx - 14) * S, (640 + dy - 22) * S, (830 + dx + 14) * S, (640 + dy + 22) * S), fill="#3F8F5A")

    if idx % 2 == 1:
        img = ImageOps.mirror(img)

    label(img)
    return img.resize((900, 900), Image.LANCZOS)


def need_space(idx: int):
    p = PALETTES[(idx + 2) % len(PALETTES)]
    img = Image.new("RGB", (W, H), p["wall"])
    d = ImageDraw.Draw(img)
    r(d, (0, 640, 900, 900), p["floor"])
    # house
    r(d, (250, 330, 650, 640), "#FFFFFF", 10)
    d.polygon([(220 * S, 340 * S), (450 * S, 160 * S), (680 * S, 340 * S)], fill=p["bed"])
    r(d, (410, 480, 490, 640), p["accent"], 8)
    r(d, (290, 400, 380, 480), p["sky"], 6)
    r(d, (520, 400, 610, 480), p["sky"], 6)
    # magnifier
    d.ellipse((560 * S, 520 * S, 760 * S, 720 * S), outline=p["blanket"], width=18 * S)
    d.line((740 * S, 700 * S, 830 * S, 790 * S), fill=p["blanket"], width=26 * S)
    d.text((70 * S, 70 * S), "LOOKING FOR A ROOM", fill=p["bed"], font=font(46 * S))
    label(img)
    return img.resize((900, 900), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for i in range(6):
        room(i).convert("RGB").save(os.path.join(OUT, f"room_{i + 1}.jpg"), quality=84, optimize=True)
    for i in range(2):
        need_space(i).convert("RGB").save(os.path.join(OUT, f"need_{i + 1}.jpg"), quality=84, optimize=True)
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
