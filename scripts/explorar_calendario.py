import csv
import os
import requests
from bs4 import BeautifulSoup

URLS = {
    "stats_1": "https://www.futbolfantasy.com/analytics/laliga/estadisticas",
    "stats_2": "https://www.futbolfantasy.com/laliga/estadisticas/jugadores",
    "stats_3": "https://www.futbolfantasy.com/analytics/laliga/estadisticas-jugadores",
}


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    os.makedirs("datos/explorar", exist_ok=True)

    for nombre, url in URLS.items():
        try:
            r = requests.get(url, headers=cabeceras, timeout=30)
            print(f"{nombre}: HTTP {r.status_code} ({url})")
            if r.status_code != 200:
                continue

            sopa = BeautifulSoup(r.text, "html.parser")
            for basura in sopa(["script", "style"]):
                basura.decompose()

            filas = []
            for fila in sopa.select("tr"):
                celdas = [c.get_text(" ", strip=True) for c in fila.select("th, td")]
                if celdas:
                    filas.append(celdas)

            print(f"  filas: {len(filas)}")
            with open(f"datos/explorar/{nombre}.csv", "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerows(filas[:8])

        except Exception as e:
            print(f"{nombre}: ERROR {e}")


if __name__ == "__main__":
    main()
