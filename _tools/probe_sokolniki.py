# Проверка альтернативных официальных адресов: Сокольники и СПб-океанариум.
import urllib.request, ssl, re

ctx = ssl._create_unverified_context()
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'}

def probe(u, timeout=20):
    try:
        r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=timeout, context=ctx)
        html = r.read(200000).decode('utf8', 'ignore')
        t = re.search(r'<title[^>]*>(.*?)</title>', html, re.S)
        return r.status, r.geturl(), (t.group(1).strip()[:90] if t else '')
    except Exception as e:
        return 'ERR', str(e)[:80], ''

print('--- океанариум СПб ---')
for u in ['https://okeanarium.spb.ru',
          'https://www.planeta-neptun.ru',
          'https://kuda-spb.ru/place/okeanarium/',
          'https://spbaquarium.ru']:
    print(u, '->', probe(u))

print('--- Сокольники ---')
for u in ['https://www.sokolniki.com',
          'https://sokolniki.mos.ru',
          'https://www.mos.ru/city/projects/parks/']:
    print(u, '->', probe(u, 30))
