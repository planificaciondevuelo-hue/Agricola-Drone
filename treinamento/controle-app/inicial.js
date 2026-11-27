/* ==========================================================================
   Tela inicial: cartões, "T25 conectado" e Começar.
   ========================================================================== */
"use strict";

function nomeDrone() {
  var m = APP.E && APP.E.m;
  return m && m.tanque && m.tanque < 30 ? "T25" : "T50";
}

function atualizarInicial() {
  var e = $("#estado-conexao");
  if (APP.conectado) {
    e.innerHTML = ic("i-ok") + "<span>" + nomeDrone() + " conectado</span>";
  } else {
    e.innerHTML = '<span class="nao"></span><span>Aeronave desconectada</span>';
  }
}
ouvir("conexao", atualizarInicial);
atualizarInicial();

$("#bt-comecar").addEventListener("click", function () { mostrar("mapa"); });
$$("[data-extra]").forEach(function (b) {
  b.addEventListener("click", function () { if (window.abrirExtra) abrirExtra(b.dataset.extra); });
});
