import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    print(f"HTTP {r.status_code}\n")
    sopa = BeautifulSoup(r.text, "html.parser")

    # --- 1. FECHA Y HORA
    for basura in sopa(["script", "style"]):
        basura.decompose()
    lineas = [l.strip() for l in sopa.get_text("\n", strip=True).split("\n") if l.strip()]

    print("=== LINEAS CON FECHA")
    for i, l in enumerate(lineas[:160]):
        if re.search(r"\d{1,2} de \w+ del \d{4}|\d{1,2}[/-]\d{1,2}|\d{1,2}:\d{2}", l):
            print(f"  {i}: {l[:90]}")

    print("\n=== ATRIBUTOS CON PINTA DE FECHA")
    vistos = set()
    for tag in sopa.find_all(True):
        for k, v in tag.attrs.items():
            if k.startswith("data-") and re.search(r"fecha|date|hora|time|timestamp", k):
                if k not in vistos:
                    vistos.add(k)
                    print(f"  {k} = {str(v)[:60]}")

    # --- 2. NOMBRES REALES DE EVENTOS
    print("\n=== EVENTOS EN EL BLOQUE LALIGA-FANTASY")
    nombres = {}
    for d in sopa.select("div.desg.laliga-fantasy div.estadistica"):
        t = d.get_text(" ", strip=True)
        limpio = re.sub(r"^-?\d+\s+", "", t)
        limpio = re.sub(r"\s*-?[\d.]+\s*p$", "", limpio).strip()
        if limpio:
            nombres[limpio] = nombres.get(limpio, 0) + 1
    for n, c in sorted(nombres.items(), key=lambda x: -x[1]):
        print(f"  {c:4}  {n}")

    print("\n=== EVENTOS EN OTROS BLOQUES (por si la asistencia esta ahi)")
    otros = {}
    for d in sopa.select("div.desg div.estadistica"):
        t = d.get_text(" ", strip=True)
        limpio = re.sub(r"^-?\d+\s+", "", t)
        limpio = re.sub(r"\s*-?[\d.]+\s*p$", "", limpio).strip()
        if limpio and "sist" not in limpio.lower():
            otros[limpio] = otros.get(limpio, 0) + 1
    for n, c in sorted(otros.items(), key=lambda x: -x[1])[:40]:
        print(f"  {c:4}  {n}")

    # --- 3. POSICION Y ENLACE DEL JUGADOR EN LA TABLA DE STATS
    print("\n=== PRIMERA FILA DE JUGADOR EN stats-local")
    tabla = sopa.select_one("div.stats-local table.tablestats")
    if tabla:
        for fila in tabla.select("tr"):
            if "desglose" in (fila.get("class") or []):
                continue
            celdas = [c.get_text(" ", strip=True) for c in fila.select("th, td")]
            if not celdas or not celdas[0] or celdas[0] in ("Titulares", "Suplentes"):
                continue
            print(f"  celdas: {celdas[:8]}")
            print(f"  atributos tr: {sorted(fila.attrs.keys())}")
            for a in fila.select("a[href]")[:3]:
                print(f"    enlace: {a['href'][-50:]}  clases={a.get('class')}")
                pos = [k for k in a.attrs if "posicion" in k]
                if pos:
                    print(f"    posicion: {a.attrs[pos[0]]}")
            break


if __name__ == "__main__":
    main()
