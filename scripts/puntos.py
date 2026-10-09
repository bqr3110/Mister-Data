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
    # El Mister usa los cronistas de AS, no los de MD, y esta web no publica
    # esa tabla con ese nombre. Pero si publica las picas del cronista de AS
    # en la pagina de Biwenger, y en Mister la pica vale lo mismo: 0 picas
    # son -2 puntos, 1 son 2, 2 son 6, 3 son 10 y 4 son 14. Comprobado contra
    # el Mister en tres casos, mirando la ficha del jugador:
    #   Zaid Romero  (Getafe)   J6: dos picas -> 6 puntos
    #   Inigo Vicente (Racing)  J6: una pica  -> 2 puntos
    #   Nico Williams (Athletic) J5: dos picas -> 6 puntos
    # Los tres cuadran con lo que da esta tabla.
    "cronistas_as": "https://www.futbolfantasy.com/analytics/modo-picas/puntos",
}

PARTIDOS = "datos/partidos.csv"
EVENTOS = "datos/eventos.csv"
SALIDA = "datos/puntos.csv"
TITULARIDAD = "datos/titularidad.csv"
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


def procesar(nombre_fuente, url, cabeceras, orden, hoy, titulares=None):
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

        # La columna "Prox. rival" trae la probabilidad de ser titular en la
        # siguiente jornada: "J8 50%", o con una casita si juega en casa. Es
        # el mismo numero en las cinco tablas, asi que se apunta una sola vez
        # y no cuesta ni una peticion de mas.
        if titulares is not None and len(celdas) > 5:
            m = re.search(r"J(\d{1,2}).*?(\d{1,3})\s*%", celdas[5])
            if m:
                titulares[(jugador, equipo)] = (int(m.group(1)), int(m.group(2)))

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
    cabeceras = {"User-Agent": "Mister-Data/1.0 (+https://github.com/bqr3110/Mister-Data; proyecto personal, no comercial)"}
    hoy = date.today().isoformat()
    orden = orden_por_equipo()

    print("Orden cronologico detectado:")
    for eq in ["Real Madrid", "Real Sociedad", "Espanyol", "Alavés"]:
        print(f"  {eq}: {orden.get(eq)}")
    print()

    todas = []
    titulares = {}
    for nombre, url in FUENTES.items():
        try:
            filas = procesar(nombre, url, cabeceras, orden, hoy, titulares)
            print(f"{nombre}: {len(filas)} filas")
            todas.extend(filas)
        except Exception as e:
            print(f"{nombre}: ERROR {e}")

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CABECERA)
        w.writerows(todas)

    if titulares:
        with open(TITULARIDAD, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["jugador", "equipo", "jornada", "probabilidad", "capturado"])
            for (jug, eq), (jor, pct) in sorted(titulares.items()):
                w.writerow([jug, eq, jor, pct, hoy])
        print(f"probabilidad de ser titular: {len(titulares)} jugadores")

    print(f"\nTotal: {len(todas)} filas")


if __name__ == "__main__":
    main()
