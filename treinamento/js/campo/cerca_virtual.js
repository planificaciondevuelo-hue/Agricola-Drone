/* ==========================================================================
   CERCA VIRTUAL NOS MAPAS REAIS - 14/10/2026, pedido do Eduardo
   ("cerca virtual, nao pode passar da parte das fotos")

   Nos mapas feitos de fotos (cenario_real.js, cen.real.area), o campo
   completa o terreno do jogo ate o horizonte e dava para voar centenas de
   metros alem da area real. Aqui a aeronave fica presa ao retangulo das
   fotos (2 m para dentro da borda), em qualquer drone e em qualquer modo de
   voo: a cada quadro, antes de desenhar, a posicao e segurada na borda e a
   velocidade para fora e zerada (como um limite de voo do app). Um aviso
   aparece na tela quando ela encosta. Mapas do jogo (plano, mediano...)
   nao tem cerca.
   ========================================================================== */
(function () {
  "use strict";

  var MARGEM = 2;   // metros para dentro da borda das fotos

  /* roda DENTRO do campo (toString + eval): usa cen, drone, V e cena do jogo */
  function instalarNoCampo(margem) {
    if (window.__xgCercaInstalada) return true;
    if (typeof cen === "undefined" || typeof drone === "undefined" || typeof V === "undefined" || typeof cena === "undefined") return false;
    window.__xgCercaInstalada = true;
    window.xgCercaVirtual = function () {
      var a = cen && cen.real && cen.real.area;
      if (!a || !drone) return false;
      var p = drone.position, bateu = false;
      var x0 = a.x0 + margem, x1 = a.x0 + a.larg - margem, z0 = a.z0 + margem, z1 = a.z0 + a.prof - margem;
      if (p.x < x0) { p.x = x0; if (V.mvx < 0) V.mvx = 0; bateu = true; }
      if (p.x > x1) { p.x = x1; if (V.mvx > 0) V.mvx = 0; bateu = true; }
      if (p.z < z0) { p.z = z0; if (V.mvz < 0) V.mvz = 0; bateu = true; }
      if (p.z > z1) { p.z = z1; if (V.mvz > 0) V.mvz = 0; bateu = true; }
      if (bateu) window.__xgCercaEm = performance.now();
      return bateu;
    };
    var antes = cena.onBeforeRender;
    cena.onBeforeRender = function () {
      try { window.xgCercaVirtual(); } catch (e) { /* drone trocando */ }
      if (antes) antes.apply(this, arguments);
    };
    return true;
  }

  var aviso = null, ultimoAviso = 0;
  function avisar() {
    if (!aviso) {
      aviso = document.createElement("div");
      aviso.style.cssText = "position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:9002;padding:9px 16px;border-radius:10px;" +
        "background:rgba(160,30,20,.92);color:#fff;font:600 14px Asap,system-ui,sans-serif;pointer-events:none;text-align:center;max-width:90vw";
      aviso.textContent = "Limite do mapa: a aeronave não pode sair da área das fotos";
      document.body.appendChild(aviso);
    }
    aviso.style.display = "block";
    clearTimeout(avisar.t);
    avisar.t = setTimeout(function () { aviso.style.display = "none"; }, 2500);
  }

  setInterval(function () {
    var f = document.getElementById("campo");
    var j = f && f.contentWindow;
    if (!j) return;
    try {
      if (!j.__xgCercaInstalada) j.eval("(" + instalarNoCampo.toString() + ")(" + MARGEM + ")");
      var em = j.__xgCercaEm || 0;
      if (em && em !== ultimoAviso && j.performance.now() - em < 600) { ultimoAviso = em; avisar(); }
    } catch (e) { /* campo carregando ou de outro endereco */ }
  }, 300);
})();
