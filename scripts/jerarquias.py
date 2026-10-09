"""Que sitio ocupa cada jugador en su equipo, segun los analistas.

FutbolFantasy clasifica a la plantilla en cinco escalones, de mas a menos
peso: Clave, Importantes, Rotacion, Revulsivos y Reservas. Es la respuesta
a "este tio, ¿va a jugar?", que es justo lo que no se puede deducir de los
puntos: un jugador con buena media que ha pasado a Reservas no vuelve a
puntuar, y uno que sube a Clave empieza a hacerlo.

Una pagina por equipo, veinte en total. La jerarquia cambia con las
lesiones y las rachas, asi que se guarda con la fecha y el fichero se va
quedando como un histórico: asi se puede ver quien esta subiendo.
"""
import csv
import os
import re
import time
from datetime import date
import requests
from bs4 import BeautifulSoup

SALIDA = "datos/jerarquias.csv"
CABECERA = ["fecha", "equipo", "slug", "jugador", "nivel", "orden"]

# el slug de la web para cada equipo, tal y como lo llamamos nosotros
EQUIPOS = {
    "Alavés": "alaves", "Athletic": "athletic", "Atlético": "atletico",
    "Barcelona": "barcelona", "Betis": "betis", "Celta": "celta",
    "Deportivo": "deportivo", "Elche": "elche", "Espanyol": "espanyol",
    "Getafe": "getafe", "Levante": "levante", "Málaga": "malaga",
    "Osasuna": "osasuna", "Racing": "racing", "Rayo": "rayo-vallecano",
    "Real Madrid": "real-madrid", "Real Sociedad": "real-sociedad",
    "Sevilla": "sevilla", "Valencia": "valencia", "Villarreal": "villarreal",
}

URL = "https://www.futbolfantasy.com/laliga/equipos/{}/jerarquias"

# De mas a menos peso. El numero es lo que se guarda, para poder pedir "de
# Rotacion para arriba" con una sola comparacion.
#
# Son siete, no cinco: por encima de Clave hay un escalon llamado "Dios"
# (ahi estan Yamal y Raphinha) y por debajo de Reservas estan los
# "Descartes". Al principio solo mire la pagina del Athletic, que no tiene
# ninguno de los dos, y por eso 26 jugadores se quedaban sin jerarquia.
NIVELES = {
    "dios": 7,
    "clave": 6,
    "importantes": 5,
    "rotacion": 4,
    "revulsivos": 3,
    "reservas": 2,
    "descartes": 1,
}


def sin_tildes(t):
    t = (t or "").lower().strip()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u")):
        t = t.replace(a, b)
    return t


def nivel_de(texto):
    """El titulo del bloque: la primera palabra, antes del primer jugador."""
    t = sin_tildes(texto)
    for nombre, orden in NIVELES.items():
        if t.startswith(nombre):
            return nombre, orden
    return None, None


def slug_de_href(href):
    m = re.search(r"/jugadores/([a-z0-9\-]+)", href or "")
    return m.group(1) if m else ""


def procesar(equipo, slug, cabeceras):
    """Los cinco bloques de la pagina del equipo.

    Cada escalon es un <section class="mod lesionados ..."> cuyo texto
    empieza por el nombre del escalon. El nombre de la clase no significa
    nada aqui: la web reutiliza el mismo molde que para los lesionados.
    """
    r = requests.get(URL.format(slug), headers=cabeceras, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    filas = []
    hoy = date.today().isoformat()
    for sec in sopa.select("section.mod"):
        elementos = sec.select("div.elemento")
        if not elementos:
            continue
        nombre, orden = nivel_de(sec.get_text(" ", strip=True))
        if nombre is None:
            continue    # la seccion de arriba, que lleva la plantilla entera
        for el in elementos:
            a = el.select_one('a[href*="/jugadores/"]')
            if a is None:
                continue
            jug = slug_de_href(a.get("href", ""))
            if not jug:
                continue
            texto = el.get_text(" ", strip=True)
            # el nombre visible va justo detras de la foto
            visible = texto.split("Leer más")[0].strip()[:60]
            filas.append([hoy, equipo, jug, visible, nombre, orden])
    return filas


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}

    # lo ya guardado de otros dias se conserva; lo de hoy se reescribe
    hoy = date.today().isoformat()
    previas = []
    if os.path.exists(SALIDA):
        for f in csv.DictReader(open(SALIDA, encoding="utf-8")):
            if f.get("fecha") != hoy:
                previas.append([f.get(c, "") for c in CABECERA])

    nuevas = []
    for equipo, slug in EQUIPOS.items():
        try:
            f = procesar(equipo, slug, cabeceras)
            print(f"  {equipo:15} {len(f)} jugadores")
            nuevas.extend(f)
        except Exception as e:
            print(f"  ERROR {equipo}: {e}")
        time.sleep(1)

    if not nuevas:
        print("No he sacado ninguna jerarquia. Dejo el fichero como estaba.")
        return

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CABECERA)
        w.writerows(previas)
        w.writerows(nuevas)

    reparto = {}
    for x in nuevas:
        reparto[x[4]] = reparto.get(x[4], 0) + 1
    print(f"\nhoy: {len(nuevas)} jugadores  ·  " +
          "  ".join(f"{k}: {v}" for k, v in sorted(reparto.items())))
    print(f"total en el fichero: {len(previas) + len(nuevas)}")


if __name__ == "__main__":
    main()
