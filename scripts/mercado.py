import csv
import os
from datetime import date
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/analytics/mister/mercado"
ACTUAL = "datos/mercado.csv"
CARPETA = "datos/historico"

EQUIPOS = [
    "Real Madrid", "Real Sociedad", "Athletic", "Atlético", "Barcelona",
    "Betis", "Celta", "Deportivo", "Elche", "Espanyol", "Getafe",
    "Levante", "Málaga", "Osasuna", "Racing", "Rayo", "Sevilla",
    "Valencia", "Villarreal", "Alavés",
]


def entero(t):
    t = t.replace(".", "").replace("€", "").replace("+", "").replace("\xa0", "").strip()
    if not t or t in ("-", "—"):
        return None
    try:
        return int(t)
    except ValueError:
        return None


def separa(texto):
    for eq in EQUIPOS:
        if texto.endswith(" " + eq):
            return texto[: -len(eq)].strip(), eq
    return None, None


def main():
    cab = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cab, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    hoy = date.today().isoformat()

    # lo que ya teniamos: nos quedamos con el ultimo valor conocido de cada jugador
    anterior = {}
    if os.path.exists(ACTUAL):
        for f in csv.DictReader(open(ACTUAL, encoding="utf-8")):
            if f["fecha"] != hoy:
                anterior[(f["jugador"], f["equipo"])] = (f["fecha"], f["valor"])
            elif f.get("valor_ayer"):
                anterior[(f["jugador"], f["equipo"])] = (f.get("fecha_ayer", ""), f["valor_ayer"])

    filas = []
    for fila in sopa.select("tr"):
        celdas = [c.get_text(" ", strip=True) for c in fila.select("td")]
        if len(celdas) < 7:
            continue

        jugador, equipo = separa(celdas[0])
        if not equipo:
            continue

        valor = None
        for c in celdas[1:]:
            trozos = c.split()
            if len(trozos) == 1:
                v = entero(trozos[0])
                if v is not None and abs(v) > 20000:
                    valor = v
                    break
        if valor is None:
            continue

        cambios = [entero(x) for x in celdas[1].split()]
        cambio_web = cambios[0] if cambios else None

        f_ayer, v_ayer = anterior.get((jugador, equipo), ("", ""))
        try:
            dif = valor - int(v_ayer)
        except (ValueError, TypeError):
            dif = None

        filas.append({
            "fecha": hoy, "jugador": jugador, "equipo": equipo, "valor": valor,
            "fecha_ayer": f_ayer, "valor_ayer": v_ayer,
            "cambio": dif if dif is not None else "",
            "cambio_web": cambio_web if cambio_web is not None else "",
        })

    if not filas:
        print("no se ha leido ningun jugador, no toco los ficheros")
        return

    os.makedirs("datos", exist_ok=True)
    os.makedirs(CARPETA, exist_ok=True)

    # 1) foto actual, se reescribe entera
    cols = ["fecha", "jugador", "equipo", "valor", "fecha_ayer", "valor_ayer", "cambio", "cambio_web"]
    with open(ACTUAL, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(filas)

    # 2) archivo del mes, una fila por jugador y dia
    mensual = os.path.join(CARPETA, f"mercado-{hoy[:7]}.csv")
    hechas = set()
    previas = []
    if os.path.exists(mensual):
        for f in csv.DictReader(open(mensual, encoding="utf-8")):
            previas.append([f["fecha"], f["jugador"], f["equipo"], f["valor"]])
            hechas.add((f["fecha"], f["jugador"], f["equipo"]))

    nuevas = [[x["fecha"], x["jugador"], x["equipo"], x["valor"]]
              for x in filas if (hoy, x["jugador"], x["equipo"]) not in hechas]

    with open(mensual, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["fecha", "jugador", "equipo", "valor"])
        w.writerows(previas + nuevas)

    print(f"jugadores leidos: {len(filas)}")
    print(f"anadidos al archivo del mes: {len(nuevas)}  (total {len(previas) + len(nuevas)})")


if __name__ == "__main__":
    main()
