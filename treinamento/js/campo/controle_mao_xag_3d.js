/* Controle de mao enviado pelo Eduardo. O celular e seus eventos ficam intactos.
   Os alvos transparentes reaproveitam os botoes e gestos do aparelho_xag.js. */
(function () {
  "use strict";
  var original = window.CONTROLE_XAG_3D.manter;
  var modelo = null, carregando = false, tentarEm = 0, painel = null;
  var arquivo = new URL("../assets/modelos/xag_controle_mao.glb", location.href).href;

  function carregar(T) {
    if (modelo || carregando || Date.now() < tentarEm || !T.GLTFLoader) return;
    carregando = true;
    new T.GLTFLoader().load(arquivo, function (g) {
      modelo = g.scene;
      carregando = false;
    }, undefined, function (erro) {
      carregando = false; tentarEm = Date.now() + 10000;
      console.warn("Controle de mao XAG nao carregou:", erro);
    });
  }

  function naMao(ponte, portatil) {
    var grupo = ponte.ler("typeof grupoOperador !== 'undefined' ? grupoOperador : null");
    if (!grupo || !grupo.children.length) return;
    var g = grupo.children[0], av = g.userData && g.userData.av, rc;
    g.children.forEach(function (c) { if (c !== av && c.isGroup) rc = c; });
    if (!rc) return;
    if (!portatil) {
      if (rc.userData.xgMaoAtivo && rc.userData.xgSrc4) {
        rc.clear(); rc.add(rc.userData.xgSrc4.modelo); rc.visible = true;
        rc.userData.xgMaoAtivo = false;
        if (ponte.poseDeSegurar) ponte.poseDeSegurar(ponte.janela.THREE, g, rc);
      }
      return;
    }
    if (!modelo) return;
    if (!rc.userData.xgMao) {
      var m = modelo.clone(true), escala = g.scale.x || 1;
      m.scale.setScalar(1 / escala);
      m.rotation.set(-0.35, Math.PI, 0);
      m.position.set(0.08 / escala, -0.12 / escala, 0.04 / escala);
      rc.userData.xgMao = m;
    }
    if (!rc.userData.xgMaoAtivo || rc.userData.xgMao.parent !== rc) {
      rc.clear(); rc.add(rc.userData.xgMao); rc.userData.xgMaoAtivo = true;
    }
    rc.visible = true;
  }

  function montar(T, doc, corpo, documento3d) {
    if (painel) { painel.render.dispose(); painel.canvas.remove(); }
    // THREE pertence ao iframe do campo: criar o contexto nesse mesmo ambiente
    // evita detectar WebGL2 como WebGL1 por instanceof entre janelas distintas.
    var canvas = documento3d.createElement("canvas");
    canvas.className = "xg-mao-canvas";
    canvas.setAttribute("aria-hidden", "true");
    var render;
    try { render = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true }); }
    catch (e) { return; } // sem WebGL: conserva o controle original funcional
    render.setPixelRatio(Math.min(doc.defaultView.devicePixelRatio || 1, 2));
    render.outputEncoding = T.sRGBEncoding;
    var cena = new T.Scene(), cam = new T.OrthographicCamera(-0.03, 0.03, 0.12, -0.12, 0.01, 2);
    cam.position.set(0, 0, 0.5); cam.lookAt(0, 0, 0);
    var m = modelo.clone(true); m.position.y = -0.11; cena.add(m);
    cena.add(new T.HemisphereLight(0xffffff, 0x777777, 1));
    var luz = new T.DirectionalLight(0xffffff, 0.6); luz.position.set(-1, 2, 4); cena.add(luz);
    // Captura o modelo original para VR, sem redesenhar o aparelho.
    canvas.__tpdVRRender = function () { render.render(cena, cam); };
    var estilo = doc.getElementById("xg-mao-estilo");
    if (!estilo) {
      estilo = doc.createElement("style"); estilo.id = "xg-mao-estilo";
      estilo.textContent =
        ".remote.handheld .handheld-body.xg-mao-modelo{position:relative!important;background:none!important;border:0!important;box-shadow:none!important;padding:0!important;overflow:visible!important}" +
        ".xg-mao-modelo:before,.xg-mao-modelo:after{display:none!important}" +
        ".xg-mao-modelo>.xg-mao-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}" +
        ".xg-mao-modelo .handheld-head{visibility:hidden!important}" +
        ".xg-mao-modelo .handheld-keys,.xg-mao-modelo .handheld-arrows{display:contents!important}" +
        ".remote.handheld .xg-mao-modelo .xg-mao-alvo{position:absolute!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:10px!important;background:transparent!important;box-shadow:none!important;color:transparent!important;font-size:0!important;z-index:2;touch-action:none}" +
        ".xg-mao-modelo .xg-mao-alvo:before,.xg-mao-modelo .xg-mao-alvo:after{display:none!important}" +
        ".xg-mao-modelo .xg-mao-alvo:hover,.xg-mao-modelo .xg-mao-alvo:focus-visible{outline:2px solid #63b23c!important}";
      doc.head.appendChild(estilo);
    }
    corpo.appendChild(canvas); corpo.classList.add("xg-mao-modelo");
    var alvos = [];
    function alvo(el, x, y, w, h) {
      if (!el) return;
      el.classList.add("xg-mao-alvo");
      alvos.push({ el: el, x: x, y: y, w: w, h: h });
    }
    alvo(corpo.querySelector(".handheld-joystick"), 0.5, 0.215, 0.45, 0.095);
    var teclas = corpo.querySelectorAll(".handheld-keys:not(.bottom-keys) span");
    for (var i = 0; i < teclas.length; i++) alvo(teclas[i], i % 2 ? 0.69 : 0.31, 0.373 + Math.floor(i / 2) * 0.058, 0.32, 0.045);
    var setas = corpo.querySelectorAll(".handheld-arrows span");
    alvo(setas[0], 0.5, 0.58, 0.28, 0.085); alvo(setas[1], 0.5, 0.68, 0.28, 0.085);
    var giros = corpo.querySelectorAll(".bottom-keys span");
    alvo(giros[0], 0.34, 0.78, 0.21, 0.085); alvo(giros[1], 0.66, 0.78, 0.21, 0.085);
    alvo(corpo.querySelector(".handheld-power"), 0.5, 0.894, 0.42, 0.1);
    painel = { doc: doc, corpo: corpo, canvas: canvas, render: render, cena: cena, cam: cam, alvos: alvos, w: 0, h: 0 };
  }

  function desenhar() {
    var p = painel, w = p.corpo.clientWidth, h = p.corpo.clientHeight;
    if (!w || !h) return;
    if (w !== p.w || h !== p.h) {
      p.w = w; p.h = h;
      var altura = Math.max(0.23, 0.056 * h / w), largura = altura * w / h;
      p.cam.left = -largura / 2; p.cam.right = largura / 2;
      p.cam.top = altura / 2; p.cam.bottom = -altura / 2; p.cam.updateProjectionMatrix();
      p.render.setSize(w, h, false);
      p.alvos.forEach(function (a) {
        var x = w / 2 + (a.x - 0.5) * 0.052 / largura * w;
        var y = h / 2 + (a.y - 0.5) * 0.22 / altura * h;
        var aw = a.w * 0.052 / largura * w, ah = a.h * 0.22 / altura * h;
        a.el.style.setProperty("left", (x - aw / 2) + "px", "important");
        a.el.style.setProperty("top", (y - ah / 2) + "px", "important");
        a.el.style.setProperty("width", aw + "px", "important");
        a.el.style.setProperty("height", ah + "px", "important");
      });
    }
    p.render.render(p.cena, p.cam);
  }

  window.CONTROLE_XAG_3D.manter = function (ponte, estado) {
    original(ponte, estado);
    if (!ponte.janela || !ponte.janela.THREE) return;
    var T = ponte.janela.THREE, portatil = estado.tipo === "portatil";
    if (portatil) carregar(T);
    naMao(ponte, portatil);
    if (!portatil || !modelo || estado.vista !== "controle") return;
    var doc = estado.docControle && estado.docControle();
    var corpo = doc && doc.querySelector(".remote.handheld .handheld-body");
    if (!corpo) return;
    if (!painel || painel.corpo !== corpo) montar(T, doc, corpo, ponte.janela.document);
    if (painel && painel.corpo === corpo) desenhar();
  };
})();
