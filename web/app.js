let DATOS = null;
const CLAVES = ["m2", "md", "cm", "sf"];

const EQUIPO = {
  'Alavés':['ALA','#0761AF'], 'Athletic':['ATH','#EE2523'], 'Atlético':['ATM','#CB3524'],
  'Barcelona':['BAR','#A50044'], 'Betis':['BET','#00954C'], 'Celta':['CEL','#8AC3EE'],
  'Deportivo':['DEP','#0055A5'], 'Elche':['ELC','#05642C'], 'Espanyol':['ESP','#0072CE'],
  'Getafe':['GET','#005999'], 'Levante':['LEV','#0053A0'], 'Málaga':['MAL','#0067B1'],
  'Osasuna':['OSA','#D91A21'], 'Racing':['RAC','#009B48'], 'Rayo':['RAY','#E53027'],
  'Real Madrid':['RMA','#4A5A7A'], 'Real Sociedad':['RSO','#0B4EA2'], 'Sevilla':['SEV','#D9042B'],
  'Valencia':['VAL','#F4A600'], 'Villarreal':['VIL','#E8B200'],
};
const POS = {
  'Portero':['PT','#E8B92E'], 'Defensa':['DF','#3B7DD8'],
  'Mediocampista':['MC','#2FA360'], 'Delantero':['DL','#D7443E'],
};
// texto legible sobre el color del equipo
function tinta(hex){
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b) > 150 ? '#1a1a1a' : '#fff';
}
function insignia(txt, color, ayuda){
  return `<span class="ins"${ayuda ? ` data-ayuda="${ayuda}"` : ''
    } style="background:${color};color:${tinta(color)}">${txt}</span>`;
}

// Real Sociedad -> real-sociedad · Alaves sin tilde, como los ficheros
const rebanada = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/ /g, '-');

/* El escudo si esta descargado; si no, la abreviatura de siempre.
   El onerror deja la insignia de texto, asi que la web funciona igual
   antes y despues de pasar el script de escudos. */
function escudo(equipo, ayuda){
  const e = EQUIPO[equipo];
  if(!e) return equipo;
  const texto = insignia(e[0], e[1], ayuda);
  return `<span class="esc" data-ayuda="${ayuda || equipo}"><img src="escudos/${
    rebanada(equipo)}.png" alt="${equipo}" loading="lazy"
    onerror="this.parentNode.outerHTML=this.dataset.txt"
    data-txt="${texto.replace(/"/g, '&quot;')}"></span>`;
}

/* La subida del día en las dos unidades: el porcentaje dice si es mucho
   o poco, que 50k no es lo mismo en un jugador de 1M que en uno de 20M. */
function subidaHoy(cam, val, conHoy){
  if(!cam) return '';
  const pct = val ? (cam / val * 100) : null;
  return `<i class="${cam>0?'sube':'baja'}">${cam>0?'+':''}${(cam/1000).toFixed(0)}k${
    pct === null ? '' : ` <em>${pct>0?'+':''}${pct.toFixed(2)}%</em>`}${conHoy?' hoy':''}</i>`;
}

const eur = n => (n === null || n === undefined) ? null
  : (n / 1e6).toFixed(2).replace('.', ',') + 'M';
// version corta para el movil, donde no caben dos decimales
const millones = n => (n / 1e6).toFixed(1).replace('.', ',') + 'M';

// metricas del bloque "mas condiciones" (el valor va en su propio filtro)
const METRICAS = [
  {k:'med', t:'Media'},
  {k:'mdn', t:'Mediana'},
  {k:'cas', t:'Media en casa'},
  {k:'fue', t:'Media fuera'},
  {k:'dif', t:'Casa − fuera'},
  {k:'tot', t:'Puntos totales'},
  {k:'min', t:'Minutos totales'},
];

const STATS = [
  {k:'g',   t:'Goles'},
  {k:'atot', t:'Asistencias'},
  {k:'y',   t:'Amarillas'},
  {k:'r',   t:'Rojas'},
  {k:'pj',  t:'Partidos jugados'},
  {k:'tit', t:'Titularidades'},
  {k:'mpm', t:'Minutos por partido'},
];

const COLS = [
  {k:'cmp', t:'',        pega:'c0', cmp:1},
  {k:'pos', t:'Pos',     pega:'c1', insig:'pos'},
  {k:'e',   t:'Eq',      pega:'c2', insig:'eq'},
  {k:'val', t:'Valor',   pega:'c3', mercado:1},
  {k:'n',   t:'Jugador', pega:'c4', txt:1},
  {k:'racha', t:'Racha', racha:1, sep:1},
  {k:'ult', t:'Últ.', ultimos:1},
  {k:'tit', t:'Tit'},
  {k:'pj',  t:'PJ'},
  {k:'med', t:'Media',   dec:2},
  {k:'mdn', t:'Mediana', dec:1},
  {k:'cas', t:'Casa', sep:1,    dec:2, cls:'casa'},
  {k:'fue', t:'Fuera',   dec:2, cls:'fuera'},
  {k:'dif', t:'Casa − fuera', cls:'dif', dec:2, dif:1},
  {k:'tot', t:'Total',   dec:1},
  {k:'g',   t:'G', sep:1},
  {k:'atot', t:'Asis'},
  {k:'y',   t:'Am'},
  {k:'r',   t:'Roj'},
  {k:'min', t:'Min'},
  {k:'mpm', t:'Min/P',   dec:0},
  {k:'cam', t:'Hoy',     cambio:1},
];

const estado = {
  fuente:'m2', buscar:'', sede:'', minpj:1,
  pos:new Set(), equipos:new Set(), modoEq:'incluir', rivales:new Set(),
  valMin:null, valMax:null, camMin:null,
  exGol:false, exRoja:false, exMin:false, minMinutos:45,
  excluidas:new Set(), rangos:[], stats:{},
  orden:'med', asc:false,
  carro:[], atrib:['med','mdn','cas','fue','pj'],
  ultN:5, juOn:false, juCuantos:3, juMinutos:15, juTit:false,
  juTotOn:false, juTotMin:180, juUltimo:false,
};

let JORNADAS = [];
let JUGADAS = {};   // equipo -> jornadas que ESE equipo ya ha disputado

function calcularJornadas(){
  const s = new Set();
  for(const j of DATOS.jugadores) for(const f in j.p) for(const n in j.p[f]) s.add(+n);
  JORNADAS = [...s].sort((a,b)=>a-b);

  /* Una jornada puede estar jugada por casi toda la liga y aplazada para dos
     equipos (el Levante-Athletic de la 6, por ejemplo). Esos partidos aparecen
     en "proximos", asi que los descuento: si no, parece que el jugador falto. */
  JUGADAS = {};
  for(const eq of DATOS.equipos){
    const pendientes = new Set((DATOS.prox[eq] || []).map(x => +x[0]));
    JUGADAS[eq] = JORNADAS.filter(n => !pendientes.has(n));
  }
}

// minutos de un jugador en una jornada concreta (0 si no jugo)
const minutosEn = (j, n) => (j.ev[n] && j.ev[n].m) || 0;

/* Cuenta cuantos de los ultimos N partidos de su equipo ha jugado.
   Se mira sobre los partidos REALES, sin que le afecten las exclusiones:
   si no, el filtro se mordería la cola. */
function actividad(j){
  const ult = (JUGADAS[j.e] || JORNADAS).slice(-estado.ultN);
  let jug = 0, min = 0, tit = 0;
  for(const n of ult){
    const m = minutosEn(j, n);
    min += m;
    if(m >= estado.juMinutos) jug++;
    if(j.ev[n] && j.ev[n].tit === 1) tit++;
  }
  return {ult:jug, ultDe:ult.length, ultMin:min, ultTit:tit,
          ultimo: ult.length ? minutosEn(j, ult[ult.length-1]) >= estado.juMinutos : false};
}

const mediana = v => { if(!v.length) return null;
  const o=[...v].sort((a,b)=>a-b), m=o.length>>1;
  return o.length%2 ? o[m] : +((o[m-1]+o[m])/2).toFixed(2); };
const prom = v => v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
const esNota = () => estado.fuente === 'sf';

function calcular(j, ignorarMin){
  const pts = j.p[estado.fuente];
  if(!pts) return null;

  const todos=[], casa=[], fuera=[], usadas=[];
  let g=0,a=0,asg=0,y=0,r=0,min=0,tit=0,t=0,oc=0;
  /* Los totales de arriba son de toda la temporada a proposito (asi la columna
     de goles sigue diciendo cuantos lleva aunque excluyas esas jornadas).
     Pero min/partido, puntos/90 y % titular dividen puntos ya filtrados:
     esos necesitan minutos y titularidades del mismo trozo, no del total. */
  let minU=0, titU=0, hayTit=false;

  for(const nj in pts){
    const n = +nj;
    const ev = j.ev[nj] || {};
    g+=ev.g||0; a+=ev.a||0; asg+=ev.asg||0; y+=ev.y||0; r+=ev.r||0; min+=ev.m||0;
    tit+=ev.tit||0; t+=ev.t||0; oc+=ev.oc||0;

    if(estado.excluidas.has(n)) continue;
    const [sede, rival] = (DATOS.lugar[n+'|'+j.e] || '|').split('|');
    if(estado.sede && sede !== estado.sede) continue;
    if(estado.rivales.has(rival)) continue;
    if(estado.exGol  && (ev.g||0) > 0) continue;
    if(estado.exRoja && (ev.r||0) > 0) continue;
    if(estado.exMin  && ev.m !== undefined && ev.m < estado.minMinutos) continue;

    const p = pts[nj];
    todos.push(p); usadas.push(n);
    minU += ev.m||0; titU += ev.tit||0;
    if(ev.tit !== undefined) hayTit = true;
    if(sede==='C') casa.push(p); else if(sede==='F') fuera.push(p);
  }

  if(!ignorarMin && todos.length < estado.minpj) return null;
  const cas = prom(casa), fue = prom(fuera);

  /* Lo que de verdad decide un fichaje no es solo la media: es si ahora
     esta en forma, cuanto techo tiene y cada cuanto te hunde la jornada. */
  const ordenadas = usadas.map((n, i) => [n, todos[i]]).sort((a, b) => a[0] - b[0]);
  const ult5 = ordenadas.slice(-5).map(x => x[1]);
  const nota = esNota();
  const bueno = nota ? 7.4 : 10;     // "partidazo" en cada escala
  const malo  = nota ? 6 : 0;
  return {n:j.n, e:j.e, pos:j.pos||'', nc:j.nc, ref:j, usadas, disp:Object.keys(pts).length,
    pj:todos.length, tot:+todos.reduce((x,z)=>x+z,0).toFixed(1),
    med:prom(todos), mdn:mediana(todos),
    cas, fue, dif:(cas!==null&&fue!==null)?cas-fue:null,
    g,a,asg,y,r,min,tit,t,oc, atot:a+asg, minU, titU, hayTit,
    mpm: todos.length ? Math.round(minU/todos.length) : null,
    med5: prom(ult5), mej: todos.length ? Math.max(...todos) : null,
    peor: todos.length ? Math.min(...todos) : null,
    p10: todos.filter(v => v >= bueno).length,
    pneg: todos.filter(v => v < malo).length,
    p90: minU ? +(todos.reduce((x,z)=>x+z,0) / minU * 90).toFixed(2) : null,
    ptit: (hayTit && todos.length) ? Math.round(titU / todos.length * 100) : null,
    val:j.val, cam:j.cam, ...actividad(j)};
}

/* Escala de Mister: la nota de Sofascore se traduce a puntos por tramos.
   Sirve para dos cosas: pintar la racha con SUS colores y poder decir
   "un 7,4 son +7" al pasar por encima de un cuadro. */
const TABLA_SF = [
  [9.3, 12], [8.6, 11], [8.0, 10], [7.8, 9], [7.6, 8], [7.4, 7], [7.2, 6],
  [7.0, 5], [6.8, 4], [6.6, 3], [6.4, 2], [6.2, 1], [6.0, 0],
  [5.8, -1], [5.4, -2], [5.0, -3], [0, -4],
];
const notaAPuntos = n => (TABLA_SF.find(([min]) => n >= min - 1e-9) || [0, -4])[1];

/* Los colores son los del propio Mister:
   azul los partidazos, verde bien, amarillo flojo, gris cero, rojo negativo. */
function nivel(v){
  if(v === undefined || v === null) return 'pv';
  const p = esNota() ? notaAPuntos(v) : v;
  return p < 0 ? 'nr' : p === 0 ? 'n0' : p < 5 ? 'na' : p < 10 ? 'nv' : 'nz';
}
function pintarRacha(f, tope){
  const pts = f.ref.p[estado.fuente] || {};
  // si se está mirando solo casa o solo fuera, la racha es la de esos partidos
  const base = estado.sede
    ? JORNADAS.filter(n => (DATOS.lugar[n+'|'+f.e] || '|').split('|')[0] === estado.sede)
    : JORNADAS;
  const js = (tope && base.length > tope) ? base.slice(-tope) : base;
  return js.map(n => {
    const v = pts[n];
    const dentro = f.usadas.includes(n);
    const [sede] = (DATOS.lugar[n+'|'+f.e] || '|').split('|');
    // con Sofascore la nota no dice nada por sí sola: se añade lo que vale en Mister
    const equiv = (v !== undefined && esNota())
      ? ` → ${notaAPuntos(v) > 0 ? '+' : ''}${notaAPuntos(v)} pts` : '';
    const t = v===undefined ? `J${n}: no jugó`
      : `J${n} ${sede==='C'?'casa':'fuera'}: ${v}${equiv}`;
    return `<i class="pt ${nivel(v)}${dentro?'':' off'}" data-ayuda="${t}">${v===undefined?'':v}</i>`;
  }).join('');
}

const fmt = (v,d) => (v===null||v===undefined) ? '<span class="tenue">·</span>'
  : (d ? v.toFixed(d) : String(v));

/* ================================================================
   AYUDAS
   Las abreviaturas de las columnas no se explican solas, asi que
   cada una lleva su frase y aparece al pasar el raton por encima.
   ================================================================ */

const AYUDA = {
  cmp:  'Mandar al comparador',
  pos:  'Posición en el campo',
  e:    'Equipo',
  n:    'Nombre del jugador',
  val:  'Valor de mercado en Mister',
  racha:'Últimas jornadas. Cuanto más verde, mejor puntuó. Los apagados están fuera por los filtros',
  tit:  'Veces que ha salido de titular. Si entró desde el banquillo no cuenta',
  ult:  'Cuántos de los últimos partidos de su equipo ha jugado. Se mira sobre los partidos reales, sin que le afecten tus exclusiones',
  ultMin:'Minutos sumados en los últimos partidos de su equipo',
  pj:   'Partidos jugados que entran en el cálculo. Si ves 4/6, es que dos quedan fuera por tus filtros',
  med:  'Media de puntos por partido',
  mdn:  'Mediana: el valor del medio. Un partidazo suelto no la infla, así que dice mejor lo que suele hacer',
  cas:  'Media de puntos jugando en casa',
  fue:  'Media de puntos jugando fuera',
  dif:  'Media en casa menos media fuera. En verde si rinde mejor en casa',
  tot:  'Suma de todos los puntos',
  g:    'Goles marcados',
  atot: 'Asistencias, de gol y sin gol juntas',
  a:    'Asistencias que acabaron en gol',
  asg:  'Asistencias que no acabaron en gol',
  y:    'Tarjetas amarillas',
  r:    'Tarjetas rojas',
  med5: 'Media de los últimos 5 partidos que cuentan. Comparada con la media general, dice si está de dulce o de capa caída',
  mej:  'Su mejor jornada',
  peor: 'Su peor jornada',
  p10:  'Partidos en los que hizo 10 puntos o más. Los que te ganan la jornada',
  pneg: 'Partidos en los que hizo puntuación negativa. Los que te la hunden',
  p90:  'Puntos por cada 90 minutos jugados. Compara de tú a tú a un titular con un suplente',
  ptit: 'Porcentaje de sus partidos que jugó de titular',
  t:    'Tiros a puerta',
  oc:   'Ocasiones claras creadas',
  min:  'Minutos jugados en total',
  minU: 'Minutos jugados en los partidos que entran en el cálculo',
  mpm:  'Minutos por partido jugado',
  cam:  'Cuánto ha subido o bajado su valor hoy',
};

