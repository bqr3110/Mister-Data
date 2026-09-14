import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    claves = {}
    for tag in sopa.find_all(True):
        for attr in tag.attrs:
            if attr.startswith("data-"):
                claves.setdefault(attr, str(tag.attrs[attr])[:40])

    print(f"Atributos data- distintos: {len(claves)}\n")
    for k, v in sorted(claves.items()):
        print(f"  {k} = {v}")


if __name__ == "__main__":
    main()
