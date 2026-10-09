import glob
import csv
import json
import os
import re
from datetime import date
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
    # Se quitan los angulos. Todo este texto viene de raspar una web ajena y
    # acaba dentro del html con innerHTML: si algun dia un nombre llegara con
    # "<img onerror=...>" dentro, se ejecutaria en la web. Ningun nombre de
    # jugador lleva "<", asi que quitarlos no pierde nada y cierra la puerta
    # en el origen, una sola vez, en vez de en cada sitio donde se pinta.
    t = t.replace("<", "").replace(">", "")
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
    hoy = date.today()

    # calendario y proximos partidos
    lugar, prox = {}, defaultdict(list)
    lugar_equipos = set()
    for p in leer("partidos.csv"):
        lugar_equipos.add(p["local"])
        lugar_equipos.add(p["visitante"])
        j = int(p["jornada"])
        lugar[f"{j}|{p['local']}"] = "C|" + p["visitante"]
        lugar[f"{j}|{p['visitante']}"] = "F|" + p["local"]
        if p["terminado"] != "1":
            # "cuando" es el unico texto libre que sale de aqui a la web
            # ("Sab 10/10 16:15h"): se limpia como los nombres. Los equipos
            # no, porque son claves de cruce y los extractores ya los validan
            # contra la lista de los veinte.
            cuando = limpia(p.get("cuando", ""))
            prox[p["local"]].append((j, "C", p["visitante"], cuando, ""))
            prox[p["visitante"]].append((j, "F", p["local"], cuando, ""))
    # Y los europeos, que vienen de su propio fichero. Es la mitad del valor
    # de esto: si el Barça juega el miercoles en Champions, el domingo rota,
    # y el que rota no puntua. Van marcados con la competicion para que en la
    # ficha se distingan de un partido de Liga.
    CORTO = {"Champions": "CH", "Europa League": "EL"}
    europeos = 0
    for p in leer("europa.csv"):
        if p.get("terminado") == "1":
            continue
        comp = CORTO.get(p.get("competicion", ""), "EU")
        cuando = limpia(p.get("cuando", ""))
        try:
            j = int(p["jornada"])
        except (ValueError, KeyError):
            continue
        for eq, sede, rival in ((p["local"], "C", p["visitante"]),
                                (p["visitante"], "F", p["local"])):
            # solo los de Primera: el resto del cuadro europeo no tiene ficha
            if eq in prox or any(eq == x for x in lugar_equipos):
                prox[eq].append((j, sede, rival, cuando, comp))
                europeos += 1
    if europeos:
        print(f"partidos europeos en el calendario: {europeos}")

    # Se ordena por el dia en que se juega, no por el numero de jornada: un
    # partido aplazado lleva numero bajo y se juega el ultimo (el Levante -
    # Athletic de la J6 cae el 21 de octubre). Lo que no tiene fecha todavia
    # va detras, por jornada.
    def cuando_ordena(p):
        """Clave de orden: primero lo que tiene fecha, por fecha."""
        m = re.search(r"(\d{1,2})/(\d{1,2})", p[3] or "")
        if not m:
            return (1, p[0], "")
        dia, mes = int(m.group(1)), int(m.group(2))
        # la temporada cruza el año: de enero a junio es el año siguiente
        año = hoy.year + (1 if mes < 7 and hoy.month >= 7 else 0)
        return (0, 0, f"{año}-{mes:02d}-{dia:02d}")

    for e in prox:
        prox[e] = sorted(prox[e], key=cuando_ordena)[:8]

    # ---- lo dura que tiene cada equipo la papeleta ----
    #
    # Dos numeros distintos, porque un rival no es igual de duro para todos:
    #   - al delantero le importa lo que ENCAJA el rival (si no encaja, no marcas)
    #   - al portero y al defensa le importa lo que MARCA el rival (si marca,
    #     te quedas sin los puntos de porteria a cero)
    # Salen del resultado de los partidos ya jugados, asi que no dependen de
    # que fuente de puntos tengas elegida. Con siete jornadas es orientativo.
    gf, gc, pjs = defaultdict(int), defaultdict(int), defaultdict(int)
    for p in leer("partidos.csv"):
        if p["terminado"] != "1" or "-" not in (p.get("resultado") or ""):
            continue
        try:
            a, b = (int(x) for x in p["resultado"].split("-", 1))
        except ValueError:
            continue
        for eq, mete, recibe in ((p["local"], a, b), (p["visitante"], b, a)):
            gf[eq] += mete
            gc[eq] += recibe
            pjs[eq] += 1

    def quintiles(valores):
        """Reparte los veinte equipos en cinco cajones, de 1 a 5."""
        orden = sorted(valores, key=lambda x: valores[x])
        n = len(orden) or 1
        return {eq: min(5, int(i * 5 / n) + 1) for i, eq in enumerate(orden)}

    enc = {e: gc[e] / pjs[e] for e in pjs if pjs[e]}   # encaja por partido
    met = {e: gf[e] / pjs[e] for e in pjs if pjs[e]}   # marca por partido
    # 5 = el rival mas duro. Encaja poco -> duro para el que ataca.
    # Marca mucho -> duro para el que defiende.
    q_enc = quintiles({e: -v for e, v in enc.items()})
    q_met = quintiles(met)
    dureza = {e: [q_enc.get(e, 3), q_met.get(e, 3),
                  round(enc.get(e, 0), 2), round(met.get(e, 0), 2), pjs.get(e, 0)]
              for e in sorted(set(enc) | set(met))}

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

    # El fichero guarda una captura por dia. La ultima dice donde esta cada
    # jugador hoy; comparandola con la anterior sale quien se ha movido, que
    # es el dato que de verdad vale: un tio que sube de Rotacion a Clave
    # empieza a puntuar, y todavia esta barato. No cuesta ninguna peticion
    # nueva: el historico ya se estaba guardando.
    filas_jer = leer("jerarquias.csv")
    fechas_jer = sorted({r.get("fecha", "") for r in filas_jer if r.get("fecha")})
    ultima = fechas_jer[-1] if fechas_jer else ""
    anterior = fechas_jer[-2] if len(fechas_jer) > 1 else ""

    # Se compara por el NOMBRE del escalon, no por el numero: el numero es
    # la escala del dia en que se capturo y esa escala ya ha cambiado una vez
    # (cuando aparecieron "Dios" y "Descartes", clave paso de 5 a 6). Si se
    # comparan numeros, un cambio de escala hace que parezca que se ha movido
    # la liga entera. El nombre del escalon significa siempre lo mismo.
    NIVELES = {"dios": 7, "clave": 6, "importantes": 5, "rotacion": 4,
               "revulsivos": 3, "reservas": 2, "descartes": 1}

    def niveles_de(fecha):
        return {r.get("slug", ""): r.get("nivel", "") for r in filas_jer
                if r.get("fecha") == fecha and r.get("slug")}

    antes_jer = niveles_de(anterior)

    con_jer, movidos = 0, 0
    for r in filas_jer:
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
            continue
        # el escalon de la captura anterior, solo si se ha movido
        pre = NIVELES.get(antes_jer.get(r.get("slug", ""), ""))
        if pre is not None and pre != jug[k]["jer"]:
            jug[k]["jer0"] = pre
            jug[k]["jerD"] = anterior
            movidos += 1
    if ultima:
        print(f"jerarquias del {ultima}: {con_jer} jugadores cruzados")
    if anterior:
        print(f"cambios desde el {anterior}: {movidos} jugadores")

    con_tit = 0
    for r in leer("titularidad.csv"):
        k = buscar(limpia(r["jugador"]), r["equipo"])
        if k is None:
            continue
        try:
            jug[k]["tp"] = int(r["probabilidad"])
            jug[k]["tj"] = int(r["jornada"])    # de que jornada es ese %
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

    # ---- la serie de valores, para la grafica de la ficha ----
    #
    # Se mete recortada: solo los ultimos VENTANA dias y el valor en miles,
    # que es la precision con la que se mueve el mercado. Asi la grafica
    # tiene de donde tirar sin que el json crezca sin freno cada dia.
    VENTANA = 60
    todas_fechas = sorted({f for porFecha in serie.values() for f in porFecha})
    eje = todas_fechas[-VENTANA:]
    con_serie = 0
    for k, porFecha in serie.items():
        if k not in jug:
            continue
        v = [round(porFecha[f] / 1000) if f in porFecha else None for f in eje]
        # si solo hay un punto no hay nada que dibujar
        if sum(1 for x in v if x is not None) < 2:
            continue
        # se recorta por delante lo que el jugador no tenga, que suele ser
        # el que acaba de llegar: la grafica empieza donde empieza su rastro
        while v and v[0] is None:
            v.pop(0)
        jug[k]["v"] = v
        con_serie += 1

    salida = {
        "fecha": fecha_dato,
        "eje": eje,
        "lugar": lugar,
        "prox": dict(prox),
        "dureza": dureza,
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
    print(f"serie de valores para la grafica: {con_serie} jugadores, {len(eje)} dias")
    print(f"json: {round(os.path.getsize(SALIDA)/1024)} KB")


if __name__ == "__main__":
    main()
