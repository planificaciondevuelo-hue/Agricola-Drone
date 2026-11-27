/* Sons do DJI (Agras T50/T25) no simulador — pedido do Eduardo, 09/10/2026:
   "os sons dos motores do drone e do botão de ligar e RTH nos drones da DJI".

   Tudo sintetizado no navegador (Web Audio): nenhum arquivo de som, nenhuma
   gravação da DJI. Este arquivo só LÊ o campo (V, drone, câmera) e o site do
   controle (faseControle); não muda nada do voo nem do controle. Só DJI: com
   o controle XAG (ou EAVision) nada toca.

   - Motores: soam enquanto as hélices giram (a mesma regra do laço do campo,
     "gira"). A rotação vem do peso (calda no tanque: empuxo ~ rotação², então
     a rotação vai com a raiz do peso), da subida e da velocidade; ligar e
     desligar sobem e descem devagar, como hélice grande. O volume cai com a
     distância até quem ouve: a câmera e, na vista Controle, o piloto.
   - Botão de energia: o controle apita ao ligar (manual T50/T25, "Ligar o
     controle remoto", passo 3: "emitirá um sinal sonoro ao ser ligado") e ao
     desligar. O primeiro toque (só acende os LEDs da bateria) não apita.
   - RTH: bipe longo quando começa e alerta "bi-bi" enquanto dura (manual:
     "alertas durante RTH"), até pousar, cancelar ou a aeronave cair.

   O navegador só deixa tocar som depois de um toque ou tecla do aluno, em
   qualquer uma das molduras. Pausa e aba escondida calam tudo.
   Console: xgSons.estado(), xgSons.mudo(true|false) (fica guardado neste
   aparelho em localStorage "tpd_sons"). */
