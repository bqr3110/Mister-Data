import os
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    print(f"HTTP {r.status_code}")
    if r.status_code != 200:
        return

    os.makedirs("datos/explorar", exist_ok=True)
    sopa = BeautifulSoup(r.text, "html.parser")

    for basura in sopa(["script", "style", "nav", "header", "footer"]):
        basura.decompose()

    texto = sopa.get_text("\n", strip=True)
    lineas = [l for l in texto.split("\n") if l.strip()]

    # Nos saltamos el menu, que ocupa las primeras lineas
    recorte = "\n".join(lineas[120:520])

    with open("datos/explorar/partido.txt", "w", encoding="utf-8") as f:
        f.write(recorte)

    print(f"Lineas totales: {len(lineas)}")
    print("Guardado datos/explorar/partido.txt")

    tablas = sopa.select("table")
    print(f"Tablas encontradas: {len(tablas)}")
    for i, t in enumerate(tablas[:6]):
        filas = t.select("tr")
        print(f"  tabla {i}: {len(filas)} filas")


if __name__ == "__main__":
    main()
