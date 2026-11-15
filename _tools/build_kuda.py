# Раздел «Куда пойти»: собирает js/kuda-data.js из _tools/kuda_places.json.
# kuda_places.json — исходник: каждое место с официальной ссылкой, ценой и часами (с источниками и годом).
# Запуск: python -X utf8 _tools/build_kuda.py   (ссылки проверяет _tools/check_kuda_links.py)
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
places = json.load(open(os.path.join(ROOT, '_tools', 'kuda_places.json'), encoding='utf8'))

OLD_YEAR = re.compile(r'20(1\d|2[0-5])')  # цены не нового сезона


def price_line(p):
    kind, txt, yr = p['price_kind'], (p.get('price') or '').strip(), (p.get('price_year') or '').strip()
    txt = txt[:1].upper() + txt[1:] if txt else ''
    if kind == 'free':
        return txt if txt and txt.lower() not in ('бесплатно',) else 'Бесплатно', ''
    if kind == 'unknown' or not txt:
        return (txt + '. ' if txt else '') + 'Цены сезона 2026–27 пока не опубликованы, смотрите на сайте площадки.', 'warn'
    if yr and OLD_YEAR.search(yr) and '2026' not in yr:
        return f'Цены сезона {yr}: {txt}. На 2026–27 уточняйте на сайте.', 'old'
    return txt, ''


def transport(m):
    return bool(re.search(r'электрич|автобус|метеор', m, re.I))


out = []
for i, p in enumerate(places):
    pr, pcls = price_line(p)
    m = (p.get('metro') or '').strip()
    w = list(p.get('ages') or []) + [x for x in (p.get('who') or []) if x in ('pair', 'crew', 'solo')]
    out.append(dict(
        id=f"{p['city']}{i + 1}", c=p['city'], n=p['name'], k=p['cat'], t=p.get('desc', ''),
        s=p.get('url') or '', ss=p.get('url_status') or 0,
        a=p.get('addr') or '', m='' if transport(m) else m, tr=m if transport(m) else '',
        mm=p.get('metro_min'), p=pr, pc=pcls, ps=p.get('price_src') or '',
        h=p.get('hours') or '', hs=p.get('hours_src') or '', se=p.get('season') or '',
        f=p.get('for') or [], w=w, mo=p.get('moods') or [], i=p['indoor'], d=p['district'],
        tm=p['time'], b=int(p.get('budget') or 0), fr=1 if p['price_kind'] == 'free' else 0,
    ))
open(os.path.join(ROOT, 'js', 'kuda-data.js'), 'w', encoding='utf8').write(
    '// Сгенерировано _tools/build_kuda.py из _tools/kuda_places.json (проверка 13.11.2026).\n'
    '// Данные с официальных сайтов и mos.ru / spb-агрегаторов; у цены — год и источник.\n'
    'window.KUDA_PLACES=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(out), 'places:', sum(p['c'] == 'msk' for p in out), 'msk /', sum(p['c'] == 'spb' for p in out), 'spb')
