import csv
import os
import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/laliga/calendario"
SALIDA = "datos/partidos.csv"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
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

        href = a["href"]
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = "https://www.futbolfantasy.com" + href

        vistos.add(m.group(1))
        filas.append([m.group(1), int(mj.group(1)), local, visitante,
                      1 if terminado else 0, resultado, cuando, href])

    filas.sort(key=lambda f: (f[1], int(f[0])))

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "jornada", "local", "visitante", "terminado", "resultado", "cuando", "url"])
        w.writerows(filas)

    print(f"Partidos: {len(filas)}  terminados: {sum(f[4] for f in filas)}")


if __name__ == "__main__":
    main()
