/* ==========================================================================
   GNSS: O MAPA "ANDA" COM O TEMPO

   Pedido dele: na precisao GNSS (sem RTK) o mapa se desloca conforme passa
   o tempo, e tambem quando nao se calibra.

   Como e na pratica: a posicao que o GNSS da passeia uns metros ao longo
   dos minutos. O talhao gravado nao muda, mas a aeronave se acha num lugar
   em que nao esta: voa a rota certinha no mapa e, no chao, as passadas
   caem deslocadas - falha de um lado, aplicacao fora do outro. No app, o
   drone e o controle (ponto azul) aparecem fora de onde estao na foto.
   O conserto e o "Retificar a compensacao" (tela de execucao): as setas
   arrastam o talhao e a rota no mapa ate casar com a posicao de agora, e
   o Sim (R3) passa a valer no voo. Com o tempo, desloca de novo.

   O modelo:
     r(t)  erro do GNSS, em metros (x leste, z sul). Passeio que volta para
           perto do zero (Ornstein-Uhlenbeck): ~1,5 m por eixo, mudando ao
           longo de ~15 min. Comeca ja com um erro sorteado (o mapa foi
           feito em outra hora). Com RTK (P.xgRtk) o erro e de 2 cm.
     c     a compensacao que o piloto aplicou no Retificar.
     A aeronave mira cada ponto da rota em (ponto + c - r): voa onde o GNSS
     diz que o ponto esta. Com c = r, acerta.

   Mostrar no app: ponte.js soma r a posicao do drone e do operador que vai
   para o controle (xgGnss), e o talhao e a rota da tela de execucao
   (#xg-rota, menos drone/base) andam c (mais o que esta sendo ajustado).
   ========================================================================== */

