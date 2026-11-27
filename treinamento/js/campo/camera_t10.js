/* ==========================================================================
   CAMERAS DO AGRAS T10 (16/10/2026)

   O T10 nao tem gimbal e nao gira o nariz para voar: ele vai e volta, de
   frente e de costas. Por isso tem DUAS cameras fixas no corpo, uma olhando
   para a frente e outra para tras (os dois modulos FPV do modelo), e o app
   mostra as duas ao mesmo tempo, em miniaturas que trocam de lugar com o mapa.

   Aqui, no campo:
   - a roda do mouse e o dial deixam de inclinar a camera (sem gimbal);
   - as duas cameras ficam presas ao corpo (inclinam e tombam com a aeronave);
   - quando o app pede imagem, um quadro de cada camera e desenhado no canto
     do canvas ANTES do quadro do jogo (que limpa tudo em seguida) e copiado
     para os <canvas> do app - o aluno nunca ve esse desenho.

   Modelo: no .glb do T10 as lentes tem o material "Lente" (uma na frente,
   outra atras); as pecas fixas sao juntadas por material (modelo_drone.js),
   entao o ponto de cada camera e a media dos vertices desse material de cada
   lado. Sem as lentes (outro modelo), mede a frente e a traseira do miolo.

   Nariz fixo (16/10/2026, mesma instalacao): na rota automatica o T10 nao gira
   o nariz para o alvo - a volta de cada passada e feita de re (ver "Rumo fixo
   nas passadas" abaixo). Os outros drones nao passam por aqui.

   Uso (principal.js, so no T10):  CAMERA_T10.instalar(ponte)
   O app (controle-app/t10.js) usa  top.CAMERA_T10.alvo(canvas, 'frente'|'tras', ligar)
   e top.CAMERA_T10.sentido()  (1 de frente, -1 de re) para trocar a camera grande.
   ========================================================================== */

