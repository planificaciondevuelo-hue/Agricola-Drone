/* ==========================================================================
   COMO O XAG VOA (P60) — diferente do DJI

   Regras do Eduardo (06/10/2026), so para a marca XAG:

   1. Seguimento de terreno pelo "Seguimento do terreno" das Configuracoes de
      operacao (xag_parametros.js, xpPlano.terreno):
        all        "Tudo LIGADO": acompanha o terreno na ida ao ponto de
                   pulverizacao, na operacao e na volta a base;
        approach   "Aproximando-se apenas da rota": na entrada e na saida
                   (ida da base ate a rota e volta para a base); aplicando, nao;
        operation  "Apenas rotas de operacao": so aplicando (indo e
                   voltando, nao - o jeito do DJI);
        off        "Totalmente fechado": altura contada da decolagem.
   2. Nao sai da area de operacao a nao ser pelo ponto de entrada e saida
      (o ponto de entrada do app, ou a ponta da rota por onde ela comeca):
      a volta a base passa primeiro por ele, e a ida para retomar no meio do
      talhao tambem entra por ele.
   3. Bateria: "Retorno automatico de energia restante" (pagina Bateria do
      dispositivo) e a % com que ele quer POUSAR. A aeronave calcula a cada
      instante quanto gasta para sair pela entrada e chegar a base e volta
      quando o que sobra encosta nessa %. Pode sair com 30% ou com 12%: pousa
      com a % escolhida. Substitui a regra fixa de 25% do jogo.
   4. Sinal: o XAG perde o sinal do controle com facilidade. Uma arvore, uma
      casa, um poste ou o morro entre o operador e a aeronave cortam o link.
      Sem sinal o app mostra a aeronave desconectada e os manches nao chegam
      (no manual ela para e paira). Ela CONTINUA o trabalho e so volta quando
      a calda acaba ou pelo calculo da bateria (Eduardo, 06/10).
   5. Desvio de obstaculos sempre pela lateral, nunca por cima.

   Tudo roda DENTRO do campo (toString + eval) embrulhando passo, alturaAlvo
   e iniciarRetorno, sem editar o motor nem os modulos do DJI.
   Uso (principal.js, so na XAG, depois do MANUAL):  VOO_XAG.instalar(ponte)
   ========================================================================== */