function arrancarAyudas(){
  const globo = document.createElement('div');
  globo.className = 'globo'; globo.hidden = true;
  document.body.appendChild(globo);
  let reloj = null;

  const esconder = () => { clearTimeout(reloj); globo.hidden = true; };

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-ayuda]');
    if(!el){ esconder(); return; }
    clearTimeout(reloj);
    reloj = setTimeout(() => {
      globo.textContent = el.dataset.ayuda;
      globo.hidden = false;
      const r = el.getBoundingClientRect(), g = globo.getBoundingClientRect();
      let x = r.left + r.width/2 - g.width/2;
      x = Math.max(8, Math.min(x, window.innerWidth - g.width - 8));
      const arriba = r.top > g.height + 12;
      globo.style.left = x + 'px';
      globo.style.top = (arriba ? r.top - g.height - 7 : r.bottom + 7) + 'px';
    }, 280);
  });
  document.addEventListener('mouseout', e => {
    if(e.target.closest('[data-ayuda]')) esconder();
  });
  window.addEventListener('scroll', esconder, {passive:true});
  document.addEventListener('click', esconder);
}

/* ---------- tarjetas (movil) ---------- */

const MOVIL = window.matchMedia
  ? window.matchMedia('(max-width:700px)')
  : {matches:false, addEventListener(){}};
const esMovil = () => MOVIL.matches;

// etiquetas cortas para las tarjetas, donde no cabe "Casa − fuera"
// columnas de la tira horizontal: el orden en que se leen en el movil
const TIRA = ['med','mdn','cas','fue','dif','ult','pj','tot','tit','g','atot','min','mpm','y','r','val','cam'];
const CORTO = {ult:'Jugados', tit:'Titular', atot:'Asis', med:'Media', mdn:'Mediana', dif:'Casa−fuera', mpm:'Min/P', tot:'Total',
               cas:'Casa', fue:'Fuera', min:'Min', val:'Valor', cam:'Hoy'};
const RACHA_TJ = 5;   // partidos visibles en la racha de la tarjeta

const colDe = k => COLS.find(x => x.k === k) || {k, t:k};
const rotuloTira = k => CORTO[k] || colDe(k).t;

function valorTira(f, k){
  const c = colDe(k);
  if(k === 'val') return f.val === null || f.val === undefined
    ? '<span class="tenue">·</span>' : millones(f.val);
  if(k === 'cam'){
    if(!f.cam) return '<span class="tenue">·</span>';
    return `${f.cam>0?'+':''}${(f.cam/1000).toFixed(0)}k`;
  }
  if(k === 'ult') return `${f.ult}<span class="tenue">/${f.ultDe}</span>`;
  if(k === 'pj' && f.pj !== f.disp) return `${f.pj}<span class="tenue">/${f.disp}</span>`;
  return fmt(f[k], c.dec);
}

function clasesTira(f, k){
  let cls = k === estado.orden ? ' act' : '';
  if(k === 'ult') cls += f.ult === 0 ? ' fuera' : '';
  else if(k === 'dif') cls += f.dif === null ? '' : f.dif > 0 ? ' dif-pos' : f.dif < 0 ? ' dif-neg' : '';
  else if(k === 'cam' && f.cam) cls += f.cam > 0 ? ' sube' : ' baja';
  else if(colDe(k).cls) cls += ' ' + colDe(k).cls;
  return cls;
}

function datosTarjeta(f){
  return '<div class="tj-datos-int">' + TIRA.map(k =>
    `<span class="d${clasesTira(f,k)}"${AYUDA[k] ? ` data-ayuda="${rotuloTira(k)}: ${AYUDA[k]}"` : ''
      }>${valorTira(f,k)}</span>`).join('') + '</div>';
}

// la tira de cabecera: rotula las columnas y a la vez elige el orden
function pintarTira(){
  document.getElementById('tira').innerHTML = '<div class="tira-int">' + TIRA.map(k => {
    const act = k === estado.orden;
    return `<button class="mt${act?' act':''}" data-k="${k}" aria-pressed="${act}"${
      AYUDA[k] ? ` data-ayuda="${AYUDA[k]}"` : ''}>${rotuloTira(k)}${
      act ? `<i>${estado.asc?'↑':'↓'}</i>` : ''}</button>`;
  }).join('') + '</div>';
}

// los números de todas las tarjetas siguen a la cabecera con un solo cambio de estilo
function seguirTira(){
  const t = document.getElementById('tira');
  document.getElementById('tarjetas').style.setProperty('--dx', (-t.scrollLeft) + 'px');
}

// en el movil no se pintan los 450 de golpe: se van pidiendo de 80 en 80
const TANDA = 80;
let tope = TANDA;
let arrastre = false;   // true mientras se desliza la tira sobre una tarjeta
let largo = false;      // true si la ultima pulsacion fue larga (mandar al comparador)

function pintarTarjetas(filas){
  const caja = document.getElementById('tarjetas');
  if(!filas.length){
    caja.innerHTML = '<div class="tj-vacio">Ningún jugador cumple estos filtros.<br>Prueba a bajar los partidos mínimos.</div>';
    return;
  }
  const quedan = filas.length - tope;
  caja.innerHTML = filas.slice(0, tope).map((f,i) => {
    const p = POS[f.pos], e = EQUIPO[f.e];
    const cam = !f.cam ? ''
      : subidaHoy(f.cam, f.val);
    const val = (f.val === null || f.val === undefined) ? '' : millones(f.val);
    return `<article class="tj" data-i="${i}" data-k="${f.n + '|' + f.e}">
      <div class="tj-cab">
        ${p ? insignia(p[0], p[1], f.pos) : ''}${escudo(f.e, f.e)}
        <span class="tj-n">${f.n}</span>
        <span class="tj-racha">${pintarRacha(f, RACHA_TJ)}</span>
        <span class="tj-val">${val}${cam}</span>
      </div>
      <div class="tj-datos">${datosTarjeta(f)}</div>
    </article>`;
  }).join('') + (quedan > 0
    ? `<button class="tj-mas" id="tj-mas">Ver ${quedan} jugador${quedan===1?'':'es'} más</button>` : '');
}

function pintarTabla(filas, k){
  document.getElementById('cabeceras').innerHTML = COLS.map(c =>
    `<th class="${c.txt?'nom':c.insig?'cen':c.racha?'racha':c.cls==='dif'?'dif':''} ${c.sep?'sep':''} ${c.pega?'pega '+c.pega:''} ${k===c.k?'activo':''}" data-k="${c.k}"${
      AYUDA[c.k] ? ` data-ayuda="${AYUDA[c.k]}"` : ''}>${c.t}${k===c.k?(estado.asc?' ↑':' ↓'):''}</th>`
  ).join('');

  document.getElementById('cuerpo').innerHTML = filas.length ? filas.map((f,i) =>
    '<tr data-i="'+i+'">' + COLS.map(c => {
      const s = (c.sep ? ' sep' : '') + (c.pega ? ' pega ' + c.pega : '');
      if(c.cmp) return `<td class="cen${s}">${botonCarro(f.n + '|' + f.e)}</td>`;
      if(c.insig === 'pos'){
        const p = POS[f.pos];
        return `<td class="cen${s}">${p ? insignia(p[0], p[1], f.pos) : '<span class="tenue">·</span>'}</td>`;
      }
      if(c.insig === 'eq'){
        const e = EQUIPO[f.e];
        return `<td class="cen${s}">${escudo(f.e, f.e)}</td>`;
      }
      if(c.racha) return `<td class="racha${s}">${pintarRacha(f)}</td>`;
      if(c.txt) return `<td class="nom${s}">${f[c.k]||'<span class="tenue">·</span>'}</td>`;
      if(c.ultimos) return `<td class="${f.ult===0?'fuera':''}${s}">${f.ult}<span class="tenue">/${f.ultDe}</span></td>`;
      if(c.k==='pj' && f.pj !== f.disp) return `<td class="sep">${f.pj}<span class="tenue">/${f.disp}</span></td>`;
      if(c.mercado) return `<td class="val${s}">${f.val===null||f.val===undefined?'<span class="tenue">·</span>':eur(f.val)}</td>`;
      if(c.cambio){
        if(f.cam===null||f.cam===undefined) return '<td><span class="tenue">·</span></td>';
        const sig = f.cam>0?'+':'';
        const pc = f.val ? ` <em>${f.cam>0?'+':''}${(f.cam/f.val*100).toFixed(2)}%</em>` : '';
        return `<td class="${f.cam>0?'sube':f.cam<0?'baja':'tenue'}">${sig}${
          (f.cam/1000).toFixed(0)}k${pc}</td>`;
      }
      let cls = (c.cls || '') + s;
      if(c.dif) cls = 'dif' + s + ' ' + (f.dif===null ? '' : f.dif>0 ? 'dif-pos' : f.dif<0 ? 'dif-neg' : '');
      if(c.k==='g' && estado.exGol && f.g>0) return `<td class="fuera sep" title="Jornadas descartadas">${f.g} ✕</td>`;
      return `<td class="${cls}">${fmt(f[c.k], c.dec)}</td>`;
    }).join('') + '</tr>'
  ).join('') : `<tr><td class="vacio" colspan="${COLS.length}">Ningún jugador cumple estos filtros. Prueba a bajar los partidos mínimos.</td></tr>`;
}

function pintar(){
  const q = estado.buscar.toLowerCase();
  let filas = DATOS.jugadores
    .filter(j => !estado.equipos.size ||
      (estado.modoEq==='incluir' ? estado.equipos.has(j.e) : !estado.equipos.has(j.e)))
    .filter(j => !estado.pos.size || estado.pos.has(j.pos))
    .filter(j => !q || j.n.toLowerCase().includes(q) || j.nc.toLowerCase().includes(q))
    .filter(j => {
      if(estado.valMin !== null && !(j.val >= estado.valMin)) return false;
      if(estado.valMax !== null && !(j.val <= estado.valMax)) return false;
      if(estado.camMin !== null && !(j.cam >= estado.camMin)) return false;
      return true;
    })
    .map(calcular).filter(Boolean)
    .filter(f => {
      if(estado.juOn    && (estado.juTit ? f.ultTit : f.ult) < estado.juCuantos) return false;
      if(estado.juTotOn && f.ultMin < estado.juTotMin)  return false;
      if(estado.juUltimo && !f.ultimo) return false;
      return true;
    })
    .filter(f => Object.entries(estado.stats).every(([k,c]) => {
      const v = f[k];
      if(v === null || v === undefined) return false;
      if(c.min !== null && c.min !== undefined && v < c.min) return false;
      if(c.max !== null && c.max !== undefined && v > c.max) return false;
      return true;
    }))
    .filter(f => estado.rangos.every(c => {
      const v = f[c.k];
      if(v === null || v === undefined) return false;
      if(c.min !== null && v < c.min) return false;
      if(c.max !== null && v > c.max) return false;
      return true;
    }));

  const k = estado.orden;
  filas.sort((x,z)=>{
    let A=x[k], B=z[k];
    if(typeof A==='string') return estado.asc ? A.localeCompare(B) : B.localeCompare(A);
    if(A===null||A===undefined) return 1;
    if(B===null||B===undefined) return -1;
    return estado.asc ? A-B : B-A;
  });

  const movil = esMovil();
  tope = TANDA;
  document.querySelector('.tabla-caja').hidden = movil;
  document.getElementById('tarjetas').hidden = !movil;
  document.getElementById('barra-orden').hidden = !movil;
  if(movil){
    const t = document.getElementById('tira'), x = t.scrollLeft;
    pintarTira();
    t.scrollLeft = x;          // repintar no debe devolver la tira al principio
    pintarTarjetas(filas);
    seguirTira();
  } else pintarTabla(filas, k);

  document.getElementById('resumen').innerHTML =
    `<span><strong>${filas.length}</strong> jugadores</span>` +
    `<span>${filas.filter(f=>f.dif!==null).length} con partidos en casa y fuera</span>` +
    (esNota() ? '<span class="escala">nota Sofascore, escala 0-10</span>' : '') +
    '<span class="pista">mantén pulsado un jugador para compararlo</span>';

  pintarActivos();
  marcarBotones();
  pintarCarro();
  window.__filas = filas;
}

/* ---------- filtros activos ---------- */

function listaActivos(){
  const L = [];
  if(estado.sede) L.push({t:'Solo ' + (estado.sede==='C'?'casa':'fuera'), q:()=>ponerSede('')});
  if(estado.minpj > 1) L.push({t:`Mínimo ${estado.minpj} partidos`, q:()=>{
    estado.minpj = 1; document.getElementById('minpj').value = 1; }});
  for(const p of estado.pos) L.push({t:p, q:()=>{
    estado.pos.delete(p); marcarCasilla('panel-pos', p, false); }});
  if(estado.equipos.size) L.push({
    t:(estado.modoEq==='incluir'?'Solo ':'Sin ') + [...estado.equipos].join(', '),
    q:()=>{ estado.equipos.clear(); todasCasillas('panel-equipos', false); }});
  if(estado.rivales.size) L.push({
    t:'Sin jugar contra ' + [...estado.rivales].join(', '),
    q:()=>{ estado.rivales.clear(); todasCasillas('panel-rivales', false);
            document.getElementById('nota-rival').hidden = true; }});
  if(estado.valMin !== null) L.push({t:`Valor desde ${estado.valMin/1e6}M`, q:()=>{
    estado.valMin = null; document.getElementById('val-min').value=''; }});
  if(estado.valMax !== null) L.push({t:`Valor hasta ${estado.valMax/1e6}M`, q:()=>{
    estado.valMax = null; document.getElementById('val-max').value=''; }});
  if(estado.camMin !== null) L.push({t:`Sube hoy ${estado.camMin/1e3}k o más`, q:()=>{
    estado.camMin = null; document.getElementById('cam-min').value=''; }});
  if(estado.juOn) L.push({
    t:`${estado.juTit?'Titular en':'Jugó'} ${estado.juCuantos} de los últimos ${estado.ultN}`, q:()=>{
    estado.juOn=false; document.getElementById('ju-min').checked=false; }});
  if(estado.juTotOn) L.push({
    t:`${estado.juTotMin} min en los últimos ${estado.ultN}`, q:()=>{
    estado.juTotOn=false; document.getElementById('ju-tot').checked=false; }});
  if(estado.juUltimo) L.push({t:'Jugó el último partido', q:()=>{
    estado.juUltimo=false; document.getElementById('ju-ultimo').checked=false; }});
  if(estado.exGol) L.push({t:'Sin jornadas con gol', q:()=>{
    estado.exGol=false; document.getElementById('ex-gol').checked=false; }});
  if(estado.exRoja) L.push({t:'Sin jornadas con roja', q:()=>{
    estado.exRoja=false; document.getElementById('ex-roja').checked=false; }});
  if(estado.exMin) L.push({t:`Sin partidos de menos de ${estado.minMinutos} min`, q:()=>{
    estado.exMin=false; document.getElementById('ex-min').checked=false; }});
  for(const n of estado.excluidas) L.push({t:'Sin J'+n, q:()=>{
    estado.excluidas.delete(n);
    const c = document.querySelector(`#jornadas .chip[data-j="${n}"]`);
    if(c) c.setAttribute('aria-pressed','false'); }});
  for(const [k,c] of Object.entries(estado.stats)){
    const m = STATS.find(x=>x.k===k); if(!m) continue;
    const a1 = (c.min!==null&&c.min!==undefined) ? `desde ${c.min}` : '';
    const b1 = (c.max!==null&&c.max!==undefined) ? `hasta ${c.max}` : '';
    if(!a1 && !b1) continue;
    L.push({t:`${m.t} ${[a1,b1].filter(Boolean).join(' ')}`, q:()=>{
      delete estado.stats[k];
      const f = document.querySelector(`#panel-stats [data-st="${k}"]`);
      if(f){ f.querySelector('.st-min').value=''; f.querySelector('.st-max').value=''; }
    }});
  }
  estado.rangos.forEach((c,i) => {
    const m = METRICAS.find(x=>x.k===c.k); if(!m) return;
    if(c.min===null && c.max===null) return;
    const a = c.min!==null ? `desde ${c.min}` : '';
    const b = c.max!==null ? `hasta ${c.max}` : '';
    L.push({t:`${m.t} ${[a,b].filter(Boolean).join(' ')}`, q:()=>{
      estado.rangos.splice(i,1); pintarRangos(); }});
  });
  return L;
}

