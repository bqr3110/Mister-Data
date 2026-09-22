import csv
import json
import os
import re
from collections import defaultdict

DATOS = "datos"
SALIDA = "web/datos.json"

FUENTES = {"mixto2": "m2", "cronistas_md": "md", "cronistas_marca": "cm"}
NOMBRES = {"m2": "Mixto 2", "md": "Cronistas MD", "cm": "Cronistas Marca", "sf": "Sofascore"}

MAPA_EV = {"goles": "g", "asis": "a", "asis_sg": "asg", "amarillas": "y", "rojas": "r",
           "min": "m", "tiros": "t", "ocasiones": "oc", "nota_sofascore": "sf", "nota_cronista": "cr",
           "titular": "tit"}


def limpia(t):
    t = t.replace("\xa0", " ").strip()
    return re.sub(r"\s*\d{1,3}\s*['\u2019\u02bc\u2032]\s*$", "", t).strip()


def apodo(n):
    w = n.split()
    for k in range(1, len(w)):
        if w[k:][-1] in w[:k]:
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
                      "val": None, "cam": None}
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
    for r in leer("mercado.csv"):
        k = buscar(limpia(r["jugador"]), r["equipo"])
        if k is None:
            sin_valor += 1
            continue
        try:
            jug[k]["val"] = int(r["valor"])
        except (ValueError, TypeError):
            pass
        try:
            jug[k]["cam"] = int(r["cambio"])
        except (ValueError, TypeError):
            pass

    salida = {
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
    print(f"json: {round(os.path.getsize(SALIDA)/1024)} KB")


if __name__ == "__main__":
    main()
