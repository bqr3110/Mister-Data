import os
import requests
from bs4 import BeautifulSoup

URLS = {
    "ff_partidos": "https://www.futbolfantasy.com/analytics/laliga/partidos",
    "ff_jornada5": "https://www.futbolfantasy.com/laliga/jornada/5",
    "fbref_liga": "https://fbref.com/es/comps/12/horario/Resultados-y-partidos-en-La-Liga",
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

            enlaces = []
            for a in sopa.select("a[href]"):
                h = a["href"]
                if any(p in h for p in ["partido", "match", "informe", "enfrentamiento"]):
                    enlaces.append(h)

            print(f"  enlaces de partido encontrados: {len(enlaces)}")
            with open(f"datos/explorar/{nombre}_enlaces.txt", "w", encoding="utf-8") as f:
                f.write("\n".join(sorted(set(enlaces))[:40]))

            texto = sopa.get_text("\n", strip=True)
            with open(f"datos/explorar/{nombre}_texto.txt", "w", encoding="utf-8") as f:
                f.write(texto[:2500])

        except Exception as e:
            print(f"{nombre}: ERROR {e}")


if __name__ == "__main__":
    main()
