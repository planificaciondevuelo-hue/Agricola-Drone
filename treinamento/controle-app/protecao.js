/* Estados de proteção vêm da física; um setor vermelho sozinho não é uma
   frenagem. Referência visual: gravação 8, telas 0046/0048/0087/0152/0164. */
(function () {
  "use strict";
  var fechado = null, chave = null;
  var painel = el("section", "protecao-painel");
  painel.hidden = true;
  painel.setAttribute("aria-live", "polite");
  var faixa = el("div", "protecao-inferior"); faixa.hidden = true;
  var barra = el("div", "protecao-altura"); barra.hidden = true;
  $("#t-mapa").appendChild(faixa);
  $("#t-mapa").appendChild(barra);
  $("#t-mapa").appendChild(painel);
  $("#alertas").addEventListener("click", function (ev) {
    if (!ev.target.closest('[data-id="pedestres"]')) return;
    dialogo({ icone: "alerta", titulo: "Pedestres ou obstáculos detectados perto da aeronave. Não é possível decolar",
      texto: "0X1610, 0Xb8,index:0", botoes: [{ t: "Fechar(R2)" }] });
  });

  window.orientacaoRadar = function (a) {
    var x = Math.sin(a || 0), y = Math.cos(a || 0);
    if (Math.abs(x) > Math.abs(y)) return "Mova a aeronave para " + (x > 0 ? "a esquerda" : "a direita") + " para evitar obstáculos";
    return "Mova a aeronave para " + (y >= 0 ? "trás" : "frente") + " para evitar obstáculos";
  };
  function fechar() { fechado = chave; painel.hidden = true; }
  window.protecaoR2 = function () {
    if (typeof dialogoAberto !== "undefined" && dialogoAberto) return false;
    if (painel.hidden || !chave || chave.indexOf("inferior:") !== 0) return false;
    fechar(); return true;
  };
  function controle(a) {
    /* Ilustração vetorial do manche direito: orientação oposta ao obstáculo. */
    return '<svg class="protecao-controle" viewBox="0 0 460 280" aria-label="Direção para afastar a aeronave">' +
      '<rect x="20" y="35" width="420" height="220" rx="44" fill="#737777" stroke="#424848" stroke-width="8"/>' +
      '<rect x="112" y="63" width="230" height="158" rx="8" fill="#292d30" stroke="#aaa" stroke-width="7"/>' +
      '<circle cx="68" cy="116" r="28" fill="#343b3c"/>' +
      '<g transform="translate(391 116) rotate(' + ((a || 0) * 180 / Math.PI) + ')">' +
      '<circle r="31" fill="none" stroke="#12cd80" stroke-width="5"/><circle r="14" fill="#12cd80"/>' +
      '<path d="M-13 24H13V58H27L0 89-27 58H-13Z" fill="#12cd80"/></g></svg>';
  }
  function atualizar() {
    var E = APP.E, p = E && E.protecao;
    var ativo = APP.conectado && E && E.v && E.v.estado !== "caiu";
    var ligado = ativo && (!E.p || E.p.desvio !== false);
    var h = ligado && p && p.horizontal, b = ligado && p && p.inferior;
    var s = ligado && p && p.superior, vertical = s || b;
    // 0087–0094: objeto abaixo tem barra/painel, nunca arco no topo.
    faixa.hidden = !s || !Number.isFinite(s.distanciaHorizontal);
    // A barra usa altura; a presença do arco não depende deste limite.
    barra.hidden = !vertical || vertical.distancia > 5;
    if (vertical) {
      var lado = s ? "superior" : "inferior";
      faixa.dataset.lado = barra.dataset.lado = lado;
      if (s && Number.isFinite(s.distanciaHorizontal)) {
        faixa.setAttribute("aria-label", "Distância horizontal ao obstáculo acima: " + num(s.distanciaHorizontal, 1) + " metros");
        faixa.textContent = num(s.distanciaHorizontal, 1) + "m";
      }
      var altura = Math.max(3, Math.min(216, (5 - vertical.distancia) * 20));
      barra.innerHTML = '<b>' + virg(vertical.distancia, 1) + '</b><i style="height:' + altura.toFixed(1) + 'px;background:' + (vertical.distancia <= 3 ? '#e3353c' : '#d0bb00') + '"></i>';
    }
    var nova = h && h.painel ? "horizontal:" + h.id : b && b.bloqueado ? "inferior:" + b.id : null;
    if (!nova) { chave = null; fechado = null; painel.hidden = true; return; }
    if (nova !== chave) {
      chave = nova;
      if (nova.indexOf("horizontal:") === 0) {
        painel.innerHTML = '<div class="protecao-texto"><span class="protecao-icone">!</span>' +
          'Prevenção de obstáculos de emergência em andamento. <strong>' + orientacaoRadar(h.direcao) + '</strong></div>' +
          controle(h.direcao) + '<button class="protecao-fechar" aria-label="Fechar aviso">×</button>';
        painel.querySelector("button").onclick = fechar;
      } else {
        painel.innerHTML = '<div class="protecao-texto"><span class="protecao-icone">!</span>' +
          '<b>Obstáculo detectado abaixo da aeronave</b><strong>Continue ou empurre o pino de controle para cima para se afastar.</strong>' +
          '<p>Desative a função de desvio de obstáculos para continuar a descida.</p></div>' +
          '<button class="protecao-proximo">Próximo(R2)</button><button class="protecao-desativar">Desativar e continuar</button>';
        painel.querySelector(".protecao-proximo").onclick = fechar;
        painel.querySelector(".protecao-desativar").onclick = function () {
          M.P.desvio = false; salvarP();
          cmd("p", { v: { desvio: false } });
          /* A física confirma a mudança no próximo estado recebido. */
          fechar();
        };
      }
    }
    painel.hidden = fechado === chave;
  }
  ouvir("estado", atualizar);
  ouvir("conexao", atualizar);
})();
