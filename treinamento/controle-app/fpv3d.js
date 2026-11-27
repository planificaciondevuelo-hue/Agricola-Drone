/* ==========================================================================
   Câmera do drone DESENHADA NO CONTROLE ("modo espelho").

   Antes, a câmera era vídeo do PC (MJPEG): o PC desenhava a cena de novo,
   comprimia e mandava - com atraso e engasgos. Agora, dentro da janela da
   câmera (#fpv), fica um iframe com o MESMO campo 3D do jogo
   (/site/treinamento/espelho.html, que o app Android serve do disco do
   controle e busca na ponte do PC uma vez), sem física: ele só desenha a
   cena pela câmera do drone. Do PC vem só a pose, no estado (30x/s):
     E.c  [x,y,z,qx,qy,qz,qw]  a câmera do drone (a mesma do vídeo)
     E.x  corpo do drone, hélices, calda, operador (ver js/campo/espelho.js)
     E.mk o nível (o mesmo que escolhe a foto do mapa)
   A cada quadro o espelho interpola entre as poses (sem esperar vídeo).

   Enquanto o espelho não fica pronto, ou se falhar, a câmera é o vídeo de
   hoje (nucleo.js abrirFluxo). A troca é muda: nada de texto na cena.
   O fundo do mapa continua sendo a foto do campo (nada muda no mapa).

   No console (chrome://inspect): FPV3D.estado(), FPV3D.qualidade('alta'|
   'media'|'baixa'), FPV3D.modo('3d'|'video').
   ========================================================================== */
