import os
import requests
from bs4 import BeautifulSoup

URLS = {
    "estad_puntos": "https://www.futbolfantasy.com/laliga/estadisticas-puntos/jugador",
    "equipo_athletic": "https://www.futbolfantasy.com/analytics/athletic",
    "equipo_athletic_lg": "https://www.futbolfantasy.com/laliga/equipos/athletic",
}


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    os.makedirs("datos/explorar", exist_ok=True)

    for nombre, url in URLS.items():
        try:
            r = requests.get(url, headers=cabeceras, timeout=30)
            print(f"{nombre}: HTTP {r.status_code}")
            if r.status_code != 200:
                continue

            sopa = BeautifulSoup(r.text, "html.parser")
            for basura in sopa(["script", "style"]):
                basura.decompose()

            texto = sopa.get_text("\n", strip=True)
            with open(f"datos/explorar/{nombre}.txt", "w", encoding="utf-8") as f:
                f.write(texto[:3000])

            print(f"  guardado, {len(texto)} caracteres")

        except Exception as e:
            print(f"{nombre}: ERROR {e}")


if __name__ == "__main__":
    main()
