# Картинки рецептов и раскраски (PDF A4) из генераций 13.11 в «Новогодний проект\Сайт Ёлкино — картинки 13.11».
# Запуск: python -I -X utf8 _tools/build_rubriki_img.py
import os
from PIL import Image, ImageOps
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = r"C:\Users\Admin\Desktop\настя\Мои проекты\Новогодний проект\Сайт Ёлкино — картинки 13.11"
# какой вариант генерации взят (1 или 2). Шуба и печенье перегенерированы (f2b/f5b), выбранные скопированы в f2_shuba_1 / f5_pechenie_1
RASK = [("1-snegovik", "r1_snegovik", 1, "Снеговик"), ("2-elka", "r2_elka", 2, "Ёлка с подарками"),
        ("3-shar", "r3_shar", 2, "Ёлочный шар"), ("4-ded-moroz", "r4_ded", 2, "Дед Мороз"),
        ("5-zayka", "r5_zayka", 2, "Зайка с мандарином"), ("6-domik", "r6_domik", 2, "Домик в снегу"),
        ("7-sani", "r7_sani", 2, "Олень и сани"), ("8-snezhinka", "r8_snezhinka", 1, "Снежинка")]
FOOD = [("olivie", "f1_olivie", 1), ("shuba", "f2_shuba", 1), ("mimoza", "f3_mimoza", 1), ("shproty", "f4_shproty", 2),
        ("pechenie", "f5_pechenie", 1), ("yabloki", "f6_yabloki", 1), ("glintvein", "f7_napitok", 2)]
import json, sys
if len(sys.argv) > 1:  # переопределить варианты: {"r1_snegovik":2,...}
    ch = json.loads(sys.argv[1])
    RASK = [(a, b, ch.get(b, c), d) for a, b, c, d in RASK]
    FOOD = [(a, b, ch.get(b, c)) for a, b, c in FOOD]


def cover(im, w, h):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def lineart(p):
    im = ImageOps.autocontrast(Image.open(p).convert("L"), cutoff=1)
    return im.point(lambda v: 0 if v < 80 else 255 if v > 150 else int((v - 80) * 255 / 70))


os.makedirs(os.path.join(ROOT, "img", "recepty"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "img", "raskraski"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "files"), exist_ok=True)
for name, src, v, *_ in FOOD:
    f = os.path.join(SRC, "recepty", f"{src}_{v}.png")
    if not os.path.exists(f): print("нет", f); continue
    cover(Image.open(f).convert("RGB"), 720, 900).save(os.path.join(ROOT, "img", "recepty", name + ".webp"), "WEBP", quality=80, method=6)

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
W, H = A4
allc = canvas.Canvas(os.path.join(ROOT, "files", "raskraski-elkino.pdf"), pagesize=A4)
allc.setTitle("Раскраски «Ёлкино чудо»")


def page(c, img_path, title):
    m = 12 * mm
    iw, ih = W - 2 * m, H - 2 * m - 12 * mm
    im = Image.open(img_path)
    r = min(iw / im.width, ih / im.height)
    dw, dh = im.width * r, im.height * r
    c.drawImage(img_path, (W - dw) / 2, m + 12 * mm + (ih - dh) / 2, dw, dh)
    c.setFont("Arial", 10); c.setFillGray(.35)
    c.drawString(m, m + 2 * mm, f"Раскраска «{title}»")
    c.drawRightString(W - m, m + 2 * mm, "Ёлкино чудо · ёлкино-чудо.рф")
    c.showPage()


for name, src, v, title in RASK:
    f = os.path.join(SRC, "raskraski", f"{src}_{v}.png")
    if not os.path.exists(f): print("нет", f); continue
    la = lineart(f)
    tmp = os.path.join(ROOT, "files", f"_{name}.png"); la.save(tmp)
    prev = Image.new("L", (600, 800), 255); t = la.copy(); t.thumbnail((584, 784), Image.LANCZOS)
    prev.paste(t, ((600 - t.width) // 2, (800 - t.height) // 2))
    prev.save(os.path.join(ROOT, "img", "raskraski", name + ".webp"), "WEBP", quality=82, method=6)
    one = canvas.Canvas(os.path.join(ROOT, "files", f"raskraska-{name}.pdf"), pagesize=A4)
    one.setTitle(f"Раскраска «{title}» — Ёлкино чудо")
    page(one, tmp, title); one.save()
    page(allc, tmp, title)
    os.remove(tmp)
allc.save()
print("готово")
