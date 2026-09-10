import csv
import os
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    print(f"HTTP {r.status_code}")
    if r.status_code != 200:
        return

    os.makedirs("datos/explorar", exist_ok=True)
    sopa = BeautifulSoup(r.text, "html.parser")

    for i, tabla in enumerate(sopa.select("table")):
        filas = []
        for fila in tabla.select("tr"):
            celdas = [c.get_text(" ", strip=True) for c in fila.select("th, td")]
            if celdas:
                filas.append(celdas)

        ancho = max((len(f) for f in filas), default=0)
        print(f"tabla {i}: {len(filas)} filas, hasta {ancho} columnas")

        with open(f"datos/explorar/tabla_{i}.csv", "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows(filas[:6])


if __name__ == "__main__":
    main()
