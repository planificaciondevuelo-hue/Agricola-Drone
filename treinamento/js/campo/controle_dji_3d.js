/* ==========================================================================
   O CONTROLE DO AGRAS T10 / T30 EM 3D - NA MAO DO OPERADOR E NA VISTA CONTROLE

   Pedido do Eduardo (13/10/2026): o controle do T10 e do T30 e o "smart
   controller" (nao o RC Plus do T25/T50), com o MESMO app do T25/T50.
   Modelo: `assets/modelos/dji_rc_t10.glb`, gerado por
   D:\Area de trabalho\modelos-3d\controle_rc_plus\gerar_controle_rc_plus.py
   (versao sem a marca). Em metros, y para cima, frente em +z. Nos:
     Corpo, Vidro_tela (material Tela_Vidro, 212 x 119 mm, 16:9),
     Joystick_Esquerdo / Joystick_Direito (pivo na base, haste em +z),
     Botao_ligar, Botao_C, Botao_redondo, Botao_sinal, Seletor_Modo,
     Antena_*, Roda_*, Suporte.

   Mesma ideia do SRC4 (controle_xag_3d.js), sem mexer nele:
   1. NA MAO DO OPERADOR: entra no grupo do controle do trabalhador no lugar
      do RC Plus do jogo.
   2. NAS VISTAS CONTROLE E OPERADOR: o modelo e desenhado numa segunda
      passada (cena e camera so dele) logo depois do campo; o app do DJI
      (o mesmo iframe do T25/T50) e encaixado no vidro pelo retangulo
      projetado (telaNaVista). O desenho 2D do RC Plus do campo fica
      invisivel, mas continua existindo: os botoes do modelo repassam os
      toques para ele, que ja tem as funcoes (energia segurando 1,5 s,
      RTH, pausa, voltar).

   Botoes (o aparelho da foto nao diz a funcao; ajustar aqui se ele
   mandar a do aparelho dele): refeito em 13/10/2026 pelo Agras Smart Controller real (RM500-ENT):
   liga/desliga = energia, H ao lado do QR = RTH, botao do ombro esquerdo = voltar; C, 5D e o
   icone sem funcao (o aparelho nao tem pausa). Manches: seguem o voo (teclado, mouse) e podem ser arrastados.
   ========================================================================== */

