# Лента «Каждый день — маленькая радость»: каждый прошедший день открывается своим постом из канала.
# Берёт главный пост дня (id elk-ДДММ-tg) из очереди бота, только уже вышедшие (state.json → channel_posts_done).
# Делает: img/pДДММ.webp (карточка 560×700), img/days/dДДММ.webp (окно поста), js/days-data.js,
# и вставляет/обновляет карточки прошедших дней в index.html. Будущие анонсы не трогает.
# Запуск: python -I -X utf8 _tools/build_days.py   (папка _ на GitHub Pages не публикуется)
import json, glob, os, re, html, datetime
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOT = r"C:\Users\Admin\Desktop\настя\Мои проекты\Бот-помощник"
START = datetime.date(2026, 11, 6)
NY = datetime.date(2027, 1, 1)
MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
ALT = {  # подписи к картинкам для незрячих
    '0611': 'Деревянный ящик с мандаринами и листьями на фоне гирлянды',
    '0711': 'Золотая гирлянда-нить с шариками на зелёном бархате',
    '0811': 'Картонная коробка с ёлочными шарами, ватой и дождиком',
    '0911': 'Зелёные стеклянные шары и золотая звезда среди огоньков',
    '1011': 'Стол со списком дел, коробкой игрушек и чашкой чая',
    '1111': 'Корица, бадьян и дольки апельсина на бархате',
    '1211': 'Тонкая свеча в латунном подсвечнике и золотые звёздочки',
    '1311': 'Бархатный свиток с золотой лентой и чистый лист бумаги',
}


def plural(n, a, b, c):
    n = abs(n) % 100
    if 11 <= n <= 19: return c
    n %= 10
    return a if n == 1 else b if 2 <= n <= 4 else c


def load_posts():
    seen = {}
    files = [os.path.join(BOT, 'channel_queue.json')] + sorted(glob.glob(os.path.join(BOT, 'channel_queue*')))
    for f in files:
        try: q = json.load(open(f, encoding='utf-8'))
        except Exception: continue
        for it in q if isinstance(q, list) else []:
            if isinstance(it, dict) and re.fullmatch(r'elk-\d{4}-tg', it.get('id', '')) and it['id'] not in seen:
                seen[it['id']] = it
    done = json.load(open(os.path.join(BOT, 'state.json'), encoding='utf-8')).get('channel_posts_done', {})
    return {k: v for k, v in seen.items() if k in done}


def cover(src, w, h):
    im = Image.open(src).convert('RGB')
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def body_html(lines):
    """Текст поста → абзацы; нумерованные строки → список."""
    out, para, lst = [], [], []
    def flush():
        nonlocal para, lst
        if para: out.append('<p>' + '<br>'.join(para) + '</p>'); para = []
        if lst: out.append('<ol>' + ''.join('<li>' + x + '</li>' for x in lst) + '</ol>'); lst = []
    for ln in lines:
        s = html.escape(ln.strip())
        if not s: flush(); continue
        m = re.match(r'^\d+\.\s+(.*)', s)
        if m:
            if para: out.append('<p>' + '<br>'.join(para) + '</p>'); para = []
            lst.append(m.group(1)); continue
        if lst: flush()
        para.append(s)
    flush()
    return ''.join(out)


def teaser(lines, title):
    for ln in lines:
        s = ln.strip()
        if not s or s.endswith('.') and len(s) < 16 or re.match(r'^\d+\.', s):  # «Мини-сказка.» и списки пропускаем
            continue
        sent, first = re.split(r'(?<=[.!?])\s', s), ''
        for x in sent:
            if len(first) >= 45 or len(first) + len(x) > 110: break
            first = (first + ' ' + x).strip()
        if first and len(first) >= 45:
            return first
        if len(s) <= 110:
            return s
        s = s[:90].rsplit(' ', 1)[0].rstrip(',;:—.') + '…'
        return s
    return ''


def main():
    today = datetime.date.today()
    posts = load_posts()
    os.makedirs(os.path.join(ROOT, 'img', 'days'), exist_ok=True)
    data, leaves = {}, {}
    for pid, it in posts.items():
        dd, mm = pid[4:6], pid[6:8]
        d = datetime.date(2026, int(mm), int(dd))
        if d < START or d > today: continue
        text = (it.get('text') or '').strip().split('\n')
        first = text[0]
        title = re.sub(r'^\d+\s+(дн\S*|день)\s+до Нового года\.\s*', '', first).strip() or first
        rest = text[1:]
        key = dd + mm
        img = it.get('image')
        if img and os.path.exists(img):
            cover(img, 560, 700).save(os.path.join(ROOT, 'img', f'p{key}.webp'), 'WEBP', quality=78, method=6)
            cover(img, 720, 900).save(os.path.join(ROOT, 'img', 'days', f'd{key}.webp'), 'WEBP', quality=80, method=6)
        n = (NY - d).days
        iso = d.isoformat()
        data[iso] = {'n': n, 'date': f'{d.day} {MONTHS[d.month - 1]}', 'h': title,
                     'img': f'img/days/d{key}.webp', 'alt': ALT.get(key, ''), 'body': body_html(rest)}
        leaves[iso] = (
            f'      <li class="leaf" data-date="{iso}">\n'
            f'        <img src="img/p{key}.webp" alt="{html.escape(ALT.get(key, ""))}" width="560" height="700" loading="lazy">\n'
            f'        <div class="leaf-body">\n'
            f'          <p class="leaf-top"><span class="leaf-n">{n}</span><span class="leaf-d">{plural(n, "день", "дня", "дней")} до НГ<br><time datetime="{iso}">{d.day} {MONTHS[d.month - 1]}</time></span></p>\n'
            f'          <h3>{html.escape(title)}</h3>\n'
            f'          <p>{html.escape(teaser(rest, title))}</p>\n'
            f'        </div>\n'
            f'      </li>')
    # данные для окна поста
    with open(os.path.join(ROOT, 'js', 'days-data.js'), 'w', encoding='utf-8') as f:
        f.write('/* Посты прошедших дней отсчёта. Сгенерировано _tools/build_days.py — руками не править. */\n')
        f.write('window.ELK_DAYS = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
    # лента в index.html
    p = os.path.join(ROOT, 'index.html')
    src = open(p, encoding='utf-8').read()
    m = re.search(r'(<ol class="strip" id="strip">\n)(.*?)(\n    </ol>)', src, re.S)
    old = re.findall(r'      <li class="leaf" data-date="([\d-]+)">.*?</li>', m.group(2), re.S)
    blocks = dict(zip(old, re.findall(r'      <li class="leaf" data-date="[\d-]+">.*?</li>', m.group(2), re.S)))
    blocks.update(leaves)
    new = '\n'.join(blocks[k] for k in sorted(blocks))
    src = src[:m.start(2)] + new + src[m.end(2):]
    open(p, 'w', encoding='utf-8', newline='\n').write(src)
    print('дней с постами:', len(data), sorted(data))


if __name__ == '__main__':
    main()