window.VOO_XAG = (function () {
  "use strict";

  function instalarNoCampo() {
    if (window.xgVooXag) return true;
    if (typeof passo !== "function" || typeof alturaAlvo !== "function" || typeof iniciarRetorno !== "function" ||
        typeof grupoOperador === "undefined" || typeof colisores === "undefined" || !window.__xgManual) return false;

    var X = window.xgVooXag = {
      sinal: true, bloqueio: "", semSinalDesde: 0, comSinalDesde: 0, verificadoEm: 0,
      precisa: 0, saida: null, entrar: null, t: 0
    };
    window.xgMarca = "xag";

    /* ------------------------------------------------- 6. gota pela vazao do bico
       Eduardo, 18/11/2026: "o bico centrifugo que faz as gotas tem um limite de rotacao; quando voce aumenta a vazao, seja
       por velocidade, aumento de faixa ou simplesmente por vazao por ha, esse bico nao vai ter a mesma capacidade de fazer
       as gotas: saindo 4 litros por minuto com o bico na rotacao maxima ele vai ter um tipo de gota, e usando 2 litros por
       minuto vai ter outra". Entao a gota mais FINA que o bico consegue cresce com os litros por minuto que passam nele:
         L/min por bico = dose (L/ha) x velocidade (km/h) x faixa (m) / 600 / numero de bicos
         gota minima    = 60 um ate 1 L/min; acima disso 60 x (L/min)^0,4, arredondada de 10 em 10 (teto 400)
         -> 2 L/min: 80 um | 4: 100 | 6: 120 | 8: 140 | 11: 160.  Os numeros sao ESTIMATIVA minha (a regra e dele, a curva
         nao veio de ficha): se ele der valores do aplicativo, trocar aqui e no xag_parametros.js (mesma conta).
       P.gota passa a devolver a gota que o bico FAZ (a pedida, ou a minima se a pedida for mais fina); quem escreve em
       P.gota continua guardando a pedida, e quando a vazao cai a gota volta para ela. */
    function vazaoPorBico(planejada) {
      var n = (window.xgPulv && xgPulv.perfil && xgPulv.perfil.bicos && xgPulv.perfil.bicos.length) || 2;
      var ms = !planejada && V.estado === "aplicando" && V.v > 0.5 ? V.v : (Number(P.vel) || 0);
      return Math.max(0, (Number(P.vazao) || 0) * ms * 3.6 * (Number(P.faixa) || 6.5) / 600) / n;
    }
    X.gotaMinima = function (q) {
      if (X.semCarga) return 60;
      q = q == null ? vazaoPorBico(false) : q;
      return Math.min(400, Math.max(60, Math.round(60 * Math.pow(Math.max(1, q), 0.4) / 10) * 10));
    };
    X.vazaoPorBico = vazaoPorBico;
    X.gotaMin = 60;
    try {
      var gotaPedida = Number(P.gota) || 150;
      Object.defineProperty(P, "gota", {
        configurable: true, enumerable: true,
        /* a conta e feita na leitura: no chao o passo do voo nao roda, e o limite tem de valer tambem ali */
        get: function () { X.gotaMin = X.gotaMinima(); return Math.max(gotaPedida, X.gotaMin); },
        set: function (v) { v = Number(v); if (isFinite(v) && v > 0) gotaPedida = v; }
      });
      X.gotaPedida = function () { return gotaPedida; };
    } catch (e) { /* P.gota fica como era: sem o limite */ }
    /* relogio proprio: no manual o jogo nao conta V.tempo */
    var agora = function () { return X.t; };

    /* ------------------------------------------------- 2. entrada e saida */
    function pontoDeEntrada() {
      if (window.xgRotaXag && window.xgRotaXag.entrada) return window.xgRotaXag.entrada;
      return rota && rota.length ? rota[0].p : null;
    }
    function naArea() {
      /* "dentro da operacao": trabalhando, parado no meio dela ou no manual
         longe da base */
      var d = drone.position, e = pontoDeEntrada();
      if (!e) return false;
      return Math.hypot(d.x - BASE.x, d.z - BASE.z) > 8 && Math.hypot(d.x - e[0], d.z - e[1]) > 3;
    }
    var retornoOriginal = iniciarRetorno;
    iniciarRetorno = function (retomar) {
      var vinhaDe = V.estado === "pairando" ? V.antesPairar : V.estado;
      var dentro = ["aplicando", "descendo", "manual", "pairando"].indexOf(vinhaDe) >= 0 && naArea();
      retornoOriginal(retomar);
      /* sai pela entrada e volta pelos pontos de seguranca, do lote para a base */
      var volta = (X.caminho || []).slice().reverse();
      X.saida = dentro ? pontoDeEntrada() : (volta.length ? volta.shift() : null);
      X.filaSaida = dentro ? volta : volta;
    };

    /* ------------------------------------------------- largura da faixa
       A conta do jogo e a do T50 (bico centrifugo: a gota manda na largura).
       No P60 (RevoSpray) a faixa util e de 6 a 8 m (manual XAG P60/P150):
       ~7 m a 3 m de altura, mais estreita baixo e mais larga alto; a gota
       muda pouco. */
    if (typeof larguraEfetiva === "function") {
      /* Eduardo, 08/10/2026: "a 3 de altura coloca 6,5 de faixa".
         Eduardo, 17/11/2026: "o xag tambem precisa ter esse tipo de variacao ela nunca e sempre da mesma forma". Com a
         fisica das gotas instalada (pulverizacao.js), a largura mostrada e a MESMA da fisica: a faixa de referencia do
         modelo a 3 m (P60 6,5 m) mexendo com gota, velocidade real e altura. Sem a fisica, vale a conta fixa de antes. */
      var larguraDaFisica = larguraEfetiva;
      larguraEfetiva = function () {
        if (window.xgPulv && window.xgPulv.motor) return larguraDaFisica();
        var E = efetivo(), h = trava(.45 + .55 * E.altura / 3, .6, 1.15);
        return 6.5 * h;
      };
    }

    /* ------------------------------------------------- perto do chao
       Vantagem do XAG (Eduardo, 07/10): quando fica perto demais do solo
       (o terreno sobe a frente mais rapido que ele sobe), ele REDUZ a
       velocidade para conseguir acompanhar. So com o seguimento de terreno
       valendo no trecho; com ele desligado o aluno pode bater (e a aula). */
    function freioPertoDoChao(dt) {
      if (["aplicando", "indo", "voltando", "descendo"].indexOf(V.estado) < 0 || V.v < 1 || !X.seguindo) { X.velLivre = V.v; return; }
      var d = drone.position, alvo = X.aglAlvo || P.altura || 3, folga = Infinity;
      for (var s = 0.5; s <= 2.5; s += 0.5) {
        var x = d.x + V.dirx * V.v * s, z = d.z + V.dirz * V.v * s;
        folga = Math.min(folga, d.y - alt(x, z));
      }
      folga = Math.min(folga, d.y - alt(d.x, d.z));
      /* Eduardo (07/10): caiu 1,5 m abaixo da altura programada -> reduz para
         80% da velocidade que vinha (so isso, o bastante para o radar
         acompanhar); com folga de novo, o jogo acelera de volta sozinho */
      var deficit = alvo - folga;
      X.ultimoDeficit = deficit;
      if (deficit < 1.5) { X.velLivre = V.v; return; }
      var ref = Math.max(V.v, X.velLivre || V.v);
      var teto = Math.max(1, ref * 0.8);
      /* o jogo acelera 2,5 m/s2 no mesmo passo: 5 aqui da uma freada suave de 2,5 */
      if (V.v > teto) V.v = Math.max(teto, V.v - 5 * dt);
      X.freouPertoDoChao = (X.freouPertoDoChao || 0) + dt;
      /* e sobe mais rapido que a subida normal (3 m/s), tanto mais quanto
         mais a altura caiu */
      {
        var extra = Math.min(2.5, (deficit - 1.5) * 2 + 0.5);
        d.y += extra * dt;
        X.subidaExtra = Math.max(X.subidaExtra || 0, extra);
      }
    }

    /* 5. radar lendo o chao como obstaculo (Eduardo, 07/10): acima de
       8 m/s, se a aeronave cai 2 m abaixo da altura programada, o radar
       frontal ve o terreno, ela para e fica pairando esperando o operador.
       So com a evitacao de obstaculos ligada e fora do voo 3D. */
    function radarLeChao() {
      if (!P.desvio || P.xg3d || X.ultimoDeficit === undefined) return;
      if (V.estado !== "aplicando" && V.estado !== "indo" && V.estado !== "voltando") return;
      if (X.velAntes > 8 && X.ultimoDeficit >= 2) {
        V.xgPorque = "Acima de 8 m/s e 2 m abaixo da altura programada, o radar frontal leu o próprio terreno como obstáculo. A aeronave parou e ficou pairando esperando o operador. Em área de morro, reduza a velocidade ou use o voo 3D sem mapas.";
        V.obs = { nome: "o terreno", tipo: "relevo" };
        pairar("Obstáculo detectado", "", [{ txt: "Retomar", fn: function () { V.estado = V.antesPairar || "aplicando"; } },
          { txt: "Retornar à base", fn: function () { iniciarRetorno(pontoAtual()); } }]);
      }
    }

    /* 5b. desvio lateral tambem na ida e na volta (Eduardo, 11/10/2026: "quando
       o desvio ta ativado o drone tem que desviar da arvore"). O jogo so contorna
       aplicando; no transito ele parava e pairava. Aqui, quando o radar para a
       aeronave indo ou voltando, o mesmo contorno do jogo (tentarDesvioAutomatico)
       vira pontos na fila da entrada (X.entrar) ou da saida (X.saida) e ela segue.
       Sem lado livre (fio atravessando, encosta) continua pairando. */
    function desvioNoTransito(estadoAntes) {
      if (!P.desvio || P.xg3d || V.estado !== "pairando") return;
      if (estadoAntes !== "indo" && estadoAntes !== "voltando") return;
      var o = V.obs;
      if (!o || o.tipo === "relevo" || typeof tentarDesvioAutomatico !== "function") return;
      var antes = V.desvioLat; V.desvioLat = null;
      var pts = tentarDesvioAutomatico(o) && V.desvioLat ? V.desvioLat.pontos.slice() : null;
      V.desvioLat = antes;
      if (!pts) return;
      if (estadoAntes === "indo") {
        X.entrar = { fila: pts.concat(X.entrar ? X.entrar.fila : []), ponto: pts[0], retomar: X.entrar ? X.entrar.retomar : V.retomar };
        X.entrou = true;
      } else {
        X.filaSaida = pts.slice(1).concat(X.saida ? [X.saida] : [], X.filaSaida || []);
        X.saida = pts[0];
      }
      if (/^O radar parou a aeronave antes/.test(V.xgPorque || "")) V.xgPorque = null;
      V.estado = estadoAntes; V.freando = false; V.obs = null;
    }

    /* 7. voo 3D sem mapas (Eduardo, 07/10): o radar da frente e o de baixo
       trabalham juntos. Qualquer objeto a frente: sobe por cima e continua
       pulverizando (fio, arvore). Em morro o radar ve o chao: sobe ate o
       radar ficar livre, quase sempre alto demais, desce de novo, e vai dando
       umas freadas no ar. Velocidade maxima 8 m/s (28,8 km/h). */
    function voo3d(dt) {
      if (["aplicando", "indo", "voltando", "descendo"].indexOf(V.estado) < 0) return;
      P.desvio = false;                         // o desvio lateral/parada do jogo nao vale no 3D
      if (V.v > 8) V.v = 8;
      var d = drone.position, agl = V.estado === "aplicando" ? P.altura : P.rth, base = alt(d.x, d.z) + agl;
      /* objeto a frente (o mesmo radar do jogo, fio incluido): sobe por cima */
      var desv = P.desvio; P.desvio = true;
      var s = typeof sondar === "function" ? sondar(V.dirx, V.dirz) : null;
      P.desvio = desv;
      if (s && s.c && s.c.tipo !== "relevo" && s.d < 20) {
        var topo = s.c.y1 !== undefined ? s.c.y1 : (s.c.topo !== undefined ? s.c.topo : (s.c.a && s.c.b ? Math.max(s.c.a.y, s.c.b.y) : d.y + 3));
        var precisa = topo + 2.5 - base;
        if (precisa > (V.extra || 0)) V.extra = precisa;
        /* nao chega embaixo dele: freia o bastante para dar tempo de subir */
        var subir = Math.max(0, topo + 2.5 - d.y), tempo = Math.max(0.3, (s.d - 2) / Math.max(0.5, V.v));
        if (subir / 3 > tempo) V.v = Math.max(1.5, V.v * 0.85);
        X.passou3d = s.c;
        X.subiuPorCima3d = (X.subiuPorCima3d || 0) + 1;
        return;
      }
      /* morro: o terreno sobe a frente -> le o chao, sobe demais e freia */
      var ax = d.x + V.dirx * 6, az = d.z + V.dirz * 6, incl = (alt(ax, az) - alt(d.x, d.z)) / 6;
      if (incl > 0.18 && agora() > (X.morro3dAte || 0)) {
        V.extra = Math.max(V.extra || 0, 4 + Math.random() * 3);
        V.v = V.v * 0.6;
        X.morro3dAte = agora() + 1.6;
        X.freadas3d = (X.freadas3d || 0) + 1;
        return;
      }
      /* livre: desce de volta para a altura programada */
      if ((V.extra || 0) > 0) V.extra = Math.max(0, V.extra - 1.5 * dt);
    }

    /* a explicacao da queda no relevo e a do DJI (cenario Montanhas e
       pomares); no XAG vale o manual dele */
    if (typeof cair === "function") {
      var cairAntes = cair;
      cair = function (c) {
        if (c && c.nome === "o relevo" && !c.xg) {
          c = { nome: c.nome, xg: true, dica: P.estab && P.xgTerreno !== "off"
            ? "O terreno subiu mais rápido do que a aeronave conseguiu acompanhar. Em área íngreme, o manual da XAG recomenda começar com altura maior (cerca de 8 m) e velocidade menor (10 a 15 km/h) e ir ajustando conforme o drone acompanha o terreno."
            : "Com o seguimento de terreno desligado (Totalmente fechado ou fora do trecho escolhido), a altura é contada a partir da decolagem. O terreno subiu e a aeronave não." };
        }
        return cairAntes(c);
      };
    }

    /* ------------------------------------------------- 1. terreno */
    var alvoAntes = alturaAlvo;
    alturaAlvo = function (agl) {
      var modo = P.xgTerreno || "all";
      /* ida = da base ate a rota; volta = para a base; o resto (aplicando,
         descendo e as ligacoes entre passadas) e a rota de operacao */
      /* 18/11/2026 (Eduardo, testando o P60: "quando ta tudo ligado o xag acompanha o terreno"): desde 23/10/2026 o jogo
         pede, na ida, a altura de OPERACAO (regra feita para o DJI). No XAG a ida e a "Rota de aproximacao", que tem a
         altura dela (P.rth): sem isto a ida voava na altura de operacao e nao era reconhecida como ida, entao os modos
         "Apenas rotas de operacao" e "Aproximando-se apenas da rota" ficavam trocados nesse trecho. Agora a ida do XAG
         volta a ser sempre a rota de aproximacao, na altura dela, e segue o terreno conforme o modo escolhido. */
      if (V.estado === "indo" || (V.estado === "subindo" && V.retomar)) agl = P.rth;
      var ida = agl === P.rth && (V.estado === "indo" || (V.estado === "subindo" && V.retomar));
      var volta = agl === P.rth && V.estado === "voltando";
      var transito = ida || volta;
      var segue = modo === "all" || (modo === "approach" && transito) || (modo === "operation" && !transito);
      X.seguindo = segue && (P.estab || transito); X.aglAlvo = agl;
      if (!segue) {
        if (transito) return alvoAntes(agl);           // nivel da decolagem (manual.js)
        var e = P.estab; P.estab = false;
        try { return alvoAntes(agl); } finally { P.estab = e; }
      }
      if (!transito) return alvoAntes(agl);
      /* deslocamento acompanhando o terreno: o mesmo olhar a frente do jogo */
      var d = drone.position, olhar = Math.max(1.5, V.v * 0.6);
      var chao = Math.max(alt(d.x, d.z), alt(d.x + V.dirx * olhar, d.z + V.dirz * olhar));
      return chao + agl + (V.extra || 0) + (V.xgAjuste || 0);
    };

    /* ------------------------------------------------- 4. sinal */
    function linhaLivre() {
      var o = grupoOperador.position, d = drone.position;
      var ax = o.x, ay = o.y + 1.3, az = o.z, dx = d.x - ax, dy = d.y - ay, dz = d.z - az;
      var dist = Math.hypot(dx, dy, dz);
      if (dist > 900) return "distância";
      var perto = colisores.filter(function (c) {
        /* fio nao corta o link; o que esta colado no operador tambem nao */
        if (c.fio || Math.hypot(c.cx - ax, c.cz - az) < c.raio + 1.5) return false;
        /* distancia do centro do obstaculo ate o segmento operador-aeronave, no plano */
        var t = Math.max(0, Math.min(1, ((c.cx - ax) * dx + (c.cz - az) * dz) / (dx * dx + dz * dz || 1)));
        return Math.hypot(ax + dx * t - c.cx, az + dz * t - c.cz) < c.raio + 1;
      });
      var q = new THREE.Vector3(), n = Math.max(2, Math.ceil(dist / 1.5));
      for (var k = 1; k < n; k++) {
        var t = k / n;
        q.set(ax + dx * t, ay + dy * t, az + dz * t);
        if (alt(q.x, q.z) > q.y + 0.2) return "o relevo";
        for (var i = 0; i < perto.length; i++) if (distColisor(perto[i], q) < 0.15) return perto[i].nome || "um obstáculo";
      }
      return "";
    }
    function conferirSinal() {
      var t = agora();
      if (t - X.verificadoEm < 0.1) return;
      X.verificadoEm = t;
      var noAr = ["em solo", "concluído", "caiu", "reabastecendo"].indexOf(V.estado) < 0;
      var bloqueio = noAr ? linhaLivre() : "";
      if (bloqueio) {
        X.comSinalDesde = 0;
        if (!X.semSinalDesde) X.semSinalDesde = t;
        if (X.sinal && t - X.semSinalDesde > 0.4) { X.sinal = false; X.bloqueio = bloqueio; X.perdidoEm = t; }
      } else {
        X.semSinalDesde = 0;
        if (!X.comSinalDesde) X.comSinalDesde = t;
        if (!X.sinal && t - X.comSinalDesde > 1.5) { X.sinal = true; X.bloqueio = ""; }
      }
    }

    /* ------------------------------------------------- 3. bateria */
    function porcentoPara(segundos) {
      var carga = V.tan / T50.tanque;
      var autonomia = T50.autonomiaVazioMin - (T50.autonomiaVazioMin - T50.autonomiaCheioMin) * carga;
      return segundos / 60 * 100 / autonomia;
    }
    function precisoParaVoltar() {
      var d = drone.position, e = X.saida || (naArea() ? pontoDeEntrada() : null);
      var vel = Math.min(10, Math.max(P.vel || 6, 6) * 1.3);
      /* daqui: entrada (se estiver no lote), os pontos de seguranca de tras para frente e a base */
      var trajeto = [[d.x, d.z]];
      if (e) trajeto.push(e);
      (X.saida ? (X.filaSaida || []) : (X.caminho || []).slice().reverse()).forEach(function (p) { trajeto.push(p); });
      trajeto.push([BASE.x, BASE.z]);
      var h = 0;
      for (var k = 1; k < trajeto.length; k++) h += Math.hypot(trajeto[k][0] - trajeto[k - 1][0], trajeto[k][1] - trajeto[k - 1][1]);
      var subir = Math.max(0, (alt(d.x, d.z) + P.rth) - d.y) / 3;
      var descer = Math.max(2, (P.rth + 1) / 2.5);   // o jogo desce a 2,5 m/s
      /* aceleracao, freada e a curva na entrada: 8% e 3 s de folga */
      return porcentoPara((h / vel) * 1.08 + subir + descer + 3);
    }

    /* ------------------------------------------------- passo */
    var passoAntes = passo;
    passo = function (dt) {
      var d = drone.position;
      X.t += dt; X.velAntes = V.v; X.ultimoDeficit = undefined;
      X.gotaMin = X.gotaMinima();                                   // 6. a gota mais fina que o bico faz com a vazao de agora
      conferirSinal();

      /* 4. sem sinal os manches nao chegam: ela solta tudo e paira */
      if (!X.sinal) {
        var M = window.xgManches;
        if (M) M.thr = M.yaw = M.pitch = M.roll = 0;
      }

      /* 3. a regra fixa de 25% do jogo nao vale: quem decide e o calculo */
      var limite = typeof P.xgBatPouso === "number" ? P.xgBatPouso : 10;
      /* no manual tambem: o retorno de energia e da aeronave, nao da rota */
      var trabalhando = ["aplicando", "descendo", "pairando", "indo", "subindo", "manual"].indexOf(V.estado) >= 0;
      X.precisa = trabalhando ? precisoParaVoltar() : 0;
      V.avisoBat = true;
      if (trabalhando && V.bat - X.precisa <= limite && !X.retornoBateria) {
        X.retornoBateria = true;
        V.xgPorque = "Retorno automático de energia: com " + Math.round(V.bat) + "% a aeronave calculou que precisava sair da lavoura para pousar com " + limite + "%.";
        if (V.estado === "manual") { V.retomar = V.retomar || pontoAtual(); V.rodando = true; }
        iniciarRetorno(["aplicando", "pairando", "descendo", "manual"].indexOf(V.estado) >= 0 ? pontoAtual() : V.retomar);
      }
      if (V.estado === "reabastecendo" || V.estado === "em solo") X.retornoBateria = false;

      /* 2. a volta passa pela entrada; a ida para o meio do talhao tambem */
      if (V.estado === "indo" && V.retomar && !X.entrar && !X.entrou) {
        var e = pontoDeEntrada(), r = V.retomar.p, fila = (X.caminho || []).slice();
        if (e && Math.hypot(r[0] - e[0], r[1] - e[1]) > 3) fila.push(e);
        if (fila.length) X.entrar = { fila: fila, ponto: fila[0], retomar: V.retomar };
        X.entrou = true;
      }
      if (V.estado !== "indo") { X.entrar = null; X.entrou = false; }
      var base = null, retomar = null;
      if (V.estado === "voltando" && X.saida) {
        if (Math.hypot(X.saida[0] - d.x, X.saida[1] - d.z) < Math.max(1, V.v * dt * 3)) X.saida = X.filaSaida && X.filaSaida.length ? X.filaSaida.shift() : null;
        else { base = { x: BASE.x, z: BASE.z }; BASE.x = X.saida[0]; BASE.z = X.saida[1]; }
      }
      if (V.estado === "indo" && X.entrar) {
        if (Math.hypot(X.entrar.ponto[0] - d.x, X.entrar.ponto[1] - d.z) < Math.max(1, V.v * dt * 3)) {
          X.entrar.fila.shift();
          X.entrar = X.entrar.fila.length ? { fila: X.entrar.fila, ponto: X.entrar.fila[0], retomar: X.entrar.retomar } : null;
        }
        if (!X.entrar) { /* chegou: segue para a rota */ }
        else { retomar = V.retomar; V.retomar = { p: X.entrar.ponto, i: retomar.i }; }
      }

      /* 8. operacao sem carga: voa a rota sem calda (sem pulverizar) e o
         tanque vazio nao manda voltar */
      var tanReal = null;
      if (P.xgSemCarga && V.tan <= 0.05) { tanReal = V.tan; V.tan = 0.06; }

      /* 7. voo 3D sem mapas: radar frontal + o de baixo viram um so */
      var desvioAntes = P.desvio;
      if (P.xg3d) voo3d(dt);

      /* 5. desvio so lateral: o jogo so sobe por cima em "montanha" */
      var terreno = P.terreno, pref = P.xgDesvioPref;
      P.terreno = P.terreno === "agua" ? "agua" : "planicie";
      P.xgDesvioPref = 0;
      var estadoAntes = V.estado, resultado;
      try { resultado = passoAntes(dt); freioPertoDoChao(dt); radarLeChao(); desvioNoTransito(estadoAntes); }
      finally {
        P.terreno = terreno; P.xgDesvioPref = pref; P.desvio = desvioAntes;
        if (tanReal !== null && V.tan >= 0.06) V.tan = tanReal;
        if (base) { BASE.x = base.x; BASE.z = base.z; }
        if (retomar) {
          /* chegou a entrada neste passo: o jogo ja ia descer; continua indo */
          if (V.estado === "descendo" && estadoAntes === "indo") { V.estado = "indo"; V.i = retomar.i; X.entrar = null; }
          V.retomar = retomar;
        }
        /* chegou a saida neste passo: o jogo ja ia pousar; continua voltando */
        if (base && V.estado === "pousando" && estadoAntes === "voltando") { V.estado = "voltando"; X.saida = null; }
      }
      return resultado;
    };
    return true;
  }

  var instalado = false;
  return {
    instalar: function (ponte) {
      if (instalado) return true;
      instalado = ponte.rodar("(" + instalarNoCampo.toString() + ")()") === true;
      return instalado;
    },
    /* o app (vinculo_xag.js) manda as escolhas do aluno */
    configurar: function (ponte, cfg) {
      var partes = [];
      if (cfg.terreno) partes.push("P.xgTerreno=" + JSON.stringify(String(cfg.terreno)) + ";");
      if (typeof cfg.batPouso === "number" && isFinite(cfg.batPouso)) partes.push("P.xgBatPouso=" + Math.max(0, Math.min(50, cfg.batPouso)) + ";");
      partes.push("P.xg3d=" + (cfg.voo3d ? "true" : "false") + ";P.xgSemCarga=" + (cfg.semCarga ? "true" : "false") + ";");
      if (cfg.semCarga) partes.push("P.xgPulverizar=false;"); else partes.push("if(P.xgPulverizar===false&&P.xgSemCargaAntes)P.xgPulverizar=true;");
      partes.push("P.xgSemCargaAntes=" + (cfg.semCarga ? "true" : "false") + ";");
      /* 19/11/2026: "Pulverize durante a mudanca de faixa" do app (ambos | externos | off), usada na curva (campo: xgArcoXag) */
      partes.push("P.xgMudanca=" + JSON.stringify(cfg.mudanca === "off" || cfg.mudanca === "externos" ? cfg.mudanca : "ambos") + ";");
      partes.push("if(window.xgVooXag)xgVooXag.caminho=" + JSON.stringify((cfg.caminho || []).filter(function (p) { return p && isFinite(p[0]) && isFinite(p[1]); })) + ";");
      if (partes.length) ponte.rodar("(function(){" + partes.join("") + "})()");
    },
    /* sinal e bateria para o app e o relatorio */
    estado: function (ponte) {
      return ponte.ler("window.xgVooXag ? {sinal: xgVooXag.sinal, bloqueio: xgVooXag.bloqueio, precisa: xgVooXag.precisa} : null");
    },
    instalado: function () { return instalado; }
  };
})();
