import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    bloques = sopa.select("div.estadistica")
    print(f"Bloques 'estadistica': {len(bloques)}\n")

    for b in bloques[:3]:
        print("=" * 60)
        print(f"TEXTO: {b.get_text(' ', strip=True)}")
        nodo = b
        for nivel in range(10):
            nodo = nodo.parent
            if nodo is None:
                break
            print(f"  nivel {nivel}: <{nodo.name}> class={nodo.get('class')} id={nodo.get('id')}")
            atrs = {k: v for k, v in nodo.attrs.items() if k.startswith("data-")}
            if atrs:
                print(f"     data: {list(atrs.items())[:5]}")


if __name__ == "__main__":
    main()
