import csv
import os
import re
from collections import defaultdict
from datetime import date
import requests
from bs4 import BeautifulSoup

FUENTES = {
    "mixto2": "https://www.futbolfantasy.com/analytics/mister-mixto-2/puntos/2027",
    "mixto": "https://www.futbolfantasy.com/analytics/mister-mixto/puntos",
    "cronistas_md": "https://www.futbolfantasy.com/analytics/mister-cronistas-md/puntos",
    "cronistas_marca": "https://www.futbolfantasy.com/analytics/cronistas-marca/puntos",
}

PARTIDOS = "datos/partidos.csv"
EVENTOS = "datos/eventos.csv"
SALIDA = "datos/puntos.csv"
CABECERA = ["fuente", "jornada", "jugador", "equipo", "puntos", "jugo", "capturado"]

EQUIPOS = [
    "Real Madrid", "Real Sociedad", "Athletic", "Atlético", "Barcelona",
    "Betis", "Celta", "Deportivo", "Elche", "Espanyol", "Getafe",
    "Levante", "Málaga", "Osasuna", "Racing", "Rayo", "Sevilla",
    "Valencia", "Villarreal", "Alavés",
]


def numero(t):
    t = t.strip()
    if t in ("", "-", "—"):
        return None
    try:
        return float(t)
    except ValueError:
        return None


def orden_por_equipo():
    """Para cada equipo, sus jornadas jugadas ordenadas por fecha REAL."""
    fechas = {}
    if os.path.exists(EVENTOS):
        for e in csv.DictReader(open(EVENTOS, encoding="utf-8")):
            if e.get("fecha"):
                fechas[e["partido"]] = e["fecha"]

    jugados = defaultdict(list)
    for p in csv.DictReader(open(PARTIDOS, encoding="utf-8")):
        if p["terminado"] != "1":
            continue
        clave = fechas.get(p["id"], "9999")
        for eq in (p["local"], p["visitante"]):
            jugados[eq].append((clave, int(p["id"]), int(p["jornada"])))

    orden = {}
    for eq, lista in jugados.items():
        lista.sort()
        orden[eq] = [j for _, _, j in lista]
    return orden


def procesar(nombre_fuente, url, cabeceras, orden, hoy):
    r = requests.get(url, headers=cabeceras, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    filas = []
    for fila in sopa.select("tr"):
        celdas = [c.get_text(" ", strip=True) for c in fila.select("td")]
        if len(celdas) < 6:
            continue

        texto = celdas[0]
        equipo = None
        for eq in EQUIPOS:
            if texto.endswith(" " + eq):
                equipo = eq
                jugador = texto[: -len(eq)].strip()
                break
        if equipo is None:
            continue

        racha = celdas[2].split()
        if not racha:
            continue

        # la racha va de lo mas reciente a lo mas antiguo
        crono = list(reversed(orden.get(equipo, [])))
        for i, valor in enumerate(racha):
            if i >= len(crono):
                break
            puntos = numero(valor)
            filas.append([nombre_fuente, crono[i], jugador, equipo,
                          puntos, 0 if puntos is None else 1, hoy])

    return filas


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    hoy = date.today().isoformat()
    orden = orden_por_equipo()

    print("Orden cronologico detectado:")
    for eq in ["Real Madrid", "Real Sociedad", "Espanyol", "Alavés"]:
        print(f"  {eq}: {orden.get(eq)}")
    print()

    todas = []
    for nombre, url in FUENTES.items():
        try:
            filas = procesar(nombre, url, cabeceras, orden, hoy)
            print(f"{nombre}: {len(filas)} filas")
            todas.extend(filas)
        except Exception as e:
            print(f"{nombre}: ERROR {e}")

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CABECERA)
        w.writerows(todas)

    print(f"\nTotal: {len(todas)} filas")


if __name__ == "__main__":
    main()
