/* ==========================================================================
   GRAFICO NOVO DO CAMPO 3D (10-11/11/2026, pedido do Eduardo: "quero no nivel
   do Farming 2019 pelo menos os graficos").

   Roda DENTRO do campo (treinamento/campo/index.html carrega este arquivo no
   fim) e enxerga os nomes do jogo: render, cena, cam, sol, mundo, alt, TALHAO,
   BASE, TAM, SEG, solo, acudes, construirCenario, carregarGlb, instanciar.

   QUEM VE (11/11/2026, ordem dele: "coloca so pra mim adm"):
   - no site: so a conta de administrador (parent.CONTAS.atual().admin), e liga
     sozinho para ela. Para comparar com o visual antigo: ?g=antigo no endereco
     ou localStorage tpd_graficos = "antigo".
   - neste PC (localhost): so com ?g=novo ou localStorage tpd_graficos = "novo".
   Para os outros este arquivo nao faz NADA e o campo fica exatamente como era.
   Para liberar aos alunos: trocar contaAdmin() (so com ordem dele).

   O que troca quando liga:
   1. CEU E LUZ: foto de ceu em 360 graus (Poly Haven, CC0) no lugar do
      degrade; o mesmo ceu ilumina a cena (reflexo na lataria, sombra azulada)
      e o sol da luz fica na direcao do sol da foto.
   2. SOMBRA: mapa de 4096 px cobrindo 110 m para cada lado, centrado no que
      a camera olha (antes: 30 m em volta do drone).
   3. CHAO: grama, solo do talhao e terra batida com textura de foto e relevo
      (normal), misturadas por um mapa de controle; duas escalas e um ruido
      largo escondem a repeticao.
   4. CAPIM: touceiras de laminas de verdade em volta da camera, com vento.
   5. ARVORES: tronco e galhos com casca de foto e copa de ramos com folhas
      recortadas, no lugar dos modelos de poucos poligonos. Entram pela mesma
      porta do jogo (carregarGlb + instanciar), com a mesma caixa dos modelos
      antigos: altura, copa, colisao e radar nao mudam.

   Recursos em treinamento/campo/assets/web/graficos/ (lista e origem em
   copias-de-seguranca/graficos-novos-20261110/fontes/origem.json).
   Mapas de arquivo (c.real): recebem ceu, luz, sombra e arvores; o chao e o
   capim novos ainda sao so dos 3 mapas embutidos.

   Console: XG_GRAFICOS (ativo, pronto, erro, ajustes, nivel()).
   ========================================================================== */
