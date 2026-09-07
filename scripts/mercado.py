import csv
import os
from datetime import date
import requests
from bs4 import BeautifulSoup

URL = "https://www.futbolfantasy.com/analytics/mister/mercado"
SALIDA = "datos/mercado.csv"
CABECERA = ["fecha", "id", "jugador", "equipo", "posicion", "valor", "variacion_dia"]


def limpiar_numero(texto):
    """Convierte '5.095.000 €' o '-44.000' en un entero."""
    if not texto:
        return None
    t = texto.replace("€", "").replace(".", "").replace("+", "").strip()
    t = t.replace("\xa0", "").replace(" ", "")
    if t in ("", "-", "—"):
        return None
    try:
        return int(t)
    except ValueError:
        return None


def descargar():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}
    respuesta = requests.get(URL, headers=cabeceras, timeout=30)
    respuesta.raise_for_status()
    return respuesta.text


def extraer(html):
    sopa = BeautifulSoup(html, "html.parser")
    hoy = date.today().isoformat()
    filas = []

    for fila in sopa.select("tr"):
        celdas = [c.get_text(" ", strip=True) for c in fila.select("td")]
        if len(celdas) < 4:
            continue
        filas.append({
            "fecha": hoy,
            "id": "",
            "bruto": celdas,
        })

    return filas


def main():
    html = descargar()

    os.makedirs("datos", exist_ok=True)
    with open("datos/ultimo.html", "w", encoding="utf-8") as f:
        f.write(html)

    filas = extraer(html)
    print(f"Filas detectadas: {len(filas)}")

    with open("datos/muestra.csv", "w", newline="", encoding="utf-8") as f:
        escritor = csv.writer(f)
        for fila in filas[:20]:
            escritor.writerow([fila["fecha"]] + fila["bruto"])

    print("Guardados datos/ultimo.html y datos/muestra.csv")


if __name__ == "__main__":
    main()
