import glob
import csv
import json
import os
import re
from collections import defaultdict

DATOS = "datos"
SALIDA = "web/datos.json"

# "as" es el cronista que de verdad usa el Mister para el Mixto 2; "md" se
# sigue capturando porque no cuesta nada y sirve de contraste
FUENTES = {"mixto2": "m2", "cronistas_as": "as", "cronistas_md": "md",
           "cronistas_marca": "cm"}
NOMBRES = {"m2": "Mixto 2", "as": "Cronistas AS", "cm": "Cronistas Marca",
           "sf": "Sofascore", "md": "Cronistas MD"}

MAPA_EV = {"goles": "g", "asis": "a", "asis_sg": "asg", "amarillas": "y", "rojas": "r",
           "min": "m", "tiros": "t", "ocasiones": "oc", "nota_sofascore": "sf", "nota_cronista": "cr",
           "titular": "tit"}


def limpia(t):
    t = t.replace("\xa0", " ").strip()
    return re.sub(r"\s*\d{1,3}\s*['\u2019\u02bc\u2032]\s*$", "", t).strip()


def apodo(n):
    """"Fermin Lopez Fermin" -> "Fermin"  ·  "Nico Williams N. Williams" -> "N. Williams"

    El campo viene como "<nombre completo> <como le llaman>". Se busca el
    corte donde la segunda parte repite una palabra de la primera, pero
    ademas se exige que no sea mas larga que ella: sin esa condicion, a
    quien se conoce por el nombre de pila se le parte al reves y sale
    "Lopez Fermin" o "Gonzalez Pedri".
    """
    w = n.split()
    for k in range(1, len(w)):
        if w[k:][-1] in w[:k] and len(w[k:]) <= k:
            return " ".join(w[k:])
    return n


def leer(nombre):
    ruta = os.path.join(DATOS, nombre)
    if not os.path.exists(ruta):
        return []
    return list(csv.DictReader(open(ruta, encoding="utf-8")))


