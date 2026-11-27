/* ==========================================================================
   O VINCULO ENTRE O CONTROLE XAG E O CAMPO

   Mesmo papel do vinculo.js (DJI), para o site do controle XAG P60 com o
   app XAG One. As diferencas vem do jeito que aquele site foi feito:

     - o estado do app mora dentro de uma funcao fechada: de fora nao da
       para ler `s`. O que atravessa e o que ele salva no navegador, na
       chave `guri-map-demo` (pontos, obstaculos, parametros da operacao);
     - o mapa e um quadro de 0 a 100 nos dois eixos, esticado sobre a tela
       (preserveAspectRatio none), com a foto `lavoura.jpg` de fundo;
     - a area que o app mostra e |soma do agrimensor| x 0,00065 ha, ou seja,
       cada unidade quadrada do quadro vale 13 m2.

   A foto do campo e tirada com a MESMA proporcao da tela do mapa e com
   largura x altura = 100 x 100 x 13 m2. Assim um pixel vale o mesmo em x e
   em y, a foto nao sai esticada e a area que o app mostra e a area real do
   talhao no campo:

       x_metros = centro.x + (u / 100 - 0,5) * larguraM
       z_metros = centro.z + (v / 100 - 0,5) * alturaM

   Nunca edita o site do controle: `controle-xag/` e copia da pasta de fora.
   Tudo entra por estilo injetado e por ouvintes de clique.
   ========================================================================== */

