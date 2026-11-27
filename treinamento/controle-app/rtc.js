/* ==========================================================================
   Câmera do drone por WebRTC.

   O jogo (navegador do PC/TV) manda o canvas da câmera como VÍDEO de verdade
   (comprimido pela placa de vídeo), direto para este controle pela rede da
   casa. Aqui o vídeo vai num <video> dentro da janela da câmera (#fpv), que o
   próprio Chrome decodifica fora da linha principal. O aperto de mão
   (oferta/resposta) passa por /sinal (hoje a ponte do PC; na internet, o
   Firebase). Enquanto o WebRTC não conecta, ou se cair, fica o vídeo antigo
   (JPEG pela ponte, nucleo.js).
   ========================================================================== */
"use strict";
var RTC = (function () {
  var pc = null, idOferta = null, fase = "parado", tentarEm = 0, pedidoEm = 0;
  var canalEstado = null, canalManches = null;

  /* ---- aperto de mão pela internet (sem a ponte do PC)
     Desde 06/10/2026 pela CONTA do Treinamento (conta.js): o documento é
     sinalConta/{uid}/aparelhos/{aparelho} e só a própria conta lê e grava
     (firestore.rules), sempre com o token dela. Este app escreve "pede", o
     simulador aberto na mesma conta grava a oferta e o app grava a resposta.
     O número de cadastro antigo (sinal/{número}) não é mais usado aqui. */
  var NUVEM = "https://firestore.googleapis.com/v1/projects/guridosdrones-treinamento/databases/(default)/documents/sinalConta/";
  var CHAVE_API = "AIzaSyDELlE6eAF-wqlYaBSh1tmIxyd908wQWGc";     // chave pública do site (conta/config.js)
  var modo = "ponte", ofertaVelha = null, falhasNuvem = 0;
  function contaPronta() { return !!(window.CONTA_CONTROLE && CONTA_CONTROLE.ativo && CONTA_CONTROLE.logado()); }
  function enderecoSinal() { return NUVEM + CONTA_CONTROLE.uid() + "/aparelhos/" + CONTA_CONTROLE.aparelho(); }
  function comToken(fn) {
    return CONTA_CONTROLE.token().then(function (t) { return fn({ Authorization: "Bearer " + t }); });
  }
  function ponteViva() { return Date.now() - (APP.ponteEm || 0) < 4000; }
  function valor(v) {
    if (!v) return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("mapValue" in v) { var o = {}, f = v.mapValue.fields || {}; for (var k in f) o[k] = valor(f[k]); return o; }
    return null;
  }
  function lerSinal() {
    return comToken(function (cab) {
      return fetch(enderecoSinal() + "?key=" + CHAVE_API, { cache: "no-store", headers: cab });
    }).then(function (r) { return r.status === 404 ? { fields: {} } : r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        var o = {}, f = j.fields || {};
        for (var k in f) o[k] = valor(f[k]);
        return o;
      });
  }
  function gravarSinal(campo, v) {
    return comToken(function (cab) {
      cab["Content-Type"] = "application/json";
      return fetch(enderecoSinal() + "?updateMask.fieldPaths=" + campo + "&key=" + CHAVE_API, {
        method: "PATCH", cache: "no-store", headers: cab,
        body: JSON.stringify({ fields: (function () { var o = {}; o[campo] = v; return o; })() })
      });
    }).then(function (r) { if (!r.ok) throw new Error("sinal " + r.status); });
  }

  /* estado do jogo que chegou pelo WebRTC: entra igual ao que vem do app
     Android (nucleo.js puxarEstado), que fica de reserva */
  function estadoPeloRtc(txt) {
    var m; try { m = JSON.parse(txt); } catch (e) { return; }
    var e = m && m.e;
    if (!e) return;
    if (e.rota === "igual") e.rota = APP.rota; else APP.rota = e.rota;
    var a = APP.E;
    if (a && a.d && e.d && e.t > a.t && e.t - a.t < 500) {
      var sg = (e.t - a.t) / 1000;
      APP.vel = { x: (e.d.x - a.d.x) / sg, z: (e.d.z - a.d.z) / sg };
    }
    if (a && e.t <= a.t) return;            // o da reserva já era mais novo
    APP.E = e;
    if (window.TPD_IDIOMAS) TPD_IDIOMAS.receber(e);
    APP.recebido = Date.now();
    APP.rtcEm = Date.now();
  }

  /* manches pelo WebRTC, 50 vezes por segundo (lidos na hora do app Android) */
  setInterval(function () {
    if (!cadastroLiberado()) return;
    if (!canalManches || canalManches.readyState !== "open" || !window.RCPLUS) return;
    if (canalManches.bufferedAmount > 4096) return;   // rede apertada: não empilha
    try { canalManches.send(window.RCPLUS.manches()); } catch (e) { /* caiu */ }
  }, 20);
  var caixa = $("#fpv"), video = document.createElement("video");
  video.id = "fpv-video";
  video.autoplay = true; video.muted = true; video.playsInline = true;
  video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
  caixa.insertBefore(video, caixa.firstChild);

  function fechar() {
    if (pc) { try { pc.close(); } catch (e) { /* já */ } }
    pc = null; idOferta = null; canalEstado = null; canalManches = null;
    if (caixa.classList.contains("rtc")) {
      caixa.classList.remove("rtc");
      if (window.ligarVideo) ligarVideo();     // volta o vídeo antigo
    }
  }

  function esperarIce(p) {
    return new Promise(function (ok) {
      if (p.iceGatheringState === "complete") return ok();
      var t = setTimeout(ok, 1500);
      p.addEventListener("icegatheringstatechange", function () {
        if (p.iceGatheringState === "complete") { clearTimeout(t); ok(); }
      });
    });
  }

  /* pede uma oferta nova ao jogo (pela ponte ou pela internet) e espera ela chegar */
  function comecar(pelaNuvem) {
    fase = "pedindo"; pedidoEm = Date.now(); modo = pelaNuvem ? "nuvem" : "ponte";
    if (!pelaNuvem) { fetch("/sinal?novo=1&t=" + Date.now(), { cache: "no-store" }).catch(function () {}); return; }
    /* a oferta que já estava lá é velha: só vale uma com outro id */
    ofertaVelha = undefined;
    lerSinal().then(function (s) {
      ofertaVelha = s && s.oferta ? s.oferta.id : null;
      return gravarSinal("pede", { integerValue: String(Date.now()) });
    }).catch(function () { fase = "parado"; tentarEm = Date.now() + esperaNuvem(); });
  }
  function esperaNuvem() { falhasNuvem++; return Math.min(30000, 4000 * falhasNuvem); }

  function buscarOferta() {
    if (modo === "nuvem") {
      if (ofertaVelha === undefined) return Promise.resolve(null);   // ainda pedindo
      return lerSinal().then(function (s) {
        var o = s && s.oferta;
        return o && o.sdp && o.id !== ofertaVelha ? { id: o.id, sdp: o.sdp } : null;
      });
    }
    return fetch("/sinal?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (t) { try { return JSON.parse(t); } catch (e) { return null; } });
  }

  function responder(o) {
    fechar();
    fase = "conectando"; idOferta = o.id;
    var p = pc = new RTCPeerConnection({ iceServers: modo === "nuvem" ? [{ urls: "stun:stun.l.google.com:19302" }] : [] });
    /* canais de dados que o jogo abriu: estado/comandos e manches */
    p.ondatachannel = function (ev) {
      var ch = ev.channel;
      if (ch.label === "estado") {
        canalEstado = ch;
        ch.onmessage = function (m) { if (pc === p) estadoPeloRtc(m.data); };
        ch.onclose = function () { if (canalEstado === ch) canalEstado = null; };
      } else if (ch.label === "manches") {
        canalManches = ch;
        ch.onclose = function () { if (canalManches === ch) canalManches = null; };
      }
    };
    p.ontrack = function (ev) {
      if (pc !== p) return;
      video.srcObject = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
      var tocar = video.play();
      if (tocar && tocar.catch) tocar.catch(function () {});
    };
    p.onconnectionstatechange = function () {
      if (pc !== p) return;
      if (p.connectionState === "failed" || p.connectionState === "closed" || p.connectionState === "disconnected") {
        fechar(); fase = "parado"; tentarEm = Date.now() + 3000;
      }
    };
    p.setRemoteDescription({ type: "offer", sdp: o.sdp })
      .then(function () { return p.createAnswer(); })
      .then(function (a) { return p.setLocalDescription(a); })
      .then(function () { return esperarIce(p); })
      .then(function () {
        if (pc !== p) return;
        if (modo === "nuvem") {
          return gravarSinal("resposta", { mapValue: { fields: {
            id: { integerValue: String(o.id) }, sdp: { stringValue: p.localDescription.sdp } } } });
        }
        var r = JSON.stringify({ id: o.id, sdp: p.localDescription.sdp });
        return fetch("/sinal?r=" + encodeURIComponent(r) + "&t=" + Date.now(), { cache: "no-store" });
      })
      .catch(function () { if (pc === p) { fechar(); fase = "parado"; tentarEm = Date.now() + 3000; } });
  }

  /* o vídeo começou a mostrar imagem: esconde o vídeo antigo e para o JPEG */
  video.addEventListener("playing", function () {
    if (!pc) return;
    fase = "ativo"; falhasNuvem = 0;
    caixa.classList.add("rtc");
    if (window.pararVideo) pararVideo();
  });

  /* relógio do aperto de mão */
  /* com a ponte do PC (em casa) o aperto de mão vai por ela; sem ela (site
     pela internet), pelo Firebase. Pela internet não há "conectado" antes do
     WebRTC: é ele que traz o estado */
  var lida = 0;
  setInterval(function () {
    if (!cadastroLiberado()) { fechar(); fase = "parado"; tentarEm = 0; return; }
    if (!window.RTCPeerConnection) return;
    var agora = Date.now(), ponte = ponteViva();
    if (fase === "parado" && agora >= tentarEm) {
      if (ponte) return comecar(false);
      if (contaPronta()) return comecar(true);
      return;
    }
    if (fase === "pedindo") {
      var limite = modo === "nuvem" ? 12000 : 8000;
      if (agora - pedidoEm > limite) { fase = "parado"; tentarEm = agora + (modo === "nuvem" ? esperaNuvem() : 5000); return; }
      /* pela internet, lê o Firebase a cada 1,2 s (não a cada 0,6) */
      if (modo === "nuvem" && agora - lida < 1100) return;
      lida = agora;
      buscarOferta().then(function (o) { if (fase === "pedindo" && o && o.sdp) responder(o); }).catch(function () {});
      return;
    }
    if (fase === "conectando" && pc && agora - pedidoEm > 15000 && !caixa.classList.contains("rtc")) {
      fechar(); fase = "parado"; tentarEm = agora + 5000;
    }
  }, 600);

  /* sem aeronave: derruba (volta quando reconectar) */
  ouvir("conexao", function (vivo) {
    if (vivo || (modo === "nuvem" && fase === "conectando")) return;
    fechar(); fase = "parado"; tentarEm = 0;
  });

  return {
    /* comando do app para o jogo pelo WebRTC (nucleo.js cmd); false = usar a ponte */
    cmd: function (o) {
      if (!cadastroLiberado()) return true;
      if (!canalEstado || canalEstado.readyState !== "open") return false;
      try { o.t = "cmd"; canalEstado.send(JSON.stringify(o)); return true; } catch (e) { return false; }
    },
    estado: function () { return { fase: fase, modo: modo, conta: contaPronta(), conexao: pc ? pc.connectionState : null, ativo: caixa.classList.contains("rtc"), w: video.videoWidth, h: video.videoHeight }; },
    medir: function () {
      var q = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
      return q ? { mostrados: q.totalVideoFrames, perdidos: q.droppedVideoFrames } : null;
    }
  };
})();
