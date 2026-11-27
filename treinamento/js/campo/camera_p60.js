/* ==========================================================================
   CAMERAS E LUZES DO XAG P60

   O P60 nao tem gimbal. Sao duas cameras fixas no corpo: uma olhando para
   a frente, no alto do nariz, e outra olhando para baixo, embaixo da
   fuselagem - e a de baixo tem luz (Eduardo, relatorio "parametros de
   aplicacao", 05/10/2026, marcado como urgente). No XAG One a imagem abre
   numa janela no alto da tela pelo botao de camera do cartao P60H; o
   icone do canto troca de camera e o de baixo leva a tela cheia, com o
   celular deitado.

   Aqui, no campo:
   - a roda do mouse e o dial deixam de inclinar a camera (sem gimbal);
   - atualizarFpv passa a usar a camera escolhida, presa ao corpo: inclina
     e tomba junto com a aeronave;
   - quando o app pede imagem, um quadro pequeno da camera e desenhado no
     canto do canvas ANTES do quadro do jogo (que limpa tudo em seguida) e
     copiado para os <canvas> do app - o aluno nunca ve esse desenho;
   - "Luz de pesquisa": o holofote da frente (holofote.js, o mesmo do T50)
     e a luz de baixo, junto da camera de baixo.

   Uso (principal.js, so na XAG):  CAMERA_P60.instalar(ponte)
   O app do controle (js/xag_fpv.js, dentro do iframe) usa a mesma API pelo
   window.parent: alvo(canvas, ligar), camera(nome), luz(ligar), estado().
   ========================================================================== */

