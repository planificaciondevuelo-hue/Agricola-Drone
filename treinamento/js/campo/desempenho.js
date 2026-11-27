/* ==========================================================================
   DESEMPENHO DO CAMPO 3D: tela grande e computador fraco

   O campo (treinamento/campo/index.html) desenha na resolucao inteira da
   janela, com sombra de 2048 px. Num monitor Full HD isso e leve; numa TV
   4K sao 8 milhoes de pontos por quadro, quatro vezes mais, e um notebook
   comum engasga. Este arquivo NAO edita o campo: mexe por fora (eval) em
   tres coisas que ja existem la - `render`, `sol` e `mundo`.

   1. TETO DE RESOLUCAO, sempre: o desenho nunca passa do tanto de pontos do
      nivel atual (1920 x 1080 no nivel "alta"). Em tela maior o navegador
      estica a imagem; a tela do aluno continua cheia.
   2. DEGRAUS AUTOMATICOS: se o campo ficar abaixo de 22 quadros por segundo
      por 6 segundos seguidos (ou abaixo de 12 por 3 segundos), desce um
      nivel: menos pontos, sombra menor ou desligada, capim mais ralo.
      Nao sobe sozinho de volta, para nao ficar oscilando.
   3. O nivel a que o computador chegou fica guardado (localStorage
      `tpd_qualidade`) e vale na proxima vez. `?q=alta|media|baixa|minima`
      na URL forca um nivel; `?q=auto` esquece o guardado.

   Para conferir no console:  xgDesempenho.estado()
   ========================================================================== */
