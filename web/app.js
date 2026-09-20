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
function insignia(txt, color){
  return `<span class="ins" style="background:${color};color:${tinta(color)}">${txt}</span>`;
}

const eur = n => (n === null || n === undefined) ? null
  : (n / 1e6).toFixed(2).replace('.', ',') + 'M';

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
  {k:'a',   t:'Asistencias'},
  {k:'y',   t:'Amarillas'},
  {k:'r',   t:'Rojas'},
  {k:'pj',  t:'Partidos jugados'},
  {k:'mpm', t:'Minutos por partido'},
];

const COLS = [
  {k:'pos', t:'Pos',     pega:'c0', insig:'pos'},
  {k:'e',   t:'Eq',      pega:'c1', insig:'eq'},
  {k:'val', t:'Valor',   pega:'c2', mercado:1},
  {k:'n',   t:'Jugador', pega:'c3', txt:1},
  {k:'racha', t:'Racha', racha:1, sep:1},
  {k:'pj',  t:'PJ'},
  {k:'med', t:'Media',   dec:2},
  {k:'mdn', t:'Mediana', dec:1},
  {k:'cas', t:'Casa', sep:1,    dec:2, cls:'casa'},
  {k:'fue', t:'Fuera',   dec:2, cls:'fuera'},
  {k:'dif', t:'Casa − fuera', cls:'dif', dec:2, dif:1},
  {k:'tot', t:'Total',   dec:1},
  {k:'g',   t:'G', sep:1},
  {k:'a',   t:'Asis'},
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
};

let JORNADAS = [];
function calcularJornadas(){
  const s = new Set();
  for(const j of DATOS.jugadores) for(const f in j.p) for(const n in j.p[f]) s.add(+n);
  JORNADAS = [...s].sort((a,b)=>a-b);
}

const mediana = v => { if(!v.length) return null;
  const o=[...v].sort((a,b)=>a-b), m=o.length>>1;
  return o.length%2 ? o[m] : +((o[m-1]+o[m])/2).toFixed(2); };
const prom = v => v.length ? v.reduce((a,b)=>a+b,0)/v.length : null;
const esNota = () => estado.fuente === 'sf';

