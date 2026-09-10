import csv
from collections import defaultdict

FUENTE = "mixto2"


def cargar_calendario():
    donde = {}
    with open("datos/calendario.csv", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            j = int(fila["jornada"])
            donde[(j, fila["local"])] = "casa"
            donde[(j, fila["visitante"])] = "fuera"
    return donde


def main():
    donde = cargar_calendario()
    jugadores = defaultdict(lambda: {"casa": [], "fuera": [], "equipo": ""})
    sin_cruce = set()

    with open("datos/puntos.csv", encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            if fila["fuente"] != FUENTE or fila["jugo"] != "1":
                continue

            clave = (int(fila["jornada"]), fila["equipo"])
            lugar = donde.get(clave)
            if lugar is None:
                sin_cruce.add(fila["equipo"])
                continue

            j = jugadores[(fila["jugador"], fila["equipo"])]
            j["equipo"] = fila["equipo"]
            j[lugar].append(float(fila["puntos"]))

    if sin_cruce:
        print(f"AVISO, equipos sin cruce: {sorted(sin_cruce)}")

    def media(lista):
        return round(sum(lista) / len(lista), 2) if lista else None

    filas = []
    for (jugador, equipo), d in jugadores.items():
        total = d["casa"] + d["fuera"]
        if len(total) < 2:
            continue
        filas.append({
            "jugador": jugador,
            "equipo": equipo,
            "pj": len(total),
            "media": media(total),
            "casa": media(d["casa"]),
            "fuera": media(d["fuera"]),
            "n_casa": len(d["casa"]),
            "n_fuera": len(d["fuera"]),
        })

    con_ambos = [f for f in filas if f["casa"] is not None and f["fuera"] is not None]
    con_ambos.sort(key=lambda f: f["casa"] - f["fuera"], reverse=True)

    print(f"\nJugadores procesados: {len(filas)}")
    print(f"Con partidos en casa y fuera: {len(con_ambos)}\n")

    print("MAS DIFERENCIA A FAVOR DE CASA")
    for f in con_ambos[:10]:
        print(f"  {f['jugador'][:28]:30} {f['equipo'][:12]:14} casa {f['casa']:5} ({f['n_casa']})  fuera {f['fuera']:5} ({f['n_fuera']})")

    print("\nMAS DIFERENCIA A FAVOR DE FUERA")
    for f in con_ambos[-10:]:
        print(f"  {f['jugador'][:28]:30} {f['equipo'][:12]:14} casa {f['casa']:5} ({f['n_casa']})  fuera {f['fuera']:5} ({f['n_fuera']})")


if __name__ == "__main__":
    main()
