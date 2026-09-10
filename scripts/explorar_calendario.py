import csv
import os
import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/laliga/calendario"
SALIDA = "datos/partidos_urls.csv"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    print(f"HTTP {r.status_code}")
    if r.status_code != 200:
        return

    sopa = BeautifulSoup(r.text, "html.parser")

    encontrados = {}
    for a in sopa.select("a[href]"):
        href = a["href"]
        m = re.search(r"/partidos/(\d+)-([a-z0-9-]+)", href)
        if not m:
            continue
        id_partido = m.group(1)
        if id_partido in encontrados:
            continue
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = "https://www.futbolfantasy.com" + href
        encontrados[id_partido] = (m.group(2), href)

    print(f"Partidos encontrados: {len(encontrados)}")

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(["id", "slug", "url"])
        for id_partido, (slug, href) in sorted(encontrados.items(), key=lambda x: int(x[0])):
            escritor.writerow([id_partido, slug, href])

    for id_partido, (slug, href) in list(sorted(encontrados.items(), key=lambda x: int(x[0])))[:5]:
        print(f"  {id_partido}  {slug}")


if __name__ == "__main__":
    main()
