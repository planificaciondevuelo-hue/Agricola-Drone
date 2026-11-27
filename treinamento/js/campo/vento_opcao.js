/* ==========================================================================
   OPCAO "VENTO" NA TELA INICIAL - roda DENTRO do campo, para todos.

   24/10/2026 (Eduardo): "uma coisa que podemos colocar ali na hora de escolher
   o mapa e se o vento afeta a aplicacao; se a pessoa nao quiser, ela desativa, e
   no sistema nao precisa mostrar as condicoes meteorologicas e o vento nao afeta".

   Ligado (o padrao, igual a antes): o vento leva as gotas, empurra a aeronave e o
   painel de clima aparece. Desligado: xgPulv.vento.desligado = true, o que faz o
   METEOROLOGIA.avancar (meteorologia.js) manter vel e rajada em zero -- gotas,
   deriva (pulverizacao.js), fisica e voo manual (fisica.js, manual.js), vortice
   leem tudo de xgPulv.vento, entao nenhum deles ve vento --, e o painel de clima
   (meteorologia.js) e o "Vento" do alto do campo somem.
   A escolha vale so ate recarregar a pagina (nao e guardada): cada sessao do
   treino livre comeca com vento, como sempre.

   26/10/2026 (Eduardo): com o vento ligado, duas escolhas:
     FORCA   Sorteada (como antes: de 0,8 a 4,5 m/s) | Calmo | Fraco | Moderado | Forte.
             Cada nivel poe a base e a rajada do vento (xgPulv.vento.base / extra), que o
             METEOROLOGIA.avancar ja usa: o vento oscila em volta da base e tem rajadas.
     DIRECAO Fixa (como antes) | Muda durante a operacao (xgPulv.vento.muda = true: o
             METEOROLOGIA.avancar faz o vento virar de 25 a 75 graus, devagar, de tempos em tempos).

   26/10/2026, de novo (Eduardo: "vamos colocar ali em cima o botao personalizar ... ela vai escolher
   direcao, vento constante e rajadas, e um mais do lado: se clicar embaixo pede depois de quanto
   tempo mudar, e ai seleciona de novo direcao, vento e rajada, ate 5 variacoes; conforme o tempo
   passa a mudanca vai acontecendo gradativamente e nao bruscamente"): o 3o botao do topo,
   PERSONALIZAR, troca Forca/Direcao por uma lista de ate 5 variacoes. Cada uma tem a direcao
   (de onde o vento vem, em 8 pontos), o vento constante (km/h) e as rajadas (km/h); da 2a em
   diante, depois de quantos minutos (da variacao anterior) ela comeca. Isto vira
   xgPulv.vento.programa = [{ t, dir, vel, raj }], e o METEOROLOGIA.avancar faz cada mudanca
   GRADUAL (em ate 2 minutos, com partida e chegada suaves).

   26/10/2026, por fim (Eduardo, com foto de "Forca do vento / Direcao do vento": "tira isso daqui"): as
   escolhas FORCA e DIRECAO SAIRAM da tela inicial. Quem quer decidir o vento usa o Personalizar; "Afeta a
   aplicacao" volta a ser so o vento sorteado de sempre. (A Forca/Direcao eram opcionais e atrapalhavam:
   a lista alta tapava o Comecar.)

   Tambem cria o recipiente unico das opcoes da tela inicial (#xgOpcoes), sempre
   colado no botao Comecar; o ponto de decolagem (veiculo.js) entra nele tambem.
   ========================================================================== */
