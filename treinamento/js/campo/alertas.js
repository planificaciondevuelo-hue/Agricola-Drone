/* ==========================================================================
   OS ALERTAS DO APP (a pilha do canto de cima, à esquerda)

   No RC Plus de verdade (gravação "drone conectado", 30/09/2026) os alertas
   ficam empilhados embaixo da barra de estado: vermelho impede a decolagem,
   amarelo pede atenção e cinza só informa. O HTML do controle trazia uma
   pilha fixa de exemplo, que a operação esconde porque nada ali era verdade
   no treinamento. Aqui a pilha é montada a partir do estado do jogo, e só
   com os textos que o aparelho mostrou:

   vermelho  Pedestres ou obstáculos perto da aeronave (radar, no chão)
             desvio de obstáculos multidirecional desativada
   amarelo   Não há mais carga líquida (tanque vazio)
   cinza     desvio multidirecional ativada / Desvio de obstáculos
             habilitado ou desabilitado / Bypass ajustando a altura para
             8,0 m / Ponto de origem registrado / travas do braço

   E o "Iniciar": com gente ou obstáculo a menos de 6 m da aeronave no chão,
   o aparelho pergunta antes ("Pessoa/obstáculo detectado em um 6.0m raio").
   Não mexe no operacao.js: embrulha a operação quando ela é criada.
   ========================================================================== */

