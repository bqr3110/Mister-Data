import re
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/laliga/calendario"


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    r = requests.get(URL, headers=cabeceras, timeout=30)
    sopa = BeautifulSoup(r.text, "html.parser")

    enlaces = [a for a in sopa.select("a[href]") if re.search(r"/partidos/(\d+)-", a["href"])]

    terminados = [a for a in enlaces if "terminado" in (a.get("class") or [])]
    pendientes = [a for a in enlaces if "terminado" not in (a.get("class") or [])]

    print(f"Total: {len(enlaces)}   terminados: {len(terminados)}   pendientes: {len(pendientes)}\n")

    print("=== CLASES DISTINTAS QUE APARECEN")
    clases = {}
    for a in enlaces:
        c = " ".join(sorted(a.get("class") or []))
        clases[c] = clases.get(c, 0) + 1
    for c, n in sorted(clases.items(), key=lambda x: -x[1]):
        print(f"  {n:4}  {c}")

    print("\n=== 3 TERMINADOS")
    for a in terminados[:3]:
        print(f"  {a['href'].split('/')[-1]}")
        print(f"     texto:   {a.get_text(' ', strip=True)[:70]}")
        print(f"     tooltip: {str(a.get('data-tooltip'))[:120]}")

    print("\n=== 3 PENDIENTES")
    for a in pendientes[:3]:
        print(f"  {a['href'].split('/')[-1]}")
        print(f"     texto:   {a.get_text(' ', strip=True)[:70]}")
        print(f"     tooltip: {str(a.get('data-tooltip'))[:120]}")


if __name__ == "__main__":
    main()
