let DATOS = null;
const CLAVES = ["m2","md","cm","sf"];
const eur = n => n===null||n===undefined ? null : (n/1e6).toFixed(2).replace('.',',') + 'M';

const COLS = [
  {k:'n',   t:'Jugador', cls:'nom', txt:1},
  {k:'e',   t:'Equipo',  cls:'txt', txt:1},
  {k:'pos', t:'Pos',     cls:'txt', txt:1},
  {k:'pj',  t:'PJ'},
  {k:'med', t:'Media',   dec:2},
  {k:'mdn', t:'Mediana', dec:1},
  {k:'cas', t:'Casa',    dec:2, cls:'casa'},
  {k:'fue', t:'Fuera',   dec:2, cls:'fuera'},
  {k:'dif', t:'Casa − fuera', cls:'dif', dec:2, dif:1},
  {k:'tot', t:'Total',   dec:1},
  {k:'g',   t:'G'},
  {k:'a',   t:'Asis'},
  {k:'y',   t:'Am'},
  {k:'r',   t:'Roj'},
  {k:'min', t:'Min'},
  {k:'val', t:'Valor',  mercado:1},
  {k:'cam', t:'Hoy',    cambio:1},
];

const estado = {fuente:'m2', equipos:new Set(), modoEq:'incluir', pos:new Set(), rivales:new Set(),
                sede:'', minpj:1, exGol:false, exRoja:false, exMin:false, minMinutos:45,
                excluidas:new Set(), orden:'med', asc:false, buscar:''};

const JORNADAS = (()=>{ const s=new Set();
  for(const j of DATOS.jugadores) for(const f in j.p) for(const n in j.p[f]) s.add(+n);
  return [...s].sort((a,b)=>a-b); })();

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
    const [sede, rival] = (DATOS.lugar[n+'|'+j.e]||'|').split('|');
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
    pj:todos.length, tot:+todos.reduce((x,z)=>x+z,0).toFixed(1), med:prom(todos), mdn:mediana(todos),
    cas, fue, dif:(cas!==null&&fue!==null)?cas-fue:null, g,a,y,r,min,
    val:j.val, cam:j.cam};
}

const fmt = (v,d) => (v===null||v===undefined) ? '<span class="tenue">·</span>' : (d?v.toFixed(d):String(v));

function pintar(){
  const q = estado.buscar.toLowerCase();
  let filas = DATOS.jugadores
    .filter(j => !estado.equipos.size || (estado.modoEq==='incluir' ? estado.equipos.has(j.e) : !estado.equipos.has(j.e)))
    .filter(j => !estado.pos.size || estado.pos.has(j.pos))
    .filter(j => !q || j.n.toLowerCase().includes(q) || j.nc.toLowerCase().includes(q))
    .map(calcular).filter(Boolean);

  const k = estado.orden;
  filas.sort((x,z)=>{
    let A=x[k], B=z[k];
    if(typeof A==='string') return estado.asc ? A.localeCompare(B) : B.localeCompare(A);
    if(A===null) return 1; if(B===null) return -1;
    return estado.asc ? A-B : B-A;
  });

  document.getElementById('cabeceras').innerHTML = COLS.map(c =>
    `<th class="${c.cls==='nom'?'nom':c.cls==='txt'?'txt':c.cls==='dif'?'dif':''} ${k===c.k?'activo':''}" data-k="${c.k}">${c.t}${k===c.k?(estado.asc?' ↑':' ↓'):''}</th>`
  ).join('');

  document.getElementById('cuerpo').innerHTML = filas.length ? filas.map((f,i) =>
    '<tr data-i="'+i+'">' + COLS.map(c => {
      if(c.txt) return `<td class="${c.cls}">${f[c.k]||'<span class="tenue">·</span>'}</td>`;
      if(c.k==='pj' && f.pj !== f.disp) return `<td>${f.pj}<span class="tenue">/${f.disp}</span></td>`;
      let cls = c.cls || '';
      if(c.mercado) return `<td class="val">${f.val===null||f.val===undefined?'<span class="tenue">·</span>':eur(f.val)}</td>`;
      if(c.cambio){
        if(f.cam===null||f.cam===undefined) return '<td><span class="tenue">·</span></td>';
        const sig = f.cam>0?'+':'';
        return `<td class="${f.cam>0?'sube':f.cam<0?'baja':'tenue'}">${sig}${(f.cam/1000).toFixed(0)}k</td>`;
      }
      if(c.dif) cls = 'dif ' + (f.dif===null ? '' : f.dif>0 ? 'dif-pos' : f.dif<0 ? 'dif-neg' : '');
      return `<td class="${cls}">${fmt(f[c.k], c.dec)}</td>`;
    }).join('') + '</tr>'
  ).join('') : `<tr><td class="vacio" colspan="${COLS.length}">Ningún jugador cumple estos filtros. Prueba a bajar los partidos mínimos.</td></tr>`;

  const avisos = [];
  if(estado.exGol) avisos.push('sin jornadas con gol');
  if(estado.exRoja) avisos.push('sin jornadas con roja');
  if(estado.exMin) avisos.push(`sin partidos de menos de ${estado.minMinutos} min`);
  if(estado.excluidas.size) avisos.push(`${estado.excluidas.size} jornada(s) fuera`);
  if(estado.pos.size) avisos.push([...estado.pos].join(', '));
  if(estado.rivales.size) avisos.push(`sin partidos contra ${[...estado.rivales].join(', ')}`);
  if(estado.equipos.size) avisos.push(`${estado.modoEq==='incluir'?'solo':'sin'} ${[...estado.equipos].join(', ')}`);

  document.getElementById('resumen').innerHTML =
    `<span><strong>${filas.length}</strong> jugadores</span>` +
    `<span>${filas.filter(f=>f.dif!==null).length} con partidos en casa y fuera</span>` +
    (esNota() ? '<span class="escala">nota Sofascore, escala 0-10</span>' : '') +
    (avisos.length ? `<span class="aviso">${avisos.join(' · ')}</span>` : '');

  window.__filas = filas;
}

