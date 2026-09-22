"""Descarga los escudos de los equipos una sola vez y los deja en web/escudos/.

Se ejecuta a mano (Actions -> Escudos -> Run workflow), no cada dos horas:
los escudos no cambian. Solo hay que volver a pasarlo cuando cambien los
equipos de Primera, y entonces hay que anadir sus numeros aqui abajo.

El numero es el que usa FutbolFantasy en la cabecera de cada partido:
static.futbolfantasy.com/uploads/images/cabecera/hd/<numero>.png
"""

import os
import unicodedata
import requests

DESTINO = "web/escudos"

EQUIPOS = {
    "Athletic": 1,      "Atlético": 2,       "Barcelona": 3,
    "Betis": 4,         "Celta": 5,          "Deportivo": 6,
    "Espanyol": 7,      "Getafe": 8,         "Levante": 10,
    "Málaga": 11,       "Osasuna": 13,       "Rayo": 14,
    "Real Madrid": 15,  "Real Sociedad": 16, "Sevilla": 17,
    "Valencia": 18,     "Elche": 21,         "Villarreal": 22,
    "Alavés": 28,       "Racing": 42,
}

URL = "https://static.futbolfantasy.com/uploads/images/cabecera/hd/{}.png"


def slug(nombre):
    """Real Sociedad -> real-sociedad · Alavés -> alaves"""
    n = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    return n.lower().replace(" ", "-")


def main():
    os.makedirs(DESTINO, exist_ok=True)
    cab = {"User-Agent": "Mozilla/5.0"}
    hechos, fallos = 0, []

    for nombre, num in sorted(EQUIPOS.items()):
        ruta = os.path.join(DESTINO, slug(nombre) + ".png")
        try:
            r = requests.get(URL.format(num), headers=cab, timeout=20)
            r.raise_for_status()
            # una pagina de error tambien devuelve 200 en algunos sitios
            if not r.content.startswith(b"\x89PNG"):
                raise ValueError("no es un PNG")
            with open(ruta, "wb") as f:
                f.write(r.content)
            hechos += 1
            print(f"  {nombre:<15} -> {ruta}  ({len(r.content)//1024} KB)")
        except Exception as e:
            fallos.append(f"{nombre} ({num}): {e}")

    print(f"\nescudos guardados: {hechos} de {len(EQUIPOS)}")
    for f in fallos:
        print("  FALLO:", f)


if __name__ == "__main__":
    main()
