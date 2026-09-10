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

    for basura in sopa(["script", "style"]):
        basura.decompose()

    lineas = [l.strip() for l in sopa.get_text("\n", strip=True).split("\n") if l.strip()]

    with open("datos/explorar/cabecera.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(lineas[:180]))

    print("Guardado datos/explorar/cabecera.txt")

    # Buscamos donde aparece el minuto de gol, tipo 34'
    import re
    for i, l in enumerate(lineas[:300]):
        if re.fullmatch(r"\d{1,3}'", l) or "'" in l and len(l) < 8:
            print(f"  linea {i}: {l}   (contexto: {lineas[max(0,i-2):i+2]})")


if __name__ == "__main__":
    main()