function pintarActivos(){
  const L = listaActivos();
  const caja = document.getElementById('activos');
  // una sola linea de texto, sin cajas: los filtros ya se ven en sus botones
  caja.innerHTML = L.length
    ? `<span class="ac-t">Filtrando por</span>` + L.map((x,i) =>
        `<span class="ac" data-i="${i}" title="Quitar este filtro">${x.t}<i>×</i></span>`
      ).join('') + '<button class="todos" id="limpiar-todo">quitar todo</button>'
    : '';
  window.__activos = L;
}

function limpiarTodo(){
  estado.sede = ''; ponerSede('');
  estado.minpj = 1; document.getElementById('minpj').value = 1;
  estado.pos.clear(); todasCasillas('panel-pos', false);
  estado.equipos.clear(); todasCasillas('panel-equipos', false);
  estado.rivales.clear(); todasCasillas('panel-rivales', false);
  document.getElementById('nota-rival').hidden = true;
  estado.valMin = estado.valMax = estado.camMin = null;
  ['val-min','val-max','cam-min'].forEach(i => document.getElementById(i).value = '');
  estado.exGol = estado.exRoja = estado.exMin = false;
  ['ex-gol','ex-roja','ex-min'].forEach(i => document.getElementById(i).checked = false);
  estado.juOn = estado.juTotOn = estado.juUltimo = estado.juTit = false;
  ['ju-min','ju-tot','ju-ultimo','ju-tit'].forEach(i => document.getElementById(i).checked = false);
  estado.excluidas.clear();
  document.querySelectorAll('#jornadas .chip').forEach(c => c.setAttribute('aria-pressed','false'));
  estado.rangos = []; pintarRangos();
  estado.stats = {};
  document.querySelectorAll('#panel-stats input').forEach(i => i.value = '');
  document.querySelectorAll('.sub-cuerpo').forEach(s => s.hidden = true);
  document.querySelectorAll('.sub-cab').forEach(s => s.setAttribute('aria-expanded','false'));
}

document.getElementById('activos').addEventListener('click', e => {
  if(e.target.id === 'limpiar-todo'){ limpiarTodo(); pintar(); return; }
  const b = e.target.closest('[data-i]'); if(!b) return;
  window.__activos[+b.dataset.i].q();
  pintar();
});

function marcarCasilla(panel, valor, on){
  const el = document.querySelector(`#${panel} input[value="${valor}"]`);
  if(el) el.checked = on;
}
function todasCasillas(panel, on){
  document.querySelectorAll(`#${panel} input`).forEach(i => i.checked = on);
}

function cuentas(){
  return {
    pos: estado.pos.size,
    equipos: estado.equipos.size,
    valor: (estado.valMin!==null?1:0)+(estado.valMax!==null?1:0)+(estado.camMin!==null?1:0),
    juega: (estado.juOn?1:0)+(estado.juTotOn?1:0)+(estado.juUltimo?1:0),
    excluir: estado.rivales.size + estado.excluidas.size
             + (estado.exGol?1:0) + (estado.exRoja?1:0) + (estado.exMin?1:0),
    stats: Object.values(estado.stats).filter(c =>
      (c.min!==null&&c.min!==undefined) || (c.max!==null&&c.max!==undefined)).length,
    cond: estado.rangos.filter(c=>c.min!==null||c.max!==null).length,
  };
}

function marcarBotones(){
  const c = cuentas();
  document.querySelectorAll('.filtro').forEach(b => {
    const n = c[b.dataset.p] || 0;
    b.classList.toggle('activo', n > 0);
    const base = b.textContent.replace(/\s*\d+$/, '').trim();
    b.textContent = n ? `${base} ${n}` : base;
  });
}

/* ================================================================
   COMPARADOR
   Funciona como un carrito: desde la lista o desde la ficha mandas
   jugadores al comparador, y ahi eliges que datos quieres enfrentar.
   ================================================================ */

// alto:1 mejor cuanto mas alto · alto:0 mejor cuanto mas bajo · alto:null sin ganador
const ATRIB = [
  {k:'med',  t:'Media',               dec:2, alto:1},
  {k:'mdn',  t:'Mediana',             dec:1, alto:1},
  {k:'cas',  t:'Media en casa',       dec:2, alto:1},
  {k:'fue',  t:'Media fuera',         dec:2, alto:1},
  {k:'dif',  t:'Casa − fuera',        dec:2, alto:1},
  {k:'tot',  t:'Puntos totales',      dec:1, alto:1},
  {k:'pj',   t:'Partidos jugados',           alto:1},
  {k:'tit',  t:'Titularidades',              alto:1},
  {k:'ult',  t:'Jugados de los últimos',      alto:1},
  {k:'ultMin',t:'Minutos en los últimos',     alto:1},
  {k:'g',    t:'Goles',                      alto:1},
  {k:'a',    t:'Asistencias de gol',         alto:1},
  {k:'asg',  t:'Asistencias sin gol',        alto:1},
  {k:'atot', t:'Asistencias totales',        alto:1},
  {k:'min',  t:'Minutos',                    alto:1},
  {k:'mpm',  t:'Minutos por partido',        alto:1},
  {k:'y',    t:'Amarillas',                  alto:0},
  {k:'r',    t:'Rojas',                      alto:0},
  {k:'val',  t:'Valor',             dinero:1, alto:null},
  {k:'cam',  t:'Sube hoy',          dinero:1, alto:1},
];

const clave = j => j.n + '|' + j.e;
let INDICE = {};   // clave -> jugador, para recuperar a los del comparador

function enCarro(k){ return estado.carro.includes(k); }

function alternarCarro(k){
  const i = estado.carro.indexOf(k);
  if(i >= 0) estado.carro.splice(i, 1);
  else if(estado.carro.length < 8) estado.carro.push(k);
  else return false;
  pintarCarro();
  return true;
}

function pintarCarro(){
  const n = estado.carro.length;
  document.getElementById('carro').hidden = n === 0;
  document.getElementById('carro-n').textContent = n;
  // marcar en la lista quien ya esta dentro
  document.querySelectorAll('.tj[data-k]').forEach(t =>
    t.classList.toggle('puesto', enCarro(t.dataset.k)));
  document.querySelectorAll('[data-cmp]').forEach(b => {
    const dentro = enCarro(b.dataset.cmp);
    b.classList.toggle('puesto', dentro);
    b.setAttribute('aria-pressed', dentro ? 'true' : 'false');
    b.dataset.ayuda = dentro ? 'Quitar del comparador' : 'Mandar al comparador';
  });
  if(document.getElementById('comparador').open) pintarComparador();
}

function botonCarro(k){
  return `<button class="mas-cmp${enCarro(k)?' puesto':''}" data-cmp="${k}"
    aria-pressed="${enCarro(k)}" data-ayuda="${enCarro(k)?'Quitar del comparador':'Mandar al comparador'}">+</button>`;
}

function valorAtrib(f, a){
  const v = f[a.k];
  if(v === null || v === undefined) return '<span class="tenue">·</span>';
  if(a.dinero) return a.k === 'cam'
    ? `${v>0?'+':''}${(v/1000).toFixed(0)}k` : eur(v);
  return a.dec ? v.toFixed(a.dec) : String(v);
}

function pintarAtrib(){
  document.getElementById('cmp-atrib').innerHTML = ATRIB.map(a => {
    const i = estado.atrib.indexOf(a.k);
    return `<button class="at${i>=0?' act':''}" data-at="${a.k}" aria-pressed="${i>=0}">${
      i>=0 ? `<b>${i+1}</b>` : ''}${a.t}</button>`;
  }).join('');
}

function pintarComparador(){
  const fichas = estado.carro
    .map(k => INDICE[k] ? Object.assign(calcular(INDICE[k], true) || {}, {clave:k}) : null)
    .filter(f => f && f.n);

  document.getElementById('cmp-sub').textContent = fichas.length
    ? `${fichas.length} jugador${fichas.length===1?'':'es'} · ${DATOS.fuentes[estado.fuente]}`
    : '';

  const cuerpo = document.getElementById('cmp-cuerpo');
  if(!fichas.length){
    cuerpo.innerHTML = '<div class="cmp-vacio">Todavía no has mandado a nadie aquí.<br>' +
      '<span class="solo-movil">Mantén pulsado un jugador en la lista</span>' +
      '<span class="solo-escritorio">Marca el círculo de la izquierda en la lista</span>' +
      ', o usa el buscador de aquí arriba.</div>';
    document.getElementById('cmp-pie').textContent = '';
    return;
  }

  const filas = estado.atrib.map(k => ATRIB.find(a => a.k === k)).filter(Boolean);

  /* Rejilla tranquila: el dato es el numero. Lo unico que destaca es el
     mejor de cada fila, y solo con el peso de la letra. Las rayas finas
     entre filas son lo que lleva el ojo de izquierda a derecha. */
  const celda = (f, a, mejor) => {
    const v = f[a.k];
    if(v === null || v === undefined) return '<td class="cg vacia">·</td>';
    const gana = mejor !== null && v === mejor;
    return `<td class="cg${gana ? ' mejor' : ''}">${valorAtrib(f, a)}</td>`;
  };

  const gana = {};
  let cuerpoTabla = '';

  for(const a of filas){
    const vals = fichas.map(f => f[a.k]).filter(v => v !== null && v !== undefined);
    let mejor = null;
    if(a.alto !== null && vals.length > 1 && Math.min(...vals) !== Math.max(...vals))
      mejor = a.alto ? Math.max(...vals) : Math.min(...vals);

    cuerpoTabla += `<tr><th class="cg-rot"${AYUDA[a.k] ? ` data-ayuda="${AYUDA[a.k]}"` : ''
      }>${a.t}</th>` + fichas.map(f => celda(f, a, mejor)).join('') + '</tr>';

    if(mejor !== null){
      const g = fichas.filter(f => f[a.k] === mejor);
      if(g.length === 1) gana[g[0].n] = (gana[g[0].n] || 0) + 1;
    }
  }

  // la racha no es una magnitud: va con sus propios colores, sin teñir
  cuerpoTabla += `<tr><th class="cg-rot" data-ayuda="${AYUDA.racha}">Racha</th>` +
    fichas.map(f => `<td class="cg-racha">${pintarRacha(f, 5)}</td>`).join('') + '</tr>';

  const cab = '<thead><tr><th class="cg-rot"></th>' + fichas.map(f => {
    const p = POS[f.pos], e = EQUIPO[f.e];
    return `<th class="cg-jug">
      <button class="cg-quitar" data-quitar="${f.clave}" aria-label="Quitar">&times;</button>
      <span class="cg-ins">${p ? insignia(p[0],p[1],f.pos) : ''}${escudo(f.e, f.e)}</span>
      <span class="cg-n">${f.n}</span></th>`;
  }).join('') + '</tr></thead>';

  const orden = Object.entries(gana).sort((a,b) => b[1]-a[1]);
  const veredicto = (orden.length && filas.length > 1 && fichas.length > 1)
    ? `<div class="cmp-veredicto"><b>${orden[0][0]}</b> gana en ${orden[0][1]} de ${filas.length}</div>`
    : '';

  cuerpo.innerHTML = veredicto +
    `<div class="cg-caja"><table class="cg-tabla">${cab}<tbody>${cuerpoTabla}</tbody></table></div>`;
  document.getElementById('cmp-pie').innerHTML = filas.length
    ? `<span>En negrita, el mejor de cada fila. Sobre ${DATOS.fuentes[estado.fuente]}, ` +
      'con los filtros de exclusión que tengas puestos.</span>'
    : '<span>Elige arriba qué datos quieres comparar.</span>';
}

/* ================================================================
   BALANCE DE FICHAJES

   Dos columnas: lo que vendes y lo que compras. Dice si te llega el
   dinero, hoy y dentro de unos días.

   Lo que hay que tener en cuenta, y que es fácil olvidar al hacerlo
   a ojo:

   - Al vender, lo que te ofrecen no es exactamente el valor: Mister
     puja entre el 95 % y el 105 %. Por eso las ventas salen como una
     horquilla y no como un número.
   - Si a un jugador tuyo le has subido la cláusula, eso ya lo pagaste.
     No lo recuperas al venderlo, así que aquí se resta aparte.
   - Subir la cláusula de uno que fichas cuesta el 20 % de su valor por
     cada escalón, y eso hay que sumarlo a lo que pagas.
   - Y todo se mueve: en diez días el que vendes vale otra cosa y el
     que compras también.
   ================================================================ */

const BAL = {vende:[], compra:[], saldo:0, dias:null};
try {
  const g = JSON.parse(localStorage.getItem('balance') || '{}');
  Object.assign(BAL, g, {vende: g.vende || [], compra: g.compra || []});
} catch(_){}
const guardarBal = () => { try {
  localStorage.setItem('balance', JSON.stringify(BAL));
} catch(_){} };

const VENTA_MIN = 0.95, VENTA_MAX = 1.05;   // la horquilla de la oferta de Mister
const TOPE_DIAS = 20;

/* ---------- dinero escrito a mano ----------

   Nadie teclea 18752365. Se habla en millones, así que eso es lo que se
   escribe: "18,75" son 18.750.000. Por debajo de mil se entiende que
   hablas de millones; de mil para arriba, que estás poniendo la cifra
   entera. Admite además la M y la k por si acaso, y los puntos de millar.
   En español la coma nunca separa millares: si aparece, es la decimal. */
function leerDinero(txt){
  if(txt === null || txt === undefined) return null;
  let s = String(txt).trim().toLowerCase().replace(/[€\s ]/g, '');
  if(!s) return null;
  const neg = s.startsWith('-');
  if(neg) s = s.slice(1);

  let esc = 1, marcada = false;
  if(/[km]$/.test(s)){ esc = s.endsWith('k') ? 1e3 : 1e6; marcada = true; s = s.slice(0, -1); }

  const pto = s.lastIndexOf('.'), com = s.lastIndexOf(',');
  let dec = '';
  if(com > -1 && com > pto){                        // coma: siempre decimal
    dec = s.slice(com + 1); s = s.slice(0, com);
  } else if(pto > -1 && s.indexOf('.') === pto && /^\d{1,2}$/.test(s.slice(pto + 1))){
    dec = s.slice(pto + 1); s = s.slice(0, pto);    // un punto solo con 1-2 cifras detrás
  }
  const ent = s.replace(/\D/g, '');                 // lo demás, puntos de millar
  if(ent === '' && dec === '') return null;

  const n = parseFloat((ent || '0') + (dec ? '.' + dec.replace(/\D/g, '') : ''));
  if(!isFinite(n)) return null;
  if(!marcada && n < 1000) esc = 1e6;               // "18,75" son millones
  return Math.round(n * esc) * (neg ? -1 : 1);
}

/* Y cómo se le devuelve escrito cuando no está tecleando: en millones,
   que es como lo va a volver a leer. Sin perder un solo euro. */
function escribirDinero(n){
  if(n === null || n === undefined || !isFinite(n)) return '';
  return (+(n / 1e6).toFixed(6)).toString().replace('.', ',');
}

/* Cuándo empieza la próxima jornada: el primer partido que quede por
   jugar de cualquier equipo. Es el plazo que sale por defecto, porque
   es el momento en que todo se mueve. */
function diasProximaJornada(){
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let mejor = null;
  for(const eq in (DATOS.prox || {})){
    for(const x of DATOS.prox[eq]){
      const f = fechaProx(x[3], hoy);
      if(!f) continue;
      const d = Math.round((f - hoy) / 864e5);
      if(d >= 0 && (mejor === null || d < mejor)) mejor = d;
    }
  }
  return mejor === null ? null : Math.min(mejor, TOPE_DIAS);
}

const diasBal = () => BAL.dias === null ? (diasProximaJornada() ?? 0) : BAL.dias;

const COSTE_ESC = 0.20;      // subir un escalón de cláusula cuesta esto
const DEVUELVE_ESC = 0.10;   // y bajarlo te devuelve la mitad de eso

/* Lo que vale una operación. Cada fila puede llevar su propio precio
   escrito a mano; si no lo lleva, se usa lo que valdrá ese día. */