(function () {
  "use strict";

  var API = window.XG_GRAFICOS = { ativo: false, pronto: false, erro: null, sombra: 4096 };

  function pedido() {
    function q(s) { try { return new URLSearchParams(s).get("g"); } catch (e) { return null; } }
    var v = q(location.search);
    try { if (v == null && window.parent !== window) v = q(window.parent.location.search); } catch (e) { /* outra origem */ }
    try { if (v == null) v = localStorage.getItem("tpd_graficos"); } catch (e) { /* sem armazenamento */ }
    return v;
  }
  if (typeof THREE === "undefined" || typeof render === "undefined" || typeof cena === "undefined" || typeof mundo === "undefined") return;
  if (!render.capabilities.isWebGL2) return;
  /* casas: anota as medidas de cada predio() montado (para todos, sem mudar nada no visual); o grafico novo troca depois so para quem o tem ligado */
  if (typeof predio === "function" && !predio.__xg) {
    var predioAntes = predio;
    predio = function (x, z, sx, sz, hp, rot, corP, corT, nome) {
      var n0 = mundo.children.length, r = predioAntes.apply(this, arguments);
      var g = mundo.children[mundo.children.length - 1];
      if (mundo.children.length === n0 + 1 && g && g.isGroup) {
        g.userData.xgPredio = { sx: sx, sz: sz, hp: hp, corP: corP, corT: corT, nome: nome };
        if (API.casa) try { API.casa(g); } catch (e) { API.erro = String(e && e.message || e); }
      }
      return r;
    };
    predio.__xg = true;
  }
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var escolha = pedido();
  if (escolha === "antigo") return;
  /* 24/11/2026 (montar43, Eduardo: "Gráfico antigo no celular"): no celular (iPhone/iPad/Android) o grafico novo nao liga,
     nem com ?g=novo. O iPhone no navegador do Instagram ainda derrubava a pagina por memoria. O computador continua igual. */
  var ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return;
  /* null = a conta ainda nao carregou */
  function contaAdmin() {
    try { var c = window.parent.CONTAS && window.parent.CONTAS.atual && window.parent.CONTAS.atual(); return c ? c.admin === true : null; } catch (e) { return false; }
  }
  /* 14/11/2026: conjunto LEVE (1,5 MB no total; o de antes tinha 11 MB e, com internet ruim, segurava o carregamento do
     simulador). Feito por copias-de-seguranca/graficos-novos-20261110/preparar_leve.py. */
  var PASTA = "assets/web/graficos/leve/";
  var CDN = "https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/";
  var param = new URLSearchParams(location.search);

  /* numeros de ajuste: ficam aqui para mexer pelo console (XG_GRAFICOS.ajustes) */
  var A = API.ajustes = {
    sol: 2.7, ceuAmbiente: 0.10, exposicao: 0.74, limiteSol: 10,
    /* 12/11/2026 (travando no Mac dele e nos notebooks): sombra 2048 / 90 m, capim pela metade, ceu 4K */
    sombraRaio: 90, sombraMapa: 2048,
    capimJanela: 70, capimTouceiras: 42000, capimAlturaMax: 40,
    solo: "farm_soil",
  };

  /* ------------------------------------------------------------------ utilitarios */
  /* imagem pedida com prioridade BAIXA: nunca passa na frente do que o simulador precisa para funcionar */
  function textura(url, srgb) {
    return new Promise(function (ok, erro) {
      var img = new Image();
      try { img.fetchPriority = "low"; img.decoding = "async"; } catch (e) { /* navegador antigo: prioridade normal */ }
      img.onload = function () {
        var t = new THREE.Texture(img);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, render.capabilities.getMaxAnisotropy());
        if (srgb) t.encoding = THREE.sRGBEncoding;
        t.needsUpdate = true;
        ok(t);
      };
      img.onerror = function () { erro(new Error("nao carregou " + url)); };
      img.src = url;
    });
  }
  /* uma de cada vez, na ordem: nao enche a linha de quem tem internet fraca */
  function emFila(lista) {
    var saida = [];
    return lista.reduce(function (p, item) {
      return p.then(function () { return textura(item[0], item[1]); }).then(function (t) { saida.push(t); });
    }, Promise.resolve()).then(function () { return saida; });
  }
  function script(url) {
    return new Promise(function (ok, erro) {
      var s = document.createElement("script"); s.src = url; s.onload = ok;
      s.onerror = function () { erro(new Error("nao carregou " + url)); };
      document.head.appendChild(s);
    });
  }
  function sorteio(semente) { var s = semente; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  /* ruido suave que emenda nas bordas: 3 canais em 3 tamanhos de mancha */
  function texturaRuido() {
    var N = 256, dados = new Uint8Array(N * N * 4), r = sorteio(4242);
    [32, 64, 16].forEach(function (cel, canal) {
      var g = N / cel, grade = new Float32Array(g * g);
      for (var i = 0; i < grade.length; i++) grade[i] = r();
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var fx = x / cel, fy = y / cel, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var a = grade[(y0 % g) * g + (x0 % g)], b = grade[(y0 % g) * g + ((x0 + 1) % g)];
        var c = grade[((y0 + 1) % g) * g + (x0 % g)], d = grade[((y0 + 1) % g) * g + ((x0 + 1) % g)];
        dados[(y * N + x) * 4 + canal] = Math.round(255 * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty));
      }
    });
    for (var k = 3; k < dados.length; k += 4) dados[k] = 255;
    var t = new THREE.DataTexture(dados, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true; return t;
  }

  /* uniformes divididos entre o chao e o capim */
  var U = {
    xgCtrl: { value: null }, xgAlt: { value: null }, xgRuido: { value: null },
    xgArea: { value: new THREE.Vector4(-700, -780, 1 / 1400, 1 / 1400) },
    xgGA: { value: null }, xgGB: { value: null }, xgSolo: { value: null }, xgTerra: { value: null },
    xgNG: { value: null }, xgNS: { value: null }, xgNT: { value: null },
    xgTomSolo: { value: new THREE.Vector3(1.45, 1.33, 1.22) },
    xgTomGrama: { value: new THREE.Vector3(0.47, 0.70, 0.36) },
    xgCorPe: { value: new THREE.Vector3(0.020, 0.045, 0.010) },
    xgCorPonta: { value: new THREE.Vector3(0.075, 0.185, 0.030) },
    xgCorSeca: { value: new THREE.Vector3(0.17, 0.22, 0.06) },
    xgFoco: { value: new THREE.Vector3() }, xgJan: { value: A.capimJanela }, xgSeg: { value: 440 },
    xgTempo: { value: 0 }, xgVento: { value: new THREE.Vector3(0.8, 0.6, 0.11) }, xgSome: { value: 1 },
  };
  API.uniformes = U;

  var dirSol = new THREE.Vector3(0.8, 1.2, 0.6).normalize();   // trocada pela direcao do sol da foto do ceu
  var ceu = null, capim = null, pronto = false, temChao = false, nivelAtual = "alta";
  var matFolhaFundo = null;

  /* ------------------------------------------------------------------ 1. ceu e luz */
  function montarCeu(info, texCeu, hdr) {
    /* a foto so tem a metade de cima do ceu: o v da esfera vai de 0 (horizonte) a 1 (zenite) */
    var geo = new THREE.SphereGeometry(1700, 64, 32), uv = geo.attributes.uv;
    for (var i = 0; i < uv.count; i++) uv.setY(i, Math.max(0.002, (uv.getY(i) - 0.5) * 2));
    texCeu.wrapT = THREE.ClampToEdgeWrapping; texCeu.generateMipmaps = false; texCeu.minFilter = THREE.LinearFilter; texCeu.anisotropy = 1;
    texCeu.needsUpdate = true;
    ceu = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: texCeu, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    ceu.renderOrder = -10; ceu.frustumCulled = false; ceu.name = "xg-ceu";

    /* onde esta o sol na esfera (mesma conta da SphereGeometry) e quanto girar para ele cair no rumo da luz do jogo */
    var fi = info.solU * 2 * Math.PI, teta = info.solV * Math.PI;
    var naEsfera = new THREE.Vector3(-Math.cos(fi) * Math.sin(teta), Math.cos(teta), Math.sin(fi) * Math.sin(teta));
    var giro = Math.atan2(0.8, 0.6) - Math.atan2(naEsfera.x, naEsfera.z);
    ceu.rotation.y = giro;
    var el = Math.asin(naEsfera.y), ch = Math.cos(el);
    dirSol.set(0.8 * ch, Math.sin(el), 0.6 * ch).normalize();

    /* some o ceu antigo (esfera em degrade e nuvens de sprite) */
    cena.children.forEach(function (o) {
      if (o.isSprite) o.visible = false;
      if (o.isMesh && o !== ceu && o.geometry && o.geometry.type === "SphereGeometry" && o.material && o.material.side === THREE.BackSide) o.visible = false;
    });
    cena.add(ceu);

    /* o mesmo ceu, em HDR e girado igual, vira a luz ambiente e o reflexo (o disco do sol e cortado: o sol e a luz direcional) */
    var cenaAmb = new THREE.Scene();
    var esf = new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), new THREE.ShaderMaterial({
      uniforms: { map: { value: hdr }, lim: { value: A.limiteSol } }, side: THREE.BackSide, depthWrite: false, depthTest: false,
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: "uniform sampler2D map;uniform float lim;varying vec2 vUv;void main(){vec3 c=texture2D(map,vUv).rgb;float m=max(c.r,max(c.g,c.b));if(m>lim)c*=lim/m;gl_FragColor=vec4(c,1.0);}",
    }));
    esf.rotation.y = giro; cenaAmb.add(esf);
    var pm = new THREE.PMREMGenerator(render);
    cena.environment = pm.fromScene(cenaAmb, 0, 0.1, 200).texture;
    pm.dispose(); esf.geometry.dispose(); esf.material.dispose(); hdr.dispose();

    cena.children.forEach(function (o) { if (o.isHemisphereLight) o.intensity = A.ceuAmbiente; });
    sol.intensity = A.sol; sol.color.set("#fff3e1");
    render.toneMappingExposure = A.exposicao;
    if (cena.fog) { cena.fog.color.set(info.horizonte); cena.fog.near = 260; cena.fog.far = 1250; }
  }

  /* ------------------------------------------------------------------ 2. sombra */
  var p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), alvo = new THREE.Vector3(), eixoX = new THREE.Vector3(), eixoY = new THREE.Vector3();
  function prepararSombra() {
    var R = A.sombraRaio;
    sol.castShadow = true;
    if (sol.shadow.mapSize.x !== A.sombraMapa) {
      sol.shadow.mapSize.set(A.sombraMapa, A.sombraMapa);
      if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null; }
    }
    Object.assign(sol.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 700 });
    sol.shadow.camera.updateProjectionMatrix();
    sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.05;
    eixoX.crossVectors(new THREE.Vector3(0, 1, 0), dirSol).normalize(); eixoY.crossVectors(dirSol, eixoX).normalize();
  }
  /* o jogo poe o sol em cima do drone a cada quadro; aqui, logo antes de desenhar, ele vai para o que a camera olha */
  function ganchoDoSol() {
    var antesAnterior = cena.onBeforeRender;
    cena.onBeforeRender = function (r, s, camera, alvoRender) {
      if (antesAnterior) antesAnterior.call(this, r, s, camera, alvoRender);
      if (!pronto) return;
      var R = A.sombraRaio;
      camera.getWorldPosition(p1); camera.getWorldDirection(p2); p2.y = 0;
      var l = p2.length(); if (l > 1e-4) p2.multiplyScalar(1 / l); else p2.set(0, 0, 0);
      alvo.set(p1.x + p2.x * R * 0.62, 0, p1.z + p2.z * R * 0.62);
      try { alvo.y = alt(alvo.x, alvo.z); } catch (e) { alvo.y = 0; }
      /* anda de ponto em ponto do mapa de sombra: a borda da sombra nao treme quando a camera se move */
      var ponto = 2 * R / sol.shadow.mapSize.x, a = alvo.dot(eixoX), b = alvo.dot(eixoY);
      alvo.addScaledVector(eixoX, Math.round(a / ponto) * ponto - a).addScaledVector(eixoY, Math.round(b / ponto) * ponto - b);
      sol.target.position.copy(alvo); sol.position.copy(alvo).addScaledVector(dirSol, 320);
      sol.target.updateMatrixWorld(); sol.updateMatrixWorld();
    };
  }
  /* postes e construcoes passam a fazer sombra; a copa das arvores faz sombra recortada pela folha */
  function ligarSombras() {
    mundo.traverse(function (o) {
      if (!o.isMesh || !o.material || o.userData.xgChao) return;
      if (o.isInstancedMesh) {
        if (o.material.userData && o.material.userData.xgFolha && !o.customDepthMaterial) o.customDepthMaterial = matFolhaFundo;
        return;   // quem faz sombra entre as malhas repetidas e decisao do jogo (a mata do horizonte nao faz)
      }
      if (o.material.transparent || (typeof pintTx !== "undefined" && o.material.map === pintTx)) return;
      o.castShadow = true; o.receiveShadow = true;
    });
  }

  /* ------------------------------------------------------------------ 3. chao */
  var CHAO_V = "varying vec3 xgW;\nvarying vec3 xgN;\n";
  var CHAO_F = [
    "uniform sampler2D xgCtrl,xgRuido,xgGA,xgGB,xgSolo,xgTerra,xgNG,xgNS,xgNT;",
    "uniform vec4 xgArea;uniform vec3 xgTomSolo;uniform vec3 xgTomGrama;",
    "varying vec3 xgW;varying vec3 xgN;",
    "vec3 xgDet=vec3(0.0,0.0,1.0);float xgRug=0.95;",
  ].join("\n") + "\n";
  var CHAO_COR = [
    "{",
    " vec2 p=xgW.xz;",
    " float dist=length(cameraPosition-xgW);",
    " float longe=smoothstep(22.0,130.0,dist);",
    " vec4 ctrl=texture2D(xgCtrl,(p-xgArea.xy)*xgArea.zw);",
    " float r1=texture2D(xgRuido,p/97.0).r;",
    " float r2=texture2D(xgRuido,p/23.0+0.37).g;",
    " float r3=texture2D(xgRuido,p/410.0+0.11).b;",
    " float r4=texture2D(xgRuido,p/7.3).g;",
    " vec3 gA=mix(texture2D(xgGA,p/3.1).rgb,texture2D(xgGA,p/19.0).rgb,longe);",
    " vec3 gB=mix(texture2D(xgGB,p/3.7).rgb,texture2D(xgGB,p/23.0).rgb,longe);",
    " float mg=smoothstep(0.34,0.66,r1*0.65+r2*0.35);",
    " vec3 grama=mix(gA,gB*vec3(1.25,1.3,1.1),mg);",
    " grama*=mix(vec3(0.80,0.90,0.72),vec3(1.16,1.10,0.92),r3)*xgTomGrama;",
    " vec3 soloC=mix(texture2D(xgSolo,p/4.3).rgb,texture2D(xgSolo,p/27.0).rgb,longe)*xgTomSolo;",
    " soloC*=mix(0.88,1.10,r1);",
    " vec3 terraC=mix(texture2D(xgTerra,p/3.3).rgb,texture2D(xgTerra,p/21.0).rgb,longe);",
    " float wS=smoothstep(0.40,0.60,ctrl.r+(r4-0.5)*0.30);",
    " float wT=smoothstep(0.38,0.62,ctrl.g+(r4-0.5)*0.45);",
    " vec3 alb=mix(grama,soloC,wS);",
    " alb=mix(alb,terraC,wT);",
    " diffuseColor.rgb=alb;",
    " vec3 nd=mix(texture2D(xgNG,p/3.1).xyz,texture2D(xgNS,p/4.3).xyz,wS);",
    " nd=mix(nd,texture2D(xgNT,p/3.3).xyz,wT)*2.0-1.0;",
    " xgDet=mix(nd,vec3(0.0,0.0,1.0),longe*0.9);",
    " xgRug=mix(0.90,0.97,wS);",
    "}",
  ].join("\n") + "\n";
  var CHAO_NORMAL = [
    "{",
    " vec3 nW=normalize(xgN);",
    " nW=normalize(vec3(nW.x+xgDet.x*1.1,nW.y,nW.z-xgDet.y*1.1));",
    " normal=normalize((viewMatrix*vec4(nW,0.0)).xyz);",
    "}",
  ].join("\n") + "\n";
  function materialChao() {
    var m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    m.envMapIntensity = 0.75;
    m.onBeforeCompile = function (sh) {
      for (var k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + CHAO_V)
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nxgW=(modelMatrix*vec4(transformed,1.0)).xyz;\nxgN=normalize(mat3(modelMatrix)*objectNormal);\n");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\n" + CHAO_F)
        .replace("#include <map_fragment>", CHAO_COR)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor=xgRug;\n")
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\n" + CHAO_NORMAL);
    };
    m.customProgramCacheKey = function () { return "xg-chao-2"; };
    return m;
  }
  /* mapa de controle (2048 px para o terreno todo): R = solo do talhao, G = terra batida, B = sem capim (agua) */
  function montarControle() {
    var N = 2048, c = document.createElement("canvas"); c.width = c.height = N;
    var g = c.getContext("2d"), X0 = -TAM / 2, Z0 = -80 - TAM / 2, e = N / TAM;
    function X(x) { return (x - X0) * e; } function Z(z) { return (z - Z0) * e; }
    g.fillStyle = "#000"; g.fillRect(0, 0, N, N);
    g.globalCompositeOperation = "lighter";
    g.filter = "blur(2.2px)"; g.fillStyle = "#ff0000";
    g.fillRect(X(TALHAO.x0), Z(TALHAO.z0), TALHAO.larg * e, TALHAO.prof * e);
    function disco(x, z, raio, cor, borra) {
      g.filter = "blur(" + borra + "px)"; g.fillStyle = cor; g.beginPath(); g.arc(X(x), Z(z), raio * e, 0, 7); g.fill();
    }
    disco(BASE.x, BASE.z, 7.5, "#00ff00", 5);                 // chao pisado em volta do ponto de decolagem
    disco(BASE.x + 10, BASE.z + 8, 4.2, "#00c800", 4);          // debaixo da camionete
    (typeof acudes !== "undefined" ? acudes : []).forEach(function (a) {
      disco(a.x, a.z, a.r + 3.5, "#00b400", 4);                 // barranco de terra em volta da agua
      disco(a.x, a.z, a.r + 0.6, "#0000ff", 1.5);               // dentro da agua nao nasce capim
    });
    g.filter = "none";
    var t = U.xgCtrl.value;
    if (t) t.dispose();
    t = new THREE.CanvasTexture(c); t.flipY = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    U.xgCtrl.value = t; U.xgArea.value.set(X0, Z0, 1 / TAM, 1 / TAM);
  }
  /* altura do chao em textura (um ponto por vertice da malha): o capim le daqui para ficar colado no terreno */
  function montarAlturas(chao) {
    var pos = chao.geometry.attributes.position, lado = SEG + 1, dados = new Float32Array(lado * lado);
    for (var i = 0; i < dados.length; i++) dados[i] = pos.getY(i);
    var t = U.xgAlt.value; if (t) t.dispose();
    var liso = !!render.extensions.get("OES_texture_float_linear");
    t = new THREE.DataTexture(dados, lado, lado, THREE.RedFormat, THREE.FloatType);
    t.magFilter = t.minFilter = liso ? THREE.LinearFilter : THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
    U.xgAlt.value = t; U.xgSeg.value = SEG;
  }

  /* ------------------------------------------------------------------ 4. capim */
  var CAPIM_V = [
    "attribute vec4 aOff;attribute float aT;",
    "uniform sampler2D xgCtrl,xgAlt,xgRuido;",
    "uniform vec4 xgArea;uniform vec3 xgFoco;uniform vec3 xgVento;uniform float xgJan,xgSeg,xgTempo,xgSome;",
    "varying float xgT;varying float xgVar;varying float xgSem;",
  ].join("\n") + "\n";
  var CAPIM_POS = [
    "vec2 xgCel=aOff.xy*xgJan;",
    "vec2 xgBase=xgFoco.xz-0.5*xgJan;",
    "vec2 xgP=xgBase+mod(xgCel-xgBase,xgJan);",
    "float xgD=distance(xgP,xgFoco.xz);",
    "float xgFade=1.0-smoothstep(xgJan*0.33,xgJan*0.49,xgD);",
    "vec2 xgUv=(xgP-xgArea.xy)*xgArea.zw;",
    "vec4 xgC=texture2D(xgCtrl,xgUv);",
    "float xgMask=(1.0-smoothstep(0.30,0.52,xgC.r))*(1.0-smoothstep(0.22,0.50,xgC.g))*(1.0-smoothstep(0.2,0.6,xgC.b));",
    "float xgY=texture2D(xgAlt,(xgUv*xgSeg+0.5)/(xgSeg+1.0)).r;",
    "float xgR=texture2D(xgRuido,xgP/37.0).r;",
    "float xgR2=texture2D(xgRuido,xgP/9.0+0.5).g;",
    "float xgAltura=mix(0.14,0.50,aOff.z*aOff.z)*mix(0.55,1.55,xgR)*mix(0.8,1.2,xgR2);",
    "float xgEsc=xgFade*xgMask*xgSome;",
    "float xgA=aOff.z*6.2831853;float xgCo=cos(xgA),xgSi=sin(xgA);",
    "vec3 xgQ=position;",
    "xgQ.xz=mat2(xgCo,-xgSi,xgSi,xgCo)*xgQ.xz*mix(0.85,1.6,aOff.w);",
    "xgQ.y*=xgAltura;",
    "float xgOnda=sin(xgTempo*1.7+xgP.x*0.31+xgP.y*0.23+aOff.w*6.0)*0.6+sin(xgTempo*3.9+xgP.x*0.9-xgP.y*0.4)*0.25+0.35;",
    "xgQ.xz+=xgVento.xy*xgOnda*xgVento.z*aT*aT*(0.4+xgAltura*2.2);",
    "xgQ*=xgEsc;",
    "vec3 transformed=vec3(xgP.x+xgQ.x,xgY+xgQ.y-0.015,xgP.y+xgQ.z);",
    "xgT=aT;xgVar=xgR;xgSem=aOff.w;",
  ].join("\n") + "\n";
  var CAPIM_COR = [
    "{",
    " vec3 ponta=mix(xgCorPonta,xgCorSeca,smoothstep(0.50,0.95,xgVar)*0.7);",
    " vec3 c=mix(xgCorPe,ponta,pow(xgT,0.8));",
    " diffuseColor.rgb=c*(0.82+0.36*xgSem);",
    "}",
  ].join("\n") + "\n";
  function touceira() {
    /* 4 laminas por touceira, cada uma com 3 alturas (5 vertices): largura na base, ponta fina, tombada para fora */
    var pos = [], ts = [], nor = [], idx = [], r = sorteio(99);
    for (var b = 0; b < 4; b++) {
      var ang = b * 1.5708 + r() * 1.2, ca = Math.cos(ang), sa = Math.sin(ang);
      var ox = (r() - 0.5) * 0.16, oz = (r() - 0.5) * 0.16, larg = 0.020 + r() * 0.012, tomba = 0.10 + r() * 0.22, alto = 0.75 + r() * 0.25;
      var base = pos.length / 3;
      [[0, 1], [0.5, 0.72], [1, 0]].forEach(function (n) {
        var t = n[0], meia = larg * n[1], fx = ox + ca * tomba * t * t, fz = oz + sa * tomba * t * t;
        if (meia > 0) {
          pos.push(fx - sa * meia, t * alto, fz + ca * meia, fx + sa * meia, t * alto, fz - ca * meia); ts.push(t, t); nor.push(0, 1, 0, 0, 1, 0);
        } else { pos.push(fx, t * alto, fz); ts.push(t); nor.push(0, 1, 0); }
      });
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    return { pos: pos, ts: ts, nor: nor, idx: idx };
  }
  function montarCapim() {
    var T = touceira(), N = A.capimTouceiras, off = new Float32Array(N * 4), r = sorteio(7);
    for (var i = 0; i < N * 4; i++) off[i] = r();
    var g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(T.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(T.nor, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(T.ts, 1));
    g.setIndex(T.idx);
    g.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 4));
    g.instanceCount = N;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    var m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
    m.envMapIntensity = 0.6;
    m.onBeforeCompile = function (sh) {
      for (var k in U) sh.uniforms[k] = U[k];
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + CAPIM_V)
        .replace("#include <begin_vertex>", CAPIM_POS);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 xgCorPe;uniform vec3 xgCorPonta;uniform vec3 xgCorSeca;varying float xgT;varying float xgVar;varying float xgSem;\n")
        .replace("#include <color_fragment>", "#include <color_fragment>\n" + CAPIM_COR)
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal=normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz);\n");
    };
    m.customProgramCacheKey = function () { return "xg-capim-2"; };
    capim = new THREE.Mesh(g, m);
    capim.frustumCulled = false; capim.receiveShadow = true; capim.castShadow = false; capim.name = "xg-capim"; capim.visible = false;
    var c1 = new THREE.Vector3(), c2 = new THREE.Vector3();
    capim.onBeforeRender = function (r2, s2, camera) {
      camera.getWorldPosition(c1); camera.getWorldDirection(c2); c2.y = 0;
      var l = c2.length(); if (l > 1e-4) c2.multiplyScalar(1 / l); else c2.set(0, 0, 0);
      var av = A.capimJanela * 0.30, chao = 0;
      U.xgFoco.value.set(c1.x + c2.x * av, c1.y, c1.z + c2.z * av);
      U.xgTempo.value = performance.now() / 1000; U.xgJan.value = A.capimJanela;
      try { chao = alt(c1.x, c1.z); } catch (e) { chao = 0; }
      /* camera alta (drone subindo, vista de cima): a lamina vira menos que um ponto da tela, entao encolhe ate sumir */
      var h = c1.y - chao;
      U.xgSome.value = 1 - Math.min(1, Math.max(0, (h - A.capimAlturaMax * 0.5) / (A.capimAlturaMax * 0.5)));
    };
    cena.add(capim);
  }

  /* ------------------------------------------------------------------ 5. arvores */
  /* 4 ramos com folhas desenhados numa textura (um por quadrante); o fundo e transparente */
  function texturaFolhas() {
    var N = 1024, c = document.createElement("canvas"); c.width = c.height = N;
    var g = c.getContext("2d"), r = sorteio(314);
    function folha(x, y, ang, comp, larg, matiz, luz) {
      g.save(); g.translate(x, y); g.rotate(ang);
      var grad = g.createLinearGradient(0, -larg, 0, larg);
      grad.addColorStop(0, "hsl(" + matiz + ",40%," + (luz + 5) + "%)"); grad.addColorStop(1, "hsl(" + (matiz + 8) + ",44%," + (luz - 4) + "%)");
      g.fillStyle = grad;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(comp * 0.42, -larg, comp, 0); g.quadraticCurveTo(comp * 0.42, larg, 0, 0); g.fill();
      g.strokeStyle = "hsla(" + matiz + ",36%," + (luz + 11) + "%,0.7)"; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(2, 0); g.lineTo(comp * 0.93, 0); g.stroke();
      g.restore();
    }
    for (var q = 0; q < 4; q++) {
      var ox = (q % 2) * 512, oy = Math.floor(q / 2) * 512;
      g.save(); g.beginPath(); g.rect(ox + 3, oy + 3, 506, 506); g.clip();
      var ramos = 9 + Math.floor(r() * 4);
      for (var k = 0; k < ramos; k++) {
        var a0 = -Math.PI / 2 + (k / (ramos - 1) - 0.5) * 2.5 + (r() - 0.5) * 0.3, compR = 150 + r() * 270;
        var x0 = ox + 256 + (r() - 0.5) * 60, y0 = oy + 470 - r() * 60, x1 = x0 + Math.cos(a0) * compR, y1 = y0 + Math.sin(a0) * compR;
        g.strokeStyle = "#33281b"; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        var nf = 20 + Math.floor(r() * 10);
        for (var j = 0; j < nf; j++) {
          var t = 0.12 + 0.88 * (j + r()) / nf, lado = j % 2 ? 1 : -1;
          folha(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, a0 + lado * (0.5 + r() * 0.7), 32 + r() * 26, 8 + r() * 7, 74 + r() * 34, 14 + r() * 15);
        }
        folha(x1, y1, a0 + (r() - 0.5) * 0.4, 38 + r() * 20, 9 + r() * 6, 78 + r() * 26, 18 + r() * 12);
      }
      g.restore();
    }
    /* o ponto transparente guarda um verde medio: sem isso a borda da folha escurece nas reducoes da textura */
    var d = g.getImageData(0, 0, N, N).data, dados = new Uint8Array(d.length);
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 12) { dados[i] = 60; dados[i + 1] = 88; dados[i + 2] = 32; dados[i + 3] = 0; }
      else { dados[i] = d[i]; dados[i + 1] = d[i + 1]; dados[i + 2] = d[i + 2]; dados[i + 3] = d[i + 3]; }
    }
    var tx = new THREE.DataTexture(dados, N, N, THREE.RGBAFormat);
    tx.encoding = THREE.sRGBEncoding; tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearMipmapLinearFilter;
    tx.generateMipmaps = true; tx.anisotropy = 4; tx.needsUpdate = true;
    return tx;
  }
  /* arvore feita por conta: tronco, galhos e (se nao for seca) cartoes de ramo com folha. Medidas em metros, cerca de 10 m de altura */
  function gerarArvore(semente, seca) {
    var r = sorteio(semente), V3 = THREE.Vector3;
    var pos = [], nor = [], uv = [], idx = [], fp = [], fn = [], fu = [], fc = [], fi = [], pontas = [];
    var CIMA = new V3(0, 1, 0), LADO = new V3(1, 0, 0);
    function curva(a, b, c, t, sai) { var u = 1 - t; return sai.set(u * u * a.x + 2 * u * t * b.x + t * t * c.x, u * u * a.y + 2 * u * t * b.y + t * t * c.y, u * u * a.z + 2 * u * t * b.z + t * t * c.z); }
    function tubo(a, b, c, r0, r1, lados, segs) {
      var base = pos.length / 3, p = new V3(), tg = new V3(), e1 = new V3(), e2 = new V3(), n = new V3(), ant = new V3(), comp = 0, ini = idx.length;
      for (var i = 0; i <= segs; i++) {
        var t = i / segs; curva(a, b, c, t, p);
        tg.set(2 * (1 - t) * (b.x - a.x) + 2 * t * (c.x - b.x), 2 * (1 - t) * (b.y - a.y) + 2 * t * (c.y - b.y), 2 * (1 - t) * (b.z - a.z) + 2 * t * (c.z - b.z)).normalize();
        e1.crossVectors(tg, Math.abs(tg.y) < 0.95 ? CIMA : LADO).normalize(); e2.crossVectors(tg, e1).normalize();
        if (i) comp += p.distanceTo(ant); ant.copy(p);
        var raio = r0 + (r1 - r0) * t;
        for (var k = 0; k <= lados; k++) {
          var ang = k / lados * 6.2831853;
          n.copy(e1).multiplyScalar(Math.cos(ang)).addScaledVector(e2, Math.sin(ang));
          pos.push(p.x + n.x * raio, p.y + n.y * raio, p.z + n.z * raio); nor.push(n.x, n.y, n.z);
          uv.push(k / lados * Math.max(1, Math.round(raio * 5)), comp * 0.55);
        }
      }
      for (var s = 0; s < segs; s++) for (var j = 0; j < lados; j++) {
        var q0 = base + s * (lados + 1) + j, q1 = q0 + 1, q2 = q0 + lados + 1, q3 = q2 + 1;
        idx.push(q0, q2, q1, q1, q2, q3);
      }
      /* confere o lado de fora no primeiro triangulo; se saiu virado, inverte os deste tubo */
      var A0 = idx[ini] * 3, B0 = idx[ini + 1] * 3, C0 = idx[ini + 2] * 3;
      var ux = pos[B0] - pos[A0], uy = pos[B0 + 1] - pos[A0 + 1], uz = pos[B0 + 2] - pos[A0 + 2], vx = pos[C0] - pos[A0], vy = pos[C0 + 1] - pos[A0 + 1], vz = pos[C0 + 2] - pos[A0 + 2];
      var fora = (uy * vz - uz * vy) * nor[A0] + (uz * vx - ux * vz) * nor[A0 + 1] + (ux * vy - uy * vx) * nor[A0 + 2];
      if (fora < 0) for (var w = ini; w < idx.length; w += 3) { var tmp = idx[w + 1]; idx[w + 1] = idx[w + 2]; idx[w + 2] = tmp; }
    }
    var H = 10, centro = new V3(0, H * 0.68, 0), RAIO = 4.6;
    var topo = new V3((r() - 0.5) * 0.5, H * 0.34 + r() * 0.7, (r() - 0.5) * 0.5);
    tubo(new V3(0, -0.35, 0), new V3((r() - 0.5) * 0.35, H * 0.17, (r() - 0.5) * 0.35), topo, 0.37, 0.24, 7, 4);
    var nG = 4 + Math.floor(r() * 2), g, k;
    for (g = 0; g <= nG; g++) {
      var guia = g === nG;   // o ultimo e o galho do meio, que sobe
      var ang = g / nG * 6.2831853 + r() * 0.7, incl = guia ? 0.12 + r() * 0.2 : 0.62 + r() * 0.42, comp = guia ? 3.6 + r() * 1.2 : 3.3 + r() * 1.5;
      var dir = new V3(Math.sin(incl) * Math.cos(ang), Math.cos(incl), Math.sin(incl) * Math.sin(ang));
      var fim = topo.clone().addScaledVector(dir, comp), ctrl = topo.clone().addScaledVector(dir, comp * 0.5); ctrl.y += comp * 0.2;
      tubo(topo, ctrl, fim, 0.2, 0.08, 5, 3);
      pontas.push(fim.clone());
      var nS = (seca ? 3 : 2) + Math.floor(r() * 2);
      for (k = 0; k < nS; k++) {
        var ini2 = curva(topo, ctrl, fim, 0.4 + r() * 0.5, new V3());
        var dir2 = dir.clone().add(new V3(r() - 0.5, r() * 0.5 - 0.1, r() - 0.5).multiplyScalar(1.5)).normalize();
        var comp2 = 1.5 + r() * 1.5, fim2 = ini2.clone().addScaledVector(dir2, comp2), ctrl2 = ini2.clone().addScaledVector(dir2, comp2 * 0.5); ctrl2.y += 0.22;
        tubo(ini2, ctrl2, fim2, 0.08, 0.025, 4, 2);
        pontas.push(fim2.clone(), ini2.clone().lerp(fim2, 0.55));
        if (seca) {
          var dir3 = dir2.clone().add(new V3(r() - 0.5, r() * 0.6, r() - 0.5).multiplyScalar(1.2)).normalize(), fim3 = fim2.clone().addScaledVector(dir3, 0.7 + r() * 0.8);
          tubo(fim2, fim2.clone().lerp(fim3, 0.5), fim3, 0.025, 0.008, 3, 1);
        }
      }
    }
    function cartao(c, tam, sombraK) {
      var nC = c.clone().sub(centro).add(new V3(r() - 0.5, r() - 0.3, r() - 0.5).multiplyScalar(2.2)).normalize();
      var dx = new V3().crossVectors(Math.abs(nC.y) < 0.95 ? CIMA : LADO, nC).normalize(), dy = new V3().crossVectors(nC, dx).normalize();
      var giro = r() * 6.2831853, cg = Math.cos(giro), sg = Math.sin(giro);
      var ex = dx.clone().multiplyScalar(cg).addScaledVector(dy, sg).multiplyScalar(tam / 2), ey = dy.clone().multiplyScalar(cg).addScaledVector(dx, -sg).multiplyScalar(tam / 2);
      var q = Math.floor(r() * 4), u0 = (q % 2) * 0.5 + 0.004, v0 = Math.floor(q / 2) * 0.5 + 0.004, du = 0.492, base = fp.length / 3;
      var luz = (0.50 + 0.55 * Math.min(1, c.distanceTo(centro) / RAIO)) * sombraK * (0.9 + r() * 0.2), tomR = 0.9 + r() * 0.16, tomB = 0.82 + r() * 0.2;
      [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].forEach(function (k4) {
        var px = c.x + ex.x * k4[0] + ey.x * k4[1], py = c.y + ex.y * k4[0] + ey.y * k4[1], pz = c.z + ex.z * k4[0] + ey.z * k4[1];
        fp.push(px, py, pz);
        var nn = new V3(px - centro.x, (py - centro.y) * 0.9 + 1.6, pz - centro.z).normalize(); fn.push(nn.x, nn.y, nn.z);
        fu.push(u0 + du * k4[2], v0 + du * k4[3]); fc.push(luz * tomR, luz, luz * tomB);
      });
      fi.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    if (!seca) {
      pontas.forEach(function (p) {
        var n = 8 + Math.floor(r() * 3);
        for (var i = 0; i < n; i++) cartao(p.clone().add(new V3(r() - 0.5, r() - 0.45, r() - 0.5).multiplyScalar(2.1)), 1.5 + r() * 0.9, 1);
      });
      for (k = 0; k < 32; k++) cartao(centro.clone().add(new V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(4.2)), 2.0 + r() * 0.8, 0.78);   // miolo: fecha os buracos da copa
    }
    return { pos: pos, nor: nor, uv: uv, idx: idx, fp: fp, fn: fn, fu: fu, fc: fc, fi: fi };
  }
  /* monta o modelo no formato que o jogo espera de um .glb e encaixa na mesma caixa (altura e largura) do modelo antigo */
  function modeloArvore(d, caixaAntiga, matTronco, matFolha) {
    var minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, maxY = -1e9, i;
    function mede(a) { for (var j = 0; j < a.length; j += 3) { minX = Math.min(minX, a[j]); maxX = Math.max(maxX, a[j]); minZ = Math.min(minZ, a[j + 2]); maxZ = Math.max(maxZ, a[j + 2]); maxY = Math.max(maxY, a[j + 1]); } }
    mede(d.pos); mede(d.fp);
    var meu = Math.max(maxX - minX, maxZ - minZ) / 2, dele = Math.max(caixaAntiga.max.x - caixaAntiga.min.x, caixaAntiga.max.z - caixaAntiga.min.z) / 2;
    var eh = dele / meu, ev = caixaAntiga.max.y / maxY;
    function escala(a) { var b = new Float32Array(a.length); for (var j = 0; j < a.length; j += 3) { b[j] = a[j] * eh; b[j + 1] = a[j + 1] * ev; b[j + 2] = a[j + 2] * eh; } return b; }
    var grupo = new THREE.Group();
    var gt = new THREE.BufferGeometry();
    gt.setAttribute("position", new THREE.BufferAttribute(escala(d.pos), 3)); gt.setAttribute("normal", new THREE.Float32BufferAttribute(d.nor, 3));
    gt.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2)); gt.setIndex(d.idx);
    grupo.add(new THREE.Mesh(gt, matTronco));
    if (d.fp.length) {
      var gf = new THREE.BufferGeometry();
      gf.setAttribute("position", new THREE.BufferAttribute(escala(d.fp), 3)); gf.setAttribute("normal", new THREE.Float32BufferAttribute(d.fn, 3));
      gf.setAttribute("uv", new THREE.Float32BufferAttribute(d.fu, 2)); gf.setAttribute("color", new THREE.Float32BufferAttribute(d.fc, 3)); gf.setIndex(d.fi);
      grupo.add(new THREE.Mesh(gf, matFolha));
    }
    grupo.updateMatrixWorld(true);
    grupo.userData.caixa = new THREE.Box3().setFromObject(grupo);
    grupo.userData.xgArvore = true;
    return grupo;
  }
  function materialFolha(tx, cor) {
    var m = new THREE.MeshStandardMaterial({ map: tx, color: cor, alphaTest: 0.3, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72, metalness: 0 });
    m.envMapIntensity = 0.85; m.userData.xgFolha = true;
    /* a luz usa a normal "de bola" da copa nos dois lados do cartao (sem isso o verso da folha fica preto) */
    m.onBeforeCompile = function (sh) {
      sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal=normalize(vNormal);\n");
    };
    m.customProgramCacheKey = function () { return "xg-folha-1"; };
    return m;
  }
  /* troca, no mundo ja montado, as arvores do modelo antigo pelas do novo, nas mesmas posicoes e tamanhos */
  function trocarNoMundo(velho, novo) {
    var partes = []; velho.traverse(function (p) { if (p.isMesh) partes.push(p); });
    if (!partes.length) return 0;
    var geos = partes.map(function (p) { return p.geometry; }), inv = new THREE.Matrix4().copy(partes[0].matrixWorld).invert();
    /* 12/11/2026: so as arvores do campo (fazem sombra); a mata do horizonte (~520, sem sombra) fica com o modelo simples, que de longe
       e igual e pesa muito menos (era o que mais travava) */
    var alvos = []; mundo.traverse(function (o) { if (o.isInstancedMesh && o.geometry === geos[0] && o.castShadow) alvos.push(o); });
    alvos.forEach(function (im) {
      var pai = im.parent, n = im.instanceMatrix.count, M = new THREE.Matrix4(), T = [];
      for (var i = 0; i < n; i++) { im.getMatrixAt(i, M); T.push(new THREE.Matrix4().multiplyMatrices(M, inv)); }
      pai.children.slice().forEach(function (o) { if (o.isInstancedMesh && geos.indexOf(o.geometry) >= 0 && o.instanceMatrix.count === n) pai.remove(o); });
      instanciar(novo, T, pai, im.castShadow);
    });
    return alvos.length;
  }
  function trocarArvoresDoCampo() {
    if (!API.modelosArvore || !API.arvoresVelhas) return;
    API.arvoresVelhas.forEach(function (v, i) { trocarNoMundo(v, API.modelosArvore[i]); });
  }
  function montarArvores(cascaCor, cascaNormal) {
    if (typeof carregarGlb !== "function" || typeof instanciar !== "function" || typeof GLB === "undefined" || typeof cacheGlb === "undefined") return Promise.resolve();
    cascaCor.anisotropy = cascaNormal.anisotropy = 4;
    var folhas = texturaFolhas();
    var casca = new THREE.MeshStandardMaterial({ map: cascaCor, normalMap: cascaNormal, roughness: 0.95, metalness: 0 });
    var cascaSeca = new THREE.MeshStandardMaterial({ map: cascaCor, normalMap: cascaNormal, color: "#b3aca0", roughness: 1, metalness: 0 });
    matFolhaFundo = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: folhas, alphaTest: 0.3, side: THREE.DoubleSide });
    return Promise.all([carregarGlb(GLB.verde), carregarGlb(GLB.outono), carregarGlb(GLB.seca)]).then(function (velhos) {
      var novos = [
        modeloArvore(gerarArvore(2026, false), velhos[0].userData.caixa, casca, materialFolha(folhas, "#ffffff")),
        modeloArvore(gerarArvore(1711, false), velhos[1].userData.caixa, casca, materialFolha(folhas, "#f3e39a")),
        modeloArvore(gerarArvore(905, true), velhos[2].userData.caixa, cascaSeca, null),
      ];
      API.arvoresVelhas = velhos;
      API.arvoresTrocadas = velhos.map(function (v, i) { return trocarNoMundo(v, novos[i]); });
      API.modelosArvore = novos;
    });
  }

  /* ------------------------------------------------------------------ 6. jato da pulverizacao */
  /* A fisica continua a mesma (pulverizacao.js / emitir do jogo escrevem as gotas na geometria da `nevoa`; a faixa, a deriva e a
     fracao de gotas finas que escapa ja dependem do tamanho de gota P.gota). Aqui muda o desenho, 11/11/2026 (Eduardo: "o drone tem
     bico rotativo e nao bico hidraulico e ai muda o tamanho da gota", "tem que ver se ta fazendo o efeito vortex"):
     (a) BICO ROTATIVO (atomizador centrifugo, T50/T25/T100/T70P/XAG/EAVision/Ceres): o disco joga a calda para FORA, num anel
         horizontal de gotas em volta do bico; o vento dos rotores pega esse anel e leva para baixo como uma cortina.
         T10 (bicos de leque hidraulicos): leque em V saindo de um ponto.
     (b) TAMANHO DA GOTA (P.gota, 50 a 500 um): gota fina = anel mais largo, nevoa mais densa e mais vortice; gota grossa = pingos
         maiores e visiveis que caem quase retos.
     (c) VORTICE DE PONTA: andando, o ar dos rotores enrola nas pontas da faixa e deixa dois rolos girando atras do drone
         (sentidos opostos), que descem ate o chao; levam junto as gotas finas.
     (d) gotas e nevoa que ja existiam, desenhadas com brilho contra o sol. */
  var jato = { gotas: null, nevoa: null, leques: [], aneis: [], rolos: null, forca: 0, bicos: null, rotativo: true };
  var JATO_V = [
    "uniform float escala;uniform float camada;uniform float droneY;uniform vec3 solDir;uniform float tamGota;uniform float fino;uniform vec3 dronePos;uniform float fluxo;",
    "varying float vA;varying float vBrilho;",
    "void main(){",
    " if(position.y<-900.0){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;vA=0.0;vBrilho=0.0;return;}",
    " float rnd=fract(sin(dot(position.xz,vec2(12.9898,78.233)))*43758.5453);",
    " float h=clamp((droneY-position.y)/3.0,0.0,1.0);",
    " vec3 pos=position;",
    " if(camada>0.5)pos.xz+=(vec2(rnd,fract(rnd*7.31))-0.5)*(0.5+1.8*h)*(0.6+0.8*fino);",
    " vec4 mv=modelViewMatrix*vec4(pos,1.0);gl_Position=projectionMatrix*mv;",
    " vec3 olhar=normalize(position-cameraPosition);",
    " vBrilho=0.72+1.1*pow(max(0.0,dot(olhar,solDir)),5.0)+0.25*rnd;",
    " float dist=max(0.1,-mv.z);",
    " if(camada<0.5){gl_PointSize=clamp((0.035+0.035*rnd)*tamGota*escala/dist,1.0,7.0);vA=(0.18+0.22*(1.0-fino)-0.15*h)*(dist>60.0?0.5:1.0);}",
    " else{gl_PointSize=clamp((0.45+1.6*h+0.5*rnd)*escala/dist,1.0,220.0);vA=0.085*(1.0-0.4*h)*(0.45+0.9*fino);}",
    " float longe=distance(position.xz,dronePos.xz);",
    " vA*=camada<0.5?(1.0-smoothstep(3.0,9.0,longe)):(1.0-smoothstep(8.0,22.0,longe));",
    " vA*=fluxo;",   // 19/11/2026: a nevoa das gotas some quando a aeronave reduz para virar (jato.fluxo)
    "}",
  ].join("\n");
  var RUIDO_GLSL = "float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n" +
    "float rd(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}\n";
  /* anel do disco rotativo: raios de gotas saindo do centro, girando */
  var ANEL_F = [
    "uniform float tempo;uniform float forca;uniform float fino;varying vec2 vUv;varying vec3 vL;", RUIDO_GLSL,
    "void main(){",
    " float r=length(vL.xz);float ang=atan(vL.z,vL.x);",
    " float raios=rd(vec2(ang*24.0+tempo*40.0,r*3.0-tempo*6.0));",
    " float fina=rd(vec2(ang*60.0-tempo*55.0,r*9.0-tempo*12.0));",
    " float a=smoothstep(0.35,0.85,mix(raios,fina,fino));",
    " a*=smoothstep(0.08,0.22,r)*(1.0-smoothstep(0.55,1.0,r));",
    " gl_FragColor=vec4(vec3(0.9,0.93,0.96),a*0.62*forca);",
    "}",
  ].join("\n");
  /* rolos de vortice: pontos calculados no proprio shader a partir de (s ao longo do rolo, fase, lado) */
  var ROLO_V = [
    "attribute vec3 aRolo;",
    "uniform vec3 uPos;uniform vec3 uFrente;uniform vec3 uLado;uniform float uMeia,uComp,uTempo,uForca,uChao,escala;uniform vec3 solDir;",
    "varying float vA;varying float vBrilho;",
    "void main(){",
    " float s=aRolo.x,lado=aRolo.z,fase=aRolo.y*6.2831853;",
    " vec3 c=uPos-uFrente*(s*uComp)+uLado*(lado*uMeia*(0.85+0.25*s));",
    " c.y=mix(uPos.y-0.5,uChao+0.7,smoothstep(0.0,0.75,s));",
    " float r=0.25+1.2*s;",
    " float ang=fase+lado*(uTempo*4.0-s*9.0);",
    " vec3 p=c+uLado*(cos(ang)*r)+vec3(0.0,1.0,0.0)*(sin(ang)*r*0.75);",
    " p.y=max(p.y,uChao+0.05);",
    " vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;",
    " float dist=max(0.1,-mv.z);",
    " gl_PointSize=clamp((0.35+1.1*s)*escala/dist,1.0,180.0);",
    " vA=uForca*0.085*smoothstep(0.0,0.08,s)*(1.0-smoothstep(0.55,1.0,s));",
    " vBrilho=0.75+1.0*pow(max(0.0,dot(normalize(p-cameraPosition),solDir)),5.0);",
    "}",
  ].join("\n");
  var ROLO_F = [
    "varying float vA;varying float vBrilho;",
    "void main(){vec2 c=gl_PointCoord-vec2(0.5);float r=length(c)*2.0;if(r>1.0||vA<=0.0)discard;",
    " gl_FragColor=vec4(vec3(0.85,0.9,0.94)*vBrilho,vA*pow(1.0-r*r,2.0));}",
  ].join("\n");
  function modeloDoDrone() {
    try { var q = new URLSearchParams(window.parent.location.search); return q.get("modelo") || q.get("drone") || "t50"; } catch (e) { return "t50"; }
  }
  var JATO_F = [
    "uniform float camada;varying float vA;varying float vBrilho;",
    "void main(){",
    " vec2 c=gl_PointCoord-vec2(0.5);float r=length(c)*2.0;if(r>1.0||vA<=0.0)discard;",
    " float a=camada<0.5?(1.0-smoothstep(0.55,1.0,r)):pow(1.0-r*r,2.2);",
    " vec3 cor=vec3(0.84,0.89,0.93)*vBrilho;",
    " gl_FragColor=vec4(cor,vA*a);",
    "}",
  ].join("\n");
  /* cortina que desce (rotativo: comeca ja larga, no raio do anel; leque: comeca num ponto) */
  var LEQUE_F = [
    "uniform float tempo;uniform float forca;uniform float fino;varying vec2 vUv;", RUIDO_GLSL,
    "void main(){",
    " float desce=1.0-vUv.y;",
    " float fios=rd(vec2(vUv.x*(40.0+50.0*(1.0-fino)),desce*3.0-tempo*5.0))*0.6+rd(vec2(vUv.x*23.0,desce*9.0-tempo*8.0))*0.4;",
    " float nuvem=rd(vec2(vUv.x*9.0,desce*2.0-tempo*2.5));",
    " float a=mix(smoothstep(0.45,0.9,fios),nuvem,smoothstep(0.15,0.8,desce)*(0.4+0.6*fino));",
    " a*=smoothstep(0.0,0.08,desce)*(1.0-smoothstep(0.55,1.0,desce));",
    " gl_FragColor=vec4(vec3(0.88,0.92,0.95),a*(0.34+0.20*fino)*forca);",
    "}",
  ].join("\n");
  function bicosDoDrone() {
    try {
      var pr = window.parent.PULVERIZACAO, pf = pr && pr.perfis && pr.perfis[modeloDoDrone()];
      if (pf && pf.bicos) return pf.bicos;
    } catch (e) { /* campo sozinho */ }
    return [{ lado: 0.9, tras: 0.55 }, { lado: -0.9, tras: 0.55 }];
  }
  function montarJato() {
    if (typeof nevoa === "undefined" || !nevoa) return;
    var uni = function (camada) {
      return { escala: { value: 600 }, camada: { value: camada }, droneY: { value: 0 }, solDir: { value: dirSol }, tamGota: { value: 1 }, fino: { value: 0.5 }, dronePos: { value: new THREE.Vector3() }, fluxo: { value: 1 } };
    };
    jato.gotas = new THREE.Points(nevoa.geometry, new THREE.ShaderMaterial({ uniforms: uni(0), vertexShader: JATO_V, fragmentShader: JATO_F, transparent: true, depthWrite: false }));
    jato.nevoa = new THREE.Points(nevoa.geometry, new THREE.ShaderMaterial({ uniforms: uni(1), vertexShader: JATO_V, fragmentShader: JATO_F, transparent: true, depthWrite: false }));
    [jato.gotas, jato.nevoa].forEach(function (p, i) { p.frustumCulled = false; p.renderOrder = 2 + i; p.name = "xg-jato"; cena.add(p); });
    jato.bicos = bicosDoDrone();
    jato.rotativo = modeloDoDrone() !== "t10";   // so o T10 tem bico hidraulico de leque
    /* 11/11/2026 (Eduardo, de perto: "nao ta legal, tem que deixar mais realista"): o jato deixa de ser cone/anel com listras
       e vira uma PLUMA DE PARTICULAS de nevoa, cada uma andando de verdade:
       - sai do bico: no rotativo o disco joga para FORA (radial, horizontal), mais forte com gota fina; no T10 (leque) desce num V;
       - o vento dos rotores empurra para baixo (forte logo abaixo do drone, fraco perto do chao);
       - arrasto do ar, turbulencia, vento do clima (gota fina sente mais);
       - bate no chao, espalha e assenta devagar;
       - andando, nas pontas da faixa o ar enrola (vortice) e leva a nevoa para cima e para dentro;
       - cada particula e um floco de nevoa macio que cresce e some; contra o sol fica mais clara.
       As gotas da fisica (pulverizacao.js) continuam pintando o chao e contando a dose; os pontinhos delas nao sao mais desenhados. */
    jato.gotas.visible = false;
    /* 18/11/2026: 2400 -> 3000 flocos, para caberem os do rolo de cima (palto: 0 = floco comum; +1/-1 = lado do rolo de cima) */
    var NPL = 3000, pp = new Float32Array(NPL * 3), pv = new Float32Array(NPL * 3), pidade = new Float32Array(NPL), pvida = new Float32Array(NPL),
      ptam = new Float32Array(NPL), palfa = new Float32Array(NPL), pgiro = new Float32Array(NPL), pfino = new Float32Array(NPL), palto = new Float32Array(NPL), prox = 0;
    for (var i0 = 0; i0 < NPL; i0++) { pp[i0 * 3 + 1] = -999; pvida[i0] = 0; }
    var gp = new THREE.BufferGeometry();
    gp.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    gp.setAttribute("aTam", new THREE.BufferAttribute(ptam, 1));
    gp.setAttribute("aAlfa", new THREE.BufferAttribute(palfa, 1));
    gp.setAttribute("aGiro", new THREE.BufferAttribute(pgiro, 1));
    /* floco de nevoa: mancha macia com miolo irregular (canvas, sem arquivo) */
    var cv = document.createElement("canvas"); cv.width = cv.height = 128;
    (function (g) {
      var r = sorteio(4321);
      for (var k = 0; k < 26; k++) {
        var x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, R = 14 + r() * 30;
        var gr = g.createRadialGradient(x, y, 0, x, y, R);
        gr.addColorStop(0, "rgba(255,255,255," + (0.18 + r() * 0.2) + ")"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
      }
      var m = g.createRadialGradient(64, 64, 30, 64, 64, 64); m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(1, "rgba(0,0,0,1)");
      g.globalCompositeOperation = "destination-out"; g.fillStyle = m; g.fillRect(0, 0, 128, 128);
    })(cv.getContext("2d"));
    var texFloco = new THREE.CanvasTexture(cv);
    var matPluma = new THREE.ShaderMaterial({
      uniforms: { mapa: { value: texFloco }, escala: { value: 600 }, solDir: { value: dirSol } }, transparent: true, depthWrite: false,
      vertexShader: [
        "attribute float aTam;attribute float aAlfa;attribute float aGiro;uniform float escala;uniform vec3 solDir;",
        "varying float vA;varying float vGiro;varying float vLuz;",
        "void main(){",
        " if(aAlfa<=0.001){gl_Position=vec4(2.0,2.0,2.0,1.0);gl_PointSize=0.0;vA=0.0;return;}",
        " vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;",
        " float dist=max(0.2,-mv.z);",
        " gl_PointSize=clamp(aTam*escala/dist,1.5,256.0);",
        " float sub=aTam*escala/dist<2.0?0.6:1.0;",
        " vA=aAlfa*sub;vGiro=aGiro;",
        " vLuz=0.78+0.9*pow(max(0.0,dot(normalize(position-cameraPosition),solDir)),4.0);",
        "}"].join("\n"),
      fragmentShader: [
        "uniform sampler2D mapa;varying float vA;varying float vGiro;varying float vLuz;",
        "void main(){",
        " vec2 c=gl_PointCoord-0.5;float s=sin(vGiro),k=cos(vGiro);c=vec2(k*c.x-s*c.y,s*c.x+k*c.y)+0.5;",
        " float a=texture2D(mapa,c).a;if(a*vA<0.003)discard;",
        " vec3 cor=mix(vec3(0.80,0.84,0.88),vec3(0.97,0.98,1.0),a)*vLuz;",
        " gl_FragColor=vec4(cor,a*vA);",
        "}"].join("\n"),
    });
    var pluma = new THREE.Points(gp, matPluma);
    pluma.frustumCulled = false; pluma.renderOrder = 4; pluma.name = "xg-pluma"; cena.add(pluma);
    jato.pluma = pluma;
    API.jato = jato;
    var antigo = cena.getObjectByName("veu-de-noiva");
    var ultimo = performance.now(), acumulado = 0, tempo = 0;
    function solo(x, z) { try { return alt(x, z); } catch (e) { return 0; } }
    jato.gotas.onBeforeRender = function () {};
    jato.nevoa.onBeforeRender = function () {
      var agora = performance.now(), dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
      if (window.PAUSA_SIM && PAUSA_SIM.pausado) dt = 0;
      dt *= Math.min(4, Math.max(0.25, V.mult || 1));   // tempo acelerado do jogo tambem acelera a nevoa
      tempo += dt;
      nevoa.visible = false;
      if (!antigo) antigo = cena.getObjectByName("veu-de-noiva");
      if (antigo) antigo.visible = false;
      var d = drone.position, h = render.domElement.height * 0.62;
      var gota = Math.max(50, Math.min(500, Number(typeof P !== "undefined" && P.gota) || 250));
      var fino = Math.max(0, Math.min(1, (500 - gota) / 450));
      var un = jato.nevoa.material.uniforms; un.escala.value = h; un.droneY.value = d.y; un.tamGota.value = gota / 250; un.fino.value = fino; un.dronePos.value.copy(d);
      matPluma.uniforms.escala.value = h;
      /* ligado = a bomba esta tirando calda do tanque (todos os drones e jeitos de voar) */
      var tanAgora = Number(V.tan) || 0;
      if (jato.tanAntes != null && tanAgora < jato.tanAntes - 1e-6) jato.gastouEm = agora;
      jato.tanAntes = tanAgora;
      var ligado = !(typeof P !== "undefined" && P.xgMapeamento) && (agora - (jato.gastouEm || -1e9) < 450 ||
        !!(V.aplicando && V.rodando) || !!(window.xgPulvManual && window.xgPulvManual.ligado));
      jato.forca += ((ligado ? 1 : 0) - jato.forca) * Math.min(1, dt * 6 + 0.001);
      var yaw = V.yaw || 0, fx = Math.cos(yaw), fz = -Math.sin(yaw), lx = fz, lz = -fx;
      var chao = solo(d.x, d.z), altura = Math.max(0.3, d.y - chao);
      var larg = 1.2; try { larg = Math.max(1.2, larguraEfetiva()); } catch (e) { /* sem largura */ }
      var manual = V.estado === "manual", vx = manual ? (V.mvx || 0) : (V.v || 0) * (V.dirx || 0), vz = manual ? (V.mvz || 0) : (V.v || 0) * (V.dirz || 0);
      var vel = Math.hypot(vx, vz), tx = vel > 0.3 ? vx / vel : fx, tz = vel > 0.3 ? vz / vel : fz, nx = -tz, nz = tx;
      var W = window.xgPulv && window.xgPulv.vento, wx = W ? Math.cos(W.dir) * W.vel : 0, wz = W ? Math.sin(W.dir) * W.vel : 0;
      if (!W && window.parent !== window) { try { var W2 = window.parent.xgPulv && window.parent.xgPulv.vento; if (W2) { wx = Math.cos(W2.dir) * W2.vel; wz = Math.sin(W2.dir) * W2.vel; } } catch (e) { /* outra origem */ } }
      /* 17/11/2026 (Eduardo: "ta faltando efeito vortex que aparece depois de 25 km/h"): o rolo de ponta so existe acima de
         25 km/h e chega ao maximo aos 32 km/h; gota grossa entra menos nele. Antes comecava com o drone quase parado e era
         fraco demais para ver. */
      var meia = Math.max(1.2, larg / 2), vortice = Math.max(0, Math.min(1, (vel * 3.6 - 25) / 7)) * (0.45 + 0.55 * fino);
      API.jatoEstado = { gota: gota, fino: Math.round(fino * 100) / 100, vortice: Math.round(vortice * jato.forca * 100) / 100, rotativo: jato.rotativo, ligado: ligado,
        faixa: Math.round(meia * 20) / 10, kmh: Math.round(vel * 36) / 10 };
      /* 19/11/2026: jato.fluxo (0 a 1) = quanto da nevoa aparece. E SEMPRE 1 (a nevoa de sempre, com o rolo do vortice), menos DENTRO
         DO GIRO do XAG, onde a vazao cai para 3% (campo: V.xgCurvaK, de 0 a 1): ali somem os flocos novos, o brilho dos que estao no
         ar e as gotas da fisica desenhadas embaixo da aeronave (xg-jato; elas saem na mesma quantidade com qualquer vazao).
         Ele, depois de ver no site a versao em que a nevoa tambem caia com a velocidade (freando e acelerando na reta): "ta muito fraca
         essa nevua e eu ainda falei q quero da forma que era antes" / "mas quand vira a volta faz igual como ta". NAO ligar a nevoa
         a velocidade nem a vazao de novo: so ao giro. */
      var fluxoAlvo = 1 - 0.97 * (V.xgCurvaK || 0);
      if (jato.fluxo == null) jato.fluxo = 1;
      jato.fluxo += (fluxoAlvo - jato.fluxo) * Math.min(1, dt * 6);
      un.fluxo.value = jato.fluxo;
      /* emitir */
      if (dt > 0 && jato.forca > 0.05) {
        /* rolo de cima (18/11/2026): flocos A MAIS, na proporcao do vortice (ate 30%), para nao tirar nevoa do jato e do rolo do chao */
        var parteAlta = API.semRoloAlto ? 0 : 0.30 * vortice;   // API.semRoloAlto = true: so para comparar no console
        /* 19/11/2026 (Eduardo, P60: "quando vira a volta reduz a vazao e isso precisa acontecer visualmente ... o efeito de agua
           quase sumir"): na troca de faixa do XAG (campo: V.xgCurvaK, de 0 a 1) sobra ~3% da nevoa (ele, vendo as fotos do teste: "tem q se bem menos produto no giro do drone ... quase nada ... menos ainda") */
        acumulado += dt * 850 * jato.forca * (A.taxaPluma || 1) * (1 + parteAlta) * jato.fluxo;   // jato.fluxo: 1 sempre, ~0 so dentro do giro do XAG (acima)
        var nb = jato.bicos.length;
        while (acumulado >= 1) {
          acumulado -= 1;
          var b = jato.bicos[prox % nb], i = prox; prox = (prox + 1) % NPL;
          /* 19/11/2026: "Somente bicos externos" na troca de faixa do XAG (campo: V.xgSoLado): o atomizador de dentro da curva nao solta nevoa */
          if (V.xgSoLado && (b.lado >= 0 ? 1 : -1) !== V.xgSoLado) continue;
          var bx = d.x + lx * b.lado - fx * b.tras, bz = d.z + lz * b.lado - fz * b.tras, by = d.y + 0.25;
          var r1 = Math.random(), ang = Math.random() * 6.2832, ff = Math.random() < 0.35 + 0.5 * fino ? 1 : 0;   // ff = gota fina desta particula
          palto[i] = 0;
          if (parteAlta > 0.004 && Math.random() < parteAlta / (1 + parteAlta)) {
            /* nasce do lado deste bico, ja em volta do miolo do rolo de cima (espalhado no giro: se todos saissem do mesmo
               ponto o rolo viraria uma fita em espiral, e nao o tubo de nevoa que se ve no campo) */
            var latB = (bx - d.x) * nx + (bz - d.z) * nz, ladoN = latB >= 0 ? 1 : -1;
            var giroN = Math.random() * 6.2832, raioN = 0.3 + 0.75 * Math.sqrt(Math.random());
            var foraN = ladoN * Math.max(2, meia * 0.5) + Math.cos(giroN) * raioN - latB;   // quanto para o lado, contado do bico
            pp[i * 3] = bx + nx * foraN; pp[i * 3 + 1] = chao + altura * 0.78 + Math.sin(giroN) * raioN; pp[i * 3 + 2] = bz + nz * foraN;
            pv[i * 3] = vx * 0.7; pv[i * 3 + 1] = 0; pv[i * 3 + 2] = vz * 0.7;
            pidade[i] = 0; pvida[i] = 2.4 + 1.6 * Math.random();
            ptam[i] = 0.12 + Math.random() * 0.1; pgiro[i] = Math.random() * 6.28; pfino[i] = 1; palto[i] = ladoN;
            continue;
          }
          /* 17/11/2026 (Eduardo: "tamanho de gota nao ta afetando a faixa e nem velocidade"): a cortina abre ate a LARGURA DA
             FAIXA da fisica (larguraEfetiva: gota fina e velocidade abrem, gota grossa e voo devagar fecham). Cada floco sai
             com a velocidade de lado que o leva a um ponto da faixa (do lado do bico dele, com um pouco de cruzamento no
             meio); o ar freia esse movimento (1,6 por segundo, o mesmo arrasto do "mover"). Antes a abertura era fixa e o
             jato ficava igual com qualquer gota e qualquer velocidade. O anel do disco rotativo continua, pequeno. */
          var radial, descer;
          if (jato.rotativo) { radial = (0.5 + 0.9 * fino) * (0.6 + 0.6 * r1); descer = 2.6 + Math.random() * 1.6; }
          else { radial = 0; descer = 5 + Math.random() * 2; }
          var ex = Math.cos(ang), ez = Math.sin(ang);
          var latBico = (bx - d.x) * nx + (bz - d.z) * nz, ladoB = latBico >= 0 ? 1 : -1;
          var vlat = 1.6 * (ladoB * meia * 0.85 * (-0.25 + 1.25 * Math.random()) - latBico);   // 0,85: o respingo no chao abre o resto
          pp[i * 3] = bx + ex * 0.12; pp[i * 3 + 1] = by; pp[i * 3 + 2] = bz + ez * 0.12;
          pv[i * 3] = nx * vlat + ex * radial + vx * 0.7; pv[i * 3 + 1] = -descer; pv[i * 3 + 2] = nz * vlat + ez * radial + vz * 0.7;
          pidade[i] = 0; pvida[i] = (ff ? 1.6 + 2.2 * fino : 0.9) + Math.random() * 0.9;
          ptam[i] = 0.12 + Math.random() * 0.1; pgiro[i] = Math.random() * 6.28; pfino[i] = ff;
        }
      }
      /* mover */
      var tq = tempo;
      for (var j = 0; j < NPL; j++) {
        if (pvida[j] <= 0) { palfa[j] = 0; continue; }
        pidade[j] += dt;
        var idade = pidade[j], vida = pvida[j];
        if (idade >= vida) { pvida[j] = 0; palfa[j] = 0; pp[j * 3 + 1] = -999; continue; }
        var k3 = j * 3, x = pp[k3], y = pp[k3 + 1], z = pp[k3 + 2];
        var acima = y - chao, sobDrone = Math.max(0, 1 - Math.hypot(x - d.x, z - d.z) / 3.2) * Math.max(0, 1 - (d.y - y) / (altura + 0.5));
        /* vortice de ponta (so acima de 25 km/h): atras do drone o ar dos rotores enrola em dois rolos, um em cada ponta da
           faixa, girando em sentidos opostos: desce pelo meio, corre para fora rente ao chao, sobe por fora e volta por cima.
           Os rolos engordam, sobem e se afastam para tras; a nevoa (a fina mais) fica presa neles e desenha os dois tubos que
           se veem no campo. noRolo = quanto este floco esta dentro de um rolo (0 a 1); alvoL/alvoY = a velocidade do ar ali
           (para o lado e para cima). O floco e puxado para essa velocidade; nao e um empurrao solto, como era. */
        var noRolo = 0, alvoL = 0, alvoY = 0;
        if (vortice > 0.02) {
          var rx = x - d.x, rz = z - d.z, atras = -(rx * tx + rz * tz), lat = rx * nx + rz * nz;
          /* idadeRolo = ha quantos segundos o drone passou por ali: o rolo evolui no tempo, igual em qualquer velocidade */
          var idadeRolo = atras / Math.max(3, vel);
          if (atras > 0.3 && idadeRolo < 5) {
            var ladoV = lat >= 0 ? 1 : -1, Rc = 0.7 + 0.5 * idadeRolo;
            /* o miolo do rolo nasce na altura das pontas dos rotores e vai descendo, ate perto do chao, e abrindo para fora */
            var cl = lat - ladoV * (meia * 0.85 + 0.25 * idadeRolo), cy = y - (chao + Math.max(0.9, altura * 0.75 - 0.8 * idadeRolo));
            var rr = Math.hypot(cl, cy), ur = rr / Rc;
            if (rr > 0.05) {
              noRolo = Math.min(1, idadeRolo / 0.2) * (1 - idadeRolo / 5) * Math.exp(-ur * ur / 6) * vortice * (0.45 + 0.55 * pfino[j]);
              var vt = (5 + 0.5 * Math.max(0, vel - 7)) * 2 * ur / (1 + ur * ur);   // m/s, maximo na borda do miolo do rolo
              alvoL = -cy / rr * ladoV * vt; alvoY = cl / rr * ladoV * vt;           // tangente do giro
            }
          }
        }
        /* ROLO DE CIMA. 18/11/2026 (Eduardo, com a foto de um T100 pulverizando: "o vortex que ta ali no chao ta bom mas tem
           outro que tem que colocar tambem que fica um pouco mais pra cima"). E o rolo das pontas dos rotores: uma parte da
           nevoa fina e engolida ao lado do drone, desce, corre para fora e SOBE por fora ate acima da altura do drone, voltando
           por cima (as duas "asas" brancas da foto). Tem flocos proprios (palto = lado em que nasceu), para o rolo do chao
           ficar exatamente como estava. O miolo fica ao lado do drone, um pouco abaixo dele, e vai subindo e abrindo com o
           tempo do floco. */
        if (palto[j]) {
          noRolo = 0; alvoL = 0; alvoY = 0;
          if (vortice > 0.02) {
            var ladoA = palto[j], latA = (x - d.x) * nx + (z - d.z) * nz, RcA = Math.min(2.4, 0.9 + 0.45 * idade);
            var clA = latA - ladoA * (Math.max(2, meia * 0.5) + 0.35 * idade), cyA = y - (chao + altura * 0.78 + 0.22 * idade);
            var rrA = Math.hypot(clA, cyA), urA = rrA / RcA;
            if (rrA > 0.05) {
              noRolo = Math.exp(-urA * urA / 8) * Math.min(1, vortice * 1.5);
              var vtA = (3.5 + 0.4 * Math.max(0, vel - 7)) * 2 * urA / (1 + urA * urA);
              alvoL = -cyA / rrA * ladoA * vtA; alvoY = clA / rrA * ladoA * vtA;
            }
          }
        }
        /* empurrao dos rotores: so perto e embaixo do drone, mais fraco perto do chao; dentro do rolo quem manda e o giro */
        var empurra = -(4.5 * sobDrone + 1.2) * Math.min(1, acima / 1.2) * (1 - 0.85 * noRolo);
        var leve = 0.5 + 0.9 * pfino[j];
        pv[k3 + 1] += (empurra - pv[k3 + 1]) * Math.min(1, dt * (2.2 + 1.5 * sobDrone));
        pv[k3] += ((wx * leve) - pv[k3]) * Math.min(1, dt * 1.6);
        pv[k3 + 2] += ((wz * leve) - pv[k3 + 2]) * Math.min(1, dt * 1.6);
        /* turbulencia: ondas lentas pelo espaco */
        pv[k3] += Math.sin(tq * 1.7 + y * 2.1 + z * 0.9 + j) * 1.4 * dt;
        pv[k3 + 2] += Math.cos(tq * 1.3 + x * 1.1 + y * 1.7 + j * 0.7) * 1.4 * dt;
        pv[k3 + 1] += Math.sin(tq * 2.3 + x * 0.7 + z * 1.3) * 0.6 * dt * pfino[j];
        if (noRolo > 0.01) {
          var puxa = Math.min(1, dt * 14) * noRolo, vl0 = pv[k3] * nx + pv[k3 + 2] * nz;
          pv[k3] += nx * (alvoL - vl0) * puxa; pv[k3 + 2] += nz * (alvoL - vl0) * puxa; pv[k3 + 1] += (alvoY - pv[k3 + 1]) * puxa;
        }
        x += pv[k3] * dt; y += pv[k3 + 1] * dt; z += pv[k3 + 2] * dt;
        var ch = chao;   /* 12/11/2026: o chao embaixo do drone (antes uma conta de relevo por floco, 2 vezes por quadro) */
        if (y < ch + 0.06) {   // bateu no chao: espalha e assenta
          y = ch + 0.06; var bate = -pv[k3 + 1];
          pv[k3 + 1] = 0; pv[k3] += (Math.random() - 0.5) * bate * 0.6; pv[k3 + 2] += (Math.random() - 0.5) * bate * 0.6;
          /* rente ao chao o ar do rolo corre para fora e leva a nevoa ate a ponta, onde ela sobe: ali o chao nao a segura */
          var atrito = 0.9 + 0.1 * Math.min(1, noRolo * 3);
          pv[k3] *= atrito; pv[k3 + 2] *= atrito;
          if (!pfino[j]) pvida[j] = Math.min(vida, idade + 0.35);
        }
        pp[k3] = x; pp[k3 + 1] = y; pp[k3 + 2] = z;
        var tv = idade / vida;
        ptam[j] = (0.16 + 0.10 * pfino[j]) + idade * (0.55 + 0.75 * pfino[j]);
        palfa[j] = jato.forca > 0 ? Math.min(1, idade * 8) * Math.pow(1 - tv, 1.6) * (palto[j] ? 0.24 : pfino[j] ? 0.16 : 0.24) * (1 + 1.4 * noRolo) * jato.fluxo : palfa[j] * 0.9;
        pgiro[j] += dt * 0.4 * (j % 2 ? 1 : -1);
      }
      var at = gp.attributes; at.position.needsUpdate = at.aTam.needsUpdate = at.aAlfa.needsUpdate = at.aGiro.needsUpdate = true;
    };
  }

  /* ------------------------------------------------------------------ 7. casas */
  /* Mesma caixa do predio() antigo (colisao e radar iguais), com: reboco de textura, barra suja embaixo, janelas com vidro que reflete o ceu,
     porta, beiral, telha ceramica (ou zinco ondulado no galpao) com relevo, cumeeira. */
  var texCasa = {};
  function canvasTex(n, desenhar, srgb, rx, ry) {
    var c = document.createElement("canvas"); c.width = c.height = n; desenhar(c.getContext("2d"), n);
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = Math.min(8, render.capabilities.getMaxAnisotropy()); t.repeat.set(rx || 1, ry || 1); return t;
  }
  function texturasCasa() {
    if (texCasa.ok) return texCasa;
    var r = sorteio(77);
    /* reboco: cinza claro com manchas (multiplica a cor da parede) + relevo granulado */
    texCasa.reboco = canvasTex(512, function (g, n) {
      g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, n, n);
      for (var i = 0; i < 160; i++) { g.globalAlpha = 0.04 + r() * 0.06; g.fillStyle = r() > 0.5 ? "#c9c2b5" : "#ffffff"; g.beginPath(); g.ellipse(r() * n, r() * n, 20 + r() * 90, 10 + r() * 60, r() * 3, 0, 7); g.fill(); }
      for (i = 0; i < 9000; i++) { g.globalAlpha = 0.1 + r() * 0.2; g.fillStyle = r() > 0.5 ? "#d8d8d8" : "#ffffff"; g.fillRect(r() * n, r() * n, 1.5, 1.5); }
      g.globalAlpha = 1;
    }, true);
    texCasa.rebocoRelevo = canvasTex(256, function (g, n) {
      g.fillStyle = "#808080"; g.fillRect(0, 0, n, n);
      for (var i = 0; i < 7000; i++) { var v = 90 + Math.floor(r() * 90); g.fillStyle = "rgb(" + v + "," + v + "," + v + ")"; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
    }, false);
    /* barra de baixo: terra vermelha respingada da chuva */
    texCasa.barra = canvasTex(256, function (g, n) {
      var gr = g.createLinearGradient(0, n, 0, 0); gr.addColorStop(0, "rgba(96,62,40,0.85)"); gr.addColorStop(0.55, "rgba(120,82,56,0.35)"); gr.addColorStop(1, "rgba(140,100,70,0)");
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
      for (var i = 0; i < 900; i++) { g.globalAlpha = r() * 0.4; g.fillStyle = "#6b4630"; g.fillRect(r() * n, n * (0.35 + r() * 0.65), 1 + r() * 3, 1 + r() * 4); }
    }, true);
    /* telha ceramica: fileiras de capa-canal; cor e relevo do mesmo desenho */
    function telhas(g, n, cor) {
      var cols = 8, rows = 8, w = n / cols, h = n / rows;
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
        var dx = (y % 2) * w * 0.5, k = 0.82 + r() * 0.3;
        var gr = g.createLinearGradient(x * w + dx, 0, x * w + dx + w, 0);
        gr.addColorStop(0, cor(k * 0.55)); gr.addColorStop(0.5, cor(k)); gr.addColorStop(1, cor(k * 0.55));
        g.fillStyle = gr; g.fillRect(x * w + dx - w, y * h, w, h); g.fillRect(x * w + dx, y * h, w, h);
        g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(x * w + dx - w, y * h + h - 3, 2 * w, 3);
      }
      for (var i = 0; i < 2500; i++) { g.globalAlpha = r() * 0.25; g.fillStyle = r() > 0.6 ? "#3b3b2c" : "#000000"; g.fillRect(r() * n, r() * n, 2, 2); }
      g.globalAlpha = 1;
    }
    texCasa.telha = canvasTex(512, function (g, n) { telhas(g, n, function (k) { return "rgb(" + Math.round(205 * k) + "," + Math.round(118 * k) + "," + Math.round(78 * k) + ")"; }); }, true);
    texCasa.telhaRelevo = canvasTex(512, function (g, n) { telhas(g, n, function (k) { var v = Math.round(230 * k); return "rgb(" + v + "," + v + "," + v + ")"; }); }, false);
    /* zinco ondulado com ferrugem e escorridos */
    texCasa.zinco = canvasTex(512, function (g, n) {
      for (var x = 0; x < n; x++) { var v = 150 + 70 * Math.sin(x / n * Math.PI * 2 * 24); g.fillStyle = "rgb(" + Math.round(v) + "," + Math.round(v + 4) + "," + Math.round(v + 8) + ")"; g.fillRect(x, 0, 1, n); }
      for (var i = 0; i < 60; i++) { g.globalAlpha = 0.08 + r() * 0.2; g.fillStyle = "#7a4a2a"; g.fillRect(r() * n, r() * n * 0.6, 2 + r() * 5, 30 + r() * 160); }
      g.globalAlpha = 1;
    }, true);
    texCasa.zincoRelevo = canvasTex(256, function (g, n) {
      for (var x = 0; x < n; x++) { var v = 128 + 120 * Math.sin(x / n * Math.PI * 2 * 24); g.fillStyle = "rgb(" + Math.round(v) + "," + Math.round(v) + "," + Math.round(v) + ")"; g.fillRect(x, 0, 1, n); }
    }, false);
    /* madeira da porta */
    texCasa.madeira = canvasTex(256, function (g, n) {
      g.fillStyle = "#6e4a2c"; g.fillRect(0, 0, n, n);
      for (var i = 0; i < 140; i++) { g.globalAlpha = 0.15 + r() * 0.2; g.strokeStyle = r() > 0.5 ? "#4a2f1b" : "#8a6240"; g.lineWidth = 1 + r() * 2; var x = r() * n; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, n * 0.3, x - 6, n * 0.7, x + 3, n); g.stroke(); }
      g.globalAlpha = 1; g.fillStyle = "rgba(0,0,0,0.35)"; for (var k = 1; k < 4; k++) g.fillRect(k * n / 4 - 1, 0, 2, n);
    }, true);
    texCasa.ok = true;
    return texCasa;
  }
  /* uv em metros para uma caixa (cada face com a escala certa, a textura nao estica) */
  function uvMetros(geo, escala) {
    var p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
    for (var i = 0; i < p.count; i++) {
      var ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      var u = ax > 0.5 ? p.getZ(i) : p.getX(i), v = ay > 0.5 ? p.getZ(i) : p.getY(i);
      uv.setXY(i, u / escala, v / escala);
    }
    uv.needsUpdate = true; return geo;
  }
  function casaNova(g) {
    var d = g.userData.xgPredio; if (!d || g.userData.xgCasaNova) return;
    var T = texturasCasa(), sx = d.sx, sz = d.sz, hp = d.hp, galpao = (sx >= 14 && hp >= 4.5) || /galp/i.test(d.nome || "");
    var antigos = g.children.slice(); antigos.forEach(function (o) { g.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    var add = function (m) { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    var corParede = new THREE.Color(d.corP);
    var matParede = new THREE.MeshStandardMaterial({ map: T.reboco, bumpMap: T.rebocoRelevo, bumpScale: 0.08, color: corParede.clone().multiplyScalar(0.86), roughness: 0.93 });
    /* paredes (sobem um pouco abaixo do chao, como o antigo) */
    var gp = uvMetros(new THREE.BoxGeometry(sx, hp, sz), 3); var parede = add(new THREE.Mesh(gp, matParede)); parede.position.y = hp / 2;
    /* barra de terra: uma casca 2 cm maior so ate 0,9 m */
    var gb = uvMetros(new THREE.BoxGeometry(sx + 0.03, 0.9, sz + 0.03), 2.2);
    var uvb = gb.attributes.uv, nb = gb.attributes.normal, pb = gb.attributes.position;
    for (var i = 0; i < uvb.count; i++) if (Math.abs(nb.getY(i)) < 0.5) uvb.setY(i, (pb.getY(i) + 0.45) / 0.9 * 0.999);
    var barra = new THREE.Mesh(gb, new THREE.MeshStandardMaterial({ map: T.barra, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
    barra.position.y = 0.45; barra.receiveShadow = true; g.add(barra);
    /* telhado de duas aguas, cumeeira no sentido do comprimento (x), mesma altura do antigo */
    var beiral = 0.55, meia = sz / 2 + beiral, alto = sz * 0.32, inc = Math.atan2(alto, sz / 2 + 0.35), compAgua = meia / Math.cos(inc);
    var matTelha = galpao
      ? new THREE.MeshStandardMaterial({ map: T.zinco, bumpMap: T.zincoRelevo, bumpScale: 1.2, color: new THREE.Color(d.corT).lerp(new THREE.Color("#c8ccd0"), 0.5), metalness: 0.65, roughness: 0.42 })
      : new THREE.MeshStandardMaterial({ map: T.telha, bumpMap: T.telhaRelevo, bumpScale: 0.9, color: new THREE.Color(d.corT).lerp(new THREE.Color("#ffffff"), 0.55), roughness: 0.82 });
    [1, -1].forEach(function (lado) {
      var ga = new THREE.BoxGeometry(sx + 2 * beiral, 0.08, compAgua);
      var uva = ga.attributes.uv, pa = ga.attributes.position;
      for (var k = 0; k < uva.count; k++) uva.setXY(k, pa.getX(k) / (galpao ? 4 : 2.2), pa.getZ(k) / (galpao ? 4 : 2.2));
      var agua = add(new THREE.Mesh(ga, matTelha));
      agua.rotation.x = lado * inc;
      agua.position.set(0, hp + alto / 2 - 0.05 + (galpao ? 0 : 0.02), lado * (compAgua / 2) * Math.cos(inc) - lado * 0.0);
      agua.position.z = lado * (meia / 2);
      agua.position.y = hp + alto - (meia / 2) * Math.tan(inc) + 0.04;
    });
    var cume = add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, sx + 2 * beiral, 10, 1), galpao ? matTelha : new THREE.MeshStandardMaterial({ color: new THREE.Color(d.corT).multiplyScalar(0.8), roughness: 0.8 })));
    cume.rotation.z = Math.PI / 2; cume.position.y = hp + alto + 0.06;
    /* oitoes (triangulos de reboco nas pontas) */
    var tri = new THREE.Shape([new THREE.Vector2(-sz / 2, 0), new THREE.Vector2(sz / 2, 0), new THREE.Vector2(0, alto * (sz / 2) / (sz / 2 + 0.35))]);
    [1, -1].forEach(function (lado) {
      var ot = add(new THREE.Mesh(new THREE.ShapeGeometry(tri), matParede));
      ot.rotation.y = lado * Math.PI / 2; ot.position.set(lado * sx / 2, hp, 0);
    });
    /* janelas e portas */
    var vidro = new THREE.MeshStandardMaterial({ color: "#16222b", metalness: 0.9, roughness: 0.06, envMapIntensity: 1.4 });
    var moldura = new THREE.MeshStandardMaterial({ color: galpao ? "#5c6266" : "#efece4", roughness: 0.6 });
    var madeira = new THREE.MeshStandardMaterial({ map: T.madeira, roughness: 0.8 });
    function abertura(face, pos, largura, altura, base, tipo) {
      /* face: "+z","-z","+x","-x"; pos = deslocamento ao longo da parede */
      var grupo = new THREE.Group(), fundo = 0.06;
      var mf = new THREE.Mesh(new THREE.BoxGeometry(largura + 0.16, altura + 0.16, 0.08), moldura); mf.position.z = fundo; grupo.add(mf);
      var miolo = new THREE.Mesh(new THREE.BoxGeometry(largura, altura, 0.06), tipo === "vidro" ? vidro : tipo === "metal" ? matTelha : madeira); miolo.position.z = fundo + 0.03; grupo.add(miolo);
      if (tipo === "vidro") {
        var cruz = new THREE.Mesh(new THREE.BoxGeometry(0.05, altura, 0.07), moldura); cruz.position.z = fundo + 0.04; grupo.add(cruz);
        var cruz2 = new THREE.Mesh(new THREE.BoxGeometry(largura, 0.05, 0.07), moldura); cruz2.position.z = fundo + 0.04; grupo.add(cruz2);
        var peit = new THREE.Mesh(new THREE.BoxGeometry(largura + 0.3, 0.06, 0.2), moldura); peit.position.set(0, -altura / 2 - 0.08, fundo + 0.08); grupo.add(peit);
      }
      grupo.position.y = base + altura / 2;
      if (face === "+z") { grupo.position.x = pos; grupo.position.z = sz / 2; }
      if (face === "-z") { grupo.position.x = pos; grupo.position.z = -sz / 2; grupo.rotation.y = Math.PI; }
      if (face === "+x") { grupo.position.z = pos; grupo.position.x = sx / 2; grupo.rotation.y = Math.PI / 2; }
      if (face === "-x") { grupo.position.z = pos; grupo.position.x = -sx / 2; grupo.rotation.y = -Math.PI / 2; }
      grupo.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(grupo);
    }
    if (galpao) {
      abertura("+z", 0, Math.min(5, sx * 0.4), Math.min(hp - 0.6, 4.4), 0, "metal");
      for (var w = -sx / 2 + 2.5; w < sx / 2 - 2; w += 4) abertura("-z", w, 1.6, 0.6, hp - 1.2, "vidro");
    } else {
      var nJ = Math.max(1, Math.floor((sx - 2.4) / 3)), passo = sx / (nJ + 1), porta = Math.min(nJ, 1 + Math.floor(nJ / 2));
      for (var j = 1; j <= nJ; j++) {
        var px = -sx / 2 + j * passo;
        if (j === porta) abertura("+z", px, 0.9, 2.1, 0, "madeira"); else abertura("+z", px, 1.2, 1.1, 1.0, "vidro");
        abertura("-z", px, 1.0, 1.0, 1.1, "vidro");
      }
      if (sz > 5) { abertura("+x", 0, 1.0, 1.0, 1.1, "vidro"); abertura("-x", 0, 1.0, 1.0, 1.1, "vidro"); }
      /* calcada em volta */
      var calc = new THREE.Mesh(new THREE.BoxGeometry(sx + 1.6, 0.12, sz + 1.6), new THREE.MeshStandardMaterial({ color: "#a9a49a", roughness: 0.95 }));
      calc.position.y = 0.2; calc.receiveShadow = true; g.add(calc);
    }
    g.userData.xgCasaNova = true;
  }
  function casasDoMundo() { mundo.children.forEach(function (o) { if (o.isGroup && o.userData.xgPredio) try { casaNova(o); } catch (e) { API.erro = String(e && e.message || e); } }); }

  /* ------------------------------------------------------------------ por cenario */
  function esconderCapimAntigo() {
    mundo.children.forEach(function (o) {
      if (!o.isInstancedMesh || !o.material) return;
      var ehTufo = (typeof texTufo !== "undefined" && texTufo && o.material.map === texTufo);
      if (ehTufo) o.visible = false;
    });
  }
  /* Chamado a cada cenario montado e a cada etapa do grafico que termina de baixar (ceu -> chao -> arvores):
     faz so o que ja esta disponivel; o resto fica como o jogo montou. */
  function aplicarMundo(c) {
    if (!pronto) return;
    var chao = null, jaTrocado = null;
    mundo.children.forEach(function (o) {
      if (!o.isMesh || o.isInstancedMesh || !o.material) return;
      if (o.userData.xgChao) jaTrocado = o;
      else if (o.material.map === solo && o.geometry.attributes.position.count === (SEG + 1) * (SEG + 1)) chao = o;
    });
    [300, 1500, 4000, 9000].forEach(function (ms) { setTimeout(function () { ligarSombras(); trocarArvoresDoCampo(); }, ms); });
    casasDoMundo();
    ligarSombras();
    if (!temChao || !capim) return;                       // texturas do chao ainda baixando
    if (jaTrocado) { capim.visible = nivelAtual !== "minima"; return; }
    capim.visible = false;
    if ((c && c.real) || !chao) return;
    montarControle(); montarAlturas(chao);
    var velho = chao.material; chao.material = materialChao(); chao.userData.xgChao = true; chao.receiveShadow = true;
    if (velho && velho.dispose) velho.dispose();
    esconderCapimAntigo();
    capim.visible = nivelAtual !== "minima";
  }
  function ganchoDoCenario() {
    var construirAntes = construirCenario;
    construirCenario = function (c) {
      var r = construirAntes(c);
      try { API.cenario = c; aplicarMundo(c); } catch (e) { API.erro = String(e && e.message || e); if (window.console) console.warn("[graficos]", e); }
      return r;
    };
  }

  /* o ajuste automatico de qualidade (js/campo/desempenho.js) avisa aqui quando desce de nivel */
  API.nivel = function (nome) {
    if (!pronto || nome === nivelAtual) return;
    nivelAtual = nome;
    var fr = { alta: 1, media: 0.6, baixa: 0.3, minima: 0 }[nome];
    if (fr == null) fr = 1;
    /* a nevoa do jato tambem alivia (12/11/2026, liberado para todos): menos flocos novos por segundo */
    A.taxaPluma = { alta: 1, media: 0.6, baixa: 0.35, minima: 0.2 }[nome] || 1;
    if (capim) {
      capim.geometry.instanceCount = Math.max(1, Math.round(A.capimTouceiras * fr));
      capim.visible = fr > 0 && temChao && !!(API.cenario && !API.cenario.real);
    }
    A.sombraRaio = nome === "alta" ? 90 : 60; API.sombra = nome === "alta" ? 2048 : 1024;
    Object.assign(sol.shadow.camera, { left: -A.sombraRaio, right: A.sombraRaio, top: A.sombraRaio, bottom: -A.sombraRaio });
    sol.shadow.camera.updateProjectionMatrix();
  };

  /* ------------------------------------------------------------------ partida */
  /* 14/11/2026 (Eduardo: "simulador ta com problema, nao ta carregando"; a internet dele estava ruim e os 11 MB do grafico novo
     baixavam JUNTO com o drone e a conta). Agora o grafico novo NUNCA disputa a linha com o simulador:
       1. so comeca depois que o jogo abriu (o aviso "carregando" do campo saiu = drone carregado) e mais 2,5 s de folga;
       2. o que nao precisa baixar entra na hora (jato em nevoa, casas);
       3. depois baixa em 3 etapas, um arquivo de cada vez e com prioridade baixa: ceu e luz -> chao e capim -> arvores.
          Cada etapa aparece quando termina; se a internet cair no meio, fica o que ja entrou e o resto como o jogo montou. */
  function esperarJogo() {
    return new Promise(function (ok) {
      (function olhar() {
        var aberto = false;
        try { aberto = !document.getElementById("carregando") && typeof inclina !== "undefined" && inclina.children.length > 0; } catch (e) { aberto = false; }
        if (aberto) setTimeout(ok, 2500); else setTimeout(olhar, 500);
      })();
    });
  }
  function tentarJato(n) {
    if (jato.pluma) return;
    if (typeof nevoa !== "undefined" && nevoa && typeof drone !== "undefined" && drone) {
      try { montarJato(); } catch (e) { API.erro = String(e && e.message || e); }
      return;
    }
    if (n > 0) setTimeout(function () { tentarJato(n - 1); }, 500);
  }
  function etapaCeu() {
    return Promise.all([
      fetch(PASTA + "ceu.json").then(function (r) { if (!r.ok) throw new Error("ceu.json " + r.status); return r.json(); }),
      textura(PASTA + "ceu_4k.jpg", true),
      script(CDN + "loaders/RGBELoader.js").then(function () {
        return new Promise(function (ok, erro) { new THREE.RGBELoader().load(PASTA + "ceu_hdr.hdr", ok, undefined, function () { erro(new Error("nao carregou ceu_hdr.hdr")); }); });
      }),
    ]).then(function (v) {
      montarCeu(v[0], v[1], v[2]);
      prepararSombra();
      pronto = true; API.pronto = true; API.etapa = "ceu";
      aplicarMundo(typeof cen !== "undefined" ? cen : null);
    });
  }
  function etapaChao() {
    return emFila([
      [PASTA + "chao/leafy_grass_diff.jpg", true], [PASTA + "chao/sparse_grass_diff.jpg", true],
      [PASTA + "chao/" + A.solo + "_diff.jpg", true], [PASTA + "chao/dirt_floor_diff.jpg", true],
      [PASTA + "chao/leafy_grass_nor_gl.jpg", false], [PASTA + "chao/" + A.solo + "_nor_gl.jpg", false],
      [PASTA + "chao/dirt_floor_nor_gl.jpg", false],
    ]).then(function (v) {
      U.xgGA.value = v[0]; U.xgGB.value = v[1]; U.xgSolo.value = v[2]; U.xgTerra.value = v[3];
      U.xgNG.value = v[4]; U.xgNS.value = v[5]; U.xgNT.value = v[6];
      U.xgRuido.value = texturaRuido();
      montarCapim();
      temChao = true; API.etapa = "chao";
      aplicarMundo(typeof cen !== "undefined" ? cen : null);
    });
  }
  function etapaArvores() {
    return emFila([[PASTA + "arvore/casca_diff.jpg", true], [PASTA + "arvore/casca_nor_gl.jpg", false]]).then(function (v) {
      return montarArvores(v[0], v[1]);
    }).then(function () { ligarSombras(); API.etapa = "arvores"; });
  }
  function ligar() {
    if (API.ativo) return;
    API.ativo = true;
    ganchoDoSol(); ganchoDoCenario();
    esperarJogo().then(function () {
      /* sem baixar nada: jato em nevoa e casas */
      tentarJato(240);
      API.casa = casaNova;
      try { casasDoMundo(); } catch (e) { API.erro = String(e && e.message || e); }
      return etapaCeu();
    }).then(etapaChao).then(etapaArvores).catch(function (e) {
      API.erro = String(e && e.message || e);
      if (window.console) console.warn("[graficos]", e);
    });
  }
  /* so depois de tudo acima existir. 12/11/2026 (Eduardo: "pode publicar ai pra todas as pessoas ja"): no site liga para TODOS
     (antes so contaAdmin()); ?g=antigo ou tpd_graficos="antigo" continua desligando. Neste PC (localhost) so com ?g=novo. */
  (function esperarConta(vezes) {
    var pode = LOCAL ? escolha === "novo" : true;
    if (pode === true) { ligar(); return; }
    if (pode === false || vezes <= 0) return;
    setTimeout(function () { esperarConta(vezes - 1); }, 500);
  })(80);
})();
