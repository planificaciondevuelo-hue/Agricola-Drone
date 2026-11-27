/* ==========================================================================
   CONTROLE VIRTUAL: O APP DO RC PLUS NA TELA E OS BOTÕES NO TECLADO

   1. A tela do controle virtual (sim.html, #controle) passa a mostrar o
      mesmo app do APK do RC Plus (treinamento/controle-app/, copiado por
      ferramentas/copiar_app_controle.py), por cima das telas antigas.
   2. Cada botão do RC Plus (L1-L3, R1-R3, C1-C3, Pausa, RTH, FPV, 5D,
      Voltar), os manches, as rodas e o botão de pulverização têm uma tecla.
      O aluno troca as teclas no botão "Teclas" do controle virtual; fica
      guardado neste navegador (localStorage "tpd_teclado_rc").
   Os manches, as rodas e a pulverização continuam no manual.js: ele pergunta
   aqui (XG_TECLADO.manche) qual comando cada tecla faz.
   ========================================================================== */
window.XG_TECLADO = (function () {
  "use strict";

  /* Air 2S (13/10/2026, Eduardo: "as teclas tem que ser mudadas"): drone de imagem com o RC-N1,
     sem pulverizacao, vazao, holofote nem os botoes do RC Plus. Lista e chave proprias. */
  var VOO_LIVRE = (function () { try { return /^(air2s)$/.test(new URLSearchParams(location.search).get("modelo") || ""); } catch (e) { return false; } })();
  /* 25/10/2026: o carimbo deste arquivo vai na URL do app do controle; mudou para o navegador baixar o app novo (Redondo com alca e raio ate 10 m) */
  /* 26/10/2026: idem, para baixar o app com o painel do Redondo (raio ate 1000 m) e a Segmentacao de rota com regua */
  /* 26/10/2026 (2): idem, para baixar o app com a borracha do topo que so limpa o rastro do voo */
  var CHAVE = VOO_LIVRE ? "tpd_teclado_fly" : "tpd_teclado_rc";
  var quest = /OculusBrowser|Meta Quest|Quest\/|Quest [23Pro]/i.test(navigator.userAgent), mapaQuest = {};
  // Sem escolha do aluno, o X esquerdo sai do VR (vr_campo.js: um clique). "Sem atalho" desliga.
  // Analógicos ("eixo"): viram os manches do RC enquanto ele está seguro pelas duas laterais.
  var PADRAO_QUEST = { 'left:4': 'sair-vr', 'left:eixo': 'manche-esq', 'right:eixo': 'manche-dir' };
  function seletorQuest(painel, chave, rotulo, opcoes) {
    var linha = el('label','display:flex;align-items:center;gap:16px;margin:12px 0',rotulo);
    var select = el('select','flex:1;padding:8px;background:#111e28;color:white;border:1px solid #8194a1;border-radius:6px');
    opcoes.forEach(a=>{var o=el('option','',a.nome);o.value=a.id;select.appendChild(o);});
    select.value=(chave in mapaQuest?mapaQuest[chave]:PADRAO_QUEST[chave])||'';select.onchange=()=>{mapaQuest[chave]=select.value;try{localStorage.setItem('tpd_quest_botoes',JSON.stringify(mapaQuest));}catch(_){};};
    linha.appendChild(select);painel.appendChild(linha);
  }
  try { mapaQuest = JSON.parse(localStorage.getItem('tpd_quest_botoes') || '{}'); } catch (_) {}
  function abrirQuest() {
    if (caixa) return;
    caixa = el('div', 'position:fixed;inset:0;z-index:100000;background:#081016e8;display:grid;place-items:center;color:white;font:15px system-ui');
    var painel = el('section', 'background:#1b2934;padding:24px;border-radius:14px;width:min(520px,90vw);max-height:85vh;overflow:auto;box-sizing:border-box');
    painel.appendChild(el('h2', 'margin-top:0', 'Controles do Meta Quest'));
    ['Gatilho do indicador: apontar e pressionar botões ou segurar um manche do RC. Também dá para encostar a ponta do controle num botão do RC para apertar.',
      'Teletransporte: aponte para o chão; aperte e solte o gatilho sobre o círculo verde.',
      'Gatilho lateral: segure a carcaça do RC para levantar, abaixar e reposicionar.',
      'Pilotar pelos analógicos: segure o RC com as duas mãos (lateral dos dois controles, cada mão do seu lado do RC). Enquanto estiver seguro assim, os analógicos movem os manches; soltando uma lateral, os manches voltam ao centro.',
      'Mãos livres: toque com o indicador nos botões; faça pinça nos manches ou nas laterais para pegar o RC.',
      'Energia do RC: toque, solte e mantenha o segundo toque por 1,5 segundo.',
      'O RC fica preso ao peito: virar só a cabeça não o move; ao virar o corpo, ele acompanha. Pegue pela lateral para mudar a posição; ao soltar, ele guarda o novo lugar.',
      'Sair do VR: aperte o botão escolhido abaixo (X, se não mudar). O botão Meta continua pertencendo ao sistema.'].forEach(t => painel.appendChild(el('p','line-height:1.5',t)));
    painel.appendChild(el('h3', '', 'Analógicos (com o RC nas duas mãos)'));
    var manches = [{id:'manche-esq',nome:'Manche esquerdo do RC (subir/descer e girar)'},{id:'manche-dir',nome:'Manche direito do RC (frente/trás e lados)'},{id:'',nome:'Não usar'}];
    seletorQuest(painel, 'left:eixo', 'Analógico esquerdo', manches);
    seletorQuest(painel, 'right:eixo', 'Analógico direito', manches);
    painel.appendChild(el('h3', '', 'Atalhos para os botões do RC Plus'));
    var atalhos = [{id:'',nome:'Sem atalho'},{id:'sair-vr',nome:'Sair do VR'}].concat(ACOES.filter(a=>a.tipo==='botao'));
    [['left:4','X'],['left:5','Y'],['right:4','A'],['right:5','B'],['left:3','Apertar analógico esquerdo'],['right:3','Apertar analógico direito']]
      .forEach(function(par) { seletorQuest(painel, par[0], par[1], atalhos); });
    painel.appendChild(el('p','line-height:1.5;color:#b9c6cf','Gatilhos e laterais ficam para apertar e segurar o RC. Os botões Menu (≡) e Meta pertencem aos óculos e não podem ser usados pelo site.'));
    var sair=el('button','padding:10px 20px;border-radius:8px;margin-top:14px','Fechar');sair.onclick=fecharTela;painel.appendChild(sair);
    caixa.appendChild(painel);document.body.appendChild(caixa);
  }
  /* tipo "manche": o código que o manual.js entende; tipo "botao": o nome que o app recebe (botoes.js) */
  var ACOES_AGRAS = [
    { id: "KeyW", grupo: "Manche esquerdo", nome: "Subir", tipo: "manche", padrao: "KeyW" },
    { id: "KeyS", grupo: "Manche esquerdo", nome: "Descer", tipo: "manche", padrao: "KeyS" },
    { id: "KeyA", grupo: "Manche esquerdo", nome: "Girar para a esquerda", tipo: "manche", padrao: "KeyA" },
    { id: "KeyD", grupo: "Manche esquerdo", nome: "Girar para a direita", tipo: "manche", padrao: "KeyD" },
    { id: "ArrowUp", grupo: "Manche direito", nome: "Frente", tipo: "manche", padrao: "ArrowUp" },
    { id: "ArrowDown", grupo: "Manche direito", nome: "Trás", tipo: "manche", padrao: "ArrowDown" },
    { id: "ArrowLeft", grupo: "Manche direito", nome: "Esquerda", tipo: "manche", padrao: "ArrowLeft" },
    { id: "ArrowRight", grupo: "Manche direito", nome: "Direita", tipo: "manche", padrao: "ArrowRight" },
    { id: "Space", grupo: "Pulverização", nome: "Botão de pulverização", tipo: "manche", padrao: "Space" },
    { id: "Equal", grupo: "Rodas", nome: "Roda esquerda: mais vazão", tipo: "manche", padrao: "Equal" },
    { id: "Minus", grupo: "Rodas", nome: "Roda esquerda: menos vazão", tipo: "manche", padrao: "Minus" },
    { id: "PageUp", grupo: "Rodas", nome: "Roda direita: câmera para cima", tipo: "manche", padrao: "PageUp" },
    { id: "PageDown", grupo: "Rodas", nome: "Roda direita: câmera para baixo", tipo: "manche", padrao: "PageDown" },
    { id: "L1", grupo: "Botões de trás", nome: "L1", tipo: "botao", padrao: "KeyQ" },
    { id: "L2", grupo: "Botões de trás", nome: "L2 (holofote)", tipo: "botao", padrao: "KeyE" },
    { id: "L3", grupo: "Botões de trás", nome: "L3", tipo: "botao", padrao: "KeyR" },
    { id: "R1", grupo: "Botões de trás", nome: "R1 (resumo da tarefa)", tipo: "botao", padrao: "KeyU" },
    { id: "R2", grupo: "Botões de trás", nome: "R2 (cancelar)", tipo: "botao", padrao: "KeyI" },
    { id: "R3", grupo: "Botões de trás", nome: "R3 (confirmar)", tipo: "botao", padrao: "KeyO" },
    { id: "C1", grupo: "Botões de cima", nome: "C1", tipo: "botao", padrao: "Digit1" },
    { id: "C2", grupo: "Botões de cima", nome: "C2", tipo: "botao", padrao: "Digit2" },
    { id: "C3", grupo: "Botões de cima", nome: "C3", tipo: "botao", padrao: "Digit3" },
    { id: "PAUSA", grupo: "Botões de cima", nome: "Pausa", tipo: "botao", padrao: "KeyP" },
    { id: "RTH", grupo: "Botões de cima", nome: "RTH (segurar 1,5 s)", tipo: "botao", padrao: "KeyH" },
    { id: "FPV", grupo: "Botões de cima", nome: "FPV / mapa", tipo: "botao", padrao: "KeyF" },
    { id: "5D_CIMA", grupo: "Botão 5D", nome: "5D para cima", tipo: "botao", padrao: "Numpad8" },
    { id: "5D_BAIXO", grupo: "Botão 5D", nome: "5D para baixo", tipo: "botao", padrao: "Numpad2" },
    { id: "5D_ESQUERDA", grupo: "Botão 5D", nome: "5D para a esquerda", tipo: "botao", padrao: "Numpad4" },
    { id: "5D_DIREITA", grupo: "Botão 5D", nome: "5D para a direita", tipo: "botao", padrao: "Numpad6" },
    { id: "5D_CENTRO", grupo: "Botão 5D", nome: "5D apertar", tipo: "botao", padrao: "Numpad5" },
    { id: "VOLTAR", grupo: "Tela", nome: "Voltar", tipo: "voltar", padrao: "Backspace" },
  ];
  /* tipo "fly": vai para o app de voo (APP_FLY.botao); "segurar": o app recebe quanto tempo ficou apertado */
  var ACOES_FLY = [
    { id: "KeyW", grupo: "Manche esquerdo", nome: "Subir", tipo: "manche", padrao: "KeyW" },
    { id: "KeyS", grupo: "Manche esquerdo", nome: "Descer", tipo: "manche", padrao: "KeyS" },
    { id: "KeyA", grupo: "Manche esquerdo", nome: "Girar para a esquerda", tipo: "manche", padrao: "KeyA" },
    { id: "KeyD", grupo: "Manche esquerdo", nome: "Girar para a direita", tipo: "manche", padrao: "KeyD" },
    { id: "ArrowUp", grupo: "Manche direito", nome: "Frente", tipo: "manche", padrao: "ArrowUp" },
    { id: "ArrowDown", grupo: "Manche direito", nome: "Trás", tipo: "manche", padrao: "ArrowDown" },
    { id: "ArrowLeft", grupo: "Manche direito", nome: "Esquerda", tipo: "manche", padrao: "ArrowLeft" },
    { id: "ArrowRight", grupo: "Manche direito", nome: "Direita", tipo: "manche", padrao: "ArrowRight" },
    { id: "PageUp", grupo: "Câmera", nome: "Roda do gimbal: câmera para cima", tipo: "manche", padrao: "PageUp" },
    { id: "PageDown", grupo: "Câmera", nome: "Roda do gimbal: câmera para baixo", tipo: "manche", padrao: "PageDown" },
    { id: "FLY_DISPARO", grupo: "Câmera", nome: "Tirar foto / gravar vídeo", tipo: "fly", alvo: "disparo", padrao: "Space" },
    { id: "FLY_FOTOVIDEO", grupo: "Câmera", nome: "Trocar foto / vídeo", tipo: "fly", alvo: "fotoVideo", padrao: "KeyV" },
    { id: "FLY_FN", grupo: "Câmera", nome: "Fn: câmera para baixo / para a frente", tipo: "fly", alvo: "fn", padrao: "KeyG" },
    { id: "FLY_DECOLAR", grupo: "Voo", nome: "Decolar / pousar (segurar 1 s)", tipo: "fly", alvo: "decolarPousar", segurar: true, padrao: "KeyT" },
    { id: "FLY_H", grupo: "Voo", nome: "H: pausa (toque) / RTH (segurar 1 s)", tipo: "fly", alvo: "pausaRth", segurar: true, padrao: "KeyH" },
    { id: "FLY_MODO", grupo: "Voo", nome: "Modo de voo C / N / S", tipo: "fly", alvo: "modoVoo", padrao: "KeyM" },
    { id: "FLY_BATERIA", grupo: "Voo", nome: "Trocar a bateria (pousado, motores parados)", tipo: "fly", alvo: "bateria", padrao: "KeyB" },
  ];
  var ACOES = VOO_LIVRE ? ACOES_FLY : ACOES_AGRAS;

  var mapa = {};             // id da ação -> tecla (e.code)
  function carregar() {
    var guardado = {};
    try { guardado = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { guardado = {}; }
    mapa = {};
    ACOES.forEach(function (a) { mapa[a.id] = Object.prototype.hasOwnProperty.call(guardado, a.id) ? guardado[a.id] : a.padrao; });
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(mapa)); } catch (e) { /* sem guardar */ } }
  carregar();

  function acaoDaTecla(code) {
    for (var i = 0; i < ACOES.length; i++) if (mapa[ACOES[i].id] === code) return ACOES[i];
    return null;
  }

  /* para o manual.js: a tecla vira o código do manche/roda/pulverização; outra tecla, "" */
  function manche(code) {
    var a = acaoDaTecla(code);
    return a && a.tipo === "manche" ? a.id : "";
  }

  function nomeDaTecla(code) {
    if (!code) return "—";
    var fixos = { Space: "Espaço", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", PageUp: "Page Up",
      PageDown: "Page Down", Minus: "-", Equal: "=", Backspace: "Backspace", Enter: "Enter", Tab: "Tab",
      ShiftLeft: "Shift esq.", ShiftRight: "Shift dir.", ControlLeft: "Ctrl esq.", ControlRight: "Ctrl dir.",
      AltLeft: "Alt", Comma: ",", Period: ".", Slash: ";", Semicolon: "Ç", BracketLeft: "´", BracketRight: "[",
      Backslash: "]", Quote: "~", Backquote: "'", Home: "Home", End: "End", Insert: "Insert", Delete: "Delete" };
    if (fixos[code]) return fixos[code];
    var m = /^Key([A-Z])$/.exec(code); if (m) return m[1];
    m = /^Digit(\d)$/.exec(code); if (m) return m[1];
    m = /^Numpad(.+)$/.exec(code); if (m) return "Num " + m[1].replace("Add", "+").replace("Subtract", "-").replace("Multiply", "*").replace("Divide", "/");
    return code;
  }

  /* ------------------------------------------------ botões do controle */
  var apertados = {};
  function appVirtual() {
    var w = window.__xgAppVirtual;
    try { return w && w.rcplusBotao ? w : null; } catch (e) { return null; }
  }
  function tecla(e, desceu) {
    if (capturando) return;
    var alvo = e.target;
    if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable)) return;
    var manual = window.XG && XG.manual && XG.manual();
    if (manual && manual.demarcando() === "Controlador" && /^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(e.code)) return;
    var a = acaoDaTecla(e.code);
    if (!a) return;
    if (a.tipo === "manche") { e.preventDefault(); return; }       // o manual.js cuida
    e.preventDefault();
    if (a.tipo === "fly") {                                          // Air 2S: app de voo
      var fly = window.APP_FLY;
      if (desceu) {
        if (apertados[a.id]) return;
        apertados[a.id] = performance.now();
        if (!a.segurar && fly) fly.botao(a.alvo, 0);
      } else if (apertados[a.id]) {
        var ms = performance.now() - apertados[a.id];
        delete apertados[a.id];
        if (a.segurar && fly) fly.botao(a.alvo, ms);
      }
      return;
    }
    var app = appVirtual();
    if (!app) return;
    if (desceu) {
      if (apertados[a.id]) return;                                   // tecla segurada repete: um aperto só
      apertados[a.id] = true;
      if (a.tipo === "botao") app.rcplusBotao(a.id, true);
    } else {
      if (!apertados[a.id]) return;
      delete apertados[a.id];
      if (a.tipo === "botao") app.rcplusBotao(a.id, false);
      else if (a.tipo === "voltar" && app.rcplusVoltar) app.rcplusVoltar();
    }
  }
  function soltarTudo() {
    var app = appVirtual();
    Object.keys(apertados).forEach(function (id) { if (app && id !== "VOLTAR" && !/^FLY_/.test(id)) app.rcplusBotao(id, false); });
    apertados = {};
  }
  var ouvindo = [];
  function ouvir(w) {
    if (!w || ouvindo.indexOf(w) >= 0) return;
    ouvindo.push(w);
    w.addEventListener("keydown", function (e) { tecla(e, true); });
    w.addEventListener("keyup", function (e) { tecla(e, false); });
    w.addEventListener("blur", soltarTudo);
  }
  ouvir(window);

  /* ----------------------------- o app do RC Plus na tela do controle virtual */
  function versao() {
    var s = document.querySelector('script[src*="teclado_rc.js"]');
    var m = s && /[?&]v=([^&]+)/.exec(s.getAttribute("src"));
    return m ? m[1] : "1";
  }
  function montarApp() {
    // O prototipo so monta a interface depois da autorizacao administrativa.
    if (new URLSearchParams(location.search).get("modelo") === "j100" && !window.J100_TESTE) return;
    var q = document.getElementById("controle"), doc;
    try { doc = q && q.contentDocument; } catch (e) { doc = null; }
    if (!doc || !doc.body) return;
    try { ouvir(q.contentWindow); } catch (e) { /* segue */ }
    try { ouvir(document.getElementById("campo").contentWindow); } catch (e) { /* segue */ }
    var tela = doc.getElementById("tela");
    if (!tela) return;
    /* T10: a tela do controle e 16:9 (o app do T10 foi gravado assim) */
    if (window.T10_APP && !doc.getElementById("xg-t10-razao")) {
      var est = doc.createElement("style");
      est.id = "xg-t10-razao";
      est.textContent = ".tela{aspect-ratio:16/9!important}";
      doc.head.appendChild(est);
    }
    var ja = doc.getElementById("xg-app-rcplus");
    if (ja) { mostrarSeLigado(doc, ja); return; }
    var f = doc.createElement("iframe");
    f.id = "xg-app-rcplus";
    f.title = "App do controle";
    f.src = "../controle-app/index.html?v=" + versao() + (window.J100_TESTE ? "&interface=j100" : "") + (window.T10_APP ? "&interface=t10" : "");
    f.setAttribute("allow", "autoplay");
    f.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;z-index:60;background:#000";
    tela.appendChild(f);
    mostrarSeLigado(doc, f);
    /* o botao de energia do controle virtual (script.js do controle) passa
       por desligado -> luzes -> logo -> carregando -> pronto: o app so
       aparece com o controle ligado, como no RC Plus */
    if (window.MutationObserver) {
      new MutationObserver(function () { mostrarSeLigado(doc, f); }).observe(doc.body, { attributes: true, attributeFilter: ["class"] });
    }
  }
  function mostrarSeLigado(doc, f) {
    var fase = "pronto";
    try { fase = doc.defaultView.eval("typeof faseControle !== 'undefined' ? faseControle : 'pronto'"); } catch (e) { fase = "pronto"; }
    /* tela apagada (um toque no botao de energia com o controle ligado): o app some junto */
    var ligado = fase === "pronto" && !doc.body.classList.contains("tela-apagada");
    f.style.visibility = ligado ? "visible" : "hidden";
  }
  setInterval(montarApp, 1000);

  /* -------------------------------------------------- tela de configurar */
  var capturando = null, caixa = null;
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }

  function abrir() {
    if (quest) return abrirQuest();
    if (caixa) return;
    caixa = el("div", "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(8,12,16,.78);font-family:Asap,system-ui,sans-serif");
    var painel = el("div", "width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);display:flex;flex-direction:column;" +
      "border-radius:14px;background:#1B232B;color:#E8EDF2;box-shadow:0 10px 40px rgba(0,0,0,.5)");
    var topo = el("div", "display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #2C3741");
    topo.appendChild(el("b", "flex:1;font-size:18px", "Teclas do controle virtual"));
    var fechar = el("button", "padding:6px 14px;border-radius:8px;border:1px solid #4A5866;background:transparent;color:#E8EDF2;cursor:pointer", "Fechar");
    fechar.type = "button";
    fechar.onclick = fecharTela;
    topo.appendChild(fechar);
    painel.appendChild(topo);
    painel.appendChild(el("p", "margin:12px 20px 0;font-size:13px;line-height:1.5;color:#C3CCD5",
      "Toque em uma tecla da lista e aperte a tecla nova no teclado. Esc cancela. A troca vale neste navegador."));
    var lista = el("div", "overflow:auto;padding:8px 20px 12px");
    painel.appendChild(lista);
    var rodape = el("div", "display:flex;justify-content:flex-end;padding:12px 20px;border-top:1px solid #2C3741");
    var padrao = el("button", "padding:8px 14px;border-radius:8px;border:1px solid #4A5866;background:transparent;color:#E8EDF2;cursor:pointer", "Voltar ao padrão");
    padrao.type = "button";
    padrao.onclick = function () {
      ACOES.forEach(function (a) { mapa[a.id] = a.padrao; });
      salvar(); desenhar();
    };
    rodape.appendChild(padrao);
    painel.appendChild(rodape);
    caixa.appendChild(painel);
    caixa.addEventListener("click", function (e) { if (e.target === caixa) fecharTela(); });
    document.body.appendChild(caixa);

    function desenhar() {
      lista.innerHTML = "";
      var grupo = null;
      ACOES.forEach(function (a) {
        if (a.grupo !== grupo) {
          grupo = a.grupo;
          lista.appendChild(el("p", "margin:14px 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#7FD37A", grupo));
        }
        var linha = el("div", "display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #26313A");
        linha.appendChild(el("span", "flex:1;font-size:14px", a.nome));
        var b = el("button", "min-width:110px;padding:7px 12px;border-radius:8px;border:1px solid #4A5866;" +
          "background:" + (capturando === a.id ? "#2F6B2C" : "#222C35") + ";color:#fff;font-size:14px;cursor:pointer",
          capturando === a.id ? "Aperte a tecla…" : nomeDaTecla(mapa[a.id]));
        b.type = "button";
        b.onclick = function () { capturando = a.id; desenhar(); };
        linha.appendChild(b);
        lista.appendChild(linha);
      });
    }
    abrir.desenhar = desenhar;
    desenhar();
  }
  function fecharTela() {
    capturando = null;
    if (caixa && caixa.parentNode) caixa.parentNode.removeChild(caixa);
    caixa = null;
  }
  /* a tecla nova: pega antes de tudo (fase de captura) */
  window.addEventListener("keydown", function (e) {
    if (!capturando) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code !== "Escape") {
      /* a tecla já era de outra ação: troca as duas de lugar */
      var antiga = mapa[capturando], dona = acaoDaTecla(e.code);
      if (dona && dona.id !== capturando) mapa[dona.id] = antiga;
      mapa[capturando] = e.code;
      salvar();
    }
    capturando = null;
    if (abrir.desenhar) abrir.desenhar();
  }, true);

  /* o botão "Teclas" no canto do controle virtual */
  function botaoTeclas() {
    if (!quest && window.DISPOSITIVO_SIM && DISPOSITIVO_SIM.movel) return;
    var ap = document.getElementById("aparelho");
    if (!ap || document.getElementById("xg-bt-teclas")) return;
    /* no canto de baixo da janela, fora do desenho do controle; so com a vista Controle */
    var b = el("button", "position:fixed;left:12px;bottom:12px;z-index:9000;display:flex;align-items:center;gap:8px;" +
      "padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(20,26,32,.85);" +
      "color:#fff;font:600 14px Asap,system-ui,sans-serif;cursor:pointer", "⌨ Teclas");
    b.id = "xg-bt-teclas";
    if (quest) { b.textContent = 'Quest'; b.setAttribute('aria-label', 'Controles do Meta Quest'); }
    b.type = "button";
    b.title = quest ? 'Controles e atalhos do Meta Quest' : "Configurar as teclas de cada botão do controle";
    b.onclick = abrir;
    document.body.appendChild(b);
    setInterval(function () { b.style.display = ap.classList.contains("esconder") ? "none" : "flex"; }, 400);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", botaoTeclas); else botaoTeclas();

  return { manche: manche, abrir: abrir, nomeDaTecla: nomeDaTecla, mapa: function () { return mapa; }, quest: function () { return Object.assign({},PADRAO_QUEST,mapaQuest); } };
})();
