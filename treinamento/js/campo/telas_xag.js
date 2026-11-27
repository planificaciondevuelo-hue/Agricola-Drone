/* ==========================================================================
   AS TELAS DO XAG ONE NO CELULAR, IGUAIS AO APARELHO

   Pelos prints do XAG One no celular dele (25/09/2026). O site do controle
   (controle-xag/, copia de pasta de fora - nunca editar) monta as telas do
   jeito dele; aqui elas sao corrigidas POR FORA, so no controle portatil
   (celular em pe):

   Tela inicial
     - menu no canto; "Eu mesmo ▾" no meio, solto sobre o mapa;
     - coluna da direita: ＋ e sino (brancos), camadas, bussola + localizar
       (juntos) e regua (escuros);
     - Operacao / mapeamento em vidro escuro, sobre a barra de baixo
       "Pagina inicial | registro operacional | Eu".
   Mapeamento
     - XAG no canto, "Mapeamento de lote unico ▾" em faixa escura;
     - coluna da direita: camadas, bussola + localizar, regua;
     - embaixo a direita o jeito de marcar ponto: bastao RTK, mira da
       aeronave e toque no mapa (o que vale no treino, em verde);
     - Limite do mapa | Desfazer | Mais | Salvar, todos brancos.

   O app redesenha o #phone inteiro a cada toque. Um MutationObserver no
   #phone refaz a correcao depois de cada desenho. Os botoes que entram aqui
   usam os mesmos `data-action` do app: o ouvinte de clique dele atende.
   Tamanhos em cqw (largura do celular), medidos nos prints (540 px = 100).
   ========================================================================== */

