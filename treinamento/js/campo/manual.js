/* ==========================================================================
   VOO MANUAL PELOS MANCHES

   O jogo so sabe voar a rota automatica. Aqui entra o manual, com os dois
   manches do aparelho e os tres modos do RC Plus - o escolhido nas
   Configuracoes do CR do controle (`modoJoystick`, 2 de fabrica):

                 manche ESQUERDO          manche DIREITO
     Modo 1      frente/tras + guinada    subir/descer + lados
     Modo 2      subir/descer + guinada   frente/tras + lados
     Modo 3      frente/tras + lados      subir/descer + guinada

   Como se pilota:
     teclado   manche esquerdo W A S D, manche direito as setas
     mouse     arrastando os manches do desenho do aparelho

   Como no aparelho:
     - os motores ligam com o CSC: os dois manches para baixo e para
       dentro (ou para fora), segurados meio segundo;
     - no chao, acelerador todo para baixo por 3 s desliga os motores (p.48);
     - com a rota rodando, mexer no manche de inclinacao ou de rolagem pausa
       a tarefa, freia e passa para o manual ("Tarefa pausada. Modo
       manual"); Retomar volta a rota (ponto de interrupcao ou 1/2).

   O passo do voo roda DENTRO do jogo, trocando o `passo` dele quando o
   estado e "manual". A colisao e a queda sao as do proprio jogo
   (colisores, distColisor, cair), entao o manual derruba igual a rota.
   ========================================================================== */

