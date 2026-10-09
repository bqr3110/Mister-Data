"""Los partidos europeos de los equipos de Primera.

Para que no te pille por sorpresa que el Barça juegue miercoles y domingo:
cuando un equipo tiene Champions entre semana, el tecnico rota, y el que
rota no puntua. Es el mismo calendario de siempre, pero de otra competicion.

Va a un fichero aparte a proposito. En partidos.csv la jornada es la de
Liga y se usa para cruzar los puntos y las rachas; si aqui se metieran las
jornadas 1 a 8 de Champions, chocarian con las 1 a 8 de Liga y se liaria
todo. Asi que europa.csv solo alimenta el calendario de la ficha.
"""
import csv
import os
import re
import time
import requests
from bs4 import BeautifulSoup

SALIDA = "datos/europa.csv"

# La web publica una pagina por competicion, todas con el mismo molde. La
# Conference no la he encontrado: si algun dia aparece, basta con añadirla
# aqui; las que den 404 se saltan solas y se avisa por pantalla.
COMPETICIONES = {
    "Champions": "https://www.futbolfantasy.com/champions/calendario",
    "Europa League": "https://www.futbolfantasy.com/europa-league/calendario",
}

# Solo interesan los partidos de equipos de Primera: el resto del cuadro
# europeo no sale en ninguna ficha. Los nombres son los que usa esta web.
EQUIPOS = {
    "Alavés", "Athletic", "Atlético", "Barcelona", "Betis", "Celta",
    "Deportivo", "Elche", "Espanyol", "Getafe", "Levante", "Málaga",
    "Osasuna", "Racing", "Rayo", "Real Madrid", "Real Sociedad",
    "Sevilla", "Valencia", "Villarreal",
}


def procesar(competicion, url, cabeceras):
    r = requests.get(url, headers=cabeceras, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    filas, vistos = [], set()
    for a in sopa.select("a[href]"):
        m = re.search(r"/partidos/(\d+)-([a-z0-9-]+)", a["href"])
        if not m or m.group(1) in vistos:
            continue

        tooltip = a.get("data-tooltip") or ""
        texto = a.get_text(" ", strip=True)
        mj = re.search(r"Jornada (\d+)", texto)
        if not mj:
            continue

        terminado = "terminado" in (a.get("class") or [])
        if terminado:
            mt = re.match(r"^(.+?)\s+(\d+)-(\d+)\s+(.+)$", tooltip)
            if not mt:
                continue
            local, visitante = mt.group(1), mt.group(4)
            resultado = f"{mt.group(2)}-{mt.group(3)}"
            cuando = ""
        else:
            partes = tooltip.split(" - ")
            if len(partes) != 2:
                continue
            local, visitante = partes[0], partes[1]
            resultado = ""
            mc = re.search(r"(\w{3} \d{2}/\d{2}(?: \d{2}:\d{2}h)?)", texto)
            cuando = mc.group(1) if mc else ""

        if local not in EQUIPOS and visitante not in EQUIPOS:
            continue

        vistos.add(m.group(1))
        filas.append([competicion, m.group(1), int(mj.group(1)), local, visitante,
                      1 if terminado else 0, resultado, cuando])
    return filas


def main():
    cabeceras = {"User-Agent": "Mister-Data/1.0 (+https://github.com/bqr3110/Mister-Data; proyecto personal, no comercial)"}

    todas = []
    for nombre, url in COMPETICIONES.items():
        try:
            filas = procesar(nombre, url, cabeceras)
            equipos = sorted({e for f in filas for e in (f[3], f[4]) if e in EQUIPOS})
            print(f"  {nombre}: {len(filas)} partidos · {', '.join(equipos) or 'ningun equipo de Primera'}")
            todas.extend(filas)
        except requests.HTTPError as e:
            print(f"  {nombre}: no esta publicada ({e.response.status_code}), la salto")
        except Exception as e:
            print(f"  ERROR {nombre}: {e}")
        time.sleep(1)

    if not todas:
        print("No he sacado ningun partido europeo. Dejo el fichero como estaba.")
        return

    todas.sort(key=lambda f: (f[0], f[2], int(f[1])))
    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["competicion", "id", "jornada", "local", "visitante",
                    "terminado", "resultado", "cuando"])
        w.writerows(todas)

    print(f"\nTotal: {len(todas)} partidos  ·  por jugar: {sum(1 for f in todas if not f[5])}")


if __name__ == "__main__":
    main()
