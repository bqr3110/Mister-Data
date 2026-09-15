import requests
from bs4 import BeautifulSoup

PARTIDOS = {
    "J4_athletic_atletico": "https://www.futbolfantasy.com/partidos/22453-athletic-atletico",
    "J1_alaves_getafe": "https://www.futbolfantasy.com/partidos/22421-alaves-getafe",
}


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}

    for nombre, url in PARTIDOS.items():
        r = requests.get(url, headers=cabeceras, timeout=30)
        print(f"\n===== {nombre}  HTTP {r.status_code}")
        if r.status_code != 200:
            continue

        sopa = BeautifulSoup(r.text, "html.parser")
        tags = [t for t in sopa.select("a.camiseta") if "data-totalgoles" in t.attrs]
        print(f"jugadores: {len(tags)}")

        if tags:
            t = tags[0]
            nom = next((im["alt"] for im in t.select("img") if im.get("alt")), "?")
            print(f"PRIMER JUGADOR: {nom}")
            print("TODOS SUS ATRIBUTOS:")
            for k in sorted(t.attrs):
                print(f"   {k} = {str(t.attrs[k])[:50]}")
            print("ATRIBUTOS DEL PADRE:")
            for k in sorted(t.parent.attrs):
                print(f"   {k} = {str(t.parent.attrs[k])[:50]}")


if __name__ == "__main__":
    main()
