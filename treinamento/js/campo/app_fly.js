/* ==========================================================================
   AIR 2S - O APP DE VOO NO CELULAR DO RC-N1 (categoria "Mapeamento / voo livre")

   Pedido do Eduardo (13/10/2026): categoria nova com o Air 2S e o controle sem
   tela (RC-N1); o aluno faz o voo livre pela area. O controle 3D (RC-N1 com o
   celular no suporte) e montado pelo controle_dji_3d.js, como o do T10; o app
   do T25/T50 continua por baixo, escondido, so para a sequencia de ligar e
   conectar. Por cima do vidro do celular fica ESTA tela.

   14/10/2026 (pedido: "olhe todas as telas e replique esse app de voo"): as
   telas foram refeitas pela gravacao do celular dele com o app de voo e um voo
   do Air 2S (D:\Area de trabalho\video para analisar\Screenrecorder-2026-10-14-
   11-49-21-574.mp4, 6,5 min, 2400 x 1080). Sem o logotipo nem o nome do
   fabricante. Entrou so o que muda o voo, a camera ou a operacao (regra dele de
   06/10): ficaram de fora busca, Academy, QuickTransfer, Create, SkyPixel,
   Servicos, Perfil, as abas Transmissao e Sobre (firmware), zonas GEO,
   calibracoes, LEDs e "Procurar meu drone". O mapa e a foto de cima do campo
   do jogo, nunca o satelite da casa dele.

   Telas:
   - inicio: "Antes de voar", Galeria, "Guia de conexao" (sem aeronave) ou o
     drone (retrato do modelo 3D) e VOAR; a tela fica apagada com o controle
     desligado e o app abre sozinho ao ligar (como no controle de pulverizacao);
   - guia de conexao 1/3 a 3/3 (controle, aeronave, conectar);
   - camera: barra de cima (Modo C/N/S, estado, bateria, tempo de voo restante,
     sinal, sensores, GPS, ...), coluna da esquerda (desvio de obstaculos,
     FocusTrack, decolar/pousar), da direita (modo de foto, AF/MF, disparo,
     galeria, exposicao), mini-mapa, telemetria (altura e distancia com as
     velocidades), Armazenar/Formato/EV, grade, quadro 3:2 (foto) ou 16:9
     (video), gimbal, radar de obstaculos e avisos;
   - mapa em tela cheia (Padrao/Satelite/Ambos, rastro, norte, centrar);
   - modos: Foto (Unica, SmartPhoto, AEB, Disparo continuo, Intervalo), Video
     (Normal, Slow Motion), MasterShots, QuickShots (Dronie, Foguete, Orbita,
     Helice, Boomerang, Asteroide), Hyperlapse (Livre, Orbita, Bloqueio de
     curso, Trajetoria) e Panoramica (Esfera, 180, Grande-angular, Vertical);
   - configuracoes: Seguranca (desvio, mapa do radar, RTH, altitude e
     distancia maximas, perda de sinal), Controle (estabilizador, Fn, modo do
     manche) e Camera (formato, aspecto, grade, armazenamento);
   - galeria (Tudo/Fotos/Videos/Favoritos) com as fotos e videos do treino.

   No campo (sem editar a pasta campo/, que e copia do jogo):
   - camera de 1" no nariz, 88 graus na diagonal (3:2 = 77,5 x 56,3 graus;
     16:9 = 48,6 graus na vertical), gimbal de 0 a -90 (+24 com a opcao);
   - limites do voo manual pelos modos da chave do RC-N1 (ficha oficial):
     C 5 m/s, N 15 m/s, S 19 m/s; subida/descida 6 m/s; guinada 60/90/250 graus/s
     (C: subida/descida 2/1,5 m/s e estimativa, a ficha nao traz);
   - o ponto de origem e onde ele decolou (o RTH volta para la);
   - camera de perseguicao perto (o drone tem 25 cm; a do jogo fica a 11 m);
   - nada de calda: o tanque fica vazio e o drone nao pulveriza.

   Uso (principal.js): APP_FLY.manter(ponte, {modelo, manual, mostrar, vista,
   fase, quadro, estado}) a cada ciclo; APP_FLY.botao(alvo, ms) recebe os
   botoes do RC-N1 que o RC Plus do desenho nao tem.
   ========================================================================== */