function abrirFicha(f){
  document.getElementById('ficha-nombre').textContent = f.n;
  document.getElementById('ficha-equipo').textContent =
    (f.pos ? f.pos + ' · ' : '') + (f.nc !== f.n ? f.nc : f.e);

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

// ---- equipos
const panelEq = document.getElementById('panel-equipos');
panelEq.innerHTML = DATOS.equipos.map(e => `<label><input type="checkbox" value="${e}"><span>${e}</span></label>`).join('')
  + '<div class="acciones"><button class="limpiar" data-a="ninguno">quitar selección</button></div>';
panelEq.addEventListener('change', e => {
  if(e.target.checked) estado.equipos.add(e.target.value); else estado.equipos.delete(e.target.value);
  actualizarCuenta(); pintar();
});
panelEq.addEventListener('click', e => {
  if(e.target.dataset.a !== 'ninguno') return;
  estado.equipos.clear();
  panelEq.querySelectorAll('input').forEach(i => i.checked = false);
  actualizarCuenta(); pintar();
});
document.getElementById('modo-eq').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#modo-eq button').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true'); estado.modoEq = b.dataset.v; pintar();
});

function arrancar(){
// ---- rivales a descartar
const panelRiv = document.getElementById('panel-rivales');
const notaRiv = document.getElementById('nota-rival');
panelRiv.innerHTML = DATOS.equipos.map(e => `<label><input type="checkbox" value="${e}"><span>${e}</span></label>`).join('')
  + '<div class="acciones"><button class="limpiar" data-a="ninguno">quitar selección</button></div>';
panelRiv.addEventListener('change', e => {
  if(e.target.checked) estado.rivales.add(e.target.value); else estado.rivales.delete(e.target.value);
  notaRiv.toggleAttribute('hidden', estado.rivales.size === 0);
  actualizarCuenta(); pintar();
});
panelRiv.addEventListener('click', e => {
  if(e.target.dataset.a !== 'ninguno') return;
  estado.rivales.clear();
  panelRiv.querySelectorAll('input').forEach(i => i.checked = false);
  notaRiv.setAttribute('hidden',''); actualizarCuenta(); pintar();
});

// ---- posiciones
const panelPos = document.getElementById('panel-pos');
panelPos.innerHTML = DATOS.posiciones.map(p => `<label><input type="checkbox" value="${p}"><span>${p}</span></label>`).join('');
panelPos.addEventListener('change', e => {
  if(e.target.checked) estado.pos.add(e.target.value); else estado.pos.delete(e.target.value);
  actualizarCuenta(); pintar();
});

// ---- jornadas sueltas
const cajaJor = document.getElementById('jornadas');
JORNADAS.forEach(n => cajaJor.insertAdjacentHTML('beforeend', `<button class="chip" data-j="${n}" aria-pressed="false">J${n}</button>`));
cajaJor.insertAdjacentHTML('beforeend', '<button class="limpiar" id="limpiar-jor">quitar</button>');
cajaJor.addEventListener('click', e => {
  if(e.target.id === 'limpiar-jor'){
    estado.excluidas.clear();
    cajaJor.querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed','false'));
    actualizarCuenta(); return pintar();
  }
  const b = e.target.closest('.chip'); if(!b) return;
  const n = +b.dataset.j, on = b.getAttribute('aria-pressed') === 'true';
  b.setAttribute('aria-pressed', on ? 'false' : 'true');
  on ? estado.excluidas.delete(n) : estado.excluidas.add(n);
  actualizarCuenta(); pintar();
});

// ---- resto de controles
document.getElementById('sede').addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#sede button').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true'); estado.sede = b.dataset.v; pintar();
});
document.getElementById('buscar').addEventListener('input', e => { estado.buscar = e.target.value; pintar(); });
document.getElementById('fuente').addEventListener('change', e => { estado.fuente = e.target.value; pintar(); });
document.getElementById('minpj').addEventListener('input', e => { estado.minpj = Math.max(1, +e.target.value||1); pintar(); });
document.getElementById('ex-gol').addEventListener('change', e => { estado.exGol = e.target.checked; actualizarCuenta(); pintar(); });
document.getElementById('ex-roja').addEventListener('change', e => { estado.exRoja = e.target.checked; actualizarCuenta(); pintar(); });
document.getElementById('ex-min').addEventListener('change', e => { estado.exMin = e.target.checked; actualizarCuenta(); pintar(); });
document.getElementById('minminutos').addEventListener('input', e => { estado.minMinutos = Math.max(1, +e.target.value||1); if(estado.exMin) pintar(); });

