/* ==========================================================================
   O SRC4 EM 3D - NA MAO DO OPERADOR E NA VISTA CONTROLE

   O modelo e o que ele mandou em 26/09/2026: `assets/modelos/xag_src4.glb`
   (XAG_SRC4_Articulado.glb, feito em D:\Area de trabalho\xag 3d\src4, 224
   pecas; o no raiz traz a escala 0,001 e o loader entrega y para cima com a
   frente em +z; tela em Pivo_tela/Vidro_tela, manches em Pivo_joystick_E/D,
   LEDs LED_0..5, botao de ligar Botao_ligar, teclas Tecla_E0/E1/D0/D1,
   ombros Botao_ombro_E/D, seletores Seletor_F1/F2).

   Dois usos, os dois so com o controle de TELA INTEGRADA escolhido:

   1. NA MAO DO OPERADOR (vistas Operador/Drone/Livre): entra no grupo do
      controle do trabalhador, no lugar do RC Plus do jogo.

   2. NA VISTA CONTROLE: o mesmo modelo, grande, na frente da camera do
      campo - "usa o modelo que te mandei, nao inventa outro". A tela do
      XAG One (o iframe do site do controle, so a parte da tela) e
      encaixada em cima do vidro do modelo, pelo retangulo projetado dele.
      Botoes, manches e seletores do modelo respondem ao mouse (raycast) e
      repassam para os botoes do site, que ja tem as funcoes.

   Em ambos: LEDs e tela acendem com o controle ligado; os manches seguem
   `aparelho.comandos` (teclado ou mouse).
   ========================================================================== */