window.MANUAL = (function () {
  "use strict";

  /* ------------------------------------------------ o que roda no campo

     Estas duas funcoes nao rodam aqui: o texto delas e levado para dentro
     do jogo (toString + eval), onde V, drone, alt, colisores e cair existem.
     Por isso nao podem usar nada deste arquivo. */

  function instalarNoCampo() {
    if (window.__xgManual) return true;
    if (typeof passo !== "function") return false;
    window.__xgManual = true;
    window.xgManches = { thr: 0, yaw: 0, pitch: 0, roll: 0 };

    /* Ponto de interrupcao (manual p.87; Fase 0, item 0.7): uma regra so
       para o manche, a Pausa e o RTH. A posicao atual vira o ponto C so
       trabalhando (pulverizando na passada, descendo para retomar ou
       pairando no meio da passada); na subida, no translado, no RTH, no pouso
       e ja no manual o ponto gravado fica. No fim da rota nao ha o que
       retomar. Indo a um ponto de retorno 1/2, o ponto e ele mesmo. */
    window.xgGravarInterrupcao = function () {
      if (V.xgVolta && (V.estado === "aplicando" || V.estado === "pairando")) {
        V.retomar = { p: [V.xgVolta[0], V.xgVolta[1]], i: V.i };
        return;
      }
      if (typeof rota === "undefined" || !rota || V.i >= rota.length) { V.retomar = null; return; }
      var w = rota[V.i];
      var trab = V.estado === "aplicando" || V.estado === "descendo" ||
                 (V.estado === "pairando" && V.antesPairar === "aplicando");
      var noTrajeto = trab && !(V.estado === "aplicando" && w && (w.con || w.alto));
      if (noTrajeto || (trab && !V.retomar)) V.retomar = pontoAtual();
    };

    var original = passo;
    passo = function (dt) {
      /* bomba armada pelo "Iniciar" do app (app_rcplus.js "pulvManual") some se a aeronave passa ao voo automatico (rota, volta, pouso) ou cai */
      var pulArm = window.xgPulvManual;
      if (pulArm && (pulArm.armada || pulArm.mmais) && ["subindo", "indo", "aplicando", "descendo", "voltando", "pousando", "reabastecendo", "concluído", "caiu"].indexOf(V.estado) >= 0) {
        if (pulArm.mmais) pulArm.ligado = false;   /* o M+ acabou: se a volta for cancelada, a bomba nao sai sozinha */
        pulArm.armada = false; pulArm.mmais = false;
      }
      if (P.xgMapeamento) {
        var pulMap = window.xgPulvManual;
        if (pulMap) { pulMap.ligado = false; pulMap.esgotar = false; }
        V.aplicando = false; V.vazaoAtual = 0;
      }
      if (V.estado === "manual") {
        /* 08/10/2026: entrando no manual vindo da rota (Pairar), a altura do
           manual parte da altura de agora. Antes ficava a da pausa anterior e a
           aeronave saltava para ela num instante. */
        if (!V.xgNoManual) { V.xgNoManual = true; V.xgAgl = Math.max(0, drone.position.y - alt(drone.position.x, drone.position.z)); }
        return xgPassoManual(dt);
      }
      V.xgNoManual = false;

      /* Retomada por um ponto de retorno 1/2 (app_rcplus.js, "retomar"): a
         aeronave vai reta ate ele, sem pulverizar, pelo desvio lateral do
         jogo. Se um desvio automatico tomar o lugar no caminho, o alvo volta
         depois dele; chegou, segue a rota pulverizando. */
      if (V.xgVolta) {
        if (V.estado !== "aplicando" && V.estado !== "pairando") V.xgVolta = null;
        else if (V.estado === "aplicando" && !V.desvioLat) {
          if (Math.hypot(drone.position.x - V.xgVolta[0], drone.position.z - V.xgVolta[1]) < 0.3) V.xgVolta = null;
          else V.desvioLat = { pontos: [V.xgVolta.slice()], obs: null, p: V.xgVolta.slice() };
        }
      }

      /* "Sistemas de pulverizacao" desligado no controle: a aeronave faz a
         rota sem soltar produto. Vazao zero e pintura segura, so durante
         este passo - o jogo gasta a calda no mesmo passo em que anda. */
      var semCalda = !!P.xgMapeamento || P.xgPulverizar === false, vazao = P.vazao, r;
      if (semCalda) { P.vazao = 0; window.__xgSemPintar = true; }
      try { r = original(dt); }
      finally { if (semCalda) { P.vazao = vazao; window.__xgSemPintar = false; } }

      /* a volta a base na velocidade de RTH do controle: o jogo calcula a
         dele a partir da velocidade de trabalho */
      if (V.estado === "voltando" && typeof P.rthVel === "number" && V.v > P.rthVel) V.v = P.rthVel;
      return r;
    };

    /* O jeito da DJI nos deslocamentos (palavras dele): a altitude de RTH e
       contada do PONTO DE DECOLAGEM e a aeronave vai em linha reta, sem
       acompanhar o terreno - na ida ao talhao, na volta a base e na subida
       antes de ir. Na volta, se ja esta acima desse nivel vem reto; se esta
       abaixo, sobe ate nivelar e vem reto. O jogo acompanhava o terreno em
       tudo. So a aplicacao continua seguindo a cultura. */
    if (typeof alturaAlvo === "function") {
      var alvoOriginal = alturaAlvo;
      var TRANSITO = { indo: 1, voltando: 1 };
      alturaAlvo = function (agl) {
        /* o ajuste do acelerador durante a rota vale em qualquer trecho */
        var ajuste = V.xgAjuste || 0;
        /* 18/11/2026 (Eduardo: "lembra que o drone nao acompanha terreno o terreno indo para o ponto de pulverizacao e nem
           quando ta voltando"). Desde 23/10/2026 a ida ao ponto inicial e feita na altura programada, e nao mais na de
           RTH; como a regra de baixo so valia para a altitude de RTH, a ida tinha voltado a acompanhar o terreno. Agora
           a ida mantem o nivel em que a subida da decolagem terminou: altura programada contada do chao do ponto de onde
           ela saiu (V.xgChaoIda). No XAG (voo_xag.js) o acompanhamento na ida e uma opcao do app dele e nao muda. */
        if (V.estado !== "indo") V.xgChaoIda = null;
        else if (agl !== P.rth && P.estab && !window.xgVooXag) {
          if (V.xgChaoIda == null) V.xgChaoIda = alt(drone.position.x, drone.position.z);
          return V.xgChaoIda + agl + (V.extra || 0) + ajuste;
        }
        var transito = TRANSITO[V.estado] || (V.estado === "subindo" && V.retomar);
        if (!transito || agl !== P.rth) {
          /* acima da agua nao ha acompanhamento de solo: a altura e fixa,
             contada da decolagem, como com a estabilizacao desligada */
          if (P.terreno === "agua" && P.estab) {
            P.estab = false;
            try { return alvoOriginal(agl) + ajuste; } finally { P.estab = true; }
          }
          return alvoOriginal(agl) + ajuste;
        }
        var nivel = alt(BASE.x, BASE.z) + P.rth + (V.extra || 0) + ajuste;
        if (V.estado === "voltando") return Math.max(nivel, drone.position.y);
        return nivel;
      };
    }

    /* E o radar nesses deslocamentos: o desvio automatico so entra com
       velocidade abaixo de 25 km/h e tanque vazio; fora disso a aeronave
       segue reta e pode bater (palavras dele). Aqui o radar e desligado
       durante o passo quando a condicao nao vale. */
    var passoComRadar = passo;
    passo = function (dt) {
      var transito = V.estado === "indo" || V.estado === "voltando";
      var podeDesviar = V.v * 3.6 < 25 && V.tan <= 0.5;
      /* regra do DJI: no XAG (window.xgVooXag, voo_xag.js) a evitacao ligada
         vale tambem na ida e na volta (Eduardo, 11/10/2026) */
      if (!transito || !P.desvio || podeDesviar || window.xgVooXag) return passoComRadar(dt);
      P.desvio = false;
      try { return passoComRadar(dt); } finally { P.desvio = true; }
    };

    /* Esgotar o sistema (botao de pulverizacao segurado): a bomba no maximo
       ate o tanque secar, ligada ou nao a aeronave. Roda no emitir, que o
       laco do jogo chama a cada quadro mesmo com os motores parados. */
    if (typeof emitir === "function") {
      var emitirAntes = emitir;
      emitir = function (dt, ligado) {
        var p = window.xgPulvManual;
        if (P.xgMapeamento) {
          if (p) { p.ligado = false; p.esgotar = false; }
          V.aplicando = false; V.vazaoAtual = 0; ligado = false;
        }
        if (p && p.esgotar) {
          if (V.tan > 0) {
            var l = Math.min(T50.vazaoMaxLmin / 60 * dt, V.tan);
            V.tan -= l; V.vazaoAtual = l / Math.max(dt, 1e-6) * 60; ligado = true;
          } else { p.esgotar = false; V.vazaoAtual = 0; }
        }
        return emitirAntes.call(this, dt, ligado);
      };
    }

    if (typeof pintarFaixa === "function") {
      var pintar = pintarFaixa;
      pintarFaixa = function () { if (!window.__xgSemPintar) return pintar.apply(this, arguments); };
    }

    /* "Desvio de obstaculos" (contornar) e uma chave separada do radar
       multidirecional (frear). Desligada, a aeronave freia e espera ordem.

       Por cenario (palavras dele e as telas do app):
         Planicies       desvia pela lateral; radar fraco no terreno
         Colina/Pomar    pode passar por cima; a preferencia "desviar
                         horizontalmente / verticalmente primeiro" decide
                         o que tenta primeiro; melhor acompanhamento
         Acima da agua   desvia pela lateral; sem acompanhamento de solo
                         (os sensores de baixo nao enxergam a agua)
       O jogo ja faz lateral em planicie/agua e por cima em montanha; o
       que entra aqui e a preferencia da colina. */
    if (typeof tentarDesvioAutomatico === "function") {
      var contornar = tentarDesvioAutomatico;
      tentarDesvioAutomatico = function (o) {
        if (P.xgContornar === false) return false;
        if (P.terreno === "montanha" && typeof P.xgDesvioPref === "number" && P.xgDesvioPref < 50) {
          /* horizontal primeiro: tenta a lateral como na planicie; se nao
             der, passa por cima */
          P.terreno = "planicie";
          var deu = false;
          try { deu = contornar(o); } finally { P.terreno = "montanha"; }
          if (deu) return true;
        }
        return contornar(o);
      };
    }

    /* Sensibilidade do radar "Media": deixa de ver objetos pequenos (poste,
       galho) a distancia - so os enxerga de perto, como o fio. "Alta" ve
       tudo. E a troca que o app descreve: menos alarme falso, mais risco. */
    if (typeof sondar === "function") {
      var sondarOriginal = sondar;
      sondar = function (fx, fz) {
        var s = sondarOriginal(fx, fz);
        if (s && P.xgRadarMedia && s.c && !s.c.fio && s.c.tipo !== "relevo" &&
            typeof s.c.raio === "number" && s.c.raio < 0.6 && s.d > T50.alcanceFio) return null;
        return s;
      };
    }
    return true;
  }

  /* Demarcacao com o controle (pedido dele): com o app no mapeamento pelo
     metodo "Controlador", os manches andam com o personagem - o aluno
     caminha a divisa do talhao como no campo, com o controle na mao.
       manche esquerdo   anda (frente/tras) e de lado
       manche direito    vira (esquerda/direita) e olha para cima/baixo
     Roda DENTRO do campo; precisa da visao do piloto (ponte.js) ja montada,
     porque embrulha a mirarOperador dela. */
  function instalarAndarNoCampo() {
    if (window.__xgAndar) return true;
    if (!window.__xgPiloto || typeof grupoOperador === "undefined" || !grupoOperador ||
        typeof pose !== "function" || typeof bloqueiaCaminhada !== "function") return false;
    window.__xgAndar = true;
    var A = window.xgAndar = { ativo: false, f: 0, l: 0, giro: 0, olhar: 0, correr: false, inclinacao: -0.25 };

    /* 16/10/2026 (Eduardo): a pe (botao "Andar a pe", equipe.js) o rosto vira com o mouse.
       Com o ponteiro preso o mouse gira o corpo e inclina a cabeca; sem prender, arrastar com
       o botao esquerdo faz o mesmo. Esc solta o mouse (o proprio navegador). Preso, o clique
       esquerdo interage (equipe.js, mesma funcao da tecla E). */
    A.sens = 0.0024;
    A.olharMouse = function (dx, dy) {
      if (!A.ativo || modoMapa || !(dx || dy)) return;
      grupoOperador.rotation.y -= dx * A.sens;
      A.inclinacao = Math.max(-1.35, Math.min(1.35, A.inclinacao - dy * A.sens));
    };
    /* 23/11/2026 (Eduardo: "quando coloca em tela cheia sai da tela" ao abastecer "andando a pe"): com o mouse preso a
       dica manda soltar com Esc, e o Esc do navegador tambem tira da tela cheia. Em tela cheia (pedida pela pagina ou a do
       navegador, F11) o mouse NAO e preso: olha-se arrastando com o botao esquerdo (o mesmo de quando a trava falha) e E
       interage. Fora da tela cheia nada muda. */
    A.telaCheia = function () {
      try {
        var w = window.top || window, d = w.document;
        if (d.fullscreenElement || d.webkitFullscreenElement || document.fullscreenElement || document.webkitFullscreenElement) return true;
        var s = w.screen;
        return !!(s && s.width && w.innerWidth >= s.width - 1 && w.innerHeight >= s.height - 1);
      } catch (e) { return false; }
    };
    A.travar = function () {
      if (A.telaCheia()) return;
      try {
        var c = render.domElement;
        if (c && c.requestPointerLock && document.pointerLockElement !== c) {
          var r = c.requestPointerLock();
          if (r && r.catch) r.catch(function () { /* sem trava: arrastar com o botao esquerdo */ });
        }
      } catch (e) { /* segue */ }
    };
    A.soltar = function () { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* segue */ } };
    A.travado = function () { return !!document.pointerLockElement; };
    function aPeAgora() { var q = window.xgEquipe; return !!(q && q.aPe); }
    document.addEventListener("mousemove", function (e) {
      if (!A.ativo || !aPeAgora()) return;
      if (document.pointerLockElement || ((e.buttons & 1) && e.target === render.domElement)) A.olharMouse(e.movementX, e.movementY);
    });
    document.addEventListener("mousedown", function (e) {
      if (!A.ativo || !aPeAgora() || e.button !== 0) return;
      if (document.pointerLockElement) { if (window.xgEquipe.interagir) window.xgEquipe.interagir(); return; }
      if (e.target === render.domElement) A.travar();
    });

    function andarPasso(dt) {
      if (!A.ativo || modoMapa || !(dt > 0)) return;
      var o = grupoOperador.position;
      /* manche para a direita vira para a direita (horario visto de cima) */
      grupoOperador.rotation.y -= A.giro * 1.8 * dt;
      A.inclinacao = Math.max(-1.35, Math.min(1.35, A.inclinacao + A.olhar * dt));
      var r = grupoOperador.rotation.y;
      var fx = Math.sin(r), fz = Math.cos(r), rx = -Math.cos(r), rz = Math.sin(r);
      var mag = Math.min(1, Math.hypot(A.f, A.l));
      if (mag > 0.08) {
        var correr = A.correr, vel = (correr ? 3.5 : 1.6) * mag;
        var mx = fx * A.f + rx * A.l, mz = fz * A.f + rz * A.l, n = Math.hypot(mx, mz) || 1;
        var nx = o.x + mx / n * vel * dt, nz = o.z + mz / n * vel * dt;
        var bl = bloqueiaCaminhada(nx, nz); if (bl) { nx = bl[0]; nz = bl[1]; }
        /* a pe (equipe.js): o drone, o misturador, o gerador e a carretinha nao se atravessam */
        var eq = window.xgEquipe;
        if (eq && eq.aPe && eq.bloquearPe) { var bl2 = eq.bloquearPe(nx, nz); if (bl2) { nx = bl2[0]; nz = bl2[1]; } }
        o.x = Math.max(-600, Math.min(600, nx)); o.z = Math.max(-650, Math.min(450, nz));
        andar.fase += vel * dt / (correr ? 1.9 : 1.35) * Math.PI;
        andar.amp += ((correr ? 0.62 : 0.42) - andar.amp) * Math.min(1, dt * 6);
      } else andar.amp += (0 - andar.amp) * Math.min(1, dt * 8);
      o.y = alt(o.x, o.z);
      pose(andar.fase);
    }

    var posAntes = posCamera;
    posCamera = function (a, dt) { andarPasso(dt || 0); return posAntes.apply(this, arguments); };
    /* andando, o operador nao fica virando para o drone */
    var acompAntes = acompanharDrone;
    acompanharDrone = function () { if (A.ativo) return; return acompAntes.apply(this, arguments); };
    /* e olha para onde anda, nao para a aeronave */
    var mirarAntes = mirarOperador;
    mirarOperador = function () {
      if (!A.ativo) return mirarAntes.apply(this, arguments);
      var o = grupoOperador.position, r = grupoOperador.rotation.y;
      var olho = new THREE.Vector3(o.x, o.y + 1.62, o.z), b = A.inclinacao;
      cam.position.copy(olho);
      cam.lookAt(olho.x + Math.sin(r) * 10 * Math.cos(b), olho.y + Math.sin(b) * 10, olho.z + Math.cos(r) * 10 * Math.cos(b));
      cam.updateMatrixWorld();
    };
    return true;
  }

  function xgPassoManual(dt) {
    var M = window.xgManches, d = drone.position;
    /* travado pelo radar (T25/T50): so o comando de afastar vale (radar.js, comando) */
    if (window.xgProtecao && window.xgProtecao.comando) M = window.xgProtecao.comando(M);
    var VEL_H = 10, SOBE = 4, DESCE = 3;   // VEL_H: limite do T50, 36 km/h
    var GIRO = 90 * Math.PI / 180;
    /* 13/10/2026: aeronave com limites proprios (Air 2S, app_fly.js: modos C/N/S) */
    var LIM = window.xgVooLimites;
    if (LIM) { VEL_H = LIM.velH || VEL_H; SOBE = LIM.sobe || SOBE; DESCE = LIM.desce || DESCE; GIRO = (LIM.giro || 90) * Math.PI / 180; }
    var INC_MAX_GRAUS = LIM && LIM.incMax || 18;   // Agras: 18 (pedido dele); Air 2S: o da ficha

    V.tempo += dt;
    V.mvx = V.mvx || 0; V.mvz = V.mvz || 0; V.vy = V.vy || 0;

    /* Freio da pausa (manual p.87-89: a aeronave "precisa de distancia de
       frenagem"): ao pausar a rota (manche ou botao Pausa) ela freia forte,
       ate 30 graus, sem obedecer aos manches de direcao nem a guinada, e so
       parada volta a ser pilotada. O acelerador continua valendo. */
    var frear = !!V.xgFreio && Math.hypot(V.mvx, V.mvz) >= 0.3;
    if (V.xgFreio && !frear) V.xgFreio = false;

    var solo = alt(d.x, d.z);
    var noChao = d.y <= solo + 0.05;

    /* guinada: manche para a direita gira no sentido horario */
    if (!noChao && !frear) V.yaw -= M.yaw * GIRO * dt;

    /* frente = (cos, -sin), direita = (sin, cos): a mesma conta do jogo */
    var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);
    var rx = Math.sin(V.yaw), rz = Math.cos(V.yaw);

    var alvoX = frear ? 0 : (fx * M.pitch + rx * M.roll) * VEL_H;
    var alvoZ = frear ? 0 : (fz * M.pitch + rz * M.roll) * VEL_H;

    /* A fisica do jogo (Vida de Piloto): o manche pede VELOCIDADE; a
       controladora inclina a aeronave para conseguir a aceleracao, e e a
       inclinacao que empurra. Inclinacao no maximo 18 graus; o arrasto do ar
       foi acertado para que, a 10 m/s com o manche no fundo, ela fique em
       16 graus. Solto o manche, ela empina
       para tras e freia. O vento empurra o corpo e a controladora segura
       (inclinando contra ele) pela parte integral. Pedido dele: no maximo
       18 graus; so na freada brusca (manche solto ou contra o movimento,
       andando rapido) chega a 30. Cruzando a 10 m/s com o manche no fundo
       fica em 16, e sobra um pouco para segurar o vento. */
    var G = 9.8, INC_MAX = INC_MAX_GRAUS * Math.PI / 180, INC_FREADA = Math.max(30, INC_MAX_GRAUS) * Math.PI / 180;
    var INC_CRUZEIRO = 16 * Math.PI / 180;
    var ARRASTO = G * Math.tan(INC_CRUZEIRO) / (VEL_H * VEL_H);
    var AMAX = G * Math.tan(INC_MAX);
    var W = window.xgPulv && window.xgPulv.vento;
    var wx = W ? Math.cos(W.dir) * W.vel : 0, wz = W ? Math.sin(W.dir) * W.vel : 0;
    V.xgAx = V.xgAx || 0; V.xgAz = V.xgAz || 0; V.xgIx = V.xgIx || 0; V.xgIz = V.xgIz || 0;
    if (noChao) {
      /* no chao a aeronave nao anda nem inclina */
      V.mvx = 0; V.mvz = 0; V.xgAx = 0; V.xgAz = 0; V.xgIx = 0; V.xgIz = 0;
    } else {
      var ex = alvoX - V.mvx, ez = alvoZ - V.mvz;
      var vh = Math.hypot(V.mvx, V.mvz);
      /* Manche solto (pedido dele): volta a estabilizar SUAVE - freia com
         metade da forca, inclina no maximo ~15 graus para tras e a atitude
         muda devagar. Os 30 graus ficam so para a freada brusca: o manche
         puxado CONTRA o movimento. */
      var solto = !frear && Math.abs(M.pitch) + Math.abs(M.roll) < 0.05;
      var kp = solto ? 0.9 : 1.8;
      var adx = ex * kp + V.xgIx * 0.6 + ARRASTO * vh * V.mvx;
      var adz = ez * kp + V.xgIz * 0.6 + ARRASTO * vh * V.mvz;
      var na = Math.hypot(adx, adz);
      var contra = !solto && vh > 3 && (alvoX * V.mvx + alvoZ * V.mvz) < 0;
      var lim = contra || frear ? G * Math.tan(INC_FREADA) : solto ? G * Math.tan(15 * Math.PI / 180) : AMAX;
      if (na > lim) { adx *= lim / na; adz *= lim / na; }
      /* a parte integral so acumula perto do alvo e sem a inclinacao no
         limite: senao passa dos 10 m/s depois de acelerar */
      else if (Math.hypot(ex, ez) < 1.5) {
        V.xgIx += ex * dt; V.xgIz += ez * dt;
        var ni = Math.hypot(V.xgIx, V.xgIz);
        if (ni > 4) { V.xgIx *= 4 / ni; V.xgIz *= 4 / ni; }
      }
      /* a atitude leva um instante para chegar (0,2 s com o manche na mao,
         0,5 s solto) e nunca vira de uma vez: no maximo ~35 graus/s */
      var ka = Math.min(1, dt / (solto ? 0.5 : 0.2));
      /* no freio da pausa a atitude vira mais depressa (~70 graus/s): o real
         para em ~1 s (g6 #0174-#0177) */
      var dax = (adx - V.xgAx) * ka, daz = (adz - V.xgAz) * ka, da = Math.hypot(dax, daz), daMax = (frear ? 12 : 6) * dt;
      if (da > daMax) { dax *= daMax / da; daz *= daMax / da; }
      V.xgAx += dax; V.xgAz += daz;
      /* arrasto pelo movimento e o empurrao do vento, separados: a
         inclinacao de cruzeiro nao some com vento a favor */
      var vw = Math.hypot(wx, wz), vh2 = Math.hypot(V.mvx, V.mvz);
      V.mvx += (V.xgAx - ARRASTO * vh2 * V.mvx + ARRASTO * vw * wx) * dt;
      V.mvz += (V.xgAz - ARRASTO * vh2 * V.mvz + ARRASTO * vw * wz) * dt;
      /* teto do T50: 36 km/h (10 m/s), nem com vento a favor passa disso */
      var vt = Math.hypot(V.mvx, V.mvz);
      if (vt > VEL_H) { V.mvx *= VEL_H / vt; V.mvz *= VEL_H / vt; }
    }
    /* inclinacao no corpo: frente (nariz para baixo) e lado (lado direito
       para baixo), lida pela fisica.js para desenhar a aeronave */
    V.xgInc = { p: Math.atan((V.xgAx * fx + V.xgAz * fz) / G), r: Math.atan((V.xgAx * rx + V.xgAz * rz) / G) };

    /* radar: com o desvio ligado, freia antes do obstaculo (fio so e visto
       de muito perto, e continua derrubando) */
    if (window.xgProtecao) xgProtecao.horizontal(dt);
    else if (P.desvio) {
      var sp = Math.hypot(V.mvx, V.mvz);
      if (sp > 0.3) {
        var s = sondar(V.mvx / sp, V.mvz / sp);
        if (s) {
          var folga = s.d - (T50.distSeguranca + T50.raioHelice);
          var vmax = Math.sqrt(2 * T50.frenagem * Math.max(0, folga));
          if (sp > vmax) { V.mvx *= vmax / sp; V.mvz *= vmax / sp; }
          V.ultimoObs = s.c;
        }
      }
    }

    /* Descida (palavras dele): com o manche todo para baixo a aeronave vem
       rapido; chegando a ~1,5 m do chao ela reduz bastante sozinha; a ~20 cm,
       se o manche continua embaixo, ela despenca (os motores soltam) e bate
       no chao - vazia quica um pouco, cheia quase nao quica. */
    var agl = Math.max(0, d.y - solo);
    if (V.xgDespenca && M.thr > 0.3) V.xgDespenca = false;     // acelerou: retoma
    if (V.xgDespenca) {
      V.vy -= 9.8 * dt;                                        // sem empuxo: so a gravidade
    } else {
      var vyAlvo = M.thr > 0 ? M.thr * SOBE : M.thr * DESCE;
      if (M.thr < 0 && !noChao) {
        /* freia para chegar a 1,5 m ja devagar (0,6 m/s) e segue devagar.
           O radar de baixo mede ate o TOPO da lavoura (cenario real com
           milho, soja... - window.__xgDossel do cenario_real.js): sobre a
           cultura a freada comeca acima dela. O despencar continua sendo
           a 20 cm do chao. */
        var dossel = typeof window.__xgDossel === "function" ? Math.max(0, window.__xgDossel(d.x, d.z) || 0) : 0;
        var radar = Math.max(0, agl - dossel);
        var teto = radar > 1.9 ? Math.min(DESCE, 0.6 + Math.sqrt(2 * 3 * (radar - 1.9))) : 0.6;
        vyAlvo = Math.max(vyAlvo, -teto);
        if (agl <= 0.2 && M.thr < -0.7) V.xgDespenca = true;
      }
      var pulM = window.xgPulvManual;
      if (pulM && pulM.mmais && !noChao && Math.abs(M.thr) < 0.05 && typeof P.altura === "number") {
        var dosM = typeof window.__xgDossel === "function" ? Math.max(0, window.__xgDossel(d.x, d.z) || 0) : 0;
        vyAlvo = Math.max(-DESCE, Math.min(SOBE, (P.altura + dosM - V.xgAgl) * 1.2));
      }
      V.vy += (vyAlvo - V.vy) * Math.min(1, dt * 5);
    }

    if (window.xgProtecao) xgProtecao.vertical(dt);

    var x0 = d.x, z0 = d.z;
    d.x += V.mvx * dt; d.z += V.mvz * dt;

    /* Estabilizacao da altitude ligada: "a aeronave segue o terreno e
       ajusta a altitude com base na altura acima das culturas" (texto da
       tela do app). O acelerador muda a altura ACIMA DO CHAO. Desligada, a
       altura e fixa no espaco e o morro pode subir por baixo. */
    if (typeof V.xgAgl !== "number") V.xgAgl = Math.max(0, d.y - solo);
    if (P.estab) {
      V.xgAgl = Math.max(0, V.xgAgl + V.vy * dt);
      /* o chao que o radar ve (radar.js): relevo subindo chega com atraso,
         mais com tanque cheio e voando rapido */
      var soloRadar = typeof window.xgRadarSolo === "function" ? window.xgRadarSolo(dt, alt(d.x, d.z)) : alt(d.x, d.z);
      d.y = soloRadar + V.xgAgl;
    } else {
      d.y += V.vy * dt;
      V.xgAgl = d.y - alt(d.x, d.z);
    }

    /* Protecao de voo do controle: altitude maxima (contada da decolagem)
       e distancia maxima do ponto de origem. A aeronave nao passa delas. */
    var origemY = alt(BASE.x, BASE.z);
    var altMax = typeof P.xgAltMax === "number" ? P.xgAltMax : 100;
    if (d.y - origemY > altMax) {
      d.y = origemY + altMax;
      V.xgAgl = d.y - alt(d.x, d.z);
      V.vy = Math.min(V.vy, 0);
    }
    var distMax = typeof P.xgDistMax === "number" ? P.xgDistMax : 1000;
    var hx = d.x - BASE.x, hz = d.z - BASE.z, hd = Math.hypot(hx, hz);
    if (hd > distMax) {
      d.x = BASE.x + hx / hd * distMax;
      d.z = BASE.z + hz / hd * distMax;
      var saindo = (V.mvx * hx + V.mvz * hz) / hd;
      if (saindo > 0) { V.mvx -= saindo * hx / hd; V.mvz -= saindo * hz / hd; }
    }

    solo = alt(d.x, d.z);
    if (d.y <= solo) {
      var h = Math.hypot(V.mvx, V.mvz);
      if (h > 2 || V.vy < -4) {
        cair({ nome: "o chão", dica: "A aeronave encostou no chão ainda andando. " +
               "No manual, pouse parado: solte o manche de direção e desça devagar." });
        return;
      }
      /* bateu no chao descendo: quica conforme o peso. Vazia (52 kg) volta
         ~55% da velocidade; cheia (92 kg) quase nada. Quicando, ela continua
         solta ate assentar. */
      var batida = -V.vy;
      d.y = solo; V.mvx = 0; V.mvz = 0; V.xgAgl = 0;
      if (batida > 0.5) {
        var cheio = Math.max(0, Math.min(1, V.tan / T50.tanque));
        V.vy = batida * (0.55 * (1 - cheio) + 0.05 * cheio);
        V.xgDespenca = V.vy > 0.15;
        if (!V.xgDespenca) V.vy = 0;
      } else { V.vy = Math.max(0, V.vy); V.xgDespenca = false; }
    }

    V.v = Math.hypot(V.mvx, V.mvz);
    if (V.v > 0.1) { V.dirx = V.mvx / V.v; V.dirz = V.mvz / V.v; }

    /* a mesma colisao do passo do jogo */
    var ponto = new THREE.Vector3(d.x, d.y + 0.4, d.z);
    for (var i = 0; i < colisores.length; i++) {
      var c = colisores[i];
      if (Math.hypot(c.cx - d.x, c.cz - d.z) > c.raio + 3) continue;
      if (distColisor(c, ponto) < 1.3) { cair(c); return; }
    }

    var carga = V.tan / T50.tanque;
    var autonomia = T50.autonomiaVazioMin - (T50.autonomiaVazioMin - T50.autonomiaCheioMin) * carga;
    V.bat = Math.max(0, V.bat - dt / 60 * (100 / autonomia));
    if (V.bat <= 0) cair({ nome: "falta de bateria", dica: "A bateria acabou no ar." });

    /* Botao de pulverizacao do RC Plus: no modo manual liga e para a
       pulverizacao. A vazao (L/min) e a da roda esquerda. Com os sistemas
       de pulverizacao desligados no app, nada sai. */
    var pul = window.xgPulvManual;
    V.aplicando = false;
    V.vazaoAtual = 0;
    /* "Iniciar" no chao deixou a bomba armada: liga assim que a aeronave sai do solo (24/10/2026) */
    if (pul && pul.armada && !noChao && V.estado === "manual" && V.tan > 0 && P.xgPulverizar !== false && !P.xgMapeamento) { pul.ligado = true; pul.passe++; pul.armada = false; }
    if (pul && pul.ligado && (noChao || V.estado !== "manual")) pul.ligado = false;
    if (pul && pul.ligado && V.tan <= 0) { pul.ligado = false; pul.acabou = true; }
    /* No M a vazao nao muda com a velocidade e, pairando, continua; so para
       indo de re (palavras dele, #12). Com 2 bicos, a re corta o produto;
       andou para a frente de novo, volta a soltar (o botao segue ligado). */
    var vFrente = V.mvx * fx + V.mvz * fz;
    if (pul && pul.ligado && !P.xgMapeamento && P.xgPulverizar !== false && vFrente >= -0.3) {
      var fluxoAgora = pul.fluxo;
      if (pul.mmais) fluxoAgora = vFrente > 0.3 ? Math.min(16, (Number(P.vazao) || 0) * (Number(P.xgEspMmais) || 6) * vFrente * 60 / 10000) : 0;
      var litros = Math.min(fluxoAgora / 60 * dt, V.tan);
      var andou = Math.hypot(d.x - x0, d.z - z0);
      V.tan -= litros; V.calda = (V.calda || 0) + litros;
      V.aplicado += litros > 0 ? andou * P.faixa / 10000 : 0;
      V.vazaoAtual = litros / dt * 60;
      if (litros > 0 && andou > 0.0005 && typeof pintarFaixa === "function") pintarFaixa(x0, z0, d.x, d.z, larguraEfetiva(), pul.passe);
      V.aplicando = fluxoAgora > 0;
    }
  }

  /* ----------------------------------------------------- os manches aqui */

  var ESTADOS_DA_ROTA = ["aplicando", "indo", "voltando", "subindo", "descendo", "pairando"];

  var TECLAS = {
    KeyW: ["esq", "y", 1], KeyS: ["esq", "y", -1], KeyA: ["esq", "x", -1], KeyD: ["esq", "x", 1],
    ArrowUp: ["dir", "y", 1], ArrowDown: ["dir", "y", -1], ArrowLeft: ["dir", "x", -1], ArrowRight: ["dir", "x", 1],
  };

  /* Botoes e rodas do RC Plus (manual do T50, pag. 17 e 22):
       botao de pulverizacao   no manual, um toque liga, outro desliga;
                               segurado: a confirmar com o piloto (pergunta 5),
                               por enquanto nao faz nada
       roda esquerda           vazao da pulverizacao no manual
       roda direita            inclinacao da camera FPV
     No teclado: Espaco = botao de pulverizacao, PageUp/PageDown = roda
     direita (camera), - e = = roda esquerda (vazao).

     No RC Plus de verdade o pacote traz os botoes como bits (MainActivity:
     bitDoBotao). O de pulverizacao e o BUTTON_L1 do Android = bit 0; o L1
     do controle (F1, "Adicionar ponto") e o bit 4. Quem gravou outro bit em
     localStorage "tpd_rc_bit_pulverizar" (0 a 9) continua valendo. */
  var TECLA_PULVERIZAR = "Space";
  var TECLAS_CAMERA = { PageUp: 1, PageDown: -1 };
  var TECLAS_VAZAO = { Minus: -1, Equal: 1, NumpadSubtract: -1, NumpadAdd: 1 };
  var FLUXO_PADRAO = 10, FLUXO_MAX = 16;  // L/min: 10 e o padrao do painel M do app (gravacao "drone conectado"); T50 vai ate 16

  function bitPulverizar() {
    try {
      var v = localStorage.getItem("tpd_rc_bit_pulverizar");
      return v === null || v === "" || !(Number(v) >= 0) ? 0 : Number(v);
    } catch (e) { return 0; }
  }

  /* centro dos dois manches no desenho do aparelho do jogo */
  var CENTROS = { esq: [230, 810], dir: [1770, 810] };
  var CURSO = 45;          // quanto o botao do manche anda no desenho

  function Manual(ponte, quadroControle) {
    this.ponte = ponte;
    this.quadro = quadroControle;
    this.operacao = null;
    this.teclas = {};
    this.mouse = { esq: null, dir: null };
    this.csc = 0;
    this.desligando = 0;
    this.instalado = false;
    this.dicaDada = false;
  }

  Manual.prototype.instalar = function () {
    if (this.instalado) return true;
    var j = this.ponte.janela;
    if (!j) return false;

    try {
      j.eval("window.xgPassoManual = " + xgPassoManual.toString());
      if (j.eval("(" + instalarNoCampo.toString() + ")()") !== true) return false;
    } catch (e) { return false; }

    var self = this;

    function tecla(e0, apertada) {
      var alvoOriginal = e0.target;
      if (alvoOriginal && (alvoOriginal.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(alvoOriginal.tagName))) return;
      if (e0.code === "ShiftLeft" || e0.code === "ShiftRight") {
        self.teclas[e0.code] = apertada;
        return;
      }
      /* as teclas que o aluno escolheu (teclado_rc.js): a tecla vira o
         codigo do manche/roda/pulverizacao de sempre */
      var e = e0;
      if (window.XG_TECLADO && !(self.demarcando() === "Controlador" && TECLAS[e0.code])) {
        var cod = window.XG_TECLADO.manche(e0.code);
        e = { code: cod, repeat: e0.repeat, target: e0.target, preventDefault: function () { e0.preventDefault(); } };
      }
      var alvoT = e.target;
      var digitando = alvoT && (alvoT.tagName === "INPUT" || alvoT.tagName === "TEXTAREA");
      if (!digitando && (e.code === TECLA_PULVERIZAR || TECLAS_CAMERA[e.code] || TECLAS_VAZAO[e.code])) {
        if (e.code === TECLA_PULVERIZAR && !e.repeat) { if (apertada) self.apertouPulverizar(); else self.soltouPulverizar(); }
        self.teclas[e.code] = apertada;
        e.preventDefault();
        return;
      }
      if (!TECLAS[e.code]) return;
      var alvo = e.target;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA")) return;
      self.teclas[e.code] = apertada;
      e.preventDefault();
    }

    [window, j].concat(this.janelaDoControle() ? [this.janelaDoControle()] : []).forEach(function (w) {
      w.addEventListener("keydown", function (e) { tecla(e, true); });
      w.addEventListener("keyup", function (e) { tecla(e, false); });
      /* perdeu o foco com tecla apertada: o manche volta ao centro */
      w.addEventListener("blur", function () { self.teclas = {}; });
    });

    this.ligarMouseNosManches(j.document);

    /* o tempo de segurar (CSC, desligar) e medido no relogio de verdade: o
       navegador espaca os intervalos quando a pagina nao esta em primeiro
       plano, e contar "0,05 s por volta" deixava o CSC sem fechar nunca */
    var antes = performance.now();
    this.relogio = setInterval(function () {
      var agora = performance.now();
      self.tique(Math.min(0.5, (agora - antes) / 1000));
      antes = agora;
    }, 50);
    this.instalado = true;
    return true;
  };

  Manual.prototype.janelaDoControle = function () {
    try { return this.quadro.contentWindow; } catch (e) { return null; }
  };

  /* Arrastar o manche do desenho: o botao acompanha o mouse ate o fim do
     curso e volta ao centro quando solta, como a mola do manche. */
  Manual.prototype.ligarMouseNosManches = function (doc) {
    var svg = doc.querySelector("#vCtrlRc svg");
    if (!svg) return;
    // A moldura HTML tambem precisa reservar o gesto de dois dedos ao controle.
    svg.parentElement.style.touchAction = "none";
    svg.style.touchAction = "none";
    var self = this;
    var NS = "http://www.w3.org/2000/svg";
    var liberadores = [];

    Object.keys(CENTROS).forEach(function (lado) {
      var c = CENTROS[lado];

      /* o botao que se move: os dois circulos de dentro do manche */
      var partes = [];
      var circulos = svg.querySelectorAll('circle[cx="' + c[0] + '"][cy="' + c[1] + '"]');
      for (var i = 0; i < circulos.length; i++) {
        var r = Number(circulos[i].getAttribute("r"));
        if (r < 70) partes.push(circulos[i]);
      }
      self["partes_" + lado] = partes;

      /* uma area de toque por cima do manche inteiro */
      var toque = doc.createElementNS(NS, "circle");
      toque.setAttribute("cx", c[0]);
      toque.setAttribute("cy", c[1]);
      toque.setAttribute("r", 128);
      toque.setAttribute("fill", "transparent");
      toque.setAttribute("class", "rcbt");
      toque.setAttribute("aria-label", "Manche " + (lado === "esq" ? "esquerdo" : "direito"));
      toque.style.outline = "none";
      toque.style.touchAction = "none";
      svg.appendChild(toque);
      var ponteiro = null, tipoPonteiro = null, dedo = null;

      function mover(e) {
        var m = svg.getScreenCTM();
        if (!m) return;
        var p = svg.createSVGPoint();
        p.x = e.clientX; p.y = e.clientY;
        p = p.matrixTransform(m.inverse());
        var dx = (p.x - c[0]) / 90, dy = -(p.y - c[1]) / 90;
        // Cada eixo precisa chegar ao fim do curso tambem na diagonal.
        // Normalizar pelo raio limitava ambos a 0,707 e impedia o CSC (>0,8).
        dx = Math.max(-1, Math.min(1, dx));
        dy = Math.max(-1, Math.min(1, dy));
        self.mouse[lado] = { x: dx, y: dy };
      }

      toque.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (ponteiro !== null && !self.mouse[lado]) soltar();
        if (ponteiro !== null) return;
        ponteiro = e.pointerId; tipoPonteiro = e.pointerType;
        e.preventDefault();
        try { toque.setPointerCapture(e.pointerId); } catch (erro) { /* eventos do documento continuam atendendo */ }
        mover(e);
      });
      doc.addEventListener("pointermove", function (e) {
        if (e.pointerId !== ponteiro || !self.mouse[lado]) return;
        // Recupera tambem uma soltura de mouse que ocorreu fora da janela.
        if (e.pointerType === "mouse" && !(e.buttons & 1)) { soltar(e); return; }
        mover(e);
      }, true);
      function soltar(e) {
        if (e && e.pointerId !== ponteiro) return;
        var anterior = ponteiro;
        ponteiro = null; tipoPonteiro = null; dedo = null;
        self.mouse[lado] = null;
        try { if (anterior !== null && toque.hasPointerCapture(anterior)) toque.releasePointerCapture(anterior); } catch (erro) {}
        self.desenharManches(self.manches());
      }
      toque.addEventListener("lostpointercapture", soltar);
      liberadores.push(soltar);

      // O identificador do Touch e independente do pointerId. No celular,
      // touchend/cancel libera o dedo mesmo se o pointerup do SVG se perder.
      function achar(lista, id) {
        for (var n = 0; n < lista.length; n++) if (lista[n].identifier === id) return lista[n];
        return null;
      }
      toque.addEventListener("touchstart", function (e) {
        if (tipoPonteiro && tipoPonteiro !== "touch") return;
        if (dedo !== null && achar(e.touches, dedo)) return;
        var t = e.changedTouches[0];
        if (!t) return;
        dedo = t.identifier; tipoPonteiro = "touch";
        e.preventDefault(); mover(t);
      }, { passive: false });
      doc.addEventListener("touchmove", function (e) {
        if (dedo === null) return;
        var t = achar(e.touches, dedo);
        if (!t) { soltar(); return; }
        e.preventDefault(); mover(t);
      }, { capture: true, passive: false });
      ["touchend", "touchcancel"].forEach(function (tipo) {
        doc.addEventListener(tipo, function (e) {
          if (dedo !== null && (!achar(e.touches, dedo) || achar(e.changedTouches, dedo))) soltar();
        }, true);
      });
    });

    function cancelar() {
      self.teclas = {}; self.csc = 0; self.desligando = 0;
      liberadores.forEach(function (soltar) { soltar(); });
    }
    // Uma soltura pode chegar na pagina principal ou na tela do app, que e
    // outro iframe. Capturar antes dos botoes do mapa evitarem a propagacao.
    var janelas = new WeakSet();
    function observar(w) {
      try {
        var d = w.document;
        if (janelas.has(d)) return;
        janelas.add(d);
        ["pointerup", "pointercancel"].forEach(function (tipo) {
          w.addEventListener(tipo, function (e) { liberadores.forEach(function (soltar) { soltar(e); }); }, true);
        });
        w.addEventListener("blur", cancelar);
        w.addEventListener("pagehide", cancelar);
        w.addEventListener("orientationchange", cancelar);
        d.addEventListener("visibilitychange", function () { if (d.hidden) cancelar(); });
        d.addEventListener("load", function (e) { if (e.target.tagName === "IFRAME") observar(e.target.contentWindow); }, true);
        Array.from(w.frames).forEach(observar);
      } catch (erro) { /* frames de outra origem nao fornecem comandos */ }
    }
    observar(window);
  };

  /* A posicao de cada manche, de -1 a 1 (y para cima), somando teclado e
     mouse. */
  Manual.prototype.manches = function () {
    var t = this.teclas;
    var m = { esq: { x: 0, y: 0 }, dir: { x: 0, y: 0 } };

    Object.keys(TECLAS).forEach(function (cod) {
      if (!t[cod]) return;
      var def = TECLAS[cod];
      m[def[0]][def[1]] += def[2];
    });

    /* o controle de verdade (RC Plus pelo Wi-Fi), quando estiver mandando */
    var real = window.CONTROLE_REAL ? window.CONTROLE_REAL.manches() : null;
    /* o RC-N1 de verdade pelo cabo USB (Air 2S, rc_n1.js), quando conectado */
    var n1 = window.XG_RC_N1 ? window.XG_RC_N1.manches() : null;
    /* o RC Plus de verdade pelo cabo USB (ponte no computador, rc_plus_cabo.js) */
    var rcp = window.XG_RC_PLUS_CABO ? window.XG_RC_PLUS_CABO.manches() : null;

    ["esq", "dir"].forEach(function (lado) {
      var mo = this.mouse[lado];
      if (mo) { m[lado].x += mo.x; m[lado].y += mo.y; }
      if (real) { m[lado].x += real[lado].x; m[lado].y += real[lado].y; }
      if (n1) { m[lado].x += n1[lado].x; m[lado].y += n1[lado].y; }
      if (rcp) { m[lado].x += rcp[lado].x; m[lado].y += rcp[lado].y; }
      m[lado].x = Math.max(-1, Math.min(1, m[lado].x));
      m[lado].y = Math.max(-1, Math.min(1, m[lado].y));
    }, this);

    return m;
  };

  /* O modo do joystick escolhido no controle (2, de fabrica). */
  Manual.prototype.modo = function () {
    var jc = this.janelaDoControle();
    try {
      var m = jc && jc.eval("typeof modoJoystick !== 'undefined' ? modoJoystick : 2");
      return m === 1 || m === 3 ? m : 2;
    } catch (e) { return 2; }
  };

  /* Os comandos que cada manche da, conforme o modo. */
  function comandos(m, modo) {
    var e = m.esq, d = m.dir;
    if (modo === 1) return { thr: d.y, yaw: e.x, pitch: e.y, roll: d.x };
    if (modo === 3) return { thr: d.y, yaw: d.x, pitch: e.y, roll: e.x };
    return { thr: e.y, yaw: e.x, pitch: d.y, roll: d.x };
  }

  Manual.prototype.tique = function (dt) {
    if (window.PAUSA_SIM && PAUSA_SIM.pausado) {
      this.teclas = {}; this.mouse = { esq: null, dir: null };
      this.csc = 0; this.desligando = 0; this.pulvDesde = 0;
      return;
    }
    var j = this.ponte.janela;
    if (!j || !j.xgManches) return;

    var m = this.manches();
    var mCru = m;   // a pe, o piloto anda mesmo com o controle desligado
    /* controle desligado ou ainda conectando: os manches nao chegam a aeronave (principal.js) */
    if (this.controlePronto && !this.controlePronto()) {
      m = { esq: { x: 0, y: 0 }, dir: { x: 0, y: 0 } };
      this.csc = 0;
    }
    this.desenharManches(m);

    var cmd = comandos(m, this.modo());
    var estado;
    try { estado = j.eval("V.estado"); } catch (e) { return; }

    /* demarcando pelo metodo Controlador, inclusive com o drone no ar: os
       manches andam com o personagem (e nao ligam motor nem dao dica) */
    if (!this.andarInstalado) {
      try { this.andarInstalado = j.eval("(" + instalarAndarNoCampo.toString() + ")()") === true; } catch (e) { /* tenta de novo */ }
    }
    this.ligarAdicionar();
    var demarcar = this.demarcando() === "Controlador";
    /* a pe (botao "Andar a pe", equipe.js): os MESMOS comandos do drone - inclinacao anda para
       frente/tras, rolagem vai de lado, guinada gira o corpo (conforme o modo do joystick e as
       teclas escolhidas) - e o rosto vira com o mouse (xgAndar.olharMouse) */
    var aPe = !demarcar && !!(j.xgEquipe && j.xgEquipe.aPe);
    var anda = demarcar || aPe;
    if (j.xgAndar) {
      j.xgAndar.ativo = anda;
      if (aPe) {
        var ca = comandos(mCru, this.modo());
        j.xgAndar.f = ca.pitch; j.xgAndar.l = ca.roll; j.xgAndar.giro = ca.yaw; j.xgAndar.olhar = 0;
      } else {
        j.xgAndar.f = demarcar ? m.esq.y : 0; j.xgAndar.l = demarcar ? m.esq.x : 0;
        j.xgAndar.giro = demarcar ? m.dir.x : 0; j.xgAndar.olhar = demarcar ? m.dir.y * 0.6 : 0;
      }
      j.xgAndar.correr = anda && !!(this.teclas.ShiftLeft || this.teclas.ShiftRight);
    }
    if (anda) {
      // Os manches comandam somente a caminhada durante a demarcacao.
      j.xgManches.thr = j.xgManches.yaw = j.xgManches.pitch = j.xgManches.roll = 0;
      if (!this.andandoDemarcacao) this.ponte.trocarVista("operador");
      this.andandoDemarcacao = true;
      this.csc = 0;
      this.pulvDesde = 0; this.pulvLongo = false;
      return;
    }
    this.andandoDemarcacao = false;
    this.botoesERodas(dt, estado);

    /* CSC: os dois manches no fundo, para dentro ou para fora */
    var fundo = m.esq.y < -0.8 && m.dir.y < -0.8;
    var dentro = m.esq.x > 0.8 && m.dir.x < -0.8;
    var fora = m.esq.x < -0.8 && m.dir.x > 0.8;
    this.csc = fundo && (dentro || fora) ? this.csc + dt : 0;

    if (estado === "em solo" || estado === "concluído") {
      j.xgManches.thr = j.xgManches.yaw = j.xgManches.pitch = j.xgManches.roll = 0;

      if (this.csc >= 0.5) {
        this.csc = -999;              // so liga uma vez por gesto
        this.ligarMotores();
        return;
      }

      /* mexeu nos manches sem ligar os motores: o aparelho nao diz nada
         (sem meta-texto na cena, Fase 0 item 0.12); o CSC fica na teoria */
      return;
    }

    if (ESTADOS_DA_ROTA.indexOf(estado) >= 0) {
      /* Na DJI o acelerador sobe e desce a aeronave durante a rota SEM
         pausar a tarefa (palavras dele): e um ajuste de altura por cima da
         automacao. So inclinacao e rolagem pausam. */
      if (Math.abs(cmd.thr) > 0.3) {
        this.ponte.rodar("V.xgAjuste = Math.max(-(" + "(drone.position.y - alt(drone.position.x, drone.position.z)) - 1.5), " +
                         "(V.xgAjuste || 0) + " + (cmd.thr * 3 * dt).toFixed(4) + ");");
        this.ajusteVivo = true;
      } else if (this.ajusteVivo) {
        /* soltou o acelerador: a aeronave volta sozinha para a altura programada
           (piloto, 02/10: no jogo ela ficava parada na altura nova). ~1,2 m/s,
           perto das subidas e descidas automáticas medidas no voo real */
        var resta = this.ponte.rodar("(function(){var a = V.xgAjuste || 0, d = Math.min(Math.abs(a), " + (1.2 * dt).toFixed(4) + ");" +
                                     "V.xgAjuste = a > 0 ? a - d : a + d; if (Math.abs(V.xgAjuste) < 0.01) V.xgAjuste = 0; return V.xgAjuste;})()");
        if (!resta) this.ajusteVivo = false;
      }

      /* Mexer no manche de inclinacao ou de rolagem com a rota rodando pausa
         a tarefa e passa ao manual (p.87). A guinada sozinha nao pausa: na
         operacao a orientacao fica travada (p.57). A aeronave freia ate parar
         (V.xgFreio) e o ponto de interrupcao segue a regra unica
         (xgGravarInterrupcao: nao troca na subida nem no translado). */
      if (Math.abs(cmd.pitch) > 0.3 || Math.abs(cmd.roll) > 0.3) {
        this.ponte.rodar(
          "if (V.estado !== 'caiu') {" +
          "  if (typeof xgGravarInterrupcao === 'function') xgGravarInterrupcao(); else V.retomar = pontoAtual();" +
          "  V.estado = 'manual'; V.rodando = true; V.xgFreio = true;" +
          "  V.aplicando = false; V.mvx = V.v * (V.dirx || 0); V.mvz = V.v * (V.dirz || 0); delete V.xgAgl;" +
          "  V.xgAx = 0; V.xgAz = 0; V.xgIx = 0; V.xgIz = 0;" +
          "  if (typeof fecharAlerta === 'function') fecharAlerta();" +
          "}"
        );
      }
      return;
    }

    if (estado !== "manual") return;

    j.xgManches.thr = cmd.thr;
    j.xgManches.yaw = cmd.yaw;
    j.xgManches.pitch = cmd.pitch;
    j.xgManches.roll = cmd.roll;

    /* No chao, acelerador todo para baixo por 3 s desliga os motores (p.48,
       Metodo 1). Mas
       so depois de o acelerador ter saido do fundo: no proprio CSC ele esta
       la embaixo, e sem isso os motores desligavam logo depois de ligar. */
    if (cmd.thr > -0.5) this.soltouDesdeLigar = true;

    var noChao = false;
    try { noChao = j.eval("drone.position.y <= alt(drone.position.x, drone.position.z) + 0.05"); }
    catch (e) { /* segue */ }
    this.desligando = noChao && this.soltouDesdeLigar && cmd.thr < -0.8 ? this.desligando + dt : 0;
    if (this.desligando >= 3 || (noChao && this.csc >= 0.5)) {
      this.desligando = 0;
      this.csc = -999;
      this.ponte.rodar("V.estado = 'em solo'; V.rodando = false; V.v = 0; V.vy = 0; V.mvx = 0; V.mvz = 0;");
    }

    /* soltou o gesto do CSC: pode usar de novo */
    if (!fundo) this.csc = Math.max(0, this.csc);
  };

  /* O metodo do mapeamento aberto no app ("Controlador", "Aeronave",
     "Retículo"), ou null se a tela de mapeamento nao esta na frente. */
  Manual.prototype.demarcando = function () {
    // O app atual fica dentro da tela antiga; consultar a tela de tras
    // mantinha o personagem sentado mesmo com Controlador selecionado.
    if (window.CONTROLE_REAL && window.CONTROLE_REAL.escolhido() === "real") {
      var remoto = window.__xgDemarcacao;
      return remoto && Date.now() - remoto.em < 3000 ? remoto.metodo : null;
    }
    var app = window.__xgAppVirtual;
    if (app) {
      try { return app.APP && app.APP.tela === "mapa" && app.M && app.M.sub === "edicao" ? app.M.metodo : null; }
      catch (e) { return null; }
    }
    var jc = this.janelaDoControle();
    try {
      return jc ? jc.eval("(function(){var t=document.querySelector('.tela-app.ativa');" +
        "return t && t.dataset.tela==='mapeamento' && typeof estado!=='undefined' ? estado.metodo : null;})()") : null;
    } catch (e) { return null; }
  };

  /* "Adicionar" no mapeamento: pelo Controlador o ponto e onde o
     personagem (com o controle) esta; pela Aeronave, onde o drone esta -
     as duas posicoes como o GNSS ve (gnss.js). O retículo do app e posto
     ali antes do clique ser tratado. */
  Manual.prototype.ligarAdicionar = function () {
    if (this.adicionarLigado) return;
    var doc; try { doc = this.quadro.contentDocument; } catch (e) { return; }
    var botao = doc && doc.getElementById("botao-adicionar-ponto");
    if (!botao) return;
    this.adicionarLigado = true;
    var self = this;
    botao.addEventListener("click", function () {
      var metodo = self.demarcando();
      if (metodo !== "Controlador" && metodo !== "Aeronave") return;
      var e = self.ponte.estado(), alvo = metodo === "Controlador" ? e.operador : e.drone;
      var v = self.operacao && self.operacao.vinculo, jc = self.janelaDoControle();
      if (!alvo || !v || typeof v.paraPixels !== "function" || !jc) return;
      var q = v.paraPixels({ x: alvo.x, z: alvo.z });
      try {
        jc.eval("(function(){var z=typeof ZOOM_TRABALHO!=='undefined'?ZOOM_TRABALHO:1," +
                "d=typeof DESLOCA_TRABALHO!=='undefined'?DESLOCA_TRABALHO:{x:0,y:0};" +
                "estado.reticulo={x:" + q.x.toFixed(2) + "*z+d.x,y:" + q.y.toFixed(2) + "*z+d.y};})()");
      } catch (erro) { /* fica o retículo */ }
    }, true);   // fase de captura: antes do ouvinte do controle
  };

  /* O botao de pulverizacao do RC Plus (palavras dele): um toque liga, outro
     toque desliga; segurado 1,5 s ainda a confirmar (nao faz nada). O toque
     so vale ao SOLTAR, senao todo "segurar" comecaria ligando a pulverizacao. */
  Manual.prototype.apertouPulverizar = function () {
    if (this.demarcando() === "Controlador") return;
    if (this.pulvDesde) return;
    this.pulvDesde = performance.now();
    this.pulvLongo = false;
  };
  Manual.prototype.soltouPulverizar = function () {
    if (!this.pulvDesde) return;
    var longo = this.pulvLongo;
    this.pulvDesde = 0; this.pulvLongo = false;
    if (!longo) this.botaoPulverizar();
  };

  /* Esgotar: a bomba no maximo (16 L/min) ate o tanque secar, com a
     aeronave no ar ou no chao. Um toque curto interrompe. */
  Manual.prototype.esgotarSistema = function () {
    var j = this.ponte.janela;
    if (!j) return;
    var r;
    try {
      r = j.eval("(function(){var p=window.xgPulvManual||(window.xgPulvManual={ligado:false,fluxo:" + FLUXO_PADRAO + ",passe:50000});" +
                 "if(P.xgMapeamento){p.ligado=false;p.esgotar=false;return 'mapeamento';}" +
                 "if(V.tan<=0)return 'vazio'; p.ligado=false; p.esgotar=true; return 'ok';})()");
    } catch (e) { return; }
    this.esgotando = r === "ok";
    if (this.operacao) this.operacao.avisar(r === "ok" ? "Esgotando o sistema: bomba no máximo até o tanque secar" : r === "mapeamento" ? "Pulverização desativada durante o mapeamento" : "Tanque vazio");
  };

  /* O botao de pulverizacao: so vale no voo manual, no ar, como no app. */
  Manual.prototype.botaoPulverizar = function () {
    if (this.demarcando() === "Controlador") return;
    var j = this.ponte.janela;
    if (!j) return;
    var r;
    try {
      r = j.eval(
        "(function(){var p=window.xgPulvManual||(window.xgPulvManual={ligado:false,fluxo:" + FLUXO_PADRAO + ",passe:50000});" +
        "if(P.xgMapeamento){p.ligado=false;p.esgotar=false;return 'mapeamento';}" +
        "if(p.esgotar){p.esgotar=false;return 'interrompeu';}" +
        "if(V.estado!=='manual')return 'fora';" +
        "if(drone.position.y<=alt(drone.position.x,drone.position.z)+0.05)return 'chao';" +
        "if(V.tan<=0)return 'vazio';" +
        "if(P.xgPulverizar===false)return 'desligado';" +
        "p.ligado=!p.ligado;if(p.ligado)p.passe++;return p.ligado?'ligou':'parou';})()");
    } catch (e) { return; }
    /* recado para o app do RC Plus (app_rcplus.js manda no estado): ele
       mostra "Habilitar/Desabilitar pulverização" (g5 #0118, #0130) */
    if (r) j.__xgRecado = { n: ((j.__xgRecado || {}).n || 0) + 1, c: r };
    var texto = {
      ligou: "Pulverização ligada", parou: "Pulverização parada", interrompeu: "Esgotamento interrompido",
      vazio: "Tanque vazio", desligado: "Sistemas de pulverização desligados nas configurações",
      mapeamento: "Pulverização desativada durante o mapeamento",
    }[r];
    if (texto && this.operacao) this.operacao.avisar(texto);
  };

  /* Rodas e botoes fisicos (RC Plus de verdade e teclado), a cada tique. */
  Manual.prototype.botoesERodas = function (dt, estado) {
    var j = this.ponte.janela;
    var t = this.teclas;
    var camera = 0, vazao = 0;
    Object.keys(TECLAS_CAMERA).forEach(function (c) { if (t[c]) camera += TECLAS_CAMERA[c]; });
    Object.keys(TECLAS_VAZAO).forEach(function (c) { if (t[c]) vazao += TECLAS_VAZAO[c]; });

    var pacote = window.CONTROLE_REAL && window.CONTROLE_REAL.ultimo ? window.CONTROLE_REAL.ultimo() : null;
    if (pacote) {
      /* rodas: -1..1 com centro 0; abaixo de 0,08 e a roda parada */
      var g = pacote.g || [0, 0];
      if (Math.abs(g[0]) > 0.08) vazao += g[0];
      if (Math.abs(g[1]) > 0.08) camera += g[1];

      var b = pacote.b | 0, antes = this.botoesAntes | 0, novos = b & ~antes, soltos = antes & ~b;
      this.botoesAntes = b;
      var bit = bitPulverizar();
      if (bit >= 0 && (novos & (1 << bit))) this.apertouPulverizar();
      if (bit >= 0 && (soltos & (1 << bit))) this.soltouPulverizar();
      /* L1 do controle (F1, bit 4) = "Adicionar ponto", como no app dele
         (relatorio dos botoes): no mapeamento, marca o ponto */
      if ((novos & 16) && !window.__xgAppVirtual && !(window.CONTROLE_REAL && window.CONTROLE_REAL.escolhido() === "real") && this.demarcando()) {
        try { this.quadro.contentDocument.getElementById("botao-adicionar-ponto").click(); } catch (e) { /* sem tela */ }
      }
    }

    /* Botao de pulverizacao segurado 1,5 s: o que ele faz ainda sera
       confirmado com o piloto (pergunta 5: liberar ar preso ou esgotar).
       Ate la, so marca que foi longo (o soltar nao liga nem desliga); o
       esgotarSistema fica pronto, sem chamada. */
    if (this.pulvDesde && !this.pulvLongo && performance.now() - this.pulvDesde >= 1500) {
      this.pulvLongo = true;
    }
    /* o esgotamento acabou (tanque seco): avisa uma vez */
    if (j && this.esgotando) {
      var ainda = false;
      try { ainda = j.eval("!!(window.xgPulvManual && window.xgPulvManual.esgotar)"); } catch (e) { ainda = false; }
      if (!ainda) { this.esgotando = false; if (this.operacao) this.operacao.avisar("Sistema esgotado: tanque e mangueiras vazios"); }
    }

    /* roda direita: inclinacao da camera, 0 (frente) a -90 (para baixo), ~60 graus/s */
    if (camera && j) {
      if (typeof j.xgGimbal !== "number") j.xgGimbal = -19;
      /* 14/10/2026: Air 2S com "Permitir rotacao do estabilizador superior" sobe ate +24 (app_fly.js) */
      j.xgGimbal = Math.max(-90, Math.min(typeof j.xgGimbalMax === "number" ? j.xgGimbalMax : 0, j.xgGimbal + camera * 60 * dt));
    }
    /* Pouso automatico (RTH, fim da tarefa, Encerrar): a camera vira sozinha
       para baixo (-90) enquanto desce no ponto de decolagem; com os motores
       parados no chao volta a 0 (piloto, resposta 6). A roda manda mais. */
    else if (j) {
      if (typeof j.xgGimbal !== "number") j.xgGimbal = -19;
      var alvoCam = null;
      /* Air 2S (app_fly.js): a camera fica como o piloto deixou no pouso (gravacao do app real, 14/10/2026) */
      if (estado === "pousando" && !j.__xgFly) { alvoCam = -90; this.camPouso = true; }
      else if (this.camPouso && (estado === "em solo" || estado === "concluído" || estado === "reabastecendo")) alvoCam = 0;
      else if (estado !== "pousando") this.camPouso = this.camPouso && estado !== "subindo";
      if (alvoCam !== null) {
        var falta = alvoCam - j.xgGimbal, passoCam = 60 * dt;
        j.xgGimbal += Math.max(-passoCam, Math.min(passoCam, falta));
        if (alvoCam === 0 && Math.abs(falta) <= passoCam) this.camPouso = false;
      }
    }
    /* roda esquerda: vazao no manual, de 1 a 16 L/min, ~4 L/min por segundo */
    if (vazao && j) {
      try {
        j.eval("(function(){var p=window.xgPulvManual||(window.xgPulvManual={ligado:false,fluxo:" + FLUXO_PADRAO + ",passe:50000});" +
               "p.fluxo=Math.max(1,Math.min(" + FLUXO_MAX + ",p.fluxo+" + (vazao * 4 * dt).toFixed(4) + "));})()");
      } catch (e) { /* segue */ }
    }
  };

  Manual.prototype.ligarMotores = function () {
    if (this.ponte.ler("P.xgMapeamento && (!Number.isFinite(V.tan) || V.tan > 0)") === true) {
      this.ponte.rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:'recusa:tanque-mapeamento'};");
      if (this.operacao) this.operacao.avisar("Esvazie o tanque para iniciar o mapeamento");
      return;
    }
    /* gente a menos de 6 m (o badeco no drone, equipe.js): o app nao liga */
    var j = this.ponte.janela, perto = false;
    try { perto = !!(j && j.xgEquipe && j.xgEquipe.estado !== "sentado" && j.xgEquipe.perto() < 6); } catch (e) { perto = false; }
    if (j && j.xgProtecao) perto = j.xgProtecao.bloqueioDecolagem();
    if (perto) {
      if (this.operacao) this.operacao.avisar("Pedestres ou obstáculos detectados perto da aeronave. Não é possível decolar");
      return;
    }
    this.ponte.rodar(
      "V.estado = 'manual'; V.rodando = true; V.motivo = null; V.xgAjuste = 0;" +
      "V.v = 0; V.vy = 0; V.mvx = 0; V.mvz = 0; V.aplicando = false; delete V.xgAgl; V.xgDespenca = false; V.xgFreio = false;" +
      "if (typeof fecharAlerta === 'function') fecharAlerta();"
    );
    if (this.operacao) this.operacao.avisar("");
    this.dicaDada = false;
    this.soltouDesdeLigar = false;
    this.desligando = 0;
  };

  /* Volta para a rota do ponto em que ela foi interrompida: sobe na altura
     de retorno e segue, como o jogo faz depois de reabastecer. */
  Manual.prototype.retomarRota = function () {
    if (this.ponte.ler("P.xgMapeamento && (!Number.isFinite(V.tan) || V.tan > 0)") === true) {
      this.ponte.rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:'recusa:tanque-mapeamento'};");
      if (this.operacao) this.operacao.avisar("Esvazie o tanque para iniciar o mapeamento");
      return;
    }
    this.ponte.rodar(
      "if (V.estado === 'manual' && V.retomar) { V.estado = 'subindo'; V.rodando = true; V.xgFreio = false; }"
    );
  };

  /* O botao do manche do desenho acompanha a posicao. */
  Manual.prototype.desenharManches = function (m) {
    ["esq", "dir"].forEach(function (lado) {
      var partes = this["partes_" + lado];
      if (!partes) return;
      var t = "translate(" + (m[lado].x * CURSO).toFixed(1) + " " + (-m[lado].y * CURSO).toFixed(1) + ")";
      for (var i = 0; i < partes.length; i++) {
        if (partes[i].getAttribute("transform") !== t) partes[i].setAttribute("transform", t);
      }
    }, this);
  };

  return {
    criar: function (ponte, quadro) { return new Manual(ponte, quadro); },
  };
})();
