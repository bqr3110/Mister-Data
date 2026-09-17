import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cab = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cab, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    print("=== NOTAS POR JUGADOR EN stats-local")
    tabla = sopa.select_one("div.stats-local table.tablestats")
    nombre = None
    for tr in tabla.select("tr"):
        if "desglose" not in (tr.get("class") or []):
            celdas = [c.get_text(" ", strip=True) for c in tr.select("th, td")]
            if celdas and celdas[0] and celdas[0] not in ("Titulares", "Suplentes"):
                nombre = celdas[0]
                print(f"\n  {nombre}")
                print(f"    celdas: {celdas[:9]}")
            continue
        if not nombre:
            continue
        for d in tr.select("div.desg"):
            sistema = " ".join(c for c in d.get("class", []) if c != "desg")
            txt = d.get_text(" ", strip=True)
            m = re.search(r"Nota[^:]*:\s*([\d.]+)", txt)
            if m:
                print(f"    [{sistema}] nota = {m.group(1)}")
        if nombre and nombre.startswith("Yuri"):
            break

    print("\n=== ATRIBUTOS CON PINTA DE NOTA / SOFASCORE")
    vistos = {}
    for tag in sopa.find_all(True):
        for k, v in tag.attrs.items():
            if k.startswith("data-") and re.search(r"nota|sofa|rating|valorac", k):
                if k not in vistos:
                    vistos[k] = str(v)[:40]
    for k, v in sorted(vistos.items()):
        print(f"  {k} = {v}")


if __name__ == "__main__":
    main()