window.GNSS = (function () {
  "use strict";

  var PASSO_M = 0.5;          // cada toque numa seta do Retificar

  /* Roda DENTRO do campo (toString + eval). */
  function instalarNoCampo() {
    if (window.xgGnss) return true;
    if (typeof passo !== "function" || typeof rota === "undefined") return false;

    var SIGMA = 1.5, TAU = 900;     // m por eixo; s (~15 min) para o erro mudar de cara
    function sorteio() {           // normal padrao (Box-Muller)
      var u = Math.random() || 1e-9, v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    var G = window.xgGnss = {
      r: { x: sorteio() * SIGMA, z: sorteio() * SIGMA },
      c: { x: 0, z: 0 },
      ajuste: { x: 0, z: 0 },     // o que esta sendo ajustado no painel, antes do Sim
      erro: function () {
        return P.xgRtk ? { x: 0, z: 0 } : this.r;
      },
    };

    var passoOriginal = passo;
    passo = function (dt) {
      /* o erro anda no tempo do voo (inclusive acelerado) */
      if (dt > 0) {
        var k = Math.exp(-dt / TAU), ruido = SIGMA * Math.sqrt(1 - k * k);
        G.r.x = G.r.x * k + ruido * sorteio();
        G.r.z = G.r.z * k + ruido * sorteio();
      }
      var e = G.erro();
      var sx = G.c.x - e.x, sz = G.c.z - e.z;
      if (Math.abs(sx) < 1e-4 && Math.abs(sz) < 1e-4) return passoOriginal(dt);
      /* a rota passa a ser a que o GNSS enxerga, so durante o passo: a tinta
         e as colisoes continuam no mundo de verdade */
      var vistos = [];
      for (var i = 0; i < rota.length; i++) {
        var p = rota[i] && rota[i].p;
        if (!p || vistos.indexOf(p) >= 0) continue;
        vistos.push(p); p[0] += sx; p[1] += sz;
      }
      try { return passoOriginal(dt); }
      finally { for (var j = 0; j < vistos.length; j++) { vistos[j][0] -= sx; vistos[j][1] -= sz; } }
    };
    return true;
  }

  function Gnss(ponte, quadro) {
    this.ponte = ponte;
    this.quadro = quadro;
    this.instalado = false;
    this.painelLigado = false;
  }

  Gnss.prototype.instalar = function () {
    if (!this.instalado) {
      var j = this.ponte && this.ponte.janela;
      if (!j) return false;
      try { this.instalado = j.eval("(" + instalarNoCampo.toString() + ")()") === true; }
      catch (e) { return false; }
    }
    this.ligarPainel();
    return this.instalado;
  };

  Gnss.prototype.g = function () {
    var j = this.ponte && this.ponte.janela;
    return j && j.xgGnss;
  };

  /* O painel "Retificar a compensacao" do controle: setas, Cancelar(R2) e
     Sim(R3). O controle so somava 0,1 no numero; aqui as setas mexem de
     verdade (cima = norte, que e o topo da foto, -z). */
  Gnss.prototype.ligarPainel = function () {
    if (this.painelLigado) return;
    var doc;
    try { doc = this.quadro.contentDocument; } catch (e) { return; }
    var painel = doc && doc.getElementById("painel-retificar");
    if (!painel) return;
    this.painelLigado = true;
    var self = this;
    var DIR = { cima: [0, -1], baixo: [0, 1], esq: [-1, 0], dir: [1, 0] };

    function mostrar() {
      var g = self.g(); if (!g) return;
      var v = doc.getElementById("valor-compensacao");
      if (v) v.textContent = Math.hypot(g.ajuste.x, g.ajuste.z).toFixed(1);
      self.moverTalhao();
    }
    var abrir = doc.getElementById("botao-retificar");
    if (abrir) abrir.addEventListener("click", function () {
      var g = self.g(); if (g) { g.ajuste.x = 0; g.ajuste.z = 0; } mostrar(); setTimeout(mostrar, 0);
    });
    Array.prototype.forEach.call(painel.querySelectorAll(".dpad .seta"), function (b) {
      var nome = ["cima", "baixo", "esq", "dir"].filter(function (n) { return b.classList.contains(n); })[0];
      if (!nome) return;
      /* depois do ouvinte do controle (que escreve 0,1 a mais): o numero certo e o daqui */
      b.addEventListener("click", function () {
        var g = self.g(); if (!g) return;
        g.ajuste.x += DIR[nome][0] * PASSO_M; g.ajuste.z += DIR[nome][1] * PASSO_M;
        mostrar();
        setTimeout(mostrar, 0);   // o controle escreve o numero dele por ultimo
      });
    });
    var sim = doc.getElementById("confirmar-retificar");
    if (sim) sim.addEventListener("click", function () {
      var g = self.g(); if (!g) return;
      g.c.x += g.ajuste.x; g.c.z += g.ajuste.z; g.ajuste.x = 0; g.ajuste.z = 0;
      self.moverTalhao();
    });
    var cancelar = doc.getElementById("cancelar-retificar");
    if (cancelar) cancelar.addEventListener("click", function () {
      var g = self.g(); if (!g) return;
      g.ajuste.x = 0; g.ajuste.z = 0; self.moverTalhao();
    });
  };

  /* O talhao e a rota da tela de execucao andam c + ajuste, em pixels do
     mapa (mesma escala do vinculo). O drone, a base e a linha do trecho em
     curso ficam onde estao: o drone ja vem na posicao que o GNSS diz. */
  var FICAM = { "xg-drone": 1, "xg-home": 1, "xg-parcial": 1 };
  Gnss.prototype.moverTalhao = function () {
    var g = this.g(), v = this.vinculo;
    var doc; try { doc = this.quadro.contentDocument; } catch (e) { return; }
    var camada = doc && doc.getElementById("xg-rota");
    if (!g || !v || !camada || typeof v.paraPixels !== "function") return;
    var mx = g.c.x + g.ajuste.x, mz = g.c.z + g.ajuste.z;
    var a = v.paraPixels({ x: 0, z: 0 }), b = v.paraPixels({ x: mx, z: mz });
    var mov = "translate(" + (b.x - a.x).toFixed(2) + " " + (b.y - a.y).toFixed(2) + ")";
    for (var k = 0; k < camada.children.length; k++) {
      var el = camada.children[k];
      if (FICAM[el.id]) continue;
      var base = el.getAttribute("data-xg-base");
      if (base === null) { base = el.getAttribute("transform") || ""; el.setAttribute("data-xg-base", base); }
      var t = (mov + " " + base).trim();
      if (el.getAttribute("transform") !== t) el.setAttribute("transform", t);
    }
  };

  /* chamado a cada ciclo do principal: a camada pode ter sido recriada */
  Gnss.prototype.ciclo = function () {
    if (!this.instalar()) return;
    this.moverTalhao();
  };

  return { criar: function (ponte, quadro) { return new Gnss(ponte, quadro); } };
})();