(function () {
  "use strict";

  var url = new URLSearchParams(location.search);
  var MARCA = url.get("marca") || "";
  var MODELO = url.get("modelo") || url.get("drone") || "t50";
  /* 18/11/2026 (Eduardo, testando o P60: "drone ta sem som"): no XAG tocam os MOTORES (mesma sintese, com a rotacao e os pesos
     de cada modelo). O bipe do botao de energia e os alertas de RTH continuam so do controle DJI. EAVision segue sem som. */
  var XAG = MARCA === "xag";

  /* 19/11/2026 (Eduardo, com a tela do simulador: "temos q colocar um botao pra silenciar o som aqui na tela"): botao "Som" na
     direita da tela, embaixo de "Tela inicial" e visivel nas mesmas horas que ele. Cala tudo de uma vez - motores e bipes (este
     arquivo), as falas do piloto e do auxiliar (falar_auxiliar.js) e os alarmes do aplicativo do controle (bateria.js e
     xag_configuracoes.js) - e fica guardado no navegador em tpd_sons ("0" = calado), o interruptor que xgSons.mudo() ja usava e
     que nunca teve botao. Fica antes da saida da EAVision: ela nao tem motor com som, mas tem as falas. */
  (function botaoDoSom() {
    if (window.parent !== window || document.getElementById("som-botao")) return;
    var ALTO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
    var CALADO = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>';
    var NOMES = { pt: ["Som", "Sem som", "Silenciar o som do simulador", "Ligar o som do simulador"],
                  en: ["Sound", "Muted", "Mute the simulator", "Unmute the simulator"],
                  es: ["Sonido", "Sin sonido", "Silenciar el simulador", "Activar el sonido del simulador"] };
    function calado() { try { return localStorage.getItem("tpd_sons") === "0"; } catch (e) { return false; } }
    var estilo = document.createElement("style");
    estilo.textContent = "#som-botao{position:fixed;right:12px;top:222px;z-index:55;display:flex;align-items:center;gap:7px;background:#17281f;color:#f3f7f1;" +
      "border:1px solid #83988b;border-radius:8px;padding:9px 12px;font:600 13px system-ui;cursor:pointer;min-height:40px}" +
      "#som-botao[hidden]{display:none!important}#som-botao[aria-pressed='true']{color:#f0c48a;border-color:#b98a4e}" +
      "#som-botao:focus-visible{outline:3px solid #c0ee8c;outline-offset:2px}" +
      "html.xg-dispositivo-movel #som-botao{top:206px;width:44px;height:40px;padding:0;justify-content:center}html.xg-dispositivo-movel #som-botao span{display:none}";
    var botao = document.createElement("button");
    botao.id = "som-botao"; botao.type = "button"; botao.hidden = true; botao.setAttribute("data-sem-traducao", "");
    function desenhar() {
      var c = calado(), idioma = window.TPD_IDIOMAS && TPD_IDIOMAS.atual ? TPD_IDIOMAS.atual() : "pt", n = NOMES[idioma] || NOMES.pt;
      botao.innerHTML = (c ? CALADO : ALTO) + "<span></span>";
      botao.lastChild.textContent = n[c ? 1 : 0];
      botao.setAttribute("aria-pressed", String(c));
      botao.setAttribute("aria-label", n[c ? 3 : 2]); botao.title = n[c ? 3 : 2];
    }
    function aparecer() { botao.hidden = !(window.PAUSA_SIM && PAUSA_SIM.emOperacao) || !!PAUSA_SIM.pausado; }
    botao.onclick = function () {
      var c = !calado();
      if (window.xgSons && xgSons.mudo) xgSons.mudo(c);
      else { try { localStorage.setItem("tpd_sons", c ? "0" : "1"); } catch (e) { /* sem armazenamento */ } }
      desenhar();
      window.dispatchEvent(new CustomEvent("som-simulador", { detail: !c }));
    };
    /* o toque no botao nao pode virar comando do jogo (o campo ouve o teclado e o ponteiro da pagina) */
    ["pointerdown", "pointerup", "touchstart", "touchend", "keydown"].forEach(function (t) { botao.addEventListener(t, function (e) { e.stopPropagation(); }); });
    function montar() { document.head.appendChild(estilo); document.body.appendChild(botao); desenhar(); aparecer(); }
    if (document.body) montar(); else document.addEventListener("DOMContentLoaded", montar);
    window.addEventListener("operacao-simulador", aparecer); window.addEventListener("pausa-simulador", aparecer);
    window.addEventListener("tpd:idioma", desenhar);
  })();

  if (MARCA === "eavision") return;

  /* frequência das pás (2 pás) no pairado vazio. T50: hélice de 54", ~1900 rpm
     pairando -> ~63 Hz. T25 é menor e gira mais rápido. */
  /* T100 (62") gira mais devagar; T10 (33") bem mais rapido. Pesos das fichas. */
  var SOM = { t25: [78, 32, 52], t100: [52, 75, 175], t70p: [52, 56, 126], t10: [110, 16.8, 24.8], c31: [48, 94, 274], air2s: [250, 0.595, 0.6],
    p60: [66, 41, 91], p100pro: [60, 48, 98], p150max: [52, 60, 136], p150: [54, 54, 124] }[MODELO] || [63, 52, 92];   // C31: helice ~61", 13/10/2026; Air 2S: 7,2", ~7500 rpm
  var F_PAS = SOM[0];
  /* peso de decolagem: vazio com bateria e máximo pulverizando (kg) */
  var PESO_VAZIO = SOM[1];
  var PESO_MAX = SOM[2];
  /* ajustado pelo medidor (xgSons.medir): marcha lenta a 12 m perto do bipe */
  var VOLUME_MOTOR = 1;

  var ctx = null, mestre = null, motor = null, medidor = null;
  var mudo = false;
  try { mudo = localStorage.getItem("tpd_sons") === "0"; } catch (e) { mudo = false; }

  /* ------------------------------------------------------------ áudio */

  function criarContexto() {
    if (ctx) return ctx;
    var A = window.AudioContext || window.webkitAudioContext;
    if (!A) return null;
    try { ctx = new A(); } catch (e) { ctx = null; return null; }
    mestre = ctx.createGain();
    mestre.gain.value = 0;
    mestre.connect(ctx.destination);
    medidor = ctx.createAnalyser();
    medidor.fftSize = 4096;
    mestre.connect(medidor);
    return ctx;
  }

  function destravar() {
    if (!criarContexto()) return;
    if (ctx.state === "suspended") { try { ctx.resume().catch(function () {}); } catch (e) { /* segue */ } }
  }

  /* os toques dentro das molduras (campo, controle) não chegam a este
     documento: cada uma recebe o ouvinte quando carrega */
  var ouvidos = typeof WeakSet === "function" ? new WeakSet() : null;
  function ouvirToques(doc) {
    if (!doc || (ouvidos && ouvidos.has(doc))) return;
    if (ouvidos) ouvidos.add(doc);
    doc.addEventListener("pointerdown", destravar, true);
    doc.addEventListener("keydown", destravar, true);
    doc.addEventListener("touchend", destravar, true);
  }
  ouvirToques(document);

  function ruidoRosa(segundos) {
    var n = Math.floor(ctx.sampleRate * segundos);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  function posicionar(p, x, y, z) {
    if (p.positionX) {
      var t = ctx.currentTime;
      p.positionX.setTargetAtTime(x, t, 0.05);
      p.positionY.setTargetAtTime(y, t, 0.05);
      p.positionZ.setTargetAtTime(z, t, 0.05);
    } else if (p.setPosition) p.setPosition(x, y, z);
  }

  /* Oito hélices fora de fase: três serras levemente desafinadas dão o
     corpo grave e o "uóm-uóm" do batimento; ruído em banda média cortado no
     ritmo das pás é o "tchop-tchop" (é o que sai em alto-falante de celular e
     notebook, que não tocam os 60 Hz das pás); ruído largo é o sopro; um
     triângulo agudo é o assobio dos motores.
     09/10: a 1ª versão ficou 20 dB abaixo do bipe (-43 dB a 12 m na marcha
     lenta) e quase toda abaixo de 200 Hz: o Eduardo não ouviu o motor. */
  function montarMotor() {
    var m = { r: 0 };
    m.saida = ctx.createGain();
    m.saida.gain.value = 0;
    m.lugar = ctx.createPanner();
    m.lugar.panningModel = "equalpower";
    m.lugar.distanceModel = "inverse";
    m.lugar.refDistance = 12;
    m.lugar.maxDistance = 3000;
    m.lugar.rolloffFactor = 0.7;
    posicionar(m.lugar, 0, 0, -12);
    m.saida.connect(m.lugar);
    m.lugar.connect(mestre);

    m.grave = ctx.createBiquadFilter();
    m.grave.type = "lowpass";
    m.grave.frequency.value = 600;
    m.grave.Q.value = 0.7;
    m.grave.connect(m.saida);
    m.pas = [0.985, 1, 1.021].map(function (k) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = 1;
      g.gain.value = 0.3;
      o.connect(g); g.connect(m.grave);
      o.start();
      return { o: o, k: k };
    });

    var ruido = ruidoRosa(3);
    /* "tchop": ruído médio com o volume batendo na frequência das pás */
    m.ruidoChop = ctx.createBufferSource();
    m.ruidoChop.buffer = ruido; m.ruidoChop.loop = true;
    m.bandaChop = ctx.createBiquadFilter();
    m.bandaChop.type = "bandpass"; m.bandaChop.frequency.value = 800; m.bandaChop.Q.value = 0.8;
    m.chop = ctx.createGain();
    m.chop.gain.value = 1.4;
    m.ritmo = ctx.createOscillator();
    m.ritmo.type = "sine"; m.ritmo.frequency.value = 1;
    var fundo = ctx.createGain();
    fundo.gain.value = 1.1;
    m.ritmo.connect(fundo); fundo.connect(m.chop.gain);
    m.ruidoChop.connect(m.bandaChop); m.bandaChop.connect(m.chop); m.chop.connect(m.saida);
    m.ruidoChop.start(); m.ritmo.start();

    /* sopro largo (outro ponto do mesmo ruído, para não somar igual) */
    m.ruido = ctx.createBufferSource();
    m.ruido.buffer = ruido; m.ruido.loop = true;
    m.banda = ctx.createBiquadFilter();
    m.banda.type = "bandpass"; m.banda.frequency.value = 400; m.banda.Q.value = 0.5;
    var gRuido = ctx.createGain();
    gRuido.gain.value = 1.6;
    m.ruido.connect(m.banda); m.banda.connect(gRuido); gRuido.connect(m.saida);
    m.ruido.start(0, 1.37);

    m.assobio = ctx.createOscillator();
    m.assobio.type = "triangle";
    m.assobio.frequency.value = 1;
    m.gAssobio = ctx.createGain();
    m.gAssobio.gain.value = 0;
    m.assobio.connect(m.gAssobio); m.gAssobio.connect(m.saida);
    m.assobio.start();
    return m;
  }

  /* r: rotação relativa ao pairado vazio (0 parado, ~0,45 marcha lenta) */
  function tocarMotor(r, rel, forca) {
    if (!motor) motor = montarMotor();
    var t = ctx.currentTime, f = Math.max(1, F_PAS * r);
    motor.pas.forEach(function (p) { p.o.frequency.setTargetAtTime(f * p.k, t, 0.06); });
    motor.ritmo.frequency.setTargetAtTime(f, t, 0.06);
    motor.grave.frequency.setTargetAtTime(350 + 900 * r, t, 0.08);
    motor.bandaChop.frequency.setTargetAtTime(500 + 700 * r, t, 0.08);
    motor.banda.frequency.setTargetAtTime(250 + 450 * r, t, 0.08);
    motor.assobio.frequency.setTargetAtTime(Math.max(1, f * 13), t, 0.06);
    motor.gAssobio.gain.setTargetAtTime(r > 0.05 ? 0.035 * r : 0, t, 0.08);
    /* marcha lenta já bem audível; cheio e subindo, mais forte */
    var g = r <= 0 ? 0 : Math.min(1, r / 0.4) * (0.35 + 0.35 * r);
    /* 19/11/2026 (Eduardo: "quando o badeco chega perto pra brigar o som do drone baixa"): enquanto o auxiliar fala
       (falar_auxiliar.js chama xgSons.abafar), o motor cai a um quarto do volume, para a fala aparecer */
    abafa += (abafaAlvo - abafa) * 0.2;
    motor.saida.gain.setTargetAtTime(VOLUME_MOTOR * g * abafa * (forca == null ? 1 : forca), t, 0.06);
    if (rel) posicionar(motor.lugar, rel[0], rel[1], rel[2]);
  }

  /* bipe do alto-falante do controle: está na mão do piloto, então não
     depende de onde a câmera está */
  function bipe(freq, inicio, dur, vol) {
    if (!ctx || ctx.state !== "running" || mudo) return;
    var t = ctx.currentTime + (inicio || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    vol = vol || 0.16;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setValueAtTime(vol, t + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(mestre);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /* 20/11/2026 (Eduardo, com o video do P60 de verdade no "Teste parado": "no momento q arrasta e da um som é esse o
     som que tem q dar"): os tres apitos que os motores do XAG dao antes de girar, medidos no som do video (IMG_7320.MOV,
     aos 12,41 s e de novo aos 38,68 s): 2048 Hz por 0,28 s, pausa, 2320 Hz por 0,17 s e 3200 Hz por 0,24 s; 1,0 s do
     comeco do primeiro ao fim do terceiro. Sao tons quase puros (o primeiro traz o dobro da frequencia a -7 dB); cada
     um acaba seco e deixa um resto fraco, o eco do lugar. Lista: [Hz, comeco (s), duracao (s), parte do dobro]. */
  var APITO_XAG = [[2048, 0, 0.28, 0.45], [2320, 0.557, 0.17, 0.08], [3200, 0.764, 0.24, 0.03]];
  function apitoXag(forca) {
    if (!ctx || ctx.state !== "running" || mudo) return;
    var vol = 0.2 * (forca || 1);
    APITO_XAG.forEach(function (a) {
      var t = ctx.currentTime + a[1], fim = t + a[2], g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.setValueAtTime(vol, fim - 0.01);
      g.gain.linearRampToValueAtTime(vol * 0.09, fim + 0.012);
      g.gain.exponentialRampToValueAtTime(vol * 0.002, fim + 0.3);
      g.gain.linearRampToValueAtTime(0, fim + 0.32);
      g.connect(mestre);
      [[1, 1], [2, a[3]]].forEach(function (h) {
        var o = ctx.createOscillator(), gh = ctx.createGain();
        o.type = "sine"; o.frequency.value = a[0] * h[0]; gh.gain.value = h[1];
        o.connect(gh); gh.connect(g);
        o.start(t); o.stop(fim + 0.34);
      });
    });
  }
  /* forca do proximo apito: 1 = os quatro motores; o Teste parado manda menos quando liga um motor so */
  var forcaApito = 1;

  var SONS = {
    ligou: function () { bipe(988, 0, 0.11); bipe(1319, 0.13, 0.11); bipe(1760, 0.26, 0.2); },
    desligou: function () { bipe(1760, 0, 0.11); bipe(1319, 0.13, 0.11); bipe(988, 0.26, 0.22); },
    rthComecou: function () { bipe(1568, 0, 0.45, 0.18); },
    rthAlerta: function () { bipe(1568, 0, 0.12); bipe(1568, 0.22, 0.12); },
    /* 19/11/2026 (Eduardo, XAG: "quando o drone vai decolar ele da um apito antes de ligar a helice"): o campo segura a
       aeronave 1 s no chao, com as helices paradas (V.xgApito), e conta o apito em V.xgApitoN.
       20/11/2026: o som deixou de ser o bipe inventado (2350 Hz por 0,85 s) e passou a ser o do aparelho (apitoXag) */
    apito: function () { apitoXag(forcaApito); }
  };
  /* os últimos sons tocados, para conferir no console (xgSons.estado) */
  var tocados = [];
  Object.keys(SONS).forEach(function (nome) {
    var tocar = SONS[nome];
    SONS[nome] = function () {
      tocados.push(nome + (mudo ? " (mudo)" : ""));
      if (tocados.length > 8) tocados.shift();
      tocar();
    };
  });

  /* ------------------------------------------------------------ leitura */

  function janela(id) {
    var f = document.getElementById(id);
    try { return f && f.contentWindow; } catch (e) { return null; }
  }

  /* o controle DJI é o controle/index.html; o XAG troca a moldura */
  function controleDji(jc) {
    try { return !!jc && /\/controle\/index\.html/.test(jc.location.pathname); } catch (e) { return false; }
  }

  /* função de leitura posta dentro do campo (lá V, drone e cam são
     declarações de topo, que só se alcançam por código rodado lá) */
  var LEITOR =
    "window.__xgSomLer=function(){" +
    "if(typeof V==='undefined'||typeof drone==='undefined'||!inclina.children.length)return null;" +
    "var gira=!!V.rodando&&['reabastecendo','concluído','em solo'].indexOf(V.estado)<0&&!(V.estado==='caiu'&&V.noChao)&&!(V.xgApito>0);" +
    "var d=drone.position,rel=d.clone(),c=null,vr=!!(render.xr&&render.xr.isPresenting);" +
    "if(vr)c=render.xr.getCamera();else if(!(vista==='controle'&&!modoMapa))c=cam;" +
    "if(c){c.updateMatrixWorld();c.worldToLocal(rel);}" +
    "else{var o=grupoOperador.position;rel.set(0,0,-Math.hypot(d.x-o.x,d.y-o.y-1.6,d.z-o.z));}" +
    "return{g:gira,e:V.estado,t:+V.tan||0,cap:T50.tanque||40,x:d.x,y:d.y,z:d.z,ch:d.y<=alt(d.x,d.z)+0.05," +
    "p:!!(window.PAUSA_SIM&&PAUSA_SIM.pausado),r:[rel.x,rel.y,rel.z],ap:V.xgApitoN||0," +
    /* Teste parado do XAG (xag_servicos.js poe o xgTesteParado no campo): quanto dos motores gira (0 a 1), os apitos e a forca deles */
    "tp:window.xgTesteParado?xgTesteParado.nivel:0,tpa:window.xgTesteParado?xgTesteParado.apitos:0,tpv:window.xgTesteParado?xgTesteParado.forca:1};};";

  function lerCampo(jw) {
    try {
      if (typeof jw.__xgSomLer !== "function") jw.eval(LEITOR);
      return jw.__xgSomLer();
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ laço */

  var PASSO = 0.05;
  var faseAntes = null, ant = null, vy = 0, vh = 0;
  var rth = false, proxAlerta = 0, apAntes = null, abafa = 1, abafaAlvo = 1, tpAntes = null;

  function alvoDoMotor(s) {
    if (!s) return 0;
    /* Teste parado do XAG: no chao, so os motores ligados na tela giram, em marcha lenta */
    if (!s.g) return s.tp > 0.005 ? 0.45 : 0;
    /* no chão com os motores ligados (CSC, antes de acelerar): marcha lenta */
    if (s.ch && (s.e === "manual" || s.e === "caiu")) return 0.45;
    var peso = PESO_VAZIO + Math.min(1, Math.max(0, s.t) / (s.cap || 40)) * (PESO_MAX - PESO_VAZIO);
    var r = Math.sqrt(peso / PESO_VAZIO);
    r += 0.07 * Math.max(-3, Math.min(6, vy));   /* subir pede mais, descer menos */
    r += 0.012 * Math.min(12, vh);                /* inclinar para andar */
    return Math.max(0.5, Math.min(1.5, r));
  }

  function passo() {
    var jc = janela("controle"), jw = janela("campo");
    if (jc) { try { ouvirToques(jc.document); } catch (e) { /* recarregando */ } }
    if (jw) { try { ouvirToques(jw.document); } catch (e) { /* recarregando */ } }
    if (!ctx || !(XAG || controleDji(jc))) return;
    if (ctx.state === "suspended") { try { ctx.resume().catch(function () {}); } catch (e) { /* segue */ } }
    if (ctx.state !== "running") return;

    var s = jw ? lerCampo(jw) : null;
    var pausado = !!(window.PAUSA_SIM && window.PAUSA_SIM.pausado) || !!(s && s.p);
    var calado = mudo || pausado || document.hidden;
    mestre.gain.setTargetAtTime(calado ? 0 : 0.85, ctx.currentTime, calado ? 0.03 : 0.15);

    /* botão de energia do controle */
    var fase = null;
    if (!XAG) { try { fase = jc.eval("typeof faseControle!=='undefined'?faseControle:null"); } catch (e) { fase = null; } }
    if (!XAG && faseAntes !== null && fase !== faseAntes) {
      if (fase === "logo") SONS.ligou();
      else if (fase === "desligado" && faseAntes !== "armado") SONS.desligou();
    }
    faseAntes = fase;

    /* apito antes de ligar as helices (XAG): toca quando o contador do campo sobe */
    if (s) {
      if (apAntes !== null && s.ap > apAntes && !calado) SONS.apito();
      apAntes = s.ap;
      /* o mesmo apito no Teste parado: mais fraco quando liga menos motores */
      if (tpAntes !== null && s.tpa > tpAntes && !calado) { forcaApito = s.tpv || 1; SONS.apito(); forcaApito = 1; }
      tpAntes = s.tpa || 0;
    }

    /* motores */
    if (s) {
      if (ant) {
        var dy = (s.y - ant.y) / PASSO, dh = Math.hypot(s.x - ant.x, s.z - ant.z) / PASSO;
        if (dy > 30 || dh > 60) { dy = 0; dh = 0; }  /* reposicionou (recomeço) */
        vy += (dy - vy) * 0.25; vh += (dh - vh) * 0.25;
      }
      ant = s;
    }
    var alvo = calado ? motor ? motor.r : 0 : alvoDoMotor(s);
    if (motor || alvo > 0) {
      if (!motor) motor = montarMotor();
      /* hélice grande: sobe em ~0,6 s e para em ~2 s */
      var tau = alvo > motor.r ? 0.25 : (alvo === 0 ? 0.7 : 0.35);
      motor.r += (alvo - motor.r) * (1 - Math.exp(-PASSO / tau));
      if (motor.r < 0.01 && alvo === 0) motor.r = 0;
      /* Teste parado: um motor so soa mais fraco que os quatro (raiz da parte que gira) */
      tocarMotor(motor.r, s && s.r, s && !s.g && s.tp > 0 ? Math.sqrt(Math.min(1, s.tp)) : 1);
    }

    /* RTH: começa no "voltando" e segue no pouso que vem dele */
    var e = s ? s.e : null;
    if (XAG) e = null;   /* os alertas de RTH sao do controle DJI */
    if (e === "voltando" && !rth && !calado) { rth = true; SONS.rthComecou(); proxAlerta = ctx.currentTime + 1.4; }
    else if (rth && e !== "voltando" && e !== "pousando") rth = false;
    if (rth && !calado && ctx.currentTime >= proxAlerta) { SONS.rthAlerta(); proxAlerta = ctx.currentTime + 2; }
  }

  /* setInterval e não requestAnimationFrame: no óculos (WebXR) o quadro da
     página para, e o som tem de continuar */
  setInterval(function () { try { passo(); } catch (e) { /* nunca derruba o simulador */ } }, PASSO * 1000);

  window.xgSons = {
    abafar: function (sim) { abafaAlvo = sim ? 0.25 : 1; return abafaAlvo; },
    mudo: function (sim) {
      mudo = !!sim;
      try { localStorage.setItem("tpd_sons", mudo ? "0" : "1"); } catch (e) { /* sem armazenamento */ }
      return mudo;
    },
    estado: function () {
      return { contexto: ctx ? ctx.state : "sem toque ainda", mudo: mudo, rotacao: motor ? +motor.r.toFixed(2) : 0,
               rth: rth, faseControle: faseAntes, sobe: +vy.toFixed(2), anda: +vh.toFixed(2),
               tocados: tocados.slice() };
    },
    /* nível que sai agora (dB de pico cheio): total e só acima de 200 Hz,
       o que alto-falante de celular e notebook consegue tocar */
    medir: function () {
      if (!medidor) return null;
      var n = medidor.frequencyBinCount, f = new Float32Array(n), w = new Float32Array(medidor.fftSize);
      medidor.getFloatFrequencyData(f); medidor.getFloatTimeDomainData(w);
      var q = 0, i, alto = 0, tudo = 0, hz = ctx.sampleRate / medidor.fftSize;
      var pico = 0;
      for (i = 0; i < w.length; i++) { q += w[i] * w[i]; pico = Math.max(pico, Math.abs(w[i])); }
      for (i = 1; i < n; i++) { var e = Math.pow(10, f[i] / 10); tudo += e; if (i * hz >= 200) alto += e; }
      return { rmsDb: +(10 * Math.log10(q / w.length + 1e-12)).toFixed(1),
               picoDb: +(20 * Math.log10(pico + 1e-9)).toFixed(1),
               acima200Hz: +(100 * alto / (tudo || 1)).toFixed(0) + "%" };
    },
    tocar: function (nome) { destravar(); if (SONS[nome]) SONS[nome](); }
  };
})();