def main():
    # calendario y proximos partidos
    lugar, prox = {}, defaultdict(list)
    for p in leer("partidos.csv"):
        j = int(p["jornada"])
        lugar[f"{j}|{p['local']}"] = "C|" + p["visitante"]
        lugar[f"{j}|{p['visitante']}"] = "F|" + p["local"]
        if p["terminado"] != "1":
            prox[p["local"]].append((j, "C", p["visitante"], p.get("cuando", "")))
            prox[p["visitante"]].append((j, "F", p["local"], p.get("cuando", "")))
    for e in prox:
        prox[e] = sorted(prox[e])[:5]

    # puntuaciones
    jug = {}
    for r in leer("puntos.csv"):
        f = FUENTES.get(r["fuente"])
        if not f:
            continue
        nom, eq = limpia(r["jugador"]), r["equipo"]
        k = (nom, eq)
        if k not in jug:
            jug[k] = {"n": apodo(nom), "nc": nom, "e": eq, "pos": "", "p": {}, "ev": {},
                      "val": None, "cam": None, "f": ""}
        if r["jugo"] != "1" or not r["puntos"]:
            continue
        jug[k]["p"].setdefault(f, {})[int(r["jornada"])] = float(r["puntos"])

    por_eq, por_nom = defaultdict(list), defaultdict(list)
    for k, v in jug.items():
        por_eq[v["e"]].append(k)
        por_nom[v["n"]].append(k)
        por_nom[v["nc"]].append(k)

    def buscar(nombre, equipo):
        c = [k for k in por_eq.get(equipo, [])
             if jug[k]["n"] == nombre or jug[k]["nc"] == nombre
             or jug[k]["nc"].endswith(" " + nombre) or nombre.endswith(" " + jug[k]["n"])]
        if len(c) == 1:
            return c[0]
        if not c:
            c2 = list(set(por_nom.get(nombre, [])))
            if len(c2) == 1:
                return c2[0]
            c3 = list({k for k in jug if jug[k]["nc"].endswith(" " + nombre) or jug[k]["n"] == nombre})
            if len(c3) == 1:
                return c3[0]
        return None

    # eventos
    sin_cruce = set()
    for r in leer("eventos.csv"):
        ev = MAPA_EV.get(r["evento"])
        if not ev:
            continue
        k = buscar(limpia(r["jugador"]), r["equipo"])
        if k is None:
            sin_cruce.add((r["jugador"], r["equipo"]))
            continue
        if r.get("posicion"):
            jug[k]["pos"] = r["posicion"]
        # el slug es el nombre del fichero de su foto en web/fotos/.
        # Las capturas viejas guardaban la temporada del enlace en vez del
        # jugador; eso no vale como nombre de fichero y se descarta.
        s = (r.get("slug") or "").strip()
        if s and not s.startswith(("laliga", "-")) and not jug[k]["f"]:
            jug[k]["f"] = s
        try:
            jug[k]["ev"].setdefault(int(r["jornada"]), {})[ev] = float(r["cantidad"])
        except ValueError:
            pass

    for v in jug.values():
        sf = {j: d["sf"] for j, d in v["ev"].items() if "sf" in d}
        if sf:
            v["p"]["sf"] = sf

    # valor de mercado
    sin_valor = 0
    filas_mercado = list(leer("mercado.csv"))

    # ¿De que dia es este valor?
    #
    # La web de la que tiramos publica los valores un rato mas tarde que el
    # propio Mister, asi que por la manana todavia tiene los de ayer. Si casi
    # nadie ha cambiado de valor respecto a la captura anterior, es que aun no
    # se ha actualizado, y entonces lo que ensenamos es de ayer. Se marca aqui
    # para que la web lo pueda decir en vez de llamarlo "hoy" y mentir.
    movidos = sum(1 for r in filas_mercado
                  if r.get("valor") and r.get("valor_ayer")
                  and r["valor"] != r["valor_ayer"])
    hay = sum(1 for r in filas_mercado if r.get("valor"))
    al_dia = hay and movidos > hay * 0.2
    fecha_dato = (filas_mercado[0].get("fecha") if al_dia
                  else filas_mercado[0].get("fecha_ayer")) if filas_mercado else ""
    print(f"valores del {fecha_dato} ({movidos} de {hay} se han movido hoy)")

    for r in filas_mercado:
        k = buscar(limpia(r["jugador"]), r["equipo"])
        if k is None:
            sin_valor += 1
            continue
        try:
            jug[k]["val"] = int(r["valor"])
        except (ValueError, TypeError):
            pass
        try:
            # "cambio" es la resta entre la captura de hoy y la de ayer, y sale 0
            # los dias en que la captura llega antes de que el Mister actualice.
            # "cambio_web" es lo que el propio Mister anuncia que sube o baja:
            # es lo que se ve en la app y lo que sirve para calcular una puja.
            crudo = r.get("cambio_web")
            if crudo in (None, ""):
                crudo = r.get("cambio", "")
            jug[k]["cam"] = int(crudo)
        except (ValueError, TypeError):
            pass

    # ---- jerarquia en el equipo y probabilidad de ser titular ----
    #
    # La jerarquia cruza por slug, que es inequivoco (dos jugadores pueden
    # llamarse igual, pero su ficha no). Del fichero, que guarda historico,
    # se coge solo la ultima fecha. La probabilidad de titular cruza por
    # nombre y equipo, como las puntuaciones.
    porslug = {}
    for k, v in jug.items():
        if v.get("f"):
            porslug.setdefault(v["f"], k)

    ultima, jerarquias = "", {}
    for r in leer("jerarquias.csv"):
        if r.get("fecha", "") > ultima:
            ultima = r["fecha"]
    con_jer = 0
    for r in leer("jerarquias.csv"):
        if r.get("fecha") != ultima:
            continue
        k = porslug.get(r.get("slug", ""))
        if k is None:
            continue
        try:
            jug[k]["jer"] = int(r["orden"])
            jug[k]["jerN"] = r["nivel"]
            con_jer += 1
        except (ValueError, TypeError, KeyError):
            pass
    if ultima:
        print(f"jerarquias del {ultima}: {con_jer} jugadores cruzados")

    con_tit = 0
    for r in leer("titularidad.csv"):
        k = buscar(limpia(r["jugador"]), r["equipo"])
        if k is None:
            continue
        try:
            jug[k]["tp"] = int(r["probabilidad"])
            con_tit += 1
        except (ValueError, TypeError, KeyError):
            pass
    if con_tit:
        print(f"probabilidad de ser titular: {con_tit} jugadores")

    # ---- historico de valores -> las cinco ventanas de la calculadora ----
    #
    # No se mete la serie entera en el json (461 jugadores por todos los dias
    # se hace enorme y crece cada dia). Se calculan aqui los cinco numeros que
    # la calculadora pide y se guardan ya listos, en % sobre el valor de
    # partida, que es la unidad con la que trabaja.
    serie = defaultdict(dict)
    for ruta in sorted(glob.glob(os.path.join("datos", "historico", "mercado-*.csv"))):
        for r in csv.DictReader(open(ruta, encoding="utf-8")):
            k = buscar(limpia(r["jugador"]), r["equipo"])
            if k is None:
                continue
            try:
                serie[k][r["fecha"]] = int(r["valor"])
            except (ValueError, TypeError):
                pass

    def variacion(vals, dias):
        """% de subida entre el valor de hace `dias` dias y el ultimo."""
        if len(vals) <= dias:
            return None
        antes, ahora = vals[-1 - dias], vals[-1]
        if not antes:
            return None
        return round((ahora - antes) / antes * 100, 3)

    con_hist = 0
    for k, porFecha in serie.items():
        if k not in jug or len(porFecha) < 2:
            continue
        vals = [porFecha[f] for f in sorted(porFecha)]
        h = {}
        for clave, dias in (("hoy", 1), ("ayer", 2), ("ante", 3), ("sem", 7), ("mes", 30)):
            # ayer y anteayer son la subida DE ese dia, no la acumulada
            if clave in ("ayer", "ante"):
                if len(vals) <= dias:
                    continue
                antes, despues = vals[-dias - 1], vals[-dias]
                v = round((despues - antes) / antes * 100, 3) if antes else None
            else:
                v = variacion(vals, dias)
            if v is not None:
                h[clave] = v
        if h:
            jug[k]["h"] = h
            con_hist += 1

    salida = {
        "fecha": fecha_dato,
        "lugar": lugar,
        "prox": dict(prox),
        "fuentes": NOMBRES,
        "jugadores": [v for v in jug.values() if v["p"]],
        "equipos": sorted({v["e"] for v in jug.values()}),
        "posiciones": ["Portero", "Defensa", "Mediocampista", "Delantero"],
    }

    os.makedirs("web", exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))

    print(f"jugadores: {len(salida['jugadores'])}")
    print(f"sin cruce en eventos: {len(sin_cruce)}  sin valor de mercado: {sin_valor}")
    print(f"jugadores con historico de valores: {con_hist}")
    print(f"json: {round(os.path.getsize(SALIDA)/1024)} KB")


if __name__ == "__main__":
    main()
