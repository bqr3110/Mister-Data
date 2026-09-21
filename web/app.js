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
  ultN:5, juOn:false, juCuantos:3, juMinutos:15,
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
  let jug = 0, min = 0;
  for(const n of ult){
    const m = minutosEn(j, n);
    min += m;
    if(m >= estado.juMinutos) jug++;
  }
  return {ult:jug, ultDe:ult.length, ultMin:min,
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
  let g=0,a=0,asg=0,y=0,r=0,min=0;

  for(const nj in pts){
    const n = +nj;
    const ev = j.ev[nj] || {};
    g+=ev.g||0; a+=ev.a||0; asg+=ev.asg||0; y+=ev.y||0; r+=ev.r||0; min+=ev.m||0;

    if(estado.excluidas.has(n)) continue;
    const [sede, rival] = (DATOS.lugar[n+'|'+j.e] || '|').split('|');
    if(estado.sede && sede !== estado.sede) continue;
    if(estado.rivales.has(rival)) continue;
    if(estado.exGol  && (ev.g||0) > 0) continue;
    if(estado.exRoja && (ev.r||0) > 0) continue;
    if(estado.exMin  && ev.m !== undefined && ev.m < estado.minMinutos) continue;

    const p = pts[nj];
    todos.push(p); usadas.push(n);
    if(sede==='C') casa.push(p); else if(sede==='F') fuera.push(p);
  }

  if(!ignorarMin && todos.length < estado.minpj) return null;
  const cas = prom(casa), fue = prom(fuera);
  return {n:j.n, e:j.e, pos:j.pos||'', nc:j.nc, ref:j, usadas, disp:Object.keys(pts).length,
    pj:todos.length, tot:+todos.reduce((x,z)=>x+z,0).toFixed(1),
    med:prom(todos), mdn:mediana(todos),
    cas, fue, dif:(cas!==null&&fue!==null)?cas-fue:null,
    g,a,asg,y,r,min, atot:a+asg, mpm: todos.length ? Math.round(min/todos.length) : null,
    val:j.val, cam:j.cam, ...actividad(j)};
}

