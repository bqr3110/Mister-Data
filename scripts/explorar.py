import re
import requests
from bs4 import BeautifulSoup

CANDIDATAS = [
    "https://www.futbolfantasy.com/analytics/mister-sofascore/puntos/2027",
    "https://www.futbolfantasy.com/analytics/mister-sofascore",
    "https://www.futbolfantasy.com/analytics/biwenger-sofascore/puntos",
]

PARTIDO = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cab = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}

    print("=== SOFASCORE: PROBANDO URLS")
    for u in CANDIDATAS:
        try:
            r = requests.get(u, headers=cab, timeout=30)
            print(f"  {r.status_code}  {u}")
        except Exception as e:
            print(f"  ERR  {u}  {e}")

    print("\n=== ENLACES A OTROS SISTEMAS DESDE LA TABLA DE MIXTO 2")
    r = requests.get("https://www.futbolfantasy.com/analytics/mister-mixto-2/puntos/2027",
                     headers=cab, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")
    vistos = set()
    for a in sopa.select("a[href]"):
        h = a["href"]
        if "/puntos" in h or "sofascore" in h.lower():
            if h not in vistos:
                vistos.add(h)
                print(f"  {h[-70:]}   ({a.get_text(' ', strip=True)[:30]})")
    for o in sopa.select("option"):
        v = o.get("value") or ""
        if "sofa" in (v + o.get_text()).lower():
            print(f"  OPTION value={v[:60]}  texto={o.get_text(' ', strip=True)[:40]}")

    print("\n=== POSICION: DONDE ESTA EN LA PAGINA DE PARTIDO")
    r2 = requests.get(PARTIDO, headers=cab, timeout=30)
    sopa2 = BeautifulSoup(r2.text, "html.parser")

    total = 0
    con_pos = 0
    ejemplos = []
    for tag in sopa2.find_all(True):
        claves = [k for k in tag.attrs if "posicion" in k]
        if not claves:
            continue
        total += 1
        v = tag.attrs.get("data-posicion-mister-mixto-2")
        if v:
            con_pos += 1
        if len(ejemplos) < 4:
            nom = next((im.get("alt") for im in tag.select("img") if im.get("alt")), "?")
            ejemplos.append((tag.name, tag.get("class"), nom, claves[:3], v))
    print(f"  elementos con algun atributo de posicion: {total}, con mister-mixto-2: {con_pos}")
    for e in ejemplos:
        print(f"    <{e[0]}> class={e[1]} nombre={e[2]}")
        print(f"       claves={e[3]}  mixto2={e[4]}")

    print("\n=== a.camiseta: CUANTOS Y QUE ATRIBUTOS DE POSICION TIENEN")
    cams = sopa2.select("a.camiseta")
    print(f"  total a.camiseta: {len(cams)}")
    if cams:
        c = cams[0]
        print(f"  primero -> {[k for k in sorted(c.attrs) if 'posicion' in k][:5]}")
        print(f"  padre class -> {c.parent.get('class')}")


if __name__ == "__main__":
    main()