const btnMas = document.getElementById('btn-mas'), avanzado = document.getElementById('avanzado');
btnMas.addEventListener('click', () => {
  const ab = avanzado.hasAttribute('hidden');
  avanzado.toggleAttribute('hidden', !ab);
  btnMas.setAttribute('aria-expanded', ab ? 'true' : 'false');
});
function actualizarCuenta(){
  const n = estado.equipos.size + estado.pos.size + estado.excluidas.size + estado.rivales.size
          + (estado.exGol?1:0) + (estado.exRoja?1:0) + (estado.exMin?1:0);
  btnMas.innerHTML = n ? `Más filtros <span class="cuenta">· ${n}</span>` : 'Más filtros';
}

document.getElementById('cabeceras').addEventListener('click', e => {
  const th = e.target.closest('th'); if(!th) return;
  const k = th.dataset.k;
  if(estado.orden === k) estado.asc = !estado.asc;
  else { estado.orden = k; estado.asc = (k==='n'||k==='e'||k==='pos'); }
  pintar();
});
document.getElementById('cuerpo').addEventListener('click', e => {
  const tr = e.target.closest('tr'); if(!tr || !tr.dataset.i) return;
  abrirFicha(window.__filas[+tr.dataset.i]);
});
document.getElementById('ficha-cerrar').addEventListener('click', () => document.getElementById('ficha').close());

document.getElementById('btn-tema').addEventListener('click', () => {
  const oscuro = getComputedStyle(document.body).backgroundColor === 'rgb(17, 23, 20)';
  document.documentElement.setAttribute('data-theme', oscuro ? 'light' : 'dark');
  try { localStorage.setItem('tema', oscuro ? 'light' : 'dark'); } catch(_){}
});
try { const t = localStorage.getItem('tema'); if(t) document.documentElement.setAttribute('data-theme', t); } catch(_){}

document.getElementById('cabecera-sub').textContent =
  `${DATOS.jugadores.length} jugadores · jornadas 1 a ${Math.max(...JORNADAS)}`;

actualizarCuenta();
pintar();
document.getElementById('cargando').hidden = true;
document.querySelector('.controles').hidden = false;
document.querySelector('.tabla-caja').hidden = false;
}

fetch('datos.json?v=' + Date.now())
  .then(r => { if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
  .then(d => { DATOS = d; arrancar(); })
  .catch(e => {
    document.getElementById('cargando').hidden = true;
    const c = document.getElementById('error');
    c.hidden = false;
    c.textContent = 'No se han podido cargar los datos (' + e.message + '). Recarga en un momento.';
  });
