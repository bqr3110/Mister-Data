import csv
import os
import re
from datetime import date
import requests
from bs4 import BeautifulSoup

FUENTES = {
    "mixto2": "https://www.futbolfantasy.com/analytics/mister-mixto-2/puntos/2027",
    "mixto": "https://www.futbolfantasy.com/analytics/mister-mixto/puntos",
    "cronistas_md": "https://www.futbolfantasy.com/analytics/mister-cronistas-md/puntos",
    "cronistas_marca": "https://www.futbolfantasy.com/analytics/cronistas-marca/puntos",
}

SALIDA = "datos/puntos.csv"
CABECERA = ["fuente", "jornada", "jugador", "equipo", "puntos", "jugo", "capturado"]


def numero(t):
    t = t.strip()
    if t in ("", "-", "—"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def procesar(nombre_fuente, url, cabeceras, hoy):
    r = requests.get(url, headers=cabeceras, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    filas = []
    for fila in sopa.select("tr"):
        celdas = [c.get_text(" ", strip=True) for c in fila.select("td")]
        if len(celdas) < 6:
            continue

        partes = celdas[0].split()
        if len(partes) < 2:
            continue
        equipo = partes[-1]
        jugador = " ".join(partes[:-1])

        racha = celdas[2].split()
        if not racha:
            continue

        m = re.search(r"J(\d+)", celdas[5])
        if not m:
            continue
        jornada_actual = int(m.group(1)) - 1

        # La racha va de la jornada mas reciente hacia atras
        for i, valor in enumerate(racha):
            jornada = jornada_actual - i
            if jornada < 1:
                continue
            puntos = numero(valor)
            filas.append([
                nombre_fuente,
                jornada,
                jugador,
                equipo,
                puntos,
                0 if puntos is None else 1,
                hoy,
            ])

    return filas


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    hoy = date.today().isoformat()
    todas = []

    for nombre, url in FUENTES.items():
        try:
            filas = procesar(nombre, url, cabeceras, hoy)
            print(f"{nombre}: {len(filas)} filas")
            todas.extend(filas)
        except Exception as e:
            print(f"{nombre}: ERROR {e}")

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(CABECERA)
        escritor.writerows(todas)

    print(f"Total: {len(todas)} filas en {SALIDA}")


if __name__ == "__main__":
    main()
