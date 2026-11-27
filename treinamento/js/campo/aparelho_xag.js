/* ==========================================================================
   O APARELHO XAG FUNCIONANDO

   O vinculo_xag.js leva o mapa e a decolagem. Aqui entra o resto do que o
   operador faz com o aparelho na mao, com as funcoes dos manuais oficiais:

   SRC4 - controle com tela integrada (manual "Smart Remote Controller 4"):
     Pausa   toque curto: paira | segurar: retoma a operacao
     RTH     segurar: volta para casa
     Radar   liga/desliga o desvio de obstaculos
     FPV     troca para a camera da aeronave
     F1      botao giratorio: vazao | F2 botao giratorio: direcao da rota
     L / R   marcam e desfazem pontos (mapear voando) - sem funcao aqui ainda
     manches Modo 2 (esquerdo: subir/descer e guinada; direito: frente/tras
             e lados). Os dois para baixo, na diagonal: liga os motores.

   ACS4 (o dele) - portatil com o app no celular. Funcoes pelo manual do ACS2/P100 2022 (conferir no ACS4):
     ↑ / ↓   subir / descer | os dois segurados 3 s: decola a 2,5 m ou pousa
     ↶ / ↻   gira o nariz para a esquerda / direita
     manche  frente/tras e lados
     Pairar  toque curto: paira | segurar: volta ao voo autonomo
     RTH     segurar: volta para casa
     S       liga/desliga a pulverizacao
     Terreno toque duplo: liga/desliga o seguimento de terreno
     Vel- / Vel+  0,5 m/s por toque

   E na tela do app:
     - a ROTA DE VERDADE do campo desenhada no mapa do XAG One (o site
       desenhava linhas de enfeite), com a aeronave e o ponto de casa;
     - o painel de voo com bateria, calda, velocidade, altura e area
       aplicada, e os botoes Pausar / Retomar / Voltar para casa.

   Tudo que muda o voo roda DENTRO do campo, pelas funcoes dele (pairar pelo
   manual, iniciarRetorno, gerarRota). Nada no site do controle e editado:
   o que e dele sai por estilo e o que e nosso entra por fora do #phone.
   ========================================================================== */

