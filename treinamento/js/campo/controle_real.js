/* ==========================================================================
   Controle de verdade: os manches do DJI RC Plus chegando pelo Wi-Fi.

   O app "Controle do Simulador" (no RC Plus) manda o estado dos manches para
   a ponte do PC (ferramentas/ponte_controle.py), que repassa para ca por
   WebSocket no localhost. Cada mensagem e o estado inteiro:

     { t:"m", e:[x,y], d:[x,y], g:[z,rz], h:[hx,hy], b:botoes, n:seq }

   e = manche esquerdo, d = direito, de -1 a 1, y PARA CIMA (o app ja vira o
   sinal do Android). O modo 1/2/3 continua sendo aplicado no manual.js, igual
   ao teclado e ao mouse: aqui chegam os manches fisicos, nao os comandos.

   O aluno escolhe na tela inicial do campo: "Controle virtual" (teclado e
   mouse, como sempre foi) ou "RC Plus real". So no real a conexao e aberta,
   e o "Comecar" espera o app do controle dar sinal antes de entrar.
   ========================================================================== */

window.CONTROLE_REAL = (function () {
  "use strict";

  var ENDERECO = "ws://127.0.0.1:8804";
  var VALIDADE_MS = 250;     // sem pacote ha mais que isso: manches no centro
  var ZONA_MORTA = 0.03;     // o manche parado nao fica exatamente no zero
  var CHAVE = "tpd_dji_manches";
  /* 08/10/2026, pedido do Eduardo: o RC Plus real (APK no controle original da DJI) fica fora do
     treinamento ate haver autorizacao da DJI para usar o controle. A escolha "Manches" nao aparece,
     tudo roda no controle virtual (como no XAG) e nada procura o controle. Para religar: true. */
  var RC_PLUS_REAL = false;

  var estado = null;
  var chegada = 0;
  var conexao = null;
  var ligado = false;
  var espera = 1000;
  var timer = null;

  /* ------------------------------------------------------------ conexao */

  function conectar() {
    if (!ligado || conexao) return;
    var ws;
    try { ws = new WebSocket(ENDERECO); } catch (e) { return reconectar(); }
    conexao = ws;
    ws.onopen = function () { espera = 1000; anunciarSessao(); };
    ws.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg && msg.t === "m") { estado = msg; chegada = performance.now(); }
        else if (msg && msg.t === "toque") toqueDoRcPlus(msg);
        else if (msg && msg.t === "pareado") { sessao.pareado = true; }
        else if (msg && msg.t === "ips") { sessao.ips = msg.l || []; }
        else if (msg && msg.t === "rtc-novo") novaOferta();
        else if (msg && msg.t === "rtc-resposta") aplicarResposta(msg);
      } catch (e) { /* pacote estranho: ignora */ }
    };
    ws.onclose = function () { conexao = null; reconectar(); };
    ws.onerror = function () { /* o onclose vem logo depois */ };
  }

  /* A ponte pode ainda nao estar aberta: tenta de novo, sem encher o console. */
  function reconectar() {
    if (!ligado || timer) return;
    timer = setTimeout(function () { timer = null; conectar(); }, espera);
    espera = Math.min(espera * 2, 4000);
  }

  function ligar(sim) {
    ligado = sim;
    if (sim) { espera = 1000; conectar(); return; }
    if (timer) { clearTimeout(timer); timer = null; }
    if (conexao) { try { conexao.close(); } catch (e) { /* ja fechou */ } conexao = null; }
    estado = null;
  }

  function zona(v) {
    v = Number(v) || 0;
    if (Math.abs(v) < ZONA_MORTA) return 0;
    return Math.max(-1, Math.min(1, v));
  }

  function fresco() {
    return ligado && estado && performance.now() - chegada < VALIDADE_MS;
  }

  /* ------------------------------------------------------------ escolha */

  function escolhido() {
    if (!RC_PLUS_REAL) return "virtual";
    /* o RC Plus real e so do DJI: no XAG a escolha guardada no DJI nao vale
       (sumia a vista Controle do XAG P60) */
    if (new URLSearchParams(location.search).get("marca") === "xag") return "virtual";
    var v = null;
    try { v = window.localStorage.getItem(CHAVE); } catch (e) { v = null; }
    return v === "real" ? "real" : "virtual";
  }

  function guardar(id) {
    try { window.localStorage.setItem(CHAVE, id); } catch (e) { /* sem guardar */ }
    ligar(id === "real");
  }

  var OPCOES = [
    { id: "virtual", nome: "Controle virtual",
      desc: "Teclado e mouse: W A S D no manche esquerdo, setas no direito." },
    { id: "real", nome: "RC Plus real",
      desc: "O seu RC Plus vira o controle do treinamento: manches, botões e a tela do app." },
  ];

  /* ------------------------------------- controle da mesma conta

     Desde 06/10/2026 o RC Plus entra no app "Controle do Simulador" com o
     mesmo e-mail e senha da conta do site (app: conta.js). Este PC diz a ponte
     que o controle liberado e o da conta logada (uid); pela internet, o
     aperto de mao usa sinalConta/{uid}/aparelhos/{aparelho}, que so a propria
     conta le e grava (firestore.rules). O numero de cadastro antigo saiu.
     Ainda valem, para compatibilidade, codigos vindos de ?controle= e os do
     modo demonstracao da conta (localStorage tpd_contas / tpd_conta_sessao). */
  var sessao = {
    pareado: false,
    ips: [],
  };

  function normalizarCodigo(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); }
  function mostrarCodigo(c) { return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : c; }

  /* os numeros liberados: o da sessao aberta pelo site, senao os da conta */
  function controlesLiberados() {
    var lista = [];
    [window.location.search, (function () {
      try { return document.getElementById("campo").contentWindow.location.search; } catch (e) { return ""; }
    })()].forEach(function (q) {
      var m = /[?&]controle=([^&]+)/.exec(q || "");
      if (m) lista.push(normalizarCodigo(decodeURIComponent(m[1])));
    });
    if (!lista.length) {
      try {
        var s = JSON.parse(window.localStorage.getItem("tpd_conta_sessao") || "null");
        var contas = JSON.parse(window.localStorage.getItem("tpd_contas") || "{}");
        var conta = s && contas[s.email];
        ((conta && conta.controles) || []).forEach(function (c) { lista.push(normalizarCodigo(c.codigo)); });
      } catch (e) { /* sem conta neste PC */ }
      try {
        var atual = window.CONTAS && window.CONTAS.atual && window.CONTAS.atual();
        ((atual && atual.controles) || []).forEach(function (c) { lista.push(normalizarCodigo(c.codigo)); });
      } catch (e) { /* conta ainda carregando */ }
    }
    /* o RC Plus que entrou na mesma conta (a ponte o reconhece pelo uid) */
    var f = firebaseLogado();
    if (f) lista.push(normalizarCodigo(f.auth().currentUser.uid));
    return lista.filter(function (c, i) { return c && lista.indexOf(c) === i; });
  }

  function anunciarSessao() {
    if (!conexao || conexao.readyState !== 1) return;
    try { conexao.send(JSON.stringify({ t: "controles", l: controlesLiberados() })); } catch (e) { /* tenta de novo */ }
  }
  /* a ponte pode ter reiniciado: lembra os liberados de tempos em tempos */
  setInterval(anunciarSessao, 3000);

  /* A caixa "Conexao do controle" (Cabo USB / Wi-Fi, numero registrado e
     "Aguardando...") saiu da tela inicial em 01/10/2026, a pedido do Eduardo.
     O numero vem da conta, e a ponte aceita o controle registrado tanto pelo
     cabo quanto pelo Wi-Fi. Versao anterior em
     copias-de-seguranca/antes-tirar-conexao-controle-20261001. */

  /* O bloco "Manches" na tela inicial do campo, no mesmo formato do
     "Nivel do terreno" e da escolha do operador. Sai cedo se ja montou. */
  function seletor(ponte) {
    var j = ponte && ponte.janela;
    var doc = j && j.document;
    var comecar = doc && doc.getElementById("bComecar");
    if (!comecar || doc.getElementById("xgManches")) return false;

    var rotulo = doc.createElement("p");
    rotulo.className = "rot";
    rotulo.style.marginTop = "18px";
    rotulo.textContent = "Manches";

    var grupo = doc.createElement("div");
    grupo.className = "avatares";
    grupo.id = "xgManches";
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Manches");

    var descricao = doc.createElement("p");
    descricao.style.cssText = "margin:8px 0 0;font-size:13px;line-height:1.5;color:#C3CCD5";

    function marcar(id) {
      var botoes = grupo.querySelectorAll("button");
      for (var i = 0; i < botoes.length; i++) {
        botoes[i].setAttribute("aria-pressed", String(botoes[i].dataset.manches === id));
      }
      var o = OPCOES.filter(function (x) { return x.id === id; })[0];
      descricao.textContent = o ? o.desc : "";
    }

    OPCOES.forEach(function (o) {
      var b = doc.createElement("button");
      b.type = "button";
      b.dataset.manches = o.id;
      b.textContent = o.nome;
      b.addEventListener("click", function () { guardar(o.id); marcar(o.id); });
      grupo.appendChild(b);
    });

    comecar.parentNode.insertBefore(rotulo, comecar);
    comecar.parentNode.insertBefore(grupo, comecar);
    comecar.parentNode.insertBefore(descricao, comecar);
    if (!RC_PLUS_REAL) rotulo.style.display = grupo.style.display = descricao.style.display = "none";
    marcar(escolhido());

    segurarComecar(doc, comecar);
    vistaDoOperador(ponte, comecar);
    instalarFpv(ponte);
    return true;
  }

  /* --------------------------------------------- a camera FPV no RC Plus

     A cada 2 quadros do jogo (~30 por segundo), a camera do drone e
     desenhada numa imagem fora da tela e vai, em JPEG, pela ponte ate o app
     do controle. So enquanto o RC Plus real estiver mandando manches: no
     controle virtual nada disso roda.

     Atraso: nunca ha mais de uma imagem a caminho. Se a anterior ainda nao
     saiu do navegador, a nova e descartada - imagem velha na fila e o que
     deixa o video atrasado. */
  var FPV_L = 960, FPV_A = 540, FPV_QUALIDADE = 0.75;

  /* ----------------------------------------------- camera por WebRTC
     O canvas da camera (r2) vira VIDEO de verdade (captureStream + WebRTC):
     a placa de video comprime (H.264/VP8) e manda direto ao controle pela rede
     da casa - sem JPEG, sem passar imagem pela ponte. A ponte (e, na internet,
     o Firebase) so faz o aperto de mao. Enquanto o WebRTC nao conecta, fica o
     JPEG de antes. */
  var janelaCampo = null;

  /* Aparelho fraco (smart TV, TV box, notebook simples, ou o jogo ja caiu para
     a qualidade baixa/minima do desempenho.js): a camera vai ao controle em
     30 quadros/s e resolucao menor - comprimir video a 60 quadros/s pesa
     demais para o processador de uma TV. Computador bom continua em 60. */
  function aparelhoFraco() {
    var ua = navigator.userAgent || "";
    if (/SMART-TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|AFT[A-Z]|CrKey|GoogleTV|Android TV|HbbTV|VIDAA|AppleTV/i.test(ua)) return true;
    if ((navigator.hardwareConcurrency || 8) <= 4) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    try {
      var d = window.xgDesempenho && window.xgDesempenho.estado();
      if (d && (d.nivel === "baixa" || d.nivel === "minima")) return true;
    } catch (e) { /* sem o medidor */ }
    return false;
  }
  function ajustarEnvio(pc, leve) {
    pc.getSenders().forEach(function (sd) {
      if (!sd.track || sd.track.kind !== "video") return;
      try {
        var pr = sd.getParameters();
        if (!pr.encodings || !pr.encodings.length) pr.encodings = [{}];
        /* imagem boa e fluida; se a rede apertar, perde resolucao, nao quadros */
        pr.encodings[0].maxBitrate = leve ? 2500000 : 6000000;
        pr.encodings[0].maxFramerate = leve ? 30 : 60;
        pr.encodings[0].scaleResolutionDownBy = leve ? 1.5 : 1;
        pr.degradationPreference = "maintain-framerate";
        sd.setParameters(pr).catch(function () {});
      } catch (e) { /* navegador antigo */ }
    });
  }
  /* o desempenho.js pode baixar a qualidade no meio do voo: a camera acompanha */
  setInterval(function () {
    if (!rtc.pc || !rtc.ativo) return;
    var leve = aparelhoFraco();
    if (leve !== rtc.leve) { rtc.leve = leve; ajustarEnvio(rtc.pc, leve); }
  }, 3000);
  var rtc = { pc: null, id: 0, ativo: false };
  function fecharRtc() {
    if (rtc.pc) { try { rtc.pc.close(); } catch (e) { /* ja */ } }
    /* para a captura do canvas da oferta antiga: ligada, cada reconexao
       somava mais uma copia da camera por quadro e o jogo ia ficando lento */
    if (rtc.fluxo) { rtc.fluxo.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* ja */ } }); }
    rtc.pc = null; rtc.ativo = false; rtc.dEst = null; rtc.fluxo = null;
  }
  /* para o app_rcplus.js mandar o estado direto ao controle */
  window.__xgRtc = {
    aberto: function () { return !!(rtc.dEst && rtc.dEst.readyState === "open"); },
    estado: function (txt) { try { if (rtc.dEst.bufferedAmount < 1000000) rtc.dEst.send(txt); } catch (e) { /* caiu */ } }
  };
  function esperarIce(pc) {
    return new Promise(function (ok) {
      if (pc.iceGatheringState === "complete") return ok();
      var t = setTimeout(ok, 1500);
      pc.addEventListener("icegatheringstatechange", function () {
        if (pc.iceGatheringState === "complete") { clearTimeout(t); ok(); }
      });
    });
  }
  function novaOferta(canal) {
    var cv = janelaCampo && janelaCampo.__xgFpvCanvas;
    if (!cv || !cv.captureStream || !window.RTCPeerConnection) return;
    if (!canal && (!conexao || conexao.readyState !== 1)) return;
    fecharRtc();
    /* id pelo relogio: uma resposta velha guardada no Firebase nao casa com a oferta nova */
    var id = rtc.id = Math.max(Date.now(), rtc.id + 1);
    var pc = new RTCPeerConnection({ iceServers: canal ? [{ urls: "stun:stun.l.google.com:19302" }] : [] });
    rtc.pc = pc; rtc.canal = canal || null;
    /* dados pelo mesmo WebRTC: "estado" (jogo -> controle) e comandos do app
       (controle -> jogo), em ordem; "manches" sem esperar reenvio (o pacote
       novo vale mais que o perdido) */
    var dEst = pc.createDataChannel("estado", { ordered: true });
    var dMan = pc.createDataChannel("manches", { ordered: false, maxRetransmits: 0 });
    rtc.dEst = dEst;
    dMan.onmessage = function (ev) {
      try { var msg = JSON.parse(ev.data); if (msg && msg.t === "m") { estado = msg; chegada = performance.now(); } }
      catch (e) { /* pacote estranho */ }
    };
    dEst.onmessage = function (ev) {
      try {
        var m = JSON.parse(ev.data);
        if (m && m.t === "cmd" && window.APP_RCPLUS) window.APP_RCPLUS.executar(m);
      } catch (e) { /* comando estranho */ }
    };
    rtc.leve = aparelhoFraco();
    var fluxo = rtc.fluxo = cv.captureStream(rtc.leve ? 30 : 60);   // 60 quadros/s ficou "perfeito" (02/10)
    fluxo.getVideoTracks().forEach(function (t) {
      try { t.contentHint = "motion"; } catch (e) { /* sem dica */ }
      pc.addTrack(t, fluxo);
    });
    pc.onconnectionstatechange = function () {
      if (rtc.pc !== pc) return;
      rtc.ativo = pc.connectionState === "connected";
      if (rtc.ativo) ajustarEnvio(pc, rtc.leve);
    };
    pc.createOffer().then(function (o) { return pc.setLocalDescription(o); })
      .then(function () { return esperarIce(pc); })
      .then(function () {
        if (rtc.pc !== pc) return;
        if (canal) {
          var fb = window.firebase;
          return canal.ref.set({ oferta: { id: id, sdp: pc.localDescription.sdp },
            resposta: fb.firestore.FieldValue.delete() }, { merge: true });
        }
        if (!conexao || conexao.readyState !== 1) return;
        conexao.send(JSON.stringify({ t: "rtc-oferta", id: id, sdp: pc.localDescription.sdp }));
      }).catch(function () { if (rtc.pc === pc) fecharRtc(); });
  }
  function aplicarResposta(m) {
    if (!rtc.pc || Number(m.id) !== rtc.id || !m.sdp || rtc.respondido === rtc.id) return;
    rtc.respondido = rtc.id;
    rtc.pc.setRemoteDescription({ type: "answer", sdp: m.sdp }).catch(function () {});
  }

  /* ---------------------------- aperto de mao pela internet (Firebase)

     Sem a ponte (site aberto pela internet, TV, tablet), o controle e o
     simulador se acham pela CONTA: cada RC Plus que entrou nela tem um
     documento sinalConta/{uid}/aparelhos/{aparelho}. O app escreve "pede",
     este navegador responde com a oferta e o app grava a resposta. So a
     propria conta le e grava ali (firestore.rules). A imagem e os dados vao
     direto pelo WebRTC, como na ponte. */
  var nuvem = { ouvinte: null, uid: null, pede: {}, erro: null };
  function firebaseLogado() {
    var f = window.firebase;
    try { return f && f.apps && f.apps.length && f.auth().currentUser ? f : null; } catch (e) { return null; }
  }
  /* escuta desde que a pagina abre (nao so depois de escolher "RC Plus real"):
     o controle conecta e o seletor de manches pode mudar sozinho */
  setInterval(function () {
    if (!RC_PLUS_REAL) return;
    if (conexao && conexao.readyState === 1) return;     // com a ponte, vai por ela
    if (new URLSearchParams(location.search).get("marca") === "xag") return; // sinalizacao propria do celular XAG
    var f = firebaseLogado();
    if (!f) return;
    var uid = f.auth().currentUser.uid;
    if (nuvem.ouvinte && nuvem.uid === uid) return;
    if (nuvem.ouvinte) { try { nuvem.ouvinte(); } catch (e) { /* ja parado */ } nuvem.ouvinte = null; }
    nuvem.uid = uid;
    var aparelhos = f.firestore().collection("sinalConta").doc(uid).collection("aparelhos");
    nuvem.ouvinte = aparelhos.onSnapshot(function (lista) {
      nuvem.erro = null;
      lista.docChanges().forEach(function (mudanca) {
        if (mudanca.type === "removed") return;
        var d = mudanca.doc, s = d.data() || {}, c = d.id;
        if (s.pede != null && s.pede !== nuvem.pede[c]) {
          var velho = nuvem.pede[c] === undefined && Math.abs(Date.now() - Number(s.pede)) > 60000;
          nuvem.pede[c] = s.pede;
          /* outro RC Plus da mesma conta nao derruba o controle ja conectado pela nuvem;
             o mesmo aparelho pedindo de novo (reconexao) continua valendo */
          var outroAparelho = rtc.ativo && rtc.canal && rtc.canal.codigo !== c;
          if (!velho && !outroAparelho && !(conexao && conexao.readyState === 1)) novaOferta({ codigo: c, ref: d.ref });
        }
        if (s.resposta && rtc.canal && rtc.canal.codigo === c) aplicarResposta(s.resposta);
      });
    }, function (e) {
      nuvem.erro = e && e.code === "permission-denied" ? "sem-permissao" : "rede";
      nuvem.ouvinte = null;
    });
  }, 1000);

  function instalarFpv(ponte) {
    var j = ponte && ponte.janela;
    if (!j || j.__xgFpvStream) return;
    janelaCampo = j;
    j.__xgFpvStream = {
      /* o controle esta vendo a camera por WebRTC: o canvas continua sendo
         desenhado (o video sai dele), mas o JPEG nao e mais feito */
      rtc: function () { return rtc.ativo; },
      /* intervalo entre imagens da camera com WebRTC: 60/s, ou 30/s em aparelho fraco */
      intervaloRtc: function () { return rtc.leve ? 32 : 15; },
      /* desenha com a ponte aberta ou com o WebRTC ligado (pela internet nao ha ponte) */
      deveMandar: function () { return (fresco() && ((conexao && conexao.readyState === 1) || rtc.ativo)) || !!window.__xgFpvLocal; },
      /* o JPEG so serve para a ponte do PC. No controle virtual (e no VR) a
         camera sai do proprio canvas: comprimir era trabalho jogado fora e,
         com 2 imagens na fila, a camera seguinte nem era desenhada - era o
         travamento da camera no controle virtual (06/10/2026) */
      precisaJpeg: function () { return !!(conexao && conexao.readyState === 1); },
      /* a camera 3D do controle (modo espelho) assumiu: o video nao e
         desenhado nem codificado. O aviso vem do app (app_rcplus.js, cmd
         "fpv") e vence em 6 s se nao for renovado - o video volta sozinho.
         O relogio de reserva (jogo rodando com a janela escondida) continua. */
      semVideo: function () { return (window.__xgFpv3dAte || 0) > Date.now(); },
      enviar: function (blob) {
        try { if (conexao && conexao.readyState === 1 && conexao.bufferedAmount < 200000) conexao.send(blob); }
        catch (e) { /* conexao caiu: o proximo quadro tenta */ }
      },
    };
    try {
      j.eval("(" + ganchoFpv.toString() + ")(" + FPV_L + "," + FPV_A + "," + FPV_QUALIDADE + ")");
    } catch (e) { j.__xgFpvStream = null; }
  }

  /* Roda DENTRO do campo (por eval): usa quadro, render, cena, camFpv.

     A camera tem um desenhador SO DELA, com o proprio canvas. Desenhar no
     desenhador do jogo (render target + leitura de pixels) mexia no estado
     dele no meio do quadro: a vista Operador ficava preta com a cena num
     canto, e a leitura de pixels travava o jogo a cada imagem. */
  function ganchoFpv(L, A, Q) {
    var S = window.__xgFpvStream;
    /* sem antisserrilhado: a leitura da imagem (toBlob) de um canvas com MSAA
       custava caro e a camera saia a ~5 quadros/s (medido 02/10) */
    var r2 = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    window.__xgFpvCanvas = r2.domElement;     // o video do WebRTC sai daqui
    r2.setPixelRatio(1);
    r2.setSize(L, A, false);
    r2.outputEncoding = render.outputEncoding;
    r2.toneMapping = render.toneMapping;
    r2.toneMappingExposure = render.toneMappingExposure;
    /* a camera do RC Plus com a mesma qualidade do jogo (sombra inclusive) */
    /* SEM sombra na camera do controle: a sombra desenha a cena inteira de novo
       e custava ~45 de cada 62 ms do quadro (medido 02/10: 62 ms com sombra,
       17 ms sem). Era o que segurava a camera em ~5-7 quadros/s */
    r2.shadowMap.enabled = false;
    r2.shadowMap.type = render.shadowMap.type;
    /* ate 2 imagens sendo comprimidas ao mesmo tempo (antes era 1: o jogo
       esperava cada JPEG ficar pronto para desenhar a proxima) e no maximo
       30 por segundo */
    var n = 0, ocupado = 0, ultimoQuadro = performance.now(), ultimaFpv = 0;
    var original = quadro;
    /* compressor do JPEG fora da pagina (Web Worker) */
    var comp = null;
    try {
      if (typeof OffscreenCanvas === "function" && typeof createImageBitmap === "function") {
        comp = new Worker(URL.createObjectURL(new Blob([
          "var oc=null,cx=null;onmessage=function(e){var b=e.data;" +
          "if(!oc||oc.width!==b.width||oc.height!==b.height){oc=new OffscreenCanvas(b.width,b.height);cx=oc.getContext('2d');}" +
          "cx.drawImage(b,0,0);b.close();" +
          "oc.convertToBlob({type:'image/jpeg',quality:" + Q + "}).then(function(j){postMessage(j);},function(){postMessage(null);});};"
        ], { type: "text/javascript" })));
        comp.onmessage = function (e) { ocupado--; if (e.data) S.enviar(e.data); };
        comp.onerror = function () { comp = null; ocupado = 0; };
      }
    } catch (e) { comp = null; }
    /* Com a janela do PC escondida ou minimizada (o aluno olhando o RC Plus),
       o navegador para o requestAnimationFrame e o jogo e a camera congelam.
       Enquanto o RC Plus estiver ligado, este relogio roda o quadro do jogo
       quando o rAF parou. O rAF do proprio quadro fica desligado nessa hora,
       senao cada chamada empilharia um laco a mais ao voltar a janela. */
    /* relogio num Web Worker: o Chrome limita os timers da pagina escondida
       a 1 por segundo (ou menos), mas nao os de Worker */
    var reserva = function () {
      if ((window.xgVR && xgVR.imersivo) || (render.xr && render.xr.isPresenting)) return;
      if (!S.deveMandar() || performance.now() - ultimoQuadro < 50) return;
      var raf = window.requestAnimationFrame;
      window.requestAnimationFrame = function () { return 0; };
      try { quadro(performance.now()); } finally { window.requestAnimationFrame = raf; }
    };
    try {
      var relogio = new Worker(URL.createObjectURL(new Blob(["setInterval(function(){postMessage(0)},16)"], { type: "text/javascript" })));
      relogio.onmessage = reserva;
    } catch (e) { setInterval(reserva, 16); }
    quadro = function (t, frame) {
      ultimoQuadro = performance.now();
      original(t, frame);
      if (window.xgBateria && xgBateria.corte) return;
      if (ocupado >= 2 || !S.deveMandar() || (S.semVideo && S.semVideo()) || performance.now() - ultimaFpv < (S.rtc && S.rtc() ? (S.intervaloRtc ? S.intervaloRtc() : 15) : 32)) return;
      ultimaFpv = performance.now();
      var p = camFpv.position.clone(), q = camFpv.quaternion.clone(), u = camFpv.up.clone(), aspecto = camFpv.aspect;
      atualizarFpv();
      if (typeof window.xgGimbal === "number") {
        var c = camFpv.position, a = window.xgGimbal * Math.PI / 180;
        var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);
        // Mesma orientacao do espelho, estavel inclusive no nadir (-90 graus).
        camFpv.up.set(-fx * Math.sin(a), Math.cos(a), -fz * Math.sin(a));
        camFpv.lookAt(c.x + fx * Math.cos(a) * 10, c.y + Math.sin(a) * 10, c.z + fz * Math.cos(a) * 10);
      }
      camFpv.aspect = L / A;
      camFpv.updateProjectionMatrix();
      r2.render(cena, camFpv);
      /* a camera do jogo volta como estava: ele pode estar usando-a */
      camFpv.position.copy(p);
      camFpv.quaternion.copy(q);
      camFpv.up.copy(u);
      camFpv.aspect = aspecto;
      camFpv.updateProjectionMatrix();
      if (S.rtc && S.rtc()) return;              // o WebRTC leva o canvas: sem JPEG
      if (S.precisaJpeg && !S.precisaJpeg()) return;   // sem ponte: ninguem recebe o JPEG
      ocupado++;
      if (comp) {
        /* a imagem vai para o Worker comprimir (OffscreenCanvas.convertToBlob):
           o toBlob na pagina ficava lento (~270 ms; ~1 s com a janela do jogo
           atras de outra) e segurava a camera em 3-7 quadros/s */
        createImageBitmap(r2.domElement).then(function (bmp) { comp.postMessage(bmp, [bmp]); })
          .catch(function () { ocupado--; });
      } else {
        r2.domElement.toBlob(function (b) { ocupado--; if (b) S.enviar(b); }, "image/jpeg", Q);
      }
    };
    return true;
  }

  /* Com o controle de verdade na mao, o aluno ve o que o piloto ve: entra
     no campo ja na vista Operador. O clique do proprio jogo leva para o
     campo; a vista e trocada assim que a tela do campo existir. */
  function vistaDoOperador(ponte, comecar) {
    comecar.addEventListener("click", function () {
      if (escolhido() !== "real" || !fresco()) return;
      var inicio = performance.now();
      var relogio = setInterval(function () {
        var noCampo = false;
        try { noCampo = ponte.estado().tela === "campo"; } catch (e) { noCampo = false; }
        if (noCampo) {
          clearInterval(relogio);
          ponte.trocarVista("operador");
        } else if (performance.now() - inicio > 5000) {
          clearInterval(relogio);
        }
      }, 100);
    });
  }

  /* ------------------------------------------- esperar o sinal do controle

     Com o RC Plus escolhido, o "Comecar" so entra depois que o app do
     controle esta mandando os manches. O clique e segurado na captura do
     documento, antes do ouvinte do proprio jogo. */
  function segurarComecar(doc, comecar) {
    var liberado = false;

    doc.addEventListener("click", function (e) {
      if (liberado || escolhido() !== "real" || fresco()) return;
      var alvo = e.target;
      if (!alvo || !alvo.closest || alvo.closest("#bComecar") !== comecar) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      esperar(doc, function () {
        liberado = true;
        comecar.click();
        liberado = false;
      });
    }, true);
  }

  function esperar(doc, aoChegar) {
    if (doc.getElementById("xgEsperaControle")) return;
    ligar(true);

    var fundo = doc.createElement("div");
    fundo.id = "xgEsperaControle";
    fundo.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(8,12,16,.78);font-family:inherit";

    var caixa = doc.createElement("div");
    caixa.style.cssText = "max-width:420px;margin:16px;padding:24px;border-radius:14px;" +
      "background:#1B232B;color:#E8EDF2;box-shadow:0 10px 40px rgba(0,0,0,.5);text-align:center";

    var titulo = doc.createElement("p");
    titulo.style.cssText = "margin:0 0 10px;font-size:18px;font-weight:700";
    titulo.textContent = "Aguardando o controle…";

    var texto = doc.createElement("p");
    texto.style.cssText = "margin:0 0 18px;font-size:14px;line-height:1.55;color:#C3CCD5";
    texto.textContent = "No RC Plus, abra o app “Controle do Simulador” e entre com o mesmo e-mail e a mesma senha " +
      "desta conta, de preferência no mesmo Wi-Fi deste aparelho. Assim que ele der sinal, o voo começa.";

    var situacao = doc.createElement("p");
    situacao.style.cssText = "margin:0 0 18px;font-size:13px;color:#F2B84B";

    var virtual = doc.createElement("button");
    virtual.type = "button";
    virtual.textContent = "Usar controle virtual";
    virtual.style.cssText = "padding:10px 18px;border-radius:10px;border:1px solid #4A5866;" +
      "background:transparent;color:#E8EDF2;font-size:14px;cursor:pointer";

    caixa.appendChild(titulo);
    caixa.appendChild(texto);
    caixa.appendChild(situacao);
    caixa.appendChild(virtual);
    fundo.appendChild(caixa);
    doc.body.appendChild(fundo);

    var relogio = setInterval(function () {
      if (fresco()) {
        fechar();
        aoChegar();
        return;
      }
      if (conexao && conexao.readyState === 1) { situacao.textContent = "Ponte do computador aberta. Esperando o controle…"; return; }
      if (!firebaseLogado()) situacao.textContent = "Entrando na sua conta…";
      else if (nuvem.erro === "sem-permissao") situacao.textContent = "Sua conta não tem acesso ao controle agora (conta bloqueada ou treinamento em manutenção).";
      else situacao.textContent = "Procurando o controle pela internet… No RC Plus, abra o app Controle do Simulador com internet e entre com o mesmo e-mail e a mesma senha desta conta.";
    }, 200);

    function fechar() {
      clearInterval(relogio);
      if (fundo.parentNode) fundo.parentNode.removeChild(fundo);
    }

    virtual.addEventListener("click", function () {
      guardar("virtual");
      var botao = doc.querySelector('#xgManches button[data-manches="virtual"]');
      if (botao) botao.click();
      fechar();
    });
  }

  /* ------------------------------------- o mapa do campo no RC Plus

     O controle virtual do PC mostra de fundo a foto de cima do campo aberto
     (vinculo.js a planta no <symbol id="terreno">); cada nivel - facil,
     medio, dificil - tem o seu. O app do RC Plus nao tem o jogo: a mesma
     foto vai pela ponte (binario com "MAPA" na frente, para nao confundir
     com a camera) e o app busca em http://PC:8805/mapa.jpg. So manda de
     novo quando a foto muda ou a conexao cai e volta. */
  var mapaEnviado = null, conexaoDoMapa = null, mapaOcupado = false;
  setInterval(function () {
    if (window.APP_RCPLUS) return;           // o app novo pede a foto por app_rcplus.js
    if (!fresco() || !conexao || conexao.readyState !== 1 || mapaOcupado) return;
    if (conexaoDoMapa !== conexao) { conexaoDoMapa = conexao; mapaEnviado = null; }
    var quadro = document.getElementById("controle");
    var doc = quadro && quadro.contentDocument;
    var foto = doc && doc.getElementById("xg-foto");
    var href = foto && (foto.getAttribute("href") || foto.getAttributeNS("http://www.w3.org/1999/xlink", "href"));
    if (!href || href === mapaEnviado) return;
    mapaOcupado = true;
    var img = new Image();
    img.onload = function () {
      var tela = document.createElement("canvas");
      tela.width = 2048; tela.height = 1280;          // o mapa do app e 1920 x 1200
      tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
      tela.toBlob(function (b) {
        mapaOcupado = false;
        if (!b || !conexao || conexao.readyState !== 1) return;
        try {
          conexao.send(new Blob([new Uint8Array([77, 65, 80, 65]), b]));   // "MAPA" + jpeg
          mapaEnviado = href;
        } catch (e) { /* tenta na proxima volta */ }
      }, "image/jpeg", 0.85);
    };
    img.onerror = function () { mapaOcupado = false; };
    img.src = href;
  }, 2000);

  /* ------------------------------------------ a tela do app no RC Plus

     O controle virtual do PC e o mestre: e nele que o treinamento escreve
     bateria, tanque, telemetria, posicao do drone, rota e alertas. O RC
     Plus mostra o MESMO conteudo (a tela .tela inteira, os estilos que o
     treinamento poe no controle e as classes do body), sobre o fundo com o
     mapa do nivel escolhido. Os toques no RC Plus voltam e viram cliques
     aqui. So manda quando muda, e nunca empilha na rede. */
  var ROLAVEIS = ".rolagem-config,.lista-tarefas,.conteudo-exec,.painel-execucao,.painel-rota,.painel-manual," +
    ".painel-tarefa-map,.lista-tipos,.lista-suspensa,.lista-arquivos,.painel-tipo-mapa,.menu-arquivos,.corpo-prescricao";
  var telaEnviada = "", cssEnviado = "", bodyEnviado = "", conexaoDaTela = null;

  function docDoControle() {
    var q = document.getElementById("controle");
    return q && q.contentDocument;
  }

  setInterval(function () {
    if (window.APP_RCPLUS) return;           // o app novo nao espelha a tela antiga
    if (!fresco() || !conexao || conexao.readyState !== 1 || conexao.bufferedAmount > 300000) return;
    if (conexaoDaTela !== conexao) { conexaoDaTela = conexao; telaEnviada = cssEnviado = bodyEnviado = ""; }
    var doc = docDoControle();
    var tela = doc && doc.querySelector(".tela");
    if (!tela) return;

    /* o RC Plus de verdade ja esta ligado na mao do aluno: o controle virtual,
       que e quem ele espelha, liga junto (a aeronave continua sendo do jogo) */
    try {
      doc.defaultView.eval("typeof faseControle !== 'undefined' && faseControle === 'desligado' && typeof ligarControle === 'function' && ligarControle()");
    } catch (e) { /* controle recarregando */ }

    /* o que nao vai no HTML: valor digitado e rolagem */
    var campos = tela.querySelectorAll("input");
    for (var i = 0; i < campos.length; i++) {
      if (campos[i].getAttribute("value") !== campos[i].value) campos[i].setAttribute("value", campos[i].value);
    }
    var rolam = tela.querySelectorAll(ROLAVEIS);
    for (var k = 0; k < rolam.length; k++) {
      var topo = String(Math.round(rolam[k].scrollTop));
      if ((rolam[k].getAttribute("data-xg-rola") || "0") !== topo) rolam[k].setAttribute("data-xg-rola", topo);
    }

    var html = tela.innerHTML;
    var estilos = doc.head.querySelectorAll("style"), css = "";
    for (var j = 0; j < estilos.length; j++) css += estilos[j].textContent + "\n";
    var corpo = doc.body.className;
    if (html === telaEnviada && css === cssEnviado && corpo === bodyEnviado) return;

    try {
      conexao.send(JSON.stringify({
        t: "tela",
        h: html === telaEnviada ? null : html,
        c: css === cssEnviado ? null : css,
        b: corpo,
      }));
      telaEnviada = html; cssEnviado = css; bodyEnviado = corpo;
    } catch (e) { /* tenta na proxima volta */ }
  }, 200);

  /* toque no RC Plus -> clique aqui. x e y vem de 0 a 1 sobre a tela do app. */
  var alvoDoToque = null, inicioDoToque = null;
  function toqueDoRcPlus(m) {
    if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
    var doc = docDoControle();
    var tela = doc && doc.querySelector(".tela");
    if (!tela) return;
    var j = doc.defaultView;

    if (m.k === "s") {                      // rolagem: o mesmo elemento, pelo caminho
      var el = tela;
      for (var i = 0; i < (m.c || []).length && el; i++) el = el.children[m.c[i]];
      if (el) el.scrollTop = m.y;
      return;
    }

    var r = tela.getBoundingClientRect();
    if (!r.width) return;
    var x = r.left + m.x * r.width, y = r.top + m.y * r.height;
    var alvo = doc.elementFromPoint(x, y);
    if (!alvo) return;
    var base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: j,
                 pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };

    function soltar(tipo, el, botoes, Classe) {
      var o = {}; for (var c in base) o[c] = base[c];
      o.buttons = botoes;
      try { el.dispatchEvent(new (Classe || j.PointerEvent)(tipo, o)); } catch (e) { /* segue */ }
    }

    if (m.k === "d") {
      alvoDoToque = alvo; inicioDoToque = [x, y];
      soltar("pointerdown", alvo, 1);
      soltar("mousedown", alvo, 1, j.MouseEvent);
    } else if (m.k === "m") {
      soltar("pointermove", alvoDoToque || alvo, 1);
      soltar("mousemove", alvoDoToque || alvo, 1, j.MouseEvent);
    } else if (m.k === "c") {
      soltar("pointerup", alvoDoToque || alvo, 0);
      alvoDoToque = null; inicioDoToque = null;
    } else if (m.k === "u") {
      soltar("pointerup", alvoDoToque || alvo, 0);
      soltar("mouseup", alvo, 0, j.MouseEvent);
      var parado = inicioDoToque && Math.hypot(x - inicioDoToque[0], y - inicioDoToque[1]) < 12;
      if (parado) {
        if (alvo.focus && /^(INPUT|TEXTAREA)$/.test(alvo.tagName)) alvo.focus();
        soltar("click", alvo, 0, j.MouseEvent);
      }
      alvoDoToque = null; inicioDoToque = null;
    }
  }

  /* abriu a pagina com o real guardado: ja vai conectando */
  if (escolhido() === "real") ligar(true);

  /* ------------------------------------- RC Plus real: Drone, Operador e Livre

     Com o controle de verdade na mao, o aparelho desenhado no PC nao tem
     funcao (a tela do app e a camera FPV estao no RC Plus): somem o desenho
     (#vCtrl) e a vista Controle. Se estava nela, vai para
     Operador. No controle virtual nada muda. */
  setInterval(function () {
    var j = null;
    try { j = window.XG && window.XG.ponte && window.XG.ponte.janela; } catch (e) { j = null; }
    var doc = j && j.document;
    if (!doc || !doc.body) return;
    var real = escolhido() === "real";
    if (!doc.getElementById("xgRcPlusReal")) {
      var css = doc.createElement("style");
      css.id = "xgRcPlusReal";
      css.textContent = "body.xg-rcplus-real #vCtrl{display:none!important}" +
        "body.xg-rcplus-real #vistas [data-v='drone']{display:block!important;visibility:visible!important}" +
        "body.xg-rcplus-real #vistas [data-v='controle']{display:none!important}";
      doc.head.appendChild(css);
    }
    doc.body.classList.toggle("xg-rcplus-real", real);
    if (!real) return;
    var v = null;
    try { v = j.eval("typeof vista !== 'undefined' ? vista : null"); } catch (e) { v = null; }
    if (v === "controle") {
      try { window.XG.ponte.trocarVista("operador"); } catch (e) { /* tenta na proxima volta */ }
    }
  }, 500);

  return {
    /* {esq:{x,y}, dir:{x,y}} ou null quando o controle nao esta mandando. */
    manches: function () {
      if (!fresco()) return null;
      var e = estado.e || [0, 0], d = estado.d || [0, 0];
      return {
        esq: { x: zona(e[0]), y: zona(e[1]) },
        dir: { x: zona(d[0]), y: zona(d[1]) },
      };
    },
    usarVirtual: function () { guardar("virtual"); },
    seletor: seletor,
    conectado: function () { return !!fresco(); },
    escolhido: escolhido,
    ultimo: function () { return estado; },
  };
})();