"use strict";
var FPV3D = (function () {
  var PAGINA = "/site/treinamento/espelho.html";
  var LIMITE_CARGA = 45000;   // ms para o campo montar e desenhar (1a vez baixa ~25 MB do PC)
  var LIMITE_MUDO = 1500;     // ms à vista sem quadro desenhado = falhou
  var LIMITE_POSE = 2000;     // ms sem pose nova com o PC vivo = o PC parou de mandar E.c
  var PAUSA_FALHA = 20000;    // depois de uma falha, espera antes de tentar de novo
  var MAX_FALHAS = 3;         // depois disso, só vídeo até o app reabrir
  var AVISO_PC = 2000;        // repete ao PC "a câmera 3D assumiu" (ele para o vídeo)

  var caixa = $("#fpv"), fr = null;
  var fase = "video";         // video | conferindo | carregando | ativo
  var nivel = null, pedidoEm = 0, falhas = 0, esperarAte = 0, ultimoT = null, poseEm = 0, avisadoPc = 0;
  var visivelAntes = false, visivelDesde = 0, ultimaFalha = "", lentoDesde = 0;

  function ler(chave, padrao) { try { return localStorage.getItem(chave) || padrao; } catch (e) { return padrao; } }
  function gravar(chave, v) { try { localStorage.setItem(chave, v); } catch (e) { /* sem guardar */ } }

  /* O que o espelho lê e escreve. Mesma origem: acesso direto
     (parent.FPV3D.ligacao), sem postMessage nem cópia. */
  var L = {
    /* [{t: relógio do PC (E.t), chegou: relógio daqui, c: E.c, x: E.x}], a mais nova no fim */
    poses: [],
    vista: vista,
    medidas: null,
    quadroEm: 0,
    quadro: function (m) { L.quadroEm = Date.now(); L.medidas = m; },
    pronto: pronto,
    erro: function (m) { falhou(String(m || "erro no espelho")); }
  };

  /* px de tela por px do palco: o palco 1920x1200 é escalado por CSS
     (APP.escala). No RC Plus, 0,4 x 2,5 = 1. Sem isto o three usaria
     min(2, dpr) e a câmera cheia sairia com 4x os pixels da tela. */
  function vista() {
    var ex = $("#extra");
    return {
      px: (APP.escala || 1) * (window.devicePixelRatio || 1),
      q: ler("fpv3d_qualidade", "baixa"),
      fps: 30,
      visivel: APP.tela === "mapa" && APP.conectado && !document.hidden && !(ex && ex.classList.contains("aberto"))
    };
  }

  /* a montagem do campo 3D prende a página alguns segundos: só com a aeronave
     parada no chão (no ar fica o vídeo até pousar) */
  function noChao(E) {
    var st = E && E.v && E.v.estado;
    return st === "em solo" || st === "concluído" || st === "reabastecendo" || !!(E && E.sens && E.sens.chao && !E.sens.motores);
  }

  function permitido(E) {
    if (/#teste=/.test(location.hash)) return false;           // modo de teste: dados falsos, sem PC
    if (/[?&]video=1/.test(location.search)) return false;     // o app Android reabriu depois de uma queda
    if (ler("fpv3d_modo2", "video") === "video") return false;      // escolhido no console: só vídeo
    if (falhas >= MAX_FALHAS || Date.now() < esperarAte) return false;
    return !!(E && E.mk && E.c && E.fpv !== "video");          // PC antigo (sem pose) ou o PC escolheu vídeo
  }

  /* cada estado novo (o evento "quadro" do nucleo.js vem a cada quadro da
     tela; o mesmo estado lido de novo é pulado pelo relógio do PC) */
  function novoEstado(E) {
    if (!E || E.t === ultimoT) return;
    ultimoT = E.t;
    if (E.c) {
      L.poses.push({ t: E.t, chegou: APP.rx || APP.recebido || Date.now(), c: E.c, x: E.x || null });
      if (L.poses.length > 90) L.poses.splice(0, L.poses.length - 90);   // ~3 s
      poseEm = Date.now();
    }
    if (fase !== "video" && (!permitido(E) || E.mk !== nivel)) voltarAoVideo();
    if (fase === "video" && permitido(E) && noChao(E)) conferir(E.mk);
  }

  /* o app Android confere se o PC tem este nível para o espelho (os mapas do
     aluno, "real-meu-*", ficam só no navegador do PC: esses ficam no vídeo) */
  function conferir(mk) {
    fase = "conferindo"; nivel = mk;
    fetch("/site-pronto?k=" + encodeURIComponent(mk), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : "nao"; })
      .catch(function () { return "nao"; })
      .then(function (t) {
        if (fase !== "conferindo" || nivel !== mk) return;
        if (String(t).trim() === "ok") return carregar(mk);
        fase = "video"; nivel = null;
        esperarAte = Date.now() + 10000;
      });
  }

  function carregar(mk) {
    tirarIframe();
    fase = "carregando"; pedidoEm = Date.now(); L.quadroEm = 0;
    fr = document.createElement("iframe");
    fr.id = "fpv-3d";
    fr.setAttribute("scrolling", "no");
    fr.setAttribute("tabindex", "-1");
    fr.setAttribute("aria-hidden", "true");
    fr.src = PAGINA + "?cenario=" + encodeURIComponent(mk);
    caixa.insertBefore(fr, caixa.firstChild);    // a .linha do canto continua por cima
  }

  /* o espelho montou o nível e desenhou: troca o vídeo pela vista 3D */
  function pronto(mk) {
    if (fase !== "carregando" || (mk && mk !== nivel)) return;
    fase = "ativo";
    visivelAntes = false;
    caixa.classList.add("tres-d");
    if (window.pararVideo) pararVideo();        // nucleo.js: fecha o MJPEG
    avisarPc(true);
  }

  /* o PC para de desenhar e codificar o vídeo enquanto o aviso vale (6 s) */
  function avisarPc(tresD) {
    avisadoPc = Date.now();
    cmd("fpv", { modo: tresD ? "3d" : "video" });
  }

  function voltarAoVideo() {
    var estava = fase === "ativo";
    caixa.classList.remove("tres-d");
    tirarIframe();
    fase = "video"; nivel = null;
    if (window.ligarVideo) ligarVideo();
    if (estava) avisarPc(false);
  }

  function tirarIframe() {
    if (!fr) return;
    try { fr.src = "about:blank"; } catch (e) { /* já saiu */ }
    fr.remove(); fr = null;                      // solta o contexto WebGL e as texturas
  }

  function falhou(m) {
    falhas++; esperarAte = Date.now() + PAUSA_FALHA; ultimaFalha = m;
    try { console.warn("câmera 3D: " + m); } catch (e) { /* sem console */ }
    voltarAoVideo();
  }

  ouvir("quadro", novoEstado);

  /* vigia: carga que não termina, desenho que parou, pose que parou */
  setInterval(function () {
    var agora = Date.now();
    if (fase === "carregando" && agora - pedidoEm > LIMITE_CARGA) return falhou("não montou a tempo");
    if (fase !== "ativo") return;
    if (APP.conectado && agora - poseEm > LIMITE_POSE) return voltarAoVideo();
    if (agora - avisadoPc > AVISO_PC && APP.conectado) avisarPc(true);
    var v = vista().visivel;
    if (v && !visivelAntes) visivelDesde = agora;
    visivelAntes = v;
    if (v && agora - Math.max(L.quadroEm, visivelDesde) > LIMITE_MUDO) return falhou("parou de desenhar");
    var m = L.medidas;
    if (v && m && m.fps > 0 && m.fps < 15) { lentoDesde = lentoDesde || agora; if (agora - lentoDesde > 6000) { lentoDesde = 0; return falhou("lento (" + m.fps.toFixed(0) + " q/s)"); } }
    else lentoDesde = 0;
  }, 250);

  return {
    ligacao: L,
    estado: function () {
      return { fase: fase, nivel: nivel, falhas: falhas, ultimaFalha: ultimaFalha, poses: L.poses.length,
        qualidade: ler("fpv3d_qualidade", "baixa"), medidas: L.medidas };
    },
    /* 'alta' (sombra como no PC), 'media' (padrão), 'baixa' (sem sombra, menos capim) */
    qualidade: function (q) { if (/^(alta|media|baixa)$/.test(q)) gravar("fpv3d_qualidade", q); return ler("fpv3d_qualidade", "baixa"); },
    /* '3d' (padrão) ou 'video' (só o vídeo do PC, como antes) */
    modo: function (m) {
      if (m === "3d" || m === "video") { gravar("fpv3d_modo2", m); falhas = 0; esperarAte = 0; if (m === "video" && fase !== "video") voltarAoVideo(); }
      return ler("fpv3d_modo2", "video");
    }
  };
})();
