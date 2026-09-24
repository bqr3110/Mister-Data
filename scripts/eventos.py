import csv
import os
import re
import time
import requests
from bs4 import BeautifulSoup

PARTIDOS = "datos/partidos.csv"
SALIDA = "datos/eventos.csv"
FOTOS = "datos/fotos.csv"
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


def slug_de_href(href):
    """/jugadores/antonio-sivera/laliga-26-27 -> antonio-sivera

    Ojo: el enlace lleva la temporada al final, asi que quedarse con el
    ultimo trozo devuelve "laliga-26-27" para casi todo el mundo. Hay que
    coger el trozo siguiente a "jugadores".
    """
    partes = [p for p in href.split("/") if p]
    if "jugadores" not in partes:
        return ""
    i = partes.index("jugadores")
    return partes[i + 1] if i + 1 < len(partes) else ""


def slug_valido(s):
    """Si sirve para ir a pedir su foto.

    Vacio es legitimo: hay suplentes que no llevan ficha enlazada, y esos
    se quedan sin foto y con sus iniciales. Lo que no vale es la basura.
    """
    s = (s or "").strip()
    if not s or s.startswith("-"):
        return False
    return not es_basura(s) and not s.replace("-", "").isdigit()


def es_basura(s):
    """El sintoma concreto del fallo: se guardaba la temporada del enlace.

    Se comprueba solo esto, y no "cualquier cosa que no valide", porque
    esta funcion decide si hay que volver a pedir el partido. Si tratara
    un slug vacio como roto, cada pasada recapturaria la temporada entera.
    """
    return (s or "").strip().startswith("laliga")


def ficha_jugadores(sopa, fotos):
    """Del campograma: nombre -> slug. De paso apunta la foto de cada uno.

    La foto no la guardamos en eventos.csv (se repetiria en cada fila);
    va a datos/fotos.csv, que es de donde tira fotos.py para bajarlas.
    Si algun dia cambia el maquetado y no aparece, no pasa nada: la web
    ya dibuja las iniciales cuando no hay foto.
    """
    fichas = {}
    for a in sopa.select("a.camiseta"):
        slug = slug_de_href(a.get("href", ""))
        img = next((im for im in a.select("img") if im.get("alt")), None)
        nombre = img.get("alt") if img is not None else ""
        if not nombre:
            continue
        fichas[limpia(nombre)] = slug

        if slug and slug not in fotos and img is not None:
            # algunas plantillas usan data-src para cargar la imagen mas tarde
            src = img.get("src") or img.get("data-src") or ""
            if "/jugadores/" in src and not src.endswith(".svg"):
                fotos[slug] = src if src.startswith("http") else "https:" + src.lstrip(":")
    return fichas


def procesar(fila, cabeceras, fotos):
    r = requests.get(fila["url"], headers=cabeceras, timeout=30)
    r.raise_for_status()
    sopa = BeautifulSoup(r.text, "html.parser")

    fecha = fecha_de(sopa)
    fichas = ficha_jugadores(sopa, fotos)

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

    guardadas, ya = [], set()
    if os.path.exists(SALIDA):
        for f in csv.DictReader(open(SALIDA, encoding="utf-8")):
            guardadas.append(f)
            ya.add(f["partido"])

    # Un partido cuyas filas traigan el slug mal se vuelve a pedir: hasta
    # hoy se guardaba "laliga-26-27" para casi todos en vez de su nombre,
    # y sin el slug bueno no hay foto. Asi no hace falta borrar nada a mano.
    rehacer = {f["partido"] for f in guardadas if es_basura(f.get("slug"))}

    previas = [f for f in guardadas if f["partido"] not in rehacer]
    ya -= rehacer

    faltan = [p for p in terminados if p["id"] not in ya]
    print(f"Terminados: {len(terminados)}   ya guardados: {len(ya)}   a pedir: {len(faltan)}")
    if rehacer:
        print(f"  de esos, {len(rehacer)} se repiten porque tenian el slug mal")

    # las fotos ya conocidas no se vuelven a mirar
    fotos = {}
    if os.path.exists(FOTOS):
        for f in csv.DictReader(open(FOTOS, encoding="utf-8")):
            if f.get("slug"):
                fotos[f["slug"]] = f.get("url", "")

    nuevas = []
    for i, p in enumerate(faltan):
        try:
            f = procesar(p, cabeceras, fotos)
            print(f"  {i+1}/{len(faltan)} J{p['jornada']} {p['local']}-{p['visitante']}: {len(f)}")
            nuevas.extend(f)
        except Exception as e:
            print(f"  ERROR {p['id']}: {e}")
        time.sleep(1)

    os.makedirs("datos", exist_ok=True)
    if fotos:
        with open(FOTOS, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["slug", "url"])
            for slug in sorted(fotos):
                w.writerow([slug, fotos[slug]])
        print(f"fotos conocidas: {len(fotos)}")

    if not nuevas and previas:
        print("Sin partidos nuevos.")
        return

    with open(SALIDA, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CABECERA)
        for p in previas:
            w.writerow([p.get(c, "") for c in CABECERA])
        w.writerows(nuevas)

    print(f"Total en fichero: {len(previas) + len(nuevas)}")


if __name__ == "__main__":
    main()