window.VINCULO_XAG = (function () {
  "use strict";

  var CHAVE = "guri-map-demo";
  var M2_POR_UNIDADE = 13;          // da conta de area do proprio app
  var AREA_DO_QUADRO = 100 * 100 * M2_POR_UNIDADE;

  function VinculoXag(ponte, quadro) {
    this.ponte = ponte;
    this.quadro = quadro;
    this.foto = null;
    this.caixa = null;
    this.assinaturaVista = undefined;
    this.aoCarregarTalhao = null;
    this.aoDecolar = null;
    this.instalado = false;
  }

  VinculoXag.prototype.janela = function () {
    try { return this.quadro.contentWindow; } catch (e) { return null; }
  };

  VinculoXag.prototype.documento = function () {
    try { return this.quadro.contentDocument; } catch (e) { return null; }
  };

  /* O que o app salvou no navegador. */
  VinculoXag.prototype.salvo = function () {
    var j = this.janela();
    if (!j) return null;
    try { return JSON.parse(j.localStorage.getItem(CHAVE) || "null"); }
    catch (e) { return null; }
  };

  /* ------------------------------------------------------ preparar a tela */

  /* A XAG nao tem o formato do RC Plus: sao dois aparelhos, o controle com
     tela integrada e o controle portatil com o app no celular. Na vista
     Controle aparece o APARELHO do site - corpo, manches e o ⏻ dele -, em
     baixo, como na mao do operador, com o campo de verdade atras.

     Sai tudo que e pagina e nao aparelho: a tela de escolha do site (a
     escolha acontece na tela inicial do campo, junto do operador e do
     terreno), os textos de ajuda e o "Trocar modelo de controle". */
  VinculoXag.prototype.prepararTela = function () {
    var doc = this.documento();
    if (!doc || !doc.body) return false;
    if (doc.getElementById("xg-embutido")) return true;

    var estilo = doc.createElement("style");
    estilo.id = "xg-embutido";
    estilo.textContent =
      "html,body{background:transparent!important;overflow:hidden!important}" +
      ".controller-picker,.intro,.remote-label,#change-control{display:none!important}" +
      /* o aparelho encostado embaixo, como seguro na mao */
      ".shell{min-height:100vh!important;justify-content:flex-end!important;" +
      "padding:0 0 6px!important;gap:0!important}" +
      FORMATO_DOS_APARELHOS;
    doc.head.appendChild(estilo);

    trocarAvisos(doc);
    if (window.TELAS_XAG) window.TELAS_XAG.instalar(doc);
    return true;
  };

  /* O formato dos dois aparelhos, pelas fotos do SRC4 dele e por um celular
     de verdade. O site mede tudo em px e vw, pensado para rodar sozinho numa
     pagina; aqui tudo e medido pela ALTURA da janela (vh), senao o aparelho
     sai cortado embaixo ou esticado para os lados.

     SRC4: tela deitada ~5:3 com moldura preta grossa, presa por um BRACO no
     meio (nao uma dobradica larga) a um corpo baixo. No corpo: manches
     afundados, dois pares de botoes ao lado do botao vermelho de energia,
     barra de LEDs, e nos ombros os gatilhos L/R e os giratorios F1/F2 de
     aro vermelho. Os manches nao podem ter transform proprio: o arrastar do
     aparelho_xag.js usa o transform deles.

     Celular: em pe, ~9:19,5 (o site deixava quase quadrado). */
  var TELA = "54vh", PROP = 1.62;   // no modelo 3D a tela tem quase a largura do corpo
  /* o caractere ⏻ nao existe na fonte do Windows e saia um quadradinho */
  var ICONE_ENERGIA = "url(\"data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" ' +
    'stroke-width="2.6" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>') + "\")";
  var FORMATO_DOS_APARELHOS = [
    /* ---------------- SRC4 */
    ".remote:not(.handheld){width:auto!important;filter:drop-shadow(0 2vh 3vh #000a)!important}",
    ".remote:not(.handheld) .handheld-body{display:none!important}",
    ".remote:not(.handheld) .remote-screen-frame{order:1;width:min(94vw,calc(" + TELA + "*" + PROP + "))!important;",
    " height:" + TELA + "!important;min-height:0!important;padding:1.3vh!important;border:.5vh solid #2b3132!important;",
    " border-radius:2.2vh!important;background:linear-gradient(160deg,#1c2122,#0b0e0f)!important;",
    " box-shadow:inset 0 0 0 .3vh #050708,0 1vh 2.5vh #0009!important}",
    ".remote:not(.handheld) .remote-screen-frame:before{display:none!important}",
    ".remote:not(.handheld) .remote-screen-frame .phone{border-radius:.8vh!important}",
    ".remote:not(.handheld) .remote-off-message{inset:1.3vh!important}",
    ".remote:not(.handheld) .remote-screen-hinge{order:2;width:9vh!important;height:4vh!important;margin:-.4vh 0 -.6vh!important;",
    " border:.3vh solid #0a0c0d!important;border-radius:.6vh!important;z-index:2!important;",
    " background:linear-gradient(90deg,#15191a,#3b4243 45%,#2a3031 55%,#121516)!important}",
    ".remote:not(.handheld) .remote-base{order:3;width:min(96vw,calc(" + TELA + "*" + PROP + " + 6vh))!important;",
    " height:30vh!important;margin:0!important;padding:0!important;display:block!important;",
    " border:.4vh solid #2a3031!important;border-bottom-color:#0a0d0e!important;border-radius:3vh 3vh 7vh 7vh!important;",
    " background:linear-gradient(172deg,#2d3334,#1b2021 50%,#0f1314)!important;",
    " box-shadow:inset 0 .4vh .6vh #ffffff14,inset 0 -1.6vh 2.4vh #0009,0 1.5vh 2vh #0008!important}",
    ".remote:not(.handheld) .remote-base:before,.remote:not(.handheld) .remote-base:after{display:none!important}",
    ".remote:not(.handheld) .hardware-side{position:absolute!important;top:0;bottom:0;width:38%;display:block!important;gap:0!important}",
    ".remote:not(.handheld) .hardware-side:first-child{left:0}",
    ".remote:not(.handheld) .hardware-side:last-child{right:0}",
    ".remote:not(.handheld) .hardware-center{position:absolute!important;left:38%;right:38%;top:0;bottom:0;",
    " display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:1.3vh!important}",
    ".remote:not(.handheld) .hardware-brand{font-size:2.1vh!important;letter-spacing:.14em!important}",
    ".remote:not(.handheld) .hardware-led{gap:1vh!important;padding:.7vh 1.3vh!important;border-radius:.7vh;background:#0a0d0e;",
    " box-shadow:inset 0 .2vh .4vh #000}",
    ".remote:not(.handheld) .hardware-led i{width:.9vh!important;height:.9vh!important}",
    ".remote:not(.handheld) .hardware-power{width:6.2vh!important;height:6.2vh!important;border:.6vh solid #353c3d!important;",
    " background:" + ICONE_ENERGIA + " center/45% no-repeat,radial-gradient(circle at 42% 36%,#ef5560,#b3202b 55%,#6d1017)!important;",
    " color:transparent!important;font-size:0!important;box-shadow:0 .5vh .8vh #000a,inset 0 .3vh .4vh #fff4!important}",
    ".remote:not(.handheld).on .hardware-power{box-shadow:0 0 0 .5vh #00d8903a,0 .5vh .8vh #000a!important}",
    /* manches afundados: posicao so por left/top (o transform e do arrastar) */
    ".remote:not(.handheld) .stick{position:absolute!important;width:13vh!important;top:calc(50% - 5.5vh)!important}",
    ".remote:not(.handheld) .hardware-side:first-child .stick{left:13%!important}",
    ".remote:not(.handheld) .hardware-side:last-child .stick{right:13%!important}",
    ".remote:not(.handheld) .hardware-buttons{display:block!important}",
    ".remote:not(.handheld) .hardware-buttons span{position:absolute!important;min-width:0!important;margin:0!important;",
    " font-size:1.35vh!important;border-color:#454d4e!important;background:linear-gradient(#323a3b,#141a1b)!important}",
    /* 1o e 2o: o par ao lado do botao de energia (RTH/Radar e Pausa/FPV) */
    ".remote:not(.handheld) .hardware-buttons span:nth-child(-n+2){width:7.8vh!important;height:4.4vh!important;border-radius:.8vh!important}",
    ".remote:not(.handheld) .hardware-buttons span:nth-child(1){top:27%}",
    ".remote:not(.handheld) .hardware-buttons span:nth-child(2){top:53%}",
    ".remote:not(.handheld) .hardware-side:first-child .hardware-buttons span:nth-child(-n+2){right:5%}",
    ".remote:not(.handheld) .hardware-side:last-child .hardware-buttons span:nth-child(-n+2){left:5%}",
    /* 3o: gatilho do ombro (L / R) */
    ".remote:not(.handheld) .hardware-buttons span:nth-child(3){top:-2.7vh;width:10vh!important;height:2.9vh!important;",
    " border-radius:1.2vh 1.2vh .3vh .3vh!important}",
    ".remote:not(.handheld) .hardware-side:first-child .hardware-buttons span:nth-child(3){left:27%}",
    ".remote:not(.handheld) .hardware-side:last-child .hardware-buttons span:nth-child(3){right:27%}",
    /* 4o: giratorio do canto (F1 / F2), aro vermelho como na foto */
    ".remote:not(.handheld) .hardware-buttons span:nth-child(4){top:-1.6vh;width:6vh!important;height:6vh!important;",
    " border-radius:50%!important;border:.6vh solid #c7323d!important;",
    " background:radial-gradient(circle at 40% 35%,#4a5253,#161b1c 70%)!important}",
    ".remote:not(.handheld) .hardware-side:first-child .hardware-buttons span:nth-child(4){left:3%}",
    ".remote:not(.handheld) .hardware-side:last-child .hardware-buttons span:nth-child(4){right:3%}",

    /* ---- igual ao modelo 3D dele (XAG_SRC4_Articulado, 26/09): duas
       antenas em poste atras da tela, poste central de apoio, tampo
       inclinado mais claro sobre a empunhadura escura com o recorte e a
       marca XAG, manches com topo serrilhado e seletores F1/F2 com aro
       vermelho e corpo serrilhado */
    ".remote:not(.handheld){position:relative!important;padding-top:11vh!important}",
    ".remote:not(.handheld):before,.remote:not(.handheld):after{content:'';position:absolute;top:0;width:3.4vh;height:19vh;",
    " border-radius:1.1vh 1.1vh .4vh .4vh;background:linear-gradient(90deg,#15191a,#2c3233 45%,#1a1f20);",
    " box-shadow:inset 0 .2vh 0 #ffffff12,0 .4vh .8vh #0008;z-index:0}",
    ".remote:not(.handheld):before{left:31%}",
    ".remote:not(.handheld):after{right:31%}",
    ".remote:not(.handheld) .remote-screen-frame{position:relative;z-index:2!important;border-color:#3a4142!important;",
    " box-shadow:inset 0 0 0 .3vh #050708,0 1vh 2.5vh #0009,0 0 0 .15vh #4a5253!important}",
    ".remote:not(.handheld) .remote-screen-hinge{width:7vh!important;height:7vh!important;margin:-1vh 0 -1.4vh!important;",
    " border-radius:.8vh .8vh .4vh .4vh!important;background:linear-gradient(90deg,#1a1f20,#454c4d 40%,#353c3d 60%,#161b1c)!important;",
    " box-shadow:inset 0 .3vh 0 #ffffff14,0 .6vh 1vh #0009!important}",
    ".remote:not(.handheld) .remote-base{position:relative;z-index:1;border-radius:2vh 2vh 6vh 6vh!important;",
    " background:linear-gradient(178deg,#3a4142 0%,#2b3132 46%,#1d2223 47%,#151a1b 100%)!important;",
    " box-shadow:inset 0 .5vh .6vh #ffffff1c,inset 0 -2vh 3vh #0009,0 1.5vh 2vh #0008!important}",
    /* a empunhadura de baixo, com o recorte entre as maos e a marca XAG */
    ".remote:not(.handheld) .remote-base:before{display:block!important;content:'';position:absolute;left:0;right:0;bottom:0;",
    " top:53%;width:auto!important;height:auto!important;border-radius:0 0 5.6vh 5.6vh;",
    " background:radial-gradient(ellipse 22% 60% at 50% 100%,#0b0e0f 0 58%,transparent 60%),linear-gradient(#1c2122,#0f1314);",
    " box-shadow:inset 0 .3vh .3vh #ffffff0d}",
    ".remote:not(.handheld) .remote-base:after{display:block!important;content:'XAG';position:absolute;left:50%;top:60%;",
    " transform:translateX(-50%);width:auto!important;height:auto!important;background:none;box-shadow:none;border-radius:0;",
    " font:900 italic 1.7vh/1 'Segoe UI',Arial,sans-serif;letter-spacing:.24em;color:#3a4243;text-shadow:0 -.1vh 0 #000}",
    ".remote:not(.handheld) .hardware-side,.remote:not(.handheld) .hardware-center{z-index:2}",
    ".remote:not(.handheld) .hardware-center{bottom:auto!important;height:53%}",
    ".remote:not(.handheld) .hardware-brand{display:none!important}",
    ".remote:not(.handheld) .stick{top:calc(26% - 6.5vh)!important;",
    " background:radial-gradient(circle at 50% 50%,#2a3132 0 30%,#0e1213 31% 46%,#20262a 47% 60%,#14191a 61% 100%)!important;",
    " box-shadow:inset 0 .8vh 1.4vh #000c,inset 0 -.4vh .6vh #ffffff0d,0 .5vh .9vh #0008!important}",
    ".remote:not(.handheld) .stick:before{width:36%!important;",
    " background:repeating-conic-gradient(#6b7476 0 10deg,#3d4547 10deg 20deg)!important;",
    " box-shadow:inset 0 0 0 .4vh #aeb7b3,0 .6vh .8vh #000b!important}",
    ".remote:not(.handheld) .hardware-buttons span:nth-child(1){top:16%}",
    ".remote:not(.handheld) .hardware-buttons span:nth-child(2){top:35%}",
    ".remote:not(.handheld) .hardware-buttons span:nth-child(-n+2){width:8.4vh!important;height:4.2vh!important;",
    " background:linear-gradient(#2b3233,#111617)!important;box-shadow:0 .3vh .5vh #000a,inset 0 .2vh 0 #ffffff10!important}",
    ".remote:not(.handheld) .hardware-buttons span:nth-child(4){top:-2.2vh;width:6.6vh!important;height:6.6vh!important;",
    " background:repeating-conic-gradient(#3b4344 0 12deg,#1c2223 12deg 24deg)!important;",
    " box-shadow:inset 0 0 0 1.3vh #262c2d,0 .5vh .8vh #000a!important}",
    ".remote:not(.handheld) .hardware-power{width:5.8vh!important;height:5.8vh!important}",
    ".remote:not(.handheld) .hardware-led{background:#0a0d0e;border-radius:.5vh}",

    /* ---- na vista Controle com o modelo 3D na frente da camera, o site
       mostra SO a tela do app (o corpo e o do modelo). A classe xg-so-tela
       e posta no <html> pelo principal.js quando o modelo esta em cena. */
    /* (com `.remote:not(.handheld)` no seletor para ganhar das regras de cima) */
    "html.xg-so-tela .remote:not(.handheld){padding:0!important;filter:none!important;width:100%!important}",
    "html.xg-so-tela .remote:not(.handheld):before,html.xg-so-tela .remote:not(.handheld):after," +
    "html.xg-so-tela .remote:not(.handheld) .remote-screen-hinge,html.xg-so-tela .remote:not(.handheld) .remote-base{display:none!important}",
    "html.xg-so-tela .remote:not(.handheld) .remote-screen-frame{position:fixed!important;inset:0!important;width:auto!important;",
    " height:auto!important;min-height:0!important;padding:0!important;border:0!important;border-radius:0!important;",
    " box-shadow:none!important;background:#06090a!important}",
    "html.xg-so-tela .remote:not(.handheld) .remote-screen-frame .phone{border-radius:0!important}",
    "html.xg-so-tela .remote:not(.handheld) .remote-off-message{inset:0!important}",
    "html.xg-so-tela .shell{padding:0!important;min-height:0!important}",
    /* Safari: altura explicita em toda a cadeia (o principal.js ainda poe o tamanho em pixels na moldura) */
    "html.xg-so-tela,html.xg-so-tela body{height:100%!important;overflow:hidden!important}",
    "html.xg-so-tela .remote:not(.handheld) .remote-screen-frame{top:0!important;left:0!important;right:0!important;bottom:0!important}",
    "html.xg-so-tela .remote:not(.handheld) .remote-screen-frame .phone{height:100%!important}",

    /* ---------------- celular + ACS4 */
    ".remote.handheld{gap:3vh!important;align-items:flex-end!important}",
    ".remote.handheld .remote-screen-frame{height:88vh!important;width:calc(88vh*.47)!important;max-width:62vw!important;",
    " min-height:0!important;padding:.8vh!important;border-width:.6vh!important;border-radius:4.2vh!important}",
    ".remote.handheld .remote-screen-frame .phone{border-radius:3.4vh!important}",
    /* as telas do app no celular (botoes no lugar do XAG One) sao do telas_xag.js */
    ".remote.handheld .remote-off-message{inset:1.4vh!important}",
    ".remote.handheld .handheld-body{height:78vh!important;width:17vh!important;min-height:0!important;",
    " padding:3vh 2vh 2.2vh!important;gap:1.4vh!important;border-radius:3vh 3vh 6vh 6vh!important}",
    ".remote.handheld .handheld-head{font-size:2.6vh!important}",
    ".remote.handheld .handheld-led{font-size:1.2vh!important}",
    ".remote.handheld .handheld-joystick{width:8vh!important;height:8vh!important;margin:1vh 0!important}",
    ".remote.handheld .handheld-keys{gap:.8vh!important}",
    ".remote.handheld .handheld-keys span{min-height:4.2vh!important;font-size:1.45vh!important}",
    ".remote.handheld .handheld-arrows{width:7vh!important;gap:.9vh!important}",
    ".remote.handheld .handheld-arrows span{min-height:5vh!important}",
    ".remote.handheld .handheld-power{width:7vh!important;height:7vh!important;color:transparent!important;font-size:0!important;",
    " background:" + ICONE_ENERGIA + " center/42% no-repeat,radial-gradient(circle,#393f3e,#171c1d)!important}",
  ].join("");

  /* O site do controle foi feito para rodar sozinho e avisa que "nenhum
     drone será comandado". Aqui dentro o Iniciar decola a aeronave no
     campo: o aviso passaria a mentir. O app redesenha a tela inteira a cada
     toque, entao a troca e refeita a cada redesenho. */
  var AVISOS = [
    ["Exercício guiado baseado no material enviado. Nenhum drone será comandado.",
     "Ao tocar em Iniciar, a aeronave decola no campo do treinamento."],
  ];

  function trocarAvisos(doc) {
    var tela = doc.getElementById("phone");
    var J = doc.defaultView;
    if (!tela || !J || !J.MutationObserver) return;

    function varrer() {
      var andar = doc.createTreeWalker(tela, J.NodeFilter.SHOW_TEXT);
      var no;
      while ((no = andar.nextNode())) {
        for (var i = 0; i < AVISOS.length; i++) {
          if (no.nodeValue.indexOf(AVISOS[i][0]) !== -1) {
            no.nodeValue = no.nodeValue.replace(AVISOS[i][0], AVISOS[i][1]);
          }
        }
      }
    }

    new J.MutationObserver(varrer).observe(tela, { childList: true, subtree: true });
    varrer();
  }

  /* ----------------------------------------------------------- 1. imagem */

  /* Proporcao do MAPA na tela do app: e sobre o retangulo do .map-svg que
     o app converte o toque em 0-100. Muda com o tipo de aparelho
     (tela deitada no integrado, celular em pe no portatil). Sem mapa na
     tela (login, abertura), usa a tela do app sem a barra de status. */
  VinculoXag.prototype.proporcao = function () {
    var doc = this.documento();
    if (!doc) return null;
    var mapa = doc.querySelector("#phone .map-svg") || doc.querySelector("#phone .map");
    var r = mapa && mapa.getBoundingClientRect();
    if (!r || r.width < 50 || r.height < 50) {
      var tela = doc.getElementById("phone");
      r = tela && tela.getBoundingClientRect();
      if (!r || r.width < 50 || r.height < 94) return null;   // aparelho fechado
      return r.width / (r.height - 44);
    }
    return r.width / r.height;
  };

  /* ---------------------------------------------- o aparelho do operador

     O tipo de aparelho e parte do kit, como o operador e o terreno: e
     escolhido na tela inicial do campo e fica guardado para a proxima vez.
     O site do controle e levado ate ele pelos proprios botoes dele. */

  var CHAVE_APARELHO = "tpd_xag_aparelho";
  /* 06/10/2026 (Eduardo): o XAG P60 treina so com o controle de tela
     integrada; o "Portatil + celular" saiu (e o celular saiu da conta) */
  var APARELHOS = [
    { id: "integrado", site: "integrated", nome: "Tela integrada",
      desc: "Controle com a tela do XAG One no próprio aparelho, deitada." },
  ];

  VinculoXag.prototype.aparelhoEscolhido = function () {
    var v = null;
    try { v = window.localStorage.getItem(CHAVE_APARELHO); } catch (e) { v = null; }
    return "integrado";
  };

  /* O bloco "Controle da aeronave" na tela inicial do campo, no mesmo
     formato do "Nivel do terreno" e da escolha do operador. */
  VinculoXag.prototype.seletorDeAparelho = function () {
    var j = this.ponte.janela;
    var doc = j && j.document;
    var comecar = doc && doc.getElementById("bComecar");
    if (!comecar || doc.getElementById("xgAparelho")) return false;
    /* um aparelho so: nao ha o que escolher */
    if (APARELHOS.length < 2) return false;

    var rotulo = doc.createElement("p");
    rotulo.className = "rot";
    rotulo.style.marginTop = "18px";
    rotulo.textContent = "Controle da aeronave";

    var grupo = doc.createElement("div");
    grupo.className = "avatares";
    grupo.id = "xgAparelho";
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Controle da aeronave");

    var descricao = doc.createElement("p");
    descricao.style.cssText = "margin:8px 0 0;font-size:13px;line-height:1.5;color:#C3CCD5";

    function marcar(id) {
      var botoes = grupo.querySelectorAll("button");
      for (var i = 0; i < botoes.length; i++) {
        botoes[i].setAttribute("aria-pressed", String(botoes[i].dataset.aparelho === id));
      }
      var a = APARELHOS.filter(function (x) { return x.id === id; })[0];
      descricao.textContent = a ? a.desc : "";
    }

    APARELHOS.forEach(function (a) {
      var b = doc.createElement("button");
      b.type = "button";
      b.dataset.aparelho = a.id;
      b.textContent = a.nome;
      b.addEventListener("click", function () {
        try { window.localStorage.setItem(CHAVE_APARELHO, a.id); } catch (e) { /* sem guardar */ }
        marcar(a.id);
      });
      grupo.appendChild(b);
    });

    comecar.parentNode.insertBefore(rotulo, comecar);
    comecar.parentNode.insertBefore(grupo, comecar);
    comecar.parentNode.insertBefore(descricao, comecar);
    marcar(this.aparelhoEscolhido());
    return true;
  };

  /* Chamado a cada ciclo: deixa o site do controle no aparelho escolhido e
     pula a tela de login do app - o aparelho do operador ja vem com o
     XAG One logado, como no campo. */
  VinculoXag.prototype.aplicarAparelho = function () {
    var doc = this.documento();
    if (!doc || !doc.body || !doc.getElementById("xg-embutido")) return;

    var alvo = APARELHOS.filter(function (a) { return a.id === this.aparelhoEscolhido(); }, this)[0];
    var tipo = this.tipoDeAparelho();

    if (tipo && tipo !== alvo.id) {
      var trocar = doc.getElementById("change-control");
      if (trocar) trocar.click();
      tipo = null;
    }
    if (!tipo) {
      var card = doc.querySelector('[data-controller="' + alvo.site + '"]');
      if (card) card.click();
      return;
    }

    var entrar = doc.querySelector('#phone [data-action="demo"]');
    if (entrar) entrar.click();
  };

  /* Tipo de aparelho escolhido no site: "integrado", "portatil" ou null. */
  VinculoXag.prototype.tipoDeAparelho = function () {
    var doc = this.documento();
    var seletor = doc && doc.getElementById("controller-picker");
    if (!seletor || !seletor.hidden) return null;
    var r = doc.getElementById("remote");
    return r && r.classList.contains("handheld") ? "portatil" : "integrado";
  };

  /* Chamado a cada ciclo com a vista Controle aberta. A foto so pode ser
     tirada depois que o aluno escolhe o tipo de aparelho (a proporcao do
     mapa depende dele) e tem de ser refeita se ele trocar de aparelho ou a
     tela mudar de formato - senao o toque cai no lugar errado do campo. */
  VinculoXag.prototype.manterFoto = function () {
    var tipo = this.tipoDeAparelho();
    if (!tipo) return;
    /* UMA foto por tipo de aparelho. Cada tela do app tem o mapa num
       tamanho um pouco diferente, e o proprio app estica a imagem em cada
       uma - os pontos 0-100 continuam presos a imagem. Refazer a foto a
       cada troca de tela mudava a conta de ponto para metro no meio do
       caminho: a rota desenhada saia torta em relacao ao talhao e o
       "Gerar rota" as vezes nao chegava ao campo. */
    if (this.foto && this.fotoTipo === tipo) return;
    var trocouDeAparelho = !!this.fotoTipo;
    if (!this.plantarImagem()) return;
    this.fotoTipo = tipo;
    /* aparelho novo, tela nova: o mesmo talhao do app cai em outro lugar */
    if (trocouDeAparelho) this.carregarTalhao();
  };

  VinculoXag.prototype.plantarImagem = function () {
    var doc = this.documento();
    if (!doc || !doc.head) return false;

    var p = this.proporcao();
    if (!p) return false;

    var larguraM = Math.sqrt(AREA_DO_QUADRO * p);
    var alturaM = AREA_DO_QUADRO / larguraM;

    /* falhou a foto: fica a anterior - apagar derrubava a conta de metro */
    var nova = this.ponte.fotografarDeCima({ larguraM: larguraM, alturaM: alturaM, px: 2048 });
    if (!nova || !nova.imagem) return false;
    this.foto = nova;

    /* O site troca `lavoura.jpg` e `lavoura-landscape.jpg` conforme a tela
       e o modelo; todas as regras passam a apontar para a foto. Tamanho
       100% 100% em vez de cover: a foto ja tem a proporcao da tela, e cover
       cortaria as bordas se a tela mudar um pixel - e a conta de metro
       depende de a foto cobrir o quadro exatamente. */
    var url = 'url("' + this.foto.imagem + '")';
    var estilo = doc.getElementById("xg-foto-estilo");
    if (!estilo) {
      estilo = doc.createElement("style");
      estilo.id = "xg-foto-estilo";
      doc.head.appendChild(estilo);
    }
    var regra = function (u) {
      return ".map,.map-photo,.remote-screen-frame .map,.remote.handheld .map," +
        ".remote.handheld .map-photo{background-image:" + u + "!important;" +
        "background-size:100% 100%!important;background-position:center!important}" +
        ".map-bg img{display:none!important}";
    };
    estilo.textContent = regra(url);
    /* 21/11/2026 (Eduardo: "quando ela criar mapa hd no xguri vai aparecer no controle do xag"): o Mapa HD que o aluno
       fez no XGuri do Air 2S (app_guri.js) entra por cima da foto, no mesmo lugar, com mais pixels. A conta de ponto
       para metro nao muda: a imagem continua cobrindo o mesmo quadro. */
    if (window.GURI_MAPAS) window.GURI_MAPAS.compor(nova, "hd", 4096).then(function (hd) {
      if (hd && estilo.isConnected) estilo.textContent = regra('url("' + hd + '")');
    });
    return true;
  };

  VinculoXag.prototype.paraMetros = function (u, v) {
    return [
      this.foto.centro.x + (u / 100 - 0.5) * this.foto.larguraM,
      this.foto.centro.z + (v / 100 - 0.5) * this.foto.alturaM,
    ];
  };

  /* ----------------------------------------------------------- 2. talhao */

  /* Chamado a cada ciclo. O app salva no navegador a cada ponto marcado,
     entao "mudou o salvo" ainda nao e "salvou o mapa": o talhao so vai
     para o campo quando o aluno toca em Salvar (acao `complete`) - ouvido
     em `instalar`. Aqui fica so a primeira carga, do mapa que ja estava
     salvo de antes. */
  VinculoXag.prototype.conferirTarefas = function () {
    if (!this.foto) return;
    this.instalar();
    if (this.assinaturaVista !== undefined) return;
    var m = this.salvo();
    this.assinaturaVista = assinar(m);
    if (m && m.points && m.points.length >= 3) this.carregarTalhao(m);
  };

  function assinar(m) {
    if (!m) return "";
    return JSON.stringify([m.points || [], m.obstacles || [], m.obstaclePolygons || []]);
  }

  VinculoXag.prototype.carregarTalhao = function (m) {
    m = m || this.salvo();
    if (!this.foto || !m || !m.points || m.points.length < 3) return false;

    var self = this;
    var limite = m.points.map(function (p) { return self.paraMetros(p[0], p[1]); });

    var obstaculos = [];
    /* circulo: o app guarda [u, v, raio/3] - o raio escolhido em metros
       dividido por 3 para desenhar. Volta para metros multiplicando. */
    (m.obstacles || []).forEach(function (o) {
      obstaculos.push({ tipo: "circulo", c: self.paraMetros(o[0], o[1]), r: (o[2] || 1) * 3 });
    });
    (m.obstaclePolygons || []).forEach(function (z) {
      if (z.length >= 3) {
        obstaculos.push({ tipo: "poligono", pts: z.map(function (p) { return self.paraMetros(p[0], p[1]); }) });
      }
    });

    var aviso = this.conferirTalhao(limite);
    if (aviso) {
      if (this.aoCarregarTalhao) this.aoCarregarTalhao({ erro: aviso, nome: m.name });
      return false;
    }

    /* direcao, zonas sem pulverizacao e ponto de entrada do app valem para
       a rota do campo (aparelho_xag.js) - antes de o campo gera-la */
    if (this.aparelho) this.aparelho.configurarRota(m, this.paraMetros.bind(this));

    this.ponte.definirMapa(limite, obstaculos);
    /* mapa do XAG: a geometria do app RC Plus (app_rcplus.js) nao vale aqui */
    this.ponte.rodar("if(typeof P!=='undefined' && P) P.xgGeo=null; if(typeof reiniciarVoo==='function' && !(V && V.rodando)) reiniciarVoo();");

    var r = {
      nome: m.name || "Mapa",
      pontos: limite.length,
      areaCampo: areaHectares(limite),
      obstaculos: obstaculos.length,
    };
    if (this.aoCarregarTalhao) this.aoCarregarTalhao(r);
    return r;
  };

  function areaHectares(pontos) {
    var soma = 0;
    for (var i = 0; i < pontos.length; i++) {
      var a = pontos[i], b = pontos[(i + 1) % pontos.length];
      soma += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(soma / 2) / 10000;
  }
  VinculoXag.prototype.areaHectares = areaHectares;

  /* mesma regra do DJI: fora da grade de tinta do campo a cobertura mente */
  VinculoXag.prototype.conferirTalhao = function (limite) {
    var c = this.caixaDeAplicacao();
    var dentro = limite.every(function (p) {
      return p[0] >= c.x0 && p[0] <= c.x1 && p[1] >= c.z0 && p[1] <= c.z1;
    });
    if (!dentro) return "O limite desenhado cai fora da área que o campo aplica.";
    if (areaHectares(limite) < 0.05) return "Limite pequeno demais para uma operação.";
    return null;
  };

  VinculoXag.prototype.caixaDeAplicacao = function () {
    if (this.caixa) return this.caixa;
    var p = this.ponte.ler(
      "(typeof PINT!=='undefined' ? " +
      "{x0:PINT.x0, z0:PINT.z0, x1:PINT.x0+PINT.larg, z1:PINT.z0+PINT.prof} : null)"
    );
    this.caixa = p || { x0: -120, z0: -230, x1: 120, z1: 50 };
    return this.caixa;
  };

  /* ------------------------------------------- 3. ouvir o que o aluno toca

     O app responde aos toques por `data-action` num ouvinte do `#phone`.
     A gente ouve o mesmo clique DEPOIS dele (fase de bolha no documento,
     com setTimeout 0) e le o que ele salvou:

       complete  = "Salvar" nos detalhes do mapa  -> talhao vai ao campo
       op-start  = "Iniciar" na operacao          -> a aeronave decola
     ---------------------------------------------------------------------- */

  VinculoXag.prototype.instalar = function () {
    if (this.instalado) return;
    var doc = this.documento();
    if (!doc || !doc.body) return;

    var self = this;
    doc.addEventListener("click", function (e) {
      var alvo = e.target && e.target.closest && e.target.closest("[data-action]");
      if (!alvo) return;
      var acao = alvo.getAttribute("data-action");

      if (acao === "complete") {
        setTimeout(function () {
          var m = self.salvo();
          self.assinaturaVista = assinar(m);
          self.carregarTalhao(m);
        }, 0);
      }

      /* "Gerar rota" / "Atualizar rota": a rota do campo refaz com a
         direcao e o espacamento novos */
      if (acao === "generate-route") {
        if (self.aparelho) self.aparelho.anguloDoF2 = null;
        setTimeout(function () { self.carregarTalhao(self.salvo()); }, 0);
      }

      /* 19/11/2026: começou a contagem regressiva da decolagem (xag_parametros.js): a aeronave apita e o auxiliar que estiver perto corre */
      if (acao === "op-contagem") {
        self.ponte.rodar("if(typeof xgApitar==='function')xgApitar()");
      }

      if (acao === "op-start") {
        setTimeout(function () { self.decolar(); }, 0);
      }
    });
    this.instalado = true;
  };

  /* O app so poe `opRunning` quando a lista de conferencia dele esta
     completa (opReady). Se nao ficou rodando, ele mesmo ja avisou o aluno. */
  VinculoXag.prototype.decolar = function () {
    var m = this.salvo();
    if (!m || !m.opRunning) return;

    /* o que o aluno escolheu no app vale para o voo - sem corrigir nada:
       valor ruim e aula (ver memoria "deixar o aluno errar") */
    var p = {};
    if (m.opHeight > 0) p.altura = Number(m.opHeight);
    if (m.opSpeed > 0) p.vel = Number(m.opSpeed);
    if (m.opVolume > 0) p.vazao = Number(m.opVolume);
    if (m.opDroplet > 0) p.gota = Number(m.opDroplet);
    if (m.spacing > 0) p.faixa = Number(m.spacing);
    /* Configuracoes de operacao (xag_parametros.js): evitacao de obstaculos
       e a altura da rota de aproximacao, que e a do deslocamento e do RTH */
    if (m.xpPlano) {
      if (typeof m.xpPlano.radar === "boolean") p.desvio = m.xpPlano.radar;
      if (m.xpPlano.aproxAltura > 0) p.rth = Number(m.xpPlano.aproxAltura);
    }
    this.ponte.definirParametros(p);
    /* como o XAG voa (voo_xag.js): seguimento do terreno das Configuracoes
       de operacao e a % de pouso da pagina Bateria do dispositivo */
    var self = this, pl = m.xpPlano || {};
    if (window.VOO_XAG) window.VOO_XAG.configurar(this.ponte, {
      terreno: pl.terreno ? pl.terreno : "all",
      batPouso: typeof m.xgBatPouso === "number" ? m.xgBatPouso : 10,
      /* 19/11/2026: "Pulverize durante a mudanca de faixa" (xag_parametros.js): dos dois lados, so os bicos de fora ou desligado */
      mudanca: pl.mudancaFaixa === "off" || pl.mudancaFaixa === "externos" ? pl.mudancaFaixa : "ambos",
      voo3d: !!pl.voo3d, semCarga: !!pl.semCarga,
      /* pontos de seguranca (base -> lote): caminho de entrada e de saida */
      caminho: pl.entrada !== "area" && Array.isArray(pl.pontos)
        ? pl.pontos.filter(function (p) { return p && p.length >= 2; }).map(function (p) { return self.paraMetros(p[0], p[1]); }) : [] });

    /* garante que o talhao no campo e o que esta no app agora */
    this.carregarTalhao(m);

    var r = this.ponte.iniciarOperacao();
    /* tarefa em andamento: retoma de onde parou (aparelho_xag.js) */
    if (r && r.ok && this.aparelho) r.retomada = this.aparelho.retomarTarefaEmAndamento();
    if (this.aoDecolar) this.aoDecolar(r);
  };

  /* ------------------------------------------------- 4. estado do aparelho

     O site marca o corpo do controle com as classes off / booting / on.
     A guia usa isso para lembrar o aluno de ligar o aparelho. */
  VinculoXag.prototype.faseDoAparelho = function () {
    var doc = this.documento();
    var r = doc && doc.getElementById("remote");
    if (!r) return null;
    if (r.classList.contains("booting")) return "carregando";
    if (r.classList.contains("on")) return "pronto";
    return "desligado";
  };

  /* O app XAG deste site nao tem estado de conexao com a aeronave. */
  VinculoXag.prototype.estadoDaOperacao = function () {
    var e = this.ponte.estado(), f = this.foto, d = e && e.drone, voo = e && e.voo;
    /* sem sinal (voo_xag.js: arvore, casa, morro entre o operador e ela) o
       app ve a aeronave como desconectada: sem telemetria e sem camera */
    var sinal = this.ponte.ler("window.xgVooXag ? xgVooXag.sinal : true") !== false;
    /* sem bateria (comeco da operacao, equipe.js) a aeronave esta desligada */
    var ligada = this.ponte.ler("!(window.xgEquipe && xgEquipe.semBateria)") !== false;
    var pronto = this.conectado === true && !!d && !!voo && sinal && ligada;
    return {conectado: pronto, ponto: pronto && f ? [((d.x-f.centro.x)/f.larguraM+.5)*100, ((d.z-f.centro.z)/f.alturaM+.5)*100] : null,
      operador: e && e.operador && f ? [((e.operador.x-f.centro.x)/f.larguraM+.5)*100, ((e.operador.z-f.centro.z)/f.alturaM+.5)*100] : null,
      velocidade: voo && voo.velocidade, altura: voo && voo.alturaSolo,
      /* cartao P60H das configuracoes de operacao (xag_parametros.js) */
      bateria: pronto ? voo.bateria : null, tanque: pronto ? voo.tanque : null,
      tanqueCap: e && e.maquina && e.maquina.tanque, estadoVoo: pronto ? voo.estado : null,
      /* registro de operacao e Centro Rapido (xag_servicos.js) */
      aplicadoHa: pronto ? voo.aplicadoHa : null, rumo: pronto ? d.rumo : null,
      teste: pronto && this.aparelho && this.aparelho.testeEmCurso ? this.aparelho.testeEmCurso() : null,
      retorno: pronto && voo.estado === 'voltando',
      alertaObstaculo: pronto && !!voo.rodando && (this.ponte.radar(6) || []).length > 0,
      pausado: !!(window.PAUSA_SIM && window.PAUSA_SIM.pausado)};
  };
  VinculoXag.prototype.refletirConexao = function (ligado) {
    this.conectado = ligado === true;
    var j = this.janela();
    if (j && j.XAG_OPERACAO) j.XAG_OPERACAO.receber(this.estadoDaOperacao());
  };

  /* O ⏻ desenhado no aparelho do campo aperta o ⏻ do site. */
  VinculoXag.prototype.apertarEnergia = function () {
    var doc = this.documento();
    var b = doc && doc.getElementById("remote-power");
    if (b) b.click();
  };

  return {
    criar: function (ponte, quadro) { return new VinculoXag(ponte, quadro); },
  };
})();
