import csv
import os
import re
import time
import requests
from bs4 import BeautifulSoup

ENTRADA = "datos/partidos_urls.csv"
SALIDA = "datos/eventos.csv"

ID_MIN, ID_MAX = 22421, 22829   # rango de LaLiga; fuera de ahi son otras competiciones

INTERESAN = ["Goles", "Asistencias", "Minutos jugados",
             "Tarjetas amarillas", "Tarjetas rojas", "Goles en contra"]


def partes_evento(texto):
    t = texto.strip()
    if not t:
        return None

    m = re.search(r"(-?[\d.]+)\s*p$", t)
    puntos = float(m.group(1)) if m else None
    if m:
        t = t[: m.start()].strip()

    m2 = re.match(r"^(-?\d+)\s+(.*)$", t)
    if m2:
        return float(m2.group(1)), m2.group(2).strip(), puntos
    return None, t, puntos


def procesar(url, cabeceras):
    r = requests.get(url, headers=cabeceras, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    jornada = None
    for l in sopa.get_text("\n", strip=True).split("\n")[:150]:
        m = re.search(r"Jornada (\d+)", l)
        if m:
            jornada = int(m.group(1))
            break

    filas = []
    for lado in ["stats-local", "stats-visitante"]:
        tabla = sopa.select_one(f"div.{lado} table.tablestats")
        if tabla is None:
            continue

        nombre, id_jug = None, ""
        for fila in tabla.select("tr"):
            clases = fila.get("class") or []

            if "desglose" not in clases:
                celdas = [c.get_text(" ", strip=True) for c in fila.select("th, td")]
                if celdas and celdas[0] and celdas[0] not in ("Titulares", "Suplentes"):
                    nombre = re.sub(r"\s*\d{1,3}'\s*$", "", celdas[0]).strip()
                    enlace = fila.select_one("a[href*='/jugadores/']")
                    id_jug = enlace["href"].split("/")[-1] if enlace else ""
                continue

            if not nombre:
                continue

            bloque = fila.select_one("div.desg.laliga-fantasy")
            if bloque is None:
                continue

            for e in bloque.select("div.estadistica"):
                p = partes_evento(e.get_text(" ", strip=True))
                if not p:
                    continue
                cantidad, evento, puntos = p
                if evento not in INTERESAN:
                    continue
                filas.append([jornada, lado.replace("stats-", ""), nombre,
                              id_jug, evento, cantidad, puntos, url.split("/")[-1]])

    return filas


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}

    with open(ENTRADA, encoding="utf-8") as f:
        urls = []
        for fila in csv.DictReader(f):
            if ID_MIN <= int(fila["id"]) <= ID_MAX:
                urls.append(fila["url"])

    print(f"Partidos de LaLiga a procesar: {len(urls)}")

    todas = []
    for i, url in enumerate(urls):
        try:
            filas = procesar(url, cabeceras)
            if filas:
                print(f"{i+1}/{len(urls)} {url.split('/')[-1]}: {len(filas)} eventos")
            todas.extend(filas)
        except Exception as e:
            print(f"ERROR en {url}: {e}")
        time.sleep(1)

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["jornada", "lado", "jugador", "slug", "evento", "cantidad", "puntos_lf", "partido"])
        w.writerows(todas)

    print(f"\nTotal: {len(todas)} eventos")


if __name__ == "__main__":
    main()
