/* ==========================================================================
   OS AJUSTES DO CONTROLE CHEGANDO AO VOO

   Cada chave do app que muda o comportamento da aeronave tem de mudar o
   drone do campo. Conferido contra o relatorio dos videos dele (o RC Plus
   de verdade):

     desvio de obstaculos multidirecional  o radar freia antes do obstaculo
     Estabilizacao da altitude             a aeronave segue o terreno
     Desvio de obstaculos                  tenta contornar (chave separada)
     Cenario Planicies/Colina-Pomar/Agua   como o desvio se comporta
     RTH velocidade e altitude             a volta a base (e a subida na
                                           decolagem)
     Sistemas de pulverizacao              desligado, voa a rota sem soltar
     Distancia e altitude maximas          limites do voo

   O controle dele tem VARIOS desses ajustes em dois lugares - nas
   Configuracoes da aeronave e na aba Voo da tela de execucao - e os dois
   nascem com valores diferentes. No aparelho e o mesmo ajuste. Aqui os
   dois andam juntos: comecam pelo da aba Voo (que bate com os videos:
   multidirecional e estabilizacao ligados, RTH 36 km/h e 7 m) e depois o
   ultimo que o aluno mexeu vale para os dois.
   ========================================================================== */

window.AJUSTES = (function () {
  "use strict";

  function normal(t) { return String(t || "").replace(/\s+/g, " ").trim().toLowerCase(); }

  /* --------------------------------------------- achar os ajustes na tela */

  /* chave (interruptor) pelo texto do rotulo, dentro de um pedaco da tela */
  function chave(raiz, teste) {
    if (!raiz) return null;
    var linhas = raiz.querySelectorAll(".linha-toggle-config");
    for (var i = 0; i < linhas.length; i++) {
      var rot = linhas[i].querySelector(".rotulo-toggle");
      var bot = linhas[i].querySelector(".interruptor");
      if (rot && bot && teste(normal(rot.textContent))) return bot;
    }
    return null;
  }

  /* deslizador das configuracoes: o rotulo fica no bloco de cima */
  function faixa(raiz, teste) {
    if (!raiz) return null;
    var faixas = raiz.querySelectorAll(".faixa");
    for (var i = 0; i < faixas.length; i++) {
      var rot = faixas[i].previousElementSibling;
      var barra = faixas[i].querySelector("input[type='range']");
      if (rot && barra && teste(normal(rot.textContent))) return barra;
    }
    return null;
  }

  var MULTI = function (t) { return /multidirecional/.test(t); };
  var ESTAB = function (t) { return /estabiliza/.test(t); };
  var CONTORNAR = function (t) { return t === "desvio de obstáculos"; };
  var PULVERIZAR = function (t) { return /sistemas de pulveriza/.test(t); };
  var RTH_ALT = function (t) { return /altitude rth/.test(t); };
  var RTH_VEL = function (t) { return /velocidade rth/.test(t); };
  var DIST_MAX = function (t) { return /dist.ncia m.xima de voo/.test(t); };
  var ALT_MAX = function (t) { return /altitude de voo m.x/.test(t); };

  var CENARIOS = [
    { nome: /plan/, terreno: "planicie" },
    { nome: /(colina|pomar)/, terreno: "montanha" },
    { nome: /gua/, terreno: "agua" },
  ];

  /* Um grupo de opcoes que o controle desenha "desativado" passa a
     escolher: tira a classe, marca a opcao inicial e liga o clique. */
  function ativarGrupo(grupo, inicial) {
    if (grupo.dataset.xgAtivo) return;
    grupo.dataset.xgAtivo = "1";
    grupo.classList.remove("desativado", "apagado");
    var botoes = grupo.querySelectorAll("button");
    if (!grupo.querySelector(".ativa") && botoes[inicial]) botoes[inicial].classList.add("ativa");
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].addEventListener("click", function () {
        for (var k = 0; k < botoes.length; k++) botoes[k].classList.toggle("ativa", botoes[k] === this);
      });
    }
  }

  /* ------------------------------------------------ ler e escrever nos dois */

  function lerChave(bot) { return bot ? bot.classList.contains("ligado") : null; }
  function escreverChave(bot, v) { if (bot) bot.classList.toggle("ligado", !!v); }

  function lerCenario(botoes) {
    for (var i = 0; i < botoes.length; i++) {
      if (!botoes[i].classList.contains("ativa")) continue;
      var t = normal(botoes[i].textContent);
      for (var k = 0; k < CENARIOS.length; k++) if (CENARIOS[k].nome.test(t)) return CENARIOS[k].terreno;
    }
    return null;
  }
  function escreverCenario(botoes, terreno) {
    var alvo = CENARIOS.filter(function (c) { return c.terreno === terreno; })[0];
    if (!alvo) return;
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].classList.toggle("ativa", alvo.nome.test(normal(botoes[i].textContent)));
    }
  }

  function lerFaixa(barra) { return barra ? Number(barra.value) : null; }
  function escreverFaixa(barra, v, jan) {
    if (!barra || Number(barra.value) === v) return;
    barra.value = v;
    /* o controle atualiza o numero ao lado so no evento dele */
    barra.dispatchEvent(new jan.Event("input", { bubbles: true }));
  }

  function lerNumero(el) { return el ? Number(String(el.textContent).replace(",", ".")) : null; }
  function escreverNumero(el, v, casas) { if (el) el.textContent = Number(v).toFixed(casas); }

  /* --------------------------------------------------------------- o ciclo */

  function Ajustes(ponte, quadroControle) {
    this.ponte = ponte;
    this.quadro = quadroControle;
    this.valor = {};          // o ultimo valor conhecido de cada ajuste
    this.aplicado = "";
  }

  Ajustes.prototype.doc = function () {
    try { return this.quadro.contentDocument; } catch (e) { return null; }
  };

  /* Um ajuste com dois lugares no controle. `ler`/`escrever` recebem o
     elemento de cada lugar. Devolve o valor combinado. */
  Ajustes.prototype.sincronizar = function (id, a, b, ler, escrever) {
    var va = a ? ler(a) : null, vb = b ? ler(b) : null;
    var atual = this.valor[id];

    if (atual === undefined) {
      /* primeira leitura: a aba Voo (b) manda, se existir */
      var inicio = vb !== null ? vb : va;
      if (inicio === null) return null;
      this.valor[id] = inicio;
      if (a && va !== inicio) escrever(a, inicio);
      if (b && vb !== inicio) escrever(b, inicio);
      return inicio;
    }

    var novo = atual;
    if (va !== null && va !== atual) novo = va;
    else if (vb !== null && vb !== atual) novo = vb;

    if (novo !== atual) {
      this.valor[id] = novo;
      if (a && va !== novo) escrever(a, novo);
      if (b && vb !== novo) escrever(b, novo);
    }
    return novo;
  };

  Ajustes.prototype.ciclo = function () {
    var doc = this.doc();
    if (!doc || !this.ponte.janela) return;
    var jan = doc.defaultView;

    var config = doc.querySelector(".painel-config");
    var exec = doc.querySelector("[data-tela='execucao'] .painel-execucao");

    var multi = this.sincronizar("multi", chave(config, MULTI), chave(exec, MULTI), lerChave, escreverChave);
    var estab = this.sincronizar("estab", chave(config, ESTAB), chave(exec, ESTAB), lerChave, escreverChave);
    var contornar = this.sincronizar("contornar", chave(config, CONTORNAR), chave(exec, CONTORNAR), lerChave, escreverChave);

    /* o cenario: grupo de botoes nas configuracoes e na aba Voo */
    var grupoConfig = null;
    if (config) {
      var grupos = config.querySelectorAll(".grupo-opcoes");
      for (var i = 0; i < grupos.length; i++) if (/plan/i.test(grupos[i].textContent)) { grupoConfig = grupos[i]; break; }
    }
    var cfgBotoes = grupoConfig ? grupoConfig.querySelectorAll("button") : null;
    var execBotoes = exec ? exec.querySelectorAll(".lista-cenario button") : null;
    var terreno = this.sincronizar("cenario",
      cfgBotoes && cfgBotoes.length ? cfgBotoes : null,
      execBotoes && execBotoes.length ? execBotoes : null,
      lerCenario, escreverCenario);

    /* RTH: deslizador nas configuracoes, numero com - e + na aba Voo */
    var rthAlt = this.sincronizarNumero("rthAlt", faixa(config, RTH_ALT), doc.getElementById("exec-rth-alt"), 0, jan);
    var rthVel = this.sincronizarNumero("rthVel", faixa(config, RTH_VEL), doc.getElementById("exec-rth-vel"), 1, jan);

    /* Os numeros da aba Tarefa da execucao (taxa, velocidade, altura,
       espacamento) vao para o voo. O espacamento refaz a rota, e por isso
       so entra com a aeronave no chao - em voo, refazer a rota apaga a
       operacao. Os outros valem na hora. */
    var taxa = lerNumero(doc.getElementById("exec-taxa"));
    var velKmh = lerNumero(doc.getElementById("exec-velocidade"));
    var altura = lerNumero(doc.getElementById("exec-altura"));
    var espac = lerNumero(doc.getElementById("exec-espacamento-exec"));
    if (espac > 0 && espac !== this.espacAplicado) {
      var r = this.ponte.ler(
        "(function(){" +
        "  if (V.estado !== 'em solo' && V.estado !== 'concluído') return false;" +
        "  P.faixa = " + espac + ";" +
        "  if (typeof mapaAtual === 'function' && mapaAtual()) reiniciarVoo();" +
        "  return true;" +
        "})()"
      );
      if (r === true) this.espacAplicado = espac;
    }

    var pulverizar = lerChave(chave(config, PULVERIZAR));
    var distMax = lerFaixa(faixa(config, DIST_MAX));
    var altMax = lerFaixa(faixa(config, ALT_MAX));

    /* Configuracoes de radar: sensibilidade e distancia de frenagem */
    var radarMedia = null, frenagem = lerFaixa(faixa(config, function (t) { return /frenagem/.test(t); }));
    if (config) {
      var grupos2 = config.querySelectorAll(".grupo-opcoes");
      for (var g = 0; g < grupos2.length; g++) {
        if (/alta/i.test(grupos2[g].textContent) && /m.dia/i.test(grupos2[g].textContent)) {
          var ativa = grupos2[g].querySelector(".ativa");
          radarMedia = !!(ativa && /m.dia/i.test(ativa.textContent));
        }
      }
    }

    /* a preferencia de desvio da Colina/Pomar (deslizador que o app mostra
       so nesse cenario): 0 = horizontal primeiro, 100 = vertical primeiro */
    var pref = this.preferenciaDeDesvio(doc, config, terreno);

    this.pontoDeOrigem(config);

    /* Holofote: a luz do drone (Automatico / Desl. / Lig.). O controle
       desenha o grupo desativado; aqui ele passa a escolher. */
    var holofote = null;
    if (config) {
      var grupos3 = config.querySelectorAll(".grupo-opcoes");
      for (var h = 0; h < grupos3.length; h++) {
        if (/autom.tico/i.test(grupos3[h].textContent) && /lig\./i.test(grupos3[h].textContent)) {
          ativarGrupo(grupos3[h], 0);
          var at = grupos3[h].querySelector(".ativa");
          holofote = at ? normal(at.textContent) : "automático";
        }
      }
    }

    this.aplicar({
      desvio: multi, estab: estab, contornar: contornar, terreno: terreno,
      rth: rthAlt, rthVel: rthVel !== null ? rthVel / 3.6 : null,
      pulverizar: pulverizar, distMax: distMax, altMax: altMax,
      radarMedia: radarMedia, frenagem: frenagem, desvioPref: pref,
      holofote: holofote,
      vazao: taxa > 0 ? taxa : null,
      vel: velKmh > 0 ? velKmh / 3.6 : null,
      altura: altura > 0 ? altura : null,
    });
  };

  /* "Atualizar Ponto de origem" (palavras dele): define o novo ponto de
     pouso. "Definir localizacao da aeronave" poe o H onde o drone esta;
     "...do controle remoto", onde o operador esta. O controle desenha os
     dois botoes desativados; aqui eles passam a funcionar. */
  Ajustes.prototype.pontoDeOrigem = function (config) {
    if (!config || this.origemLigada) return;
    var grupos = config.querySelectorAll(".grupo-opcoes");
    var grupo = null;
    for (var i = 0; i < grupos.length; i++) {
      if (/definir localiza/i.test(grupos[i].textContent)) { grupo = grupos[i]; break; }
    }
    if (!grupo) return;

    grupo.classList.remove("desativado", "apagado");
    var self = this;
    grupo.querySelectorAll("button").forEach(function (b) {
      var daAeronave = /aeronave/i.test(b.textContent);
      b.addEventListener("click", function () {
        self.ponte.rodar(
          "(function(){" +
          "  var p = " + (daAeronave ? "drone.position" : "grupoOperador.position") + ";" +
          "  BASE.x = p.x; BASE.z = p.z;" +
          "})()"
        );
        grupo.querySelectorAll("button").forEach(function (o) { o.classList.toggle("ativa", o === b); });
        setTimeout(function () { b.classList.remove("ativa"); }, 900);
      });
    });
    this.origemLigada = true;
  };

  /* O deslizador "Desviar horizontalmente primeiro / verticalmente primeiro"
     nao existe no controle dele: entra logo abaixo da chave "Desvio de
     obstaculos" das configuracoes do sensor, com o mesmo feitio das faixas
     do app, e so aparece com Colina/Pomar escolhido (foto dele). */
  Ajustes.prototype.preferenciaDeDesvio = function (doc, config, terreno) {
    if (!config) return null;

    var bloco = config.querySelector("#xg-pref-desvio");
    if (!bloco) {
      var linha = null, linhas = config.querySelectorAll(".linha-toggle-config");
      for (var i = 0; i < linhas.length; i++) {
        if (normal((window.TPD_IDIOMAS ? TPD_IDIOMAS.original(linhas[i]) : linhas[i].textContent)) === "desvio de obstáculos") { linha = linhas[i]; break; }
      }
      if (!linha) return null;
      var alvo = linha.closest(".config-bloco") || linha;

      bloco = doc.createElement("div");
      bloco.id = "xg-pref-desvio";
      bloco.className = "config-bloco";
      bloco.innerHTML =
        '<div class="faixa" style="display:flex;align-items:center;gap:1cqw">' +
        '<button class="passo-botao" data-faixa="-1" type="button">−</button>' +
        '<div class="trilho" style="flex:1"><input type="range" min="0" max="100" step="5" value="100" style="width:100%"></div>' +
        '<button class="passo-botao" data-faixa="1" type="button">+</button></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:1.6cqw;color:#5b5f63;padding:.4cqw 5cqw 0">' +
        "<span>Desviar horizontalmente<br>primeiro</span><span style=\"text-align:right\">Desviar verticalmente<br>primeiro</span></div>";
      alvo.parentNode.insertBefore(bloco, alvo.nextSibling);

      var barra = bloco.querySelector("input");
      bloco.querySelectorAll("[data-faixa]").forEach(function (b) {
        b.addEventListener("click", function () {
          barra.value = Math.max(0, Math.min(100, Number(barra.value) + Number(b.dataset.faixa) * 5));
        });
      });
    }

    bloco.style.display = terreno === "montanha" ? "" : "none";
    return Number(bloco.querySelector("input").value);
  };

  /* O RTH tem um deslizador de um lado e um numero do outro. */
  Ajustes.prototype.sincronizarNumero = function (id, barra, numero, casas, jan) {
    return this.sincronizar(id, barra, numero,
      function (el) { return el.tagName === "INPUT" ? lerFaixa(el) : lerNumero(el); },
      function (el, v) {
        if (el.tagName === "INPUT") escreverFaixa(el, v, jan);
        else escreverNumero(el, v, casas);
      });
  };

  /* Leva para o P do campo so o que mudou. A estabilizacao so troca com a
     aeronave no chao: no ar, o campo perderia a referencia de altura e a
     aeronave cairia (V.referencia so e semeada na decolagem). */
  Ajustes.prototype.aplicar = function (a) {
    var partes = [];
    function por(chave, valor) {
      if (valor === null || valor === undefined) return;
      partes.push("P." + chave + " = " + JSON.stringify(valor) + ";");
    }

    por("desvio", a.desvio);
    por("xgContornar", a.contornar);
    por("terreno", a.terreno);
    por("rth", a.rth);
    por("rthVel", a.rthVel);
    por("xgPulverizar", a.pulverizar);
    por("xgDistMax", a.distMax);
    por("xgAltMax", a.altMax);
    por("vazao", a.vazao);
    por("vel", a.vel);
    por("altura", a.altura);
    por("xgRadarMedia", a.radarMedia);
    por("xgFrenagem", a.frenagem);
    por("xgDesvioPref", a.desvioPref);

    // Configuracoes e L2 usam a mesma luz. Alterar outro parametro nao
    // reaplica o valor antigo de holofote por cima do botao fisico.
    if (a.holofote !== null && a.holofote !== undefined && a.holofote !== this.holofoteAplicado && window.HOLOFOTE) {
      window.HOLOFOTE.instalar(this.ponte);
      this.ponte.rodar("window.xgHolofote(" + (/^lig/.test(a.holofote) ? "true" : "false") + ")");
      this.holofoteAplicado = a.holofote;
    }

    var codigo = partes.join("");
    if (codigo !== this.aplicado) {
      this.aplicado = codigo;
      this.ponte.rodar(codigo);
    }

    /* a cada volta: se o aluno mexeu na chave em voo, ela vale quando pousar */
    if (a.estab !== null && a.estab !== undefined) {
      /* Air 2S (app_fly.js, window.__xgFly): drone de imagem nao acompanha o terreno (14/10/2026) */
      this.ponte.rodar("if (!window.__xgFly && (V.estado === 'em solo' || V.estado === 'concluído') && P.estab !== " +
                       (a.estab ? "true" : "false") + ") P.estab = " + (a.estab ? "true" : "false") + ";");
    }
  };

  return {
    criar: function (ponte, quadro) { return new Ajustes(ponte, quadro); },
  };
})();
