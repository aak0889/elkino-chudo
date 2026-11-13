# Картинки рубрики «Как было у нас»: квадратные кадры из её материалов (ролик «Бабушкин сервант», «Мама, это тебе», пины Pinterest без надписей).
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = r"C:\Users\Admin\Desktop\настя\Мои проекты\Контент-конвейер"
SV = P + r"\Ролики по стандарту 10.11\_исходники\servant\assets"
MA = P + r"\Ролики по стандарту 10.11\_исходники\mama\assets"
PI = P + r"\Ночь 09.11\Pinterest"
# (имя, файл, верх кадра в долях высоты, доля ширины)
JOBS = [
    ("servant", SV + r"\s0.jpg", .18, 1.0),
    ("salatnitsa", SV + r"\s1.jpg", .30, 1.0),
    ("serviz", SV + r"\s2.jpg", .28, 1.0),
    ("mandariny", PI + r"\08_мандарины.png", .30, 1.0),
    ("korobka", PI + r"\03_ватные-игрушки.png", .30, 1.0),
    ("dozhdik", MA + r"\s5.jpg", .22, 1.0),
    ("stol", PI + r"\05_стол.png", .30, 1.0),
    ("varezhki", MA + r"\s3.jpg", .36, 1.0),
    ("otkrytka", PI + r"\04_открытка.png", .30, 1.0),
]
for name, src, top, wf in JOBS:
    im = Image.open(src).convert("RGB")
    w = int(im.width * wf); x = (im.width - w) // 2
    side = min(w, int(im.height * .64)) if 'Pinterest' in src else w
    y = int(im.height * top)
    y = min(y, im.height - side)
    im = im.crop((x, y, x + side, y + side)).resize((900, 900), Image.LANCZOS)
    im.save(os.path.join(ROOT, "img", "bylo", name + ".webp"), "WEBP", quality=80, method=6)
    print(name)
