# Ojeador

Herramienta personal para decidir fichajes en una liga del Mister. Captura a
diario datos públicos de LaLiga, los cruza y los presenta en una web para poder
mirarlos con calma: medias por sistema de puntuación, rachas, valor de mercado,
calendario y el sitio que ocupa cada jugador en su equipo.

**Proyecto personal, sin ánimo de lucro y no oficial.** No tiene ninguna
relación con FútbolFantasy, con Mister, con LaLiga ni con ningún club.

## De dónde salen los datos

Los datos los publica **[FútbolFantasy](https://www.futbolfantasy.com)** en
páginas abiertas. Aquí solo se leen, se cruzan entre sí y se presentan de otra
forma; no se calcula ni se genera ningún dato nuevo. El mérito de recopilarlos y
verificarlos es suyo. Si quieres los datos, ve a la fuente.

Las puntuaciones de los distintos sistemas, los valores de mercado, las
jerarquías de plantilla y la probabilidad de titularidad son **elaboración de
FútbolFantasy**. El calendario y los resultados son hechos públicos de la
competición.

## Cómo se pide

- Dos capturas al día, no más. La fuente publica los valores una vez al día.
- Un segundo de espera entre peticiones.
- User-Agent identificado, con enlace a este repositorio.
- `robots.txt` de la fuente respetado.

Si alguien de FútbolFantasy quiere que esto pare o cambie, basta con abrir una
incidencia en este repositorio y se retira.

## Licencia

El **código** está bajo licencia MIT (ver `LICENSE`).

Los **datos** de `datos/` y de `web/datos.json`, y las **imágenes** de
`web/fotos/` y `web/escudos/`, **no son míos y no están licenciados**: proceden
de sus respectivos titulares y se incluyen aquí solo para que la herramienta
funcione. No se cede ningún derecho sobre ellos. Si vas a reutilizar algo, pide
permiso a quien corresponda.

## Cómo está montado

```
scripts/   los extractores, en Python
  partidos.py    calendario y estado de cada partido
  eventos.py     goles, minutos y tarjetas de cada partido
  puntos.py      puntuaciones de los cinco sistemas, y la probabilidad de titular
  jerarquias.py  el sitio de cada jugador en su plantilla
  mercado.py     valor de mercado y subida del día
  fotos.py       caras de los jugadores (a mano, solo las que falten)
  escudos.py     escudos de los equipos (a mano, al cambiar de temporada)
  web.py         cruza todos los CSV y deja un solo web/datos.json
datos/     un CSV por cosa, con histórico por fecha
web/       la web: index.html, estilo.css, app.js y los datos ya cocinados
prueba-*.js  una prueba por cada cosa que se puede romper (jsdom, sin navegador)
```

Los workflows: **Captura** dos veces al día, **Publicar** cuando la captura
acaba o cuando se toca `web/`, y **Fotos** y **Escudos** a mano.

### Antes de dar un cambio por bueno

```bash
node --check web/app.js
for f in prueba-*.js; do out=$(node "$f" 2>&1); echo "[$?] $f"; done
```

Todas tienen que salir en `[0]`.
