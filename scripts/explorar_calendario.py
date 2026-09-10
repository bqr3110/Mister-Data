import re
from collections import Counter
from bs4 import BeautifulSoup

ENTRADA = "datos/puntos_ultimo.html"


def main():
    with open(ENTRADA, encoding="utf-8") as f:
        sopa = BeautifulSoup(f.read(), "html.parser")

    enlaces = [a["href"] for a in sopa.select("a[href]")]
    print(f"Enlaces totales: {len(enlaces)}\n")

    patrones = Counter()
    for h in enlaces:
        limpio = re.sub(r"\d+", "N", h)
        limpio = re.sub(r"/[a-z0-9-]{6,}$", "/SLUG", limpio)
        patrones[limpio] += 1

    print("PATRONES DE URL MAS FRECUENTES")
    for patron, veces in patrones.most_common(25):
        print(f"  {veces:5}  {patron}")

    print("\nEJEMPLOS CON 'jugador' O 'player'")
    ejemplos = [h for h in enlaces if "jugador" in h or "player" in h]
    for h in sorted(set(ejemplos))[:10]:
        print(f"  {h}")


if __name__ == "__main__":
    main()
