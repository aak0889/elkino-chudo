# Раздел «Куда пойти»: собирает js/kuda-data.js из таблицы мест (places.txt) и её файлов (адрес/метро).
# Запуск: python -I -X utf8 _tools/build_kuda.py <places.txt> <161455.txt.json> <161503.txt.json>
import sys, json, re, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
places_fn, msk_fn, spb_fn = sys.argv[1:4]
src = {'msk': json.load(open(msk_fn, encoding='utf8')), 'spb': json.load(open(spb_fn, encoding='utf8'))}
ADDR = {  # исправлено по официальным сайтам
    'Театр Образцова': ('ул. Садовая-Самотёчная, 3', ''),
    'Океанариум в Крокус Сити': ('Красногорск, ул. Международная, 10 (Крокус Сити)', ''),
    'Москвариум на ВДНХ': ('ВДНХ, пр-т Мира, 119, стр. 23', 'ВДНХ'),
    'Брусницын, лазерный каток': ('Кожевенная линия, 30', ''),
    'Vokzal 1853': ('наб. Обводного канала, 118', ''),
    'Ярмарка на Манежной': ('Манежная площадь', 'Охотный ряд'),
    'Дворцовая площадь': ('Дворцовая площадь', 'Адмиралтейская / Невский проспект'),
    'Рождественская ярмарка, Манежная': ('Манежная площадь (Санкт-Петербург)', 'Гостиный двор / Невский проспект'),
    'Петропавловская крепость': ('Заячий остров', 'Горьковская / Спортивная'),
    'Ботанический сад Петра Великого': ('ул. Профессора Попова, 2', 'Петроградская / Аптекарский остров'),
    'Кронштадт, «Остров фортов»': ('Кронштадт, парк «Остров фортов»', ''),
    'Охта Парк, «Лесной каток»': ('Охта Парк, Ленинградская область (уточняйте на сайте)', ''),
    'Квиз, плиз!': ('несколько баров центра', ''),
    'ИнноПарк ВДНХ': ('ВДНХ (павильон уточняйте на сайте)', 'ВДНХ'),
    'Standup Store': ('адрес уточняйте на афише клуба', ''),
    'Анненкирхе, «Рождество»': ('Кирочная ул., 8, лит. В', ''),
}
BAD = ('Standup', 'Клуб')
out = []
for line in open(places_fn, encoding='utf8'):
    line = line.strip()
    if not line or line.startswith('#'): continue
    c, key, name, tag, who, mood, band, time, ind, dist, site, note, price = line.split('|')
    a = m = ''
    for r in src[c]:
        if key in r['name']:
            a = re.sub(r'\s*\[.*$', '', r['f'].get('Адрес', '')).strip()
            m = re.sub(r'\s*\[.*$', '', r['f'].get('Метро', '')).strip()
            break
    if name in ADDR:
        a, m2 = ADDR[name]; m = m2 or m
    if ' | Метро:' in a: a, m0 = a.split(' | Метро:', 1); m = m or m0.strip()
    m = re.sub(r'^Метро:\s*', '', m); m = re.split(r'[;(,]', m)[0].strip(); a = re.sub(r'\s*\(.*?$', '', a) if len(a) > 60 else a
    if not a: a = 'Адрес: уточняйте на сайте'
    out.append(dict(id=f'{c}{len(out)+1}', c=c, n=name, t=tag, w=who.split(','), mo=mood.split(','), b=int(band), tm=time,
                    i=ind, d=dist, s=site, a=a, m=m, h=note, p=price, v=1 if site else 0))
open(os.path.join(ROOT, 'js', 'kuda-data.js'), 'w', encoding='utf8').write(
    '// Сгенерировано _tools/build_kuda.py. Данные из файла Насти; проверенное отмечено ссылкой на сайт, остальное «уточняйте».\n'
    'window.KUDA_PLACES=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(len(out), 'places')
