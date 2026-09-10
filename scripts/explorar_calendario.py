import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/partidos/22453-athletic-atletico"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")
    for basura in sopa(["script", "style"]):
        basura.decompose()

    lineas = [l.strip() for l in sopa.get_text("\n", strip=True).split("\n") if l.strip()]
    print(f"Lineas totales: {len(lineas)}\n")

    for i, l in enumerate(lineas):
        if re.search(r"[Tt]arjeta (amarilla|roja)", l):
            print("--- linea", i)
            for j in range(max(0, i - 3), min(len(lineas), i + 4)):
                marca = ">>" if j == i else "  "
                print(f" {marca} {j}: {lineas[j][:110]}")


if __name__ == "__main__":
    main()