function cuentaFila(fila, dias){
  const j = INDICE[fila.k];
  if(!j) return null;
  const val = j.val || 0;
  const proyectado = dias > 0 ? valorPotencial({val, ref:j}, dias).techo : val;
  // lo que pagas o te dan: lo tuyo manda sobre la proyección
  const precio = (fila.precio === null || fila.precio === undefined)
    ? proyectado : +fila.precio;
  const esc = +fila.esc || 0;
  // la cláusula se calcula sobre la base que digas: si hiciste un clausulazo,
  // no es su valor de mercado, es lo que pagaste
  const base = (fila.base === null || fila.base === undefined) ? precio : +fila.base;
  const clausula = COSTE_ESC * esc * base;
  const suyo = !!fila.suyo;               // ya lo tienes: solo pagas la cláusula

  /* Bajarle la cláusula a uno que te quedas también es dinero que entra.
     Mister devuelve la mitad de lo que costó subirla, y la calcula sobre
     lo que pagaste por él, salvo que hoy valga más: entonces, sobre lo
     que vale. Por eso la base es el mayor de los dos. */
  const baja = !!fila.baja;
  const mequedo = baja && !!fila.mequedo;   // le bajo la cláusula pero no lo suelto
  const escAct = Math.min(MULT.length - 1, Math.max(0, +fila.escAct || 0));
  const escFin = Math.min(escAct, Math.max(0, +fila.escFin || 0));
  const pague = (fila.pague === null || fila.pague === undefined)
    ? proyectado : +fila.pague;
  const baseBaja = Math.max(pague, proyectado);
  const devuelve = baja ? DEVUELVE_ESC * (escAct - escFin) * baseBaja : 0;

  const aMano = fila.precio !== null && fila.precio !== undefined;
  const venta = mequedo ? 0 : precio;
  // lo único que baila con la horquilla del 95-105 % es el traspaso, y solo
  // si no le has puesto precio tú. La devolución de la cláusula es fija.
  const flotante = (mequedo || aMano) ? 0 : precio;

  const total = baja ? venta + devuelve : (suyo ? 0 : precio) + clausula;
  return {j, val, proyectado, precio, esc, base, clausula, suyo, total,
          baja, mequedo, escAct, escFin, pague, baseBaja, devuelve, venta, flotante,
          aPagado: fila.pague !== null && fila.pague !== undefined, aMano};
}

/* De dónde ha salido la base de la devolución, dicho en una línea. Si no
   ha escrito lo que pagó, la casilla lleva el valor de hoy: entonces no
   se le puede decir "lo que pagaste", porque no lo ha dicho. */
function textoBase(c){
  if(c.baseBaja > c.pague) return 'que es lo que vale';
  return c.aPagado ? 'que es lo que pagaste' : 'que es lo que vale hoy';
}

function filaBalance(cual, fila, c, i){
  const vende = cual === 'vende';
  // una casilla de dinero: texto libre, con el euro leído debajo para que
  // se vea al momento que lo ha entendido
  const campo = (etq, cual2, cual3, valor, txt) => {
    const escrito = txt !== null && txt !== undefined && txt !== ''
      ? txt : escribirDinero(valor);
    return `
    <label class="bal-campo">
      <span>${etq}</span>
      <input type="text" data-${cual2}="${cual}|${i}" value="${escrito}"
        inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="18,75">
      <em class="bal-leido" data-leido="${cual2}|${cual}|${i}">${euros(valor)}</em>
    </label>`;
  };

  return `<div class="bal-f">
    <div class="bal-quien">
      ${escudo(c.j.e, c.j.e)}<span class="bal-n">${c.j.n}</span>
      <b class="${vende ? 'sube' : 'baja'}" data-tot="${cual}|${i}"
        >${vende ? '+' : '−'}${eur(c.total)}</b>
      <button class="bal-x" data-quita="${cual}|${i}" aria-label="Quitar">&times;</button>
    </div>

    <div class="bal-campos">
      ${(c.suyo || c.mequedo) ? ''
        : campo(vende ? 'Te dan' : 'Pagas', 'precio', cual, c.precio, fila.precioTxt)}
      <div class="bal-campo quieto">
        <span>${BAL.__dias ? 'valdrá' : 'vale'}</span>
        <div>${eur(c.proyectado)}</div>
      </div>
    </div>

    ${!vende ? '' : `
    <label class="bal-chk"><input type="checkbox" data-baja="${cual}|${i}"${
      c.baja ? ' checked' : ''}><span>Le bajo la cláusula antes</span></label>

    ${!c.baja ? '' : `
    <div class="bal-campos">
      <label class="bal-campo">
        <span>La tengo a</span>
        <select data-escact="${cual}|${i}">
          ${MULT.map((m, k) => `<option value="${k}"${k===c.escAct?' selected':''}
            >×${m.toFixed(1).replace('.', ',')}</option>`).join('')}
        </select>
      </label>
      <label class="bal-campo">
        <span>La bajo a</span>
        <select data-escfin="${cual}|${i}">
          ${MULT.map((m, k) => k > c.escAct ? '' : `<option value="${k}"${
            k===c.escFin?' selected':''}>×${m.toFixed(1).replace('.', ',')}</option>`).join('')}
        </select>
      </label>
      ${campo('Pagué por él', 'pague', cual, c.pague, fila.pagueTxt)}
    </div>
    <p class="bal-nota" data-nota="${cual}|${i}">${
      c.escAct === c.escFin
        ? 'Elige a cuánto la tienes y a cuánto la dejas.'
        : `Te devuelven <b>${eur(c.devuelve)}</b>, que es la mitad de lo que costó
           subirla. Calculado sobre <b>${eur(c.baseBaja)}</b>, ${textoBase(c)}.${
             c.mequedo ? '' : ` Y al venderlo, <b>${eur(c.venta)}</b> más.`}`}</p>

    <label class="bal-chk"><input type="checkbox" data-mequedo="${cual}|${i}"${
      c.mequedo ? ' checked' : ''}><span>Y me lo quedo, no lo vendo</span></label>`}`}

    ${vende ? '' : `
    <label class="bal-chk"><input type="checkbox" data-suyo="${cual}|${i}"${
      c.suyo ? ' checked' : ''}><span>Ya lo tengo, solo le subo la cláusula</span></label>

    <div class="bal-campos">
      <label class="bal-campo">
        <span>Cláusula</span>
        <select data-esc="${cual}|${i}">
          ${MULT.map((m, k) => `<option value="${k}"${k===c.esc?' selected':''}
            >${k === 0 ? 'no la toco' : '×' + m.toFixed(1).replace('.', ',')}</option>`).join('')}
        </select>
      </label>
      ${c.esc ? campo('Calculada sobre', 'base', cual, c.base, fila.baseTxt) : ''}
    </div>
    ${c.esc ? `<p class="bal-nota" data-nota="${cual}|${i}">Subirla cuesta
      <b>${eur(c.clausula)}</b> y la cláusula queda en
      <b>${eur(c.base * MULT[c.esc])}</b></p>` : ''}`}
  </div>`;
}

function pintarBalance(){
  const dias = diasBal();
  BAL.__dias = dias;
  const caja = document.getElementById('bal-cuerpo');
  const prox = diasProximaJornada();

  const lado = (cual, titulo, vacio) => {
    const filas = BAL[cual];
    const cuentas = filas.map(f => cuentaFila(f, dias));
    const cuerpo = filas.length
      ? cuentas.map((c, i) => c ? filaBalance(cual, filas[i], c, i) : '').join('')
      : `<p class="bal-vacio">${vacio}</p>`;
    return `<section class="bal-lado ${cual}">
      <h3>${titulo} <span>${filas.length || ''}</span></h3>
      ${cuerpo}
      <div class="bal-busca">
        <input type="text" data-busca="${cual}" placeholder="Añadir jugador…" autocomplete="off">
        <div class="bal-sug" data-sug-de="${cual}" hidden></div>
      </div>
    </section>`;
  };

  caja.innerHTML = `
    <div class="bal-plazo">
      <div class="bal-slider">
        <input type="range" id="bal-dias" min="0" max="${TOPE_DIAS}" value="${dias}">
        <output>${dias === 0 ? 'hoy' : dias + ' d'}</output>
      </div>
      ${prox !== null ? `<button id="bal-prox" class="${BAL.dias === null ? 'act' : ''}"
        >Próxima jornada${prox ? ` · ${prox} d` : ''}</button>` : ''}
    </div>
    <div class="bal-lados">
      ${lado('vende', 'Vendo', 'Añade los que vas a soltar.')}
      ${lado('compra', 'Compro', 'Añade a quien fiches o a quien quieras subirle la cláusula.')}
    </div>`;

  document.getElementById('bal-saldo').value = BAL.saldoTxt !== undefined
    ? BAL.saldoTxt : (BAL.saldo ? escribirDinero(BAL.saldo) : '');
  totalesBalance();
}

/* Los números de abajo y las cifras de cada fila. Va aparte porque
   mientras escribes en una casilla hay que actualizar esto sin volver a
   generar la casilla: si se regenera, se pierde el cursor. */
function totalesBalance(){
  const dias = BAL.__dias;

  for(const cual of ['vende', 'compra']){
    BAL[cual].forEach((fila, i) => {
      const c = cuentaFila(fila, dias);
      if(!c) return;
      const tot = document.querySelector(`[data-tot="${cual}|${i}"]`);
      if(tot) tot.textContent = (cual === 'vende' ? '+' : '−') + eur(c.total);
      const nota = document.querySelector(`[data-nota="${cual}|${i}"]`);
      if(nota && c.baja && c.escAct !== c.escFin) nota.innerHTML =
        `Te devuelven <b>${eur(c.devuelve)}</b>, que es la mitad de lo que costó` +
        ` subirla. Calculado sobre <b>${eur(c.baseBaja)}</b>, ` +
        textoBase(c) + '.' +
        (c.mequedo ? '' : ` Y al venderlo, <b>${eur(c.venta)}</b> más.`);
      else if(nota && c.esc) nota.innerHTML = `Subirla cuesta <b>${eur(c.clausula)}</b>` +
        ` y la cláusula queda en <b>${eur(c.base * MULT[c.esc])}</b>`;
      for(const [campo, valor] of [['precio', c.precio], ['base', c.base],
                                   ['pague', c.pague]]){
        const le = document.querySelector(`[data-leido="${campo}|${cual}|${i}"]`);
        if(le) le.textContent = euros(valor);
      }
    });
  }

  const v = BAL.vende.map(f => cuentaFila(f, dias)).filter(Boolean);
  const c = BAL.compra.map(f => cuentaFila(f, dias)).filter(Boolean);
  const ingreso = v.reduce((a, x) => a + x.total, 0);
  const gasto = c.reduce((a, x) => a + x.total, 0);
  const saldo = +BAL.saldo || 0;
  const neto = saldo + ingreso - gasto;
  // la horquilla solo afecta a lo que no has escrito tú: si fijas el precio,
  // ese es el precio
  const flota = v.reduce((a, x) => a + x.flotante, 0);
  const fijo = ingreso - flota;
  const peor = saldo + fijo + flota * VENTA_MIN - gasto;
  const mejor = saldo + fijo + flota * VENTA_MAX - gasto;

  document.getElementById('bal-total').innerHTML = (!v.length && !c.length)
    ? '<p class="bal-vacio">Añade jugadores a cualquiera de los dos lados.</p>'
    : `<div class="bal-cifras">
         <div><span>vendiendo</span><b class="sube">+${eur(ingreso)}</b></div>
         <div><span>fichando</span><b class="baja">−${eur(gasto)}</b></div>
         ${saldo ? `<div><span>tenías</span><b>${eur(saldo)}</b></div>` : ''}
       </div>
       <div class="bal-res ${neto>=0?'bien':'mal'}">
         <span>${neto>=0 ? 'Te sobran' : 'Te faltan'}</span>
         <b>${eur(Math.abs(neto))}</b>
       </div>
       ${flota ? `<p class="bal-horquilla">Por los que no has puesto precio, Mister paga
         entre el 95 % y el 105 %: acabarías entre <b>${eur(peor)}</b> y
         <b>${eur(mejor)}</b>.</p>` : ''}`;

  document.getElementById('bal-sub').textContent =
    dias === 0 ? 'con los valores de hoy'
    : BAL.dias === null ? `al empezar la próxima jornada, en ${dias} días`
    : `dentro de ${dias} días`;
  guardarBal();
}

function abrirBalance(){
  pintarBalance();
  document.getElementById('balance').showModal();
}

function abrirComparador(){
  pintarComparador();
  document.getElementById('comparador').showModal();
}

/* ---------- ficha ---------- */

/* Las tres fuentes que componen el Mixto 2. Van con su nombre en texto:
   los logotipos son marcas suyas y no los dibujo. */
const SUB = ['cm', 'md', 'sf'];

/* Estadisticas de la ficha: primero el resumen, luego por familias. */
const GRUPOS = [
  ['Resumen',      ['med','mdn','tot','pj','tit']],
  ['Forma y techo',['med5','mej','peor','p10','pneg']],
  ['Casa y fuera', ['cas','fue','dif']],
  ['Ataque',       ['g','a','asg','t','oc']],
  ['Juego',        ['minU','mpm','p90','ptit','ult']],
  ['Disciplina',   ['y','r']],
  ['Mercado',      ['val','cam']],
];
const ROTULO = {
  med:'Media', mdn:'Mediana', pj:'Partidos', tit:'Titular', tot:'Puntos totales',
  cas:'Media en casa', fue:'Media fuera', dif:'Casa − fuera',
  g:'Goles', a:'Asis. de gol', asg:'Asis. sin gol', t:'Tiros a puerta',
  oc:'Ocasiones creadas', min:'Minutos', minU:'Minutos', mpm:'Min/partido',
  ult:'Jugados últimos', y:'Amarillas', r:'Rojas', val:'Valor', cam:'Sube hoy',
  med5:'Media últimos 5', mej:'Mejor jornada', peor:'Peor jornada',
  p10:'Partidazos', pneg:'En negativo', p90:'Puntos/90 min', ptit:'% titular',
};

function valorFicha(f, k){
  if(k === 'val') return f.val ? eur(f.val) : '<span class="tenue">·</span>';
  if(k === 'cam') return !f.cam ? '<span class="tenue">·</span>'
    : `${f.cam>0?'+':''}${(f.cam/1000).toFixed(0)}k`;
  if(k === 'ult') return `${f.ult}<span class="tenue">/${f.ultDe}</span>`;
  if(k === 'tit') return f.hayTit ? `${f.titU}<span class="tenue">/${f.pj}</span>`
    : '<span class="tenue">·</span>';
  if(k === 'ptit') return f.ptit === null ? '<span class="tenue">·</span>' : f.ptit + '<span class="tenue">%</span>';
  if(k === 'med5') return fmt(f.med5, 2);
  if(k === 'p90')  return fmt(f.p90, 2);
  const c = COLS.find(x => x.k === k) || ATRIB.find(x => x.k === k) || {};
  return fmt(f[k], c.dec);
}

/* Pestaña "Últimos partidos": una columna por jornada, como en el Mister.
   La altura dice cuantos puntos; el color, en que tramo de la escala cae. */
