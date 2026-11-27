/* ==========================================================================
   MODELO DA AERONAVE

   O campo foi feito para o Agras T50 e carrega o `t50.obj` sozinho. Para
   outra marca, a aeronave e trocada POR FORA, sem editar o campo (a pasta
   `campo/` e copia do jogo e a proxima atualizacao levaria o conserto):
   espera o T50 entrar na cena, tira ele do grupo `inclina` e poe no lugar
   o modelo da marca.

   O voo nao muda nada: o campo move `drone` e inclina `inclina`, e so
   precisa que o modelo olhe para +Z com os pes no y = 0. As helices giram
   pela lista `helices` do campo, que le e escreve `rotation.y` de cada
   item - por isso cada helice do modelo novo entra ali por um adaptador
   que repassa para o eixo em que ela gira no arquivo.

   Uso (principal.js):  MODELO_DRONE.trocar(ponte, modelo, aoTerminar)
   ========================================================================== */

window.MODELO_DRONE = (function () {
  "use strict";

  /* Para cada formato de arquivo: como achar as helices e em que eixo local
     cada uma gira. O P60 veio articulado, com um "Propeller_XX_Pivot" por
     rotor girando em z (o arquivo e z para cima; a raiz ja traz a rotacao
     que deixa y para cima). O sentido de cada rotor e o da animacao
     "Propellers_Spin" do proprio arquivo: FL e RR anti-horario, FR e RL
     horario. */
  var PERFIS = {
    t25: {
      helice: /^Rotor_(FL|FR|RL|RR)$/,
      eixo: "y",
      sentido: { FL: 1, RR: 1, FR: -1, RL: -1 },
      nomeNaTela: "Agras T25",
      // Ajuste didático solicitado pelo operador, não autonomia certificada.
      // Tempos informados de 100% a 15%: 9,5 min vazio e 7 min cheio.
      autonomiaVazioMin: 9.5 / .85,
      autonomiaCheioMin: 7 / .85,
    },
    p60: {
      helice: /^Propeller_(FL|FR|RL|RR)_Pivot$/,
      eixo: "z",
      sentido: { FL: 1, RR: 1, FR: -1, RL: -1 },
      nomeNaTela: "XAG P60",
      /* 18/11/2026 (Eduardo: "o drone ta muito grande perto do auxiliar", "o p60 fica pra baixo da cintura"): o arquivo
         xag_p60.glb tem 2,60 m entre motores na diagonal; a ficha da XAG (xa.com/en/p60/p60specs) da 1,85 m, e o conjunto
         aberto 2,517 x 2,575 x 0,615 m. O modelo entra na medida real: fica com cerca de 0,80 m de altura (arco de protecao). */
      escalaReal: 1.85 / 2.60,
      bateria: "b13970s",       // troca a bateria do arquivo pela de verdade (bateriaB13970S, abaixo)
      /* 18/11/2026 (Eduardo: "Sim, acerta os dois"): a escala acima encolheu tambem as pas (0,86 m de diametro; a ficha da 1,232 m).
         Elas voltam a crescer em volta do eixo, ate 1,08 m: no arquivo os motores da frente e de tras ficam a 1,10 m um do
         outro (no P60 real, 1,31 m), e com 1,232 m as pas se cruzariam. */
      heliceRaio: 0.54, pa: /^Blade_/,
      /* vermelho da XAG (o da carenagem do proprio modelo), no lugar do
         azul que o campo usa para a DJI */
      cor: "#E0232E",
      cor2: "#F0434D",
      corFundo: "224,35,46",
    },
    /* P150 (21/11/2026, xag_p150.glb feito no Mac): Propeller_FR/FL/RL/RR com o pivo no eixo do motor, giro em y; bracos 1 e 3
       (frente direita e tras esquerda) no sentido horario, 2 e 4 no anti-horario (manual do P150) */
    p150: {
      helice: /^Propeller_(FL|FR|RL|RR)$/,
      eixo: "y",
      sentido: { FL: 1, RR: 1, FR: -1, RL: -1 },
      nomeNaTela: "XAG P150",
      cor: "#E0232E",
      cor2: "#F0434D",
      corFundo: "224,35,46",
    },
    /* P150 Max (12/10/2026): helices Helice_<lado>_<posicao>, filhas dos bracos, girando em z
       local; o sentido e o da animacao "Helices_girando" do arquivo. */
    p150max: {
      helice: /^Helice_(E_tras|E_frente|D_tras|D_frente)$/,
      eixo: "z",
      sentido: { E_tras: 1, D_frente: 1, E_frente: -1, D_tras: -1 },
      nomeNaTela: "XAG P150 Max",
      juntar: true,             // 194 pecas: as paradas viram uma por material
      cor: "#E0232E",
      cor2: "#F0434D",
      corFundo: "224,35,46",
    },
    /* P100 Pro (13/10/2026, gerar_p100pro.py): Rotor_1..4 com o pivo no centro do motor,
       giro em y; 1 e 3 num sentido, 2 e 4 no outro (1 = frente direita, horario). */
    p100pro: {
      helice: /^Rotor_([1-4])$/,
      eixo: "y",
      sentido: { 1: 1, 3: 1, 2: -1, 4: -1 },
      nomeNaTela: "XAG P100 Pro",
      juntar: true,
      cor: "#E0232E",
      cor2: "#F0434D",
      corFundo: "224,35,46",
    },
    /* Modelos de 13/10/2026. `voo`: o campo passa a voar com a ficha (marcas.js) -
       tanque, vazao, autonomia, radar e velocidade - e nao com os numeros do T50.
       T100: 4 bracos com rotor coaxial; Rotor_N_Inferior vem com o eixo y invertido,
       entao o mesmo sentido gira ao contrario do de cima, como no real. Sentido da
       animacao "Helices_Girando" do arquivo. */
    t100: {
      helice: /^Rotor_([1-4])_(Superior|Inferior)$/,
      eixo: "y",
      sentido: { 1: -1, 3: -1, 2: 1, 4: 1 },
      nomeNaTela: "Agras T100",
      juntar: true,
      voo: true,
    },
    /* T10: mesma montagem do P150 Max (Helice_<lado>_<posicao>, giro em z local). */
    t10: {
      helice: /^Helice_(E_tras|E_frente|D_tras|D_frente)$/,
      eixo: "z",
      sentido: { E_tras: 1, D_frente: 1, E_frente: -1, D_tras: -1 },
      nomeNaTela: "Agras T10",
      juntar: true,
      voo: true,
    },
    /* EAVision: pivo "<braco>_Rotor" no centro do motor, giro em y local. O arquivo
       nao traz animacao: diagonais opostas no mesmo sentido. */
    j100: {
      helice: /^Braco_(dianteiro_esquerdo|dianteiro_direito|traseiro_esquerdo|traseiro_direito)_Rotor$/,
      eixo: "y",
      sentido: { dianteiro_esquerdo: 1, traseiro_direito: 1, dianteiro_direito: -1, traseiro_esquerdo: -1 },
      nomeNaTela: "EAVision J100",
      juntar: true,             // ~600 pecas
      voo: true,
      cor: "#1E6FD0",
      cor2: "#3C8CE8",
      corFundo: "30,111,208",
    },
  };
  PERFIS.j150 = Object.assign({}, PERFIS.j100, { nomeNaTela: "EAVision J150" });
  /* Ceres Air C31 (13/10/2026): mesmos nomes do T100 (Rotor_N_Superior/Inferior com o pivo
     no centro do motor), mas o de baixo NAO vem invertido: o sentido vai por nivel. */
  PERFIS.c31 = {
    helice: /^Rotor_([1-4]_(?:Superior|Inferior))$/,
    eixo: "y",
    sentido: { "1_Superior": 1, "1_Inferior": -1, "3_Superior": 1, "3_Inferior": -1,
               "2_Superior": -1, "2_Inferior": 1, "4_Superior": -1, "4_Inferior": 1 },
    nomeNaTela: "Ceres Air C31",
    juntar: true,
    voo: true,
  };
  /* DJI Agras T70P (26/10/2026, gerar_t70p.py): 4 bracos, um Rotor_N por motor com o pivo
     no centro dele, giro em y; 1 e 3 num sentido e 2 e 4 no outro (diagonais iguais),
     com o mesmo sinal do T100. */
  PERFIS.t70p = {
    helice: /^Rotor_([1-4])$/,
    eixo: "y",
    sentido: { 1: -1, 3: -1, 2: 1, 4: 1 },
    nomeNaTela: "Agras T70P",
    juntar: true,
    voo: true,
  };
  /* DJI Air 2S (13/10/2026, voo livre): Rotor_N com o pivo no centro do motor, giro em y;
     1 e 3 num sentido, 2 e 4 no outro. Drone pequeno: a folga de colisao usa a helice
     dele (0,09 m), nao a do T50. Limites de voo e camera ficam no app_fly.js. */
  PERFIS.air2s = {
    helice: /^Rotor_([1-4])$/,
    eixo: "y",
    sentido: { 1: 1, 3: 1, 2: -1, 4: -1 },
    nomeNaTela: "Air 2S",
    pequeno: true,
  };

  function trocar(ponte, modelo, aoTerminar) {
    var fim = aoTerminar || function () {};
    var info = modelo && modelo.modelo3d;
    if (!info || !(modelo.id === "t25" || /\.glb$/i.test(info.arquivo || ""))) { fim(false); return; }

    var j = ponte.janela;
    var THREE = j.THREE;
    var perfil = PERFIS[modelo.id] || PERFIS.p60;

    /* a pagina do campo esta em treinamento/campo/, os modelos na raiz */
    var url = "../../" + info.arquivo;

    trocarNomes(j, perfil.nomeNaTela);
    if (perfil.cor) pintar(j, perfil);

    /* O tanque e o da ficha do modelo (marcas.js), nao os 40 L do T50:
       P60 = 30 L (ele confirmou em 26/09/2026). So mexe com a aeronave no
       chao, para nao encher um tanque em voo. */
    var tanque = modelo.specs && Number(modelo.specs.tanque);
    if (tanque > 0) {
      ponte.rodar(
        "(function(){ if (typeof T50 === 'undefined') return;" +
        "  T50.tanque = " + tanque + ";" +
        "  if (typeof V !== 'undefined' && V && V.estado === 'em solo') V.tan = Math.min(V.tan, T50.tanque); })()"
      );
    }

    // O legado chama os parâmetros de T50 mesmo quando a aeronave é T25.
    // Aplicar aqui atende ao voo manual e à rota, sem debitar bateria duas vezes.
    if (modelo.id === "t25") {
      ponte.rodar("T50.autonomiaVazioMin=" + perfil.autonomiaVazioMin +
        ";T50.autonomiaCheioMin=" + perfil.autonomiaCheioMin + ";");
    }
    if (perfil.voo && modelo.specs) aplicarFicha(ponte, modelo.specs);
    /* 18/11/2026 (Eduardo, testando o P60: "p60 vai a 50 km/h"): o app do XAG ja deixava escolher ate 13,8 m/s, mas o campo
       segurava em 10 m/s (36 km/h), o teto do T50. So a velocidade: os outros numeros da ficha do P60 ainda sao "a conferir". */
    if (modelo.id === "p60") ponte.rodar("if (typeof T50 !== 'undefined') { T50.velMax = 13.8; T50.velMaxDesvio = 13.8; }");

    /* O T50 continua sendo baixado pelo campo; enquanto o novo nao chega,
       ele fica escondido para o aluno de XAG nunca ver um DJI. */
    var inclina = ponte.ler("inclina");
    var vigia = setInterval(function () {
      for (var i = 0; i < inclina.children.length; i++) {
        if (!inclina.children[i].userData.xgModelo) inclina.children[i].visible = false;
      }
    }, 30);

    function carregou(cena) {
      esperarT50(ponte, function () {
        clearInterval(vigia);
        montar(ponte, cena, perfil, info);
        fim(true);
      });
    }
    function falhou(erro) {
      clearInterval(vigia);
      if (modelo.id === "t25") {
        for (var n = 0; n < inclina.children.length; n++) inclina.children[n].visible = false;
        console.error("Não foi possível carregar o T25:", erro);
        fim(false);
        return;
      }
      console.warn("modelo " + url + " nao carregou - fica o T50:", erro);
      for (var i = 0; i < inclina.children.length; i++) inclina.children[i].visible = true;
      fim(false);
    }
    if (modelo.id === "t25") carregarT25(THREE, url, carregou, falhou);
    else new THREE.GLTFLoader().load(url, function (gltf) { carregou(gltf.scene); }, undefined, falhou);
  }

  /* T25 em GLB indexado (modelos-3d/t25_glb/converter_t25_glb.py, feito do mesmo OBJ: os mesmos 674 mil
     triangulos, 339 mil vertices em vez de 2 milhoes). O OBJ de 54 MB levava de 2 a 7 s so para o navegador
     le-lo e a tela "Preparando o campo" parecia travada; o GLB abre em ~50 ms. Sem o GLB, ou se ele falhar,
     cai no OBJ de antes. */
  function carregarT25(THREE, url, pronto, falhou) {
    var glb = url.replace(/\.obj$/i, ".glb");
    if (glb === url || typeof THREE.GLTFLoader !== "function") { carregarT25Obj(THREE, url, pronto, falhou); return; }
    var raiz = url.slice(0, url.lastIndexOf("/") + 1);
    var gerente = new THREE.LoadingManager();
    var erro = false, cena;
    gerente.onError = function (arquivo) {
      if (erro) return;
      erro = true;
      console.warn("T25 em GLB indisponivel, usando o OBJ:", arquivo);
      carregarT25Obj(THREE, url, pronto, falhou);
    };
    gerente.onLoad = function () { if (!erro && cena) pronto(cena); };
    var texturas = {};
    ["Body", "Leg", "Wing"].forEach(function (parte) {
      var mapa = new THREE.TextureLoader(gerente).load(raiz + "T25_" + parte + "_texture_BaseColor.1001.jpg");
      mapa.encoding = THREE.sRGBEncoding;
      mapa.flipY = false;          // o glTF guarda o V da textura de cima para baixo
      texturas[parte + "_texture"] = mapa;
    });
    new THREE.GLTFLoader(gerente).load(glb, function (gltf) { cena = acabarT25(THREE, gltf.scene, texturas); });
  }

  /* OBJ em metros, Y para cima e camera em +Z. As oito pas vieram
     dobradas individualmente: abrimos cada par no eixo do seu motor. */
  function carregarT25Obj(THREE, url, pronto, falhou) {
    var raiz = url.slice(0, url.lastIndexOf("/") + 1);
    var gerente = new THREE.LoadingManager();
    var erro = false, cena;
    gerente.onError = function (arquivo) { erro = true; falhou(arquivo); };
    gerente.onLoad = function () { if (!erro && cena) pronto(cena); };
    var texturas = {};
    ["Body", "Leg", "Wing"].forEach(function (parte) {
      var mapa = new THREE.TextureLoader(gerente).load(raiz + "T25_" + parte + "_texture_BaseColor.1001.jpg");
      mapa.encoding = THREE.sRGBEncoding;
      texturas[parte + "_texture"] = mapa;
    });
    new THREE.OBJLoader(gerente).load(url, function (obj) { cena = acabarT25(THREE, obj, texturas); });
  }

  /* Materiais, decalques e os quatro rotores do T25, iguais para o GLB e para o OBJ. No GLB os nomes vem
     sem ponto ("F.motorwing3.002" vira "F_motorwing3_002"). */
  function acabarT25(THREE, obj, texturas) {
    function achar(nome) { return obj.getObjectByName(nome) || obj.getObjectByName(nome.replace(/\./g, "_")); }
    var materiais = {};
    function material(original) {
      var nome = original.name;
      if (materiais[nome]) return materiais[nome];
      return materiais[nome] = new THREE.MeshStandardMaterial({
        map: texturas[nome] || null,
        color: texturas[nome] ? 0xffffff : /White|Glass|glass/.test(nome) ? 0xc8d0d3 : 0x222629,
        roughness: 0.58, metalness: 0.12,
      });
    }
    obj.traverse(function (o) {
      if (!o.isMesh) return;
      // Decalques sem imagem no pacote de texturas nao viram placas opacas.
      if (/^(DJI_logo|Sticker)/.test(o.name)) { o.visible = false; return; }
      o.material = Array.isArray(o.material) ? o.material.map(material) : material(o.material);
    });
    var motores = [
      ["FR", "F.motorwing3", ""], ["RR", "B.motorwing3", ".002"],
      ["FL", "F.motorwing3.002", ".003"], ["RL", "B.motorwing3.002", ".004"],
    ];
    motores.forEach(function (motor) {
      var suporte = achar(motor[1]);
      var caixa = new THREE.Box3().setFromObject(suporte);
      var centro = caixa.getCenter(new THREE.Vector3());
      var rotor = new THREE.Group();
      rotor.name = "Rotor_" + motor[0];
      rotor.position.copy(centro);
      [1, 2].forEach(function (numero) {
        var pa = achar("Front_properller" + numero + motor[2]);
        var meio = new THREE.Box3().setFromObject(pa).getCenter(new THREE.Vector3());
        pa.geometry.translate(-centro.x, -centro.y, -centro.z);
        pa.rotation.y = (numero === 1 ? 0 : Math.PI) - Math.atan2(meio.x - centro.x, meio.z - centro.z);
        rotor.add(pa);
      });
      obj.add(rotor);
    });
    return obj;
  }

  /* Numeros do voo vindos da ficha (so modelos com `voo` no perfil). Autonomia como a
     do T25: a ficha da de 100% ate o fim; o campo conta ate a reserva de 15%. */
  function aplicarFicha(ponte, s) {
    var campos = {
      vazaoMaxLmin: Math.max(Number(s.vazaoMax2Bicos) || 0, Number(s.vazaoMax4Bicos) || 0),
      autonomiaVazioMin: s.vooParadoVazio / 0.85,
      autonomiaCheioMin: s.vooParadoCheio / 0.85,
      radarAlcance: s.radarAlcance,
      velMaxDesvio: s.velocidadeMaxObstaculo,
      velMax: s.velocidadeMax,
    };
    var js = "";
    Object.keys(campos).forEach(function (k) {
      var v = Number(campos[k]);
      if (isFinite(v) && v > 0) js += "T50." + k + "=" + (+v.toFixed(3)) + ";";
    });
    ponte.rodar("(function(){ if (typeof T50 === 'undefined') return; " + js + " })()");
  }

  /* O T50 entra em `inclina` no fim do carregamento dele; so depois disso
     da para tirar. */
  function esperarT50(ponte, pronto) {
    var tentativas = 0;
    (function olhar() {
      if (ponte.ler("inclina.children.length") > 0 || ++tentativas > 600) { pronto(); return; }
      setTimeout(olhar, 50);
    })();
  }

  function montar(ponte, cena, perfil, info) {
    var j = ponte.janela;
    var THREE = j.THREE;
    var inclina = ponte.ler("inclina");
    var helices = ponte.ler("helices");
    var T50 = ponte.ler("T50");

    /* fora o T50 e as helices dele */
    while (inclina.children.length) inclina.remove(inclina.children[0]);
    helices.length = 0;

    var modelo = new THREE.Group();
    modelo.userData.xgModelo = true;
    modelo.add(cena);

    var escala = (info.escala || 1) * (perfil.escalaReal || 1);
    cena.scale.multiplyScalar(escala);
    if (info.girarY) cena.rotation.y += info.girarY;   // arquivo olhando para -Z (P150 Max)
    cena.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });

    if (perfil.bateria === "b13970s") { try { bateriaB13970S(THREE, cena); } catch (e) { /* fica a bateria do arquivo */ } }
    if (perfil.juntar) juntarPecas(THREE, cena, perfil);

    /* pes no chao e centro no eixo do voo, como o campo fazia com o T50 */
    cena.updateMatrixWorld(true);
    var caixa = new THREE.Box3().setFromObject(cena);
    var centro = caixa.getCenter(new THREE.Vector3());
    cena.position.x -= centro.x;
    cena.position.z -= centro.z;
    cena.position.y -= caixa.min.y;

    /* helices: adaptador de rotation.y para o eixo do arquivo */
    var raio = 0;
    cena.traverse(function (o) {
      var m = perfil.helice.exec(o.name || "");
      if (!m) return;
      helices.push(adaptador(o, perfil.eixo, perfil.sentido[m[1]] || 1));
      raio = Math.max(raio, raioDaHelice(THREE, o));
    });

    /* A folga de colisao do campo soma o raio da helice: vale o do P60,
       medido no proprio arquivo, e nao o do T50. */
    /* helices no tamanho pedido pelo perfil: so as pas crescem (no plano do rotor), o cubo fica como esta */
    if (perfil.heliceRaio && perfil.pa && raio > 0.05) {
      var kPa = perfil.heliceRaio / raio;
      helices.forEach(function (h) {
        (h.alvo ? h.alvo.children : []).forEach(function (f) {
          if (!perfil.pa.test(f.name || "")) return;
          ["x", "y", "z"].forEach(function (e) { if (e !== perfil.eixo) f.scale[e] *= kPa; });
        });
      });
      raio = perfil.heliceRaio;
    }
    if (raio > 0.2 || (perfil.pequeno && raio > 0)) T50.raioHelice = +raio.toFixed(2);

    inclina.add(modelo);

    j.XG_MODELO = {
      nome: perfil.nomeNaTela,
      medidas: caixa.getSize(new THREE.Vector3()),
      raioHelice: T50.raioHelice,
      helices: helices.length,
    };
  }


  /* Bateria do P60 (18/11/2026, Eduardo: "a bateria do xag ta errada", "olha na internet como ela e"). A do arquivo e uma caixa
     baixa e escura (0,23 x 0,20 x 0,27 m). A de verdade (Smart SuperCharge B13970S, foto em xa.com/en/p60) e uma caixa ALTA
     cinza-clara, com cantos de borracha pretos, tampa preta com alca, conector preto e etiqueta amarela; as medidas sao as da
     irma B13960S (189 x 139 x 317 mm), porque a ficha do P60 nao traz o tamanho. As pecas do no Battery_Removable sao trocadas
     por esta, no mesmo lugar: o auxiliar e a mesa do carregador (equipe.js) copiam a bateria deste no. */
  function bateriaB13970S(THREE, cena) {
    var no = null;
    cena.traverse(function (o) { if (!no && /^Battery_Removable$/i.test(o.name || "")) no = o; });
    if (!no) return false;
    cena.updateMatrixWorld(true);
    var cx = new THREE.Box3().setFromObject(no);
    if (cx.isEmpty()) return false;
    var c = cx.getCenter(new THREE.Vector3());
    var L = 0.189, H = 0.317, W = 0.139, corpoH = H - 0.03;
    var base = cx.max.y + 0.04 - H;                              // o alto fica um pouco acima do da bateria antiga
    var velhas = [];
    no.traverse(function (o) { if (o.isMesh) velhas.push(o); });
    velhas.forEach(function (o) { if (o.parent) o.parent.remove(o); });

    var g = new THREE.Group(); g.name = "Bateria_B13970S";
    function mat(cor, rug, met) { return new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met || 0 }); }
    function caixa(nome, w, h, d, x, y, z, m) {
      var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.name = nome; o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o;
    }
    var prata = mat("#c5c9cd", 0.42, 0.3), preto = mat("#16181b", 0.75), amarelo = mat("#f0c419", 0.6);
    caixa("Bateria_corpo", L - 0.008, corpoH, W - 0.008, 0, corpoH / 2, 0, prata);
    /* furos de ventilacao da frente e de tras: pontos escuros em colunas */
    var furos = prata;
    try {
      var cv = document.createElement("canvas"); cv.width = 96; cv.height = 160;
      var x2 = cv.getContext("2d"); x2.fillStyle = "#c5c9cd"; x2.fillRect(0, 0, 96, 160); x2.fillStyle = "#43474c";
      for (var col = 0; col < 8; col++) {
        var linhas = 9 + Math.round(4 * Math.sin((col + 0.5) / 8 * Math.PI));
        for (var lin = 0; lin < linhas; lin++) { x2.beginPath(); x2.arc(10 + col * 11, 150 - lin * 11, 3, 0, 6.3); x2.fill(); }
      }
      var tx = new THREE.CanvasTexture(cv); if (THREE.sRGBEncoding) tx.encoding = THREE.sRGBEncoding;
      furos = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.45, metalness: 0.3 });
    } catch (e) { /* sem a textura: chapa lisa */ }
    [-1, 1].forEach(function (s) {
      var p = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.62, corpoH * 0.66), furos);
      p.name = "Bateria_furos"; p.position.set(0, corpoH * 0.42, s * (W / 2 - 0.0035)); if (s < 0) p.rotation.y = Math.PI; g.add(p);
    });
    /* cantos de borracha, em cima e embaixo */
    [-1, 1].forEach(function (sx) { [-1, 1].forEach(function (sz) {
      caixa("Canto_bateria", 0.036, 0.046, 0.036, sx * (L / 2 - 0.014), 0.023, sz * (W / 2 - 0.014), preto);
      caixa("Canto_bateria", 0.036, 0.05, 0.036, sx * (L / 2 - 0.014), corpoH - 0.025, sz * (W / 2 - 0.014), preto);
    }); });
    caixa("Bateria_tampa", L, 0.02, W, 0, corpoH + 0.01, 0, preto);
    /* alca dobrada sobre a tampa */
    caixa("Alca_bateria", L * 0.56, 0.012, 0.026, 0, corpoH + 0.036, 0, preto);
    [-1, 1].forEach(function (s) { caixa("Alca_bateria", 0.014, 0.022, 0.026, s * L * 0.27, corpoH + 0.026, 0, preto); });
    /* conector e etiqueta na face de tras (a que fica virada para quem troca) */
    caixa("Bateria_conector", 0.07, 0.062, 0.034, -0.038, corpoH - 0.058, -(W / 2 + 0.012), preto);
    caixa("Etiqueta_bateria", 0.042, 0.016, 0.003, 0.055, corpoH - 0.034, -(W / 2 - 0.002), amarelo);

    g.position.set(c.x, base, c.z);
    g.updateMatrix();
    g.applyMatrix4(new THREE.Matrix4().copy(no.matrixWorld).invert());
    no.add(g);
    return true;
  }

  /* Pecas que nao se mexem (fora das helices) juntadas por material, no
     espaco da raiz do arquivo: menos chamadas de desenho no celular. */
  function juntarPecas(THREE, cena, perfil) {
    var U = THREE.BufferGeometryUtils;
    if (!U || !U.mergeBufferGeometries) return;
    cena.updateMatrixWorld(true);
    var paraRaiz = cena.matrixWorld.clone().invert(), porMat = new Map();
    cena.traverse(function (o) {
      if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
      for (var p = o; p && p !== cena; p = p.parent) if (perfil.helice.test(p.name || "")) return;
      var geo = o.geometry.clone().applyMatrix4(paraRaiz.clone().multiply(o.matrixWorld));
      if (!geo.index) geo.setIndex(Array.from({ length: geo.attributes.position.count }, function (_, i) { return i; }));
      if (!porMat.has(o.material)) porMat.set(o.material, { geos: [], pecas: [] });
      porMat.get(o.material).geos.push(geo); porMat.get(o.material).pecas.push(o);
    });
    porMat.forEach(function (g, mat) {
      var comUv = !!mat.map && g.geos.every(function (x) { return x.attributes.uv; });
      g.geos.forEach(function (x) { if (!comUv) x.deleteAttribute("uv"); ["uv2", "color", "tangent"].forEach(function (a) { x.deleteAttribute(a); }); });
      var junto = U.mergeBufferGeometries(g.geos);
      if (!junto) return;                                   // nao juntou: as pecas ficam como vieram
      g.pecas.forEach(function (o) { o.parent.remove(o); });
      cena.add(new THREE.Mesh(junto, mat));
    });
  }

  /* O campo faz `h.rotation.y += ...` e le `h.userData.sentido`. */
  function adaptador(pivo, eixo, sentido) {
    return {
      userData: { sentido: sentido },
      rotation: {
        get y() { return pivo.rotation[eixo]; },
        set y(v) { pivo.rotation[eixo] = v; },
      },
      alvo: pivo,
    };
  }

  /* Maior distancia horizontal de um vertice das pas ao eixo do rotor. */
  function raioDaHelice(THREE, pivo) {
    pivo.updateMatrixWorld(true);
    var eixo = new THREE.Vector3().setFromMatrixPosition(pivo.matrixWorld);
    var p = new THREE.Vector3();
    var raio = 0;
    pivo.traverse(function (o) {
      if (!o.isMesh) return;
      var pos = o.geometry.attributes.position;
      for (var i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        raio = Math.max(raio, Math.hypot(p.x - eixo.x, p.z - eixo.z));
      }
    });
    return raio;
  }

  /* Os letreiros do campo que dizem "Agras T50" passam a dizer o nome da
     aeronave da marca. So texto de tela; nada de logica depende deles. */
  function trocarNomes(j, nome) {
    var d = j.document;
    d.title = d.title.replace(/T50/g, nome);
    var alvos = d.querySelectorAll("#carregando, h1 span, .sobre");
    for (var i = 0; i < alvos.length; i++) {
      var t = alvos[i];
      if (t.children.length === 0 && /Agras T50/.test(t.textContent)) {
        t.textContent = t.textContent.replace(/Agras T50/g, nome);
      }
    }
  }

  /* O campo pinta os destaques com --azul/--azul2 e alguns fundos com o
     azul escrito direto (rgba 47,128,237): sobrescreve os dois. */
  function pintar(j, perfil) {
    var d = j.document;
    if (d.getElementById("xg-cor-marca")) return;
    var f = perfil.corFundo;
    var css = d.createElement("style");
    css.id = "xg-cor-marca";
    css.textContent =
      ":root{--azul:" + perfil.cor + ";--azul2:" + perfil.cor2 + "}" +
      ".cen button[aria-pressed=\"true\"]{background:rgba(" + f + ",.12)}" +
      ".seg button[aria-pressed=\"true\"]{background:rgba(" + f + ",.14)}" +
      ".avatares button[aria-pressed=\"true\"]{background:rgba(" + f + ",.18)}" +
      ".deslizar input::-webkit-slider-thumb{box-shadow:0 0 0 6px rgba(" + f + ",.25)}";
    d.head.appendChild(css);
  }

  return { trocar: trocar };
})();
