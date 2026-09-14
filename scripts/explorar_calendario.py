import csv
import os
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"

CAMPOS = [
    "data-tooltip", "data-posicion-mister-mixto-2", "data-valor",
    "data-totalpartidosjugados", "data-totalgoles", "data-totalasistencias",
    "data-totalamarillas", "data-totalrojas", "data-edad", "data-lesion",
    "data-probabilidad", "data-onceff",
]


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    print(f"HTTP {r.status_code}")
    sopa = BeautifulSoup(r.text, "html.parser")

    filas = []
    for tag in sopa.find_all(True):
        if "data-totalgoles" not in tag.attrs:
            continue
        fila = {c: tag.attrs.get(c, "") for c in CAMPOS}
        fila["texto"] = tag.get_text(" ", strip=True)[:40]
        filas.append(fila)

    print(f"Elementos con data-totalgoles: {len(filas)}")

    equipos = {}
    for f in filas:
        equipos[f["data-tooltip"]] = equipos.get(f["data-tooltip"], 0) + 1
    print(f"Equipos presentes: {equipos}")

    os.makedirs("datos/explorar", exist_ok=True)
    with open("datos/explorar/jugadores_partido.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=CAMPOS + ["texto"])
        w.writeheader()
        w.writerows(filas[:15])

    print("Guardado datos/explorar/jugadores_partido.csv")


if __name__ == "__main__":
    main()