function calcular(j){
  const pts = j.p[estado.fuente];
  if(!pts) return null;

  const todos=[], casa=[], fuera=[], usadas=[];
  let g=0,a=0,y=0,r=0,min=0;

  for(const nj in pts){
    const n = +nj;
    const ev = j.ev[nj] || {};
    g+=ev.g||0; a+=(ev.a||0)+(ev.asg||0); y+=ev.y||0; r+=ev.r||0; min+=ev.m||0;

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

  if(todos.length < estado.minpj) return null;
  const cas = prom(casa), fue = prom(fuera);
  return {n:j.n, e:j.e, pos:j.pos||'', nc:j.nc, ref:j, usadas, disp:Object.keys(pts).length,
    pj:todos.length, tot:+todos.reduce((x,z)=>x+z,0).toFixed(1),
    med:prom(todos), mdn:mediana(todos),
    cas, fue, dif:(cas!==null&&fue!==null)?cas-fue:null,
    g,a,y,r,min, mpm: todos.length ? Math.round(min/todos.length) : null,
    val:j.val, cam:j.cam};
}

function nivel(v){
  if(v === undefined || v === null) return 'pv';
  if(esNota()) return v<6 ? 'p0' : v<6.8 ? 'p1' : v<7.4 ? 'p2' : v<8.2 ? 'p3' : 'p4';
  return v<0 ? 'p0' : v<3 ? 'p1' : v<6 ? 'p2' : v<10 ? 'p3' : 'p4';
}
function pintarRacha(f){
  const pts = f.ref.p[estado.fuente] || {};
  return JORNADAS.map(n => {
    const v = pts[n];
    const dentro = f.usadas.includes(n);
    const [sede] = (DATOS.lugar[n+'|'+f.e] || '|').split('|');
    const t = v===undefined ? `J${n}: no jugó` : `J${n} ${sede==='C'?'casa':'fuera'}: ${v}`;
    return `<i class="pt ${nivel(v)}${dentro?'':' off'}" title="${t}">${v===undefined?'':v}</i>`;
  }).join('');
}

const fmt = (v,d) => (v===null||v===undefined) ? '<span class="tenue">·</span>'
  : (d ? v.toFixed(d) : String(v));

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

  document.getElementById('cabeceras').innerHTML = COLS.map(c =>
    `<th class="${c.txt?'nom':c.insig?'cen':c.racha?'racha':c.cls==='dif'?'dif':''} ${c.sep?'sep':''} ${c.pega?'pega '+c.pega:''} ${k===c.k?'activo':''}" data-k="${c.k}">${c.t}${k===c.k?(estado.asc?' ↑':' ↓'):''}</th>`
  ).join('');

  document.getElementById('cuerpo').innerHTML = filas.length ? filas.map((f,i) =>
    '<tr data-i="'+i+'">' + COLS.map(c => {
      const s = (c.sep ? ' sep' : '') + (c.pega ? ' pega ' + c.pega : '');
      if(c.insig === 'pos'){
        const p = POS[f.pos];
        return `<td class="cen${s}">${p ? insignia(p[0], p[1]) : '<span class="tenue">·</span>'}</td>`;
      }
      if(c.insig === 'eq'){
        const e = EQUIPO[f.e];
        return `<td class="cen${s}" title="${f.e}">${e ? insignia(e[0], e[1]) : f.e}</td>`;
      }
      if(c.racha) return `<td class="racha${s}">${pintarRacha(f)}</td>`;
      if(c.txt) return `<td class="nom${s}">${f[c.k]||'<span class="tenue">·</span>'}</td>`;
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

  document.getElementById('resumen').innerHTML =
    `<span><strong>${filas.length}</strong> jugadores</span>` +
    `<span>${filas.filter(f=>f.dif!==null).length} con partidos en casa y fuera</span>` +
    (esNota() ? '<span class="escala">nota Sofascore, escala 0-10</span>' : '');

  pintarActivos();
  marcarBotones();
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
  caja.innerHTML = L.map((x,i) =>
    `<span class="activo-chip"><b>${x.t}</b><button data-i="${i}" aria-label="Quitar">&times;</button></span>`
  ).join('') + (L.length ? '<button class="todos" id="limpiar-todo">quitar todos</button>' : '');
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
  const b = e.target.closest('button[data-i]'); if(!b) return;
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
    + CLAVES.map(c=>`<th>${DATOS.fuentes[c]}</th>`).join('')
    + '<th>Min</th><th>G</th><th>Asis</th><th>Am</th><th>Roj</th></tr></thead><tbody>';

  for(const n of js){
    const [sede, rival] = (DATOS.lugar[n+'|'+f.e]||'|').split('|');
    const ev = f.ref.ev[n] || {};
    const dentro = f.usadas.includes(n);
    html += `<tr style="${dentro?'':'opacity:.4'}">`
      + `<td class="nom">J${n} <span class="${sede==='C'?'casa':'fuera'}">${sede==='C'?'casa':'fuera'}</span></td>`
      + `<td class="txt">${rival||''}</td>`
      + CLAVES.map(c => { const v=(f.ref.p[c]||{})[n];
          return `<td ${c===estado.fuente?'style="font-weight:600"':'class="tenue"'}>${v===undefined?'·':v}</td>`; }).join('')
      + `<td>${ev.m!==undefined?ev.m:'<span class="tenue">·</span>'}</td>`
      + `<td>${ev.g||''}</td><td>${(ev.a||0)+(ev.asg||0)||''}</td><td>${ev.y||''}</td><td>${ev.r||''}</td></tr>`;
  }
  document.getElementById('ficha-tabla').innerHTML = html + '</tbody>';

  document.getElementById('ficha-pie').textContent =
    `${DATOS.fuentes[estado.fuente]}: media ${f.med.toFixed(2)}, mediana ${f.mdn}, sobre ${f.pj} partidos. Las filas atenuadas quedan fuera por los filtros activos.`;
  document.getElementById('ficha').showModal();
}

/* ---------- desplegables ---------- */

function cerrarPops(salvo){
  document.querySelectorAll('.grupo').forEach(g => {
    const b = g.querySelector('.filtro'), p = g.querySelector('.pop');
    if(!b || !p || g === salvo) return;
    p.hidden = true; b.setAttribute('aria-expanded','false');
  });
}

document.getElementById('barra-filtros').addEventListener('click', e => {
  const b = e.target.closest('.filtro');
  if(b){
    const g = b.closest('.grupo'), p = g.querySelector('.pop');
    const abrir = p.hidden;
    cerrarPops(g);
    p.hidden = !abrir;
    b.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    return;
  }
  const lim = e.target.dataset.limpiar;
  if(lim === 'equipos'){ estado.equipos.clear(); todasCasillas('panel-equipos', false); pintar(); }
  if(lim === 'rivales'){ estado.rivales.clear(); todasCasillas('panel-rivales', false);
    document.getElementById('nota-rival').hidden = true; pintar(); }
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

function arrancar(){
  calcularJornadas();

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
  document.querySelectorAll('.sub-cab').forEach(b => {
    b.addEventListener('click', () => {
      const cuerpo = document.querySelector(`.sub-cuerpo[data-sub-de="${b.dataset.sub}"]`);
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
    if(k === 'racha') return;
    if(estado.orden === k) estado.asc = !estado.asc;
    else { estado.orden = k; estado.asc = (k==='n'||k==='e'||k==='pos'); }
    pintar();
  });
  document.getElementById('cuerpo').addEventListener('click', e => {
    const tr = e.target.closest('tr'); if(!tr || !tr.dataset.i) return;
    abrirFicha(window.__filas[+tr.dataset.i]);
  });
  document.getElementById('ficha-cerrar').addEventListener('click', () =>
    document.getElementById('ficha').close());

  document.getElementById('cabecera-sub').textContent =
    `${DATOS.jugadores.length} jugadores · jornadas 1 a ${Math.max(...JORNADAS)}`;

  pintar();
  document.getElementById('cargando').hidden = true;
  document.querySelector('.controles').hidden = false;
  document.querySelector('.tabla-caja').hidden = false;
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
