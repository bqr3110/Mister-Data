import csv
import os
import requests
from bs4 import BeautifulSoup

URLS = {
    "cal_1": "https://www.futbolfantasy.com/laliga/calendario",
    "cal_2": "https://www.futbolfantasy.com/laliga/calendario/2027",
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

            with open(f"datos/explorar/{nombre}.html", "w", encoding="utf-8") as f:
                f.write(r.text)

            sopa = BeautifulSoup(r.text, "html.parser")
            filas = []
            for fila in sopa.select("tr"):
                celdas = [c.get_text(" ", strip=True) for c in fila.select("td")]
                if celdas:
                    filas.append(celdas)

            print(f"  filas en tr/td: {len(filas)}")
            with open(f"datos/explorar/{nombre}.csv", "w", newline="", encoding="utf-8") as f:
                csv.writer(f).writerows(filas[:25])

            texto = sopa.get_text(" ", strip=True)
            with open(f"datos/explorar/{nombre}_texto.txt", "w", encoding="utf-8") as f:
                f.write(texto[:4000])

        except Exception as e:
            print(f"{nombre}: ERROR {e}")


if __name__ == "__main__":
    main()
