/* Celular XAG: sinalizacao pelo mesmo cadastro do APK RC Plus, canal proprio.
   O telefone envia mapas/comandos; somente o simulador executa o voo. */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search), codigo = q.get("celular");
  if (q.get("marca") !== "xag" || !/^XAG[A-Z0-9]{9}$/.test(codigo || "") || q.get("controle") !== codigo) return;
  var pc = null, canal = null, ref = null, pedido = null, ofertaId = 0, conectado = false;
  var escutando = false, autorizado = false, fotoEnviada = null, filaFoto = [], estadoEm = 0, fotoTentadaEm = 0;
  var desligarSinal = null, pararCadastro = null;
  var fpvAte = 0, fpvEnviado = null;   // camera do P60 pedida pelo celular (camera_p60.js)
  function fechar() {
    conectado = false; canal = null; filaFoto = []; fotoEnviada = null;
    if (pc) pc.close(); pc = null;
  }
  function enviar(m) {
    if (canal && canal.readyState === "open" && canal.bufferedAmount < 262144) canal.send(JSON.stringify(m));
  }
  function vinculo() { return window.XG && XG.vinculo && XG.vinculo(); }
  function mapaSeguro(m) {
    if (!m || !Array.isArray(m.points) || m.points.length < 3 || m.points.length > 1000) throw new Error("Mapa invalido.");
    var r = {}, lista = ["points", "lotClosed", "obstacles", "obstaclePolygons", "zones", "markers", "operationPoints", "routeNodes", "connectionNodes", "name", "route", "angle", "spacing", "height", "boundarySafety", "obstacleSafety", "terrainFollow", "opHeight", "opSpeed", "opVolume", "opDroplet", "opEntry", "opExit", "opRunning", "opChecks", "opCalibration", "opReturn", "xpPlano"];
    var n = 0;
    function valido(v, profundidade) {
      if (++n > 20000 || profundidade > 8) return false;
      if (v === null || typeof v === "boolean") return true;
      if (typeof v === "number") return Number.isFinite(v) && Math.abs(v) <= 10000;
      if (typeof v === "string") return v.length <= 200;
      if (Array.isArray(v)) return v.length <= 1000 && v.every(function (x) { return valido(x, profundidade + 1); });
      if (typeof v === "object") return Object.keys(v).every(function (k) { return !["__proto__", "constructor", "prototype"].includes(k) && valido(v[k], profundidade + 1); });
      return false;
    }
    lista.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(m, k)) { if (!valido(m[k], 0)) throw new Error("Dados do mapa invalidos."); r[k] = m[k]; } });
    if (!r.points.every(function (p) { return Array.isArray(p) && p.length === 2 && p.every(function (x) { return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 100; }); })) throw new Error("Pontos invalidos.");
    return r;
  }
  function receber(txt) {
    if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
    if (!autorizado || !conectado || typeof txt !== "string" || txt.length > 150000) return;
    var m, v = vinculo();
    if (!v || !v.ponte || !v.ponte.janela) return;
    try {
      m = JSON.parse(txt);
      if (m.t === "tela" && Number.isFinite(m.proporcao) && m.proporcao >= 0.2 && m.proporcao <= 2) {
        // A vista Controle pode estar fechada no PC. A fotografia usa as
        // dimensoes reais do celular, sem depender do iframe estar visivel.
        if (!v.xagProporcaoCelular) {
          v.xagProporcaoCelular = m.proporcao;
          v.proporcao = function () { return this.xagProporcaoCelular; };
          v.foto = null; fotoEnviada = null; filaFoto = [];
          if (v.plantarImagem()) v.fotoTipo = "portatil";
        }
        return;
      }
      if (m.t === "fpv") {
        if (!window.CAMERA_P60) return;
        if (m.camera === "frente" || m.camera === "baixo") CAMERA_P60.camera(m.camera);
        if (typeof m.luz === "boolean" && v.estadoDaOperacao && v.estadoDaOperacao().conectado) CAMERA_P60.luz(m.luz);
        fpvAte = m.ligar === true ? Date.now() + 2500 : 0;
        if (fpvAte) CAMERA_P60.pedirJpeg(2500);
        return;
      }
      if (m.t === "mapa" && ["complete", "generate-route", "op-start"].includes(m.acao)) {
        var salvo = mapaSeguro(m.mapa);
        if (v.ponte.ler("typeof V !== 'undefined' && V.rodando")) throw new Error("Pause e encerre o voo antes de trocar o mapa.");
        if (!v.foto) v.plantarImagem();
        v.janela().localStorage.setItem("guri-map-demo", JSON.stringify(salvo));
        var resultado = v.carregarTalhao(salvo);
        if (!resultado || resultado.erro) throw new Error(resultado && resultado.erro || "Nao foi possivel carregar o mapa.");
        if (m.acao === "op-start") {
          if (!salvo.opRunning) throw new Error("Conclua a conferencia da operacao.");
          v.decolar();
          if (!v.ponte.ler("typeof V !== 'undefined' && V.rodando")) throw new Error("Decolagem recusada. Confira os avisos do simulador.");
        }
        enviar({ t: "aviso", texto: m.acao === "op-start" ? "Operacao iniciada no simulador." : "Mapa enviado ao simulador." });
      } else if (m.t === "comando" && v.aparelho) {
        var funcoes = { pausar: "pairar", retomar: "retomar", rth: "voltarParaCasa", pulverizar: "alternarPulverizacao",
          /* Centro Rapido e Sistema de Propulsao (xag_servicos.js) */
          "marcha-lenta": "testeMarchaLenta", "teste-spray": "testePulverizacao", escorrer: "escorrer",
          "voo-in-situ": "testeVooInSitu", "parar-teste": "pararTeste" };
        if (Object.prototype.hasOwnProperty.call(funcoes, m.acao)) v.aparelho[funcoes[m.acao]]();
      }
    } catch (e) { enviar({ t: "aviso", texto: e.message || "Comando recusado." }); }
  }
  function esperarIce(p) {
    return new Promise(function (ok) {
      if (p.iceGatheringState === "complete") return ok();
      var t = setTimeout(ok, 5000);
      p.addEventListener("icegatheringstatechange", function () { if (p.iceGatheringState === "complete") { clearTimeout(t); ok(); } });
    });
  }
  async function ofertar() {
    fechar();
    var id = ofertaId = Date.now();
    var p = pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    var ch = canal = p.createDataChannel("xag-celular", { ordered: true });
    ch.onopen = function () {
      if (pc !== p) return;
      conectado = true;
      try { localStorage.setItem("tpd_xag_aparelho", "portatil"); } catch (e) {}
      enviar({ t: "aviso", texto: "Celular conectado ao simulador XAG." });
    };
    ch.onmessage = function (e) { if (pc === p) receber(e.data); };
    ch.onclose = function () { if (pc === p) conectado = false; };
    p.onconnectionstatechange = function () { if (pc === p && ["failed", "closed", "disconnected"].includes(p.connectionState)) fechar(); };
    try {
      await p.setLocalDescription(await p.createOffer()); await esperarIce(p);
      if (pc !== p || !autorizado) return;
      // O dono e conferido pela regra em controles/{codigo}; o uid nao fica exposto no sinal.
      await ref.set({ oferta: { id: id, sdp: p.localDescription.sdp }, uid: firebase.firestore.FieldValue.delete(), resposta: firebase.firestore.FieldValue.delete() }, { merge: true });
    } catch (e) { if (pc === p) fechar(); }
  }
  async function iniciar() {
    if (escutando || !window.TREINO_AUTORIZADO || !window.firebase) return;
    escutando = true;
    try {
      await window.TREINO_AUTORIZADO;
      if (!firebase.auth().currentUser) { escutando = false; return; }
      var uid = firebase.auth().currentUser.uid;
      pararCadastro = firebase.firestore().collection("controles").doc(codigo).onSnapshot(function (d) {
        autorizado = d.exists && d.data().uid === uid;
        if (!autorizado) { fechar(); if (desligarSinal) desligarSinal(); desligarSinal = null; return; }
        if (desligarSinal) return;
        ref = firebase.firestore().collection("sinal").doc(codigo);
        desligarSinal = ref.onSnapshot(function (snap) {
          var s = snap.exists && snap.data(); if (!s) return;
          if (s.pede && s.pede !== pedido && Math.abs(Date.now() - Number(s.pede)) < 60000) { pedido = s.pede; ofertar(); }
          if (pc && s.resposta && Number(s.resposta.id) === ofertaId && !pc.remoteDescription) pc.setRemoteDescription({ type: "answer", sdp: s.resposta.sdp }).catch(fechar);
        }, fechar);
      }, function () { autorizado = false; fechar(); });
    } catch (e) { fechar(); }
  }
  setInterval(function () {
    iniciar();
    if (!conectado || !autorizado) return;
    var v = vinculo(); if (!v || !v.ponte) return;
    if (Date.now() - estadoEm > 500) {
      estadoEm = Date.now();
      var e = v.ponte.estado();
      if (e) enviar({ t: "estado", idioma: window.TPD_IDIOMAS ? TPD_IDIOMAS.atual() : "pt", voo: e.voo, drone: e.drone, operacao: v.estadoDaOperacao ? v.estadoDaOperacao() : {conectado:false} });
    }
    if (fpvAte > Date.now() && window.CAMERA_P60 && canal && canal.bufferedAmount < 131072 && !filaFoto.length) {
      var q = CAMERA_P60.jpeg();
      if (q && q.id !== fpvEnviado && q.url.length < 140000) { fpvEnviado = q.id; enviar({ t: "fpvq", id: q.id, url: q.url }); }
    }
    if (!v.foto && Date.now() - fotoTentadaEm > 3000) { fotoTentadaEm = Date.now(); v.plantarImagem(); }
    var foto = v.foto && v.foto.imagem;
    if (foto && foto !== fotoEnviada && !filaFoto.length) {
      fotoEnviada = foto;
      var id = Date.now(), total = Math.ceil(foto.length / 12000);
      for (var i = 0; i < total; i++) filaFoto.push({ t: "foto", id: id, i: i, total: total, parte: foto.slice(i * 12000, (i + 1) * 12000) });
    }
    if (filaFoto.length && canal && canal.bufferedAmount < 65536) enviar(filaFoto.shift());
  }, 100);
  window.addEventListener("pagehide", function () { if (pararCadastro) pararCadastro(); if (desligarSinal) desligarSinal(); fechar(); });
})();
