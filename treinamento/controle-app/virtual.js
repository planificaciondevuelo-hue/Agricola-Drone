/* ==========================================================================
   APP DO CONTROLE NO CONTROLE VIRTUAL (site)

   Os outros arquivos desta pasta são cópia do app do APK "Controle do
   Simulador" (ferramentas/copiar_app_controle.py). No RC Plus, quem atende
   os pedidos do app (/estado, /cmd, a câmera...) é o Android e a ponte; aqui,
   dentro do controle virtual do sim.html, quem atende é o próprio jogo, na
   mesma página (window.top.APP_RCPLUS, js/campo/app_rcplus.js):
     /estado   -> APP_RCPLUS.estado() (o mesmo estado que vai ao RC Plus)
     /cmd      -> APP_RCPLUS.executar() (os mesmos comandos)
     câmera    -> o canvas da câmera do drone (controle_real.js) direto no
                  <video> do app, sem rede
     teclado   -> as teclas apertadas aqui vão para o jogo (manches) e para
                  o teclado do controle (js/campo/teclado_rc.js)
   Aberto fora do sim.html, este arquivo não faz nada.
   ========================================================================== */
(function () {
  "use strict";
  var JOGO = null;
  try { if (window.top !== window && window.top.APP_RCPLUS) JOGO = window.top; } catch (e) { JOGO = null; }
  if (!JOGO) return;
  window.__xgVirtual = true;
  JOGO.__xgAppVirtual = window;
  // Aplicar antes de concluir o carregamento de imagens/fontes do iframe.
  if (JOGO.DISPOSITIVO_SIM && JOGO.DISPOSITIVO_SIM.preparar) JOGO.DISPOSITIVO_SIM.preparar(window);

  /* sem WebRTC: a câmera vem do canvas, na mesma página */
  window.RTCPeerConnection = undefined;

  var rv = 0, rotaTxt = null, cache = null, cacheEm = 0;
  function estado(rvPagina) {
    var agora = Date.now();
    if (!cache || agora - cacheEm > 90) {
      var e = null;
      try { e = JOGO.APP_RCPLUS.estado(); } catch (erro) { e = null; }
      cacheEm = agora;
      if (e) {
        var txt = JSON.stringify(e.rota || null);
        if (txt !== rotaTxt) { rotaTxt = txt; rv++; }
      }
      cache = e;
    }
    if (!cache) return null;
    var e2 = {};
    for (var k in cache) e2[k] = cache[k];
    if (String(rvPagina) === String(rv)) e2.rota = "igual";
    return { rv: rv, rx: agora, e: e2 };
  }

  function resposta(corpo, tipo, status) {
    return Promise.resolve(new Response(corpo, { status: status || 200, headers: { "Content-Type": tipo || "application/json" } }));
  }

  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (url, opcoes) {
    var u;
    try { u = new URL(typeof url === "string" ? url : url.url, location.href); } catch (e) { return fetchOriginal(url, opcoes); }
    if (u.origin !== location.origin) return fetchOriginal(url, opcoes);
    switch (u.pathname) {
      case "/estado": {
        var m = estado(u.searchParams.get("rv"));
        return m ? resposta(JSON.stringify(m)) : resposta("", "text/plain", 503);
      }
      case "/cmd": {
        try {
          var comando = JSON.parse(u.searchParams.get("j") || "{}");
          // O iframe escondido continua vivo no RC Plus. Seu heartbeat nao
          // pode cancelar o metodo escolhido na tela do controle fisico.
          var real = JOGO.CONTROLE_REAL && JOGO.CONTROLE_REAL.escolhido() === "real";
          if (!(real && comando.c === "demarcacao")) JOGO.APP_RCPLUS.executar(comando);
          cache = null;
        }
        catch (e) { /* comando estranho */ }
        return resposta("OK", "text/plain");
      }
      case "/registro":
        return resposta(JSON.stringify({ codigo: "", estado: "virtual" }));
      case "/mapas-mudaram":
        return resposta("0", "text/plain");
      case "/mapa.txt": case "/mapa.jpg": case "/fpv.jpg": case "/fpv.mjpg": case "/sinal": case "/site-pronto":
        return resposta("", "text/plain", 404);
    }
    return fetchOriginal(url, opcoes);
  };

  /* imagem HD do mapeamento (feita pelo simulador, app_rcplus.js fotoHD) */
  window.mapaHDDoJogo = function (id) {
    try { return JOGO.APP_RCPLUS && JOGO.APP_RCPLUS.mapaHD ? JOGO.APP_RCPLUS.mapaHD(id) : null; } catch (e) { return null; }
  };

  /* 21/11/2026 (Eduardo: "quando criar orthomosaico e armazenar vai aparecer em todos os controles da dji"): o
     ortomosaico que o aluno armazenou no DGuri do Air 2S (js/campo/app_guri.js) entra no mapa, por cima da foto do
     campo, no lugar onde foi fotografado (1 unidade do mapa = 0,2327 m, com o talhao no meio do quadro 1920 x 1200). */
  function colarOrtoDoAluno() {
    try {
      var G = JOGO.GURI_MAPAS, foto = document.getElementById('foto-mapa');
      if (!G || !foto || document.getElementById('foto-orto-aluno')) return;
      var cen = G.cenario();
      if (!G.tem(cen, 'orto')) return;
      var c = JOGO.document.getElementById('campo').contentWindow.eval('({x: TALHAO.x0 + TALHAO.larg/2, z: TALHAO.z0 + TALHAO.prof/2})');
      G.ler(cen, 'orto').then(function (m) {
        if (!m || !m.imagem || document.getElementById('foto-orto-aluno')) return;
        var E = 0.2327, i = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        i.id = 'foto-orto-aluno';
        i.setAttribute('x', (m.cx - m.lm / 2 - c.x) / E + 960); i.setAttribute('y', (m.cz - m.am / 2 - c.z) / E + 600);
        i.setAttribute('width', m.lm / E); i.setAttribute('height', m.am / E);
        i.setAttribute('preserveAspectRatio', 'none'); i.setAttribute('style', 'filter:saturate(1.25) contrast(1.08);pointer-events:none');
        i.setAttribute('href', m.imagem);
        var depois = document.querySelector('#vista .fundo-padrao') || foto;
        depois.parentNode.insertBefore(i, depois.nextSibling);
      });
    } catch (e) { /* sem o mapa do aluno */ }
  }
  document.addEventListener("DOMContentLoaded", function () { setTimeout(colarOrtoDoAluno, 1500); });

  /* fotos dos mapas: as do site */
  document.addEventListener("DOMContentLoaded", function () {
    window.SITE_MAPAS = "../mapas_controle/";
    // Mapas privados nao existem na pasta publica de imagens prontas.
    // A foto e produzida pelo proprio cenario aberto, sem enviar o mapa ao site.
    var mapaPadrao = window.mapaDoNivel, pedido = 0, urlAtual = null;
    window.mapaDoNivel = function (k) {
      if (!k || k === window.chaveMapa || k === window.chaveTentando) return;
      var numero = ++pedido;
      var imagem = document.getElementById('foto-mapa');
      if (imagem) imagem.removeAttribute('href');
      if (urlAtual) { URL.revokeObjectURL(urlAtual); urlAtual = null; }
      window.chaveMapa = null;
      if (!/^real-/.test(k)) return mapaPadrao(k);
      window.chaveTentando = k;
      JOGO.APP_RCPLUS.fotoDoMapa().then(function (blob) {
        if (numero !== pedido) return;
        if (!blob) throw Error('Mapa ainda carregando');
        urlAtual = URL.createObjectURL(blob);
        window.encaixarMapa(urlAtual, function () {
          if (numero === pedido) window.chaveTentando = null;
        }, function () {
          if (numero === pedido) { window.chaveMapa = k; window.chaveTentando = null; }
        });
      }).catch(function () {
        if (numero === pedido) window.chaveTentando = null;
      });
    };
  });

  /* ---------------------------------------------------------- a câmera */
  function janelaCampo() {
    try { return JOGO.document.getElementById("campo").contentWindow; } catch (e) { return null; }
  }
  function aparelhoVisivel() {
    try {
      var a = JOGO.document.getElementById("aparelho");
      return !!a && !a.classList.contains("esconder");
    } catch (e) { return false; }
  }
  var fluxo = null;
  setInterval(function () {
    var visivel = aparelhoVisivel();
    JOGO.__xgFpvLocal = visivel;                 // o jogo só desenha a câmera com alguém vendo
    var video = document.getElementById("fpv-video"), caixa = document.getElementById("fpv");
    if (!video || !caixa) return;
    /* 23/10/2026 (T25: camera preta depois de trocar a bateria): quando a aeronave desconecta, o rtc.js (fechar) tira a classe "rtc" da
       caixa e o <video> some (display:none), mas o fluxo do canvas continua vivo. So recoloca a classe (e o play) quando ela sumiu. */
    if (fluxo) {
      if (!caixa.classList.contains("rtc")) {
        caixa.classList.add("rtc");
        if (window.pararVideo) window.pararVideo();
        if (video.paused) { var voltar = video.play(); if (voltar && voltar.catch) voltar.catch(function () {}); }
      }
      return;
    }
    var c = janelaCampo(), cv = c && c.__xgFpvCanvas;
    if (!cv || !cv.captureStream) return;
    fluxo = cv.captureStream(30);
    video.srcObject = fluxo;
    var tocar = video.play();
    if (tocar && tocar.catch) tocar.catch(function () {});
    caixa.classList.add("rtc");
    if (window.pararVideo) window.pararVideo();
  }, 500);

  /* ---------------------------------------------------------- o teclado */
  function repassar(e) {
    var alvo = e.target;
    if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return;
    var ev;
    try { ev = new JOGO.KeyboardEvent(e.type, { code: e.code, key: e.key, repeat: e.repeat, bubbles: true, cancelable: true }); }
    catch (erro) { return; }
    JOGO.dispatchEvent(ev);
    if (ev.defaultPrevented) e.preventDefault();
  }
  window.addEventListener("keydown", repassar, true);
  window.addEventListener("keyup", repassar, true);
  window.addEventListener("blur", function () {
    try { JOGO.dispatchEvent(new JOGO.Event("blur")); } catch (e) { /* segue */ }
  });
})();
