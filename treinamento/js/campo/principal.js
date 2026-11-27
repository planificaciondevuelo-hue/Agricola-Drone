/* ==========================================================================
   O SIMULADOR

   A camada de treinamento por cima do campo: mostra a instrucao, acompanha
   o que o aluno faz la dentro e fecha a etapa com boletim.

   URL: sim.html?marca=dji&modelo=t50&cenario=plano&etapa=mapear
   ========================================================================== */

(async function () {
  "use strict";

  var sessao = window.SESSAO.exigir("conta/index.html");
  if (!sessao) return;

  var url = new URLSearchParams(window.location.search);
  var exigirContaOnline = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);

  /* Aluno da area de conta so entra no simulador pelo Iniciar sessao
     (conta/drones.html), que traz o drone e o controle e liga o medidor
     de horas. Aberto de outro jeito, volta para a escolha do drone. */
  if ((exigirContaOnline || sessao.origem === "conta") && !url.get("drone")) {
    window.location.replace("conta/drones.html");
    return;
  }
  var marcaId = url.get("marca") || sessao.marcas[0];
  var modeloId = url.get("modelo") || "t50";
  var cenarioId = url.get("cenario") || "plano";
  var etapaId = url.get("etapa") || "conhecer";
  var modo = url.get("modo") || "aula";

  if (exigirContaOnline || sessao.origem === "conta" || marcaId === "eavision" || modeloId === "j100" || url.get("drone") === "j100" || marcaId === "xag" || modeloId === "p60" || modeloId === "t25" || url.get("drone") === "t25" || url.get("drone") === "p60" || url.get("drone") === "p150max" || /^(t100|t70p|t10|j150|c31|air2s)$/.test(modeloId) || /^(t100|t70p|t10|j150|c31|air2s)$/.test(url.get("drone") || "")) {
    var droneConta = url.get("drone");
    var combinacoes = { t50: ["dji", "t50"], t25: ["dji", "t25"], t100: ["dji", "t100"], t70p: ["dji", "t70p"], t10: ["dji", "t10"], p60: ["xag", "p60"], p150max: ["xag", "p150max"], p150: ["xag", "p150"], p100pro: ["xag", "p100pro"], j100: ["eavision", "j100"], j150: ["eavision", "j150"], c31: ["dji", "c31"], air2s: ["dji", "air2s"] };   // c31 = Ceres Air (app do T50), 13/10/2026; air2s = voo livre
    var esperado = Object.prototype.hasOwnProperty.call(combinacoes, droneConta) && combinacoes[droneConta];
    if (!esperado || marcaId !== esperado[0] || modeloId !== esperado[1]) {
      window.location.replace("conta/drones.html");
      return;
    }
    window.TREINO_AUTORIZADO = window.CONTAS.iniciar().then(function (conta) {
      if (!conta) throw new Error("Entre na sua conta.");
      return window.CONTAS.iniciarTreino(droneConta, url.get("controle") || "");
    });
    try { await window.TREINO_AUTORIZADO; }
    catch (e) {
      document.getElementById("carregando-titulo").textContent = "Não foi possível iniciar o treino";
      document.getElementById("carregando-passo").textContent = e.message || "Tente novamente em alguns instantes.";
      document.getElementById("carregando-voltar").classList.remove("esconder");
      return;
    }
  }

  var marca = window.MARCAS[marcaId] || window.MARCAS.dji;
  // A resposta autenticada do servidor libera a versão administrativa.
  // Não guardar esta permissão em localStorage nem em checkpoints.
  if (marcaId === "dji" && window.TREINO_AUTORIZADO && window.APP_RCPLUS) {
    await APP_RCPLUS.autorizarMapeamento(modeloId);
  }
  var modelo = (marca.modelos || []).filter(function (m) { return m.id === modeloId; })[0]
            || (marca.modelos || [])[0];

  // Ativado somente depois da autorizacao do treino J100.
  // O app EAV (controle-app/j100*.js) e o mesmo no J100 e no J150 (13/10/2026).
  window.J100_TESTE = marcaId === "eavision" && (modeloId === "j100" || modeloId === "j150");

  /* App do T10 (16/10/2026): a tela do controle do T10 refeita pelas gravacoes dele
     (controle-app/t10.js + t10.css, 16:9, sem a marca), com as DUAS cameras fixas do T10
     (camera_t10.js). Em localhost, ?app=t10 liga o mesmo app em qualquer drone DJI (teste). */
  window.T10_APP = marcaId === "dji" && (modeloId === "t10" ||
    (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && url.get("app") === "t10"));
  if (window.T10_APP && window.CONTROLE_DJI_3D && CONTROLE_DJI_3D.configurar) CONTROLE_DJI_3D.configurar({ razaoApp: 16 / 9 });

  var ORDEM = ["conhecer", "mapear", "parametros", "decolar", "aplicar"];
  var etapa = window.ETAPAS_CAMPO.criar(etapaId) || window.ETAPAS_CAMPO.criar("conhecer");

  var chaveTreino = marcaId + "/" + (modelo ? modelo.id : "t50") + "/" + cenarioId;

  /* XAG: o aparelho e o site do controle XAG P60 (tela integrada com o app
     XAG One), e nao o RC Plus. O resto do treinamento e o mesmo. */
  var ehXag = marcaId === "xag";
  /* T10/T30 (13/10/2026): o controle e o smart controller em 3D
     (controle_dji_3d.js), com o mesmo app do T25/T50. Em localhost, ?rc=t10
     mostra o mesmo controle em outro drone DJI, para testar sem conta. */
  var rcT10 = marcaId === "dji" && (/^(t10|t30)$/.test(modeloId) ||
    (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && url.get("rc") === "t10"));
  /* J100/J150 (13/10/2026): EAV-RC50 / EAV-RC60 em 3D pelo mesmo modulo do T10
     (modelos de D:\Area de trabalho\modelos-3d\controles_eavision, sem a marca),
     com o app EAV no vidro. Mesmo ramo do rcT10 daqui para baixo. */
  if (marcaId === "eavision" && /^(j100|j150)$/.test(modeloId) && window.CONTROLE_DJI_3D && CONTROLE_DJI_3D.configurar) {
    CONTROLE_DJI_3D.configurar({
      arquivo: "../../assets/modelos/" + (modeloId === "j150" ? "eavision_rc60.glb" : "eavision_rc50.glb"),
      pecas: [[/^Botao_ligar/, "energia"], [/^Botao_RTH/, "rth"], [/^Botao_topo_direito/, "pausa"],
              [/^Botao_voltar/, "voltar"], [/^Joystick_Esquerdo/, "esq"], [/^Joystick_Direito/, "dir"]],
    });
    rcT10 = true;
  }
  /* Air 2S (13/10/2026): categoria "Mapeamento / voo livre". Controle RC-N1 (sem tela)
     com o celular no suporte, pelo mesmo modulo do T10. A tela do celular e o app de voo
     (app_fly.js) por cima do app do T25/T50, que continua por baixo so para ligar e
     conectar o aparelho. Nao pulveriza: sem calda, sem auxiliar e sem radar de terreno. */
  var vooLivre = !!(modelo && modelo.vooLivre);
  if (vooLivre && window.CONTROLE_DJI_3D && CONTROLE_DJI_3D.configurar) {
    CONTROLE_DJI_3D.configurar({
      arquivo: "../../" + modelo.controle3d,
      razaoApp: 0,                 // o app de voo ocupa o vidro inteiro do celular
      margemTopo: 44,              // o celular fica abaixo da barra de clima do campo
      focoTela: { largura: 0.46, altura: 0.5, topo: 0.02 },   // vista Controle: o celular grande no alto (13/10/2026)
      pecas: [[/^Botao_ligar/, "energia"], [/^Botao_RTH/, "pausaRth"], [/^Botao_foto_video/, "fotoVideo"],
              [/^Botao_disparo/, "disparo"], [/^Seletor_Modo/, "modoVoo"], [/^Botao_Fn/, "fn"],
              [/^Roda_gimbal/, "gimbal"], [/^Joystick_Esquerdo/, "esq"], [/^Joystick_Direito/, "dir"]],
    });
    rcT10 = true;
  }
  // O documento inicial fica vazio ate a autorizacao. replace evita criar
  // uma entrada DJI no historico conjunto dos iframes de uma sessao XAG.
  $("controle").contentWindow.location.replace(new URL(ehXag ? "controle-xag/index.html" : "controle/index.html?v=20261007hd3", window.location.href).href);
  if (ehXag) {
    $("controle").title = "Controle XAG " + (modelo && modelo.nome ? modelo.nome : "P60");
    /* o site do controle e claro e o treinamento e escuro: com esquemas
       diferentes o navegador pinta o iframe de branco por baixo, e o campo
       sumia atras do aparelho */
    $("controle").style.colorScheme = "light";
  }

  function $(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------- a guia */

  var indice = ORDEM.indexOf(etapa.id);
  $("guia-etapa").textContent = "Etapa " + (indice + 1) + " de " + ORDEM.length;
  $("guia-titulo").textContent = etapa.titulo;
  $("guia-instrucao").textContent = etapa.instrucao
    .replace(/\bT50\b/g, modelo ? modelo.nome : "T50");
  $("guia-porque").textContent = etapa.porque || "";

  if (modo === "prova") {
    document.body.classList.add("modo-prova");
    $("guia-instrucao").textContent = "Prova: faça a etapa sem instrução.";
    $("guia-conferir").classList.add("esconder");
    $("guia-porque").parentNode.classList.add("esconder");
  }

  /* Treino livre: o painel de instrucoes permanece oculto, inclusive
     durante a sequencia de ligar o controle. */
  $("guia").hidden = !!etapa.livre;
  if (etapa.livre) {
    document.body.classList.add("modo-livre");
    $("guia-etapa").textContent = "Treino livre";
    $("guia-conferir").classList.add("esconder");
    $("guia-porque").parentNode.classList.add("esconder");
    $("guia").classList.add("esconder");
  }

  $("btn-recolher").addEventListener("click", function () {
    var guia = $("guia");
    guia.classList.toggle("guia--recolhida");
    this.textContent = guia.classList.contains("guia--recolhida") ? "+" : "−";
  });

  /* ------------------------------------------------------------- a ponte */

  var ponte = window.PONTE.criar($("campo"));
  var vinculo = null;
  var operacao = null;
  var manual = null;
  var fisicaInstalada = false;
  var gnss = null;
  var equipe = null;
  var radar = null;
  var ajustes = null;
  var editorRota = null;
  var aparelho = null;        // XAG: botoes, manches e tela de voo do aparelho
  var cicloCobertura = 0;
  var ultimaCobertura = null;
  var vistaPedida = "drone";
  var concluida = false;
  var ultimoEstado = {};

  $("carregando-titulo").textContent = vooLivre ? modelo.modeloOficial : marca.nome + " " + (modelo ? modelo.nome : "");   // Air 2S nao e "Agras"

  ponte.esperar(function () {
    /* XAG: o RC Plus da DJI que o jogo desenha NUNCA aparece - nem no
       instante entre abrir a vista Controle e o ciclo esconde-lo (pedido
       dele: "em hipotese alguma"). Regra fixa no campo, antes de tudo;
       visibility e nao display, para o layout do jogo continuar o mesmo. */
    if (ehXag) {
      ponte.rodar(
        "(function(){" +
        "  var e = document.createElement('style');" +
        "  e.textContent = '#vCtrlRc,#tela{visibility:hidden!important}';" +
        "  document.head.appendChild(e);" +
        "})()"
      );
    }

    /* O campo entra direto no cenario que o aluno escolheu no painel, sem
       as telas de escolha e de configuracao: o terreno ja foi decidido e o
       resto se ajusta no controle. */
    ponte.embutir(cenarioId);

    /* No Treino livre ninguem escolheu o terreno antes: ele e escolhido na
       tela inicial do campo, junto do nome e do operador. Trocar de terreno
       invalida o que foi medido no anterior - a foto do mapa do controle, a
       caixa onde o campo pinta e a cobertura. */
    if (etapa.livre) {
      ponte.seletorDeTerreno(cenarioId, function (novo) {
        cenarioId = novo;
        ultimaCobertura = null;
        if (vinculo) { vinculo.foto = null; vinculo.caixa = null; }
        ponte.prepararCobertura();
      });
    }

    /* Vista "Controle" = o aparelho de verdade por cima do campo. */
    ponte.aoTrocarVista(function (v) {
      vistaPedida = v;
      /* o aparelho entra no mesmo toque, sem esperar a proxima volta do ciclo */
      try { acompanharUmaVez(); } catch (e) { /* o ciclo tenta de novo */ }
    });

    /* O campo aparece atrás do aparelho em vez do fundo preto. */
    ponte.campoAtrasDoAparelho(true);

    /* Vista "Operador" = visão do piloto: dos olhos dele, olhando para o
       drone, com o aparelho baixo e só a parte de cima à mostra. */
    if (!ehXag) ponte.visaoDoPiloto();
    /* XAG (10/10/2026): Operador = campo + aparelho baixo; Controle = aparelho grande e perto */
    else if (window.CONTROLE_XAG_3D && window.CONTROLE_XAG_3D.vistasDoXag) window.CONTROLE_XAG_3D.vistasDoXag(ponte);

    /* A rota voada é a planejada no controle: ângulo, segmentação e área
       de cobertura. Sem plano, o campo gera a dele como sempre. */
    ponte.instalarRotaPlanejada();

    /* E o vínculo: a foto do campo vira o mapa do controle, e o talhão
       desenhado lá vira o talhão daqui.

       Dentro de try: o treinamento tem de abrir mesmo que o vínculo falhe
       — sem isso, um erro aqui deixava o aluno preso na tela de carregar. */
    try {
      vinculo = (ehXag ? window.VINCULO_XAG : window.VINCULO).criar(ponte, $("controle"));
      vinculo.aoCarregarTalhao = function (r) {
        if (r.erro) { avisar(r.erro); return; }
        avisar("Talhão \"" + r.nome + "\" carregado no campo: " +
               r.areaCampo.toFixed(2).replace(".", ",") + " ha, " +
               r.pontos + " pontos.");

        /* a nota passa a ser medida dentro DESTE talhão, não do retângulo
           fixo do cenário */
        ponte.prepararCobertura();
      };

      /* O caminho de volta: decolar pelo controle e ver o voo na tela. */
      if (ehXag) {
        /* no XAG One quem decola e o "Iniciar" da tela Operação */
        vinculo.aoDecolar = function (r) {
          avisar(r && r.ok ? "Aeronave em operação: " + r.pontos + " pontos de rota."
                           : "A aeronave não decolou (" + (r ? r.motivo : "sem campo") +
                             "). Confira o limite do mapa e a rota no XAG One.");
        };

        /* os manches do aparelho XAG usam o mesmo voo manual do RC Plus;
           os recados dele aparecem na tela do aparelho */
        manual = window.MANUAL.criar(ponte, $("controle"));
        manual.operacao = { avisar: function (t) { if (aparelho && t) aparelho.avisar(t); } };
        aparelho = window.APARELHO_XAG.criar(ponte, $("controle"), vinculo, manual);
        vinculo.aparelho = aparelho;
        aparelho.instalar();
        /* 12/10/2026 (Eduardo): o auxiliar (bateria, tanque, misturador) tambem no XAG */
        if (window.EQUIPE) equipe = window.EQUIPE.criar(ponte);
        /* as telas do XAG One (telas_xag.js) medem em metros pelo vinculo */
        if (window.TELAS_XAG) window.TELAS_XAG.vinculo = vinculo;
      } else {
        operacao = window.OPERACAO.criar(ponte, $("controle"));
        /* para desenhar o mapa real na tela de execução, em pixels do controle */
        operacao.vinculo = vinculo;
        /* verde o feito, amarelo o que falta, cinza o feito antes de
           desligar o controle; retoma de onde parou */
        operacao.andamento = window.ANDAMENTO.criar(ponte, "tpd_dji_andamento");
        operacao.aoDecolar = function (r) {
          avisar("Aeronave em operação: " + r.pontos + " pontos de rota.");
        };

        /* O voo manual pelos manches, no modo do joystick escolhido no
           controle (Modo 2 de fábrica). */
        manual = window.MANUAL.criar(ponte, $("controle"));
        manual.operacao = operacao;
        operacao.manual = manual;
        /* 13/10/2026 (Eduardo): "se o controle nao ligar o drone nao pode voar" - os manches
           so comandam a aeronave com o controle ligado e conectado (fase "pronto") */
        manual.controlePronto = function () {
          return !vinculo || !vinculo.faseDoAparelho || vinculo.faseDoAparelho() === "pronto";
        };

        /* As chaves do app (radar, estabilização, desvio, cenário, RTH,
           pulverização, limites) mudando o voo de verdade. */
        ajustes = window.AJUSTES.criar(ponte, $("controle"));

        /* GNSS: o erro que anda com o tempo e o Retificar a compensação (gnss.js) */
        if (window.GNSS) { gnss = window.GNSS.criar(ponte, $("controle")); gnss.vinculo = vinculo; }
        /* operador e badeco sentados; o badeco abastece e troca bateria (equipe.js) */
        if (window.EQUIPE && !vooLivre) equipe = window.EQUIPE.criar(ponte);
        /* radar de terreno: eficiencia pela carga e pela velocidade (radar.js) */
        if (window.RADAR && !vooLivre) radar = window.RADAR.criar(ponte, !ehXag);

        /* As janelas de Ângulo da rota e Segmentação do editor. */
        editorRota = window.EDITOR_ROTA.criar($("controle"));
      }
    } catch (e) {
      console.warn("vínculo com o controle indisponível:", e);
    }

    /* Marca com aeronave propria (XAG P60): o carregando so sai quando a
       aeronave certa ja esta na cena - o aluno de XAG nao ve o T50. */
    /* gota, vento e bicos (pulverizacao.js): vale para qualquer marca */
    // O manual substitui o passo e o esgotamento. Deve entrar antes da calda.
    if (manual && !manual.instalado) manual.instalar();
    if ((!manual || manual.instalado) && window.VORTICE && !vooLivre) window.VORTICE.instalar(ponte, modelo);
    if (!manual || manual.instalado) window.PULVERIZACAO.instalar(ponte, modelo);

    /* XAG P60: duas cameras fixas (frente e baixo), sem gimbal, e a luz
       de pesquisa; o app do controle pede a imagem (camera_p60.js) */
    if (ehXag && window.CAMERA_P60) window.CAMERA_P60.instalar(ponte);
    /* T10: duas cameras fixas (frente e tras), sem gimbal (camera_t10.js) */
    if (window.T10_APP && window.CAMERA_T10) window.CAMERA_T10.instalar(ponte);
    /* XAG voa diferente do DJI: terreno, entrada/saida, bateria, sinal e
       desvio so lateral (voo_xag.js). Depois do manual: embrulha o passo dele. */
    if (ehXag && window.VOO_XAG && (!manual || manual.instalado)) window.VOO_XAG.instalar(ponte);

    /* 25/10/2026: o jogo (iframe do campo) passa a saber qual aeronave e: o travamento do radar so vale no T25 e no T50 */
    try { ponte.rodar("window.xgModeloId=" + JSON.stringify(modelo ? modelo.id : "t50") + ";"); } catch (e) { /* segue */ }
    window.MODELO_DRONE.trocar(ponte, modelo, function (carregou) {
      if (modelo.id === "t25" && !carregou) {
        $("carregando-passo").textContent = "Não foi possível carregar o T25. Recarregue a página para tentar novamente.";
        return;
      }
      $("carregando").classList.add("esconder");
    });
    if (etapa.preparar) etapa.preparar(ponte);
    acompanhar();
  }, function () {
    $("carregando-passo").textContent =
      "O campo não abriu. Recarregue a página (Ctrl+F5) — se insistir, me avise.";
  });

  /* ---------------------------------------------------------- o aparelho */

  var aparelhoPreparado = false;
  var noAparelho = false;

  function mostrarAparelho(mostrar) {
    if (mostrar === noAparelho) return;      // chamado a cada ciclo
    noAparelho = mostrar;
    $("aparelho").classList.toggle("esconder", !mostrar);

    /* A moldura do aparelho continua sendo a que o campo desenha - e ela
       que aparece na mao do operador, com a cena atras. O que troca e o
       conteudo da TELA. Por isso o que se esconde aqui e so o desenho de
       dentro da tela do campo (FPV e mini-mapa), nao o aparelho. */
    ponte.rodar(
      "(function(){" +
      "  var t = document.getElementById('tela');" +
      "  if (t) t.style.visibility = " + (mostrar ? "'hidden'" : "''") + ";" +
      "})()"
    );

    /* Na XAG o aparelho e o do site do controle (tela integrada ou
       portatil com celular): o desenho do RC Plus do campo sai de cena. */
    if (ehXag) {
      ponte.rodar(
        "(function(){" +
        "  var c = document.getElementById('vCtrlRc');" +
        "  if (c) c.style.visibility = " + (mostrar ? "'hidden'" : "''") + ";" +
        "})()"
      );
    }

    /* Enquanto ele olha a tela do aparelho, a guia recolhe para o titulo:
       nao some (o aluno pode precisar dela), mas para de tapar o visor. */
    var guia = $("guia");
    guia.classList.toggle("guia--recolhida", mostrar);
    $("btn-recolher").textContent = mostrar ? "+" : "−";

    if (mostrar) {
      prepararAparelho();
      encaixarNaTela();

      /* A foto do campo entra no mapa do controle na primeira vez que ele
         e aberto: antes disso o campo pode nem ter terminado de montar. */
      if (vinculo && !vinculo.foto) {
        if (!vinculo.plantarImagem()) {
          setTimeout(function () { if (vinculo) vinculo.plantarImagem(); }, 1200);
        }
      }
    }
  }

  /* O app do SRC4 trabalha numa largura fixa e e reduzido (ou ampliado) ate
     o vidro do modelo 3D: assim letras e botoes guardam a proporcao da tela
     do aparelho em qualquer tamanho de janela ("tamanho das letras nao estao
     condizentes com a realidade", 06/10). 610 px foi medido pelo
     ferramentas/comparar-src4.cjs contra as capturas do SRC4_H (altura das
     letras 1,0x nas telas do app; 975 px dava 0,6x). */
  var LARGURA_SRC4 = 610;
  function escalarControle(largura, altura, larguraVirtual) {
    var f = $("controle").style;
    if (!larguraVirtual || !largura) {
      if (f.transform) { f.width = ""; f.height = ""; f.transform = ""; f.transformOrigin = ""; }
      return;
    }
    if (window.XG_LARGURA_SRC4 > 0) larguraVirtual = window.XG_LARGURA_SRC4;   // ajuste fino (ferramentas/comparar-src4.cjs)
    var k = largura / larguraVirtual;
    f.width = larguraVirtual + "px";
    f.height = (altura / k) + "px";
    f.transform = "scale(" + k + ")";
    f.transformOrigin = "0 0";
  }

  /* Poe o iframe exatamente em cima da tela do aparelho. */
  function encaixarNaTela() {
    if (!noAparelho) return;

    /* XAG: o site do controle ocupa o campo inteiro, menos a barra de
       vistas do canto de baixo, que continua sendo o jeito de voltar */
    if (ehXag) {
      /* tela integrada: o modelo 3D do SRC4 esta na frente da camera do
         campo (controle_xag_3d.js) e o site mostra SO a tela do app, em
         cima do vidro do modelo */
      var vidro = window.CONTROLE_XAG_3D ? window.CONTROLE_XAG_3D.telaNaVista(ponte) : null;
      try {
        var raiz = $("controle").contentDocument.documentElement;
        raiz.classList.toggle("xg-so-tela", !!vidro);
      } catch (e) { /* controle ainda carregando */ }
      if (vidro) {
        var v = $("aparelho").style;
        v.left = vidro.x + "px";
        v.top = vidro.y + "px";
        v.width = vidro.w + "px";
        v.height = vidro.h + "px";
        escalarControle(vidro.w, vidro.h, LARGURA_SRC4);
        /* 08/10/2026: no Safari (Mac e iPhone) a tela do app ficava so na parte de
           cima do vidro, com uma faixa cinza embaixo. A moldura do app passa a ter
           o tamanho do iframe em pixels, sem depender do "inset"/altura do Safari. */
        try {
          var docC = $("controle").contentDocument, mold = docC && docC.querySelector(".remote:not(.handheld) .remote-screen-frame");
          if (mold) {
            var fs = $("controle").style, hpx = parseFloat(fs.height) || 0, wpx = parseFloat(fs.width) || 0;
            if (hpx > 0 && wpx > 0) {
              ["top", "left"].forEach(function (k) { mold.style.setProperty(k, "0px", "important"); });
              mold.style.setProperty("width", wpx + "px", "important");
              mold.style.setProperty("height", hpx + "px", "important");
            }
          }
        } catch (e) { /* controle ainda carregando */ }
        return;
      }
      escalarControle();
      try {
        var molde = $("controle").contentDocument.querySelector(".remote-screen-frame");
        if (molde) ["top", "left", "width", "height"].forEach(function (k) { molde.style.removeProperty(k); });
      } catch (e) { /* controle ainda carregando */ }

      var barra = null;
      try { barra = $("campo").contentDocument.getElementById("bar"); } catch (e) { barra = null; }
      var fundo = barra ? barra.getBoundingClientRect().top - 8 : window.innerHeight - 64;
      var e = $("aparelho").style;
      e.left = "0px";
      e.top = "0px";
      e.width = window.innerWidth + "px";
      e.height = Math.max(200, fundo) + "px";
      return;
    }

    /* T10/T30: o app vai no vidro do controle 3D (controle_dji_3d.js) */
    var caixa = null;
    if (rcT10 && window.CONTROLE_DJI_3D) {
      var vt = window.CONTROLE_DJI_3D.telaNaVista(ponte);
      if (vt) caixa = { x: vt.x, y: vt.y, largura: vt.w, altura: vt.h, matriz: vt.matriz };
    }
    if (!caixa) caixa = ponte.caixaDaTela();
    if (!caixa) return;

    var estilo = $("aparelho").style;
    estilo.left = caixa.x + "px";
    estilo.top = caixa.y + "px";
    estilo.width = caixa.largura + "px";
    estilo.height = caixa.altura + "px";
    /* T10 (21/10/2026): o vidro aparece inclinado; o app entra nele por perspectiva (matrix3d), sem sobrar nem faltar nos cantos */
    estilo.transformOrigin = "0 0";
    estilo.transform = caixa.matriz || "";
  }

  window.addEventListener("resize", encaixarNaTela);

  /* iPhone (Safari), 08/10/2026: tocar num campo do app abre o teclado; o iOS
     rola a pagina (e o documento do app) para mostrar o campo e, fechado o
     teclado, ela ficava deslocada - a tela do app saia de cima do vidro e o
     vidro ficava cinza. A pagina do simulador nunca rola: volta para o zero e
     o encaixe e refeito na hora, com o teclado abrindo e fechando. */
  function semRolagem(doc, win) {
    try {
      if (win && (win.scrollX || win.scrollY)) win.scrollTo(0, 0);
      var se = doc && doc.scrollingElement;
      if (se && (se.scrollTop || se.scrollLeft)) { se.scrollTop = 0; se.scrollLeft = 0; }
    } catch (e) { /* documento ainda carregando */ }
  }
  function reencaixar() {
    semRolagem(document, window);
    try { semRolagem($("controle").contentDocument, $("controle").contentWindow); } catch (e) { /* controle carregando */ }
    if (noAparelho) encaixarNaTela();
  }
  window.addEventListener("scroll", reencaixar, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", reencaixar);
    window.visualViewport.addEventListener("scroll", reencaixar);
  }
  $("controle").addEventListener("load", function () {
    try {
      var dc = $("controle").contentDocument;
      ["focusin", "focusout"].forEach(function (ev) {
        dc.addEventListener(ev, function () { [60, 350, 800].forEach(function (ms) { setTimeout(reencaixar, ms); }); }, true);
      });
      $("controle").contentWindow.addEventListener("scroll", reencaixar, { passive: true });
    } catch (e) { /* outro endereco */ }
  });

  /* O estilo que deixa so a tela do app tem de entrar assim que o controle
     carrega - e nao so quando o aluno abre a vista. Sem isso, o visor
     mostrava a pagina inteira do site: titulo, instrucoes e o aparelho
     desenhado por ele, tudo dentro da tela do aparelho do campo. */
  $("controle").addEventListener("load", function () {
    aparelhoPreparado = false;
    prepararAparelho();

    /* Controle recarregado (versao nova, Ctrl+F5 so no quadro): tudo que a
       integracao montou dentro dele sumiu junto - e o Iniciar voltava a
       abrir o aviso de fabrica "Falha no upload / Incapaz de decolar", que
       ficava preso na tela. Monta de novo no documento novo. */
    if (!ehXag && operacao && operacao.instalado) {
      operacao.instalado = false;
      /* o documento novo nao sabe que a aeronave esta no ar: sem isto
         sumiam os botoes de voo e o painel ficava no estado errado */
      operacao.voando = null;
      if (editorRota) editorRota.instalado = false;
      if (vinculo && vinculo.foto) vinculo.plantarImagem();
    }
    /* XAG: o telas_xag.js recarrega o app para abrir um mapa novo ou
       devolver o salvo; o documento e outro, entao os ouvintes do vinculo
       (Salvar, Iniciar), do manual e a foto do mapa voltam do zero */
    if (ehXag) {
      if (vinculo) { vinculo.instalado = false; vinculo.fotoTipo = null; }
      if (manual) manual.instalado = false;
    }
  });

  /* Dentro do aparelho do campo, o site do controle mostra SO a tela do
     app: o corpo desenhado por ele e o cabecalho da pagina sairiam por
     cima da moldura que ja existe. */
  function prepararAparelho() {
    if (aparelhoPreparado) return;

    /* o controle XAG tem outro desenho: quem sabe o que esconder e o vinculo */
    if (ehXag) {
      try {
        aparelhoPreparado = window.VINCULO_XAG.criar(ponte, $("controle")).prepararTela();
      } catch (e) { /* tenta de novo no próximo ciclo */ }
      return;
    }

    try {
      var doc = $("controle").contentDocument;
      if (!doc || !doc.body) return;          // ainda carregando
      if (doc.getElementById("xg-embutido")) { aparelhoPreparado = true; return; }

      var estilo = doc.createElement("style");
      estilo.id = "xg-embutido";
      estilo.textContent =
        "body{background:transparent!important;padding:0!important;min-height:0!important;overflow:hidden}" +
        ".cabecalho{display:none!important}" +
        /* o corpo do aparelho some, mas a tela continua visível: a
           visibilidade é herdada pelos filhos dela */
        ".controle{visibility:hidden!important}" +
        ".moldura-tela{visibility:visible!important;position:fixed!important;inset:0!important;" +
        "width:auto!important;height:auto!important;margin:0!important;" +
        "border:0!important;border-radius:0!important;box-shadow:none!important}";

      doc.head.appendChild(estilo);
      aparelhoPreparado = true;
    } catch (e) { /* tenta de novo no próximo clique */ }
  }

  /* ------------------------------------------------------- acompanhamento */

  function desenharConferencia(itens) {
    var lista = $("guia-conferir");
    var assinatura = itens.map(function (i) { return i.texto + i.feito; }).join("|");
    if (lista.dataset.assinatura === assinatura) return;
    lista.dataset.assinatura = assinatura;

    lista.innerHTML = "";
    itens.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "lista__item" + (item.feito ? " lista__item--feito" : "");
      li.textContent = item.texto;
      lista.appendChild(li);
    });
  }

  /* O ciclo nao pode morrer: um erro numa volta (algo do campo ainda nao
     pronto, por exemplo) vai para o console, e a proxima volta acontece
     assim mesmo. Antes o erro era engolido pela espera do campo, que
     montava tudo de novo - e o simulador ficava em dobro. */
  function acompanhar() {
    try {
      acompanharUmaVez();
    } catch (e) {
      console.warn("ciclo do simulador:", e);
    }
    setTimeout(acompanhar, 400);      // 2,5 leituras por segundo bastam
  }

  function acompanharUmaVez() {
    if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
    // A sessao XR dirige o voo por quadro; paineis e fotos 2D esperam a saida.
    if (window.XG_VR && window.XG_VR.imersivo) {
      var estadoVR = ponte.estado();
      if (operacao) operacao.atualizar(estadoVR);
      if (aparelho) aparelho.atualizar(estadoVR);
      if (vinculo) vinculo.refletirConexao(vinculo.faseDoAparelho() === "pronto");
      return;
    }
    var estado = ponte.estado();
    ultimoEstado = estado;

    /* O campo refaz o layout do aparelho por conta propria (resize, troca
       de vista, entrar e sair do mapa). Conferir o encaixe so no resize da
       janela deixava a tela do app fora da moldura. */
    /* O aparelho so existe quando o aluno esta no campo: na tela inicial,
       no painel ou no modo de mapa do campo ele nao tem controle na mao -
       e a tela do app ficava por cima dessas telas. */
    var noCampo = estado.tela === "campo";
    /* na visão do piloto (vista Operador) o aparelho também aparece, baixo */
    var vistaAgora = estado.vista || vistaPedida;
    var querControle = vistaAgora === "controle" || (!ehXag && vistaAgora === "operador");
    /* com o RC Plus de verdade o controle está na mão do aluno: na tela fica
       só a vista do operador seguindo o drone, sem o aparelho desenhado */
    if (window.CONTROLE_REAL && window.CONTROLE_REAL.escolhido() === "real") querControle = false;
    mostrarAparelho(noCampo && querControle);
    /* 14/10/2026: o cartão "Aeronave perdida" é do campo e ficava atrás da tela
       do aparelho (relato do Eduardo no Air 2S): aberto, o aparelho sai da frente */
    var quedaAberta = false;
    try { var cq = ponte.janela.document.getElementById("queda"); quedaAberta = !!(cq && !cq.hidden); } catch (e) { /* campo recarregando */ }
    $("aparelho").style.visibility = quedaAberta ? "hidden" : "";

    /* "Só a tela" do controle DJI: se a página do controle ficou sem o estilo
       (relato do Eduardo, 07/10/2026: o visor mostrava a página inteira, com
       título, "Ligar drone" e o aparelho desenhado), prepara de novo. */
    if (aparelhoPreparado && !ehXag) {
      try {
        var docControle = $("controle").contentDocument;
        if (docControle && docControle.body && !docControle.getElementById("xg-embutido")) aparelhoPreparado = false;
      } catch (e) { /* segue */ }
    }
    if (!aparelhoPreparado) prepararAparelho();
    ligarBotaoDeEnergia();
    ligarBotaoVoltar();
    if (manual && !manual.instalado) manual.instalar();
    if ((!manual || manual.instalado) && window.VORTICE && !vooLivre) window.VORTICE.instalar(ponte, modelo);
    if ((!manual || manual.instalado) && window.PULVERIZACAO) window.PULVERIZACAO.instalar(ponte, modelo);
    /* Air 2S: tela do celular, camera de 1" e limites do voo (app_fly.js) */
    if (vooLivre && window.APP_FLY) window.APP_FLY.manter(ponte, {
      modelo: modelo, manual: manual, mostrar: noAparelho && noCampo, vista: noCampo ? vistaAgora : null,
      fase: vinculo && vinculo.faseDoAparelho ? vinculo.faseDoAparelho() : "desligado",
      quadro: $("aparelho"), estado: estado,
    });
    /* física do jogo: inclinação da aeronave e queda (fisica.js) */
    if (window.FISICA && !fisicaInstalada) fisicaInstalada = window.FISICA.instalar(ponte);
    if (!ehXag && fisicaInstalada && manual && manual.instalado && window.BATERIA) window.BATERIA.instalar(ponte);
    /* com o RC Plus de verdade quem ajusta P e o app dele (app_rcplus.js):
       o controle virtual escondido nao pode regravar estab, radar, desvio...
       a cada volta (Fase 0, item 0.3) */
    if (ajustes && !(window.CONTROLE_REAL && window.CONTROLE_REAL.escolhido() === "real")) ajustes.ciclo();
    if (gnss) gnss.ciclo();
    if (equipe) equipe.ciclo();
    if (radar) radar.ciclo();
    if (editorRota && !editorRota.instalado) editorRota.instalar();
    ligarBotoesDoAparelho();

    /* o controle na mão do operador com a cara do RC Plus e a foto do
       campo na tela; sai cedo quando já está montado */
    if (ehXag) {
      /* o controle 3D na mao do operador: o SRC4 dele (controle_xag_3d.js)
         com o controle de tela integrada; nunca o RC Plus do jogo */
      if (window.CONTROLE_XAG_3D) {
        window.CONTROLE_XAG_3D.manter(ponte, {
          tipo: vinculo && vinculo.aparelhoEscolhido ? vinculo.aparelhoEscolhido() : "integrado",
          ligado: !!(vinculo && vinculo.faseDoAparelho && vinculo.faseDoAparelho() === "pronto"),
          /* os manches do modelo seguem o que chega ao voo: teclado
             (W A S D e setas), mouse no modelo e o controle real juntos */
          comandos: manual && manual.manches ? manual.manches() : (aparelho ? aparelho.comandos : null),
          vista: noCampo ? vistaAgora : null,
          docControle: function () { try { return $("controle").contentDocument; } catch (e) { return null; } },
          aoEnergia: function () { if (vinculo && vinculo.apertarEnergia) vinculo.apertarEnergia(); },
          aoManche: function (lado, x, y) {
            if (!aparelho) return;
            aparelho.comandos[lado] = { x: x, y: y };
            aparelho.aplicarManches();
          },
        });
      }
    } else if (rcT10 && window.CONTROLE_DJI_3D) {
      /* T10/T30: o smart controller 3D na mao e nas vistas, com o app do T25/T50 no vidro */
      window.CONTROLE_DJI_3D.manter(ponte, {
        fase: vinculo && vinculo.faseDoAparelho ? vinculo.faseDoAparelho() : "desligado",
        foto: vinculo && vinculo.foto ? vinculo.foto.imagem : null,
        comandos: manual && manual.manches ? manual.manches() : null,
        vista: noCampo ? vistaAgora : null,
        mostrar: noAparelho,
        /* Air 2S: os botoes do RC-N1 que nao existem no RC Plus vao para o app de voo */
        aoBotao: vooLivre && window.APP_FLY ? function (alvo, ms) { return window.APP_FLY.botao(alvo, ms); } : null,
        /* arrastar o manche do modelo e como arrastar o do desenho (manual.mouse) */
        aoManche: function (lado, x, y) {
          if (!manual || !manual.mouse) return;
          manual.mouse[lado] = x === null ? null : { x: x, y: y };
        },
      });
      if (window.CONTROLE_REAL) window.CONTROLE_REAL.seletor(ponte);
    } else {
      ponte.controleNaMao(vinculo && vinculo.foto ? vinculo.foto.imagem : null);
      /* "Manches": controle virtual ou o RC Plus de verdade; sai cedo
         depois da primeira vez */
      if (window.CONTROLE_REAL) window.CONTROLE_REAL.seletor(ponte);
    }
    if (noAparelho) encaixarNaTela();
    if (ehXag && vinculo && vinculo.aplicarAparelho) {
      vinculo.seletorDeAparelho();          // sai cedo depois da primeira vez
      vinculo.aplicarAparelho();
      if (noAparelho) vinculo.manterFoto();
    }
    if (vinculo && vinculo.foto) vinculo.conferirTarefas();

    /* A sequência de decolagem e o painel de voo vivem dentro do controle;
       só dá para montá-los depois que ele carregou. */
    if (operacao && !operacao.instalado) operacao.instalar();

    /* A cobertura que vale é a medida contra o talhão que veio do controle.
       `coberturaReal()` do campo mede contra um retângulo fixo do cenário.
       A varredura é cara, então acontece em ciclo sim, ciclo não. */
    if (++cicloCobertura % 2 === 0) {
      var real = ponte.cobertura();
      if (real) ultimaCobertura = real;
    }
    if (ultimaCobertura) estado.cobertura = ultimaCobertura;
    if (aparelho) aparelho.atualizar(estado);

    if (operacao) operacao.atualizar(estado);

    /* Aeronave ligada = aparelho conectado: o X de emergência fica verde,
       os LEDs acendem e a barra deixa de dizer "desconectada".

       Mas o aparelho tem de estar ligado primeiro. Enquanto não estiver, a
       conexão não fecha e a tela de execução devolve o aluno para o mapa —
       sem uma palavra. Então a guia fala por ela. */
    if (vinculo) {
      var fase = vinculo.faseDoAparelho();
      vinculo.refletirConexao(estado.tela === "campo" && fase === "pronto");
      var chave = querControle && fase ? fase : "pronto";
      /* na visão do piloto o botão de energia fica fora da tela */
      if (vistaAgora === "operador" && (fase === "desligado" || fase === "armado")) chave += "-piloto";
      avisarAparelho(chave);
    }

    var itens = [];
    try {
      itens = etapa.conferir ? etapa.conferir(estado) : [];
    } catch (e) { itens = []; }

    if (modo !== "prova") desenharConferencia(itens);

    if (!concluida) {
      var pronta = false;
      try { pronta = !!etapa.pronta(estado, itens); } catch (e) { pronta = false; }

      if (pronta) {
        concluida = true;
        $("btn-concluir").classList.remove("esconder");
        $("guia").classList.add("guia--pronta");
      }
    }
  }

  /* Ponto de diagnostico.

     Esta integracao depende de nomes internos de dois sistemas que
     continuam sendo desenvolvidos noutras pastas. Quando um nome muda,
     nada explode: simplesmente para de funcionar, calado. Daqui da para
     perguntar, no console, o que a ponte esta enxergando. */
  /* Tudo de que a integracao depende dentro do controle. O controle e
     desenvolvido noutra pasta e continua mudando; um id renomeado nao da
     erro nenhum, so para de funcionar calado. Esta lista e o antidoto:
     `XG.conferirControle()` no console diz o que sumiu. */
  var DEPENDENCIAS = [
    ["elemento", "#terreno", "o <symbol> do mapa; e dentro dele que a foto do campo e plantada"],
    ["elemento", "#botao-iniciar", "o Iniciar da execucao, que dispara a sequencia de decolagem"],
    ["elemento", "[data-tela='execucao']", "a tela de voo; a sequencia e o painel sao montados dentro dela"],
    ["elemento", "[data-tela='execucao'] .alerta-voo", "a faixa de aviso do alto da tela"],
    ["elemento", "[data-tela='execucao'] .bat-drone", "bateria da aeronave na barra de cima"],
    ["elemento", "[data-tela='execucao'] .tanque", "tanque na barra de cima"],
    ["variavel", "METROS_POR_UNIDADE", "a escala do mapa; sem ela o talhao atravessa no tamanho errado"],
    ["variavel", "tarefas", "a lista de tarefas salvas; cada item precisa de nome, area, limite[] e obstaculo[]"],
    ["variavel", "estado", "o estado do app; a integracao escreve estado.conectado"],
    ["funcao", "mostrarTela", "trocar de tela por fora"],
  ];

  window.XG = {
    ponte: ponte,
    vinculo: function () { return vinculo; },
    manual: function () { return manual; },
    aparelho: function () { return aparelho; },
    operacao: function () { return operacao; },
    ajustes: function () { return ajustes; },

    /* Rode isto no console depois de mexer no controle. */
    conferirControle: function () {
      var doc, jan, faltando = [], ok = [];

      try {
        doc = $("controle").contentDocument;
        jan = $("controle").contentWindow;
      } catch (e) {
        return { erro: "o controle nao carregou: " + (e.message || e) };
      }

      DEPENDENCIAS.forEach(function (d) {
        var tipo = d[0], nome = d[1], existe = false;

        if (tipo === "elemento") {
          existe = !!doc.querySelector(nome.charAt(0) === "#" ? nome : nome);
        } else {
          try {
            existe = jan.eval("typeof " + nome + " !== 'undefined'") === true;
          } catch (e) { existe = false; }
        }

        (existe ? ok : faltando).push(nome + "  —  " + d[2]);
      });

      if (faltando.length) {
        console.warn("O controle mudou. A integracao depende destes, e eles sumiram:");
        faltando.forEach(function (f) { console.warn("   " + f); });
      } else {
        console.log("Controle conferido: os " + ok.length + " nomes de que a integracao depende continuam la.");
      }

      return { faltando: faltando, encontrados: ok.length };
    },
    estado: function () { return ponte.estado(); },
    diagnostico: function () {
      var d = {
        campoDePe: !!ponte.janela,
        tela: (ponte.estado() || {}).tela,
        controleCarregado: false,
        temSimboloTerreno: false,
        fotoPlantada: false,
        escala: vinculo ? vinculo.escala : null,
        tarefasNoControle: null,
      };

      try {
        var doc = $("controle").contentDocument;
        d.controleCarregado = !!(doc && doc.body);
        d.temSimboloTerreno = !!(doc && doc.getElementById("terreno"));
        d.fotoPlantada = !!(doc && doc.getElementById("xg-foto"));
        d.tarefasNoControle = $("controle").contentWindow
          .eval("typeof tarefas !== 'undefined' ? tarefas.length : 'sem tarefas'");
      } catch (e) { d.erroNoControle = String(e.message || e); }

      return d;
    },
  };

  /* O botão ⏻ do desenho do aparelho vira o botão de energia do app.

     O controle liga como o de verdade: um toque acende as luzes, e segurar
     3 segundos liga. Só que o botão dele fica no corpo do aparelho HTML,
     que a gente esconde para mostrar apenas a tela — o aluno vê o desenho
     do jogo, e ali o ⏻ era enfeite. Então o ⏻ do jogo passa a repassar a
     pressão para as funções do próprio controle: o gesto e o tempo
     continuam sendo os dele, não uma imitação nossa. */
  var energiaLigada = false;

  function ligarBotaoDeEnergia() {
    if (energiaLigada) return;
    if (ehXag) { ligarEnergiaXag(); return; }

    var docCampo, jc;
    try {
      docCampo = $("campo").contentDocument;
      jc = $("controle").contentWindow;
    } catch (e) { return; }
    if (!docCampo || !jc) return;

    /* o botão não tem id: é o círculo de (1680, 1258) no SVG do aparelho */
    var circulo = docCampo.querySelector('#vCtrlRc circle[cx="1680"][cy="1258"]');
    if (!circulo || !circulo.parentNode) return;

    var existe = false;
    try {
      existe = jc.eval("typeof iniciarPressaoEnergia === 'function' && " +
                       "typeof finalizarPressaoEnergia === 'function'") === true;
    } catch (e) { existe = false; }
    if (!existe) return;

    var botao = circulo.parentNode;
    /* .rcbt é a classe que o jogo usa para os botões clicáveis do aparelho:
       dá o clique (o SVG é pointer-events:none), o cursor e o foco */
    botao.classList.add("rcbt");
    botao.setAttribute("role", "button");
    botao.setAttribute("aria-label", "Energia do controle");
    botao.setAttribute("tabindex", "0");
    /* o clique dava foco e o navegador desenhava um quadrado branco em volta */
    botao.style.outline = "none";

    /* O tempo de segurar e o do aparelho de verdade, dito por ele: toque e
       solta acende as luzes, e segurar 1,5 s liga. O controle dele espera 3 s
       (DURACAO_PRESSAO, um const que nao da para trocar de fora); entao o
       nosso relogio chama ligarControle() aos 1,5 s, e o de 3 s dele, quando
       vence, ve que a fase ja mudou e nao faz nada. O resto do gesto (armar
       no toque; ligado, tocar apaga a tela e segurar 1,5 s desliga - 12/10/2026)
       continua sendo o dele. */
    var SEGURAR_MS = 1500;
    var relogio = null;

    function soltar() {
      clearTimeout(relogio);
      relogio = null;
      try { jc.eval("finalizarPressaoEnergia()"); } catch (e) { /* recarregando */ }
    }

    botao.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      try { botao.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura */ }
      try { jc.eval("iniciarPressaoEnergia()"); } catch (erro) { /* recarregando */ }

      clearTimeout(relogio);
      relogio = setTimeout(function () {
        relogio = null;
        try {
          jc.eval("if (faseControle === 'armado' && botaoEnergiaPressionado) ligarControle();");
        } catch (erro) { /* recarregando */ }
      }, SEGURAR_MS);
    });
    botao.addEventListener("pointerup", soltar);
    botao.addEventListener("pointercancel", soltar);

    energiaLigada = true;
  }

  /* No XAG o ⏻ do site do controle e um toque só: liga e passa pela
     abertura (Android, XAG, XAG One). O ⏻ do desenho repassa o toque. */
  function ligarEnergiaXag() {
    var docCampo;
    try { docCampo = $("campo").contentDocument; } catch (e) { return; }
    var circulo = docCampo && docCampo.querySelector('#vCtrlRc circle[cx="1680"][cy="1258"]');
    if (!circulo || !circulo.parentNode || !vinculo || !vinculo.apertarEnergia) return;

    var botao = circulo.parentNode;
    energiaLigada = true;
    /* a marca fica no proprio desenho: ligar duas vezes fazia um toque
       ligar e desligar o aparelho na mesma hora */
    if (botao.getAttribute("data-xg-energia")) return;
    botao.setAttribute("data-xg-energia", "1");
    botao.classList.add("rcbt");
    botao.setAttribute("role", "button");
    botao.setAttribute("aria-label", "Energia do controle");
    botao.setAttribute("tabindex", "0");
    botao.style.outline = "none";
    botao.addEventListener("click", function () { vinculo.apertarEnergia(); });

    energiaLigada = true;
  }

  /* O ‹ do desenho do aparelho aperta o ‹ do controle (.t-voltar). Quem sabe
     voltar é ele: fecha o painel que estiver aberto e, se não houver, volta
     à tela anterior pelo histórico — e não faz nada com o aparelho desligado. */
  var voltarLigado = false;

  function ligarBotaoVoltar() {
    if (voltarLigado) return;

    var docCampo, docControle;
    try {
      docCampo = $("campo").contentDocument;
      docControle = $("controle").contentDocument;
    } catch (e) { return; }
    if (!docCampo || !docControle) return;

    /* sem id no desenho: é o círculo de (188, 1050) */
    var circulo = docCampo.querySelector('#vCtrlRc circle[cx="188"][cy="1050"]');
    var alvo = docControle.querySelector(".t-voltar");
    if (!circulo || !circulo.parentNode || !alvo) return;

    var botao = circulo.parentNode;
    botao.classList.add("rcbt");
    botao.setAttribute("role", "button");
    botao.setAttribute("aria-label", "Voltar");
    botao.setAttribute("tabindex", "0");
    botao.style.outline = "none";

    /* Com o app do RC Plus na tela (controle-app), quem volta é ele: um toque volta um
       nível e dois em até 0,5 s vão à tela inicial (rcplusVoltar), como no aparelho.
       O .t-voltar só mexia na página do controle escondida atrás do app. 07/10/2026 */
    botao.addEventListener("click", function () {
      var doc = $("controle").contentDocument, app = null, fase = "pronto";
      try { app = window.__xgAppVirtual && window.__xgAppVirtual.rcplusVoltar ? window.__xgAppVirtual : null; } catch (e) { app = null; }
      if (app && doc.getElementById("xg-app-rcplus")) {
        try { fase = doc.defaultView.eval("typeof faseControle !== 'undefined' ? faseControle : 'pronto'"); } catch (e) { fase = "pronto"; }
        if (fase === "pronto") app.rcplusVoltar();
        return;
      }
      var t = doc.querySelector(".t-voltar");
      if (t) t.click();
    });

    voltarLigado = true;
  }

  /* Os botoes fisicos L1, R2 e R3 do desenho do aparelho, como no RC Plus
     dos videos dele:
       R2  cancela a janela aberta - aperta o botao que diz "(R2)"
       R3  confirma - aperta o botao que diz "(R3)"; na decolagem, e o
           mesmo que deslizar ate o fim
       L1  "Adicionar ponto" (a atribuicao de fabrica mostrada no video)
     No desenho eles nao tem id: sao os retangulos dos rotulos, entao cada
     um ganha uma area de toque por cima. */
  var botoesLigados = false;

  function ligarBotoesDoAparelho() {
    if (botoesLigados || ehXag || !operacao) return;

    var docCampo, docControle;
    try {
      docCampo = $("campo").contentDocument;
      docControle = $("controle").contentDocument;
    } catch (e) { return; }
    var svg = docCampo && docCampo.querySelector("#vCtrlRc svg");
    if (!svg || !docControle) return;

    var NS = "http://www.w3.org/2000/svg";
    [["L1", 282, 955], ["R1", 1642, 955], ["R2", 1642, 1025], ["R3", 1642, 1095]].forEach(function (b) {
      var toque = docCampo.createElementNS(NS, "rect");
      toque.setAttribute("x", b[1]); toque.setAttribute("y", b[2]);
      toque.setAttribute("width", 78); toque.setAttribute("height", 50);
      toque.setAttribute("rx", 11);
      toque.setAttribute("fill", "transparent");
      toque.setAttribute("class", "rcbt");
      toque.setAttribute("aria-label", b[0]);
      toque.style.outline = "none";
      toque.addEventListener("click", function () { apertarBotaoFisico(b[0]); });
      svg.appendChild(toque);
    });

    botoesLigados = true;
  }

  function visivel(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  function apertarBotaoFisico(nome) {
    var doc;
    try { doc = $("controle").contentDocument; } catch (e) { return; }
    if (!doc) return;

    /* na decolagem, R3 vale o deslizar ate o fim */
    /* R1 esconde e mostra o painel de voo (pedido dele) */
    if (nome === "R1") {
      var op = doc.getElementById("xg-op");
      if (op) op.classList.toggle("xg-escondido");
      return;
    }

    if (nome === "R3") {
      var desliza = doc.getElementById("xg-desliza");
      if (desliza && desliza.classList.contains("aberta") && visivel(desliza)) {
        operacao.contar();
        return;
      }
      /* 11/11/2026: a Verificacao automatica do app do controle (controle-app, dentro do campo) tem o proprio deslizador;
         o R3 do desenho tambem confirma ele (o app so aceita quando a barra de sincronizar terminou) */
      var achou = (function procurar(w, n) {
        try { if (typeof w.rcplusSegurarR3 === "function") return w.rcplusSegurarR3; } catch (e) { return null; }
        if (n > 3) return null;
        for (var k = 0; k < w.frames.length; k++) { var f = procurar(w.frames[k], n + 1); if (f) return f; }
        return null;
      })(window, 0);
      if (achou) { achou(); return; }
    }

    var botoes = doc.querySelectorAll("button");
    for (var i = 0; i < botoes.length; i++) {
      var texto = botoes[i].textContent.replace(/\s+/g, "");
      var serve = nome === "L1" ? texto === "Adicionar" || texto === "+Adicionar"
                                : texto.indexOf("(" + nome + ")") >= 0;
      if (serve && visivel(botoes[i]) && !botoes[i].disabled) {
        botoes[i].click();
        return;
      }
    }
  }

  /* O aparelho liga como o de verdade: um toque no ⏻ acende as luzes, e
     segurar 1,5 segundo liga. As luzes do aparelho de verdade ficam no corpo
     dele, que a gente esconde - então o primeiro toque não mostrava nada e
     parecia não ter funcionado. Aqui o recado acompanha cada passo, e o anel
     do ⏻ acende no lugar das luzes. */
  var faseAvisada = "pronto";

  /* Sem o simbolo de energia no texto: a fonte da guia nao tem esse
     caractere e ele saia como um quadradinho. */
  var RECADO_DO_APARELHO = {
    desligado: "O controle está desligado. Toque uma vez no botão de energia (o " +
               "redondo embaixo à direita do aparelho).",
    armado:    "Luzes acesas. Agora segure o botão de energia por 1,5 segundo para ligar.",
    ligando:   "Ligando o controle…",
    /* na visao do piloto o aparelho fica baixo e o botao de energia, fora da
       tela: liga-se na vista Controle */
    "desligado-piloto": "O controle está desligado. Abra a vista Controle para ligá-lo " +
                        "no botão de energia.",
    "armado-piloto":    "Luzes acesas. Na vista Controle, segure o botão de energia por " +
                        "1,5 segundo para ligar.",
  };

  /* Na XAG o ⏻ fica no aparelho do site (no meio do integrado, embaixo do
     portatil), e antes disso o aluno escolhe qual dos dois vai usar. */
  if (ehXag) {
    RECADO_DO_APARELHO.desligado = "O controle está desligado. Na vista Controle, " +
      "aperte o botão de energia do aparelho.";
  }

  function avisarAparelho(fase) {
    if (fase === faseAvisada) return;
    faseAvisada = fase;

    var desligado = fase !== "pronto";

    if (desligado) {
      avisar(RECADO_DO_APARELHO[fase] || RECADO_DO_APARELHO.ligando);
      /* com o aparelho na tela a guia fica recolhida - e o recado ia junto */
      $("guia").classList.remove("guia--recolhida");
      $("btn-recolher").textContent = "−";
    } else {
      if (modo !== "prova") avisar(etapa.instrucao);
      if (noAparelho) {
        $("guia").classList.add("guia--recolhida");
        $("btn-recolher").textContent = "+";
      }
    }

    var base = fase.split("-")[0];
    acenderBotaoDeEnergia(base === "armado" || RECADO_DO_APARELHO[base] === undefined && desligado);
  }

  /* O anel do ⏻ no desenho do aparelho faz o papel das luzes. */
  function acenderBotaoDeEnergia(aceso) {
    try {
      var circulo = $("campo").contentDocument
        .querySelector('#vCtrlRc circle[cx="1680"][cy="1258"]');
      if (!circulo) return;
      circulo.setAttribute("stroke", aceso ? "#3ddc84" : "#72767b");
      circulo.setAttribute("stroke-width", aceso ? "9" : "5");
    } catch (e) { /* campo recarregando */ }
  }

  /* LEDs do RC virtual do DJI, como no RC Plus (pedido do Eduardo, 07/10/2026,
     com fotos do aparelho dele). No desenho do campo (#vCtrlRc): 1 LED de status
     (x=918) e 4 de bateria (x=980..1070) embaixo da tela, e o anel do botão
     redondo do lado esquerdo (322,610).
     - desligado: tudo apagado;
     - um toque no liga/desliga ("armado"): os 4 LEDs mostram a bateria;
     - ligado: a bateria fica acesa; cada LED vale 25%, e o último pisca quando
       aquele quarto está pela metade (tabela padrão do RC Plus: 88-100% quatro
       acesos, 75-87% o quarto pisca, 63-74% três, ... 0-12% o primeiro pisca);
     - status e anel: vermelho sem a aeronave, verde conectado.
     A bateria é a do aparelho onde o simulador roda (a mesma do app do controle);
     sem bateria (PC de mesa), 100%. Só no DJI: a XAG tem outro aparelho. */
  var LED_VERDE = "#2bef5d", LED_VERMELHO = "#ff3b2e", LED_APAGADO = "#2a2c2f", ANEL_PADRAO = "#72767b";
  var bateriaRc = 100;
  try {
    if (navigator.getBattery) navigator.getBattery().then(function (b) {
      var ler = function () { bateriaRc = Math.round(b.level * 100); };
      ler(); b.addEventListener("levelchange", ler);
    }).catch(function () {});
  } catch (e) { /* sem a API: fica 100% */ }
  /* 4 LEDs: "on" aceso, "pisca", "off" apagado */
  function padraoDaBateria(p) {
    if (p >= 88) return ["on", "on", "on", "on"];
    if (p >= 75) return ["on", "on", "on", "pisca"];
    if (p >= 63) return ["on", "on", "on", "off"];
    if (p >= 50) return ["on", "on", "pisca", "off"];
    if (p >= 38) return ["on", "on", "off", "off"];
    if (p >= 25) return ["on", "pisca", "off", "off"];
    if (p >= 13) return ["on", "off", "off", "off"];
    return ["pisca", "off", "off", "off"];
  }
  function pintarLed(el, cor) {
    if (!el) return;
    el.setAttribute("fill", cor);
    el.style.filter = cor === LED_APAGADO ? "" : "drop-shadow(0 0 6px " + cor + ")";
  }
  function atualizarLedsDoRc() {
    if (ehXag || !vinculo) return;
    var doc;
    try { doc = $("campo").contentDocument; } catch (e) { return; }
    var svg = doc && doc.querySelector("#vCtrlRc svg");
    if (!svg) return;
    var fase = vinculo.faseDoAparelho() || "desligado";
    var aceso = fase !== "desligado";
    var piscaAgora = Math.floor(Date.now() / 500) % 2 === 0;
    var padrao = padraoDaBateria(bateriaRc);
    [980, 1010, 1040, 1070].forEach(function (x, i) {
      var p = aceso ? padrao[i] : "off";
      pintarLed(svg.querySelector('rect[x="' + x + '"][y="1177"]'), p === "on" || (p === "pisca" && piscaAgora) ? LED_VERDE : LED_APAGADO);
    });
    /* ligando (logo/carregando) ou ligado: vermelho até a aeronave conectar */
    var ligado = aceso && fase !== "armado", conectado = fase === "pronto" && !!vinculo.conectado;
    pintarLed(svg.querySelector('rect[x="918"][y="1177"]'), ligado ? (conectado ? LED_VERDE : LED_VERMELHO) : LED_APAGADO);
    var anel = svg.querySelector('circle[cx="322"][cy="610"]');
    if (anel) {
      anel.setAttribute("stroke", ligado ? (conectado ? LED_VERDE : LED_VERMELHO) : ANEL_PADRAO);
      anel.setAttribute("stroke-width", ligado ? "8" : "5");
    }
  }
  setInterval(function () { try { atualizarLedsDoRc(); } catch (e) { /* campo recarregando */ } }, 250);

  /* Recado curto do vinculo, na propria guia. */
  function avisar(texto) {
    var alvo = $("guia-instrucao");
    if (!alvo) return;
    alvo.textContent = texto;
  }

  /* ------------------------------------------------------------- boletim */

  $("btn-concluir").addEventListener("click", function () {
    var itens = [];
    try {
      itens = etapa.boletim ? etapa.boletim(ultimoEstado, ponte) : [];
    } catch (e) { itens = []; }

    var nota = 10;
    itens.forEach(function (i) { if (!i.bom) nota -= 2; });
    nota = Math.max(0, Math.round(nota * 10) / 10);

    window.SESSAO.salvarProgresso(chaveTreino,
      (modo === "prova" ? "prova:" : "") + etapa.id, { nota: itens.length ? nota : undefined });

    var corpo = $("modal-corpo");
    corpo.innerHTML = "";

    if (itens.length) {
      var p = document.createElement("p");
      p.className = "nota";
      p.textContent = String(nota).replace(".", ",");
      corpo.appendChild(p);

      itens.forEach(function (item) {
        var div = document.createElement("div");
        div.className = "item " + (item.bom ? "item--bom" : "item--ruim");
        div.innerHTML = "<h3>" + item.titulo + "</h3><b>" + item.valor + "</b><p>" + item.texto + "</p>";
        corpo.appendChild(div);
      });
    } else {
      var texto = document.createElement("p");
      texto.textContent = "Etapa cumprida. O que você aprendeu aqui vale para qualquer talhão.";
      corpo.appendChild(texto);
    }

    $("modal-titulo").textContent = etapa.titulo;

    var proxima = ORDEM[indice + 1];
    var botao = $("btn-proxima");
    if (proxima) {
      botao.href = "sim.html?marca=" + marcaId + "&modelo=" + (modelo ? modelo.id : "t50") +
                   "&cenario=" + cenarioId + "&etapa=" + proxima +
                   (modo !== "aula" ? "&modo=" + modo : "");
      botao.textContent = "Próxima etapa";
    } else {
      botao.href = "index.html";
      botao.textContent = "Terminar o treinamento";
    }

    $("modal").classList.remove("esconder");
  });
})();
