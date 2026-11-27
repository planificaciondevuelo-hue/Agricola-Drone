/* Idioma compartilhado pelo site, simulador e aplicativo do controle.
   As chaves do protocolo e os valores dos formularios permanecem em portugues. */
(function () {
  "use strict";
  if (window.TPD_IDIOMAS) return;
  var catalogo = window.TPD_TRADUCOES || {};
  /* 21/11/2026: chinês adicionado para a versão beta de avaliação da XAG. Mapa próprio chave->texto (TPD_TRADUCOES_ZH,
     no fim do catalogo.js); onde não houver zh, cai no português original em vez de quebrar. Assim dá para traduzir aos poucos. */
  var catalogoZh = window.TPD_TRADUCOES_ZH || {};
  var CHAVE = "tpd_idioma", idioma = "pt";
  var idiomas = { pt: "pt-BR", en: "en", es: "es", zh: "zh-CN" };
  var originais = new WeakMap(), atributos = new WeakMap(), pendentes = new Set();
  var observador, agendado = false, seletor;
  function normalizar(v) { return typeof v === "string" ? v.toLowerCase().split(/[-_]/)[0] : ""; }
  function valido(v) { return Object.prototype.hasOwnProperty.call(idiomas, v); }
  try { idioma = normalizar(localStorage.getItem(CHAVE)) || "pt"; } catch (_) {}
  try {
    var pai = window.parent !== window && window.parent.TPD_IDIOMAS;
    if (pai) idioma = pai.atual();
    else {
      var parametro = normalizar(new URLSearchParams(location.search).get("lang"));
      if (valido(parametro)) idioma = parametro;
    }
  } catch (_) {}
  if (!valido(idioma)) idioma = "pt";
  function texto(s) {
    if (s == null || idioma === "pt") return s;
    var chave = String(s).replace(/\s+/g, " ").trim();
    if (idioma === "zh") {
      var z = Object.prototype.hasOwnProperty.call(catalogoZh, chave) ? catalogoZh[chave] : null;
      if (z != null) return String(s).replace(/\S[\s\S]*\S|\S/, function () { return z; });
      var sfz = /^(.*?)(\s*\(R[1-6]\)|[:：])$/.exec(chave);
      if (sfz && catalogoZh[sfz[1]]) return texto(sfz[1]) + sfz[2];
      return s;
    }
    var par = Object.prototype.hasOwnProperty.call(catalogo, chave) ? catalogo[chave] : null;
    if (Array.isArray(par)) return String(s).replace(/\S[\s\S]*\S|\S/, function () { return par[idioma === "en" ? 0 : 1]; });
    var regras = [
      [/^Remover (.+) da sua conta\? Ele não vai mais conectar\.$/, ["Remove $1 from your account? It will no longer connect.", "¿Eliminar $1 de tu cuenta? Ya no podrá conectarse."]],
      [/^Gerar um novo certificado vai ANULAR o certificado (.+)\. Continuar\?$/, ["Generating a new certificate will VOID certificate $1. Continue?", "Generar un nuevo certificado ANULARÁ el certificado $1. ¿Continuar?"]],
      [/^Retirar o mapa “(.+)”\?$/, ["Remove map “$1”?", "¿Retirar el mapa «$1»?"]],
      [/^Bloquear a conta de (.+)\? Ela não consegue mais entrar nem treinar\.(.*)$/, ["Block $1's account? They will no longer be able to sign in or train.$2", "¿Bloquear la cuenta de $1? Ya no podrá iniciar sesión ni entrenar.$2"]],
      [/^Modo (\d+)$/, ["Mode $1", "Modo $1"]],
      [/^(.+) conectado$/, ["$1 connected", "$1 conectado"]],
      [/^Este voo leva (.+)$/, ["This flight takes $1", "Este vuelo dura $1"]],
      [/^(\d+(?:[.,]\d+)?) minutos?$/, ["$1 minutes", "$1 minutos"]],
      [/^(\d+(?:[.,]\d+)?) horas?$/, ["$1 hours", "$1 horas"]],
      [/^inscrito\(a\) no CPF (\S+),$/, ["registered under CPF $1, ", "inscrito(a) con el CPF $1, "]],
      [/^Instituto de ensino: (.+)$/, ["Educational institution: $1", "Institución de enseñanza: $1"]],
      [/^Horas pagas treinadas: (.+) · Horas gratuitas treinadas: (.+) · Válidas para certificado: (.+)\.$/, ["Paid hours trained: $1 · Free hours trained: $2 · Valid for certificate: $3.", "Horas pagadas entrenadas: $1 · Horas gratuitas entrenadas: $2 · Válidas para certificado: $3."]],
      [/^O certificado fica disponível 7 dias depois da última compra de horas\. Na sua conta ele libera em (.+)\. Até lá você pode continuar treinando normalmente\.$/, ["The certificate becomes available 7 days after the last hour purchase. On your account it unlocks on $1. Until then you can keep training normally.", "El certificado está disponible 7 días después de la última compra de horas. En tu cuenta se libera el $1. Hasta entonces puedes seguir entrenando normalmente."]],
      [/^O certificado fica disponível 7 dias depois da última compra de horas: a partir de (.+)\.$/, ["The certificate becomes available 7 days after the last hour purchase: from $1.", "El certificado está disponible 7 días después de la última compra de horas: a partir del $1."]],
      [/^Nenhum certificado encontrado com o código (.+)\. Confira se digitou corretamente\.$/, ["No certificate found with code $1. Check that you typed it correctly.", "No se encontró ningún certificado con el código $1. Revisa si lo escribiste correctamente."]]
    ];
    for (var i = 0; i < regras.length; i++) {
      if (regras[i][0].test(chave)) return chave.replace(regras[i][0], regras[i][1][idioma === "en" ? 0 : 1]);
    }
    var sufixo = /^(.*?)(\s*\(R[1-6]\)|[:：])$/.exec(chave);
    if (sufixo && catalogo[sufixo[1]]) return texto(sufixo[1]) + sufixo[2];
    var oi = /^Olá, (.+)!$/.exec(chave);
    if (oi) return (idioma === "en" ? "Hello, " : "¡Hola, ") + oi[1] + "!";
    return s;
  }
  function ignorado(el) {
    return !el || !!el.closest("script,style,code,pre,textarea,[contenteditable]:not([contenteditable=false]),[translate=no],[data-sem-traducao]");
  }
  function traduzirNo(no) {
    if (no.nodeType !== 3 || ignorado(no.parentElement)) return;
    var el = no.parentElement;
    // O texto de OPTION sem value tambem e seu valor: preserve o protocolo.
    if (el.tagName === "OPTION" && !el.hasAttribute("value")) el.setAttribute("value", el.textContent);
    var salvo = originais.get(no);
    if (!salvo || no.nodeValue !== salvo.saida) salvo = { fonte: no.nodeValue, saida: null };
    var saida = texto(salvo.fonte);
    salvo.saida = saida;
    originais.set(no, salvo);
    if (no.nodeValue !== saida) no.nodeValue = saida;
  }
  function traduzirAtributos(el) {
    if (ignorado(el)) return;
    var registro = atributos.get(el) || {};
    ["title", "placeholder", "aria-label", "alt"].forEach(function (nome) {
      if (!el.hasAttribute(nome)) { delete registro[nome]; return; }
      var atual = el.getAttribute(nome), salvo = registro[nome];
      if (!salvo || atual !== salvo.saida) salvo = { fonte: atual, saida: null };
      salvo.saida = texto(salvo.fonte);
      registro[nome] = salvo;
      if (atual !== salvo.saida) el.setAttribute(nome, salvo.saida);
    });
    atributos.set(el, registro);
  }
  function traduzir(raiz) {
    if (!raiz || !raiz.isConnected) return;
    if (raiz.nodeType === 3) { traduzirNo(raiz); return; }
    if (raiz.nodeType !== 1 || ignorado(raiz)) return;
    traduzirAtributos(raiz);
    var walker = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var no;
    while ((no = walker.nextNode())) {
      if (no.nodeType === 3) traduzirNo(no);
      else traduzirAtributos(no);
    }
  }
  function propagar() {
    document.querySelectorAll("iframe").forEach(function (frame) {
      try {
        if (frame.contentWindow && frame.contentWindow.TPD_IDIOMAS)
          frame.contentWindow.TPD_IDIOMAS.definir(idioma, { local: true });
      } catch (_) {}
    });
  }
  function definir(v, opcoes) {
    v = normalizar(v);
    if (!valido(v)) return false;
    if (!(opcoes && opcoes.local)) {
      try {
        if (window.parent !== window && window.parent.TPD_IDIOMAS)
          return window.parent.TPD_IDIOMAS.definir(v);
      } catch (_) {}
    }
    var mudou = idioma !== v;
    idioma = v;
    try { if (localStorage.getItem(CHAVE) !== v) localStorage.setItem(CHAVE, v); } catch (_) {}
    document.documentElement.lang = idiomas[v];
    if (seletor) seletor.value = v;
    if (mudou) {
      traduzir(document.documentElement);
      propagar();
      window.dispatchEvent(new CustomEvent("tpd:idioma", { detail: { idioma: v } }));
    }
    return true;
  }
  function original(el) {
    if (!el) return "";
    var dono = el.ownerDocument && el.ownerDocument.defaultView;
    if (dono && dono !== window && dono.TPD_IDIOMAS) return dono.TPD_IDIOMAS.original(el);
    if (el.nodeType === 3) {
      var salvo = originais.get(el);
      return salvo && el.nodeValue === salvo.saida ? salvo.fonte : el.nodeValue;
    }
    return Array.prototype.map.call(el.childNodes, original).join("");
  }
  window.TPD_IDIOMAS = {
    original: original,
    alerta: function (mensagem) { window.alert(texto(mensagem)); },
    confirmar: function (mensagem) { return window.confirm(texto(mensagem)); },
    atual: function () { return idioma; },
    definir: definir,
    t: texto,
    locale: function () { return idiomas[idioma]; },
    receber: function (estado) {
      if (estado && valido(estado.idioma)) definir(estado.idioma, { local: true });
    },
    traduzir: function () { traduzir(document.documentElement); }
  };
  document.documentElement.lang = idiomas[idioma];
  try { localStorage.setItem(CHAVE, idioma); } catch (_) {}
  window.addEventListener("storage", function (e) { if (e.key === CHAVE) definir(e.newValue, { local: true }); });
  function iniciar() {
    // A escolha fica no site. Os controles recebem o idioma da sessao, sem seletor.
    var automatico = document.documentElement.hasAttribute("data-idioma-automatico");
    if (window.top === window && !automatico) {
      var barra = document.createElement("div");
      barra.id = "tpd-idiomas";
      barra.setAttribute("translate", "no");
      barra.innerHTML = '<label for="tpd-idioma">🌐 <span class="tpd-rotulo">Idioma / Language</span></label> <select id="tpd-idioma" aria-label="Idioma / Language / Idioma"><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select>';
      var estilo = document.createElement("style");
      estilo.textContent = "#tpd-idiomas{position:relative;z-index:10000;display:flex;align-items:center;justify-content:flex-end;gap:8px;box-sizing:border-box;width:100%;min-height:38px;padding:5px 16px;background:#0e1a14;color:#f3f7f1;font:14px/1.3 system-ui,sans-serif}#tpd-idiomas select{font:inherit;color:#f3f7f1;background:#1c3025;border:1px solid #73917d;border-radius:5px;padding:3px 7px;max-width:150px}body.tpd-idiomas-flutuante #tpd-idiomas{position:fixed;top:0;right:0;width:auto;border-radius:0 0 0 8px}@media(max-width:450px){#tpd-idiomas .tpd-rotulo{display:none}}@media print{#tpd-idiomas{display:none!important}}";
      if (document.querySelector("#palco,#app,#campo")) document.body.classList.add("tpd-idiomas-flutuante");
      document.head.appendChild(estilo);
      document.body.insertBefore(barra, document.body.firstChild);
      seletor = barra.querySelector("select");
      seletor.value = idioma;
      seletor.addEventListener("change", function () { definir(seletor.value); });
    }
    traduzir(document.documentElement);
    observador = new MutationObserver(function (mudancas) {
      mudancas.forEach(function (m) {
        if (m.type === "childList") m.addedNodes.forEach(function (n) { pendentes.add(n); });
        else pendentes.add(m.target);
      });
      if (agendado || !pendentes.size) return;
      agendado = true;
      queueMicrotask(function () {
        agendado = false;
        var lista = Array.from(pendentes); pendentes.clear();
        lista.forEach(traduzir);
      });
    });
    observador.observe(document.documentElement, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["title", "placeholder", "aria-label", "alt"] });
    document.addEventListener("load", function (e) { if (e.target.tagName === "IFRAME") propagar(); }, true);
    propagar();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