function panelPartidos(f){
  const pts = f.ref.p[estado.fuente] || {};
  // con casa o fuera elegido, las otras jornadas no se apagan: desaparecen
  const js = estado.sede
    ? JORNADAS.filter(n => (DATOS.lugar[n+'|'+f.e] || '|').split('|')[0] === estado.sede)
    : JORNADAS;
  const tope = Math.max(...js.map(n => Math.abs(pts[n] || 0)), 1);
  const hay = js.some(n => pts[n] !== undefined && pts[n] < 0);

  return '<div class="gr">' + js.map(n => {
    const v = pts[n];
    const ev = f.ref.ev[n] || {};
    const [sede, rival] = (DATOS.lugar[n+'|'+f.e] || '|').split('|');
    const jugado = v !== undefined;
    const alto = jugado ? Math.max(Math.abs(v) / tope * 100, 3) : 0;

    const marcas = [
      ev.g ? '⚽'.repeat(Math.min(ev.g, 3)) : '',
      (ev.a || ev.asg) ? '<i class="gr-as">→</i>' : '',
      ev.y ? '<i class="gr-am"></i>' : '',
      ev.r ? '<i class="gr-ro"></i>' : '',
    ].join('');

    const t = jugado
      ? `J${n} ${sede==='C'?'en casa contra':'fuera contra'} ${rival}: ${v} pts` +
        (ev.m !== undefined ? ` · ${ev.m} min` : '') +
        (ev.tit === 1 ? ' · titular' : ev.tit === 0 ? ' · suplente' : '')
      : `J${n} contra ${rival}: no jugó`;

    const cuenta = f.usadas.includes(n);
    return `<div class="gr-col${jugado && !cuenta ? ' fuera-filtro' : ''}" data-ayuda="${t}">
      <div class="gr-pista${hay?' doble':''}">
        ${jugado
          ? `<div class="gr-barra ${nivel(v)}${v<0?' neg':''}" style="height:${alto}%">
               <span class="gr-n">${v}</span><span class="gr-ev">${marcas}</span></div>`
          : '<div class="gr-no"></div>'}
      </div>
      <div class="gr-pie">
        ${escudo(rival, rival)}
        <i class="gr-s">${!jugado ? '·' : ev.tit === 1 ? 'T' : ev.tit === 0 ? 'S' : (sede==='C'?'🏠':'✈️')}</i>
        <b>J${n}</b>
      </div>
    </div>`;
  }).join('') + '</div>';
}

function panelStats(f){
  const tinte = k =>
    k === 'dif' && f.dif !== null ? (f.dif > 0 ? ' casa' : f.dif < 0 ? ' fuera' : '') :
    k === 'cam' && f.cam ? (f.cam > 0 ? ' casa' : ' neg') :
    k === 'pneg' && f.pneg ? ' neg' : '';

  // mirando solo casa (o solo fuera) ese grupo sobra: la mitad sale vacía
  return GRUPOS.filter(([titulo]) => !(estado.sede && titulo === 'Casa y fuera'))
    .map(([titulo, ks]) => {
    // el resumen va en grande; el resto, en filas apretadas
    const cuerpo = titulo === 'Resumen'
      ? '<div class="fx-tiles">' + ks.map(k =>
          `<div class="fx-b${tinte(k)}"${AYUDA[k]?` data-ayuda="${AYUDA[k]}"`:''}>
            <b>${valorFicha(f, k)}</b><span>${ROTULO[k]}</span></div>`).join('') + '</div>'
      : '<div class="fx-filas">' + ks.map(k =>
          `<div class="fx-f${tinte(k)}"${AYUDA[k]?` data-ayuda="${AYUDA[k]}"`:''}>
            <span>${ROTULO[k]}</span><b>${valorFicha(f, k)}</b></div>`).join('') + '</div>';
    return `<section class="fx-g"><h3>${titulo}</h3>${cuerpo}</section>`;
  }).join('');
}

/* La ficha puede mirarse con otro sistema de puntuacion sin tocar la lista
   de detras. Se cambia la fuente un instante, se calcula, y se devuelve. */
let fuenteFicha = 'm2';
let sedeFicha = '';
function conFuente(fu, fn){
  const antes = estado.fuente;
  estado.fuente = fu;
  try { return fn(); } finally { estado.fuente = antes; }
}

const ORDEN_SUB = ['m2', 'cm', 'md', 'sf'];

/* El rotulo de cada sistema. Si algun dia pones los logotipos en
   web/logos/, aparecen solos; mientras no esten, se lee el nombre.
   Los logos no los bajo yo: son marcas de Marca, MD y Sofascore, y
   Mixto 2 no tiene logotipo porque es una cuenta del propio Mister. */
function rotuloFuente(c){
  const t = DATOS.fuentes[c].replace('Cronistas ', '');
  if(c === 'm2') return t;
  // el nombre va siempre en el html; el css lo esconde solo si el logo carga.
  // Si no hay logo, la imagen se quita sola y vuelve a verse el nombre.
  return `<img class="logo-f" src="logos/${c}.png" alt="${t}" loading="lazy"
    onerror="this.remove()"><span class="txt-f">${t}</span>`;
}
const TONO = {m2:'var(--f-m2)', cm:'var(--f-cm)', md:'var(--f-md)', sf:'var(--f-sf)'};

/* Todo lo que depende del sistema elegido: el numero grande, las casillas,
   la racha corta, el grafico y las estadisticas. */
function pintarFicha(j){
  const sedeAntes = estado.sede;
  estado.sede = sedeFicha;
  conFuente(fuenteFicha, () => {
    const f = calcular(j, true);
    window.__ficha = f;

    // el número grande y los tres pequeños miran la temporada entera del jugador,
    // sin los filtros de la lista, pero sí obedecen al casa/fuera de la ficha
    const js = [...new Set(CLAVES.flatMap(c => Object.keys(j.p[c]||{})))].map(Number)
      .filter(n => !sedeFicha || (DATOS.lugar[n+'|'+j.e] || '|').split('|')[0] === sedeFicha)
      .sort((a,b)=>a-b);
    const mediaDe = c => {
      const q = j.p[c] || {};
      const v = js.map(n => q[n]).filter(x => x !== undefined);
      return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
    };
    const m = mediaDe(fuenteFicha);

    const hero = document.getElementById('ficha-hero');
    hero.style.setProperty('--tono', TONO[fuenteFicha]);
    hero.innerHTML =
      `<span class="fx-hero-n">${m === null ? '·' : m.toFixed(2)}</span>
       <span class="fx-hero-t">${rotuloFuente(fuenteFicha)}${
         fuenteFicha === 'sf' ? ' <em>0-10</em>' : ''}</span>`;
    hero.classList.remove('cambia'); void hero.offsetWidth; hero.classList.add('cambia');

    document.getElementById('ficha-sub').innerHTML = ORDEN_SUB
      .filter(c => c !== fuenteFicha).map(c => {
        const v = mediaDe(c);
        const eq = (c === 'sf' && v !== null) ? ` ≈ ${notaAPuntos(v)>0?'+':''}${notaAPuntos(v)} pts` : '';
        return `<button class="fx-s" data-fu="${c}" style="--tono:${TONO[c]}"
          data-ayuda="Ver la ficha con ${DATOS.fuentes[c]}${
          c==='sf'?' · nota sobre 10'+eq:' · puntos'}">
          <em>${rotuloFuente(c)}</em>
          <b>${v === null ? '·' : v.toFixed(2)}</b></button>`;
      }).join('');

    document.getElementById('ficha-racha5').innerHTML = pintarRacha(f, 5);
    document.getElementById('pes-partidos').innerHTML = panelPartidos(f);
    document.getElementById('pes-stats').innerHTML = panelStats(f);
  });
  estado.sede = sedeAntes;
}

function abrirFicha(f){
  const k = f.n + '|' + f.e;
  const p = POS[f.pos];

  // la foto, y si no la hay (o no ha llegado aun), sus iniciales
  const ini = `<span class="fx-ini">${
    f.n.split(' ').map(x=>x[0]).slice(0,2).join('')}</span>`;
  document.getElementById('ficha-foto').innerHTML = f.ref.f
    ? `<img src="fotos/${f.ref.f}.webp" alt="${f.n}" loading="lazy"
         onerror="this.parentNode.innerHTML=this.dataset.ini"
         data-ini="${ini.replace(/"/g,'&quot;')}">`
    : ini;
  document.getElementById('ficha-arriba').innerHTML =
    `${escudo(f.e, f.e)}<span>${f.e}</span>` +
    (p ? `<span class="fx-pos" style="color:${p[1]}">${f.pos}</span>` : '');
  document.getElementById('ficha-nombre').textContent = f.n;

  const cam = !f.cam ? ''
    : subidaHoy(f.cam, f.val, true);
  document.getElementById('ficha-val').innerHTML =
    (f.val ? eur(f.val) : '<span class="tenue">sin valor</span>') + cam;

  const pr = DATOS.prox[f.e] || [];
  document.getElementById('ficha-prox').innerHTML = pr.length ? pr.map(([n,sd,rival,cuando]) =>
    `<span class="fx-p" data-ayuda="J${n} ${sd==='C'?'en casa contra':'fuera contra'} ${rival}${cuando?' · '+cuando:''}">
      <b>J${n}</b>${escudo(rival, rival)}<i>${sd==='C'?'🏠':'✈️'}</i></span>`).join('') : '';

  fuenteFicha = estado.fuente;   // arranca con lo que tengas elegido fuera
  sedeFicha = estado.sede;
  document.querySelectorAll('#fx-sede button').forEach(b =>
    b.classList.toggle('act', b.dataset.sd === sedeFicha));
  pintarFicha(f.ref);

  // el botón no marca una casilla: lleva al comparador con este jugador ya dentro
  const btn = document.getElementById('ficha-cmp');
  btn.dataset.cmpFicha = k;
  const otros = estado.carro.filter(x => x !== k).length;
  btn.textContent = otros ? `Comparar (${otros + 1})` : 'Comparar';
  document.getElementById('ficha-calc').hidden = true;

  const dlg = document.getElementById('ficha');
  dlg.showModal();
  document.querySelector('.fx-cuerpo').scrollTop = 0;
}

/* ================================================================
   CALCULADORAS DE PUJA Y CLAUSULA

   Las formulas son las que ajustaste tu en agosto, traidas tal cual
   desde calculadoras-mister.jsx. No he tocado ni un numero: lo unico
   que cambia es que el valor de mercado y la subida de hoy ya vienen
   puestos de los datos, en vez de copiarlos a mano.
   ================================================================ */

const euros = n => (n === null || n === undefined || !isFinite(n)) ? '—'
  : (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';

// las cinco ventanas del historico: las tres primeras son de un dia,
// las dos ultimas vienen acumuladas y hay que repartirlas
const VENTANAS = [
  {k:'hoy',  t:'Hoy',       acum:false, dias:1},
  {k:'ayer', t:'Ayer',      acum:false, dias:1},
  {k:'ante', t:'Anteayer',  acum:false, dias:1},
  {k:'sem',  t:'Semana',    acum:true,  dias:7},
  {k:'mes',  t:'Mes',       acum:true,  dias:30},
];

const MULT = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0];

/* ================================================================
   PROYECCION POR PARTIDOS

   Lo que de verdad mueve el valor no es una tendencia que se pueda
   extrapolar, es si el jugador juega o no juega. Medido sobre la
   jornada 7 y los 9 dias siguientes (parón de selecciones, así que
   no hay nada más que lo contamine), con 449 jugadores:

        no jugó                 -20,5 %   (n=134)
        jugó menos de 45 min     -5,4 %   (n= 89)
        jugó 45+ min, sin gol    +5,9 %   (n=205)
        marcó un gol            +15,9 %   (n= 21)

   Ojo: es UNA jornada. Con la 8 y la 9 habrá que volver a mirarlo.
   Si estos números cambian, se cambian aquí y ya está.
   ================================================================ */

const EFECTO = {no:0.795, poco:0.946, juega:1.059, gol:1.159};
const DIAS_EFECTO = 9;      // en cuántos días se completa, que es la ventana medida

/* Qué suele hacer en un partido, mirando los últimos que jugó su equipo.
   Devuelve con qué frecuencia no juega, juega poco o juega de verdad. */
function perfilPartido(j, cuantos){
  const jornadas = (JUGADAS[j.e] || JORNADAS).slice(-(cuantos || 6));
  let no = 0, poco = 0, juega = 0, conGol = 0;
  for(const n of jornadas){
    const ev = j.ev[n];
    const m = (ev && ev.m) || 0;
    if(!ev || !m) no++;
    else if(m < 45) poco++;
    else { juega++; if((ev.g || 0) > 0) conGol++; }
  }
  const t = jornadas.length || 1;
  // en cuántos de los partidos que juega MARCA, no cuántos goles mete:
  // el efecto medido es el de "marcó o no marcó", y un hat-trick no
  // multiplica por tres la subida
  return {no:no/t, poco:poco/t, juega:juega/t,
          gol: juega ? conGol/juega : 0, de:t};
}

/* El efecto que cabe esperar de UN partido suyo, ya mezclado con la
   probabilidad de que lo juegue. Un titular fijo que marca a menudo
   sale por encima de 1; uno que lleva semanas sin jugar, por debajo. */
function efectoPartido(p){
  const conGol = p.gol;
  const jugando = conGol * EFECTO.gol + (1 - conGol) * EFECTO.juega;
  return p.no * EFECTO.no + p.poco * EFECTO.poco + p.juega * jugando;
}

/* "Lun 12/10 21:00h" -> Date. El año no viene, así que se deduce:
   la temporada cruza el año nuevo, y los meses de enero a junio son
   del año siguiente al de agosto-diciembre. */
function fechaProx(txt, hoy){
  const m = /(\d{1,2})\/(\d{1,2})/.exec(txt || '');
  if(!m) return null;
  const dia = +m[1], mes = +m[2];
  let año = hoy.getFullYear();
  // si el partido cae en un mes bastante anterior al de hoy, es del año que viene
  if(mes < hoy.getMonth() + 1 - 6) año++;
  const d = new Date(año, mes - 1, dia, 21, 0, 0);
  // y si aun asi sale en el pasado, es del año que viene
  if(d < hoy && (hoy - d) > 30 * 864e5) d.setFullYear(año + 1);
  return d;
}

/* Lo que hizo en un partido concreto, para saber qué efecto le toca.
   Aquí no hay que estimar nada: ya se sabe si jugó y si marcó. */
function efectoReal(ev){
  const m = (ev && ev.m) || 0;
  if(!ev || !m) return EFECTO.no;
  if(m < 45) return EFECTO.poco;
  return (ev.g || 0) > 0 ? EFECTO.gol : EFECTO.juega;
}

/* Proyección del valor día a día contando los partidos que caen en medio.
   Cada partido reparte su efecto en los DIAS_EFECTO siguientes, así que
   dos partidos seguidos se solapan y se acumulan, que es lo que pasa.

   Cuenta las dos cosas:
   - los partidos que quedan por jugar, con el efecto que cabe esperar
   - los ya jugados hace menos de DIAS_EFECTO, con el efecto que de verdad
     tuvieron. Sin esto, en un parón de selecciones la proyección diría
     que no pasa nada, cuando en realidad la subida del último partido
     todavía se está aplicando. */
function seriePorPartidos(j, valor, dias, extra){
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const p = perfilPartido(j);
  const ef = efectoPartido(p) * (extra || 1);
  const mult = (extra || 1);

  // [díaRelativo, efecto] — negativo si ya se jugó
  const eventos = [];

  for(const x of ((DATOS.prox || {})[j.e] || [])){
    const f = fechaProx(x[3], hoy);
    if(!f) continue;
    const d = Math.round((f - hoy) / 864e5);
    if(d >= 0) eventos.push([d, ef]);
  }

  for(const n of (JUGADAS[j.e] || JORNADAS)){
    const txt = (DATOS.jugado || {})[n + '|' + j.e];
    if(!txt) continue;
    const f = new Date(txt + 'T21:00:00');
    const d = Math.round((f - hoy) / 864e5);
    if(d < 0 && d > -DIAS_EFECTO) eventos.push([d, efectoReal(j.ev[n]) * mult]);
  }
  eventos.sort((a,b) => a[0] - b[0]);

  const tope = Math.max(60, dias + 10);
  const out = [{dia:0, valor}];
  let v = valor;
  for(let t = 1; t <= tope; t++){
    // todos los partidos que siguen soltando su efecto ese día
    let f = 1;
    for(const [d, e] of eventos){
      if(t > d && t <= d + DIAS_EFECTO) f *= Math.pow(e, 1 / DIAS_EFECTO);
    }
    v = v * f;
    out.push({dia:t, valor:v});
  }
  const partidos = eventos.filter(x => x[0] >= 0).map(x => x[0]);
  const enMarcha = eventos.filter(x => x[0] < 0);
  return {serie:out, perfil:p, efecto:ef, partidos, enMarcha};
}

/* Dos niveles: lo que es criterio tuyo (a cuántos días pujas, cuánto
   frenas) vale para cualquier jugador; lo que es del jugador (lo que te
   costó, si está lesionado, su histórico) se guarda con su nombre. */