window.CAMERA_P60 = (function () {
  "use strict";

  /* Roda DENTRO do campo (toString + eval): usa THREE, render, cena,
     camFpv, drone, inclina, atualizarFpv. */
  function instalarNoCampo() {
    if (window.xgCamP60) return true;
    if (typeof THREE === "undefined" || typeof render === "undefined" || typeof cena === "undefined" ||
        typeof camFpv === "undefined" || typeof atualizarFpv !== "function" || typeof inclina === "undefined") return false;

    var C = window.xgCamP60 = {
      camera: "frente", luz: false, auto: true, alvos: [], jpegAte: 0, jpeg: null, jpegEm: 0,
      ultimo: 0, intervalo: 66, quadros: 0, cv: null, ctx: null, ancoras: null, luzBaixo: null,
      /* 18/11/2026 (Eduardo, no Mac dele a tela de voo do P60 ficava PRETA, sem aviso): a copia do quadro e conferida;
         se sair vazia, a imagem passa a ser LIDA direto do desenho (modo "leitura"); o que falhar fica em `erro` */
      modo: "copia", vazios: 0, erro: "", falhas: 0, sonda: null, buf: null, img: null, cvLido: null
    };

    /* Sem gimbal: quem escreve xgGimbal (dial, roda do mouse, pouso
       automatico) nao muda mais nada, e quem le recebe "sem gimbal". */
    try {
      Object.defineProperty(window, "xgGimbal", {
        configurable: true,
        get: function () { return undefined; },
        set: function () {}
      });
    } catch (e) { /* segue com o gimbal de antes */ }

    /* Os pontos das duas cameras, medidos no proprio modelo (o P60 entra
       por modelo_drone.js depois do T50 sair). O P60_Articulado tem as duas
       lentes no modulo do nariz, uma sobre a outra: "Lente_1" (a de cima,
       para a frente) e "Lente" (a de baixo, para o chao, ao lado dos LEDs).
       Sem essas pecas, mede a frente do miolo da fuselagem. */
    function medirAncoras() {
      inclina.updateMatrixWorld(true);
      var inv = new THREE.Matrix4().copy(inclina.matrixWorld).invert(), v = new THREE.Vector3();
      var zMax = -Infinity, yMin = Infinity, yMax = -Infinity, n = 0, lentes = {};
      inclina.traverse(function (o) {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || o.userData.xgCamP60) return;
        if (o.parent && o.parent.name === "xg-holofote") return;
        var pos = o.geometry.attributes.position, mat = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        var passo = Math.max(1, Math.floor(pos.count / 4000));
        var lente = (o.name === "Lente" || o.name === "Lente_1") ? new THREE.Box3() : null;
        for (var k = 0; k < pos.count; k += passo) {
          v.fromBufferAttribute(pos, k).applyMatrix4(mat);
          n++;
          if (lente) lente.expandByPoint(v);
          if (v.y < yMin) yMin = v.y;
          if (v.y > yMax) yMax = v.y;
          if (Math.abs(v.x) < 0.18 && v.z > zMax) zMax = v.z;
        }
        if (lente) lentes[o.name] = lente.getCenter(new THREE.Vector3());
      });
      if (!n || !isFinite(zMax)) return null;
      var altura = yMax - yMin;
      var frente = new THREE.Object3D(), baixo = new THREE.Object3D();
      frente.name = "xg-cam-frente"; baixo.name = "xg-cam-baixo";
      frente.userData.xgCamP60 = baixo.userData.xgCamP60 = true;
      /* a camera do three olha para -Z: girada meia volta olha para +Z (o
         nariz); a de cima desce 8 graus */
      if (lentes.Lente_1) frente.position.copy(lentes.Lente_1).add(new THREE.Vector3(0, 0, 0.03));
      else frente.position.set(0, yMin + altura * 0.65, zMax + 0.04);
      frente.rotation.set(8 * Math.PI / 180, Math.PI, 0);
      /* a de baixo olha para -Y e o alto da imagem e o nariz (+Z) */
      if (lentes.Lente) baixo.position.copy(lentes.Lente).add(new THREE.Vector3(0, -0.02, 0.03));
      else baixo.position.set(0, yMin + altura * 0.55, zMax + 0.02);
      baixo.rotation.set(Math.PI / 2, Math.PI, 0);
      inclina.add(frente); inclina.add(baixo);

      /* a luz de baixo: um foco largo para o chao, junto da camera */
      var foco = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 3.2, 0.6, 1.4);
      foco.userData.xgCamP60 = true;
      foco.position.copy(baixo.position);
      var alvo = new THREE.Object3D();
      alvo.userData.xgCamP60 = true;
      alvo.position.set(baixo.position.x, baixo.position.y - 5, baixo.position.z);
      inclina.add(alvo); foco.target = alvo; inclina.add(foco);
      C.luzBaixo = foco;
      return { frente: frente, baixo: baixo, foco: foco, alvo: alvo };
    }

    function ancoras() {
      var A = C.ancoras;
      if (A && A.frente.parent === inclina) return A;
      if (A) { [A.frente, A.baixo, A.foco, A.alvo].forEach(function (o) { if (o.parent) o.parent.remove(o); }); }
      C.ancoras = medirAncoras();
      aplicarLuz();
      return C.ancoras;
    }

    function escuro() {
      try { return typeof sol !== "undefined" && sol.intensity < 0.6; } catch (e) { return false; }
    }

    function aplicarLuz() {
      var acesa = C.luz || (C.auto && escuro());
      if (window.HOLOFOTE_CAMPO_P60 !== acesa && typeof window.xgHolofote === "function") {
        try { window.xgHolofote(acesa); window.HOLOFOTE_CAMPO_P60 = acesa; } catch (e) { /* sem holofote */ }
      }
      if (C.luzBaixo) C.luzBaixo.intensity = acesa ? 1.3 : 0;
    }
    C.aplicarLuz = aplicarLuz;

    /* atualizarFpv da camera fixa escolhida */
    function poseDaCamera() {
      var A = ancoras();
      if (!A) return false;
      var o = C.camera === "baixo" ? A.baixo : A.frente;
      o.updateWorldMatrix(true, false);
      o.matrixWorld.decompose(camFpv.position, camFpv.quaternion, new THREE.Vector3());
      camFpv.up.set(0, 1, 0).applyQuaternion(camFpv.quaternion);
      var perto = C.camera === "baixo" ? 0.05 : 0.3;
      if (camFpv.near !== perto) { camFpv.near = perto; camFpv.updateProjectionMatrix(); }
      return true;
    }

    var meuAtualizar = null;
    function embrulhar() {
      var anterior = atualizarFpv;
      meuAtualizar = function () {
        anterior.apply(this, arguments);
        if (typeof V !== "undefined" && V.estado === "caiu") return;
        poseDaCamera();
      };
      atualizarFpv = meuAtualizar;
    }
    embrulhar();

    /* Copia do quadro da camera para o app */
    function precisaImagem(agora) {
      C.alvos = C.alvos.filter(function (t) { return t && t.isConnected; });
      var visivel = C.alvos.some(function (t) { return t.clientWidth > 0 && t.clientHeight > 0; });
      return visivel || agora < C.jpegAte;
    }

    /* a copia (C.cv) saiu vazia? Uma sonda pequena, so de leitura, para nao tirar C.cv da placa de video */
    function copiaVazia(w, h) {
      try {
        if (!C.sonda) { var s = document.createElement("canvas"); s.width = 16; s.height = 9; C.sonda = s.getContext("2d", { willReadFrequently: true }); }
        C.sonda.clearRect(0, 0, 16, 9);
        C.sonda.drawImage(C.cv, 0, 0, w, h, 0, 0, 16, 9);
        var d = C.sonda.getImageData(0, 0, 16, 9).data;
        for (var i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
        return true;
      } catch (e) { return false; }
    }

    /* modo "leitura": os pontos do quadro pequeno, lidos do proprio desenho (canto de baixo, onde ele acabou de ser feito) */
    function lerDoDesenho(w, h, pr) {
      var gl = render.getContext(), wp = Math.floor(w * pr), hp = Math.floor(h * pr);
      if (!wp || !hp) return null;
      if (!C.buf || C.buf.length !== wp * hp * 4) {
        C.buf = new Uint8Array(wp * hp * 4);
        C.img = new ImageData(wp, hp);
        C.cvLido = document.createElement("canvas"); C.cvLido.width = wp; C.cvLido.height = hp;
      }
      gl.readPixels(0, 0, wp, hp, gl.RGBA, gl.UNSIGNED_BYTE, C.buf);
      var linha = wp * 4, dst = C.img.data, cheio = false;
      /* o desenho vem de baixo para cima */
      for (var y = 0; y < hp; y++) dst.set(C.buf.subarray((hp - 1 - y) * linha, (hp - y) * linha), y * linha);
      for (var i = 3; i < dst.length; i += 4) { if (dst[i] !== 0) cheio = true; dst[i] = 255; }
      C.cvLido.getContext("2d").putImageData(C.img, 0, 0);
      return cheio ? "ok" : "vazia";
    }

    function capturar() {
      var pr = render.getPixelRatio(), el = render.domElement;
      var W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
      /* do tamanho do maior alvo na tela (a tela cheia pede mais pixels) */
      var maior = 0;
      C.alvos.forEach(function (t) {
        var dpr = (t.ownerDocument.defaultView || window).devicePixelRatio || 1;
        maior = Math.max(maior, t.clientWidth * dpr / pr);
      });
      /* lendo direto do desenho a imagem custa mais: fica em 640 de largura */
      var w = Math.floor(Math.min(W, C.modo === "leitura" ? 640 : 960, Math.max(320, maior || 480))), h = Math.round(w * 9 / 16);
      if (!w || !h || h > H) { C.erro = "tela pequena"; return; }
      if (!C.cv) { C.cv = document.createElement("canvas"); C.ctx = C.cv.getContext("2d"); }
      if (C.cv.width !== w || C.cv.height !== h) { C.cv.width = w; C.cv.height = h; }

      var aspecto = camFpv.aspect, p = camFpv.position.clone(), q = camFpv.quaternion.clone(), u = camFpv.up.clone();
      atualizarFpv();
      camFpv.aspect = w / h; camFpv.updateProjectionMatrix();
      render.setScissorTest(true);
      render.setScissor(0, 0, w, h);
      render.setViewport(0, 0, w, h);
      render.render(cena, camFpv);
      var lido = C.modo === "leitura" ? lerDoDesenho(w, h, pr) : null;
      render.setScissorTest(false);
      render.setViewport(0, 0, W, H);
      if (C.modo !== "leitura") {
        C.ctx.drawImage(el, 0, (H - h) * pr, w * pr, h * pr, 0, 0, w, h);
        /* confere a copia nos primeiros quadros e de tempos em tempos: vazia tres vezes seguidas, troca de modo */
        if (C.quadros < 3 || C.quadros % 150 === 0) {
          if (copiaVazia(w, h)) { if (++C.vazios >= 3) { C.modo = "leitura"; C.vazios = 0; } }
          else C.vazios = 0;
        }
        C.erro = "";
      } else if (lido) {
        C.ctx.drawImage(C.cvLido, 0, 0, C.cvLido.width, C.cvLido.height, 0, 0, w, h);
        C.erro = lido === "vazia" ? "imagem vazia" : "";
      }
      camFpv.aspect = aspecto; camFpv.updateProjectionMatrix();
      camFpv.position.copy(p); camFpv.quaternion.copy(q); camFpv.up.copy(u);
      C.quadros++;

      C.alvos.forEach(function (t) {
        var cw = t.clientWidth, ch = t.clientHeight;
        if (!cw || !ch) return;
        var dpr = (t.ownerDocument.defaultView || window).devicePixelRatio || 1;
        var TW = Math.round(cw * dpr), TH = Math.round(ch * dpr);
        if (t.width !== TW) t.width = TW;
        if (t.height !== TH) t.height = TH;
        /* preenche cortando as bordas, sem esticar */
        var esc = Math.max(TW / w, TH / h), sw = TW / esc, sh = TH / esc;
        t.getContext("2d").drawImage(C.cv, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, TW, TH);
      });
      if (performance.now() < C.jpegAte && performance.now() - C.jpegEm > 110) {
        C.jpegEm = performance.now();
        try { C.jpeg = { id: C.quadros, url: C.cv.toDataURL("image/jpeg", 0.55) }; } catch (e) { C.jpeg = null; }
      }
    }

    var original = render.render;
    render.render = function (sc, cm) {
      if (!C.ocupado && sc === cena && cm !== camFpv && this.autoClear && !this.getScissorTest() &&
          !this.getRenderTarget()) {
        if (atualizarFpv !== meuAtualizar) embrulhar();     // outro modulo embrulhou depois
        var agora = performance.now();
        if (agora - C.ultimo >= C.intervalo && precisaImagem(agora)) {
          C.ultimo = agora;
          C.ocupado = true;
          try { capturar(); }
          catch (e) {
            /* um quadro sem copia; o motivo fica guardado para o app mostrar (antes a tela ficava preta sem dizer nada) */
            C.falhas++; C.erro = String((e && e.message) || e).slice(0, 60);
            try { render.setScissorTest(false); render.setViewport(0, 0, render.domElement.clientWidth || innerWidth, render.domElement.clientHeight || innerHeight); } catch (e2) { /* segue */ }
          }
          C.ocupado = false;
        }
      }
      return original.apply(this, arguments);
    };

    /* a troca do modelo (T50 -> P60) esvazia inclina: remede na proxima vez */
    var antes = cena.onBeforeRender;
    cena.onBeforeRender = function () {
      if (C.ancoras && C.ancoras.frente.parent !== inclina) C.ancoras = null;
      if (antes) antes.apply(this, arguments);
    };
    return true;
  }

  var ponteAtual = null, instalado = false;

  function rodar(js) {
    if (!ponteAtual || !instalado) return null;
    try { return ponteAtual.ler(js); } catch (e) { return null; }
  }

  function campo() {
    /* 18/11/2026: se a camera nao entrou no campo (instalacao que falhou na abertura, ou o campo foi recarregado),
       tenta de novo aqui em vez de deixar o app sem imagem ate a pagina ser reaberta */
    var j = ponteAtual && ponteAtual.janela;
    if (j && !j.xgCamP60 && ponteAtual) {
      instalado = false;
      try { instalado = ponteAtual.rodar("(" + instalarNoCampo.toString() + ")()") === true; } catch (e) { instalado = false; }
    }
    return j;
  }

  return {
    instalar: function (ponte) {
      ponteAtual = ponte;
      if (instalado) return true;
      if (window.HOLOFOTE) window.HOLOFOTE.instalar(ponte);
      try { instalado = ponte.rodar("(" + instalarNoCampo.toString() + ")()") === true; } catch (e) { instalado = false; }
      return instalado;
    },

    /* um <canvas> do app recebe a imagem enquanto estiver na tela */
    alvo: function (canvas, ligar) {
      var j = campo();
      if (!instalado || !j || !j.xgCamP60 || !canvas) return false;
      var lista = j.xgCamP60.alvos;
      var i = lista.indexOf(canvas);
      if (ligar && i < 0) lista.push(canvas);
      if (!ligar && i >= 0) lista.splice(i, 1);
      return true;
    },

    camera: function (nome) {
      var j = campo();
      if (!instalado || !j || !j.xgCamP60) return null;
      if (nome === "frente" || nome === "baixo") j.xgCamP60.camera = nome;
      return j.xgCamP60.camera;
    },

    luz: function (ligar) {
      var j = campo();
      if (!instalado || !j || !j.xgCamP60) return null;
      if (typeof ligar === "boolean") { j.xgCamP60.luz = ligar; j.xgCamP60.aplicarLuz(); }
      return j.xgCamP60.luz;
    },

    /* quadros em JPEG para o celular remoto (celular_xag.js) */
    pedirJpeg: function (ms) {
      var j = campo();
      if (!instalado || !j || !j.xgCamP60) return;
      j.xgCamP60.jpegAte = j.performance.now() + (ms || 1500);
    },
    jpeg: function () {
      var j = campo();
      return instalado && j && j.xgCamP60 ? j.xgCamP60.jpeg : null;
    },

    estado: function () {
      var j = campo();
      if (!instalado || !j || !j.xgCamP60) return null;
      var C = j.xgCamP60, ligado = rodar("typeof V !== 'undefined' && V.estado !== 'caiu'");
      return { camera: C.camera, luz: C.luz, quadros: C.quadros, aeronave: ligado === true,
               modo: C.modo, erro: C.erro || "", falhas: C.falhas, alvos: C.alvos.length };
    }
  };
})();