(function () {
  "use strict";

  var NIVEIS = [
    { nome: "alta",   pontos: 1920 * 1080, sombra: 2048, ralo: 1 },
    { nome: "media",  pontos: 1600 * 900,  sombra: 1024, ralo: 1 },
    { nome: "baixa",  pontos: 1280 * 720,  sombra: 0,    ralo: 0.5 },
    { nome: "minima", pontos: 960 * 540,   sombra: 0,    ralo: 0.3 },
  ];
  var CHAVE = "tpd_qualidade";
  var FPS_BAIXO = 22, FPS_MUITO_BAIXO = 12, JANELA_MS = 3000, ESPERA_INICIAL_MS = 8000;

  var url = new URLSearchParams(location.search);
  var pedido = url.get("q");
  var janela = null, jogo = null;
  var nivel = 0, forcado = false, automatico = false;
  var medida = { fps: 0, lentas: 0 };

  function indiceDe(nome) {
    for (var i = 0; i < NIVEIS.length; i++) if (NIVEIS[i].nome === nome) return i;
    return -1;
  }

  function nivelInicial() {
    if (pedido === "auto") { try { localStorage.removeItem(CHAVE); } catch (e) { /* segue */ } return 0; }
    if (indiceDe(pedido) >= 0) { forcado = true; return indiceDe(pedido); }
    try {
      var g = indiceDe(localStorage.getItem(CHAVE));
      if (g >= 0) { automatico = true; return g; }
    } catch (e) { /* sem armazenamento */ }
    return 0;
  }

  /* fracao de pontos que cabe no teto do nivel; nunca acima da tela */
  function razao() {
    var w = Math.max(1, janela.innerWidth), h = Math.max(1, janela.innerHeight);
    var dpr = Math.min(2, janela.devicePixelRatio || 1);
    return Math.min(dpr, Math.sqrt(NIVEIS[nivel].pontos / (w * h)));
  }

  function ralear() {
    var f = NIVEIS[nivel].ralo;
    jogo.mundo.traverse(function (o) {
      if (!o.isInstancedMesh) return;
      if (o.userData.xgCheio == null) o.userData.xgCheio = o.count;
      if (o.userData.xgCheio > 300) o.count = Math.max(1, Math.round(o.userData.xgCheio * f));
    });
  }

  function aplicar() {
    if (jogo.render.xr && jogo.render.xr.isPresenting) return;
    var N = NIVEIS[nivel];
    try {
      jogo.render.setPixelRatio(razao());

      /* grafico novo (js/campo/graficos.js, 11/11/2026): ele decide o tamanho da sombra e raleia o proprio capim em cada nivel */
      var G = janela.XG_GRAFICOS, novo = !!(G && G.pronto);
      if (novo && G.nivel) G.nivel(N.nome);
      var tamanho = novo && N.sombra > 0 ? G.sombra : N.sombra;
      var sol = jogo.sol;
      if (sol && sol.shadow) {
        var liga = N.sombra > 0;
        if (sol.castShadow !== liga) sol.castShadow = liga;
        if (liga && sol.shadow.mapSize.x !== tamanho) {
          sol.shadow.mapSize.set(tamanho, tamanho);
          if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null; }
        }
      }
      ralear();
    } catch (e) {
      if (window.console) console.warn("[desempenho]", e);
    }
  }

  function descer(motivo) {
    if (forcado || nivel >= NIVEIS.length - 1) return false;
    nivel++;
    automatico = true;
    try { localStorage.setItem(CHAVE, NIVEIS[nivel].nome); } catch (e) { /* segue */ }
    aplicar();
    if (window.console) console.info("[desempenho] qualidade " + NIVEIS[nivel].nome + " (" + motivo + ")");
    return true;
  }

  /* conta os quadros que o navegador consegue entregar; aba escondida nao conta */
  function medir() {
    var inicio = janela.performance.now(), n = 0, liberado = inicio + ESPERA_INICIAL_MS;
    function quadro(agora) {
      janela.requestAnimationFrame(quadro);
      if (janela.document.hidden || (jogo.render.xr && jogo.render.xr.isPresenting)) { inicio = agora; n = 0; return; }
      n++;
      if (agora - inicio < JANELA_MS) return;
      medida.fps = n * 1000 / (agora - inicio);
      inicio = agora; n = 0;
      if (agora < liberado) return;            // carregando: nao conta
      if (medida.fps < FPS_MUITO_BAIXO) { medida.lentas = 0; if (descer("menos de " + FPS_MUITO_BAIXO + " quadros por segundo")) liberado = agora + JANELA_MS; return; }
      if (medida.fps < FPS_BAIXO) {
        if (++medida.lentas >= 2) { medida.lentas = 0; if (descer("menos de " + FPS_BAIXO + " quadros por segundo")) liberado = agora + JANELA_MS; }
      } else medida.lentas = 0;
    }
    janela.requestAnimationFrame(quadro);
  }

  function ligar() {
    nivel = nivelInicial();
    aplicar();
    /* o campo refaz o tamanho ao mudar a janela; o teto e recalculado logo depois */
    janela.addEventListener("resize", function () { setTimeout(aplicar, 0); });
    /* arrastar a janela do monitor para a TV muda os pontos por polegada sem
       avisar por "resize": confere de tempos em tempos e refaz o teto */
    var ultima = "";
    setInterval(function () {
      var chave = janela.innerWidth + "x" + janela.innerHeight + "@" + razao().toFixed(3) + (janela.XG_GRAFICOS && janela.XG_GRAFICOS.pronto ? "g" : "");
      if (chave !== ultima) { ultima = chave; aplicar(); }
    }, 2000);
    /* a mata e os modelos chegam depois (.glb): raleia de novo algumas vezes */
    var vezes = 0, t = setInterval(function () { try { ralear(); } catch (e) { /* segue */ } if (++vezes >= 6) clearInterval(t); }, 5000);
    medir();
  }

  function esperar() {
    var quadroCampo = document.getElementById("campo");
    var tentativas = 0;
    var t = setInterval(function () {
      if (++tentativas > 600) { clearInterval(t); return; }   // 5 min: desiste em silencio
      try {
        var j = quadroCampo && quadroCampo.contentWindow;
        if (!j || !j.eval) return;
        var achado = j.eval("(typeof render!=='undefined'&&typeof mundo!=='undefined'&&typeof sol!=='undefined')?{render:render,mundo:mundo,sol:sol}:null");
        if (!achado) return;
        clearInterval(t);
        janela = j; jogo = achado;
        ligar();
      } catch (e) { /* campo ainda carregando */ }
    }, 500);
  }

  window.xgDesempenho = {
    estado: function () {
      if (!jogo) return { pronto: false };
      var t = { x: 0, y: 0 };
      try { var v = new janela.THREE.Vector2(); jogo.render.getDrawingBufferSize(v); t = { x: v.x, y: v.y }; } catch (e) { /* segue */ }
      return {
        pronto: true, nivel: NIVEIS[nivel].nome, forcado: forcado, automatico: automatico,
        janela: janela.innerWidth + "x" + janela.innerHeight, desenho: t.x + "x" + t.y,
        razao: Math.round(razao() * 1000) / 1000, sombra: jogo.sol.castShadow ? jogo.sol.shadow.mapSize.x : 0,
        fps: Math.round(medida.fps),
      };
    },
    descer: function () { return descer("pedido pelo console"); },
    niveis: NIVEIS.map(function (n) { return n.nome; }),
  };

  if (document.getElementById("campo")) esperar();
  else document.addEventListener("DOMContentLoaded", esperar);
})();
