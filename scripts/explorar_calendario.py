import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    elementos = [t for t in sopa.find_all(True) if "data-totalgoles" in t.attrs]
    print(f"Elementos: {len(elementos)}\n")

    for tag in elementos[:3]:
        print("=" * 50)
        print(f"ETIQUETA: <{tag.name}> clases={tag.get('class')}")
        print(f"ATRIBUTOS: {sorted(tag.attrs.keys())}")

        padre = tag.parent
        print(f"\nPADRE: <{padre.name}> clases={padre.get('class')}")
        print(f"  texto padre: {padre.get_text(' ', strip=True)[:150]}")
        print(f"  atributos padre: {sorted(padre.attrs.keys())}")

        abuelo = padre.parent
        print(f"\nABUELO texto: {abuelo.get_text(' ', strip=True)[:200]}")

        imgs = tag.select("img")
        for im in imgs[:3]:
            print(f"  IMG alt={im.get('alt')} title={im.get('title')}")


if __name__ == "__main__":
    main()
