# Проверка ссылок «На сайт» раздела «Куда пойти»: каждая должна отвечать 200/3xx.
# Запуск: python -X utf8 _tools/check_kuda_links.py [--write]  (--write сохраняет код ответа в kuda_places.json)
import json, os, sys, ssl, urllib.request, concurrent.futures as cf
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'kuda_places.json')
places = json.load(open(SRC, encoding='utf8'))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE  # у части музеев цепочка сертификатов неполная


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None


def check(url):
    for method in ('HEAD', 'GET'):
        try:
            op = urllib.request.build_opener(NoRedirect, urllib.request.HTTPSHandler(context=ctx))
            r = op.open(urllib.request.Request(url, method=method, headers={'User-Agent': UA, 'Accept-Language': 'ru'}), timeout=25)
            return r.status
        except urllib.error.HTTPError as e:
            if e.code in (405, 403, 401) and method == 'HEAD': continue
            return e.code
        except Exception as e:
            if method == 'HEAD': continue
            return 0
    return 0


urls = sorted({p['url'] for p in places if p.get('url')})
with cf.ThreadPoolExecutor(12) as ex:
    res = dict(zip(urls, ex.map(check, urls)))
bad = {u: c for u, c in res.items() if not (200 <= c < 400)}
for u, c in sorted(res.items(), key=lambda x: x[1]):
    print(c, u)
print(f'\nВсего ссылок: {len(urls)}; 200/3xx: {len(urls) - len(bad)}; проблемных: {len(bad)}')
if '--write' in sys.argv:
    for p in places:
        if p.get('url'): p['url_status'] = res[p['url']]
    json.dump(places, open(SRC, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
sys.exit(1 if bad else 0)
