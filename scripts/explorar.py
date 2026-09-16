import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/laliga/calendario"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    print(f"HTTP {r.status_code}\n")
    sopa = BeautifulSoup(r.text, "html.parser")

    enlaces = [a for a in sopa.select("a[href]") if re.search(r"/partidos/(\d+)-", a["href"])]
    print(f"Enlaces de partido: {len(enlaces)}\n")

    for a in enlaces[:4]:
        print("=" * 60)
        print(f"href: {a['href'][-40:]}")
        print(f"clases: {a.get('class')}")
        print(f"atributos: {sorted(a.attrs.keys())}")
        print(f"texto del enlace: {a.get_text(' ', strip=True)[:80]}")

        nodo = a
        for nivel in range(4):
            nodo = nodo.parent
            if nodo is None:
                break
            txt = nodo.get_text(" ", strip=True)[:110]
            print(f"  nivel {nivel}: <{nodo.name}> class={nodo.get('class')}")
            print(f"     texto: {txt}")
            datos = {k: v for k, v in nodo.attrs.items() if k.startswith("data-")}
            if datos:
                print(f"     data: {list(datos.items())[:4]}")


if __name__ == "__main__":
    main()
