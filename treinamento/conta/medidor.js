/* ==========================================================================
   MEDIDOR DE HORAS DO SIMULADOR

   Entra no simulador oficial (treinamento/sim.html), que carrega
   conta/config.js, conta/contas.js e este arquivo depois do principal.js. So age quando a pagina foi aberta
   pela area do aluno, com ?drone=...&controle=... na URL. Sem isso o
   simulador abre como antes (treino da turma, sem cobranca).

   - Exige conta logada e saldo. O controle registrado e opcional: sem ele
     o aluno treina com o controle virtual (teclado e mouse).
   - Conta o tempo so com a aba visivel; a cada 60 s registra 1 minuto
     no cadastro (vai para o certificado) e tira 1 minuto do saldo.
   - Saldo zerado: cobre a tela e manda comprar mais horas.
   ========================================================================== */

(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var drone = params.get("drone");
  if (!drone || !window.CONTAS) return;

  var CONTA_URL = "conta/";
  var nomeDrone = CONTAS.DRONES[drone] || drone;
  var codigo = String(params.get("controle") || "");

  (window.TREINO_AUTORIZADO || CONTAS.iniciar().then(function (conta) {
    if (!conta) {
      location.replace(CONTA_URL + "index.html?volta=" + encodeURIComponent(location.pathname + location.search));
      return;
    }
    return CONTAS.iniciarTreino(drone, codigo);
  })).then(function (r) { if (r) comecar(r.treino, r.vitalicio ? Infinity : r.saldoMin); }).catch(function () {
    /* O principal mostra a falha de autorizacao; nao apagar a mensagem
       com um segundo redirecionamento silencioso. */
    if (!window.TREINO_AUTORIZADO) location.replace(CONTA_URL + "drones.html");
  });

  function comecar(treino, saldoInicial) {
    /* ---------------------------------------------------------------- selo */

    var estilo = document.createElement("style");
    estilo.textContent =
      "#medidor{position:fixed;left:50%;top:44px;transform:translateX(-50%);z-index:50;" +
        "display:flex;gap:10px;align-items:center;padding:6px 12px;border-radius:999px;" +
        "background:rgba(14,26,20,.88);border:1px solid rgba(99,178,60,.55);color:#F3F7F1;" +
        "font:500 13px Asap,'Segoe UI',sans-serif;pointer-events:auto}" +
      "#medidor b{color:#7CC955;font-variant-numeric:tabular-nums}" +
      "#medidor.pouco{border-color:#E8901A}#medidor.pouco b{color:#E8901A}" +
      "#medidor a{color:#B9C8BB;text-decoration:none}" +
      "#medidor-fim{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;" +
        "background:rgba(8,15,11,.88);color:#F3F7F1;font-family:Asap,'Segoe UI',sans-serif;text-align:center;padding:16px}" +
      "#medidor-fim > div{max-width:520px;width:100%;box-sizing:border-box;max-height:90vh;overflow:auto;background:#17281F;border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:28px}" +
      "#medidor-fim h2{margin:0 0 8px;font-family:Outfit,'Segoe UI',sans-serif}" +
      "#medidor-avaliacao{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;" +
        "background:rgba(8,15,11,.82);color:#F3F7F1;font-family:Asap,'Segoe UI',sans-serif;padding:16px}" +
      "#medidor-avaliacao > div{max-width:520px;width:100%;box-sizing:border-box;max-height:90vh;overflow:auto;background:#17281F;" +
        "border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:24px;text-align:left}" +
      "#medidor-avaliacao h2{margin:0 0 8px;font-family:Outfit,'Segoe UI',sans-serif}" +
      "#medidor-avaliacao fieldset{border:1px solid rgba(255,255,255,.15);border-radius:10px;margin:12px 0}" +
      "#medidor-avaliacao label{display:block;padding:6px 4px}" +
      "#medidor-avaliacao textarea{box-sizing:border-box;width:100%;margin-top:6px;padding:10px;border-radius:8px;font:inherit;resize:vertical}" +
      "#medidor-avaliacao .av-botoes{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}" +
      "#medidor-avaliacao button{flex:1;padding:12px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.25);" +
        "background:transparent;color:#F3F7F1;font:600 15px Asap,'Segoe UI',sans-serif;cursor:pointer}" +
      "#medidor-avaliacao button.av-principal{background:#63B23C;border-color:#63B23C;color:#0E1A14}" +
      "#medidor-avaliacao button:disabled{opacity:.6;cursor:default}" +
      "#medidor-fim a{display:inline-block;margin-top:16px;padding:12px 20px;border-radius:10px;" +
        "background:#63B23C;color:#0E1A14;font-weight:600;text-decoration:none}";
    document.head.appendChild(estilo);

    var selo = document.createElement("div");
    selo.id = "medidor";
    selo.innerHTML = '<span></span><span>Saldo <b></b></span><a href="' + CONTA_URL + 'inicio.html">Sair</a>';
    /* Beta da XAG (21/11/2026): sem saldo na tela (o tempo nao acaba) e o Sair volta para a tela do beta. So mostra; quem libera e o servidor. */
    var beta = params.get("beta") === "1";
    if (beta) selo.innerHTML = '<span></span><span><span>Versão beta de avaliação</span> · <b>sem limite de tempo</b></span><a href="' + CONTA_URL + 'beta.html">Sair</a>';
    /* sem o numero do controle na barra (Eduardo, 11/10/2026) */
    selo.firstChild.textContent = codigo ? nomeDrone : nomeDrone + " · controle virtual";
    document.body.appendChild(selo);

    var saldoAgora = saldoInicial;
    function mostrar(minutos) {
      saldoAgora = minutos;
      // Infinity = acesso vitalício (o saldo não acaba).
      if (beta) return;
      selo.querySelector("b").textContent = minutos === Infinity ? "Vitalício" : CONTAS.formatarHoras(minutos);
      selo.classList.toggle("pouco", minutos <= 10);
    }

    function acabou() {
      clearInterval(relogio);
      if (document.getElementById("medidor-fim")) return;
      if (document.exitPointerLock) document.exitPointerLock();
      var fim = document.createElement("div");
      fim.id = "medidor-fim";
      fim.setAttribute("role", "dialog");
      fim.setAttribute("aria-modal", "true");
      fim.setAttribute("aria-labelledby", "fim-titulo");
      fim.innerHTML = '<div><h2 id="fim-titulo">Suas horas acabaram</h2>' +
        '<p>O tempo treinado já está registrado no seu cadastro.</p>' +
        '<section id="fim-avaliacao" hidden><p>Seu tempo de teste terminou. Queremos saber sua opinião: que nota você dá ao simulador?</p>' +
        '<fieldset id="fim-notas"><legend>Sua avaliação</legend>' +
        ["1 — Muito ruim", "2 — Ruim", "3 — Regular", "4 — Bom", "5 — Muito bom"].map(function (texto, i) {
          return '<label style="display:block;text-align:left;padding:8px"><input type="radio" name="nota-teste" value="' + (i + 1) + '"> ' + texto + '</label>';
        }).join("") + '</fieldset>' +
        '<label style="display:block;text-align:left;padding:16px 0"><input id="fim-curto" type="checkbox"> Não sei, o tempo de teste foi muito curto.</label>' +
        '<label for="fim-sugestao" style="display:block;text-align:left">Tem alguma sugestão? (opcional)</label>' +
        '<textarea id="fim-sugestao" maxlength="1000" rows="3" placeholder="Conte o que podemos melhorar" style="box-sizing:border-box;width:100%;margin-top:8px;padding:10px;border-radius:8px;font:inherit;resize:vertical"></textarea>' +
        '<small style="display:block;text-align:left">Até 1.000 caracteres. Você pode deixar em branco.</small>' +
        '<p id="fim-status" role="status" aria-live="polite"></p>' +
        '<p id="fim-oferta">Continue treinando: 30% de desconto no pacote de 10 horas.</p></section>' +
        '<a id="fim-inicio" href="' + CONTA_URL + 'inicio.html">Ir para a tela inicial</a> ' +
        '<a id="fim-comprar" href="' + CONTA_URL + 'creditos.html">Comprar mais horas</a></div>';
      document.body.appendChild(fim);
      // Impede os controles do simulador de receberem as teclas da avaliação.
      ["keydown", "keyup", "keypress"].forEach(function (evento) {
        fim.addEventListener(evento, function (e) {
          e.stopPropagation();
          if (evento === "keydown" && e.key === "Tab") {
            var itens = Array.from(fim.querySelectorAll("a, input, textarea")).filter(function (x) { return !x.disabled && x.getClientRects().length; });
            var primeiro = itens[0], ultimo = itens[itens.length - 1];
            if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
            else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
          }
        });
      });
      var inicio = fim.querySelector("#fim-inicio"), comprar = fim.querySelector("#fim-comprar");
      var fila = Promise.resolve(), erro = false, ofertaAtiva = false, navegando = false;
      var eventoClique = crypto.randomUUID(), prepararSaida = function () {};
      [inicio, comprar].forEach(function (link) {
        link.addEventListener("click", function (e) {
          e.preventDefault();
          if (navegando) return;
          navegando = true;
          prepararSaida();
          fila.then(function () {
            if (erro) { navegando = false; return; }
            if (link !== comprar || !ofertaAtiva) { location.href = link.href; return; }
            // Repetir usa o mesmo identificador, sem duplicar a contagem.
            return CONTAS.registrarCliqueOfertaTeste(eventoClique).catch(function () {
              return CONTAS.registrarCliqueOfertaTeste(eventoClique);
            }).catch(function () { /* falha de rede nao impede acessar a compra */ }).then(function () { location.href = link.href; });
          });
        });
      });
      inicio.focus();
      CONTAS.recarregar().then(function (conta) {
        if (!conta || !conta.testeGratisEm || conta.saldoMin > 0) return;
        // A oferta de 30% vale uma vez por conta; a avaliação continua aparecendo.
        var ofertaUsada = !!conta.ofertaTeste30UsadaEm || (conta.compras || []).some(function (c) { return c && c.oferta === "teste30"; });
        ofertaAtiva = !ofertaUsada;
        fim.querySelector("#fim-titulo").textContent = "Seu teste grátis terminou";
        fim.querySelector("#fim-avaliacao").hidden = false;
        fim.querySelector("#fim-oferta").hidden = ofertaUsada;
        if (ofertaAtiva) {
          comprar.href += "?oferta=teste30";
          comprar.textContent = "Comprar 10 horas com 30% de desconto";
        }
        var curto = fim.querySelector("#fim-curto"), notas = fim.querySelector("#fim-notas");
        var status = fim.querySelector("#fim-status"), sugestao = fim.querySelector("#fim-sugestao");
        var atrasoSugestao, ultimaResposta = "";
        if (conta.avaliacaoTeste) {
          sugestao.value = conta.avaliacaoTeste.sugestao || "";
          curto.checked = !!conta.avaliacaoTeste.tempoCurto;
          notas.hidden = curto.checked; notas.disabled = curto.checked;
          var marcada = notas.querySelector('input[value="' + Number(conta.avaliacaoTeste.nota) + '"]');
          if (marcada && !curto.checked) marcada.checked = true;
          status.textContent = "Sua opinião já está salva. Você pode alterá-la.";
        }
        function salvar() {
          clearTimeout(atrasoSugestao);
          var nota = fim.querySelector('input[name="nota-teste"]:checked');
          if (!curto.checked && !nota) { status.textContent = ""; return; }
          var dados = { tempoCurto: curto.checked, nota: curto.checked ? null : Number(nota.value), sugestao: sugestao.value.trim() };
          var assinatura = JSON.stringify(dados);
          if (assinatura === ultimaResposta && !erro) return;
          ultimaResposta = assinatura;
          status.textContent = "Salvando sua opinião…";
          fila = fila.catch(function () {}).then(function () { return CONTAS.avaliarTeste(dados); }).then(function () {
            erro = false; status.textContent = "Obrigado! Sua opinião foi salva.";
          }).catch(function () { erro = true; status.textContent = "Não foi possível salvar. Clique novamente em uma resposta para tentar de novo."; });
        }
        curto.addEventListener("change", function () {
          notas.hidden = curto.checked;
          notas.disabled = curto.checked;
          if (curto.checked) notas.querySelectorAll("input").forEach(function (n) { n.checked = false; });
          salvar();
        });
        notas.addEventListener("change", salvar);
        sugestao.addEventListener("input", function () {
          clearTimeout(atrasoSugestao);
          atrasoSugestao = setTimeout(salvar, 700);
        });
        sugestao.addEventListener("blur", salvar);
        prepararSaida = salvar;

      }).catch(function () {
        fim.querySelector("#fim-titulo").textContent = "Suas horas acabaram";
      });
    }

    /* -------------------------------------------------------------- relogio */

    mostrar(saldoInicial);

    /* ------------------------------------------------ avaliação (08/10/2026)

       Pedido do Eduardo: quem já treinou 15 minutos ou mais e ainda não
       avaliou responde o que está achando e ganha 10 minutos, uma vez (o
       servidor confere em avaliarTeste). Vale também para quem já tinha
       passado dos 15 minutos: aparece na próxima sessão. Só abre no menu do
       simulador, fora da operação, onde o tempo não está sendo contado.
       "Agora não" fecha e pede de novo na próxima vez que ele testar. */
    var avaliacao = { conferir: true, conferindo: false, encerrada: false };
    window.addEventListener("treino-minuto-registrado", function () { avaliacao.conferir = true; });
    function noMenu() {
      return document.visibilityState === "visible" && !!window.PAUSA_SIM && !PAUSA_SIM.emOperacao &&
        !(window.RETOMADA_SIM && RETOMADA_SIM.carregando) &&
        !document.getElementById("medidor-fim") && !document.getElementById("medidor-avaliacao");
    }
    var relogioAvaliacao = setInterval(function () {
      if (avaliacao.encerrada) { clearInterval(relogioAvaliacao); return; }
      if (!avaliacao.conferir || avaliacao.conferindo || !noMenu()) return;
      avaliacao.conferindo = true;
      CONTAS.recarregar().then(function (conta) {
        avaliacao.conferindo = false;
        avaliacao.conferir = false;
        if (!conta || conta.tipoConta === "escola") { avaliacao.encerrada = true; return; }
        if (conta.avaliacaoTeste || conta.bonusAvaliacaoEm) { avaliacao.encerrada = true; return; }
        if ((conta.minutosTreinados || 0) < 15) return;
        if (!noMenu()) { avaliacao.conferir = true; return; }
        avaliacao.encerrada = true;
        pedirAvaliacao();
      }, function () { avaliacao.conferindo = false; });
    }, 3000);

    function pedirAvaliacao() {
      if (document.exitPointerLock) document.exitPointerLock();
      var caixa = document.createElement("div");
      caixa.id = "medidor-avaliacao";
      caixa.setAttribute("role", "dialog");
      caixa.setAttribute("aria-modal", "true");
      caixa.setAttribute("aria-labelledby", "av-titulo");
      caixa.innerHTML = '<div><h2 id="av-titulo">O que você está achando do simulador?</h2>' +
        '<p>Você já treinou mais de 15 minutos. Dê a sua nota e ganhe 10 minutos de simulador.</p>' +
        '<fieldset id="av-notas"><legend>Sua nota</legend>' +
        ["1 — Muito ruim", "2 — Ruim", "3 — Regular", "4 — Bom", "5 — Muito bom"].map(function (texto, i) {
          return '<label><input type="radio" name="nota-avaliacao" value="' + (i + 1) + '"> ' + texto + '</label>';
        }).join("") + '</fieldset>' +
        '<label for="av-sugestao">O que podemos melhorar? (opcional)</label>' +
        '<textarea id="av-sugestao" maxlength="1000" rows="3" placeholder="Conte o que podemos melhorar"></textarea>' +
        '<p id="av-status" role="status" aria-live="polite"></p>' +
        '<div class="av-botoes"><button type="button" id="av-depois">Agora não</button>' +
        '<button type="button" class="av-principal" id="av-enviar">Enviar e ganhar 10 minutos</button></div></div>';
      document.body.appendChild(caixa);
      // As teclas da avaliação não vão para os controles do simulador.
      ["keydown", "keyup", "keypress"].forEach(function (evento) {
        caixa.addEventListener(evento, function (e) { e.stopPropagation(); });
      });
      var enviar = caixa.querySelector("#av-enviar"), depois = caixa.querySelector("#av-depois");
      var status = caixa.querySelector("#av-status"), enviada = false;
      function fechar() { caixa.remove(); }
      depois.addEventListener("click", fechar);
      enviar.addEventListener("click", function () {
        if (enviada) { fechar(); return; }
        var nota = caixa.querySelector('input[name="nota-avaliacao"]:checked');
        if (!nota) { status.textContent = "Escolha uma nota de 1 a 5."; return; }
        enviar.disabled = depois.disabled = true;
        status.textContent = "Enviando sua avaliação…";
        CONTAS.avaliarTeste({ tempoCurto: false, nota: Number(nota.value), sugestao: caixa.querySelector("#av-sugestao").value.trim() }).then(function () {
          enviada = true;
          status.textContent = "Obrigado! Os 10 minutos já estão no seu saldo.";
          if (saldoAgora !== Infinity) mostrar(saldoAgora + 10);
          caixa.querySelector("#av-notas").disabled = true;
          caixa.querySelector("#av-sugestao").disabled = true;
          depois.hidden = true;
          enviar.textContent = "Continuar";
          enviar.disabled = false;
          enviar.focus();
        }).catch(function () {
          enviar.disabled = depois.disabled = false;
          status.textContent = "Não foi possível enviar. Tente de novo.";
        });
      });
      var primeira = caixa.querySelector('input[name="nota-avaliacao"]');
      if (primeira) primeira.focus();
    }

    /* Heartbeat (A3): se o servidor parar de confirmar os minutos pagos por
       vários minutos SEGUIDOS enquanto o aluno opera (cópia rehospedada, sessão
       inválida/bloqueada ou conexão perdida), encerra a sessão. Falha de rede
       passageira NÃO derruba: o contador zera a cada confirmação bem-sucedida. */
    var falhasConfirmacao = 0;
    var LIMITE_FALHAS = 5; // ~5 minutos operando sem o servidor confirmar
    function interromper() {
      clearInterval(relogio);
      if (document.getElementById("medidor-fim")) return;
      if (document.exitPointerLock) document.exitPointerLock();
      var aviso = document.createElement("div");
      aviso.id = "medidor-fim";
      aviso.setAttribute("role", "dialog");
      aviso.setAttribute("aria-modal", "true");
      aviso.innerHTML = '<div><h2>Sessão não confirmada</h2>' +
        '<p>Não foi possível confirmar seu treino com o servidor nos últimos minutos. ' +
        'Verifique sua conexão e entre de novo pela sua conta.</p>' +
        '<a href="' + CONTA_URL + 'inicio.html">Voltar para a tela inicial</a></div>';
      document.body.appendChild(aviso);
    }

    var segundos = 0, enviando = false;
    var ultimo = performance.now();
    function podeContar() {
      return document.visibilityState === "visible" && !!(window.PAUSA_SIM && PAUSA_SIM.emOperacao) && !PAUSA_SIM.pausado && !(window.RETOMADA_SIM && RETOMADA_SIM.carregando);
    }
    var contando = podeContar();
    function acumular() {
      var agora = performance.now();
      if (contando && !enviando) segundos += Math.max(0, agora - ultimo) / 1000;
      ultimo = agora;
      contando = podeContar();
    }
    // Só transporta a fração do minuto; saldo e autorização continuam no servidor.
    window.MEDIDOR_SESSAO = {
      exportar: function () { acumular(); return Math.max(0, Math.min(59.999, segundos)); },
      restaurar: function (s) { segundos = Math.max(0, Math.min(59.999, Number(s) || 0)); ultimo = performance.now(); contando = podeContar(); }
    };
    // Fecha o trecho ativo no instante da pausa, preservando minutos parciais.
    window.addEventListener("pausa-simulador", acumular);
    window.addEventListener("operacao-simulador", acumular);
    document.addEventListener("visibilitychange", acumular);
    var relogio = setInterval(function () {
      acumular();
      if (!contando || enviando || segundos < 60) return;
      segundos -= 60;
      enviando = true;
      CONTAS.registrarMinuto(treino).then(function (resta) {
        ultimo = performance.now();
        enviando = false;
        falhasConfirmacao = 0;   // servidor confirmou: zera o contador do heartbeat
        mostrar(resta);
        window.dispatchEvent(new CustomEvent('treino-minuto-registrado'));
        if (resta <= 0) acabou();
      }).catch(function () {
        ultimo = performance.now(); enviando = false;
        // Sem confirmação do servidor: tolera quedas passageiras, mas encerra
        // se persistir (cópia rehospedada / sessão inválida / sem internet).
        if (++falhasConfirmacao >= LIMITE_FALHAS) interromper();
      });
    }, 1000);
  }
})();