window.CONTROLE_XAG_3D = (function () {
  "use strict";

  /* 12/10/2026: o SRC5 que ele mandou (Controle_P150_Max.glb, sem as ranhuras e os
     dentes milimetricos dos manches: ferramentas/podar_glb.cjs) substitui o SRC4 no
     P60 e no P150 Max. As pecas tem outros nomes: adaptarSrc5 da a elas os nomes do
     SRC4 que o resto deste arquivo (e vr_controle_original.js) usa. */
  /* Ate ele liberar (12/10/2026), o SRC5 e so do administrador; aluno segue com o SRC4. */
  function arquivoDoControle() {
    /* P100 Pro (13/10/2026): o controle dele e o ARC3 Pro com o celular (ficha `controle3d`
       em js/marcas.js); o app no celular e o mesmo do P60. */
    var proprio = controleDaFicha();
    if (proprio) return "../../" + proprio;
    var c = window.CONTAS && CONTAS.atual && CONTAS.atual();
    /* 23/10/2026, pedido do Eduardo ("voltar pro controle certo do P60"): o P60 volta ao SRC4 para todos, administrador inclusive;
       o SRC5 (Controle_P150_Max) fica so no P150 Max e so para o administrador, como o resto do P150 Max. */
    var p = new URLSearchParams(location.search), idDrone = p.get("modelo") || p.get("drone") || "";
    var src5 = idDrone === "p150max" && c && c.admin === true;
    return "../../assets/modelos/" + (src5 ? "xag_src5.glb" : "xag_src4.glb");   // a pagina do campo esta em treinamento/campo/
  }
  function controleDaFicha() {
    try {
      var id = new URLSearchParams(location.search).get("modelo");
      var m = (window.MARCAS && MARCAS.xag ? MARCAS.xag.modelos : []).filter(function (x) { return x.id === id; })[0];
      return m && m.controle3d || null;
    } catch (e) { return null; }
  }
  var LARGURA_M = 0.26;                                 // 260 mm de largura (LEIA-ME do modelo)
  var CURSO = 0.32;                                     // rad de inclinacao do manche no fim do curso

  /* na vista Controle: distancia da camera, fracao da largura da vista que
     o aparelho ocupa, onde fica na vertical e a inclinacao (o operador
     olha o tampo um pouco de cima) */
  /* 19/11/2026 (Eduardo: "quando ta selecionado ali operador o controle deve baixar pra a pessoa poder ver por cima como e nos
     outros modelos"): com a tela deitada o aparelho da vista Operador tapava o meio da cena; `alturaDeitado` desce ele ate
     sobrarem as antenas e o alto da tela, como no DJI. Em pe (celular) ele ja ficava baixo: `altura` nao mudou. */
  var VISTA = { dist: 1.0, largura: 0.5, altura: -0.34, alturaDeitado: -0.74, inclina: 0.42 };
  /* Pedido do Eduardo (10/10/2026): essa composicao (campo dos olhos do
     piloto, drone e o aparelho baixo) e a vista OPERADOR do XAG; a vista
     CONTROLE e o mesmo aparelho grande e perto. `largura` e a fracao da
     largura da tela; `teto`, quantas alturas da tela a largura pode ter
     (paisagem: nao deixa o aparelho passar de cima a baixo); `altura` em pe e
     `alturaDeitado` com a tela deitada. */
  var PERTO = { dist: 1.0, largura: 0.96, teto: 0.62, altura: -0.2, alturaDeitado: -0.3, inclina: 0.42 };
  /* ARC3 Pro (13/10/2026): com o celular em cima ele e mais alto que o SRC4; na vista
     Operador fica menor e mais baixo para o campo continuar aparecendo. */
  var VISTA_ARC3 = { dist: 1.0, largura: 0.34, altura: -0.38, inclina: 0.12 };
  function ajusteAtual(j) {
    if (j && j.__xgVistaXag === "controle") return PERTO;
    return carregado && carregado.userData.xgArc3 ? VISTA_ARC3 : VISTA;
  }
  /* O SRC5 ficava deitado demais com a inclinacao do SRC4 (Eduardo, 12/10/2026): em pe, so um pouco. */
  var INCLINA_SRC5 = 0.1;
  /* ARC3 Pro: o celular fica em cima do corpo; quase em pe para a tela do app nao achatar. */
  var INCLINA_ARC3 = 0.12;
  function inclinacao(V) {
    if (carregado && carregado.userData.xgArc3) return INCLINA_ARC3;
    return carregado && carregado.userData.xgSrc5 ? INCLINA_SRC5 : V.inclina;
  }
  /* largura de verdade do aparelho na mao (o ARC3 Pro tem 200 mm; o SRC4, 260) */
  function larguraNaMao() { return carregado && carregado.userData.xgLargura || LARGURA_M; }

  var carregado = null;      // a cena do GLB, carregada uma vez
  var carregando = false;
  var hud = null;            // o aparelho da vista Controle

  /* `cena`, `cam` e `render` sao const do jogo: nao existem em window, so
     por eval no escopo global do campo (a ponte faz isso) */
  function globais(ponte) {
    try { return ponte.ler("({cena: cena, cam: cam, render: render})"); } catch (e) { return null; }
  }

  function grupoDoControle(ponte) {
    var grupo = ponte.ler("typeof grupoOperador !== 'undefined' ? grupoOperador : null");
    if (!grupo || !grupo.children.length) return null;
    var g = grupo.children[0];
    var av = g.userData && g.userData.av;
    var rc = null;
    g.children.forEach(function (c) { if (c !== av && c.isGroup) rc = c; });
    return rc ? { g: g, rc: rc } : null;
  }

  function carregar(ponte, pronto) {
    if (carregado) { pronto(carregado); return; }
    var j = ponte.janela;
    if (!j || !j.THREE || !j.THREE.GLTFLoader) return;
    if (carregando) { carregando.push(pronto); return; }
    carregando = [pronto];
    new j.THREE.GLTFLoader().load(arquivoDoControle(), function (gltf) {
      carregado = gltf.scene;
      adaptarSrc5(carregado);
      adaptarArc3(carregado);
      var fila = carregando; carregando = false;
      fila.forEach(function (f) { f(carregado); });
    }, undefined, function (erro) {
      carregando = false;
      console.warn("SRC5 3D nao carregou:", erro);
    });
  }

  /* SRC5 -> nomes do SRC4. Botoes (o que cada um faz no site do controle):
     H = RTH, L1 = Radar, L2 e L3 = L, R1 = Pausa, R2 = FPV, R3 = R,
     discos de tras = F1 (vazao) e F2 (direcao). */
  function adaptarSrc5(cena) {
    if (!cena.getObjectByName("CONTROLE_P150_MAX")) return;
    cena.userData.xgSrc5 = true;
    function nomear(grupo, nome) {
      var g = cena.getObjectByName(grupo); if (!g) return;
      var k = 0; g.traverse(function (o) { if (o.isMesh) o.name = nome + "_" + (k++); });
    }
    nomear("Botao_H", "Tecla_E0"); nomear("Botao_L1", "Tecla_E1");
    nomear("Botao_L2", "Botao_ombro_E"); nomear("Botao_L3", "Botao_ombro_E3");
    nomear("Botao_R1", "Tecla_D0"); nomear("Botao_R2", "Tecla_D1");
    nomear("Botao_R3", "Botao_ombro_D"); nomear("Disco_traseiro_L", "Seletor_F1"); nomear("Disco_traseiro_R", "Seletor_F2");
    nomear("Joystick_esquerdo", "Haste_joystick_E"); nomear("Joystick_direito", "Haste_joystick_D");
    var e = cena.getObjectByName("Joystick_esquerdo"), d = cena.getObjectByName("Joystick_direito");
    if (e) e.name = "Pivo_joystick_E"; if (d) d.name = "Pivo_joystick_D";
    /* haste do manche no +z local, como no SRC4 (girar em x = frente/tras, em y = lados) */
    var ligar = cena.getObjectByName("Tecla_POWER__Plastico_teclas"); if (ligar) ligar.name = "Botao_ligar";
    var vidro = cena.getObjectByName("Tela_substituivel__Vidro_desligado"); if (vidro) vidro.name = "Vidro_tela";
    var led = cena.getObjectByName("LED_verde__Verde_LED"); if (led) led.name = "LED_0";
  }

  /* ARC3 Pro (gerar_arc3_pro.py, 13/10/2026): as pecas ja vem com os nomes do SRC4
     (L1 = Tecla_E0, Fn = Tecla_E1, pausa = Tecla_D0, R1 = Tecla_D1, L2/R2 = ombros,
     rodas A/D = F1/F2, Vidro_tela = a tela do celular). O arquivo esta em metros. */
  function adaptarArc3(cena) {
    var raiz = cena.getObjectByName("XAG_ARC3_Pro");
    if (!raiz) return;
    cena.userData.xgArc3 = true;
    cena.userData.xgLargura = Number(raiz.userData.largura) || 0.2;
  }

  /* uma copia do modelo com material proprio por peca e o mapa de pecas */
  function copiar(T, cena, escalaAlvo) {
    var modelo = cena.clone(true);
    modelo.traverse(function (o) {
      if (o.isMesh) { o.material = o.material.clone(); o.castShadow = true; }
    });
    modelo.updateMatrixWorld(true);
    var caixa = new T.Box3().setFromObject(modelo);
    var largura = caixa.max.x - caixa.min.x || LARGURA_M;
    modelo.scale.setScalar((escalaAlvo || LARGURA_M) / largura);
    var pecas = {};
    modelo.traverse(function (o) { if (o.name) pecas[o.name] = o; });
    return { modelo: modelo, pecas: pecas, ligado: null };
  }

  /* ------------------------------------------------- 1. na mao do operador */

  function montarNaMao(ponte, g, rc, cena) {
    var T = ponte.janela.THREE;
    var escala = g.scale.x || 1;
    var d = copiar(T, cena, larguraNaMao() / escala);
    /* frente (+z) para o operador, que fica do lado -z do grupo (o mesmo
       lado da face do RC Plus no jogo): meia-volta */
    d.modelo.rotation.set(0, Math.PI, 0);
    /* As maos do trabalhador ficam nas empunhaduras de TRAS do corpo, por
       baixo (medido: maos em x=+-0,20, y=-0,085, z=-0,045 no grupo). Com o
       modelo centrado nas maos elas entravam pelo corpo: o corpo vai 7 cm
       para a frente e 4 cm para baixo, e as maos sobram atras. */
    d.modelo.position.set(0, -0.04 / escala, 0.07 / escala);
    rc.clear();
    rc.add(d.modelo);
    rc.userData.xgSrc4 = d;
    if (ponte.poseDeSegurar) ponte.poseDeSegurar(T, g, rc);
  }

  /* ------------------------------------------------- 2. na vista Controle */

  /* A vista Controle do jogo desenha o campo com uma camera propria (os
     olhos do operador, ver ponte.campoAtrasDoAparelho). O aparelho nao
     entra nessa cena: e desenhado numa SEGUNDA passada, com cena e camera
     so dele, fixa na origem olhando para -z - assim a projecao da tela e
     exata e nao depende de onde o jogo pos a camera. A passada e
     acrescentada embrulhando `renderControle` do jogo. */
  function montarNaVista(ponte, cena) {
    var j = ponte.janela, T = j.THREE;
    var G = globais(ponte);
    if (!G || !G.render) return;
    var d = copiar(T, cena, LARGURA_M);
    var grupo = new T.Group();
    grupo.name = "xgSrc4Vista";
    grupo.add(d.modelo);
    d.modelo.rotation.set(inclinacao(VISTA), 0, 0);
    d.grupo = grupo;
    d.escalaBase = d.modelo.scale.x;
    grupo.visible = false;

    d.cena = new T.Scene();
    d.cena.add(grupo);
    /* luz contida: o aparelho e preto fosco, clareava demais */
    d.cena.add(new T.HemisphereLight(0xdfe8ee, 0x2a3328, 0.38));
    var sol = new T.DirectionalLight(0xffffff, 0.48);
    sol.position.set(0.6, 1.4, 1.2);
    d.cena.add(sol);
    d.cam = new T.PerspectiveCamera(45, 1, 0.05, 10);
    d.cam.position.set(0, 0, 0);
    d.cam.lookAt(0, 0, -1);
    hud = d;
    j.__xgHud = { cena: d.cena, cam: d.cam, visivel: false };

    ponte.rodar(
      "(function(){" +
      "  if (window.__xgHudEmbrulhado) return;" +
      "  window.__xgHudEmbrulhado = true;" +
      "  var anterior = renderControle;" +
      "  window.renderControle = function(){" +
      "    anterior();" +
      "    var h = window.__xgHud;" +
      "    if (!h || !h.visivel) return;" +
      "    render.autoClear = false;" +
      "    render.clearDepth();" +
      "    render.render(h.cena, h.cam);" +
      "    render.autoClear = true;" +
      "  };" +
      "})()"
    );
    posicionarNaVista(ponte);
  }

  function posicionarNaVista(ponte) {
    var j = ponte.janela, G = globais(ponte);
    if (!hud || !G || !G.render) return;
    var tela = G.render.domElement;
    var c = hud.cam;
    c.aspect = (tela.clientWidth || 1) / (tela.clientHeight || 1);
    c.updateProjectionMatrix();
    var V = ajusteAtual(j), fov = c.fov * Math.PI / 180;
    var H = 2 * V.dist * Math.tan(fov / 2), W = H * c.aspect;
    var s = V === PERTO ? Math.min(V.largura * W, V.teto * H) / LARGURA_M
      : (V.largura * Math.min(W, H * 1.35)) / LARGURA_M;
    hud.modelo.scale.setScalar(s * hud.escalaBase);
    hud.modelo.rotation.x = inclinacao(V);
    var desce = W > H && V.alturaDeitado != null ? V.alturaDeitado : V.altura;   // deitado: a tela do aparelho nao pode sair por cima (Controle) nem tapar a cena (Operador)
    hud.grupo.position.set(0, desce * H, -V.dist);
    hud.grupo.updateMatrixWorld(true);
  }

  /* o retangulo do vidro da tela, em pixels da janela do treinamento */
  function retanguloDaTela(ponte) {
    if (!hud || !hud.grupo.visible) return null;
    var j = ponte.janela, T = j.THREE, G = globais(ponte), c = hud.cam;
    var vidro = hud.pecas.Vidro_tela;
    if (!vidro || !c || !G || !G.render) return null;
    posicionarNaVista(ponte);
    if (!vidro.geometry.boundingBox) vidro.geometry.computeBoundingBox();
    var b = vidro.geometry.boundingBox;
    var tela = G.render.domElement;
    var cw = tela.clientWidth, ch = tela.clientHeight;
    var quadro = ponte.iframe.getBoundingClientRect();
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.min.x, b.max.y], [b.max.x, b.max.y]].forEach(function (p) {
      var v = new T.Vector3(p[0], p[1], b.max.z).applyMatrix4(vidro.matrixWorld).project(c);
      var x = quadro.left + (v.x + 1) / 2 * cw, y = quadro.top + (1 - v.y) / 2 * ch;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    });
    if (!(x1 > x0 && y1 > y0)) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /* ------------------------------------- os toques no modelo (vista Controle)

     Cada peca do modelo repassa para o botao correspondente do site do
     controle (que ja tem as funcoes: pausa, RTH, radar, FPV, F1/F2 pela
     roda, L/R). Os manches viram `aparelho.comandos`, como arrastar os
     do site. O botao de ligar chama o do site. */
  var MAPA_DE_PECAS = [
    [/^(Botao_ligar|Moldura_ligar|Simbolo_power|Traco_power)/, "energia"],
    [/joystick_E/, "mancheEsq"], [/joystick_D/, "mancheDir"],
    [/^(Tecla|Icone|Borda_botao)_E0/, ".hardware-side:first-child .hardware-buttons span:nth-child(1)"],
    [/^(Tecla|Icone|Borda_botao)_E1/, ".hardware-side:first-child .hardware-buttons span:nth-child(2)"],
    [/^(Tecla|Icone|Borda_botao)_D0/, ".hardware-side:last-child .hardware-buttons span:nth-child(1)"],
    [/^(Tecla|Icone|Borda_botao)_D1/, ".hardware-side:last-child .hardware-buttons span:nth-child(2)"],
    [/^(Botao_ombro|Letra_ombro)_E/, ".hardware-side:first-child .hardware-buttons span:nth-child(3)"],
    [/^(Botao_ombro|Letra_ombro)_D/, ".hardware-side:last-child .hardware-buttons span:nth-child(3)"],
    [/^(Seletor_F1|Ranhura_F1|Legenda_F1|Base_seletor_E|Anel_vermelho_E)/, ".hardware-side:first-child .hardware-buttons span:nth-child(4)"],
    [/^(Seletor_F2|Ranhura_F2|Legenda_F2|Base_seletor_D|Anel_vermelho_D)/, ".hardware-side:last-child .hardware-buttons span:nth-child(4)"],
  ];

  function pecaTocada(ponte, e) {
    if (!hud || !hud.grupo.visible) return null;
    var T = ponte.janela.THREE, G = globais(ponte);
    if (!G) return null;
    var tela = G.render.domElement, r = tela.getBoundingClientRect();
    var nd = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    var ray = new T.Raycaster();
    ray.setFromCamera(nd, hud.cam);
    var hits = ray.intersectObject(hud.modelo, true);
    if (!hits.length) return null;
    var o = hits[0].object;
    while (o && o !== hud.modelo) {
      for (var i = 0; i < MAPA_DE_PECAS.length; i++) {
        if (MAPA_DE_PECAS[i][0].test(o.name || "")) return { alvo: MAPA_DE_PECAS[i][1], ponto: hits[0].point, nome: o.name };
      }
      o = o.parent;
    }
    return null;
  }

  /* tecla apertada no modelo: a peca (e o icone dela) afunda enquanto o
     dedo esta em cima, como no aparelho */
  var afundadas = [];
  function afundar(nome) {
    var m = /_(E0|E1|D0|D1)$/.exec(nome) || /^(?:Botao|Letra)_ombro_(E|D)$/.exec(nome);
    if (!m || !hud) return;
    var re = /_(E0|E1|D0|D1)$/.test(nome) ? new RegExp("^(Tecla|Icone)_" + m[1] + "$") : new RegExp("^(Botao|Letra)_ombro_" + m[1] + "$");
    hud.modelo.traverse(function (o) {
      if (!re.test(o.name || "") || o.userData.xgAfundada) return;
      var caixa = o.geometry && (o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox));
      var curso = caixa ? Math.max(0.5, (caixa.max.y - caixa.min.y) * 0.45) : 1;
      /* ARC3 Pro: cada tecla diz em que eixo entra no corpo ("afunda"), em metros */
      var eixo = o.userData.afunda === "z" ? "z" : "y";
      if (o.userData.afunda) curso = 0.0015;
      o.userData.xgAfundada = { eixo: eixo, v: o.position[eixo] };
      o.position[eixo] -= curso;
      afundadas.push(o);
    });
  }
  function soltarTeclas() {
    afundadas.forEach(function (o) { var a = o.userData.xgAfundada; if (a) { o.position[a.eixo] = a.v; delete o.userData.xgAfundada; } });
    afundadas = [];
  }

  var toquesLigados = false;
  function ligarToques(ponte, estado) {
    if (toquesLigados) return;
    var j = ponte.janela, G = globais(ponte);
    if (!j || !G || !G.render) return;
    toquesLigados = true;
    var tela = G.render.domElement;
    var arrasto = null;       // manche sendo arrastado
    var seguro = null;        // botao do site com pointerdown pendente

    function elemento(sel) {
      var doc = estado.docControle && estado.docControle();
      return doc ? doc.querySelector(sel) : null;
    }
    function evento(el, tipo) {
      if (!el) return;
      el.dispatchEvent(new (el.ownerDocument.defaultView.PointerEvent)(tipo, { bubbles: true, pointerId: 5 }));
    }

    tela.addEventListener("pointerdown", function (e) {
      var p = pecaTocada(ponte, e);
      if (!p) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (p.alvo === "energia") { if (estado.aoEnergia) estado.aoEnergia(); return; }
      if (p.alvo === "mancheEsq" || p.alvo === "mancheDir") {
        arrasto = { lado: p.alvo === "mancheEsq" ? "esq" : "dir", x0: e.clientX, y0: e.clientY };
        try { tela.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura */ }
        return;
      }
      afundar(p.nome);
      seguro = elemento(p.alvo);
      evento(seguro, "pointerdown");
    }, true);

    tela.addEventListener("pointermove", function (e) {
      if (!arrasto || !estado.aoManche) return;
      var raio = Math.max(20, tela.clientHeight * 0.06);
      var x = (e.clientX - arrasto.x0) / raio, y = -(e.clientY - arrasto.y0) / raio;
      var n = Math.hypot(x, y);
      if (n > 1) { x /= n; y /= n; }
      estado.aoManche(arrasto.lado, x, y);
    }, true);

    function soltar(e) {
      soltarTeclas();
      if (arrasto) {
        if (estado.aoManche) estado.aoManche(arrasto.lado, 0, 0);
        arrasto = null;
        return;
      }
      if (seguro) {
        evento(seguro, "pointerup");
        if (seguro.click) seguro.click();
        seguro = null;
      }
    }
    tela.addEventListener("pointerup", soltar, true);
    tela.addEventListener("pointercancel", soltar, true);

    /* roda do mouse sobre F1/F2: o site ja trata a roda nesses botoes */
    tela.addEventListener("wheel", function (e) {
      var p = pecaTocada(ponte, e);
      if (!p || !/nth-child\(4\)/.test(String(p.alvo))) return;
      var el = elemento(p.alvo);
      if (!el) return;
      e.preventDefault();
      el.dispatchEvent(new (el.ownerDocument.defaultView.WheelEvent)("wheel", { bubbles: true, deltaY: e.deltaY, cancelable: true }));
    }, { passive: false, capture: true });
  }

  /* ------------------------------------------------- LEDs, tela e manches */

  function atualizar(T, d, estado) {
    if (!d) return;
    if (d.ligado !== estado.ligado) {
      d.ligado = estado.ligado;
      for (var i = 0; i < 6; i++) {
        var led = d.pecas["LED_" + i];
        if (led && led.material) {
          led.material.emissive = new T.Color(estado.ligado ? "#19d67a" : "#000000");
          led.material.emissiveIntensity = estado.ligado ? 1.2 : 0;
        }
      }
      var vidro = d.pecas.Vidro_tela;
      if (vidro && vidro.material) {
        vidro.material.emissive = new T.Color(estado.ligado ? "#2a3a30" : "#000000");
        vidro.material.emissiveIntensity = estado.ligado ? 0.9 : 0;
      }
      /* o botao de ligar fica verde com o controle ligado (como no aparelho) */
      var ligar = d.pecas.Botao_ligar;
      if (ligar && ligar.material) {
        if (!ligar.userData.xgCor) { ligar.material = ligar.material.clone(); ligar.userData.xgCor = ligar.material.color.clone(); }
        if (estado.ligado) ligar.material.color.set("#20c46e"); else ligar.material.color.copy(ligar.userData.xgCor);
        ligar.material.emissive = new T.Color(estado.ligado ? "#19d67a" : "#c8202a");
        ligar.material.emissiveIntensity = estado.ligado ? 0.35 : 0.25;
      }
    }
    var c = estado.comandos || {};
    inclinar(d.pecas.Pivo_joystick_E, c.esq);
    inclinar(d.pecas.Pivo_joystick_D, c.dir);
  }

  /* no GLB a haste sai do pivo pelo +z local (medido: 0 a 19 mm em z):
     frente/tras gira em x e os lados giram em y. Girar em z so fazia a
     haste rodar em volta de si (os lados "nao funcionavam"). */
  function inclinar(pivo, cmd) {
    if (!pivo) return;
    var x = cmd ? cmd.x || 0 : 0, y = cmd ? cmd.y || 0 : 0;
    pivo.rotation.x = -y * CURSO;
    pivo.rotation.y = x * CURSO;
    pivo.rotation.z = 0;
  }

  return {
    /* estado = { tipo, ligado, comandos, vista, docControle(), aoEnergia(), aoManche(lado,x,y) } */
    manter: function (ponte, estado) {
      var j = ponte.janela;
      if (!j || !j.THREE) return;
      var T = j.THREE;
      var integrado = estado.tipo === "integrado";

      /* 1. na mao */
      var par = grupoDoControle(ponte);
      if (par) {
        var rc = par.rc;
        if (!integrado) rc.visible = false;
        else if (!rc.userData.xgSrc4) {
          rc.visible = false;                       // o RC Plus do jogo nunca aparece
          if (!rc.userData.xgSrc4Montando) {
            rc.userData.xgSrc4Montando = true;
            carregar(ponte, function (cena) {
              var agora = grupoDoControle(ponte);
              if (!agora || agora.rc !== rc) { rc.userData.xgSrc4Montando = false; return; }
              montarNaMao(ponte, par.g, rc, cena);
              rc.visible = true;
            });
          }
        } else {
          rc.visible = true;
          atualizar(T, rc.userData.xgSrc4, estado);
        }
      }

      /* 2. na vista Controle */
      if (!hud) {
        carregar(ponte, function (cena) { if (!hud) montarNaVista(ponte, cena); });
      } else {
        var mostrar = integrado && estado.vista === "controle";
        if (hud.grupo.visible !== mostrar) hud.grupo.visible = mostrar;
        if (j.__xgHud) j.__xgHud.visivel = mostrar;
        if (mostrar) { posicionarNaVista(ponte); atualizar(T, hud, estado); ligarToques(ponte, estado); }
      }
    },

    ajuste: VISTA,     // para acertar distancia/altura pelo console
    ajustePerto: PERTO,

    /* So XAG (10/10/2026): o botao Operador abre a vista Controle do jogo
       (campo dos olhos do piloto + aparelho baixo) com o Operador aceso;
       o botao Controle abre a mesma vista com o aparelho grande e perto
       (PERTO). __xgVistaXag guarda o botao que o aluno apertou. */
    vistasDoXag: function (ponte) {
      ponte.rodar(
        "(function(){" +
        "  if (window.__xgVistasXag) return;" +
        "  window.__xgVistasXag = true;" +
        "  var antes = window.definirVista;" +
        "  window.definirVista = function (v) {" +
        "    window.__xgVistaXag = v;" +
        "    antes(v === 'operador' ? 'controle' : v);" +
        "    if (v === 'operador') document.querySelectorAll('#vistas button').forEach(function (b) {" +
        "      b.setAttribute('aria-pressed', b.dataset.v === 'operador'); });" +
        "  };" +
        "  document.querySelectorAll('#vistas button').forEach(function (b) {" +
        "    b.onclick = function () { window.definirVista(b.dataset.v); b.blur(); };" +
        "  });" +
        "  if (typeof vista !== 'undefined') window.__xgVistaXag = vista;" +
        "})()"
      );
    },

    /* onde a tela do XAG One tem de ficar (pixels da janela), ou null */
    telaNaVista: function (ponte) {
      try { return retanguloDaTela(ponte); } catch (e) { return null; }
    },
  };
})();