window.CONTROLE_DJI_3D = (function () {
  "use strict";

  var ARQUIVO = "../../assets/modelos/dji_rc_t10.glb";   // a pagina do campo esta em treinamento/campo/
  var CURSO = 0.42;               // rad de inclinacao do manche no fim do curso (24 graus)
  var INCLINA = 0.08;             // na vista, o tampo um pouco para cima
  /* 21/10/2026 (Eduardo: "o controle do T10 esta muito feio, parece uma foto, e a tela nao esta bem encaixada"):
     so o T10 (arquivo dji_rc_t10.glb) ganha o visual novo - aparelho deitado para mostrar o volume, luz de estudio
     com reflexo suave e corpo liso - e o app passa a ser encaixado no vidro por perspectiva (matrix3d), nao por
     um retangulo. Os outros aparelhos (EAV-RC50/RC60) seguem como estavam. */
  var ARQUIVO_T10 = "../../assets/modelos/dji_rc_t10.glb";
  var INCLINA_T10 = 0.05;         // 21/10/2026: 0,30 deixava o aparelho "inclinado" (Eduardo); fica quase de frente, so um toque para cima
  var DIST = 1.0;                 // distancia da camera da vista ao aparelho
  /* parte do aparelho que aparece na vista Operador (o resto fica abaixo da
     janela), como o jogo faz com o RC Plus (0,36 do desenho com antenas) */
  var MOSTRA_NO_OPERADOR = 0.55;

  var carregado = null, carregando = false, hud = null, desenhoEscondido = false;
  function novoVisual() { return ARQUIVO === ARQUIVO_T10; }
  function inclinaAtual() { return novoVisual() ? INCLINA_T10 : INCLINA; }

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
    new j.THREE.GLTFLoader().load(ARQUIVO, function (gltf) {
      carregado = gltf.scene;
      var fila = carregando; carregando = false;
      fila.forEach(function (f) { f(carregado); });
    }, undefined, function (erro) {
      carregando = false;
      console.warn("Controle 3D do T10 nao carregou:", erro);
    });
  }

  /* uma copia com material proprio por peca, centrada no corpo (o pivo
     fica no meio do corpo, sem as antenas) */
  function copiar(T, cena) {
    var modelo = cena.clone(true);
    modelo.traverse(function (o) {
      if (!o.isMesh) return;
      o.material = o.material.clone(); o.castShadow = true;
      /* 21/11/2026 (Eduardo, no Air 2S: "o controle ta muito branco"): o RC-N1 de verdade tem o corpo cinza e as pegadas pretas;
         no modelo o corpo vinha cinza claro e, com a luz forte da vista, ficava quase branco. Escuro demais ele tambem nao gostou ("agora
         o controle ta preto de mais") */
      if (/dji_rc_n1\.glb$/.test(ARQUIVO)) {
        if (o.material.name === "Plastico_Cinza_Claro") o.material.color.setRGB(0.075, 0.078, 0.085);   // valores lineares (o three.js daqui nao converte o "#hex")
        else if (o.material.name === "Empunhadura_Cinza") o.material.color.setRGB(0.022, 0.023, 0.025);
      }
      /* 13/10/2026 (Eduardo: "muito escuro, nao da pra identificar os botoes"): os
         icones e letras dos botoes acendem um pouco, como a serigrafia clara do aparelho */
      if (o.material.name === "Etiquetas" && o.material.map) {
        o.material.emissive = new T.Color("#ffffff");
        o.material.emissiveMap = o.material.map;
        o.material.emissiveIntensity = 0.55;
      }
    });
    modelo.updateMatrixWorld(true);
    var corpo = modelo.getObjectByName("Corpo") || modelo;
    var centro = new T.Box3().setFromObject(corpo).getCenter(new T.Vector3());
    modelo.position.set(-centro.x, -centro.y, -centro.z);
    var pivo = new T.Group();
    pivo.add(modelo);
    pivo.updateMatrixWorld(true);
    /* tamanho na vista pelo CORPO (com a caixa de baixo), sem as antenas: elas podem sair por
       cima da janela, como no desenho do RC Plus, e a tela do app fica maior (13/10/2026) */
    var toda = new T.Box3().setFromObject(corpo !== modelo ? corpo : modelo);
    /* a tela entra na conta: no RC-N1 do Air 2S o celular fica ACIMA do corpo, e so o corpo
       fazia o controle encher a janela com a tela fora dela (13/10/2026) */
    var vidroDaConta = modelo.getObjectByName("Vidro_tela");
    if (vidroDaConta) toda.union(new T.Box3().setFromObject(vidroDaConta));
    var pecas = {};
    modelo.traverse(function (o) { if (o.name && !pecas[o.name]) pecas[o.name] = o; });
    var vidro = pecas.Vidro_tela;
    if (vidro && !vidro.isMesh) vidro.traverse(function (o) { if (o.isMesh) vidro = o; });
    return {
      modelo: pivo, pecas: pecas, vidro: vidro, ligado: null, foto: null,
      alto: toda.max.y - toda.min.y, largo: toda.max.x - toda.min.x, meioY: (toda.max.y + toda.min.y) / 2,
      frenteZ: toda.max.z,       // a face da frente fica na distancia DIST (perspectiva certa na conta do tamanho)
      vidroCaixa: vidro ? new T.Box3().setFromObject(vidro) : null,   // para o foco na tela (Air 2S)
      texturaOriginal: vidro && vidro.material ? vidro.material.map : null,
      brilhoTela: 0.55,          // luz propria do vidro apagado (na vista: menos, ver montarNaVista)
    };
  }

  /* ------------------------------------------------- 1. na mao do operador */

  function montarNaMao(ponte, g, rc, cena) {
    var T = ponte.janela.THREE;
    var escala = g.scale.x || 1;
    var d = copiar(T, cena);
    d.modelo.scale.setScalar(1 / escala);
    /* frente (+z) para o operador, que fica do lado -z do grupo: meia-volta.
       As maos ficam nas empunhaduras de tras (como no SRC4): o corpo vai um
       pouco para a frente e para baixo. */
    d.modelo.rotation.set(0, Math.PI, 0);
    d.modelo.position.set(0, -0.03 / escala, 0.06 / escala);
    rc.clear();
    rc.add(d.modelo);
    rc.userData.xgRcT10 = d;
    if (ponte.poseDeSegurar) ponte.poseDeSegurar(T, g, rc);
  }

  /* ------------------------------------- 2. nas vistas Controle e Operador */

  /* Na vista o aparelho fica grande, contra o campo claro: preto puro virava uma
     mancha sem botoes (Eduardo, 13/10/2026). So nesta copia (a da mao continua com
     as cores do modelo): os plasticos escuros viram grafite e os botoes (nos
     Botao_*) ficam um cinza mais claro que o corpo, para cada um se destacar. */
  function clarearParaAVista(T, modelo) {
    function plastico(m) {
      return m && !(m.metalness > 0.5) && !/^(Tela_Vidro|Etiquetas|LED)/.test(m.name || "");
    }
    modelo.traverse(function (o) {
      if (!o.isMesh || !plastico(o.material)) return;
      var c = o.material.color;
      if (o.material.map) c.multiplyScalar(2.6);                        // corpo texturizado
      else {
        var maior = Math.max(c.r, c.g, c.b);
        if (maior < 0.03) c.multiplyScalar(0.03 / Math.max(maior, 0.004));
      }
    });
    modelo.traverse(function (no) {
      if (!/^Botao_/.test(no.name || "")) return;
      no.traverse(function (o) {
        if (!o.isMesh || !plastico(o.material)) return;
        var c = o.material.color, maior = Math.max(c.r, c.g, c.b);
        if (maior < 0.09) c.multiplyScalar(0.09 / Math.max(maior, 0.004));
      });
    });
  }

  /* Os dois botoes de cima (Voltar a esquerda, Confirmar a direita) eram duas pastilhas escuras de 6 mm, sem icone: ninguem
     achava o Voltar (Eduardo, 21/10/2026). Viram botoes redondos como os outros, com a seta e o visto desenhados na
     frente. Mesmo no (mesmo nome), entao o toque, o afundar ao apertar e o mapa de pecas continuam valendo. */
  function iconeDeBotao(doc, tipo) {
    var c = doc.createElement("canvas"); c.width = c.height = 128;
    var g = c.getContext("2d");
    g.strokeStyle = "#f2f4f7"; g.lineWidth = 15; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath();
    if (tipo === "voltar") { g.moveTo(102, 64); g.lineTo(28, 64); g.moveTo(60, 30); g.lineTo(26, 64); g.lineTo(60, 98); }      // seta para a esquerda
    else { g.moveTo(24, 68); g.lineTo(52, 96); g.lineTo(104, 34); }                                                              // visto
    g.stroke();
    return c;
  }
  function botoesDeOmbro(T, d, doc) {
    [["Botao_voltar", "voltar"], ["Botao_confirmar", "confirmar"]].forEach(function (b) {
      var no = d.pecas[b[0]];
      if (!no || !no.isMesh) return;
      var cil = new T.CylinderGeometry(0.0042, 0.0042, 0.003, 40);
      cil.rotateX(Math.PI / 2);                                    // o eixo do cilindro vira o z (para a frente)
      no.geometry = cil;
      var tex = new T.CanvasTexture(iconeDeBotao(doc, b[1]));
      tex.anisotropy = 4;
      var marca = new T.Mesh(new T.PlaneGeometry(0.0062, 0.0062), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
      marca.material.color.setScalar(0.8);
      marca.position.z = 0.0016;
      no.add(marca);
    });
  }

  /* Visual novo do T10 (21/10/2026): o corpo deixa a textura de ruido (virava um couro cinza chapado,
     "parece uma foto") e fica grafite liso e fosco; o aparelho ganha um ambiente de estudio escuro gerado aqui, que
     so risca de luz os cantos arredondados, os manches, as rodas e os botoes brilhantes. Corpo de cima (Plastico_Macio)
     e de baixo (Plastico_Texturizado) levam a mesma cor, senao a caixa de baixo ficava mais clara que o resto. */
  function acabamentoNovo(T, d, render, doc) {
    d.modelo.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var m = o.material;
      if (m.name === "Plastico_Texturizado" || m.name === "Plastico_Macio") {
        m.map = null; m.color.set("#0d0d0f"); m.roughness = 0.6; m.envMapIntensity = 1;
        if (m.normalScale) m.normalScale.set(0.2, 0.2);
        m.needsUpdate = true;
      } else if (m.isMeshStandardMaterial && !/^(Tela_Vidro|Etiquetas|LED)/.test(m.name || "")) {
        m.envMapIntensity = 1;
        if (m.name === "Plastico_Brilhante") m.roughness = 0.4;
      }
    });
    botoesDeOmbro(T, d, doc);
    try {
      var sc = new T.Scene();
      sc.add(new T.Mesh(new T.SphereGeometry(10, 48, 24), new T.ShaderMaterial({ side: T.BackSide,
        vertexShader: "varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
        fragmentShader: "varying vec3 p; void main(){ float y = p.y; vec3 topo = vec3(0.09); vec3 hor = vec3(0.047); vec3 chao = vec3(0.02);" +
          " vec3 c = y > 0. ? mix(hor, topo, pow(y, 0.7)) : mix(hor, chao, pow(-y, 0.7)); gl_FragColor = vec4(c, 1.); }" })));
      /* Estudio escuro: a frente do aparelho reflete so o fundo quase preto (grafite, nao cinza azulado) e as tres luzes de caixa
         (uma por cima e uma de cada lado) ficam quase de raspao, para riscar de luz so os cantos arredondados e as bordas. */
      [[0, 6, 1.5, 10, 2.5, 6], [-6, 1, 1, 2, 6, 4], [6, 1, 1, 2, 6, 4]].forEach(function (l) {      // x, y, z, largura, altura, brilho
        var caixa = new T.Mesh(new T.PlaneGeometry(l[3], l[4]), new T.MeshBasicMaterial({ side: T.DoubleSide }));
        caixa.material.color.setRGB(l[5], l[5], l[5]); caixa.position.set(l[0], l[1], l[2]); caixa.lookAt(0, 0, 0); sc.add(caixa);
      });
      var pm = new T.PMREMGenerator(render);
      d.cena.environment = pm.fromScene(sc, 0.02).texture;
      pm.dispose();
    } catch (e) { /* sem ambiente: ficam so as luzes */ }
  }

  function montarNaVista(ponte, cena) {
    var j = ponte.janela, T = j.THREE;
    var G = globais(ponte);
    if (!G || !G.render) return;
    var d = copiar(T, cena);
    clarearParaAVista(T, d.modelo);
    d.brilhoTela = 0.12;       // com a luz de dia o vidro apagado ficava cinza nas faixas ao lado do app
    var grupo = new T.Group();
    grupo.name = "xgRcT10Vista";
    grupo.add(d.modelo);
    d.modelo.rotation.set(inclinaAtual(), 0, 0);
    d.grupo = grupo;
    grupo.visible = false;

    d.cena = new T.Scene();
    d.cena.add(grupo);
    /* luz de dia: o aparelho e preto fosco e, com a luz contida de antes, sumia
       contra o campo (13/10/2026). Ceu claro, sol por cima e de frente e uma luz
       de preenchimento do lado oposto, para os botoes ganharem volume. */
    var novo = novoVisual();
    d.cena.add(new T.HemisphereLight(0xffffff, novo ? 0x30343a : 0x6a7078, novo ? 0.12 : 1.5));
    var sol = new T.DirectionalLight(0xffffff, novo ? 1.0 : 1.6);
    sol.position.set(novo ? -0.8 : 0.5, novo ? 1.2 : 1.2, novo ? 1.4 : 1.6);
    d.cena.add(sol);
    var preenche = new T.DirectionalLight(0xdfe6ee, novo ? 0.2 : 0.7);
    preenche.position.set(-1.0, 0.3, 1.0);
    d.cena.add(preenche);
    if (novo) acabamentoNovo(T, d, G.render, j.document);
    d.cam = new T.PerspectiveCamera(45, 1, 0.05, 10);
    d.cam.position.set(0, 0, 0);
    d.cam.lookAt(0, 0, -1);
    hud = d;
    j.__xgHudDji = { cena: d.cena, cam: d.cam, visivel: false };

    /* A passada do aparelho vem logo depois do campo, nas duas vistas: na
       Controle o campo e desenhado pelo renderControle (com a camera dos
       olhos do piloto, ponte.campoAtrasDoAparelho); na Operador, pelo
       render.render normal. Embrulhar render.render pega os dois. */
    ponte.rodar(
      "(function(){" +
      "  if (window.__xgHudDjiEmbrulhado) return;" +
      "  window.__xgHudDjiEmbrulhado = true;" +
      "  var rr = render.render.bind(render);" +
      "  render.render = function (s, c) {" +
      "    rr(s, c);" +
      "    var h = window.__xgHudDji;" +
      "    if (!h || !h.visivel || s !== cena || modoMapa || telaInicial) return;" +
      "    if (window.xgVR && xgVR.ativo) return;" +
      "    if (vista !== 'controle' && vista !== 'operador') return;" +
      "    if (c !== cam && c !== window.__camFrente) return;" +
      "    var ac = render.autoClear;" +
      "    render.autoClear = false;" +
      "    render.clearDepth();" +
      "    rr(h.cena, h.cam);" +
      "    render.autoClear = ac;" +
      /* a camera do drone vem logo depois (cameraNoControle) e usa rcCaixa: outros embrulhos do
         layoutControle (painel do auxiliar) mexem nela, entao a caixa do vidro volta a cada quadro */
      "    if (window.__xgRcT10Caixa) window.__xgRcT10Caixa();" +
      /* Vista Operador (13/10/2026, Air 2S: "nao ta funcionando a camera"): a camera do drone so
         era copiada para as telas do app dentro do renderControle (vista Controle); aqui ela tambem
         sai na Operador, no mesmo ritmo (quadro sim, quadro nao) e no mesmo lugar (rcCaixa). */
      "    if (vista === 'operador' && window.__xgFpv && window.xgFpvAlvos && window.xgFpvAlvos.length) {" +
      "      window.__xgFpvN = (window.__xgFpvN || 0) + 1;" +
      "      var q = rcCaixa, alvos = window.xgFpvAlvos;" +
      "      if (!(window.__xgFpvN % 2) && q.sw && q.sh) {" +
      "        var pr = render.getPixelRatio(), fonte = render.domElement, Hj = innerHeight;" +
      "        atualizarFpv();" +
      "        if (typeof window.xgGimbal === 'number') {" +
      "          var pf = camFpv.position, ag = window.xgGimbal * Math.PI / 180, fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);" +
      "          camFpv.up.set(0, 1, 0);" +
      "          camFpv.lookAt(pf.x + fx * Math.cos(ag) * 10, pf.y + Math.sin(ag) * 10, pf.z + fz * Math.cos(ag) * 10);" +
      "        }" +
      "        render.setScissorTest(true);" +
      "        render.setScissor(q.sx, Hj - q.sy - q.sh, q.sw, q.sh);" +
      "        render.setViewport(q.sx, Hj - q.sy - q.sh, q.sw, q.sh);" +
      "        rr(cena, camFpv);" +
      "        render.setScissorTest(false);" +
      "        render.setViewport(0, 0, innerWidth, innerHeight);" +
      "        for (var ia = 0; ia < alvos.length; ia++) {" +
      "          var tl = alvos[ia], wl = tl.clientWidth, hl = tl.clientHeight;" +
      "          if (!wl || !hl) continue;" +
      "          var dl = (tl.ownerDocument.defaultView || window).devicePixelRatio || 1, Wl = Math.round(wl * dl), Hl = Math.round(hl * dl);" +
      "          if (tl.width !== Wl) tl.width = Wl; if (tl.height !== Hl) tl.height = Hl;" +
      "          tl.getContext('2d').drawImage(fonte, q.sx * pr, q.sy * pr, q.sw * pr, q.sh * pr, 0, 0, Wl, Hl);" +
      "        }" +
      "      }" +
      "    }" +
      "  };" +
      "})()"
    );
  }

  /* O aparelho ocupa a janela como o desenho do RC Plus do jogo
     (layoutControle: ate 96% da largura e a altura livre acima da barra de
     baixo); na vista Operador ele desce e so a parte de cima aparece. */
  function posicionarNaVista(ponte, vista) {
    var G = globais(ponte);
    if (!hud || !G || !G.render) return;
    var tela = G.render.domElement;
    var cw = tela.clientWidth || 1, ch = tela.clientHeight || 1;
    var c = hud.cam;
    c.aspect = cw / ch;
    c.updateProjectionMatrix();
    var pxPorM = ch / (2 * DIST * Math.tan(c.fov * Math.PI / 360));
    var livre = ch - 64 - MARGEM_TOPO;
    var s = Math.min(0.96 * cw / (hud.largo * pxPorM), (novoVisual() ? 0.9 : 0.98) * livre / (hud.alto * pxPorM));   // deitado, o aparelho ocupa mais altura
    var alturaPx = hud.alto * s * pxPorM;
    var topo = MARGEM_TOPO + (vista === "operador" ? livre - alturaPx * MOSTRA_NO_OPERADOR : Math.max(6, (livre - alturaPx) / 2));
    var meioPx = topo + alturaPx / 2;
    var y = (ch / 2 - meioPx) / pxPorM - hud.meioY * s;
    /* Foco na tela (Air 2S, 13/10/2026: "a colocacao do controle ta ruim"): na vista Controle o
       celular fica grande no alto, com os manches logo abaixo e o resto do controle saindo pela
       parte de baixo da janela, como quem olha o celular pilotando. */
    var vc = hud.vidroCaixa;
    if (FOCO_TELA && vista !== "operador" && vc) {
      var vw = vc.max.x - vc.min.x, vh = vc.max.y - vc.min.y;
      s = Math.min(FOCO_TELA.largura * cw / (vw * pxPorM), FOCO_TELA.altura * ch / (vh * pxPorM));
      var topoVidroPx = MARGEM_TOPO + FOCO_TELA.topo * ch;
      y = (ch / 2 - topoVidroPx) / pxPorM - vc.max.y * s;
    }
    hud.modelo.scale.setScalar(s);
    hud.modelo.rotation.x = inclinaAtual();
    hud.grupo.position.set(0, y, -DIST - (hud.frenteZ || 0) * s);
    hud.grupo.updateMatrixWorld(true);
  }

  /* o retangulo do vidro, em pixels da janela do treinamento */
  function retanguloDaTela(ponte) {
    if (!hud || !hud.grupo.visible || !hud.vidro) return null;
    var T = ponte.janela.THREE, G = globais(ponte), c = hud.cam;
    if (!G || !G.render) return null;
    posicionarNaVista(ponte, hud.vista);     // a janela pode ter mudado de tamanho desde o ultimo ciclo
    var vidro = hud.vidro;
    if (!vidro.geometry.boundingBox) vidro.geometry.computeBoundingBox();
    var b = vidro.geometry.boundingBox;
    var tela = G.render.domElement;
    var cw = tela.clientWidth, ch = tela.clientHeight;
    var quadro = ponte.iframe.getBoundingClientRect();
    if (novoVisual()) {
      /* T10: os 4 cantos do vidro como aparecem na tela (cima-esq, cima-dir, baixo-dir, baixo-esq) */
      var q4 = [[b.min.x, b.max.y], [b.max.x, b.max.y], [b.max.x, b.min.y], [b.min.x, b.min.y]].map(function (p) {
        var v4 = new T.Vector3(p[0], p[1], b.max.z).applyMatrix4(vidro.matrixWorld).project(c);
        return [quadro.left + (v4.x + 1) / 2 * cw, quadro.top + (1 - v4.y) / 2 * ch];
      });
      return quadroDaTela(q4);
    }
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.min.x, b.max.y], [b.max.x, b.max.y]].forEach(function (p) {
      var v = new T.Vector3(p[0], p[1], b.max.z).applyMatrix4(vidro.matrixWorld).project(c);
      var x = quadro.left + (v.x + 1) / 2 * cw, y = quadro.top + (1 - v.y) / 2 * ch;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    });
    if (!(x1 > x0 && y1 > y0)) return null;
    /* A tela do app (controle/index.html, #tela) e 16:10 com 4 px de moldura e cresce
       pela largura: no vidro 16:9 do T10 a parte de baixo do app ficava cortada
       (13/10/2026). Vidro mais largo que isso: o app fica no meio, com faixas escuras
       do vidro dos lados, como um video 16:10 numa tela 16:9. */
    var w = x1 - x0, h = y1 - y0, largMax = (h - 2 * BORDA_APP) * RAZAO_APP + 2 * BORDA_APP;
    if (RAZAO_APP && w > largMax) { x0 += (w - largMax) / 2; w = largMax; }   // razaoApp 0 = vidro inteiro (celular do Air 2S)
    return { x: x0, y: y0, w: w, h: h };
  }
  /* Encaixe por perspectiva (T10): q = [cima-esq, cima-dir, baixo-dir, baixo-esq] em pixels da janela.
     Devolve o elemento (x, y = canto de cima a esquerda; w, h = tamanho do app) e o matrix3d que leva os
     cantos dele aos do vidro (homografia de 4 pontos), alem do maior retangulo reto dentro do vidro (a
     caixa da camera do drone, que e desenhada por baixo do app). */
  function quadroDaTela(q) {
    var dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    var wm = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2, hm = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2;
    if (!(wm > 1 && hm > 1)) return null;
    /* O palco do app do T10 e 16:9 e o vidro tambem; com o aparelho deitado o vidro aparece mais baixo do que largo
       (encurtado pela perspectiva), entao o elemento NAO usa a altura medida: tem a proporcao do palco e a matriz
       o leva aos quatro cantos do vidro. Antes o app era estreitado e sobravam faixas escuras nos lados (21/10/2026). */
    var W = Math.round(wm), H = Math.round(wm * 9 / 16), o = q[0];
    var P = q.map(function (p) { return [p[0] - o[0], p[1] - o[1]]; });
    var x1 = P[1][0], y1 = P[1][1], x2 = P[2][0], y2 = P[2][1], x3 = P[3][0], y3 = P[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = -x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = -y1 + y2 - y3;
    var det = dx1 * dy2 - dx2 * dy1, g = 0, hh = 0;
    if ((Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) && Math.abs(det) > 1e-9) { g = (dx3 * dy2 - dx2 * dy3) / det; hh = (dx1 * dy3 - dx3 * dy1) / det; }
    var a = x1 + g * x1, b = x3 + hh * x3, d = y1 + g * y1, e = y3 + hh * y3;
    var m = [a / W, d / W, 0, g / W, b / H, e / H, 0, hh / H, 0, 0, 1, 0, 0, 0, 0, 1].map(function (n) { return +n.toFixed(7); });
    /* maior retangulo reto dentro do quadrilatero, na proporcao do app */
    var ix0 = Math.max(q[0][0], q[3][0]), ix1 = Math.min(q[1][0], q[2][0]), iy0 = Math.max(q[0][1], q[1][1]), iy1 = Math.min(q[3][1], q[2][1]);
    var iw = ix1 - ix0, ih = iy1 - iy0, asp = W / H;
    if (iw / ih > asp) { var nw = ih * asp; ix0 += (iw - nw) / 2; iw = nw; } else { var nh = iw / asp; iy0 += (ih - nh) / 2; ih = nh; }
    return { x: o[0], y: o[1], w: W, h: H, matriz: "matrix3d(" + m.join(",") + ")", dentro: { x: ix0, y: iy0, w: iw, h: ih } };
  }
  var RAZAO_APP = 1.6, BORDA_APP = 4;
  var FOCO_TELA = null;           // {largura, altura, topo} em fracao da janela (Air 2S); null = aparelho inteiro
  var MARGEM_TOPO = 0;            // px livres no alto da vista (Air 2S: a barra de clima do campo fica acima do celular)

  /* O RC Plus desenhado pelo campo nunca aparece com este controle; fica
     escondido (visibility, para o layout do jogo continuar o mesmo) e os
     botoes dele continuam recebendo os toques repassados. */
  function esconderDesenho(ponte) {
    if (desenhoEscondido) return;
    desenhoEscondido = ponte.rodar(
      "(function(){" +
      "  if (document.getElementById('xg-rc-t10')) return true;" +
      "  var e = document.createElement('style');" +
      "  e.id = 'xg-rc-t10';" +
      "  e.textContent = '#vCtrlRc,#tela{visibility:hidden!important}';" +
      "  document.head.appendChild(e);" +
      "  return true;" +
      "})()"
    ) === true;
  }

  /* ------------------------------------------ os toques no modelo (vistas) */

  var MAPA_DE_PECAS = [
    /* Agras Smart Controller RM500-ENT (manual do T30 v1.4, itens 2, 4 e 10): o "H" ao lado do QR e o RTH,
       o botao do ombro esquerdo e o Voltar. C (C3), 5D e o icone ficam sem funcao; o aparelho nao tem
       botao de pausa (pausa pelo teclado/barra). Nomes antigos ficam para o modelo anterior. */
    [/^Botao_ligar/, "energia"], [/^Botao_RTH/, "rth"], [/^Botao_voltar/, "voltar"], [/^Botao_redondo/, "pausa"],
    [/^Joystick_Esquerdo/, "esq"], [/^Joystick_Direito/, "dir"],
  ];

  function pecaTocada(ponte, e) {
    if (!hud || !hud.grupo.visible) return null;
    var T = ponte.janela.THREE, G = globais(ponte);
    if (!G) return null;
    var r = G.render.domElement.getBoundingClientRect();
    var nd = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    var ray = new T.Raycaster();
    ray.setFromCamera(nd, hud.cam);
    var hits = ray.intersectObject(hud.modelo, true);
    if (!hits.length) return null;
    for (var o = hits[0].object; o && o !== hud.modelo; o = o.parent) {
      for (var i = 0; i < MAPA_DE_PECAS.length; i++) {
        if (MAPA_DE_PECAS[i][0].test(o.name || "")) return { alvo: MAPA_DE_PECAS[i][1], no: o };
      }
    }
    return { alvo: null };      // tocou no corpo: so nao deixa o toque passar para o campo
  }

  /* os botoes do desenho do campo que ja fazem cada coisa */
  function botaoDoDesenho(doc, alvo) {
    if (alvo === "rth") return doc.getElementById("rcRth");
    if (alvo === "pausa") return doc.getElementById("rcPausa");
    var circulo = alvo === "energia" ? doc.querySelector('#vCtrlRc circle[cx="1680"][cy="1258"]')
      : alvo === "voltar" ? doc.querySelector('#vCtrlRc circle[cx="188"][cy="1050"]') : null;
    return circulo ? circulo.parentNode : null;
  }

  var toquesLigados = false;
  function ligarToques(ponte, estado) {
    if (toquesLigados) return;
    var j = ponte.janela, G = globais(ponte);
    if (!j || !G || !G.render) return;
    toquesLigados = true;
    var tela = G.render.domElement;
    var arrasto = null, apertado = null;

    function evento(el, tipo) {
      if (!el) return;
      var W = el.ownerDocument.defaultView;
      var E = /^pointer/.test(tipo) ? W.PointerEvent : W.MouseEvent;
      el.dispatchEvent(new E(tipo, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "mouse", button: 0 }));
    }
    function afundar(no, sim) {
      if (!no) return;
      if (sim && no.userData.xgZ === undefined) { no.userData.xgZ = no.position.z; no.position.z -= 0.0015; }
      if (!sim && no.userData.xgZ !== undefined) { no.position.z = no.userData.xgZ; delete no.userData.xgZ; }
    }

    tela.addEventListener("pointerdown", function (e) {
      var p = pecaTocada(ponte, e);
      if (!p) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (!p.alvo) return;
      if (p.alvo === "esq" || p.alvo === "dir") {
        arrasto = { lado: p.alvo, x0: e.clientX, y0: e.clientY };
        try { tela.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura */ }
        return;
      }
      apertado = p;
      p.t0 = performance.now();
      afundar(p.no, true);
      /* a energia e "segurar": o desenho conta o tempo entre o down e o up */
      if (p.alvo === "energia") evento(botaoDoDesenho(j.document, "energia"), "pointerdown");
      /* 24/10/2026: o RTH tambem e "segurar" (1,5 s, contado pelo desenho do campo); o Air 2S (aoBotao) conta o proprio tempo */
      else if (p.alvo === "rth" && !estado.aoBotao) evento(botaoDoDesenho(j.document, "rth"), "pointerdown");
    }, true);

    tela.addEventListener("pointermove", function (e) {
      if (!arrasto || !estado.aoManche) return;
      var raio = Math.max(20, tela.clientHeight * 0.06);
      var x = (e.clientX - arrasto.x0) / raio, y = -(e.clientY - arrasto.y0) / raio;
      x = Math.max(-1, Math.min(1, x)); y = Math.max(-1, Math.min(1, y));
      estado.aoManche(arrasto.lado, x, y);
      e.stopImmediatePropagation();
    }, true);

    function soltar() {
      if (arrasto) {
        if (estado.aoManche) estado.aoManche(arrasto.lado, null);
        arrasto = null;
        return;
      }
      if (!apertado) return;
      var p = apertado; apertado = null;
      afundar(p.no, false);
      /* botoes que o RC Plus do desenho nao tem (RC-N1 do Air 2S): quem configurou decide */
      if (estado.aoBotao && estado.aoBotao(p.alvo, performance.now() - (p.t0 || 0)) === true) return;
      var el = botaoDoDesenho(j.document, p.alvo);
      if (p.alvo === "energia" || (p.alvo === "rth" && !estado.aoBotao)) evento(el, "pointerup");
      else evento(el, "click");
    }
    tela.addEventListener("pointerup", soltar, true);
    tela.addEventListener("pointercancel", soltar, true);
  }

  /* --------------------------------------- botao aceso, tela e manches */

  function atualizar(T, d, estado) {
    if (!d) return;
    var fase = estado.fase || "desligado";
    var ligado = fase !== "desligado";
    var chave = fase + "|" + (estado.foto || "");
    if (d.ligado !== chave) {
      d.ligado = chave;
      /* o anel do liga/desliga faz o papel das luzes, como no desenho do jogo */
      var bt = d.pecas.Botao_ligar;
      if (bt) bt.traverse(function (o) {
        if (!o.isMesh || !o.material || o.material.name === "Etiquetas") return;
        o.material.emissive = new T.Color(ligado ? "#2bef5d" : "#000000");
        o.material.emissiveIntensity = ligado ? 0.45 : 0;
      });
      trocarTela(T, d, ligado ? estado.foto : null, fase === "pronto");
    }
    var c = estado.comandos || {};
    inclinar(d.pecas.Joystick_Esquerdo, c.esq);
    inclinar(d.pecas.Joystick_Direito, c.dir);
  }

  /* Na mao, a tela mostra a foto do campo (o mapa do app) com o controle
     ligado, como o RC Plus do jogo; desligado, o vidro escuro do modelo. */
  function trocarTela(T, d, foto, pronto) {
    var m = d.vidro && d.vidro.material;
    if (!m) return;
    if (!foto) {
      m.map = d.texturaOriginal; m.emissiveMap = d.texturaOriginal;
      m.emissiveIntensity = d.brilhoTela; m.needsUpdate = true;
      d.foto = null;
      return;
    }
    if (d.foto === foto) return;
    d.foto = foto;
    new T.TextureLoader().load(foto, function (tex) {
      if (d.foto !== foto) return;
      tex.flipY = false;                 // UV do glTF: v = 0 em cima
      tex.encoding = T.sRGBEncoding;
      m.map = tex; m.emissiveMap = tex;
      m.emissive = new T.Color("#ffffff");
      m.emissiveIntensity = pronto ? 0.3 : 0.15;
      m.needsUpdate = true;
    });
  }

  /* A camera do drone (FPV) que o app mostra e desenhada pelo campo na caixa
     da tela do RC Plus (rcCaixa.sx/sy/sw/sh, ponte.cameraNoControle) e
     copiada para as telas de camera do app. Com este controle a caixa passa
     a ser o vidro do modelo: a imagem fica por baixo do app, e nao solta em
     volta dele, e sai na proporcao 16:9 do vidro. O layoutControle do jogo
     refaz a caixa (resize, troca de vista); o embrulho aplica de novo. */
  function caixaNoVidro(ponte, r) {
    var j = ponte.janela, quadro = ponte.iframe.getBoundingClientRect();
    if (r.dentro) r = r.dentro;       // T10: a caixa da camera e o retangulo reto dentro do vidro inclinado
    j.__xgRcT10Tela = { sx: r.x - quadro.left, sy: r.y - quadro.top, sw: r.w, sh: r.h };
    ponte.rodar(
      "(function(){" +
      "  if (!window.__xgRcT10Caixa) {" +
      "    window.__xgRcT10Caixa = function () {" +
      "      var t = window.__xgRcT10Tela, h = window.__xgHudDji;" +
      "      if (!t || !h || !h.visivel || typeof rcCaixa === 'undefined') return;" +
      "      rcCaixa.sx = t.sx; rcCaixa.sy = t.sy; rcCaixa.sw = t.sw; rcCaixa.sh = t.sh;" +
      "      if (typeof camFpv !== 'undefined' && Math.abs(camFpv.aspect - t.sw / t.sh) > 1e-3) {" +
      "        camFpv.aspect = t.sw / t.sh; camFpv.updateProjectionMatrix();" +
      "      }" +
      "    };" +
      "    var antes = layoutControle;" +
      "    layoutControle = function () { antes.apply(this, arguments); window.__xgRcT10Caixa(); };" +
      "    addEventListener('resize', function () { window.__xgRcT10Caixa(); });" +
      "  }" +
      "  window.__xgRcT10Caixa();" +
      "})()"
    );
  }

  /* a haste sai do pivo pelo +z local: frente/tras gira em x, lados em y */
  function inclinar(pivo, cmd) {
    if (!pivo) return;
    var x = cmd ? cmd.x || 0 : 0, y = cmd ? cmd.y || 0 : 0;
    pivo.rotation.set(-y * CURSO, x * CURSO, 0);
  }

  return {
    /* estado = { fase, foto, comandos, vista, mostrar, aoManche(lado, x, y | null) } */
    manter: function (ponte, estado) {
      var j = ponte.janela;
      if (!j || !j.THREE) return;
      var T = j.THREE;
      esconderDesenho(ponte);

      /* 1. na mao: o RC Plus do jogo sai e entra este */
      var par = grupoDoControle(ponte);
      if (par) {
        var rc = par.rc;
        if (!rc.userData.xgRcT10) {
          rc.visible = false;
          if (!rc.userData.xgRcT10Montando) {
            rc.userData.xgRcT10Montando = true;
            carregar(ponte, function (cena) {
              var agora = grupoDoControle(ponte);
              if (!agora || agora.rc !== rc) { rc.userData.xgRcT10Montando = false; return; }
              montarNaMao(ponte, agora.g, rc, cena);
              rc.visible = true;
            });
          }
        } else {
          rc.visible = true;
          atualizar(T, rc.userData.xgRcT10, estado);
        }
      }

      /* 2. nas vistas */
      if (!hud) {
        carregar(ponte, function (cena) { if (!hud) montarNaVista(ponte, cena); });
        return;
      }
      var mostrar = !!estado.mostrar && (estado.vista === "controle" || estado.vista === "operador");
      hud.grupo.visible = mostrar;
      if (j.__xgHudDji) j.__xgHudDji.visivel = mostrar;
      if (mostrar) {
        hud.vista = estado.vista;
        posicionarNaVista(ponte, estado.vista);
        var r = retanguloDaTela(ponte);
        if (r) caixaNoVidro(ponte, r);
        atualizar(T, hud, { fase: estado.fase, foto: null, comandos: estado.comandos });
        ligarToques(ponte, estado);
      }
    },

    /* onde a tela do app tem de ficar (pixels da janela), ou null */
    telaNaVista: function (ponte) {
      try { return retanguloDaTela(ponte); } catch (e) { return null; }
    },

    /* Outro aparelho no mesmo esquema (13/10/2026: EAV-RC50 do J100 e EAV-RC60 do
       J150). Chamar antes do primeiro manter. pecas = [[regex do no, alvo], ...] com
       alvo energia | rth | pausa | voltar | esq | dir. Sem chamar, fica o do T10. */
    configurar: function (o) {
      if (!o) return;
      if (o.arquivo && o.arquivo !== ARQUIVO && !carregado && !carregando) ARQUIVO = o.arquivo;
      if (o.pecas) MAPA_DE_PECAS = o.pecas;
      if (typeof o.razaoApp === "number") RAZAO_APP = o.razaoApp;
      if (typeof o.margemTopo === "number") MARGEM_TOPO = o.margemTopo;
      if (o.focoTela) FOCO_TELA = o.focoTela;
    },

    ajuste: function (operador, inclina) {     // acertar pelo console
      if (operador > 0) MOSTRA_NO_OPERADOR = operador;
      if (typeof inclina === "number") { if (novoVisual()) INCLINA_T10 = inclina; else INCLINA = inclina; }
    },
  };
})();
