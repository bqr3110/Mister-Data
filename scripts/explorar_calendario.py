import csv
import os
import time
import requests
from bs4 import BeautifulSoup

BASE = "https://futbolweb.net/calendario-laliga-2026-2027/jornada/"
SALIDA = "datos/calendario.csv"

TRADUCE = {
    "Atl. Madrid": "Atlético",
    "Dépor": "Deportivo",
}

EQUIPOS = [
    "Real Madrid", "Real Sociedad", "Athletic", "Atlético", "Barcelona",
    "Betis", "Celta", "Deportivo", "Elche", "Espanyol", "Getafe",
    "Levante", "Málaga", "Osasuna", "Racing", "Rayo", "Sevilla",
    "Valencia", "Villarreal", "Alavés",
]


def limpiar(nombre):
    return TRADUCE.get(nombre, nombre)


def jornada(numero, cabeceras):
    r = requests.get(BASE + str(numero), headers=cabeceras, timeout=30)
    r.raise_for_status()

    sopa = BeautifulSoup(r.text, "html.parser")
    for basura in sopa(["script", "style"]):
        basura.decompose()

    lineas = [l.strip() for l in sopa.get_text("\n", strip=True).split("\n") if l.strip()]

    partidos = []
    for i, linea in enumerate(lineas):
        if linea != "vs":
            continue
        if i == 0 or i + 1 >= len(lineas):
            continue
        local = limpiar(lineas[i - 1])
        visitante = limpiar(lineas[i + 1])
        if local in EQUIPOS and visitante in EQUIPOS:
            partidos.append([numero, local, visitante])

    return partidos


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    todos = []

    for n in range(1, 39):
        try:
            partidos = jornada(n, cabeceras)
            print(f"J{n}: {len(partidos)} partidos")
            todos.extend(partidos)
        except Exception as e:
            print(f"J{n}: ERROR {e}")
        time.sleep(1)

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        escritor.writerow(["jornada", "local", "visitante"])
        escritor.writerows(todos)

    print(f"Total: {len(todos)} partidos (esperados 380)")


if __name__ == "__main__":
    main()
