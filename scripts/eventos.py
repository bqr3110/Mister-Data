import csv
import os
import re
import time
import requests
from bs4 import BeautifulSoup

PARTIDOS = "datos/partidos.csv"
SALIDA = "datos/eventos.csv"
CABECERA = ["partido", "jornada", "fecha", "equipo", "lado", "jugador", "slug",
            "posicion", "evento", "cantidad"]

INTERESAN = {
    "Minutos jugados": "min",
    "Goles": "goles",
    "Asistencias de gol": "asis",
    "Asistencias sin gol": "asis_sg",
    "Tarjetas amarillas": "amarillas",
    "Tarjetas rojas": "rojas",
    "Tiros a puerta": "tiros",
    "Ocasiones claras creadas": "ocasiones",
}

MESES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
         "julio":7,"agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12}


def limpia(t):
    return t.replace("\xa0", " ").strip()


def cantidad_y_evento(texto):
    t = limpia(texto)
    if not t:
        return None, None
    t = re.sub(r"\s*-?[\d.]+\s*p$", "", t).strip()
    m = re.match(r"^(-?\d+)\s+(.*)$", t)
    if m:
        return float(m.group(1)), m.group(2).strip()
    return 1.0, t


def fecha_de(sopa):
    for l in sopa.get_text("\n", strip=True).split("\n")[:150]:
        m = re.search(r"(\d{1,2}) de (\w+) del (\d{4})(?:.*?(\d{1,2}):(\d{2}))?", l)
        if m and m.group(2).lower() in MESES:
            h = f" {m.group(4)}:{m.group(5)}" if m.group(4) else ""
            return f"{m.group(3)}-{MESES[m.group(2).lower()]:02d}-{int(m.group(1)):02d}{h}"
    return ""


def ficha_jugadores(sopa):
    """Del campograma: nombre -> slug"""
    fichas = {}
    for a in sopa.select("a.camiseta"):
        href = a.get("href", "")
        slug = href.split("/")[-1] if "/jugadores/" in href else ""
        nombre = next((im.get("alt") for im in a.select("img") if im.get("alt")), "")
        if nombre:
            fichas[limpia(nombre)] = slug
    return fichas


def procesar(fila, cabeceras):
    r = requests.get(fila["url"], headers=cabeceras, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    fecha = fecha_de(sopa)
    fichas = ficha_jugadores(sopa)

    filas = []
    for lado in ["local", "visitante"]:
        tabla = sopa.select_one(f"div.stats-{lado} table.tablestats")
        if tabla is None:
            continue
        equipo = fila[lado]

        nombre = None
        posicion = nota_cron = nota_sofa = ""
        seccion = ""   # "Titulares" o "Suplentes": la tabla viene separada en dos

        for tr in tabla.select("tr"):
            if "desglose" not in (tr.get("class") or []):
                celdas = [c.get_text(" ", strip=True) for c in tr.select("th, td")]
                if celdas and celdas[0]:
                    if celdas[0] in ("Titulares", "Suplentes"):
                        seccion = celdas[0]
                    else:
                        nombre = re.sub(r"\s*\d{1,3}'\s*$", "", limpia(celdas[0])).strip()
                        celda = tr.select_one("td.name, th.name")
                        posicion = celda.attrs.get("data-posicion-mister-mixto-2", "") if celda else ""
                        nota_cron = celdas[3] if len(celdas) > 3 else ""
                        nota_sofa = celdas[4] if len(celdas) > 4 else ""
                continue

            if not nombre:
                continue

            bloque = tr.select_one("div.desg.laliga-fantasy")
            if bloque is None:
                continue

            slug = ""
            for n, s in fichas.items():
                if n == nombre or n.endswith(" " + nombre) or nombre.endswith(" " + n):
                    slug = s
                    break

            # 1 si salio de inicio, 0 si entro desde el banquillo
            if seccion:
                filas.append([fila["id"], fila["jornada"], fecha, equipo, lado,
                              nombre, slug, posicion, "titular",
                              1.0 if seccion == "Titulares" else 0.0])

            for etiqueta, valor in (("nota_cronista", nota_cron), ("nota_sofascore", nota_sofa)):
                try:
                    filas.append([fila["id"], fila["jornada"], fecha, equipo, lado,
                                  nombre, slug, posicion, etiqueta, float(valor)])
                except (TypeError, ValueError):
                    pass

            for d in bloque.select("div.estadistica"):
                cant, ev = cantidad_y_evento(d.get_text(" ", strip=True))
                clave = INTERESAN.get(ev)
                if clave is None:
                    continue
                filas.append([fila["id"], fila["jornada"], fecha, equipo, lado,
                              nombre, slug, posicion, clave, cant])
    return filas


def main():
    cabeceras = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}

    partidos = list(csv.DictReader(open(PARTIDOS, encoding="utf-8")))
    terminados = [p for p in partidos if p["terminado"] == "1"]

    previas, ya = [], set()
    if os.path.exists(SALIDA):
        for f in csv.DictReader(open(SALIDA, encoding="utf-8")):
            previas.append(f)
            ya.add(f["partido"])

    faltan = [p for p in terminados if p["id"] not in ya]
    print(f"Terminados: {len(terminados)}   ya guardados: {len(ya)}   a pedir: {len(faltan)}")

    nuevas = []
    for i, p in enumerate(faltan):
        try:
            f = procesar(p, cabeceras)
            print(f"  {i+1}/{len(faltan)} J{p['jornada']} {p['local']}-{p['visitante']}: {len(f)}")
            nuevas.extend(f)
        except Exception as e:
            print(f"  ERROR {p['id']}: {e}")
        time.sleep(1)

    if not nuevas and previas:
        print("Sin partidos nuevos.")
        return

    os.makedirs("datos", exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CABECERA)
        for p in previas:
            w.writerow([p.get(c, "") for c in CABECERA])
        w.writerows(nuevas)

    print(f"Total en fichero: {len(previas) + len(nuevas)}")


if __name__ == "__main__":
    main()