const CALC = {
  cual:'puja', modo:'dias',
  dias:8, frenado:30, diasFrenado:15, escalon:5, peso:'simple', metodo:'partidos',
  jug:{},      // por jugador: {hist:{hoy:{v,u},…}, compra, precio, lesionado, diasRec, valRec}
};
try {
  const g = JSON.parse(localStorage.getItem('calc') || '{}');
  Object.assign(CALC, g, {jug: g.jug || {}});
} catch(_){}
const guardarCalc = () => { try {
  // lo que empieza por __ es de esta pasada, no hace falta guardarlo
  localStorage.setItem('calc', JSON.stringify(CALC,
    (k, v) => k.startsWith('__') ? undefined : v));
} catch(_){} };

const fichaDe = k => (CALC.jug[k] = CALC.jug[k] || {
  hist: Object.fromEntries(VENTANAS.map(v => [v.k, {v:'', u:'pct'}])),
  compra:0, precio:null, lesionado:false, diasRec:14, valRec:null,
});

/* La tendencia: cada ventana con dato se pasa a % diario y se promedian.
   Las acumuladas se reparten en geometrica, no dividiendo entre los dias.

   El promedio se puede hacer de dos maneras y las dos salen a la vez:
   - simple: la tuya. Un dia suelto pesa lo mismo que un mes entero.
   - ponderada: cada ventana pesa sus dias. Un mes lleva 30 dias dentro,
     asi que dice treinta veces mas que la subida de hoy. Es lo que sale
     de ponderar por el inverso de la varianza. OJO: las ventanas se
     solapan (el mes incluye la semana, la semana incluye hoy), asi que
     es una aproximacion, no el optimo exacto. */
function tasaDiaria(hist, valor){
  const filas = VENTANAS.map(w => {
    const c = hist[w.k] || {v:'', u:'pct'};
    if(c.v === '' || c.v === null || isNaN(Number(c.v))) return {...w, diario:null};
    let pct = Number(c.v);
    if(c.u === 'eur'){
      const antes = valor - Number(c.v);
      pct = antes > 0 ? (Number(c.v) / antes) * 100 : 0;
    }
    return {...w, diario: w.acum ? (Math.pow(1 + pct/100, 1/w.dias) - 1) * 100 : pct};
  });
  const con = filas.filter(x => x.diario !== null);
  const simple = con.length ? con.reduce((a,x) => a + x.diario, 0) / con.length : 0;
  const pesos = con.reduce((a,x) => a + x.dias, 0);
  const pond = pesos ? con.reduce((a,x) => a + x.diario * x.dias, 0) / pesos : 0;
  return {filas, simple, pond, tasa: CALC.peso === 'pond' ? pond : simple};
}





const diasHasta = (valor, tasa, objetivo) => {
  if(objetivo <= valor) return null;
  if(!tasa || tasa <= 0) return Infinity;
  return Math.ceil(Math.log(objetivo / valor) / Math.log(1 + tasa / 100));
};

/* La proyeccion, en SVG. Solo la curva, la raya del objetivo y el punto:
   lo que se lee de un vistazo. Los numeros exactos ya estan arriba. */
function grafica(serie, opc){
  const An = 320, Al = 116, mx = 6, my = 10;
  if(serie.length < 2) return '';
  const vs = serie.map(p => p.valor).filter(isFinite);
  if(!vs.length) return '';
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if(opc.refY !== undefined && isFinite(opc.refY)){ lo = Math.min(lo, opc.refY); hi = Math.max(hi, opc.refY); }
  if(hi - lo < 1){ hi = lo + 1; }
  const dmax = serie[serie.length-1].dia;
  const X = d => mx + d / dmax * (An - mx*2);
  const Y = v => Al - my - (v - lo) / (hi - lo) * (Al - my*2);

  const linea = serie.map((p,i) => `${i?'L':'M'}${X(p.dia).toFixed(1)} ${Y(p.valor).toFixed(1)}`).join(' ');
  const area = `${linea} L${X(dmax).toFixed(1)} ${Al-my} L${X(0).toFixed(1)} ${Al-my} Z`;

  let marca = '';
  if(opc.refX !== undefined && opc.refX !== null){
    const x = X(opc.refX).toFixed(1);
    marca += `<line x1="${x}" y1="${my-4}" x2="${x}" y2="${Al-my}" class="g-ref"/>`;
  }
  if(opc.refY !== undefined && opc.refY !== null && isFinite(opc.refY)){
    const y = Y(opc.refY).toFixed(1);
    marca += `<line x1="${mx}" y1="${y}" x2="${An-mx}" y2="${y}" class="g-ref"/>`;
  }
  if(opc.puntoX !== undefined && opc.puntoX !== null && opc.puntoY !== undefined){
    marca += `<circle cx="${X(opc.puntoX).toFixed(1)}" cy="${Y(opc.puntoY).toFixed(1)}" r="4" class="g-pt"/>`;
  }

  return `<svg class="g-svg" viewBox="0 0 ${An} ${Al}" role="img"
    aria-label="Proyección del valor a ${dmax} días">
    <path d="${area}" class="g-area"/>
    <path d="${linea}" class="g-linea"/>${marca}</svg>
    <div class="g-pies"><span>hoy</span><span>${dmax} días</span></div>`;
}

/* El historico: la subida de hoy ya viene de los datos; el resto se
   escribe una vez por jugador y se queda guardado. */
function bloqueHistorico(t){
  const J = CALC.__j, {filas, tasa, simple, pond} = t;
  const pondera = CALC.peso === 'pond';
  const difiere = Math.abs(simple - pond) > 0.005;
  return `<details class="cc-plg"${CALC.abHist ? ' open' : ''} data-plg="hist">
    <summary><span>Tendencia</span>
      <b class="${tasa < 0 ? 'baja' : tasa > 0 ? 'sube' : ''}">${tasa.toFixed(2)}%/día</b></summary>
    <div class="cc-peso" id="cc-peso">
      <button class="${pondera?'':'act'}" data-peso="simple">Media simple
        <i>${simple.toFixed(2)}%</i></button>
      <button class="${pondera?'act':''}" data-peso="pond">Ponderada por días
        <i>${pond.toFixed(2)}%</i></button>
    </div>
    <p class="cc-pista">${difiere
      ? 'Ponderada, un mes pesa treinta veces más que la subida de hoy, que es lo que de verdad vale. Las ventanas se solapan, así que es aproximado.'
      : 'Con un solo dato las dos dan lo mismo. Rellena más ventanas y se separan.'}</p>
    <p class="cc-pista">Hoy, ayer y anteayer: lo que subió ese día. Semana y mes: acumulado.</p>
    <div class="cc-hist">${filas.map(w => `
      <div class="cc-h${(J.hist[w.k]||{}).auto ? ' auto' : ''}">
        <label for="h-${w.k}">${w.t}</label>
        <input id="h-${w.k}" type="number" step="0.01" data-hist="${w.k}"
          value="${(J.hist[w.k]||{}).v ?? ''}" placeholder="—" inputmode="decimal">
        <button class="cc-uni" data-uni="${w.k}"
          aria-label="Cambiar unidad">${(J.hist[w.k]||{}).u === 'eur' ? '€' : '%'}</button>
        <i>${w.diario === null ? '' : w.diario.toFixed(2) + '%/día'}</i>
      </div>`).join('')}</div>
  </details>`;
}

/* ================================================================
   LA PUJA IDEAL

   Un número y un veredicto. Nada que decidir.

   El razonamiento, por si hace falta repasarlo dentro de un año:

   - El SUELO es el valor × 1,05. Mister puja solo por los jugadores
     libres con una oferta aleatoria de entre el 95 % y el 105 % del
     valor (art. 37 de su ayuda). Por debajo de ese 105 % la máquina
     puede ganarte sin que intervenga nadie, así que pujar ahí es tirar
     el turno.
   - El TECHO es lo que valdrá el jugador cuando hayan pasado sus dos
     próximos partidos. Pagar más que eso es perder dinero seguro.
   - El PLAZO no lo elige nadie: sale del calendario de su equipo.
   - La puja va al 60 % del camino entre el suelo y el techo. Deja
     margen para que el jugador cumpla peor de lo esperado y aun así
     no pierdas.
   ================================================================ */

/* ================================================================
   VALOR POTENCIAL  ·  lo máximo que puedes pagar hoy

   Qué predice esto: lo que valdrá el jugador dentro de unos días. Si
   pagas eso, ese día habrás quedado en paz; si vendes antes, pierdes.

   Cómo. Lo único que predice de verdad es lo que el jugador YA está
   subiendo. Se comprobó partiendo el histórico en dos: con lo de los
   primeros días se predijo lo de los siguientes.

        lo que lleva subiendo           r = +0,55
        media de puntos                 r = +0,26
        subida de un solo día           r = +0,23
        minutos, partidos, valor          ruido

   Un modelo que contaba partidos (si juega, si marca) se probó y se
   tiró: predecía con r = +0,10, o sea nada. Los efectos que se ven por
   grupos (el que no juega baja un 20 %) no sirven para un jugador
   concreto, porque dentro de cada grupo hay de todo.

   La fórmula sale de una regresión sobre 546 jugadores:

        subida esperada en 4 días = 0,65 × (subida de los últimos 5) − 1,78

   O sea: se conserva el 65 % del ritmo y hay un freno fijo de 1,78
   puntos. Eso es el "frenado" que hacía falta, pero medido en vez de
   inventado. R² = 0,31 y el error típico es de 8 puntos: esto orienta,
   no garantiza.
   ================================================================ */

const CONSERVA = 0.6512;    // cuánto del ritmo se mantiene
const FRENO = 1.778;        // lo que se pierde de salida, en puntos
const VENTANA = 5;          // días de los que se lee el ritmo
const TRAMO = 4;            // días que cubre cada aplicación de la fórmula
const PLAZO = 10;           // a cuántos días se da el valor potencial

function valorPotencial(f, dias){
  const val = f.val;
  const h = f.ref.h || {};
  dias = dias || PLAZO;

  // lo que lleva subiendo. Si no hay ventana de 5 días, se apaña con lo que haya
  let ritmo = h.d5, base = VENTANA;
  if(ritmo === undefined){ ritmo = h.sem; base = 7; }
  if(ritmo === undefined){ ritmo = h.hoy; base = 1; }
  const hayDato = ritmo !== undefined;
  const sub5 = hayDato ? ritmo * (VENTANA / base) : 0;

  // lo que cabe esperar, pasado a tasa diaria
  const esperado = CONSERVA * sub5 - FRENO;          // en % para TRAMO días
  const diaria = Math.pow(1 + esperado / 100, 1 / TRAMO) - 1;

  const serie = [{dia:0, valor:val}];
  let v = val;
  for(let t = 1; t <= Math.max(30, dias + 5); t++){
    v = v * (1 + diaria);
    serie.push({dia:t, valor:v});
  }
  const techo = serie[Math.min(dias, serie.length - 1)].valor;
  const sube = techo / val - 1;

  const veredicto =
    !hayDato     ? {clase:'justo', txt:'Sin datos suficientes'} :
    sube > 0.06  ? {clase:'bien',  txt:'Buen margen'} :
    sube > 0.01  ? {clase:'justo', txt:'Margen corto'} :
                   {clase:'mal',   txt:'No pujes'};

  return {val, serie, techo, sube, diaria, sub5, esperado, hayDato, veredicto, dias};
}

function panelPuja(f){
  const J = CALC.__j, val = f.val;
  const r = valorPotencial(f, PLAZO);
  const pf = perfilPartido(f.ref);

  const cabeza = `
    <p class="cc-rot">No pagues más de</p>
    <p class="cc-grande">${euros(r.techo)}</p>
    <p class="cc-sub ${r.sube>=0?'sube':'baja'}">${r.sube>=0?'+':''}${(r.sube*100).toFixed(1)}%
      sobre sus ${euros(val)} de hoy</p>
    <p class="cc-veredicto ${r.veredicto.clase}">${r.veredicto.txt}</p>`;

  const graf = grafica(r.serie.slice(0, r.dias + 5),
    {refY:r.techo, puntoX:r.dias, puntoY:r.techo});

  if(CALC.__soloSalida) return {cabeza, graf, salida:''};

  const porque = !r.hayDato
    ? `Todavía no hay histórico suyo para saber a qué ritmo se mueve.`
    : r.veredicto.clase === 'mal'
    ? `Lleva ${r.sub5>=0?'subiendo':'bajando'} un ${Math.abs(r.sub5).toFixed(1)}% en 5 días.
       A ese ritmo no llega a cubrir lo que cuesta hoy: pagar su precio ya es sobrepagar.`
    : `Lleva subiendo un <b>${r.sub5.toFixed(1)}%</b> en los últimos 5 días. De ese ritmo
       se suele conservar dos tercios, así que en <b>${r.dias} días</b> debería valer
       <b>${euros(r.techo)}</b>. Pagando eso quedas en paz; lo que pujes por debajo es
       lo que ganas.`;

  return `
    <div id="cc-cab">${cabeza}</div>
    <p class="cc-porque">${porque}</p>
    <div class="cc-graf" id="cc-gr">${graf}</div>

    <div class="cc-cuenta">
      <div class="${r.sub5>=0?'sube':'baja'}"><b>${r.sub5>=0?'+':''}${
        r.sub5.toFixed(1)}%</b><span>lleva en 5 días</span></div>
      <div class="${r.diaria>=0?'sube':'baja'}"><b>${r.diaria>=0?'+':''}${
        (r.diaria*100).toFixed(2)}%</b><span>esperado al día</span></div>
      <div><b>${Math.round(pf.juega*100)}%</b><span>juega los partidos</span></div>
      <div><b>${euros(r.techo - val).replace(' €','')}</b><span>margen sobre hoy</span></div>
    </div>

    <p class="cc-aviso">El error típico de esta cuenta es de 8 puntos. Orienta, no garantiza.</p>

    <details class="cc-plg"${CALC.abAj ? ' open' : ''} data-plg="aj">
      <summary><span>A otro plazo</span><b>${r.dias} días</b></summary>
      <div class="cc-plazos" id="cc-plazos">
        ${[5,10,15,21].map(d => {
          const x = valorPotencial(f, d);
          return `<div><b>${euros(x.techo)}</b><span>${d} días</span></div>`;
        }).join('')}
      </div>
      <label class="cc-chk"><input type="checkbox" id="cc-les"${J.lesionado?' checked':''}>
        <span>Está lesionado o sancionado</span></label>
    </details>`;
}

function panelClausula(f){
  const J = CALC.__j, val = f.val;
  const compra = +J.compra || 0;
  const T = tasaDiaria(J.hist, val), tasa = T.tasa;
  const esc = CALC.escalon;
  const base = Math.max(compra, val);
  const clausula = base * MULT[esc];
  const coste = 0.2 * esc * base;
  const total = compra + coste;
  const objetivo = esc > 0 ? total / (1 + 0.1 * esc) : null;
  const dif = objetivo === null ? null : val - objetivo;
  const dias = objetivo ? diasHasta(val, tasa, objetivo) : null;

  const serie = [];
  if(objetivo){
    const r = 1 + tasa / 100;
    const tope = Math.min(90, Math.max(30, (isFinite(dias) && dias !== null) ? dias + 5 : 30));
    for(let t = 0; t <= tope; t++) serie.push({dia:t, valor: val * Math.pow(r, t)});
  }

  const mult = MULT[esc].toFixed(1).replace('.', ',');
  const cabeza = `
    <p class="cc-rot">Cláusula si subes a ×${mult}</p>
    <p class="cc-grande">${euros(clausula)}</p>
    <p class="cc-sub">te cuesta ${euros(coste)}</p>`;

  const cuentas = `
    <div class="cc-cuentas">
      <div><span>Compra</span><b>${euros(compra)}</b></div>
      <div><span>Subir cláusula</span><b>${euros(coste)}</b></div>
      <div class="tot"><span>Invertido</span><b>${euros(total)}</b></div>
    </div>
    ${esc > 0 ? `
      <p class="cc-rot">Tiene que llegar a</p>
      <p class="cc-grande">${euros(objetivo)}</p>
      <p class="cc-sub ${dif>=0?'sube':'baja'}">${dif>=0
        ? 'ya ha subido ' + euros(dif) + ' de más'
        : 'le faltan ' + euros(-dif)}</p>
      <p class="cc-plazo">${dias === null ? 'Ya está alcanzado'
        : dias === Infinity ? 'A esta tendencia, nunca'
        : '~' + dias + ' día' + (dias===1?'':'s') + ' a esta tendencia'}</p>
      <div class="cc-graf">${grafica(serie, {refY:objetivo,
        puntoX:(isFinite(dias)&&dias!==null)?dias:null, puntoY:objetivo})}</div>` : ''}`;

  if(CALC.__soloSalida) return {cabeza, cuentas, salida:'×' + mult, esc};

  return `
    <div id="cc-cab">${cabeza}</div>
    <div class="cc-rango escalones">
      <input type="range" id="cc-esc" min="0" max="5" step="1" value="${esc}">
      <output id="cc-out">×${mult}</output></div>
    <div class="cc-escn" id="cc-escn">${MULT.map((m,i) =>
      `<span class="${i===esc?'act':''}">${m.toFixed(1).replace('.', ',')}</span>`).join('')}</div>

    <div class="cc-campo"><label for="cc-compra">Lo que te costó (0 si vino gratis)</label>
      <input type="number" id="cc-compra" value="${compra}" step="1000" inputmode="numeric"></div>

    <div id="cc-cuentas">${cuentas}</div>
    ${bloqueHistorico(T)}`;
}

