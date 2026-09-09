import os
import requests
from bs4 import BeautifulSoup

URL = "https://futbolweb.net/calendario-laliga-2026-2027/jornada/4"


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

    texto = sopa.get_text("\n", strip=True)
    with open("datos/explorar/futbolweb_j4.txt", "w", encoding="utf-8") as f:
        f.write(texto[:6000])

    print("Guardado datos/explorar/futbolweb_j4.txt")


if __name__ == "__main__":
    main()
