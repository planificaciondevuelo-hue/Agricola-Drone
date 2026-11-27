/* ==========================================================================
   A OPERACAO: DECOLAR PELO CONTROLE E VER O VOO NA TELA DO APP

   Ate aqui o vinculo levava o campo PARA o controle: a foto e o talhao.
   Falta o caminho de volta - o aluno aperta Iniciar no controle e o drone
   sobe no campo; o drone voa no campo e os numeros aparecem no controle.

   Duas partes:

     1. DECOLAGEM   a sequencia do aparelho de verdade:
                    Iniciar -> verificacao automatica -> sincronizando com
                    a aeronave -> deslizar para decolar -> 3, 2, 1 -> sobe.

     2. TELEMETRIA  enquanto voa, a tela de operacao mostra area coberta,
                    quantidade aplicada, altitude, velocidade, distancia e
                    vazao - lidos do campo, nao inventados.

   Tudo e montado POR FORA, dentro do documento do controle. O site do
   controle e desenvolvido em outra pasta e a copia daqui e refeita a cada
   atualizacao: se a gente editasse os arquivos dele, a proxima atualizacao
   levaria o conserto junto. Por isso nada aqui escreve no controle - so
   acrescenta.
   ========================================================================== */

window.OPERACAO = (function () {
  "use strict";

  /* O app inteiro e medido em `cqw` - centesimos da largura da tela do
     aparelho. E o que faz ele ficar igual num monitor grande e na moldura
     pequena do treinamento. Tudo daqui segue a mesma regua. */
  var ESTILO = [
    /* --- a sequencia de decolagem ------------------------------------- */
    ".xg-seq{position:absolute;inset:0;display:none;align-items:center;",
    "  justify-content:center;background:rgba(10,14,20,.55);z-index:40}",
    ".xg-seq.aberta{display:flex}",
    ".xg-cartao{width:46cqw;max-height:82cqh;display:flex;flex-direction:column;",
    "  background:#fff;border-radius:1cqw;overflow:hidden;",
    "  box-shadow:0 1.4cqw 3.4cqw rgba(0,0,0,.36)}",
    ".xg-cartao h3{margin:0;padding:1.4cqw 1.8cqw .8cqw;font-size:2.2cqw;",
    "  font-weight:600;color:#1d2126}",
    ".xg-sub{margin:0;padding:0 1.8cqw .9cqw;font-size:1.6cqw;color:#7b8288}",
    ".xg-lista{overflow:auto;padding:0 1.8cqw;flex:1}",
    ".xg-linha{display:flex;justify-content:space-between;gap:1.2cqw;",
    "  align-items:baseline;padding:.7cqw 0;border-top:1px solid #eef0f2;font-size:1.7cqw}",
    ".xg-linha .n{color:#5d646a}",
    ".xg-linha .v{color:#2f8a4a;font-weight:600;text-align:right}",
    ".xg-linha.al .v{color:#d9822b}",
    /* rodape: sincronizando, deslizar, contagem */
    ".xg-rodape{padding:1.2cqw 1.8cqw 1.4cqw;border-top:1px solid #eef0f2;background:#fbfbfc}",
    ".xg-sinc{font-size:1.6cqw;color:#5d646a;margin:0 0 .8cqw}",
    ".xg-barra{height:.5cqw;border-radius:.3cqw;background:#e6e9ec;overflow:hidden}",
    ".xg-barra i{display:block;height:100%;width:0;background:#2f8a4a;",
    "  transition:width .25s linear}",
    ".xg-desliza{position:relative;height:5.4cqw;margin-top:1.2cqw;border-radius:3cqw;",
    "  background:#eef1f3;display:none}",
    ".xg-desliza.aberta{display:block}",
    ".xg-desliza .rot{position:absolute;inset:0;display:flex;align-items:center;",
    "  justify-content:center;font-size:1.7cqw;color:#7b8288;pointer-events:none}",
    ".xg-desliza input{position:absolute;inset:0;width:100%;height:100%;margin:0;",
    "  opacity:0;cursor:grab}",
    ".xg-desliza b{position:absolute;top:.5cqw;left:.5cqw;width:4.4cqw;height:4.4cqw;",
    "  border-radius:50%;background:#2f8a4a}",
    ".xg-botoes{display:flex;gap:1cqw;margin-top:1cqw}",
    ".xg-botoes button{flex:1;height:4.2cqw;border:0;border-radius:.6cqw;font-size:1.7cqw;",
    "  background:#eef1f3;color:#3b4146;cursor:pointer;font-family:inherit}",
    ".xg-conta{font-size:9cqw;font-weight:700;color:#fff;text-align:center;",
    "  text-shadow:0 .4cqw 1.6cqw rgba(0,0,0,.5)}",
    /* --- painel de operacao (so em voo) ------------------------------- */
    /* do alto ate o pe da tela: os botoes Encerrar/Retomar ficam bem
       embaixo, como no app (foto dele) */
    /* em voo (foto dele): um cartao pequeno no alto a direita com area e
       quantidade, a coluna de ferramentas continua, e Encerrar/Pausar sao
       dois botoes grandes empilhados no canto de baixo */
    ".xg-op{position:absolute;right:1.2cqw;top:11.4cqw;width:28cqw;z-index:22;",
    "  flex-direction:column;",
    "  background:rgba(20,26,36,.72);border-radius:.6cqw;padding:.5cqw 1cqw;",
    "  color:#fff;display:none}",
    ".xg-op .par.xg-mais{display:none!important}",
    ".xg-op .xg-recolhe{position:absolute;right:-1.6cqw;top:50%;transform:translateY(-50%);width:1.8cqw;height:4cqw;",
    "  border:0;border-radius:0 .5cqw .5cqw 0;background:rgba(20,26,36,.72);color:#fff;font-size:1.4cqw;cursor:pointer;padding:0}",
    ".xg-op.xg-fechado .par{display:none}",
    ".xg-op.xg-fechado{width:1cqw;padding:2cqw 0}",
    /* position:fixed com transform no ancestral nao fixa; vai por absolute
       na tela da execucao, fora do cartao */
    "[data-tela='execucao'] .xg-acoes-voo{position:absolute;right:1.2cqw;bottom:1.2cqw;z-index:24;display:none;",
    "  flex-direction:column;gap:.8cqw;width:16cqw}",
    "body.xg-voando [data-tela='execucao'] .xg-acoes-voo{display:flex}",
    ".xg-acoes-voo button{height:4.6cqw;border:0;border-radius:.6cqw;font-size:1.8cqw;background:#f7f7f6;color:#2f3336;",
    "  display:flex;align-items:center;justify-content:center;gap:.9cqw;font-weight:500;box-shadow:0 .2cqw .6cqw rgba(0,0,0,.3);",
    "  cursor:pointer;font-family:inherit}",
    ".xg-acoes-voo button svg{width:2cqw;height:2cqw;flex:none}",
    "body.xg-voando .xg-op{display:flex}",
    "body.xg-voando .xg-op.xg-escondido{display:none}",       /* R1 */
    /* com as configuracoes do controle abertas o painel de voo sai: ele
       ficava por cima do X de fechar, e o aluno nao conseguia sair */
    "body:has(#painel-config.aberto) .xg-op,body:has(#painel-extra.aberto) .xg-op{display:none!important}",
    /* em voo o painel de preparo sai de cena, e os avisos de solo tambem:
       "nao e possivel decolar" com a aeronave no ar seria mentira na tela */
    /* em voo o painel de parametros fica recolhido, e a setinha do canto o
       abre (fotos dele): velocidade, altura e gota mudam com a aeronave no
       ar. A aba chama "Operacao" durante o voo. */
    "body.xg-voando [data-tela='execucao']:not(.xg-aberto-em-voo) .painel-execucao,",
    "body.xg-voando [data-tela='execucao'] .acoes-inferiores,",
    "body.xg-voando [data-tela='execucao'] .avisos-voo,",
    /* os botoes da direita (Retificar, Ponto de conexao) ficavam por baixo
       do painel de voo, aparecendo pela transparencia */
    "body.xg-voando [data-tela='execucao'] .botao-retificar,",
    "body.xg-voando [data-tela='execucao'] .bloco-conexao,",
    "body.xg-voando [data-tela='execucao'] .caixa-info-tarefa{display:none}",
    ".xg-op .par{display:flex;align-items:baseline;gap:.6cqw;padding:.35cqw 0}",
    ".xg-op .par span{font-size:1.6cqw;color:#fff}",
    ".xg-op .par b{font-size:1.9cqw;font-weight:600;margin-left:auto}",
    ".xg-op .par i{font-size:1.3cqw;color:#dfe3e6;font-style:normal}",
    /* a coluna de ferramentas continua em voo, a esquerda do cartao */
    "body.xg-voando [data-tela='execucao'] .ferramentas-mapa{display:flex;z-index:23}",
    /* --- tamanho da gota (fotos dele) ---------------------------------- */
    ".xg-gota{position:absolute;left:1.2cqw;top:6.2cqw;bottom:1.2cqw;width:23cqw;z-index:31;display:none;",
    "  flex-direction:column;background:#f7f7f6;border-radius:.9cqw;padding:1.2cqw 1.4cqw;",
    "  box-shadow:0 .5cqw 1.8cqw rgba(0,0,0,.3);font-family:Inter,'Segoe UI',sans-serif;color:#2f3336}",
    ".xg-gota.aberto{display:flex}",
    ".xg-gota .atual{font-size:1.5cqw;color:#5b5f63;line-height:1.3;padding-bottom:.8cqw;border-bottom:1px solid #e3e6e8}",
    ".xg-gota .atual b{color:#2f8a4a;font-weight:500}",
    ".xg-gota .valor{text-align:center;font-size:2.6cqw;font-weight:600;margin:.8cqw 0 .2cqw}",
    ".xg-gota .valor i{font-size:1.5cqw;font-style:normal;font-weight:400;color:#5b5f63;margin-left:.3cqw}",
    ".xg-gota .corpo{flex:1;display:flex;gap:1cqw;min-height:0;padding:0 .4cqw}",
    ".xg-gota .escala{width:7cqw;position:relative;display:flex;flex-direction:column;align-items:center}",
    ".xg-gota .escala .n{font-size:1.4cqw;color:#8a8f93;height:2cqw;line-height:2cqw}",
    ".xg-gota .trilho{flex:1;width:.7cqw;background:#d6dadd;border-radius:.4cqw;position:relative;touch-action:none;cursor:pointer}",
    ".xg-gota .cheio{position:absolute;left:0;right:0;bottom:0;background:#3fbf5a;border-radius:.4cqw}",
    ".xg-gota .alca{position:absolute;left:50%;width:3.4cqw;height:3.4cqw;margin:-1.7cqw 0 0 -1.7cqw;border-radius:50%;",
    "  background:#fff;box-shadow:0 .15cqw .5cqw rgba(0,0,0,.3);border:.15cqw solid #d6dadd}",
    ".xg-gota .classes{flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:1.5cqw 0}",
    ".xg-gota .classes div{display:flex;align-items:center;gap:.6cqw;font-size:1.35cqw;color:#5b5f63}",
    ".xg-gota .classes i{width:.8cqw;height:.8cqw;border-radius:50%;flex:none}",
    ".xg-gota .classes span{background:#eceeef;border-radius:.4cqw;padding:.3cqw .6cqw;line-height:1.15}",
    ".xg-gota .aplicar{border:0;background:none;color:#2f8a4a;font-size:1.9cqw;font-weight:600;",
    "  padding:.8cqw 0 .2cqw;cursor:pointer;font-family:inherit;border-top:1px solid #e3e6e8;margin-top:.6cqw}",
    /* --- as configuracoes, coladas na beirada (fotos dele) ------------- */
    /* no aparelho a tela branca vai de alto a baixo e ate a borda direita,
       sem margem; so o mapa sobra numa tira a esquerda */
    ".painel-config{align-items:stretch!important;justify-content:flex-start!important}",
    ".painel-config .caixa-config{position:absolute;left:11cqw;right:0;top:0;bottom:0;",
    "  width:auto!important;height:auto!important;border-radius:0!important;box-shadow:none!important}",
    /* a bateria de verdade: 14 celulas e a barra de carga em cada uma */
    ".celulas-bateria .xg-carga{position:absolute;left:14%;right:14%;bottom:5%;background:#3fbf5a;border-radius:.2cqw}",
    ".celulas-bateria > div{position:relative}",
    ".celulas-bateria > div svg{position:relative;z-index:1}",
    ".faixa-dupla .xg-cheio{position:absolute;top:50%;height:.5cqw;transform:translateY(-50%);background:#f0a63a;z-index:0}",
    /* --- o estado da aeronave ------------------------------------------ */
    /* os avisos do HTML do controle sao fixos (GNSS fraco, pedestres, trava
       do braco 3): nenhum deles e verdade no treinamento */
    ".avisos-voo{display:none!important}",
    ".barra-voo .alerta-voo.xg-vazio{display:none}",
    ".status-voo .xg-bom{color:#3ad46a!important}",
    ".status-voo .xg-bom svg{fill:#3ad46a!important;color:#3ad46a!important}",
    ".status-voo .tanque.xg-bom svg{fill:none!important}",
    ".status-voo .xg-meio{color:#f0c419!important}",
    ".status-voo .xg-meio svg{fill:#f0c419!important;color:#f0c419!important}",
    ".status-voo .tanque.xg-meio svg{fill:none!important}",
    ".status-voo .xg-ruim{color:#ff4034!important}",
    ".status-voo .xg-ruim svg{color:#ff4034!important}",
    ".caixa-info-tarefa .etiqueta-baixa.xg-alto{color:#3ad46a;background:rgba(58,212,106,.16)}",
    /* --- a camera do drone ---------------------------------------------- */
    ".fpv .xg-camera{position:absolute;inset:0;width:100%;height:100%;display:block;background:#0b0f13}",
    ".fpv svg{position:relative;z-index:1}",
    /* no mapa fica so a mira dele (a foto ampliada e o veu saem) */
    ".fpv.xg-com-mira svg > g[transform],.fpv.xg-com-mira svg > rect{display:none}",
    /* na execucao o desenho cinza sai inteiro, e a janela aparece */
    ".fpv.xg-so-camera svg{display:none}",
    /* so com a aeronave no ar: antes de decolar o painel de configuracoes
       ocupa a esquerda, e a janela caia em cima dele (pedido dele) */
    "body.xg-voando [data-tela='execucao'] .fpv{display:block!important;cursor:pointer}",
    /* camera em tela cheia e o mapa no canto, como o .trocado do mapa */
    "[data-tela='execucao'].xg-trocado .fpv{left:0;bottom:0;width:100%;height:100%;",
    "  aspect-ratio:auto;border-radius:0;box-shadow:none;z-index:0}",
    /* com a camera em tela cheia, a barra de cima (bateria, GNSS e a
       engrenagem das configuracoes) ficava por baixo dela */
    "[data-tela='mapa'].trocado .barra-voo,[data-tela='execucao'].xg-trocado .barra-voo{z-index:6}",
    "[data-tela='mapa'].trocado .arte-mapa{cursor:pointer}",
    "[data-tela='execucao'].xg-trocado .arte-mapa{left:1.2cqw;right:auto;top:auto;bottom:1.2cqw;",
    "  width:22cqw;height:auto;aspect-ratio:16/10;border-radius:.4cqw;overflow:hidden;z-index:5;",
    "  box-shadow:0 .2cqw .6cqw rgba(0,0,0,.5);cursor:pointer}",
    /* --- o diagnostico da queda --------------------------------------- */
    ".xg-queda{position:absolute;inset:0;display:none;align-items:center;",
    "  justify-content:center;background:rgba(10,14,20,.6);z-index:45}",
    ".xg-queda.aberta{display:flex}",
    /* tela grande (pedido dele): o filme da queda a esquerda, a explicacao
       a direita. A classe e propria - `.cartao` e dos cartoes de tarefa do
       controle e vinha com display:flex, o que espalhava tudo numa linha */
    ".xg-queda .xg-cartao-queda{width:88cqw;height:52cqw;background:#fff;border-radius:1cqw;",
    "  padding:1.6cqw 1.8cqw;box-shadow:0 1.4cqw 3.4cqw rgba(0,0,0,.4);display:flex;gap:1.8cqw}",
    ".xg-queda .filme{width:42cqw;flex:none;display:flex;flex-direction:column;gap:.6cqw}",
    ".xg-queda .filme canvas{width:100%;aspect-ratio:1.6;background:#0b0f13;border-radius:.7cqw;display:block}",
    ".xg-queda .filme small{font-size:1.3cqw;color:#8a8f93}",
    ".xg-queda .texto{flex:1;display:flex;flex-direction:column;min-width:0;overflow:auto}",
    ".xg-queda h3{margin:0 0 .4cqw;font-size:2.6cqw;font-weight:600;color:#c0392b}",
    ".xg-queda .oque{margin:0 0 1cqw;font-size:1.9cqw;color:#2f3336}",
    ".xg-queda ul{margin:0 0 1.2cqw;padding:0;list-style:none}",
    ".xg-queda li{font-size:1.7cqw;color:#5d646a;padding:.45cqw 0;",
    "  border-top:1px solid #eef0f2;display:flex;justify-content:space-between;gap:1.2cqw}",
    ".xg-queda li b{color:#2f3336;font-weight:600;text-align:right}",
    ".xg-queda li.culpa b{color:#c0392b}",
    ".xg-queda .licao{margin:0 0 1.2cqw;font-size:1.6cqw;color:#5d646a;line-height:1.4}",
    ".xg-queda .licao{flex:1}",
    ".xg-queda button{width:100%;height:4.2cqw;border:0;border-radius:.6cqw;flex:none;",
    "  font-size:1.7cqw;background:#eef1f3;color:#3b4146;cursor:pointer;font-family:inherit}",
    /* a abinha que recolhe o painel da tarefa na execucao (pedido dele),
       igual a do mapeamento */
    ".xg-aba-painel{position:absolute;left:0;top:50%;width:2.4cqw;height:6cqw;margin-top:-3cqw;z-index:12;",
    "  background:rgba(60,64,68,.85);border-radius:0 .6cqw .6cqw 0;border:0;color:#fff;cursor:pointer;",
    "  font-size:1.6cqw;display:flex;align-items:center;justify-content:center}",
    "[data-tela='execucao']:not(.xg-recolhido) .xg-aba-painel{left:26.2cqw;border-radius:.6cqw}",
    "[data-tela='execucao'].xg-recolhido .painel-execucao{display:none}",
    "body.xg-voando [data-tela='execucao'] .xg-aba-painel{left:0;border-radius:0 .6cqw .6cqw 0}",
    "body.xg-voando [data-tela='execucao'].xg-aberto-em-voo .xg-aba-painel{left:26.2cqw;border-radius:.6cqw}",
    "body.xg-voando [data-tela='execucao'].xg-aberto-em-voo .painel-execucao{display:flex;bottom:14cqw}",
    /* o menu rapido dos sensores, ao tocar no radar (foto dele) */
    ".xg-sensores{position:absolute;left:27cqw;bottom:13cqw;width:24cqw;z-index:26;display:none;",
    "  background:#f7f7f6;border-radius:.9cqw;padding:.8cqw 1.2cqw;box-shadow:0 .5cqw 1.6cqw rgba(0,0,0,.3);",
    "  font-family:Inter,'Segoe UI',sans-serif}",
    ".xg-sensores.aberto{display:block}",
    ".xg-sensores .linha-toggle-config{display:flex;justify-content:space-between;align-items:center;",
    "  gap:1cqw;padding:.7cqw 0;font-size:1.55cqw;color:#2f3336;line-height:1.2}",
    ".bussola{cursor:pointer}",
    /* --- a verificacao antes da tarefa, como na foto dele -------------- */
    ".xg-cartao{width:62cqw;max-height:92cqh;background:#fff}",
    ".xg-cartao h3{text-align:center;font-size:2.1cqw}",
    ".xg-bloco{background:#f4f4f3;border-radius:.6cqw;padding:.6cqw 1.4cqw;margin:0 1.6cqw .8cqw}",
    ".xg-bloco .xg-linha{border:0;padding:.55cqw 0;font-size:1.75cqw}",
    ".xg-bloco .xg-linha .n{color:#2f3336}",
    ".xg-bloco .xg-linha .v{color:#2f8a4a;font-weight:600;font-size:1.9cqw}",
    ".xg-bloco .xg-linha.al .v{color:#2f8a4a}",
    ".xg-cartoes{display:flex;gap:.6cqw;margin:0 1.6cqw 1cqw}",
    ".xg-cartoes div{flex:1;background:#f4f4f3;border-radius:.6cqw;padding:1cqw .8cqw;text-align:center;",
    "  font-size:1.5cqw;color:#2f3336;display:flex;flex-direction:column;justify-content:space-between;gap:.8cqw;min-height:9cqw}",
    ".xg-cartoes b{font-size:1.7cqw;color:#2f8a4a;font-weight:600}",
    ".xg-cartoes div.off b{color:#2f3336}",
    ".xg-rodape{background:#fff;text-align:center}",
    ".xg-desliza{width:44cqw;margin:1cqw auto 0;background:#e6e9ec}",
    ".xg-desliza .rot{font-size:1.5cqw;color:#8a8f93;padding-left:5cqw;line-height:1.2}",
    ".xg-desliza b{background:#fff;box-shadow:0 .1cqw .4cqw rgba(0,0,0,.25)}",
    ".xg-desliza b::after{content:'\\203A\\203A\\203A';color:#2f8a4a;font-size:2.2cqw;font-weight:700;",
    "  display:flex;align-items:center;justify-content:center;height:100%;letter-spacing:-.2cqw}",
    ".xg-botoes button{background:none;font-size:1.9cqw;color:#2f3336;border-top:1px solid #eef0f2;border-radius:0}",
  ].join("");

  function Operacao(ponte, quadro) {
    this.ponte = ponte;
    this.quadro = quadro;
    this.instalado = false;
    this.voando = false;
    this.aoDecolar = null;       /* aviso para a camada de etapas */
  }

  Operacao.prototype.doc = function () {
    try { return this.quadro.contentDocument; } catch (e) { return null; }
  };

  /* --------------------------------------------------------- 1. montagem */

  Operacao.prototype.instalar = function () {
    var doc = this.doc();
    if (!doc || !doc.body || this.instalado) return false;

    var tela = doc.querySelector("[data-tela='execucao']");
    if (!tela) return false;

    var estilo = doc.createElement("style");
    estilo.id = "xg-operacao-estilo";
    estilo.textContent = ESTILO;
    doc.head.appendChild(estilo);

    tela.insertAdjacentHTML("beforeend",
      this.moldeSequencia() + this.moldePainel() + this.moldeQueda());

    this.montarCamera(doc);
    this.montarGota(doc);

    /* a abinha que recolhe o painel da tarefa */
    var aba = doc.createElement("button");
    aba.className = "xg-aba-painel";
    aba.type = "button";
    aba.textContent = "◂";
    var self = this;
    aba.addEventListener("click", function () {
      var classe = self.voando ? "xg-aberto-em-voo" : "xg-recolhido";
      tela.classList.toggle(classe);
      var aberto = self.voando ? tela.classList.contains("xg-aberto-em-voo") : !tela.classList.contains("xg-recolhido");
      aba.textContent = aberto ? "◂" : "▸";
    });
    tela.appendChild(aba);
    this.abaPainel = aba;

    /* tocar no radar abre o menu rapido com as tres chaves dos sensores;
       cada chave espelha a das Configuracoes do sensor (ajustes.js le de la) */
    var menu = doc.createElement("div");
    menu.className = "xg-sensores";
    var nomes = ["desvio de obstáculos multidirecional", "Estabilização da altitude", "Desvio de obstáculos"];
    menu.innerHTML = nomes.map(function (n, i) {
      return '<div class="linha-toggle-config"><span class="rotulo-toggle"></span><button class="interruptor" data-xg-sensor="' + i + '"><i></i></button></div>';
    }).join("");
    var rots = menu.querySelectorAll(".rotulo-toggle");
    nomes.forEach(function (n, i) { rots[i].textContent = n; });
    tela.appendChild(menu);

    function chaveDasConfiguracoes(nome) {
      var linhas = doc.querySelectorAll(".painel-config .linha-toggle-config");
      for (var i = 0; i < linhas.length; i++) {
        var r = linhas[i].querySelector(".rotulo-toggle");
        if (r && (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(r) : r.textContent).replace(/\s+/g, " ").trim().toLowerCase() === nome.toLowerCase()) return linhas[i].querySelector(".interruptor");
      }
      return null;
    }
    menu.querySelectorAll("[data-xg-sensor]").forEach(function (b, i) {
      b.addEventListener("click", function () {
        var alvo = chaveDasConfiguracoes(nomes[i]);
        if (alvo) alvo.click();
        b.classList.toggle("ligado", alvo ? alvo.classList.contains("ligado") : !b.classList.contains("ligado"));
      });
    });
    var radar = tela.querySelector(".bussola");
    if (radar) radar.addEventListener("click", function () {
      menu.querySelectorAll("[data-xg-sensor]").forEach(function (b, i) {
        var alvo = chaveDasConfiguracoes(nomes[i]);
        b.classList.toggle("ligado", !!(alvo && alvo.classList.contains("ligado")));
      });
      menu.classList.toggle("aberto");
    });
    /* o menu dos sensores fecha tocando fora dele, como no aparelho - so
       tocando de novo no radar ele ficava preso por cima das outras telas */
    doc.addEventListener("click", function (e) {
      if (!menu.classList.contains("aberto")) return;
      if (menu.contains(e.target) || (radar && radar.contains(e.target))) return;
      menu.classList.remove("aberto");
    });

    this.ligarBotoes(doc);
    this.instalado = true;
    this.avisar("");        // o "Incapaz de decolar" que o HTML traz escrito
    return true;
  };

  /* "Tamanho da gota de pulverizacao" (fotos dele): tocar na linha abre, a
     esquerda, a barra vertical de 20 a 500 um com as seis classes ao lado
     (Muito grosso ... Extremamente fino). Anda de 10 em 10, de 50 a 500.
     "Aplicar" leva o valor para a linha e para o P.gota do campo (que
     decide a largura efetiva da faixa). */
  var CLASSES_GOTA = [
    ["Muito grosso", "#3fbf5a"], ["Grosso", "#2b7fe0"], ["Médio", "#f0c419"],
    ["Fino", "#f08a24"], ["Muito fino", "#e8442e"], ["Extremamente fino", "#b84fd6"],
  ];

  Operacao.prototype.montarGota = function (doc) {
    var self = this;
    var linhas = doc.querySelectorAll(".linha-link");
    for (var i = 0; i < linhas.length; i++) {
      if (!/gota/i.test(linhas[i].textContent)) continue;
      if (linhas[i].dataset.xgGota) continue;
      linhas[i].dataset.xgGota = "1";
      (function (linha) {
        linha.addEventListener("click", function () { self.abrirGota(linha); });
      })(linhas[i]);
    }
  };

  Operacao.prototype.abrirGota = function (linha) {
    var doc = this.doc();
    var tela = linha.closest(".tela-app") || doc.body;
    var painel = tela.querySelector(".xg-gota");
    var em = linha.querySelector("em");
    var atual = em ? parseInt(em.textContent, 10) : 300;
    if (!(atual >= 50)) atual = 300;

    if (!painel) {
      painel = doc.createElement("div");
      painel.className = "xg-gota";
      painel.innerHTML =
        '<div class="atual">Configuração atual: <b>Camada dupla (padrão)</b></div>' +
        '<div class="valor"><span>300</span><i>µm</i></div>' +
        '<div class="corpo"><div class="escala"><span class="n">500</span>' +
        '<div class="trilho"><i class="cheio"></i><b class="alca"></b></div><span class="n">20</span></div>' +
        '<div class="classes">' + CLASSES_GOTA.map(function (c) {
          return '<div><i style="background:' + c[1] + '"></i><span></span></div>';
        }).join("") + "</div></div>" +
        '<button class="aplicar" type="button">Aplicar</button>';
      var spans = painel.querySelectorAll(".classes span");
      CLASSES_GOTA.forEach(function (c, k) { spans[k].textContent = c[0]; });
      tela.appendChild(painel);

      var trilho = painel.querySelector(".trilho");
      var arrastando = false;
      var self = this;
      function posicionar(e) {
        var r = trilho.getBoundingClientRect();
        var frac = 1 - (e.clientY - r.top) / r.height;        // 1 no alto
        var v = 20 + frac * 480;
        self.mostrarGota(painel, v);
      }
      trilho.addEventListener("pointerdown", function (e) {
        arrastando = true;
        try { trilho.setPointerCapture(e.pointerId); } catch (erro) { /* sem captura */ }
        posicionar(e);
      });
      trilho.addEventListener("pointermove", function (e) { if (arrastando) posicionar(e); });
      trilho.addEventListener("pointerup", function () { arrastando = false; });
      trilho.addEventListener("pointercancel", function () { arrastando = false; });

      painel.querySelector(".aplicar").addEventListener("click", function () {
        var v = Number(painel.dataset.valor || 300);
        var alvo = painel.xgLinha && painel.xgLinha.querySelector("em");
        if (alvo) alvo.textContent = v + " µm";
        self.ponte.rodar("P.gota = " + v + "; if (typeof desenharFaixas === 'function') desenharFaixas();");
        painel.classList.remove("aberto");
      });
    }

    painel.xgLinha = linha;
    this.mostrarGota(painel, atual);
    painel.classList.add("aberto");
  };

  /* de 10 em 10, de 50 a 500; a escala desenhada vai de 20 a 500 (foto) */
  Operacao.prototype.mostrarGota = function (painel, v) {
    v = Math.round(Math.max(50, Math.min(500, v)) / 10) * 10;
    painel.dataset.valor = String(v);
    painel.querySelector(".valor span").textContent = String(v);
    var frac = (v - 20) / 480;
    painel.querySelector(".cheio").style.height = (frac * 100).toFixed(1) + "%";
    painel.querySelector(".alca").style.top = ((1 - frac) * 100).toFixed(1) + "%";
  };

  /* Zoom no mapa de mapeamento pela roda do mouse, em volta do ponteiro.

     O controle desloca o mapa com `translate` no grupo #mapa-panoramica e
     reescreve esse atributo a cada arrasto - o que apagaria a escala. Um
     observador do atributo recoloca o `scale` sempre que ele some. Os
     pontos marcados continuam certos porque o controle converte o toque
     pela matriz do proprio grupo (getScreenCTM), que inclui a escala. */
  Operacao.prototype.zoomDoMapa = function (e) {
    var doc = this.doc();
    var j; try { j = this.quadro.contentWindow; } catch (erro) { return; }
    var grupo = doc && doc.getElementById("mapa-panoramica");
    var svg = grupo && grupo.ownerSVGElement;
    if (!grupo || !svg) return;

    if (!this.escalaMapa) {
      this.escalaMapa = 1;
      var self = this;
      new j.MutationObserver(function () {
        var t = grupo.getAttribute("transform") || "";
        if (self.escalaMapa !== 1 && t.indexOf("scale(") < 0) {
          grupo.setAttribute("transform", t + " scale(" + self.escalaMapa + ")");
        }
      }).observe(grupo, { attributes: true, attributeFilter: ["transform"] });
    }

    var antes = this.escalaMapa;
    var depois = Math.max(0.5, Math.min(4, antes * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    if (depois === antes) return;

    /* o ponto sob o ponteiro, no referencial do SVG (sem a transformacao
       do grupo), fica parado */
    var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    var c = p.matrixTransform(svg.getScreenCTM().inverse());
    var d = { x: 0, y: 0 };
    try { d = j.eval("({x: deslocamentoMapa.x, y: deslocamentoMapa.y})"); } catch (erro) { /* sem arrasto */ }
    var tx = c.x - (c.x - d.x) * depois / antes;
    var ty = c.y - (c.y - d.y) * depois / antes;

    this.escalaMapa = depois;
    try { j.eval("deslocamentoMapa.x = " + tx + "; deslocamentoMapa.y = " + ty + ";"); } catch (erro) { /* segue */ }
    grupo.setAttribute("transform", "translate(" + tx + " " + ty + ") scale(" + depois + ")");
  };

  /* Zoom nas telas de mapa e execucao: o SVG inteiro (.arte-mapa, com a
     foto, o talhao, a rota e os marcadores dentro) e ampliado por CSS em
     volta do ponteiro. De 0,5x a 4x, por tela. */
  Operacao.prototype.zoomDaTela = function (tela, e) {
    var svg = tela.querySelector("svg.arte-mapa");
    if (!svg) return;
    var atual = Number(svg.dataset.xgZoom || 1);
    var novo = Math.max(0.5, Math.min(4, atual * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    if (novo === atual) return;
    var r = svg.getBoundingClientRect();
    svg.style.transformOrigin = ((e.clientX - r.left) / r.width * 100).toFixed(1) + "% " +
                                ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%";
    svg.style.transform = "scale(" + novo.toFixed(3) + ")";
    svg.dataset.xgZoom = String(novo);
  };

  /* A janela da camera. O controle tem duas: a do mapa (#fpv-mapa, que o
     aluno toca para trocar camera e mapa de lugar) e a da execucao. A do
     mapa e uma camera de mentira - a foto do mapa ampliada, com um veu e a
     mira por cima; a da execucao e um desenho cinza, e vem escondida.
     Nas duas entra a imagem de verdade, por baixo da mira dele. */
  Operacao.prototype.montarCamera = function (doc) {
    var janelas = doc.querySelectorAll(".fpv");
    var telas = [];

    for (var i = 0; i < janelas.length; i++) {
      var janela = janelas[i];
      if (janela.querySelector(".xg-camera")) continue;

      var tela = doc.createElement("canvas");
      tela.className = "xg-camera";
      janela.insertBefore(tela, janela.firstChild);
      janela.classList.add(janela.querySelector(".rota-fpv") ? "xg-com-mira" : "xg-so-camera");
      telas.push(tela);
    }

    if (telas.length) this.ponte.cameraNoControle(telas);
    this.ligarGimbal(doc);
    this.ligarTrocaNaExecucao(doc);
  };

  /* Na tela do mapa o controle ja troca camera e mapa de lugar ao tocar na
     janela (.trocado). Na de execucao nao havia: tocar na camera a leva
     para a tela cheia e o mapa vai para o canto; tocar no mapa pequeno
     desfaz. */
  Operacao.prototype.ligarTrocaNaExecucao = function (doc) {
    var tela = doc.querySelector("[data-tela='execucao']");
    if (!tela) return;

    var janela = tela.querySelector(".fpv");
    var mapa = tela.querySelector(".arte-mapa");
    if (!janela || !mapa) return;

    janela.addEventListener("click", function () {
      tela.classList.add("xg-trocado");
    });
    mapa.addEventListener("click", function () {
      if (tela.classList.contains("xg-trocado")) tela.classList.remove("xg-trocado");
    });

    /* Na tela do mapa a troca e do proprio controle (.trocado), mas so a
       camera alterna: tocar no mapinha nao trazia o mapa de volta. Em
       captura, para o toque no mapinha nao virar tambem "escolher a tarefa
       debaixo do dedo". */
    var telaMapa = doc.querySelector("[data-tela='mapa']");
    var mapinha = telaMapa && telaMapa.querySelector(".arte-mapa");
    if (mapinha) {
      mapinha.addEventListener("click", function (e) {
        if (!telaMapa.classList.contains("trocado")) return;
        e.stopPropagation();
        e.preventDefault();
        telaMapa.classList.remove("trocado");
      }, true);
    }
  };

  /* A roda do mouse faz o papel do dial do gimbal do RC Plus: rolar para
     baixo baixa a camera, para cima levanta. De 0 (reto para a frente) a
     -90 (direto para baixo), comecando nos -19 graus que o jogo usava.
     Vale sobre a tela do controle e sobre o desenho do aparelho; fora da
     vista Controle a roda continua sendo o zoom do jogo. */
  Operacao.prototype.ligarGimbal = function (docControle) {
    var j = this.ponte.janela;
    if (!j || this.gimbalLigado) return;
    this.gimbalLigado = true;

    if (typeof j.xgGimbal !== "number") j.xgGimbal = -19;

    /* Em cima de um painel que rola (tarefa, configuracoes, lista de
       tarefas), a roda rola o painel - senao o aluno nao chega nos campos
       de baixo. Fora deles, a roda e o dial do gimbal. */
    function dentroDeAlgoQueRola(alvo) {
      for (var n = alvo; n && n.nodeType === 1; n = n.parentNode) {
        var jan = n.ownerDocument.defaultView;
        var estilo = jan && jan.getComputedStyle(n);
        if (estilo && /(auto|scroll)/.test(estilo.overflowY) && n.scrollHeight > n.clientHeight + 1) {
          return true;
        }
      }
      return false;
    }

    var self = this;
    function rolar(e) {
      var vista;
      try { vista = j.eval("typeof vista !== 'undefined' ? vista : ''"); } catch (erro) { return; }
      if (vista !== "controle") return;
      if (dentroDeAlgoQueRola(e.target)) return;

      /* na tela de mapeamento a roda e zoom do mapa (pedido dele) */
      /* A roda so inclina a camera com o FPV em tela cheia (palavras dele).
         Com o mapa na tela, e zoom - em qualquer tela de mapa. */
      var telaApp = e.target.closest && e.target.closest(".tela-app");
      var fpvCheio = telaApp && (telaApp.classList.contains("trocado") || telaApp.classList.contains("xg-trocado"));
      if (telaApp && !fpvCheio) {
        e.preventDefault(); e.stopPropagation();
        if (telaApp.dataset.tela === "mapeamento") self.zoomDoMapa(e);
        else self.zoomDaTela(telaApp, e);
        return;
      }
      if (!fpvCheio) return;

      e.preventDefault();
      e.stopPropagation();

      /* um "dente" da roda (100) mexe 4 graus */
      var passo = Math.max(-12, Math.min(12, e.deltaY / 100 * 4));
      j.xgGimbal = Math.max(-90, Math.min(0, j.xgGimbal - passo));
    }

    docControle.addEventListener("wheel", rolar, { passive: false });
    /* no campo, antes do zoom do jogo (fase de captura) */
    j.document.addEventListener("wheel", rolar, { passive: false, capture: true });
  };

  Operacao.prototype.moldeSequencia = function () {
    return "" +
      '<div class="xg-seq" id="xg-seq">' +
      '  <div class="xg-cartao" id="xg-cartao">' +
      "    <h3>Verificação automática antes da tarefa</h3>" +
      '    <p class="xg-sub" id="xg-sub"></p>' +
      '    <div class="xg-lista" id="xg-lista"></div>' +
      '    <div class="xg-rodape">' +
      '      <p class="xg-sinc" id="xg-sinc">Sincronizando tarefa com a aeronave…</p>' +
      '      <div class="xg-barra"><i id="xg-enche"></i></div>' +
      '      <div class="xg-desliza" id="xg-desliza">' +
      '        <span class="rot">Deslize ou pressione e segure o botão R3 para confirmar</span>' +
      '        <b id="xg-punho"></b>' +
      '        <input type="range" id="xg-range" min="0" max="100" value="0"' +
      '               aria-label="Deslize para decolar">' +
      "      </div>" +
      '      <div class="xg-botoes"><button id="xg-minimizar">Minimizar(R2)</button></div>' +
      "    </div>" +
      "  </div>" +
      '  <div class="xg-conta" id="xg-conta" hidden></div>' +
      "</div>";
  };

  /* Os rotulos seguem o modulo instalado na aeronave. O T50 do treinamento
     e o pulverizador, entao e litro e bico - a tremonha de solidos usaria
     quilo e "saida da tremonha". */
  Operacao.prototype.moldeQueda = function () {
    return "" +
      '<div class="xg-queda" id="xg-queda">' +
      '  <div class="xg-cartao-queda">' +
      '    <div class="filme"><canvas id="xg-queda-filme" width="480" height="300"></canvas>' +
      "      <small>A queda, vista de fora</small></div>" +
      '    <div class="texto">' +
      "      <h3>Aeronave perdida</h3>" +
      '      <p class="oque" id="xg-queda-oque"></p>' +
      '      <ul id="xg-queda-numeros"></ul>' +
      '      <p class="licao" id="xg-queda-licao"></p>' +
      '      <button id="xg-queda-ok">Entendi</button>' +
      "    </div>" +
      "  </div>" +
      "</div>";
  };

  Operacao.prototype.moldePainel = function () {
    return "" +
      '<div class="xg-op" id="xg-op">' +
      '  <div class="par"><span>Área coberta</span><b id="xg-coberta">0.00</b><i>Ha</i></div>' +
      '  <div class="par"><span>Quantidade pulverizada</span><b id="xg-aplicado">0.0</b><i>L</i></div>' +
      /* altitude, velocidade, distancia e fluxo ja estao na barra de baixo;
         ficam escondidos so para as leituras continuarem funcionando */
      '  <div class="par xg-mais"><b id="xg-altitude">0.0</b></div>' +
      '  <div class="par xg-mais"><b id="xg-vel">0.0</b></div>' +
      '  <div class="par xg-mais"><b id="xg-dist">0.0</b></div>' +
      '  <div class="par xg-mais"><b id="xg-vazao">0.0</b></div>' +
      '  <button class="xg-recolhe" id="xg-recolhe" type="button">‹</button>' +
      "</div>" +
      '<div class="xg-acoes-voo">' +
      '  <button id="xg-encerrar"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2"/></svg><span>Encerrar</span></button>' +
      '  <button id="xg-retomar"><svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg><span>Pausar</span></button>' +
      "</div>";
  };

  /* --------------------------------------------------- 2. o botao Iniciar

     O controle ja tem um ouvinte no Iniciar: ele abre o aviso de falha de
     upload. Trocar o no pelo clone e a forma de tirar aquele ouvinte sem
     editar o arquivo do controle. */
  Operacao.prototype.ligarBotoes = function (doc) {
    var self = this;

    var iniciar = doc.getElementById("botao-iniciar");
    if (iniciar && iniciar.parentNode) {
      var limpo = iniciar.cloneNode(true);
      iniciar.parentNode.replaceChild(limpo, iniciar);
      limpo.addEventListener("click", function () { self.comecarSequencia(); });
    }

    /* "Use" vai direto para a tela de operacao (pedido dele). O controle
       tem dois ouvintes nesse botao que brigam: o primeiro manda a tarefa
       para "Em andamento", zera a selecao e desativa o botao, e o segundo -
       o que abriria a execucao - desiste. Mesmo remedio do Iniciar: o
       clone descarta os dois, e fica um so. */
    var usar = doc.getElementById("botao-usar");
    if (usar && usar.parentNode) {
      var limpoUsar = usar.cloneNode(true);
      usar.parentNode.replaceChild(limpoUsar, usar);
      limpoUsar.addEventListener("click", function (e) { self.usarTarefa(e.currentTarget); });
    }

    /* "Edicao" abre o planejamento do campo escolhido (PDF dele, pag. 2):
       a tela de mapeamento com os pontos do contorno e o painel de rota.
       O controle desenha o botao mas nao liga nada nele. Os pontos da
       tarefa estao no mapa geral; a tela de mapeamento trabalha ampliada
       (ZOOM_TRABALHO e DESLOCA_TRABALHO), entao e a conta inversa de
       paraMapaGeral. */
    var botoesEdicao = doc.querySelectorAll("button");
    for (var b = 0; b < botoesEdicao.length; b++) {
      if ((window.TPD_IDIOMAS ? TPD_IDIOMAS.original(botoesEdicao[b]) : botoesEdicao[b].textContent).replace(/\s+/g, "") !== "Edição") continue;
      if (botoesEdicao[b].id === "botao-usar") continue;
      botoesEdicao[b].addEventListener("click", function (e) {
        if (e.currentTarget.classList.contains("desativado")) return;
        try {
          self.quadro.contentWindow.eval(
            "(function(){" +
            "  var t = tarefaEscolhida() || emAndamento[emAndamento.length - 1] || tarefas[tarefas.length - 1];" +
            "  if (!t) return;" +
            "  var volta = function (p) { return { x: p.x * ZOOM_TRABALHO + DESLOCA_TRABALHO.x, y: p.y * ZOOM_TRABALHO + DESLOCA_TRABALHO.y }; };" +
            "  estado.limite = t.limite.map(volta);" +
            "  estado.obstaculo = (t.obstaculo || []).map(volta);" +
            "  estado.marcas = [];" +
            "  estado.xgEditando = t.id;" +
            "  redesenhar(); if (typeof atualizarAreas === 'function') atualizarAreas();" +
            "  mostrarTela('mapeamento');" +
            "})()"
          );
        } catch (erro) { /* controle recarregando */ }
      });
    }

    var minimizar = doc.getElementById("xg-minimizar");
    if (minimizar) minimizar.addEventListener("click", function () { self.fechar(); });

    var range = doc.getElementById("xg-range");
    if (range) {
      range.addEventListener("input", function (e) {
        var v = Number(e.target.value);
        self.moverPunho(v);
        if (v >= 97) { e.target.value = 0; self.moverPunho(0); self.contar(); }
      });
      /* soltou no meio: volta sozinho, como no aparelho */
      range.addEventListener("change", function (e) {
        if (Number(e.target.value) < 97) { e.target.value = 0; self.moverPunho(0); }
      });
    }

    /* a setinha do cartao de voo o recolhe (foto dele) */
    var recolhe = doc.getElementById("xg-recolhe");
    if (recolhe) recolhe.addEventListener("click", function () {
      var op = doc.getElementById("xg-op");
      op.classList.toggle("xg-fechado");
      recolhe.textContent = op.classList.contains("xg-fechado") ? "›" : "‹";
    });

    var fecharQueda = doc.getElementById("xg-queda-ok");
    if (fecharQueda) fecharQueda.addEventListener("click", function () {
      var d = self.doc();
      if (d) d.getElementById("xg-queda").classList.remove("aberta");
    });

    /* Encerrar: a tarefa acaba, a aeronave volta a base e a tela vai para
       o mapa (pedido dele). No manual ela so pousa quando o piloto quiser,
       entao ali nada muda no voo. */
    var encerrar = doc.getElementById("xg-encerrar");
    if (encerrar) encerrar.addEventListener("click", function () {
      /* Encerrar acaba a tarefa e traz a aeronave para casa - tambem com
         ela pausada (em espera) ou no manual; antes, pausada, nada acontecia */
      self.ponte.rodar(
        "if (V.estado !== 'em solo' && V.estado !== 'caiu' && V.estado !== 'concluído') {" +
        "  V.retomar = null; iniciarRetorno(null); V.rodando = true;" +
        "  if (typeof fecharAlerta === 'function') fecharAlerta();" +
        "}"
      );
      try { self.quadro.contentWindow.eval("mostrarTela('mapa')"); } catch (e) { /* recarregando */ }
    });

    var retomar = doc.getElementById("xg-retomar");
    if (retomar) retomar.addEventListener("click", function () {
      var e = self.ponte.estado();
      /* na base reabastecendo: Continuar abre a verificacao com o arraste
         para decolar, toda vez, como no aparelho */
      if (e.voo && e.voo.estado === "reabastecendo") {
        self.comecarSequencia();
        return;
      }
      /* no manual, Retomar volta para a rota do ponto em que parou */
      if (e.voo && e.voo.estado === "manual") {
        if (self.manual) self.manual.retomarRota();
        return;
      }
      /* Pausar: a aeronave freia e fica parada no ar esperando ("Tarefa
         pausada. Aeronave em espera"), e o resto do campo segue. Antes
         congelava o simulador inteiro (o Pausar do jogo), e parecia que o
         botao nao funcionava. Em espera ela fica no manual com os manches
         no centro: e dali que o Retomar sabe voltar. */
      self.ponte.rodar(
        "if (['aplicando','indo','voltando','subindo','descendo','pairando'].indexOf(V.estado) >= 0) {" +
        "  V.retomar = (V.estado === 'aplicando' || !V.retomar) ? pontoAtual() : V.retomar;" +
        "  V.estado = 'manual'; V.rodando = true; V.aplicando = false;" +
        "  V.mvx = 0; V.mvz = 0; V.vy = 0;" +
        "  if (typeof fecharAlerta === 'function') fecharAlerta();" +
        "} else if (!V.rodando && V.estado !== 'em solo') { V.rodando = true; }"
      );
    });
  };

  /* O Use: a tarefa escolhida vai para o campo (e a que o drone voa, nao a
     ultima salva), entra na lista "Em andamento" como no aparelho, e a tela
     de operacao abre com a area dela - a selecao fica, porque e dela que o
     abrirExecucao() do controle tira a area e o volume. */
  Operacao.prototype.usarTarefa = function (botao) {
    if (botao.classList.contains("desativado")) return;

    var j;
    try { j = this.quadro.contentWindow; } catch (e) { return; }

    var id;
    try {
      id = j.eval(
        "(function(){" +
        "  var t = tarefaEscolhida();" +
        "  if (!t) return null;" +
        "  var jaVai = emAndamento.indexOf(t) >= 0 ||" +
        "              emAndamento.some(function(x){ return x.origem === t.id; });" +
        "  if (!jaVai) emAndamento.push({ id: Date.now(), origem: t.id, nome: t.nome," +
        "    data: new Date(), area: t.area, progresso: 0," +
        "    limite: t.limite, obstaculo: t.obstaculo });" +
        "  return t.id;" +
        "})()"
      );
    } catch (e) { return; }
    if (id == null) return;

    /* com o drone no ar, trocar o talhao reiniciaria o voo e apagaria a
       operacao: so abre a tela */
    if (!this.voando && this.vinculo) this.vinculo.carregarTarefa(id);

    try {
      j.eval("abrirExecucao(); document.getElementById('painel-tarefas').classList.remove('aberto');");
    } catch (e) { /* controle recarregando */ }
  };

  Operacao.prototype.moverPunho = function (v) {
    var doc = this.doc();
    if (!doc) return;

    var punho = doc.getElementById("xg-punho");
    var trilho = doc.getElementById("xg-desliza");
    if (!punho || !trilho) return;

    punho.style.left = (4 + Math.max(0, trilho.clientWidth - 44) * v / 100) + "px";
  };

  /* ------------------------------------------------------ 3. a sequencia */

  Operacao.prototype.comecarSequencia = function () {
    var doc = this.doc();
    if (!doc) return;

    if (!this.ponte.ler("typeof mapaAtual === 'function' && !!mapaAtual()")) {
      this.avisar("Mapeie o talhão antes de iniciar a tarefa.");
      return;
    }

    /* So o que a verificacao do app mostra de verdade (foto dele): o
       cenario, a velocidade e a altitude de RTH, o retorno a base e os
       tres cartoes dos sensores. Nada de bateria, RTK ou vazao aqui. */
    var p = (this.ponte.estado() || {}).parametros || {};
    var cenario = { planicie: "Planícies", montanha: "Colina/Pomar", agua: "Acima da água" }[p.terreno] || "Planícies";
    var rthVel = typeof p.rthVel === "number" ? Math.round(p.rthVel * 3.6) : 36;
    var chaves = [!!p.desvio, !!p.estab, !!p.xgContornar];
    var ligadas = chaves.filter(function (x) { return x; }).length;

    /* a foto dele: um bloco com o cenario, um bloco com o RTH e tres
       cartoes dos sensores, "Habilitado" em verde e "Desabilitado" em preto */
    var lista = doc.getElementById("xg-lista");
    doc.getElementById("xg-sub").textContent = "";
    lista.innerHTML =
      '<div class="xg-bloco"><div class="xg-linha"><span class="n">Cenário</span><span class="v" id="xg-v-cen"></span></div></div>' +
      '<div class="xg-bloco">' +
      '<div class="xg-linha"><span class="n">Roteamento de conexão e velocidade RTH</span><span class="v" id="xg-v-vel"></span></div>' +
      '<div class="xg-linha"><span class="n">Roteamento de conexão e altitude RTH</span><span class="v" id="xg-v-alt"></span></div>' +
      '<div class="xg-linha"><span class="n">Retorno à base automático</span><span class="v" id="xg-v-rth"></span></div>' +
      "</div>" +
      '<div class="xg-cartoes">' +
      ["desvio de obstáculos multidirecional", "Estabilização da altitude", "Desvio de obstáculos"].map(function (n, i) {
        return '<div class="' + (chaves[i] ? "" : "off") + '"><span></span><b>' + (chaves[i] ? "Habilitado" : "Desabilitado") + "</b></div>";
      }).join("") + "</div>";
    var nomesCartoes = ["desvio de obstáculos multidirecional", "Estabilização da altitude", "Desvio de obstáculos"];
    lista.querySelectorAll(".xg-cartoes span").forEach(function (s, i) { s.textContent = nomesCartoes[i]; });
    doc.getElementById("xg-v-cen").textContent = cenario;
    doc.getElementById("xg-v-vel").textContent = rthVel.toFixed(1) + " km/h";
    doc.getElementById("xg-v-alt").textContent = (p.rth != null ? Number(p.rth) : 7).toFixed(1) + " m";
    doc.getElementById("xg-v-rth").textContent = ligadas === 3 ? "Totalmente ativado" : "Parcialmente ativado";

    /* o controle nasce dizendo "Incapaz de decolar"; a partir daqui quem
       manda na faixa de aviso e o estado real do voo */
    this.avisar("");

    doc.getElementById("xg-seq").classList.add("aberta");
    doc.getElementById("xg-conta").hidden = true;
    doc.getElementById("xg-cartao").style.display = "";
    doc.getElementById("xg-desliza").classList.remove("aberta");
    doc.getElementById("xg-sinc").textContent = "Sincronizando tarefa com a aeronave…";
    this.moverPunho(0);

    this.sincronizar();
  };

  /* A barra enchendo: e o momento em que o aparelho manda a rota para a
     aeronave. So depois dela o deslizar aparece. */
  Operacao.prototype.sincronizar = function () {
    var doc = this.doc();
    if (!doc) return;

    var enche = doc.getElementById("xg-enche");
    var self = this;
    var passo = 0;

    enche.style.width = "0%";
    clearInterval(this.relogioSinc);

    this.relogioSinc = setInterval(function () {
      if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
      var d = self.doc();
      if (!d) { clearInterval(self.relogioSinc); return; }

      passo += 10;
      d.getElementById("xg-enche").style.width = Math.min(passo, 100) + "%";

      if (passo >= 100) {
        clearInterval(self.relogioSinc);
        d.getElementById("xg-sinc").textContent = "Tarefa sincronizada com a aeronave";
        d.getElementById("xg-desliza").classList.add("aberta");
      }
    }, 250);
  };

  Operacao.prototype.contar = function () {
    var doc = this.doc();
    if (!doc) return;

    doc.getElementById("xg-cartao").style.display = "none";

    var conta = doc.getElementById("xg-conta");
    var n = 3;
    var self = this;

    conta.hidden = false;
    conta.textContent = String(n);

    clearInterval(this.relogioConta);
    this.relogioConta = setInterval(function () {
      if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
      var d = self.doc();
      if (!d) { clearInterval(self.relogioConta); return; }

      n -= 1;
      if (n > 0) { d.getElementById("xg-conta").textContent = String(n); return; }

      clearInterval(self.relogioConta);
      self.decolar();
    }, 1000);
  };

  Operacao.prototype.decolar = function () {
    /* Continuar da base: a aeronave pousou para reabastecer e esperava o
       operador. Depois do "arraste para decolar", sai com tanque e bateria
       cheios e volta ao ponto onde a tarefa parou. */
    if (this.ponte.ler("typeof V !== 'undefined' && V.estado === 'reabastecendo'")) {
      this.ponte.rodar(
        "V.tan = T50.tanque; V.bat = 100; V.avisoBat = false; V.recargas = (V.recargas || 0) + 1;" +
        "V.espera = 0; V.estado = 'subindo'; V.rodando = true;"
      );
      this.fechar();
      this.avisar("");
      if (this.aoDecolar) this.aoDecolar({ ok: true, pontos: this.ponte.ler("rota.length"), continuacao: true });
      return;
    }

    var r = this.ponte.iniciarOperacao();
    /* tarefa em andamento: vai direto para onde parou (andamento.js) */
    if (r && r.ok && this.andamento) {
      this.andamento.novaOperacao();
      r.retomada = this.andamento.retomar();
    }

    this.fechar();

    if (!r.ok) {
      this.avisar({
        "sem-mapa": "Mapeie o talhão antes de iniciar a tarefa.",
        "sem-rota": "A rota não foi gerada. Confira o espaçamento e os limites.",
        "ja-voando": "A aeronave já está em operação.",
        "pessoa-perto": "Pedestres ou obstáculos detectados perto da aeronave. Não é possível decolar",
      }[r.motivo] || "Incapaz de decolar.");
      return;
    }

    if (this.aoDecolar) this.aoDecolar(r);
  };

  Operacao.prototype.fechar = function () {
    clearInterval(this.relogioSinc);
    clearInterval(this.relogioConta);

    var doc = this.doc();
    if (!doc) return;

    var seq = doc.getElementById("xg-seq");
    if (seq) seq.classList.remove("aberta");
  };

  /* Os avisos do app aparecem na faixa vermelha do alto das telas de voo.
     Sem aviso, a faixa some - o controle nasce com "Incapaz de decolar"
     escrito ali, e o drone do treinamento esta pronto para decolar. */
  Operacao.prototype.avisar = function (texto) {
    var doc = this.doc();
    if (!doc) return;

    var alvos = doc.querySelectorAll(".barra-voo .alerta-voo");
    for (var i = 0; i < alvos.length; i++) {
      if (alvos[i].textContent !== texto) alvos[i].textContent = texto;
      alvos[i].classList.toggle("xg-vazio", !texto);
    }
  };

  /* ----------------------------------------------------- 4. a telemetria */

  Operacao.prototype.atualizar = function (e) {
    /* O campo decolava sozinho 15 s depois de pousar para reabastecer. No
       aparelho quem manda sair de novo e o operador (Continuar + arraste). */
    this.ponte.rodar("if (typeof V !== 'undefined' && V.estado === 'reabastecendo') V.espera = 999;");
    if (this.andamento && this.vinculo && this.vinculo.faseDoAparelho) {
      this.andamento.ciclo(this.vinculo.faseDoAparelho());
    }
    var doc = this.doc();
    if (!doc || !this.instalado || !e) return;

    var v = e.voo || {};
    var c = e.cobertura || {};
    /* `cair()` sobrescreve V.estado com "caiu" e nao guarda de onde veio.
       Quem lembra e a gente: e a diferenca entre "caiu voltando" (culpa da
       altura de retorno) e "caiu aplicando" (culpa da altura de trabalho). */
    if (v.estado && v.estado !== "caiu") this.estadoAntes = v.estado;

    if (v.estado === "caiu" && !this.quedaMostrada) {
      this.quedaMostrada = true;
      this.mostrarQueda();
    } else if (v.estado !== "caiu") {
      this.quedaMostrada = false;
    }

    var voando = !!(v.estado && v.estado !== "em solo" && v.estado !== "concluído");

    if (voando !== this.voando) {
      this.voando = voando;
      doc.body.classList.toggle("xg-voando", voando);
      /* em voo a aba chama "Operacao" (foto dele); no chao volta a "Tarefa" */
      var abaTarefa = doc.querySelector("[data-tela='execucao'] [data-aba-exec='tarefa']");
      if (abaTarefa) abaTarefa.textContent = voando ? "Operação" : "Tarefa";
      var exec = doc.querySelector("[data-tela='execucao']");
      if (exec) exec.classList.remove("xg-aberto-em-voo", "xg-recolhido");
      if (this.abaPainel) this.abaPainel.textContent = voando ? "▸" : "◂";
      if (!voando) {
        this.avisar("");
        /* a camera some no chao: se estava em tela cheia, o mapa volta */
        if (exec) exec.classList.remove("xg-trocado");
        /* tarefa concluida: a aeronave pousou e o app volta ao mapa (o
           modal "Operacao concluida" do jogo fica escondido) */
        if (v.estado === "concluído") {
          try { this.quadro.contentWindow.eval("if (estado.tela === 'execucao') mostrarTela('mapa')"); }
          catch (e) { /* controle recarregando */ }
        }
      }
    }

    /* O estado da aeronave vale o tempo todo, e nao so no ar: o HTML do
       controle nasce com bateria 15%, tanque 0.0/0.0 e "Baixo(GNSS)" fixos,
       e o drone do treinamento esta carregado e pronto. */
    this.estadoDaAeronave(doc, v, e.maquina || {});
    this.bateriaNaTela(doc, v, e);
    /* o RTH (e as outras chaves do app) agora vem de ajustes.js, que
       mantem os dois lugares do controle iguais */
    this.desenharTarefa(e);
    this.marcadoresNoMapa(e);
    this.barraDeDados(doc, e);
    this.desenharRadar(doc);

    if (!voando) return;

    /* distancia ate o ponto de origem (o H), como a barra do app */
    var distancia = this.distanciaDaOrigem(e);

    this.escrever(doc, "xg-coberta", (c.haCobertos || 0).toFixed(2));
    this.escrever(doc, "xg-aplicado", (v.calda || 0).toFixed(1));
    this.escrever(doc, "xg-altitude", (v.alturaSolo || 0).toFixed(1));
    this.escrever(doc, "xg-vel", ((v.velocidade || 0) * 3.6).toFixed(1));
    this.escrever(doc, "xg-dist", distancia.toFixed(1));
    this.escrever(doc, "xg-vazao", (v.vazao || 0).toFixed(1));

    /* o aviso segue o estado real do voo */
    var aviso = "";
    if (v.estado === "manual") aviso = v.temRota ? "Tarefa pausada. Modo manual" : "Modo manual";
    else if (!v.rodando) aviso = "Tarefa pausada. Modo manual";
    else if (v.estado === "voltando") aviso = "Retornando ao ponto de origem";
    else if (v.estado === "reabastecendo") aviso = "Reabastecendo. Tarefa pausada";
    else if (v.estado === "caiu") aviso = "Aeronave perdida";
    this.avisar(aviso);

    var retomar = doc.getElementById("xg-retomar");
    if (retomar) {
      var rotulo = v.estado === "reabastecendo" ? "Continuar"
                 : v.estado === "manual" || !v.rodando ? "Retomar" : "Pausar";
      var rotuloEl = retomar.querySelector("span") || retomar;
      if (rotuloEl.textContent !== rotulo) rotuloEl.textContent = rotulo;
      /* no manual sem tarefa interrompida, nao ha para onde retomar */
      retomar.disabled = v.estado === "manual" && !v.temRota;
      retomar.style.opacity = retomar.disabled ? ".45" : "";
    }
  };

  /* O RTH segue as Configuracoes da aeronave do controle (Roteamento de
     conexao e RTH): a altitude vira o P.rth do campo e a velocidade limita
     a volta. Sem piso nenhum - decisao dele: o aluno pode configurar um
     retorno que derruba, e o cartao de queda explica o porque.
     O valor mora so no deslizador do controle; o rotulo acima dele diz qual
     e qual. */
  Operacao.prototype.rthDoControle = function (doc) {
    var faixas = doc.querySelectorAll(".painel-config .faixa");
    var alt = null, vel = null;

    for (var i = 0; i < faixas.length; i++) {
      var rotulo = faixas[i].previousElementSibling;
      var barra = faixas[i].querySelector("input[type='range']");
      if (!rotulo || !barra) continue;
      var texto = rotulo.textContent || "";
      if (/altitude RTH/i.test(texto)) alt = Number(barra.value);
      else if (/velocidade RTH/i.test(texto)) vel = Number(barra.value);
    }
    if (alt === null && vel === null) return;

    var assinatura = alt + "|" + vel;
    if (assinatura === this.rthAplicado) return;
    this.rthAplicado = assinatura;

    this.ponte.rodar(
      (alt !== null ? "P.rth = " + alt + ";" : "") +
      (vel !== null ? "P.rthVel = " + (vel / 3.6).toFixed(3) + ";" : "")   // km/h -> m/s
    );
  };

  /* O radar do controle (o circulo com riscos vermelhos) vem desenhado
     fixo no HTML. Aqui os riscos e os numeros saem, e entram os
     obstaculos de verdade: um risco na direcao de cada obstaculo a ate
     15 m, com a distancia na ponta - amarelo, laranja e vermelho abaixo de
     5 m. O circulo, o triangulo do drone e o N continuam os dele. */
  var ALCANCE_RADAR = 15;

  Operacao.prototype.desenharRadar = function (doc) {
    var telas = doc.querySelectorAll(".bussola svg");
    var alvos = [];

    for (var i = 0; i < telas.length; i++) {
      var svg = telas[i];
      var camada = svg.querySelector(".xg-radar");

      if (!camada) {
        var riscos = svg.querySelector("g[stroke='#e8442e']");
        if (!riscos) continue;                 // bussola sem radar (a do mapa)
        riscos.style.display = "none";
        var numeros = svg.querySelector("g[font-size]");
        if (numeros) numeros.style.display = "none";

        camada = doc.createElementNS("http://www.w3.org/2000/svg", "g");
        camada.setAttribute("class", "xg-radar");
        /* por baixo do triangulo do drone */
        var drone = svg.querySelector("path[fill='#f0c419']");
        svg.insertBefore(camada, drone || null);
      }
      alvos.push(camada);
    }
    if (!alvos.length) return;

    var lidos = this.ponte.radar(ALCANCE_RADAR) || [];
    var assinatura = lidos.map(function (s) { return s[0] + ":" + s[1].toFixed(1); }).join("|");
    if (assinatura === this.radarDesenhado) return;
    this.radarDesenhado = assinatura;

    var h = "";
    lidos.forEach(function (s) {
      var ang = s[0] * Math.PI / 6, dist = s[1];
      var cor = dist < 5 ? "#e8442e" : dist < 10 ? "#f08a24" : "#f0c419";
      var sx = Math.sin(ang), sy = -Math.cos(ang);
      h += '<path d="M' + (60 + sx * 9).toFixed(1) + " " + (60 + sy * 9).toFixed(1) +
           "L" + (60 + sx * 36).toFixed(1) + " " + (60 + sy * 36).toFixed(1) +
           '" stroke="' + cor + '" stroke-width="3" stroke-linecap="round"/>';
      h += '<text x="' + (60 + sx * 47).toFixed(1) + '" y="' + (63 + sy * 47).toFixed(1) +
           '" text-anchor="middle" font-size="9" fill="#fff" font-family="Inter,sans-serif">' +
           dist.toFixed(1) + "</text>";
    });

    alvos.forEach(function (c) { c.innerHTML = h; });
  };

  Operacao.prototype.distanciaDaOrigem = function (e) {
    var d = e.drone, b = e.base;
    if (!d || !b) return 0;
    return Math.hypot(d.x - b.x, d.z - b.z);
  };

  /* A barra de dados de baixo do app (Relativo a origem, Velocidade,
     Distancia, Fluxo) vem com numeros fixos no HTML do controle. Aqui ela
     segue o drone - em qualquer modo, manual ou rota, e em todas as telas
     que a tem. Cada campo e achado pelo rotulo, nao pela posicao. */
  Operacao.prototype.barraDeDados = function (doc, e) {
    var v = e.voo || {}, d = e.drone, b = e.base;
    if (!d) return;

    var relativo = b && typeof b.y === "number" ? d.y - b.y : (v.alturaSolo || 0);
    if (Math.abs(relativo) < 0.05) relativo = 0;

    var valores = [
      /* "Relativo a origem" e o radar de solo (palavras dele): a altura
         acima do chao, nao a diferenca para o ponto de decolagem */
      [/relativo/i, (v.alturaSolo || 0).toFixed(1).replace(".", ",")],
      [/velocidade/i, ((v.velocidade || 0) * 3.6).toFixed(1)],
      [/dist/i, this.distanciaDaOrigem(e).toFixed(1)],
      [/fluxo/i, (v.vazao || 0).toFixed(1)],
    ];

    var campos = doc.querySelectorAll(".barra-dados > div");
    for (var i = 0; i < campos.length; i++) {
      var rotulo = campos[i].querySelector("span");
      var numero = campos[i].querySelector("b");
      if (!rotulo || !numero) continue;

      for (var k = 0; k < valores.length; k++) {
        if (valores[k][0].test(rotulo.textContent)) {
          if (numero.textContent !== valores[k][1]) numero.textContent = valores[k][1];
          break;
        }
      }
    }
  };

  /* A tela "Bateria Inteligente" com o drone ligado (fotos dele): 14
     celulas com a tensao de cada uma, tensao total, temperatura, ciclos e
     corrente; os limites de bateria fraca (20%, RTH) e muito fraca (5%,
     aterrissagem). O HTML do controle traz tudo em N/A e "-%". Os numeros
     seguem a bateria do campo: a celula do T50 (DB1560, 14S) fica em
     3,53 V com 75% e cai com a carga; a corrente sobe em voo. */
  Operacao.prototype.bateriaNaTela = function (doc, v, e) {
    var tela = doc.querySelector(".pagina-config[data-config='bateria']");
    if (!tela || v.bateria == null) return;

    var pct = Math.max(0, Math.min(100, v.bateria));
    var celulaV = 3.2 + 0.45 * pct / 100;                 // 3,53 V aos 75%
    var voando = v.estado && v.estado !== "em solo" && v.estado !== "concluído";
    var corrente = voando ? 34 + (v.velocidade || 0) * 2.2 + (v.vazao || 0) * 1.5 : 1.4;
    var temperatura = 15.7 + Math.min(14, (v.tempo || 0) / 60 * 1.6);

    var caixa = tela.querySelector(".celulas-bateria");
    if (caixa) {
      var divs = caixa.querySelectorAll(":scope > div");
      /* o T50 tem 14 celulas; o HTML traz 12 */
      while (divs.length < 14) { caixa.appendChild(divs[0].cloneNode(true)); divs = caixa.querySelectorAll(":scope > div"); }
      for (var i = 0; i < divs.length; i++) {
        var s = divs[i].querySelector("span");
        var texto = celulaV.toFixed(2);
        if (s && s.textContent !== texto) s.textContent = texto;
        var carga = divs[i].querySelector(".xg-carga");
        if (!carga) { carga = doc.createElement("i"); carga.className = "xg-carga"; divs[i].appendChild(carga); }
        carga.style.height = (pct * 0.82).toFixed(0) + "%";
      }
    }

    var dados = tela.querySelectorAll(".grade-dados b");
    var valores = [
      (celulaV * 14).toFixed(1).replace(".", ",") + "<i>v</i>",
      temperatura.toFixed(1).replace(".", ",") + "<i>°C</i>",
      "196",
      corrente.toFixed(1).replace(".", ",") + "<i>A</i>",
    ];
    for (var k = 0; k < dados.length && k < valores.length; k++) {
      if (dados[k].innerHTML !== valores[k]) dados[k].innerHTML = valores[k];
    }

    var limites = tela.querySelectorAll(".titulo-marcado b.laranja");
    if (limites[0] && limites[0].textContent !== "20%") limites[0].textContent = "20%";
    if (limites[1] && limites[1].textContent !== "5%") limites[1].textContent = "5%";

    var duplos = tela.querySelectorAll(".limites-duplos span");
    if (duplos[0] && duplos[0].textContent !== "5%") { duplos[0].textContent = "5%"; duplos[0].style.color = "#e8442e"; }
    if (duplos[1] && duplos[1].textContent !== "20%") { duplos[1].textContent = "20%"; duplos[1].style.color = "#f0a63a"; }

    var rodape = tela.querySelectorAll(".linha-titulo-config");
    var ultimo = rodape[rodape.length - 1];
    if (ultimo && /Aterrissa/.test(ultimo.textContent)) {
      var i2 = ultimo.querySelector("i");
      if (i2 && i2.textContent !== "RTH") i2.textContent = "RTH";
    }

    /* o RTH escolhido para bateria fraca */
    var grupo = tela.querySelector(".grupo-opcoes");
    if (grupo && !grupo.querySelector(".ativa")) {
      var bots = grupo.querySelectorAll("button");
      if (bots[1]) bots[1].classList.add("ativa");
    }
  };

  /* Bateria, tanque e precisao do campo, em TODAS as telas que tem a barra
     (mapa e execucao), com a cor dizendo se esta bom: verde, amarelo na
     reserva, vermelho quando acaba. Sem leitura do campo, nao mexe. */
  Operacao.prototype.estadoDaAeronave = function (doc, v, m) {
    if (v.bateria == null) return;

    var bateria = Math.round(v.bateria);
    var nivelBat = bateria <= 15 ? "xg-ruim" : bateria <= 30 ? "xg-meio" : "xg-bom";

    var cheio = m.tanque || 40;
    var tanque = v.tanque || 0;
    var nivelTan = tanque <= 0.05 ? "xg-ruim" : tanque / cheio <= 0.2 ? "xg-meio" : "xg-bom";

    this.escreverTodos(doc, ".status-voo .bat-drone", bateria + "%", nivelBat);
    this.escreverTodos(doc, ".status-voo .tanque",
                       tanque.toFixed(1) + "/" + cheio.toFixed(1), nivelTan);

    /* a barra de cima diz GNSS, entao a precisao do campo e GNSS, nao RTK
       (palavras dele): fica a etiqueta do proprio controle */
  };

  /* ----------------------------------------- a tarefa na tela de execucao

     O HTML do controle traz, na tela de execucao, um desenho de EXEMPLO
     (.rota-execucao): um talhao amarelo, um obstaculo e uma rota escritos a
     mao. Aqui ele sai, e entra o mapa que o drone vai voar de verdade - o
     limite, os obstaculos e a rota que o campo gerou, com o drone andando
     por ela durante o voo.

     Nessa tela o terreno e deslocado e ampliado (hoje, translate(-180 -300)
     scale(1.28)). A nossa camada copia a MESMA transformacao do grupo do
     terreno, lida da pagina: assim os pontos em pixels do mapa geral caem
     em cima da foto, e se o controle mudar o enquadramento, segue junto. */
  var SVG = "http://www.w3.org/2000/svg";

  Operacao.prototype.desenharTarefa = function (e) {
    var doc = this.doc();
    var v = this.vinculo;
    if (!doc || !v || !v.foto) return;

    var tela = doc.querySelector("[data-tela='execucao'] svg.arte-mapa");
    if (!tela) return;

    var camada = doc.getElementById("xg-rota");
    if (!camada) {
      var uso = tela.querySelector("use[href='#terreno']");
      var grupoDoTerreno = uso && uso.parentNode !== tela ? uso.parentNode : null;

      camada = doc.createElementNS(SVG, "g");
      camada.id = "xg-rota";
      if (grupoDoTerreno && grupoDoTerreno.getAttribute("transform")) {
        camada.setAttribute("transform", grupoDoTerreno.getAttribute("transform"));
      }
      tela.appendChild(camada);

      var exemplo = tela.querySelector(".rota-execucao");
      if (exemplo) exemplo.style.display = "none";
    }

    var dados = this.ponte.rotaDoCampo();
    if (!dados) {
      if (this.assinaturaRota) { camada.innerHTML = ""; this.assinaturaRota = ""; }
      return;
    }

    var l0 = dados.limite[0] || [0, 0];
    var assinatura = [dados.faixa, dados.limite.length, dados.rota.length, dados.obstaculos.length,
                      dados.circulos.length, l0[0].toFixed(1), l0[1].toFixed(1)].join("|");

    /* o progresso muda a cor dos trechos sem redesenhar tudo */
    if (assinatura === this.assinaturaRota && typeof dados.feitos === "number") {
      var trechos = camada.querySelectorAll(".xg-trecho");
      for (var k = 0; k < trechos.length; k++) {
        var idx = Number(trechos[k].dataset.i);
        if (trechos[k].getAttribute("data-manobra")) continue;
        var corAgora = this.corDoTrecho(idx, dados.feitos);
        if (trechos[k].getAttribute("stroke") !== corAgora) trechos[k].setAttribute("stroke", corAgora);
      }
    }

    if (assinatura !== this.assinaturaRota) {
      this.assinaturaRota = assinatura;
      camada.innerHTML = this.moldeDaRota(dados, v);
      this.areaNaTela(doc);
    }

    /* A passada em curso fica amarela e ganha um verde so ate onde a
       aeronave chegou (antes ela ficava inteira verde assim que comecava). */
    var parcial = doc.getElementById("xg-parcial");
    if (!parcial) {
      parcial = doc.createElementNS(SVG, "line");
      parcial.id = "xg-parcial";
      parcial.setAttribute("stroke", "#7ed321");
      parcial.setAttribute("stroke-width", "2");
      parcial.setAttribute("stroke-linecap", "round");
      parcial.setAttribute("vector-effect", "non-scaling-stroke");
      var marcador = doc.getElementById("xg-home");
      if (marcador && marcador.parentNode === camada) camada.insertBefore(parcial, marcador);
      else camada.appendChild(parcial);
    }
    var f = dados.feitos, emCurso = e.voo && e.voo.estado === "aplicando" && e.drone &&
      f > 0 && dados.rota[f] && dados.rota[f][2] === 1;
    if (emCurso) {
      var ini = v.paraPixels({ x: dados.rota[f - 1][0], z: dados.rota[f - 1][1] });
      var agora = v.paraPixels({ x: e.drone.x, z: e.drone.z });
      parcial.setAttribute("x1", ini.x.toFixed(1)); parcial.setAttribute("y1", ini.y.toFixed(1));
      parcial.setAttribute("x2", agora.x.toFixed(1)); parcial.setAttribute("y2", agora.y.toFixed(1));
      parcial.style.display = "";
    } else {
      parcial.style.display = "none";
    }

    /* o drone andando pela rota, virado para onde vai, e a base */
    this.posicionar(doc.getElementById("xg-drone"), e.drone, e.drone, 0, 0);
    this.posicionar(doc.getElementById("xg-home"), e.base, null, 0, 0);
  };

  /* Poe um marcador no ponto do campo, girado pelo rumo do drone quando
     houver. `ox, oy` descontam onde o desenho original do marcador esta
     (os do controle vem desenhados no meio do mapa, e nao em volta de 0). */
  Operacao.prototype.posicionar = function (alvo, ponto, drone, ox, oy) {
    var v = this.vinculo;
    if (!alvo || !ponto || !v || !v.foto) return;

    var q = v.paraPixels({ x: ponto.x, z: ponto.z });
    var t = "translate(" + q.x.toFixed(1) + " " + q.y.toFixed(1) + ")";

    /* frente do drone = (cos rumo, -sin rumo); no mapa, 0 grau e para cima */
    if (drone && typeof drone.rumo === "number") {
      t += " rotate(" + (90 - drone.rumo * 180 / Math.PI).toFixed(1) + ")";
    }
    if (ox || oy) t += " translate(" + (-ox) + " " + (-oy) + ")";

    if (alvo.getAttribute("transform") !== t) alvo.setAttribute("transform", t);
  };

  /* O mapa principal do controle traz o H e a seta do drone desenhados
     fixos, no meio do mapa. Aqui eles vao para onde a base e o drone estao
     no campo. Nessa tela o terreno nao tem transformacao, entao o pixel do
     mapa geral vale direto. */
  Operacao.prototype.marcadoresNoMapa = function (e) {
    var doc = this.doc();
    if (!doc || !this.vinculo || !this.vinculo.foto) return;

    var tela = doc.querySelector("[data-tela='mapa'] svg.arte-mapa");
    if (!tela) return;

    /* os centros dos desenhos originais: o H em (880, 560) e a seta com a
       ponta em (960, 600) e o meio do corpo em (960, 626) */
    this.posicionar(tela.querySelector(".marcador-home"), e.base, null, 880, 560);
    this.posicionar(tela.querySelector(".marcador-drone"), e.drone, e.drone, 960, 626);

    /* O ponto azul com a cruz e o CONTROLE (o piloto), palavras dele. O
       controle desenha-o fixo em (1090, 616) na tela de mapeamento e refaz
       a cada redesenhar(); aqui ele segue o operador do campo, toda volta. */
    var mapeamento = doc.querySelector("[data-tela='mapeamento']");
    if (mapeamento && e.operador) {
      var azuis = mapeamento.querySelectorAll("circle[fill='#2b7fe0']");
      for (var i = 0; i < azuis.length; i++) {
        var ponto = azuis[i];
        var cruz = ponto.previousElementSibling;
        var q = this.vinculo.paraPixels({ x: e.operador.x, z: e.operador.z });
        /* a tela de mapeamento mostra o terreno ampliado e deslocado
           (ZOOM_TRABALHO, DESLOCA_TRABALHO do controle): o ponto do mapa
           geral tem de passar pela mesma conta, senao o operador aparece
           fora do lugar */
        var jc = doc.defaultView, zoom = 1, desl = { x: 0, y: 0 };
        try {
          zoom = jc.eval("typeof ZOOM_TRABALHO !== 'undefined' ? ZOOM_TRABALHO : 1");
          desl = jc.eval("typeof DESLOCA_TRABALHO !== 'undefined' ? DESLOCA_TRABALHO : {x:0,y:0}");
        } catch (erro) { /* fica sem ampliar */ }
        q = { x: q.x * zoom + desl.x, y: q.y * zoom + desl.y };
        var t = "translate(" + (q.x - 1090).toFixed(1) + " " + (q.y - 616).toFixed(1) + ")";

        /* O controle refaz o desenho do mapeamento a cada toque (mover o
           reticulo, marcar ponto) e recria a bolinha no meio do mapa; ate a
           proxima leitura ela aparecia la e depois sumia. O redesenhar() dele
           passa a sair ja com a bolinha onde o operador esta. */
        jc.__xgOperadorT = t;
        if (!jc.__xgOperadorEmbrulhado && typeof jc.redesenhar === "function") {
          jc.__xgOperadorEmbrulhado = true;
          jc.eval(
            "(function(){ var original = redesenhar;" +
            "  redesenhar = function(){ var r = original.apply(this, arguments);" +
            "    var t = window.__xgOperadorT; if (!t) return r;" +
            "    var az = document.querySelectorAll(\"[data-tela='mapeamento'] circle[fill='#2b7fe0']\");" +
            "    for (var i = 0; i < az.length; i++) { az[i].setAttribute('transform', t);" +
            "      var c = az[i].previousElementSibling;" +
            "      if (c && c.tagName === 'path' && /^M1090/.test(c.getAttribute('d') || '')) c.setAttribute('transform', t); }" +
            "    return r; }; })()"
          );
        }
        if (ponto.getAttribute("transform") !== t) ponto.setAttribute("transform", t);
        if (cruz && cruz.tagName === "path" && /^M1090/.test(cruz.getAttribute("d") || "")) {
          if (cruz.getAttribute("transform") !== t) cruz.setAttribute("transform", t);
        }
      }
    }
  };

  /* Cores das fotos dele (DJI Agras): feito nesta operacao em verde, o que
     falta em amarelo e, numa tarefa retomada depois de desligar o
     controle, o que ja estava feito em cinza (andamento.js). */
  Operacao.prototype.corDoTrecho = function (i, feitos) {
    if (this.andamento) return this.andamento.cor(i, feitos);
    return i < feitos ? "#7ed321" : i === feitos ? "#7ed321" : "#f2e03c";
  };

  /* O contorno encolhido d pixels para dentro (a fronteira laranja).
     Devolve null se o talhao for pequeno demais para isso. */
  function porDentro(lim, d) {
    var n = lim.length, s = 0;
    if (n < 3) return null;
    for (var i = 0; i < n; i++) { var a = lim[i], b = lim[(i + 1) % n]; s += a.x * b.y - b.x * a.y; }
    var lado = s > 0 ? 1 : -1, linhas = [], pts = [];
    for (var j = 0; j < n; j++) {
      var p = lim[j], q = lim[(j + 1) % n], ex = q.x - p.x, ey = q.y - p.y, l = Math.hypot(ex, ey) || 1;
      linhas.push([{ x: p.x - ey / l * lado * d, y: p.y + ex / l * lado * d }, { x: ex, y: ey }]);
    }
    for (var k = 0; k < n; k++) {
      var L1 = linhas[(k + n - 1) % n], L2 = linhas[k];
      var den = L1[1].x * L2[1].y - L1[1].y * L2[1].x;
      if (Math.abs(den) < 1e-9) { pts.push(L2[0]); continue; }
      var t = ((L2[0].x - L1[0].x) * L2[1].y - (L2[0].y - L1[0].y) * L2[1].x) / den;
      pts.push({ x: L1[0].x + L1[1].x * t, y: L1[0].y + L1[1].y * t });
    }
    return pts;
  }

  Operacao.prototype.moldeDaRota = function (dados, v) {
    function px(p) {
      var q = v.paraPixels({ x: p[0], z: p[1] });
      return q.x.toFixed(1) + "," + q.y.toFixed(1);
    }
    /* traco com a mesma grossura em qualquer zoom da tela */
    var fino = ' vector-effect="non-scaling-stroke"';
    var h = "";

    /* Como nas fotos dele do app DJI em operacao: o limite do talhao em
       BRANCO fino com as bolinhas rosadas nos cantos, a fronteira LARANJA
       fina por dentro (meia faixa da borda) e as passadas finas - amarelas
       por fazer, verdes feitas, cinzas feitas antes (andamento.js). Nada de
       area pintada nem contorno amarelo grosso. */
    var limPx = dados.limite.map(function (p) { return v.paraPixels({ x: p[0], z: p[1] }); });
    h += '<polygon points="' + dados.limite.map(px).join(" ") +
         '" fill="rgba(255,255,255,.06)" stroke="#f4f4f4" stroke-width="2.5" stroke-linejoin="round"' + fino + "/>";
    var dentro = porDentro(limPx, (dados.faixa || 6) / 2 / v.escala);
    if (dentro) {
      h += '<polygon points="' + dentro.map(function (q) { return q.x.toFixed(1) + "," + q.y.toFixed(1); }).join(" ") +
           '" fill="none" stroke="#f08a24" stroke-width="2" stroke-linejoin="round"' + fino + "/>";
    }

    dados.obstaculos.forEach(function (o) {
      h += '<polygon points="' + o.map(px).join(" ") +
           '" fill="rgba(232,68,46,.55)" stroke="#e8442e" stroke-width="4"' + fino + "/>";
    });

    dados.circulos.forEach(function (c) {
      var q = v.paraPixels({ x: c[0], z: c[1] });
      h += '<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' +
           (c[2] / v.escala).toFixed(1) +
           '" fill="rgba(232,68,46,.55)" stroke="#e8442e" stroke-width="4"' + fino + "/>";
    });

    /* passada que pulveriza em linha cheia; deslocamento sem pulverizar,
       tracejado */
    for (var i = 1; i < dados.rota.length; i++) {
      var a = px(dados.rota[i - 1]).split(","), b = px(dados.rota[i]).split(",");
      var aplica = dados.rota[i][2] === 1;
      var cor = this.corDoTrecho(i, dados.feitos);
      /* passada fina na cor do andamento; manobra entre passadas em branco */
      h += '<line class="xg-trecho" data-i="' + i + '" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] +
           '" stroke="' + (aplica ? cor : "#ffffff") + '" stroke-width="' + (aplica ? 2 : 1.5) + '"' +
           ' stroke-linecap="round"' + (aplica ? "" : ' data-manobra="1"') + fino + "/>";
    }
    limPx.forEach(function (q) {
      h += '<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) +
           '" r="5.5" fill="#d977e6" stroke="#fff" stroke-width="1.8"' + fino + "/>";
    });

    /* o H da base e a seta vermelha do drone, com o mesmo desenho do mapa
       principal do controle */
    h += '<g id="xg-home"><circle r="14" fill="#3ad46a" stroke="#fff" stroke-width="3"' + fino + "/>" +
         '<text y="6" text-anchor="middle" font-size="16" font-weight="700" fill="#fff">H</text></g>';
    h += '<g id="xg-drone"><path d="M0 -22 l-20 38 20-12 20 12z" fill="#e8442e" stroke="#fff"' +
         ' stroke-width="3" stroke-linejoin="round"' + fino + "/></g>";
    return h;
  };

  /* A caixa "Area da tarefa / Volume pulverizado" da execucao so e
     preenchida pelo "Use" do controle (que hoje nao abre a execucao). Aqui
     ela recebe a area do talhao que o drone vai voar, e o volume o proprio
     controle recalcula com a taxa dele. */
  Operacao.prototype.areaNaTela = function (doc) {
    var area = this.ponte.areaHectares();
    var alvo = doc.getElementById("exec-area");
    if (!alvo || !(area > 0)) return;

    alvo.textContent = area.toFixed(2);
    try {
      this.quadro.contentWindow.eval("typeof atualizarVolume === 'function' && atualizarVolume()");
    } catch (erro) { /* controle recarregando */ }
  };

  /* Escreve o numero no ultimo no do icone (o texto vem depois do <svg>)
     e troca a classe de cor. */
  Operacao.prototype.escreverTodos = function (doc, seletor, texto, nivel) {
    var alvos = doc.querySelectorAll(seletor);
    for (var i = 0; i < alvos.length; i++) {
      var a = alvos[i];
      if (a.lastChild && a.lastChild.nodeType === 3) {
        if (a.lastChild.textContent !== texto) a.lastChild.textContent = texto;
      } else {
        a.appendChild(doc.createTextNode(texto));
      }
      if (!a.classList.contains(nivel)) {
        a.classList.remove("xg-bom", "xg-meio", "xg-ruim");
        a.classList.add(nivel);
      }
    }
  };

  /* ------------------------------------------------ 5. por que ela caiu

     O campo tem a tela de queda dele, mas ela fica ATRAS da moldura do
     aparelho - dentro do treinamento o aluno nunca a veria. Aqui o mesmo
     motivo e remontado na tela do controle, e com os numeros que o proprio
     aluno escolheu, porque e isso que fecha a licao: ninguem aprende com
     "bateu numa arvore", aprende com "voltou a 7 m onde a mata tem 12".

     Nada e travado no controle de proposito (decisao dele): o aluno pode
     configurar um retorno suicida. O que nao pode e cair sem entender. */
  /* Os nomes dos obstaculos ja vem com artigo ("o poste", "a rede de baixa
     tensao"), porque o campo os usa em frases. Para "Altura de ___" e
     preciso contrair: de+o = do, de+a = da. */
  function de(nome) {
    if (/^o /.test(nome)) return "do " + nome.slice(2);
    if (/^a /.test(nome)) return "da " + nome.slice(2);
    if (/^os /.test(nome)) return "dos " + nome.slice(3);
    if (/^as /.test(nome)) return "das " + nome.slice(3);
    return "de " + nome;
  }

  /* Numero como se escreve aqui: virgula decimal, e sem casa quando e
     redondo - "7 m", nao "7,0 m". */
  function num(v, casas) {
    var arredondado = Math.round(v * Math.pow(10, casas)) / Math.pow(10, casas);
    var texto = (arredondado % 1 === 0) ? String(arredondado) : arredondado.toFixed(casas);
    return texto.replace(".", ",");
  }

  Operacao.prototype.mostrarQueda = function () {
    var doc = this.doc();
    var q = this.ponte.lerQueda();
    if (!doc || !q) return;

    var voltando = this.estadoAntes === "voltando";
    var nome = q.nome || "um obstáculo";
    var sujeito = nome.charAt(0).toUpperCase() + nome.slice(1);

    doc.getElementById("xg-queda-oque").textContent =
      sujeito + " derrubou a aeronave.";

    var linhas = [];

    if (q.alturaObstaculo != null) {
      linhas.push(["Altura " + de(nome), num(q.alturaObstaculo, 1) + " m", false]);
    }

    if (voltando && q.rth != null) {
      linhas.push([
        "Altitude de retorno (RTH)",
        num(q.rth, 1) + " m",
        q.alturaObstaculo != null && q.rth < q.alturaObstaculo,
      ]);
    } else if (q.altura != null) {
      linhas.push([
        "Altura de trabalho",
        num(q.altura, 1) + " m",
        q.alturaObstaculo != null && q.altura < q.alturaObstaculo,
      ]);
    }

    if (q.desvio != null && !q.fio) {
      linhas.push(["Desvio de obstáculos", q.desvio ? "Ligado" : "Desligado", !q.desvio]);
    }

    doc.getElementById("xg-queda-numeros").innerHTML = linhas.map(function (l) {
      return "<li" + (l[2] ? ' class="culpa"' : "") + "><span></span><b></b></li>";
    }).join("");

    var itens = doc.querySelectorAll("#xg-queda-numeros li");
    linhas.forEach(function (l, i) {
      if (!itens[i]) return;
      itens[i].querySelector("span").textContent = l[0];
      itens[i].querySelector("b").textContent = l[1];
    });

    /* a frase que amarra os numeros, e so depois a licao escrita no campo */
    var conta = "";
    var minha = voltando ? q.rth : q.altura;
    var comoIa = voltando ? "voltava" : "aplicava";

    if (minha != null && q.alturaObstaculo != null) {
      conta = "A aeronave " + comoIa + " a " + num(minha, 1) + " m; " + nome +
              ", ali, está a " + num(q.alturaObstaculo, 1) + " m do chão.";
    } else if (q.relevo && (this.estadoAntes === "indo" || this.estadoAntes === "voltando" ||
                            this.estadoAntes === "subindo") && q.rth != null) {
      /* no deslocamento, a aeronave voa reta na altitude de RTH,
         contada a partir do ponto de decolagem */
      conta = "No deslocamento a aeronave voa reto, a " + num(q.rth, 1) + " m acima do ponto de " +
              "decolagem, sem acompanhar o terreno" +
              (q.relevoSobreOrigem != null
                ? " — e aqui o chão já estava " + num(q.relevoSobreOrigem, 1) + " m acima da decolagem."
                : ".") +
              " Com terreno subindo, a altitude de RTH tem de ser maior que o morro.";
    } else if (q.relevo) {
      conta = "O terreno subiu mais rápido do que a aeronave.";
    }

    if (q.fio) {
      conta += " Fio não aparece no radar a tempo: não há desvio automático " +
               "que salve. A única defesa é a altura.";
    } else if (q.desvio === false) {
      conta += " Com o desvio de obstáculos desligado, nada a fez parar.";
    }

    doc.getElementById("xg-queda-licao").textContent =
      (conta ? conta + " " : "") + (q.dica || "");

    doc.getElementById("xg-queda").classList.add("aberta");
    this.rodarFilmeDaQueda(doc);
  };

  /* O filme e a lista de quadros que a ponte grava enquanto a aeronave
     cai; toca em loop a 20 quadros por segundo enquanto o cartao esta
     aberto, e continua ganhando quadros nos primeiros segundos. */
  Operacao.prototype.rodarFilmeDaQueda = function (doc) {
    var self = this, k = 0;
    clearInterval(this.relogioFilme);
    this.relogioFilme = setInterval(function () {
      var d = self.doc();
      var alvo = d && d.getElementById("xg-queda-filme");
      var aberto = d && d.getElementById("xg-queda").classList.contains("aberta");
      if (!alvo || !aberto) { clearInterval(self.relogioFilme); return; }
      var filme = self.ponte.janela && self.ponte.janela.__xgQuedaFilme;
      if (!filme || !filme.length) return;
      k = (k + 1) % filme.length;
      alvo.getContext("2d").drawImage(filme[k], 0, 0, alvo.width, alvo.height);
    }, 50);
  };

  Operacao.prototype.escrever = function (doc, id, texto) {
    var alvo = doc.getElementById(id);
    if (alvo && alvo.textContent !== texto) alvo.textContent = texto;
  };

  return {
    criar: function (ponte, quadro) { return new Operacao(ponte, quadro); },
  };
})();