window.TELAS_XAG = (function () {
  "use strict";
  /* 21/11/2026 (Eduardo: "tudo onde mostra p60 e o p100 pro"): nome do drone no aplicativo XAG */
  /* 21/11/2026: selo de posicionamento igual em todas as telas (RTK por padrao; segue s.posModo). */
  function seloPosXag() { try { var m = JSON.parse(localStorage.getItem('guri-map-demo') || '{}').posModo; return m === 'GPS' ? 'GNSS' : (m === 'VRTK' ? 'VRTK' : (m === 'PPP' && NOME_XAG !== 'P100 Pro' ? 'PPP' : 'RTK')); } catch (e) { return 'RTK'; } }
  var NOME_XAG = /[?&](modelo|drone)=p100pro(&|$)/.test((function () { try { return (window.parent !== window ? window.parent : window).location.search; } catch (e) { return location.search; } })()) ? "P100 Pro" : "P60H 2024";

  function svg(corpo, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + corpo + "</svg>";
  }

  var ICONE = {
    mais: svg('<path d="M12 4v16M4 12h16"/>'),
    sino: svg('<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.6 2H4.4z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    camadas: svg('<path d="M12 3.5l8.5 4.7-8.5 4.7-8.5-4.7z"/><path d="M3.5 12.6l8.5 4.7 8.5-4.7"/>'),
    bussola: svg('<path d="M12 3l6.5 17L12 16l-6.5 4z"/>'),
    localizar: svg('<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>' +
                   '<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>'),
    regua: svg('<path d="M3.5 16.5L16.5 3.5l4 4-13 13z"/><path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>'),
    pessoa: svg('<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c.8-4 3.6-6 7-6s6.2 2 7 6"/>'),
    inicio: svg('<rect x="3.5" y="3.5" width="7.5" height="10" rx="1.6" fill="currentColor"/>' +
                '<rect x="13" y="3.5" width="7.5" height="6" rx="1.6" fill="currentColor"/>' +
                '<rect x="3.5" y="15.5" width="7.5" height="5" rx="1.6" fill="currentColor"/>' +
                '<rect x="13" y="11.5" width="7.5" height="9" rx="1.6" fill="currentColor"/>', ' stroke="none"'),
    registro: svg('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13.5h9M7.5 17h5"/>'),
    operador: svg('<path d="M6.5 9.5c0-3.5 2.4-5.5 5.5-5.5s5.5 2 5.5 5.5z"/><path d="M5 9.5h14"/>' +
                  '<path d="M8 12.5c.4 2.3 1.9 3.6 4 3.6s3.6-1.3 4-3.6"/><path d="M5 21c.9-2.6 3.7-4 7-4s6.1 1.4 7 4"/>'),
    rtk: svg('<rect x="8.5" y="2.5" width="7" height="19" rx="2.5"/><rect x="10.3" y="5" width="3.4" height="4" rx=".6"/>' +
             '<circle cx="12" cy="13.5" r="1.2"/>'),
    mira: svg('<circle cx="12" cy="12" r="5.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/>'),
    toque: svg('<path d="M9.5 12V5.3a1.6 1.6 0 0 1 3.2 0V11"/><path d="M12.7 10.4a1.6 1.6 0 0 1 3.2 0v1.2"/>' +
               '<path d="M15.9 11.4a1.6 1.6 0 0 1 3.1.4v2.8c0 3.6-2.6 6.4-6.2 6.4h-.9c-1.9 0-3.3-.8-4.4-2.3L4.6 14.2' +
               'a1.6 1.6 0 0 1 2.5-2l2.4 2.4"/>'),
    limite: svg('<rect x="6" y="4.5" width="12" height="16" rx="1.5" fill="#20c05c" stroke="#128a3f"/>' +
                '<path d="M12 1.5l2.2 2.2H9.8z" fill="#1c252a" stroke="none"/>'),
    desfazer: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.5 11.5h5.5a2.6 2.6 0 0 1 0 5.2H12"/><path d="M10.5 9l-2.3 2.5 2.3 2.4"/>'),
    salvar: svg('<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>'),
    aviao: svg('<path d="M21 3L3 10.5l7.2 2.6L13 20.5z" fill="currentColor"/>', ' stroke="none"'),
    mapa: svg('<path d="M3 6l6-2.5 6 2.5 6-2.5V18l-6 2.5-6-2.5L3 20.5z" fill="currentColor"/>' +
              '<path d="M9 3.5v14.6M15 6v14.5" stroke="#fff" stroke-width="1.4"/>', ' stroke="none"'),
  };

  var ESTILO = [
    ".remote.handheld .phone{container-type:inline-size}",

    /* ---- pecas comuns: coluna da direita e botoes quadrados */
    ".xg-col{position:absolute;z-index:9;right:4cqw;display:flex;flex-direction:column;gap:3cqw}",
    ".xg-col button,.xg-metodos button{width:11cqw;height:11cqw;border:0;padding:0;display:grid;place-items:center;cursor:pointer}",
    ".xg-col svg,.xg-metodos svg{width:5.6cqw;height:5.6cqw}",
    ".xg-col .xg-branco{background:#fff;color:#1b2429;border-radius:2cqw;box-shadow:0 .4cqw 1.4cqw #0003}",
    /* vidro fosco: no app o botao pega a cor do mapa que esta por baixo
       (oliva no verde, bege na terra) - nao e uma cor fixa */
    ".xg-col .xg-escuro{background:#9a948a52;color:#fff;border-radius:2cqw;backdrop-filter:blur(10px) brightness(.8) saturate(1.2)}",
    ".xg-col .xg-grupo{display:flex;flex-direction:column;border-radius:2cqw;overflow:hidden;background:#9a948a52;",
    " backdrop-filter:blur(10px) brightness(.8) saturate(1.2)}",
    /* a regua tem uma setinha para a esquerda (abre a gaveta de medidas) */
    ".xg-col .xg-regua{position:relative}",
    ".xg-col .xg-regua:before{content:'';position:absolute;left:1.1cqw;top:50%;transform:translateY(-50%);",
    " border:1cqw solid transparent;border-right:1.2cqw solid #fff;border-left:0}",
    ".xg-col .xg-grupo button{background:transparent;color:#fff}",
    ".xg-col .xg-grupo button+button{border-top:1px solid #ffffff22}",
    ".xg-dica{position:absolute;z-index:20;left:50%;bottom:34%;transform:translateX(-50%);max-width:86%;",
    " background:#1f2a2ee6;color:#fff;border-radius:2cqw;padding:2.4cqw 3.6cqw;font-size:3.2cqw;",
    " text-align:center;pointer-events:none;animation:xgSome 2.6s forwards}",
    "@keyframes xgSome{0%,80%{opacity:1}100%{opacity:0}}",

    /* ---- tela inicial */
    ".remote.handheld .home-view .home-shortcuts,.remote.handheld .home-view .home-tools{display:none!important}",
    ".remote.handheld .home-view .home-top{top:3cqw!important;left:4cqw!important;right:4cqw!important;height:11cqw;",
    " display:flex!important;justify-content:center!important;gap:0!important}",
    ".remote.handheld .home-view .home-menu{position:absolute;left:0;top:0;width:11cqw!important;min-width:0!important;",
    " height:11cqw!important;border-radius:2cqw!important;box-shadow:0 .4cqw 1.4cqw #0003}",
    ".remote.handheld .home-view .home-menu .app-icon{width:5.6cqw!important;height:5.6cqw!important}",
    ".remote.handheld .home-view .home-team{flex:none!important;background:transparent!important;color:#fff!important;",
    " font-size:3.7cqw!important;font-weight:600!important;gap:1.4cqw!important;text-shadow:0 1px 3px #000c}",
    ".remote.handheld .home-view .home-team svg{width:4.6cqw!important;height:4.6cqw!important}",
    ".remote.handheld .home-view .home-team svg:last-child{width:2.6cqw!important;height:2.6cqw!important}",
    ".remote.handheld .home-view .xg-col{top:3cqw}",
    ".remote.handheld .home-view .home-actions{left:4cqw!important;right:4cqw!important;bottom:18.5cqw!important;",
    " gap:3.5cqw!important;display:flex!important}",
    ".remote.handheld .home-view .home-actions button{flex:1;height:12cqw;padding:0!important;border-radius:2.4cqw!important;",
    " background:#9a948a52!important;color:#fff!important;box-shadow:none!important;",
    " backdrop-filter:blur(10px) brightness(.8) saturate(1.2);",
    " display:flex!important;align-items:center!important;justify-content:center!important;gap:2cqw!important;",
    " font-size:3.7cqw!important;font-weight:500!important}",
    ".remote.handheld .home-view .home-actions button svg{width:5cqw!important;height:5cqw!important;color:#fff}",
    ".xg-barra{position:absolute;z-index:9;left:0;right:0;bottom:0;height:14cqw;background:#f4f5f7;",
    " display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #e3e6ea}",
    ".xg-barra button{border:0;background:none;color:#1d262b;font-size:2.6cqw;display:flex;flex-direction:column;",
    " align-items:center;justify-content:center;gap:.8cqw;cursor:pointer;padding:0}",
    ".xg-barra svg{width:5.8cqw;height:5.8cqw}",
    ".xg-barra .xg-ativo{color:#17a567}",

    /* ---- mapeamento */
    ".remote.handheld .portrait-edit .map-tools,.remote.handheld .portrait-edit .edit-secondary-tools," +
    ".remote.handheld .portrait-edit-top>button[data-action='layers']{display:none!important}",
    ".remote.handheld .portrait-edit-top{top:3cqw!important;left:4cqw!important;right:19cqw!important;gap:3.5cqw!important}",
    ".remote.handheld .portrait-edit-top button.logo{width:11cqw!important;height:11cqw!important;border-radius:2cqw!important;",
    " font-size:4cqw;letter-spacing:-.04em!important;display:block!important;position:relative;text-align:center;",
    " line-height:9.6cqw!important;padding:0!important}",
    ".remote.handheld .portrait-edit-top button.logo:after{content:'';position:absolute;left:50%;bottom:1.4cqw;",
    " transform:translateX(-50%);border:1cqw solid transparent;border-top:1.1cqw solid #1c292c;border-bottom:0}",
    ".remote.handheld .portrait-edit-top strong{height:11cqw;background:#3d4636c9!important;color:#fff;border-radius:2cqw!important;",
    " font-size:3.5cqw!important;font-weight:500;padding:0 3cqw!important;gap:2.5cqw!important;backdrop-filter:blur(4px)}",
    ".remote.handheld .portrait-edit-top strong>span:first-child{font-size:5cqw}",
    ".remote.handheld .portrait-edit .xg-col{top:3cqw}",
    ".xg-metodos{position:absolute;z-index:9;right:4cqw;bottom:20cqw;display:flex;flex-direction:column;",
    " background:#fff;border-radius:2cqw;overflow:hidden;box-shadow:0 .4cqw 1.4cqw #0003}",
    ".xg-metodos button{background:#fff;color:#1b2429}",
    ".xg-metodos button+button{border-top:1px solid #e6e8eb}",
    ".xg-metodos .xg-ativo{color:#17a567}",
    ".remote.handheld .portrait-edit .map-bottom{left:4cqw!important;right:4cqw!important;bottom:3cqw!important}",
    ".remote.handheld .portrait-edit .toolbar{gap:2.2cqw!important}",
    ".remote.handheld .portrait-edit .toolbar button{min-height:0!important;height:12cqw;border-radius:2cqw!important;",
    " background:#fff!important;color:#1b2429!important;outline:0!important;font-size:3cqw!important;font-weight:500!important;",
    " opacity:1!important;padding:0 1cqw!important;box-shadow:0 .4cqw 1.4cqw #0003!important}",
    ".remote.handheld .portrait-edit .toolbar button:disabled{color:#a9afb4!important}",
    ".remote.handheld .portrait-edit .toolbar button strong{display:grid!important;place-items:center;height:5.4cqw}",
    ".remote.handheld .portrait-edit .toolbar button strong svg{width:5cqw;height:5cqw}",
    ".remote.handheld .portrait-edit .auto-close{bottom:37cqw!important;font-size:3.2cqw!important;padding:2cqw 4cqw!important}",
  ].join("");

  function botao(doc, classe, acao, icone, titulo) {
    var b = doc.createElement("button");
    b.type = "button";
    if (classe) b.className = classe;
    if (acao) b.setAttribute("data-action", acao);
    b.setAttribute("aria-label", titulo);
    b.title = titulo;
    b.innerHTML = icone;
    return b;
  }

  function dica(mapa, texto) {
    var velha = mapa.querySelector(".xg-dica");
    if (velha) velha.remove();
    var d = mapa.ownerDocument.createElement("div");
    d.className = "xg-dica";
    d.textContent = texto;
    mapa.appendChild(d);
    setTimeout(function () { d.remove(); }, 2700);
  }

  /* bussola + localizar + regua: a mesma coluna nas duas telas */
  function colunaDoMapa(doc, comecar) {
    var col = doc.createElement("div");
    col.className = "xg-col";
    (comecar || []).forEach(function (b) { col.appendChild(b); });
    col.appendChild(botao(doc, "xg-escuro", "layers", ICONE.camadas, "Camadas do mapa"));
    var grupo = doc.createElement("div");
    grupo.className = "xg-grupo";
    grupo.appendChild(botao(doc, "", "center", ICONE.bussola, "Norte para cima"));
    grupo.appendChild(botao(doc, "", "center", ICONE.localizar, "Minha posição"));
    col.appendChild(grupo);
    col.appendChild(botao(doc, "xg-escuro xg-regua", "measure", ICONE.regua, "Medir distância"));
    return col;
  }

  function telaInicial(doc, vista) {
    var mapa = vista.querySelector(".map");
    if (!mapa || mapa.querySelector(".xg-col")) return;

    /* o "+" abre a tela de Operacao (print dele de 26/09) */
    mapa.appendChild(colunaDoMapa(doc, [
      botao(doc, "xg-branco", "operations", ICONE.mais, "Operação"),
      botao(doc, "xg-branco", "notifications", ICONE.sino, "Notificações"),
    ]));

    /* "Eu mesmo ▾", com a pessoa no lugar do icone de equipe */
    var equipe = vista.querySelector(".home-team");
    if (equipe) {
      var nome = equipe.querySelector("span");
      if (nome && /equipe principal/i.test(nome.textContent)) nome.textContent = "Eu mesmo";
      var icones = equipe.querySelectorAll("svg");
      if (icones[0]) icones[0].outerHTML = ICONE.pessoa;
      /* o ▾ do app e um triangulo cheio, nao a seta de traco */
      if (icones[1]) icones[1].outerHTML = svg('<path d="M5 8.5h14L12 17z" fill="currentColor"/>', ' stroke="none"');
    }

    vista.querySelectorAll(".home-actions button").forEach(function (b) {
      var acao = b.getAttribute("data-action");
      var ic = b.querySelector("svg");
      if (ic && acao === "operations") ic.outerHTML = ICONE.aviao;
      if (ic && acao === "mapping") ic.outerHTML = ICONE.mapa;
    });

    mapa.appendChild(barraDeBaixo(doc, "home"));
  }

  var ICONES_DA_BARRA = { "mode-menu": "limite", "undo": "desfazer", "save-map": "salvar" };

  function mapeamento(doc, vista) {
    var mapa = vista.classList.contains("map") ? vista : vista.querySelector(".map");
    if (!mapa || mapa.querySelector(".xg-col")) return;

    mapa.appendChild(colunaDoMapa(doc));

    var metodos = doc.createElement("div");
    metodos.className = "xg-metodos";
    /* fonte do ponto (relatorio "criar mapa", 05/10): equipamento (Selecao
       de equipamento: RTK6 PRO / P60H 2024), mira no meio do mapa ou toque.
       Quem marca e o xag_mapeamento.js, dentro do app. */
    var M = doc.defaultView.XAG_MAPEAMENTO;
    var fonteAtual = M && M.estado() ? M.estado().fonte : "toque";
    var rtk = botao(doc, fonteAtual === "aeronave" ? "xg-ativo" : "", null, ICONE.rtk, "Seleção de equipamento");
    var mira = botao(doc, fonteAtual === "mira" ? "xg-ativo" : "", null, ICONE.mira, "Marcar com a mira");
    var toque = botao(doc, fonteAtual === "toque" ? "xg-ativo" : "", null, ICONE.toque, "Marcar tocando no mapa");
    rtk.addEventListener("click", function () { if (M) M.fonte("equipamento"); else dica(mapa, "Neste treino os pontos são marcados tocando no mapa."); });
    mira.addEventListener("click", function () { if (M) M.fonte("mira"); else dica(mapa, "Neste treino os pontos são marcados tocando no mapa."); });
    toque.addEventListener("click", function () { if (M) M.fonte("toque"); else dica(mapa, "Toque no mapa para marcar os cantos do talhão."); });
    [rtk, mira, toque].forEach(function (b) { metodos.appendChild(b); });
    mapa.appendChild(metodos);

    mapa.querySelectorAll(".toolbar button").forEach(function (b) {
      var nome = ICONES_DA_BARRA[b.getAttribute("data-action")];
      var forte = b.querySelector("strong");
      if (forte && nome && b.getAttribute("data-action") !== "mode-menu") forte.innerHTML = ICONE[nome];
      if (forte && b.getAttribute("data-action") === "mode-menu" && /Limite/.test((window.TPD_IDIOMAS ? TPD_IDIOMAS.original(b) : b.textContent))) forte.innerHTML = ICONE.limite;
      if (forte && b.getAttribute("data-action") === "more") forte.textContent = "···";
    });
  }

  /* ------------------------------------------------------------ Eu

     Pelo print dele: titulo "Eu" sem voltar (e aba, nao pagina), cartao da
     conta com a etiqueta "Eu", foto, nome e telefone mascarado, e tres
     cartoes: Dispositivo + Modelos de operação (assim, em ingles, no app),
     Servico, Configuracoes. O nome e o telefone sao os do ALUNO logado -
     nunca os dados do dono do aparelho que serviu de modelo. */
  function contaDoAluno() {
    var nome = "Operador", fone = "";
    try {
      var s = window.SESSAO && window.SESSAO.atual();
      var c = window.SESSAO && window.SESSAO.cadastro && window.SESSAO.cadastro();
      if (s && s.aluno) nome = s.aluno;
      var d = c && c.telefone ? String(c.telefone).replace(/\D/g, "") : "";
      if (d.length >= 10) fone = "55" + d.slice(0, 2) + "*****" + d.slice(-2);
    } catch (e) { /* sem sessao: fica o generico */ }
    return { nome: nome, fone: fone };
  }

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  var ICONES_EU = {
    dispositivo: svg('<circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>' +
                     '<circle cx="18" cy="18" r="3"/><path d="M8.2 8.2l2.3 2.3M15.8 8.2l-2.3 2.3M8.2 15.8l2.3-2.3M15.8 15.8l-2.3-2.3"/>' +
                     '<rect x="10" y="10" width="4" height="4" rx="1"/>', ' style="color:#e5484d"'),
    modelo: svg('<rect x="6.5" y="3.5" width="14" height="14" rx="2.5"/><path d="M3.5 7v11a2.5 2.5 0 0 0 2.5 2.5h11"/>' +
                '<path d="M10 8v6M14 11v3M10 8h1.5"/>', ' style="color:#2f7fe0"'),
    servico: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="3.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="3.5"/>' +
                 '<rect x="3.5" y="13.5" width="7" height="7" rx="3.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="3.5"/>',
                 ' style="color:#19b36b"'),
    config: svg('<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><circle cx="12" cy="12" r="3"/>', ' style="color:#3cc3a0"'),
  };
  var SETA = '<i class="xg-seta">›</i>';

  function barraDeBaixo(doc, ativa) {
    var barra = doc.createElement("nav");
    barra.className = "xg-barra";
    [["home", ICONE.inicio, "Página inicial"],
     ["records", ICONE.registro, "registro operacional"],
     ["profile", ICONE.operador, "Eu"]].forEach(function (d) {
      var b = botao(doc, d[0] === ativa ? "xg-ativo" : "", d[0], d[1], d[2]);
      b.insertAdjacentHTML("beforeend", "<span>" + d[2] + "</span>");
      barra.appendChild(b);
    });
    return barra;
  }

  function telaEu(doc, vista) {
    if (vista.querySelector(".xg-eu")) return;
    var conta = contaDoAluno();
    vista.classList.add("xg-vista-aba");
    vista.innerHTML =
      '<div class="xg-eu"><h2>Eu</h2>' +
      '<button class="xg-cartao xg-conta" data-action="account">' +
      '  <span class="xg-etiqueta">' + ICONE.pessoa + 'Eu</span>' +
      '  <span class="xg-linha"><span class="xg-foto">' + ICONE.pessoa + '</span>' +
      '  <span class="xg-nome"><b>' + esc(conta.nome) + '</b>' + (conta.fone ? "<small>" + conta.fone + "</small>" : "") + "</span>" +
      SETA + "</span></button>" +
      '<div class="xg-cartao">' +
      '  <button class="xg-item" data-action="device">' + ICONES_EU.dispositivo + "<span>Dispositivo</span>" + SETA + "</button>" +
      '  <button class="xg-item" data-action="model">' + ICONES_EU.modelo + "<span>Modelos de operação</span>" + SETA + "</button>" +
      "</div>" +
      '<div class="xg-cartao"><button class="xg-item" data-action="service">' + ICONES_EU.servico +
      "<span>Serviço</span>" + SETA + "</button></div>" +
      '<div class="xg-cartao"><button class="xg-item" data-action="settings">' + ICONES_EU.config +
      "<span>Configurações</span>" + SETA + "</button></div>" +
      "</div>";
    vista.appendChild(barraDeBaixo(doc, "profile"));
  }

  var ESTILO_EU = [
    ".remote.handheld .xg-vista-aba{background:#eff0f2!important;padding:0!important;overflow:hidden!important}",
    ".xg-eu{position:absolute;inset:0 0 14cqw;overflow:auto;padding:0 4cqw 4cqw;font-family:Roboto,Inter,'Segoe UI',sans-serif;color:#15191c}",
    ".xg-eu h2{margin:0;padding:7cqw 0 5.5cqw;text-align:center;font-size:4.4cqw;font-weight:700}",
    ".xg-cartao{display:block;width:100%;background:#fff;border:0;border-radius:2.6cqw;margin:0 0 3cqw;padding:0;text-align:left;font:inherit;color:inherit}",
    ".xg-conta{padding:4.4cqw 4cqw 4.6cqw;cursor:pointer}",
    ".xg-etiqueta{display:inline-flex;align-items:center;gap:1.2cqw;background:#f0f1f3;border-radius:5cqw;padding:1.2cqw 2.8cqw;font-size:3.2cqw}",
    ".xg-etiqueta svg{width:3.8cqw;height:3.8cqw}",
    ".xg-linha{display:flex;align-items:center;gap:3.4cqw;margin-top:3.6cqw}",
    ".xg-foto{width:13cqw;height:13cqw;border-radius:50%;background:#d9dbde;border:.5cqw solid #eceef0;display:grid;place-items:center;color:#8b9096;flex:none}",
    ".xg-foto svg{width:7.6cqw;height:7.6cqw;fill:#8b9096}",
    ".xg-nome{flex:1;min-width:0;display:flex;flex-direction:column;gap:.8cqw}",
    ".xg-nome b{font-size:5cqw;font-weight:500}",
    ".xg-nome small{font-size:3.4cqw;color:#7c8287}",
    ".xg-item{display:flex;align-items:center;gap:3.4cqw;width:100%;height:14cqw;padding:0 4cqw;background:none;border:0;",
    " font:inherit;font-size:4cqw;color:inherit;text-align:left;cursor:pointer}",
    ".xg-item+.xg-item{border-top:1px solid #e7e9eb;margin-left:4cqw;width:calc(100% - 4cqw);padding-left:0}",
    ".xg-item svg{width:5.4cqw;height:5.4cqw;flex:none}",
    ".xg-item span{flex:1}",
    ".xg-seta{font-style:normal;font-size:5.6cqw;color:#6f757a;line-height:1}",
  ].join("");

  /* ----------------------------------------------------- Dispositivo

     Pelo print dele. Regras que ele ditou (25/09): na lista "Mais" so
     aparece o controle que esta em uso - com o ACS4 + celular nao aparece o
     SRC4_H, com o SRC4 nao aparece o ACS4 - e o ACS4 fica "Online" quando
     esta ligado. Vale para os dois aparelhos, por isso nao depende de
     `.handheld`: no SRC4 a tela e deitada e a unidade (--u) e menor. */
  var FOTOS = {
    p60: svg('<circle cx="12" cy="12" r="11" fill="#e4e6e8" stroke="none"/>' +
             '<path d="M6 6l12 12M18 6L6 18" stroke="#1b1f22" stroke-width="1.6"/>' +
             '<circle cx="6" cy="6" r="2.2" fill="#d6262f" stroke="none"/><circle cx="18" cy="6" r="2.2" fill="#d6262f" stroke="none"/>' +
             '<circle cx="6" cy="18" r="2.2" fill="#d6262f" stroke="none"/><circle cx="18" cy="18" r="2.2" fill="#d6262f" stroke="none"/>' +
             '<rect x="9" y="8.5" width="6" height="7" rx="1.4" fill="#f4f4f4" stroke="#1b1f22" stroke-width=".8"/>', ""),
    acs4: svg('<circle cx="12" cy="12" r="11" fill="#e4e6e8" stroke="none"/>' +
              '<rect x="9.6" y="3" width="4.8" height="18" rx="2" fill="#1d2124" stroke="none"/>' +
              '<circle cx="12" cy="6.4" r="1.5" fill="#444a4e" stroke="#b8323b" stroke-width=".5"/>' +
              '<path d="M11 9.6h2M11 11.4h2M11 13.2h2M11 15h2" stroke="#3ecf7c" stroke-width=".7"/>', ""),
    rtk: svg('<circle cx="12" cy="12" r="11" fill="#e4e6e8" stroke="none"/>' +
             '<rect x="8.6" y="3.4" width="6.8" height="3.2" rx="1.4" fill="#c9ccd0" stroke="#9ea3a8" stroke-width=".5"/>' +
             '<rect x="10.4" y="6.6" width="3.2" height="7.4" rx=".8" fill="#d2d5d8" stroke="#9ea3a8" stroke-width=".5"/>' +
             '<path d="M12 14v7" stroke="#9ea3a8" stroke-width="1.2"/>', ""),
    src4: svg('<circle cx="12" cy="12" r="11" fill="#e4e6e8" stroke="none"/>' +
              '<path d="M4 16.5c0-1.8 1.4-3 3.2-3h9.6c1.8 0 3.2 1.2 3.2 3v1.5H4z" fill="#15191b" stroke="none"/>' +
              '<path d="M6.5 13.5l2.2-7.5h10l-2.2 7.5z" fill="#23282b" stroke="#0c0e0f" stroke-width=".4"/>' +
              '<path d="M8.4 12.4l1.6-5.3h7.4l-1.6 5.3z" fill="#3a4a55" stroke="none"/>', ""),
  };

  function linhaDeAparelho(foto, nome, acao, estado) {
    var etiqueta = estado ? '<em class="xg-estado' + ((estado === "Online" || estado === "Conectado") ? " xg-online" : "") + '">' + estado + "</em>" : "";
    return '<button class="xg-cartao xg-aparelho" data-action="' + acao + '"><span class="xg-miniatura">' + foto + "</span>" +
           '<span class="xg-nome"><b>' + nome + "</b>" + etiqueta + "</span>" + SETA + "</button>";
  }

  function telaDispositivo(doc, vista, remoto) {
    var portatil = remoto.classList.contains("handheld");
    var ligado = remoto.classList.contains("on");
    var assinatura = (portatil ? "p" : "i") + (ligado ? "1" : "0");
    var feito = vista.querySelector(".xg-disp");
    if (feito && feito.getAttribute("data-xg") === assinatura) return;

    vista.classList.add("xg-vista-disp", portatil ? "xg-em-pe" : "xg-deitado");
    vista.classList.remove(portatil ? "xg-deitado" : "xg-em-pe");
    vista.innerHTML =
      '<div class="xg-disp" data-xg="' + assinatura + '">' +
      '<div class="xg-topo"><button data-action="profile" aria-label="Voltar">' +
      svg('<path d="M15 4.5L7.5 12l7.5 7.5"/>') + "</button><h2>Dispositivo</h2>" +
      '<span><button data-action="device-help" aria-label="Adicionar dispositivo">' +
      svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>') + "</button>" +
      '<button data-action="device-help" aria-label="Mais opções">' +
      svg('<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>' +
          '<circle cx="19" cy="12" r="1.5" fill="currentColor"/>', ' stroke="none"') + "</button></span></div>" +
      '<p class="xg-secao">Dispositivo de operação</p>' +
      '<div class="xg-cartao">' + linhaDeAparelho(FOTOS.p60, NOME_XAG, "device-p60", portatil ? "Desconectado" : "Offline") +
      '<button class="xg-configurar" data-action="configure-operation-device">Configurar dispositivo de operação</button></div>' +
      '<p class="xg-secao">Mais</p>' +
      (portatil ? linhaDeAparelho(FOTOS.acs4, "ACS4", "device-acs", ligado ? "Conectado" : "Desconectado") : "") +
      linhaDeAparelho(FOTOS.rtk, "RTK6 PRO", "device-rtk", portatil ? "Desconectado" : "Offline") +
      (portatil ? "" : linhaDeAparelho(FOTOS.src4, "SRC4_H", "device-src", "")) +
      "</div>";
  }

  var ESTILO_DISP = [
    ".remote .phone{container-type:inline-size}",
    ".xg-vista-disp{background:#eff0f2!important;padding:0!important;overflow:hidden!important}",
    ".xg-vista-disp.xg-em-pe{--u:1cqw}",
    ".xg-vista-disp.xg-deitado{--u:.5cqw}",
    ".xg-disp{position:absolute;inset:0;overflow:auto;padding:0 calc(var(--u)*4) calc(var(--u)*4);",
    " font-family:Roboto,Inter,'Segoe UI',sans-serif;color:#15191c}",
    ".xg-deitado .xg-disp{padding-left:calc(50% - var(--u)*50);padding-right:calc(50% - var(--u)*50)}",
    ".xg-disp .xg-topo{display:flex;align-items:center;height:calc(var(--u)*16)}",
    ".xg-em-pe .xg-disp .xg-topo{margin-top:calc(var(--u)*4)}",
    ".xg-disp .xg-topo h2{flex:1;margin:0;text-align:center;font-size:calc(var(--u)*4.6);font-weight:700}",
    ".xg-disp .xg-topo span{display:flex;gap:calc(var(--u)*3)}",
    ".xg-disp .xg-topo button{border:0;background:none;padding:0;width:calc(var(--u)*7);height:calc(var(--u)*7);",
    " display:grid;place-items:center;color:#15191c;cursor:pointer}",
    ".xg-disp .xg-topo span{width:calc(var(--u)*17);justify-content:flex-end}",
    ".xg-disp .xg-topo>button{width:calc(var(--u)*17);justify-content:start}",
    ".xg-disp .xg-topo svg{width:calc(var(--u)*6.4);height:calc(var(--u)*6.4)}",
    ".xg-disp .xg-secao{margin:calc(var(--u)*2) calc(var(--u)*4) calc(var(--u)*3.4);font-size:calc(var(--u)*3.8);color:#5f656a}",
    ".xg-disp .xg-cartao{border-radius:calc(var(--u)*2.6);margin-bottom:calc(var(--u)*3)}",
    ".xg-disp .xg-cartao .xg-cartao{margin:0}",
    ".xg-aparelho{display:flex!important;align-items:center;gap:calc(var(--u)*2.6);padding:calc(var(--u)*3.2) calc(var(--u)*4)!important;cursor:pointer}",
    ".xg-miniatura{width:calc(var(--u)*12.4);height:calc(var(--u)*12.4);flex:none}",
    ".xg-miniatura svg{width:100%;height:100%}",
    ".xg-disp .xg-nome{gap:calc(var(--u)*1.2);align-items:flex-start}",
    ".xg-disp .xg-nome b{font-size:calc(var(--u)*4.2);font-weight:500}",
    ".xg-estado{font-style:normal;font-size:calc(var(--u)*3.1);background:#d8d9db;color:#2b3034;border-radius:calc(var(--u)*.6);",
    " padding:calc(var(--u)*.4) calc(var(--u)*1)}",
    ".xg-estado.xg-online{background:#dcf5e8;color:#17a567}",
    ".xg-disp .xg-seta{font-size:calc(var(--u)*5.6)}",
    ".xg-configurar{display:block;margin:0 calc(var(--u)*12) 0;width:calc(100% - var(--u)*24);border:0;border-top:0;",
    " background:#ecedef;color:#17a567;border-radius:calc(var(--u)*1.4);height:calc(var(--u)*10);",
    " font:inherit;font-size:calc(var(--u)*3.7);cursor:pointer;margin-bottom:calc(var(--u)*3.2)}",
    ".xg-disp .xg-cartao>.xg-aparelho{border-bottom:1px solid #e7e9eb;border-radius:0}",
    ".xg-disp .xg-cartao>.xg-aparelho:only-child{border:0}",
    ".xg-disp .xg-cartao .xg-configurar{margin-top:calc(var(--u)*3.2)}",
  ].join("");

  /* ------------------------------------------------------- Lista (☰)

     Pelos prints: o ☰ da tela inicial NAO troca de tela - abre a gaveta
     "Lista" na metade de baixo, com o alto da tela inicial intacto (menu,
     "Eu mesmo", coluna da direita e o ponto azul). Abas Mapa | mapa HD |
     Prescricoes e, embaixo, uma fileira de botoes que muda por aba:
       Mapa         Pesquisar  Atualizar  ··· Mais
       mapa HD      Pesquisar  Atualizar  Imagens...  ···
       Prescricoes  Pesquisar  Atualizar  ⊕ Novo  ··· Mais          */
  var ICONES_LISTA = {
    pesquisar: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>'),
    atualizar: svg('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.2h-4.2"/>'),
    imagens: svg('<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M7.5 15.5l3-3.5 2.2 2.3 1.6-1.6 2.2 2.8z"/>'),
    novo: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'),
    mapa: svg('<path d="M4.5 18.5l3-12 9 1.5 3 9.5z"/><circle cx="4.5" cy="18.5" r="1.3" fill="currentColor"/>' +
              '<circle cx="7.5" cy="6.5" r="1.3" fill="currentColor"/><circle cx="16.5" cy="8" r="1.3" fill="currentColor"/>' +
              '<circle cx="19.5" cy="17.5" r="1.3" fill="currentColor"/>'),
    hd: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.6"/>' +
            '<path d="M3.5 17l5-5 4 4 2.5-2.5 5.5 5"/>'),
    prescricao: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M12 3.5v17M3.5 12h17"/>'),
    vazio: svg('<path d="M5 6l5-2 4 2 5-2v14l-5 2-4-2-5 2z" fill="#eceef0" stroke="#d3d6d9"/>' +
               '<path d="M10 4v14M14 6v14" stroke="#d3d6d9"/><path d="M11.5 9h7v6h-7z" fill="#fff" stroke="#d3d6d9"/>'),
  };

  function pilula(doc, icone, texto, acao, mapa, recado) {
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "xg-pilula";
    if (acao) b.setAttribute("data-action", acao);
    b.innerHTML = icone + (texto ? "<span>" + texto + "</span>" : "");
    if (!acao) b.addEventListener("click", function () { dica(mapa, recado); });
    return b;
  }

  function listaDeMapas(doc, mapa) {
    if (mapa.querySelector(".xg-col")) return;

    /* o alto da tela inicial, no lugar do alto de mapa comum do site */
    var topo = doc.createElement("div");
    topo.className = "xg-topo-inicio";
    topo.innerHTML =
      '<button class="xg-menu" data-action="home" aria-label="Fechar a lista">' +
      svg('<circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/>' +
          '<circle cx="4" cy="18" r="1" fill="currentColor"/><path d="M8.5 6h11.5M8.5 12h11.5M8.5 18h11.5"/>') + "</button>" +
      '<button class="xg-equipe" data-action="team-menu">' + ICONE.pessoa + "<span>Eu mesmo</span>" +
      svg('<path d="M5 8.5h14L12 17z" fill="currentColor"/>', ' stroke="none"') + "</button>";
    mapa.appendChild(topo);
    mapa.appendChild(colunaDoMapa(doc, [
      botao(doc, "xg-branco", "operations", ICONE.mais, "Operação"),
      botao(doc, "xg-branco", "notifications", ICONE.sino, "Notificações"),
    ]));

    var gaveta = mapa.querySelector(".map-list-sheet");
    if (!gaveta) return;
    var fechar = gaveta.querySelector(".sheet-head .x");
    if (fechar) fechar.innerHTML = svg('<path d="M7 7l10 10M17 7L7 17"/>');

    var aba = (gaveta.querySelector(".segmented .selected") || {}).textContent || "Mapa";
    var ferramentas = gaveta.querySelector(".list-tools");
    if (ferramentas) {
      ferramentas.innerHTML = "";
      ferramentas.appendChild(pilula(doc, ICONES_LISTA.pesquisar, "Pesquisar", "search"));
      ferramentas.appendChild(pilula(doc, ICONES_LISTA.atualizar, "Atualizar", "refresh"));
      if (/HD/.test(aba)) {
        ferramentas.appendChild(pilula(doc, ICONES_LISTA.imagens, "Imagens...", null, mapa,
          "No treino não há imagens de mapa HD para importar."));
        ferramentas.appendChild(pilula(doc, "···", "", "list-more"));
      } else {
        if (/Prescri/.test(aba)) {
          ferramentas.appendChild(pilula(doc, ICONES_LISTA.novo, "Novo", null, mapa,
            "Prescrição nova: use a taxa variável do XGuri para gerar o arquivo."));
        }
        ferramentas.appendChild(pilula(doc, "···", "Mais", "list-more"));
      }
    }

    /* cada item com o icone da aba, nome grande e area embaixo */
    var icone = /HD/.test(aba) ? ICONES_LISTA.hd : /Prescri/.test(aba) ? ICONES_LISTA.prescricao : ICONES_LISTA.mapa;
    gaveta.querySelectorAll(".card .row").forEach(function (r) {
      if (!r.querySelector(".xg-icone-item")) r.insertAdjacentHTML("afterbegin", '<i class="xg-icone-item">' + icone + "</i>");
    });
    var vazio = gaveta.querySelector(".list-empty .graphic");
    if (vazio) vazio.innerHTML = ICONES_LISTA.vazio;
    var total = gaveta.querySelector(".list-empty p");
    if (total) total.textContent = total.textContent.replace("0,00 m²", "0.00㎡");
  }

  var ESTILO_LISTA = [
    ".remote.handheld .list-view .map-top,.remote.handheld .list-view .map-tools{display:none!important}",
    ".remote.handheld .list-view .xg-col{top:3cqw}",
    ".xg-topo-inicio{position:absolute;z-index:9;top:3cqw;left:4cqw;right:4cqw;height:11cqw;display:flex;",
    " align-items:center;justify-content:center;pointer-events:none}",
    ".xg-topo-inicio button{pointer-events:auto;cursor:pointer;border:0}",
    ".xg-topo-inicio .xg-menu{position:absolute;left:0;top:0;width:11cqw;height:11cqw;border-radius:2cqw;background:#fff;",
    " color:#1b2429;display:grid;place-items:center;padding:0;box-shadow:0 .4cqw 1.4cqw #0003}",
    ".xg-topo-inicio .xg-menu svg{width:5.6cqw;height:5.6cqw}",
    ".xg-topo-inicio .xg-equipe{background:none;color:#fff;display:flex;align-items:center;gap:1.4cqw;",
    " font:inherit;font-size:3.7cqw;text-shadow:0 1px 3px #000c;padding:0}",
    ".xg-topo-inicio .xg-equipe svg{width:4.6cqw;height:4.6cqw;filter:drop-shadow(0 1px 2px #000a)}",
    ".xg-topo-inicio .xg-equipe svg:last-child{width:2.6cqw;height:2.6cqw}",
    /* a gaveta */
    ".remote.handheld .map-list-sheet{height:48%!important;max-height:none!important;padding:0!important;",
    " background:#f3f4f6!important;border-radius:3cqw 3cqw 0 0!important;display:flex;flex-direction:column;overflow:hidden!important}",
    ".remote.handheld .map-list-sheet:before{width:9cqw!important;height:1cqw!important;margin:1.8cqw auto 0!important;background:#c9cbd0!important}",
    ".remote.handheld .map-list-sheet .sheet-head{min-height:0!important;height:10cqw;margin:0!important;padding:0 4cqw}",
    ".remote.handheld .map-list-sheet .sheet-head h3{font-size:4.4cqw!important;font-weight:600!important}",
    ".remote.handheld .map-list-sheet .sheet-head .x{right:4cqw!important;width:7cqw!important;height:7cqw!important;border-radius:50%;",
    " border:0;background:#e3e5e8;color:#4a5055;display:grid;place-items:center;padding:0}",
    ".remote.handheld .map-list-sheet .sheet-head .x svg{width:4cqw;height:4cqw}",
    ".remote.handheld .map-list-sheet .segmented{margin:1.4cqw 4cqw 0;padding:.8cqw!important;border-radius:1.6cqw!important;background:#e6e7ea!important}",
    ".remote.handheld .map-list-sheet .segmented button{font-size:3.6cqw!important;padding:1.6cqw 0!important;color:#8a9095!important;",
    " border-radius:1.2cqw!important;font-weight:400!important}",
    ".remote.handheld .map-list-sheet .segmented button.selected{color:#15191c!important;background:#fff!important}",
    ".remote.handheld .map-list-sheet .list-tools{margin:0!important;padding:3.2cqw 4cqw;gap:2.4cqw!important;border-top:1px solid #e3e5e8;margin-top:3cqw!important}",
    ".xg-pilula{display:flex;align-items:center;gap:1cqw;height:7.6cqw;padding:0 2.2cqw;border:0;border-radius:1.4cqw;",
    " background:#e7e9ec;color:#1b2429;font:inherit;font-size:3.1cqw;cursor:pointer;white-space:nowrap}",
    ".xg-pilula svg{width:3.8cqw;height:3.8cqw}",
    ".remote.handheld .map-list-sheet .list-empty{flex:1;margin:0!important;border-radius:0!important;padding:3cqw 5cqw!important;background:#fff}",
    ".remote.handheld .map-list-sheet .list-empty p{font-size:3.3cqw!important;color:#6f757a!important;margin:0!important}",
    ".remote.handheld .map-list-sheet .list-empty .empty{padding:6cqw 0 0!important}",
    ".remote.handheld .map-list-sheet .list-empty .graphic svg{width:15cqw;height:15cqw;margin:0 auto}",
    ".remote.handheld .map-list-sheet .list-empty strong{font-size:3.8cqw;font-weight:500;margin-top:2cqw!important}",
    ".remote.handheld .map-list-sheet .card{margin:0 4cqw!important;border-radius:2.6cqw;overflow:auto;background:#fff}",
    ".remote.handheld .map-list-sheet .card .row{display:flex;align-items:center;gap:3cqw;padding:3cqw 4cqw!important;font-size:4cqw}",
    ".remote.handheld .map-list-sheet .card .row b{font-weight:400}",
    ".remote.handheld .map-list-sheet .card .row small{font-size:3.3cqw;color:#8a9095}",
    ".remote.handheld .map-list-sheet .card .row>span:first-of-type{flex:1;display:flex;flex-direction:column;gap:1cqw}",
    ".xg-icone-item{display:grid;place-items:center;font-style:normal}",
    ".xg-icone-item svg{width:5.8cqw;height:5.8cqw}",
  ].join("");

  /* ------------------------------------------------ mapeamento, por dentro

     Pelos 11 prints do mapeamento (25/09):
     - "Limite do mapa" abre um POPUP no canto de baixo (nao uma gaveta):
       Limite do mapa ✓ / Obstaculos / Zona sem pulverizacao / Marcador /
       Ponto de operacao, cada um com o icone da sua cor;
     - em Obstaculos, um botao quadrado acima da barra abre Poligono ✓ /
       Circulo; no circulo aparece a mira no meio e um painel com o botao
       vermelho, que marca o circulo onde a mira esta;
     - em Marcador: tres cores e "Ponto de marcacao ✓ / Linha de marcacao";
     - contagem do que ja foi marcado acima da barra (▨ 1  ⊘ 1  ◎ 2);
     - o comprimento de cada lado em metros, escrito sobre a linha;
     - o titulo "Mapeamento de lote unico ▾" abre "lote unico ✓ / multi-lote".  */
  var CORES = { lote: "#17b36b", obstaculo: "#e5484d", zona: "#f0a020", marcador: "#a34be0", ponto: "#e9c400" };
  var ICONES_MODO = {
    lote: svg('<rect x="6" y="4.5" width="12" height="16" rx="1.5" fill="' + CORES.lote + '" stroke="#0f7a48"/>' +
              '<path d="M12 1.5l2.2 2.2H9.8z" fill="#1c252a" stroke="none"/>'),
    obstaculo: svg('<rect x="3.5" y="9" width="17" height="11" rx="1.5" fill="' + CORES.obstaculo + '" stroke="#a5242a"/>' +
                   '<path d="M6.5 9V6h3v3M14.5 9V6h3v3M8 13h8M8 16h8" stroke="#fff"/>'),
    zona: svg('<circle cx="12" cy="12" r="8" fill="' + CORES.zona + '" stroke="#b8760e"/><path d="M7 17L17 7" stroke="#fff" stroke-width="2.2"/>'),
    marcador: svg('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" fill="' + CORES.marcador + '" stroke="#6f2aa0"/>' +
                  '<circle cx="12" cy="10" r="2.4" fill="#fff" stroke="none"/>'),
    ponto: svg('<rect x="4" y="4" width="16" height="16" rx="3" fill="' + CORES.ponto + '" stroke="#a88b00"/>' +
               '<circle cx="12" cy="12" r="3" fill="#fff" stroke="none"/>'),
    poligono: svg('<path d="M5 6l14-1.5L18 18 6 19z" fill="none" stroke="' + CORES.obstaculo + '" stroke-width="1.6"/>' +
                  '<circle cx="5" cy="6" r="1.6" fill="' + CORES.obstaculo + '" stroke="none"/><circle cx="19" cy="4.5" r="1.6" fill="' + CORES.obstaculo + '" stroke="none"/>' +
                  '<circle cx="18" cy="18" r="1.6" fill="' + CORES.obstaculo + '" stroke="none"/><circle cx="6" cy="19" r="1.6" fill="' + CORES.obstaculo + '" stroke="none"/>'),
    circulo: svg('<circle cx="12" cy="12" r="7.5" fill="none" stroke="' + CORES.obstaculo + '" stroke-width="1.6"/>' +
                 '<circle cx="12" cy="12" r="2.4" fill="' + CORES.obstaculo + '" stroke="none"/>'),
    linha: svg('<path d="M5 19L19 5" stroke="' + CORES.marcador + '" stroke-width="1.8"/>' +
               '<circle cx="5" cy="19" r="2" fill="' + CORES.marcador + '" stroke="none"/><circle cx="19" cy="5" r="2" fill="' + CORES.marcador + '" stroke="none"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5" stroke="#17b36b" stroke-width="2.4"/>'),
    unico: svg('<rect x="5" y="5" width="14" height="14" rx="1.5"/><circle cx="5" cy="5" r="1.4" fill="currentColor"/>' +
               '<circle cx="19" cy="5" r="1.4" fill="currentColor"/><circle cx="5" cy="19" r="1.4" fill="currentColor"/><circle cx="19" cy="19" r="1.4" fill="currentColor"/>'),
    multi: svg('<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 12h16M12 4v16"/>'),
    mira: svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>'),
  };

  function salvoDoApp(doc) {
    try { return JSON.parse(doc.defaultView.localStorage.getItem("guri-map-demo") || "null"); }
    catch (e) { return null; }
  }

  /* popup pequeno, ancorado no canto de baixo esquerdo (acima da barra) */
  function popup(doc, mapa, id, itens, aoEscolher) {
    var velho = mapa.querySelector("#" + id);
    mapa.querySelectorAll(".xg-popup").forEach(function (p) { p.remove(); });
    if (velho) return;                               // segundo toque fecha
    var caixa = doc.createElement("div");
    caixa.className = "xg-popup";
    caixa.id = id;
    itens.forEach(function (it) {
      var b = doc.createElement("button");
      b.type = "button";
      if (it.acao) b.setAttribute("data-action", it.acao);
      b.innerHTML = it.icone + "<span>" + it.texto + "</span>" + (it.marcado ? ICONES_MODO.check : "");
      b.addEventListener("click", function () {
        caixa.remove();
        if (it.recado) dica(mapa, it.recado);
        if (aoEscolher) aoEscolher(it);
      });
      caixa.appendChild(b);
    });
    mapa.appendChild(caixa);
    /* toque fora fecha */
    setTimeout(function () {
      doc.addEventListener("pointerdown", function fechar(e) {
        if (!caixa.contains(e.target)) { caixa.remove(); doc.removeEventListener("pointerdown", fechar, true); }
      }, true);
    }, 0);
  }

  function modoAtual(mapa) {
    var b = mapa.querySelector('.toolbar [data-action="mode-menu"]');
    var t = b ? b.textContent : "";
    return /Obst/.test(t) ? "obstaculo" : /Zona/.test(t) ? "zona" : /Marcador/.test(t) ? "marcador" : /Ponto/.test(t) ? "ponto" : "lote";
  }

  function mapeamentoPorDentro(doc, mapa) {
    var modo = modoAtual(mapa);
    var s = salvoDoApp(doc) || {};

    /* o botao da ferramenta: icone da cor certa e o popup no lugar da gaveta */
    var ferramenta = mapa.querySelector('.toolbar [data-action="mode-menu"]');
    if (ferramenta && !ferramenta.getAttribute("data-xg")) {
      ferramenta.setAttribute("data-xg", "1");
      var forte = ferramenta.querySelector("strong");
      if (forte) forte.innerHTML = ICONES_MODO[modo];
      /* o data-action fica (e por ele que se le o modo atual); o clique
         para aqui, antes de chegar ao ouvinte do site que abriria a gaveta */
      ferramenta.addEventListener("click", function (e) {
        e.stopPropagation();
        popup(doc, mapa, "xg-popup-modo", [
          { icone: ICONES_MODO.lote, texto: "Limite do mapa", acao: "choose-lote", marcado: modo === "lote" },
          { icone: ICONES_MODO.obstaculo, texto: "Obstáculos", acao: "choose-obstaculo", marcado: modo === "obstaculo" },
          { icone: ICONES_MODO.zona, texto: "Zona sem pulverização", acao: "choose-zona", marcado: modo === "zona" },
          { icone: ICONES_MODO.marcador, texto: "Marcador", acao: "choose-marcador", marcado: modo === "marcador" },
          { icone: ICONES_MODO.ponto, texto: "Ponto de operação", acao: "choose-ponto", marcado: modo === "ponto" },
        ]);
      });
    }

    /* titulo: "Mapeamento de lote unico ▾" abre a escolha do tipo */
    var titulo = mapa.querySelector(".portrait-edit-top strong");
    if (titulo && !titulo.getAttribute("data-xg")) {
      titulo.setAttribute("data-xg", "1");
      titulo.style.cursor = "pointer";
      titulo.addEventListener("click", function () {
        /* multi-lote pelo xag_mapeamento.js (relatorio "criar mapa", 05/10) */
        var M = doc.defaultView.XAG_MAPEAMENTO, multi = !!(M && M.ehMulti());
        popup(doc, mapa, "xg-popup-tipo", [
          { icone: ICONES_MODO.unico, texto: "Mapeamento de lote único", marcado: !multi, multi: false },
          { icone: ICONES_MODO.multi, texto: "Mapeamento multi-lote", marcado: multi, multi: true,
            recado: M ? "" : "No treino o talhão é um só: mapeamento de lote único." },
        ], function (it) { if (M) M.multi(it.multi); });
        var p = mapa.querySelector("#xg-popup-tipo");
        if (p) p.classList.add("xg-popup--alto");
      });
    }

    /* o quadrado de opcoes da ferramenta (poligono/circulo, ponto/linha) */
    var opcoes = mapa.querySelector(".portrait-shape");
    if (opcoes) opcoes.style.display = "none";
    var quadrado = mapa.querySelector(".xg-quadrado");
    if (modo === "obstaculo" || modo === "marcador") {
      var circulo = modo === "obstaculo" && /selected/.test((mapa.querySelector('[data-action="obstacle-circle"]') || {}).className || "");
      var estadoM = doc.defaultView.XAG_MAPEAMENTO && doc.defaultView.XAG_MAPEAMENTO.estado();
      var iconeQ = modo === "obstaculo" ? (circulo ? ICONES_MODO.circulo : ICONES_MODO.poligono)
                 : (estadoM && estadoM.marca === "linha" ? ICONES_MODO.linha : ICONES_MODO.marcador);
      if (!quadrado) {
        quadrado = doc.createElement("button");
        quadrado.type = "button";
        quadrado.className = "xg-quadrado";
        mapa.appendChild(quadrado);
        quadrado.addEventListener("click", function () {
          if (modoAtual(mapa) === "obstaculo") {
            var c = /selected/.test((mapa.querySelector('[data-action="obstacle-circle"]') || {}).className || "");
            popup(doc, mapa, "xg-popup-forma", [
              { icone: ICONES_MODO.poligono, texto: "Polígono", acao: "obstacle-polygon", marcado: !c },
              { icone: ICONES_MODO.circulo, texto: "Círculo", acao: "obstacle-circle", marcado: c },
            ]);
          } else {
            /* ponto ou linha de marcacao, nas tres cores (xag_mapeamento.js) */
            var M = doc.defaultView.XAG_MAPEAMENTO, e = M && M.estado() || { marca: "ponto", cor: "roxo" };
            popup(doc, mapa, "xg-popup-marca", [
              { icone: '<i class="xg-cores">' + [["roxo", "#a34be0"], ["verde", "#14b5a5"], ["laranja", "#f26b1d"]].map(function (c) {
                  return '<b data-xg-cor="' + c[0] + '" style="background:' + c[1] + (e.cor === c[0] ? ';box-shadow:0 0 0 2px #fff,0 0 0 4px ' + c[1] : '') + '"></b>'; }).join("") + "</i>", texto: "", cores: true },
              { icone: ICONES_MODO.marcador, texto: "Ponto de marcação", marcado: e.marca !== "linha", marca: "ponto" },
              { icone: ICONES_MODO.linha, texto: "Linha de marcação", marcado: e.marca === "linha", marca: "linha",
                recado: M ? "" : "Linha de marcação: toque dois pontos no mapa." },
            ], function (it) { if (M && it.marca) M.marca(it.marca); });
            var caixaCores = mapa.querySelector("#xg-popup-marca .xg-cores");
            if (caixaCores && M) caixaCores.addEventListener("click", function (ev) {
              var b = ev.target.closest("[data-xg-cor]");
              ev.stopPropagation();
              if (b) { mapa.querySelectorAll(".xg-popup").forEach(function (p) { p.remove(); }); M.cor(b.getAttribute("data-xg-cor")); }
            });
          }
        });
      }
      quadrado.innerHTML = iconeQ;

      /* circulo: mira no meio e o botao vermelho que marca ali */
      var painel = mapa.querySelector(".xg-painel-circulo");
      if (circulo) {
        if (!painel) {
          painel = doc.createElement("div");
          painel.className = "xg-painel-circulo";
          painel.innerHTML = '<button type="button" aria-label="Marcar obstáculo na mira"></button>';
          mapa.appendChild(painel);
          var mira = doc.createElement("i");
          mira.className = "xg-mira";
          mira.innerHTML = ICONES_MODO.mira;
          mapa.appendChild(mira);
          painel.querySelector("button").addEventListener("click", function () {
            var svgMapa = mapa.querySelector(".map-svg");
            if (!svgMapa) return;
            var r = svgMapa.getBoundingClientRect();
            var ev = new doc.defaultView.PointerEvent("pointerup", {
              bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1 });
            svgMapa.dispatchEvent(ev);
          });
        }
      } else if (painel) { painel.remove(); tirarMira(mapa); }
    } else if (quadrado) {
      quadrado.remove();
      var pc = mapa.querySelector(".xg-painel-circulo");
      if (pc) pc.remove();
      tirarMira(mapa);
    }

    /* contagem do que ja foi marcado */
    var nObs = (s.obstacles || []).length + (s.obstaclePolygons || []).length;
    var nZon = (s.zones || []).length;
    var nMar = (s.markers || []).length;
    var contagem = mapa.querySelector(".xg-contagem");
    var textoC = (nObs ? '<span>' + ICONES_MODO.obstaculo + nObs + "</span>" : "") +
                 (nZon ? '<span>' + ICONES_MODO.zona + nZon + "</span>" : "") +
                 (nMar ? '<span>' + ICONES_MODO.marcador + nMar + "</span>" : "");
    if (textoC) {
      if (!contagem) { contagem = doc.createElement("div"); contagem.className = "xg-contagem"; mapa.appendChild(contagem); }
      if (contagem.innerHTML !== textoC) contagem.innerHTML = textoC;
    } else if (contagem) contagem.remove();

    /* medidas dos lados: metros pelo vinculo (a mesma conta do campo) */
    medidas(doc, mapa, s, modo);
  }

  function tirarMira(mapa) {
    var m = mapa.querySelector(".xg-mira");
    if (m) m.remove();
  }

  function medidas(doc, mapa, s, modo) {
    var v = window.TELAS_XAG.vinculo;
    var svgMapa = mapa.querySelector(".map-svg");
    var caixa = mapa.querySelector(".xg-medidas");
    if (!v || !v.foto || !svgMapa) { if (caixa) caixa.remove(); return; }
    if (!caixa) { caixa = doc.createElement("div"); caixa.className = "xg-medidas"; mapa.appendChild(caixa); }

    var r = svgMapa.getBoundingClientRect(), rm = mapa.getBoundingClientRect();
    var linhas = [];
    function lados(pts, fechado) {
      var n = fechado ? pts.length : pts.length - 1;
      for (var i = 0; i < n; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        var ma = v.paraMetros(a[0], a[1]), mb = v.paraMetros(b[0], b[1]);
        var m = Math.hypot(mb[0] - ma[0], mb[1] - ma[1]);
        var ax = r.left - rm.left + a[0] / 100 * r.width, ay = r.top - rm.top + a[1] / 100 * r.height;
        var bx = r.left - rm.left + b[0] / 100 * r.width, by = r.top - rm.top + b[1] / 100 * r.height;
        var ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
        if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
        linhas.push('<span style="left:' + ((ax + bx) / 2).toFixed(1) + 'px;top:' + ((ay + by) / 2).toFixed(1) +
                    'px;transform:translate(-50%,-130%) rotate(' + ang.toFixed(1) + 'deg)">' + m.toFixed(1) + "m</span>");
      }
    }
    if ((s.points || []).length >= 2) lados(s.points, s.lotClosed || s.points.length >= 3);
    if (modo !== "lote" && (s.draftShape || []).length >= 2) lados(s.draftShape, false);
    var html = linhas.join("");
    if (caixa.getAttribute("data-html") !== html) { caixa.innerHTML = html; caixa.setAttribute("data-html", html); }
  }

  var ESTILO_MAPEAMENTO = [
    ".xg-popup{position:absolute;z-index:14;left:4cqw;bottom:22cqw;min-width:44cqw;background:#fff;border-radius:2.6cqw;",
    " box-shadow:0 1cqw 3cqw #0004;padding:1cqw 0;overflow:hidden}",
    ".xg-popup--alto{left:auto;right:22cqw;top:16cqw;bottom:auto}",
    "#xg-popup-forma,#xg-popup-marca{bottom:33cqw}",
    ".xg-popup button{display:flex;align-items:center;gap:2.6cqw;width:100%;border:0;background:none;padding:2.8cqw 3.4cqw;",
    " font:inherit;font-size:3.7cqw;color:#15191c;text-align:left;cursor:pointer}",
    ".xg-popup button+button{border-top:1px solid #edeef0}",
    ".xg-popup button svg{width:5.4cqw;height:5.4cqw;flex:none}",
    ".xg-popup button span{flex:1}",
    ".xg-popup button>svg:last-child{width:4.8cqw;height:4.8cqw}",
    ".xg-cores{display:flex;gap:4cqw;padding:0 1cqw}",
    ".xg-cores b{width:5cqw;height:5cqw;border-radius:50%;box-shadow:0 0 0 .8cqw #fff,0 0 0 1.2cqw #d9dbde}",
    ".xg-quadrado{position:absolute;z-index:9;left:4cqw;bottom:20cqw;width:11cqw;height:11cqw;border:0;border-radius:2cqw;",
    " background:#fff;display:grid;place-items:center;box-shadow:0 .4cqw 1.4cqw #0003;cursor:pointer}",
    ".xg-quadrado svg{width:6cqw;height:6cqw}",
    ".xg-contagem{position:absolute;z-index:9;left:50%;bottom:16.4cqw;transform:translateX(-50%);display:flex;gap:2.4cqw;",
    " color:#fff;font-size:3.4cqw;font-weight:600;text-shadow:0 1px 3px #000c;pointer-events:none}",
    ".xg-contagem span{display:flex;align-items:center;gap:.6cqw}",
    ".xg-contagem svg{width:4.4cqw;height:4.4cqw}",
    ".xg-medidas{position:absolute;inset:0;z-index:3;pointer-events:none}",
    ".xg-medidas span{position:absolute;color:#fff;font-size:2.7cqw;font-weight:600;text-shadow:0 1px 2px #000,0 0 3px #000;white-space:nowrap}",
    ".xg-painel-circulo{position:absolute;z-index:9;left:4cqw;right:4cqw;bottom:3cqw;height:19cqw;background:#fff;border-radius:2.6cqw;",
    " display:grid;place-items:center;box-shadow:0 .4cqw 1.4cqw #0003}",
    ".xg-painel-circulo button{width:12cqw;height:12cqw;border-radius:50%;border:0;background:#f0413f;cursor:pointer;",
    " background-image:" + "url(\"data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8">' +
      '<circle cx="12" cy="12" r="3.5"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/></svg>') + "\");",
    " background-size:55%;background-position:center;background-repeat:no-repeat}",
    ".xg-mira{position:absolute;z-index:8;left:50%;top:44%;transform:translate(-50%,-50%);color:#fff;filter:drop-shadow(0 1px 2px #000);pointer-events:none}",
    ".xg-mira svg{width:6cqw;height:6cqw}",
    ".remote.handheld .portrait-edit .map-bottom{transition:none}",
    ".remote.handheld .xg-com-circulo .map-bottom{bottom:24cqw!important}",
    ".remote.handheld .xg-com-circulo .xg-quadrado{bottom:41cqw}",
    ".remote.handheld .xg-com-circulo .xg-contagem{bottom:37.4cqw}",
    ".remote.handheld .xg-com-circulo .xg-metodos{bottom:41cqw}",
  ].join("");

  /* ------------------------------------------------------- Camadas do mapa

     Pelos 2 prints: abre pela metade e da para PUXAR para cima ate a tela
     inteira. Conteudo: Meu mapa (mapa HD ✓, Mapa ✓), "Mostrar rotas de voo
     historicas > Mostrar apenas fa...", "Mostrar area de mapa" (chave), "Show
     restricted flying zone" (chave ligada) com No-Fly Zone e Enhanced Warning
     Zone, "Mapa de satelite > Mapa personalizado" e o botao de limpar cache. */
  function chave(ligada) {
    return '<i class="xg-chave' + (ligada ? " xg-chave--on" : "") + '"><b></b></i>';
  }
  function telaCamadas(doc, gaveta, mapa) {
    if (gaveta.getAttribute("data-xg")) return;
    gaveta.setAttribute("data-xg", "1");
    gaveta.classList.add("xg-camadas");
    gaveta.innerHTML =
      '<div class="xg-alca"></div>' +
      '<div class="xg-cabeca"><h3>Camadas do mapa</h3><button class="x" data-action="close-sheet" aria-label="Fechar">' +
      svg('<path d="M7 7l10 10M17 7L7 17"/>') + "</button></div>" +
      '<div class="xg-bloco"><p>Meu mapa</p><div class="xg-ladrilhos">' +
      '<button type="button" class="xg-ladrilho xg-ladrilho--hd xg-marcado"><span>mapa HD</span></button>' +
      '<button type="button" class="xg-ladrilho xg-ladrilho--mapa xg-marcado"><span>Mapa</span></button></div></div>' +
      '<div class="xg-bloco">' +
      '<button type="button" class="xg-opcao"><span>Mostrar rotas de voo hi…</span><small>Mostrar apenas fa…</small>' + SETA + "</button>" +
      '<button type="button" class="xg-opcao" data-chave="area"><span>Mostrar área de mapa</span>' + chave(false) + "</button>" +
      '<button type="button" class="xg-opcao" data-chave="zona"><span>Show restricted flying zone ' +
      svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>') + "</span>" + chave(true) + "</button>" +
      '<div class="xg-ladrilhos xg-ladrilhos--zonas">' +
      '<button type="button" class="xg-ladrilho xg-ladrilho--nofly xg-marcado"><span>No-Fly Zone</span></button>' +
      '<button type="button" class="xg-ladrilho xg-ladrilho--aviso xg-marcado"><span>Enhanced Warning Z…</span></button></div></div>' +
      '<div class="xg-bloco"><button type="button" class="xg-opcao"><span>Mapa de satélite</span><small>Mapa personalizado</small>' + SETA + "</button></div>" +
      '<button type="button" class="xg-limpar">' + svg('<path d="M5 17l7-7 5 5-3 3H8z"/><path d="M10 8l4-4 6 6-3 3"/><path d="M4 20h16"/>') +
      "Limpe o cache e atualize as imagens HD</button>";

    gaveta.querySelectorAll(".xg-ladrilho").forEach(function (b) {
      b.addEventListener("click", function () { b.classList.toggle("xg-marcado"); });
    });
    gaveta.querySelectorAll("[data-chave]").forEach(function (b) {
      b.addEventListener("click", function () { b.querySelector(".xg-chave").classList.toggle("xg-chave--on"); });
    });
    gaveta.querySelector(".xg-limpar").addEventListener("click", function () {
      dica(mapa, "Imagens HD atualizadas.");
    });

    /* puxar para cima = tela inteira; puxar para baixo = metade */
    var y0 = null;
    var alca = gaveta.querySelector(".xg-alca"), cabeca = gaveta.querySelector(".xg-cabeca");
    [alca, cabeca].forEach(function (el) {
      el.addEventListener("pointerdown", function (e) { y0 = e.clientY; });
    });
    doc.addEventListener("pointerup", function (e) {
      if (y0 === null) return;
      var dy = e.clientY - y0; y0 = null;
      if (dy < -25) gaveta.classList.add("xg-cheia");
      else if (dy > 25) gaveta.classList.remove("xg-cheia");
    });
  }

  var ESTILO_CAMADAS = [
    ".remote.handheld .xg-camadas{height:56%!important;max-height:none!important;padding:0 4cqw 4cqw!important;background:#f3f4f6!important;",
    " border-radius:3cqw 3cqw 0 0!important;overflow:auto!important;transition:height .25s;font-family:Roboto,Inter,'Segoe UI',sans-serif}",
    ".remote.handheld .xg-camadas.xg-cheia{height:100%!important;border-radius:0!important}",
    ".remote.handheld .xg-camadas:before{display:none!important}",
    ".xg-camadas .xg-alca{width:9cqw;height:1cqw;border-radius:1cqw;background:#c9cbd0;margin:1.8cqw auto 0;cursor:grab}",
    ".xg-camadas .xg-cabeca{position:relative;height:12cqw;display:flex;align-items:center;justify-content:center;cursor:grab}",
    ".xg-camadas .xg-cabeca h3{margin:0;font-size:4.4cqw;font-weight:600}",
    ".xg-camadas .xg-cabeca .x{position:absolute;right:0;width:7cqw;height:7cqw;border-radius:50%;border:0;background:#e3e5e8;color:#4a5055;",
    " display:grid;place-items:center;padding:0}",
    ".xg-camadas .xg-cabeca .x svg{width:4cqw;height:4cqw}",
    ".xg-camadas .xg-bloco{background:#fff;border-radius:2.6cqw;padding:0 4cqw;margin-bottom:3cqw}",
    ".xg-camadas .xg-bloco p{margin:0;padding:3.6cqw 0 0;font-size:3.9cqw}",
    ".xg-ladrilhos{display:flex;gap:4cqw;padding:3.4cqw 0 3.6cqw}",
    ".xg-ladrilho{width:22cqw;height:22cqw;border:.6cqw solid transparent;border-radius:2.4cqw;padding:0;position:relative;cursor:pointer;",
    " background-size:cover;background-position:center;display:flex;align-items:flex-end;justify-content:center}",
    ".xg-ladrilho span{position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:3.2cqw;color:#6f757a;margin-top:1.2cqw}",
    ".xg-ladrilho.xg-marcado{border-color:#17b36b}",
    ".xg-ladrilho.xg-marcado span{color:#17b36b}",
    ".xg-ladrilho.xg-marcado:after{content:'';position:absolute;right:-.6cqw;bottom:-.6cqw;width:5cqw;height:5cqw;background:#17b36b;",
    " border-radius:2cqw 0 1.8cqw 0;background-image:url(\"data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M6 12.5l4 4L18 8"/></svg>') +
    "\");background-size:70%;background-position:center;background-repeat:no-repeat}",
    ".xg-ladrilhos{padding-bottom:8cqw}",
    ".xg-ladrilho--hd{background-image:linear-gradient(115deg,#c9d640 0 42%,#4a4d3a 42% 50%,#b9c930 50%)}",
    ".xg-ladrilho--mapa{background-image:linear-gradient(#5ea83c,#4c9a32);}",
    ".xg-ladrilho--mapa:before{content:'';position:absolute;inset:18%;background:linear-gradient(90deg,#bfe6d6 0 48%,transparent 48% 52%,#bfe6d6 52%);",
    " clip-path:polygon(0 0,100% 0,100% 100%,0 100%);border:.6cqw solid #fff;border-radius:1cqw}",
    ".xg-ladrilho--nofly{background-image:radial-gradient(circle,#ff3b3b 0 22%,#ff3b3b88 40%,transparent 41%),linear-gradient(#8f7a5a,#6d5a40)}",
    ".xg-ladrilho--aviso{background-image:radial-gradient(circle,#ffb300 0 22%,#ffb30088 40%,transparent 41%),linear-gradient(#8f7a5a,#6d5a40)}",
    ".xg-opcao{display:flex;align-items:center;gap:2cqw;width:100%;min-height:14cqw;border:0;background:none;padding:0;font:inherit;",
    " font-size:3.9cqw;color:#15191c;text-align:left;cursor:pointer;border-bottom:1px solid #eceef0}",
    ".xg-opcao:last-child{border-bottom:0}",
    ".xg-opcao>span{flex:1;display:flex;align-items:center;gap:1.6cqw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".xg-opcao>span svg{width:4.6cqw;height:4.6cqw;flex:none}",
    ".xg-opcao small{font-size:3.7cqw;color:#8a9095;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40%}",
    ".xg-chave{width:10cqw;height:5.6cqw;border-radius:3cqw;background:#d5d7db;position:relative;flex:none;transition:background .2s}",
    ".xg-chave b{position:absolute;top:.6cqw;left:.6cqw;width:4.4cqw;height:4.4cqw;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 .3cqw .6cqw #0003}",
    ".xg-chave--on{background:#17b36b}",
    ".xg-chave--on b{left:5cqw}",
    ".xg-limpar{display:flex;align-items:center;gap:2cqw;margin:3cqw auto 0;border:0;border-radius:2cqw;background:#e6e8eb;color:#17b36b;",
    " font:inherit;font-size:3.7cqw;padding:2.6cqw 4cqw;cursor:pointer;text-align:left}",
    ".xg-limpar svg{width:5.4cqw;height:5.4cqw;flex:none}",
  ].join("");

  /* ---------------------------------------------- Operacao (drone desligado)

     Pelo print: a tela de Operacao e o MAPA (XAG no canto, coluna da
     direita), a dica "Por favor clique na lote de terreno ou decole com
     controle remoto", o cartao "P60H 2024 >" com camera e parada de
     emergencia e a linha sinal / RTK / tanque -- / bico -- / altura 0.0m, e
     os botoes "mais" e "Centro Rapido". O site abre uma pagina branca com
     abas: ela fica escondida e volta quando o aluno toca no talhao. */
  function telaOperacao(doc, vista, mapa0) {
    if (vista.querySelector(".xg-op")) return;
    var v = window.TELAS_XAG.vinculo;
    var foto = v && v.foto ? v.foto.imagem : "";
    var s = salvoDoApp(doc) || {};
    var pts = (s.points || []).length >= 3 ? s.points.map(function (p) { return p.join(","); }).join(" ") : "";
    var op = doc.createElement("div");
    op.className = "xg-op map";
    op.innerHTML =
      '<div class="xg-op-foto" style="background-image:url(\'' + foto + '\')"></div>' +
      /* class map-svg: o aparelho_xag.js desenha aqui a rota real, a aeronave e o H */
      '<svg class="xg-op-svg map-svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
      (pts ? '<polygon class="xg-op-talhao" points="' + pts + '" fill="#ffffff2e" stroke="#fff" stroke-width=".5" vector-effect="non-scaling-stroke"/>' : "") +
      "</svg>" +
      '<button type="button" class="logo xg-op-logo" data-action="operation-back">X<b>A</b>G</button>' +
      '<div class="xg-op-dica">Por favor clique na lote de terreno ou decole com controle remoto</div>' +
      '<div class="xg-op-cartao"><div class="xg-op-linha1"><span class="xg-op-foto-drone"></span><b>' + NOME_XAG + '</b>' + SETA +
      '<span class="xg-op-icones"><i>' + svg('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-2.5v7L16 13z"/>') + "</i>" +
      '<i class="xg-op-parada">' + svg('<path d="M9 12V6a1.5 1.5 0 0 1 3 0v5"/><path d="M12 10.5a1.5 1.5 0 0 1 3 0V12"/><path d="M15 11.5a1.5 1.5 0 0 1 3 .5v3c0 3.3-2.4 6-5.6 6h-.8c-1.8 0-3-.7-4-2.1L4.4 15a1.5 1.5 0 0 1 2.3-1.9l2.3 2.2"/>') + "</i></span></div>" +
      '<div class="xg-op-linha2">' +
      svg('<path d="M4 18h2v-3H4zM8.5 18h2v-6h-2zM13 18h2v-9h-2zM17.5 18h2V6h-2z" fill="currentColor"/>', ' stroke="none"') +
      '<em>' + seloPosXag() + '</em>' +
      svg('<path d="M7 20V9l5-3 5 3v11z"/><path d="M9 9.5v9M15 9.5v9"/>') + "<span>--</span>" +
      svg('<path d="M4 10h16M6 10v4h12v-4M9 14v5M15 14v5"/>') + "<span>--</span>" +
      svg('<path d="M12 4v16M6 20h12M8 8l4-4 4 4"/>') + "<span>0.0m</span></div></div>" +
      '<div class="xg-op-botoes"><button type="button" class="xg-op-mais"><i>···</i>mais</button>' +
      '<button type="button" class="xg-op-centro"><i>⌘</i>Centro Rápido</button></div>';
    vista.appendChild(op);
    op.appendChild(colunaDoMapa(doc));
    vista.classList.add("xg-vista-op");

    /* com o drone ligado (foto dele de 26/09): linha verde de RTK sob o
       logo, cartao com o icone verde de conexao, bateria e calda de verdade,
       e embaixo "mais" + botao do meio + "Comecar" - que so fica verde
       depois de o aluno tocar no talhao para escolher o mapa */
    op.insertAdjacentHTML("beforeend",
      '<div class="xg-op-rtk">● RTK fixo com base de solo</div>' +
      '<div class="xg-op-botoes xg-op-botoes--ligado"><button type="button" class="xg-op-mais2"><i>···</i>mais</button>' +
      '<button type="button" class="xg-op-meio" disabled></button>' +
      '<button type="button" class="xg-op-comecar" disabled>' + svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>') + "Começar</button></div>");

    function seguirParaOPreparo() { vista.classList.remove("xg-vista-op"); op.remove(); }

    /* tocar no talhao: com o drone desligado segue para o preparo do site;
       ligado, escolhe o mapa e libera o Comecar */
    var talhao = op.querySelector(".xg-op-talhao");
    if (talhao) talhao.addEventListener("click", function () {
      if (op.classList.contains("xg-op--ligado")) { op.classList.add("xg-op--selecionado"); atualizarOperacao(doc, op); }
      else seguirParaOPreparo();
    });
    op.querySelector(".xg-op-svg").addEventListener("click", function (e) {
      if (e.target === talhao) return;
      dica(op, "Toque dentro do talhão para escolher o mapa.");
    });
    op.querySelector(".xg-op-comecar").addEventListener("click", function () { abrirConfiguracoes(doc, op, seguirParaOPreparo); });
    op.querySelectorAll(".xg-op-mais,.xg-op-mais2").forEach(function (b) {
      b.addEventListener("click", function () { dica(op, "Mais: registro, pouso e ajustes da aeronave."); });
    });
    op.querySelector(".xg-op-centro").addEventListener("click", function () {
      dica(op, "Ligue o controle para conectar a aeronave.");
    });
    atualizarOperacao(doc, op);
  }

  /* Depois do Comecar (foto dele de 26/09): a rota aparece no mapa, a dica
     vira "Please confirm the access route and safety point positions..." e
     sobe a janela Base | avancado com Configuracoes de pulverizacao, Rota de
     operacao (altura e velocidade, folga de seguranca) e Rota de aproximacao.
     Os valores sao os que o aluno guardou no app. O botao do fim leva ao
     preparo do site, que e quem decola a aeronave. */
  function abrirConfiguracoes(doc, op, aoIniciar) {
    if (op.querySelector(".xg-op-conf")) return;
    var s = salvoDoApp(doc) || {};
    var dose = (Number(s.opVolume) || 0).toFixed(2) + "L/ha", gota = (Number(s.opDroplet) || 100) + "μm";
    var alt = (Number(s.opHeight) || 0).toFixed(1) + "m", vel = ((Number(s.opSpeed) || 0) * 3.6).toFixed(1) + "km/h";
    var folga = "obstáculo" + (Number(s.obstacleSafety) || 3).toFixed(1) + "m";
    var hoje = new Date(), rota = (hoje.getMonth() + 1 < 10 ? "0" : "") + (hoje.getMonth() + 1) + "-" + (hoje.getDate() < 10 ? "0" : "") + hoje.getDate() + " Rota local";
    function linha(rotulo, valor, seta) {
      return '<button type="button" class="xg-conf-linha"><span>' + rotulo + "</span><em>" + valor + "</em>" + (seta === false ? "" : SETA) + "</button>";
    }
    var conf = doc.createElement("div");
    conf.className = "xg-op-conf";
    conf.innerHTML =
      '<div class="xg-conf-abas"><span class="xg-conf-aba xg-conf-aba--ativa">Base</span><span class="xg-conf-aba">avançado</span>' +
      '<button type="button" class="xg-conf-x" aria-label="Fechar">' + svg('<path d="M7 7l10 10M17 7L7 17"/>') + "</button></div>" +
      '<div class="xg-conf-modelo"><span>Modelo:Não usado ⌄</span><b>Salvar como modelo</b></div>' +
      '<div class="xg-conf-rolagem">' +
      '<h4><i class="xg-conf-icone" style="background:#e5484d">' + svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" fill="#fff"/>', ' stroke="none"') + "</i>Configurações de pulverização</h4>" +
      linha("Dosagem e atomização", dose + "，" + gota) +
      '<h4><i class="xg-conf-icone" style="background:#2f7fe0">' + svg('<path d="M4 6l16 6-16 6z" fill="#fff"/>', ' stroke="none"') + "</i>Rota de operação<em>" + rota + " ⌄</em></h4>" +
      linha("altura e velocidade", alt + "，" + vel) +
      linha("Folga de segurança", folga) +
      '<h4><i class="xg-conf-icone" style="background:#a34be0">' + svg('<path d="M4 18l6-10 4 6 2-3 4 7z" fill="#fff"/>', ' stroke="none"') + "</i>Rota de aproximação</h4>" +
      linha("Ponto de entrada e saída", s.opEntry && s.opExit ? "marcados" : "não marcados") +
      linha("Ao terminar", s.opReturn || "Retornar ao ponto de decolagem") + "</div>";
    op.appendChild(conf);
    op.classList.add("xg-op--conf");
    var dicaEl = op.querySelector(".xg-op-dica");
    dicaEl.textContent = "Confirme a rota de acesso e as posições dos pontos de segurança. Confira se não há obstáculos a menos de 5,0 m do ponto de segurança.";
    dicaEl.setAttribute("data-fixa", "1");

    /* o X fecha a janela e deixa a tela pronta para "Iniciar operacao" */
    conf.querySelector(".xg-conf-x").addEventListener("click", function () {
      conf.remove(); op.classList.remove("xg-op--conf"); dicaEl.removeAttribute("data-fixa");
      prontaParaIniciar(doc, op, aoIniciar);
    });
    conf.querySelectorAll(".xg-conf-linha").forEach(function (b) {
      b.addEventListener("click", function () { dica(op, "Esses valores se ajustam no preparo da operação (Iniciar operação)."); });
    });
    conf.querySelectorAll(".xg-conf-aba")[1].addEventListener("click", function () { dica(op, "Avançado: ajustes finos da aeronave, no preparo."); });
    conf.querySelector(".xg-conf-modelo b").addEventListener("click", function () { dica(op, "Modelo salvo: use-o nas próximas operações."); });
  }

  /* Tela pronta para decolar (foto dele): rota e aeronave no mapa, bloco
     "P60H 2024 / SN" no alto, faixa "estime X Hectare / Parametros
     operacionais", o cartao e os botoes Cancela / Operacao Configurar /
     Iniciar operacao (verde). */
  function prontaParaIniciar(doc, op, aoIniciar) {
    if (op.querySelector(".xg-op-pronta")) return;
    var v = window.TELAS_XAG.vinculo;
    var s = salvoDoApp(doc) || {};
    var ha = 0;
    try {
      if (v && v.paraMetros && v.areaHectares && (s.points || []).length >= 3) {
        ha = v.areaHectares(s.points.map(function (p) { return v.paraMetros(p[0], p[1]); }));
      }
    } catch (e) { ha = 0; }
    var alt = (Number(s.opHeight) || 0).toFixed(1).replace(".", ",") + "m", vel = (Number(s.opSpeed) || 0).toFixed(1) + "m/s";

    op.classList.add("xg-op--pronta");
    op.insertAdjacentHTML("beforeend",
      '<div class="xg-op-pronta">' +
      '<div class="xg-op-info"><b>' + NOME_XAG + '</b><small>SN: 8219343Q0W71</small>' +
      '<span>● tanque líquido com baixa dosagem</span></div>' +
      '<div class="xg-op-estimativa"><div><span>estime</span><b>' + ha.toFixed(1) + "Hectare</b></div>" +
      "<div><span>Parâmetros operacionais</span><b>" + alt + "， " + vel + "</b></div></div>" +
      '<div class="xg-op-botoes xg-op-botoes--pronta">' +
      '<button type="button" class="xg-op-cancela"><i>×</i>Cancela</button>' +
      '<button type="button" class="xg-op-configurar"><span>Operação</span><i>⚙</i>Configurar</button>' +
      '<button type="button" class="xg-op-iniciar">' + svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>') + "Iniciar operação</button></div></div>");
    var bloco = op.querySelector(".xg-op-pronta");
    bloco.querySelector(".xg-op-cancela").addEventListener("click", function () {
      bloco.remove(); op.classList.remove("xg-op--pronta"); atualizarOperacao(doc, op);
    });
    bloco.querySelector(".xg-op-configurar").addEventListener("click", function () {
      bloco.remove(); op.classList.remove("xg-op--pronta"); abrirConfiguracoes(doc, op, aoIniciar);
    });
    bloco.querySelector(".xg-op-iniciar").addEventListener("click", function () { modalIniciar(doc, op); });
  }

  /* "Iniciar operacao": desenho da aeronave, duas caixas e o arrastar.
     Arrastou: "Carregando rota..." 0-100% (menos de 1 s), depois 3, 2, 1
     "Iniciar contagem regressiva...", cada um com "Abortar decolagem". No 0
     a aeronave decola no campo, pelo mesmo caminho do Iniciar do site. */
  function modalIniciar(doc, op) {
    if (op.querySelector(".xg-modal")) return;
    var modal = doc.createElement("div");
    modal.className = "xg-modal";
    modal.innerHTML =
      '<div class="xg-modal-cabeca"><h3>Iniciar operação</h3><button type="button" class="xg-modal-x" aria-label="Fechar">' +
      svg('<path d="M7 7l10 10M17 7L7 17"/>') + "</button></div>" +
      '<div class="xg-modal-drone">' +
      svg('<g stroke="#3bc9a0" stroke-width="1.2" fill="#c9f0e4"><path d="M4 4l6.5 6.5-1 1L3 5z"/><path d="M20 4l-6.5 6.5 1 1L21 5z"/>' +
          '<path d="M4 20l6.5-6.5-1-1L3 19z"/><path d="M20 20l-6.5-6.5 1-1L21 19z"/></g>' +
          '<g stroke="#3bc9a0" fill="none" stroke-width="1"><circle cx="3.5" cy="4.5" r="1.4"/><circle cx="20.5" cy="4.5" r="1.4"/>' +
          '<circle cx="3.5" cy="19.5" r="1.4"/><circle cx="20.5" cy="19.5" r="1.4"/></g>' +
          '<g stroke="#c8cdd1" fill="none" stroke-width=".8"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M10 7.5h4M12 6v1.5M9 17h6"/></g>', ' stroke="none"') + "</div>" +
      '<label class="xg-modal-caixa"><span>As hélices estão orientadas e acionadas corretamente</span><input type="checkbox"><i></i></label>' +
      '<label class="xg-modal-caixa"><span>Estou a mais de 10,0m do drone e a zona de voo está livre</span><input type="checkbox"><i></i></label>' +
      '<div class="xg-modal-arrastar"><div class="xg-modal-pino">' +
      svg('<path d="M4 15l16-3-3 3M20 12l-3-3"/><path d="M4 19h16"/>') + "</div><span>›</span></div>";
    op.appendChild(modal);
    modal.querySelector(".xg-modal-x").addEventListener("click", function () { modal.remove(); });

    var trilho = modal.querySelector(".xg-modal-arrastar"), pino = modal.querySelector(".xg-modal-pino");
    var x0 = null;
    pino.addEventListener("pointerdown", function (e) {
      x0 = e.clientX; try { pino.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
    });
    pino.addEventListener("pointermove", function (e) {
      if (x0 === null) return;
      var max = trilho.clientWidth - pino.offsetWidth;
      pino.style.transform = "translateX(" + Math.max(0, Math.min(max, e.clientX - x0)) + "px)";
    });
    function soltar(e) {
      if (x0 === null) return;
      var max = trilho.clientWidth - pino.offsetWidth;
      var foi = (e.clientX - x0) > max * 0.65;
      x0 = null;
      pino.style.transform = "";
      if (!foi) return;
      var caixas = modal.querySelectorAll('input[type="checkbox"]');
      if (!caixas[0].checked || !caixas[1].checked) { dica(op, "Marque as duas caixas antes de deslizar."); return; }
      decolagem(doc, op, modal);
    }
    pino.addEventListener("pointerup", soltar);
    pino.addEventListener("pointercancel", function () { x0 = null; pino.style.transform = ""; });
  }

  function decolagem(doc, op, modal) {
    var J = doc.defaultView;
    var abortado = false;
    modal.innerHTML =
      '<div class="xg-modal-anel"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="#e6e8eb" stroke-width="6"/>' +
      '<circle class="xg-anel" cx="50" cy="50" r="42" fill="none" stroke="#2fb47c" stroke-width="6" stroke-linecap="round" ' +
      'stroke-dasharray="264" stroke-dashoffset="264" transform="rotate(-90 50 50)"/></svg><b>0%</b></div>' +
      '<p class="xg-modal-texto">Carregando rota ...</p>' +
      '<button type="button" class="xg-modal-abortar">Abortar decolagem</button>';
    var anel = modal.querySelector(".xg-anel"), numero = modal.querySelector("b"), texto = modal.querySelector(".xg-modal-texto");
    modal.querySelector(".xg-modal-abortar").addEventListener("click", function () { abortado = true; modal.remove(); });

    var agoraPausa = function () { return window.PAUSA_SIM ? PAUSA_SIM.agora() : J.performance.now(); };
    var inicio = agoraPausa();
    function carregar(t) {
      if (abortado) return;
      if (window.PAUSA_SIM && PAUSA_SIM.pausado) {
        J.setTimeout(function () { carregar(agoraPausa()); }, 40); return;
      }
      var p = Math.min(1, (t - inicio) / 800);
      anel.setAttribute("stroke-dashoffset", (264 * (1 - p)).toFixed(1));
      numero.textContent = Math.round(p * 100) + "%";
      /* setTimeout e nao requestAnimationFrame: com a aba escondida o rAF
         para e a decolagem ficaria presa no carregando */
      if (p < 1) J.setTimeout(function () { carregar(agoraPausa()); }, 40); else contar(3);
    }
    function contar(n) {
      if (abortado) return;
      if (window.PAUSA_SIM && PAUSA_SIM.pausado) { J.setTimeout(function () { contar(n); }, 100); return; }
      if (n === 0) { modal.remove(); decolarNoCampo(doc, op); return; }
      texto.textContent = "Iniciar contagem regressiva...";
      numero.textContent = String(n);
      anel.setAttribute("stroke-dashoffset", (264 * (1 - n / 3)).toFixed(1));
      J.setTimeout(function () { contar(n - 1); }, 1000);
    }
    carregar(inicio);
  }

  /* O mesmo caminho do "Iniciar" do site: o vinculo le `opRunning` do que
     esta salvo e decola com os parametros do app. */
  function decolarNoCampo(doc, op) {
    var v = window.TELAS_XAG.vinculo;
    if (!v || !v.decolar) { dica(op, "O campo não respondeu; tente de novo."); return; }
    try {
      var ls = doc.defaultView.localStorage;
      var m = JSON.parse(ls.getItem("guri-map-demo") || "{}");
      m.opRunning = true;
      ls.setItem("guri-map-demo", JSON.stringify(m));
    } catch (e) { /* sem localStorage: o decolar avisa */ }
    v.decolar();
    var bloco = op.querySelector(".xg-op-pronta");
    if (bloco) bloco.remove();
    op.classList.remove("xg-op--pronta");
    op.classList.add("xg-op--voando");
  }

  /* Chamado a cada ciclo com a tela de operacao aberta: liga/desliga e os
     numeros da aeronave (bateria e calda do campo). */
  function atualizarOperacao(doc, op) {
    var remoto = doc.getElementById("remote");
    var ligado = !!(remoto && remoto.classList.contains("on"));
    op.classList.toggle("xg-op--ligado", ligado);
    if (!ligado) op.classList.remove("xg-op--selecionado");
    var selecionado = op.classList.contains("xg-op--selecionado");

    var dicaEl = op.querySelector(".xg-op-dica");
    var texto = !ligado || !selecionado
      ? "Por favor clique na lote de terreno ou decole com controle remoto"
      : "Coloque o drone no ponto limite ou acima dele e, em seguida, corrija-o para a posição do drone";
    if (!dicaEl.getAttribute("data-fixa") && dicaEl.textContent !== texto) dicaEl.textContent = texto;

    var comecar = op.querySelector(".xg-op-comecar");
    comecar.disabled = !(ligado && selecionado);

    /* numeros do campo */
    var v = window.TELAS_XAG.vinculo;
    var n = null;
    if (ligado && v && v.ponte) {
      try { n = v.ponte.ler("(typeof V!=='undefined' && V) ? {bat: V.bat, tan: V.tan} : null"); } catch (e) { n = null; }
    }
    var linha = op.querySelector(".xg-op-linha2");
    var bat = linha.querySelector(".xg-op-bat"), tan = linha.querySelector(".xg-op-tan");
    if (!bat) {
      linha.insertAdjacentHTML("beforeend",
        '<b class="xg-op-bat">' + svg('<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3"/><rect x="5" y="9" width="8" height="6" fill="currentColor" stroke="none"/>') +
        "<span></span></b><b class=\"xg-op-tan\">" + svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>') + "<span></span></b>");
      bat = linha.querySelector(".xg-op-bat"); tan = linha.querySelector(".xg-op-tan");
    }
    if (n) {
      bat.lastChild.textContent = Math.round(n.bat) + "%";
      tan.lastChild.textContent = n.tan < 1 ? "menor que 1.0L" : n.tan.toFixed(1) + "L";
      tan.classList.toggle("xg-op-tan--pouco", n.tan < 1);
    }
  }

  var ESTILO_OP = [
    ".remote.handheld .xg-vista-op{background:#eff0f2!important;padding:0!important;overflow:hidden!important}",
    ".remote.handheld .xg-vista-op>.settings-page,.remote.handheld .xg-vista-op>.status{display:none!important}",
    ".xg-op{position:absolute;inset:0;overflow:hidden;font-family:Roboto,Inter,'Segoe UI',sans-serif;background:#4b5a3f}",
    ".xg-op-foto{position:absolute;inset:0;background-size:100% 100%;background-position:center}",
    ".xg-op-svg{position:absolute;inset:0;width:100%;height:100%}",
    ".xg-op-talhao{cursor:pointer}",
    ".xg-op .xg-col{top:3cqw;right:4cqw}",
    ".xg-op-logo{position:absolute;z-index:9;top:3cqw;left:4cqw;width:11cqw;height:11cqw;border:0;border-radius:2cqw;background:#fff;",
    " color:#1c292c;font-weight:950;font-style:italic;letter-spacing:-.04em;font-size:4cqw;line-height:9.6cqw;cursor:pointer;box-shadow:0 .4cqw 1.4cqw #0003}",
    ".xg-op-logo b{color:#d72432}",
    ".xg-op-logo:after{content:'';position:absolute;left:50%;bottom:1.4cqw;transform:translateX(-50%);border:1cqw solid transparent;border-top:1.1cqw solid #1c292c;border-bottom:0}",
    ".xg-op-dica{position:absolute;z-index:9;left:4cqw;right:4cqw;bottom:41cqw;background:#9a948a52;backdrop-filter:blur(10px) brightness(.8);",
    " color:#fff;border-radius:2.4cqw;padding:2.8cqw 3.6cqw;font-size:3.9cqw;line-height:1.35}",
    ".xg-op-cartao{position:absolute;z-index:9;left:4cqw;right:4cqw;bottom:18.5cqw;background:#ffffffd9;border-radius:2.6cqw;padding:2.6cqw 3.4cqw}",
    ".xg-op-linha1{display:flex;align-items:center;gap:2cqw}",
    ".xg-op-linha1 b{font-size:4.6cqw;font-weight:500}",
    ".xg-op-foto-drone{width:8cqw;height:8cqw;border-radius:50%;background:radial-gradient(circle at 40% 35%,#f6f6f6,#c9cccf);flex:none}",
    ".xg-op-linha1 .xg-seta{font-size:5cqw}",
    ".xg-op-icones{margin-left:auto;display:flex;gap:3cqw}",
    ".xg-op-icones i{width:8cqw;height:8cqw;border-radius:50%;background:#e9ebee;display:grid;place-items:center;color:#5a6066}",
    ".xg-op-icones i svg{width:4.6cqw;height:4.6cqw}",
    ".xg-op-icones .xg-op-parada{background:#fde3e4;color:#e5484d}",
    ".xg-op-linha2{display:flex;align-items:center;gap:1.4cqw;margin-top:2.4cqw;color:#8d9399;font-size:3.6cqw}",
    ".xg-op-linha2 svg{width:4.8cqw;height:4.8cqw;flex:none}",
    ".xg-op-linha2 em{font-style:normal;font-size:2.6cqw;font-weight:700;border:1px solid #8d9399;border-radius:.6cqw;padding:0 .6cqw;margin:0 1.4cqw 0 .6cqw}",
    ".xg-op-linha2 span{margin-right:2cqw}",
    ".xg-op-botoes{position:absolute;z-index:9;left:4cqw;right:4cqw;bottom:3.4cqw;display:flex;gap:2.4cqw}",
    ".xg-op-botoes button{flex:1;height:14cqw;border:0;border-radius:2.6cqw;background:#fff;color:#15191c;font:inherit;font-size:3.7cqw;",
    " display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.4cqw;cursor:pointer;box-shadow:0 .4cqw 1.4cqw #0003}",
    ".xg-op-botoes i{font-style:normal;font-size:4cqw;line-height:1}",
    /* drone ligado */
    ".xg-op-rtk{position:absolute;z-index:9;top:16cqw;left:4cqw;color:#2ed36f;font-size:3.2cqw;text-shadow:0 1px 3px #000c;display:none}",
    ".xg-op-botoes--ligado{display:none}",
    ".xg-op--ligado .xg-op-rtk,.xg-op--ligado .xg-op-botoes--ligado{display:flex}",
    ".xg-op--ligado .xg-op-botoes:not(.xg-op-botoes--ligado){display:none}",
    ".xg-op--ligado .xg-op-parada{background:#dcf5e8!important;color:#17a567!important}",
    ".xg-op-botoes--ligado .xg-op-mais2{flex:0 0 16cqw}",
    ".xg-op-botoes--ligado .xg-op-meio{flex:1;background:#f6dede;box-shadow:none;cursor:default}",
    ".xg-op-botoes--ligado .xg-op-comecar{flex:0 0 42cqw;flex-direction:row;gap:1.6cqw;background:#cfd3d7;color:#fff;box-shadow:none;cursor:default}",
    ".xg-op-botoes--ligado .xg-op-comecar:not(:disabled){background:#17b36b;cursor:pointer}",
    ".xg-op-botoes--ligado .xg-op-comecar svg{width:4.4cqw;height:4.4cqw}",
    ".xg-op-bat,.xg-op-tan{display:none;align-items:center;gap:.8cqw;font-weight:400}",
    ".xg-op--ligado .xg-op-bat,.xg-op--ligado .xg-op-tan{display:flex}",
    ".xg-op-bat{color:#17b36b}",
    ".xg-op-tan{color:#5a6066}",
    ".xg-op-tan--pouco{color:#f0821e}",
    ".xg-op--ligado .xg-op-linha2>span{display:none}",
    ".xg-op--ligado .xg-op-linha2>span:last-of-type{display:inline}",
    /* janela de configuracoes depois do Comecar */
    ".xg-op--conf .xg-op-cartao,.xg-op--conf .xg-op-botoes{display:none!important}",
    ".xg-op--conf .xg-op-dica{bottom:auto;top:48%;transform:translateY(-100%);text-align:center;background:transparent;backdrop-filter:none;text-shadow:0 1px 3px #000c}",
    ".xg-op-conf{position:absolute;z-index:12;left:0;right:0;bottom:0;height:57%;background:#f7f2f3;border-radius:3cqw 3cqw 0 0;",
    " display:flex;flex-direction:column;font-family:Roboto,Inter,'Segoe UI',sans-serif;color:#15191c}",
    ".xg-conf-abas{position:relative;display:flex;justify-content:center;gap:2cqw;padding:3cqw 4cqw 2cqw}",
    ".xg-conf-aba{padding:1.6cqw 6cqw;border-radius:1.6cqw;font-size:3.7cqw;color:#8a9095}",
    ".xg-conf-aba--ativa{background:#fff;color:#15191c;box-shadow:0 .3cqw .8cqw #0001}",
    ".xg-conf-x{position:absolute;right:4cqw;top:3.4cqw;width:7cqw;height:7cqw;border:0;background:none;color:#5a6066;display:grid;place-items:center;padding:0}",
    ".xg-conf-x svg{width:4.6cqw;height:4.6cqw}",
    ".xg-conf-rolagem{flex:1;overflow:auto;padding:0 4cqw 4cqw}",
    ".xg-op-conf h4{display:flex;align-items:center;gap:2cqw;margin:5cqw 0 1.6cqw;font-size:4.1cqw;font-weight:400}",
    ".xg-op-conf h4 em{margin-left:auto;font-style:normal;font-size:3.6cqw;color:#7c8287}",
    ".xg-conf-icone{width:4.6cqw;height:4.6cqw;border-radius:1cqw;display:grid;place-items:center;flex:none}",
    ".xg-conf-icone svg{width:3.2cqw;height:3.2cqw}",
    ".xg-conf-linha{display:flex;align-items:center;gap:2cqw;width:100%;min-height:13cqw;border:0;border-top:1px solid #ebe6e7;background:none;",
    " padding:1.4cqw 0;font:inherit;font-size:3.9cqw;color:#5a6066;text-align:left;cursor:pointer}",
    ".xg-conf-linha span{flex:1}",
    ".xg-conf-linha em{font-style:normal;color:#7c8287;font-size:3.7cqw;white-space:nowrap}",
    ".xg-conf-modelo{display:flex;justify-content:space-between;align-items:center;padding:1cqw 4cqw 2cqw;font-size:3.7cqw;color:#5a6066}",
    ".xg-conf-modelo b{color:#17b36b;font-weight:500;cursor:pointer}",
    /* pronta para iniciar */
    ".xg-op--pronta .xg-op-dica,.xg-op--pronta .xg-op-botoes:not(.xg-op-botoes--pronta),.xg-op--voando .xg-op-dica{display:none!important}",
    ".xg-op-info{position:absolute;z-index:9;top:16cqw;left:4cqw;color:#fff;text-shadow:0 1px 3px #000c;display:flex;flex-direction:column;gap:.6cqw;font-size:3cqw}",
    ".xg-op-info b{font-weight:500;font-size:3.2cqw}",
    ".xg-op-info span{color:#2ed36f}",
    ".xg-op-estimativa{position:absolute;z-index:9;left:0;right:0;bottom:41cqw;background:#00000055;color:#fff;padding:2cqw 4cqw;font-size:3.3cqw;",
    " display:flex;flex-direction:column;gap:1cqw}",
    ".xg-op-estimativa div{display:flex;justify-content:space-between}",
    ".xg-op-estimativa b{font-weight:500}",
    ".xg-op--pronta .xg-op-rtk{display:none!important}",
    ".xg-op-botoes--pronta{display:flex!important}",
    ".xg-op-botoes--pronta .xg-op-cancela{flex:0 0 14cqw;font-size:3cqw!important}",
    ".xg-op-botoes--pronta .xg-op-configurar{flex:1;flex-direction:row!important;gap:1.6cqw!important;font-size:3.2cqw!important}",
    ".xg-op-botoes--pronta .xg-op-configurar span{margin-right:auto}",
    ".xg-op-botoes--pronta .xg-op-iniciar{flex:0 0 40cqw;flex-direction:row!important;gap:1.6cqw!important;background:#17b36b!important;color:#fff!important}",
    ".xg-op-botoes--pronta .xg-op-iniciar svg{width:4.4cqw;height:4.4cqw}",
    /* modal Iniciar operacao */
    ".xg-modal{position:absolute;z-index:15;left:3cqw;right:3cqw;top:14cqw;bottom:3cqw;background:#fff;border-radius:3cqw;padding:0 5cqw 5cqw;",
    " display:flex;flex-direction:column;font-family:Roboto,Inter,'Segoe UI',sans-serif;color:#15191c;box-shadow:0 1cqw 4cqw #0005}",
    ".xg-modal-cabeca{position:relative;height:14cqw;display:flex;align-items:center;justify-content:center}",
    ".xg-modal-cabeca h3{margin:0;font-size:4.4cqw;font-weight:600}",
    ".xg-modal-x{position:absolute;right:-1cqw;top:3.5cqw;width:7cqw;height:7cqw;border:0;background:none;color:#5a6066;display:grid;place-items:center;padding:0}",
    ".xg-modal-x svg{width:4.6cqw;height:4.6cqw}",
    ".xg-modal-drone{flex:1;display:grid;place-items:center}",
    ".xg-modal-drone svg{width:60cqw;height:60cqw}",
    ".xg-modal-caixa{display:flex;align-items:center;gap:2cqw;min-height:12cqw;border-top:1px solid #edeef0;font-size:3.5cqw;cursor:pointer}",
    ".xg-modal-caixa span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".xg-modal-caixa input{display:none}",
    ".xg-modal-caixa i{width:5.4cqw;height:5.4cqw;border:.5cqw solid #17b36b;border-radius:1cqw;flex:none;display:grid;place-items:center}",
    ".xg-modal-caixa input:checked+i{background:#17b36b}",
    ".xg-modal-caixa input:checked+i:after{content:'';width:1.6cqw;height:3cqw;border:solid #fff;border-width:0 .6cqw .6cqw 0;transform:rotate(45deg) translate(-.3cqw,-.3cqw)}",
    ".xg-modal-arrastar{position:relative;height:14cqw;margin-top:4cqw;border-radius:7cqw;background:#e8f7ef;display:flex;align-items:center;justify-content:center;color:#8fbfa9;font-size:5cqw;user-select:none}",
    ".xg-modal-pino{position:absolute;left:1cqw;top:1cqw;width:20cqw;height:12cqw;border-radius:6cqw;background:#fff;box-shadow:0 .4cqw 1.4cqw #0003;",
    " display:grid;place-items:center;color:#17b36b;cursor:grab;touch-action:none}",
    ".xg-modal-pino svg{width:6cqw;height:6cqw}",
    ".xg-modal-anel{position:relative;width:46cqw;height:46cqw;margin:16cqw auto 6cqw}",
    ".xg-modal-anel svg{width:100%;height:100%}",
    ".xg-modal-anel b{position:absolute;inset:0;display:grid;place-items:center;font-size:8cqw;font-weight:500}",
    ".xg-modal-texto{margin:0;text-align:center;font-size:4cqw;color:#5a6066}",
    ".xg-modal-abortar{margin-top:auto;height:12cqw;border:0;border-radius:2cqw;background:#ef6a3b;color:#fff;font:inherit;font-size:3.9cqw;font-weight:500;cursor:pointer}",
  ].join("");

  /* ---------------------------------------------- mapa selecionado + Mais

     Pelo print: cabecalho com o icone, nome, "0.46Hectare  #ID" e "Mais ▾";
     Operacao (verde) / Editar / Compartilhar / Mais; "Etiquetas e notas >";
     abas Records | Rota | Mapa de presc...; e o "Mais" abre a gaveta
     Dividir mapa / Mudar o nome do mapa / Excluir (vermelho). */
  function telaMapaSelecionado(doc, gaveta) {
    if (gaveta.getAttribute("data-xg")) return;
    gaveta.setAttribute("data-xg", "1");
    gaveta.classList.add("xg-sel");
    var cabeca = gaveta.querySelector(".sheet-head");
    var nome = cabeca && cabeca.querySelector("h3") ? cabeca.querySelector("h3").textContent : "Mapa";
    var area = cabeca && cabeca.querySelector(".muted") ? cabeca.querySelector(".muted").textContent.split("·")[0].trim() : "";
    var id = "#" + Math.abs(hash(nome)).toString().slice(0, 8);
    if (cabeca) {
      cabeca.innerHTML =
        '<i class="xg-sel-icone">' + ICONES_LISTA.prescricao + "</i>" +
        '<div class="xg-sel-nome"><b>' + esc(nome) + "</b><small>" + esc(area.replace(" ha", "Hectare")) + "&nbsp;&nbsp;" + id + "</small>" +
        '<span class="xg-sel-mais">Mais ' + svg('<path d="M6 9l6 6 6-6"/>') + "</span></div>" +
        '<button class="x" data-action="home" aria-label="Fechar">' + svg('<path d="M7 7l10 10M17 7L7 17"/>') + "</button>";
    }
    var botoes = gaveta.querySelectorAll('.sheet-head + div > button');
    var icones = [svg('<path d="M21 3L3 10.5l7.2 2.6L13 20.5z"/>'), svg('<path d="M4 20h16M4 16l10-10 4 4-10 10H4z"/>'),
                  svg('<path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/>'), "<i>···</i>"];
    var rotulos = ["Operação", "Editar", "Compartilhar", "Mais"];
    botoes.forEach(function (b, i) {
      b.innerHTML = icones[i] + "<span>" + rotulos[i] + "</span>";
      b.removeAttribute("style");
    });
    var abas = gaveta.querySelectorAll(".segmented button");
    ["Records", "Rota", "Mapa de presc…"].forEach(function (t, i) { if (abas[i]) abas[i].textContent = t; });
  }

  function hash(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; }

  /* "Mais" no mapeamento: so "Claro" (vermelho), que apaga TUDO que esta
     sendo desenhado agora - limite em aberto, obstaculos, zonas, marcadores
     e pontos de operacao. O limite ja fechado e salvo fica (ele: "menos os
     mapas salvos"). O site so limpa a ferramenta atual: aqui passa por todas. */
  /* ------------------------------------------- mapa novo x mapa salvo

     Regra dele (26/09): "mapeamento" na tela inicial comeca SEMPRE em
     branco; o mapa salvo so abre para edicao pelo "Editar" do mapa
     selecionado. O site tem um mapa so (o que esta em `guri-map-demo`), e o
     estado dele vive numa closure que so le o localStorage ao carregar.
     Entao: o mapa salvo e guardado em outra chave, o localStorage recebe o
     mapa em branco e o app do controle e RECARREGADO (principal.js religa
     o vinculo e o manual no documento novo). Sair do mapeamento sem salvar
     devolve o mapa guardado; salvar (complete) descarta a copia. */
  var CHAVE_GUARDADO = "tpd_xag_mapa_guardado";

  function armazem(doc) {
    try { return doc.defaultView.localStorage; } catch (e) { return null; }
  }

  /* (Recarregar o app nao serve: ao carregar ele volta ao login com o
     controle desligado. Entao o mapa salvo e REDESENHADO por dentro, com os
     mesmos toques e botoes que o aluno usaria - tudo sincrono, sem quadro
     no meio, entao nao aparece.) */

  function guardarMapaSalvo(doc) {
    var ls = armazem(doc), m = salvoDoApp(doc);
    if (!ls || !m || (m.points || []).length < 3 || !m.lotClosed) return false;
    ls.setItem(CHAVE_GUARDADO, JSON.stringify(m));
    return true;
  }

  /* um toque no mapa, na posicao 0-100 do app (o site le clientX/Y) */
  function tocarNoMapa(doc, tela, u, v) {
    var svgMapa = tela.querySelector(".map-svg");
    if (!svgMapa) return;
    var r = svgMapa.getBoundingClientRect();
    svgMapa.dispatchEvent(new doc.defaultView.PointerEvent("pointerup", {
      bubbles: true, pointerId: 9, clientX: r.left + u / 100 * r.width, clientY: r.top + v / 100 * r.height }));
  }

  function restaurarMapaSalvo(doc, tela) {
    var ls = armazem(doc);
    var g = ls && ls.getItem(CHAVE_GUARDADO);
    if (!g) return;
    ls.removeItem(CHAVE_GUARDADO);
    var m;
    try { m = JSON.parse(g); } catch (e) { return; }
    var A = function (acao) { apertarAcao(doc, tela, acao); };
    var T = function (p) { tocarNoMapa(doc, tela, p[0], p[1]); };
    var J = doc.defaultView;
    J.__xgRestaurando = true;
    try { redesenharGuardado(); } finally { J.__xgRestaurando = false; }
    /* as linhas de marcacao do xag_mapeamento.js voltam junto */
    if (J.XAG_MAPEAMENTO && J.XAG_MAPEAMENTO.restaurarLinhas) J.XAG_MAPEAMENTO.restaurarLinhas(m.xmLinhas || []);
    return;

    function redesenharGuardado() {
    A("choose-lote");                       // entra no mapeamento
    limparMapeamento(doc, tela);            // e comeca do zero
    J.__xgRestaurando = true;
    (m.points || []).forEach(T);
    A("close-lot");

    if ((m.obstacles || []).length) {
      A("choose-obstaculo"); A("obstacle-circle");
      m.obstacles.forEach(function (o) {
        T(o);
        /* o circulo nasce com o raio padrao do app; ajusta de 0,1 em 0,1 m */
        var atual = Number((salvoDoApp(doc) || {}).radius) || 5, alvo = (Number(o[2]) || 1) * 3;
        var passos = Math.max(-300, Math.min(300, Math.round((alvo - atual) * 10)));
        for (var i = 0; i < Math.abs(passos); i++) A(passos > 0 ? "diameter-up" : "diameter-down");
      });
    }
    if ((m.obstaclePolygons || []).length) {
      A("choose-obstaculo"); A("obstacle-polygon");
      m.obstaclePolygons.forEach(function (z) { z.forEach(T); A("finish-shape"); });
    }
    if ((m.zones || []).length) {
      A("choose-zona");
      m.zones.forEach(function (z) { if (z.length >= 3) { z.forEach(T); A("finish-shape"); } });
    }
    if ((m.markers || []).length) { A("choose-marcador"); m.markers.forEach(T); }
    if ((m.operationPoints || []).length) { A("choose-ponto"); m.operationPoints.forEach(T); }

    A("choose-lote"); A("save-map"); A("complete");   // salvo de novo, como era
    if (m.route) A("generate-route");
    A("home");
    }
  }

  function ouvirMapaNovo(doc, tela) {
    tela.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-action]");
      if (!b) return;
      var acao = b.getAttribute("data-action");
      var ls = armazem(doc);
      if (acao === "mapping") {
        /* o site abre o mapa salvo para editar; aqui ele e guardado e o
           mapeamento comeca em branco (depois de o site abrir a tela) */
        guardarMapaSalvo(doc);
        setTimeout(function () { limparMapeamento(doc, tela); }, 0);
      } else if (acao === "edit") {
        guardarMapaSalvo(doc);               // sair sem salvar devolve este
      } else if (acao === "complete" && ls) {
        ls.removeItem(CHAVE_GUARDADO);       // salvou: o novo e o que vale
      }
    }, true);
  }

  /* chamado a cada desenho: saiu do mapeamento sem salvar -> volta o guardado */
  var restaurando = false;
  function conferirMapaGuardado(doc, tela) {
    var ls = armazem(doc);
    if (restaurando || !ls || !ls.getItem(CHAVE_GUARDADO)) return;
    if (tela.querySelector(".portrait-edit, .edit-view, .details, .details-mobile")) return;
    restaurando = true;
    try { restaurarMapaSalvo(doc, tela); } finally { restaurando = false; }
  }

  function apertarAcao(doc, tela, acao) {
    var b = doc.createElement("button");
    b.setAttribute("data-action", acao);
    b.style.display = "none";
    tela.appendChild(b);
    b.click();
    if (b.parentNode) b.remove();
  }

  /* No celular o "limpar" do site pede confirmacao numa segunda tela:
     clear-mode abre, confirm-clear-mode limpa (e e ele que reabre o limite,
     lotClosed=false). O limite tambem entra: o mapa salvo esta guardado a
     parte (ver `guardarMapaSalvo`). */
  function limparMapeamento(doc, tela) {
    /* toques programados: o xag_mapeamento.js deixa passar sem perguntar */
    var J = doc.defaultView;
    J.__xgRestaurando = true;
    try {
      ["lote", "obstaculo", "zona", "marcador", "ponto"].forEach(function (m) {
        apertarAcao(doc, tela, "choose-" + m);
        apertarAcao(doc, tela, "clear-mode");
        apertarAcao(doc, tela, "confirm-clear-mode");
      });
      apertarAcao(doc, tela, "choose-lote");
    } finally { J.__xgRestaurando = false; }
    /* linhas de marcacao e lotes do multi-lote tambem saem */
    if (J.XAG_MAPEAMENTO && J.XAG_MAPEAMENTO.limparSessao) J.XAG_MAPEAMENTO.limparSessao();
  }

  function gavetaMaisDoMapeamento(doc, gaveta, tela) {
    if (gaveta.getAttribute("data-xg")) return;
    gaveta.setAttribute("data-xg", "1");
    gaveta.classList.add("xg-mais");
    gaveta.innerHTML =
      '<div class="xg-cabeca"><h3>Mais</h3><button class="x" data-action="close-sheet" aria-label="Fechar">' +
      svg('<path d="M7 7l10 10M17 7L7 17"/>') + "</button></div>" +
      '<button type="button" class="xg-mais-item xg-mais-item--vermelho">Claro</button>';
    gaveta.querySelector(".xg-mais-item").addEventListener("click", function () {
      /* o aparelho confirma antes (relatorio "criar mapa", 0078) */
      var M = doc.defaultView.XAG_MAPEAMENTO;
      if (M && M.confirmarClaro) M.confirmarClaro(function () { limparMapeamento(doc, tela, true); });
      else limparMapeamento(doc, tela);
    });
  }

  function gavetaMais(doc, gaveta, mapa) {
    if (gaveta.getAttribute("data-xg")) return;
    gaveta.setAttribute("data-xg", "1");
    gaveta.classList.add("xg-mais");
    gaveta.innerHTML =
      '<div class="xg-cabeca"><h3>Mais</h3><button class="x" data-action="close-sheet" aria-label="Fechar">' +
      svg('<path d="M7 7l10 10M17 7L7 17"/>') + "</button></div>" +
      '<button type="button" class="xg-mais-item" data-dica="Dividir mapa: corte o talhão em partes no aparelho real.">Dividir mapa</button>' +
      '<button type="button" class="xg-mais-item" data-dica="Mudar o nome: abra Editar e toque em Salvar para renomear.">Mudar o nome do mapa</button>' +
      '<button type="button" class="xg-mais-item xg-mais-item--vermelho" data-action="delete-maps">Excluir</button>';
    gaveta.querySelectorAll("[data-dica]").forEach(function (b) {
      b.addEventListener("click", function () { dica(mapa, b.getAttribute("data-dica")); });
    });
  }

  var ESTILO_SEL = [
    ".remote.handheld .xg-sel{height:auto!important;max-height:62%!important;padding:0 4cqw 4cqw!important;background:#f3f4f6!important;",
    " border-radius:3cqw 3cqw 0 0!important;font-family:Roboto,Inter,'Segoe UI',sans-serif}",
    ".remote.handheld .xg-sel:before{width:9cqw!important;height:1cqw!important;margin:1.8cqw auto 2cqw!important;background:#c9cbd0!important}",
    ".xg-sel .sheet-head{display:flex;align-items:flex-start;gap:3cqw;margin:0 0 3cqw!important}",
    ".xg-sel-icone{width:11cqw;height:11cqw;border-radius:2cqw;background:#fff;display:grid;place-items:center;color:#15191c;flex:none;font-style:normal}",
    ".xg-sel-icone svg{width:6cqw;height:6cqw}",
    ".xg-sel-nome{flex:1;display:flex;flex-direction:column;gap:.6cqw}",
    ".xg-sel-nome b{font-size:4.6cqw;font-weight:500}",
    ".xg-sel-nome small{font-size:3.5cqw;color:#7c8287}",
    ".xg-sel-mais{display:flex;align-items:center;gap:.4cqw;font-size:3.5cqw;color:#7c8287}",
    ".xg-sel-mais svg{width:3.6cqw;height:3.6cqw}",
    ".xg-sel .sheet-head .x{width:7cqw;height:7cqw;border-radius:50%;border:0;background:#e3e5e8;color:#4a5055;display:grid;place-items:center;padding:0}",
    ".xg-sel .sheet-head .x svg{width:4cqw;height:4cqw}",
    ".xg-sel .sheet-head+div{gap:2.4cqw!important;margin-bottom:3cqw}",
    ".xg-sel .sheet-head+div>button{height:15cqw;border:0!important;border-radius:2.2cqw!important;background:#e6e8eb!important;color:#15191c!important;",
    " font:inherit!important;font-size:3.3cqw!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1cqw;padding:0!important}",
    ".xg-sel .sheet-head+div>button svg{width:5cqw;height:5cqw}",
    ".xg-sel .sheet-head+div>button i{font-style:normal;font-size:4cqw;line-height:1}",
    ".xg-sel .sheet-head+div>button.primary{background:#17a567!important;color:#fff!important}",
    ".xg-sel>.row{background:#e6e8eb;border-radius:2.2cqw;padding:3.6cqw 4cqw;font-size:3.9cqw;color:#5a6066;margin-bottom:3cqw;border:0;width:100%;display:flex;justify-content:space-between}",
    ".xg-sel .card{background:#e6e8eb;border-radius:2.6cqw;padding:2.4cqw}",
    ".xg-sel .card .segmented{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8cqw;",
    " background:#d7d9dd!important;border-radius:1.6cqw!important;padding:.8cqw!important;overflow:hidden!important}",
    ".xg-sel .card .segmented button{min-width:0!important;font-size:3.5cqw!important;padding:2cqw 1cqw!important;",
    " white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:1.2cqw!important;font-weight:400!important;color:#8a9095!important}",
    ".xg-sel .card .segmented button.selected{background:#fff!important;color:#15191c!important}",
    ".xg-sel .card .empty{padding:5cqw 0!important}",
    ".remote.handheld .xg-mais{height:auto!important;padding:0 4cqw 8cqw!important;background:#f3f4f6!important;border-radius:3cqw 3cqw 0 0!important;",
    " font-family:Roboto,Inter,'Segoe UI',sans-serif}",
    ".remote.handheld .xg-mais:before{display:none!important}",
    ".xg-mais .xg-cabeca{position:relative;height:16cqw;display:flex;align-items:center;justify-content:center}",
    ".xg-mais .xg-cabeca h3{margin:0;font-size:4.6cqw;font-weight:600}",
    ".xg-mais .xg-cabeca .x{position:absolute;right:0;width:7cqw;height:7cqw;border-radius:50%;border:0;background:#e3e5e8;color:#4a5055;display:grid;place-items:center;padding:0}",
    ".xg-mais .xg-cabeca .x svg{width:4cqw;height:4cqw}",
    ".xg-mais-item{display:block;width:100%;height:13cqw;border:0;border-radius:2.6cqw;background:#fff;margin-bottom:3cqw;font:inherit;font-size:4.2cqw;color:#15191c;cursor:pointer}",
    ".xg-mais-item--vermelho{color:#e5484d}",
  ].join("");

  function corrigir(doc) {
    var remoto = doc.getElementById("remote");
    if (!remoto) return;
    var tela = doc.getElementById("phone");
    if (!tela) return;
    conferirMapaGuardado(doc, tela);
    var tituloDisp = tela.querySelector(".white-view .header h2");
    if (tituloDisp && (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(tituloDisp) : tituloDisp.textContent).trim() === "Dispositivo") {
      telaDispositivo(doc, tituloDisp.closest(".white-view"), remoto);
    }
    var jaDisp = tela.querySelector(".xg-disp");
    if (jaDisp) telaDispositivo(doc, jaDisp.closest(".white-view"), remoto);   // ligou/desligou o ACS4
    if (!remoto.classList.contains("handheld")) return;
    var inicio = tela.querySelector(".home-view");
    if (inicio) telaInicial(doc, inicio.closest(".view") || inicio);
    var edicao = tela.querySelector(".portrait-edit");
    if (edicao) {
      mapeamento(doc, edicao);
      mapeamentoPorDentro(doc, edicao);
      edicao.classList.toggle("xg-com-circulo", !!edicao.querySelector(".xg-painel-circulo"));
    }
    var lista = tela.querySelector(".list-view");
    if (lista) listaDeMapas(doc, lista);

    /* gavetas do site que viram as do app */
    tela.querySelectorAll(".sheet").forEach(function (g) {
      var h3 = g.querySelector(".sheet-head h3");
      var t = h3 ? (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(h3) : h3.textContent).trim() : "";
      var mapa = g.closest(".map") || tela;
      if (t === "Camadas do mapa") telaCamadas(doc, g, mapa);
      else if (t === "Mais" && tela.querySelector(".xg-sel")) gavetaMais(doc, g, mapa);
      else if (t === "Mais" && tela.querySelector(".portrait-edit")) gavetaMaisDoMapeamento(doc, g, tela);
      else if (g.querySelector('.sheet-head + div > [data-action="operations"]')) telaMapaSelecionado(doc, g);
    });

    /* a pagina "Operacao de treino" do site vira o mapa da operacao */
    var op = tela.querySelector(".op-intro:not([data-xag-preparo])");
    if (op) telaOperacao(doc, op.closest(".white-view"));
    var opAberta = tela.querySelector(".xg-op");
    if (opAberta) atualizarOperacao(doc, opAberta);
    /* a aba Eu: a pagina branca do app com o titulo "Eu" */
    var titulo = tela.querySelector(".white-view > .header h2");
    if (titulo && (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(titulo) : titulo.textContent).trim() === "Eu") telaEu(doc, titulo.closest(".white-view"));
  }

  return {
    /* o vinculo de verdade (principal.js poe aqui): da os metros das medidas
       e a foto do campo para a tela de operacao */
    vinculo: null,
    _popup: popup, _modo: modoAtual,   // para depurar pelo console

    /* Chamado uma vez por carga do site do controle (vinculo_xag.js). */
    instalar: function (doc) {
      if (!doc || !doc.head || doc.getElementById("xg-telas-estilo")) return;
      var estilo = doc.createElement("style");
      estilo.id = "xg-telas-estilo";
      estilo.textContent = ESTILO + ESTILO_EU + ESTILO_DISP + ESTILO_LISTA + ESTILO_MAPEAMENTO +
                           ESTILO_CAMADAS + ESTILO_OP + ESTILO_SEL;
      doc.head.appendChild(estilo);

      var tela = doc.getElementById("phone");
      var remoto = doc.getElementById("remote");
      var J = doc.defaultView;
      if (!tela || !J || !J.MutationObserver) return;
      /* so o filho direto: o desenho novo do app troca o conteudo do #phone
         inteiro; o que entra aqui fica mais fundo e nao dispara de novo */
      new J.MutationObserver(function () { corrigir(doc); }).observe(tela, { childList: true });
      ouvirMapaNovo(doc, tela);
      /* trocar de aparelho muda a classe do #remote sem redesenhar */
      if (remoto) new J.MutationObserver(function () { corrigir(doc); }).observe(remoto, { attributes: true, attributeFilter: ["class"] });
      corrigir(doc);
    },
  };
})();