(function () {
  "use strict";

  var RAIO_DECOLAGEM = 6;      // m, o mesmo número do diálogo do aparelho
  var VIDA_INFO = 8000;        // ms que um alerta cinza fica na tela

  var CSS = [
    ".xg-alertas{position:absolute;left:1cqw;top:6.4cqw;width:26cqw;z-index:12;display:flex;",
    "  flex-direction:column;gap:.5cqw;pointer-events:none}",
    "[data-tela='execucao'] .xg-alertas{left:26cqw}",
    "body.app-modo-manual [data-tela='mapa'] .xg-alertas{left:26cqw}",
    ".xg-alerta{pointer-events:auto;display:flex;gap:.6cqw;align-items:flex-start;border-radius:.3cqw;",
    "  padding:.7cqw .9cqw;font-size:1.5cqw;line-height:1.4;color:#2f3336;background:rgba(240,240,239,.95)}",
    ".xg-alerta.vermelho{background:rgba(214,52,46,.92);color:#fff}",
    ".xg-alerta.amarelo{background:rgba(222,196,30,.95);color:#2f3336}",
    ".xg-alerta span{flex:1}",
    ".xg-alerta button{background:transparent;border:0;cursor:pointer;font-size:1.8cqw;color:inherit;padding:0;line-height:1}",
  ].join("\n");

  function Alertas(op) {
    this.op = op;
    this.ativos = {};          // id -> { tipo, texto, fechado, ate }
    this.antes = {};           // último valor de cada chave, para avisar a troca
    this.instalado = null;
  }

  Alertas.prototype.instalar = function (doc) {
    if (this.instalado === doc) return;
    this.instalado = doc;
    /* o app (telas_drone.js) avisa por aqui, para cair na mesma pilha */
    var self = this;
    doc.defaultView.__xgAlertar = function (texto) { self.informar("app-" + texto, texto); };
    if (!doc.getElementById("xg-alertas-css")) {
      var s = doc.createElement("style");
      s.id = "xg-alertas-css";
      s.textContent = CSS;
      doc.head.appendChild(s);
    }
    var telas = doc.querySelectorAll("[data-tela='mapa'], [data-tela='execucao']");
    for (var i = 0; i < telas.length; i++) {
      if (telas[i].querySelector(".xg-alertas")) continue;
      var p = doc.createElement("div");
      p.className = "xg-alertas";
      telas[i].appendChild(p);
    }
  };

  /* vermelho e amarelo ficam enquanto a condição for verdade (o X do amarelo
     esconde até ela mudar); cinza aparece na troca e some sozinho */
  Alertas.prototype.condicao = function (id, verdade, tipo, texto) {
    var a = this.ativos[id];
    if (verdade) {
      if (!a) this.ativos[id] = { tipo: tipo, texto: texto, fechado: false };
      else a.texto = texto;
    } else if (a) {
      delete this.ativos[id];
    }
  };

  Alertas.prototype.informar = function (id, texto) {
    this.ativos[id] = { tipo: "info", texto: texto, fechado: false, ate: Date.now() + VIDA_INFO };
  };

  /* avisa quando um valor muda (e não na primeira leitura) */
  Alertas.prototype.mudou = function (chave, valor) {
    var antes = this.antes[chave];
    this.antes[chave] = valor;
    return antes !== undefined && antes !== valor;
  };

  Alertas.prototype.obstaculoPerto = function () {
    var lidos = this.op.ponte.radar(RAIO_DECOLAGEM) || [];
    var menor = Infinity;
    for (var i = 0; i < lidos.length; i++) menor = Math.min(menor, lidos[i][1]);
    return menor;
  };

  Alertas.prototype.atualizar = function (doc, e) {
    if (!doc || !e || !e.voo) return;
    this.instalar(doc);

    var v = e.voo, p = e.parametros || {};
    var conectado = doc.body.classList.contains("conectado");
    var voando = !!(v.estado && v.estado !== "em solo" && v.estado !== "concluído" && v.estado !== "caiu");

    if (!conectado) {
      this.ativos = {};
      this.antes = {};
      this.desenhar(doc, false);
      return;
    }

    /* ao conectar, o aparelho lembra das travas dos braços */
    if (this.mudou("conectado", true) || this.antes.travas === undefined) {
      this.antes.travas = true;
      this.informar("travas", "Aperte todas as travas do braço com segurança para evitar possíveis riscos de segurança");
    }

    /* --- vermelhos --- */
    var perto = voando ? Infinity : this.obstaculoPerto();
    this.perto = perto;
    this.condicao("pedestres", perto < RAIO_DECOLAGEM, "vermelho",
      "Pedestres ou obstáculos detectados perto da aeronave. Não é possível decolar");
    this.condicao("multi-off", p.desvio === false, "vermelho",
      "desvio de obstáculos multidirecional desativada. A aeronave não freia automaticamente. Pilote com cuidado");

    /* --- amarelo --- */
    this.condicao("sem-carga", (v.tanque || 0) <= 0.05, "amarelo",
      "Não há mais carga líquida. Aterrisse e reabasteça");

    /* --- cinzas, na troca --- */
    if (this.mudou("multi", p.desvio) && p.desvio) {
      this.informar("multi-on", "desvio de obstáculos multidirecional ativada");
    }
    if (this.mudou("contornar", p.xgContornar)) {
      if (p.xgContornar) {
        this.informar("contornar", "Desvio de obstáculos habilitado");
        /* com o desvio ligado a altura acima das culturas fica entre 2,5 e 8,0 m */
        if (typeof p.altura === "number" && p.altura > 8) {
          this.informar("bypass", "Bypass de obstáculos habilitado. Altura acima das culturas ajustada para 8,0 m");
        }
      } else {
        this.informar("contornar", "Desvio de obstáculos desabilitado.");
      }
    }
    if (this.mudou("voando", voando) && voando) {
      this.informar("origem", "Ponto de origem registrado");
    }

    /* cinzas vencidos saem */
    var agora = Date.now();
    for (var id in this.ativos) {
      if (this.ativos[id].ate && this.ativos[id].ate < agora) delete this.ativos[id];
    }

    /* faixa de cima: com vermelho no chão, "Incapaz de decolar" (no ar quem
       escreve é a operação) */
    if (!voando) {
      var temVermelho = false;
      for (var k in this.ativos) if (this.ativos[k].tipo === "vermelho") temVermelho = true;
      this.op.avisar(temVermelho ? "Incapaz de decolar" : "");
    }

    this.desenhar(doc, true);
  };

  Alertas.prototype.desenhar = function (doc, mostrar) {
    var ordem = { vermelho: 0, amarelo: 1, info: 2 };
    var lista = [];
    for (var id in this.ativos) if (!this.ativos[id].fechado) lista.push([id, this.ativos[id]]);
    lista.sort(function (a, b) { return ordem[a[1].tipo] - ordem[b[1].tipo]; });

    var html = mostrar ? lista.map(function (x) {
      var a = x[1];
      return '<div class="xg-alerta ' + a.tipo + '" data-id="' + x[0] + '"><span>' + a.texto + " &gt;&gt;</span>" +
        (a.tipo === "vermelho" ? "" : '<button aria-label="Fechar">×</button>') + "</div>";
    }).join("") : "";

    if (html === this.desenhado) return;
    this.desenhado = html;

    var self = this;
    var pilhas = doc.querySelectorAll(".xg-alertas");
    for (var i = 0; i < pilhas.length; i++) {
      pilhas[i].innerHTML = html;
      var bots = pilhas[i].querySelectorAll("button");
      for (var j = 0; j < bots.length; j++) {
        bots[j].addEventListener("click", function () {
          var id = this.parentNode.dataset.id;
          if (self.ativos[id]) self.ativos[id].fechado = true;
          self.desenhar(doc, true);
        });
      }
    }
  };

  /* --------------------------------------------- o Iniciar com gente perto */

  function perguntarAntes(op, alertas, seguir) {
    var doc = op.doc();
    var tela = doc && doc.querySelector(".tela-app.ativa");
    if (!tela || !(alertas.perto < RAIO_DECOLAGEM)) return seguir();
    var fundo = doc.createElement("div");
    fundo.className = "dialogo-fundo aberto dialogo-app";
    fundo.style.zIndex = "40";
    fundo.innerHTML =
      '<div class="dialogo" style="width:40cqw;text-align:center">' +
        '<div style="display:flex;align-items:center;gap:1.4cqw;background:#f4f4f3;border-radius:.8cqw;padding:1.2cqw;margin-bottom:1.4cqw">' +
          '<svg viewBox="0 0 120 60" style="width:14cqw;height:7cqw;flex:none">' +
            '<ellipse cx="54" cy="44" rx="48" ry="12" fill="none" stroke="#f08a24" stroke-width="2"/>' +
            '<ellipse cx="54" cy="44" rx="30" ry="7" fill="rgba(240,138,36,.18)"/>' +
            '<g fill="#3c4245"><rect x="40" y="26" width="28" height="9" rx="3"/><path d="M30 24h14M64 24h14" stroke="#3c4245" stroke-width="3"/>' +
            '<path d="M46 35v6M62 35v6" stroke="#3c4245" stroke-width="2"/></g>' +
            '<g fill="#e8442e"><circle cx="100" cy="16" r="5"/><rect x="95" y="22" width="10" height="20" rx="3"/></g></svg>' +
          '<b style="font-size:1.9cqw;color:#2f3336;font-weight:600;text-align:left">Pessoa/obstáculo detectado em um 6.0m raio</b>' +
        '</div>' +
        '<p class="texto-aviso">Confirme se os avisos estão liberados e pressione os pinos de controle para decolar</p>' +
        '<div class="botoes-dialogo"><button class="xg-nao">Cancelar(R2)</button>' +
        '<button class="vermelho xg-sim">Confirmar(R3)</button></div>' +
      '</div>';
    tela.appendChild(fundo);
    fundo.querySelector(".xg-nao").addEventListener("click", function () { fundo.remove(); });
    fundo.querySelector(".xg-sim").addEventListener("click", function () { fundo.remove(); seguir(); });
  }

  /* ------------------------------------------------- ligar na operação */

  var antigo = window.OPERACAO && window.OPERACAO.criar;
  if (!antigo) return;
  window.OPERACAO.criar = function (ponte, quadro) {
    var op = antigo.apply(this, arguments);
    var alertas = new Alertas(op);
    op.alertasApp = alertas;

    var atualizar = op.atualizar;
    op.atualizar = function (e) {
      var r = atualizar.apply(this, arguments);
      try { alertas.atualizar(this.doc(), e); } catch (erro) { /* o controle pode estar recarregando */ }
      return r;
    };

    var comecar = op.comecarSequencia;
    op.comecarSequencia = function () {
      var self = this, args = arguments;
      perguntarAntes(self, alertas, function () { comecar.apply(self, args); });
    };
    return op;
  };
})();