function panelCalculo(cual){
  const f = window.__ficha;
  const caja = document.getElementById('ficha-calc');
  if(!f || !f.val){ caja.hidden = true; return; }

  if(cual) CALC.cual = cual;
  CALC.__j = fichaDe(f.n + '|' + f.e);

  /* Las cinco ventanas salen del histórico de valores, que se guarda a
     diario. Van todas en %, para que se lean juntas sin mezclar unidades.
     Solo se rellena lo que esté vacío: lo que escribas tú manda y no se
     pisa. Si aún no hay histórico, la de hoy cae en la subida que anuncia
     el propio Mister, que sí sabemos desde el primer día. */
  const h = f.ref.h || {};
  for(const w of VENTANAS){
    const c = CALC.__j.hist[w.k];
    if(c.v !== '' || h[w.k] === undefined) continue;
    CALC.__j.hist[w.k] = {v:String(h[w.k]), u:'pct', auto:true};
  }
  if(CALC.__j.hist.hoy.v === '' && f.cam){
    CALC.__j.hist.hoy = {v:String(f.cam), u:'eur', auto:true};
  }

  caja.hidden = false;
  caja.innerHTML = `
    <div class="fx-calc-cab">${CALC.cual === 'puja' ? 'Puja ideal' : 'Subir cláusula'}
      <span class="cc-quien">${f.n} · ${euros(f.val)}</span>
      <button class="fx-x" id="fx-cerrar-calc" aria-label="Cerrar">&times;</button></div>
    <div class="cc-cuerpo">${CALC.cual === 'puja' ? panelPuja(f) : panelClausula(f)}</div>`;
  guardarCalc();
}

/* Mientras arrastras, solo se repintan los numeros y el grafico.
   El deslizador se queda donde esta y sigue pegado al dedo. */
function refrescarCalculo(){
  const f = window.__ficha;
  const caja = document.getElementById('ficha-calc');
  if(!f || !f.val || caja.hidden) return;
  CALC.__soloSalida = true;
  const s = CALC.cual === 'puja' ? panelPuja(f) : panelClausula(f);
  CALC.__soloSalida = false;

  const pon = (id, html) => { const e = document.getElementById(id); if(e) e.innerHTML = html; };
  pon('cc-cab', s.cabeza);
  if(s.graf !== undefined) pon('cc-gr', s.graf);
  if(s.cuentas !== undefined) pon('cc-cuentas', s.cuentas);
  const out = document.getElementById('cc-out');
  if(out) out.textContent = s.salida;
  const escn = document.getElementById('cc-escn');
  if(escn) [...escn.children].forEach((x,i) => x.classList.toggle('act', i === s.esc));
  guardarCalc();
}

/* ---------- desplegables ---------- */

function cerrarPops(salvo){
  document.querySelectorAll('.grupo').forEach(g => {
    const b = g.querySelector('.filtro'), p = g.querySelector('.pop');
    if(!b || !p || g === salvo) return;
    p.hidden = true; b.setAttribute('aria-expanded','false');
  });
  sincronizarVelo();
}

// el velo solo aparece en movil, donde los desplegables son hojas inferiores
function sincronizarVelo(){
  const abierto = !!document.querySelector('.pop:not([hidden])');
  document.getElementById('velo').hidden = !(abierto && esMovil());
  document.body.style.overflow = (abierto && esMovil()) ? 'hidden' : '';
}

document.getElementById('barra-filtros').addEventListener('click', e => {
  const b = e.target.closest('.filtro');
  if(b){
    const g = b.closest('.grupo'), p = g.querySelector('.pop');
    const abrir = p.hidden;
    cerrarPops(g);
    p.hidden = !abrir;
    b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    sincronizarVelo();
    return;
  }
  const lim = e.target.dataset.limpiar;
  if(lim === 'equipos'){ estado.equipos.clear(); todasCasillas('panel-equipos', false); pintar(); }
  if(lim === 'rivales'){ estado.rivales.clear(); todasCasillas('panel-rivales', false);
    document.getElementById('nota-rival').hidden = true; pintar(); }
  if(lim === 'juega'){
    estado.juOn = estado.juTotOn = estado.juUltimo = estado.juTit = false;
    ['ju-min','ju-tot','ju-ultimo','ju-tit'].forEach(i => document.getElementById(i).checked = false);
    pintar();
  }
  if(lim === 'valor'){
    estado.valMin = estado.valMax = estado.camMin = null;
    ['val-min','val-max','cam-min'].forEach(i => document.getElementById(i).value = '');
    pintar();
  }
});

document.addEventListener('click', e => {
  if(!e.target.closest('.grupo')) cerrarPops(null);
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') cerrarPops(null); });

// al girar el movil o cambiar de tamano, se cambia de tabla a tarjetas
MOVIL.addEventListener('change', () => { sincronizarVelo(); if(DATOS) pintar(); });

/* ---------- arranque ---------- */

function ponerSede(v){
  estado.sede = v;
  document.querySelectorAll('#sede button').forEach(x =>
    x.setAttribute('aria-pressed', x.dataset.v === v ? 'true' : 'false'));
}

function pintarRangos(){
  const caja = document.getElementById('rangos');
  caja.innerHTML = estado.rangos.map((c,i) => {
    const v = x => x===null ? '' : x;
    return `<div class="rango" data-i="${i}">
      <select class="r-k">${METRICAS.map(m =>
        `<option value="${m.k}" ${m.k===c.k?'selected':''}>${m.t}</option>`).join('')}</select>
      <span class="etiqueta">de</span>
      <input type="number" class="r-min" step="any" value="${v(c.min)}" placeholder="—">
      <span class="etiqueta">a</span>
      <input type="number" class="r-max" step="any" value="${v(c.max)}" placeholder="—">
      <button class="quitar" title="Quitar">&times;</button>
    </div>`;
  }).join('') + '<button class="limpiar" id="add-rango">+ añadir condición</button>';
}

function arrancarComparador(){
  const dlg = document.getElementById('comparador');

  document.getElementById('carro-abrir').addEventListener('click', abrirComparador);
  document.getElementById('carro-vaciar').addEventListener('click', () => {
    estado.carro = []; pintarCarro(); });
  document.getElementById('cmp-cerrar').addEventListener('click', () => dlg.close());

  // el + de la lista: no debe abrir la ficha de paso
  const pulsarMas = e => {
    const b = e.target.closest('[data-cmp]'); if(!b) return;
    e.stopPropagation(); e.preventDefault();
    if(!alternarCarro(b.dataset.cmp)) avisarLleno();
  };
  document.getElementById('cuerpo').addEventListener('click', pulsarMas, true);
  document.getElementById('abrir-cmp').addEventListener('click', abrirComparador);

  /* en el movil se manda al comparador manteniendo pulsada la tarjeta:
     asi la linea del jugador se queda limpia, sin casilla que la estreche */
  const tarjetas = document.getElementById('tarjetas');
  let reloj = null, objetivo = null, xIni = 0, yIni = 0;

  const soltarLargo = () => { clearTimeout(reloj); reloj = null; objetivo = null; };

  tarjetas.addEventListener('pointerdown', e => {
    const tj = e.target.closest('.tj'); if(!tj) return;
    objetivo = tj; xIni = e.clientX; yIni = e.clientY; largo = false;
    clearTimeout(reloj);
    reloj = setTimeout(() => {
      reloj = null; largo = true;
      if(!alternarCarro(tj.dataset.k)) return avisarLleno();
      tj.classList.add('marcando');
      setTimeout(() => tj.classList.remove('marcando'), 300);
      if(navigator.vibrate) try { navigator.vibrate(12); } catch(_){}
    }, 420);
  });
  tarjetas.addEventListener('pointermove', e => {
    if(!objetivo) return;
    if(Math.abs(e.clientX - xIni) > 8 || Math.abs(e.clientY - yIni) > 8) soltarLargo();
  });
  tarjetas.addEventListener('pointerup', soltarLargo);
  tarjetas.addEventListener('pointercancel', () => { soltarLargo(); largo = false; });
  tarjetas.addEventListener('scroll', soltarLargo, true);
  window.addEventListener('scroll', soltarLargo, {passive:true});
  // sin menu contextual: la pulsacion larga es nuestra
  tarjetas.addEventListener('contextmenu', e => { if(e.target.closest('.tj')) e.preventDefault(); });

  document.getElementById('ficha-sub').addEventListener('click', e => {
    const b = e.target.closest('[data-fu]'); if(!b) return;
    fuenteFicha = b.dataset.fu;
    pintarFicha(window.__ficha.ref);
  });

  document.getElementById('fx-sede').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    sedeFicha = b.dataset.sd;
    document.querySelectorAll('#fx-sede button').forEach(x => x.classList.toggle('act', x === b));
    pintarFicha(window.__ficha.ref);
  });

  document.getElementById('fx-pestanas').addEventListener('click', e => {
    const b = e.target.closest('.fx-pes'); if(!b) return;
    document.querySelectorAll('.fx-pes').forEach(x => x.classList.toggle('act', x === b));
    document.getElementById('pes-partidos').hidden = b.dataset.pes !== 'partidos';
    document.getElementById('pes-stats').hidden = b.dataset.pes !== 'stats';
    document.querySelector('.fx-cuerpo').scrollTop = 0;
  });

  document.querySelector('.fx-acciones').addEventListener('click', e => {
    const c = e.target.closest('[data-calc]');
    if(c){ panelCalculo(c.dataset.calc); return; }
    const b = e.target.closest('[data-cmp-ficha]'); if(!b) return;
    const k = b.dataset.cmpFicha;
    // si aún no estaba, entra; y en cualquier caso se va derecho al comparador
    if(!enCarro(k) && !alternarCarro(k)) return avisarLleno();
    document.getElementById('ficha').close();
    abrirComparador();
  });
  const cajaCalc = document.getElementById('ficha-calc');

  cajaCalc.addEventListener('click', e => {
    if(e.target.id === 'fx-cerrar-calc'){ cajaCalc.hidden = true; return; }

    const m = e.target.closest('[data-modo]');
    if(m){ CALC.modo = m.dataset.modo; panelCalculo(); return; }

    const p = e.target.closest('[data-peso]');
    if(p){ CALC.peso = p.dataset.peso; panelCalculo(); return; }

    // el % / € de cada fila del historico: cambiar de unidad vacia el dato,
    // porque un 2 en porcentaje y un 2 en euros no son la misma cosa
    const u = e.target.closest('[data-uni]');
    if(u){
      const h = CALC.__j.hist, c = h[u.dataset.uni];
      h[u.dataset.uni] = {v:'', u: c.u === 'eur' ? 'pct' : 'eur', auto:false};
      panelCalculo(); return;
    }
  });

  // los plegables recuerdan si los dejaste abiertos
  cajaCalc.addEventListener('toggle', e => {
    const d = e.target.closest('details[data-plg]'); if(!d) return;
    if(d.dataset.plg === 'hist') CALC.abHist = d.open; else CALC.abAj = d.open;
    guardarCalc();
  }, true);

  cajaCalc.addEventListener('change', e => {
    if(e.target.id === 'cc-les'){ CALC.__j.lesionado = e.target.checked; panelCalculo(); }
  });

  cajaCalc.addEventListener('input', e => {
    const t = e.target, v = t.value;
    switch(t.id){
      case 'cc-dias':   CALC.dias = +v; break;
      case 'cc-esc':    CALC.escalon = +v; break;
      case 'cc-precio': CALC.__j.precio = v === '' ? null : +v; break;
      case 'cc-compra': CALC.__j.compra = v === '' ? 0 : +v; break;
      case 'cc-fren':   CALC.frenado = Math.min(100, Math.max(0, +v || 0)); break;
      case 'cc-frend':  CALC.diasFrenado = +v || 0; break;
      case 'cc-rec':    CALC.__j.diasRec = +v || 0; break;
      case 'cc-vrec':   CALC.__j.valRec = v === '' ? null : +v; break;
      default:
        if(t.dataset.hist){ const c = CALC.__j.hist[t.dataset.hist];
          c.v = v; c.auto = false; break; }
        return;
    }
    // las filas del historico cambian el resumen del plegable, que está fuera
    // de las zonas que refresco: ahí sí conviene repintar entero, pero sin
    // perder el foco de la casilla que se está escribiendo
    if(t.dataset.hist){
      const id = t.id;
      let pos = null; try { pos = t.selectionStart; } catch(_){}
      panelCalculo();
      const n = document.getElementById(id);
      if(n){ n.focus(); if(pos !== null) try { n.setSelectionRange(pos, pos); } catch(_){} }
    } else refrescarCalculo();
  });

  // elegir atributos, en el orden en que se tocan
  document.getElementById('cmp-cab-atrib').addEventListener('click', e => {
    const caja = document.getElementById('cmp-atrib');
    const abrir = caja.hidden;
    caja.hidden = !abrir;
    e.currentTarget.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  });
  document.getElementById('cmp-atrib').addEventListener('click', e => {
    const b = e.target.closest('.at'); if(!b) return;
    const i = estado.atrib.indexOf(b.dataset.at);
    if(i >= 0) estado.atrib.splice(i, 1); else estado.atrib.push(b.dataset.at);
    pintarAtrib(); pintarComparador();
  });

  // quitar un jugador desde la propia tabla de comparacion
  document.getElementById('cmp-cuerpo').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar]'); if(!b) return;
    alternarCarro(b.dataset.quitar);
  });

  // buscador propio: anadir sin salir del comparador
  const buscador = document.getElementById('cmp-buscar');
  const sug = document.getElementById('cmp-sug');
  buscador.addEventListener('input', () => {
    const q = buscador.value.trim().toLowerCase();
    if(q.length < 2){ sug.hidden = true; return; }
    const hallados = DATOS.jugadores.filter(j =>
      j.n.toLowerCase().includes(q) || j.nc.toLowerCase().includes(q)).slice(0, 8);
    sug.hidden = !hallados.length;
    sug.innerHTML = hallados.map(j => {
      const k = clave(j), f = calcular(j, true), p = POS[j.pos], e = EQUIPO[j.e];
      return `<button class="sg${enCarro(k)?' puesto':''}" data-sug="${k}">
        ${p?insignia(p[0],p[1],j.pos):''}${escudo(j.e, j.e)}
        <span class="sg-n">${j.n}</span>
        <span class="sg-d">${f && f.med!==null ? 'media '+f.med.toFixed(2) : 'sin datos'}</span>
        <span class="sg-x">${enCarro(k)?'✓':'+'}</span></button>`;
    }).join('');
  });
  sug.addEventListener('click', e => {
    const b = e.target.closest('[data-sug]'); if(!b) return;
    if(!alternarCarro(b.dataset.sug)) return avisarLleno();
    buscador.value = ''; sug.hidden = true; buscador.focus();
  });

  pintarAtrib();
  pintarCarro();
  arrancarBalance();
}