window.APARELHO_XAG = (function () {
  "use strict";
  /* 21/11/2026 (Eduardo: "tudo onde mostra p60 e o p100 pro"): nome do drone no aplicativo XAG */
  var NOME_XAG = /[?&](modelo|drone)=p100pro(&|$)/.test((function () { try { return (window.parent !== window ? window.parent : window).location.search; } catch (e) { return location.search; } })()) ? "P100 Pro" : "P60H 2024";

  var NS = "http://www.w3.org/2000/svg";
  var SEGURAR_MS = 1000;
  var EM_ROTA = ["aplicando", "indo", "voltando", "subindo", "descendo", "pairando"];

  /* ------------------------------------------------ o que roda no campo

     Levado para dentro do jogo por toString + eval: nao pode usar nada
     deste arquivo. Embrulha gerarRota para a rota do campo seguir o que o
     aluno planejou no XAG One: direcao das passadas, zonas sem
     pulverizacao, ponto de entrada e o botao S. */
  function instalarNoCampo() {
    if (window.xgRotaXag) return true;
    if (typeof gerarRota !== "function" || typeof mapaAtual !== "function") return false;

    window.xgRotaXag = { angulo: 0, zonas: [], entrada: null, semPulverizar: false, faixa: null };
    var original = gerarRota;

    function girar(p, c, a) {
      var dx = p[0] - c[0], dz = p[1] - c[1], co = Math.cos(a), si = Math.sin(a);
      return [c[0] + dx * co - dz * si, c[1] + dx * si + dz * co];
    }

    function dentro(p, z) {
      var d = false;
      for (var i = 0, j = z.length - 1; i < z.length; j = i++) {
        if ((z[i][1] > p[1]) !== (z[j][1] > p[1]) &&
            p[0] < (z[j][0] - z[i][0]) * (p[1] - z[i][1]) / (z[j][1] - z[i][1]) + z[i][0]) d = !d;
      }
      return d;
    }

    /* corta um trecho de aplicacao onde ele passa por zona sem pulverizacao:
       a aeronave passa por cima, com o bico fechado */
    function cortarZonas(a, b, zonas) {
      var ts = [0, 1];
      zonas.forEach(function (z) {
        for (var i = 0; i < z.length; i++) {
          var p = z[i], q = z[(i + 1) % z.length];
          var d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]);
          if (Math.abs(d) < 1e-9) continue;
          var t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d;
          var u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d;
          if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
        }
      });
      ts.sort(function (x, y) { return x - y; });
      var saida = [];
      for (var k = 1; k < ts.length; k++) {
        if (ts[k] - ts[k - 1] < 1e-6) continue;
        var tm = (ts[k] + ts[k - 1]) / 2;
        var m = [a[0] + (b[0] - a[0]) * tm, a[1] + (b[1] - a[1]) * tm];
        var livre = !zonas.some(function (z) { return dentro(m, z); });
        saida.push({ p: [a[0] + (b[0] - a[0]) * ts[k], a[1] + (b[1] - a[1]) * ts[k]], aplica: livre });
      }
      return saida;
    }

    /* "Faixa de operacao" do XAG One (Rota No. i-j): so as passadas i a j.
       O campo traca passadas em X = minX + MARGEM_BORDA + faixa/2 + k*faixa;
       recortar o lote (ja girado) nas bordas certas deixa so essas. */
    /* o contorno puxado para dentro de d metros (cada lado anda d para
       dentro e os cantos sao a interseccao dos lados vizinhos) */
    function recuarPoligono(pts, d) {
      var area = 0, n = pts.length, linhas = [], r = [];
      for (var i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
      var s = area > 0 ? 1 : -1;
      for (var i2 = 0; i2 < n; i2++) {
        var a = pts[i2], b = pts[(i2 + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
        var nx = -dz / L * s, nz = dx / L * s;
        linhas.push([[a[0] + nx * d, a[1] + nz * d], [b[0] + nx * d, b[1] + nz * d]]);
      }
      for (var k = 0; k < n; k++) {
        var l1 = linhas[(k + n - 1) % n], l2 = linhas[k];
        var x1 = l1[0][0], y1 = l1[0][1], x2 = l1[1][0], y2 = l1[1][1], x3 = l2[0][0], y3 = l2[0][1], x4 = l2[1][0], y4 = l2[1][1];
        var den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (Math.abs(den) < 1e-9) { r.push(l2[0]); continue; }
        var t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
        r.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1)]);
      }
      return r;
    }

    function recortarFaixa(lim, f) {
      var xs = lim.map(function (p) { return p[0]; }), minX = Math.min.apply(null, xs);
      var passo = P.faixa, m = typeof MARGEM_BORDA === "number" ? MARGEM_BORDA : 2.5;
      var esq = minX + (f[0] - 1) * passo, dir = minX + 2 * m + f[1] * passo;
      function corte(pts, x, manterMaior) {
        var r = [];
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i], q = pts[(i + 1) % pts.length];
          var pin = manterMaior ? p[0] >= x : p[0] <= x, qin = manterMaior ? q[0] >= x : q[0] <= x;
          if (pin) r.push(p);
          if (pin !== qin) { var t = (x - p[0]) / (q[0] - p[0]); r.push([x, p[1] + t * (q[1] - p[1])]); }
        }
        return r;
      }
      var r = f[0] > 1 ? corte(lim, esq, true) : lim;
      return r.length >= 3 ? corte(r, dir, false) : r;
    }

    gerarRota = function () {
      var X = window.xgRotaXag, M = mapaAtual();
      var a = (X.angulo || 0) * Math.PI / 180;
      var faixa = Array.isArray(X.faixa) && X.faixa.length === 2 ? X.faixa : null;

      if (M && (a || faixa)) {
        var c = M.limite.reduce(function (s, p) {
          return [s[0] + p[0] / M.limite.length, s[1] + p[1] / M.limite.length];
        }, [0, 0]);
        var limGirado = M.limite.map(function (p) { return girar(p, c, -a); });
        if (faixa) limGirado = recortarFaixa(limGirado, faixa);
        var girado = {
          pronto: M.pronto,
          limite: limGirado,
          obstaculos: M.obstaculos.map(function (o) {
            return o.tipo === "circulo"
              ? { tipo: o.tipo, c: girar(o.c, c, -a), r: o.r }
              : { tipo: o.tipo, pts: o.pts.map(function (p) { return girar(p, c, -a); }) };
          }),
        };
        var mapaDeVerdade = mapaAtual;
        mapaAtual = function () { return girado; };
        try { original(); } finally { mapaAtual = mapaDeVerdade; }
        rota.forEach(function (w) { w.p = girar(w.p, c, a); });
      } else {
        original();
      }

      /* "Aplicacao na borda": uma volta pelo contorno, a MARGEM_BORDA do
         limite, antes das passadas; comeca no canto mais perto da rota */
      if (X.borda && M && rota.length) {
        var contorno = recuarPoligono(M.limite, typeof MARGEM_BORDA === "number" ? MARGEM_BORDA : 2.5);
        if (contorno.length >= 3) {
          var ini = rota[0].p, k0 = 0, dmin = Infinity;
          contorno.forEach(function (p, k) { var d = Math.hypot(p[0] - ini[0], p[1] - ini[1]); if (d < dmin) { dmin = d; k0 = k; } });
          var volta = [];
          for (var j = 0; j <= contorno.length; j++) volta.push({ p: contorno[(k0 + j) % contorno.length], aplica: j > 0, borda: true });
          rota = volta.concat(rota.map(function (w, n) { return n === 0 ? { p: w.p, aplica: false, alto: w.alto } : w; }));
        }
      }

      /* zonas sem pulverizacao */
      if (X.zonas.length && rota.length) {
        var nova = [rota[0]];
        for (var i = 1; i < rota.length; i++) {
          var w = rota[i];
          if (!w.aplica) { nova.push(w); continue; }
          cortarZonas(rota[i - 1].p, w.p, X.zonas).forEach(function (s) {
            nova.push({ p: s.p, aplica: s.aplica });
          });
        }
        rota = nova;
      }

      /* ponto de entrada: comeca pela ponta da rota mais perto dele */
      if (X.entrada && rota.length > 1) {
        var e = X.entrada, ini = rota[0].p, fim = rota[rota.length - 1].p;
        if (Math.hypot(fim[0] - e[0], fim[1] - e[1]) < Math.hypot(ini[0] - e[0], ini[1] - e[1])) {
          var invertida = [];
          for (var k = rota.length - 1; k >= 0; k--) {
            invertida.push({ p: rota[k].p, aplica: k + 1 < rota.length ? rota[k + 1].aplica : false,
                             alto: rota[k].alto });
          }
          rota = invertida;
        }
      }

      rota.forEach(function (w) { w.xgAplica = w.aplica; });
      if (X.semPulverizar) rota.forEach(function (w) { w.aplica = false; });
    };
    return true;
  }

  /* --------------------------------------------------------- o aparelho */

  function Aparelho(ponte, quadro, vinculo, manual) {
    this.ponte = ponte;
    this.quadro = quadro;
    this.vinculo = vinculo;
    this.manual = manual;
    this.instaladoNoCampo = false;
    this.comandos = { esq: { x: 0, y: 0 }, dir: { x: 0, y: 0 } };
    this.subidaAuto = null;
    this.voo = null;
    /* direcao escolhida no F2: vale ate o aluno gerar a rota de novo no app */
    this.anguloDoF2 = null;
  }

  Aparelho.prototype.documento = function () {
    try { return this.quadro.contentDocument; } catch (e) { return null; }
  };

  Aparelho.prototype.instalar = function () {
    if (this.instaladoNoCampo) return true;
    var j = this.ponte.janela;
    if (!j) return false;
    try {
      this.instaladoNoCampo = j.eval("(" + instalarNoCampo.toString() + ")()") === true;
    } catch (e) { this.instaladoNoCampo = false; }
    return this.instaladoNoCampo;
  };

  /* O planejamento do app vale para a rota do campo. Chamado pelo vinculo
     sempre que o talhao atravessa (Salvar, Gerar rota, Iniciar). */
  Aparelho.prototype.configurarRota = function (salvo, paraMetros) {
    if (!this.instalar() || !salvo) return;
    var zonas = (salvo.zones || []).map(function (z) {
      if (z.length === 2) {       // retangulo: o app guarda so dois cantos
        z = [z[0], [z[1][0], z[0][1]], z[1], [z[0][0], z[1][1]]];
      }
      return z.map(function (p) { return paraMetros(p[0], p[1]); });
    }).filter(function (z) { return z.length >= 3; });

    var cfg = {
      /* o app desenha 20° como passadas norte-sul e gira no sentido horario */
      angulo: this.anguloDoF2 !== null ? this.anguloDoF2
            : salvo.route ? Number(salvo.angle || 20) - 20 : 0,
      zonas: zonas,
      entrada: salvo.opEntry ? paraMetros(salvo.opEntry[0], salvo.opEntry[1])
             /* ou o ultimo ponto de seguranca das configuracoes de operacao */
             : (salvo.xpPlano && Array.isArray(salvo.xpPlano.pontos) && salvo.xpPlano.pontos.length
                ? paraMetros(salvo.xpPlano.pontos[salvo.xpPlano.pontos.length - 1][0], salvo.xpPlano.pontos[salvo.xpPlano.pontos.length - 1][1]) : null),
      /* "Faixa de operacao" (xag_parametros.js): passadas i a j */
      borda: !!(salvo.xpPlano && salvo.xpPlano.borda),
      lote: chaveDoLote(salvo),
      faixa: salvo.route && salvo.xpPlano && Array.isArray(salvo.xpPlano.faixa) &&
             salvo.xpPlano.faixa.length === 2 && salvo.xpPlano.faixa.every(function (n) { return n >= 1; })
             ? [Math.round(salvo.xpPlano.faixa[0]), Math.round(salvo.xpPlano.faixa[1])] : null,
    };
    this.ponte.rodar(
      "(function(){ var c = " + JSON.stringify(cfg) + ";" +
      "  xgRotaXag.angulo = c.angulo; xgRotaXag.zonas = c.zonas; xgRotaXag.entrada = c.entrada;" +
      "  xgRotaXag.faixa = c.faixa; xgRotaXag.borda = c.borda; xgRotaXag.lote = c.lote;" +
      "})()"
    );
    if (salvo.route && salvo.spacing > 0) this.ponte.definirParametros({ faixa: Number(salvo.spacing) });
  };

  /* ------------------------------------------------------ acoes de voo */

  Aparelho.prototype.estadoDoVoo = function () {
    return this.ponte.ler("typeof V!=='undefined' ? V.estado : ''") || "";
  };

  Aparelho.prototype.pairar = function () {
    var est = this.estadoDoVoo();
    if (EM_ROTA.indexOf(est) === -1) { this.avisar(est === "manual" ? "Pairando." : "A aeronave não está em voo."); return; }
    /* pairar = passar para o manual com os manches no centro: e o que o
       aparelho faz, e de onde o Retomar sabe voltar */
    this.ponte.rodar(
      "if (V.estado !== 'caiu') {" +
      "  V.retomar = (V.estado === 'aplicando' || !V.retomar) ? pontoAtual() : V.retomar;" +
      "  V.xgAntesPausa = V.estado; V.xgPausaEm = [drone.position.x, drone.position.z];" +
      "  V.estado = 'manual'; V.rodando = true; V.aplicando = false; V.mvx = 0; V.mvz = 0; V.vy = 0;" +
      "  if (typeof fecharAlerta === 'function') fecharAlerta();" +
      "}"
    );
    this.avisar("Pairando. Segure Pausa para retomar a operação.");
  };

  Aparelho.prototype.retomar = function () {
    var ok = this.ponte.ler(
      /* 08/10/2026: parado no mesmo ponto em que pairou, o XAG continua dali (nao
         sobe para a altura de deslocamento nem volta voando ao ponto); se o aluno
         levou a aeronave para outro lugar no manual, ai sim faz a volta */
      "(function(){ if (V.estado === 'manual' && V.retomar) { var d = drone.position, q = V.xgPausaEm, a = V.xgAntesPausa;" +
      "    var perto = q && Math.hypot(d.x - q[0], d.z - q[1]) < 3 && ['aplicando','indo','descendo','subindo'].indexOf(a) >= 0;" +
      "    V.estado = perto ? a : 'subindo'; V.rodando = true; V.xgAntesPausa = null; return true; }" +
      "  if (V.estado === 'pairando') { V.estado = V.antesPairar || 'indo'; V.rodando = true;" +
      "    if (typeof fecharAlerta === 'function') fecharAlerta(); return true; }" +
      "  return false; })()"
    );
    this.avisar(ok ? "Retomando a operação." : "Não há operação para retomar.");
  };

  /* Terminar operacao (menu ⋯ do voo, Eduardo 09/10/2026): a tarefa daquele
     mapa acaba e o andamento volta para o inicio. A aeronave para e fica
     pairando onde esta; volta com Voltar para casa ou pelo manual. */
  Aparelho.prototype.terminarOperacao = function () {
    this.ponte.rodar(
      "if (typeof V !== 'undefined' && V.estado !== 'caiu') {" +
      "  var noAr = ['em solo', 'reabastecendo', 'concluído'].indexOf(V.estado) < 0;" +
      "  V.retomar = null; V.xgAntesPausa = null; V.xgPausaEm = null; V.aplicando = false; V.i = 0;" +
      "  if (noAr) { V.estado = 'manual'; V.rodando = true; V.mvx = 0; V.mvz = 0; V.vy = 0; }" +
      "  if (typeof fecharAlerta === 'function') fecharAlerta();" +
      "}"
    );
    this.anterior = null;
    this.gravarAndamento(null);
    this.avisar("Operação terminada. O progresso deste mapa voltou para o início.");
    return true;
  };

  /* Continuar da base (09/10/2026): pousou para reabastecer no meio da tarefa;
     depois da confirmacao e do arrastar, decola com o que o ajudante deixou
     (nada enche sozinho) e volta para onde a tarefa parou, como no DJI. */
  Aparelho.prototype.continuarDaBase = function () {
    var ok = this.ponte.ler("(function(){ if (typeof V === 'undefined' || V.estado !== 'reabastecendo') return false;" +
      "  V.recargas = (V.recargas || 0) + 1; V.espera = 0; V.estado = 'subindo'; V.rodando = true;" +
      "  if (typeof fecharAlerta === 'function') fecharAlerta(); return true; })()");
    this.avisar(ok ? "Continuando a operação." : "A aeronave não está pousada para reabastecer.");
    return ok;
  };

  Aparelho.prototype.voltarParaCasa = function () {
    var ok = this.ponte.ler(
      "(function(){ var e = V.estado;" +
      "  if (e === 'manual') { iniciarRetorno(V.retomar || pontoAtual()); V.rodando = true; return true; }" +
      "  if (['aplicando','indo','pairando','subindo','descendo'].indexOf(e) >= 0) {" +
      "    iniciarRetorno(e === 'aplicando' || e === 'pairando' ? pontoAtual() : V.retomar); V.rodando = true; return true; }" +
      "  return e === 'voltando'; })()"
    );
    this.avisar(ok ? "Voltando para casa." : "A aeronave não está em voo.");
  };

  Aparelho.prototype.alternarRadar = function () {
    var ligado = this.ponte.ler("(function(){ P.desvio = !P.desvio; return P.desvio; })()");
    this.avisar("Desvio de obstáculos " + (ligado ? "ligado." : "desligado."));
  };

  Aparelho.prototype.alternarTerreno = function () {
    var ligado = this.ponte.ler("(function(){ P.estab = !P.estab; return P.estab; })()");
    this.avisar(ligado ? "Seguimento de terreno ligado." : "Altura pelo GPS (seguimento de terreno desligado).");
  };

  Aparelho.prototype.alternarPulverizacao = function () {
    var desligada = this.ponte.ler(
      "(function(){ var X = xgRotaXag; X.semPulverizar = !X.semPulverizar;" +
      "  if (typeof rota !== 'undefined') rota.forEach(function(w){" +
      "    if (w.xgAplica === undefined) w.xgAplica = w.aplica;" +
      "    w.aplica = X.semPulverizar ? false : w.xgAplica; });" +
      "  return X.semPulverizar; })()"
    );
    this.avisar(desligada ? "Pulverização desligada." : "Pulverização ligada.");
  };

  Aparelho.prototype.mudarVelocidade = function (passo) {
    var v = this.ponte.ler("(function(){ P.vel = Math.max(0.5, Math.min(T50.velMax, Math.round((P.vel + " +
                           passo + ") * 2) / 2)); return P.vel; })()");
    this.avisar("Velocidade " + String(v).replace(".", ",") + " m/s.");
  };

  /* altura da operacao durante o voo (painel de voo, "Ajustes da operacao") */
  Aparelho.prototype.mudarAltura = function (passo) {
    var v = this.ponte.ler("(function(){ P.altura = Math.max(1.5, Math.min(30, Math.round((P.altura + " +
                           passo + ") * 2) / 2)); return P.altura; })()");
    this.avisar("Altura " + String(v).replace(".", ",") + " m.");
  };

  Aparelho.prototype.mudarVazao = function (passo) {
    var v = this.ponte.ler("(function(){ P.vazao = Math.max(1, Math.round(P.vazao + " + passo +
                           ")); return P.vazao; })()");
    this.avisar("Vazão " + v + " L/ha.");
  };

  /* 18/11/2026 (Eduardo, testando o P60: "nao tem a opcao de alterar as gotas depois de iniciar a operacao"): tamanho de
     gota durante o voo, de 10 em 10 micra, dentro da faixa do atomizador (60 a 400). Vale na hora (P.gota do campo): o jato e
     a faixa mudam junto. */
  Aparelho.prototype.mudarGota = function (passo) {
    /* 18/11/2026: P.gota devolve a gota que o bico FAZ com a vazao de agora (voo_xag.js, item 6); pedir mais fina que isso nao muda nada */
    var r = this.ponte.ler("(function(){ var antes = Number(P.gota) || 150; P.gota = Math.max(60, Math.min(400, Math.round((antes + " + passo +
                           ") / 10) * 10)); return {g: P.gota, antes: antes, min: (window.xgVooXag && xgVooXag.gotaMin) || 60}; })()") || {};
    var v = r.g;
    this.avisar(passo < 0 && r.g === r.antes && r.g <= r.min && r.min > 60
      ? "Gota " + v + " μm: é a mais fina com esta vazão."
      : "Gota " + v + " μm.");
  };

  Aparelho.prototype.mudarDirecao = function (passo) {
    var est = this.estadoDoVoo();
    if (est !== "em solo" && est !== "concluído") {
      this.avisar("A direção da rota só muda com a aeronave no chão.");
      return;
    }
    var a = this.ponte.ler(
      "(function(){ xgRotaXag.angulo = ((xgRotaXag.angulo + " + passo + ") % 360 + 360) % 360;" +
      "  reiniciarVoo(); return xgRotaXag.angulo; })()"
    );
    this.anguloDoF2 = a;
    this.avisar("Direção da rota " + Math.round(((a + 20) % 180 + 180) % 180) + "°.");
  };

  /* FPV: abre/fecha a camera do P60 na tela do app (xag_fpv.js); sem o
     modulo, cai na vista que segue o drone, como antes */
  Aparelho.prototype.verCameraDaAeronave = function () {
    var doc = this.documento(), j = doc && doc.defaultView;
    if (j && j.XAG_FPV) { j.XAG_FPV.alternar(); return; }
    this.ponte.rodar("definirVista('drone')");
  };

  /* ACS4: os dois botoes de altura segurados 3 s decolam (2,5 m) ou pousam */
  Aparelho.prototype.decolarOuPousar = function () {
    var est = this.estadoDoVoo();
    if (!this.manual) return;
    if (est === "em solo" || est === "concluído") {
      this.manual.ligarMotores();
      this.subidaAuto = { alvo: 2.5, sobe: true };
      this.avisar("Decolando: a aeronave sobe e paira a 2,5 m.");
    } else {
      if (EM_ROTA.indexOf(est) >= 0) this.pairar();
      this.subidaAuto = { sobe: false };
      this.avisar("Pousando.");
    }

    /* a altura e conferida de perto enquanto sobe ou desce: no ciclo da
       guia (400 ms) a aeronave passava do ponto */
    var self = this;
    clearInterval(this.relogioSubida);
    this.relogioSubida = setInterval(function () {
      if (!self.subidaAuto) { clearInterval(self.relogioSubida); return; }
      self.cuidarDaSubida(self.ponte.ler(
        "({estado: V.estado, alturaSolo: drone.position.y - alt(drone.position.x, drone.position.z), vy: V.vy || 0})"
      ));
    }, 40);
  };

  /* ------------------------------------------- Centro Rapido (testes)

     Relatorio do SRC4 (05/10/2026, 15_operacao, tela 173): Teste de marcha
     lenta, Teste de RevoSpray manual, Escorra o liquido restante e, no
     Sistema de Propulsao, Teste parado e Teste de voo in situ. Tudo no
     chao, pelo mesmo voo manual: motores ligados sem subir, a bomba do
     esgotamento (manual.js) e a decolagem de 2,5 m do ACS4. Quem chama e o
     app (xag_servicos.js), pelo vinculo no PC ou pelo celular_xag.js. */
  Aparelho.prototype.noChao = function () {
    return this.ponte.ler("typeof V!=='undefined' && V.estado!=='caiu' && drone.position.y <= alt(drone.position.x, drone.position.z) + 0.05") === true;
  };
  Aparelho.prototype.testeLivre = function () {
    if (!this.manual) return "sem-manual";
    if (!this.noChao()) { this.avisar("Pouse a aeronave antes do teste."); return "voando"; }
    return "";
  };
  Aparelho.prototype.testeMarchaLenta = function (seg) {
    var motivo = this.testeLivre();
    if (motivo) return motivo;
    this.pararTeste();
    this.manual.ligarMotores();
    if (this.estadoDoVoo() !== "manual") return "recusado";       // gente perto: o app nao liga
    var self = this;
    this.testeAtual = "marcha";
    this.relogioTeste = setTimeout(function () { self.pararTeste(); }, (seg || 5) * 1000);
    this.avisar("Teste de marcha lenta: hélices girando devagar.");
    return "ok";
  };
  Aparelho.prototype.testePulverizacao = function (seg) {
    var motivo = this.testeLivre();
    if (motivo) return motivo;
    if (this.ponte.ler("V.tan > 0") !== true) { this.avisar("Tanque vazio."); return "vazio"; }
    this.pararTeste();
    this.manual.esgotarSistema();
    var self = this;
    this.testeAtual = "spray";
    this.relogioTeste = setTimeout(function () { self.pararTeste(); }, (seg || 10) * 1000);
    return "ok";
  };
  Aparelho.prototype.escorrer = function () {
    var motivo = this.testeLivre();
    if (motivo) return motivo;
    if (this.ponte.ler("V.tan > 0") !== true) { this.avisar("Tanque vazio."); return "vazio"; }
    this.pararTeste();
    this.manual.esgotarSistema();
    this.testeAtual = "escorrer";
    return "ok";
  };
  Aparelho.prototype.testeVooInSitu = function () {
    var motivo = this.testeLivre();
    if (motivo) return motivo;
    this.pararTeste();
    this.decolarOuPousar();                                       // sobe e paira a 2,5 m
    if (!this.subidaAuto) return "recusado";
    var self = this;
    this.testeAtual = "in-situ";
    this.relogioTeste = setTimeout(function () {
      if (self.testeAtual === "in-situ") self.decolarOuPousar();    // e pousa
      self.testeAtual = null;
    }, 8000);
    return "ok";
  };
  Aparelho.prototype.pararTeste = function () {
    clearTimeout(this.relogioTeste);
    var era = this.testeAtual;
    this.testeAtual = null;
    this.ponte.rodar("if (window.xgPulvManual) xgPulvManual.esgotar = false;");
    if (era === "marcha") {
      this.ponte.rodar(
        "if (V.estado === 'manual' && drone.position.y <= alt(drone.position.x, drone.position.z) + 0.05) {" +
        "  V.estado = 'em solo'; V.rodando = false; V.v = 0; V.vy = 0; V.mvx = 0; V.mvz = 0; }");
    }
    return "ok";
  };
  /* para o app: o teste em curso (o esgotamento acaba sozinho com o tanque seco) */
  Aparelho.prototype.testeEmCurso = function () {
    if (this.testeAtual === "escorrer" && this.ponte.ler("!!(window.xgPulvManual && xgPulvManual.esgotar)") !== true) this.testeAtual = null;
    return this.testeAtual || null;
  };

  /* ----------------------------------------------------------- avisos */

  Aparelho.prototype.avisar = function (texto) {
    var el = this.camada("xg-aviso");
    if (!el) return;
    el.textContent = texto;
    el.hidden = !texto;
    clearTimeout(this.relogioAviso);
    this.relogioAviso = setTimeout(function () { el.hidden = true; }, 2600);
  };

  /* Os elementos nossos ficam FORA do #phone (o app refaz o #phone inteiro
     a cada toque), por cima dele, dentro da moldura da tela. */
  Aparelho.prototype.camada = function (id) {
    var doc = this.documento();
    if (!doc) return null;
    var el = doc.getElementById(id);
    if (el) return el;
    var moldura = doc.querySelector(".remote-screen-frame");
    if (!moldura) return null;
    el = doc.createElement("div");
    el.id = id;
    el.hidden = true;
    moldura.appendChild(el);
    return el;
  };

  /* -------------------------------------------------- ligar os botoes */

  Aparelho.prototype.prepararAparelho = function () {
    var doc = this.documento();
    if (!doc || !doc.body || doc.getElementById("xg-aparelho-estilo")) return;

    var estilo = doc.createElement("style");
    estilo.id = "xg-aparelho-estilo";
    estilo.textContent = [
      /* as linhas de enfeite do site saem; a rota de verdade entra */
      ".map-svg g[stroke='#f4d628']{display:none!important}",
      "[data-action='op-next']{display:none!important}",
      ".xg-botao{cursor:pointer;user-select:none;touch-action:none}",
      ".xg-botao:active{filter:brightness(1.6)}",
      ".hardware-buttons span.xg-botao{font-size:.62rem;font-weight:800;letter-spacing:.02em}",
      ".handheld-keys span.xg-botao{font-size:.66rem}",
      ".stick,.handheld-joystick{cursor:grab;touch-action:none}",
      "#xg-aviso{position:absolute;left:50%;top:56px;transform:translateX(-50%);z-index:40;",
      " background:#1f2a2ee8;color:#fff;border-radius:9px;padding:8px 14px;font-size:.8rem;",
      " font-weight:600;pointer-events:none;white-space:nowrap}",
      "#xg-voo{position:absolute;z-index:35;left:0;right:0;bottom:0;padding:10px;",
      " pointer-events:none;font-family:Inter,-apple-system,'Segoe UI',sans-serif}",
      "#xg-voo .xg-cartao{pointer-events:auto;background:#fffffff2;color:#172328;border-radius:12px;",
      " box-shadow:0 4px 18px #0004;padding:10px 12px;display:grid;gap:8px}",
      "#xg-voo .xg-topo{display:flex;justify-content:space-between;align-items:center;font-size:.78rem}",
      "#xg-voo .xg-topo b{font-size:.86rem}",
      "#xg-voo .xg-numeros{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;text-align:center}",
      "#xg-voo .xg-numeros div{background:#eef1f4;border-radius:8px;padding:5px 2px}",
      "#xg-voo .xg-numeros strong{display:block;font-size:.92rem}",
      "#xg-voo .xg-numeros span{font-size:.62rem;color:#5d6970}",
      "#xg-voo .xg-ajustes{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:6px}",
      "#xg-voo .xg-ajustes div{display:grid;grid-template-columns:22px 1fr 22px;grid-template-rows:auto auto;align-items:center;background:#eef1f4;border-radius:8px;padding:4px 5px;text-align:center}",
      "#xg-voo .xg-ajustes span{grid-column:1/4;font-size:.62rem;color:#5d6970}",
      "#xg-voo .xg-ajustes b{font-size:.85rem}",
      "#xg-voo .xg-ajustes button{width:22px;height:22px;padding:0;border:0;border-radius:50%;background:#fff;font-size:15px;line-height:1;cursor:pointer}",
      "#xg-voo .xg-botoes{display:flex;gap:6px}",
      "#xg-voo button{flex:1;border:0;border-radius:9px;padding:8px 6px;font:inherit;font-size:.78rem;",
      " font-weight:700;background:#e9eaee;color:#172328;cursor:pointer}",
      "#xg-voo button.xg-verde{background:#00a86b;color:#fff}",
      "#xg-voo button.xg-vermelho{background:#e0232e;color:#fff}",
      "#xg-voo.xg-recolhido .xg-numeros,#xg-voo.xg-recolhido .xg-botoes{display:none}",
      ".remote.handheld #xg-voo .xg-numeros{grid-template-columns:repeat(3,1fr)}",
    ].join("");
    doc.head.appendChild(estilo);
  };

  /* Liga os botoes do corpo do aparelho que estiver na tela. O site redesenha
     so o #phone; o corpo continua o mesmo, entao isto roda uma vez por
     carga do site (marca no proprio elemento). */
  Aparelho.prototype.ligarBotoes = function () {
    var doc = this.documento();
    if (!doc || !doc.body) return;
    var remoto = doc.getElementById("remote");
    if (!remoto || remoto.getAttribute("data-xg-botoes")) return;
    remoto.setAttribute("data-xg-botoes", "1");

    var self = this;
    var ladoEsq = doc.querySelectorAll(".remote-base .hardware-side")[0];
    var ladoDir = doc.querySelectorAll(".remote-base .hardware-side")[1];

    /* SRC4 -------------------------------------------------------------- */
    function rotular(lado, nomes) {
      if (!lado) return [];
      var caixa = lado.querySelector(".hardware-buttons");
      if (caixa) caixa.removeAttribute("aria-hidden");
      lado.removeAttribute("aria-hidden");
      var spans = lado.querySelectorAll(".hardware-buttons span");
      return nomes.map(function (n, i) {
        var s = spans[i];
        if (!s) return null;
        s.textContent = n.rotulo;
        s.title = n.titulo;
        s.className = "xg-botao";
        s.setAttribute("role", "button");
        return s;
      });
    }

    var esq = rotular(ladoEsq, [
      { rotulo: "RTH", titulo: "Segure para voltar para casa" },
      { rotulo: "Radar", titulo: "Liga/desliga o desvio de obstáculos" },
      { rotulo: "L", titulo: "Marca ponto ao mapear voando" },
      { rotulo: "F1", titulo: "Gire (roda do mouse) para a vazão" },
    ]);
    var dir = rotular(ladoDir, [
      { rotulo: "Pausa", titulo: "Toque: paira. Segure: retoma a operação" },
      { rotulo: "FPV", titulo: "Câmera da aeronave" },
      { rotulo: "R", titulo: "Desfaz ponto ao mapear voando" },
      { rotulo: "F2", titulo: "Gire (roda do mouse) para a direção da rota" },
    ]);

    segurar(esq[0], null, function () { self.voltarParaCasa(); }, "Segure o RTH para voltar para casa.");
    tocar(esq[1], function () { self.alternarRadar(); });
    tocar(esq[2], function () { self.avisar("L: marca pontos quando se mapeia voando com a aeronave."); });
    girar(esq[3], function (p) { self.mudarVazao(p); });
    segurar(dir[0], function () { self.pairar(); }, function () { self.retomar(); });
    tocar(dir[1], function () { self.verCameraDaAeronave(); });
    tocar(dir[2], function () { self.avisar("R: desfaz o último ponto marcado voando."); });
    girar(dir[3], function (p) { self.mudarDirecao(p * 5); });

    var manches = doc.querySelectorAll(".remote-base .stick");
    arrastar(manches[0], "esq");
    arrastar(manches[1], "dir");

    /* ACS4 -------------------------------------------------------------- */
    var corpo = doc.querySelector(".handheld-body");
    if (corpo) {
      corpo.removeAttribute("aria-hidden");
      var teclas = corpo.querySelectorAll(".handheld-keys:not(.bottom-keys) span");
      var nomes = [
        ["S", "Liga/desliga a pulverização"],
        ["Pairar", "Toque: paira. Segure: volta ao voo autônomo"],
        ["Terreno", "Dois toques: liga/desliga o seguimento de terreno"],
        ["RTH", "Segure para voltar para casa"],
        ["Vel −", "Diminui a velocidade"],
        ["Vel +", "Aumenta a velocidade"],
      ];
      for (var i = 0; i < teclas.length && i < nomes.length; i++) {
        teclas[i].textContent = nomes[i][0];
        teclas[i].title = nomes[i][1];
        teclas[i].className = "xg-botao";
        teclas[i].setAttribute("role", "button");
      }
      tocar(teclas[0], function () { self.alternarPulverizacao(); });
      segurar(teclas[1], function () { self.pairar(); }, function () { self.retomar(); });
      duploToque(teclas[2], function () { self.alternarTerreno(); },
                 function () { self.avisar("Toque duas vezes para trocar o seguimento de terreno."); });
      segurar(teclas[3], null, function () { self.voltarParaCasa(); }, "Segure o RTH para voltar para casa.");
      tocar(teclas[4], function () { self.mudarVelocidade(-0.5); });
      tocar(teclas[5], function () { self.mudarVelocidade(0.5); });

      var setas = corpo.querySelectorAll(".handheld-arrows span");
      var giro = corpo.querySelectorAll(".bottom-keys span");
      manter(setas[0], "esq", "y", 1, "↑", "Subir");
      manter(setas[1], "esq", "y", -1, "↓", "Descer");
      manter(giro[0], "esq", "x", -1, "↶", "Girar o nariz para a esquerda");
      manter(giro[1], "esq", "x", 1, "↻", "Girar o nariz para a direita");
      arrastar(corpo.querySelector(".handheld-joystick"), "dir");
    }

    /* ------------------------------------------------------ os gestos */

    function tocar(el, fn) {
      if (!el) return;
      el.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
    }

    /* toque curto e segurar fazem coisas diferentes, como no aparelho */
    function segurar(el, curto, longo, dicaCurta) {
      if (!el) return;
      var relogio = null, disparou = false;
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        disparou = false;
        clearTimeout(relogio);
        relogio = setTimeout(function () { disparou = true; longo(); }, SEGURAR_MS);
      });
      function soltar() {
        if (relogio === null) return;
        clearTimeout(relogio);
        relogio = null;
        if (disparou) return;
        if (curto) curto(); else if (dicaCurta) self.avisar(dicaCurta);
      }
      el.addEventListener("pointerup", soltar);
      el.addEventListener("pointerleave", function () { clearTimeout(relogio); relogio = null; });
    }

    function duploToque(el, duplo, simples) {
      if (!el) return;
      var ultimo = 0, relogio = null;
      el.addEventListener("click", function () {
        var agora = Date.now();
        if (agora - ultimo < 450) { clearTimeout(relogio); ultimo = 0; duplo(); return; }
        ultimo = agora;
        relogio = setTimeout(simples, 460);
      });
    }

    /* botao giratorio: a roda do mouse gira; clique +1, botao direito -1 */
    function girar(el, fn) {
      if (!el) return;
      el.addEventListener("wheel", function (e) { e.preventDefault(); fn(e.deltaY < 0 ? 1 : -1); }, { passive: false });
      el.addEventListener("click", function () { fn(1); });
      el.addEventListener("contextmenu", function (e) { e.preventDefault(); fn(-1); });
    }

    /* botao que vale enquanto esta apertado (setas e giro do ACS4) */
    var apertados = {};
    function manter(el, lado, eixo, valor, rotulo, titulo) {
      if (!el) return;
      el.textContent = rotulo;
      el.title = titulo;
      el.className = "xg-botao";
      el.setAttribute("role", "button");
      var chave = lado + eixo + valor;
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura */ }
        apertados[chave] = true;
        self.somarManches(apertados);
        self.conferirDecolagem(apertados);
      });
      function soltar() {
        apertados[chave] = false;
        self.somarManches(apertados);
        self.conferirDecolagem(apertados);
      }
      el.addEventListener("pointerup", soltar);
      el.addEventListener("pointercancel", soltar);
    }

    /* manche arrastado com o mouse: vai ate o fim do curso e volta ao
       centro quando solta, como a mola */
    function arrastar(el, lado) {
      if (!el) return;
      var CURSO = 9;
      function mover(e) {
        var r = el.getBoundingClientRect();
        var raio = Math.max(20, r.width / 2);
        var x = (e.clientX - (r.left + r.width / 2)) / raio;
        var y = -(e.clientY - (r.top + r.height / 2)) / raio;
        var n = Math.hypot(x, y);
        if (n > 1) { x /= n; y /= n; }
        self.comandos[lado] = { x: x, y: y };
        el.style.transform = "translate(" + (x * CURSO).toFixed(1) + "px," + (-y * CURSO).toFixed(1) + "px)";
        self.aplicarManches();
      }
      el.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura */ }
        el.xgArrastando = true;
        mover(e);
      });
      el.addEventListener("pointermove", function (e) { if (el.xgArrastando) mover(e); });
      function soltar() {
        el.xgArrastando = false;
        el.style.transform = "";
        self.comandos[lado] = { x: 0, y: 0 };
        self.aplicarManches();
      }
      el.addEventListener("pointerup", soltar);
      el.addEventListener("pointercancel", soltar);
    }
  };

  /* setas e giro do ACS4 viram o manche esquerdo (subir/descer e guinada) */
  Aparelho.prototype.somarManches = function (ap) {
    this.comandos.esq = {
      x: (ap["esqx1"] ? 1 : 0) - (ap["esqx-1"] ? 1 : 0),
      y: (ap["esqy1"] ? 1 : 0) - (ap["esqy-1"] ? 1 : 0),
    };
    this.aplicarManches();
  };

  Aparelho.prototype.conferirDecolagem = function (ap) {
    var self = this;
    clearTimeout(this.relogioDecolar);
    if (ap["esqy1"] && ap["esqy-1"]) {
      this.relogioDecolar = setTimeout(function () { self.decolarOuPousar(); }, 3000);
    }
  };

  /* Entrega os manches ao voo manual (manual.js), pelo mesmo canal do mouse
     no desenho do RC Plus: `manual.mouse`. */
  Aparelho.prototype.aplicarManches = function () {
    if (!this.manual) return;
    var c = this.comandos;
    /* os dois botoes de altura juntos sao o comando de decolar/pousar, nao
       "subir e descer ao mesmo tempo" */
    this.manual.mouse.esq = (c.esq.x || c.esq.y) ? { x: c.esq.x, y: c.esq.y } : null;
    this.manual.mouse.dir = (c.dir.x || c.dir.y) ? { x: c.dir.x, y: c.dir.y } : null;
  };

  /* decolagem e pouso automaticos do ACS4 */
  Aparelho.prototype.cuidarDaSubida = function (voo) {
    var s = this.subidaAuto;
    if (!s || !this.manual || !voo) return;
    if (s.sobe) {
      /* corta a subida antes, contando o que a aeronave ainda sobe por inercia */
      var freio = Math.max(0, voo.vy || 0) * 0.35;
      if (voo.estado === "manual" && voo.alturaSolo + freio < s.alvo) {
        this.manual.mouse.esq = { x: 0, y: 1 };
      } else if (voo.estado === "manual") {
        this.manual.mouse.esq = null;
        this.subidaAuto = null;
      }
    } else {
      if (voo.estado === "manual") this.manual.mouse.esq = { x: 0, y: -1 };
      if (voo.estado === "em solo") { this.manual.mouse.esq = null; this.subidaAuto = null; }
    }
  };

  /* ------------------------------------------------ a tela do app em voo */

  Aparelho.prototype.atualizar = function (estado) {
    this.instalar();
    this.prepararAparelho();
    this.ligarBotoes();
    var voo = estado && estado.voo;
    this.cuidarDaSubida(voo);
    this.acompanharAndamento(voo);
    this.sincronizarOperacao(voo);
    this.desenharNoMapa(estado);
    this.painelDeVoo(estado);
  };

  /* O app guarda "operacao em andamento" no navegador e, enquanto isso,
     esconde o Iniciar e mostra um passo a passo proprio (Etapa x/4). Quem
     manda e o voo: com a aeronave no chao, a operacao do app e encerrada
     pelo proprio botao dele (op-next ate o fim), o que tambem grava o
     registro da operacao no historico do app. */
  Aparelho.prototype.sincronizarOperacao = function (voo) {
    if (!voo || (voo.estado !== "em solo" && voo.estado !== "concluído")) return;
    var doc = this.documento();
    var proximo = doc && doc.querySelector('#phone [data-action="op-next"]');
    if (proximo) proximo.click();
  };

  /* A rota de verdade, a aeronave e o ponto de casa em todo mapa do app. */
  Aparelho.prototype.desenharNoMapa = function (estado) {
    var doc = this.documento();
    var foto = this.vinculo && this.vinculo.foto;
    if (!doc || !foto || !estado || !estado.drone) return;

    var salvo = this.vinculo.salvo() || {};
    var dono = this.ponte.ler("window.xgRotaXag ? xgRotaXag.lote : null");
    var doLote = !dono || dono === chaveDoLote(salvo);
    var rota = salvo.route && doLote ? this.ponte.ler(
      "typeof rota!=='undefined' ? rota.map(function(w){return [Math.round(w.p[0]*10)/10, Math.round(w.p[1]*10)/10, w.xgAplica===false||w.aplica===false?0:1]}) : []"
    ) || [] : [];

    function uv(x, z) {
      return [((x - foto.centro.x) / foto.larguraM + 0.5) * 100,
              ((z - foto.centro.z) / foto.alturaM + 0.5) * 100];
    }

    /* Como no XAG One: passada feita em AZUL (Eduardo, 09/10/2026), passada que falta em
       AMARELO, deslocamento em branco. `k` e o ponto da rota para onde a
       aeronave vai; fora da rota (pausa, retorno, manual) vale o ponto de
       onde ela vai retomar. A passada em curso e dividida na aeronave. */
    var andamento = this.ponte.ler(
      "(function(){ if(typeof V==='undefined') return null;" +
      "  var e = V.estado;" +
      "  if (e === 'concluído') return {k: 1e9};" +
      "  if (e === 'em solo') return {k: 0};" +
      "  if (e === 'aplicando' || e === 'indo') return {k: V.i, corte: [drone.position.x, drone.position.z], em: e === 'aplicando'};" +
      "  if (V.retomar) return {k: V.retomar.i, corte: V.retomar.p, em: true};" +
      "  return {k: V.i}; })()"
    ) || { k: 0 };

    /* Tarefa em andamento de outro dia (ou de antes de desligar o
       controle): o que ja tinha sido feito fica CINZA, e so o que a
       aeronave passar agora fica azul. */
    var ant = this.andamentoDaRota(rota);
    /* 19/11/2026 (Eduardo, com o video do mapa do controle durante a aplicacao: "como fica as cores e as linhas ali no controle"):
       no aplicativo o feito e uma faixa azul VIVA, quase sem transparencia, com a linha do voo em azul claro por cima; o que falta
       e uma linha amarela bem visivel; a troca de faixa e TRACEJADA (amarela enquanto falta, clara depois de feita); e a aeronave e
       uma seta rosada com o nome ao lado ("P60H 2024"). Antes: azul apagado, amarelo de meio pixel e ligacao sempre branca. */
    var CINZA = "#b9bfc4", AZUL = "#2384f5", AZUL_CLARO = "#58c4ff", AMARELO = "#f6e04a", LIGACAO_FEITA = "#eaf5ffd9";
    var partes = [], trilhas = [];
    function traco(a, b, cor, larg, tracejado) {
      return '<line x1="' + a[0].toFixed(2) + '" y1="' + a[1].toFixed(2) + '" x2="' + b[0].toFixed(2) +
             '" y2="' + b[1].toFixed(2) + '" stroke="' + cor + '" stroke-width="' + larg + '"' +
             (tracejado ? ' stroke-dasharray="' + tracejado + '"' : "") + ' vector-effect="non-scaling-stroke"/>';
    }
    function linha(a, b, cor, larg, tracejado) { partes.push(traco(a, b, cor, larg, tracejado)); }
    /* a linha do voo, em azul claro, por cima da faixa feita */
    function trilha(a, b) { trilhas.push(traco(a, b, AZUL_CLARO, "1")); }
    /* O feito nao e linha: e a FAIXA aplicada pintada de azul, da largura real
       da aplicacao (6,5 m a 3 m no P60), como no XAG One (Eduardo, 09/10/2026).
       A faixa e montada em metros e so depois passa para a tela. */
    var larguraFaixa = Number(this.ponte.ler("typeof larguraEfetiva === 'function' ? larguraEfetiva() : (P.faixa || 6.5)")) || 6.5;
    var faixas = [];
    function faixa(pa, pb) {
      var dx = pb[0] - pa[0], dz = pb[1] - pa[1], n = Math.hypot(dx, dz);
      if (n < 0.05) return;
      var ox = -dz / n * larguraFaixa / 2, oz = dx / n * larguraFaixa / 2;
      var cantos = [[pa[0] + ox, pa[1] + oz], [pb[0] + ox, pb[1] + oz], [pb[0] - ox, pb[1] - oz], [pa[0] - ox, pa[1] - oz]].map(function (q) { return uv(q[0], q[1]); });
      faixas.push('<polygon points="' + cantos.map(function (q) { return q[0].toFixed(2) + "," + q[1].toFixed(2); }).join(" ") + '" fill="' + AZUL + '" fill-opacity=".9"/>');
    }
    for (var i = 1; i < rota.length; i++) {
      var pa = [rota[i - 1][0], rota[i - 1][1]], pb = [rota[i][0], rota[i][1]];
      var a = uv(pa[0], pa[1]), b = uv(pb[0], pb[1]);
      if (!rota[i][2]) { linha(a, b, i < andamento.k ? LIGACAO_FEITA : AMARELO, "1.1", "4 3"); continue; }
      if (ant && i < ant.k) { linha(a, b, CINZA, ".8"); continue; }
      if (ant && i === ant.k && ant.corte && i <= andamento.k) {
        var mc = uv(ant.corte[0], ant.corte[1]);
        linha(a, mc, CINZA, ".8");
        a = mc; pa = ant.corte;
      }
      if (i < andamento.k) { faixa(pa, pb); trilha(a, b); continue; }
      if (i === andamento.k && andamento.em && andamento.corte) {
        var m = uv(andamento.corte[0], andamento.corte[1]);
        faixa(pa, andamento.corte);
        trilha(a, m);
        linha(m, b, AMARELO, "1.1");
        continue;
      }
      linha(a, b, AMARELO, "1.1");
    }
    partes = faixas.concat(trilhas, partes);   // a faixa por baixo, a linha do voo em cima dela e depois o resto

    var casa = estado.base ? uv(estado.base.x, estado.base.z) : null;
    var d = uv(estado.drone.x, estado.drone.z);
    /* rumo: frente em (cos, -sin) no campo; na tela x para a direita e z
       para baixo, entao o angulo na tela e -rumo */
    var graus = -estado.drone.rumo * 180 / Math.PI;
    var foto2 = foto.larguraM / foto.alturaM;     // o quadro 0-100 e esticado: desfaz no desenho

    var svgCasa = casa ? '<g transform="translate(' + casa[0].toFixed(2) + ' ' + casa[1].toFixed(2) +
      ') scale(1 ' + foto2.toFixed(3) + ')"><circle r="1.6" fill="#00a86b" stroke="#fff" stroke-width=".35"/>' +
      '<text y=".55" text-anchor="middle" font-size="1.6" font-weight="700" fill="#fff">H</text></g>' : "";
    var svgDrone = '<g transform="translate(' + d[0].toFixed(2) + ' ' + d[1].toFixed(2) + ') scale(1 ' +
      foto2.toFixed(3) + ') rotate(' + graus.toFixed(1) + ')"><polygon points="2.2,0 -1.4,1.4 -.7,0 -1.4,-1.4" ' +
      'fill="#dc3a63" stroke="#fff" stroke-width=".3"/></g>';
    /* o nome da aeronave ao lado da seta, como no aplicativo (a tela de antes do voo ja escreve o nome por conta propria) */
    var svgNome = '<g transform="translate(' + d[0].toFixed(2) + ' ' + d[1].toFixed(2) + ') scale(1 ' + foto2.toFixed(3) + ')">' +
      '<text x="0" y="5" text-anchor="middle" font-size="2.2" font-weight="600" fill="#fff" stroke="#000000a6" stroke-width=".45" ' +
      'paint-order="stroke" style="font-family:Roboto,Arial,sans-serif">' + NOME_XAG + '</text></g>';

    /* o ponto azul do XAG One: onde o celular/controle esta = o operador */
    var op = estado.operador ? uv(estado.operador.x, estado.operador.z) : null;
    var svgOperador = op ? '<g transform="translate(' + op[0].toFixed(2) + ' ' + op[1].toFixed(2) +
      ') scale(1 ' + foto2.toFixed(3) + ')"><circle r="2.2" fill="#1e88ff33"/>' +
      '<circle r="1.25" fill="#1e88ff" stroke="#fff" stroke-width=".4"/></g>' : "";

    var htmlRota = partes.join("") + svgCasa + svgOperador + svgDrone;

    /* A tela inicial do site nao desenha nada no mapa (mapSvg sai vazio no
       'home'). No XAG One o campo salvo aparece ali: limite branco, areas
       sem aplicacao em laranja e obstaculos em vermelho. */
    function poligono(pts, fundo, borda) {
      return '<polygon points="' + pts.map(function (p) { return p.join(","); }).join(" ") +
             '" fill="' + fundo + '" stroke="' + borda + '" stroke-width=".42" vector-effect="non-scaling-stroke"/>';
    }
    var campoSalvo = "";
    if (salvo.points && salvo.points.length >= 3) {
      campoSalvo = poligono(salvo.points, "#ffffff3b", "#fff");
      (salvo.zones || []).forEach(function (z) { if (z.length >= 3) campoSalvo += poligono(z, "#f3aa3655", "#f4a826"); });
      (salvo.obstaclePolygons || []).forEach(function (z) { if (z.length >= 3) campoSalvo += poligono(z, "#fa4a4a70", "#f63434"); });
    }

    var mapas = doc.querySelectorAll("#phone .map-svg");
    for (var k = 0; k < mapas.length; k++) {
      var html = (mapas[k].closest(".home-view") ? campoSalvo : "") + htmlRota + (mapas[k].closest(".xp-view") ? "" : svgNome);
      var g = mapas[k].querySelector("g[data-xg]");
      if (!g) {
        g = doc.createElementNS(NS, "g");
        g.setAttribute("data-xg", "1");
        g.setAttribute("pointer-events", "none");
        mapas[k].appendChild(g);
      }
      if (g.getAttribute("data-html") !== html) {
        g.innerHTML = html;
        g.setAttribute("data-html", html);
      }
    }
  };

  /* --------------------------------------------- tarefa em andamento

     O progresso da tarefa fica guardado no navegador, por rota (a mesma
     rota do mesmo talhao, com a mesma direcao e espacamento). Quando o
     aparelho e ligado - ou a pagina aberta outro dia -, o que estava feito
     vira o "de antes" (cinza) e, no Iniciar, a aeronave retoma dali. */
  var CHAVE_ANDAMENTO = "tpd_xag_andamento";
  /* o lote do app: o id da lista de terrenos (xag_mapeamento.js) ou, sem
     ele, o nome e o primeiro ponto */
  function chaveDoLote(s) {
    if (!s) return "";
    if (s.xmAtual) return String(s.xmAtual);
    var p = (s.points || [])[0];
    return "nome:" + (s.name || "") + (p ? ":" + Math.round(p[0] * 10) + "," + Math.round(p[1] * 10) : "");
  }

  function assinarRota(rota) {
    if (!rota || rota.length < 2) return "";
    var a = rota[0], b = rota[rota.length - 1];
    return [rota.length, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1])].join("|");
  }

  /* Cada mapa tem a sua aplicacao (como o DJI, 06/10/2026): o andamento
     fica guardado pelo lote aberto no XAG One; um lote nunca mostra o
     andamento nem a rota de outro. */
  Aparelho.prototype.chaveAndamento = function () {
    return CHAVE_ANDAMENTO + "@" + chaveDoLote(this.vinculo && this.vinculo.salvo ? this.vinculo.salvo() : null);
  };
  Aparelho.prototype.lerAndamento = function () {
    try { return JSON.parse(window.localStorage.getItem(this.chaveAndamento()) || "null"); }
    catch (e) { return null; }
  };

  Aparelho.prototype.gravarAndamento = function (a) {
    try {
      if (a) window.localStorage.setItem(this.chaveAndamento(), JSON.stringify(a));
      else window.localStorage.removeItem(this.chaveAndamento());
    } catch (e) { /* sem guardar */ }
  };

  /* O "de antes" desta rota, se houver (fotografado quando o aparelho
     ligou). */
  Aparelho.prototype.andamentoDaRota = function (rota) {
    var ant = this.anterior;
    if (!ant || !ant.k || ant.assinatura !== assinarRota(rota)) return null;
    return ant;
  };

  /* Chamado a cada ciclo: guarda ate onde a aeronave foi e, quando o
     aparelho liga, separa o que ja estava feito. */
  Aparelho.prototype.acompanharAndamento = function (voo) {
    var fase = this.vinculo && this.vinculo.faseDoAparelho ? this.vinculo.faseDoAparelho() : "pronto";
    var lote = this.chaveAndamento();
    /* 21/11/2026 (Eduardo: "xag nao tem opcao de tarefa em andamento"): o aplicativo do XAG nao retoma tarefa de antes de
       desligar o controle nem de outro dia. O "de antes" nunca mais e lido: cada Iniciar comeca a rota do comeco e o mapa
       so pinta de azul o que a aeronave fez neste voo. (A retomada depois de reabastecer, no mesmo voo, e do campo e continua.) */
    if ((fase === "pronto" && this.faseAntes !== "pronto") || lote !== this.loteAntes) this.anterior = null;
    this.faseAntes = fase; this.loteAntes = lote;
    if (!voo || !this.instaladoNoCampo) return;

    if (voo.estado === "concluído") { this.gravarAndamento(null); return; }

    var r = this.ponte.ler(
      "(function(){ if (typeof rota==='undefined' || rota.length < 2) return null;" +
      "  var e = V.estado, k = null, corte = null;" +
      "  if (e === 'aplicando') { k = V.i; corte = [drone.position.x, drone.position.z]; }" +
      "  else if (V.retomar && e !== 'em solo') { k = V.retomar.i; corte = V.retomar.p; }" +
      "  if (k === null) return null;" +
      "  var r = rota.map(function(w){ return [w.p[0], w.p[1]]; });" +
      "  return {k: k, corte: corte, rota: [r.length, r[0], r[r.length-1]]}; })()"
    );
    if (!r || !r.k) return;
    var assinatura = [r.rota[0], Math.round(r.rota[1][0]), Math.round(r.rota[1][1]),
                      Math.round(r.rota[2][0]), Math.round(r.rota[2][1])].join("|");
    var atual = this.lerAndamento();
    if (atual && atual.assinatura === assinatura && atual.k > r.k) return;   // nunca volta atras
    this.gravarAndamento({ assinatura: assinatura, k: r.k, corte: r.corte, quando: Date.now() });
  };

  /* No Iniciar de uma tarefa em andamento: a aeronave vai direto para o
     ponto onde parou, em vez de refazer o que ja esta cinza. */
  Aparelho.prototype.retomarTarefaEmAndamento = function () {
    var ant = this.anterior;
    if (!ant || !ant.k || !ant.corte) return false;
    return this.ponte.ler(
      "(function(){ var a = " + JSON.stringify(ant) + ";" +
      "  var r = rota.map(function(w){ return [w.p[0], w.p[1]]; });" +
      "  var s = [r.length, Math.round(r[0][0]), Math.round(r[0][1])," +
      "           Math.round(r[r.length-1][0]), Math.round(r[r.length-1][1])].join('|');" +
      "  if (s !== a.assinatura || a.k >= rota.length) return false;" +
      "  V.retomar = {p: a.corte, i: a.k}; return true; })()"
    ) === true;
  };

  var NOMES_DO_ESTADO = {
    subindo: "Subindo", indo: "Indo para a rota", aplicando: "Pulverizando", voltando: "Voltando para casa",
    descendo: "Descendo", pousando: "Pousando", pairando: "Pairando", manual: "Controle manual",
    reabastecendo: "Reabastecendo", "concluído": "Operação concluída", caiu: "Aeronave caiu",
  };

  /* O painel de voo do XAG One, com os numeros do campo. Aparece sozinho
     quando a aeronave sai do chao; "Recolher" deixa o mapa livre. */
  Aparelho.prototype.painelDeVoo = function (estado) {
    var voo = estado && estado.voo;
    var painel = this.camada("xg-voo");
    if (!painel) return;
    var doc = this.documento();
    var tela = doc.getElementById("phone");
    var ligado = doc.getElementById("remote") && doc.getElementById("remote").classList.contains("on");
    var noAr = voo && voo.estado && voo.estado !== "em solo";
    var portatil = doc.getElementById("remote").classList.contains("handheld");

    /* no integrado a tela so existe com o aparelho ligado; o celular do
       portatil funciona sozinho */
    if (!noAr || !tela || (!ligado && !portatil)) { painel.hidden = true; return; }
    /* 08/10/2026: no SRC4 (tela integrada) o voo usa os controles do aparelho
       (xag_fpv.js: Progresso com os tres risquinhos e Pairar / Continuar) */
    if (!portatil) { painel.hidden = true; return; }

    /* em cima da tela do app, sem sair dela */
    painel.style.left = tela.offsetLeft + "px";
    painel.style.width = tela.offsetWidth + "px";
    painel.style.top = "auto";
    painel.style.bottom = (tela.offsetParent.clientHeight - tela.offsetTop - tela.offsetHeight) + "px";
    painel.hidden = false;

    if (!painel.firstChild) {
      painel.innerHTML =
        '<div class="xg-cartao">' +
        '  <div class="xg-topo"><b data-v="estado"></b><span data-v="progresso"></span>' +
        '    <button type="button" data-xg="recolher" style="flex:0 0 auto;padding:4px 10px">Recolher</button></div>' +
        '  <div class="xg-numeros">' +
        '    <div><strong data-v="bateria"></strong><span>Bateria</span></div>' +
        '    <div><strong data-v="tanque"></strong><span>Calda</span></div>' +
        '    <div><strong data-v="velocidade"></strong><span>Velocidade</span></div>' +
        '    <div><strong data-v="altura"></strong><span>Altura</span></div>' +
        '    <div><strong data-v="area"></strong><span>Aplicado</span></div>' +
        '  </div>' +
        /* Ajustes da operacao durante o voo: valem na hora (P do campo) */
        '  <div class="xg-ajustes">' +
        '    <div><span>Altura</span><button type="button" data-xg="alt-">−</button><b data-v="aj-altura"></b><button type="button" data-xg="alt+">+</button></div>' +
        '    <div><span>Velocidade</span><button type="button" data-xg="vel-">−</button><b data-v="aj-vel"></b><button type="button" data-xg="vel+">+</button></div>' +
        '    <div><span>Dosagem</span><button type="button" data-xg="vaz-">−</button><b data-v="aj-vazao"></b><button type="button" data-xg="vaz+">+</button></div>' +
        '    <div><span>Gota</span><button type="button" data-xg="gota-">−</button><b data-v="aj-gota"></b><button type="button" data-xg="gota+">+</button></div>' +
        '  </div>' +
        '  <div class="xg-botoes">' +
        '    <button type="button" data-xg="pausar">Pausar</button>' +
        '    <button type="button" data-xg="retomar" class="xg-verde">Retomar</button>' +
        '    <button type="button" data-xg="casa" class="xg-vermelho">Voltar para casa</button>' +
        '  </div>' +
        '</div>';
      var self = this;
      painel.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-xg]");
        if (!b) return;
        var o = b.getAttribute("data-xg");
        if (o === "pausar") self.pairar();
        if (o === "retomar") self.retomar();
        if (o === "casa") self.voltarParaCasa();
        if (o === "alt-") self.mudarAltura(-0.5);
        if (o === "alt+") self.mudarAltura(0.5);
        if (o === "vel-") self.mudarVelocidade(-0.5);
        if (o === "vel+") self.mudarVelocidade(0.5);
        if (o === "vaz-") self.mudarVazao(-1);
        if (o === "vaz+") self.mudarVazao(1);
        if (o === "gota-") self.mudarGota(-10);
        if (o === "gota+") self.mudarGota(10);
        if (o === "recolher") {
          painel.classList.toggle("xg-recolhido");
          b.textContent = painel.classList.contains("xg-recolhido") ? "Abrir" : "Recolher";
        }
      });
    }

    function por(nome, texto) {
      var el = painel.querySelector('[data-v="' + nome + '"]');
      if (el && el.textContent !== texto) el.textContent = texto;
    }
    function n(v, casas) { return (Number(v) || 0).toFixed(casas).replace(".", ","); }

    var cob = estado.cobertura && typeof estado.cobertura.pct === "number" ? estado.cobertura.pct : null;
    por("estado", NOMES_DO_ESTADO[voo.estado] || voo.estado);
    por("progresso", cob !== null ? n(cob, 0) + "% do talhão" : "");
    por("bateria", n(voo.bateria, 0) + "%");
    por("tanque", n(voo.tanque, 1) + " L");
    por("velocidade", n(voo.velocidade, 1) + " m/s");
    por("altura", n(voo.alturaSolo, 1) + " m");
    por("area", n(voo.aplicadoHa, 2) + " ha");
    var aj = this.ponte.ler("({h: P.altura, v: P.vel, q: P.vazao, g: P.gota})") || {};
    por("aj-altura", n(aj.h, 1) + " m");
    por("aj-vel", n(aj.v, 1) + " m/s");
    por("aj-vazao", n(aj.q, 0) + " L/ha");
    por("aj-gota", n(aj.g || 150, 0) + " μm");
  };

  /* Sem sinal (voo_xag.js: arvore, casa ou morro entre o operador e a
     aeronave) os botoes e o app nao chegam ate ela. */
  Aparelho.prototype.semSinal = function () {
    return this.ponte.ler("window.xgVooXag ? xgVooXag.sinal === false : false") === true;
  };
  ["pairar", "retomar", "voltarParaCasa", "terminarOperacao", "continuarDaBase", "alternarRadar", "alternarTerreno", "alternarPulverizacao",
   "mudarVelocidade", "mudarVazao", "mudarAltura", "mudarGota", "mudarDirecao", "testeMarchaLenta", "testePulverizacao", "escorrer",
   "testeVooInSitu"].forEach(function (nome) {
    var original = Aparelho.prototype[nome];
    if (typeof original !== "function") return;
    Aparelho.prototype[nome] = function () {
      if (this.semSinal()) { this.avisar("Sem sinal com a aeronave."); return false; }
      return original.apply(this, arguments);
    };
  });

  return {
    criar: function (ponte, quadro, vinculo, manual) { return new Aparelho(ponte, quadro, vinculo, manual); },
  };
})();
