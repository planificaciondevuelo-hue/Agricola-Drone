/* Botões físicos do RC Plus → ações do app (como no Agras).
   O Java chama rcplusBotao(nome, apertou). Nomes:
     L1 L2 L3 R1 R2 R3, 5D_CIMA 5D_BAIXO 5D_ESQUERDA 5D_DIREITA 5D_CENTRO, PULV, FPV  (teclas do Android)
     C1 C2 C3 PAUSA RTH INDICADOR, CHAVE_N CHAVE_S CHAVE_F  (canal interno da DJI, porta 40007)
   Mapa dos botões: teste do Gravador de Telas (relatorios_botoes, 01/10/2026). */
(function () {
  var segurando = {};          // nome -> horário em que apertou
  var timers = {};
  var SEGURAR_MS = 1000;
  var RTH_MS = 1500;           // RTH: segurar 1,5 s (24/10/2026, pedido dele)

  /* no ar de verdade: caída, no chão, concluída ou abastecendo não conta
     (Fase 0, 0.5); com os sensores do jogo, só fora do chão */
  function voando() {
    var E = APP.E;
    if (!E || !E.v || ["em solo", "concluído", "caiu", "reabastecendo"].indexOf(E.v.estado) >= 0) return false;
    return !(E.sens && E.sens.chao);
  }
  function estado() { return APP.E && APP.E.v ? APP.E.v.estado : ""; }
  function aviso(t) { if (window.avisoInfo) avisoInfo(t); else toast(t); }

  /* Funções escolhidas em Configurações > Personalização dos botões (config.js, CFG.local["b:X"]) */
  var PADRAO = { L1: "Adicionar ponto", L2: "Interruptor de holofote", L3: "Estabilizador de inclinação para baixo/recentralização",
    C1: "Defina o Ponto A (Rota A-B)", C2: "Defina o Ponto B (Rota A-B)", C3: "Adicionar ponto",
    "5D_CIMA": "Indefinida", "5D_BAIXO": "Indefinida", "5D_ESQUERDA": "Indefinida", "5D_DIREITA": "Indefinida", "5D_CENTRO": "Indefinida" };
  var NOME_CFG = { "5D_CIMA": "Para cima", "5D_BAIXO": "Para baixo", "5D_ESQUERDA": "Esquerda", "5D_DIREITA": "Direita", "5D_CENTRO": "Centro" };
  function funcaoDe(nome) {
    var local = window.CFG && CFG.local ? CFG.local["b:" + (NOME_CFG[nome] || nome)] : null;
    return local || PADRAO[nome] || "Indefinida";
  }

  function executar(f) {
    switch (f) {
      case "Indefinida": return false;
      case "Defina o Ponto A (Rota A-B)":
        return !!(window.ROTA_AB && ROTA_AB.marcar("a"));
      case "Defina o Ponto B (Rota A-B)":
        return !!(window.ROTA_AB && ROTA_AB.marcar("b"));
      case "Adicionar ponto":
        if (window.M && M.sub === "edicao" && window.adicionarPonto) { adicionarPonto(); return true; }
        return false;
      case "Interruptor de holofote":
        /* os 4 LEDs da frente do T50 (jogo: app_rcplus.js "holofote") */
        APP.holofote = !APP.holofote;
        cmd("holofote", { v: APP.holofote });
        return true;
      case "Ativar/desativar desvio de obstáculos multidirecional":
        M.P.desvio = !M.P.desvio; salvarP(); enviarP(); if (window.montar) montar();
        aviso("desvio de obstáculos multidirecional " + (M.P.desvio ? "ativada" : "desativada"));
        return true;
      default:
        /* função ainda não feita: fica muda, como um botão sem efeito (sem meta-texto) */
        return true;
    }
  }

  /* botão segurado: depois de SEGURAR_MS chama fn uma vez */
  function aoSegurar(nome, apertou, fn, ms) {
    clearTimeout(timers[nome]);
    if (apertou) timers[nome] = setTimeout(function () { segurando[nome] = "feito"; fn(); }, ms || SEGURAR_MS);
  }

  var registro = window.rcplusRegistroBotoes = [];      // últimos botões (para conferir pelo cabo)
  window.rcplusBotao = function (nome, apertou) {
    registro.push(nome + (apertou ? " ↓" : " ↑"));
    if (registro.length > 60) registro.shift();
    var antes = segurando[nome];
    if (apertou) segurando[nome] = Date.now(); else delete segurando[nome];
    var segurou = antes === "feito";

    switch (nome) {
      /* R2 = cancelar, R3 = confirmar nos diálogos; R3 segurado = deslizar da verificação */
      case "R2":
        if (!apertou) {
          if (window.protecaoR2 && protecaoR2()) return;
          if (teclaFisica("R2")) return;
          var min = document.querySelector(".min");
          if (min) min.click();
        }
        return;
      case "R3":
        aoSegurar("R3", apertou, function () { if (window.rcplusSegurarR3) window.rcplusSegurarR3(); });
        if (!apertou && !segurou) teclaFisica("R3");
        return;

      case "FPV":
        if (apertou) trocarFpv(!document.body.classList.contains("fpv-cheia"));
        return;

      /* RTH: segurar inicia; um toque durante o retorno cancela (a aeronave para e paira) */
      case "RTH":
        if (apertou && estado() === "voltando") { cmd("pausar"); aviso("RTH cancelado"); segurando.RTH = "feito"; return; }
        aoSegurar("RTH", apertou, function () {
          if (!voando()) return;          // fora do voo: nada (sem meta-texto)
          cmd("rth"); aviso("Retornando ao ponto de origem");
        }, RTH_MS);
        return;

      /* Pausa = freio de emergência em voo automático, retomada, RTH e pouso.
         O aviso vem do jogo: o cartão "Tarefa pausada" quando o estado muda */
      case "PAUSA":
        if (!apertou) return;
        if (["aplicando", "indo", "voltando", "subindo", "descendo", "pairando", "pousando"].indexOf(estado()) >= 0) cmd("pausar");
        return;

      /* Botão de pulverização: vai ao jogo pelo bit 0 do pacote UDP (manual.js);
         o app só mostra o cartão quando o jogo confirmar (recado no estado) */
      case "PULV":
        return;

      case "CHAVE_N": case "CHAVE_F": case "CHAVE_S": {
        /* no padrão a posição da chave não muda nada (piloto #9): sem aviso */
        APP.chaveModo = nome.slice(-1);
        return;
      }

      case "INDICADOR":
        return;      // reservado no RC Plus do Agras

      /* R1 na execução: abre/minimiza o Resumo da tarefa (g6 #0286 / #0174) */
      case "R1":
        if (apertou && window.alternarResumo && window.alternarResumo()) return;
        /* fora da execução: como os outros (botão "(R1)" de janela ou função escolhida) */
      case "L1": case "L2": case "L3":
      case "C1": case "C2": case "C3":
      case "5D_CIMA": case "5D_BAIXO": case "5D_ESQUERDA": case "5D_DIREITA": case "5D_CENTRO":
        if (!apertou) return;
        /* aviso na tela que cita o botão (ex.: "OK(L1)"): o físico aperta ele */
        if (dialogoAberto) {
          var alvo = Array.prototype.filter.call(dialogoAberto.camada.querySelectorAll("button"), function (b) {
            return b.textContent.indexOf("(" + nome + ")") >= 0;
          })[0];
          if (alvo) { alvo.click(); return; }
        }
        executar(funcaoDe(nome));
        return;
    }
  };

  /* Voltar do RC Plus (manual p.16 item 6; p.23-24; p.29). O Java consome a
     tecla (e o deslize da borda, que vira a mesma tecla) e chama esta função.
     Um toque volta um nível; dois em até 0,5 s vão direto à tela inicial. */
  var voltouEm = 0;
  function visivel(b) { return !!(b && b.offsetParent !== null); }
  function abertoCfg() { var c = $("#cfg"); return !!(c && c.classList.contains("aberto")); }
  function abertoExtra() { var x = $("#extra"); return !!(x && x.classList.contains("aberto")); }
  function irParaInicio() {
    if (window.fecharDialogo) fecharDialogo();
    $$(".lista-sus").forEach(function (l) { l.remove(); });
    if (window.fecharFlutuantes) fecharFlutuantes();
    var v = $(".verif");
    if (v && !$(".conta", v)) { var mn = $(".min", v); if (mn) mn.click(); }
    if (window.fecharConfig) fecharConfig();
    if (window.fecharExtra) fecharExtra();
    mostrar("inicial");
  }
  function voltarUm() {
    /* 1. diálogo: o "Cancelar(R2)" dele; sem ele, só fecha (o obstáculo não manda rth) */
    if (dialogoAberto) {
      var bots = $$(".botoes button", dialogoAberto.camada);
      if (bots.length && bots[0].textContent.indexOf("(R2)") >= 0) bots[0].click(); else fecharDialogo();
      return;
    }
    /* 2. verificação antes da tarefa: minimiza (na contagem, nada) */
    var v = $(".verif");
    if (v) { if (!$(".conta", v)) { var mn = $(".min", v); if (mn) mn.click(); } return; }
    /* 3. lista suspensa  4. janelinhas da barra e tipo de mapa */
    var ls = $(".lista-sus");
    if (ls) { ls.remove(); return; }
    if ($(".janelinha,.tipo-mapa")) { if (window.fecharFlutuantes) fecharFlutuantes(); return; }
    /* 5. painel que substitui o lateral (prescrição, retificar, lados): o "Cancelar(R2)" */
    if (!abertoCfg() && !abertoExtra() && APP.tela === "mapa") {
      var r2 = $$("#t-mapa button").filter(function (b) { return visivel(b) && b.textContent.indexOf("(R2)") >= 0; })[0];
      if (r2) { r2.click(); return; }
    }
    /* 6. configurações: sub-tela volta um nível; senão fecha */
    if (abertoCfg()) {
      if (window.CFG && CFG.sub) {
        var pg = window.PAG && PAG[CFG.pag], sub = pg && pg.subs && pg.subs[CFG.sub];
        CFG.sub = (sub && sub.volta) || null;
        montarCfg();
      } else fecharConfig();
      return;
    }
    /* 7. telas extras: sub-tela, seleção, fecha */
    if (abertoExtra()) {
      if (window.EX && EX.sub) { EX.sub = null; montarExtra(); }
      else if (window.EX && EX.sel) { EX.sel = false; EX.marcados = []; montarExtra(); }
      else fecharExtra();
      return;
    }
    /* 8. escolha de modo -> mapa  9. mapa -> tela inicial */
    if (APP.tela === "modos") { mostrar("mapa"); return; }
    if (APP.tela === "mapa") { mostrar("inicial"); return; }
  }
  window.rcplusVoltar = function () {
    var agora = Date.now(), duplo = agora - voltouEm < 500;
    voltouEm = duplo ? 0 : agora;
    if (duplo) irParaInicio(); else voltarUm();
  };
})();
