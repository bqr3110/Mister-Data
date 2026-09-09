import csv
import os
from datetime import date
import requests
from bs4 import BeautifulSoup

FUENTES = {
    "mister_cronistas_md": "https://www.futbolfantasy.com/analytics/mister-cronistas-md/puntos",
    "mister_mixto": "https://www.futbolfantasy.com/analytics/mister-mixto/puntos",
    "cronistas_as": "https://www.futbolfantasy.com/analytics/cronistas-as/puntos",
    "cronistas_marca": "https://www.futbolfantasy.com/analytics/cronistas-marca/puntos",
}


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    os.makedirs("datos/explorar", exist_ok=True)
    hoy = date.today().isoformat()

    for nombre, url in FUENTES.items():
        try:
            r = requests.get(url, headers=cabeceras, timeout=30)
            print(f"{nombre}: HTTP {r.status_code}")
            if r.status_code != 200:
                continue

            sopa = BeautifulSoup(r.text, "html.parser")
            filas = []
            for fila in sopa.select("tr"):
                celdas = [c.get_text(" ", strip=True) for c in fila.select("td")]
                if len(celdas) < 4:
                    continue
                filas.append([hoy] + celdas)

            print(f"  filas: {len(filas)}")
            with open(f"datos/explorar/{nombre}.csv", "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerows(filas[:10])

        except Exception as e:
            print(f"{nombre}: ERROR {e}")


if __name__ == "__main__":
    main()
