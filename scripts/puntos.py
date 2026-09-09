import csv
import os
from datetime import date
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/analytics/mister-mixto-2/puntos/2027"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    respuesta = requests.get(URL, headers=cabeceras, timeout=30)
    respuesta.raise_for_status()

    os.makedirs("datos", exist_ok=True)
    with open("datos/puntos_ultimo.html", "w", encoding="utf-8") as f:
        f.write(respuesta.text)

    sopa = BeautifulSoup(respuesta.text, "html.parser")
    hoy = date.today().isoformat()

    filas = []
    for fila in sopa.select("tr"):
        celdas = [c.get_text(" ", strip=True) for c in fila.select("td")]
        if len(celdas) < 4:
            continue
        filas.append([hoy] + celdas)

    print(f"Filas detectadas: {len(filas)}")

    with open("datos/puntos_muestra.csv", "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        for fila in filas[:20]:
            escritor.writerow(fila)

    print("Guardado datos/puntos_muestra.csv")


if __name__ == "__main__":
    main()
