/* ==========================================================================
   Interface do app do T10 (16/10/2026), refeita pelas duas gravacoes que o
   Eduardo fez do controle do T10 (drone desligado e drone ligado). Palco
   1280x720 (a tela 16:9 do controle), sem nome nem logotipo do fabricante.

   Reusa o motor do app do T25/T50 (nucleo.js, mapa.js, config.js...), que
   continua montado e escondido por baixo: estado do jogo (APP.E), comandos
   (cmd), tarefas por mapa (M.tarefas), rota (rotaPlanejada), ajustes (M.P).
   So desenha uma tela nova por cima, como o app do J100 (j100.js).

   So vale com ?interface=t10 e com o T10_APP ligado no simulador (principal.js).
   A camera do T10: duas cameras FIXAS (frente e traseira), sem gimbal; o drone
   vai e volta sem virar, por isso cada lado tem a sua (camera_t10.js).
   ========================================================================== */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  if (Q.get('interface') !== 't10') return;
  var JOGO = null;
  try { if (top !== window && top.T10_APP === true) JOGO = top; } catch (e) { JOGO = null; }
  var TESTE = /#teste=/.test(location.hash);
  if (!JOGO && !TESTE) return;

  /* ------------------------------------------------------------ palco */
  /* A interface vive num shadow root: o app.css do T25/T50 (que continua por baixo)
     usa os mesmos nomes de classe (.acoes, .osd, .alertas...) e vazava para ca. */
  var host = document.createElement('div');
  host.id = 't10-host';
  host.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;z-index:50';
  document.body.appendChild(host);
  var raiz = host.attachShadow({ mode: 'open' });
  var lk = document.createElement('link');
  lk.rel = 'stylesheet'; lk.href = 't10.css?v=baec48ba8d8a';
  raiz.appendChild(lk);
  var lk2 = document.createElement('link');
  lk2.rel = 'stylesheet'; lk2.href = 't10-b.css?v=2a1ed86dd846';
  raiz.appendChild(lk2);
  var stage = document.createElement('div');
  stage.id = 't10';
  raiz.appendChild(stage);
  var esconde = document.createElement('style');
  esconde.textContent = 'html,body{background:#000!important}#palco{visibility:hidden!important;pointer-events:none!important}';
  document.head.appendChild(esconde);
  document.body.classList.add('t10-v1');
  function escalar() {
    /* iframe ainda sem tamanho (controle recem-ligado): k = 0 deixava o palco em scale(0), tela preta ate alguem redimensionar */
    if (!(innerWidth > 0 && innerHeight > 0)) { setTimeout(escalar, 250); return; }
    var k = Math.min(innerWidth / 1280, innerHeight / 720);
    stage.style.transform = 'scale(' + k + ')';
    stage.style.left = ((innerWidth - 1280 * k) / 2) + 'px';
    stage.style.top = ((innerHeight - 720 * k) / 2) + 'px';
    S.k = k;
  }
  var S = {
    k: 1, tela: 'inicio', sub: 'lista', aba: 'Campos',
    sel: null, ed: null, modo: 'M', modoMenu: false,
    pagCfg: null, avancado: false, painelTarefa: false, painelEd: true, abaEd: 'rota',
    ptipo: 'Ponto limite', pmetodo: 'Retículo', pmodo: 'ref',
    seguir: true, girar: false, camadas: false, sat: true,
    principal: 'mapa', mini: ['f'], duas: false,
    V: { k: 1.16, x: 0, y: 0 }, vistaIni: false,
    dlg: null, toast: null, menu: null, teclado: null, carregando: null,
    mover: false, conexao: null, conta: 0,
  };
  var L = {};
  try { L = JSON.parse(localStorage.getItem('t10_cfg') || '{}'); } catch (e) { L = {}; }
  function gravarL() { try { localStorage.setItem('t10_cfg', JSON.stringify(L)); } catch (e) { /* sem guardar */ } }
  function lv(k, d) { return L[k] == null ? d : L[k]; }

  /* ------------------------------------------------------- utilidades */
  var E_ = function () { return (window.APP && APP.E) || null; };
  function conectado() { return !!(window.APP && APP.conectado); }
  function fmt(v, c) { return (Number(v) || 0).toFixed(c == null ? 1 : c); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function qs(s, r) { return (r || stage).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || stage).querySelectorAll(s)); }
  function setHtml(e, h) { if (e && e._h !== h) { e._h = h; e.innerHTML = h; } }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function passoV(v, p, a, b) { return clamp(Math.round(v / p) * p, a, b); }

  var IC = {
    doc: '<path d="M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 15h7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 4-7 8-7s8 2 8 7"/>',
    drone: '<circle cx="5.5" cy="5.5" r="3"/><circle cx="18.5" cy="5.5" r="3"/><circle cx="5.5" cy="18.5" r="3"/><circle cx="18.5" cy="18.5" r="3"/><path d="M8 8l8 8M16 8l-8 8"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/>',
    ajuda: '<path d="M4 5h16v11h-9l-4 4v-4H4z"/><path d="M10 9a2 2 0 1 1 3 1.7c-.7.4-1 .8-1 1.6M12 14.2v.1"/>',
    avisos: '<path d="M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 0 1 0 6"/>',
    engr: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    cubo: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    borracha: '<path d="M4 15l8-9 7 6-6 8H8zM8 19h11M7.5 12.5l6 5"/>',
    local: '<circle cx="12" cy="12" r="7.5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    seta: '<path d="M4 12.5 20 4l-6.5 16-2.5-6.5z"/>',
    camadas: '<path d="M12 3l9 5-9 5-9-5zM3 12.2l9 5 9-5M3 16.2l9 5 9-5"/>',
    mais: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
    hachura: '<path d="M5 19L19 5M9 21L21 9M3 13L13 3"/>',
    troca: '<path d="M4 9h14l-3-3M20 15H6l3 3"/>',
    janela: '<rect x="3" y="9" width="12" height="9" rx="1"/><path d="M8 9V6h13v9h-3"/>',
    busca: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    x: '<path d="M5 5l14 14M19 5L5 19"/>',
    voltar: '<path d="M15 4l-8 8 8 8"/>',
    seta_d: '<path d="M9 4l8 8-8 8"/>',
    seta_e: '<path d="M15 4l-8 8 8 8"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',
    baixar: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    subir: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    sat: '<path d="M7 13l4 4M4 10l10 10"/><rect x="9" y="3" width="6" height="6" rx="1" transform="rotate(45 12 6)"/><path d="M3 18a6 6 0 0 0 3 3"/>',
    antena: '<path d="M12 10v3M9 21l3-11 3 11M10 17h4M7.5 7.5a6 6 0 0 0 0 5M16.5 7.5a6 6 0 0 1 0 5M5 5a10 10 0 0 0 0 10M19 5a10 10 0 0 1 0 10"/>',
    cr: '<rect x="3" y="11" width="18" height="9" rx="3"/><path d="M8 11V5M16 11V5"/><circle cx="8.5" cy="15.5" r="1.4" class="cheio"/><circle cx="15.5" cy="15.5" r="1.4" class="cheio"/>',
    bateria: '<path d="M4 5h10v16H4zM14 8h2M7 5V3h4v2M12 10l-4 7h3l-1 4"/>',
    radar: '<circle cx="5" cy="12" r="1.8" class="cheio"/><path d="M9 8a5 5 0 0 1 0 8M12.5 5a9 9 0 0 1 0 14M16 2a13 13 0 0 1 0 20"/>',
    pulv: '<path d="M8 3h8v4H8zM12 7v6M6 13l6 0 6 0M8 16l-2 5M12 16v5M16 16l2 5"/>',
    aviso: '<path d="M12 3L22 20H2z"/><path d="M12 9.5v5M12 17v.1"/>',
    sd: '<path d="M7 3h8l3 3v15H7z"/><path d="M10 7v3M12.5 7v3M15 7v3"/>',
    girar: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>',
  };
  function ic(n, cls, st) { return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24"' + (st ? ' style="' + st + '"' : '') + '>' + (IC[n] || '') + '</svg>'; }

  /* ---------------------------------------------------------------- dados */
  function tarefas() { return (window.M && M.tarefas) || []; }
  function tarefaPorId(id) { return tarefas().filter(function (t) { return t.id === id; })[0] || null; }
  function pxm(x, z) { return paraPx(x, z); }
  function dataHora(ms) {
    var d = new Date(ms), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  function emSolo(E) { var v = E && E.v; return !v || ['em solo', 'concluído'].indexOf(v.estado) >= 0; }
  function pontos() { return (S.ed && S.ed.limite) || []; }

  /* ------------------------------------------------------------ mapa/vista */
  function fotoAttrs() {
    var f = document.getElementById('foto-mapa');
    if (!f) return null;
    return { href: f.getAttribute('href'), x: f.getAttribute('x'), y: f.getAttribute('y'), w: f.getAttribute('width'), h: f.getAttribute('height') };
  }
  function centrar(x, z) {
    var p = pxm(x, z);
    S.V.x = 640 - p[0] * S.V.k; S.V.y = 360 - p[1] * S.V.k;
  }
  function centrarAero() {
    var E = E_();
    if (E && E.d) centrar(E.d.x, E.d.z); else if (E && E.b) centrar(E.b.x, E.b.z); else if (E && E.o) centrar(E.o.x, E.o.z); else centrar(0, -90);
  }
  function aTela(mx, mz) { var p = pxm(mx, mz); return [p[0] * S.V.k + S.V.x, p[1] * S.V.k + S.V.y]; }
  function aMundo(sx, sy) { return paraM((sx - S.V.x) / S.V.k, (sy - S.V.y) / S.V.k); }

  /* ------------------------------------------------------------ comandos */
  function pEnviar() { try { salvarP(); enviarP(); } catch (e) { /* app escondido ainda montando */ } }
  function toast(t) {
    S.toast = t; clearTimeout(S._tt);
    var e = qs('.toast');
    if (!e) { e = document.createElement('div'); e.className = 'toast'; stage.appendChild(e); }
    e.textContent = t;
    S._tt = setTimeout(function () { S.toast = null; var x = qs('.toast'); if (x) x.remove(); }, 2600);
  }
  function aviso(t) { if (window.avisoInfo) avisoInfo(t); else toast(t); }

  /* ================================================================ INICIO */
  function arteInicio() {
    return '<svg class="arte" viewBox="0 0 1280 560" preserveAspectRatio="xMidYMid slice">' +
      '<defs><linearGradient id="t10-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb2d4"/><stop offset=".62" stop-color="#d4e3ee"/><stop offset="1" stop-color="#e9eff0"/></linearGradient>' +
      '<linearGradient id="t10-capim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8a3a"/><stop offset="1" stop-color="#2e4a18"/></linearGradient></defs>' +
      '<rect width="1280" height="560" fill="url(#t10-ceu)"/>' +
      '<path d="M0 455 L170 420 L330 438 L520 398 L690 440 L860 430 L1040 452 L1280 430 L1280 560 L0 560Z" fill="#7790ad" opacity=".75"/>' +
      '<path d="M0 480 L260 470 L520 486 L800 466 L1280 482 L1280 560 L0 560Z" fill="url(#t10-capim)"/>' +
      '<g stroke="#a8c364" stroke-width="2" opacity=".5">' + (function () { var s = ''; for (var i = 0; i < 90; i++) { var x = i * 14.3, h = 14 + (i * 37 % 23); s += '<path d="M' + x.toFixed(1) + ' 548 q2 -' + h + ' 6 -' + (h + 6) + '"/>'; } return s; })() + '</g>' +
      /* o drone, de frente e de lado, com quatro hélices */
      '<g transform="translate(790 230)">' +
      '<g stroke="#4a5058" stroke-width="9" stroke-linecap="round"><path d="M-300 -52 L-72 10 M300 -52 L72 10 M-190 56 L-60 22 M190 56 L60 22"/></g>' +
      '<g fill="#2c3036"><rect x="-322" y="-68" width="46" height="22" rx="5"/><rect x="276" y="-68" width="46" height="22" rx="5"/><rect x="-212" y="44" width="46" height="22" rx="5"/><rect x="166" y="44" width="46" height="22" rx="5"/></g>' +
      '<g fill="#3a4046" opacity=".55"><ellipse cx="-300" cy="-80" rx="108" ry="9"/><ellipse cx="300" cy="-80" rx="108" ry="9"/><ellipse cx="-190" cy="36" rx="92" ry="8"/><ellipse cx="190" cy="36" rx="92" ry="8"/></g>' +
      '<g stroke="#2c3036" stroke-width="7" fill="none" stroke-linecap="round"><path d="M-48 70 L-62 170 L-124 176 M48 70 L62 170 L124 176"/></g>' +
      '<rect x="-64" y="-22" width="128" height="82" rx="22" fill="#d7dbde"/><rect x="-44" y="42" width="88" height="46" rx="12" fill="#e6e9eb"/>' +
      '<rect x="-30" y="-10" width="60" height="26" rx="10" fill="#f0a31c"/><circle cx="0" cy="-1" r="6" fill="#33383e"/>' +
      '</g></svg>';
  }
  function telaInicio() {
    var c = conectado();
    var h = '<div class="ini">' + arteInicio() +
      '<div class="icones">' + ['doc', 'user', 'drone', 'ajuda', 'avisos', 'engr'].map(function (n, i) {
        return '<button data-ac="home:' + n + '" style="left:' + (26 + i * 116.6).toFixed(0) + 'px">' + ic(n) + '</button>';
      }).join('') + '</div>' +
      '<button class="cubo" data-ac="home:cubo">' + ic('cubo') + '</button>' +
      '<div class="rodape"></div>' +
      '<div class="estado' + (c ? ' on' : '') + '"><i></i>' + (c ? 'Conectado&nbsp;T10&nbsp;Aeronave agrícola' : 'Compatível com aeronave da série T') + '</div>' +
      '<div class="acoes"><button data-ac="planejar">Planejar campo</button><b></b><button data-ac="executar">Executar tarefa</button></div>' +
      '</div>';
    return h;
  }

  /* seletor do metodo de planejamento */
  function telaMetodo() {
    var E = E_(), c = conectado(), rtk = !!(E && E.rtk);
    function cartao(id, rot, ok, ico, estado) {
      return '<button class="cartao' + (ok ? ' ok' : '') + '" data-ac="metodo:' + id + '">' + ico + '<b>' + rot + '</b><small>' + estado + '</small>' + (ok ? '' : '<span class="q">?</span>') + '</button>';
    }
    return '<div class="metodo"><h2>Selecione o método de planejamento de campo</h2><button class="x" data-ac="metodo:x">' + ic('x') + '</button>' +
      '<div class="cartoes">' +
      cartao('cr', 'Caminhar com CR', !c, ic('cr'), c ? 'N/A' : 'Disponível') +
      cartao('rtk', 'Caminhar com RTK', rtk, '<span class="rtk">RTK</span>', rtk ? 'Disponível' : 'Desconectado') +
      cartao('aero', 'Voar a aeronave', c, ic('seta'), c ? 'Disponível' : 'Desconectado') +
      '</div>' + (c ? '' : '<div class="aviso-desc">Aeronave desconectada</div>') + '</div>';
  }

  /* ====================================================== barra e telemetria */
  /* Textos da barra conferidos no voo real do T10 (gravacao de 21/10/2026): em rota a barra
     fica "Rota (GNSS)" o tempo todo (as pausas e retomadas sao avisos verdes a parte); no RTH e
     no pouso automaticos aparece "RTH automatico em andamento:33.8m" e "Aterrissagem automatica:3.5m". */
  var TXT_ESTADO = {
    'subindo': 'Rota Manual', 'indo': 'Rota', 'descendo': 'Rota', 'aplicando': 'Rota',
    'pairando': 'Rota', 'voltando': 'RTH automático em andamento', 'pousando': 'Aterrissagem automática', 'reabastecendo': 'Reabastecimento',
    'concluído': 'Operação concluída', 'caiu': 'Aeronave perdida', 'manual': 'Rota Manual'
  };
  function altOsd() {
    var f = (window.faseVoo && conectado()) ? faseVoo() : null, a = 0;
    if (f) a = f.alt ? (f.alto ? f.rel : f.altR) : f.rel;
    return Math.round((Number(a) || 0) * 10) / 10;
  }
  function textoBarra() {
    var E = E_(), v = E && E.v;
    if (S.sub === 'plan' || S.sub === 'edit') {
      if (S.via === 'aero' && conectado()) return { t: 'Precisão GNSS da aeronave ' + fmt(lv('prec', 1.0), 1) + ' m', c: 'verde' };
      return { t: 'Precisão GNSS do CR ' + fmt(lv('prec', 1.1), 1).replace('.', ',') + ' m', c: 'verde' };
    }
    if (!conectado() || !v) return { t: 'Aeronave desconectada', c: '' };
    var t = TXT_ESTADO[v.estado], cl = 'verde';
    var bloq = E.protecao && E.protecao.bloqueioDecolagem;
    if (bloq) { return { t: 'Incapaz de decolar-Pessoas ou obstáculos detectados', c: 'verm' }; }
    var pos = E.rtk ? 'RTK' : 'GNSS';
    if (!t) {
      /* no chao, no modo M a barra ja diz "Rota Manual (GNSS)" (video do voo real) */
      if (S.modo === 'M') return { t: 'Rota Manual (' + pos + ')', c: 'verde' };
      return { t: 'Pronto para decolar (' + pos + ')', c: 'verde' };
    }
    if (v.estado === 'caiu') cl = 'verm'; else if (v.estado === 'reabastecendo') cl = 'amar';
    if (v.estado === 'manual' && v.temRota) t = 'Tarefa pausada. Modo manual';
    else if (v.estado === 'manual' && S.modo !== 'M') t = 'Manual';
    else if (t === 'Rota' || t === 'Rota Manual') t += ' (' + pos + ')';
    else if (v.estado === 'voltando') { if (E.d && E.b) t += ':' + fmt(Math.hypot(E.d.x - E.b.x, E.d.z - E.b.z), 1) + 'm'; }
    else if (v.estado === 'pousando') t += ':' + fmt(altOsd(), 1) + 'm';
    return { t: t, c: cl };
  }
  function barraHtml() {
    var E = E_(), c = conectado(), v = E && E.v, b = c && v ? Math.round(v.bateria || 0) : 0;
    var plan = S.sub === 'plan' || S.sub === 'edit';
    var tb = textoBarra();
    var rtk = !!(E && E.rtk), sats = c ? (rtk ? 24 : 13) : 9;
    var bars = function (n, tot) { var h = ''; for (var i = 0; i < tot; i++) h += '<u style="height:' + (7 + i * 4) + 'px;opacity:' + (i < n ? 1 : .32) + '"></u>'; return '<span class="bars">' + h + '</span>'; };
    var crb = lv('crBat', null);
    /* rodando uma tarefa de rota o botao de modo vira o icone listrado (voo real); no voo manual e o "M" */
    var icRota = '<svg class="ic" viewBox="0 0 40 40" style="width:40px;height:40px;font-size:40px"><path d="M4 18L18 4M4 32L32 4M10 38L38 10M24 38L38 24" stroke-width="4" stroke-linecap="round" fill="none"/></svg>';
    var h = plan ? '' : '<span class="modo">' + (S.sub === 'exec' ? icRota : S.modo === 'M+' ? 'M<sup>+</sup>' : S.modo === 'AB' ? 'AB' : 'M') + '</span><i class="div1"></i>';
    h += '<div class="txt ' + tb.c + '"><span class="mq">' + esc(tb.t) + '</span></div>';
    if (c && !plan) {
      /* anel verde + precisao do posicionamento (5.0 m sem RTK fixo; 0.1 m com) */
      h += '<button class="stt" data-ac="cfg:rtk" style="left:822px"><svg class="ic" viewBox="0 0 24 24" style="font-size:25px;color:#6cc22a"><circle cx="12" cy="12" r="8.5" fill="none" stroke-width="2.6"/><circle cx="12" cy="12" r="3.4" class="cheio"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke-width="2.2"/></svg><em>' + (rtk ? '0.1m' : '5.0m') + '</em></button>';
    }
    if (plan) {
      h += '<span class="stt" style="left:950px"><em style="font-size:11px;color:#fff;margin:0 0 14px 0">RC</em>' + ic('sat', '', 'font-size:29px') + '<sub>' + sats + '</sub>' + bars(3, 5) + '</span>' +
        '<span class="stt" style="left:1030px">' + ic('cr', '', 'font-size:29px') + bars(2, 5) + '</span>';
      var bp = lv('bateriaCR', 30);
      h += '<span class="bat verde" style="left:1104px">' + ic('bateria', '', 'font-size:34px') + bp + '<i>%</i></span><i class="div2"></i><button class="eng" data-ac="cfg:aeronave">' + ic('engr') + '</button>';
      return h;
    }
    h += '<span class="stt" style="left:898px">' + ic('sat', '', 'font-size:29px') + (c ? '<sub>' + sats + '</sub>' : '<sub style="opacity:0">0</sub>') + bars(c ? 4 : 1, 5) + '</span>' +
      '<span class="stt" style="left:978px">' + ic('antena', '', 'font-size:29px') + '<svg class="ic" viewBox="0 0 24 24" style="position:absolute;left:21px;top:30px;width:13px;height:13px;color:#e0262f"><path d="M5 5l14 14M19 5L5 19" stroke-width="3.4"/></svg></span>' +
      '<span class="stt" style="left:1034px">' + ic('cr', '', 'font-size:29px') + bars(c ? 5 : 2, 5) + '</span>' +
      '<span class="bat ' + (c ? (b <= 15 ? 'verm' : b <= 30 ? 'amar' : 'verde') : 'verde') + '">' + ic('bateria', '', 'font-size:34px') + b + '<i>%</i></span><i class="div2"></i>' +
      '<button class="eng" data-ac="cfg:aeronave">' + ic('engr') + '</button>';
    return h;
  }
  function osdHtml() {
    var E = E_(), c = conectado(), v = E && E.v, d = E && E.d, bs = E && E.b;
    var f = (window.faseVoo && c) ? faseVoo() : null;
    var alt = 0, tit = 'Altitude(m)';
    if (c && f) alt = f.alt ? (f.alto ? f.rel : f.altR) : f.rel;
    var dist = c && d && bs ? Math.hypot(d.x - bs.x, d.z - bs.z) : 0;
    var vel = c && v ? (v.velocidade || 0) * 3.6 : 0;
    var area = c && E && E.cob ? (E.cob.haCobertos || (v && v.aplicadoHa) || 0) : 0;
    var flu = c && v ? (v.vazao || 0) : 0;
    if (S.ar) flu = S.ar.fluxo;             /* liberando o ar das mangueiras: as bombas giram */
    /* seta ao lado da velocidade: verde acelerando, vermelha freando (voo real); some em ~1,5 s */
    var tn = Date.now();
    if (S._vAnt == null) { S._vAnt = vel; S._vT = tn; }
    else if (tn - S._vT > 450) { var dv = vel - S._vAnt; if (Math.abs(dv) > .5) { S._seta = dv > 0 ? 1 : -1; S._setaT = tn; } S._vAnt = vel; S._vT = tn; }
    var seta = S._seta && tn - (S._setaT || 0) < 1500 ? '<span class="seta ' + (S._seta > 0 ? 'sobe' : 'desce') + '"></span>' : '';
    var a = Math.round((Number(alt) || 0) * 10) / 10; if (!a) a = 0;
    /* icone do radar de altura (voo real): tres ondas empilhadas, verdes no ar e vermelhas no chao */
    var rampa = '<svg class="ic osd-ramp" viewBox="0 0 24 24" style="color:' + (a > 0.2 ? '#7ed321' : '#e0262f') + '"><path d="M6 8c3.5-2 8.5-2 12 0M4 12.5c4.5-3 11.5-3 16 0M6.5 17c3-1.8 8-1.8 11 0" fill="none" stroke-width="2.3" stroke-linecap="round"/></svg>';
    var arEd = (S.sub === 'plan' || S.sub === 'edit') && S.ed ? areaHa(S.ed.limite || []) : 0;
    return rampa + '<div class="r" style="left:1px;top:0">Altitude(m)</div><div class="g sub" style="left:1px;top:28px">' + fmt(a, 1) + '</div>' +
      '<div class="r" style="left:118px;top:0">Fluxo(L/Min)</div><div class="g" style="left:118px;top:28px">' + fmt(flu, 1) + '</div>' +
      '<div class="r" style="left:1px;top:97px">Distância(m)</div><div class="p" style="left:1px;top:122px">' + fmt(dist, 1) + '</div>' +
      '<div class="r" style="left:118px;top:97px">Velocidade(km/h)</div><div class="p" style="left:118px;top:122px">' + seta + fmt(vel, 1) + '</div>' +
      '<div class="r" style="left:268px;top:97px">' + (S.sub === 'plan' || S.sub === 'edit' ? 'Área de campo(H' : 'Área concluída(Ha)') + '</div><div class="p" style="left:268px;top:122px">' + fmt(S.sub === 'plan' || S.sub === 'edit' ? arEd : area, 1) + '</div>';
  }

  /* obstaculo acima da aeronave: arco vermelho no alto da tela com a distancia (voo real: "3.4m") */
  function supHtml() {
    var E = E_(), s = E && E.protecao && E.protecao.superior;
    if (!conectado() || !s || S.sub === 'lista' || S.sub === 'plan' || S.sub === 'edit') return '';
    return '<svg class="sup" viewBox="0 0 420 70" width="420" height="70"><path d="M0 0H420C396 46 304 66 210 66S24 46 0 0Z" fill="rgba(222,18,26,.9)"/><text x="210" y="52" text-anchor="middle" font-size="19" fill="#fff" font-weight="500">' + fmt(Math.max(0, s.distancia || 0), 1) + 'm</text></svg>';
  }

  /* ---------------------------------------------------------- radar (HSI) */
  function hsiSvg() {
    var E = E_(), c = conectado(), f = (window.faseVoo && c) ? faseVoo() : { chao: true, mot: false, armou: false, saiu: false, alt: false };
    var multi = E && E.p && typeof E.p.desvio === 'boolean' ? E.p.desvio : (window.M ? M.P.desvio : true);
    var yaw = c && E && E.d && typeof E.d.rumo === 'number' ? E.d.rumo : Math.PI / 2;
    var fx = Math.cos(yaw), fz = -Math.sin(yaw), rx = Math.sin(yaw), rz = Math.cos(yaw);
    var rel = function (dx, dz) { return [dx * rx + dz * rz, dx * fx + dz * fz]; };
    var C = 125, RO = 107, PASSO = Math.PI / 36;
    var pt = function (a, r) { return [C + Math.sin(a) * r, C - Math.cos(a) * r]; };
    var xy = function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); };
    var alerta = lv('alerta', 10), esc_ = RO / 16;
    var rd = null;
    if (c && E && E.v && !f.chao && multi !== false) {
      if (E.sens) rd = E.rd || null;
      else if (E.radar && E.radar.length) {
        rd = []; for (var i = 0; i < 72; i++) rd.push(0);
        E.radar.forEach(function (s) { for (var k = s[0] * 6 - 3; k <= s[0] * 6 + 2; k++) rd[(k + 72) % 72] = s[1]; });
      }
    }
    var g = window.gruposRadar ? gruposRadar(rd) : [];
    var h = '<circle cx="' + C + '" cy="' + C + '" r="' + (RO + 18) + '" fill="#08090b"/>' +
      '<circle cx="' + C + '" cy="' + C + '" r="' + RO + '" fill="rgba(34,38,44,.62)"/>';
    /* cone da frente (o radar da frente) */
    var a0 = -Math.PI / 4, a1 = Math.PI / 4;
    h += '<path d="M' + C + ' ' + C + 'L' + xy(pt(a0, RO)) + 'A' + RO + ' ' + RO + ' 0 0 1 ' + xy(pt(a1, RO)) + 'Z" fill="rgba(255,255,255,.2)"/>';
    /* aneis e cruz (a cruz gira com o norte) */
    var nq = rel(0, -1), na = Math.atan2(nq[0], nq[1]);
    h += '<circle cx="' + C + '" cy="' + C + '" r="' + (RO * .62).toFixed(1) + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="1.6 4.4" stroke-linecap="round"/>' +
      '<circle cx="' + C + '" cy="' + C + '" r="' + (RO * .34).toFixed(1) + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="1.6 4.4" stroke-linecap="round"/>' +
      '<g transform="rotate(' + (na * 180 / Math.PI).toFixed(1) + ' ' + C + ' ' + C + ')" stroke="rgba(255,255,255,.4)" stroke-width="1"><path d="M' + (C - RO) + ' ' + C + 'H' + (C + RO) + 'M' + C + ' ' + (C - RO) + 'V' + (C + RO) + '"/></g>';
    /* setores com eco */
    g.forEach(function (s) {
      var n = s.ks.length, b0 = s.ks[0] * PASSO - PASSO / 2, b1 = b0 + n * PASSO, d, j;
      var ri = function (k) { return Math.min(RO, esc_ * rd[k]); };
      if (s.cheio) {
        d = 'M' + xy(pt(0, RO)) + 'A' + RO + ' ' + RO + ' 0 1 1 ' + xy(pt(Math.PI, RO)) + 'A' + RO + ' ' + RO + ' 0 1 1 ' + xy(pt(0, RO)) + 'Z';
        for (j = 0; j < n; j++) d += (j ? 'L' : 'M') + xy(pt(b0 + (j + .5) * PASSO, ri(s.ks[j])));
        d += 'Z';
      } else {
        d = 'M' + xy(pt(b0, RO)) + 'A' + RO + ' ' + RO + ' 0 ' + (b1 - b0 > Math.PI ? 1 : 0) + ' 1 ' + xy(pt(b1, RO)) + 'L' + xy(pt(b1, ri(s.ks[n - 1])));
        for (j = n - 1; j >= 0; j--) d += 'L' + xy(pt(b0 + (j + .5) * PASSO, ri(s.ks[j])));
        d += 'L' + xy(pt(b0, ri(s.ks[0]))) + 'Z';
      }
      h += '<path d="' + d + '" fill-rule="evenodd" fill="' + (s.min <= 6 ? 'rgba(220,28,36,.86)' : 'rgba(255,214,0,.7)') + '"/>';
    });
    if (lv('distObs', true) !== false) {
      var postos = [];
      g.slice().sort(function (a, b) { return a.min - b.min; }).forEach(function (s) {
        if (postos.length >= 6) return;
        var ang = (s.ks[0] + (s.ks.length - 1) / 2) * PASSO, q = pt(ang, RO * .86);
        if (postos.some(function (o) { return Math.hypot(o[0] - q[0], o[1] - q[1]) < 26; })) return;
        postos.push(q);
        var rot = ang * 180 / Math.PI + 90; if (rot > 90 && rot < 270) rot += 180;
        h += '<text transform="translate(' + xy(q) + ') rotate(' + rot.toFixed(0) + ')" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="500" fill="#fff">' + s.min.toFixed(1) + '</text>';
      });
    }
    /* o H: o rumo da base em relacao ao nariz */
    if (c && E && E.d && E.b) {
      var qb = rel(E.b.x - E.d.x, E.b.z - E.d.z), db = Math.hypot(qb[0], qb[1]), rb = Math.min(esc_ * db, RO - 2);
      var hx = db > 0 ? C + qb[0] / db * rb : C, hy = db > 0 ? C - qb[1] / db * rb : C;
      h += '<g transform="translate(' + hx.toFixed(1) + ' ' + hy.toFixed(1) + ')"><circle r="11" fill="none" stroke="#f0b51c" stroke-width="2.6"/><text text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#f0b51c">H</text></g>';
    }
    /* vetor de velocidade */
    if (c && E && E.sens) {
      var w = rel(E.sens.vx || 0, E.sens.vz || 0), vh = Math.hypot(w[0], w[1]);
      if (vh >= .8) { var Lv = Math.min(vh * 3.6 * 3.4, RO - 6); h += '<path d="M' + C + ' ' + C + 'L' + (C + w[0] / vh * Lv).toFixed(1) + ' ' + (C - w[1] / vh * Lv).toFixed(1) + '" stroke="#d4333a" stroke-width="3" stroke-linecap="round"/>'; }
    }
    h += '<path d="M' + C + ' ' + (C - 14) + 'L' + (C + 10) + ' ' + (C + 11) + 'L' + C + ' ' + (C + 6) + 'L' + (C - 10) + ' ' + (C + 11) + 'Z" fill="#e02c30"/>';
    /* anel preto com as letras e a placa do N */
    var letras = [['N', 0], ['E', 90], ['S', 180], ['W', 270]];
    letras.forEach(function (l) {
      var ang = na + l[1] * Math.PI / 180, q = pt(ang, RO + 9);
      if (l[0] === 'N') {
        h += '<g transform="translate(' + xy(pt(ang, RO + 9)) + ') rotate(' + (ang * 180 / Math.PI).toFixed(1) + ')"><path d="M-19 -9 A24 24 0 0 1 19 -9 L19 7 A26 26 0 0 0 -19 7Z" fill="#fff" transform="translate(0 4)"/><text y="0" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="600" fill="#111">N</text></g>';
      } else {
        var rt = ang * 180 / Math.PI; if (rt > 90 && rt < 270) rt += 180;
        h += '<text transform="translate(' + xy(q) + ') rotate(' + rt.toFixed(1) + ')" text-anchor="middle" dominant-baseline="central" font-size="15" font-weight="500" fill="#fff">' + l[0] + '</text>';
      }
    });
    return '<svg viewBox="0 0 250 250" width="250" height="250" style="transform:scale(' + ({ Grande: 1, Médio: .84, Pequeno: .68 }[lv('tamHsi', 'Grande')] || 1) + ');transform-origin:50% 100%">' + h + '</svg>';
  }

  /* ------------------------------------- avisos e eventos do voo real (21/10/2026)
     Gravacao de um voo de verdade do T10: os avisos verdes (Decolar, Pausado, Retomar a tarefa,
     Aeronave no ponto de partida..., Voo estacionario, Tarefa concluida), o alerta vermelho
     "Altitude baixa", a carta de confirmacao ao fim da rota e a janela "Liberando ar preso". */
  function nota(txt, tipo, ms) {
    var agora = Date.now();
    S.notas = (S.notas || []).filter(function (n) { return n.ate > agora; });
    S.notas.push({ id: 'n' + agora + Math.random().toString(36).slice(2, 6), tipo: tipo || 'verde', txt: txt, ate: agora + (ms || 6000) });
  }
  function eventosVoo() {
    var E = E_(), v = E && E.v, ev = S._ev || (S._ev = { est: null, rod: null, aplicou: false, conc: false, t0: 0, tan0: 0, alt2: false });
    if (!conectado() || !v) { ev.est = null; ev.rod = null; S.altBaixa = false; return; }
    var est = v.estado, rod = !!v.rodando, voo = window.M && M.voo;
    var chao = est === 'em solo' || est === 'concluído';
    var antesChao = ev.est === 'em solo' || ev.est === 'concluído';
    if (ev.est !== null && ev.est !== est) {
      if (antesChao && !chao && est !== 'caiu') {                       /* decolou */
        nota('Decolar'); ev.aplicou = false; ev.conc = false; ev.alt2 = false; ev.t0 = Date.now(); ev.tan0 = v.tanque || 0;
      } else if (est === 'aplicando' && !ev.aplicou && S.sub === 'exec') {
        ev.aplicou = true; nota('Aeronave no ponto de partida. Tarefa sendo iniciada.');
      }
    }
    /* pausa: no jogo o drone fica "manual" com a rota guardada (temRota) ou "pairando" sem rodar */
    if (!chao && S.sub === 'exec' && ev.aplicou) {
      var pausaAgora = (est === 'pairando' && !rod) || (est === 'manual' && !!v.temRota);
      if (pausaAgora && !ev.pausa) nota('Pausado');
      else if (!pausaAgora && ev.pausa && (est === 'subindo' || est === 'indo' || est === 'aplicando')) nota('Retomar a tarefa');
      ev.pausa = pausaAgora;
    } else if (chao) ev.pausa = false;
    /* altitude baixa: so depois de ter passado de 2 m neste voo (na decolagem nao avisa) */
    var alt = altOsd();
    if (chao) ev.alt2 = false; else if (alt >= 2) ev.alt2 = true;
    S.altBaixa = !chao && ev.alt2 && est === 'manual' && alt > 0.2 && alt < 1.6;
    /* rota feita ate o fim: carta de confirmacao da tarefa */
    var R = E.rota, feito = !!(voo && R && R.r && R.r.length > 1 && R.feitos >= R.r.length);
    /* no codigo no ar o `concluiu` do motor nem sempre vira true (so com `trabalhou`): vale tambem a rota feita ate o fim
       depois de ter pulverizado, com o drone voltando, pousando ou ja no chao */
    var fimDaRota = feito && ev.aplicou && (est === 'voltando' || est === 'pousando' || est === 'concluído');
    if ((fimDaRota || (voo && voo.concluiu && feito)) && !ev.conc) { ev.conc = true; cartaFinal(v, ev); }
    ev.est = est; ev.rod = rod;
  }
  function cartaFinal(v, ev) {
    var t = (window.M && M.exec) || {}, tar = 0, campo = 0, obs = 0;
    try {
      campo = areaHa(t.limite || []); tar = areaDaTarefaHa(t);
      obs = (obsDaTarefa(t) || []).reduce(function (s, o) { return s + (o.tipo === 'circulo' ? Math.PI * o.r * o.r / 10000 : areaHa(o.pts)); }, 0);
    } catch (e) { /* sem os dados da tarefa: fica com zeros */ }
    var usado = Math.max(0, (ev.tan0 || 0) - (v.tanque || 0));
    nota('Voo estacionário'); nota('Tarefa concluída');
    S.carta = { tar: tar, rest: 0, campo: campo, marg: Math.max(0, campo - tar - obs), obs: obs,
      tempo: ev.t0 ? Math.max(0, Math.round((Date.now() - ev.t0) / 1000)) : 0, qt: usado, lha: tar > 0 ? usado / tar : 0, taxa: 100 };
  }
  function cartaHtml() {
    var c = S.carta; if (!c) return '';
    function r(rot, val, un, y) { return '<span class="rt" style="top:' + (y - 12) + 'px">' + rot + '</span><b class="vl" style="top:' + (y - 22) + 'px">' + val + '<i>' + un + '</i></b>'; }
    var m = Math.floor(c.tempo / 60), s = c.tempo % 60;
    return '<div class="carta"><h3>Carta de confirmação da tarefa</h3>' +
      '<span class="g1" style="left:54px">Área da tarefa</span><b class="gv" style="left:54px">' + fmt(c.tar, 2) + '<i>Ha</i></b>' +
      '<span class="g1" style="left:295px">Área restante</span><b class="gv lar" style="left:295px">' + fmt(c.rest, 2) + '<i>Ha</i></b>' +
      r('Área de campo', fmt(c.campo, 2), 'Ha', 236) + r('Área da margem de segurança', fmt(c.marg, 2), 'Ha', 286) + r('Área de obstáculo', fmt(c.obs, 2), 'Ha', 336) +
      r('Tempo de voo', m + ':' + (s < 10 ? '0' : '') + s, '', 386) + r('Quantidade total utilizada', fmt(c.qt, 1).replace('.', ','), 'l', 436) +
      r('Volume de pulverização por área', fmt(c.lha, 2), 'L/Ha', 486) +
      '<div class="tx-c">Taxa de conclusão</div><b class="tx-v">' + Math.round(c.taxa) + '<i>%</i></b><span class="modo-r">Modo de rota</span></div>';
  }
  /* "Liberar ar preso nas mangueiras": janela branca com as duas bombas (1 e 2 liberando, depois
     "Bem-sucedido"); durante o processo os avisos vermelhos "Ar na bomba N..." e o fluxo sobe */
  function arIniciar() {
    var E = E_(), v = E && E.v;
    if (!conectado() || !v) return toast('Aeronave desconectada');
    if ((v.tanque || 0) <= 0.05) return toast('Sem líquido no tanque');
    if (S.ar) return;
    S.pagCfg = null; S.avancado = false;
    S.ar = { t0: Date.now(), b1: 'lib', b2: 'lib', fluxo: 0.6 };
    S._arT = setInterval(arTick, 250);
    arTick();
  }
  function arTick() {
    var a = S.ar; if (!a) return;
    var s = (Date.now() - a.t0) / 1000;
    if (s >= 7) a.b1 = 'ok';
    if (s >= 10) a.b2 = 'ok';
    a.fluxo = a.b2 === 'ok' ? 1.52 : 0.6 + 0.92 * Math.min(1, s / 10);
    if (s >= 11.5) { nota('Ar preso liberado'); arFim(); return; }
    S.dlg = arDlg; render2();
  }
  function arFim() {
    clearInterval(S._arT); S._arT = null; S.ar = null; S.dlg = null; S.dlgBt = null; render2();
  }
  function arDlg() {
    var a = S.ar || {};
    function par(n, st) {
      var ok = st === 'ok';
      return '<div class="par' + (ok ? ' ok' : '') + '"><div class="bx"><b>' + n + '</b><small>Bomba</small>' + (ok ? '<span class="ck">✓</span>' : '<span class="bi">' + ic('pulv') + '</span>') + '</div><span class="st">' + (ok ? 'Bem-sucedido' : 'Liberando ar preso…') + '</span></div>';
    }
    return '<div class="vidro"><div class="dlg ar"><div class="tt">Liberando ar preso das mangueiras…</div><div class="pares">' + par(1, a.b1) + par(2, a.b2) + '</div><div class="bts"><button data-ac="arCancelar">Cancelar</button></div></div></div>';
  }

  /* --------------------------------------------------------------- alertas */
  function listaAlertas() {
    var l = [];
    if (window.alertasAtuais && conectado()) {
      alertasAtuais().forEach(function (a) {
        if (a.id === 'demarcacao') return;
        var txt = a.txt, tp = a.tipo === 'vermelho' ? 'vermelho' : a.tipo === 'amarelo' ? 'amar' : 'info';
        if (a.id === 'pedestres') txt = 'Pessoas ou obstáculos detectados';
        /* textos e cores conferidos no voo real do T10 (21/10/2026) */
        if (a.id === 'superior-radar') { txt = 'Obstáculo acima da aeronave. Voe com cuidado'; tp = 'vermelho'; }
        if (a.id === 'carga') tp = 'vermelho';
        l.push({ id: a.id, tipo: tp, txt: txt, x: a.id === 'pedestres' ? 0 : 1 });
      });
    }
    if (window.avisosInfo) {
      avisosInfo.forEach(function (a) { if (/^Tarefa pausada$/i.test(a.txt)) return; l.push({ id: a.id, tipo: /ativad|sucesso|adicionado|definido|otimizad|registrado|abilitar pulveriza|iniciar tarefa|liberado/i.test(a.txt) ? 'verde' : 'amar', txt: a.txt, x: 1 }); });
    }
    if (conectado()) {
      if (S.altBaixa) l.push({ id: 'alt-baixa', tipo: 'vermelho', txt: 'Altitude baixa. Voe com cuidado', x: 1 });
      if (S.ar) {
        if (S.ar.b1 !== 'ok') l.push({ id: 'ar-b1', tipo: 'vermelho', txt: 'Ar na bomba 1 ou válvula de escape manual não apertada', x: 1 });
        if (S.ar.b2 !== 'ok') l.push({ id: 'ar-b2', tipo: 'vermelho', txt: 'Ar na bomba 2 ou válvula de escape manual não apertada', x: 1 });
      }
    }
    var agora = Date.now();
    S.notas = (S.notas || []).filter(function (n) { return n.ate > agora; });
    S.notas.forEach(function (n) { l.push({ id: n.id, tipo: n.tipo, txt: n.txt, x: n.tipo === 'verde' ? 0 : 1 }); });
    var fech = (window.M && M.alertasFechados) || {};
    return l.filter(function (a) { return !fech[a.id]; });
  }
  function avisoPlanoHtml() {
    /* planejando: so o ultimo aviso verde, numa barra translucida (nada de lista vermelha) */
    if (S.sub !== 'plan' && S.sub !== 'edit') return '';
    var g = listaAlertas().filter(function (a) { return a.tipo === 'verde'; });
    var u = g[g.length - 1];
    return u ? '<div class="barra-aviso' + (S.sub === 'edit' && S.painelEd ? ' com-painel' : '') + '"><i class="pt"></i>' + esc(u.txt) + '</div>' : '';
  }
  function alertasHtml() {
    var l = listaAlertas();
    if (!l.length) return '';
    return l.slice(0, 6).map(function (a) {
      var cls = a.tipo === 'verde' ? 'verde' : a.tipo === 'amar' ? 'amar' : '';
      return '<div class="a ' + cls + (a.x ? '' : ' sem-x') + '" data-aid="' + esc(a.id) + '">' +
        (a.tipo === 'verde' ? '<i class="pt"></i>' : ic('aviso', 'cheio', 'color:#ff6b5e')) +
        esc(a.txt) + (a.x ? '<span class="x" data-ac="alerta-x:' + esc(a.id) + '">×</span>' : '') + '</div>';
    }).join('');
  }

  /* =============================================================== MAPA */
  var FUNDO = null;
  function mapaSvg() {
    var f = fotoAttrs();
    var rot = '';
    if (S.girar && S.seguir && conectado() && E_() && E_().d) { rot = ' rotate(' + (-(90 - (E_().d.rumo || 0) * 180 / Math.PI)).toFixed(1) + ' 640 360)'; }
    return '<svg class="mapa-svg" id="t10-mapa" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#14181c"/>' +
      '<g id="t10-mundo" transform="translate(' + S.V.x.toFixed(1) + ' ' + S.V.y.toFixed(1) + ') scale(' + S.V.k + ')">' +
      (f && f.href ? '<image id="t10-foto" href="' + esc(f.href) + '" x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '" preserveAspectRatio="none"/>' : '') +
      '<g id="t10-geo"></g><g id="t10-aero"></g></g></svg>';
  }
  function poligono(lim, cor, w, fill) {
    if (!lim || lim.length < 2) return '';
    var p = lim.map(function (m) { var q = pxm(m[0], m[1]); return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ');
    return '<polygon points="' + p + '" fill="' + (fill || 'none') + '" stroke="' + cor + '" stroke-width="' + w + '" stroke-linejoin="round"/>';
  }
  function bolinha(m, cor, r, borda) {
    var q = pxm(m[0], m[1]), k = 1 / S.V.k;
    return '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (r * k).toFixed(2) + '" fill="' + cor + '" stroke="' + (borda || '#fff') + '" stroke-width="' + (2.5 * k).toFixed(2) + '"/>';
  }
  function rotaDe(t) {
    var ang = t.ang != null ? t.ang : anguloAuto(t.limite);
    var chave = JSON.stringify([t.limite, t.obs, t.esp, t.margem, t.seguranca, t.cob, ang, t.angManual, t.modoMargem, t.lados]);
    if (t._rk === chave && t._rr) return t._rr;
    var r = [];
    try { r = rotaPlanejada(t, t.angManual != null ? t.angManual : ang) || []; } catch (e) { r = []; }
    t._rk = chave; t._rr = r;
    return r;
  }
  function geoHtml() {
    var k = 1 / S.V.k, h = '', E = E_();
    var t = S.sub === 'edit' || S.sub === 'plan' ? S.ed : (S.sub === 'exec' && window.M && M.exec ? M.exec : S.sel ? tarefaPorId(S.sel) : null);
    if (!t) return h;
    var lim = t.limite || [];
    var plan = S.sub === 'edit' || S.sub === 'plan';
    /* limite */
    if (lim.length >= 2) h += poligono(lim, '#ffffff', 3.2 * k, lim.length > 2 && S.sub === 'lista' ? 'rgba(0,0,0,.28)' : 'none');
    /* rota */
    if ((t.limite || []).length >= 3 && !(S.sub === 'lista' && !S.sel)) {
      var r = rotaDe(t);
      if (r && r.length > 1) {
        var d = '', dd = '';
        for (var i = 1; i < r.length; i++) {
          var a = pxm(r[i - 1][0], r[i - 1][1]), b = pxm(r[i][0], r[i][1]);
          var seg = 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
          if (r[i][2] && r[i][3] !== 4) d += seg; else dd += seg;
        }
        h += '<path d="' + d + '" fill="none" stroke="#ffd500" stroke-width="' + (3.4 * k).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<path d="' + dd + '" fill="none" stroke="#ffd500" stroke-width="' + (2 * k).toFixed(2) + '" stroke-dasharray="' + (3 * k).toFixed(2) + ' ' + (5 * k).toFixed(2) + '"/>';
        var ini = r.filter(function (p) { return p[3] !== 4; })[0] || r[0], fim = r[r.length - 1];
        h += bolinha([ini[0], ini[1]], '#7ed321', 7) + bolinha([fim[0], fim[1]], '#f5a800', 7);
        t._ini = [ini[0], ini[1]];
        if (S.sub === 'exec' && E && E.b && E.d && emSolo(E)) {
          var o = pxm(E.b.x, E.b.z), q0 = pxm(ini[0], ini[1]);
          h += '<path d="M' + o[0].toFixed(1) + ' ' + o[1].toFixed(1) + 'L' + q0[0].toFixed(1) + ' ' + q0[1].toFixed(1) + '" stroke="#ffd500" stroke-width="' + (2 * k).toFixed(2) + '" stroke-dasharray="' + (3 * k).toFixed(2) + ' ' + (5 * k).toFixed(2) + '"/>';
        }
      }
    }
    /* pontos de referencia e obstaculos */
    (t.obs || []).forEach(function (o) {
      if (o.tipo === 'circulo') { var q = pxm(o.c[0], o.c[1]); h += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + (o.r / ESCALA_M).toFixed(1) + '" fill="rgba(221,46,49,.3)" stroke="#dd2e31" stroke-width="' + (3 * k).toFixed(2) + '"/>'; }
      else if (o.pts && o.pts.length > 1) h += poligono(o.pts, '#dd2e31', 3 * k, 'rgba(221,46,49,.3)');
      if (plan && o.pts) o.pts.forEach(function (m) { h += bolinha(m, '#dd2e31', 7); });
    });
    if (lim.length) lim.forEach(function (m) { h += bolinha(m, '#cc11e4', 8); });
    /* ponto de partida da edicao */
    if (plan && t.partida) {
      var qp = pxm(t.partida[0], t.partida[1]);
      h += '<g transform="translate(' + qp[0].toFixed(1) + ' ' + qp[1].toFixed(1) + ') scale(' + k + ')"><circle r="34" fill="rgba(255,255,255,.28)" stroke="#fff" stroke-width="2" stroke-dasharray="3 4"/><circle r="9" fill="#f5a800"/></g>';
    }
    /* trilha voada */
    if (S.sub === 'exec' && window.M && M.trilha && M.trilha.length) {
      M.trilha.forEach(function (s) {
        if (!s.p || s.p.length < 2) return;
        var dd2 = s.p.map(function (m, i) { var q = pxm(m[0], m[1]); return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('');
        h += '<path d="' + dd2 + '" fill="none" stroke="' + (s.v ? '#4bd05a' : '#fff') + '" stroke-width="' + (3 * k).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>';
      });
    }
    return h;
  }
  function aeroHtml() {
    var E = E_(), k = 1 / S.V.k, h = '';
    if (E && E.b) {
      var b = pxm(E.b.x, E.b.z);
      h += '<g transform="translate(' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + ') scale(' + k + ')"><path d="M0 0C-5 -9 -21 -21 -21 -38A21 21 0 1 1 21 -38C21 -21 5 -9 0 0Z" fill="#6cb52f" stroke="#fff" stroke-width="2"/><text y="-27" text-anchor="middle" font-size="25" font-weight="700" fill="#fff" font-family="Roboto,Arial">H</text></g>';
    }
    if (E && E.o) {
      var o = pxm(E.o.x, E.o.z);
      h += '<g transform="translate(' + o[0].toFixed(1) + ' ' + o[1].toFixed(1) + ') scale(' + k + ')"><circle r="12" fill="#0a84ff" stroke="#fff" stroke-width="3"/><path d="M14 -3L24 0L14 3Z" fill="#fff"/></g>';
    }
    if (E && E.d && E.b) h += '<path d="M' + pxm(E.d.x, E.d.z).map(function (v) { return v.toFixed(1); }).join(' ') + 'L' + pxm(E.b.x, E.b.z).map(function (v) { return v.toFixed(1); }).join(' ') + '" stroke="#fff" stroke-width="' + (2.5 * k).toFixed(2) + '"/>';
    if (E && E.d && conectado()) {
      var d = pxm(window.poseAgora ? poseAgora(E.d).x : E.d.x, window.poseAgora ? poseAgora(E.d).z : E.d.z), rot = 90 - (E.d.rumo || 0) * 180 / Math.PI;
      h += '<g transform="translate(' + d[0].toFixed(1) + ' ' + d[1].toFixed(1) + ') scale(' + k * .82 + ') rotate(' + rot.toFixed(1) + ')"><path d="M0 -34 26 26 0 12 -26 26z" fill="#e5372e" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></g>';
    }
    return h;
  }

  /* ---------------------------------------------- ferramentas do mapa */
  function ferramentasHtml() {
    var bar = barraVisivel(), y = bar ? 68 : 2;
    var camMain = S.principal !== 'mapa';
    function bt(x, n, ac, cls) { return '<button class="' + (cls || '') + '" data-ac="' + ac + '" style="position:absolute;left:' + x + 'px;top:' + y + 'px">' + ic(n) + '</button>'; }
    var h = '';
    if (S.sub === 'lista') {
      h = bt(964, 'mais', 'fit') + bt(1048, 'local', 'local') + bt(1128, 'hachura', 'hachura') + bt(1214, 'camadas', 'camadas');
    } else if (S.sub === 'plan' || S.sub === 'edit') {
      h = bt(1048, 'mais', 'fit') + bt(1130, 'local', 'local') + bt(1214, 'camadas', 'camadas');
    } else if (camMain) {
      h = bt(1130, 'local', 'local', 'apag') + bt(1214, 'camadas', 'camadas', 'apag');
    } else {
      h = bt(964, 'borracha', 'borracha') + bt(1048, 'local', 'local') + bt(1128, 'seta', 'seguir', S.seguir ? 'seg' : '') + bt(1214, 'camadas', 'camadas');
    }
    return h;
  }
  function barraVisivel() {
    if (S.sub === 'lista') return false;
    if (S.sub === 'plan') return true;
    if (S.sub === 'edit') return !S.painelEd;
    return !S.painelTarefa;
  }
  function popCamadas() {
    return '<div class="pop-camadas"><div class="tipos"><button data-ac="tipo:padrao"><i></i>Padrão</button><button class="sat" data-ac="tipo:sat"><i></i>Satélite</button></div>' +
      '<div class="gira' + (S.girar ? ' on' : '') + '" data-ac="girar">Girar mapa<b></b></div></div>';
  }

  /* ----------------------------------------------------- miniaturas e cameras */
  function slotsCamera() {
    /* principal: 'mapa' | 'f' | 't'; minis: o resto, na ordem fixa */
    var todos = ['mapa', 'f', 't'], res = [];
    var outros = todos.filter(function (x) { return x !== S.principal; });
    if (!S.duas) outros = outros.filter(function (x) { return x === 'mapa' ? true : x === S.mini[0]; });
    return { principal: S.principal, minis: outros };
  }
  function norteSvg() {
    var E = E_(), rot = E && E.d ? (E.d.rumo || 0) * 180 / Math.PI - 90 : 0;
    return '<svg class="norte" viewBox="0 0 30 34" style="transform:rotate(' + (-rot).toFixed(0) + 'deg)"><path d="M15 3L25 28L15 22L5 28Z" fill="#fff"/><circle cx="15" cy="4" r="3.4" fill="#e02c30"/></svg>';
  }
  function camHtml() {
    var sl = slotsCamera(), h = '';
    var top = [310, 480];
    sl.minis.forEach(function (n, i) {
      var y = sl.minis.length === 1 ? 480 : top[i];
      var cam = n !== 'mapa';
      h += '<div class="mini" data-mini="' + n + '" data-ac="trocar:' + n + '" style="top:' + y + 'px">' +
        (n === 'mapa' ? '<svg class="mapaMini" id="t10-mini-mapa" viewBox="0 0 266 150" preserveAspectRatio="xMidYMid slice"></svg>' : '') +
        '<button class="trocar" data-ac="trocar:' + n + '">' + ic('troca') + '</button>' +
        (i === 0 && sl.minis.length === 1 ? '<button class="janela" data-ac="duas">' + ic('janela') + '</button>' : '') +
        (cam && sl.minis.length > 1 ? '<button class="fechar" data-ac="fecharCam:' + n + '">' + ic('x') + '</button>' : '') +
        norteSvg() + '</div>';
    });
    return h;
  }
  function reposicionarCams() {
    var ver = S.tela === 'mapa' && S.sub !== 'lista' && S.sub !== 'plan' && S.sub !== 'edit';
    var sl = ver ? slotsCamera() : { principal: 'nenhum', minis: [] };
    ['f', 't'].forEach(function (n) {
      var cv = qs('#t10-cam-' + n);
      if (!cv) return;
      var ehP = sl.principal === n, mi = sl.minis.indexOf(n);
      if (ehP) { cv.style.cssText = 'position:absolute;left:0;top:0;width:1280px;height:720px;z-index:1;display:block'; cv._visivel = true; }
      else if (mi >= 0) {
        var y = sl.minis.length === 1 ? 480 : [310, 480][mi];
        cv.style.cssText = 'position:absolute;left:997px;top:' + y + 'px;width:266px;height:150px;z-index:9;display:block'; cv._visivel = true;   /* abaixo do .cam-hud (10): os botoes da miniatura (trocar, janela, fechar) ficam por cima da imagem */
      } else { cv.style.display = 'none'; cv._visivel = false; }
    });
    var cam = window.top && top.CAMERA_T10;
    ['f', 't'].forEach(function (n) {
      var cv = qs('#t10-cam-' + n);
      if (cam && cam.alvo && cv) { try { cam.alvo(cv, n === 'f' ? 'frente' : 'tras', !!cv._visivel && S.tela === 'mapa'); } catch (e) { /* camera ainda nao pronta */ } }
    });
  }

  /* ============================================================ MONTAGEM */
  function montarMapa() {
    var E = E_(), t = S.sub === 'lista' ? null : S.ed;
    var h = '<div class="cam-fundo" id="t10-fundo">' + mapaSvg() + '</div>';
    h += '<canvas id="t10-cam-f" width="640" height="360"></canvas><canvas id="t10-cam-t" width="640" height="360"></canvas>';
    h += '<div class="cam-hud" id="t10-hud">';
    h += '<div class="barra" id="t10-barra"></div><div class="tanque-pill" id="t10-tanque"></div>';
    h += '<div id="t10-ferr"></div><div class="alertas" id="t10-alertas"></div><div id="t10-aviso"></div><div id="t10-pop"></div>';
    h += '<button class="esq-doc" data-ac="doc" id="t10-doc">' + ic('doc') + '</button>';
    h += '<div class="osd" id="t10-osd"></div><div class="hsi" id="t10-hsi"></div><div id="t10-sup"></div>';
    h += '<div id="t10-minis"></div><div id="t10-lado"></div><div id="t10-baixo"></div><div class="mira oculto" id="t10-mira"></div>';
    h += '</div><div class="cam-folha" id="t10-folha"></div><div class="cam-modal" id="t10-modal"></div>';
    stage.innerHTML = h;
    S.vistaIni || (S.vistaIni = true, centrarAero());
    var m = qs('#t10-mapa');
    ligarMapa(m);
    S._tmp = {};
    tickMapa(true);
  }
  function renderMapa() { if (!qs('#t10-hud')) montarMapa(); else tickMapa(true); }

  /* O T10 faz a volta de cada passada de re, com o nariz no mesmo rumo (camera_t10.js):
     ao mudar o sentido na rota automatica, a camera que olha para onde ele vai passa a ser a
     grande - a de tras na volta, a da frente na ida. Se a camera grande for o mapa, so troca a
     miniatura (uma so). Troca uma vez por mudanca de sentido: a escolha do piloto vale ate a proxima. */
  function camAuto() {
    var jg = window.top && top.CAMERA_T10;
    if (!jg || !jg.sentido || !conectado()) return false;
    var s = jg.sentido();
    if (!s || s === S.sentidoCam) return false;
    var antes = S.sentidoCam;
    S.sentidoCam = s;
    if (!antes) return false;              /* o primeiro sentido so e anotado */
    var alvo = s > 0 ? 'f' : 't';
    if (S.principal === alvo) return false;
    if (S.principal === 'mapa') {
      if (S.duas || S.mini[0] === alvo) return false;
      S.mini = [alvo];
    } else {
      S.principal = alvo;
      if (!S.duas) S.mini = ['mapa'];
    }
    return true;
  }

  function tickMapa(forca) {
    if (S.tela !== 'mapa' || !qs('#t10-hud')) return;
    camAuto();
    eventosVoo();
    var E = E_(), c = conectado(), v = E && E.v;
    /* fundo (foto do mapa, vista) */
    var f = fotoAttrs(), ft = qs('#t10-foto'), mundo = qs('#t10-mundo');
    var g = qs('#t10-fundo');
    if (S.principal === 'mapa') { if (g) g.style.display = ''; } else if (g) g.style.display = 'none';
    if (S.seguir && S.principal === 'mapa' && c && E && E.d && !S.arrasto && S.sub !== 'edit' && S.sub !== 'plan') centrar(E.d.x, E.d.z);
    if (mundo) {
      var tr = 'translate(' + S.V.x.toFixed(1) + ' ' + S.V.y.toFixed(1) + ') scale(' + S.V.k + ')';
      if (S.girar && S.seguir && c && E && E.d) tr = 'rotate(' + (-(90 - (E.d.rumo || 0) * 180 / Math.PI)).toFixed(1) + ' 640 360) ' + tr;
      mundo.setAttribute('transform', tr);
    }
    if (f && f.href) {
      if (!ft) { var nf = document.createElementNS('http://www.w3.org/2000/svg', 'image'); nf.id = 't10-foto'; mundo.insertBefore(nf, mundo.firstChild); ft = nf; }
      if (ft.getAttribute('href') !== f.href) ft.setAttribute('href', f.href);
      ['x', 'y'].forEach(function (a) { if (ft.getAttribute(a) !== f[a]) ft.setAttribute(a, f[a]); });
      if (ft.getAttribute('width') !== f.w) ft.setAttribute('width', f.w);
      if (ft.getAttribute('height') !== f.h) ft.setAttribute('height', f.h);
      ft.setAttribute('preserveAspectRatio', 'none');
    }
    setHtml(qs('#t10-geo'), geoHtml());
    setHtml(qs('#t10-aero'), aeroHtml());
    /* barra */
    var bar = qs('#t10-barra'), vis = barraVisivel();
    bar.style.display = vis ? '' : 'none';
    if (vis) {
      var bh = barraHtml(); if (bar._h !== bh) { bar._h = bh; bar.innerHTML = bh; var mq = bar.querySelector('.mq'); if (mq) { mq.parentNode.classList.toggle('longo', mq.scrollWidth > mq.parentNode.clientWidth + 2); } }
    }
    var tq = qs('#t10-tanque');
    tq.style.display = vis && c && v ? '' : 'none';
    if (vis && c && v) {
      /* o medidor do T10 so mede abaixo de 1,1 l: acima disso o app mostra ">1.1l" e a pilula fica
         parada em "1.1l" na ponta direita da linha verde, mesmo com 8 l no tanque (voo real);
         abaixo de 1,1 l ela anda para a esquerda e chega em 0.0l com o aviso de carga acabada */
      var tvis = Math.min(v.tanque || 0, 1.1);
      tq.textContent = fmt(tvis, 1) + 'l';
      var tpx = Math.round(clamp(tvis / 1.1, 0, 1) * (1280 - 46));
      tq.style.left = tpx + 'px'; tq.style.setProperty('--w', tpx + 'px');
    }
    setHtml(qs('#t10-ferr'), ferramentasHtml());
    setHtml(qs('#t10-pop'), S.camadas ? popCamadas() : '');
    var doc = qs('#t10-doc'); doc.style.display = (S.sub === 'idle' || S.sub === 'exec') && S.principal === 'mapa' || (S.principal !== 'mapa' && S.sub !== 'lista') ? '' : (S.sub === 'lista' || S.sub === 'plan' || S.sub === 'edit' ? 'none' : '');
    if (S.sub === 'exec') doc.innerHTML = ic('sliders'), doc.dataset.ac = 'cfgtarefa'; else { doc.innerHTML = ic('doc'); doc.dataset.ac = 'doc'; }
    doc.style.top = S.principal === 'mapa' ? '' : '';
    setHtml(qs('#t10-alertas'), S.sub === 'plan' || S.sub === 'edit' ? '' : alertasHtml());
    setHtml(qs('#t10-aviso'), avisoPlanoHtml());
    var ae = qs('#t10-alertas');
    ae.className = 'alertas' + (S.carta ? ' com-carta' : S.sub === 'lista' ? ' em-lista' : (S.painelTarefa || (S.sub === 'exec' && S.painelTarefa) ? ' com-painel' : ''));
    ae.style.display = (S.sub === 'plan' || S.sub === 'edit') ? 'none' : '';
    setHtml(qs('#t10-osd'), osdHtml());
    var osd = qs('#t10-osd'); osd.style.display = S.sub === 'lista' || S.sub === 'plan' ? (S.sub === 'plan' ? '' : 'none') : (S.sub === 'edit' ? '' : '');
    osd.style.visibility = (S.sub === 'lista') || (S.painelTarefa) || S.carta || (S.sub === 'edit' && S.painelEd) ? 'hidden' : '';
    setHtml(qs('#t10-sup'), supHtml());
    var hs = qs('#t10-hsi');
    hs.style.display = S.sub === 'plan' || S.sub === 'edit' ? 'none' : '';
    hs.style.visibility = S.sub === 'lista' && !S.sel ? '' : '';
    setHtml(hs, '<div data-ac="hsi" style="position:absolute;inset:0;pointer-events:auto"></div><div id="t10-dica" class="dica-hsi" style="display:' + (S.dicaHsi ? '' : 'none') + '">Decolar primeiro</div>' + hsiSvg());
    /* miniaturas: so com o mapa/camera no ar (nao na lista/edicao) */
    var ver = S.sub !== 'lista' && S.sub !== 'plan' && S.sub !== 'edit';
    var minis = qs('#t10-minis');
    setHtml(minis, ver ? camHtml() : '');
    if (ver) {
      var mm = qs('#t10-mini-mapa');
      if (mm) mm.innerHTML = miniMapaHtml();
    }
    reposicionarCams();
    setHtml(qs('#t10-lado'), ladoHtml());
    setHtml(qs('#t10-baixo'), baixoHtml());
    var mira = qs('#t10-mira');
    var mostraMira = (S.sub === 'edit' && S.pmetodo === 'Retículo') || (S.sub === 'exec' && S.mover);
    mira.classList.toggle('oculto', !mostraMira);
    var fo = qs('#t10-folha');
    var cb = qs('.folha-cfg .corpo'), st = cb ? cb.scrollTop : 0, pg = (S.avancado ? 'adv:' : '') + S.pagCfg;
    setHtml(fo, folhaHtml());
    var cb2 = qs('.folha-cfg .corpo');
    if (cb2) { if (S._pgAnt !== pg) cb2.scrollTop = 0; else if (st) cb2.scrollTop = st; }
    S._pgAnt = S.pagCfg ? pg : null;
    setHtml(qs('#t10-modal'), modalHtml());
    var mo = qs('#t10-modal'); mo.style.pointerEvents = (S.dlg || S.carregando || S.teclado || S.menu) ? 'auto' : 'none';
    var cr = qs('.carregando'); void cr;
    if (S.sub !== 'lista') { var l = qs('.lista'); if (l) l.remove(); }
  }
  function miniMapaHtml() {
    var f = fotoAttrs(), E = E_(), c = conectado();
    var cx = c && E && E.d ? pxm(E.d.x, E.d.z) : (E && E.b ? pxm(E.b.x, E.b.z) : [960, 600]);
    var k = .72, x = 133 - cx[0] * k, y = 75 - cx[1] * k;
    var h = f && f.href ? '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + k + ')"><image href="' + esc(f.href) + '" x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '" preserveAspectRatio="none"/>' : '';
    if (h && E && E.b) { var b = pxm(E.b.x, E.b.z); h += '<circle cx="' + b[0] + '" cy="' + b[1] + '" r="14" fill="#6cb52f" stroke="#fff" stroke-width="3"/><text x="' + b[0] + '" y="' + (b[1] + 5) + '" text-anchor="middle" font-size="15" font-weight="700" fill="#fff">H</text>'; }
    if (h && c && E && E.d) { var d = pxm(E.d.x, E.d.z), rot = 90 - (E.d.rumo || 0) * 180 / Math.PI; h += '<g transform="translate(' + d[0].toFixed(1) + ' ' + d[1].toFixed(1) + ') scale(.6) rotate(' + rot.toFixed(0) + ')"><path d="M0 -34 26 26 0 12 -26 26z" fill="#e5372e" stroke="#fff" stroke-width="4"/></g>'; }
    return (h ? h + '</g>' : '<rect width="266" height="150" fill="#000"/>');
  }

  /* ---------------------- botoes do lado direito e de baixo, por modo */
  function bt2(txt, ac, cls, st) { return '<button class="' + (cls || '') + '" data-ac="' + ac + '"' + (st ? ' style="' + st + '"' : '') + '>' + txt + '</button>'; }
  function ladoHtml() {
    var h = '';
    if (S.sub === 'plan') {
      var modoRef = S.pmodo === 'ref';
      var l1 = modoRef ? 'Adicionar ponto de referência C2' : 'Adicionar obstáculo C2';
      var l2 = modoRef ? 'Modo de obstáculo C1' : 'Ponto de referência C1';
      var d1 = modoRef ? '#cc11e4' : '#dd2e31', d2 = modoRef ? '#dd2e31' : '#cc11e4';
      h = '<div class="lado-dir" style="top:' + (modoRef ? 228 : 168) + 'px;right:17px">' +
        '<button data-ac="pAdd"><i style="background:' + d1 + ';border:2px solid #fff"></i>' + l1 + '</button>' +
        '<button data-ac="pModo"><i style="background:' + d2 + ';border:2px solid #fff"></i>' + l2 + '</button>' +
        (modoRef ? '' : '<button data-ac="pRedondo"><i style="background:none;border:3px solid #dd2e31"></i>Redondo</button>') + '</div>';
    } else if (S.sub === 'edit') {
      h = '<div class="card-dd" style="top:165px"><small>Adicionar ponto com</small><button data-ac="menu:pmetodo">' + esc(S.pmetodo) + '<i>▼</i></button></div>' +
        '<div class="card-dd" style="top:282px"><small>Tipo de ponto</small><button data-ac="menu:ptipo">' + esc(S.ptipo) + '<i>▼</i></button></div>' +
        '<button class="card-add" data-ac="pAddRet" style="top:398px"><span>+</span> Adicionar</button>';
    } else if (S.sub === 'exec' && S.mover) {
      h = '<div class="lado-dir" style="top:228px;right:17px"><button data-ac="mover" style="padding-left:20px">Mover rota de voo</button><button data-ac="conexao" style="padding-left:20px"><span style="margin-right:12px;font-size:18px">+</span>Adicionar ponto de conexão</button></div>';
    }
    return h;
  }
  function baixoHtml() {
    var E = E_(), c = conectado(), v = E && E.v, voando = c && v && !emSolo(E);
    var h = '';
    function cx(w, bots) { return '<div class="barra-inf" style="width:' + w + 'px">' + bots + '</div>'; }
    function b(ac, txt, w, cls, extra) { return '<button data-ac="' + ac + '"' + (cls ? ' class="' + cls + '"' : '') + ' style="width:' + w + 'px;padding:0' + (extra || '') + '">' + txt + '</button>'; }
    if (S.carta) h = cx(152, b('cartaFechar', 'Desativar', 152));
    else if (S.sub === 'plan') h = cx(380, b('pEdicao', 'Edição do campo', 252) + b('pSalvar', 'Salvar', 128, pontos().length >= 3 ? 'azul' : ''));
    else if (S.sub === 'edit') h = S.painelEd ? cx(474, b('pPartida', 'Definir o ponto de partida', 334) + b('pVoltar', 'Voltar', 140)) : cx(380, b('pPartida', 'Definir o ponto de partida', 330) + b('pVoltar', 'Voltar', 50, '', ';overflow:hidden;text-align:left'));
    else if (S.sub === 'lista') {
      var tem = !!S.sel;
      h = cx(411, b('lCancelar', 'Cancelar', 148) + b('lEdicao', 'Edição', 130, tem ? '' : 'desl') + b('lUse', 'Use', 133, S.usando ? 'azul' : tem ? '' : 'desl'));
    } else if (S.sub === 'exec') {
      if (S.mover) h = cx(278, b('mCancelar', 'Cancelar', 139) + b('mSim', 'Sim', 139));
      else if (S.painelTarefa) h = cx(303, b('cfgCancelar', 'Cancelar', 145) + b('cfgConfirmar', 'Confirmar', 158));
      else if (voando) {
        var pausado = v.estado === 'manual' || !v.rodando, reab = v.estado === 'reabastecendo';
        h = cx(278, b('encerrar', 'Encerrar', 139) + b('pausar', reab || pausado ? 'Continuar' : 'Pausar', 139));
      } else h = cx(278, b('eCancelar', 'Cancelar', 139) + b('eIniciar', 'Iniciar', 139));
    } else {
      if (S.painelTarefa) h = cx(303, b('cfgCancelar', 'Cancelar', 145) + b('cfgConfirmar', 'Confirmar', 158));
      else if (voando && S.modo === 'M') h = cx(139, b('encerrar', 'Encerrar', 139));      /* voo manual: so "Encerrar" (voo real) */
      else if (voando) h = cx(278, b('encerrar', 'Encerrar', 139) + b('pausar', v && (v.estado === 'manual' || !v.rodando) ? 'Continuar' : 'Pausar', 139));
      else h = cx(132, b('iniciarM', 'Iniciar', 132));
    }
    return h;
  }

  /* -------------------------------------------------- painel da lista */
  function listaHtml() {
    var andamento = S.aba === 'Em andamento';
    var h = '<div class="lista"><div class="busca">' + ic('busca') + '<span data-ac="lMenu">' + esc(S.aba) + ' ▾</span></div>' +
      '<div class="ordem"><span>Distância</span><span>▾</span></div>';
    var ts = tarefas().filter(function (t) { return andamento ? (window.M && M.andamento.indexOf(t.id) >= 0) : S.aba === 'Mapa de prescrição' ? false : true; });
    var E = E_();
    if (E && E.o) ts.sort(function (a, b) { var ca = centroide(a.limite), cb = centroide(b.limite); return Math.hypot(ca[0] - E.o.x, ca[1] - E.o.z) - Math.hypot(cb[0] - E.o.x, cb[1] - E.o.z); });
    ts.forEach(function (t) {
      var pr = window.M && M.prog && M.prog[t.id], a = areaHa(t.limite);
      var taxa = pr && pr.pct != null ? pr.pct : (pr ? 24 : 0);
      h += '<button class="card' + (S.sel === t.id ? ' sel' : '') + '" data-ac="lSel:' + esc(t.id) + '"><small>' + dataHora(t.data || Date.now()) + '</small><b>' + esc(t.nome) + '</b>' +
        '<div class="area"' + (andamento ? ' style="left:206px"' : '') + '><small>Área de campo</small><strong>' + fmt(a, 1) + ' <i>Ha</i></strong></div>' +
        (andamento ? '<div class="area" style="left:312px"><small>Taxa de c...</small><strong>' + taxa + '<i>%</i></strong></div>' : '') +
        (pr || t.executada ? '<i class="canto"></i>' : '<i class="ponto"></i>') + '</button>';
    });
    if (S.menuLista) h += '<div class="menu-tipo">' + ['Campos', 'Em andamento', 'Mapa de prescrição'].map(function (n) { return '<button data-ac="lAba:' + n + '">' + n + '</button>'; }).join('') + '</div>';
    return h + '</div>' + (S.aba === 'Campos' ? '<div class="check-circ"><svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' : '');
  }

  /* ----------------------------------------------- sliders e valores */
  var SL = {};
  function slider(chave, rot, un, v, min, max, step, casas, opc) {
    opc = opc || {};
    SL[chave] = { min: min, max: max, step: step, casas: casas, set: opc.set, un: un };
    var pct = clamp((v - min) / (max - min), 0, 1) * 100;
    return '<div class="sl" data-sl="' + chave + '"><button class="mm" data-sl-mm="' + chave + ':-1">−</button><div class="trilho" data-sltr="' + chave + '"><div class="cheio" style="width:' + pct + '%"></div><div class="pino" style="left:' + pct + '%"></div></div><button class="mm" data-sl-mm="' + chave + ':1">+</button></div>';
  }
  function valorEd(chave, v, casas, un, cls) { return '<span class="val ' + (cls || '') + '" data-num="' + chave + '">' + fmt(v, casas) + '<i>' + un + '</i></span>'; }
  function setSl(chave, v) {
    var s = SL[chave]; if (!s) return;
    v = clamp(Math.round(v / s.step) * s.step, s.min, s.max);
    if (s.set) s.set(v);
    var e = qs('[data-sltr="' + chave + '"]');
    if (e) { var p = (v - s.min) / (s.max - s.min) * 100; e.firstChild.style.width = p + '%'; e.lastChild.style.left = p + '%'; }
    qa('[data-num="' + chave + '"]').forEach(function (n) { n.innerHTML = fmt(v, s.casas) + '<i>' + (s.un || '') + '</i>'; });
    qa('[data-valtxt="' + chave + '"]').forEach(function (n) { n.textContent = fmt(v, s.casas) + (s.un || ''); });
  }
  function getSl(chave) { var s = SL[chave]; return s && s.get ? s.get() : 0; }

  /* ---------------------------------------- painel de configuracao da tarefa */
  function vTarefa() {
    var P = window.M ? M.P : {};
    var t = (S.sub === 'exec' && M.exec) ? M.exec : null;
    return { P: P, t: t, esp: t ? t.esp : (P.espMmais || 6) };
  }
  function fluxoCalc() { var o = vTarefa(); return (o.P.taxa || 0) * (o.esp || 6) * (o.P.vel || 0) / 600; }
  function pRot(txt, yc) { return '<span class="pe-rot" style="top:' + (yc - 17 - 12) + 'px">' + txt + '</span>'; }
  function pVal(k, v, casas, un, yc, cls, dir) { return '<span class="pe-val" style="top:' + (yc - 17 - 18) + 'px;' + (dir != null ? 'right:' + dir + 'px' : '') + '"><b class="' + (cls || '') + '" data-num="' + k + '">' + fmt(v, casas) + '</b><i>' + un + '</i></span>'; }
  function pSl(k, v, min, max, step, casas, set, yc) {
    return '<div class="pe-sl" style="top:' + (yc - 17 - 24) + 'px">' + slider(k, '', '', v, min, max, step, casas, { set: set }) + '</div>';
  }
  function painelTarefaHtml() {
    var o = vTarefa(), P = o.P, mmais = S.modo === 'M+' && !o.t;
    SL.taxa = { min: 1, max: 60, step: .01, casas: 2, un: '', set: function (v) { P.taxa = v; pEnviar(); refluxo(); }, get: function () { return P.taxa; } };
    SL.vel = { min: 3.6, max: 25.2, step: .1, casas: 1, un: '', set: function (v) { P.vel = v; pEnviar(); refluxo(); }, get: function () { return P.vel; } };
    SL.alt = { min: 1, max: 15, step: .1, casas: 1, un: '', set: function (v) { P.altura = v; pEnviar(); }, get: function () { return P.altura; } };
    SL.esp = { min: 1.6, max: 59.03, step: .01, casas: 2, un: '', set: function (v) { if (o.t) { o.t.esp = v; enviarTalhao(o.t); } else { P.espMmais = v; salvarP(); } refluxo(); }, get: function () { return o.esp; } };
    var fl = fluxoCalc(), bicos = fl <= .9 ? 2 : 4;
    var area = o.t && window.areaDaTarefaHa ? areaDaTarefaHa(o.t) : 0;
    var h = '<div class="painel-esq"><div class="t">Configurações da tarefa</div>';
    h += pRot('Taxa de aplicação', 130) + pVal('taxa', P.taxa, 2, 'L/Ha', 130, '', 17) +
      (o.t ? '<span class="pe-tot" style="top:122px;right:17px">Total' + fmt(area * P.taxa, 1).replace('.', ',') + 'l</span>' : '') +
      pSl('taxa', P.taxa, 1, 60, .01, 2, SL.taxa.set, 181);
    h += '<div class="subcartao" style="top:196px"><span>Velocidade do fluxo</span><b data-fluxo>' + fmt(fl, fl < 1 ? 1 : 2) + '</b><em>L/Min</em><u data-bicos>' + bicos + '</u><s>Bico</s></div>';
    h += pRot('Velocidade do voo', 314) + pVal('vel', P.vel, 1, 'km/h', 314, '', 17) + pSl('vel', P.vel, 3.6, 25.2, .1, 1, SL.vel.set, 365);
    var comEsp = mmais || S.modo === 'M+';
    if (comEsp) h += pRot('Espaçamento de rota', 431) + pVal('esp', o.esp, 1, 'm', 431, '', 17) + pSl('esp', o.esp, 1.6, 59.03, .01, 2, SL.esp.set, 481);
    var ya = comEsp ? 548 : 431;
    h += pRot('Altura acima das culturas', ya) + pVal('alt', P.altura, 1, 'm', ya, '', 17) + pSl('alt', P.altura, 1, 15, .1, 1, SL.alt.set, ya + 50);
    if (comEsp) h += '<span class="pe-rot" style="top:' + (673 - 17 - 12) + 'px">Rota Fixa no modo M+</span><button class="tg' + (lv('rotaFixa', false) ? ' on' : '') + '" data-ac="tg:rotaFixa" style="position:absolute;right:17px;top:' + (655 - 17) + 'px"></button>';
    return h + '</div>';
  }
  function refluxo() {
    var fl = fluxoCalc(), e = qs('[data-fluxo]'), b = qs('[data-bicos]');
    if (e) e.textContent = fmt(fl, fl < 1 ? 1 : 2);
    if (b) b.textContent = fl <= .9 ? 2 : 4;
    var o = vTarefa(), tot = qs('.pe-tot');
    if (tot && o.t && window.areaDaTarefaHa) tot.textContent = 'Total' + fmt(areaDaTarefaHa(o.t) * o.P.taxa, 1).replace('.', ',') + 'l';
  }

  /* --------------------------------------------- painel da edicao do campo */
  function eRot(txt, yc) { return '<span class="rot" style="position:absolute;left:16px;top:' + (yc - 17 - 11) + 'px;font-size:18px;line-height:22px;width:200px;white-space:nowrap;overflow:hidden">' + txt + '</span>'; }
  function eVal(k, v, casas, un, topAbs, sub, dir) { return '<span class="val' + (sub ? ' sub' : '') + '" data-num="' + k + '" style="position:absolute;top:' + (topAbs - 17) + 'px;right:' + dir + 'px">' + fmt(v, casas) + '<i>' + un + '</i></span>'; }
  function eTog(ac, on, topAbs) { return '<button class="ch' + (on ? ' on' : '') + '" data-ac="' + ac + '" style="position:absolute;right:17px;top:' + (topAbs - 17) + 'px"></button>'; }
  function eSl(k, v, min, max, step, casas, set, yc) {
    SL[k] = { min: min, max: max, step: step, casas: casas, un: '', set: set };
    return '<div style="position:absolute;left:0;right:0;top:' + (yc - 17 - 24) + 'px">' + slider(k, '', '', v, min, max, step, casas, { set: set }) + '</div>';
  }
  function painelEdHtml() {
    var t = S.ed; if (!t) return '';
    var tab = S.abaEd;
    var h = '<div class="painel-esq largo"><div class="t" style="top:29px">Edição do campo</div>' +
      '<div class="ed-abas"><button class="' + (tab === 'rota' ? 'ativo' : '') + '" data-ac="edAba:rota">ROTA</button><button class="' + (tab === 'pontos' ? 'ativo' : '') + '" data-ac="edAba:pontos">PONTOS DE REFERÊNCIA</button></div>' +
      '<div style="position:absolute;left:0;right:0;top:0;bottom:0;overflow:hidden;clip-path:inset(160px 0 0 0)"><div id="t10-rolEd" style="position:absolute;left:0;right:0;top:' + (-(S.edScroll || 0)) + 'px;height:900px">';
    if (tab === 'rota') {
      var umOn = !!t.umLado, mgOn = t.margemOn !== false;
      var y0 = 205, y1 = y0 + (mgOn ? 116 : 66), y2 = y1 + (umOn ? 116 : 67), y3 = y2 + 123, y4 = y3 + 132;
      h += eRot('Amplie a margem geral', y0) + eVal('mg', t.margem || 0, 1, 'm', y0 - 18, false, 83) + eTog('edTog:margemOn', mgOn, y0 - 17);
      if (mgOn) h += eSl('mg', t.margem || 0, 0, 12, .1, 1, function (v) { t.margem = v; t.modoMargem = 'Geral'; sync(); }, y0 + 50);
      h += eRot('Amplie um lado', y1) + eVal('ul', t.ladoV != null ? t.ladoV : .5, 1, 'm', y1 - 15, false, 83) + eTog('edTog:umLado', umOn, y1 - 17);
      if (umOn) h += eSl('ul', t.ladoV != null ? t.ladoV : .5, 0, 12, .1, 1, function (v) { t.ladoV = v; t.lados = {}; t.lados[t.ladoIdx || 0] = v; t.modoMargem = 'Um lado'; sync(); }, y1 + 50);
      h += eRot('Espaçamento de rota', y2) + eVal('esp', t.esp || 5, 1, 'm', y2 - 11, true, 14) + eSl('esp', t.esp || 5, 1.6, 59.03, .01, 2, function (v) { t.esp = v; sync(); }, y2 + 50);
      h += eRot('Distância de segurança do limite de obstáculo', y3) + eVal('seg', t.seguranca != null ? t.seguranca : 2.5, 1, 'm', y3 - 16, false, 14) + eSl('seg', t.seguranca != null ? t.seguranca : 2.5, 0, 5, .1, 1, function (v) { t.seguranca = v; sync(); }, y3 + 50);
      h += eRot('Rota de fronteira automática', y4) + eTog('edTog:fronteira', t.cob === 'Rota e fronteira', y4 - 17);
    } else {
      h += '<div style="position:absolute;left:16px;right:16px;top:180px;font-size:18px;color:#aab2ba;line-height:28px">Pontos de referência: ' + (t.marcas || []).length + '<br>Obstáculos: ' + (t.obs || []).length + '</div>';
    }
    return h + '</div></div></div><button class="colapsa" data-ac="edPainel">' + ic('seta_e') + '</button>';
  }
  function sync() {
    var t = S.ed; if (!t) return;
    t.area = areaHa(t.limite || []);
    t._rk = null;
    if (window.M) M.rotaMapCache = null;
  }

  /* ======================================================= configuracoes */
  var PAGS = [['aeronave', 'drone'], ['pulv', 'pulv'], ['cr', 'cr'], ['radar', 'radar'], ['rtk', 'RTK'], ['hd', 'HD'], ['bateria', 'bateria']];
  var TITULOS = { aeronave: 'Configurações da aeronave', pulv: 'Configurações do sistema de pulverização', cr: 'Configurações do CR', radar: 'Configurações de radar', rtk: 'Configurações RTK', hd: 'Configurações da transmissão de imagem', bateria: 'Bateria Inteligente', avancado: 'Configurações avançadas' };
  function cfgTog(k, rot, desc, def, ac) {
    var on = tgv(k, def);
    return '<div class="lin"><div class="nome">' + rot + '</div><div class="dir"><button class="tog' + (on ? ' on' : '') + '" data-ac="tg:' + k + '"></button></div>' + (desc ? '<div class="desc">' + desc + '</div>' : '') + '</div>';
  }
  function tgv(k, def) {
    var P = window.M ? M.P : {};
    if (k === 'estab') return P.estab !== false;
    if (k === 'desvio') return P.desvio !== false;
    if (k === 'contornar') return P.contornar !== false;
    return lv(k, def);
  }
  function cfgSel(k, rot, ops, def, desc, larg) {
    return '<div class="lin"><div class="nome">' + rot + '</div><div class="dir"><button class="pilula" data-ac="menu:' + k + '" style="' + (larg ? 'min-width:' + larg + 'px' : '') + '">' + esc(lv(k, def)) + '<i>▼</i></button></div>' + (desc ? '<div class="desc">' + desc + '</div>' : '') + '</div>';
  }
  function cfgSlider(chave, rot, v, un, min, max, step, casas, desc, set, dois) {
    SL[chave] = { min: min, max: max, step: step, casas: casas, un: un, set: set };
    var pct = clamp((v - min) / (max - min), 0, 1) * 100;
    return '<div class="lin' + (dois ? ' dois' : '') + '"><div class="nome">' + rot + '</div>' +
      '<div class="ctl"><span class="v" data-valtxt="' + chave + '">' + fmt(v, casas) + un + '</span><button class="mm" data-sl-mm="' + chave + ':-1">−</button><div class="trilho" data-sltr="' + chave + '"><div class="cheio" style="width:' + pct + '%"></div><div class="pino" style="left:' + pct + '%"></div></div><button class="mm" data-sl-mm="' + chave + ':1">+</button></div>' +
      (desc ? '<div class="desc" style="margin-top:' + (dois ? 38 : 14) + 'px">' + desc + '</div>' : '') + '</div>';
  }
  function cfgBtn(rot, txt, desc, ac, aj) {
    return '<div class="lin"><div class="nome">' + rot + '</div><div class="dir">' + (aj ? '<span class="interr">?</span>' : '') + '<button class="brancho" data-ac="' + ac + '">' + txt + '</button></div>' + (desc ? '<div class="desc">' + desc + '</div>' : '') + '</div>';
  }
  function pagAeronave() {
    var P = window.M ? M.P : {};
    var h = cfgSlider('rthVel', 'Roteamento de conexão e velocidade RTH', P.rthVel || 36, 'km/h', 10.8, 25.2, .1, 1, '', function (v) { P.rthVel = v; pEnviar(); }, true).replace('<div class="desc"', '<div class="desc"');
    h += cfgSlider('rthAlt', 'Roteamento de conexão e altitude RTH', P.rthAlt || 7, 'm', 3, 50, 1, 0, '', function (v) { P.rthAlt = v; pEnviar(); }, true);
    h += '<div class="ilus"><svg viewBox="0 0 440 100" width="440" height="100"><path d="M18 40H140M150 40H255V78" fill="none" stroke="#7ed321" stroke-width="2" stroke-dasharray="4 4"/><g fill="#7ed321"><path d="M30 36l-9 4 9 4zM60 36l-9 4 9 4zM90 36l-9 4 9 4z" opacity=".8"/></g>' +
      '<path d="M18 40V70" stroke="#7ed321" stroke-width="2" stroke-dasharray="4 4"/><g transform="translate(18 88)"><path d="M0 0C-3 -6 -11 -12 -11 -21A11 11 0 1 1 11 -21C11 -12 3 -6 0 0Z" fill="#6cb52f"/><text y="-16" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">H</text></g></svg>' +
      '<div class="cx" style="left:262px;top:14px;line-height:25px;font-size:17px">A aeronave subirá a uma altitude predefinida antes de retornar à base.</div></div>';
    h += cfgSel('pulvFim', 'Pulverização concluída', ['Voo estacionário', 'Retorno à base (RTH)', 'Pousar'], 'Voo estacionário', 'Função não suportada no modo M');
    h += cfgTog('continuar', 'Continuar a tarefa se o sinal do controle remoto for perdido', 'Compatível apenas com modo Rota. Quando desativado, a ação para sinal do CR perdido selecionada será realizada (aplicada a todas as aeronaves no modo várias aeronaves)', true);
    h += cfgSel('sinalCR', 'Sinal do CR perdido', ['Retorno à base (RTH)', 'Pairar', 'Pousar'], 'Retorno à base (RTH)', 'Selecione Ação para sinal do CR perdido');
    h += cfgSel('rotaCompleta', 'Rota de voo completa', ['Voo estacionário', 'Retorno à base (RTH)'], 'Voo estacionário', 'Quando em modo de várias aeronaves, as configurações serão aplicadas a todas as aeronaves');
    h += '<div class="lin"><div class="nome">Localização do ponto de origem</div><div class="dir"><button class="pilula pequena" data-ac="origem:aero" style="min-width:104px">' + ic('seta', '', 'font-size:28px') + '</button><button class="pilula pequena" data-ac="origem:cr" style="min-width:104px;margin-left:10px">' + ic('user', '', 'font-size:28px') + '</button></div><div class="desc">Altere a localização do Ponto de origem com base nas necessidades de pulverização</div></div>';
    h += cfgTog('qtFrontal', 'Quick Track frontal', 'Serve como fonte de luz e indicador durante tarefas noturnas', false);
    h += cfgTog('qtTraseiro', 'Quick Track traseiro', 'Serve como fonte de luz e indicador durante tarefas noturnas', false);
    var altMax = (window.CFG && CFG.local.altMax != null) ? CFG.local.altMax : 100, dMax = (window.CFG && CFG.local.distMax != null) ? CFG.local.distMax : 2000;
    h += cfgSlider('altMax', 'Altitude de voo máx.', altMax, 'm', 15, 100, 1, 0, 'Faixa 15-100m', function (v) { CFG.local.altMax = v; guardar('cfgLocal', CFG.local); cmd('p', { v: { xgAltMax: v } }); });
    h += cfgSlider('distMax', 'Distância máxima de voo', dMax, 'm', 50, 2000, 10, 0, 'Faixa 50-2000m', function (v) { CFG.local.distMax = v; guardar('cfgLocal', CFG.local); cmd('p', { v: { xgDistMax: v } }); });
    h += '<button class="lin seta" data-ac="avancado"><span>Configurações avançadas</span>' + ic('seta_d') + '</button>';
    return h;
  }
  function pagAvancado() {
    var h = '<button class="lin seta" data-ac="mute"><span>Desbloqueando licença(s)</span>' + ic('seta_d') + '</button>' +
      '<button class="lin seta" data-ac="mute"><span>Calibração da bússola e da UMI</span>' + ic('seta_d') + '</button>';
    h += cfgTog('atti', 'Permitir Modo Atitude (ATTI)', 'O modo A será ativado quando a alternância do modo de voo do CR for movida para o modo A. Voe com cuidado', false);
    h += cfgTog('ajusteEsp', 'Ajuste automático do espaçamento da rota', 'Quando habilitada, a cobertura de pulverização das áreas da borda do campo será otimizadas automaticamente', true);
    h += '<button class="lin seta" data-ac="mute" style="display:block;height:auto;padding:14px 0 16px"><span style="display:flex;justify-content:space-between;align-items:center">Dados do motor' + ic('seta_d') + '</span><span class="desc" style="display:block;font-size:17px;color:rgba(255,255,255,.62);margin-top:10px;text-align:left">Exibir dados do motor</span></button>';
    h += '<div class="lin sem centro" style="margin-top:34px"><button data-ac="retomarNC" style="color:#2096f3;font-size:20px">Retomar tarefa não concluída</button></div>';
    return h;
  }
  function pagPulv() {
    var E = E_(), c = conectado(), v = E && E.v;
    var h = cfgTog('sistema', 'Sistema de pulverização', 'Quando o sistema de pulverização é desabilitado, a pulverização não pode ser feita, mas a tarefa de missão do voo pode ser executada normalmente', true);
    h += cfgTog('tempoReal', 'Dados em tempo real do sistema de pulverização', '', true);
    var rpm = c && v && (v.vazao || 0) > 0 ? '2200' : 'N/A', fl2 = c && v ? fmt(v.vazao || 0, 1) : 'N/A';
    var rp = c && rpm !== 'N/A' ? rpm : (c ? '0' : 'N/A'), vz = c ? fl2 : 'N/A';
    var ib = '<svg class="ic" viewBox="0 0 24 24" style="font-size:30px;margin:0 auto">' + IC.pulv + '</svg>';
    h += '<div class="lin sem" style="padding-top:2px"><table class="grade" style="width:auto"><tr><td style="width:330px"></td><td colspan="2" style="text-align:center;padding-bottom:0">Bomba</td></tr>' +
      '<tr><td></td><td class="v" style="width:92px;padding:0">' + ib + '<div style="font-size:15px">1</div></td><td class="v" style="width:92px;padding:0">' + ib + '<div style="font-size:15px">2</div></td></tr>' +
      '<tr><td>Velocidade de rotação (RPM)</td><td class="v">' + rp + '</td><td class="v">' + rp + '</td></tr>' +
      '<tr><td style="text-align:right;padding-right:14px">Vazão (L/Min)</td><td class="v">' + vz + '</td><td class="v">' + vz + '</td></tr></table></div>';
    h += '<div class="lin" style="display:flex;justify-content:space-between"><span>Quociente de vazão</span><span>' + (c && v ? fmt((v.vazao || 0), 1) + 'L/Min' : 'N/A') + '</span></div>';
    h += '<div class="lin" style="display:flex;justify-content:space-between"><span>Volume pulverizado</span><span>' + (c && v ? fmt(v.calda || 0, 2) + 'l' : 'N/A') + '</span></div><div class="desc" style="margin:-8px 0 14px;font-size:16px;color:rgba(255,255,255,.62)">Recalcular após reiniciar a aeronave</div>';
    h += '<div class="lin" style="display:flex;justify-content:space-between"><span>Carga líquida restante</span><span>' + (c && v ? ((v.tanque || 0) > 1.1 ? '>1.1l' : fmt(v.tanque || 0, 1) + 'l') : 'N/A') + '</span></div>';
    h += cfgBtn('Liberar ar preso', 'Iniciar', 'A ativação desse recurso libera o ar preso nas mangueiras da bomba do pulverizador. Pressione e mantenha pressionado o botão Pulverização para ativar rapidamente esse recurso quando estiver na visualização de tarefas.', 'arIniciar');
    h += cfgSlider('tanqueVazio', 'Limite de aviso de tanque vazio', lv('tanqueVazio', 0), 'l', 0, 2, .1, 1, 'No modo Rota. A tarefa será suspensa quando a carga restante no tanque de pulverização cair para o limite predefinido', function (v) { L.tanqueVazio = v; gravarL(); });
    h += cfgBtn('Calibrar fluxo da bomba', 'Calibrar', 'Calibre as bombas de entrega se a quantidade real pulverizada for inconsistente com o valor predefinido, o tipo de bico mudou ou as bombas foram substituídas. Calibre o fluxômetro antes de calibrar as bombas de entrega.', 'mute');
    h += cfgBtn('Calibrar fluxômetro', 'Calibrar', 'Quando o quociente de vazão exibido estiver impreciso, calibre o fluxômetro (somente pré-decolagem).', 'mute', true);
    h += cfgBtn('Calibração do medidor de nível do líquido', 'Calibrar', 'Calibrar o medidor de líquido ajuda a assegurar a precisão da carga útil restante', 'mute');
    h += cfgSel('bico', 'Modelo do bico', ['SX11001VS', 'XR11001VS', 'XR11002VS'], 'SX11001VS', '<span style="display:block;padding-left:62px;margin-top:-4px">Ajuste as configurações com base no tipo de bico atualmente instalado para evitar afetar os resultados da tarefa(Faixa de vazão do bico: 0.0~-1.0L/Min -1.0~0.0L/Min)</span>');
    h += cfgBtn('Restaurar fluxômetro para as configurações de fábrica', 'Restaurar', 'Se os resultados do fluxômetro forem imprecisos após a calibração, restaure o fluxômetro para as configurações de fábrica.', 'mute');
    return h;
  }
  function pagCR() {
    var linhas = [['C1', 'Definir Ponto A'], ['C2', 'Definir Ponto B'], ['C3', 'Indefinida'], ['Para cima', 'Indefinida'], ['Para baixo', 'Indefinida'], ['Esquerda', 'M+ desvio à esquerda'], ['Direita', 'M + desvio à direita']];
    var h = '<div class="lin sem" style="padding-bottom:0">Botão personalizado</div><div class="botao-pers" style="height:330px">' +
      '<svg viewBox="0 0 290 280" width="290" height="280" style="position:absolute;left:0;top:10px" fill="none" stroke="#fff" stroke-width="2"><rect x="20" y="40" width="250" height="52" rx="14"/><path d="M50 40V10M240 40V10M80 92v28H210V92"/><rect x="30" y="170" width="230" height="86" rx="18"/><circle cx="145" cy="214" r="8" fill="#2aa6ff" stroke="none"/><circle cx="104" cy="214" r="7" fill="#2aa6ff" stroke="none"/><circle cx="186" cy="214" r="7" fill="#2aa6ff" stroke="none"/><circle cx="145" cy="186" r="7" fill="#2aa6ff" stroke="none"/><circle cx="145" cy="242" r="7" fill="#2aa6ff" stroke="none"/><g fill="#7ed321" stroke="none" font-size="13" font-family="Roboto,Arial"><text x="10" y="30">C2</text><text x="250" y="30">C1</text><text x="30" y="175">Para cima</text><text x="210" y="172">Direita</text><text x="10" y="264">Esquerda</text><text x="116" y="268">Para baixo</text><text x="76" y="276">C3</text></g></svg>';
    var ys = [60, 102, 158, 200, 242, 284, 326];
    linhas.forEach(function (l, i) {
      h += '<span style="position:absolute;right:162px;top:' + (ys[i] - 78 + 8) + 'px;font-size:17px;color:#fff;width:90px;text-align:right">' + l[0] + '</span>' +
        '<button class="pilula" data-ac="menu:cr' + i + '" style="position:absolute;right:0;top:' + (ys[i] - 78) + 'px;min-width:150px;width:150px;height:35px;font-size:15px;padding:0 6px">' + esc(lv('cr' + i, l[1])) + '<i>▼</i></button>';
    });
    return h + '</div>';
  }
  function pagRadar() {
    var P = window.M ? M.P : {};
    var h = cfgTog('estab', 'Seguir terreno automático', 'A aeronave segue o terreno automaticamente e ajusta a altitude (altura acima das plantações) durante o voo, com base na elevação atual', true);
    h += cfgTog('desvio', 'Desvio de obstáculo horizontal', 'A aeronave detecta obstáculos horizontais por meio de radar e freia para evitar colisões. Esta opção é habilitada por padrão, em todas as tarefas do modo não M para ajudar a garantir a segurança do voo, podendo ser desabilitada manualmente', true);
    h += cfgTog('supOn', 'Desvio de obstáculos superiores', 'A aeronave detecta obstáculos superiores por meio de radar e freia para evitar colisões', false);
    h += cfgTog('audio', 'Alerta de áudio para evitar obstáculo', 'Habilite Áudio de alerta para evitar obstáculo quando Evitar obstáculo horizontal estiver desabilitado', true);
    h += cfgTog('contornar', 'Seguir terreno e desvio de obstáculos', '<span style="display:block;padding-left:38px">Disponível apenas nos modos de operação de rota de voo e de rota A-B. Quando habilitado, a aeronave tentará desviar de obstáculos automaticamente. Mova os pinos de controle para desativar esta função.</span>', true);
    var fren = lv('frenagem', (window.CFG && CFG.local.frenagem != null) ? CFG.local.frenagem : 5);
    h += cfgSlider('frenagem', 'Distância de frenagem do obstáculo lateral', fren, 'm', 1, 7, .5, 1, '<span style="display:block;padding-left:56px">Ajuste a distância a partir da qual a aeronave freia para evitar obstáculos em ambos os lados (perpendicular à orientação da aeronave). Essa configuração é essencial para a segurança do voo. Tenha cuidado</span>', function (v) { L.frenagem = v; gravarL(); if (window.CFG) { CFG.local.frenagem = v; guardar('cfgLocal', CFG.local); } cmd('p', { v: { xgFrenagem: v } }); }, true);
    h += cfgSlider('alerta', 'Distância de alerta', lv('alerta', 10), 'm', 2, 16, .5, 1, '<span style="display:block;padding-left:62px">Obstáculos detectados à esquerda, à direita, à frente ou à parte traseira da aeronave, dentro da distância de aviso predefinida, serão exibidos no indicador de atitude, e o aviso será solicitado</span>', function (v) { L.alerta = v; gravarL(); });
    h += cfgSlider('transp', 'Indicador de altitude transparente', lv('transp', 10), 's', 2, 30, 1, 0, 'Quando obstáculos são detectados para a quantidade de tempo predeterminada, o indicador de altitude se torna transparente para fornecer uma visão mais nítida da câmera. Toque no indicador para restaurar para uma exibição sólida', function (v) { L.transp = v; gravarL(); }, true);
    h += cfgTog('distObs', 'Distância até o obstáculo', 'Quando ativada, o indicador de altitude exibirá os obstáculos em todas as direções desde a aeronave', true);
    h += cfgSel('tamHsi', 'Tamanho do indicador de altitude', ['Grande', 'Médio', 'Pequeno'], 'Grande', '');
    h += cfgSel('terrTarefa', 'Terreno de tarefa', ['Automático', 'Árvore'], 'Automático', 'O modo Automático é adequado para terrenos planos, sem mudanças claras de altura, ou montanhas com grandes ondulações. O modo Árvore (Tree) é adequado para árvores frutíferas e características definidas de cobertura. Escolha o modo apropriado com base nos requisitos da tarefa');
    h += cfgBtn('Calibrar ângulo de detecção', 'Calibrar', 'A detecção de radar pode ser calibrada para corrigir acionamentos falsos do sistema de desvio de obstáculos.', 'calib');
    return h;
  }
  function pagRTK() {
    var E = E_(), on = !!(E && E.rtk) || lv('rtkOn', false);
    var h = '<div class="lin"><div class="nome">Posicionamento RTK de aeronaves</div><div class="dir"><button class="tog' + (on ? ' on' : '') + '" data-ac="tg:rtk"></button></div><div class="desc">Quando desabilitado, a aeronave usará o posicionamento por satélite. Quando habilitado durante o voo, o posicionamento do RTK ocorrerá imediatamente</div></div>';
    h += cfgSel('rtkFonte', 'Fonte de sinal RTK', ['RTK de rede personalizada', 'Estação móvel D-RTK 2'], 'RTK de rede personalizada', 'Certifique-se de que a conexão de rede seja estável', 260);
    h += '<div class="ntrip"><div class="l"><span>Host NTRIP</span><div><div class="campo-txt"><input data-in="ntHost" value="' + esc(lv('ntHost', '')) + '"></div></div></div>' +
      '<div class="l"><span>Entrada</span><div><div class="campo-txt"><input data-in="ntPorta" value="' + esc(lv('ntPorta', '')) + '"></div></div></div>' +
      '<div class="l"><span>Usuário</span><div><div class="campo-txt"><input data-in="ntUser" value="' + esc(lv('ntUser', '')) + '"></div></div></div>' +
      '<div class="l"><span>Senha</span><div><div class="campo-txt"><input type="password" data-in="ntSenha" value="' + esc(lv('ntSenha', '')) + '"></div></div></div>' +
      '<div class="l"><span>Ponto de suporte</span><div><div class="campo-txt"><input data-in="ntPonto" value="' + esc(lv('ntPonto', 'AUTO')) + '"></div></div></div>' +
      '<div style="text-align:center;padding:14px 0 4px"><button data-ac="ntConfig" style="color:#7ed321;font-size:17px">Configurações</button></div></div>';
    h += '<div class="lin sem" style="display:flex;justify-content:space-between"><span>RTK de rede personalizadaStatus&nbsp;&nbsp;<b style="color:' + (on ? '#7ed321' : '#e0262f') + ';font-weight:400">' + (on ? 'Conectado' : 'Desconectado') + '</b></span><span>4G</span></div>';
    h += '<table class="tabela2"><tr><th></th><th>Aeronave</th><th>RTK de rede<br>personalizada</th></tr>' +
      '<tr><td>Orientação</td><td>' + (on ? 'Fixo' : '') + '</td><td></td></tr><tr><td>Posicionamento</td><td>' + (on ? 'Fixo' : '') + '</td><td></td></tr>' +
      '<tr><td>Latitude</td><td></td><td></td></tr><tr><td>Longitude</td><td></td><td></td></tr><tr><td>Satélites</td><td>' + (on ? '24' : '') + '</td><td></td></tr></table>';
    h += '<button class="lin seta" data-ac="mute"><span>Diagnóstico RTK</span>' + ic('seta_d') + '</button>';
    h += cfgTog('rtkOri', 'Orientação RTK', '', false);
    return h;
  }
  function pagHD() {
    var m = lv('hdModo', 'Automático');
    var h = '<div class="lin sem" style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:21px">Modo canal</span><div class="seg verde" style="min-width:250px"><button class="' + (m === 'Automático' ? 'ativo' : '') + '" data-ac="hdModo:Automático">Automático</button><button class="' + (m === 'Manual' ? 'ativo' : '') + '" data-ac="hdModo:Manual">Manual</button></div></div>';
    h += '<div class="lin sem" style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:21px">Varredura de frequência</span><button class="pilula" style="min-width:232px">5.8G</button></div>';
    h += '<div class="grafico"><span style="position:absolute;left:0;top:-4px">dBm/MHz</span><div class="quadro"><div class="janela"></div></div><span style="position:absolute;left:30px;top:30px">-70</span><span style="position:absolute;left:30px;top:90px">-90</span><span style="position:absolute;left:24px;top:146px">-110</span>' +
      '<span style="position:absolute;right:0;top:46px">≈1km</span><span style="position:absolute;right:0;top:112px">≈4km</span><span style="position:absolute;right:0;top:150px">MHz</span><div class="leg"><i></i>Sinal bom<i class="f"></i>Sinal fraco</div></div>';
    h += '<div class="lin sem" style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:21px">Canal da transmissão de imagem</span><button class="pilula" data-ac="menu:hdCanal">' + esc(lv('hdCanal', 'Selecione')) + '<i>▼</i></button></div>';
    return h;
  }
  function pagBateria() {
    var E = E_(), c = conectado(), v = E && E.v, b = c && v ? Math.round(v.bateria || 0) : 0;
    var cel = c ? 3.45 + 0.0075 * b : 0, tensao = cel * 14;
    var h = '';
    if (c) {
      h += '<div class="celulas">' + (function () { var s = ''; for (var i = 0; i < 14; i++) s += '<div><i style="background:linear-gradient(#69c130 ' + (b) + '%,transparent ' + (b) + '%)"></i>' + fmt(cel, 2) + '</div>'; return s; })() + '</div>';
    }
    h += '<div class="quatro"><div>Tensão<b>' + (c ? fmt(tensao, 1) : '--') + '<small>V</small></b></div><div>Temperatura<b>' + (c ? '22,6' : '--') + '<small>°C</small></b></div><div>Número de ciclos<b>' + (c ? '12' : '--') + '</b></div><div>Corrente da bateria<b>' + (c ? (v && v.rodando ? '18000' : '800') : '--') + '<small>mA</small></b></div></div>';
    h += cfgSlider('batFraca', 'Advertência de bateria fraca', lv('batFraca', 20), '%', 10, 50, 1, 0, 'O CR vibra com aviso de bateria fraca. RTH ou substitua a bateria', function (v) { L.batFraca = v; gravarL(); });
    h += cfgSlider('batCrit', 'Advertência de bateria baixa crítica', lv('batCrit', 5), '%', 5, 30, 1, 0, 'Quando um alerta crítico de bateria fraca é acionado, o controle remoto vibra e a aeronave pousa automaticamente', function (v) { L.batCrit = v; gravarL(); });
    h += cfgSel('batAcao', 'Ação de bateria baixa', ['Advertência', 'Retorno à base (RTH)', 'Pousar'], 'Advertência', 'Definir a ação quando houver bateria baixa. RTH apenas disponível em modo de Rota A-B e modo de Rota');
    h += '<div class="lin" style="display:flex;justify-content:space-between"><span>Número de série da bateria</span><b style="font-weight:500;letter-spacing:.5px">' + (c ? '—' : '—') + '</b></div>';
    return h;
  }
  function folhaHtml() {
    var h = '';
    if (S.carta) h += cartaHtml();
    if (S.painelTarefa) h += painelTarefaHtml();
    if (S.sub === 'edit' && S.painelEd) h += painelEdHtml();
    if (S.sub === 'lista') h += listaHtml();
    if (S.pagCfg) {
      var pg = S.avancado ? 'avancado' : S.pagCfg;
      var corpo = { aeronave: pagAeronave, pulv: pagPulv, cr: pagCR, radar: pagRadar, rtk: pagRTK, hd: pagHD, bateria: pagBateria, avancado: pagAvancado }[pg]();
      h += '<div class="folha-cfg"><div class="tiras">' + PAGS.map(function (p) {
        var txt = p[0] === 'rtk' || p[0] === 'hd';
        return '<button class="' + (p[0] === S.pagCfg ? 'ativo' : '') + (txt ? ' txt' : '') + '" data-ac="cfg:' + p[0] + '">' + (txt ? p[1] : ic(p[1], '', 'font-size:34px')) + '</button>';
      }).join('') + '</div>' +
        '<div class="tit">' + (S.avancado ? '<button data-ac="avancado-x" style="position:absolute;left:12px;top:30px;width:40px;height:40px;font-size:22px">' + ic('voltar') + '</button>' : '') + TITULOS[pg] + '</div>' +
        '<button class="fechar" data-ac="cfg-x">' + ic('x') + '</button>' +
        '<div class="corpo com-tit"><div class="rol" id="t10-rol">' + corpo + '</div></div></div>';
    }
    return h;
  }

  /* =================================================== dialogos e modais */
  function modalHtml() {
    var h = '';
    if (S.carregando) h += '<div class="vidro" style="background:rgba(0,0,0,.2)"><div class="dlg carreg">' + S.carregando.html + '</div></div>';
    if (S.dlg) h += S.dlg();
    if (S.menu) h += menuHtml();
    if (S.teclado) h += tecladoHtml();
    return h;
  }
  function dlgSimples(icone, txt, botoes) {
    return function () {
      return '<div class="vidro"><div class="dlg">' + (icone ? '<span class="icone ' + icone + '">' + ic('aviso', 'cheio') + '</span>' : '') + '<div class="tx">' + txt + '</div>' +
        '<div class="bts">' + botoes.map(function (b, i) { return '<button data-ac="dlg:' + i + '"' + (b.cls ? ' class="' + b.cls + '"' : '') + '>' + b.t + '</button>'; }).join('') + '</div></div></div>';
    };
  }
  function abrirDlg(icone, txt, botoes) { S.dlg = dlgSimples(icone, txt, botoes); S.dlgBt = botoes; render2(); }
  function fecharDlg() { S.dlg = null; S.dlgBt = null; render2(); }
  var MENUS = {
    pmetodo: ['Retículo', 'Controlador', 'Aeronave'], ptipo: ['Ponto limite', 'Ponto de referência', 'Obstáculo', 'Redondo'],
    pulvFim: ['Voo estacionário', 'Retorno à base (RTH)', 'Pousar'], sinalCR: ['Retorno à base (RTH)', 'Pairar', 'Pousar'], rotaCompleta: ['Voo estacionário', 'Retorno à base (RTH)'],
    tamHsi: ['Grande', 'Médio', 'Pequeno'], terrTarefa: ['Automático', 'Árvore'], rtkFonte: ['RTK de rede personalizada', 'Estação móvel D-RTK 2'],
    bico: ['SX11001VS', 'XR11001VS', 'XR11002VS'], batAcao: ['Advertência', 'Retorno à base (RTH)', 'Pousar'], hdCanal: ['Selecione', '5745 MHz', '5765 MHz', '5785 MHz', '5805 MHz', '5825 MHz'],
    colheita: ['Outro', 'Arroz', 'Trigo', 'Milho', 'Sorgo', 'Algodão', 'Batata', 'Árvore frutífera']
  };
  var CR_OPS = ['Indefinida', 'Definir Ponto A', 'Definir Ponto B', 'Interruptor de holofote', 'M+ desvio à esquerda', 'M + desvio à direita', 'Adicionar ponto'];
  function opcoesMenu(k) { return /^cr\d$/.test(k) ? CR_OPS : (MENUS[k] || []); }
  function menuHtml() {
    var m = S.menu, ops = opcoesMenu(m.k), cur = m.k === 'pmetodo' ? S.pmetodo : m.k === 'ptipo' ? S.ptipo : m.k === 'colheita' ? S.colheita : lv(m.k, ops[0]);
    return '<div class="vidro" style="background:transparent" data-ac="menu-x"><div class="menu-flut" style="left:' + m.x + 'px;top:' + m.y + 'px;width:' + m.w + 'px" data-ac="nop">' +
      ops.map(function (o, i) { return '<button class="' + (o === cur ? 'ativo' : '') + '" data-ac="menu-op:' + i + '">' + esc(o) + '</button>'; }).join('') + '</div></div>';
  }
  function tecladoHtml() {
    var t = S.teclado;
    var linhas = [['1', '2', '3', '-'], ['4', '5', '6', ','], ['7', '8', '9', '⌫'], ['.', '0', 'Português', 'Conc.']];
    return '<div class="teclado-num">' + (t.selTudo ? '<div style="position:absolute;left:0;top:-32px;background:#fff;color:#111;font-size:15px;padding:7px 12px;box-shadow:0 2px 6px #0006">SELECIONAR TUDO</div>' : '') +
      linhas.map(function (l) { return '<div class="linha">' + l.map(function (k) { return '<button class="' + (k === 'Português' ? 'pq' : k === 'Conc.' ? 'ok' : '') + '" data-ac="tec:' + k + '">' + k + '</button>'; }).join('') + '</div>'; }).join('') + '</div>';
  }
  function abrirTeclado(chave, ini) { S.teclado = { k: chave, txt: String(ini).replace('.', ','), selTudo: true }; render2(); mostraTeclado(); }
  function mostraTeclado() {
    var t = S.teclado; if (!t) return;
    qa('[data-num="' + t.k + '"]').forEach(function (n) { n.classList.add('edit'); var u = (SL[t.k] && SL[t.k].un) || ''; n.innerHTML = esc(t.txt || '') + '<i>' + u + '</i>'; });
  }

  /* ============================================================= acoes */
  function render2() {
    if (S.tela === 'inicio') { var raiz = qs('.ini'); stage.innerHTML = telaInicio() + (S.metodoDlg ? telaMetodo() : '') + modalHtmlSimples(); }
    else if (S.tela === 'registros') stage.innerHTML = registrosHtml() + modalHtmlSimples();
    else renderMapa();
  }
  function modalHtmlSimples() {
    var h = '';
    if (S.dlg) h += S.dlg();
    return h ? '<div class="cam-modal" style="pointer-events:auto">' + h + '</div>' : '';
  }
  function registrosHtml() {
    var ts = tarefas();
    return '<div class="extra"><button class="fx" data-ac="home:fechar">' + ic('x') + '</button><div style="position:absolute;left:8px;top:14px;font-size:11px;color:#9aa;line-height:14px">Não sincronizado ▫<br>Total ▫ ' + ts.length + '</div>' +
      '<div style="position:absolute;left:0;right:0;top:26px;text-align:center"><span style="display:inline-block;border:1px solid rgba(255,255,255,.35);border-radius:6px;padding:8px 70px;font-size:17px">Campos ▾</span></div>' +
      '<div class="conteudo" style="top:100px">' + (ts.length ? ts.map(function (t) { return '<div style="margin:0 80px 12px;padding:14px 18px;background:rgba(255,255,255,.06);border-radius:6px;display:flex;justify-content:space-between"><span>' + esc(t.nome) + '</span><span>' + fmt(areaHa(t.limite), 1) + ' Ha</span></div>'; }).join('') : '<div style="text-align:center;margin-top:150px">' + ic('aviso', 'cheio', 'width:34px;height:34px;margin:0 auto 12px;color:#fff') + 'Sem dados</div>') + '</div></div>';
  }
  function irMapa(sub) {
    S.principal = 'mapa';
    S.tela = 'mapa'; S.sub = sub; S.sel = null; S.ed = null; S.painelTarefa = false; S.pagCfg = null; S.mover = false; S.vistaIni = false; S.usando = false;
    if (window.M) { M.sub = sub === 'lista' ? 'lista' : M.sub; M.modo = 'rota'; if (sub !== 'lista') M.exec = M.exec; }
    stage.innerHTML = ''; montarMapa();
  }
  function irInicio() {
    S.tela = 'inicio'; S.sub = 'lista'; S.ed = null; S.metodoDlg = false; S.pagCfg = null; S.painelTarefa = false;
    if (window.M) { M.sub = 'lista'; M.exec = null; M.voo = null; M.ed = null; }
    render2();
  }

  /* limite/pontos da edicao */
  function novoCampo() {
    return { id: null, nome: '', limite: [], obs: [], marcas: [], esp: 5, margem: 2.5, margemOn: true, modoMargem: 'Geral', seguranca: 2.5, cob: 'Somente rota', sentido: 'horario', umLado: false, angManual: null, seg: [0, 100], lados: {}, linhasM: [], ladoIdx: 0, partida: null };
  }
  function pontoNovo() {
    var E = E_(), m = null;
    if (S.pmetodo === 'Retículo') m = aMundo(640, 360);
    else if (S.pmetodo === 'Aeronave') { if (!conectado() || !E || !E.d) { toast('Aeronave desconectada'); return null; } m = [E.d.x, E.d.z]; }
    else { if (!E || !E.o) { toast('Posição do controle indisponível'); return null; } m = [E.o.x, E.o.z]; }
    return m && m.every(isFinite) ? m : null;
  }
  function adicionarPonto(tipo) {
    var t = S.ed, m = pontoNovo();
    if (!t || !m) return;
    var perto = function (l) { return l.some(function (q) { return Math.hypot(q[0] - m[0], q[1] - m[1]) < 1; }); };
    if (tipo === 'Ponto limite') {
      if (perto(t.limite)) return aviso('Falha ao adicionar. Os pontos devem estar pelo menos 1.0m separados');
      var L2 = t.limite, pos = L2.length;
      if (S.pmetodo === 'Retículo' && L2.length >= 3) {
        var melhor = Infinity, hp = function (a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); };
        for (var i = 0; i < L2.length; i++) { var a = L2[i], b = L2[(i + 1) % L2.length], c2 = hp(a, m) + hp(m, b) - hp(a, b); if (c2 < melhor) { melhor = c2; pos = i + 1; } }
      }
      L2.splice(pos, 0, m);
      aviso('Ponto de referência adicionado');
      if (L2.length === 3) planejando();
    } else if (tipo === 'Redondo') { t.obs.push({ tipo: 'circulo', c: m, r: 1.5 }); aviso('Ponto de referência adicionado'); }
    else if (tipo === 'Obstáculo') {
      if (!t.grupo || t.obs.indexOf(t.grupo) < 0) { t.grupo = { tipo: 'poligono', pts: [], sem: false, tipoNome: 'Ponto de obstáculo' }; t.obs.push(t.grupo); }
      t.grupo.pts.push(m); aviso('Ponto de referência adicionado');
    } else { t.marcas.push(m); aviso('Ponto de referência adicionado'); }
    sync(); tickMapa(true);
    if (window.poligonoCruzado && poligonoCruzado(t.limite)) aviso('Planos de campo se cruzaram');
  }
  function cartaoGira(txt, cor) {
    return '<div style="width:498px;height:237px;text-align:center;color:#555"><svg class="ic" viewBox="0 0 24 24" style="width:44px;height:44px;margin:64px auto 0;color:' + (cor || '#3cb34a') + ';animation:t10giro 1s linear infinite"><path d="M12 3a9 9 0 1 1-9 9" stroke-width="2.6"/></svg><div style="font-size:22px;margin-top:62px">' + txt + '</div></div>';
  }
  function planejando() {
    S.carregando = { html: cartaoGira('Planejando rota...') };
    tickMapa(true);
    setTimeout(function () { S.carregando = null; aviso('Pulverização de bordas das áreas do campo otimizadas automaticamente'); tickMapa(true); }, 900);
  }
  function salvarCampo(nome, colheita) {
    var ed = S.ed, ang = ed.angManual != null ? ed.angManual : anguloAuto(ed.limite);
    var t = {
      id: 't' + Date.now(), nome: nome || ('Campo ' + (tarefas().length + 1)), data: Date.now(), limite: ed.limite,
      obs: ed.obs.filter(function (o) { return o.tipo === 'circulo' || o.pts.length >= 3; }).map(function (o) { return o.tipo === 'circulo' ? { tipo: 'circulo', c: o.c, r: o.r } : { tipo: 'poligono', pts: o.pts, sem: !!o.sem }; }),
      marcas: ed.marcas, esp: ed.esp, margem: ed.margem, modoMargem: ed.modoMargem, ladoIdx: ed.ladoIdx || 0, seguranca: ed.seguranca, cob: ed.cob, sentido: ed.sentido,
      umLado: ed.umLado, angManual: ed.angManual, ang: ang, seg: ed.seg, lados: ed.lados || {}, linhasM: [], modo: 'rota', colheita: colheita
    };
    t.area = areaHa(t.limite);
    M.tarefas.unshift(t); salvarTarefas();
    S.sel = t.id;
    return t;
  }

  function iniciarVoo(conf) {
    if (!conectado()) return toast('Aeronave desconectada');
    S.carregando = { html: '<div style="width:600px;padding:56px 40px 60px;text-align:center;color:#444"><svg class="ic" viewBox="0 0 24 24" style="width:50px;height:50px;margin:0 auto 22px;animation:t10giro 1s linear infinite;color:#555"><path d="M12 3a9 9 0 1 1-9 9" stroke-width="2.4"/></svg><div style="font-size:26px">Carregando...</div><div style="font-size:19px;color:#888;margin-top:16px">Certifique-se de que o controle remoto tenha conexão sem interferência</div></div>' };
    tickMapa(true);
    setTimeout(function () {
      S.carregando = null;
      var n = 3;
      var conta = function () {
        if (n <= 0) { S.carregando = null; tickMapa(true); cmd('iniciar'); return; }
        S.carregando = { html: '<div style="width:600px;padding:40px 40px 44px;text-align:center;color:#333"><div style="font-size:26px;line-height:34px">Aeronave se preparando para decolar. Afaste-se a uma distância segura</div><div style="font-size:130px;color:#e5372e;font-weight:700;margin:20px 0 10px;line-height:150px">' + n + '</div><div style="font-size:20px;line-height:28px;color:#777">Empurre o pino de controle esquerdo (no Modo 2) para baixo para cancelar a decolagem</div></div>' };
        tickMapa(true); n -= 1; S._conta = setTimeout(conta, 1000);
      };
      conta();
    }, 1700);
  }

  function acao(a, el) {
    var p = a.split(':'), n = p[0], v = p.slice(1).join(':');
    switch (n) {
      case 'nop': return;
      case 'mute': return;
      case 'home':
        if (v === 'doc') { S.tela = 'registros'; render2(); }
        else if (v === 'fechar') { S.tela = 'inicio'; render2(); }
        return;
      case 'planejar': S.metodoDlg = true; render2(); return;
      case 'metodo': {
        if (v === 'x') { S.metodoDlg = false; render2(); return; }
        var E = E_();
        if (v === 'cr' && conectado()) return;      /* N/A com a aeronave ligada (voo real) */
        if (v === 'rtk' && !(E && E.rtk)) { abrirDlg('laranja', 'Vincular ao dispositivo RTK primeiro', [{ t: 'OK', cls: 'dest', fn: function () {} }]); return; }
        if (v === 'aero' && !conectado()) { abrirDlg('laranja', 'Conectar à aeronave', [{ t: 'OK', cls: 'dest' }]); return; }
        S.metodoDlg = false; S.pmetodo = 'Retículo'; S.via = v; S.principal = 'mapa';
        S.tela = 'mapa'; S.sub = 'plan'; S.ed = novoCampo(); S.pmodo = 'ref'; S.vistaIni = false;
        if (window.M) { M.sub = 'edicao'; M.modo = 'rota'; M.metodo = S.pmetodo; M.ed = novaEdicao(null); M.painel = true; }
        montarMapa();
        if (!conectado()) { S.avisoDesc = false; }
        return;
      }
      case 'executar': irMapa('lista'); S.aba = 'Campos'; tickMapa(true); return;
      case 'dlg': { var b = (S.dlgBt || [])[Number(v)]; var f = b && b.fn; fecharDlg(); if (f) f(); return; }
      case 'cfg': S.pagCfg = v; S.avancado = false; tickMapa(true); return;
      case 'cfg-x': S.pagCfg = null; S.avancado = false; tickMapa(true); return;
      case 'avancado': S.avancado = true; tickMapa(true); return;
      case 'avancado-x': S.avancado = false; tickMapa(true); return;
      case 'tg': {
        var P = window.M ? M.P : {};
        if (v === 'estab') { P.estab = !(P.estab !== false); pEnviar(); }
        else if (v === 'desvio') { P.desvio = !(P.desvio !== false); pEnviar(); aviso(P.desvio ? 'Desvio de obstáculo horizontal ativado' : 'Desvio de obstáculo horizontal desativado. Alerta sonoro para desvio de obstáculo disponível.'); }
        else if (v === 'contornar') { P.contornar = !(P.contornar !== false); pEnviar(); }
        else if (v === 'rtk') { var novo = !(E_() && E_().rtk); L.rtkOn = novo; gravarL(); if (window.CFG) { CFG.local.rtkOn = novo; guardar('cfgLocal', CFG.local); } cmd('p', { v: { xgRtk: novo } }); }
        else { L[v] = !lv(v, false); gravarL(); if (v === 'qtFrontal') cmd('holofote', { v: !!L[v] }); }
        tickMapa(true); return;
      }
      case 'menu': {
        var r = el.getBoundingClientRect(), rs = stage.getBoundingClientRect(), k = S.k;
        var w = Math.max(r.width / k, 200);
        S.menu = { k: v, x: (r.left - rs.left) / k, y: Math.min((r.bottom - rs.top) / k + 4, 560), w: w };
        if (v === 'pmetodo' || v === 'ptipo') { S.menu.y = (r.bottom - rs.top) / k - 2; S.menu.x = (r.left - rs.left) / k; S.menu.w = r.width / k; }
        tickMapa(true); return;
      }
      case 'menu-x': S.menu = null; tickMapa(true); return;
      case 'menu-op': {
        var ops = opcoesMenu(S.menu.k), op = ops[Number(v)], k2 = S.menu.k;
        S.menu = null;
        if (k2 === 'pmetodo') { S.pmetodo = op; if (window.M) M.metodo = op; }
        else if (k2 === 'ptipo') S.ptipo = op;
        else if (k2 === 'colheita') S.colheita = op;
        else { L[k2] = op; gravarL(); if (k2 === 'terrTarefa' && window.M) { M.P.terreno = op === 'Árvore' ? 'montanha' : 'planicie'; pEnviar(); } }
        if (k2 === 'colheita') { render2(); return; }
        tickMapa(true); return;
      }
      case 'alerta-x': if (window.M) { M.alertasFechados[v] = true; if (window.avisosInfo) { var ix = avisosInfo.findIndex(function (x) { return x.id === v; }); if (ix >= 0) avisosInfo.splice(ix, 1); } } tickMapa(true); return;
      case 'camadas': S.camadas = !S.camadas; tickMapa(true); return;
      case 'tipo': S.sat = v === 'sat'; S.camadas = false; tickMapa(true); return;
      case 'girar': S.girar = !S.girar; tickMapa(true); return;
      case 'hsi': dicaRadar(); return;
      case 'seguir': S.seguir = !S.seguir; if (S.seguir) centrarAero(); tickMapa(true); return;
      case 'local': centrarAero(); tickMapa(true); return;
      case 'fit': { var t0 = S.ed || (S.sel && tarefaPorId(S.sel)); if (t0 && t0.limite.length) { var c0 = centroide(t0.limite); centrar(c0[0], c0[1]); } else centrarAero(); tickMapa(true); return; }
      case 'borracha': if (window.apagarTrilha) apagarTrilha(); tickMapa(true); return;
      case 'hachura': return;
      case 'doc': S.sub = 'lista'; S.sel = null; if (window.M) M.sub = 'lista'; tickMapa(true); return;
      case 'trocar': {
        var alvo = v;
        if (alvo === S.principal) return;
        var antes = S.principal; S.principal = alvo;
        var i = S.mini.indexOf(alvo); if (i >= 0) S.mini[i] = antes;
        if (antes !== 'mapa' && S.mini.indexOf(antes) < 0 && !S.duas) S.mini = [antes];
        tickMapa(true); return;
      }
      case 'duas': S.duas = !S.duas; tickMapa(true); return;
      case 'fecharCam': S.duas = false; if (S.principal !== 'mapa') S.principal = 'mapa'; tickMapa(true); return;
      /* planejamento */
      case 'pAdd': adicionarPonto(S.pmodo === 'ref' ? 'Ponto limite' : 'Obstáculo'); return;
      case 'pRedondo': adicionarPonto('Redondo'); return;
      case 'pModo': S.pmodo = S.pmodo === 'ref' ? 'obs' : 'ref'; tickMapa(true); return;
      case 'pAddRet': adicionarPonto(S.ptipo); return;
      case 'pEdicao': S.sub = 'edit'; S.painelEd = true; if (window.M) M.sub = 'edicao'; tickMapa(true); return;
      case 'pVoltar': if (S.sub === 'edit') { S.sub = 'plan'; tickMapa(true); } else irInicio(); return;
      case 'pPartida': { var E3 = E_(), pp = S.pmetodo === 'Reticulo' || S.pmetodo === 'Retículo' ? aMundo(640, 360) : (E3 && E3.d ? [E3.d.x, E3.d.z] : E3 && E3.o ? [E3.o.x, E3.o.z] : null); if (pp) S.ed.partida = pp; tickMapa(true); return; }
      case 'pSalvar': {
        if (S.ed.limite.length < 3) return toast('Adicione pelo menos 3 pontos limite');
        S.colheita = 'Outro'; S.nomeCampo = '';
        S.dlg = function () {
          return '<div class="vidro"><div class="dlg campo-info"><div class="tt">Informação de campo</div><input class="nome" id="t10-nome" placeholder="Insira o nome do campo" value="' + esc(S.nomeCampo) + '">' +
            '<div class="colh">Colheita</div><button class="sel" data-ac="menu:colheita" style="display:flex">' + esc(S.colheita) + '<i>▼</i></button>' +
            '<div class="bts"><button data-ac="salvarCancel">Cancelar</button><button data-ac="salvarOk" class="dest">Salvar</button></div></div></div>';
        };
        render2(); return;
      }
      case 'salvarCancel': S.dlg = null; render2(); return;
      case 'salvarOk': {
        var inp = qs('#t10-nome'); var nome = inp ? inp.value.trim() : S.nomeCampo;
        S.dlg = null; salvarCampo(nome, S.colheita);
        S.ed = null; S.sub = 'lista'; if (window.M) { M.sub = 'lista'; M.ed = null; }
        S.vistaIni = false; irMapa('lista'); return;
      }
      case 'edAba': S.abaEd = v; tickMapa(true); return;
      case 'edPainel': S.painelEd = !S.painelEd; tickMapa(true); return;
      case 'edTog': {
        var t = S.ed; if (!t) return;
        if (v === 'margemOn') { t.margemOn = !t.margemOn; if (!t.margemOn) t.margem = 0; else t.margem = t.margem || 2.5; }
        else if (v === 'umLado') { t.umLado = !t.umLado; if (t.umLado) { t.lados = {}; t.lados[t.ladoIdx || 0] = t.ladoV != null ? t.ladoV : .5; t.modoMargem = 'Um lado'; } else { t.lados = {}; t.modoMargem = 'Geral'; } }
        else if (v === 'fronteira') t.cob = t.cob === 'Rota e fronteira' ? 'Somente rota' : 'Rota e fronteira';
        sync(); tickMapa(true); return;
      }
      /* lista */
      case 'lMenu': S.menuLista = !S.menuLista; tickMapa(true); return;
      case 'lAba': S.aba = v; S.menuLista = false; S.sel = null; tickMapa(true); return;
      case 'lSel': {
        S.sel = S.sel === v ? null : v;
        var tt = tarefaPorId(S.sel);
        if (tt) { var cc = centroide(tt.limite); centrar(cc[0], cc[1]); }
        S.usando = false; tickMapa(true); return;
      }
      case 'lCancelar': if (S.sel) { S.sel = null; tickMapa(true); } else { S.sub = 'idle'; if (window.M) M.sub = 'lista'; tickMapa(true); } return;
      case 'lEdicao': {
        var te = tarefaPorId(S.sel); if (!te) return;
        S.ed = JSON.parse(JSON.stringify(novaEdicao(te))); S.ed.id = te.id; S.ed.data = te.data; S.ed.nome = te.nome;
        S.sub = 'edit'; S.pmetodo = 'Retículo'; S.painelEd = true; if (window.M) { M.sub = 'edicao'; M.ed = novaEdicao(te); }
        tickMapa(true); return;
      }
      case 'lUse': {
        var tu = tarefaPorId(S.sel); if (!tu) return;
        S.usando = true; S.carregando = { html: '<div style="width:300px;height:134px;text-align:center;color:#333"><svg class="ic" viewBox="0 0 24 24" style="width:40px;height:40px;margin:22px auto 0;color:#333;animation:t10giro 1.1s linear infinite">' + IC.girar + '</svg><div style="font-size:20px;font-weight:700;margin-top:20px">Lendo dados...</div></div>' };
        tickMapa(true);
        setTimeout(function () {
          S.carregando = null; S.usando = false;
          if (window.M) { M.aba = S.aba === 'Em andamento' ? 'Em andamento' : 'Tarefa'; usar(tu); }
          S.sub = 'exec'; S.sel = tu.id; S.painelTarefa = false;
          tickMapa(true);
        }, 900);
        return;
      }
      /* execucao */
      case 'cfgtarefa': S.painelTarefa = !S.painelTarefa; tickMapa(true); return;
      case 'cfgCancelar': S.painelTarefa = false; tickMapa(true); return;
      case 'cfgConfirmar': S.painelTarefa = false; pEnviar(); tickMapa(true); return;
      case 'eCancelar':
        S.dlg = null; abrirDlg('laranja', 'Cancelar?', [{ t: 'Cancelar' }, { t: 'Sim', cls: 'dest', fn: function () { if (window.M) { M.exec = null; M.voo = null; M.sub = 'lista'; } S.sub = 'lista'; S.sel = null; S.mover = false; tickMapa(true); } }]);
        return;
      case 'eIniciar': iniciarVoo(); return;
      case 'iniciarM': S.painelTarefa = true; tickMapa(true); return;
      case 'encerrar': abrirDlg('laranja', 'Encerrar a tarefa? A aeronave retornará ao ponto de origem', [{ t: 'Cancelar' }, { t: 'Encerrar', cls: 'dest', fn: function () { cmd('encerrar'); } }]); return;
      case 'pausar': {
        var Ev = E_(), vv = Ev && Ev.v, paus = vv && (vv.estado === 'manual' || !vv.rodando);
        if (vv && vv.estado === 'reabastecendo') return iniciarVoo();
        if (paus) cmd('retomar', { alvo: (Ev && Ev.v && Ev.v.estado === 'manual' && Ev.v.temRota) ? 'c' : undefined }); else cmd('pausar');
        return;
      }
      case 'arIniciar': arIniciar(); return;
      case 'arCancelar': arFim(); return;
      case 'cartaFechar': S.carta = null; tickMapa(true); return;
      case 'mover': S.mover = true; tickMapa(true); return;
      case 'mCancelar': S.mover = false; tickMapa(true); return;
      case 'mSim': S.mover = false; tickMapa(true); return;
      case 'conexao': {
        if (!M.exec) return;
        if (!M.voo || M.voo.id !== M.exec.id) M.voo = novoVoo(M.exec);
        M.voo.con.push(aMundo(640, 360)); M.voo.conDaRota = false; enviarTalhao(M.exec); aviso('Ponto de conexão adicionado com sucesso'); tickMapa(true); return;
      }
      case 'retomarNC': S.pagCfg = null; S.avancado = false; S.sub = 'lista'; S.aba = 'Em andamento'; tickMapa(true); return;
      case 'origem': return;
      case 'hdModo': L.hdModo = v; gravarL(); tickMapa(true); return;
      case 'ntConfig': { var on = true; L.rtkOn = on; gravarL(); if (window.CFG) { CFG.local.rtkOn = on; guardar('cfgLocal', CFG.local); } cmd('p', { v: { xgRtk: on } }); toast('Conectado'); tickMapa(true); return; }
      case 'calib': abrirDlg(null, 'Confirme se os seguintes requisitos foram atendidos<br><br>1. Decole e faça voo estacionário a 1.5-3.0m. 2. Calibre em um ambiente sem vento e não opere a aeronave.', [{ t: 'Cancelar' }, { t: 'Calibrar', cls: 'dest' }]); return;
      case 'tec': teclaNum(v); return;
    }
  }
  function teclaNum(k) {
    var t = S.teclado; if (!t) return;
    if (t.selTudo) { t.selTudo = false; if (/^[0-9.,-]$/.test(k)) t.txt = ''; }
    if (k === '⌫') t.txt = t.txt.slice(0, -1);
    else if (k === 'Conc.') {
      var v = parseFloat(String(t.txt).replace(',', '.')); var s = SL[t.k];
      S.teclado = null;
      if (isFinite(v) && s) setSl(t.k, v);
      render2(); return;
    } else if (/^[0-9]$/.test(k)) t.txt += k;
    else if (k === ',' || k === '.') { if (t.txt.indexOf(',') < 0) t.txt += ','; }
    else if (k === '-') { if (!t.txt) t.txt = '-'; }
    mostraTeclado();
    var tc = qs('.teclado-num'); if (tc) { var tp = qs('.teclado-num > div[style]'); if (tp && !t.selTudo) tp.remove(); }
  }

  /* ----------------------------------------------- toques, arraste e zoom */
  stage.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ac]');
    if (b) { e.stopPropagation(); acao(b.dataset.ac, b); return; }
    var mm = e.target.closest('[data-sl-mm]');
    if (mm) {
      var q = mm.dataset.slMm.split(':'), s = SL[q[0]];
      if (s) setSl(q[0], (getAtual(q[0]) + Number(q[1]) * s.step));
      return;
    }
    var nm = e.target.closest('[data-num]');
    if (nm) { var kk = nm.dataset.num; if (SL[kk]) abrirTeclado(kk, getAtual(kk)); return; }
    /* toque num ponto do mapa: a alca verde da rota abre o ajuste de navegacao */
    if (S.teclado && !e.target.closest('.teclado-num')) { S.teclado = null; render2(); }
  });
  function getAtual(k) {
    var s = SL[k]; if (!s) return 0;
    if (s.get) return Number(s.get()) || 0;
    var t = qs('[data-sltr="' + k + '"]');
    var p = t ? parseFloat(t.lastChild.style.left) / 100 : 0;
    return s.min + p * (s.max - s.min);
  }
  /* sliders */
  stage.addEventListener('pointerdown', function (e) {
    var tr = e.target.closest('[data-sltr]');
    if (tr) {
      var k = tr.dataset.sltr, mover = function (ev) { var r = tr.getBoundingClientRect(), f = clamp((ev.clientX - r.left) / r.width, 0, 1), s = SL[k]; if (s) setSl(k, s.min + f * (s.max - s.min)); };
      try { tr.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ }
      mover(e); tr.onpointermove = mover; tr.onpointerup = function () { tr.onpointermove = null; };
      e.stopPropagation(); return;
    }
    var m = e.target.closest('#t10-mapa');
    if (m && S.principal === 'mapa' && !e.target.closest('button')) {
      S.arrasto = { x: e.clientX, y: e.clientY, vx: S.V.x, vy: S.V.y, mexeu: false };
      try { m.setPointerCapture(e.pointerId); } catch (x) { /* sem captura */ }
    }
  });
  stage.addEventListener('pointermove', function (e) {
    if (!S.arrasto) return;
    var dx = (e.clientX - S.arrasto.x) / S.k, dy = (e.clientY - S.arrasto.y) / S.k;
    if (Math.hypot(dx, dy) > 4 || S.arrasto.mexeu) { S.arrasto.mexeu = true; S.V.x = S.arrasto.vx + dx; S.V.y = S.arrasto.vy + dy; if (S.seguir && S.sub !== 'edit' && S.sub !== 'plan') { S.seguir = false; } tickMapa(false); }
  });
  stage.addEventListener('pointerup', function (e) {
    if (S.arrasto && !S.arrasto.mexeu) { var r = stage.getBoundingClientRect(); toqueMapa((e.clientX - r.left) / S.k, (e.clientY - r.top) / S.k); }
    S.arrasto = null;
  });
  function toqueMapa(sx, sy) {
    if (S.sub === 'exec' && !S.painelTarefa) {
      var t = window.M && M.exec;
      if (t && t._ini) { var q = aTela(t._ini[0], t._ini[1]); if (Math.hypot(q[0] - sx, q[1] - sy) < 40) { S.mover = !S.mover; tickMapa(true); return; } }
    }
    if (S.sub === 'edit' && S.ed && S.ed.limite.length >= 3 && S.ed._ini) {
      var q2 = aTela(S.ed._ini[0], S.ed._ini[1]); if (Math.hypot(q2[0] - sx, q2[1] - sy) < 36) { abrirNavegacao(); return; }
    }
    if (S.sub === 'lista') { /* toque num campo do mapa seleciona */
      var m = aMundo(sx, sy), ach = tarefas().filter(function (t) { return window.dentro && dentro(m, t.limite); })[0];
      if (ach) { S.sel = ach.id; tickMapa(true); }
    }
  }
  function abrirNavegacao() {
    var t = S.ed, ang = t.angManual != null ? t.angManual : anguloAuto(t.limite), grau = ((ang * 180 / Math.PI) % 360 + 360) % 360;
    var nomes = ['Norte', 'Nordeste', 'Leste', 'Sudeste', 'Sul', 'Sudoeste', 'Oeste', 'Noroeste'];
    var ix = Math.round(grau / 45) % 8;
    var ticks = '';
    for (var i = 0; i < 60; i++) { var a = i * 6 * Math.PI / 180, r1 = i % 5 ? 84 : 80; ticks += '<line x1="' + (97 + Math.sin(a) * r1).toFixed(1) + '" y1="' + (97 - Math.cos(a) * r1).toFixed(1) + '" x2="' + (97 + Math.sin(a) * 90).toFixed(1) + '" y2="' + (97 - Math.cos(a) * 90).toFixed(1) + '" stroke="#9aa" stroke-width="' + (i % 5 ? 1 : 1.6) + '"/>'; }
    S.dlg = function () {
      return '<div class="vidro" style="background:transparent;pointer-events:none"><div class="nav-painel" style="pointer-events:auto"><div class="t">Ajuste de navegação</div><div class="grau">' + nomes[ix] + ':' + Math.round(grau) + '°</div>' +
        '<svg class="br" viewBox="0 0 194 194" width="194" height="194"><g>' + ticks + '</g><g fill="#fff" font-size="20" text-anchor="middle" font-family="Roboto,Arial"><text x="97" y="34">N</text><text x="97" y="171">S</text><text x="164" y="104">E</text><text x="30" y="104">W</text></g>' +
        '<circle cx="97" cy="97" r="13" fill="none" stroke="#fff" stroke-width="2"/><g transform="rotate(' + grau.toFixed(0) + ' 97 97)"><path d="M97 40L103 97H91Z" fill="#e02c30"/><path d="M97 154L103 97H91Z" fill="#fff"/></g><circle cx="97" cy="97" r="5" fill="#fff"/></svg>' +
        '<div class="mm"><button data-ac="navM:-1">−</button><button data-ac="navM:1">+</button></div></div>' +
        '<div class="barra-inf" style="width:278px;pointer-events:auto"><button data-ac="navX" style="width:139px;padding:0">Cancelar</button><button data-ac="navOk" style="width:139px;padding:0">Salvar</button></div></div>';
    };
    S.navAng = ang; render2();
  }
  /* ajuste de navegacao: acoes proprias */
  var acao0 = acao;
  acao = function (a, el) {
    var p = a.split(':');
    if (p[0] === 'navM') { S.navAng += Number(p[1]) * Math.PI / 180; S.ed.angManual = S.navAng; sync(); abrirNavegacaoAtualiza(); return; }
    if (p[0] === 'navX') { S.dlg = null; render2(); return; }
    if (p[0] === 'navOk') { S.dlg = null; S.ed.angManual = S.navAng; sync(); render2(); return; }
    return acao0(a, el);
  };
  function abrirNavegacaoAtualiza() { var t = S.ed; var a = S.navAng; S.ed.angManual = a; abrirNavegacao(); S.navAng = a; }
  stage.addEventListener('wheel', function (e) {
    if (e.target.closest('.painel-esq.largo')) { e.preventDefault(); S.edScroll = clamp((S.edScroll || 0) + (e.deltaY > 0 ? 60 : -60), 0, 200); tickMapa(true); return; }
    if (!e.target.closest('#t10-mapa')) return;
    e.preventDefault();
    var r = stage.getBoundingClientRect(), sx = (e.clientX - r.left) / S.k, sy = (e.clientY - r.top) / S.k, f = e.deltaY < 0 ? 1.15 : .87, k0 = S.V.k, k1 = clamp(k0 * f, .35, 8);
    S.V.x = sx - (sx - S.V.x) * k1 / k0; S.V.y = sy - (sy - S.V.y) * k1 / k0; S.V.k = k1; S.seguir = false; tickMapa(true);
  }, { passive: false });
  function ligarMapa() { /* os ouvintes ficam no palco (delegacao) */ }

  /* ------------------------------------------------------ botoes fisicos */
  var rcBotao0 = window.rcplusBotao;
  window.rcplusBotao = function (nome, apertou) {
    /* R2 = cancelar e R3 = confirmar nos dialogos do app */
    if (apertou && (nome === 'R2' || nome === 'R3') && S.dlg) {
      var bs = qa('.dlg .bts button');
      if (bs.length) { (nome === 'R2' ? bs[0] : bs[bs.length - 1]).click(); return; }
    }
    if (apertou && (S.sub === 'plan' || S.sub === 'edit')) {
      if (nome === 'C1') { S.pmodo = S.pmodo === 'ref' ? 'obs' : 'ref'; tickMapa(true); return; }
      if (nome === 'C2' || nome === 'C3') { if (S.sub === 'plan') adicionarPonto(S.pmodo === 'ref' ? 'Ponto limite' : 'Obstáculo'); else adicionarPonto(S.ptipo); return; }
    }
    if (rcBotao0) return rcBotao0(nome, apertou);
  };
  window.rcplusVoltar = function () {
    if (S.teclado) { S.teclado = null; return render2(); }
    if (S.menu) { S.menu = null; return tickMapa(true); }
    if (S.dlg) { S.dlg = null; return render2(); }
    if (S.pagCfg) { if (S.avancado) S.avancado = false; else S.pagCfg = null; return tickMapa(true); }
    if (S.painelTarefa) { S.painelTarefa = false; return tickMapa(true); }
    if (S.camadas) { S.camadas = false; return tickMapa(true); }
    if (S.tela === 'registros') { S.tela = 'inicio'; return render2(); }
    if (S.metodoDlg) { S.metodoDlg = false; return render2(); }
    if (S.tela === 'mapa') {
      if (S.sub === 'edit') { S.sub = 'plan'; return tickMapa(true); }
      if (S.sub === 'lista' && S.sel) { S.sel = null; return tickMapa(true); }
      var E = E_(); if (S.sub === 'exec' && E && !emSolo(E)) return;
      return irInicio();
    }
    if (S.tela === 'inicio' && top && top.location && JOGO) { /* inicio: nada */ }
  };

  /* toque no radar: no chao ele pede para decolar antes (como no aparelho) */
  function dicaRadar() {
    var E = E_();
    if (!conectado() || emSolo(E)) {
      S.dicaHsi = Date.now();
      var e = qs('#t10-dica'); if (e) { e.style.display = ''; }
      clearTimeout(S._dh); S._dh = setTimeout(function () { var x = qs('#t10-dica'); if (x) x.style.display = 'none'; S.dicaHsi = 0; }, 1800);
    }
  }

  /* ======================================================== arranque */
  window.EAV_T10 = { S: S, L: L, acao: function (a) { acao(a, document.body); }, render: render2, tick: function () { tickMapa(true); } };
  addEventListener('resize', escalar);
  escalar();
  render2();
  if (window.ouvir) {
    ouvir('estado', function () { if (S.tela === 'mapa') tickMapa(false); else if (S.tela === 'inicio' && !S.dlg && !S.metodoDlg) { var c = conectado(); if (S.conexao !== c) { S.conexao = c; render2(); } } });
    ouvir('quadro', function () { if (S.tela === 'mapa' && !S.arrasto) tickMapa(false); });
    ouvir('conexao', function (vivo) { S.conexao = vivo; if (S.tela === 'inicio') render2(); else tickMapa(true); });
  }
  setInterval(function () { if (S.tela === 'mapa') tickMapa(false); }, 250);
  /* o app do T25/T50 por baixo manda o demarcacao do metodo escolhido aqui */
})();
