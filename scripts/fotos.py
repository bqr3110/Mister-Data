"""Baja las fotos de los jugadores y las deja pequenas en web/fotos/.

Se ejecuta a mano (Actions -> Fotos -> Run workflow), no cada dos horas.
Solo baja las que falten, asi que pasarlo otra vez tras una jornada nueva
cuesta poco: se trae unicamente las caras nuevas.

De donde saca la URL de cada foto, por orden:
  1. datos/fotos.csv, que escribe eventos.py al leer el campograma. Es
     gratis, porque esa pagina ya se pide para los eventos.
  2. Si ahi no esta, entra en la ficha del jugador y la busca. Es una
     peticion por jugador, asi que la primera vez tarda unos minutos.
Lo que encuentre por la via 2 lo apunta en fotos.csv, para no repetirlo.

Asi no hay que borrar datos/eventos.csv ni recapturar nada: los slugs
ya estan ahi desde la primera captura.
"""

import csv
import os
import re
import time
import requests

ORIGEN = "datos/fotos.csv"
EVENTOS = "datos/eventos.csv"
DESTINO = "web/fotos"
LADO = 160          # 80 px en pantalla, al doble para pantallas densas
CALIDAD = 82

FICHA = "https://www.futbolfantasy.com/jugadores/{}"
# la version con /thumb/400x400/ lleva un sello de cache que caduca;
# la ruta directa a uploads/ es estable
DIRECTA = "https://media.futbolfantasy.com/uploads/images/jugadores/ficha/{}.{}"
PATRON = re.compile(r"uploads/images/jugadores/ficha/(\d+)\.(png|jpg|jpeg|webp)")


def url_de_la_ficha(slug, cab):
    """Entra en la pagina del jugador y saca la ruta de su foto."""
    r = requests.get(FICHA.format(slug), headers=cab, timeout=25)
    r.raise_for_status()
    m = PATRON.search(r.text)
    if not m:
        return ""
    return DIRECTA.format(m.group(1), m.group(2))


def slugs_de_eventos():
    """Todos los slugs que aparecen en la captura, sin repetir."""
    if not os.path.exists(EVENTOS):
        return []
    vistos = {}
    for f in csv.DictReader(open(EVENTOS, encoding="utf-8")):
        s = (f.get("slug") or "").strip()
        if s:
            vistos[s] = True
    return list(vistos)


try:
    import io
    from PIL import Image
    HAY_PILLOW = True
except ImportError:
    HAY_PILLOW = False


def encoge(bruto):
    """Cuadrado de LADO px en webp. Sin Pillow, se guarda tal cual."""
    if not HAY_PILLOW:
        return None

    im = Image.open(io.BytesIO(bruto))
    im = im.convert("RGBA")
    # recorte cuadrado centrado, mordiendo por el lado largo
    an, al = im.size
    lado = min(an, al)
    im = im.crop(((an - lado) // 2, (al - lado) // 2,
                  (an + lado) // 2, (al + lado) // 2))
    im = im.resize((LADO, LADO), Image.LANCZOS)

    fuera = io.BytesIO()
    im.save(fuera, "WEBP", quality=CALIDAD, method=6)
    return fuera.getvalue()


def main():
    os.makedirs(DESTINO, exist_ok=True)
    os.makedirs("datos", exist_ok=True)
    cab = {"User-Agent": "Mozilla/5.0 (proyecto personal, uso no comercial)"}

    # lo que ya sabemos de otras pasadas
    conocidas = {}
    if os.path.exists(ORIGEN):
        for f in csv.DictReader(open(ORIGEN, encoding="utf-8")):
            if f.get("slug"):
                conocidas[f["slug"]] = f.get("url", "")

    slugs = slugs_de_eventos()
    if not slugs and not conocidas:
        print(f"No encuentro slugs. Falta {EVENTOS} o {ORIGEN}.")
        return
    for s in conocidas:
        if s not in slugs:
            slugs.append(s)
    print(f"jugadores a mirar: {len(slugs)}   urls ya conocidas: "
          f"{sum(1 for s in slugs if conocidas.get(s))}")

    bajadas = saltadas = buscadas = 0
    fallos = []
    bytes_totales = 0

    for slug in slugs:
        # si ya esta en cualquiera de los dos formatos, no se vuelve a pedir
        if any(os.path.exists(os.path.join(DESTINO, slug + e)) for e in (".webp", ".png")):
            saltadas += 1
            continue
        try:
            url = conocidas.get(slug) or ""
            if not url:
                url = url_de_la_ficha(slug, cab)
                buscadas += 1
                conocidas[slug] = url
                time.sleep(1)
                if not url:
                    raise ValueError("su ficha no trae foto")
            r = requests.get(url, headers=cab, timeout=25)
            r.raise_for_status()
            if not (r.content[:8].startswith(b"\x89PNG") or r.content[:3] == b"\xff\xd8\xff"
                    or r.content[:4] == b"RIFF"):
                raise ValueError("no parece una imagen")

            pequena = encoge(r.content)
            if pequena is None:
                ruta = os.path.join(DESTINO, slug + ".png")
                datos = r.content
            else:
                ruta = os.path.join(DESTINO, slug + ".webp")
                datos = pequena

            with open(ruta, "wb") as g:
                g.write(datos)
            bajadas += 1
            bytes_totales += len(datos)
        except Exception as e:
            fallos.append(f"{slug}: {e}")

    # lo aprendido se apunta, para que la proxima pasada no vuelva a buscarlo
    if conocidas:
        with open(ORIGEN, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["slug", "url"])
            for s in sorted(conocidas):
                w.writerow([s, conocidas[s]])

    print(f"fotos nuevas: {bajadas}   ya estaban: {saltadas}   "
          f"urls buscadas en su ficha: {buscadas}")
    if bajadas:
        print(f"peso de las nuevas: {bytes_totales // 1024} KB "
              f"({bytes_totales // max(bajadas, 1) // 1024} KB de media)")
    if not HAY_PILLOW:
        print("AVISO: sin Pillow se guardan a tamano original y pesan mucho mas.")
    for x in fallos[:15]:
        print("  FALLO:", x)
    if len(fallos) > 15:
        print(f"  ...y {len(fallos) - 15} mas")


if __name__ == "__main__":
    main()
