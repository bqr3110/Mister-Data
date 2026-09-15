import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    objetivos = ["Minutos jugados", "Gol", "Tarjeta"]
    vistos = 0

    for tag in sopa.find_all(True):
        if tag.find_all(True):
            continue
        texto = tag.get_text(" ", strip=True)
        if not any(o in texto for o in objetivos):
            continue
        if len(texto) > 40:
            continue

        ancestro = tag
        id_jug = ""
        for _ in range(8):
            ancestro = ancestro.parent
            if ancestro is None:
                break
            clases = ancestro.get("class", []) or []
            enc = [c for c in clases if c.startswith("jugador_")]
            if enc:
                id_jug = enc[0]
                break

        print(f"[{id_jug or 'sin id'}] <{tag.name} class={tag.get('class')}> {texto}")
        vistos += 1
        if vistos > 40:
            break


if __name__ == "__main__":
    main()
