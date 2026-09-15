import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    tabla = sopa.select_one("div.stats-local table.tablestats")
    if tabla is None:
        print("no encuentro la tabla")
        return

    filas = tabla.select("tr")
    print(f"Filas: {len(filas)}\n")

    for fila in filas[:6]:
        clases = fila.get("class") or []
        if "desglose" in clases:
            print("   DESGLOSE:")
            for d in fila.select("div.desg"):
                sistema = " ".join(c for c in d.get("class", []) if c != "desg")
                eventos = [e.get_text(" ", strip=True) for e in d.select("div.estadistica")]
                print(f"     [{sistema}] {eventos}")
        else:
            celdas = [c.get_text(" ", strip=True) for c in fila.select("th, td")]
            print(f"FILA: {celdas[:6]}")
            enlace = fila.select_one("a[href*='/jugadores/']")
            if enlace:
                print(f"   jugador: {enlace['href'].split('/')[-1]}")


if __name__ == "__main__":
    main()