window.APP_FLY = (function () {
  "use strict";

  var MODOS = {
    C: { nome: "Cine", velH: 5, sobe: 2, desce: 1.5, giro: 60, incMax: 15 },
    N: { nome: "Normal", velH: 15, sobe: 6, desce: 6, giro: 90, incMax: 30 },     // ficha: frente 30, lados 35
    S: { nome: "Sport", velH: 19, sobe: 6, desce: 6, giro: 250, incMax: 35 },
  };
  var TOAST_MODO = {
    C: "Modo Cine (vel. baixa)",
    N: "Modo normal",
    S: "Modo Esportivo (desvio de obstáculos indisponível)",
  };
  var ORDEM = ["C", "N", "S"];
  var AUTONOMIA_MIN = 31;           // ficha: 31 min voando sem vento
  var ALTURA_DECOLAGEM = 1.2;       // decolagem automatica: paira a 1,2 m
  var VFOV = { "3:2": 56.3, "16:9": 48.6 };   // graus na vertical do quadro visivel
  var FOTOS_LIVRES = 298;           // "Armazenar 298" com 2,3 GB livres (JPEG)
  var VIDEO_LIVRE = { "4K": 198, "2.7K": 401, "1080p": 571 };   // segundos livres (03:18, 06:41, 09:31)
  var EVS = [-3, -2.7, -2.3, -2, -1.7, -1.3, -1, -0.7, -0.3, 0, 0.3, 0.7, 1, 1.3, 1.7, 2, 2.3, 2.7, 3];

  /* ------------------------------------------------------------ estado */

  var ponte = null, cfg = {}, el = null, campoPronto = false;
  var modo = "N", lido = null, anterior = null, casa = null, relogio = null;
  var tela = "inicio";              // inicio | guia | camera | galeria
  var mapaGrande = false, mapaMin = false;
  var usb = { aceito: false, fase: "" };
  var auto = null;                  // automacao em curso (decolar, pousar, QuickShots...)
  var escrito = null;               // o que a automacao pos nos manches (para saber se o piloto mexeu)
  var alvo = null;                  // alvo escolhido na tela {x,y,z}
  var escolhendoAlvo = false, focusTrack = false;
  var gravando = null;              // {desde, rec, partes, nome}
  var intervalo = null;             // disparo por intervalo em curso
  var midia = [];                   // galeria do treino
  var fotosTiradas = 0, videoGasto = 0;
  var voandoDesde = 0, perdaDesde = 0, perdaFeita = false, ligadoAntes = false;
  var avisoBat = 0, avisoLimite = 0, gimbalVisto = null, gimbalMostrarAte = 0;
  var trilha = [], ultimaTrilha = 0, retrato = null, mapa = null, mapaPedido = false;
  var recadoAte = 0, sateliteBase = 20 + Math.floor(Math.random() * 6);

  var S = {                         // configuracoes do app (ficam no navegador)
    desvio: "frear", radar: true, rthAlt: 100, altMax: 500, distMax: 0, perda: "rth",
    gimbalModo: "rastreio", gimbalCima: false, fn: "gimbal", manche: 2,
    formato: "JPEG", aspecto: "3:2", grade: true, ev: 0, foco: "MF", res: "4K", fps: 30,
    camada: "padrao", norte: true,
  };
  var CAM = { modo: "foto", foto: "unica", aeb: 3, rajada: 3, intervalo: 2, video: "normal",
              qs: "dronie", hl: "livre", pano: "esfera", hlIntervalo: 2, hlQuadros: 125, hlVel: 1.5, hlPontos: [] };

  try {
    var guardado = JSON.parse(localStorage.getItem("tpd_fly_cfg") || "{}");
    Object.keys(S).forEach(function (k) { if (guardado && typeof guardado[k] === typeof S[k]) S[k] = guardado[k]; });
  } catch (e) { /* sem guardar */ }
  function salvarS() { try { localStorage.setItem("tpd_fly_cfg", JSON.stringify(S)); } catch (e) { /* sem guardar */ } }

  var MODOS_CAM = [
    { id: "foto", nome: "Foto", sub: [["unica", "Única"], ["smart", "SmartPhoto"], ["aeb", "AEB"], ["rajada", "Disparo contínuo"], ["intervalo", "Intervalo"]] },
    { id: "video", nome: "Vídeo", sub: [["normal", "Normal"], ["lento", "Slow Motion"]] },
    { id: "mastershots", nome: "MasterShots", sub: [] },
    { id: "quickshots", nome: "QuickShots", sub: [["dronie", "Dronie"], ["foguete", "Foguete"], ["orbita", "Órbita"], ["helice", "Hélice"], ["boomerang", "Boomerang"], ["asteroide", "Asteroide"]] },
    { id: "hyperlapse", nome: "Hyperlapse", sub: [["livre", "Livre"], ["orbita", "Órbita"], ["curso", "Bloqueio de curso"], ["trajetoria", "Trajetória"]] },
    { id: "pano", nome: "Panorâmica", sub: [["esfera", "Esfera"], ["180", "180°"], ["grande", "Grande-angular"], ["vertical", "Vertical"]] },
  ];
  var DESCRICAO = {
    mastershots: "Com base no alvo e na distância, a aeronave grava alguns clipes e cria um MasterShot automaticamente.",
    dronie: "A aeronave voa para trás e para cima, com a câmera travada no alvo.",
    foguete: "A câmera fica voltada para baixo, focando no alvo, enquanto a aeronave sobe rapidamente.",
    orbita: "A câmera foca no alvo e circunda-o a uma altitude constante.",
    helice: "A aeronave voa ao redor do alvo, afastando-se e subindo em espiral.",
    boomerang: "A aeronave voa ao redor do alvo em um movimento oval, subindo na diagonal, e volta ao ponto de partida.",
    asteroide: "A aeronave voa para cima e para trás até atingir a altura máxima e captura várias fotos para gerar uma panorâmica.",
    hl_livre: "Defina parâmetros de gravação. A aeronave irá gravar automaticamente e gerar um vídeo em Hyperlapse.",
    hl_orbita: "Selecione um alvo imóvel. A aeronave irá gravar automaticamente e criar um vídeo em Hyperlapse centralizando o alvo.",
    hl_curso: "A direção de voo fica travada. A aeronave avança nessa direção e grava um vídeo em Hyperlapse.",
    hl_trajetoria: "Defina várias trajetórias para criar uma rota de voo. A aeronave irá voar automaticamente pela rota de voo para gravar e criar um vídeo em Hyperlapse.",
    pano_esfera: "A aeronave captura 26 fotos e gera uma panorâmica esférica.",
    pano_180: "A aeronave captura 21 fotos e gera uma panorâmica de 180°.",
    pano_grande: "A aeronave captura 9 fotos e gera uma foto grande-angular.",
    pano_vertical: "A aeronave captura 3 fotos na vertical e gera uma panorâmica vertical.",
  };

  /* "Como jogar" da tela inicial (14/10/2026, Eduardo: instrucoes de como trocar a bateria no site).
     Teclas padrao; o aluno muda em "Teclas". */
  var LEAD = "Voe livre pela área com o controle RC-N1 e o app de voo no celular: fotos, vídeos e voos inteligentes, " +
             "com a câmera do drone, a tela do celular ou ao lado do operador.";
  var COMO_JOGAR = [
    "Ligue o controle: aperte o botão de ligar uma vez e depois segure (no controle da tela ou no seu RC-N1 pelo cabo). O app do celular abre e conecta sozinho.",
    "Toque em <b>VOAR</b>. Para decolar, toque no botão da esquerda e segure o círculo (ou segure <b>T</b>). Para pousar é igual.",
    "Voe com os manches (<b>W A S D</b> e as setas). A altura não acompanha o terreno: quem sobe e desce é você. A chave C/N/S (<b>M</b>) muda a velocidade.",
    "Fotos e vídeos: disparo (<b>Espaço</b>), foto/vídeo (<b>V</b>), câmera para cima e para baixo (<b>PageUp/PageDown</b>). Veja e baixe no computador pela Galeria (botão ▶ do app).",
    "Casinha (<b>H</b>): um toque pausa; segurando 1 s a aeronave volta ao ponto de decolagem (RTH).",
    "Trocar a bateria: pouse, espere os motores pararem e aperte <b>B</b>. A aeronave fica desligada alguns segundos e volta com 100%. Baixe as fotos antes de recarregar a página.",
  ];

  /* ------------------------------------------------------------ no campo

     Estas funcoes rodam DENTRO do jogo (toString + eval), onde V, drone,
     cena, render, camFpv e alt existem; nao podem usar nada deste arquivo. */

  function instalarNoCampo(o) {
    if (window.__xgFly) return true;
    if (typeof T50 === "undefined" || typeof V === "undefined" || typeof atualizarFpv !== "function" ||
        typeof posCamera !== "function" || typeof cena === "undefined" || typeof render === "undefined") return false;
    window.__xgFly = true;
    T50.tanque = 0.001; T50.vazaoMaxLmin = 0; T50.velMax = 15; T50.distSeguranca = 1.5; T50.frenagem = 6;
    T50.autonomiaVazioMin = o.autonomia; T50.autonomiaCheioMin = o.autonomia;
    /* tela inicial do campo: o texto e o "Como jogar" eram os do T50 (pulverizacao) */
    var como = document.querySelector("details.como ol");
    if (como) como.innerHTML = o.comoJogar.map(function (t) { return "<li>" + t + "</li>"; }).join("");
    var lead = document.querySelector("p.lead:not(#olaOp)");
    if (lead) lead.textContent = o.lead;
    V.tan = 0;
    if (typeof window.xgGimbal !== "number") window.xgGimbal = 0;
    if (typeof window.xgFlyVfov !== "number") window.xgFlyVfov = 56.3;

    /* camera no nariz, gimbal estabilizado; o quadro visivel tem a altura
       inteira da tela, entao o campo de visao vertical e o do sensor */
    atualizarFpv = function () {
      var d = drone.position, fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);
      camFpv.position.set(d.x + fx * 0.17, d.y + 0.022, d.z + fz * 0.17);
      camFpv.up.set(0, 1, 0);
      var g = (window.xgGimbal || 0) * Math.PI / 180, p = camFpv.position;
      camFpv.lookAt(p.x + fx * Math.cos(g) * 10, p.y + Math.sin(g) * 10, p.z + fz * Math.cos(g) * 10);
      var fov = window.xgFlyVfov || 56.3;
      if (Math.abs(camFpv.fov - fov) > 0.05 || camFpv.near !== 0.05) { camFpv.fov = fov; camFpv.near = 0.05; camFpv.updateProjectionMatrix(); }
    };

    /* perseguicao perto: o jogo segue o T50 a 11 m e 4,2 m acima */
    var pc = posCamera;
    posCamera = function (inst, dt) {
      if (modoMapa || telaInicial || vista === "operador" || !seguir) return pc.apply(this, arguments);
      var d = drone.position, tx = -Math.cos(V.yaw), tz = Math.sin(V.yaw);
      camPos.set(d.x + tx * 2.6 + tz * 0.9, d.y + 0.9, d.z + tz * 2.6 - tx * 0.9);
      camPos.y = Math.max(camPos.y, alt(camPos.x, camPos.z) + 0.4);
      camAlvo.set(d.x, d.y + 0.08, d.z);
      if (inst) { cam.position.copy(camPos); orb.target.copy(camAlvo); return; }
      var k = 1 - Math.exp(-(dt || 0.016) * 4);
      cam.position.lerp(camPos, k); orb.target.lerp(camAlvo, Math.min(1, k * 2.2));
    };

    /* Protecao de voo do app: altitude e distancia maximas contadas do ponto
       de origem. A cada quadro, antes de desenhar (como a cerca virtual). */
    window.xgFlyLimitar = function () {
      var L = window.xgFlyLimites;
      if (!L || !drone || V.estado === "caiu") return;
      var p = drone.position, bateu = false;
      if (L.altMax && p.y > L.y + L.altMax) {
        p.y = L.y + L.altMax; if (V.vy > 0) V.vy = 0;
        if (typeof V.xgAgl === "number") V.xgAgl = Math.max(0, p.y - alt(p.x, p.z));
        bateu = "alt";
      }
      if (L.distMax) {
        var dx = p.x - L.x, dz = p.z - L.z, d = Math.hypot(dx, dz);
        if (d > L.distMax) {
          p.x = L.x + dx / d * L.distMax; p.z = L.z + dz / d * L.distMax;
          var fora = (V.mvx || 0) * dx / d + (V.mvz || 0) * dz / d;
          if (fora > 0) { V.mvx -= fora * dx / d; V.mvz -= fora * dz / d; }
          bateu = "dist";
        }
      }
      if (bateu) { window.__xgFlyLimiteEm = performance.now(); window.__xgFlyLimiteTipo = bateu; }
    };
    /* RTH ou pouso no voo livre terminam em "concluido": o jogo abriria o resumo
       da pulverizacao (mostrarFim), que nao existe aqui e quebrava sem talhao */
    if (typeof mostrarFim === "function") {
      var fimAntes = mostrarFim;
      mostrarFim = function () { if (window.__xgFly) return; return fimAntes.apply(this, arguments); };
    }
    var antesRender = cena.onBeforeRender;
    cena.onBeforeRender = function () {
      try { window.xgFlyLimitar(); } catch (e) { /* drone trocando */ }
      if (antesRender) antesRender.apply(this, arguments);
    };

    /* imagem de um alvo de render. Num alvo o three.js (r147) entrega a cor
       LINEAR e sem tone mapping; a tela usa ACES Filmic + sRGB. A conta abaixo
       e a mesma do shader dele, para a foto sair igual a imagem ao vivo. */
    function paraCanvas(alvo, w, h, comAlfa) {
      var dados = new Float32Array(w * h * 4);
      render.readRenderTargetPixels(alvo, 0, 0, w, h, dados);
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      var ctx = c.getContext("2d"), img = ctx.createImageData(w, h);
      var aces = render.toneMapping === THREE.ACESFilmicToneMapping, expo = (render.toneMappingExposure || 1) / 0.6;
      var srgb = render.outputEncoding === THREE.sRGBEncoding;
      function fit(v) { return (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
      function enc(v) { v = v < 0 ? 0 : v > 1 ? 1 : v; return srgb ? (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) : v; }
      for (var i = 0; i < w * h; i++) {
        var o2 = ((h - 1 - Math.floor(i / w)) * w + i % w) * 4;
        var r = dados[o2], g = dados[o2 + 1], b = dados[o2 + 2];
        if (aces) {
          r *= expo; g *= expo; b *= expo;
          var r1 = fit(0.59719 * r + 0.35458 * g + 0.04823 * b), g1 = fit(0.07600 * r + 0.90834 * g + 0.01566 * b), b1 = fit(0.02840 * r + 0.13383 * g + 0.83777 * b);
          r = 1.60475 * r1 - 0.53108 * g1 - 0.07367 * b1; g = -0.10208 * r1 + 1.10813 * g1 - 0.00605 * b1; b = -0.00327 * r1 - 0.07276 * g1 + 1.07602 * b1;
        }
        img.data[i * 4] = Math.round(enc(r) * 255);
        img.data[i * 4 + 1] = Math.round(enc(g) * 255);
        img.data[i * 4 + 2] = Math.round(enc(b) * 255);
        img.data[i * 4 + 3] = comAlfa ? Math.max(0, Math.min(255, Math.round(dados[o2 + 3] * 255))) : 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }

    /* a foto do sensor: renderiza a camFpv num alvo do tamanho da foto */
    window.xgFlyFoto = function (w, h) {
      var asp = camFpv.aspect;
      atualizarFpv();
      camFpv.aspect = w / h; camFpv.updateProjectionMatrix();
      var alvo = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
      var antes = render.getRenderTarget();
      render.setRenderTarget(alvo);
      render.render(cena, camFpv);
      render.setRenderTarget(antes);
      camFpv.aspect = asp; camFpv.updateProjectionMatrix();
      var c = paraCanvas(alvo, w, h, false);
      alvo.dispose();
      return c;
    };

    /* o ponto do chao (ou do obstaculo) que aparece num ponto da tela */
    window.xgFlyAlvoNaTela = function (nx, ny) {
      atualizarFpv(); camFpv.updateMatrixWorld();
      var o = camFpv.position.clone();
      var dir = new THREE.Vector3(nx, ny, 0.5).unproject(camFpv).sub(o).normalize();
      var perto = typeof colisores !== "undefined" ? colisores.filter(function (c) { return Math.hypot(c.cx - o.x, c.cz - o.z) < 420; }) : [];
      var q = new THREE.Vector3();
      for (var k = 1; k < 400; k += 0.5) {
        q.set(o.x + dir.x * k, o.y + dir.y * k, o.z + dir.z * k);
        var solo = alt(q.x, q.z);
        if (q.y <= solo) return { x: q.x, y: solo + 0.8, z: q.z, d: k };
        for (var i = 0; i < perto.length; i++) {
          var c = perto[i];
          if (Math.abs(c.cx - q.x) > c.raio + 2 || Math.abs(c.cz - q.z) > c.raio + 2) continue;
          if (typeof distColisor === "function" && distColisor(c, q) < 0.3) return { x: q.x, y: q.y, z: q.z, d: k };
        }
      }
      return null;
    };

    /* retrato do drone para a tela inicial (o modelo 3D, fundo transparente) */
    window.xgFlyRetratoDrone = function () {
      if (typeof drone === "undefined" || !drone) return null;
      var W = 760, H = 440, d = drone.position, y = V.yaw;
      var fx = Math.cos(y), fz = -Math.sin(y), rx = Math.sin(y), rz = Math.cos(y);
      var cam2 = new THREE.PerspectiveCamera(24, W / H, 0.01, 30);
      cam2.position.set(d.x + fx * 0.62 + rx * 0.44, d.y + 0.27, d.z + fz * 0.62 + rz * 0.44);
      cam2.lookAt(d.x + fx * 0.02, d.y + 0.05, d.z + fz * 0.02);
      var esc = [];
      cena.children.forEach(function (ob) { if (ob !== drone && !ob.isLight && ob.visible) { ob.visible = false; esc.push(ob); } });
      var fundo = cena.background, nevoa = cena.fog;
      cena.background = null; cena.fog = null;
      var cor = new THREE.Color(); render.getClearColor(cor);
      var alfa = render.getClearAlpha();
      render.setClearColor(0x000000, 0);
      var alvo = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
      var antes = render.getRenderTarget();
      try {
        render.setRenderTarget(alvo);
        render.clear();
        render.render(cena, cam2);
      } finally {
        render.setRenderTarget(antes);
        render.setClearColor(cor, alfa);
        cena.background = fundo; cena.fog = nevoa;
        esc.forEach(function (ob) { ob.visible = true; });
      }
      var c = paraCanvas(alvo, W, H, true);
      alvo.dispose();
      return c.toDataURL("image/png");
    };

    /* um retrato do voo, lido direto do campo */
    window.xgFlyLer = function (radar) {
      if (typeof drone === "undefined" || !drone) return null;
      var d = drone.position, man = V.estado === "manual";
      var vx = man ? (V.mvx || 0) : (V.v || 0) * (V.dirx || 0), vz = man ? (V.mvz || 0) : (V.v || 0) * (V.dirz || 0);
      var op = typeof grupoOperador !== "undefined" ? grupoOperador.position : d;
      var r = { x: d.x, y: d.y, z: d.z, solo: alt(d.x, d.z), yaw: V.yaw, hs: Math.hypot(vx, vz), bat: V.bat,
                est: V.estado, ox: op.x, oy: op.y, oz: op.z, g: window.xgGimbal || 0, desvio: !!P.desvio,
                frente: null, tras: null, alvo: null, limite: window.__xgFlyLimiteEm || 0, limiteTipo: window.__xgFlyLimiteTipo || "",
                agora: performance.now(), batBaixa: false, batCritica: false };
      if (radar && d.y > r.solo + 0.3 && typeof sondar === "function" && V.estado !== "caiu") {
        var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw), a = sondar(fx, fz), b = sondar(-fx, -fz);
        r.frente = a ? a.d : null; r.tras = b ? b.d : null;
      }
      var A = window.xgFlyAlvo;
      if (A && typeof camFpv !== "undefined") {
        var v = new THREE.Vector3(A.x, A.y, A.z).project(camFpv);
        r.alvo = { x: v.x, y: v.y, z: v.z };
      }
      var B = window.xgBateria && window.xgBateria.estado ? window.xgBateria.estado() : null;
      if (B) { r.batBaixa = !!B.baixa; r.batCritica = !!B.critica; }
      return r;
    };
    return true;
  }

  function instalar() {
    if (campoPronto || !ponte) return;
    campoPronto = ponte.rodar("(" + instalarNoCampo.toString() + ")(" +
      JSON.stringify({ autonomia: +(AUTONOMIA_MIN / 0.85).toFixed(3), comoJogar: COMO_JOGAR, lead: LEAD }) + ")") === true;
    if (campoPronto) aplicarModo();
  }

  function janela() { return ponte && ponte.janela; }

  function aplicarModo() {
    var j = janela();
    if (j && !(auto && auto.limites)) j.xgVooLimites = MODOS[modo];
  }

  /* o que o app manda no campo a cada ciclo: desvio, limites, campo de visao */
  function aplicarAjustes() {
    var j = janela();
    if (!j) return;
    var desvio = S.desvio !== "desl" && modo !== "S";
    /* 14/10/2026 (Eduardo: "o drone de imagem nao acompanha terreno, e a pessoa que passa os comandos"):
       sem a estabilizacao de altitude do Agras, a altura fica parada no espaco */
    ponte.rodar("if (typeof P !== 'undefined' && P.estab) { P.estab = false; if (typeof V !== 'undefined') delete V.xgAgl; }" +
                "if (typeof P !== 'undefined' && P.desvio !== " + desvio + ") P.desvio = " + desvio + ";" +
                "if (typeof V !== 'undefined' && V.tan) V.tan = 0;");
    j.xgFlyVfov = VFOV[aspectoAtual()];
    j.xgGimbalMax = S.gimbalCima ? 24 : 0;
    j.xgGimbalFpv = S.gimbalModo === "fpv";
    j.xgFlyLimites = casa ? { x: casa.x, z: casa.z, y: casa.y, altMax: S.altMax, distMax: S.distMax } : null;
    /* modo do manche: o mesmo que o controle virtual le (manual.js) */
    try {
      var jc = cfg.manual && cfg.manual.janelaDoControle && cfg.manual.janelaDoControle();
      if (jc && jc.eval("typeof modoJoystick !== 'undefined' ? modoJoystick : 2") !== S.manche) jc.eval("modoJoystick = " + S.manche);
    } catch (e) { /* controle carregando */ }
  }

  function aspectoAtual() {
    return CAM.modo === "foto" || CAM.modo === "pano" ? S.aspecto : "16:9";
  }

  function ler() {
    try {
      return ponte.ler("window.xgFlyLer ? window.xgFlyLer(" + (S.radar ? "true" : "false") + ") : null");
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ icones */

  var IC = {
    casa: '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/></svg>',
    obst: '<svg viewBox="0 0 24 24"><path d="M12 2.5l8 4.6v9.8l-8 4.6-8-4.6V7.1z"/><path d="M12 7.5l3.6 6.2H8.4z" class="ch"/></svg>',
    obstDesl: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 18L18 6"/><path d="M12 7.5l3.6 6.2H8.4z"/></svg>',
    foco: '<svg viewBox="0 0 24 24"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><circle cx="12" cy="12" r="1.3" class="ch"/></svg>',
    decolar: '<svg viewBox="0 0 24 24"><path d="M12 14V4M8 8l4-4 4 4"/><ellipse cx="12" cy="19" rx="7" ry="2.2"/></svg>',
    pousar: '<svg viewBox="0 0 24 24"><path d="M12 3v10M8 9l4 4 4-4"/><ellipse cx="12" cy="19" rx="7" ry="2.2"/></svg>',
    fechar: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
    tresPontos: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" class="ch"/><circle cx="12" cy="12" r="1.6" class="ch"/><circle cx="19" cy="12" r="1.6" class="ch"/></svg>',
    foto: '<svg viewBox="0 0 24 24"><rect x="3.5" y="6" width="17" height="12" rx="1.5"/></svg>',
    video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 9h18M3 15h18M7 6v3M11 6v3M15 6v3M19 6v3M7 15v3M11 15v3M15 15v3M19 15v3"/></svg>',
    master: '<svg viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="1"/><path d="M3 8l3-4h3l-3 4M9 8l3-4h3l-3 4M15 8l3-4h3"/><path d="M12 11.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" class="ch"/></svg>',
    quick: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.5v6M19.4 8l-5.2 3M19.4 16l-5.2-3M12 20.5v-6M4.6 16l5.2-3M4.6 8l5.2 3"/></svg>',
    hyper: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 2.2M9.5 3h5"/></svg>',
    pano: '<svg viewBox="0 0 24 24"><path d="M3 6.5c6 2 12 2 18 0v11c-6-2-12-2-18 0z"/></svg>',
    galeria: '<svg viewBox="0 0 24 24"><path d="M8 6.5v11l9-5.5z" class="ch"/></svg>',
    auto: '<svg viewBox="0 0 24 24"><path d="M3.5 8h4l1.5-2h6l1.5 2h4v11h-17z"/><text x="12" y="16.3" text-anchor="middle" font-size="6.2" font-weight="700" class="tx">AUTO</text></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" class="ch"/><path d="M12 11v6M12 7.5v.5" class="br"/></svg>',
    borracha: '<svg viewBox="0 0 24 24"><path d="M14 4l6 6-9 9H6l-3-3z" class="ch"/><path d="M8 10l6 6M11 19h9" class="br"/></svg>',
    local: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    norte: '<svg viewBox="0 0 24 24"><path d="M12 6l5 13-5-3-5 3z" class="ch"/><text x="12" y="5.4" text-anchor="middle" font-size="5" font-weight="700" class="tx">N</text></svg>',
    camadas: '<svg viewBox="0 0 24 24"><path d="M12 4l9 5-9 5-9-5z" class="ch"/><path d="M3 13.5l9 5 9-5"/></svg>',
    aviao: '<svg viewBox="0 0 24 24"><path d="M12 2.5c1 0 1.5 1.5 1.5 3V9l7.5 5v2l-7.5-2.3v4.5l2.2 1.8v1.6L12 20.5l-3.7 1.1V20l2.2-1.8v-4.5L3 16v-2l7.5-5V5.5c0-1.5.5-3 1.5-3z" class="ch"/></svg>',
    voltar: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8"/></svg>',
    baixar: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    seta: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
    estrela: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
    lixo: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>',
    sinal: '<svg viewBox="0 0 22 14"><rect x="0" y="10" width="2.6" height="4" class="ch b1"/><rect x="4" y="7" width="2.6" height="7" class="ch b2"/><rect x="8" y="4" width="2.6" height="10" class="ch b3"/><rect x="12" y="1" width="2.6" height="13" class="ch b4"/><text x="18.8" y="13" text-anchor="middle" font-size="5.6" font-weight="700" class="tx">RC</text></svg>',
    visao: '<svg viewBox="0 0 24 24"><path d="M5 6c-2 3.5-2 8.5 0 12M9 8c-1.2 2.5-1.2 5.5 0 8"/><path d="M16 5v14M13.5 7.5L16 5l2.5 2.5M13.5 16.5L16 19l2.5-2.5"/></svg>',
    gps: '<svg viewBox="0 0 24 24"><path d="M5 13l6-6 4 4-6 6z"/><path d="M14 5l5 5M3 21l4-4M15 15c1.5 0 3 1.5 3 3"/></svg>',
    mais: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    lapis: '<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12l3 3 5-6"/></svg>',
    controle: '<svg viewBox="0 0 120 80"><rect x="8" y="14" width="104" height="54" rx="20" fill="#d9dbde" stroke="#9a9ea4"/><circle cx="36" cy="40" r="11" fill="#55595f"/><circle cx="84" cy="40" r="11" fill="#55595f"/><circle cx="36" cy="40" r="4" fill="#2b2e33"/><circle cx="84" cy="40" r="4" fill="#2b2e33"/><rect x="50" y="52" width="20" height="3" rx="1.5" fill="#8b9096"/><rect x="34" y="6" width="52" height="10" rx="3" fill="#c6c9cd"/></svg>',
  };

  /* desenho simples do Air 2S (sem marca) para quando o retrato 3D nao vem */
  var DRONE_SVG = '<svg viewBox="0 0 300 170" class="fly__drone-svg"><g fill="none" stroke-linecap="round">' +
    '<path d="M60 60l60 30M240 60l-60 30M70 128l50-28M230 128l-50-28" stroke="#5c6168" stroke-width="10"/>' +
    '<ellipse cx="60" cy="58" rx="46" ry="5" fill="#2a2d31"/><ellipse cx="240" cy="58" rx="46" ry="5" fill="#2a2d31"/>' +
    '<ellipse cx="70" cy="126" rx="50" ry="6" fill="#2a2d31"/><ellipse cx="230" cy="126" rx="50" ry="6" fill="#2a2d31"/>' +
    '<rect x="112" y="72" width="76" height="46" rx="16" fill="#6c7178"/><rect x="128" y="104" width="44" height="30" rx="8" fill="#43474d"/>' +
    '<circle cx="150" cy="119" r="10" fill="#1b1d20" stroke="#8a8f96" stroke-width="2"/></g></svg>';

  /* ------------------------------------------------------------ a tela */

  var CSS = [
    ".fly{position:absolute;inset:0;z-index:2;pointer-events:auto;overflow:hidden;background:#000;color:#fff;",
    "  font:500 3.4cqh/1.25 Roboto,'Segoe UI',system-ui,sans-serif;container-type:size;user-select:none;-webkit-user-select:none;cursor:default}",
    ".fly *{box-sizing:border-box}",
    ".fly [hidden]{display:none!important}",
    ".fly svg{fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}",
    ".fly svg .ch{fill:currentColor;stroke:none}.fly svg .tx{fill:currentColor;stroke:none;font-family:Roboto,Arial,sans-serif}.fly svg .br{stroke:#111}",
    ".fly [data-acao]{cursor:pointer}",
    /* camera */
    ".fly__cam{position:absolute;inset:0;width:100%;height:100%;display:block;background:#0b0f13}",
    ".fly__quadro{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:min(100cqw,150cqh);box-shadow:0 0 0 200cqw #000;pointer-events:none}",
    ".fly__quadro.q169{width:min(100cqw,177.8cqh)}",
    ".fly__grade{position:absolute;inset:0;width:100%;height:100%}",
    ".fly__grade line{stroke:rgba(255,255,255,.55);stroke-width:1;vector-effect:non-scaling-stroke}",
    ".fly__toque{position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:min(100cqw,150cqh)}",
    ".fly__toque.q169{width:min(100cqw,177.8cqh)}",
    ".fly__toque.mira{cursor:crosshair}",
    ".fly__alvo{position:absolute;width:12cqh;height:14cqh;transform:translate(-50%,-50%);border:.35cqh solid #22e36b;border-radius:.6cqh;pointer-events:none}",
    ".fly__alvo.foco{border-color:#f2c200}",
    ".fly__alvo b{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:4cqh;color:#22e36b;font-weight:400}",
    ".fly__radar{position:absolute;left:50%;transform:translateX(-50%);width:34cqh;height:5cqh;pointer-events:none}",
    ".fly__radar svg{width:100%;height:100%;display:block}.fly__radar path{stroke-width:2.4;fill:none}",
    ".fly__radar b{position:absolute;left:50%;top:-3.6cqh;transform:translateX(-50%);font-size:2.8cqh;font-weight:600;white-space:nowrap;text-shadow:0 0 .6cqh #000}",
    ".fly__gimbal{position:absolute;top:22cqh;height:56cqh;width:0;border-left:.3cqh dotted rgba(255,255,255,.75);pointer-events:none;transition:opacity .4s}",
    ".fly__gimbal i{position:absolute;left:-1cqh;width:2cqh;height:2cqh;margin-top:-1cqh;border-radius:50%;background:#fff}",
    ".fly__gimbal b{position:absolute;right:2.2cqh;transform:translateY(-50%);font-size:2.6cqh;font-weight:500;white-space:nowrap;text-shadow:0 0 .5cqh #000}",
    /* barra de cima */
    ".fly__topo{position:absolute;left:0;right:0;top:0;height:12cqh;display:flex;align-items:center;pointer-events:none}",
    ".fly__topo>*{pointer-events:auto}",
    ".fly__home{position:absolute;left:3.6cqh;top:3.4cqh;width:5cqh;height:5cqh;color:#fff}",
    ".fly__home svg{width:100%;height:100%;stroke-width:2}",
    ".fly__modo{position:absolute;left:16.6cqh;top:3.4cqh;font-size:3.9cqh;font-weight:600;text-shadow:0 0 .6cqh rgba(0,0,0,.6)}",
    ".fly__sep{position:absolute;left:35.4cqh;top:4.2cqh;height:3.6cqh;width:1px;background:rgba(255,255,255,.55)}",
    ".fly__estado{position:absolute;left:39.6cqh;top:2.6cqh;font-size:3.8cqh;font-weight:500;padding:.6cqh 1.4cqh;border-radius:.6cqh;max-width:60cqw;",
    "  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 0 .6cqh rgba(0,0,0,.6)}",
    ".fly__estado.alerta{background:#e8a317;text-shadow:none}.fly__estado.erro{background:#e5243b;text-shadow:none}",
    ".fly__dir{position:absolute;right:14.2cqh;top:2.4cqh;height:7cqh;display:flex;align-items:center;gap:1.8cqh;text-shadow:0 0 .6cqh rgba(0,0,0,.6)}",
    ".fly__bat{position:relative;width:6.6cqh;height:6.6cqh}",
    ".fly__bat svg{width:100%;height:100%;transform:rotate(-90deg)}",
    ".fly__bat circle{stroke-width:3.2;fill:rgba(0,0,0,.25)}",
    ".fly__bat b{position:absolute;inset:0;display:grid;place-items:center;font-size:2.9cqh;font-weight:700}",
    ".fly__tempo{font-size:4.2cqh;font-weight:700;font-variant-numeric:tabular-nums;margin-left:-.6cqh}",
    ".fly__ico{display:flex;align-items:center;gap:.4cqh;font-size:2.9cqh;font-weight:600}",
    ".fly__ico svg{height:4.4cqh;width:auto}",
    ".fly__ico.sinal svg{height:3.2cqh}",
    ".fly__ico.visao{position:relative}.fly__ico.visao.off::after{content:'';position:absolute;left:10%;right:10%;top:50%;height:.45cqh;background:#ff3b4a;transform:rotate(-40deg)}",
    ".fly__ico.visao.off svg{color:#ff3b4a}",
    ".fly__mais{position:absolute;right:6.2cqh;top:3.6cqh;width:6cqh;height:5cqh}",
    ".fly__mais svg{width:100%;height:100%}",
    /* coluna da esquerda */
    ".fly__esq{position:absolute;left:2.6cqh;top:19cqh;display:flex;flex-direction:column;gap:7.4cqh;align-items:center}",
    ".fly__esq .b{width:6.4cqh;height:6.4cqh;display:grid;place-items:center;color:#fff;position:relative}",
    ".fly__esq .b svg{width:5.4cqh;height:5.4cqh;stroke-width:1.8}",
    ".fly__esq .b.verde{color:#2ee66b}.fly__esq .b.amarelo{color:#f5c518}.fly__esq .b.vermelho{color:#ff3b4a}",
    ".fly__esq .b.cancelar{background:#e5243b;border-radius:50%}",
    ".fly__esq .b.cancelar svg{stroke-width:2.4;width:4.2cqh;height:4.2cqh}",
    ".fly__dica{position:absolute;left:8.6cqh;top:50%;transform:translateY(-50%);white-space:nowrap;background:rgba(30,30,30,.85);",
    "  border-radius:.8cqh;padding:1.2cqh 1.8cqh;font-size:3cqh;pointer-events:none}",
    /* coluna da direita */
    ".fly__dirc{position:absolute;right:0;top:0;bottom:0;width:20cqh;pointer-events:none}",
    ".fly__dirc>*{pointer-events:auto;position:absolute}",
    ".fly__modocam{right:6.2cqh;top:29.4cqh;width:6.2cqh;height:6.2cqh;display:grid;place-items:center}",
    ".fly__modocam svg{width:5.6cqh;height:5.6cqh}",
    ".fly__modocam.cor{color:#f5c518}",
    ".fly__disparo{right:3.6cqh;top:44.2cqh;width:11.6cqh;height:11.6cqh;border-radius:50%;background:#ececec;display:grid;place-items:center;",
    "  font-weight:600;font-size:3.4cqh;color:#fff;box-shadow:0 0 0 .3cqh rgba(0,0,0,.15)}",
    ".fly__disparo.video{background:#e5243b}",
    ".fly__disparo.gravando{background:#5b1520;border:.5cqh solid #e5243b}",
    ".fly__disparo.gravando::after{content:'';width:4cqh;height:4cqh;border-radius:.6cqh;background:#e5243b}",
    ".fly__disparo.start{background:#2ee66b;color:#fff}",
    ".fly__disparo.start.off{background:#2ee66b55;color:#fff8}",
    ".fly__disparo.parar{background:#e5243b}",
    ".fly__disparo.parar::after{content:'';width:3.8cqh;height:3.8cqh;border-radius:.5cqh;background:#fff}",
    ".fly__disparo.intervalo::after{content:'';width:3.6cqh;height:3.6cqh;border-radius:.5cqh;background:#e5243b}",
    ".fly__rectempo{right:2.6cqh;top:57.6cqh;width:13.6cqh;text-align:center;font-size:3cqh;font-weight:600;color:#ff4d5e;font-variant-numeric:tabular-nums;pointer-events:none}",
    ".fly__af{right:19.6cqh;top:44.8cqh;width:10.6cqh;height:10.6cqh;border-radius:50%;background:rgba(20,20,20,.75);display:grid;place-items:center;font-size:3.1cqh;font-weight:600}",
    ".fly__zoom{right:20.6cqh;top:32.6cqh;width:8.4cqh;height:8.4cqh;border-radius:50%;background:rgba(20,20,20,.75);display:grid;place-items:center;font-size:2.8cqh;font-weight:600;color:#f5c518}",
    ".fly__play{right:6.6cqh;top:63.4cqh;width:5.6cqh;height:5.6cqh;display:grid;place-items:center}",
    ".fly__play svg{width:100%;height:100%}",
    ".fly__play::before{content:'';position:absolute;inset:.6cqh;border:.35cqh solid #fff;border-radius:.6cqh}",
    ".fly__expo{right:5.8cqh;top:89cqh;width:7cqh;height:6cqh;display:grid;place-items:center}",
    ".fly__expo svg{width:6.4cqh;height:6.4cqh;stroke-width:1.4}",
    /* mini-mapa e pip */
    ".fly__mini{position:absolute;left:3.1cqh;bottom:3.3cqh;width:50.5cqh;height:30cqh;border-radius:1.4cqh;overflow:hidden;background:#cfeccf;box-shadow:0 0 0 1px rgba(0,0,0,.25)}",
    ".fly__mini canvas{position:absolute;inset:0;width:100%;height:100%;display:block}",
    ".fly__mini .n{position:absolute;left:1cqh;top:1cqh;width:4.6cqh;height:4.6cqh;color:#fff;filter:drop-shadow(0 0 .3cqh rgba(0,0,0,.7))}",
    ".fly__mini .n svg{width:100%;height:100%;stroke-width:1}",
    ".fly__mini .min{position:absolute;right:1.2cqh;top:1.6cqh;width:4.4cqh;height:.5cqh;background:#fff;border-radius:99px;box-shadow:0 0 .4cqh rgba(0,0,0,.6)}",
    ".fly__mini .min::before{content:'';position:absolute;left:-1cqh;right:-1cqh;top:-2cqh;bottom:-2cqh}",
    ".fly__mini .rot{position:absolute;right:1cqh;bottom:1cqh;width:4.6cqh;height:4.6cqh;border-radius:50%;background:rgba(255,255,255,.92);color:#333;display:grid;place-items:center}",
    ".fly__mini .rot svg{width:3.4cqh;height:3.4cqh;stroke-width:1.2}",
    ".fly__mini.pip{background:#000}",
    ".fly__mini.pip .n,.fly__mini.pip .rot,.fly__mini.pip .min{display:none}",
    ".fly__minibtn{position:absolute;left:3.1cqh;bottom:3.3cqh;width:9cqh;height:9cqh;border-radius:1.4cqh;background:rgba(20,20,20,.75);display:grid;place-items:center}",
    ".fly__minibtn svg{width:5.6cqh;height:5.6cqh}",
    /* telemetria e informacao da camera */
    ".fly__tele{position:absolute;left:59cqh;bottom:2.2cqh;display:grid;gap:.4cqh;font-variant-numeric:tabular-nums;text-shadow:0 0 .6cqh rgba(0,0,0,.75);pointer-events:none}",
    ".fly__tele div{display:flex;align-items:baseline;gap:1.2cqh;white-space:nowrap}",
    ".fly__tele svg{width:3.6cqh;height:3.6cqh;align-self:center;stroke-width:1.6}",
    ".fly__tele b{font-size:4.2cqh;font-weight:700;min-width:11cqh}",
    ".fly__tele span{font-size:2.8cqh;font-weight:600}",
    ".fly__info{position:absolute;right:17.4cqh;bottom:2.4cqh;display:flex;gap:2.6cqh;text-shadow:0 0 .6cqh rgba(0,0,0,.75)}",
    ".fly__info div{display:grid;gap:.2cqh}",
    ".fly__info small{font-size:2.8cqh;font-weight:500;color:#fff}",
    ".fly__info b{font-size:3.8cqh;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}",
    ".fly__info b.cor{color:#f5c518}",
    /* avisos */
    ".fly__toast{position:absolute;left:13cqh;top:11.8cqh;max-width:72cqh;background:rgba(28,28,28,.88);border-radius:1cqh;padding:1.4cqh 2.2cqh 1.4cqh 3cqh;",
    "  font-size:3.2cqh;line-height:1.3;transition:opacity .3s;pointer-events:none}",
    ".fly__toast::before{content:'';position:absolute;left:0;top:0;bottom:0;width:1.1cqh;border-radius:1cqh 0 0 1cqh;background:#2ee66b}",
    ".fly__toast.alerta::before{background:#f59e0b}.fly__toast.erro::before{background:#e5243b}",
    ".fly__grande{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);background:rgba(25,25,25,.85);border-radius:1cqh;padding:2.6cqh 4cqh;",
    "  text-align:center;min-width:28cqh;max-width:46cqh;transition:opacity .3s;pointer-events:none}",
    ".fly__grande b{display:block;font:500 6cqh/1 Roboto,Arial,sans-serif;margin-bottom:2cqh}",
    ".fly__grande span{font-size:3cqh}",
    ".fly__flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .25s}",
    /* paineis escuros */
    ".fly__painel{position:absolute;background:rgba(32,32,32,.94);border-radius:1.4cqh;box-shadow:0 1cqh 4cqh rgba(0,0,0,.5)}",
    ".fly__fundo{position:absolute;inset:0;background:transparent}",
    ".fly__fundo.escuro{background:rgba(0,0,0,.35)}",
    /* decolar / aterrissar */
    ".fly__dec{left:50%;top:50%;transform:translate(-50%,-50%);width:91cqh;padding:7cqh 5cqh 5cqh;display:grid;justify-items:center;gap:2.6cqh}",
    ".fly__circ{position:relative;width:29cqh;height:29cqh;border-radius:50%;background:#4a4a4a;box-shadow:0 0 0 1.4cqh #262626;display:grid;place-items:center;touch-action:none}",
    ".fly__circ svg.ic{width:7cqh;height:7cqh;stroke-width:1.6}",
    ".fly__circ svg.anel{position:absolute;inset:-1.4cqh;width:calc(100% + 2.8cqh);height:calc(100% + 2.8cqh);transform:rotate(-90deg)}",
    ".fly__circ svg.anel circle{stroke:#2ee66b;stroke-width:2.6;fill:none;stroke-linecap:butt}",
    ".fly__dec b{font-size:3.6cqh;font-weight:600}",
    ".fly__dec span{font-size:2.8cqh;color:#bbb}",
    ".fly__linha{width:100%;background:#3c3c3c;border-radius:.8cqh;padding:2.6cqh 3cqh;display:flex;justify-content:center;align-items:center;gap:1cqh;font-size:3.6cqh;font-weight:600}",
    ".fly__linha svg{width:3.4cqh;height:3.4cqh}",
    /* menu rapido de obstaculos */
    ".fly__obs{right:9cqh;top:12cqh;width:44cqh;padding:1.6cqh 1.6cqh 2cqh;display:grid;gap:1.2cqh;text-align:center}",
    ".fly__obs b{font-size:3.4cqh}.fly__obs small{font-size:2.6cqh;color:#aaa}",
    ".fly__obs hr{border:0;border-top:1px solid #444;width:100%;margin:.6cqh 0}",
    ".fly__obs .rotulo{font-size:2.4cqh;color:#bbb;text-align:left}",
    /* segmentos e chaves */
    ".fly__seg{display:flex;background:#3a3a3a;border-radius:.6cqh;overflow:hidden}",
    ".fly__seg div{flex:1;text-align:center;padding:1.3cqh 1.4cqh;font-size:3cqh;color:#ddd;white-space:nowrap}",
    ".fly__seg div.sel{background:#f2f2f2;color:#111}",
    ".fly__seg div.off{opacity:.35;pointer-events:none}",
    ".fly__chave{width:8.4cqh;height:4.6cqh;border-radius:99px;background:#5a5a5a;position:relative;flex:none}",
    ".fly__chave::after{content:'';position:absolute;left:.5cqh;top:.5cqh;width:3.6cqh;height:3.6cqh;border-radius:50%;background:#fff;transition:left .2s}",
    ".fly__chave.lig{background:#1e88ff}.fly__chave.lig::after{left:4.3cqh}",
    ".fly__barra{position:relative;flex:1;height:5cqh;touch-action:none;cursor:pointer}",
    ".fly__barra::before{content:'';position:absolute;left:0;right:0;top:50%;height:.4cqh;margin-top:-.2cqh;background:#777;border-radius:99px}",
    ".fly__barra i{position:absolute;top:50%;width:3.6cqh;height:3.6cqh;margin:-1.8cqh 0 0 -1.8cqh;border-radius:50%;background:#fff}",
    ".fly__barra u{position:absolute;left:0;top:50%;height:.4cqh;margin-top:-.2cqh;background:#fff;border-radius:99px}",
    /* configuracoes (...) */
    ".fly__cfg{position:absolute;left:24cqh;right:0;top:0;bottom:0;background:rgba(30,30,30,.95);display:flex;flex-direction:column}",
    ".fly__abas{display:flex;justify-content:space-around;height:12cqh;align-items:center;border-bottom:1px solid #3a3a3a;flex:none;padding:0 6cqh}",
    ".fly__abas div{font-size:3.7cqh;color:#ccc;padding:2cqh 1cqh;position:relative}",
    ".fly__abas div.sel{color:#fff;font-weight:600}",
    ".fly__abas div.sel::after{content:'';position:absolute;left:0;right:0;bottom:.4cqh;height:.6cqh;border-radius:99px;background:#fff}",
    ".fly__lista{flex:1;overflow:auto;padding:0 0 4cqh;scrollbar-width:thin;scrollbar-color:#666 transparent}",
    ".fly__lista::-webkit-scrollbar{width:.8cqh}.fly__lista::-webkit-scrollbar-thumb{background:#666;border-radius:99px}",
    ".fly__grupo{font-size:3cqh;color:#aaa;padding:3.4cqh 4cqh 1.4cqh;background:rgba(0,0,0,.18)}",
    ".fly__item{display:flex;align-items:center;gap:3cqh;padding:2.4cqh 4cqh;border-bottom:1px solid #353535;min-height:10cqh}",
    ".fly__item>b{font-size:3.3cqh;font-weight:600;flex:none;max-width:52cqh}",
    ".fly__item .valor{font-size:3.2cqh;white-space:nowrap;min-width:12cqh;text-align:right}",
    ".fly__item .fly__seg{margin-left:auto;min-width:48cqh}",
    ".fly__item .fly__chave{margin-left:auto}",
    ".fly__item .ir{margin-left:auto;width:4cqh;height:4cqh}",
    ".fly__item .azul{margin-left:auto;color:#3b9bff;font-size:3.2cqh}",
    ".fly__desc{font-size:2.6cqh;color:#aaa;padding:0 4cqh 2.4cqh;margin-top:-1.6cqh;border-bottom:1px solid #353535}",
    ".fly__ilus{display:flex;align-items:center;justify-content:center;gap:4cqh;padding:3cqh 4cqh;color:#2ee66b}",
    ".fly__ilus svg{height:12cqh;width:auto}",
    ".fly__arm{display:flex;gap:0;margin:0 4cqh 2cqh;border-radius:.8cqh;overflow:hidden}",
    ".fly__arm div{flex:1;padding:1.8cqh 2.4cqh;background:#3a3a3a;font-size:3cqh}",
    ".fly__arm div small{display:block;font-size:2.5cqh;color:#aaa}",
    ".fly__arm div.sel{background:#f2f2f2;color:#111}.fly__arm div.sel small{color:#555}",
    /* lista de status (toque no estado) */
    ".fly__status{left:24cqh;right:9cqh;top:2.6cqh;max-height:90cqh;overflow:auto;padding:0}",
    ".fly__status .fly__item:first-child b{font-size:3.5cqh}",
    ".fly__verde{margin-left:auto;color:#2ee66b;font-size:3.4cqh}",
    /* menu dos modos de foto */
    ".fly__modos{right:17.6cqh;top:15.6cqh;height:64cqh;width:37cqh;display:flex;overflow:hidden}",
    ".fly__modos .sub{width:50%;background:rgba(0,0,0,.25);overflow:auto;padding:1cqh 0;scrollbar-width:none}",
    ".fly__modos .pri{width:50%;overflow:auto;padding:1cqh 0;scrollbar-width:none}",
    ".fly__modos .op{display:grid;justify-items:center;gap:.6cqh;padding:1.6cqh .6cqh;font-size:2.6cqh;color:#ddd;text-align:center}",
    ".fly__modos .op svg{width:5.4cqh;height:5.4cqh;stroke-width:1.5}",
    ".fly__modos .op.sel{color:#f5c518}",
    ".fly__modos .op small{font-size:2.3cqh;color:#aaa}.fly__modos .op.sel small{color:#f5c518}",
    /* cartao de explicacao do modo inteligente */
    ".fly__exp{right:57cqh;top:8cqh;width:54cqh;padding:0;overflow:hidden}",
    ".fly__exp .img{height:34cqh;background:radial-gradient(circle at 40% 35%,#3b4f63,#151b22 75%);display:grid;place-items:center;color:#cfe3f2}",
    ".fly__exp .img svg{width:16cqh;height:16cqh;stroke-width:1}",
    ".fly__exp p{margin:0;padding:2cqh 2.4cqh;font-size:2.8cqh;line-height:1.35;text-align:center}",
    ".fly__dicaalvo{position:absolute;left:50%;bottom:23cqh;transform:translateX(-50%);background:rgba(25,25,25,.85);border-radius:.8cqh;padding:1.2cqh 2.2cqh;font-size:2.9cqh;white-space:nowrap}",
    /* parametros (RES/FPS, Hyperlapse, exposicao) */
    ".fly__params{right:17.4cqh;bottom:14cqh;padding:1cqh 0;min-width:56cqh}",
    ".fly__params .lin{display:flex;align-items:center;gap:2cqh;padding:1.4cqh 2.6cqh;font-size:3cqh}",
    ".fly__params .lin>span{width:10cqh;color:#ddd}",
    ".fly__params .lin div{flex:1;text-align:center;color:#bbb}",
    ".fly__params .lin div.sel{color:#f5c518;font-weight:600}",
    ".fly__params .lin div.off{opacity:.3;pointer-events:none}",
    ".fly__hl{left:50%;bottom:4cqh;transform:translateX(-50%);display:flex;padding:1.2cqh 1cqh}",
    ".fly__hl div{display:grid;justify-items:center;padding:0 3cqh;gap:.3cqh}",
    ".fly__hl b{font-size:3.6cqh}.fly__hl small{font-size:2.6cqh;color:#bbb}",
    ".fly__traj{left:50%;bottom:4cqh;transform:translateX(-50%);display:flex;gap:1cqh;padding:1.2cqh}",
    ".fly__traj div{width:12cqh;height:9cqh;border-radius:.6cqh;background:#3a3a3a;display:grid;place-items:center;font-size:2.6cqh;color:#ccc}",
    ".fly__traj div.mais{background:#2a2a2a;border:1px solid #666}",
    ".fly__traj div.mais svg{width:4.4cqh;height:4.4cqh}",
    ".fly__traj div.ok{background:#2f6b45;color:#fff}",
    ".fly__progresso{position:absolute;left:50%;top:13cqh;transform:translateX(-50%);background:rgba(25,25,25,.85);border-radius:99px;padding:1cqh 2.6cqh;font-size:3cqh;white-space:nowrap}",
    ".fly__expop{right:17.4cqh;bottom:4cqh;width:58cqh;padding:2cqh 2.6cqh;display:grid;gap:2cqh}",
    ".fly__expop .fly__seg{width:30cqh}",
    ".fly__expop .lin{display:flex;align-items:center;gap:2cqh;font-size:3cqh}",
    ".fly__expop .lin b{width:12cqh;text-align:right;color:#f5c518;font-variant-numeric:tabular-nums}",
    /* mapa em tela cheia */
    ".fly__mapa{position:absolute;inset:0;background:#cfeccf}",
    ".fly__mapa canvas{position:absolute;inset:0;width:100%;height:100%;display:block}",
    ".fly__fer{position:absolute;right:4.6cqh;top:13cqh;display:grid;gap:2.2cqh}",
    ".fly__fer div{width:6.4cqh;height:6.4cqh;border-radius:.8cqh;background:rgba(255,255,255,.95);color:#222;display:grid;place-items:center;box-shadow:0 .2cqh .8cqh rgba(0,0,0,.3)}",
    ".fly__fer div.sel{background:#2f86f6;color:#fff}",
    ".fly__fer svg{width:4.6cqh;height:4.6cqh;stroke-width:1.6}",
    ".fly__camadas{right:13cqh;top:46cqh;width:14cqh;padding:1.2cqh 0;background:#fff;color:#222;display:grid;gap:1cqh;justify-items:center}",
    ".fly__camadas div{display:grid;justify-items:center;gap:.4cqh;font-size:2.4cqh}",
    ".fly__camadas i{width:9cqh;height:7cqh;border-radius:.6cqh;display:block;border:.4cqh solid transparent}",
    ".fly__camadas div.sel i{border-color:#2f86f6}",
    ".fly__legenda{right:13cqh;top:13cqh;width:44cqh;padding:2cqh 2.6cqh;background:#fff;color:#222;display:grid;gap:1.4cqh;font-size:2.8cqh}",
    ".fly__legenda div{display:flex;align-items:center;gap:1.6cqh}",
    ".fly__legenda i{width:3.6cqh;height:3.6cqh;border-radius:50%;flex:none;display:grid;place-items:center;font-style:normal;font-weight:700;font-size:2.4cqh}",
    /* telas cheias: inicio, guia, galeria */
    ".fly__tela{position:absolute;inset:0;background:#232527;color:#fff}",
    ".fly__card{position:absolute;background:#2e3033;border-radius:1.6cqh;padding:3.2cqh 3.6cqh}",
    ".fly__card h3{margin:0 0 1.6cqh;font-size:4.2cqh;font-weight:700}",
    ".fly__card p{margin:0;font-size:3cqh;color:#cfd2d6;line-height:1.35}",
    ".fly__card .ok{margin-top:4cqh;display:flex;align-items:center;gap:1.6cqh;font-size:3.2cqh}",
    ".fly__card .ok i{width:3.6cqh;height:3.6cqh;border-radius:50%;background:#2ee66b;display:block}",
    ".fly__card .ok i.nao{background:#777}",
    ".fly__tile{position:absolute;background:#2e3033;border-radius:1.6cqh;display:grid;place-content:center;justify-items:center;gap:2cqh;font-size:3.4cqh;font-weight:600}",
    ".fly__tile i{width:8cqh;height:8cqh;border-radius:50%;background:#45484c;display:grid;place-items:center}",
    ".fly__tile svg{width:4.8cqh;height:4.8cqh}",
    ".fly__nome{position:absolute;right:9cqh;top:5cqh;font:300 5.4cqh/1 Roboto,Arial,sans-serif;letter-spacing:.06em;display:flex;align-items:center;gap:1cqh}",
    ".fly__nome i{position:absolute;right:0;top:-2.2cqh;width:1.6cqh;height:1.6cqh;border-radius:50%;background:#2ee66b}",
    ".fly__retrato{position:absolute;left:70cqh;right:0;top:16cqh;height:58cqh;display:grid;place-items:center}",
    ".fly__retrato img,.fly__retrato svg{max-width:100%;max-height:100%;filter:drop-shadow(0 2cqh 3cqh rgba(0,0,0,.6))}",
    ".fly__retrato.apagado{opacity:.35;filter:grayscale(1)}",
    ".fly__mini-icones{position:absolute;right:9cqh;top:75cqh;display:flex;gap:1.4cqh;color:#aaa;font-size:2.4cqh;align-items:center}",
    ".fly__mini-icones svg{width:3.4cqh;height:3.4cqh}",
    ".fly__voar{position:absolute;right:8cqh;bottom:6cqh;width:63cqh;height:10.4cqh;border-radius:1cqh;display:grid;place-items:center;font-size:3.6cqh;font-weight:700;letter-spacing:.04em}",
    ".fly__voar.azul{background:#2f86f6;color:#fff}.fly__voar.branco{background:#fff;color:#111;letter-spacing:0}",
    ".fly__voar.cinza{background:#3a3c3f;color:#aaa;letter-spacing:0}",
    ".fly__guia{background:#fff;color:#222}",
    ".fly__guia .cab{height:12cqh;display:flex;align-items:center;justify-content:center;position:relative;font-size:3.4cqh}",
    ".fly__guia .cab .v{position:absolute;left:3cqh;top:3cqh;width:6cqh;height:6cqh}",
    ".fly__guia .cab .v svg{width:100%;height:100%;stroke-width:2}",
    ".fly__guia .cab .pg{margin-left:1.4cqh;background:#eceef0;border-radius:.6cqh;padding:.4cqh 1.2cqh;font-size:2.8cqh;display:flex;align-items:center;gap:.4cqh}",
    ".fly__guia .cab .pg svg{width:2.6cqh;height:2.6cqh;stroke-width:2.4}",
    ".fly__guia .cab .cam{position:absolute;right:3.6cqh;top:3.8cqh;font-size:3cqh;font-weight:600;display:flex;align-items:center;gap:.6cqh}",
    ".fly__guia .cab .cam svg{width:3cqh;height:3cqh;stroke-width:2.2}",
    ".fly__guia .corpo{display:flex;align-items:center;gap:8cqh;padding:6cqh 8cqh}",
    ".fly__guia .corpo svg.ilus{width:44cqh;height:auto;flex:none}",
    ".fly__guia ol{margin:0;padding-left:4cqh;font-size:3.2cqh;line-height:1.4;display:grid;gap:2.4cqh}",
    ".fly__guia .prox{position:absolute;right:6cqh;bottom:6cqh;background:#2f86f6;color:#fff;border-radius:.8cqh;padding:2cqh 6cqh;font-size:3.2cqh;font-weight:600}",
    ".fly__gal .cab{height:12cqh;display:flex;align-items:center;justify-content:center;gap:1.6cqh;position:relative;font-size:3.4cqh;font-weight:600;border-bottom:1px solid #333}",
    ".fly__gal .cab .v{position:absolute;left:3cqh;top:3cqh;width:6cqh;height:6cqh}",
    ".fly__gal .cab .v svg{width:100%;height:100%;stroke-width:2}",
    ".fly__gal .cab svg.l{width:3.2cqh;height:3.2cqh}",
    ".fly__gal .cab .sel2{position:absolute;right:4cqh;top:3.6cqh;width:5cqh;height:5cqh}",
    ".fly__gal .cab .sel2 svg{width:100%;height:100%}",
    ".fly__gal .abas{display:flex;justify-content:center;gap:0;margin:2cqh auto;background:#2b2d30;border-radius:.6cqh;width:max-content}",
    ".fly__gal .abas div{padding:1.2cqh 2.6cqh;font-size:3cqh;color:#aaa}",
    ".fly__gal .abas div.sel{color:#fff;background:#3b3e42;border-radius:.6cqh}",
    ".fly__gal .grade{position:absolute;left:0;right:0;top:25cqh;bottom:0;overflow:auto;padding:0 4cqh 4cqh;display:grid;grid-template-columns:repeat(auto-fill,minmax(30cqh,1fr));gap:1.2cqh;align-content:start}",
    ".fly__gal .grade div{position:relative;aspect-ratio:3/2;background:#111 center/cover;border-radius:.4cqh}",
    ".fly__gal .grade div span{position:absolute;right:1cqh;bottom:.8cqh;font-size:2.4cqh;text-shadow:0 0 .4cqh #000}",
    ".fly__gal .grade div em{position:absolute;left:1cqh;top:.8cqh;font-size:2.2cqh;font-style:normal;background:rgba(0,0,0,.55);border-radius:.4cqh;padding:.2cqh .8cqh}",
    ".fly__gal .grade div i{position:absolute;right:1cqh;top:.8cqh;width:3cqh;height:3cqh;color:#f5c518}",
    ".fly__gal .vazio{position:absolute;left:0;right:0;top:45cqh;text-align:center;color:#888;font-size:3.2cqh}",
    ".fly__ver{position:absolute;inset:0;background:#000;display:grid;place-items:center}",
    ".fly__ver img,.fly__ver video{max-width:100%;max-height:100%}",
    ".fly__ver .barra{position:absolute;left:0;right:0;top:0;height:11cqh;display:flex;align-items:center;gap:3cqh;padding:0 3cqh;background:linear-gradient(#000c,#0000)}",
    ".fly__ver .barra div{width:6cqh;height:6cqh}.fly__ver .barra svg{width:100%;height:100%;stroke-width:1.8}",
    ".fly__ver .barra span{flex:1;font-size:3cqh;color:#ddd}",
    ".fly__ver .barra .fav.sel{color:#f5c518}.fly__ver .barra .fav.sel svg{fill:#f5c518}",
    /* tela do celular seguindo a ligacao do controle (como o RC Plus): apagada e abrindo */
    ".fly__apagada{position:absolute;inset:0;background:#000}",
    ".fly__abrindo{position:absolute;inset:0;background:#000;display:grid;place-content:center;justify-items:center;gap:5cqh}",
    ".fly__abrindo b{font:300 8cqh/1 Roboto,Arial,sans-serif;letter-spacing:.08em;color:#fff}",
    ".fly__abrindo i{width:6cqh;height:6cqh;border-radius:50%;border:.5cqh solid #ffffff33;border-top-color:#fff;animation:flyGira 1s linear infinite}",
    "@keyframes flyGira{to{transform:rotate(360deg)}}",
  ].join("\n");

  function h(tag, cls, html) {
    var d = el ? el.doc.createElement(tag) : document.createElement(tag);
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    return d;
  }

  function montarTela() {
    if (el || !cfg.quadro) return;
    var d = cfg.quadro.ownerDocument;
    if (!d.getElementById("xg-fly-css")) {
      var s = d.createElement("style");
      s.id = "xg-fly-css";
      s.textContent = CSS;
      d.head.appendChild(s);
    }
    var velho = d.getElementById("xg-fly");
    if (velho) velho.remove();
    var t = d.createElement("div");
    t.className = "fly";
    t.id = "xg-fly";
    t.innerHTML =
      /* camera */
      '<div class="fly__vista">' +
      '  <canvas class="fly__cam"></canvas>' +
      '  <div class="fly__quadro"><svg class="fly__grade" viewBox="0 0 300 300" preserveAspectRatio="none">' +
      '    <line x1="100" y1="0" x2="100" y2="300"/><line x1="200" y1="0" x2="200" y2="300"/>' +
      '    <line x1="0" y1="100" x2="300" y2="100"/><line x1="0" y1="200" x2="300" y2="200"/></svg>' +
      '    <div class="fly__radar r-frente" style="top:66cqh" hidden><svg viewBox="0 0 100 14"><path d="M4 12Q50 -2 96 12"/></svg><b></b></div>' +
      '    <div class="fly__radar r-tras" style="top:91cqh" hidden><svg viewBox="0 0 100 14"><path d="M4 2Q50 16 96 2"/></svg><b></b></div>' +
      '    <div class="fly__gimbal" style="opacity:0;right:6cqh"><i></i><b>0°</b></div>' +
      '  </div>' +
      '  <div class="fly__toque" data-toque="1"></div>' +
      '  <div class="fly__alvo" hidden><b>+</b></div>' +
      '</div>' +
      '<div class="fly__mapa" hidden><canvas></canvas></div>' +
      /* barra de cima */
      '<div class="fly__topo">' +
      '  <div class="fly__home" data-acao="inicio">' + IC.casa + '</div>' +
      '  <div class="fly__modo">Modo N</div><div class="fly__sep"></div>' +
      '  <div class="fly__estado" data-acao="status">Decolagem permitida</div>' +
      '  <div class="fly__dir">' +
      '    <div class="fly__bat"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" stroke="#444"/>' +
      '      <circle class="arco" cx="18" cy="18" r="15.5" stroke="#2ee66b" stroke-dasharray="97.4 97.4" stroke-dashoffset="0"/>' +
      '      <circle class="rth" cx="18" cy="18" r="15.5" stroke="#ff3b4a" stroke-dasharray="3 94.4" stroke-dashoffset="-24"/></svg><b>--</b></div>' +
      '    <div class="fly__tempo">00\'00"</div>' +
      '    <div class="fly__ico sinal">' + IC.sinal + '</div>' +
      '    <div class="fly__ico visao" data-acao="obsMenu">' + IC.visao + '</div>' +
      '    <div class="fly__ico gps">' + IC.gps + '<span class="fly__sat">0</span></div>' +
      '  </div>' +
      '  <div class="fly__mais" data-acao="config">' + IC.tresPontos + '</div>' +
      '</div>' +
      /* coluna da esquerda */
      '<div class="fly__esq">' +
      '  <div class="b b-obs" data-acao="obsMenu">' + IC.obst + '</div>' +
      '  <div class="b b-foco" data-acao="focusTrack">' + IC.foco + '</div>' +
      '  <div class="b b-dec" data-acao="decolarMenu">' + IC.decolar + '</div>' +
      '</div>' +
      /* coluna da direita */
      '<div class="fly__dirc">' +
      '  <div class="fly__modocam" data-acao="modosMenu">' + IC.foto + '</div>' +
      '  <div class="fly__zoom" data-acao="zoom" hidden>1×</div>' +
      '  <div class="fly__af" data-acao="foco">MF</div>' +
      '  <div class="fly__disparo" data-acao="disparo"></div>' +
      '  <div class="fly__rectempo" hidden>00:00</div>' +
      '  <div class="fly__play" data-acao="galeria">' + IC.galeria + '</div>' +
      '  <div class="fly__expo" data-acao="expoMenu">' + IC.auto + '</div>' +
      '</div>' +
      /* mini-mapa / pip da camera */
      '<div class="fly__mini" data-acao="trocarMapa"><canvas></canvas>' +
      '  <div class="n">' + IC.norte + '</div><div class="min" data-acao="minimizarMapa"></div>' +
      '  <div class="rot" data-acao="girarMapa">' + IC.aviao + '</div></div>' +
      '<div class="fly__minibtn" data-acao="minimizarMapa" hidden>' + IC.local + '</div>' +
      /* telemetria e camera */
      '<div class="fly__tele">' +
      '  <div><svg viewBox="0 0 24 24"><path d="M5 4h14M5 20h14M12 7v10M9 9l3-3 3 3M9 15l3 3 3-3"/></svg><b class="t-h">--m</b><span class="t-vs">--m/s</span></div>' +
      '  <div><svg viewBox="0 0 24 24"><path d="M4 5v14M20 5v14M7 12h10M10 9l-3 3 3 3M14 9l3 3-3 3"/></svg><b class="t-d">--m</b><span class="t-hs">--m/s</span></div>' +
      '</div>' +
      '<div class="fly__info" data-acao="resMenu">' +
      '  <div><small>Armazenar</small><b class="i-arm">298</b></div>' +
      '  <div><small class="i-fmt-t">Formato</small><b class="i-fmt">JPEG</b></div>' +
      '  <div><small>EV</small><b class="i-ev">0.0</b></div>' +
      '</div>' +
      '<div class="fly__radares"></div>' +
      '<div class="fly__toast" style="opacity:0"></div>' +
      '<div class="fly__grande" style="opacity:0"><b>N</b><span>Modo normal</span></div>' +
      '<div class="fly__progresso" hidden></div>' +
      '<div class="fly__dicaalvo" hidden>Toque em "+" ou arraste um quadrado ao redor do alvo.</div>' +
      '<div class="fly__flash"></div>' +
      /* paineis que se abrem por cima (um de cada vez) */
      '<div class="fly__camada"></div>' +
      /* telas cheias */
      '<div class="fly__tela fly__inicio" hidden></div>' +
      '<div class="fly__tela fly__guia" hidden></div>' +
      '<div class="fly__tela fly__gal" hidden></div>' +
      '<div class="fly__abrindo" hidden><b>AIR 2S</b><i></i></div>' +
      '<div class="fly__apagada"></div>';
    cfg.quadro.appendChild(t);
    var q = function (s) { return t.querySelector(s); };
    el = {
      doc: d, raiz: t, vista: q(".fly__vista"), cam: q(".fly__cam"), quadro: q(".fly__quadro"), grade: q(".fly__grade"),
      toque: q(".fly__toque"), alvo: q(".fly__alvo"), rFrente: q(".r-frente"), rTras: q(".r-tras"), gimbal: q(".fly__gimbal"),
      mapaCheio: q(".fly__mapa"), mapaCanvas: q(".fly__mapa canvas"),
      topo: q(".fly__topo"), modo: q(".fly__modo"), estado: q(".fly__estado"), batArco: q(".fly__bat .arco"), batTxt: q(".fly__bat b"),
      tempo: q(".fly__tempo"), sinal: q(".fly__ico.sinal"), visao: q(".fly__ico.visao"), sat: q(".fly__sat"),
      esq: q(".fly__esq"), bObs: q(".b-obs"), bFoco: q(".b-foco"), bDec: q(".b-dec"),
      dirc: q(".fly__dirc"), modoCam: q(".fly__modocam"), zoom: q(".fly__zoom"), af: q(".fly__af"), disparo: q(".fly__disparo"),
      recTempo: q(".fly__rectempo"), play: q(".fly__play"), expo: q(".fly__expo"),
      mini: q(".fly__mini"), miniCanvas: q(".fly__mini canvas"), miniN: q(".fly__mini .n"), miniBtn: q(".fly__minibtn"),
      tele: q(".fly__tele"), th: q(".t-h"), tvs: q(".t-vs"), td: q(".t-d"), ths: q(".t-hs"),
      info: q(".fly__info"), iArm: q(".i-arm"), iFmt: q(".i-fmt"), iFmtT: q(".i-fmt-t"), iEv: q(".i-ev"),
      toast: q(".fly__toast"), grande: q(".fly__grande"), progresso: q(".fly__progresso"), dicaAlvo: q(".fly__dicaalvo"),
      flash: q(".fly__flash"), camada: q(".fly__camada"),
      inicio: q(".fly__inicio"), guia: q(".fly__guia"), gal: q(".fly__gal"),
      abrindo: q(".fly__abrindo"), apagada: q(".fly__apagada"),
    };
    t.addEventListener("click", aoClicar);
    t.addEventListener("pointerdown", aoApertar);
    t.addEventListener("wheel", function (e) {
      if (tela !== "camera") return;
      e.preventDefault();
      if (mapaGrande && !e.target.closest(".fly__mini")) { zoomMapa *= e.deltaY > 0 ? 1.15 : 1 / 1.15; zoomMapa = Math.max(40, Math.min(900, zoomMapa)); return; }
      mudarGimbal(e.deltaY > 0 ? -3 : 3);
    }, { passive: false });
    desenharInicio();
    mostrarTela(tela);
    atualizarCamera();
  }

  /* ------------------------------------------------------------ cliques */

  var painel = null;                // nome do painel aberto
  var zoomMapa = 300, centroMapa = "drone", mostrarCamadas = false, mostrarLegenda = false;
  var abaCfg = "seg", filtroGal = "tudo", vendo = null, passoGuia = 1;

  function aoClicar(e) {
    var b = e.target.closest("[data-acao]");
    if (!b || !el.raiz.contains(b)) {
      if (e.target.closest("[data-toque]")) tocarNaCamera(e);
      return;
    }
    e.stopPropagation();
    acao(b.getAttribute("data-acao"), b, e);
  }

  /* segurar (decolar/aterrissar) e arrastar as barras */
  function aoApertar(e) {
    var c = e.target.closest(".fly__circ");
    if (c) { segurarCirculo(c, e); return; }
    var bar = e.target.closest(".fly__barra");
    if (bar) { arrastarBarra(bar, e); }
  }

  function acao(a, b, e) {
    var v = b.getAttribute("data-v");
    switch (a) {
      /* telas */
      case "inicio": fecharPainel(); pararEscolhaAlvo(); mostrarTela("inicio"); return;
      case "guri": if (window.APP_GURI) window.APP_GURI.abrir(v, apiGuri); return;
      case "voar": if (conectado()) mostrarTela("camera"); else { passoGuia = 1; mostrarTela("guia"); } return;
      case "guia": passoGuia = 1; mostrarTela("guia"); return;
      case "guiaVoltar": if (passoGuia > 1) { passoGuia--; desenharGuia(); } else mostrarTela("inicio"); return;
      case "guiaProx": if (passoGuia < 3) { passoGuia++; desenharGuia(); } else mostrarTela("camera"); return;
      case "guiaCamera": mostrarTela("camera"); return;
      case "galeria": fecharPainel(); vendo = null; mostrarTela("galeria"); return;
      case "galVoltar": if (vendo !== null) { vendo = null; desenharGaleria(); } else mostrarTela(voltarDaGaleria || "camera"); return;
      case "galFiltro": filtroGal = v; desenharGaleria(); return;
      case "galVer": vendo = +v; desenharGaleria(); return;
      case "galFav": if (midia[vendo]) { midia[vendo].fav = !midia[vendo].fav; desenharGaleria(); } return;
      case "galBaixar": if (midia[vendo]) baixarMidia(midia[vendo]); return;
      case "galBaixarTudo": baixarTudo(); return;
      case "galApagar": if (midia[vendo]) { liberar(midia[vendo]); midia.splice(vendo, 1); vendo = null; desenharGaleria(); } return;

      /* camera */
      case "status": abrirPainel(painel === "status" ? null : "status"); return;
      case "config": abrirPainel(painel === "config" ? null : "config"); return;
      case "obsMenu": abrirPainel(painel === "obs" ? null : "obs"); return;
      case "decolarMenu":
        if (auto && (auto.nome === "pousar" || auto.nome === "decolar")) { cancelarAuto("Pouso cancelado"); return; }
        if (rthAtivo()) { cancelarRth(); return; }
        if (!conectado()) { aviso("Aeronave desconectada", "erro"); return; }
        abrirPainel(painel === "dec" ? null : "dec"); return;
      case "focusTrack":
        if (focusTrack || escolhendoAlvo) { pararEscolhaAlvo(); return; }
        if (!noAr(lido)) { aviso("Decole antes de usar o FocusTrack", "alerta"); return; }
        abrirPainel("focoDica"); return;
      case "focoOk": fecharPainel(); escolhendoAlvo = "foco"; atualizarCamera(); return;
      case "modosMenu": abrirPainel(painel === "modos" ? null : "modos"); return;
      case "modoCam": escolherModoCam(v); return;
      case "subModo": escolherSubModo(v); return;
      case "foco": S.foco = S.foco === "MF" ? "AF" : "MF"; salvarS(); atualizarCamera(); return;
      case "zoom": return;
      case "disparo": disparar(); return;
      case "expoMenu": abrirPainel(painel === "expo" ? null : "expo"); return;
      case "ev": S.ev = EVS[Math.max(0, Math.min(EVS.length - 1, EVS.indexOf(S.ev) + (+v)))]; salvarS(); atualizarCamera(); desenharPainel(); return;
      case "resMenu": if (CAM.modo === "video" || CAM.modo === "hyperlapse") abrirPainel(painel === "res" ? null : "res"); return;
      case "res": S.res = v; if (S.res === "4K" && CAM.video === "lento") CAM.video = "normal"; salvarS(); atualizarCamera(); desenharPainel(); return;
      case "fps": S.fps = +v; salvarS(); atualizarCamera(); desenharPainel(); return;
      case "hlParam": mudarParamHl(v); return;
      case "trajMais": adicionarPontoTraj(); return;
      case "trajLimpar": CAM.hlPontos = []; desenharPainel(); return;
      case "fechar": fecharPainel(); return;

      /* decolar / aterrissar / origem */
      case "atualizarOrigem": abrirPainel("origem"); return;
      case "origemAeronave": atualizarOrigem("aeronave"); return;
      case "origemControle": atualizarOrigem("controle"); return;

      /* desvio de obstaculos */
      case "desvio":
        if (v === "desl" && S.desvio !== "desl") { abrirPainel("deslConfirma"); return; }
        S.desvio = v; salvarS(); desenharPainel(); atualizarCamera(); return;
      case "desligarDesvio": S.desvio = "desl"; salvarS(); abrirPainel(painelAntes || null); atualizarCamera(); return;
      case "cancelarDesl": abrirPainel(painelAntes || null); return;

      /* configuracoes */
      case "aba": abaCfg = v; desenharPainel(); return;
      case "op": definirOpcao(b.getAttribute("data-k"), v); return;
      case "chave": var k = b.getAttribute("data-k"); S[k] = !S[k]; salvarS(); desenharPainel(); atualizarCamera(); return;
      case "formatar": abrirPainel("formatar"); return;
      case "formatarSim":
        midia.forEach(liberar); midia = []; fotosTiradas = 0; videoGasto = 0;
        abrirPainel("config"); aviso("Armazenamento formatado"); atualizarCamera(); return;

      /* mapa */
      case "trocarMapa": if (mapaMin) return; mapaGrande = !mapaGrande; fecharPainel(); atualizarCamera(); return;
      case "minimizarMapa": if (e) e.stopPropagation(); mapaMin = !mapaMin; if (mapaMin) mapaGrande = false; atualizarCamera(); return;
      case "girarMapa": if (e) e.stopPropagation(); S.norte = !S.norte; salvarS(); return;
      case "mapaInfo": mostrarLegenda = !mostrarLegenda; mostrarCamadas = false; desenharFerramentas(); return;
      case "mapaApagar": trilha = []; aviso("Rota de voo apagada"); return;
      case "mapaPiloto": centroMapa = centroMapa === "piloto" ? "drone" : "piloto"; desenharFerramentas(); return;
      case "mapaNorte": S.norte = !S.norte; salvarS(); desenharFerramentas(); return;
      case "mapaCamadas": mostrarCamadas = !mostrarCamadas; mostrarLegenda = false; desenharFerramentas(); return;
      case "camada": S.camada = v; salvarS(); mostrarCamadas = false; desenharFerramentas(); return;
      case "mapaDrone": centroMapa = "drone"; desenharFerramentas(); return;
    }
  }

  /* ------------------------------------------------------------ telas */

  var voltarDaGaleria = "camera";

  function mostrarTela(qual) {
    if (qual === "galeria") voltarDaGaleria = tela === "galeria" ? voltarDaGaleria : tela;
    tela = qual;
    if (!el) return;
    el.inicio.hidden = qual !== "inicio";
    el.guia.hidden = qual !== "guia";
    el.gal.hidden = qual !== "galeria";
    if (qual === "inicio") desenharInicio();
    if (qual === "guia") desenharGuia();
    if (qual === "galeria") desenharGaleria();
    if (qual === "camera") atualizarCamera();
  }

  function conectado() { return cfg.fase === "pronto" && usb.aceito && !trocandoBateria; }
  function controleLigado() { return cfg.fase && cfg.fase !== "desligado"; }

  function desenharInicio() {
    if (!el) return;
    var c = conectado();
    var linhas = [
      ["Controle remoto", controleLigado() && usb.aceito],
      ["Aeronave", c],
      ["Sinal de GPS", c],
    ];
    el.inicio.innerHTML =
      '<div class="fly__card" style="left:6cqh;top:5cqh;width:70cqh;height:40cqh"><h3>Antes de voar</h3>' +
      '  <p>Confira a área, as hélices e a bateria. Bateria fraca? Pouse, pare os motores e troque (tecla B).</p>' +
      linhas.map(function (l) { return '<div class="ok"><i class="' + (l[1] ? "" : "nao") + '"></i>' + l[0] + (l[1] ? "" : " — aguardando") + "</div>"; }).join("").replace(/<div class="ok">/g, '<div class="ok" style="margin-top:1.6cqh">') +
      '</div>' +
      '<div class="fly__tile" style="left:6cqh;top:48cqh;width:34cqh;height:26cqh" data-acao="galeria"><i>' + IC.foto.replace("<svg", '<svg style="stroke-width:1.6"') + '</i>Galeria</div>' +
      '<div class="fly__tile" style="left:42cqh;top:48cqh;width:34cqh;height:26cqh" data-acao="guia"><i>' + IC.seta + '</i>Guia de conexão</div>' +
      /* 21/11/2026 (Eduardo: "la no controle do air 2s vc coloca os dois apps dguri e xguri ai a pessoa treina mapeamento"):
         os dois apps de mapeamento dele abrem daqui; as telas ficam no app_guri.js */
      '<div class="fly__tile" style="left:6cqh;top:77cqh;width:34cqh;height:19cqh;gap:1.2cqh" data-acao="guri" data-v="dguri"><i style="width:8cqh;height:8cqh;border-radius:2cqh;background:#15803D;color:#fff;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:4.6cqh">D</i>DGuri Portátil</div>' +
      '<div class="fly__tile" style="left:42cqh;top:77cqh;width:34cqh;height:19cqh;gap:1.2cqh" data-acao="guri" data-v="xguri"><i style="width:8cqh;height:8cqh;border-radius:2cqh;background:#E31B23;color:#fff;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:4.6cqh">X</i>XGuri Portátil</div>' +
      '<div class="fly__nome">AIR 2S' + (c ? "<i></i>" : "") + '</div>' +
      '<div class="fly__retrato' + (c ? "" : " apagado") + '">' + (retrato ? '<img alt="" src="' + retrato + '">' : DRONE_SVG) + '</div>' +
      (c ? '<div class="fly__mini-icones">' + IC.gps + IC.sinal + '<span>' + Math.round(lido ? lido.bat : 100) + '%</span></div>' : "") +
      (c ? '<div class="fly__voar azul" data-acao="voar">VOAR</div>' :
           '<div class="fly__voar branco" data-acao="voar">Guia de conexão</div>');
  }

  function desenharGuia() {
    if (!el) return;
    var passos = {
      1: { t: "Ligando o controle remoto", ilus: IC.controle,
           l: ["Retire e instale os pinos de controle.",
               "Pressione o botão Liga/Desliga do controle remoto, então pressione e segure-o novamente para ligar o controle remoto.",
               "Conecte o celular ao controle remoto usando o cabo do controle."] },
      2: { t: "Ligando a aeronave", ilus: DRONE_SVG.replace('class="fly__drone-svg"', 'class="ilus"'),
           l: ["Retire a proteção do estabilizador e abra os braços da aeronave (os da frente primeiro).",
               "Pressione o botão da bateria uma vez e, em seguida, pressione e segure para ligar a aeronave.",
               "Coloque a aeronave num lugar plano e aberto, longe de pessoas e obstáculos."] },
      3: { t: "Conectando", ilus: IC.controle,
           l: ["Com o controle e a aeronave ligados, aguarde a conexão.",
               conectado() ? "Aeronave conectada. Toque em Concluir para abrir a câmera." : "Aguardando a aeronave..."] },
    }[passoGuia];
    el.guia.innerHTML =
      '<div class="cab"><div class="v" data-acao="guiaVoltar">' + IC.voltar + '</div>' + passos.t +
      '  <span class="pg">' + passoGuia + '/3 ' + IC.seta + '</span>' +
      '  <div class="cam" data-acao="guiaCamera">Exibição da câmera ' + IC.seta + '</div></div>' +
      '<div class="corpo">' + passos.ilus.replace("<svg", '<svg class="ilus"') + '<ol>' + passos.l.map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ol></div>' +
      '<div class="prox" data-acao="guiaProx">' + (passoGuia < 3 ? "Próximo" : "Concluir") + '</div>';
  }

  function desenharGaleria() {
    if (!el) return;
    if (vendo !== null && midia[vendo]) {
      var m = midia[vendo];
      el.gal.innerHTML =
        '<div class="fly__ver">' + (m.tipo === "video" ? '<video src="' + m.url + '" controls autoplay loop playsinline></video>' : '<img alt="" src="' + m.url + '">') +
        '  <div class="barra"><div data-acao="galVoltar">' + IC.voltar + '</div><span>' + m.nome + ' · ' + m.quando + (m.dur ? " · " + mmss(m.dur) : "") + '</span>' +
        '    <div data-acao="galBaixar" title="Baixar no computador">' + IC.baixar + '</div>' +
        '    <div class="fav' + (m.fav ? " sel" : "") + '" data-acao="galFav">' + IC.estrela + '</div><div data-acao="galApagar">' + IC.lixo + '</div></div></div>';
      return;
    }
    var lista = midia.map(function (m, i) { return { m: m, i: i }; }).filter(function (o) {
      return filtroGal === "tudo" || (filtroGal === "fotos" && o.m.tipo !== "video") || (filtroGal === "videos" && o.m.tipo === "video") || (filtroGal === "fav" && o.m.fav);
    }).reverse();
    el.gal.innerHTML =
      '<div class="cab"><div class="v" data-acao="galVoltar">' + IC.voltar + '</div>' + IC.lapis.replace("<svg", '<svg class="l"') + ' Air 2S <span style="font-weight:400;color:#aaa">Salvo</span>' +
      (midia.length ? '  <div class="sel2" data-acao="galBaixarTudo" title="Baixar tudo no computador">' + IC.baixar + '</div>' : "") + '</div>' +
      '<div class="abas">' + [["tudo", "Tudo"], ["fotos", "Fotos"], ["videos", "Vídeos"], ["fav", "Favoritos"]].map(function (a) {
        return '<div data-acao="galFiltro" data-v="' + a[0] + '" class="' + (filtroGal === a[0] ? "sel" : "") + '">' + a[1] + "</div>";
      }).join("") + '</div>' +
      (lista.length ? '<div class="grade">' + lista.map(function (o) {
        return '<div data-acao="galVer" data-v="' + o.i + '" style="background-image:url(' + o.m.mini + ')">' +
          (o.m.tipo === "pano" ? "<em>PANO</em>" : o.m.etiqueta ? "<em>" + o.m.etiqueta + "</em>" : "") +
          (o.m.fav ? "<i>" + IC.estrela.replace("<svg", '<svg style="fill:#f5c518"') + "</i>" : "") +
          (o.m.tipo === "video" ? "<span>" + mmss(o.m.dur || 0) + "</span>" : "") + "</div>";
      }).join("") + '</div>' : '<div class="vazio">Nenhum arquivo. As fotos e os vídeos do treino aparecem aqui.</div>');
  }

  /* Baixar no computador (14/10/2026, Eduardo: "pra acessar as fotos e videos gravados tem como?"):
     as fotos saem em JPG e os videos em WebM, com o nome do cartao (AIR2S_0001...). Ficam so na
     memoria da pagina: recarregar o simulador apaga a galeria. */
  function nomeArquivo(m) {
    var n = ("000" + (midia.indexOf(m) + 1)).slice(-4);
    return "AIR2S_" + n + (m.tipo === "video" ? ".webm" : m.tipo === "pano" ? "_PANO.jpg" : ".jpg");
  }
  function baixarMidia(m) {
    if (!m || !m.url) { aviso("Arquivo ainda sendo gravado", "alerta"); return; }
    var a = el.doc.createElement("a");
    a.href = m.url; a.download = nomeArquivo(m);
    el.doc.body.appendChild(a); a.click(); a.remove();
  }
  function baixarTudo() {
    var lista = midia.filter(function (m) { return m.url; }), k = 0;
    if (!lista.length) return;
    aviso("Baixando " + lista.length + " arquivo(s)");
    (function um() { if (k >= lista.length) return; baixarMidia(lista[k++]); setTimeout(um, 350); })();
  }

  /* fases do controle (vinculo.faseDoAparelho). Como no controle de pulverizacao (14/10/2026,
     Eduardo: "essa mensagem nao precisa aparecer e pra ligar o controle e igual o de pulverizacao"):
     desligado ou so com as luzes (um toque) a tela fica apagada; segurando o botao de ligar, o app
     abre (logo/carregando) e conecta sozinho, sem o pedido do Android. */
  /* Troca de bateria (14/10/2026, Eduardo: "pra trocar a bateria tem como?"): no Air 2S quem troca e
     o proprio piloto, com a aeronave pousada e os motores parados. Ela fica desligada uns segundos
     (o app perde a aeronave) e volta com a bateria cheia. */
  var trocandoBateria = 0;
  function trocarBateria() {
    if (trocandoBateria) return;
    if (!lido) return;
    if (noAr(lido)) { aviso("Pouse e pare os motores para trocar a bateria", "alerta"); return; }
    trocandoBateria = performance.now();
    aviso("Trocando a bateria: aeronave desligada", "alerta", 6000);
    setTimeout(function () {
      ponte.rodar("V.bat = 100; V.avisoBat = false; if (window.xgBateria && xgBateria.rever) xgBateria.rever();");
      trocandoBateria = 0;
      avisoBat = 0;
      aviso("Bateria trocada: 100%");
      if (tela === "inicio") desenharInicio();
    }, 6000);
  }

  function seguirConexao() {
    var f = cfg.fase || "desligado";
    if (f === usb.fase) return;
    usb.fase = f;
    usb.aceito = f !== "desligado" && f !== "armado";
    if (el) {
      el.apagada.hidden = usb.aceito;
      el.abrindo.hidden = f !== "logo";
    }
    if (tela === "inicio") desenharInicio();
    if (tela === "guia") desenharGuia();
  }

  /* ------------------------------------------------------------ paineis */

  var painelAntes = null;

  function abrirPainel(nome) {
    if (painel && nome && painel !== nome && ["deslConfirma", "origem", "formatar"].indexOf(nome) >= 0) painelAntes = painel;
    else if (!nome || ["deslConfirma", "origem", "formatar"].indexOf(nome) < 0) painelAntes = null;
    painel = nome;
    desenharPainel();
  }
  function fecharPainel() { painel = null; painelAntes = null; if (el) el.camada.innerHTML = ""; }

  function seg(acaoNome, k, valor, opcoes, extra) {
    return '<div class="fly__seg">' + opcoes.map(function (o) {
      return '<div data-acao="' + acaoNome + '"' + (k ? ' data-k="' + k + '"' : "") + ' data-v="' + o[0] + '" class="' +
        (String(valor) === String(o[0]) ? "sel" : "") + (extra && extra(o[0]) ? " off" : "") + '">' + o[1] + "</div>";
    }).join("") + "</div>";
  }
  function chave(k) { return '<div class="fly__chave' + (S[k] ? " lig" : "") + '" data-acao="chave" data-k="' + k + '"></div>'; }
  function barra(k, min, max, texto) {
    var f = (S[k] - min) / (max - min);
    return '<span class="valor">' + texto + '</span><div class="fly__barra" data-k="' + k + '" data-min="' + min + '" data-max="' + max + '">' +
      '<u style="width:' + (f * 100) + '%"></u><i style="left:' + (f * 100) + '%"></i></div>';
  }
  function item(rotulo, direita, desc) {
    return '<div class="fly__item"><b>' + rotulo + '</b>' + direita + '</div>' + (desc ? '<div class="fly__desc">' + desc + "</div>" : "");
  }
  function textoDist() { return S.distMax ? S.distMax + " m" : "Sem limites"; }

  var DESC_DESVIO = {
    desviar: "Quando habilitado e ao controlar a aeronave através dos pinos de controle, a aeronave desvia de obstáculos detectados ou paira automaticamente.",
    frear: "Quando habilitado e ao controlar a aeronave através dos pinos de controle, a aeronave paira automaticamente quando obstáculos são detectados.",
    desl: "O desvio de obstáculos está desligado. A aeronave não vai parar diante de obstáculos.",
  };

  function desenharPainel() {
    if (!el) return;
    var c = el.camada, n = painel;
    if (!n) { c.innerHTML = ""; return; }
    var html = "";
    if (n === "dec") {
      var voando = noAr(lido);
      html = '<div class="fly__fundo escuro" data-acao="fechar"></div><div class="fly__painel fly__dec">' +
        '<div class="fly__circ" data-quer="' + (voando ? "pousar" : "decolar") + '">' + (voando ? IC.pousar : IC.decolar).replace("<svg", '<svg class="ic"') +
        '<svg class="anel" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16.5" stroke-dasharray="0 104"/></svg></div>' +
        '<b>' + (voando ? "Aterrissar" : "Decolar") + '</b><span>Pressione e segure para ' + (voando ? "aterrissar" : "decolar") + '</span>' +
        (voando ? '<div class="fly__linha" data-acao="atualizarOrigem">Atualize o Ponto de origem ' + IC.seta + '</div>' : "") + '</div>';
    } else if (n === "origem") {
      html = '<div class="fly__fundo escuro" data-acao="fechar"></div><div class="fly__painel fly__dec" style="gap:2cqh;padding:5cqh">' +
        '<b>Atualizar Ponto de origem</b><span>O RTH volta para o novo ponto de origem.</span>' +
        '<div class="fly__linha" data-acao="origemAeronave">Posição atual da aeronave</div>' +
        '<div class="fly__linha" data-acao="origemControle">Posição do controle remoto</div></div>';
    } else if (n === "obs") {
      var esp = modo === "S";
      html = '<div class="fly__fundo" data-acao="fechar"></div><div class="fly__painel fly__obs">' +
        '<b>' + (esp ? "Indisponível" : S.desvio === "desl" ? "Desligado" : "Normal") + '</b><small>Sistema de detecção</small><hr>' +
        '<div class="rotulo">Evitação manual de obstáculos</div>' +
        seg("desvio", "", S.desvio, [["desviar", "Desviar"], ["frear", "Frear"], ["desl", "Desl."]], function () { return esp; }) +
        (esp ? '<small>No Modo Esportivo o desvio de obstáculos fica indisponível.</small>' : "") + '</div>';
    } else if (n === "deslConfirma") {
      html = '<div class="fly__fundo escuro"></div><div class="fly__painel" style="left:50%;top:50%;transform:translate(-50%,-50%);width:66cqh;padding:4cqh 4cqh 1cqh;text-align:center">' +
        '<p style="margin:0 0 3cqh;font-size:3cqh;line-height:1.4">Quando o desvio de obstáculos estiver desativado, a aeronave não conseguirá desviar de obstáculos, aumentando o risco de colisão. ' +
        'Durante o RTH, o FocusTrack, os QuickShots e outros recursos inteligentes, o desvio de obstáculos será ativado automaticamente.</p>' +
        '<div class="fly__linha" style="background:none;border-top:1px solid #444;border-radius:0" data-acao="desligarDesvio">DESABILITAR (NÃO RECOMENDADO)</div>' +
        '<div class="fly__linha" style="background:none;border-top:1px solid #444;border-radius:0" data-acao="cancelarDesl">CANCELAR</div></div>';
    } else if (n === "focoDica") {
      html = '<div class="fly__fundo escuro" data-acao="focoOk"></div><div class="fly__painel" style="left:50%;top:50%;transform:translate(-50%,-50%);width:72cqh;padding:3cqh;text-align:center">' +
        '<div style="display:flex;gap:2cqh;justify-content:center;margin-bottom:2.6cqh">' +
        '<div style="width:31cqh;height:20cqh;border-radius:.8cqh;background:linear-gradient(#5d6b77,#2e3a43);display:grid;place-items:center"><div style="width:7cqh;height:9cqh;border:.35cqh solid #2ee66b"></div></div>' +
        '<div style="width:31cqh;height:20cqh;border-radius:.8cqh;background:linear-gradient(#5d6b77,#2e3a43);display:grid;place-items:center;color:#2ee66b;font-size:5cqh">+</div></div>' +
        '<p style="margin:0 0 2cqh;font-size:3cqh">Toque em "+" ou faça um quadro ao redor do alvo</p>' +
        '<div class="fly__linha" style="background:none;border-top:1px solid #444;border-radius:0" data-acao="focoOk">OK</div></div>';
    } else if (n === "status") {
      html = '<div class="fly__fundo" data-acao="fechar"></div><div class="fly__painel fly__status">' +
        item("Status do voo", '<span class="fly__verde">' + (lido && lido.batBaixa ? "Bateria baixa" : "Normal") + "</span>") +
        item("Altitude de Retorno à Base", barra("rthAlt", 20, 500, S.rthAlt + " m")) +
        '<div class="fly__grupo">Proteção de voo</div>' +
        item("Altitude máx.", barra("altMax", 20, 500, S.altMax + " m")) +
        item("Distância máx.", barra("distMax", 0, 8000, textoDist())) +
        '<div class="fly__grupo" style="display:flex">Armazenamento<span class="azul" style="margin-left:auto;color:#3b9bff" data-acao="formatar">Formato</span></div>' +
        armazenamento() + '</div>';
    } else if (n === "config") {
      html = '<div class="fly__fundo" data-acao="fechar"></div><div class="fly__cfg">' +
        '<div class="fly__abas">' + [["seg", "Segurança"], ["ctl", "Controle"], ["cam", "Câmera"]].map(function (a) {
          return '<div data-acao="aba" data-v="' + a[0] + '" class="' + (abaCfg === a[0] ? "sel" : "") + '">' + a[1] + "</div>";
        }).join("") + '</div><div class="fly__lista">' + conteudoCfg() + "</div></div>";
    } else if (n === "formatar") {
      html = '<div class="fly__fundo escuro"></div><div class="fly__painel" style="left:50%;top:50%;transform:translate(-50%,-50%);width:62cqh;padding:4cqh 4cqh 1cqh;text-align:center">' +
        '<p style="margin:0 0 3cqh;font-size:3.2cqh">Formatar o armazenamento interno? Todas as fotos e vídeos do treino serão apagados.</p>' +
        '<div class="fly__linha" style="background:none;border-top:1px solid #444;border-radius:0;color:#ff5a6a" data-acao="formatarSim">FORMATAR</div>' +
        '<div class="fly__linha" style="background:none;border-top:1px solid #444;border-radius:0" data-acao="config">CANCELAR</div></div>';
    } else if (n === "modos") {
      var atual = MODOS_CAM.filter(function (m) { return m.id === CAM.modo; })[0];
      html = '<div class="fly__fundo" data-acao="fechar"></div>' + cartaoExplicacao() +
        '<div class="fly__painel fly__modos"><div class="sub">' + (atual.sub || []).map(function (s) {
          return '<div class="op' + (subAtual() === s[0] ? " sel" : "") + '" data-acao="subModo" data-v="' + s[0] + '">' + iconeSub(atual.id, s[0]) + s[1] +
            (atual.id === "foto" && subAtual() === s[0] ? "<small>" + rotuloParamFoto() + "</small>" : "") + "</div>";
        }).join("") + '</div><div class="pri">' + MODOS_CAM.map(function (m) {
          return '<div class="op' + (CAM.modo === m.id ? " sel" : "") + '" data-acao="modoCam" data-v="' + m.id + '">' + iconeModo(m.id) + m.nome + "</div>";
        }).join("") + "</div></div>";
    } else if (n === "res") {
      var lento = CAM.modo === "video" && CAM.video === "lento";
      html = '<div class="fly__fundo" data-acao="fechar"></div><div class="fly__painel fly__params">' +
        '<div class="lin"><span>RES</span>' + ["1080p", "2.7K", "4K"].map(function (r) {
          return '<div data-acao="res" data-v="' + r + '" class="' + (S.res === r ? "sel" : "") + (lento && r !== "1080p" ? " off" : "") + '">' + r + "</div>";
        }).join("") + '</div><div class="lin"><span>FPS</span>' + (lento ? '<div class="sel">120fps</div>' : [25, 30, 48, 60].map(function (f) {
          return '<div data-acao="fps" data-v="' + f + '" class="' + (S.fps === f ? "sel" : "") + '">' + f + "fps</div>";
        }).join("")) + "</div></div>";
    } else if (n === "expo") {
      html = '<div class="fly__fundo" data-acao="fechar"></div><div class="fly__painel fly__expop">' +
        '<div class="fly__seg"><div class="sel">Auto</div><div class="off">Pro</div></div>' +
        '<div class="lin">EV<div class="fly__linha" style="width:7cqh;padding:1cqh" data-acao="ev" data-v="-1">−</div>' +
        '<div style="flex:1;height:.4cqh;background:#777;position:relative"><i style="position:absolute;top:-1.4cqh;width:3.2cqh;height:3.2cqh;margin-left:-1.6cqh;border-radius:50%;background:#f5c518;left:' +
        ((S.ev + 3) / 6 * 100) + '%"></i></div><div class="fly__linha" style="width:7cqh;padding:1cqh" data-acao="ev" data-v="1">+</div><b>' + fmtEv(S.ev) + "</b></div></div>";
    }
    c.innerHTML = html;
  }

  function armazenamento() {
    var livre = Math.max(0, 2.3 - fotosTiradas * 0.0078 - videoGasto * 0.0116);
    return '<div class="fly__arm"><div>Cartão SD<small>Nenhum cartão SD</small></div><div class="sel">Armazenamento interno<small>' +
      fmt(livre, 1).replace(".", ",") + ' GB/7,2 GB disponível</small></div></div>';
  }

  function conteudoCfg() {
    if (abaCfg === "seg") {
      var esp = modo === "S";
      return '<div class="fly__grupo">Assistência de voo</div>' +
        '<div class="fly__ilus">' + IC.obst.replace("<svg", '<svg style="height:9cqh"') +
        '<svg viewBox="0 0 120 40" style="color:#2ee66b"><path d="M2 20h18" stroke="#ddd"/><path d="M28 20c14 0 18 14 32 14s18-14 32-14h14" stroke-width="2.4"/><path d="M100 14l8 6-8 6" stroke-width="2.4"/>' +
        '<path d="M52 4l6 12h-4l5 10h-14l5-10h-4z" fill="#777" stroke="#777"/></svg></div>' +
        item("Evitação manual de obstáculos", seg("desvio", "", S.desvio, [["desviar", "Desviar"], ["frear", "Frear"], ["desl", "Desl."]], function () { return esp; }),
             esp ? "No Modo Esportivo o desvio de obstáculos fica indisponível." : DESC_DESVIO[S.desvio]) +
        item("Exibir mapa do radar", chave("radar"), "As distâncias aos obstáculos aparecem na visão da câmera.") +
        '<div class="fly__grupo">Retorno à Base (RTH)</div>' +
        item("Altitude de RTH automático", barra("rthAlt", 20, 500, S.rthAlt + " m"), "Antes de Retornar à Base (RTH), a aeronave se elevará a uma altitude predefinida.") +
        '<div class="fly__item" data-acao="atualizarOrigem"><b>Atualizar Ponto de origem</b><span class="ir">' + IC.seta + "</span></div>" +
        '<div class="fly__grupo">Proteção de voo</div>' +
        item("Altitude máx.", barra("altMax", 20, 500, S.altMax + " m")) +
        item("Distância máx.", barra("distMax", 0, 8000, textoDist())) +
        '<div class="fly__grupo">Configurações avançadas de segurança</div>' +
        item("Perda de sinal", seg("op", "perda", S.perda, [["rth", "RTH"], ["descer", "Descer"], ["pairar", "Pairar"]]),
             "O que a aeronave faz quando perde o sinal do controle remoto por mais de 6 segundos.");
    }
    if (abaCfg === "ctl") {
      return '<div class="fly__grupo">Estabilizador</div>' +
        item("Modo do estabilizador", seg("op", "gimbalModo", S.gimbalModo, [["rastreio", "Modo Rastreio"], ["fpv", "Modo FPV"]]),
             S.gimbalModo === "fpv" ? "O estabilizador acompanha a rolagem da aeronave (o horizonte inclina)." : "O estabilizador segue os movimentos da aeronave e mantém o horizonte nivelado.") +
        item("Permitir rotação do estabilizador superior", chave("gimbalCima"), "A câmera pode subir até 24° acima do horizonte.") +
        '<div class="fly__grupo">Controle remoto</div>' +
        '<div class="fly__ilus" style="justify-content:flex-start;color:#ddd">' + IC.controle.replace("<svg", '<svg style="height:14cqh"') +
        '<div style="display:grid;gap:2cqh;flex:1">' +
        '<div style="display:flex;align-items:center;gap:2cqh;font-size:3cqh">Pressione a tecla Fn<span style="margin-left:auto"></span>' +
        seg("op", "fn", S.fn, [["gimbal", "RECENTRALIZE/MOVA O ESTABILIZADOR PARA BAIXO"], ["fotoVideo", "ALTERNAR FOTO/VÍDEO"]]) + "</div></div></div>" +
        item("Modo do manche", seg("op", "manche", S.manche, [[1, "Modo 1"], [2, "Modo 2"], [3, "Modo 3"]]),
             { 1: "Esquerdo: frente/trás e girar. Direito: subir/descer e lados.", 2: "Esquerdo: subir/descer e girar. Direito: frente/trás e lados.",
               3: "Esquerdo: frente/trás e lados. Direito: subir/descer e girar." }[S.manche]);
    }
    return item("Formato", seg("op", "formato", S.formato, [["JPEG", "JPEG"], ["RAW", "RAW"], ["JPEG+RAW", "JPEG + RAW"]])) +
      item("Taxa de aspecto", seg("op", "aspecto", S.aspecto, [["3:2", "3:2"], ["16:9", "16:9"]])) +
      '<div class="fly__grupo">Geral</div>' +
      item("Linhas de grade", chave("grade")) +
      '<div class="fly__grupo" style="display:flex">Armazenamento<span style="margin-left:auto;color:#3b9bff" data-acao="formatar">Formato</span></div>' +
      armazenamento();
  }

  function definirOpcao(k, v) {
    if (k === "manche") v = +v;
    S[k] = v;
    salvarS();
    desenharPainel();
    atualizarCamera();
  }

  /* barras (RTH, altitude e distancia maximas) */
  function arrastarBarra(bar, e) {
    e.preventDefault();
    var k = bar.getAttribute("data-k"), min = +bar.getAttribute("data-min"), max = +bar.getAttribute("data-max");
    function mover(ev) {
      var r = bar.getBoundingClientRect(), f = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      var v = min + f * (max - min);
      if (k === "distMax") v = f < 0.02 ? 0 : Math.max(15, Math.round(v / 10) * 10);
      else v = Math.round(v);
      if (S[k] === v) return;
      S[k] = v;
      bar.querySelector("i").style.left = ((v - min) / (max - min) * 100) + "%";
      bar.querySelector("u").style.width = ((v - min) / (max - min) * 100) + "%";
      var txt = bar.previousElementSibling;
      if (txt) txt.textContent = k === "distMax" ? textoDist() : v + " m";
    }
    mover(e);
    var w = bar.ownerDocument.defaultView;
    function soltar() { w.removeEventListener("pointermove", mover); w.removeEventListener("pointerup", soltar); salvarS(); }
    w.addEventListener("pointermove", mover);
    w.addEventListener("pointerup", soltar);
  }

  /* "Pressione e segure": 1 s com o dedo no circulo */
  function segurarCirculo(c, e) {
    e.preventDefault();
    var quer = c.getAttribute("data-quer"), anel = c.querySelector(".anel circle"), t0 = performance.now(), quadro = null, w = c.ownerDocument.defaultView;
    function parar() {
      if (quadro) w.cancelAnimationFrame(quadro);
      quadro = null; anel.setAttribute("stroke-dasharray", "0 104");
      w.removeEventListener("pointerup", parar);
    }
    w.addEventListener("pointerup", parar);
    (function passo() {
      var f = Math.min(1, (performance.now() - t0) / 1000);
      anel.setAttribute("stroke-dasharray", (f * 103.7) + " 104");
      if (f >= 1) { parar(); fecharPainel(); if (quer === "pousar") pousar(); else decolar(); return; }
      quadro = w.requestAnimationFrame(passo);
    })();
  }

  /* ------------------------------------------------------------ modos da camera */

  function subAtual() {
    return { foto: CAM.foto, video: CAM.video, quickshots: CAM.qs, hyperlapse: CAM.hl, pano: CAM.pano, mastershots: "" }[CAM.modo];
  }
  function rotuloParamFoto() {
    if (CAM.foto === "aeb") return CAM.aeb + " fotos";
    if (CAM.foto === "rajada") return CAM.rajada + " fotos";
    if (CAM.foto === "intervalo") return CAM.intervalo + " s";
    return "";
  }
  function iconeModo(id) {
    return { foto: IC.foto.replace('<rect', '<path d="M8.5 6l1.5-2h4l1.5 2"/><circle cx="12" cy="12" r="3"/><rect'), video: IC.video,
             mastershots: IC.master, quickshots: IC.quick, hyperlapse: IC.hyper, pano: IC.pano }[id];
  }
  function iconeSub(modoId, s) {
    if (modoId === "pano") return { esfera: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.5" ry="8.5"/><path d="M3.5 12h17"/></svg>',
      "180": '<svg viewBox="0 0 24 24"><path d="M4 7h4v10H4zM10 7h4v10h-4zM16 7h4v10h-4z"/></svg>',
      grande: '<svg viewBox="0 0 24 24"><path d="M4 6h5v4H4zM10 6h4v4h-4zM15 6h5v4h-5zM4 11h5v4H4zM10 11h4v4h-4zM15 11h5v4h-5z"/></svg>',
      vertical: '<svg viewBox="0 0 24 24"><path d="M8 3h8v5H8zM8 9.5h8v5H8zM8 16h8v5H8z"/></svg>' }[s];
    if (modoId === "quickshots") return { dronie: '<svg viewBox="0 0 24 24"><path d="M5 19L19 5M12 5h7v7"/></svg>', foguete: '<svg viewBox="0 0 24 24"><path d="M12 20V5M7 10l5-5 5 5M6 21h12"/></svg>',
      orbita: '<svg viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 1-2-4.9"/><path d="M17 3v4h-4"/><circle cx="12" cy="12" r="1.6" class="ch"/></svg>',
      helice: '<svg viewBox="0 0 24 24"><path d="M12 13c-1 0-1.5-1-1-2s2.5-1.2 3.4.2c1.3 2-.5 4.6-3 4.6-3.2 0-5-3.6-3.3-6.4 2-3.3 7.4-3 9.2.8"/></svg>',
      boomerang: '<svg viewBox="0 0 24 24"><path d="M6 15c-2-4 2-9 7-8s6 6 3 8-6 1-10 0"/><path d="M6 11v4h4"/></svg>',
      asteroide: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="17" rx="8" ry="3"/><circle cx="12" cy="9" r="4"/></svg>' }[s];
    if (modoId === "hyperlapse") return { livre: '<svg viewBox="0 0 24 24"><path d="M4 18c4-8 12-4 16-12"/></svg>', orbita: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.6" class="ch"/></svg>',
      curso: '<svg viewBox="0 0 24 24"><path d="M5 19L19 5M12 5h7v7"/><path d="M4 9l4 4"/></svg>', trajetoria: '<svg viewBox="0 0 24 24"><path d="M4 18l5-7 5 4 6-9"/></svg>' }[s];
    if (modoId === "video") return s === "lento" ? '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/><text x="12" y="15" text-anchor="middle" font-size="6" class="tx">SLO</text></svg>' : IC.video;
    return IC.foto;
  }
  function cartaoExplicacao() {
    var id = CAM.modo === "quickshots" ? CAM.qs : CAM.modo === "mastershots" ? "mastershots" : CAM.modo === "hyperlapse" ? "hl_" + CAM.hl : CAM.modo === "pano" ? "pano_" + CAM.pano : null;
    if (!id || !DESCRICAO[id]) return "";
    var ic = CAM.modo === "mastershots" ? IC.master : iconeSub(CAM.modo, subAtual());
    return '<div class="fly__painel fly__exp"><div class="img">' + ic + '</div><p>' + DESCRICAO[id] + "</p></div>";
  }

  function escolherModoCam(id) {
    if (gravando || auto && auto.inteligente || intervalo) { aviso("Pare a gravação antes de trocar o modo", "alerta"); return; }
    CAM.modo = id;
    if (id !== "quickshots" && id !== "mastershots" && !(id === "hyperlapse" && CAM.hl === "orbita") && !focusTrack) limparAlvo();
    desenharPainel();
    atualizarCamera();
  }
  function escolherSubModo(s) {
    if (CAM.modo === "foto") {
      if (CAM.foto === s) {   // tocar de novo muda o parametro
        if (s === "aeb") CAM.aeb = CAM.aeb === 3 ? 5 : 3;
        if (s === "rajada") CAM.rajada = { 3: 5, 5: 7, 7: 3 }[CAM.rajada];
        if (s === "intervalo") { var iv = [2, 3, 5, 7, 10, 15, 20, 30, 60]; CAM.intervalo = iv[(iv.indexOf(CAM.intervalo) + 1) % iv.length]; }
      }
      CAM.foto = s;
    }
    if (CAM.modo === "video") { CAM.video = s; if (s === "lento") { S.res = "1080p"; salvarS(); } }
    if (CAM.modo === "quickshots") CAM.qs = s;
    if (CAM.modo === "hyperlapse") { CAM.hl = s; if (s !== "orbita") limparAlvo(); }
    if (CAM.modo === "pano") CAM.pano = s;
    desenharPainel();
    atualizarCamera();
  }

  function precisaAlvo() {
    return CAM.modo === "quickshots" || CAM.modo === "mastershots" || (CAM.modo === "hyperlapse" && CAM.hl === "orbita");
  }

  function mudarParamHl(qual) {
    if (qual === "intervalo") { var iv = [1, 2, 3, 5, 10]; CAM.hlIntervalo = iv[(iv.indexOf(CAM.hlIntervalo) + 1) % iv.length]; }
    if (qual === "duracao") { var q = [125, 250, 500, 750]; CAM.hlQuadros = q[(q.indexOf(CAM.hlQuadros) + 1) % q.length]; }
    if (qual === "vel") { var vv = [0.5, 1, 1.5, 2, 3, 5]; CAM.hlVel = vv[(vv.indexOf(CAM.hlVel) + 1) % vv.length]; }
    atualizarCamera();
  }

  function adicionarPontoTraj() {
    if (!lido || !noAr(lido)) { aviso("Decole para marcar os pontos da trajetória", "alerta"); return; }
    if (CAM.hlPontos.length >= 5) { aviso("No máximo 5 pontos", "alerta"); return; }
    CAM.hlPontos.push({ x: lido.x, y: lido.y, z: lido.z, yaw: lido.yaw, g: lido.g });
    atualizarCamera();
  }

  /* ------------------------------------------------------------ acoes de voo */

  function noAr(r) { return !!r && r.est !== "em solo" && r.est !== "concluído" && r.est !== "caiu" && r.est !== "reabastecendo"; }
  function rthAtivo() { return !!lido && (lido.est === "voltando" || lido.est === "pousando"); }

  function decolar() {
    var m = cfg.manual;
    if (!conectado()) { aviso("Aeronave desconectada", "erro"); return; }
    if (!m || !lido || (lido.est !== "em solo" && lido.est !== "concluído")) return;
    m.ligarMotores();
    iniciarAuto({ nome: "decolar", passo: passoDecolar });
  }

  function pousar() { iniciarAuto({ nome: "pousar", passo: passoPousar }); }

  function rth(silencioso) {
    if (cfg.fase !== "pronto" && !silencioso) return;
    if (!noAr(lido)) { if (!silencioso) aviso("A aeronave está no chão", "alerta"); return; }
    pararTudoAuto();
    /* o ponto de origem e onde ele decolou; volta na altitude do RTH (ou na atual, se mais alta;
       perto do ponto de origem, na altura em que esta) */
    var h0 = casa ? casa : { x: lido.x, z: lido.z, y: lido.solo };
    var dist = Math.hypot(lido.x - h0.x, lido.z - h0.z), agl = Math.max(0, lido.y - lido.solo);
    var altRth = dist <= 20 ? Math.max(2, agl) : Math.max(S.rthAlt, agl);
    ponte.rodar("(function(){ if (typeof BASE === 'undefined') return; BASE.x = " + h0.x.toFixed(3) + "; BASE.z = " + h0.z.toFixed(3) + ";" +
                "P.rth = " + altRth.toFixed(1) + ";" +
                "if (['manual','aplicando','indo','pairando','subindo','descendo'].indexOf(V.estado) >= 0) {" +
                "  V.retomar = null; iniciarRetorno(null); V.rodando = true; } })()");
    aviso("Retornando ao ponto de origem. Altitude de RTH: " + Math.round(altRth) + " m", "alerta");
  }

  function cancelarRth() {
    ponte.rodar("if (V.estado === 'voltando' || V.estado === 'pousando') {" +
                "  V.mvx = (V.v || 0) * (V.dirx || 0); V.mvz = (V.v || 0) * (V.dirz || 0);" +
                "  V.estado = 'manual'; V.rodando = true; V.xgFreio = true; V.v = 0; delete V.xgAgl;" +
                "  V.xgAx = 0; V.xgAz = 0; V.xgIx = 0; V.xgIz = 0; if (typeof fecharAlerta === 'function') fecharAlerta(); }");
    aviso("RTH cancelado", "alerta");
  }

  function pausar() {
    if (auto) { cancelarAuto("Voo inteligente pausado"); return; }
    soltarManche();
    var b = ponte.janela && ponte.janela.document.getElementById("rcPausa");
    if (b) b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    if (rthAtivo()) cancelarRth(); else aviso("Voo pausado");
  }

  function atualizarOrigem(qual) {
    if (!lido) return;
    if (qual === "controle") casa = { x: lido.ox, z: lido.oz, y: lido.oy };
    else casa = { x: lido.x, z: lido.z, y: lido.solo };
    fecharPainel();
    aviso("Ponto de origem atualizado. Altitude de RTH: " + S.rthAlt + " m");
  }

  /* ------------------------------------------------------------ automacao

     A automacao pilota pelos manches, como o piloto (manual.mouse), entao a
     fisica e os limites do voo manual valem. Mexer nos manches cancela. */

  function iniciarAuto(o) {
    pararTudoAuto();
    o.desde = performance.now();
    o.t = 0;
    auto = o;
    if (o.limites) { var j = janela(); if (j) j.xgVooLimites = MODOS.N; }
  }

  function pararTudoAuto() {
    if (auto && auto.aoFim) { var f = auto.aoFim; auto.aoFim = null; try { f(false); } catch (e) { /* segue */ } }
    auto = null;
    soltarManche();
    aplicarModo();
  }

  function cancelarAuto(texto) {
    var a = auto;
    pararTudoAuto();
    if (a && texto) aviso(texto, "alerta");
    if (a && a.inteligente) atualizarCamera();
  }

  function soltarManche() {
    if (escrito && cfg.manual && cfg.manual.mouse) { cfg.manual.mouse.esq = null; cfg.manual.mouse.dir = null; }
    escrito = null;
  }

  /* comandos (-1 a 1) para os manches do modo escolhido */
  function comandar(c) {
    var m = cfg.manual;
    if (!m || !m.mouse) return;
    var cl = function (v) { return Math.max(-1, Math.min(1, v || 0)); };
    var thr = cl(c.thr), yaw = cl(c.yaw), pitch = cl(c.pitch), roll = cl(c.roll), md = S.manche;
    var esq, dir;
    if (md === 1) { esq = { x: yaw, y: pitch }; dir = { x: roll, y: thr }; }
    else if (md === 3) { esq = { x: roll, y: pitch }; dir = { x: yaw, y: thr }; }
    else { esq = { x: yaw, y: thr }; dir = { x: roll, y: pitch }; }
    m.mouse.esq = esq; m.mouse.dir = dir;
    escrito = { esq: esq, dir: dir };
  }

  /* o piloto mexeu? (teclado, controle de verdade ou arrastou o manche do modelo) */
  function pilotoMexeu() {
    var m = cfg.manual;
    if (!m || !m.manches) return false;
    var mo = m.mouse || {};
    if (escrito && (mo.esq !== escrito.esq || mo.dir !== escrito.dir)) return true;
    m.mouse = { esq: null, dir: null };
    var p;
    try { p = m.manches(); } finally { m.mouse = mo; }
    return Math.max(Math.abs(p.esq.x), Math.abs(p.esq.y), Math.abs(p.dir.x), Math.abs(p.dir.y)) > 0.25;
  }

  function anguloPara(dx, dz) { return Math.atan2(-dz, dx); }
  function difAng(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  /* velocidade no mundo (m/s), rumo desejado (rad) -> manches */
  function voarCom(r, vx, vy, vz, yawAlvo) {
    var L = MODOS.N, giro = L.giro * Math.PI / 180;
    var fx = Math.cos(r.yaw), fz = -Math.sin(r.yaw), rx = Math.sin(r.yaw), rz = Math.cos(r.yaw);
    var yaw = 0;
    if (typeof yawAlvo === "number") yaw = -difAng(yawAlvo, r.yaw) * 2.2 / giro;
    comandar({ pitch: (vx * fx + vz * fz) / L.velH, roll: (vx * rx + vz * rz) / L.velH,
               thr: vy >= 0 ? vy / L.sobe : vy / L.desce, yaw: yaw });
  }

  /* segue um ponto que anda (p(t)) com a camera no alvo */
  function seguirPonto(r, p, pAdiante, dt, olhar) {
    var vx = (pAdiante.x - p.x) / dt + (p.x - r.x) * 1.2;
    var vy = (pAdiante.y - p.y) / dt + (p.y - r.y) * 1.2;
    var vz = (pAdiante.z - p.z) / dt + (p.z - r.z) * 1.2;
    var vh = Math.hypot(vx, vz), max = 12;
    if (vh > max) { vx *= max / vh; vz *= max / vh; }
    var yawAlvo = null;
    if (olhar) {
      yawAlvo = anguloPara(olhar.x - r.x, olhar.z - r.z);
      apontarGimbal(r, olhar);
    }
    voarCom(r, vx, Math.max(-5, Math.min(5, vy)), vz, yawAlvo);
  }

  function apontarGimbal(r, o) {
    var j = janela();
    if (!j) return;
    var d = Math.hypot(o.x - r.x, o.z - r.z);
    var g = Math.atan2(o.y - r.y, d) * 180 / Math.PI;
    var max = S.gimbalCima ? 24 : 0;
    g = Math.max(-90, Math.min(max, g));
    var atual = typeof j.xgGimbal === "number" ? j.xgGimbal : 0;
    j.xgGimbal = atual + Math.max(-6, Math.min(6, g - atual));
  }

  function passoDecolar(r, t) {
    var agl = r.y - r.solo;
    if (r.est !== "manual") return t > 2500;
    if (agl < ALTURA_DECOLAGEM - 0.35) { comandar({ thr: agl < 0.5 ? 0.35 : 0.2 }); return false; }
    aviso("Ponto de origem atualizado. Altitude de RTH: " + S.rthAlt + " m");
    return true;
  }

  function passoPousar(r) {
    if (r.est !== "manual") return true;
    var agl = r.y - r.solo;
    comandar({ thr: agl > 0.6 ? -0.7 : -1 });
    return false;
  }

  function seguirAutomacao(r) {
    if (!auto || !r) return;
    var agora = performance.now(), dt = auto.ultimo ? Math.min(0.5, (agora - auto.ultimo) / 1000) : 0.1;
    auto.ultimo = agora;
    auto.t = agora - auto.desde;
    if (r.est === "caiu") { pararTudoAuto(); return; }
    if (auto.t > 600 && !auto.livre && pilotoMexeu()) {
      cancelarAuto(auto.nome === "pousar" ? "Pouso cancelado" : auto.nome === "decolar" ? "" : auto.titulo ? auto.titulo + " interrompido" : "");
      return;
    }
    var feito = false;
    try { feito = auto.passo(r, auto.t, dt); } catch (e) { feito = true; }
    if (feito) {
      var a = auto;
      auto = null;
      soltarManche();
      aplicarModo();
      if (a.aoFim) a.aoFim(true);
      if (a.inteligente) atualizarCamera();
    }
  }

  /* ------------------------------------------------------------ voos inteligentes */

  function exigirVoo(nome) {
    if (!lido || !noAr(lido)) { aviso("Incapaz de usar " + nome + ". Decole e tente novamente", "alerta"); return false; }
    if (lido.y - lido.solo < 2) { aviso("Incapaz de usar " + nome + ". Suba a aeronave e tente novamente", "alerta"); return false; }
    if (lido.batBaixa) { aviso("Bateria baixa. " + nome + " indisponível", "alerta"); return false; }
    return true;
  }

  /* trajetoria de cada QuickShot: p(t) a partir da posicao inicial e do alvo */
  function trajetoQuick(qual, r0, a) {
    var dx = r0.x - a.x, dz = r0.z - a.z, d0 = Math.max(3, Math.hypot(dx, dz));
    var ux = dx / d0, uz = dz / d0, ang0 = Math.atan2(dz, dx);
    var y0 = r0.y;
    var orb = function (ang, raio, y) { return { x: a.x + Math.cos(ang) * raio, y: y, z: a.z + Math.sin(ang) * raio }; };
    if (qual === "dronie") return { T: 16, p: function (t) { var s = Math.min(t, 16) / 16 * 40; return { x: r0.x + ux * s, y: y0 + s * 0.45, z: r0.z + uz * s }; } };
    if (qual === "foguete") return { T: 14, p: function (t) { return { x: r0.x, y: y0 + Math.min(t, 14) / 14 * 40, z: r0.z }; } };
    if (qual === "orbita") { var Tor = Math.max(14, 2 * Math.PI * d0 / 3); return { T: Tor, p: function (t) { return orb(ang0 + Math.min(t, Tor) / Tor * 2 * Math.PI, d0, y0); } }; }
    if (qual === "helice") { var Th = Math.max(20, 2 * Math.PI * (d0 + 10) / 3); return { T: Th, p: function (t) { var f = Math.min(t, Th) / Th; return orb(ang0 + f * 2 * Math.PI, d0 + f * 20, y0 + f * 15); } }; }
    if (qual === "boomerang") { var Tb = Math.max(16, 2 * Math.PI * d0 * 1.3 / 3); return { T: Tb, p: function (t) { var f = Math.min(t, Tb) / Tb, ang = ang0 + f * 2 * Math.PI; return orb(ang, d0 * (1 + 0.7 * Math.sin(f * Math.PI)), y0 + 10 * Math.sin(f * Math.PI)); } }; }
    if (qual === "asteroide") return { T: 22, p: function (t) { var f = Math.min(t, 22) / 22, s = (f < 0.5 ? f * 2 : (1 - f) * 2) * 45; return { x: r0.x + ux * s, y: y0 + s * 0.8, z: r0.z + uz * s }; } };
    /* MasterShots: meia orbita, afasta (dronie), sobe (foguete) */
    var T1 = Math.max(10, Math.PI * d0 / 3), T2 = 10, T3 = 8;
    return { T: T1 + T2 + T3, p: function (t) {
      if (t < T1) return orb(ang0 + t / T1 * Math.PI, d0, y0);
      var fim = orb(ang0 + Math.PI, d0, y0), u2x = Math.cos(ang0 + Math.PI), u2z = Math.sin(ang0 + Math.PI);
      if (t < T1 + T2) { var s = (t - T1) / T2 * 20; return { x: fim.x + u2x * s, y: y0 + s * 0.4, z: fim.z + u2z * s }; }
      var f3 = Math.min(1, (t - T1 - T2) / T3);
      return { x: fim.x + u2x * 20, y: y0 + 8 + f3 * 12, z: fim.z + u2z * 20 };
    } };
  }

  function iniciarQuick() {
    var nome = CAM.modo === "mastershots" ? "MasterShots" : "QuickShots";
    if (!exigirVoo(nome)) return;
    if (!alvo) { aviso('Toque em "+" ou arraste um quadrado ao redor do alvo', "alerta"); escolhendoAlvo = "quick"; atualizarCamera(); return; }
    var r0 = { x: lido.x, y: lido.y, z: lido.z, yaw: lido.yaw }, a = alvo;
    var tr = trajetoQuick(CAM.modo === "mastershots" ? "master" : CAM.qs, r0, a);
    var volta = null, fimTrajeto = null;
    comecarGravacao(CAM.modo === "mastershots" ? "MasterShots" : "QuickShots");
    iniciarAuto({ nome: "quick", titulo: nome, inteligente: true, limites: true,
      passo: function (r, tms, dt) {
        var t = tms / 1000;
        if (!volta) {
          var tt = Math.min(t, tr.T);
          seguirPonto(r, tr.p(tt), tr.p(Math.min(tt + 0.25, tr.T + 0.25)), 0.25, a);
          progresso(nome + " · " + Math.min(100, Math.round(t / tr.T * 100)) + "%");
          if (t >= tr.T + 1.5) { fimTrajeto = { x: r.x, y: r.y, z: r.z }; volta = t; pararGravacao(); }
          return false;
        }
        /* volta ao ponto de partida */
        var dist = Math.hypot(r0.x - fimTrajeto.x, r0.z - fimTrajeto.z, r0.y - fimTrajeto.y), Tv = Math.max(3, dist / 5), f = Math.min(1, (t - volta) / Tv);
        var lerp = function (k) { return { x: fimTrajeto.x + (r0.x - fimTrajeto.x) * k, y: fimTrajeto.y + (r0.y - fimTrajeto.y) * k, z: fimTrajeto.z + (r0.z - fimTrajeto.z) * k }; };
        seguirPonto(r, lerp(f), lerp(Math.min(1, f + 0.25 / Tv)), 0.25, a);
        progresso("Voltando ao ponto inicial");
        return f >= 1 && Math.hypot(r.x - r0.x, r.z - r0.z) < 1.5;
      },
      aoFim: function (ok) { progresso(""); if (gravando) pararGravacao(); if (ok) aviso(nome + " concluído"); },
    });
    atualizarCamera();
  }

  /* panoramicas: lista de [guinada relativa (graus), gimbal (graus)] e como montar */
  function planoPano(qual) {
    var L = [], i;
    if (qual === "esfera") { [0, -30, -60].forEach(function (g) { for (i = 0; i < 8; i++) L.push([i * 45, g]); }); L.push([0, -90], [180, -90]); return { L: L, cols: 8, linhas: 3, passoY: 45, passoG: 30 }; }
    if (qual === "180") { [0, -30, -60].forEach(function (g) { for (i = 0; i < 7; i++) L.push([-90 + i * 30, g]); }); return { L: L, cols: 7, linhas: 3, passoY: 30, passoG: 30 }; }
    if (qual === "grande") { [0, -25, -50].forEach(function (g) { for (i = 0; i < 3; i++) L.push([-40 + i * 40, g]); }); return { L: L, cols: 3, linhas: 3, passoY: 40, passoG: 25 }; }
    return { L: [[0, 0], [0, -30], [0, -60]], cols: 1, linhas: 3, passoY: 77, passoG: 30 };
  }

  function iniciarPano() {
    if (!exigirVoo("Panorâmica")) return;
    var plano = planoPano(CAM.pano), r0 = { x: lido.x, y: lido.y, z: lido.z, yaw: lido.yaw }, k = 0, espera = 0, fotosPano = [];
    iniciarAuto({ nome: "pano", titulo: "Panorâmica", inteligente: true, limites: true,
      passo: function (r, tms, dt) {
        var s = plano.L[k];
        if (!s) return true;
        var yawAlvo = r0.yaw - s[0] * Math.PI / 180;    // guinada para a direita
        var j = janela();
        if (j) j.xgGimbal += Math.max(-8, Math.min(8, s[1] - j.xgGimbal));
        voarCom(r, (r0.x - r.x) * 1.2, (r0.y - r.y) * 1.2, (r0.z - r.z) * 1.2, yawAlvo);
        progresso("Panorâmica · " + k + "/" + plano.L.length);
        var parado = Math.abs(difAng(yawAlvo, r.yaw)) < 0.03 && Math.abs(r.g - s[1]) < 1.5 && r.hs < 0.3;
        if (parado) espera += dt; else espera = 0;
        if (espera > 0.35) {
          var c = tirarFotoCanvas(600, 400);
          if (c) fotosPano.push({ c: c, s: s });
          piscar();
          k++; espera = 0;
        }
        return false;
      },
      aoFim: function (ok) {
        progresso("");
        if (!ok) return;
        var montada = montarPano(fotosPano, plano);
        if (montada) guardarMidia("pano", montada, "Panorâmica " + { esfera: "Esfera", "180": "180°", grande: "Grande-angular", vertical: "Vertical" }[CAM.pano], plano.L.length);
        aviso("Panorâmica salva (" + plano.L.length + " fotos)");
      },
    });
    atualizarCamera();
  }

  /* junta as fotos lado a lado, cada uma cortada ao passo entre elas */
  function montarPano(lista, plano) {
    var fotos = lista.filter(function (f) { return f.s[1] > -90; });
    if (!fotos.length) return null;
    var w0 = fotos[0].c.width, h0 = fotos[0].c.height;
    var cw = Math.round(w0 * Math.min(1, plano.passoY / 77.5)), ch = Math.round(h0 * Math.min(1, plano.passoG / 56.3));
    if (plano.cols === 1) ch = Math.round(h0 * Math.min(1, plano.passoG / 56.3));
    var c = document.createElement("canvas");
    c.width = cw * plano.cols; c.height = ch * plano.linhas;
    var g = c.getContext("2d");
    fotos.forEach(function (f, i) {
      var col = i % plano.cols, lin = Math.floor(i / plano.cols);
      g.drawImage(f.c, (w0 - cw) / 2, (h0 - ch) / 2, cw, ch, col * cw, lin * ch, cw, ch);
    });
    return c;
  }

  /* Hyperlapse: grava quadros a cada intervalo; voo conforme o tipo */
  function iniciarHyper() {
    if (!exigirVoo("Hyperlapse")) return;
    var tipo = CAM.hl, r0 = { x: lido.x, y: lido.y, z: lido.z, yaw: lido.yaw }, quadros = 0, ultimo = -1e9, a = alvo;
    if (tipo === "orbita" && !a) { aviso('Toque em "+" ou arraste um quadrado ao redor do alvo', "alerta"); escolhendoAlvo = "quick"; atualizarCamera(); return; }
    if (tipo === "trajetoria" && CAM.hlPontos.length < 2) { aviso("Marque pelo menos 2 pontos da trajetória (+)", "alerta"); return; }
    var pts = CAM.hlPontos.slice(), seg = 0, fSeg = 0;
    var d0 = a ? Math.max(3, Math.hypot(r0.x - a.x, r0.z - a.z)) : 0, ang0 = a ? Math.atan2(r0.z - a.z, r0.x - a.x) : 0, ang = ang0;
    comecarGravacao("Hyperlapse");
    iniciarAuto({ nome: "hyper", titulo: "Hyperlapse", inteligente: true, limites: tipo !== "livre", livre: tipo === "livre",
      passo: function (r, tms, dt) {
        var t = tms / 1000;
        if (t - ultimo >= CAM.hlIntervalo) { ultimo = t; quadros++; }
        progresso("Hyperlapse · " + quadros + "/" + CAM.hlQuadros);
        if (quadros >= CAM.hlQuadros) return true;
        if (tipo === "livre") { escrito = null; return false; }   // o piloto voa
        if (tipo === "curso") { var fx = Math.cos(r0.yaw), fz = -Math.sin(r0.yaw); voarCom(r, fx * CAM.hlVel, (r0.y - r.y), fz * CAM.hlVel, r0.yaw); return false; }
        if (tipo === "orbita") {
          ang += CAM.hlVel / d0 * dt;
          var p = { x: a.x + Math.cos(ang) * d0, y: r0.y, z: a.z + Math.sin(ang) * d0 };
          var p2 = { x: a.x + Math.cos(ang + CAM.hlVel / d0 * 0.25) * d0, y: r0.y, z: a.z + Math.sin(ang + CAM.hlVel / d0 * 0.25) * d0 };
          seguirPonto(r, p, p2, 0.25, a);
          return false;
        }
        /* trajetoria: de ponto em ponto, rumo e camera interpolados */
        var A = pts[seg], B = pts[seg + 1];
        if (!B) return true;                                   // fim da rota
        var dist = Math.max(0.5, Math.hypot(B.x - A.x, B.y - A.y, B.z - A.z));
        fSeg = Math.min(1, fSeg + CAM.hlVel * dt / dist);
        var lp = function (k) { return { x: A.x + (B.x - A.x) * k, y: A.y + (B.y - A.y) * k, z: A.z + (B.z - A.z) * k }; };
        var j = janela();
        if (j) j.xgGimbal = A.g + (B.g - A.g) * fSeg;
        var cx = lp(fSeg), cx2 = lp(Math.min(1, fSeg + CAM.hlVel * 0.25 / dist));
        var vx = (cx2.x - cx.x) / 0.25 + (cx.x - r.x) * 1.2, vy = (cx2.y - cx.y) / 0.25 + (cx.y - r.y) * 1.2, vz = (cx2.z - cx.z) / 0.25 + (cx.z - r.z) * 1.2;
        voarCom(r, vx, vy, vz, A.yaw + difAng(B.yaw, A.yaw) * fSeg);
        if (fSeg >= 1) { seg++; fSeg = 0; }
        return false;
      },
      aoFim: function (ok) { progresso(""); pararGravacao(); if (ok) aviso("Hyperlapse salvo"); },
    });
    atualizarCamera();
  }

  function progresso(txt) {
    if (!el) return;
    el.progresso.hidden = !txt;
    if (txt) el.progresso.textContent = txt;
  }

  /* ------------------------------------------------------------ alvo na tela */

  function tocarNaCamera(e) {
    if (!escolhendoAlvo && !precisaAlvo()) return;
    if (!lido || !noAr(lido)) { aviso("Decole antes de escolher o alvo", "alerta"); return; }
    var r = el.cam.getBoundingClientRect();
    var nx = (e.clientX - r.left) / r.width * 2 - 1, ny = -((e.clientY - r.top) / r.height * 2 - 1);
    var p = ponte.ler("window.xgFlyAlvoNaTela ? window.xgFlyAlvoNaTela(" + nx.toFixed(4) + "," + ny.toFixed(4) + ") : null");
    if (!p) { aviso("Alvo fora de alcance", "alerta"); return; }
    alvo = { x: p.x, y: p.y, z: p.z };
    var j = janela();
    if (j) j.xgFlyAlvo = alvo;
    if (escolhendoAlvo === "foco") { focusTrack = true; aviso("FocusTrack: o alvo fica no centro. Voe com os manches."); }
    escolhendoAlvo = false;
    atualizarCamera();
  }

  function limparAlvo() {
    alvo = null; focusTrack = false;
    var j = janela();
    if (j) j.xgFlyAlvo = null;
  }
  function pararEscolhaAlvo() {
    escolhendoAlvo = false;
    if (focusTrack) { limparAlvo(); aviso("FocusTrack encerrado"); }
    else if (!precisaAlvo()) limparAlvo();
    atualizarCamera();
  }

  /* FocusTrack (Spotlight): o piloto voa e a aeronave mantem o alvo no centro */
  function seguirFoco(r) {
    if (!focusTrack || !alvo || auto || !noAr(r)) return;
    var j = janela();
    if (!j) return;
    apontarGimbal(r, alvo);
    var yawAlvo = anguloPara(alvo.x - r.x, alvo.z - r.z);
    var giro = MODOS[modo].giro * Math.PI / 180;
    var falta = difAng(yawAlvo, r.yaw);
    /* guinada direto no campo (os manches continuam com o piloto) */
    ponte.rodar("V.yaw += " + (Math.max(-giro * 0.12, Math.min(giro * 0.12, falta * 0.35))).toFixed(5) + ";");
  }

  /* ------------------------------------------------------------ camera: fotos e video */

  function piscar() {
    if (!el) return;
    el.flash.style.transition = "none"; el.flash.style.opacity = ".7";
    var w = el.doc.defaultView;
    w.requestAnimationFrame(function () { el.flash.style.transition = "opacity .25s"; el.flash.style.opacity = "0"; });
  }

  function filtroEv() { return S.ev ? "brightness(" + Math.pow(2, S.ev * 0.5).toFixed(3) + ")" : "none"; }

  /* a foto do sensor (renderiza a camera do drone no tamanho pedido) */
  function tirarFotoCanvas(w, h) {
    var c = null;
    try { c = ponte.ler("window.xgFlyFoto ? window.xgFlyFoto(" + w + "," + h + ") : null"); } catch (e) { c = null; }
    if (!c) return null;
    if (S.ev) {
      var c2 = el.doc.createElement("canvas");
      c2.width = c.width; c2.height = c.height;
      var g = c2.getContext("2d");
      g.filter = filtroEv();
      g.drawImage(c, 0, 0);
      return c2;
    }
    return c;
  }

  function tamanhoFoto() { return aspectoAtual() === "16:9" ? [1280, 720] : [1200, 800]; }

  function guardarMidia(tipo, canvas, nome, n, etiqueta) {
    var mini = document.createElement("canvas");
    mini.width = 300; mini.height = Math.round(300 * canvas.height / canvas.width);
    mini.getContext("2d").drawImage(canvas, 0, 0, mini.width, mini.height);
    var agora = new Date();
    var item2 = { tipo: tipo, url: canvas.toDataURL("image/jpeg", 0.86), mini: mini.toDataURL("image/jpeg", 0.7), nome: nome,
                  quando: ("0" + agora.getHours()).slice(-2) + ":" + ("0" + agora.getMinutes()).slice(-2) + ":" + ("0" + agora.getSeconds()).slice(-2),
                  fav: false, etiqueta: etiqueta || "" };
    midia.push(item2);
    if (midia.length > 300) liberar(midia.shift());
    fotosTiradas += (n || 1) * (S.formato === "RAW" ? 4.5 : S.formato === "JPEG+RAW" ? 5.4 : 1);
    return item2;
  }
  function liberar(m) { if (m && m.blob) { try { URL.revokeObjectURL(m.url); } catch (e) { /* segue */ } } }

  function fotoUnica(etiqueta) {
    var sz = tamanhoFoto(), c = tirarFotoCanvas(sz[0], sz[1]);
    if (!c) { aviso("Câmera indisponível", "erro"); return false; }
    piscar();
    guardarMidia("foto", c, "Foto " + (midia.length + 1), 1, etiqueta);
    return true;
  }

  function disparar() {
    if (!conectado()) { aviso("Aeronave desconectada", "erro"); return; }
    if (auto && auto.inteligente) { cancelarAuto(auto.titulo + " interrompido"); return; }
    if (intervalo) { pararIntervalo(); return; }
    if (CAM.modo === "foto") {
      if (fotosRestantes() <= 0) { aviso("Armazenamento cheio", "erro"); return; }
      if (CAM.foto === "unica" || CAM.foto === "smart") { fotoUnica(CAM.foto === "smart" ? "SMART" : ""); return; }
      if (CAM.foto === "aeb" || CAM.foto === "rajada") {
        var n = CAM.foto === "aeb" ? CAM.aeb : CAM.rajada, k = 0, evAntes = S.ev;
        (function uma() {
          if (CAM.foto === "aeb") S.ev = Math.max(-3, Math.min(3, evAntes + (k - (n - 1) / 2) * 0.7));
          fotoUnica(CAM.foto === "aeb" ? "AEB" : "CONT");
          S.ev = evAntes;
          if (++k < n) setTimeout(uma, CAM.foto === "aeb" ? 260 : 180);
        })();
        return;
      }
      if (CAM.foto === "intervalo") {
        fotoUnica("INT");
        intervalo = setInterval(function () { if (!conectado() || fotosRestantes() <= 0) { pararIntervalo(); return; } fotoUnica("INT"); }, CAM.intervalo * 1000);
        aviso("Fotos a cada " + CAM.intervalo + " s. Toque de novo para parar");
        atualizarCamera();
        return;
      }
    }
    if (CAM.modo === "video") {
      if (gravando) pararGravacao(); else comecarGravacao("Vídeo");
      atualizarCamera();
      return;
    }
    if (CAM.modo === "quickshots" || CAM.modo === "mastershots") { iniciarQuick(); return; }
    if (CAM.modo === "hyperlapse") { iniciarHyper(); return; }
    if (CAM.modo === "pano") { iniciarPano(); return; }
  }

  function pararIntervalo() {
    clearInterval(intervalo);
    intervalo = null;
    aviso("Fotos por intervalo encerradas");
    atualizarCamera();
  }

  /* video: grava a imagem da camera (o quadro 16:9) com o MediaRecorder */
  function comecarGravacao(nome) {
    if (gravando) return;
    var g = { desde: performance.now(), nome: nome, partes: [], rec: null, canvas: null, laco: 0 };
    gravando = g;
    try {
      var c = el.doc.createElement("canvas");
      c.width = 1280; c.height = 720;
      var ctx = c.getContext("2d"), w = el.doc.defaultView;
      g.canvas = c;
      g.capa = null;
      (function quadro() {
        if (gravando !== g) return;
        var fonte = el.cam, fw = fonte.width, fh = fonte.height;
        if (fw && fh && !mapaGrande) {
          var qw = Math.min(fw, fh * 16 / 9), sx = (fw - qw) / 2;
          ctx.filter = filtroEv();
          ctx.drawImage(fonte, sx, 0, qw, fh, 0, 0, 1280, 720);
          if (!g.capa) { g.capa = el.doc.createElement("canvas"); g.capa.width = 480; g.capa.height = 270; g.capa.getContext("2d").drawImage(c, 0, 0, 480, 270); }
        }
        g.laco = w.requestAnimationFrame(quadro);
      })();
      var stream = c.captureStream(30);
      var tipo = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].filter(function (t) { return w.MediaRecorder && w.MediaRecorder.isTypeSupported(t); })[0];
      if (tipo) {
        g.rec = new w.MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 4e6 });
        g.rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) g.partes.push(ev.data); };
        g.rec.start(1000);
      }
    } catch (e) { g.rec = null; }
    atualizarCamera();
  }

  function pararGravacao() {
    var g = gravando;
    if (!g) return;
    gravando = null;
    var dur = (performance.now() - g.desde) / 1000;
    videoGasto += dur;
    try { el.doc.defaultView.cancelAnimationFrame(g.laco); } catch (e) { /* segue */ }
    var capa = g.capa || g.canvas;
    var mini = capa ? capa.toDataURL("image/jpeg", 0.7) : "";
    var item2 = { tipo: "video", url: "", mini: mini, nome: g.nome + " " + (midia.length + 1), quando: new Date().toTimeString().slice(0, 8), dur: dur, fav: false,
                  etiqueta: g.nome === "Vídeo" ? "" : g.nome.toUpperCase().slice(0, 6) };
    midia.push(item2);
    if (g.rec) {
      g.rec.onstop = function () {
        try { item2.url = URL.createObjectURL(new Blob(g.partes, { type: "video/webm" })); item2.blob = true; } catch (e) { item2.url = mini; }
        if (tela === "galeria") desenharGaleria();
      };
      try { g.rec.stop(); } catch (e) { item2.url = mini; }
    } else item2.url = mini;
    if (g.nome === "Vídeo") aviso("Vídeo salvo (" + mmss(dur) + ")");
    atualizarCamera();
  }

  function fotosRestantes() { return Math.max(0, Math.floor(FOTOS_LIVRES - fotosTiradas - videoGasto * 1.5)); }
  function videoRestante() { return Math.max(0, (VIDEO_LIVRE[S.res] || 198) - videoGasto - fotosTiradas * 0.66 - (gravando ? (performance.now() - gravando.desde) / 1000 : 0)); }

  /* ------------------------------------------------------------ gimbal */

  function mudarGimbal(passo) {
    var j = janela();
    if (!j) return;
    var max = S.gimbalCima ? 24 : 0;
    var g = Math.max(-90, Math.min(max, (typeof j.xgGimbal === "number" ? j.xgGimbal : 0) + passo));
    j.xgGimbal = g;
  }

  /* ------------------------------------------------------------ avisos */

  function aviso(txt, tipo, ms) {
    if (!el || !txt) return;
    el.toast.textContent = txt;
    el.toast.className = "fly__toast" + (tipo ? " " + tipo : "");
    el.toast.style.opacity = "1";
    recadoAte = performance.now() + (ms || 3200);
  }

  function avisoModo() {
    if (!el) return;
    el.grande.querySelector("b").textContent = modo;
    el.grande.querySelector("span").textContent = TOAST_MODO[modo];
    el.grande.style.opacity = "1";
    clearTimeout(avisoModo.t);
    avisoModo.t = setTimeout(function () { if (el) el.grande.style.opacity = "0"; }, 1600);
  }

  /* ------------------------------------------------------------ desenho da camera */

  function fmt(v, casas) { return (Math.round(v * Math.pow(10, casas)) / Math.pow(10, casas)).toFixed(casas); }
  function fmtM(v) { return (Math.abs(v) < 10 ? fmt(v, 1) : String(Math.round(v))) + "m"; }
  function fmtEv(v) { return (v > 0 ? "+" : "") + fmt(v, 1); }
  function mmss(s) { s = Math.max(0, Math.round(s)); return ("0" + Math.floor(s / 60)).slice(-2) + ":" + ("0" + s % 60).slice(-2); }

  /* coisas que mudam pouco: modo de foto, botoes, quadro */
  function atualizarCamera() {
    if (!el) return;
    var q169 = aspectoAtual() === "16:9";
    el.quadro.classList.toggle("q169", q169);
    el.toque.classList.toggle("q169", q169);
    el.grade.style.display = S.grade ? "" : "none";
    el.cam.style.filter = filtroEv();
    /* mapa grande x camera */
    el.mapaCheio.hidden = !mapaGrande;
    el.vista.style.cssText = "";
    el.mini.classList.toggle("pip", mapaGrande);
    el.mini.hidden = mapaMin;
    el.miniBtn.hidden = !mapaMin;
    if (mapaGrande) { el.mini.appendChild(el.cam); posicionarPip(); }
    else if (el.cam.parentNode !== el.vista) { el.cam.style.cssText = ""; el.vista.insertBefore(el.cam, el.vista.firstChild); }
    el.miniCanvas.hidden = mapaGrande;
    el.dirc.hidden = mapaGrande;
    el.info.hidden = mapaGrande;
    desenharFerramentas();
    /* modo de foto */
    var inteligente = ["quickshots", "mastershots", "hyperlapse", "pano"].indexOf(CAM.modo) >= 0;
    el.modoCam.innerHTML = { foto: IC.foto, video: IC.video, mastershots: IC.master, quickshots: IC.quick, hyperlapse: IC.hyper, pano: IC.pano }[CAM.modo];
    el.modoCam.classList.toggle("cor", CAM.modo !== "foto");
    var d = el.disparo;
    d.className = "fly__disparo";
    d.textContent = "";
    if (auto && auto.inteligente) d.classList.add("parar");
    else if (inteligente) { d.classList.add("start"); d.textContent = "Start"; if (precisaAlvo() && !alvo) d.classList.add("off"); }
    else if (CAM.modo === "video") d.classList.add(gravando ? "gravando" : "video");
    else if (intervalo) d.classList.add("parar", "intervalo");
    el.zoom.hidden = CAM.modo !== "video";
    el.af.textContent = S.foco;
    el.recTempo.hidden = !gravando;
    el.iFmtT.textContent = CAM.modo === "video" || CAM.modo === "hyperlapse" ? "RES&FPS" : "Formato";
    el.iFmt.classList.toggle("cor", CAM.modo === "video");
    el.iEv.textContent = fmtEv(S.ev);
    /* esquerda */
    var esp = modo === "S", deslig = S.desvio === "desl" || esp;
    el.bObs.innerHTML = deslig ? IC.obstDesl : IC.obst;
    el.bObs.className = "b b-obs" + (deslig ? " vermelho" : S.desvio === "desviar" ? " verde" : "");
    el.visao.classList.toggle("off", deslig);
    el.bFoco.className = "b b-foco" + (focusTrack || escolhendoAlvo ? " amarelo" : "");
    el.toque.classList.toggle("mira", !!escolhendoAlvo || precisaAlvo());
    el.dicaAlvo.hidden = !((escolhendoAlvo || (precisaAlvo() && !alvo)) && !(auto && auto.inteligente) && tela === "camera" && !mapaGrande);
    el.dicaAlvo.textContent = escolhendoAlvo === "foco" ? 'Toque em "+" ou faça um quadro ao redor do alvo' : 'Toque em "+" ou arraste um quadrado ao redor do alvo.';
    desenharParamsInteligentes();
  }

  /* os parametros do Hyperlapse ficam embaixo, no meio */
  function desenharParamsInteligentes() {
    var velho = el.raiz.querySelector(".fly__hlbox");
    if (velho) velho.remove();
    if (CAM.modo !== "hyperlapse" || mapaGrande || (auto && auto.inteligente)) return;
    var box = h("div", "fly__hlbox");
    var dur = CAM.hlQuadros * CAM.hlIntervalo;
    if (CAM.hl === "trajetoria") {
      box.innerHTML = '<div class="fly__painel fly__traj" style="bottom:4cqh">' + CAM.hlPontos.map(function (p, i) { return '<div class="ok">' + (i + 1) + "</div>"; }).join("") +
        (CAM.hlPontos.length < 5 ? '<div class="mais" data-acao="trajMais">' + IC.mais + "</div>" : "") +
        (CAM.hlPontos.length ? '<div data-acao="trajLimpar">' + IC.lixo.replace("<svg", '<svg style="width:4cqh;height:4cqh"') + "</div>" : "") + "</div>";
    } else {
      box.innerHTML = '<div class="fly__painel fly__hl"><div data-acao="hlParam" data-v="intervalo"><b>' + CAM.hlIntervalo + 's</b><small>Intervalo</small></div>' +
        '<div data-acao="hlParam" data-v="duracao"><b>' + Math.round(CAM.hlQuadros / 25) + 's</b><small>Duração</small></div>' +
        (CAM.hl === "livre" ? "" : '<div data-acao="hlParam" data-v="vel"><b>' + fmt(CAM.hlVel, 1) + 'm/s</b><small>Velocidade</small></div>') +
        '<div><b style="font-size:2.8cqh">' + mmss(dur) + '</b><small>Quadros ' + CAM.hlQuadros + "</small></div></div>";
    }
    el.raiz.insertBefore(box, el.camada);
  }

  function posicionarPip() {
    var W = el.raiz.clientWidth, H = el.raiz.clientHeight, mh = el.mini.clientHeight;
    if (!W || !H || !mh) return;
    var w = mh * W / H;
    el.cam.style.cssText = "position:absolute;top:0;height:100%;width:" + w + "px;left:" + ((el.mini.clientWidth - w) / 2) + "px";
  }

  function desenharFerramentas() {
    var velho = el.raiz.querySelector(".fly__ferbox");
    if (velho) velho.remove();
    if (!mapaGrande) return;
    var box = h("div", "fly__ferbox");
    var bt = function (a, ic, sel) { return '<div data-acao="' + a + '" class="' + (sel ? "sel" : "") + '">' + ic + "</div>"; };
    box.innerHTML = '<div class="fly__fer">' + bt("mapaInfo", IC.info, mostrarLegenda) + bt("mapaApagar", IC.borracha) + bt("mapaPiloto", IC.local, centroMapa === "piloto") +
      bt("mapaNorte", IC.norte, !S.norte) + bt("mapaCamadas", IC.camadas, mostrarCamadas) + bt("mapaDrone", IC.aviao, centroMapa === "drone") + "</div>" +
      (mostrarCamadas ? '<div class="fly__painel fly__camadas">' + [["padrao", "Padrão", "#cfeccf"], ["satelite", "Satélite", "#3d5a3a"], ["ambos", "Ambos", "linear-gradient(135deg,#3d5a3a 50%,#cfeccf 50%)"]].map(function (c) {
        return '<div data-acao="camada" data-v="' + c[0] + '" class="' + (S.camada === c[0] ? "sel" : "") + '"><i style="background:' + c[2] + '"></i>' + c[1] + "</div>";
      }).join("") + "</div>" : "") +
      (mostrarLegenda ? '<div class="fly__painel fly__legenda"><div><i style="background:#f7d117;color:#111">H</i>Ponto de origem</div>' +
        '<div><i style="background:#1e88ff;border:.4cqh solid #fff"></i>Aeronave (a seta aponta o nariz)</div><div><i style="background:#fff;border:.6cqh solid #1e88ff"></i>Você (controle remoto)</div>' +
        '<div><i style="background:#1e88ff;border-radius:.4cqh;height:.8cqh"></i>Rota de voo</div></div>' : "");
    el.raiz.insertBefore(box, el.camada);
  }

  /* a cada 100 ms: telemetria, estado, mapa, radar */
  function desenhar() {
    if (!el) return;
    var r = ler(), agora = performance.now();
    if (r) {
      if (anterior && agora > anterior.t) r.vs = (r.y - anterior.y) / ((agora - anterior.t) / 1000);
      else r.vs = 0;
      anterior = { y: r.y, t: agora };
      var voandoAgora = noAr(r);
      /* ponto de origem: onde a aeronave decolou */
      if (!casa || (!noAr(lido) && !voandoAgora)) casa = { x: r.x, z: r.z, y: r.solo };
      if (voandoAgora && !voandoDesde) voandoDesde = agora;
      if (!voandoAgora) voandoDesde = 0;
      if (voandoAgora && agora - ultimaTrilha > 1000) {
        ultimaTrilha = agora;
        var u = trilha[trilha.length - 1];
        if (!u || Math.hypot(u.x - r.x, u.z - r.z) > 1) trilha.push({ x: r.x, z: r.z });
        if (trilha.length > 3000) trilha.shift();
      }
      seguirAutomacao(r);
      seguirFoco(r);
      seguirPerdaDeSinal(r);
    }
    lido = r;
    seguirConexao();
    if (r && !retrato && !retrato_tentado && (r.est === "em solo" || r.est === "concluído")) pedirRetrato();
    if (!mapa && !mapaPedido && r) pedirMapa();

    if (tela === "inicio" && (agora - (desenhar.ultimoInicio || 0) > 2000)) { desenhar.ultimoInicio = agora; desenharInicio(); }
    if (agora > recadoAte && el.toast.style.opacity !== "0") el.toast.style.opacity = "0";
    if (tela !== "camera") return;

    var c = conectado(), ligado = controleLigado() && usb.aceito;
    el.modo.textContent = c ? "Modo " + modo : "N/A";
    var est = el.estado, txt, cls = "";
    if (!ligado) { txt = "Controle remoto não conectado ao dispositivo móvel"; cls = "erro"; }
    else if (!c) { txt = "Aeronave desconectada"; cls = "erro"; }
    else if (!r) { txt = "Conectando..."; }
    else if (r.est === "caiu") { txt = "Aeronave perdida"; cls = "erro"; }
    else if (r.est === "voltando") { txt = "Retornando à base..."; cls = "alerta"; }
    else if (r.est === "pousando" || (auto && auto.nome === "pousar")) { txt = "Aterrissando..."; cls = rthAtivo() ? "alerta" : ""; }
    else if (r.batCritica) { txt = "Bateria criticamente baixa"; cls = "erro"; }
    else if (r.batBaixa) { txt = "Bateria baixa. Retorne à base"; cls = "alerta"; }
    else if (noAr(r)) txt = "Em voo...";
    else txt = "Decolagem permitida";
    if (est.textContent !== txt) est.textContent = txt;
    est.className = "fly__estado" + (cls ? " " + cls : "");

    /* bateria, tempo de voo restante, sinal, GPS */
    if (c && r) {
      var bat = Math.max(0, Math.min(100, r.bat));
      el.batTxt.textContent = Math.round(bat);
      el.batArco.setAttribute("stroke-dashoffset", String(97.4 * (1 - bat / 100)));
      el.batArco.setAttribute("stroke", bat <= 15 ? "#ff3b4a" : bat <= 30 ? "#f5c518" : "#2ee66b");
      var resta = voandoDesde && agora - voandoDesde > 4000 ? Math.max(0, bat / 100 * AUTONOMIA_MIN * 60 - 40) : 0;
      el.tempo.textContent = ("0" + Math.floor(resta / 60)).slice(-2) + "'" + ("0" + Math.floor(resta % 60)).slice(-2) + '"';
      var dOp = Math.hypot(r.x - r.ox, r.z - r.oz);
      var barras = dOp > 6000 ? 1 : dOp > 3000 ? 2 : dOp > 1200 ? 3 : 4;
      for (var b = 1; b <= 4; b++) { var bb = el.sinal.querySelector(".b" + b); if (bb) bb.style.opacity = b <= barras ? "1" : ".3"; }
      el.sat.textContent = String(sateliteBase + Math.round(Math.sin(agora / 40000) * 3) + (noAr(r) ? 3 : 0));
    } else {
      el.batTxt.textContent = "--";
      el.batArco.setAttribute("stroke-dashoffset", "97.4");
      el.tempo.textContent = "--'--\"";
      el.sat.textContent = "0";
    }

    /* telemetria */
    if (c && r && casa) {
      el.th.textContent = fmtM(r.y - casa.y);
      el.tvs.textContent = fmt(Math.abs(r.vs) < 0.05 ? 0 : r.vs, 1) + "m/s";
      el.td.textContent = fmtM(Math.hypot(r.x - casa.x, r.z - casa.z));
      el.ths.textContent = fmt(r.hs, 1) + "m/s";
    } else { el.th.textContent = el.td.textContent = "--m"; el.tvs.textContent = el.ths.textContent = "--m/s"; }
    el.iArm.textContent = c ? (CAM.modo === "video" || CAM.modo === "hyperlapse" ? mmss(videoRestante()) : String(fotosRestantes())) : "N/A";
    el.iFmt.textContent = c ? (CAM.modo === "video" || CAM.modo === "hyperlapse" ? (CAM.video === "lento" && CAM.modo === "video" ? "1080 120" : S.res + " " + S.fps) : S.formato) : "N/A";
    if (gravando) el.recTempo.textContent = mmss((agora - gravando.desde) / 1000);

    /* esquerda: decolar / aterrissar / cancelar */
    var cancelavel = (auto && auto.nome === "pousar") || rthAtivo();
    var queroIcone = cancelavel ? "x" : noAr(r) ? "pousar" : "decolar";
    if (el.bDec.dataset.i !== queroIcone) {
      el.bDec.dataset.i = queroIcone;
      el.bDec.className = "b b-dec" + (cancelavel ? " cancelar" : "");
      el.bDec.innerHTML = (queroIcone === "x" ? IC.fechar : queroIcone === "pousar" ? IC.pousar : IC.decolar) +
        (cancelavel ? '<div class="fly__dica">' + (rthAtivo() ? "Toque para cancelar o RTH" : "Toque para cancelar o pouso") + "</div>" : "");
    }

    /* gimbal: aparece enquanto muda */
    if (r) {
      if (gimbalVisto !== null && Math.abs(r.g - gimbalVisto) > 0.4) gimbalMostrarAte = agora + 1500;
      gimbalVisto = r.g;
      var gmax = S.gimbalCima ? 24 : 0, fr = (gmax - r.g) / (gmax + 90);
      el.gimbal.style.opacity = agora < gimbalMostrarAte ? "1" : "0";
      el.gimbal.querySelector("i").style.top = (fr * 100) + "%";
      var gb = el.gimbal.querySelector("b");
      gb.style.top = (fr * 100) + "%";
      gb.textContent = Math.round(r.g) + "°";
    }

    /* radar de obstaculos */
    radarArco(el.rFrente, c && r && S.radar ? r.frente : null);
    radarArco(el.rTras, c && r && S.radar ? r.tras : null);

    /* alvo na tela */
    if (alvo && r && r.alvo && r.alvo.z < 1 && Math.abs(r.alvo.x) < 1.1 && Math.abs(r.alvo.y) < 1.1 && !mapaGrande) {
      el.alvo.hidden = false;
      el.alvo.classList.toggle("foco", focusTrack);
      el.alvo.style.left = ((r.alvo.x + 1) / 2 * 100) + "%";
      el.alvo.style.top = ((1 - r.alvo.y) / 2 * 100) + "%";
    } else el.alvo.hidden = true;

    /* avisos de bateria e de limite */
    if (r && c) {
      if (r.batCritica && avisoBat < 2) { avisoBat = 2; aviso("Bateria criticamente baixa. A aeronave vai pousar", "erro", 5000); }
      else if (r.batBaixa && avisoBat < 1) { avisoBat = 1; aviso("Nível de bateria baixo. Retorne à base", "alerta", 5000); }
      else if (!r.batBaixa && avisoBat) avisoBat = 0;
      if (r.limite && r.limite !== avisoLimite && agora - r.limite < 800 && r.agora - r.limite < 800) {
        avisoLimite = r.limite;
        aviso(r.limiteTipo === "dist" ? "Distância máxima de voo atingida" : "Altitude máxima atingida (" + S.altMax + " m)", "alerta");
      }
    }
    if (mapaGrande) { if (el.cam.parentNode === el.mini) posicionarPip(); desenharMapa(el.mapaCanvas, r, zoomMapa, centroMapa); }
    else if (!mapaMin) desenharMapa(el.miniCanvas, r, 120, "drone");
    if (el.mini.hidden !== mapaMin) el.mini.hidden = mapaMin;
    el.miniN.style.transform = "rotate(" + (S.norte || !r ? 0 : rotacaoMapa(r)) + "rad)";
  }
  var retrato_tentado = false;

  function radarArco(div, d) {
    if (d === null || d === undefined || d > 12) { div.hidden = true; return; }
    div.hidden = false;
    var cor = d < 2.5 ? "#ff3b4a" : d < 6 ? "#ff8a1f" : "#f5c518";
    div.querySelector("path").setAttribute("stroke", cor);
    var b = div.querySelector("b");
    b.textContent = fmt(d, 1) + "m";
    b.style.color = cor;
  }

  /* perda de sinal: o controle desligou (ou perdeu a ligacao) com a aeronave no ar */
  function seguirPerdaDeSinal(r) {
    var ok = cfg.fase === "pronto";
    if (ligadoAntes && !ok && noAr(r)) { perdaDesde = performance.now(); perdaFeita = false; }
    if (ok) { perdaDesde = 0; perdaFeita = false; }
    ligadoAntes = ok;
    if (!perdaDesde || perdaFeita || !noAr(r) || performance.now() - perdaDesde < 6000) return;
    perdaFeita = true;
    pararTudoAuto();
    if (S.perda === "rth") rth(true);
    else if (S.perda === "descer") ponte.rodar("if (V.estado === 'manual') { V.estado = 'pousando'; V.v = 0; V.rodando = true; }");
  }

  /* ------------------------------------------------------------ mapa */

  function pedirMapa() {
    mapaPedido = true;
    setTimeout(function () {
      try {
        var b = ponte.ler("typeof BASE !== 'undefined' ? {x: BASE.x, z: BASE.z} : null") || { x: 0, z: 0 };
        /* 21/11/2026 (Eduardo: "tem que melhorar significativamente a qualidade da imagem nos controles"): 1280 px para 640 m davam
           50 cm por pixel e o mapa aproximado ficava borrado; 3072 px = 21 cm (a ponte ainda desenha 2x e reduz) */
        var f = ponte.fotografarDeCima({ cx: b.x, cz: b.z, larguraM: 640, alturaM: 640, px: 3072 });
        if (!f || !f.imagem) return;
        var img = new (el.doc.defaultView.Image)();
        img.onload = function () { mapa = { img: img, cx: f.centro.x, cz: f.centro.z, lm: f.larguraM, am: f.alturaM }; };
        img.src = f.imagem;
      } catch (e) { mapaPedido = false; }
    }, 1500);
  }

  /* o modelo 3D chega depois do campo: enquanto o retrato sair vazio (PNG pequeno), tenta de novo */
  var retratoTentativas = 0;
  function pedirRetrato() {
    retrato_tentado = true;
    setTimeout(function () {
      var url = null;
      try { url = ponte.ler("window.xgFlyRetratoDrone ? window.xgFlyRetratoDrone() : null"); } catch (e) { url = null; }
      if (url && url.length > 30000) retrato = url;
      else if (++retratoTentativas < 12) retrato_tentado = false;
      if (tela === "inicio") desenharInicio();
    }, retratoTentativas ? 4000 : 1500);
  }

  function rotacaoMapa(r) {
    /* com o rumo para cima: o nariz (cos, -sin) aponta para o alto da tela */
    var fx = Math.cos(r.yaw), fz = -Math.sin(r.yaw);
    return -Math.PI / 2 - Math.atan2(fz, fx);
  }

  function desenharMapa(c, r, metros, centro) {
    var w = c.clientWidth, h2 = c.clientHeight;
    if (!w || !h2) return;
    var dpr = (el.doc.defaultView.devicePixelRatio) || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h2 * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h2 * dpr); }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var camada = S.camada, claro = camada === "padrao";
    g.fillStyle = claro ? "#d5f2cf" : "#2f3d2c";
    g.fillRect(0, 0, w, h2);
    if (!r) return;
    var s = w / metros;
    var cx = r.x, cz = r.z;
    if (centro === "piloto") { cx = r.ox; cz = r.oz; }
    var rot = S.norte ? 0 : rotacaoMapa(r);
    g.save();
    g.translate(w / 2, h2 / 2);
    g.rotate(rot);
    var px = function (x, z) { return [(x - cx) * s, (z - cz) * s]; };
    if (mapa) {
      var p0 = px(mapa.cx - mapa.lm / 2, mapa.cz - mapa.am / 2);
      /* Padrao: o verde claro do mapa do app, com o campo do jogo em cinza por cima (multiplicado) */
      if (claro) { g.globalCompositeOperation = "multiply"; g.filter = "grayscale(1) brightness(2.1) contrast(.85)"; }
      g.drawImage(mapa.img, p0[0], p0[1], mapa.lm * s, mapa.am * s);
      g.filter = "none"; g.globalCompositeOperation = "source-over";
      if (camada === "ambos") {
        g.globalAlpha = 0.35; g.fillStyle = "#d5f2cf";
        g.fillRect(p0[0], p0[1], mapa.lm * s, mapa.am * s);
        g.globalAlpha = 1;
      }
    }
    /* rastro do voo */
    if (trilha.length > 1) {
      g.strokeStyle = "#1e88ff"; g.lineWidth = Math.max(1.5, w / 260); g.lineJoin = "round";
      g.beginPath();
      trilha.forEach(function (p, i) { var q = px(p.x, p.z); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      var qa = px(r.x, r.z); g.lineTo(qa[0], qa[1]);
      g.stroke();
    }
    /* alvo */
    if (alvo) { var qa2 = px(alvo.x, alvo.z); g.strokeStyle = "#22e36b"; g.lineWidth = 2; g.strokeRect(qa2[0] - 6, qa2[1] - 6, 12, 12); }
    /* pontos da trajetoria */
    CAM.hlPontos.forEach(function (p, i) { var q = px(p.x, p.z); g.fillStyle = "#2f6b45"; g.beginPath(); g.arc(q[0], q[1], 7, 0, 7); g.fill(); });
    var tam = Math.max(9, Math.min(16, h2 * 0.07));
    /* controle remoto (voce) */
    var O = px(r.ox, r.oz);
    g.fillStyle = "#fff"; g.beginPath(); g.arc(O[0], O[1], tam * 0.55, 0, 7); g.fill();
    g.fillStyle = "#1e88ff"; g.beginPath(); g.arc(O[0], O[1], tam * 0.33, 0, 7); g.fill();
    /* ponto de origem: alfinete amarelo com H (fica de pe mesmo com o mapa girado) */
    if (casa) {
      var H = px(casa.x, casa.z);
      g.save(); g.translate(H[0], H[1]); g.rotate(-rot);
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(-tam * 0.4, -tam * 0.9); g.lineTo(0, 0); g.lineTo(tam * 0.4, -tam * 0.9); g.fill();
      g.beginPath(); g.arc(0, -tam * 1.45, tam * 0.95, 0, 7); g.fill();
      g.fillStyle = "#f7d117"; g.beginPath(); g.arc(0, -tam * 1.45, tam * 0.78, 0, 7); g.fill();
      g.fillStyle = "#111"; g.font = "700 " + Math.round(tam * 1.05) + "px Roboto,Arial,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("H", 0, -tam * 1.4);
      g.restore();
    }
    /* aeronave: seta azul no rumo */
    var D = px(r.x, r.z), fx = Math.cos(r.yaw), fz = -Math.sin(r.yaw), ang = Math.atan2(fz, fx);
    g.save(); g.translate(D[0], D[1]); g.rotate(ang);
    g.fillStyle = "#1e88ff"; g.strokeStyle = "#fff"; g.lineWidth = Math.max(1.5, tam * 0.16);
    g.beginPath(); g.moveTo(tam * 1.05, 0); g.lineTo(-tam * 0.7, tam * 0.75); g.lineTo(-tam * 0.3, 0); g.lineTo(-tam * 0.7, -tam * 0.75); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    g.restore();
  }

  /* ------------------------------------------------------------ camera do drone na tela */

  function ligarCamera() {
    var j = janela();
    if (!j || !el) return;
    var alvos = j.xgFpvAlvos;
    if (alvos && alvos.indexOf(el.cam) >= 0) return;
    if (alvos && alvos.push) alvos.push(el.cam);
    else ponte.cameraNoControle([el.cam]);
  }

  /* o que o app_guri.js (DGuri e XGuri Portatil) usa daqui: leitura do voo e a automacao pelos manches */
  var apiGuri = {
    ler: function () { return lido; }, conectado: conectado, ligado: function () { return !!(controleLigado() && usb.aceito); },
    noAr: noAr, decolar: decolar, rth: function () { rth(); }, iniciarAuto: iniciarAuto, cancelarAuto: cancelarAuto, voarCom: voarCom,
    auto: function () { return auto && auto.nome; }, ponte: function () { return ponte; }, janela: janela,
    raiz: function () { return el && el.raiz; }, aviso: aviso,
  };

  /* ------------------------------------------------------------ API */

  return {
    manter: function (p, estado) {
      ponte = p;
      cfg = estado || {};
      instalar();
      if (!campoPronto) return;
      montarTela();
      ligarCamera();
      aplicarModo();
      aplicarAjustes();
      if (!relogio) relogio = setInterval(function () { try { desenhar(); } catch (e) { /* proxima volta */ } }, 100);
    },

    /* botoes do RC-N1 (controle_dji_3d.js e teclado_rc.js); true = tratado aqui */
    botao: function (a, ms) {
      if (a === "pausaRth") { if (ms >= 1000) rth(); else pausar(); return true; }
      if (a === "disparo") { disparar(); return true; }
      /* teclado (teclado_rc.js, 13/10/2026): decolar/pousar segurando 1 s, como no app */
      if (a === "decolarPousar") {
        if (!conectado()) { aviso("Aeronave desconectada", "erro"); return true; }
        if (ms < 1000) { aviso("Segure 1 s para " + (noAr(lido) ? "pousar" : "decolar"), "", 1400); return true; }
        if (noAr(lido)) pousar(); else decolar();
        return true;
      }
      if (a === "fotoVideo") {
        if (gravando || (auto && auto.inteligente)) return true;
        escolherModoCam(CAM.modo === "video" ? "foto" : "video");
        return true;
      }
      if (a === "modoVoo") { this.definirModo(ORDEM[(ORDEM.indexOf(modo) + 1) % ORDEM.length]); return true; }
      if (a === "fn") {
        if (S.fn === "fotoVideo") return this.botao("fotoVideo", 0);
        var j = janela();
        mudarGimbal(j && j.xgGimbal < -45 ? 90 : -90);
        return true;
      }
      if (a === "gimbal") { mudarGimbal(-15); return true; }
      if (a === "bateria") { trocarBateria(); return true; }
      return false;
    },

    /* a chave C/N/S do RC-N1 de verdade (rc_n1.js) manda a posicao, nao "a proxima" */
    definirModo: function (m) {
      if (!MODOS[m] || m === modo) return;
      modo = m;
      aplicarModo();
      aplicarAjustes();
      atualizarCamera();
      avisoModo();
    },

    estado: function () {
      return { tela: tela, modo: modo, camera: CAM, ajustes: S, fotos: midia.length, gravando: !!gravando, auto: auto && auto.nome,
               casa: casa, lido: lido, alvo: alvo, usb: usb, mapa: !!mapa, retrato: !!retrato, painel: painel };
    },
    /* para os testes: abrir uma tela ou painel pelo nome */
    _acao: function (a, v) { acao(a, { getAttribute: function (k) { return k === "data-v" ? v : null; } }, null); },
  };
})();