window.CAMERA_T10 = (function () {
  "use strict";

  /* Roda DENTRO do campo (toString + eval): usa THREE, render, cena, drone,
     inclina e atualizarFpv. */
  function instalarNoCampo() {
    if (window.xgCamT10) return true;
    if (typeof THREE === "undefined" || typeof render === "undefined" || typeof cena === "undefined" ||
        typeof inclina === "undefined" || typeof camFpv === "undefined") return false;

    var C = window.xgCamT10 = {
      alvos: [], ultimo: 0, intervalo: 66, quadros: 0, cv: {}, ctx: {}, ancoras: null, ocupado: false,
      fov: 72, pitch: 6
    };

    /* Sem gimbal: quem escreve xgGimbal (dial, roda do mouse, pouso automatico)
       nao muda mais nada, e quem le recebe "sem gimbal". */
    try {
      Object.defineProperty(window, "xgGimbal", {
        configurable: true,
        get: function () { return undefined; },
        set: function () {}
      });
    } catch (e) { /* segue com o gimbal de antes */ }

    function medirAncoras() {
      inclina.updateMatrixWorld(true);
      var inv = new THREE.Matrix4().copy(inclina.matrixWorld).invert(), v = new THREE.Vector3();
      var zMax = -Infinity, zMin = Infinity, yMin = Infinity, yMax = -Infinity, n = 0;
      var lf = new THREE.Vector3(), lt = new THREE.Vector3(), nf = 0, nt = 0;
      inclina.traverse(function (o) {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || o.userData.xgCamT10) return;
        if (o.parent && o.parent.name === "xg-holofote") return;
        var pos = o.geometry.attributes.position, mat = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        var lente = !!(o.material && !Array.isArray(o.material) && o.material.name === "Lente");
        var passo = lente ? 1 : Math.max(1, Math.floor(pos.count / 4000));
        for (var k = 0; k < pos.count; k += passo) {
          v.fromBufferAttribute(pos, k).applyMatrix4(mat);
          if (lente) { if (v.z >= 0) { lf.add(v); nf++; } else { lt.add(v); nt++; } continue; }
          n++;
          if (v.y < yMin) yMin = v.y;
          if (v.y > yMax) yMax = v.y;
          if (Math.abs(v.x) < 0.18) { if (v.z > zMax) zMax = v.z; if (v.z < zMin) zMin = v.z; }
        }
      });
      if (!n && !nf) return null;
      var alt = yMax - yMin, frente = new THREE.Object3D(), tras = new THREE.Object3D();
      frente.name = "xg-cam-frente"; tras.name = "xg-cam-tras";
      frente.userData.xgCamT10 = tras.userData.xgCamT10 = true;
      if (nf && nt) {
        frente.position.copy(lf.multiplyScalar(1 / nf)).add(new THREE.Vector3(0, 0, 0.03));
        tras.position.copy(lt.multiplyScalar(1 / nt)).add(new THREE.Vector3(0, 0, -0.03));
      } else {
        frente.position.set(0, yMin + alt * 0.65, zMax + 0.05);
        tras.position.set(0, yMin + alt * 0.65, zMin - 0.05);
      }
      /* a camera do three olha para -Z: girada meia volta olha para +Z (o nariz).
         As duas olham um pouco para baixo. */
      frente.rotation.set(C.pitch * Math.PI / 180, Math.PI, 0);
      tras.rotation.set(-C.pitch * Math.PI / 180, 0, 0);
      inclina.add(frente); inclina.add(tras);
      return { frente: frente, tras: tras };
    }
    function ancoras() {
      var A = C.ancoras;
      if (A && A.frente.parent === inclina) return A;
      if (A) { [A.frente, A.tras].forEach(function (o) { if (o.parent) o.parent.remove(o); }); }
      C.ancoras = medirAncoras();
      return C.ancoras;
    }

    var cam = new THREE.PerspectiveCamera(C.fov, 16 / 9, 0.05, 2500);
    function poseDe(nome) {
      var A = ancoras();
      if (!A) return false;
      var o = nome === "tras" ? A.tras : A.frente;
      o.updateWorldMatrix(true, false);
      o.matrixWorld.decompose(cam.position, cam.quaternion, new THREE.Vector3());
      cam.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      return true;
    }

    function precisaImagem() {
      C.alvos = C.alvos.filter(function (a) { return a.t && a.t.isConnected; });
      return C.alvos.some(function (a) { return a.t.clientWidth > 0 && a.t.clientHeight > 0; });
    }

    function desenhar(nome, alvos) {
      var pr = render.getPixelRatio(), el = render.domElement;
      var W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
      var maior = 0;
      alvos.forEach(function (a) {
        var dpr = (a.t.ownerDocument.defaultView || window).devicePixelRatio || 1;
        maior = Math.max(maior, a.t.clientWidth * dpr / pr);
      });
      var w = Math.floor(Math.min(W, 960, Math.max(320, maior || 480))), h = Math.round(w * 9 / 16);
      if (!w || !h || h > H) return;
      var cv = C.cv[nome], ctx = C.ctx[nome];
      if (!cv) { cv = C.cv[nome] = document.createElement("canvas"); ctx = C.ctx[nome] = cv.getContext("2d"); }
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      if (!poseDe(nome)) return;
      cam.aspect = w / h; cam.fov = C.fov; cam.updateProjectionMatrix();
      render.setScissorTest(true);
      render.setScissor(0, 0, w, h);
      render.setViewport(0, 0, w, h);
      render.render(cena, cam);
      render.setScissorTest(false);
      render.setViewport(0, 0, W, H);
      ctx.drawImage(el, 0, (H - h) * pr, w * pr, h * pr, 0, 0, w, h);
      alvos.forEach(function (a) {
        var t = a.t, cw = t.clientWidth, ch = t.clientHeight;
        if (!cw || !ch) return;
        var dpr = (t.ownerDocument.defaultView || window).devicePixelRatio || 1;
        var TW = Math.round(cw * dpr), TH = Math.round(ch * dpr);
        if (t.width !== TW) t.width = TW;
        if (t.height !== TH) t.height = TH;
        /* preenche cortando as bordas, sem esticar */
        var esc = Math.max(TW / w, TH / h), sw = TW / esc, sh = TH / esc;
        t.getContext("2d").drawImage(cv, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, TW, TH);
      });
      C.quadros++;
    }

    function capturar() {
      ["frente", "tras"].forEach(function (nome) {
        var alvos = C.alvos.filter(function (a) { return a.nome === nome && a.t.clientWidth > 0 && a.t.clientHeight > 0; });
        if (alvos.length) desenhar(nome, alvos);
      });
    }

    var original = render.render;
    render.render = function (sc, cm) {
      if (!C.ocupado && sc === cena && cm !== cam && this.autoClear && !this.getScissorTest() && !this.getRenderTarget()) {
        var agora = performance.now();
        if (agora - C.ultimo >= C.intervalo && precisaImagem()) {
          C.ultimo = agora;
          C.ocupado = true;
          try { capturar(); } catch (e) { /* um quadro sem copia */ }
          C.ocupado = false;
        }
      }
      return original.apply(this, arguments);
    };

    /* a troca do modelo (T50 -> T10) esvazia inclina: remede na proxima vez */
    var antes = cena.onBeforeRender;
    cena.onBeforeRender = function () {
      if (C.ancoras && C.ancoras.frente.parent !== inclina) C.ancoras = null;
      if (antes) antes.apply(this, arguments);
    };

    /* ---- Rumo fixo nas passadas ----
       O campo gira o nariz para o alvo a cada passo (V.yaw += dy * ...). No T10
       de verdade a rota nao tem essa virada: a ida e a volta de cada passada sao
       feitas com o nariz no mesmo rumo (na volta a aeronave anda de re e quem
       olha para onde ela vai e a camera de tras). Aqui, so no T10 e so enquanto
       a aeronave voa a rota (estado "aplicando", a partir do primeiro trecho
       pulverizado), o passo do campo e embrulhado: o que ele girou e desfeito e
       o nariz segue o rumo das passadas (o do primeiro trecho pulverizado), com
       a mesma suavizacao dele. A posicao nao muda - ela ja andava para o alvo,
       de frente, de re ou de lado. Subida, trecho de ida a retomada, retorno e
       pouso continuam girando o nariz para o alvo, como nos outros drones. */
    C.rumoFixo = true;
    function passadas() {
      if (typeof rota === "undefined" || !rota || rota.length < 2) return null;
      for (var k = 1; k < rota.length; k++) {
        var w = rota[k], aplica = w.xgAplica !== undefined ? w.xgAplica : w.aplica;
        if (!aplica || !rota[k - 1]) continue;
        var dx = w.p[0] - rota[k - 1].p[0], dz = w.p[1] - rota[k - 1].p[1];
        if (Math.hypot(dx, dz) < 1) continue;
        return { k: k, rumo: Math.atan2(-dz, dx) };
      }
      return null;
    }
    function rumoFixoAtivo() {
      if (!C.rumoFixo || V.estado !== "aplicando") return null;
      var p = passadas();
      return p && V.i >= p.k && V.i < rota.length ? p : null;
    }
    if (typeof passo === "function" && typeof V !== "undefined") {
      var passoAntes = passo;
      passo = function (dt) {
        var fixa = rumoFixoAtivo(), y0 = V.yaw;
        var r = passoAntes.apply(this, arguments);
        if (fixa && V.estado !== "caiu") {
          var dy = fixa.rumo - y0;
          while (dy > Math.PI) dy -= 2 * Math.PI;
          while (dy < -Math.PI) dy += 2 * Math.PI;
          V.yaw = y0 + dy * Math.min(1, (Number(dt) || 0) * 4);
        }
        return r;
      };
    }
    /* para onde a aeronave anda em relacao ao nariz, na rota automatica:
       1 = de frente, -1 = de re, 0 = parada, de lado ou fora da rota */
    C.sentido = function () {
      if (["aplicando", "indo", "voltando"].indexOf(V.estado) < 0 || !(V.v > 0.5)) return 0;
      var dot = (V.dirx || 0) * Math.cos(V.yaw) + (V.dirz || 0) * -Math.sin(V.yaw);
      return dot > 0.35 ? 1 : dot < -0.35 ? -1 : 0;
    };
    return true;
  }

  var ponteAtual = null, instalado = false;
  function campo() { return ponteAtual && ponteAtual.janela; }

  return {
    instalar: function (ponte) {
      ponteAtual = ponte;
      if (instalado) return true;
      instalado = ponte.rodar("(" + instalarNoCampo.toString() + ")()") === true;
      return instalado;
    },

    /* um <canvas> do app recebe a imagem da camera enquanto estiver na tela */
    alvo: function (canvas, nome, ligar) {
      var j = campo();
      if (!instalado || !j || !j.xgCamT10 || !canvas) return false;
      var lista = j.xgCamT10.alvos, i = -1;
      for (var k = 0; k < lista.length; k++) if (lista[k].t === canvas) { i = k; break; }
      if (ligar && i < 0) lista.push({ t: canvas, nome: nome });
      else if (ligar) lista[i].nome = nome;
      if (!ligar && i >= 0) lista.splice(i, 1);
      return true;
    },

    estado: function () {
      var j = campo();
      if (!instalado || !j || !j.xgCamT10) return null;
      var C = j.xgCamT10;
      return { quadros: C.quadros, alvos: C.alvos.length, ancoras: !!C.ancoras, rumoFixo: !!C.rumoFixo, sentido: C.sentido ? C.sentido() : 0 };
    },

    /* 1 = a aeronave anda de frente, -1 = de re (nariz fixo na ida e volta), 0 = parada/de lado */
    sentido: function () {
      var j = campo();
      if (!instalado || !j || !j.xgCamT10 || !j.xgCamT10.sentido) return 0;
      try { return j.xgCamT10.sentido(); } catch (e) { return 0; }
    },

    /* liga/desliga o nariz fixo nas passadas (so para teste; ligado por padrao) */
    rumoFixo: function (ligado) {
      var j = campo();
      if (!instalado || !j || !j.xgCamT10) return false;
      if (ligado !== undefined) j.xgCamT10.rumoFixo = !!ligado;
      return !!j.xgCamT10.rumoFixo;
    }
  };
})();
