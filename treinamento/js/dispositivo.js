/* Interacao por toque no simulador, incluindo os controles em iframes.
   Tambem diz ao site que aparelho e este: <html data-dispositivo="oculos|celular|
   tablet|tv|computador"> e window.TPD_DISPOSITIVO. Nas paginas da conta, carregar
   com data-somente-tipo (so identifica, sem os ajustes de toque do simulador).
   Para testar: ?dispositivo=tv (vale na aba ate ?dispositivo=auto). */
(function () {
  "use strict";
  var n = navigator, ua = n.userAgent || "", raiz = document.documentElement;
  var script = document.currentScript;
  var ipad = /iPad/i.test(ua) || (/Mac/i.test(n.platform || "") && n.maxTouchPoints > 1);
  var tv = /SMART-TV|SmartTV|Tizen|Web0S|webOS|Android TV|GoogleTV|HbbTV/i.test(ua);
  var toque = n.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse) and (hover: none)").matches;
  var movel = !tv && (ipad || /Android|iPhone|iPod/i.test(ua) ||
    (n.userAgentData && n.userAgentData.mobile) || toque);
  var quest = /OculusBrowser|Meta Quest|Quest\/|Quest [23Pro]/i.test(ua);

  // O VR continua so no Quest (vr_campo.js); os outros oculos so ficam identificados.
  // Vision Pro se apresenta como iPad, mas o iPad nao tem navigator.xr.
  var OCULOS = [["quest", quest], ["pico", /PicoBrowser|Pico Neo|PICO \d/i],
    ["vive", /VIVE Browser|HTC_VIVE/i], ["vision-pro", ipad && "xr" in n],
    ["outro", /Wolvic|Mobile VR|\bVR Safari/i]];
  // Fire TV = AFTxx; Chromecast = CrKey. Console tambem e tela de TV.
  var TVS = [["samsung", /Tizen|SMART-TV/i], ["lg", /Web0S|webOS|NetCast/i],
    ["fire-tv", /\bAFT[A-Z]/], ["chromecast", /CrKey|Chromecast/i],
    ["android-tv", /Android ?TV|Google ?TV|BRAVIA|MiTV|MIBOX/i], ["roku", /Roku/i],
    ["hisense", /VIDAA/i],["philips", /NETTV/], ["console", /Xbox|PlayStation [345]/i],
    ["tv", /SmartTV|Smart TV|HbbTV|Opera TV/i]];
  function achar(lista) {
    for (var i = 0; i < lista.length; i++) {
      var t = lista[i][1];
      if (t === true || (t && t.test && t.test(ua))) return lista[i][0];
    }
    return "";
  }
  var detalhe = achar(OCULOS), tipo = detalhe ? "oculos" : "";
  if (!tipo && (detalhe = achar(TVS))) { tipo = "tv"; movel = false; }
  if (!tipo && movel) {
    // Android sem "Mobile" e tablet (regra do proprio Android); sem pista, a tela decide.
    var menorLado = Math.min(screen.width || 0, screen.height || 0);
    tipo = ipad || /Tablet|Silk\//i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ||
      (!/iPhone|iPod|Android/i.test(ua) && !(n.userAgentData && n.userAgentData.mobile) && menorLado >= 600)
      ? "tablet" : "celular";
  }
  // Notebook e PC de mesa nao se distinguem pelo navegador.
  if (!tipo) tipo = "computador";

  var forcado = "";
  try {
    forcado = new URLSearchParams(location.search).get("dispositivo") || sessionStorage.getItem("tpd_dispositivo") || "";
    if (forcado === "auto") { sessionStorage.removeItem("tpd_dispositivo"); forcado = ""; }
    else if (/^(oculos|celular|tablet|tv|computador)$/.test(forcado)) sessionStorage.setItem("tpd_dispositivo", forcado);
    else forcado = "";
  } catch (_) { forcado = ""; }
  if (forcado) { tipo = forcado; detalhe = "teste"; movel = tipo === "celular" || tipo === "tablet"; }

  raiz.setAttribute("data-dispositivo", tipo);
  if (detalhe) raiz.setAttribute("data-dispositivo-detalhe", detalhe);
  window.DISPOSITIVO_SIM = window.TPD_DISPOSITIVO = {
    tipo: tipo, detalhe: detalhe, movel: !!movel, quest: quest, toque: !!toque, forcado: !!forcado
  };
  if (script && script.hasAttribute("data-somente-tipo")) return;

  // Os iframes do simulador (campo, controle) recebem o mesmo atributo para o CSS deles.
  var marcados = new WeakSet();
  function marcar(j) {
    try {
      var d = j.document;
      d.documentElement.setAttribute("data-dispositivo", tipo);
      if (detalhe) d.documentElement.setAttribute("data-dispositivo-detalhe", detalhe);
      if (marcados.has(d)) return;
      marcados.add(d);
      d.addEventListener("load", function (e) {
        if (e.target.tagName === "IFRAME") marcar(e.target.contentWindow);
      }, true);
      Array.from(d.querySelectorAll("iframe")).forEach(function (f) { marcar(f.contentWindow); });
    } catch (_) { /* Iframes de outra origem administram a propria interface. */ }
  }
  marcar(window);
  if (!movel && !quest) return;

  var documentos = new WeakSet();
  var editaveis = 'input,textarea,[contenteditable]:not([contenteditable="false"])';
  function podeSelecionar(alvo) {
    if (alvo && alvo.nodeType !== 1) alvo = alvo.parentElement;
    return alvo && (alvo.isContentEditable || (alvo.closest && alvo.closest(editaveis)));
  }
  function preparar(j) {
    try {
      var d = j.document;
      if (documentos.has(d)) return;
      documentos.add(d);
      d.documentElement.classList.add("xg-dispositivo-movel");
      var css = d.createElement("style");
      css.id = "xg-toque-selecao";
      css.textContent =
        "html.xg-dispositivo-movel,html.xg-dispositivo-movel body *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}" +
        "html.xg-dispositivo-movel input,html.xg-dispositivo-movel textarea,html.xg-dispositivo-movel [contenteditable]:not([contenteditable='false']),html.xg-dispositivo-movel [contenteditable]:not([contenteditable='false']) *{-webkit-user-select:text!important;user-select:text!important;-webkit-touch-callout:default!important}" +
        "html.xg-dispositivo-movel #pausa-botao{width:44px;height:40px;padding:0;border-radius:8px;font-size:0;line-height:1;touch-action:manipulation}" +
        "html.xg-dispositivo-movel #pausa-botao::before{content:'Ⅱ';font:600 19px 'Segoe UI',sans-serif}" +
        "html.xg-dispositivo-movel #bar{position:fixed;left:var(--xg-barra-inicio,8px);right:8px;top:var(--xg-barra-topo,auto);bottom:8px;max-width:none;gap:4px;align-items:flex-start}" +
        "html.xg-dispositivo-movel.xg-barra-posicionada #bar{bottom:auto}" +
        "html.xg-dispositivo-movel #bar button,html.xg-dispositivo-movel #bar #vistas button{font-size:11px;line-height:1;height:30px;padding:0 7px;border-radius:6px;white-space:nowrap}" +
        "html.xg-dispositivo-movel #bar #vistas{border-radius:6px;flex-shrink:0}" +
        "html.xg-dispositivo-movel #bar #vistas button{border-radius:0}" +
        "html.xg-dispositivo-movel #xg-bt-teclas{left:8px!important;top:var(--xg-barra-topo,auto)!important;bottom:auto!important;width:62px;height:32px;padding:0 4px!important;font-size:11px!important;gap:3px!important;border-radius:6px!important;justify-content:center}";
      (d.head || d.documentElement).appendChild(css);
      // Nao cancelar touchstart/pointerdown: manches, mapa e campos continuam utilizaveis.
      ["selectstart", "contextmenu", "dragstart"].forEach(function (tipo) {
        d.addEventListener(tipo, function (e) { if (!podeSelecionar(e.target)) e.preventDefault(); }, true);
      });
      function limparSelecao() {
        var s = j.getSelection();
        if (s && !s.isCollapsed && !podeSelecionar(s.anchorNode) && !podeSelecionar(s.focusNode)) s.removeAllRanges();
      }
      d.addEventListener('selectionchange', limparSelecao);
      d.addEventListener('pointerdown', function(e) { if (!podeSelecionar(e.target)) limparSelecao(); }, true);
      // O app do RC Plus e criado dentro do iframe do controle depois da carga inicial.
      d.addEventListener("load", function (e) {
        if (e.target.tagName === "IFRAME") preparar(e.target.contentWindow);
      }, true);
      Array.from(d.querySelectorAll("iframe")).forEach(function (f) { preparar(f.contentWindow); });
    } catch (_) { /* Iframes de outra origem administram a propria interface. */ }
  }
  window.DISPOSITIVO_SIM.preparar = preparar;
  preparar(window);

  // A tela do app e a moldura usam rcCaixa: deslocar ambas juntas quando
  // a vista Controle em paisagem precisa reservar espaco para a barra.
  function instalarBarraNoCampo() {
    if (window.__xgBarraMovel) return true;
    if (!window.__xgPiloto || typeof layoutControle !== "function") return false;
    window.__xgBarraMovel = true;
    var original = layoutControle;
    layoutControle = function () {
      original();
      var b = document.getElementById("bar"), v = document.getElementById("vCtrl");
      if (!b || !v || v.hidden || getComputedStyle(v).display === "none") return;
      var c = rcCaixa, topo, escala;
      if (vista === "controle") {
        // Nesta vista a barra fica no rodape; reservar a area abaixo da moldura.
        var limite = innerHeight - Math.max(32, b.offsetHeight) - 14;
        if (c.y + c.h <= limite) return;
        escala = Math.min(1, (limite - 8) / c.h);
        topo = Math.max(8, limite - c.h * escala);
      } else {
        topo = b.offsetHeight + 14;
        if (c.y >= topo) return;
        escala = Math.min(1, (innerHeight - topo - 8) / c.h);
      }
      var x = (innerWidth - c.w * escala) / 2;
      c.sx = x + (c.sx - c.x) * escala; c.sy = topo + (c.sy - c.y) * escala;
      c.x = x; c.y = topo; c.w *= escala; c.h *= escala; c.sw *= escala; c.sh *= escala;
      Object.assign(document.getElementById("vCtrlRc").style, { left: c.x + "px", top: c.y + "px", width: c.w + "px", height: c.h + "px" });
      Object.assign(document.getElementById("tela").style, { left: c.sx + "px", top: c.sy + "px", width: c.sw + "px", height: c.sh + "px" });
    };
    return true;
  }
  var chaveBarra = "", campoBarra = null;
  function atualizarBarra() {
    try {
      var f = document.getElementById("campo"), j = f && f.contentWindow, d = j && j.document;
      var b = d && d.getElementById("bar"), rc = d && d.getElementById("vCtrlRc"), v = d && d.getElementById("vCtrl");
      if (!b || !rc || !v) return;
      var ap = document.getElementById("aparelho"), teclas = quest && ap && !ap.classList.contains("esconder");
      var raiz = d.documentElement;
      raiz.style.setProperty("--xg-barra-inicio", teclas ? "76px" : "8px");
      if (campoBarra !== j || !j.__xgBarraMovel) {
        if (j.eval("(" + instalarBarraNoCampo.toString() + ")()") !== true) return;
        campoBarra = j; chaveBarra = "";
      }
      var visivel = !v.hidden && j.getComputedStyle(v).display !== "none" && j.getComputedStyle(rc).visibility !== "hidden";
      var vistaControle = j.eval("vista === 'controle'");
      var chave = [innerWidth, innerHeight, b.offsetHeight, visivel, teclas, vistaControle, d.body.className].join("|");
      if (chave !== chaveBarra) { chaveBarra = chave; j.eval("layoutControle()"); }
      var h = Math.max(32, b.offsetHeight), topo = visivel && !vistaControle ? rc.getBoundingClientRect().top - h - 6 : j.innerHeight - h - 8;
      topo = Math.max(8, topo);
      raiz.style.setProperty("--xg-barra-topo", topo + "px");
      raiz.classList.add("xg-barra-posicionada");
      document.documentElement.style.setProperty("--xg-barra-topo", (f.getBoundingClientRect().top + topo) + "px");
    } catch (_) { /* campo ainda carregando */ }
  }
  window.addEventListener("resize", atualizarBarra);
  setInterval(atualizarBarra, 200);
})();