(function () {
  "use strict";
  if (window.xgOpcoesInicio) return;
  /* 21/11/2026 (Eduardo, no Air 2S: "nele nao tem problema o vento" / "1 pode esconder"): o Air 2S nao pulveriza, entao a linha
     "Vento" some da tela inicial e ele voa sem vento (como o "Desligado"). O campo e um iframe sem o ?modelo=: le o da pagina de fora. */
  var AIR2S = /[?&](modelo|drone)=air2s(&|$)/.test((function () { try { return (window.parent !== window ? window.parent : window).location.search; } catch (e) { return location.search; } })());
  var ligado = !AIR2S, personalizado = false, orig = null, sujo = false;

  /* ---- Personalizar: ate 5 variacoes ---- */
  var MAX_FASES = 5;
  var PONTOS = [["Norte (N)", 0], ["Nordeste (NE)", 45], ["Leste (L)", 90], ["Sudeste (SE)", 135], ["Sul (S)", 180], ["Sudoeste (SO)", 225], ["Oeste (O)", 270], ["Noroeste (NO)", 315]];
  var LIMITES = { min: [1, 60], vento: [0, 40], rajada: [0, 30] };
  var fases = [{ min: 0, graus: 0, vento: 8, rajada: 4 }];
  function limitar(campo, v) { var L = LIMITES[campo]; return Math.max(L[0], Math.min(L[1], Math.round(v))); }
  /* graus = de onde o vento VEM (0 = norte); w.dir segue a convencao do jogo: dir = (graus + 90) em radianos */
  function programa() {
    var t = 0;
    return fases.map(function (f, i) {
      if (i > 0) t += f.min * 60;
      return { t: t, dir: (f.graus + 90) * Math.PI / 180, vel: f.vento / 3.6, raj: f.rajada / 3.6 };
    });
  }
  function aplicarPrograma(W) {
    var P = programa(), p0 = P[0];
    W.programa = P; W.transicao = 120; W.dinamico = true;
    W.base = p0.vel; W.extra = p0.raj; W.vel = p0.vel; W.rajada = p0.vel + p0.raj;
    W.dir = p0.dir; W.direcaoBase = p0.dir; W.tempo = 0;
    if (Array.isArray(W.picos)) W.picos.length = 0;
  }

  function estiloPers() {
    if (document.getElementById("xgPersCss")) return;
    var s = document.createElement("style"); s.id = "xgPersCss";
    s.textContent =
      "#xgPers{margin-top:12px;display:grid;gap:10px}" +
      "#xgPers .fase{border:1px solid #2b3a47;border-radius:10px;background:rgba(20,28,36,.55);padding:10px 12px}" +
      "#xgPers .topo{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:13px;color:#E8EDF2}" +
      "#xgPers .topo b{font-weight:700}#xgPers .topo .quando{display:flex;align-items:center;gap:6px;color:#C3CCD5}" +
      "#xgPers .topo .acoes{margin-left:auto;display:flex;gap:6px}" +
      "#xgPers .campos{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px}" +
      "#xgPers label{display:grid;gap:4px;font-size:12px;color:#C3CCD5}" +
      "#xgPers input,#xgPers select{width:100%;box-sizing:border-box;padding:7px 8px;border-radius:8px;border:1px solid #3a4b59;background:#101820;color:#fff;font:inherit;font-size:14px}" +
      "#xgPers .topo input{width:58px}" +
      "#xgPers .mini{width:34px;height:34px;border-radius:50%;border:1px solid #4a5b69;background:#18222c;color:#fff;font-size:20px;line-height:1;cursor:pointer;padding:0}" +
      "#xgPers .mini:disabled{opacity:.35;cursor:default}#xgPers .mini:not(:disabled):hover{background:#22303d}" +
      "#xgPers .dica{font-size:12px;line-height:1.5;color:#C3CCD5;margin:0}" +
      "@media(max-width:430px){#xgPers .campos{grid-template-columns:1fr 1fr}#xgPers .campos label:first-child{grid-column:1/3}}" +
      /* janela do editor (fora da tela inicial) */
      /* a janela fica do lado ESQUERDO, como o painel da tela inicial: o quadro da aula (etapas) fica a direita e nao a cobre */
      "#xgPersModal{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:flex-start;padding:64px clamp(16px,5vw,64px) 16px;box-sizing:border-box;background:rgba(5,8,12,.78)}" +
      "#xgPersModal.aberto{display:flex}" +
      "#xgPersModal .cx{width:min(560px,100%);max-height:100%;overflow:auto;box-sizing:border-box;background:#0f1720;border:1px solid #2b3a47;border-radius:14px;padding:16px 16px 0;color:#E8EDF2;outline:none}" +
      "#xgPersModal h3{margin:0 0 4px;font-size:17px;font-weight:600;color:#E8EDF2}" +
      "#xgPersModal #xgPers{margin-top:10px}" +
      /* o Concluir fica fixo no pe da janela: com 5 variacoes a lista rola e o botao continua a vista */
      "#xgPersModal .fim{position:sticky;bottom:0;display:flex;justify-content:flex-end;margin:6px -16px 0;padding:10px 16px 14px;background:linear-gradient(0deg,#0f1720 72%,rgba(15,23,32,0))}" +
      "#xgPersModal .ok{min-width:120px;padding:11px 18px;border-radius:10px;border:0;background:#2F80ED;color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer}";
    document.head.appendChild(s);
  }

  /* a janela do editor: criada uma vez, no corpo da pagina do campo */
  function criarJanela() {
    var m = document.getElementById("xgPersModal");
    if (m) return m;
    estiloPers();
    m = document.createElement("div"); m.id = "xgPersModal";
    m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "Personalizar o vento");
    m.innerHTML = "<div class='cx' tabindex='-1'><h3>Personalizar o vento</h3><div id='xgPers'></div>" +
      "<div class='fim'><button type='button' class='ok' data-ac='pronto'>Concluir</button></div></div>";
    document.body.appendChild(m);
    return m;
  }

  /* desenha a lista de variacoes (so quando muda a estrutura: entrar, tirar, acrescentar; digitar nao refaz, para nao perder o foco) */
  function desenharPers(pers) {
    estiloPers();
    var acumulado = 0, h = "";
    fases.forEach(function (f, i) {
      if (i > 0) acumulado += f.min;
      var ultima = i === fases.length - 1;
      h += "<div class='fase' data-i='" + i + "'><div class='topo'><b><span>Variação</span> " + (i + 1) + "</b>";
      if (i === 0) h += "<span class='quando'>começa no início</span>";
      else h += "<span class='quando'><span>depois de</span> <input type='number' inputmode='numeric' min='" + LIMITES.min[0] + "' max='" + LIMITES.min[1] + "' step='1' data-c='min' value='" + f.min + "'> <span>min</span></span>" +
        "<span class='quando'><span>começa aos</span> <b>" + acumulado + "</b> <span>min</span></span>";
      h += "<span class='acoes'>";
      if (i > 0) h += "<button type='button' class='mini' data-ac='tirar' aria-label='Remover variação'>×</button>";
      if (ultima) h += "<button type='button' class='mini' data-ac='mais' aria-label='Adicionar variação'" + (fases.length >= MAX_FASES ? " disabled" : "") + ">+</button>";
      h += "</span></div><div class='campos'>" +
        "<label><span>Direção (de onde vem)</span><select data-c='graus'>" +
        PONTOS.map(function (p) { return "<option value='" + p[1] + "'" + (p[1] === f.graus ? " selected" : "") + ">" + p[0] + "</option>"; }).join("") + "</select></label>" +
        "<label><span>Vento constante (km/h)</span><input type='number' inputmode='numeric' min='" + LIMITES.vento[0] + "' max='" + LIMITES.vento[1] + "' step='1' data-c='vento' value='" + f.vento + "'></label>" +
        "<label><span>Rajadas (km/h)</span><input type='number' inputmode='numeric' min='" + LIMITES.rajada[0] + "' max='" + LIMITES.rajada[1] + "' step='1' data-c='rajada' value='" + f.rajada + "'></label>" +
        "</div></div>";
    });
    h += "<p class='dica'>Até 5 variações. O tempo conta a partir do começo da operação. A mudança de uma variação para a outra é gradual (em até 2 minutos), nunca de repente.</p>";
    pers.innerHTML = h;
  }

  /* recipiente das opcoes: as outras escolhas do jogo (mapas) entram antes do Comecar depois da gente, entao ele se recoloca */
  function recipiente() {
    var c = document.getElementById("xgOpcoes");
    if (c) return c;
    var b = document.getElementById("bComecar");
    if (!b || !b.parentNode) return null;
    c = document.createElement("div"); c.id = "xgOpcoes";
    function posicionar() { if (b.parentNode && c.nextSibling !== b) b.parentNode.insertBefore(c, b); }
    posicionar();
    if (window.MutationObserver) new MutationObserver(posicionar).observe(b.parentNode, { childList: true });
    return c;
  }
  window.xgOpcoesInicio = recipiente;

  function montar() {
    var c = recipiente();
    if (!c) return;
    if (document.getElementById("xgVento")) return;
    var bloco = document.createElement("div");
    bloco.id = "xgVento";
    bloco.innerHTML =
      "<p class='rot' style='margin-top:18px'>Vento</p>" +
      "<div class='avatares' role='group' aria-label='Vento'>" +
      "<button type='button' data-v='1' aria-pressed='true'>Afeta a aplicação</button>" +
      "<button type='button' data-v='0' aria-pressed='false'>Desligado</button>" +
      "<button type='button' data-v='2' aria-pressed='false' aria-haspopup='dialog'>Personalizar</button></div>";
    /* a tela inicial fica SO com a linha "Vento" (Eduardo: "deixa so assim"); o editor das variacoes abre numa JANELA propria ao clicar em Personalizar
       (de novo, se clicar nele outra vez): la dentro ele nao estica o painel nem tapa o Comecar */
    var janela = criarJanela(), pers = janela.querySelector("#xgPers");
    function abrirJanela() { desenharPers(pers); janela.classList.add("aberto"); var cx = janela.querySelector(".cx"); if (cx) cx.focus(); }
    function fecharJanela() { janela.classList.remove("aberto"); }
    janela.addEventListener("click", function (e) { if (e.target === janela || (e.target.closest && e.target.closest("button[data-ac='pronto']"))) fecharJanela(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && janela.classList.contains("aberto")) { fecharJanela(); e.stopPropagation(); } }, true);
    function marcar(v) {
      ligado = v !== 0; personalizado = v === 2;
      bloco.querySelectorAll("button[data-v]").forEach(function (b) { b.setAttribute("aria-pressed", String(Number(b.dataset.v) === v)); });
      if (personalizado) abrirJanela(); else fecharJanela();
      sujo = true;
      aplicar();
    }
    bloco.querySelectorAll("button[data-v]").forEach(function (b) { b.addEventListener("click", function () { marcar(Number(b.dataset.v)); }); });

    /* a lista de variacoes: mais (a ultima), tirar, e os campos */
    pers.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-ac]");
      if (!b || b.disabled) return;
      var i = Number(b.closest(".fase").dataset.i);
      if (b.dataset.ac === "mais" && fases.length < MAX_FASES) {
        var u = fases[fases.length - 1];
        fases.push({ min: 5, graus: u.graus, vento: u.vento, rajada: u.rajada });   // nasce igual a anterior: so muda o que a pessoa escolher
      } else if (b.dataset.ac === "tirar" && i > 0) fases.splice(i, 1);
      desenharPers(pers); sujo = true; aplicar();
    });
    function campo(e) {
      var el = e.target, c = el && el.dataset && el.dataset.c;
      if (!c) return;
      var f = fases[Number(el.closest(".fase").dataset.i)];
      if (!f) return;
      if (c === "graus") f.graus = Number(el.value) || 0;
      else { var v = parseFloat(String(el.value).replace(",", ".")); if (!isFinite(v)) return; f[c] = limitar(c, v); }
      /* ao confirmar, mostra o valor ajustado; so o "depois de N min" refaz a lista (muda o "comeca aos N min" das seguintes) */
      if (e.type === "change") { if (c === "min") desenharPers(pers); else if (c !== "graus") el.value = f[c]; }
      sujo = true; aplicar();
    }
    pers.addEventListener("input", campo);
    pers.addEventListener("change", campo);

    if (AIR2S) bloco.style.display = "none";
    c.appendChild(bloco);
  }

  /* o xgPulv nasce depois (pulverizacao.js entra no campo quando a pagina fica pronta): confere de tempos em tempos */
  function aplicar() {
    var W = window.xgPulv && window.xgPulv.vento;
    if (W) {
      if (!ligado) {
        /* guarda o vento sorteado antes de zerar: a tela inicial nao anda o clima, entao base ainda nao existe e, sem isto, ao religar ele voltaria em zero */
        if (!W.desligado) {
          if (!Number.isFinite(W.base)) W.base = Math.max(0, Number(W.vel) || 0);
          if (!Number.isFinite(W.direcaoBase)) W.direcaoBase = Number(W.dir) || 0;
        }
        W.desligado = true; W.vel = 0; W.rajada = 0; if (Array.isArray(W.picos)) W.picos.length = 0;
      } else {
        /* o vento sorteado de antes de qualquer escolha (guardado uma vez), para "Afeta a aplicacao" poder voltar a ele depois do Personalizar */
        if (!orig) orig = { vel: Math.max(0, Number(W.base) || Number(W.vel) || 2), extra: Number.isFinite(W.extra) ? W.extra : 2, dir: Number.isFinite(W.direcaoBase) ? W.direcaoBase : (Number(W.dir) || 0) };
        if (W.desligado) {
          delete W.desligado;
          if (Number.isFinite(W.base)) { W.vel = W.base; W.rajada = W.base; }
        }
        if (personalizado) {
          /* Personalizar: o programa de variacoes (so refaz quando a pessoa muda algo, antes de comecar) */
          if (sujo) { aplicarPrograma(W); sujo = false; }
        } else if (W.programa) {
          /* saiu do Personalizar: volta ao vento sorteado de antes (forca, rajada e direcao), do comeco */
          delete W.programa; delete W.transicao;
          W.base = orig.vel; W.extra = orig.extra; W.vel = orig.vel; W.rajada = orig.vel; W.tempo = 0;
          W.dir = orig.dir; W.direcaoBase = orig.dir;
          if (Array.isArray(W.picos)) W.picos.length = 0;
        }
      }
    }
    var h = document.getElementById("hVento");
    if (h && h.parentNode) h.parentNode.style.display = ligado ? "" : "none";
  }
  window.xgVentoLigado = function () { return ligado; };
  montar();
  setInterval(function () { montar(); aplicar(); }, 500);
})();