function nivel(v){
  if(v === undefined || v === null) return 'pv';
  if(esNota()) return v<6 ? 'p0' : v<6.8 ? 'p1' : v<7.4 ? 'p2' : v<8.2 ? 'p3' : 'p4';
  return v<0 ? 'p0' : v<3 ? 'p1' : v<6 ? 'p2' : v<10 ? 'p3' : 'p4';
}
function pintarRacha(f, tope){
  const pts = f.ref.p[estado.fuente] || {};
  const js = (tope && JORNADAS.length > tope) ? JORNADAS.slice(-tope) : JORNADAS;
  return js.map(n => {
    const v = pts[n];
    const dentro = f.usadas.includes(n);
    const [sede] = (DATOS.lugar[n+'|'+f.e] || '|').split('|');
    const t = v===undefined ? `J${n}: no jugó` : `J${n} ${sede==='C'?'casa':'fuera'}: ${v}`;
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
  min:  'Minutos jugados en total',
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
const TIRA = ['med','mdn','cas','fue','dif','ult','pj','tot','g','atot','min','mpm','y','r','val','cam'];
const CORTO = {ult:'Jugados', atot:'Asis', med:'Media', mdn:'Mediana', dif:'Casa−fuera', mpm:'Min/P', tot:'Total',
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
      : `<i class="${f.cam>0?'sube':'baja'}">${f.cam>0?'+':''}${(f.cam/1000).toFixed(0)}k</i>`;
    const val = (f.val === null || f.val === undefined) ? '' : millones(f.val);
    return `<article class="tj" data-i="${i}" data-k="${f.n + '|' + f.e}">
      <div class="tj-cab">
        ${p ? insignia(p[0], p[1], f.pos) : ''}${e ? insignia(e[0], e[1], f.e) : ''}
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
        return `<td class="cen${s}">${e ? insignia(e[0], e[1], f.e) : f.e}</td>`;
      }
      if(c.racha) return `<td class="racha${s}">${pintarRacha(f)}</td>`;
      if(c.txt) return `<td class="nom${s}">${f[c.k]||'<span class="tenue">·</span>'}</td>`;
      if(c.ultimos) return `<td class="${f.ult===0?'fuera':''}${s}">${f.ult}<span class="tenue">/${f.ultDe}</span></td>`;
      if(c.k==='pj' && f.pj !== f.disp) return `<td class="sep">${f.pj}<span class="tenue">/${f.disp}</span></td>`;
      if(c.mercado) return `<td class="val${s}">${f.val===null||f.val===undefined?'<span class="tenue">·</span>':eur(f.val)}</td>`;
      if(c.cambio){
        if(f.cam===null||f.cam===undefined) return '<td><span class="tenue">·</span></td>';
        const sig = f.cam>0?'+':'';
        return `<td class="${f.cam>0?'sube':f.cam<0?'baja':'tenue'}">${sig}${(f.cam/1000).toFixed(0)}k</td>`;
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
      if(estado.juOn    && f.ult    < estado.juCuantos) return false;
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
    t:`Jugó ${estado.juCuantos} de los últimos ${estado.ultN}`, q:()=>{
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
  estado.juOn = estado.juTotOn = estado.juUltimo = false;
  ['ju-min','ju-tot','ju-ultimo'].forEach(i => document.getElementById(i).checked = false);
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

  let html = '<table class="cmp-tabla"><thead><tr><th class="cmp-rot"></th>' +
    fichas.map(f => {
      const p = POS[f.pos], e = EQUIPO[f.e];
      return `<th><div class="cmp-jug">
        <div class="cmp-ins">${p?insignia(p[0],p[1],f.pos):''}${e?insignia(e[0],e[1],f.e):''}</div>
        <span class="cmp-n">${f.n}</span>
        <button class="cmp-quitar" data-quitar="${f.clave}" aria-label="Quitar">&times;</button>
      </div></th>`;
    }).join('') + '</tr></thead><tbody>';

  for(const a of filas){
    // el mejor de la fila se resalta, salvo en atributos sin ganador claro
    let mejor = null;
    if(a.alto !== null){
      const vs = fichas.map(f => f[a.k]).filter(v => v !== null && v !== undefined);
      if(vs.length > 1) mejor = a.alto ? Math.max(...vs) : Math.min(...vs);
    }
    html += `<tr><th class="cmp-rot"${AYUDA[a.k]?` data-ayuda="${AYUDA[a.k]}"`:''}>${a.t}</th>` + fichas.map(f => {
      const v = f[a.k];
      const gana = mejor !== null && v === mejor && v !== null && v !== undefined;
      return `<td class="${gana?'gana':''}">${valorAtrib(f, a)}</td>`;
    }).join('') + '</tr>';
  }

  // racha, siempre al final: es lo que mejor se lee de un vistazo
  html += '<tr><th class="cmp-rot">Racha</th>' + fichas.map(f =>
    `<td class="cmp-racha">${pintarRacha(f, 6)}</td>`).join('') + '</tr></tbody></table>';

  cuerpo.innerHTML = html;
  document.getElementById('cmp-pie').innerHTML = filas.length
    ? `<span>Sobre ${DATOS.fuentes[estado.fuente]}, con los filtros de exclusión que tengas puestos.</span>`
    : '<span>Elige arriba qué datos quieres comparar.</span>';
}

function abrirComparador(){
  pintarComparador();
  document.getElementById('comparador').showModal();
}

/* ---------- ficha ---------- */

function abrirFicha(f){
  document.getElementById('ficha-nombre').textContent = f.n;
  document.getElementById('ficha-equipo').textContent =
    (f.pos ? f.pos + ' · ' : '') + (f.nc !== f.n ? f.nc : f.e) +
    (f.val ? ' · ' + eur(f.val) : '');

  const js = [...new Set(CLAVES.flatMap(c => Object.keys(f.ref.p[c]||{})))].map(Number).sort((a,b)=>a-b);

  document.getElementById('ficha-sistemas').innerHTML = CLAVES.map(c => {
    const p = f.ref.p[c] || {};
    const v = js.map(n => p[n]).filter(x => x!==undefined);
    const m = v.length ? (v.reduce((a,b)=>a+b,0)/v.length) : null;
    return `<div class="${c===estado.fuente?'act':''}">${DATOS.fuentes[c]}${c==='sf'?' <span class="escala">0-10</span>':''}
      <strong>${m===null?'·':m.toFixed(2)}</strong></div>`;
  }).join('');

  const pr = DATOS.prox[f.e] || [];
  document.getElementById('ficha-prox').innerHTML = pr.length
    ? '<span class="etiqueta">Próximos</span> ' + pr.map(([n,sd,rival,cuando]) =>
        `<span class="prox ${sd==='C'?'c':''}" title="${cuando||''}">J${n} ${sd==='C'?'vs':'@'} ${rival}</span>`).join(' ')
    : '';

  let html = '<thead><tr><th class="nom">Jornada</th><th class="txt">Rival</th>'
    + CLAVES.map(c=>`<th class="${c===estado.fuente?'':'otra'}">${DATOS.fuentes[c]}</th>`).join('')
    + '<th>Min</th><th>G</th><th>Asis</th><th>Am</th><th>Roj</th></tr></thead><tbody>';

  for(const n of js){
    const [sede, rival] = (DATOS.lugar[n+'|'+f.e]||'|').split('|');
    const ev = f.ref.ev[n] || {};
    const dentro = f.usadas.includes(n);
    html += `<tr style="${dentro?'':'opacity:.4'}">`
      + `<td class="nom">J${n} <span class="${sede==='C'?'casa':'fuera'}">${sede==='C'?'casa':'fuera'}</span></td>`
      + `<td class="txt">${rival||''}</td>`
      + CLAVES.map(c => { const v=(f.ref.p[c]||{})[n];
          return `<td ${c===estado.fuente?'style="font-weight:600"':'class="tenue otra"'}>${v===undefined?'·':v}</td>`; }).join('')
      + `<td>${ev.m!==undefined?ev.m:'<span class="tenue">·</span>'}</td>`
      + `<td>${ev.g||''}</td><td>${(ev.a||0)+(ev.asg||0)||''}</td><td>${ev.y||''}</td><td>${ev.r||''}</td></tr>`;
  }
  document.getElementById('ficha-tabla').innerHTML = html + '</tbody>';

  const k = f.n + '|' + f.e;
  document.getElementById('ficha-pie').innerHTML =
    `<span>${DATOS.fuentes[estado.fuente]}: media ${f.med.toFixed(2)}, mediana ${f.mdn}, sobre ${f.pj} partidos. Las filas atenuadas quedan fuera por los filtros activos.</span>` +
    `<button class="ficha-cmp${enCarro(k)?' puesto':''}" data-cmp-ficha="${k}">${
      enCarro(k) ? '✓ En el comparador' : '+ Mandar al comparador'}</button>`;
  document.getElementById('ficha').showModal();
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
    estado.juOn = estado.juTotOn = estado.juUltimo = false;
    ['ju-min','ju-tot','ju-ultimo'].forEach(i => document.getElementById(i).checked = false);
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

  document.getElementById('ficha-pie').addEventListener('click', e => {
    const b = e.target.closest('[data-cmp-ficha]'); if(!b) return;
    if(!alternarCarro(b.dataset.cmpFicha)) return avisarLleno();
    const dentro = enCarro(b.dataset.cmpFicha);
    b.classList.toggle('puesto', dentro);
    b.textContent = dentro ? '✓ En el comparador' : '+ Mandar al comparador';
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
        ${p?insignia(p[0],p[1],j.pos):''}${e?insignia(e[0],e[1],j.e):''}
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
