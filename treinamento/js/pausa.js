/* Pausa da sessão: mantém os objetos do jogo e não recarrega os mapas. */
(function () {
  "use strict";
  if (window.PAUSA_SIM) return;
  try {
    if (window.parent !== window && window.parent.PAUSA_SIM) {
      window.PAUSA_SIM = window.parent.PAUSA_SIM;
      return;
    }
  } catch (_) {}
  var pausado = false, emOperacao = false, botao, painel, inicioPausa = 0, tempoPausado = 0;
  var api = window.PAUSA_SIM = {
    get pausado() { return pausado; },
    get emOperacao() { return emOperacao; },
    definirOperacao: function (valor) {
      valor = !!valor;
      if (valor === emOperacao) return;
      emOperacao = valor;
      if (botao) botao.hidden = pausado || !emOperacao;
      window.dispatchEvent(new CustomEvent("operacao-simulador", { detail: emOperacao }));
    },
    agora: function () { return (pausado ? inicioPausa : performance.now()) - tempoPausado; },
    definir: function (valor) {
      valor = !!valor;
      if (valor === pausado) return;
      if (valor) inicioPausa = performance.now();
      else tempoPausado += performance.now() - inicioPausa;
      pausado = valor;
      if (pausado) {
        visitar(window, function (j) {
          j.dispatchEvent(new j.Event("blur"));
          if (j.document.exitPointerLock) j.document.exitPointerLock();
        });
      }
      if (painel) painel.hidden = !pausado;
      if (botao) { botao.hidden = pausado || !emOperacao; if (!botao.hidden) botao.focus(); }
      if (pausado && painel) painel.querySelector("button").focus();
      window.dispatchEvent(new CustomEvent("pausa-simulador", { detail: pausado }));
    }
  };
  function visitar(j, acao) {
    try { acao(j); Array.from(j.frames).forEach(function (f) { visitar(f, acao); }); } catch (_) {}
  }
  function proteger(j) {
    if (j.__pausaProtegida) return;
    j.__pausaProtegida = true;
    j.PAUSA_SIM = api;
    ["keydown", "keypress", "pointerdown", "mousedown", "touchstart", "click", "dblclick", "wheel"].forEach(function (tipo) {
      j.addEventListener(tipo, function (e) {
        if (!pausado || (painel && painel.contains(e.target)) ||
            (e.target.closest && e.target.closest('#primeiro-voo-dialogo,#app-tela-dialogo,#retomada-carregando,#retomada-erro'))) return;
        e.preventDefault(); e.stopImmediatePropagation();
      }, { capture: true, passive: false });
    });
    j.document.addEventListener("load", function (e) {
      if (e.target.tagName === "IFRAME") visitar(e.target.contentWindow, proteger);
    }, true);
  }
  proteger(window);
  function montar() {
    var css = document.createElement("style");
    css.textContent = "#pausa-botao{position:fixed;right:12px;top:112px;z-index:2147483645}" +
      "#pausa-botao,#pausa-painel button{background:#63b23c;color:#0e1a14;border:1px solid #acd991;border-radius:10px;padding:12px 18px;font:600 16px 'Segoe UI',sans-serif;cursor:pointer}" +
      "#pausa-painel{position:fixed;inset:0;z-index:2147483646;background:rgba(8,15,11,.86);display:grid;place-items:center;color:#f3f7f1;font:16px 'Segoe UI',sans-serif;text-align:center;padding:20px}" +
      "#pausa-painel>div{max-width:460px;padding:28px;background:#17281f;border:1px solid #50674e;border-radius:16px}" +
      "#pausa-painel[hidden],#pausa-botao[hidden]{display:none!important}";
    document.head.appendChild(css);
    botao = document.createElement("button"); botao.id = "pausa-botao"; botao.type = "button"; botao.textContent = "Ⅱ Pausar";
    botao.hidden = pausado || !emOperacao;
    botao.onclick = function () { api.definir(true); };
    painel = document.createElement("div"); painel.id = "pausa-painel"; painel.hidden = true;
    painel.setAttribute("role", "dialog"); painel.setAttribute("aria-modal", "true"); painel.setAttribute("aria-labelledby", "pausa-titulo");
    painel.innerHTML = '<div><h2 id="pausa-titulo">Simulador pausado</h2><p>Suas horas não são descontadas durante a pausa.</p><p>O mapa e as aplicações ficam preservados. Mantenha esta página aberta para continuar de onde parou.</p><button type="button">Continuar treinamento</button></div>';
    painel.querySelector("button").onclick = function () { api.definir(false); };
    painel.addEventListener("keydown", function (e) {
      if (e.key === "Tab") { e.preventDefault(); painel.querySelector("button").focus(); }
      e.stopPropagation();
    });
    document.body.append(botao, painel);
    visitar(window, proteger);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montar); else montar();
})();
