import csv
import os
import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    print(f"HTTP {r.status_code}")
    if r.status_code != 200:
        return

    sopa = BeautifulSoup(r.text, "html.parser")
    for basura in sopa(["script", "style"]):
        basura.decompose()

    lineas = [l.strip() for l in sopa.get_text("\n", strip=True).split("\n") if l.strip()]

    # Jornada
    jornada = None
    for l in lineas[:120]:
        m = re.search(r"Jornada (\d+)", l)
        if m:
            jornada = int(m.group(1))
            break
    print(f"Jornada: {jornada}")

    # Goleadores: nombre seguido de (46')
    goles = []
    for i, l in enumerate(lineas[:140]):
        if re.fullmatch(r"\(\d{1,3}'?\)", l) and i > 0:
            goles.append((lineas[i - 1], l.strip("()'")))
    print(f"Goles detectados: {goles}")

    # Buscamos rastros de tarjetas en todo el texto
    print("\nRASTROS DE TARJETA:")
    for i, l in enumerate(lineas):
        if re.search(r"[Aa]marilla|[Rr]oja|[Tt]arjeta", l):
            print(f"  {i}: {l[:120]}")
            if i > 400:
                break


if __name__ == "__main__":
    main()