/* ---------- balance: enganchar los controles ---------- */
function arrancarBalance(){
  const dlg = document.getElementById('balance');
  document.getElementById('abrir-bal').addEventListener('click', abrirBalance);
  document.getElementById('bal-cerrar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if(e.target === dlg) dlg.close(); });

  const cuerpo = document.getElementById('bal-cuerpo');

  // una sola forma de leer "lado|índice", que la clave del jugador
  // lleva su propio "|" dentro
  const parte = t => { const i = t.indexOf('|'); return [t.slice(0, i), t.slice(i + 1)]; };

  const saldoCaja = document.getElementById('bal-saldo');
  saldoCaja.addEventListener('input', e => {
    BAL.saldoTxt = e.target.value;
    BAL.saldo = leerDinero(e.target.value) || 0;
    totalesBalance();
  });
  // al salir, se le deja escrito como lo va a volver a leer
  saldoCaja.addEventListener('blur', () => {
    BAL.saldoTxt = BAL.saldo ? escribirDinero(BAL.saldo) : '';
    saldoCaja.value = BAL.saldoTxt;
  });

  cuerpo.addEventListener('click', e => {
    if(e.target.closest('#bal-prox')){ BAL.dias = null; pintarBalance(); return; }

    const q = e.target.closest('[data-quita]');
    if(q){ const [cual, i] = parte(q.dataset.quita); BAL[cual].splice(+i, 1); pintarBalance(); return; }

    const sg = e.target.closest('[data-badd]');
    if(sg){
      const [cual, k] = parte(sg.dataset.badd);
      if(!BAL[cual].some(x => x.k === k))
        BAL[cual].push({k, esc:0, precio:null, base:null, suyo:false});
      pintarBalance(); return;
    }
  });

  // al salir de una casilla se le deja escrito en millones, que es como se
  // lee. Si la dejó vacía, vuelve a mandar la proyección.
  cuerpo.addEventListener('focusout', e => {
    const t = e.target;
    for(const campo of ['precio', 'base', 'pague']){
      if(t.dataset[campo] === undefined) continue;
      const [cual, i] = parte(t.dataset[campo]);
      const fila = BAL[cual][+i]; if(!fila) return;
      if(fila[campo] === null || fila[campo] === undefined){
        delete fila[campo + 'Txt'];
        pintarBalance();
      } else {
        fila[campo + 'Txt'] = escribirDinero(fila[campo]);
        t.value = fila[campo + 'Txt'];
        guardarBal();
      }
      return;
    }
  });

  cuerpo.addEventListener('change', e => {
    const sel = e.target.closest('[data-esc]');
    if(sel){
      const [cual, i] = parte(sel.dataset.esc);
      BAL[cual][+i].esc = +sel.value;
      pintarBalance(); return;
    }
    const chk = e.target.closest('[data-suyo]');
    if(chk){
      const [cual, i] = parte(chk.dataset.suyo);
      BAL[cual][+i].suyo = chk.checked;
      pintarBalance(); return;
    }
    for(const campo of ['baja', 'mequedo']){
      const b = e.target.closest(`[data-${campo}]`);
      if(!b) continue;
      const [cual, i] = parte(b.dataset[campo]);
      BAL[cual][+i][campo] = b.checked;
      pintarBalance(); return;
    }
    for(const campo of ['escact', 'escfin']){
      const s = e.target.closest(`[data-${campo}]`);
      if(!s) continue;
      const [cual, i] = parte(s.dataset[campo]);
      const fila = BAL[cual][+i];
      fila[campo === 'escact' ? 'escAct' : 'escFin'] = +s.value;
      // la cláusula no se puede dejar más alta de lo que ya estaba
      if((+fila.escFin || 0) > (+fila.escAct || 0)) fila.escFin = fila.escAct;
      pintarBalance(); return;
    }
  });

  cuerpo.addEventListener('input', e => {
    const t = e.target;

    if(t.id === 'bal-dias'){
      BAL.dias = +t.value;
      pintarBalance();
      const n = document.getElementById('bal-dias');
      if(n) n.focus();
      return;
    }

    // mientras escribe, la casilla no se toca: solo se guarda lo escrito y
    // se refrescan los números. Repintarla le robaría el cursor.
    for(const campo of ['precio', 'base', 'pague']){
      if(t.dataset[campo] !== undefined){
        const [cual, i] = parte(t.dataset[campo]);
        const fila = BAL[cual][+i];
        fila[campo + 'Txt'] = t.value;
        fila[campo] = leerDinero(t.value);
        totalesBalance();
        return;
      }
    }

    const b = t.closest('[data-busca]'); if(!b) return;
    const cual = b.dataset.busca;
    const caja = cuerpo.querySelector(`[data-sug-de="${cual}"]`);
    const q = b.value.trim().toLowerCase();
    if(q.length < 2){ caja.hidden = true; return; }
    const hay = DATOS.jugadores.filter(j => j.val &&
      (j.n.toLowerCase().includes(q) || (j.nc||'').toLowerCase().includes(q))).slice(0, 7);
    caja.hidden = !hay.length;
    caja.innerHTML = hay.map(j => {
      const p = POS[j.pos];
      return `<button class="sg" data-badd="${cual}|${clave(j)}">
        ${p?insignia(p[0],p[1],j.pos):''}${escudo(j.e, j.e)}
        <span class="sg-n">${j.n}</span>
        <span class="sg-d">${eur(j.val)}</span><span class="sg-x">+</span></button>`;
    }).join('');
  });
}

function avisarLleno(){
  const c = document.getElementById('carro-abrir');
  c.classList.add('lleno');
  setTimeout(() => c.classList.remove('lleno'), 600);
}

function arrancar(){
  calcularJornadas();
  INDICE = {};
  for(const j of DATOS.jugadores) INDICE[clave(j)] = j;

  // equipos y rivales
  const casillas = eq => `<label><input type="checkbox" value="${eq}"><span>${eq}</span></label>`;
  document.getElementById('panel-equipos').innerHTML = DATOS.equipos.map(casillas).join('');
  document.getElementById('panel-rivales').innerHTML = DATOS.equipos.map(casillas).join('');
  document.getElementById('panel-pos').innerHTML = DATOS.posiciones.map(casillas).join('');

  document.getElementById('panel-equipos').addEventListener('change', e => {
    e.target.checked ? estado.equipos.add(e.target.value) : estado.equipos.delete(e.target.value);
    pintar();
  });
  document.getElementById('panel-rivales').addEventListener('change', e => {
    e.target.checked ? estado.rivales.add(e.target.value) : estado.rivales.delete(e.target.value);
    document.getElementById('nota-rival').hidden = estado.rivales.size === 0;
    pintar();
  });
  document.getElementById('panel-pos').addEventListener('change', e => {
    e.target.checked ? estado.pos.add(e.target.value) : estado.pos.delete(e.target.value);
    pintar();
  });

  document.getElementById('modo-eq').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    document.querySelectorAll('#modo-eq button').forEach(x=>x.setAttribute('aria-pressed','false'));
    b.setAttribute('aria-pressed','true'); estado.modoEq = b.dataset.v; pintar();
  });

  // valor
  const num = (el, esc) => el.value === '' ? null : parseFloat(el.value) * esc;
  document.getElementById('val-min').addEventListener('input', e => {
    estado.valMin = num(e.target, 1e6); pintar(); });
  document.getElementById('val-max').addEventListener('input', e => {
    estado.valMax = num(e.target, 1e6); pintar(); });
  document.getElementById('cam-min').addEventListener('input', e => {
    estado.camMin = num(e.target, 1e3); pintar(); });

  // filtro "Juega": actividad reciente
  const ent = id => document.getElementById(id);
  const alCambiar = (id, campo, min, max) => ent(id).addEventListener('input', e => {
    estado[campo] = Math.min(max, Math.max(min, +e.target.value || min));
    pintar();
  });
  alCambiar('ult-n',     'ultN',      1, 20);
  alCambiar('ju-cuantos','juCuantos', 1, 20);
  alCambiar('ju-minutos','juMinutos', 1, 90);
  alCambiar('ju-totmin', 'juTotMin',  1, 1800);
  ent('ju-min').addEventListener('change', e => { estado.juOn = e.target.checked; pintar(); });
  ent('ju-tit').addEventListener('change', e => { estado.juTit = e.target.checked; pintar(); });
  ent('ju-tot').addEventListener('change', e => { estado.juTotOn = e.target.checked; pintar(); });
  ent('ju-ultimo').addEventListener('change', e => { estado.juUltimo = e.target.checked; pintar(); });

  // estadisticas clasicas
  const panelSt = document.getElementById('panel-stats');
  panelSt.innerHTML = '<span class="etiqueta">Sobre el total de la temporada</span>' +
    STATS.map(m => `<div class="st" data-st="${m.k}">
      <span class="st-t">${m.t}</span>
      <input type="number" class="st-min" step="1" placeholder="mín">
      <input type="number" class="st-max" step="1" placeholder="máx">
    </div>`).join('');
  panelSt.addEventListener('input', e => {
    const fila = e.target.closest('.st'); if(!fila) return;
    const k = fila.dataset.st;
    const v = el => el.value === '' ? null : parseFloat(el.value);
    const c = {min:v(fila.querySelector('.st-min')), max:v(fila.querySelector('.st-max'))};
    if(c.min === null && c.max === null) delete estado.stats[k];
    else estado.stats[k] = c;
    pintar();
  });

  // sub-desplegables dentro de Excluir
  document.querySelectorAll('.pop .sub-cab').forEach(b => {
    b.addEventListener('click', () => {
      const cuerpo = document.querySelector(`.sub-cuerpo[data-sub-de="${b.dataset.sub}"]`);
      if(!cuerpo) return;
      const abrir = cuerpo.hidden;
      cuerpo.hidden = !abrir;
      b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    });
  });

  const salidaMin = document.getElementById('out-min');
  salidaMin.textContent = estado.minMinutos + ' min';

  // jornadas
  const cajaJor = document.getElementById('jornadas');
  cajaJor.innerHTML = JORNADAS.map(n =>
    `<button class="chip" data-j="${n}" aria-pressed="false">J${n}</button>`).join('');
  cajaJor.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if(!b) return;
    const n = +b.dataset.j, on = b.getAttribute('aria-pressed') === 'true';
    b.setAttribute('aria-pressed', on ? 'false' : 'true');
    on ? estado.excluidas.delete(n) : estado.excluidas.add(n);
    pintar();
  });

  document.getElementById('ex-gol').addEventListener('change', e => { estado.exGol = e.target.checked; pintar(); });
  document.getElementById('ex-roja').addEventListener('change', e => { estado.exRoja = e.target.checked; pintar(); });
  document.getElementById('ex-min').addEventListener('change', e => { estado.exMin = e.target.checked; pintar(); });
  document.getElementById('minminutos').addEventListener('input', e => {
    estado.minMinutos = Math.max(1, +e.target.value||1);
    salidaMin.textContent = estado.minMinutos + ' min';
    if(estado.exMin) pintar(); });

  // condiciones
  const cajaRangos = document.getElementById('rangos');
  cajaRangos.addEventListener('click', e => {
    if(e.target.id === 'add-rango'){
      estado.rangos.push({k:'med', min:null, max:null});
      pintarRangos(); return;
    }
    if(e.target.classList.contains('quitar')){
      estado.rangos.splice(+e.target.closest('.rango').dataset.i, 1);
      pintarRangos(); pintar();
    }
  });
  cajaRangos.addEventListener('input', e => {
    const caja = e.target.closest('.rango'); if(!caja) return;
    const c = estado.rangos[+caja.dataset.i];
    const v = el => el.value === '' ? null : parseFloat(el.value);
    c.min = v(caja.querySelector('.r-min'));
    c.max = v(caja.querySelector('.r-max'));
    pintar();
  });
  cajaRangos.addEventListener('change', e => {
    if(!e.target.classList.contains('r-k')) return;
    const i = +e.target.closest('.rango').dataset.i;
    estado.rangos[i] = {k:e.target.value, min:null, max:null};
    pintarRangos(); pintar();
  });
  pintarRangos();

  // resto
  document.getElementById('sede').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    ponerSede(b.dataset.v); pintar();
  });
  document.getElementById('buscar').addEventListener('input', e => { estado.buscar = e.target.value; pintar(); });
  document.getElementById('fuente').addEventListener('change', e => { estado.fuente = e.target.value; pintar(); });
  document.getElementById('minpj').addEventListener('input', e => {
    estado.minpj = Math.max(1, +e.target.value||1); pintar(); });

  document.getElementById('cabeceras').addEventListener('click', e => {
    const th = e.target.closest('th'); if(!th) return;
    const k = th.dataset.k;
    if(k === 'racha' || k === 'cmp') return;
    if(estado.orden === k) estado.asc = !estado.asc;
    else { estado.orden = k; estado.asc = (k==='n'||k==='e'||k==='pos'); }
    pintar();
  });
  document.getElementById('cuerpo').addEventListener('click', e => {
    const tr = e.target.closest('tr'); if(!tr || !tr.dataset.i) return;
    abrirFicha(window.__filas[+tr.dataset.i]);
  });
  document.getElementById('tarjetas').addEventListener('click', e => {
    if(arrastre){ arrastre = false; return; }   // estaba deslizando, no abriendo la ficha
    if(largo){ largo = false; return; }         // era una pulsacion larga: ya la hemos usado
    if(e.target.id === 'tj-mas'){
      tope += TANDA * 2;
      pintarTarjetas(window.__filas);
      return;
    }
    const tj = e.target.closest('.tj'); if(!tj) return;
    abrirFicha(window.__filas[+tj.dataset.i]);
  });

  // la tira de cabecera: toca una metrica para ordenar, tocala otra vez para invertir
  const tira = document.getElementById('tira');
  tira.addEventListener('click', e => {
    const b = e.target.closest('.mt'); if(!b) return;
    const k = b.dataset.k;
    if(estado.orden === k) estado.asc = !estado.asc;
    else { estado.orden = k; estado.asc = false; }
    pintar();
    const nuevo = tira.querySelector('.mt.act');   // pintarTira ha rehecho los botones
    if(nuevo && nuevo.scrollIntoView) nuevo.scrollIntoView({block:'nearest', inline:'nearest', behavior:'smooth'});
  });
  tira.addEventListener('scroll', seguirTira, {passive:true});

  // arrastrar sobre los numeros de una tarjeta mueve la tira, como si fuese una tabla
  const cajaTj = document.getElementById('tarjetas');
  let x0 = null, sl0 = 0;
  cajaTj.addEventListener('pointerdown', e => {
    if(!e.target.closest('.tj-datos')) return;
    x0 = e.clientX; sl0 = tira.scrollLeft; arrastre = false;
  });
  cajaTj.addEventListener('pointermove', e => {
    if(x0 === null) return;
    const d = e.clientX - x0;
    if(!arrastre && Math.abs(d) < 8) return;
    arrastre = true;
    tira.scrollLeft = sl0 - d;
    e.preventDefault();
  });
  const soltar = () => { x0 = null; };
  cajaTj.addEventListener('pointerup', soltar);
  cajaTj.addEventListener('pointercancel', () => { x0 = null; arrastre = false; });

  document.getElementById('velo').addEventListener('click', () => cerrarPops(null));
  document.getElementById('ficha-cerrar').addEventListener('click', () =>
    document.getElementById('ficha').close());

  document.getElementById('cabecera-sub').textContent =
    `${DATOS.jugadores.length} jugadores · jornadas 1 a ${Math.max(...JORNADAS)}`;

  arrancarComparador();
  arrancarAyudas();
  pintar();
  document.getElementById('cargando').hidden = true;
  document.querySelector('.controles').hidden = false;
}

document.getElementById('btn-tema').addEventListener('click', () => {
  const oscuro = getComputedStyle(document.body).backgroundColor === 'rgb(17, 23, 20)';
  document.documentElement.setAttribute('data-theme', oscuro ? 'light' : 'dark');
  try { localStorage.setItem('tema', oscuro ? 'light' : 'dark'); } catch(_){}
});
try { const t = localStorage.getItem('tema'); if(t) document.documentElement.setAttribute('data-theme', t); } catch(_){}

fetch('datos.json?v=' + Date.now())
  .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => { DATOS = d; arrancar(); })
  .catch(e => {
    document.getElementById('cargando').hidden = true;
    const c = document.getElementById('error');
    c.hidden = false;
    c.textContent = 'No se han podido cargar los datos (' + e.message + '). Recarga en un momento.';
  });
