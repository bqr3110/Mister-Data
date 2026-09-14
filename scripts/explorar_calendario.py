import csv
import os
import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"

CAMPOS = ["data-totalpartidosjugados", "data-totalgoles", "data-totalasistencias",
          "data-totalamarillas", "data-totalrojas", "data-edad"]


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    filas = []
    for tag in sopa.select("a.camiseta"):
        if "data-totalgoles" not in tag.attrs:
            continue

        padre = tag.parent
        clases = padre.get("class", [])
        id_jugador = next((c.replace("jugador_", "") for c in clases if c.startswith("jugador_")), "")

        nombre = ""
        for im in tag.select("img"):
            if im.get("alt"):
                nombre = im["alt"]
                break

        fila = {
            "id": id_jugador,
            "nombre": nombre,
            "href": tag.get("href", "")[-60:],
            "onceff": padre.get("data-onceff", ""),
        }
        for c in CAMPOS:
            fila[c.replace("data-total", "").replace("data-", "")] = tag.attrs.get(c, "")
        filas.append(fila)

    print(f"Jugadores: {len(filas)}")

    os.makedirs("datos/explorar", exist_ok=True)
    if filas:
        with open("datos/explorar/jugadores_partido.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(filas[0].keys()))
            w.writeheader()
            w.writerows(filas)

    for f in filas[:8]:
        print(f"  {f['id']:6} {f['nombre'][:20]:22} G{f['goles']} A{f['asistencias']} Am{f['amarillas']} R{f['rojas']}  {f['href'][-30:]}")


if __name__ == "__main__":
    main()
