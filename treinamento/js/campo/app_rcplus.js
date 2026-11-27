/* ==========================================================================
   O APP NOVO DO RC PLUS (réplica do DJI Agras que roda no próprio controle)

   O app do controle não tem o jogo: ele desenha as telas e manda comandos.
   Aqui, no PC, este módulo é a outra ponta:

   - a cada 100 ms junta o estado do jogo (voo, bateria, tanque, drone, base,
     rota, radar, cobertura, parâmetros) e manda à ponte, que o app busca em
     /estado;
   - recebe os comandos do app ({t:"cmd", c:"..."}) e executa no jogo, pelas
     mesmas linhas que operacao.js / vinculo.js / ajustes.js usam;
   - tira a foto de cima do campo do nível aberto (o fundo do mapa do app) e
     manda à ponte quando muda.

   Coordenadas do app = as do controle antigo: mapa 1920x1200 px, 0,2327 m/px,
   centro (x 0, z -90). O app já manda o talhão em metros (x, z).
   Só funciona com "RC Plus real" escolhido e o controle pareado.
   ========================================================================== */

(function () {
  "use strict";

  var ESCALA = 0.2327, CX = 0, CZ = -90;
  var ws = null, espera = 1000, ultimoEstado = "", fotoFeita = null;
  var mapeamentoAutorizado = false, pedidoAutorizacao = 0;

  function autorizarMapeamento(drone) {
    var pedido = ++pedidoAutorizacao;
    mapeamentoAutorizado = false;
    if (["t25", "t50"].indexOf(drone) < 0 || !window.CONTAS || !CONTAS.autorizarMapeamento) return Promise.resolve(false);
    return Promise.resolve().then(function () { return CONTAS.autorizarMapeamento(drone); }).then(function (r) {
      if (pedido === pedidoAutorizacao) mapeamentoAutorizado = !!(r && r.permitido === true);
      return pedido === pedidoAutorizacao && mapeamentoAutorizado;
    }).catch(function () { return false; });
  }
  function recusarMapeamento() {
    rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:'recusa:mapeamento-admin'}");
  }

  function xg() { return window.XG; }
  function ponte() { return xg() && xg().ponte; }
  function op() { return xg() && xg().operacao && xg().operacao(); }
  function real() { return window.CONTROLE_REAL && window.CONTROLE_REAL.escolhido() === "real"; }

  function rodar(js) { var p = ponte(); return p ? p.rodar(js) : undefined; }
  function ler(js) { var p = ponte(); return p ? p.ler(js) : undefined; }

  /* Modelo didático da gravação 7. Executa dentro do campo: fotografias são
     footprints georreferenciados da cena, não fotogrametria nem reconhecimento
     de árvores. Nenhum relógio de parede fabrica progresso com o jogo parado. */
  function instalarMapeamentoNoCampo() {
    if (window.xgMapeamento) return true;
    if (typeof passo !== "function" || typeof emitir !== "function" || typeof efetivo !== "function") return false;
    var missao = null, percurso = [], comprimentos = [], cobertos = [], distanciaTotal = 0;
    var tempoFoto = 0, tempoRecon = 0, iniciado = false, gimbalAntes = null;
    function permitido() {
      try { return !!(parent.APP_RCPLUS && parent.APP_RCPLUS.mapeamentoDisponivel()); }
      catch (_) { return false; }
    }
    function pausado() { return !!(window.PAUSA_SIM && PAUSA_SIM.pausado); }
    function solo() {
      return drone.position.y - alt(drone.position.x, drone.position.z) < .15 &&
        ["em solo", "concluído", "reabastecendo"].indexOf(V.estado) >= 0;
    }
    function ativo() { return !!(missao && P.xgMapeamento && !missao.confirmada); }
    function tanqueVazio() { return Number.isFinite(V.tan) && V.tan <= 0; }
    function coordenadas() {
      var g = window.xgGnss ? xgGnss.erro() : { x: 0, z: 0 };
      return [drone.position.x - (window.xgGnss ? xgGnss.c.x - g.x : 0),
        drone.position.z - (window.xgGnss ? xgGnss.c.z - g.z : 0)];
    }
    function camera(nadir) {
      if (nadir) {
        if (gimbalAntes === null) gimbalAntes = typeof window.xgGimbal === "number" ? window.xgGimbal : -19;
        window.xgGimbal = -90;
      } else if (gimbalAntes !== null) { window.xgGimbal = gimbalAntes; gimbalAntes = null; }
      if (missao) missao.nadir = !!nadir;
    }
    function cancelar(motivo) {
      if (!missao || missao.confirmada || missao.estado === "concluido") return;
      missao.estado = "cancelado"; missao.motivo = motivo || "encerrado"; missao.completa = false;
      camera(false);
    }
    function progresso() {
      if (!missao) return;
      var coberto = cobertos.reduce(function(a,b) { return a+b; }, 0);
      missao.rotaPct = missao.completa ? 100 : Math.min(99.9, distanciaTotal ? coberto / distanciaTotal * 100 : 0);
      // Coleta ocupa um terço; reconstrução ocupa dois terços do fluxo.
      missao.totalPct = missao.estado === "concluido" ? 100 :
        Math.min(99.9, missao.rotaPct / 3 + missao.reconstrucao * 2 / 3);
    }
    function estado() {
      if (!missao) return null;
      missao.altitude = Math.max(0, drone.position.y - alt(drone.position.x, drone.position.z));
      missao.velocidade = Math.max(0, V.estado === "manual" ? Math.hypot(V.mvx || 0,V.mvz || 0) : V.v || 0);
      return JSON.parse(JSON.stringify(missao));
    }
    function capturar() {
      if (!missao) return null;
      // A telemetria não contém os acumuladores necessários para continuar.
      return JSON.parse(JSON.stringify({ versao:1,missao:estado(),percurso:percurso,cobertos:cobertos,
        tempoFoto:tempoFoto,tempoRecon:tempoRecon,iniciado:iniciado,gimbalAntes:gimbalAntes,
        gimbal:typeof window.xgGimbal === "number" ? window.xgGimbal : -19 }));
    }
    function restaurar(s) {
      if (s && !permitido()) throw Error("O mapeamento está disponível somente para administrador.");
      if (!s) {
        camera(false); missao=null;percurso=[];comprimentos=[];cobertos=[];distanciaTotal=0;
        tempoFoto=tempoRecon=0;iniciado=false;return true;
      }
      var copia=JSON.parse(JSON.stringify(s)),m=copia.missao,pts=copia.percurso,cob=copia.cobertos;
      var estados=["planejado","voando","pausado","retornando","reconstruindo","concluido","cancelado"];
      if (copia.versao!==1 || !m || typeof m.id!=="string" || estados.indexOf(m.estado)<0 ||
          !Array.isArray(pts) || pts.length<2 || pts.some(function(p){return !Array.isArray(p)||p.length!==2||!p.every(Number.isFinite);}) ||
          !Array.isArray(cob) || cob.length!==pts.length || cob.some(function(v){return !Number.isFinite(v)||v<0;}) ||
          !Number.isFinite(m.altura) || m.altura<20 || m.altura>60 || !Number.isFinite(m.vel) || m.vel<=0 ||
          !Array.isArray(m.capturas) || m.capturas.length>1024 || !Number.isInteger(m.fotos) || m.fotos<m.capturas.length ||
          !Number.isFinite(copia.tempoFoto) || copia.tempoFoto<0 || copia.tempoFoto>=1 ||
          !Number.isFinite(copia.tempoRecon) || copia.tempoRecon<0) throw Error("O estado salvo do mapeamento é incompatível.");
      var comp=[0],total=0;
      for(var i=1;i<pts.length;i++) {
        var d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
        if(cob[i]>d+.001)throw Error("O progresso salvo do mapeamento é incompatível.");
        comp.push(d);total+=d;
      }
      if(!(total>.2))throw Error("A rota salva do mapeamento é incompatível.");
      // Nenhum passo, foto ou segundo de processamento é executado ao repor.
      camera(false);missao=m;percurso=pts;comprimentos=comp;cobertos=cob;distanciaTotal=total;
      tempoFoto=copia.tempoFoto;tempoRecon=copia.tempoRecon;iniciado=!!copia.iniciado;
      gimbalAntes=Number.isFinite(copia.gimbalAntes)?copia.gimbalAntes:null;
      window.xgGimbal=Number.isFinite(copia.gimbal)?copia.gimbal:(missao.nadir?-90:-19);
      progresso();return true;
    }
    function preparar(config, pontos) {
      if (!permitido()) return false;
      if (missao && !missao.confirmada && ["planejado", "cancelado"].indexOf(missao.estado) < 0) return false;
      camera(false);
      config = config || {};
      percurso = pontos.map(function(p) { return [p[0],p[1]]; });
      distanciaTotal = 0; comprimentos = [0]; cobertos = [0];
      for (var i = 1; i < percurso.length; i++) {
        var d = Math.hypot(percurso[i][0]-percurso[i-1][0],percurso[i][1]-percurso[i-1][1]);
        comprimentos.push(d); cobertos.push(0); distanciaTotal += d;
      }
      if (!(distanciaTotal > .2)) return false;
      missao = { id: String(config.id || "mapeamento"), tipo: config.tipo === "maparvore" ? "maparvore" : "maprota",
        res: config.res === "Alta" ? "Alta" : "Médio", rotaMap: config.rotaMap === "fronteira" ? "fronteira" : "area",
        altura: Math.max(20, Math.min(60, Number(config.altura) || 30)), vel: Math.max(1,Math.min(8,Number(config.vel) || 5)),
        estado: "planejado", rotaPct: 0, fotos: 0, fotosPrevistas: Math.max(1,Math.round(Number(config.fotosPrevistas) || distanciaTotal / 5)),
        reconstrucao: 0, totalPct: 0, altitude: 0, velocidade: 0, capturas: [], completa: false,
        confirmada: false, nadir: false, modelo: "didatico", motivo: null };
      tempoFoto = 0; tempoRecon = 0; iniciado = false;
      return true;
    }
    function confirmar(id) {
      if (!missao || String(id) !== missao.id || missao.estado !== "concluido" || !solo()) return false;
      missao.confirmada = true; camera(false); return true;
    }
    function descartar(id) {
      if (!missao || (id != null && String(id) !== missao.id) || !solo()) return false;
      camera(false); missao = null; percurso = []; cobertos = []; comprimentos = []; return true;
    }
    function registrarFoto(p, angulo) {
      var h = Math.max(1, drone.position.y - alt(drone.position.x, drone.position.z));
      missao.fotos++;
      // Conserva amostras por toda a área ao limitar a telemetria.
      if (missao.capturas.length >= 1024) missao.capturas = missao.capturas.filter(function(_,i) { return i % 2 === 0; });
      missao.capturas.push({ x: p[0], z: p[1], largura: h * 1.4, altura: h * 1.05,
        angulo: angulo, n: missao.fotos, altitude: h });
    }
    function acompanhar(dt, antes) {
      if (!ativo() || missao.estado === "cancelado" || missao.estado === "concluido") return;
      if (V.estado === "caiu") { cancelar("queda"); return; }
      if (V.rodando && !solo()) iniciado = true;
      var p = coordenadas(), i = antes.i, d = comprimentos[i] || 0;
      var trecho = antes.estado === "aplicando" && i > 0 && i < percurso.length && !antes.desvio && P.xgRtk && tanqueVazio() && permitido();
      if (trecho && d > 0) {
        var a = percurso[i-1], b = percurso[i], dx = b[0]-a[0], dz = b[1]-a[1];
        var proj = function(q) { return Math.max(0,Math.min(d,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/d)); };
        var andou = Math.max(0,proj(p)-proj(antes.p));
        cobertos[i] = Math.min(d,cobertos[i]+andou);
        if (Math.hypot(p[0]-b[0],p[1]-b[1]) < .12 && cobertos[i] >= d-.25) cobertos[i]=d;
        var passada = missao.rotaMap === "fronteira" || i % 2 === 1;
        if (passada && andou > .002 && V.estado === "aplicando") {
          camera(true); tempoFoto += dt;
          while (tempoFoto >= 1) { tempoFoto -= 1; registrarFoto(p, Math.atan2(dz,dx)); }
        }
      }
      var percorreu = distanciaTotal > 0 && cobertos.reduce(function(a,b) { return a+b; },0) >= distanciaTotal * .995;
      if (!missao.completa && antes.estado === "aplicando" && V.i >= percurso.length && percorreu && missao.fotos > 0 && P.xgRtk && tanqueVazio() && permitido()) {
        missao.completa = true; missao.reconstrucao = 29; camera(false);
      }
      progresso();
      if (missao.completa) {
        if (solo()) missao.estado = "reconstruindo";
        else if (["manual", "pairando"].indexOf(V.estado) >= 0) missao.estado = "pausado";
        else missao.estado = "retornando";
      } else if (!iniciado) missao.estado = "planejado";
      else if (["voltando", "pousando"].indexOf(V.estado) >= 0) { missao.estado = "retornando"; camera(false); }
      else if (!P.xgRtk || !tanqueVazio() || solo() || ["manual", "pairando", "reabastecendo"].indexOf(V.estado) >= 0 || !V.rodando) {
        missao.estado = "pausado"; camera(false);
      } else {
        missao.estado = "voando";
        if (V.estado !== "aplicando") camera(false);
        missao.reconstrucao = Math.min(29,missao.rotaPct * .29);
        progresso();
      }
    }
    var efetivoAntes = efetivo;
    efetivo = function() {
      var e = efetivoAntes.apply(this,arguments);
      if (ativo()) { e.altura = missao.altura; e.vel = missao.vel / (V.estado === "aplicando" ? 1.2 : 1); }
      return e;
    };
    var passoAntes = passo;
    passo = function(dt) {
      if (pausado()) return;
      if (!ativo()) return passoAntes.apply(this,arguments);
      if ((!permitido() || !P.xgRtk || !tanqueVazio()) && ["subindo", "indo", "aplicando", "descendo"].indexOf(V.estado) >= 0) {
        if (typeof xgGravarInterrupcao === "function") xgGravarInterrupcao();
        else if (typeof pontoAtual === "function") V.retomar = pontoAtual();
        V.mvx = (V.v || 0) * (V.dirx || 0); V.mvz = (V.v || 0) * (V.dirz || 0);
        V.estado = "manual"; V.rodando = true; V.xgFreio = true; V.aplicando = false;
        V.xgAx = V.xgAz = V.xgIx = V.xgIz = 0; delete V.xgAgl;
        // Um checkpoint inválido no chão não pode armar nem decolar.
        if (drone.position.y - alt(drone.position.x,drone.position.z) < .15) {
          V.estado = "em solo"; V.rodando = false; V.v = V.vy = V.mvx = V.mvz = 0;
        }
        if (!tanqueVazio()) window.__xgRecado = { n:((window.__xgRecado||{}).n||0)+1,c:"recusa:tanque-mapeamento" };
      }
      // Cada alteração vale somente neste passo, sem regravar os ajustes de calda.
      var rthAntes = P.rth, modoAntes = P.modo, p = coordenadas();
      var antes = { i:V.i,estado:V.estado,p:p,desvio:!!V.desvioLat };
      P.rth = Math.max(33,missao.altura); P.modo = "facil";
      try { passoAntes.apply(this,arguments); } finally { P.rth = rthAntes; P.modo = modoAntes; }
      acompanhar(Math.max(0,Number(dt)||0),antes);
    };
    var emitirAntes = emitir;
    emitir = function(dt,aplica) {
      var r = emitirAntes.apply(this,arguments);
      if (pausado() || !ativo() || !missao.completa || missao.estado === "cancelado" || !solo() || V.rodando) return r;
      if (missao.estado !== "concluido") {
        missao.estado = "reconstruindo";
        tempoRecon += Math.max(0,Number(dt)||0) * (V.mult || 1);
        missao.reconstrucao = Math.min(100,29+71*tempoRecon/(missao.res === "Alta" ? 100 : 65));
        if (missao.reconstrucao >= 100) missao.estado = "concluido";
        progresso();
      }
      return r;
    };
    window.xgMapeamento = { preparar:preparar,estado:estado,confirmar:confirmar,descartar:descartar,cancelar:cancelar,
      capturar:capturar,restaurar:restaurar };
    return true;
  }

  function conectar() {
    if (ws || !real()) return;
    try { ws = new WebSocket("ws://127.0.0.1:8804"); } catch (e) { ws = null; return; }
    ws.onopen = function () { espera = 1000; ultimoEstado = ""; fotoFeita = null; rotaEnviada = ""; };
    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m && m.t === "cmd") { try { executar(m); } catch (e) { console.warn("app_rcplus", e); } }
    };
    ws.onclose = function () { ws = null; setTimeout(conectar, espera); espera = Math.min(espera * 2, 4000); };
    ws.onerror = function () { /* onclose vem depois */ };
  }

  /* ------------------------------------------ sensores (radar e altura)

     Roda DENTRO do campo (toString + eval, como o manual.js), onde drone, V,
     alt, colisores e distColisor existem. É o que o HSI e a altura do app
     precisam:
     - chao / motores: no chão? hélices girando? (a mesma conta das hélices);
     - altRadar: altura sobre o chão, a lavoura (__xgDossel) ou o topo da
       árvore/construção logo abaixo - "o terreno que o radar identifica";
     - vx, vz, vy: velocidade pela posição de verdade (sem o erro do GNSS);
     - rd: 72 fatias de 5 graus (0 = nariz, sentido horário) com a distância
       do obstáculo mais perto até 16 m; só no ar. Faixa vertical de 5 m (o
       texto do app: "acima e abaixo dentro de 5,0 m"); fio só até 4 m.
     O radar antigo (Ponte.radar, 12 setores) continua para os avisos. */
  function sensoresNoJogo() {
    if (typeof drone === "undefined" || !drone || typeof V === "undefined" || typeof colisores === "undefined" ||
        typeof distColisor !== "function" || typeof alt !== "function") return null;
    var d = drone.position, solo = alt(d.x, d.z), i, k, c;
    var chao = d.y <= solo + 0.05;
    var motores = !!V.rodando && ["reabastecendo", "concluído", "em solo"].indexOf(V.estado) < 0 &&
      !(V.estado === "caiu" && V.noChao);

    /* velocidade pela posição (m/s do jogo: o relógio dele corre V.mult vezes) */
    var agora = performance.now(), ant = window.__xgSensAnt, vx = 0, vz = 0, vy = 0;
    if (ant && agora - ant.t < 50) { vx = ant.vx; vz = ant.vz; vy = ant.vy; }
    else {
      if (ant && agora - ant.t <= 1000) {
        var dt = (agora - ant.t) / 1000 * (V.mult || 1);
        var bx = (d.x - ant.x) / dt, bz = (d.z - ant.z) / dt, by = (d.y - ant.y) / dt;
        /* pulo (reiniciou o voo, voltou à base): não é velocidade */
        if (Math.hypot(bx, bz, by) < 40) { vx = 0.5 * ant.vx + 0.5 * bx; vz = 0.5 * ant.vz + 0.5 * bz; vy = 0.5 * ant.vy + 0.5 * by; }
      }
      window.__xgSensAnt = { t: agora, x: d.x, y: d.y, z: d.z, vx: vx, vz: vz, vy: vy };
    }

    /* altura do radar: chão, lavoura ou o topo do que estiver logo abaixo */
    var dos = typeof window.__xgDossel === "function" ? Math.max(0, window.__xgDossel(d.x, d.z) || 0) : 0;
    var topo = solo + dos;
    var dentroCaixa = function (c, x, z) {
      var cs = Math.cos(-(c.rot || 0)), sn = Math.sin(-(c.rot || 0));
      var lx = (x - c.x) * cs - (z - c.z) * sn, lz = (x - c.x) * sn + (z - c.z) * cs;
      return Math.abs(lx) <= c.sx / 2 && Math.abs(lz) <= c.sz / 2;
    };
    for (i = 0; i < colisores.length; i++) {
      c = colisores[i];
      if (c.tipo === "seg" || !(c.y1 <= d.y + 0.3) || Math.hypot(c.cx - d.x, c.cz - d.z) > c.raio) continue;
      if (c.tipo === "cil" ? Math.hypot(d.x - c.x, d.z - c.z) <= c.r : dentroCaixa(c, d.x, d.z)) topo = Math.max(topo, c.y1);
    }
    var altRadar = Math.max(0, d.y - topo);

    /* radar: 72 raios em volta, só no ar */
    var rd = null;
    if (!chao && motores) {
      var N = 72, PASSO = 2 * Math.PI / N, A = 16, FAIXA = 5;
      var fio = typeof T50 !== "undefined" && T50.alcanceFio ? T50.alcanceFio : 4;
      var media = typeof P !== "undefined" && P.xgRadarMedia;
      var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw), rx = Math.sin(V.yaw), rz = Math.cos(V.yaw);
      var p = new THREE.Vector3(d.x, d.y + 0.3, d.z), out = [];
      for (k = 0; k < N; k++) out.push(0);
      var por = function (k, v) { k = ((k % N) + N) % N; v = Math.max(0.05, v); if (!out[k] || v < out[k]) out[k] = v; };
      var angulo = function (x, z) { var dx = x - d.x, dz = z - d.z; return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz); };
      var raio = function (k) { var t = k * PASSO, ct = Math.cos(t), st = Math.sin(t); return [fx * ct + rx * st, fz * ct + rz * st]; };
      /* distância horizontal ao longo do raio w até a pegada (-1 = errou) */
      var tiroCil = function (c, w) {
        var ox = c.x - d.x, oz = c.z - d.z, o2 = ox * ox + oz * oz, r2 = c.r * c.r;
        if (o2 <= r2) return 0;
        var b = ox * w[0] + oz * w[1], s2 = o2 - b * b;
        if (b < 0 || s2 > r2) return -1;
        return Math.max(0, b - Math.sqrt(r2 - s2));
      };
      var tiroCaixa = function (c, w) {
        var cs = Math.cos(-(c.rot || 0)), sn = Math.sin(-(c.rot || 0)), qx = d.x - c.x, qz = d.z - c.z;
        var o = [qx * cs - qz * sn, qx * sn + qz * cs], v = [w[0] * cs - w[1] * sn, w[0] * sn + w[1] * cs];
        var me = [c.sx / 2, c.sz / 2], t0 = -Infinity, t1 = Infinity;
        for (var e = 0; e < 2; e++) {
          if (Math.abs(v[e]) < 1e-9) { if (Math.abs(o[e]) > me[e]) return -1; continue; }
          var ta = (-me[e] - o[e]) / v[e], tb = (me[e] - o[e]) / v[e];
          t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
        }
        if (t1 < Math.max(t0, 0)) return -1;
        return Math.max(0, t0);
      };
      for (i = 0; i < colisores.length; i++) {
        c = colisores[i];
        var dc = Math.hypot(c.cx - d.x, c.cz - d.z);
        if (dc > c.raio + A) continue;
        /* árvore seca: acima de 15 km/h o radar não a vê (campo, sondar) */
        if (c.seca && typeof T50 !== "undefined" && T50.velArvoreSeca &&
            (typeof velHorizontal === "function" ? velHorizontal() : V.v) > T50.velArvoreSeca) continue;
        var lim = c.fio ? Math.min(A, fio) : A;
        var dist = distColisor(c, p);
        if (dist > lim) continue;
        /* sensibilidade Média: o pequeno só de perto (manual.js) */
        if (media && !c.fio && c.raio < 0.6 && dist > fio) continue;
        /* fora da faixa vertical: muito abaixo ou muito acima do radar */
        var topoC = c.tipo === "seg" ? Math.max(c.a.y, c.b.y) : c.y1;
        if (p.y - topoC > FAIXA) continue;
        if (c.tipo !== "seg" && c.y0 - p.y > FAIXA) continue;
        var w, h, dk;
        if (c.tipo === "seg") {
          /* fio: cada raio que cruza o fio dentro do alcance */
          var ex = c.b.x - c.a.x, ey = c.b.y - c.a.y, ez = c.b.z - c.a.z, l2 = ex * ex + ey * ey + ez * ez || 1;
          var u0 = Math.max(0, Math.min(1, ((p.x - c.a.x) * ex + (p.y - c.a.y) * ey + (p.z - c.a.z) * ez) / l2));
          var qx = c.a.x + ex * u0, qz = c.a.z + ez * u0, gq = p.y - (c.a.y + ey * u0);
          if (!(Math.abs(gq) > Math.hypot(qx - d.x, qz - d.z))) por(Math.round(angulo(qx, qz) / PASSO), dist);
          var ax = c.a.x - d.x, az = c.a.z - d.z;
          for (k = 0; k < N; k++) {
            w = raio(k);
            var den = w[0] * ez - w[1] * ex;
            if (Math.abs(den) < 1e-9) continue;
            h = (ax * ez - az * ex) / den;
            var u = (ax * w[1] - az * w[0]) / den;
            if (h < 0 || u < 0 || u > 1) continue;
            var gu = p.y - (c.a.y + ey * u);
            if (h < Math.abs(gu)) continue; // cone vertical: indicador acima/abaixo, não disco horizontal
            dk = Math.hypot(h, gu) - c.r;
            if (dk <= lim) por(k, Math.max(dist, dk));
          }
          continue;
        }
        /* cilindro/caixa: borda irregular, raio a raio. O que está bem
           embaixo (mais de 45 graus abaixo do radar) é o chão do radar de
           baixo (altRadar), não obstáculo: sobrevoar a copa não pinta o disco */
        var gy = p.y > c.y1 ? p.y - c.y1 : p.y < c.y0 ? c.y0 - p.y : 0, baixo = p.y > c.y1;
        var ang = angulo(c.cx, c.cz), angP = ang;
        if (c.tipo === "caixa") {
          /* ponto mais perto da pegada: prédio comprido não faz pico no rumo do meio */
          var cs2 = Math.cos(-(c.rot || 0)), sn2 = Math.sin(-(c.rot || 0)), qx2 = d.x - c.x, qz2 = d.z - c.z;
          var lx2 = Math.max(-c.sx / 2, Math.min(c.sx / 2, qx2 * cs2 - qz2 * sn2)), lz2 = Math.max(-c.sz / 2, Math.min(c.sz / 2, qx2 * sn2 + qz2 * cs2));
          var nx2 = c.x + lx2 * cs2 + lz2 * sn2, nz2 = c.z - lx2 * sn2 + lz2 * cs2;
          if (Math.hypot(nx2 - d.x, nz2 - d.z) > 1e-6) angP = angulo(nx2, nz2);
        }
        if (Math.sqrt(Math.max(0, dist * dist - gy * gy)) >= gy) por(Math.round(angP / PASSO), dist);
        var meia = dc > c.raio ? Math.asin(Math.min(1, c.raio / dc)) : Math.PI;
        var k0 = Math.round((ang - meia) / PASSO), k1 = Math.round((ang + meia) / PASSO);
        if (k1 - k0 >= N) k1 = k0 + N - 1;
        for (k = k0; k <= k1; k++) {
          w = raio(k);
          h = c.tipo === "cil" ? tiroCil(c, w) : tiroCaixa(c, w);
          if (h < 0 || h < gy) continue;
          dk = Math.hypot(h, gy);
          if (dk <= lim) por(k, Math.max(dist, dk));
        }
      }
      // Não inventar setores de obstáculos a partir da altura do terreno.
      rd = out.map(function (v) { return v ? Math.max(0.1, Math.round(v * 10) / 10) : 0; });
    }
    var r2 = function (v) { return Math.round(v * 100) / 100; };
    return { chao: chao, motores: motores, altRadar: r2(altRadar), vx: r2(vx), vz: r2(vz), vy: r2(vy), rd: rd };
  }

  /* instala uma vez no campo; o teste a cada chamada reinstala sozinho
     quando o nível recarrega */
  function sensores() {
    var r = ler("typeof __xgSensores === 'function' ? __xgSensores() : 'falta'");
    if (r === "falta") {
      rodar("window.__xgSensores = " + sensoresNoJogo.toString());
      r = ler("typeof __xgSensores === 'function' ? __xgSensores() : null");
    }
    return r && typeof r === "object" ? r : null;
  }

  /* ------------------------------------- rota do app novo, dentro do campo

     Roda DENTRO do campo (toString + eval, como os sensores). O embrulho do
     gerarRota (ponte.js, instalarRotaPlanejada) chama window.__xgRotaApp()
     primeiro. Com P.xgGeo (mandado pelo app no talhao) e a chave do limite
     batendo, gera a rota com o MESMO gerador da previa do controle e devolve
     true; senao devolve false e o caminho antigo assume (sem geo, outro
     talhao, controle virtual ou XAG).
     Pontos: os de conexao primeiro ({alto, con}: voa na altitude RTH), depois
     a rota ({aplica, fr: fronteira, alto: passa por cima}).
     gerarRotaPulv: COPIA IDENTICA da funcao de mesmo nome em
     ControleSimuladorRCPlus/app/src/main/assets/app/mapa.js (manter igual a mapa.js). */
  function rotaDoAppNoJogo() {
    if (typeof P === "undefined" || !P || !P.xgGeo || typeof mapaAtual !== "function") return false;
    var G = P.xgGeo, Mp = mapaAtual();
    if (!Mp || !Mp.limite || Mp.limite.length < 3 || (!Array.isArray(G.map) && typeof P.xgAngulo !== "number")) return false;
    var LM = Mp.limite, chave = LM.length + "|" + Number(LM[0][0]).toFixed(2) + "|" + Number(LM[0][1]).toFixed(2);
    if (chave !== G.chave) return false;
    if (Array.isArray(G.map)) {
      rota.length = 0;
      G.map.forEach(function(q) { rota.push({p:[q[0],q[1]], aplica:false}); });
      return true;
    }

    /* manter igual a mapa.js */
    function gerarRotaPulv(lim, o) {
      var esp = Number(o.esp) || 6, cob = o.cob || "Somente rota";
      var laco0 = o.laco == null ? 1.5 : Number(o.laco), folgaLig = o.folgaLig == null ? 0 : Number(o.folgaLig);
      var folga = o.folgaObs == null ? 3.2 : Number(o.folgaObs);
      var ang = Number(o.ang) || 0, c = Math.cos(-ang), s = Math.sin(-ang);
      var gira = function (p) { return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };
      var desgira = function (p) { return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c]; };
      var dist = function (a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); };
      function areaS(pol) {
        var t = 0;
        for (var i = 0; i < pol.length; i++) { var a = pol[i], b = pol[(i + 1) % pol.length]; t += a[0] * b[1] - b[0] * a[1]; }
        return t / 2;
      }
      /* recuo para dentro (d número ou lista por aresta), cantos em esquadria */
      function borda(pol, d) {
        var n = pol.length, sinal = areaS(pol) > 0 ? 1 : -1, lin = [], out = [], i;
        for (i = 0; i < n; i++) {
          var p = pol[i], q = pol[(i + 1) % n], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1;
          var di = typeof d === "number" ? d : (Number(d[i]) || 0);
          lin.push([[p[0] - ez / l * sinal * di, p[1] + ex / l * sinal * di], [ex, ez]]);
        }
        for (i = 0; i < n; i++) {
          var L1 = lin[(i + n - 1) % n], L2 = lin[i], den = L1[1][0] * L2[1][1] - L1[1][1] * L2[1][0];
          if (Math.abs(den) < 1e-9) { out.push(L2[0]); continue; }
          var t = ((L2[0][0] - L1[0][0]) * L2[1][1] - (L2[0][1] - L1[0][1]) * L2[1][0]) / den;
          out.push([L1[0][0] + L1[1][0] * t, L1[0][1] + L1[1][1] * t]);
        }
        return out;
      }
      /* inválido: virou do avesso (sinal da área trocou) ou quase sem área */
      function valido(pol, ref) {
        if (!pol || pol.length < 3) return false;
        var a = areaS(pol);
        return Math.abs(a) >= 1 && (a > 0) === (ref > 0);
      }
      /* onde a reta horizontal y corta o polígono (x em ordem) */
      function cortes(pol, y) {
        var xs = [];
        for (var i = 0; i < pol.length; i++) {
          var a = pol[i], b = pol[(i + 1) % pol.length];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        return xs.sort(function (p, q) { return p - q; });
      }
      function envolt(pts) {
        var p = pts.map(function (q) { return [q[0], q[1]]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
        if (p.length < 3) return p;
        var cr = function (q, a, b) { return (a[0] - q[0]) * (b[1] - q[1]) - (a[1] - q[1]) * (b[0] - q[0]); }, lo = [], hi = [], i;
        for (i = 0; i < p.length; i++) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p[i]) <= 0) lo.pop(); lo.push(p[i]); }
        for (i = p.length - 1; i >= 0; i--) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p[i]) <= 0) hi.pop(); hi.push(p[i]); }
        return lo.slice(0, -1).concat(hi.slice(0, -1));
      }
      /* zona do obstáculo: Redondo = octógono de apótema r + folga (vértices em
         k·45° + 22,5°; só para as ligações: as passadas usam os círculos abaixo);
         polígono = envoltória recuada para fora em "folga", em esquadria, com
         teto de 3 x folga */
      function zona(ob) {
        var z = [], k;
        if (ob.tipo === "circulo" || (ob.c && ob.r)) {
          var R = (Number(ob.r) + folga) / Math.cos(Math.PI / 8);
          for (k = 0; k < 8; k++) { var a = k * Math.PI / 4 + Math.PI / 8; z.push([ob.c[0] + Math.cos(a) * R, ob.c[1] + Math.sin(a) * R]); }
          return z;
        }
        var h = envolt(ob.pts || []), n = h.length;
        if (n < 3) return [];
        var sg = areaS(h) > 0 ? 1 : -1;
        var nor = function (a, b) { var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dz / l * sg, -dx / l * sg]; };
        return h.map(function (v, i) {
          var n1 = nor(h[(i - 1 + n) % n], v), n2 = nor(v, h[(i + 1) % n]);
          var bx = n1[0] + n2[0], bz = n1[1] + n2[1], l = Math.hypot(bx, bz) || 1;
          bx /= l; bz /= l;
          var m = Math.min(3, 1 / Math.max(.2, bx * n1[0] + bz * n1[1])) * folga;
          return [v[0] + bx * m, v[1] + bz * m];
        });
      }
      function dentroP(p, pol) {
        var ok = false;
        for (var i = 0, j = pol.length - 1; i < pol.length; j = i++) {
          var a = pol[i], b = pol[j];
          if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])) ok = !ok;
        }
        return ok;
      }
      function segDentro(a, b, pol) {
        var n = Math.max(2, Math.ceil(dist(a, b)));
        for (var k = 0; k <= n; k++) { var t = k / n; if (!dentroP([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], pol)) return false; }
        return true;
      }
      /* cópia fiel de cruzaZona/contornar do campo (campo/index.html) */
      function cruza(z, a, b) {
        var n = z.length, sg = areaS(z) > 0 ? 1 : -1, dx = b[0] - a[0], dz = b[1] - a[1], t0 = 0, t1 = 1, e0 = -1, e1 = -1;
        for (var i = 0; i < n; i++) {
          var p = z[i], q = z[(i + 1) % n], nx = (q[1] - p[1]) * sg, nz = -(q[0] - p[0]) * sg;
          var num = nx * (a[0] - p[0]) + nz * (a[1] - p[1]), den = nx * dx + nz * dz;
          if (Math.abs(den) < 1e-9) { if (num > -1e-6) return null; continue; }
          var t = -num / den;
          if (den < 0) { if (t > t0 || (e0 < 0 && t >= t0 - 1e-6)) { t0 = Math.max(t, 0); e0 = i; } }
          else if (t < t1 || (e1 < 0 && t <= t1 + 1e-6)) { t1 = Math.min(t, 1); e1 = i; }
          if (t0 > t1) return null;
        }
        if ((t1 - t0) * Math.hypot(dx, dz) < .6 || e0 < 0 || e1 < 0) return null;
        return { t0: t0, t1: t1, e0: e0, e1: e1 };
      }
      function contorna(a, b, zonas, limite, prof) {
        var melhor = null;
        zonas.forEach(function (z) { var q = cruza(z, a, b); if (q && (!melhor || q.t0 < melhor.c.t0)) melhor = { z: z, c: q }; });
        if (!melhor) return [];
        if (prof > 6) return [{ p: b.slice(), alto: true }];
        var z = melhor.z, q = melhor.c, n = z.length, frente = [], tras = [], i, k;
        for (i = (q.e0 + 1) % n, k = 0; k < n; i = (i + 1) % n, k++) { frente.push(z[i]); if (i === q.e1) break; }
        for (i = q.e0, k = 0; k < n; i = (i - 1 + n) % n, k++) { if (i === q.e1) break; tras.push(z[i]); }
        var E = [a[0] + (b[0] - a[0]) * q.t0, a[1] + (b[1] - a[1]) * q.t0], X = [a[0] + (b[0] - a[0]) * q.t1, a[1] + (b[1] - a[1]) * q.t1];
        var comp = function (l) { var t = 0, p = E; l.concat([X]).forEach(function (r) { t += dist(p, r); p = r; }); return t; };
        var cam = frente.length && (comp(frente) <= comp(tras) || !tras.length) ? frente : tras;
        if (!cam.length) return [{ p: b.slice(), alto: true }];
        var xs = limite.map(function (p) { return p[0]; }), zs = limite.map(function (p) { return p[1]; });
        var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), z0 = Math.min.apply(null, zs), z1 = Math.max.apply(null, zs);
        var fora = cam.some(function (r) { return r[0] < x0 - 12 || r[0] > x1 + 12 || r[1] < z0 - 12 || r[1] > z1 + 12; });
        if (fora || comp(cam) > dist(E, X) * 3 + 40) return [{ p: b.slice(), alto: true }];
        return cam.map(function (r) { return { p: r }; }).concat(contorna(cam[cam.length - 1], b, zonas, limite, prof + 1));
      }

      if (!lim || lim.length < 3) return [];
      var A0 = areaS(lim);
      if (Math.abs(A0) < 1) return [];
      /* passo 1: laço (fronteira), linha das ligações (L) e borda do pulverizado (S).
         Rota e fronteira (g6 #0103): S fica esp/2 por dentro do LAÇO (o amarelo
         termina a esp/2 dele) e a ponta branca tem esp/2 AO LONGO da passada,
         sem passar de L (laço + folgaLig; 0 = pode encostar no laço). A grade das
         passadas continua presa 0,2 m mais para dentro (1ª passada a ~esp + 0,2
         do laço) */
      var dL = cob === "Somente rota" ? laco0 : laco0 + folgaLig;
      var lacoW = borda(lim, laco0), LW = borda(lim, dL), SW = cob === "Somente rota" ? LW : borda(lim, laco0 + esp / 2);
      var okLaco = valido(lacoW, A0), okL = valido(LW, A0), okS = okL && valido(SW, A0);
      var L = LW.map(gira), S = SW.map(gira), lacoR = lacoW.map(gira), limR = lim.map(gira);
      var GW = cob === "Somente rota" ? SW : borda(lim, laco0 + .2 + esp / 2), G = valido(GW, A0) ? GW.map(gira) : S;
      /* a travessia entre passadas não sai da área: conferida 0,3 m por fora de L */
      var chkW = borda(lim, Math.max(0, dL - .3)), chk = valido(chkW, A0) ? chkW.map(gira) : limR;
      var ehCirc = function (ob) { return ob.tipo === "circulo" || !!(ob.c && ob.r); };
      var zonas = (o.obs || []).map(zona).filter(function (z) { return z.length >= 3; }).map(function (z) { return z.map(gira); });
      var zonasCorte = (o.obs || []).filter(function (ob) { return !ehCirc(ob); }).map(zona).filter(function (z) { return z.length >= 3; })
        .map(function (z) { return z.map(gira); });
      /* Redondo (g6 #0110 medido pelo espaçamento, 36 px/m): zona de pulverização
         = círculo de raio r + folga (4,7 m): a passada que só a atravessa (a 4,6 m
         do centro) segue reta, branca dentro dele. Zona de voo = r + segurança
         (folga − 1,7; 3,0 m): a passada que entra nela (a 0,1 e 2,3 m) é cortada
         no círculo e desvia por uma polilinha só dela, a r + folga dos lados e a
         r + folga + 0,3·d no fundo (4,7 m com d = 0; 5,4 m com d = 2,3: passa por
         cima da vizinha; os desvios de passadas vizinhas se cruzam) */
      var circs = (o.obs || []).filter(ehCirc).map(function (ob) {
        var r = Number(ob.r) || 1.5;
        return { c: gira(ob.c), rs: r + folga, rv: r + Math.max(0, folga - 1.7), rd: r + folga };
      });
      var sem = (o.sem || []).filter(function (p) { return p && p.length >= 3; }).map(function (p) { return p.map(gira); });
      var out = [];
      var emite = function (p, a, t) { out.push([p[0], p[1], a, t || 0]); };
      /* desvio de uma passada em volta do Redondo C, do corte de entrada ao de
         saída; false se sair do talhão (aí passa por cima, trecho alto) */
      var desvioRedondo = function (C, y, mais) {
        var dd = y - C.c[1], sn = dd >= 0 ? 1 : -1, ad = Math.abs(dd), tg = Math.tan(Math.PI / 8), h = C.rd + .3 * ad, w = [];
        if (C.rd * tg > ad) w.push([-C.rd, sn * C.rd * tg]);
        w.push([-h * tg, sn * h], [h * tg, sn * h]);
        if (C.rd * tg > ad) w.push([C.rd, sn * C.rd * tg]);
        if (!mais) w.reverse();
        w = w.map(function (p) { return [C.c[0] + p[0], C.c[1] + p[1]]; });
        if (w.some(function (p) { return !dentroP(p, limR); })) return false;
        w.forEach(function (p) { emite(p, 0); });
        return true;
      };
      var ult = function () { var u = out[out.length - 1]; return [u[0], u[1]]; };
      var contornarAte = function (a, q) { contorna(a, q, zonas, L, 0).forEach(function (w) { emite(w.p, 0, w.alto ? 2 : 0); }); };
      /* liga o último ponto a q (desviando das zonas); entre passadas, se a
         travessia sai da área, recua as duas pontas pelas próprias passadas */
      var ligar = function (q, dirAnt, dirProx) {
        if (!out.length) { emite(q, 0); return; }
        var a = ult();
        if (dirAnt && dirProx && !segDentro(a, q, chk)) {
          for (var d = 2; d <= 60; d += 2) {
            var a2 = [a[0] - dirAnt[0] * d, a[1] - dirAnt[1] * d], b2 = [q[0] + dirProx[0] * d, q[1] + dirProx[1] * d];
            if (!segDentro(a2, b2, chk)) continue;
            emite(a2, 0);
            contornarAte(a2, b2);
            if (dist(ult(), b2) > .1) emite(b2, 0);
            a = b2;
            break;
          }
        }
        contornarAte(a, q);
        if (dist(ult(), q) > .1) emite(q, 0);
      };

      /* passo 2: linhas e peças */
      var linhas = [];
      if (cob !== "Somente fronteira" && okS) {
        var minY = Infinity, maxY = -Infinity;
        G.forEach(function (p) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
        for (var y = minY + esp / 2; y < maxY; y += esp) {
          var cs = cortes(S, y), cl = cortes(L, y), pecas = [];
          for (var j = 0; j + 1 < cs.length; j += 2) {
            var pa = cs[j], pb = cs[j + 1], ta = pa, tb = pb;
            for (var m = 0; m + 1 < cl.length; m += 2) if (cl[m] <= pa + 1e-6 && cl[m + 1] >= pb - 1e-6) { ta = cl[m]; tb = cl[m + 1]; break; }
            if (cob !== "Somente rota") { ta = Math.max(ta, pa - esp / 2); tb = Math.min(tb, pb + esp / 2); }
            if (pb - pa > 1) pecas.push({ ta: ta, tb: tb, a: pa, b: pb });
          }
          /* corte por zona: sem ponta branca no lado do obstáculo */
          for (var zi = 0; zi < zonasCorte.length && pecas.length; zi++) {
            var cz = cortes(zonasCorte[zi], y);
            if (cz.length < 2) continue;
            var za = cz[0], zb = cz[cz.length - 1], nov = [];
            for (var pi = 0; pi < pecas.length; pi++) {
              var q = pecas[pi];
              if (zb <= q.ta || za >= q.tb) { nov.push(q); continue; }
              var bE = Math.min(q.b, za), aD = Math.max(q.a, zb);
              if (bE - q.a > 1) nov.push({ ta: q.ta, tb: za, a: q.a, b: bE });
              if (q.b - aD > 1) nov.push({ ta: zb, tb: q.tb, a: aD, b: q.b });
            }
            pecas = nov;
          }
          /* Redondo: só corta (e marca o desvio entre as duas peças) se a passada
             entra na zona de voo; o corte fica no círculo de pulverização */
          for (var ci = 0; ci < circs.length && pecas.length; ci++) {
            var C = circs[ci], dc = y - C.c[1];
            if (Math.abs(dc) >= C.rv) continue;
            var wc = Math.sqrt(C.rs * C.rs - dc * dc), ca = C.c[0] - wc, cb = C.c[0] + wc, nv = [];
            for (var pj = 0; pj < pecas.length; pj++) {
              var q2 = pecas[pj], pE = null, pD = null;
              if (cb <= q2.ta || ca >= q2.tb) { nv.push(q2); continue; }
              if (Math.min(q2.b, ca) - q2.a > 1) { pE = { ta: q2.ta, tb: ca, a: q2.a, b: Math.min(q2.b, ca), cE: q2.cE }; nv.push(pE); }
              if (q2.b - Math.max(q2.a, cb) > 1) { pD = { ta: cb, tb: q2.tb, a: Math.max(q2.a, cb), b: q2.b, cD: q2.cD }; nv.push(pD); }
              if (pE && pD) { pE.cD = C; pD.cE = C; }
            }
            pecas = nv;
          }
          if (pecas.length) linhas.push({ y: y, pecas: pecas });
        }
      }
      /* passo 3: segmentação */
      var sg0 = o.seg || [0, 100], nl = linhas.length;
      if (sg0[0] > 0 || sg0[1] < 100) linhas = linhas.slice(Math.floor(nl * sg0[0] / 100), Math.ceil(nl * sg0[1] / 100));
      /* passo 4: serpentina */
      var dirAnt = null;
      linhas.forEach(function (ln, k) {
        var mais = k % 2 === 0, dir = [mais ? 1 : -1, 0], y = ln.y;
        var ps = ln.pecas.slice().sort(function (p, q) { return mais ? p.ta - q.ta : q.ta - p.ta; });
        ps.forEach(function (q, idx) {
          var ini = mais ? q.ta : q.tb, s0 = mais ? q.a : q.b, s1 = mais ? q.b : q.a, fim = mais ? q.tb : q.ta;
          /* entre as duas peças de uma passada cortada pelo Redondo: o desvio dela */
          var cv = idx > 0 ? (mais ? q.cE : q.cD) : null;
          if (cv) { var porCima = !desvioRedondo(cv, y, mais); emite([ini, y], 0, porCima ? 2 : 0); }
          else ligar([ini, y], idx === 0 ? dirAnt : null, idx === 0 ? dir : null);
          if (Math.abs(s0 - ini) > .05) emite([s0, y], 0);
          /* áreas sem aplicação: o trecho dentro delas fica branco */
          var ws = [], lo = Math.min(s0, s1), hi = Math.max(s0, s1);
          sem.forEach(function (pol) {
            var cz = cortes(pol, y);
            for (var j = 0; j + 1 < cz.length; j += 2) {
              var w0 = Math.max(cz[j], lo), w1 = Math.min(cz[j + 1], hi);
              if (w1 - w0 > .05) ws.push([w0, w1]);
            }
          });
          /* Redondo que a passada só atravessa (fora da zona de voo): branco e reto */
          circs.forEach(function (C) {
            var dc = y - C.c[1];
            if (Math.abs(dc) < C.rv || Math.abs(dc) >= C.rs) return;
            var wc = Math.sqrt(C.rs * C.rs - dc * dc), w0 = Math.max(C.c[0] - wc, lo), w1 = Math.min(C.c[0] + wc, hi);
            if (w1 - w0 > .05) ws.push([w0, w1]);
          });
          ws.sort(function (p, q) { return p[0] - q[0]; });
          var junt = [];
          ws.forEach(function (w) { var u = junt[junt.length - 1]; if (u && w[0] <= u[1]) u[1] = Math.max(u[1], w[1]); else junt.push(w.slice()); });
          if (!mais) junt = junt.reverse().map(function (w) { return [w[1], w[0]]; });
          var cur = s0;
          junt.forEach(function (w) {
            if (Math.abs(w[0] - cur) > .05) emite([w[0], y], 1);
            emite([w[1], y], 0);
            cur = w[1];
          });
          if (Math.abs(s1 - cur) > .05 || !junt.length) emite([s1, y], 1);
          if (Math.abs(fim - s1) > .05) emite([fim, y], 0);
        });
        dirAnt = dir;
      });
      /* passo 5: fronteira, voada por último (horário = área com sinal > 0) */
      if (cob !== "Somente rota" && okLaco) {
        var lc = lacoR.slice(), nL = lc.length, hor = areaS(lc) > 0, mm;
        if ((o.sentido === "anti") === hor) lc.reverse();
        if (out.length) {
          var u = ult(), melhor = Infinity, Q = lc[0], jj = 0;
          for (var j2 = 0; j2 < nL; j2++) {
            var e0 = lc[j2], e1 = lc[(j2 + 1) % nL], ex = e1[0] - e0[0], ez = e1[1] - e0[1], l2 = ex * ex + ez * ez;
            var tt = l2 > 1e-12 ? Math.max(0, Math.min(1, ((u[0] - e0[0]) * ex + (u[1] - e0[1]) * ez) / l2)) : 0;
            var pq = [e0[0] + ex * tt, e0[1] + ez * tt], dq = dist(u, pq);
            if (dq < melhor) { melhor = dq; Q = pq; jj = j2; }
          }
          ligar(Q, null, null);
          for (mm = 1; mm <= nL; mm++) emite(lc[(jj + mm) % nL], 1, 1);
          emite(Q, 1, 1);
        } else {
          emite(lc[0], 0);
          for (mm = 1; mm <= nL; mm++) emite(lc[mm % nL], 1, 1);
        }
      }
      return out.map(function (q) {
        var p = desgira(q);
        return [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000, q[2], q[3]];
      });
    }

    var r;
    try {
      r = gerarRotaPulv(LM, { esp: P.faixa, ang: P.xgAngulo, cob: P.xgCobertura || "Somente rota", sentido: P.xgSentido,
        seg: P.xgSeg || [0, 100], obs: Mp.obstaculos || [], folgaObs: G.folgaObs, sem: G.sem || [], laco: G.laco, folgaLig: G.folgaLig });
    } catch (e) { return false; }
    rota.length = 0;
    (G.con || []).forEach(function (c) { rota.push({ p: [c[0], c[1]], aplica: false, alto: true, con: true }); });
    r.forEach(function (q) { rota.push({ p: [q[0], q[1]], aplica: q[2] === 1, fr: q[3] === 1, alto: q[3] === 2 }); });
    return true;
  }

  /* ------------------------------------------- pontos de retorno 1 e 2

     Manual p.88-89 e o piloto (nº 38): pausada a rota, o app mostra o ponto
     de interrupcao C (fixo) e os pontos de retorno 1 e 2, que sao E1 e E3 do
     manual (na Rota nao existe E2): as projecoes PERPENDICULARES da posicao
     atual do drone sobre a passada em que ele estava e sobre a seguinte.
     Recalculados a cada estado, acompanham o drone.
       r  = [[x, z, aplica, tipo]] (rotaDoCampo; tipo 4 = ponto de conexao)
       C  = {i, p}: o ponto de interrupcao, no trecho i = r[i-1] -> r[i]
       D  = [x, z]: posicao verdadeira do drone
       vi = V.i do jogo
     Devolve {c, ci, ida, con, pas, e1, e2}: ida = ainda na ida do comeco
     (menu "Ponto de conexao / Ponto inicial"); pas = C esta numa passada
     (senao so o ponto de interrupcao); e1/e2 = {i, p} ou null. Funcao pura. */
  function pontosRetorno(r, C, D, comPontos, vi) {
    if (!r || !r.length || !C || !C.p) return null;
    var n = r.length, k0 = 0;
    while (k0 < n && r[k0][3] === 4) k0++;
    var ci = Number(C.i) || 0;
    var out = { c: [C.p[0], C.p[1]], ci: ci, ida: (typeof vi === "number" ? vi : ci) <= k0, con: k0, pas: false, e1: null, e2: null };
    if (out.ida || ci < 1 || ci >= n) return out;
    var A = r[ci - 1], B = r[ci];
    if (!B[2] || (B[3] || 0) !== 0) return out;
    var reta = function (a, b) {
      var ux = b[0] - a[0], uz = b[1] - a[1], L = Math.hypot(ux, uz);
      return L > 1e-6 ? { a: a, u: [ux / L, uz / L] } : null;
    };
    var fora = function (l, p) { return Math.abs((p[0] - l.a[0]) * l.u[1] - (p[1] - l.a[1]) * l.u[0]); };
    var tt = function (l, p) { return (p[0] - l.a[0]) * l.u[0] + (p[1] - l.a[1]) * l.u[1]; };
    var la = reta(A, B);
    if (!la || fora(la, C.p) > 1.5) return out;
    out.pas = true;
    if (!comPontos || !D) return out;
    /* os trechos pulverizados de uma passada, a partir de k, sobre a reta l
       (os vaos sem aplicacao e os desvios do Redondo no meio dela sao
       pulados); para no primeiro trecho pulverizado fora dela - o comeco
       da passada seguinte ou a fronteira */
    var passada = function (l, k) {
      var lista = [], depois = -1;
      for (; k < n; k++) {
        var p = r[k - 1], q = r[k];
        var naReta = (q[3] || 0) !== 1 && fora(l, p) < 0.3 && fora(l, q) < 0.3;
        if (naReta) { if (q[2]) lista.push(k); continue; }
        if (q[2]) { depois = k; break; }
      }
      return { lista: lista, depois: depois };
    };
    var projetar = function (l, lista, minimo) {
      if (!lista.length) return null;
      var t = tt(l, D), fim = tt(l, r[lista[lista.length - 1]]);
      t = Math.max(minimo, Math.min(fim, t));
      for (var j = 0; j < lista.length; j++) {
        var k = lista[j], t0 = tt(l, r[k - 1]), t1 = tt(l, r[k]);
        if (t <= t1 + 1e-9) {
          if (t < t0) t = t0;
          return { i: k, p: [Math.round((l.a[0] + l.u[0] * t) * 1000) / 1000, Math.round((l.a[1] + l.u[1] * t) * 1000) / 1000] };
        }
      }
      return null;
    };
    var atual = passada(la, ci);
    out.e1 = projetar(la, atual.lista, tt(la, C.p));
    /* a passada seguinte: so se o proximo trecho pulverizado for de passada
       (tipo 0); fronteira ou fim da rota, sem ponto 2 */
    var k2 = atual.depois;
    if (k2 > 0 && (r[k2][3] || 0) === 0) {
      var l2 = reta(r[k2 - 1], r[k2]);
      if (l2) out.e2 = projetar(l2, passada(l2, k2).lista, 0);
    }
    return out;
  }

  /* GNSS sem RTK (gnss.js): a aeronave mira a rota deslocada de gs = c - erro,
     então a posição verdadeira fica 1-2 m fora das linhas. As contas dos
     pontos de retorno são feitas na rota (sem o deslocamento); o alvo para
     voar volta a ter o deslocamento (comRota). */
  var GS_JOGO = "(window.xgGnss ? (function(){var e=xgGnss.erro(); return [xgGnss.c.x-e.x, xgGnss.c.z-e.z];})() : [0,0])";
  function naRota(q, gs) {
    if (!q) return q;
    var g = gs || [0, 0];
    if (q.p) return { i: q.i, p: [q.p[0] - g[0], q.p[1] - g[1]] };
    return [q[0] - g[0], q[1] - g[1]];
  }
  function comRota(pt, gs) { var g = gs || [0, 0]; return [pt[0] + g[0], pt[1] + g[1]]; }

  /* modo do manche (controle virtual escondido): o app confere com o dele */
  var mjGuardado = null, mjQuando = 0;
  function modoDoManche() {
    var agora = Date.now();
    if (agora - mjQuando > 1000) {
      mjQuando = agora;
      try {
        var w = document.getElementById("controle").contentWindow;
        var v = w ? w.eval("typeof modoJoystick !== 'undefined' ? modoJoystick : null") : null;
        mjGuardado = v === 1 || v === 2 || v === 3 ? v : null;
      } catch (e) { mjGuardado = null; }
    }
    return mjGuardado;
  }
  var antesQueda = null;

  /* ------------------------------------------------------------ estado */

  function juntarEstado() {
    var p = ponte();
    if (!p || !p.janela) return null;
    if (ler("window.xgBateria && xgBateria.corte")) return null;
    var e = p.estado() || {};
    var rota = p.rotaDoCampo ? p.rotaDoCampo() : null;
    var radar = p.radar ? p.radar(15) : null;
    var sens = sensores();
    prepararEspelho();
    /* a cobertura e uma varredura cara: 2 vezes por segundo basta (a 10 Hz
       ela pesava no jogo e na camera) */
    var agora = Date.now();
    if (p.cobertura && agora - cobQuando > 500) { cobGuardada = p.cobertura(); cobQuando = agora; }
    var cob = cobGuardada;
    var extra = ler("{" +
      "alerta: (function(){var a=document.getElementById('alerta'); return a && !a.hidden ? {tit:(document.getElementById('alTit')||{}).textContent||'', txt:(document.getElementById('alTxt')||{}).textContent||''} : null})()," +
      "obs: (typeof V!=='undefined' && V.estado==='pairando')," +
      "modo: (typeof P!=='undefined' ? P.modo : null)," +
      "terrenoNivel: (typeof cen!=='undefined' && cen ? (cen.id||cen.nome||null) : null)," +
      /* a foto so depende do cenario (o tipo de terreno do voo nao muda a imagem) */
      "chaveMapa: (typeof cen!=='undefined' && cen ? (cen.id||cen.nome||'') : '')," +
      /* ponto de interrupcao (pontosRetorno): indice da rota e posicao
         verdadeira do drone; trechos pulados na retomada pelo ponto 1/2 */
      "vi: (typeof V!=='undefined' ? V.i : null)," +
      "dp: (typeof drone!=='undefined' && drone ? [drone.position.x, drone.position.z] : null)," +
      "gs: " + GS_JOGO + "," +
      "pulos: (typeof V!=='undefined' && V.pulos && V.pulos.length ? V.pulos : null)," +
      /* fluxo do M (L/min, roda esquerda) e recado do botao de pulverizacao / do Iniciar */
      "fm: (window.xgPulvManual ? xgPulvManual.fluxo : null)," +
      "recado: (window.__xgRecado || null)," +
      /* badeco: o que ele esta fazendo (botoes do controle) */
      "eq: (window.xgEquipe ? {e: xgEquipe.estado, t: !!xgEquipe.tarefa.tanque, b: !!xgEquipe.tarefa.bateria, s: !!xgEquipe.tarefa.esvaziar} : null)," +
      /* aeronave sem bateria (comeco da operacao, equipe.js): o app ve a aeronave desligada */
      "desligada: !!(window.xgEquipe && xgEquipe.semBateria)," +
      /* inclinacao da camera (graus, 0 frente, -90 baixo): a linha do horizonte do app */
      "gb: (typeof window.xgGimbal === 'number' ? window.xgGimbal : -19)," +
      /* rolamento do corpo (graus, + = lado direito para baixo): o horizonte da camera do app */
      "rl: (function(){ if (typeof inclina === 'undefined' || typeof V === 'undefined' || typeof V.yaw !== 'number') return 0;" +
      "  var u = new THREE.Vector3(0, 1, 0).applyQuaternion(inclina.getWorldQuaternion(new THREE.Quaternion()));" +
      "  var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);" +
      "  return Math.asin(Math.max(-1, Math.min(1, u.x * (-fz) + u.z * fx))) * 180 / Math.PI; })()," +
      /* camera 3D desenhada no controle (modo espelho): a pose da camera do
         drone e o que mexe na cena (corpo, calda, chao molhado, operador) */
      "fpv: (window.__xgPoseFpv ? __xgPoseFpv() : null)," +
      "esp: (window.__xgEspelhoPc ? __xgEspelhoPc() : null)" +
      "}") || {};
    var est = e.voo ? e.voo.estado : null;
    if (est && est !== "caiu") antesQueda = est;
    var queda = null;
    if (est === "caiu" && p.lerQueda) { queda = p.lerQueda(); if (queda) queda.antes = antesQueda; }
    return {
      v: e.voo || null,
      d: e.drone || null,
      b: e.base || null,
      o: e.operador || null,
      p: e.parametros || null,
      m: e.maquina ? { tanque: e.maquina.tanque, vazaoMax: e.maquina.vazaoMaxLmin } : null,
      mapa: e.mapa || null,
      rota: rota ? { lim: rota.limite, obs: rota.obstaculos, r: rota.rota, f: rota.faixa, feitos: rota.feitos,
        /* trechos pulados (do C ao ponto 1/2): o app desenha em branco; vai
           dentro da rota para viajar com o "igual" */
        pulos: extra.pulos || null } : null,
      /* ponto de interrupcao C e pontos de retorno 1/2 (so com a rota pausada) */
      ret: e.voo && e.voo.retomar && rota ? pontosRetorno(rota.rota, naRota(e.voo.retomar, extra.gs), naRota(extra.dp, extra.gs), est === "manual", extra.vi) : null,
      fm: typeof extra.fm === "number" ? Math.round(extra.fm * 100) / 100 : null,
      recado: extra.recado || null,
      rtk: !!(e.parametros && e.parametros.xgRtk),
      mapeamento: !!(e.parametros && e.parametros.xgMapeamento),
      mapeamentoDisponivel: mapeamentoAutorizado,
      mapaTanqueVazio: ler("Number.isFinite(V.tan) && V.tan <= 0") === true,
      mapaMissao: ler("window.xgMapeamento ? xgMapeamento.estado() : null"),
      tarefaPreparada: ler("!!V.xgTarefaPreparada"),
      bateria: ler("window.xgBateria ? xgBateria.estado() : null"),
      eq: extra.eq || null,
      desligada: !!extra.desligada,   // sem bateria (equipe.js): o app ve a aeronave desligada
      gb: typeof extra.gb === "number" ? Math.round(extra.gb * 10) / 10 : null,
      rl: typeof extra.rl === "number" ? Math.round(extra.rl * 10) / 10 : null,
      queda: queda,
      mj: modoDoManche(),
      radar: radar,
      protecao: ler("window.xgProtecao ? xgProtecao.ler() : null"),
      /* HSI e altura do OSD (app novo); app antigo ignora */
      sens: sens ? { chao: !!sens.chao, motores: !!sens.motores, altRadar: sens.altRadar, vx: sens.vx, vz: sens.vz, vy: sens.vy } : null,
      rd: sens && sens.rd ? Array.prototype.slice.call(sens.rd) : null,
      cob: cob,
      alerta: extra.alerta || null,
      nivel: extra.terrenoNivel || null,
      /* de qual nivel e o mapa: o controle guarda os mapas e so baixa o que
         ainda nao tem */
      mk: extra.chaveMapa || null,
      /* modo espelho (app novo; app antigo ignora): c = pose da camera do
         drone [x,y,z,qx,qy,qz,qw], a MESMA do video (atualizarFpv + gimbal +
         rolagem), SEM o erro do GNSS; x = o que o controle precisa para a
         cena sair igual (ver poseEspelhoNoCampo) */
      c: extra.fpv || null,
      x: extra.esp || null,
      idioma: window.TPD_IDIOMAS ? window.TPD_IDIOMAS.atual() : "pt",
      t: Date.now(),
    };
  }

  /* --------------------------------------------- modo espelho (camera 3D)

     O controle desenha a camera do drone sozinho: carrega o mesmo campo 3D
     (treinamento/espelho.html, sem fisica) e so precisa da pose, 30x/s.
     Estas funcoes rodam DENTRO do campo (toString + eval), como os sensores.
     Instaladas uma vez; um campo recarregado instala de novo. */
  function poseFpvNoCampo() {
    if (typeof camFpv === "undefined" || typeof drone === "undefined" || !drone || typeof atualizarFpv !== "function") return null;
    /* a mesma conta do ganchoFpv (controle_real.js): atualizarFpv (com a
       rolagem do corpo, fisica.js) e o gimbal do T50 pelo lookAt */
    var p0 = camFpv.position.clone(), q0 = camFpv.quaternion.clone(), u0 = camFpv.up.clone();
    atualizarFpv();
    if (typeof window.xgGimbal === "number") {
      var c = camFpv.position, a = window.xgGimbal * Math.PI / 180;
      var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);
      // No nadir, o topo da imagem acompanha o rumo: o up mundial seria
      // paralelo ao olhar e faria o lookAt escolher um eixo arbitrario.
      camFpv.up.set(-fx * Math.sin(a), Math.cos(a), -fz * Math.sin(a));
      camFpv.lookAt(c.x + fx * Math.cos(a) * 10, c.y + Math.sin(a) * 10, c.z + fz * Math.cos(a) * 10);
    }
    var P3 = function (v) { return Math.round(v * 1000) / 1000; }, Q5 = function (v) { return Math.round(v * 100000) / 100000; };
    var r = [P3(camFpv.position.x), P3(camFpv.position.y), P3(camFpv.position.z),
      Q5(camFpv.quaternion.x), Q5(camFpv.quaternion.y), Q5(camFpv.quaternion.z), Q5(camFpv.quaternion.w)];
    camFpv.position.copy(p0); camFpv.quaternion.copy(q0); camFpv.up.copy(u0);
    return r;
  }

  function poseEspelhoNoCampo() {
    if (typeof drone === "undefined" || !drone || typeof inclina === "undefined" || !inclina.children.length) return null;
    var d = drone.position, q = inclina.quaternion, X = window.xgPulv, pm = window.xgPulvManual;
    var R = function (v, n) { var k = Math.pow(10, n); return Math.round(v * k) / k; };
    var o = typeof grupoOperador !== "undefined" && grupoOperador ? grupoOperador : null;
    var lf = 0;
    try { lf = larguraEfetiva(); } catch (e) { lf = 0; }
    return {
      /* corpo: pes do drone (posicao verdadeira), guinada e inclinacao (no tombo, o giro inteiro) */
      hl: !!(window.__xgHolofote && window.__xgHolofote.ligado),
      p: [R(d.x, 3), R(d.y, 3), R(d.z, 3)], ry: R(drone.rotation.y, 4),
      q: [R(q.x, 4), R(q.y, 4), R(q.z, 4), R(q.w, 4)],
      /* hélices girando: a mesma conta do quadro() do campo */
      h: V.rodando && ["reabastecendo", "concluído", "em solo"].indexOf(V.estado) < 0 && !(V.estado === "caiu" && V.noChao) ? 1 : 0,
      /* calda: pintando agora, largura efetiva, passe (rota: V.i; manual: o do
         botao), gota, deriva (m) e vento sorteado: faixa e nevoa saem iguais */
      ap: !P.xgMapeamento && V.aplicando && !window.__xgSemPintar ? 1 : 0,
      lf: R(lf, 2), ps: V.estado === "manual" && pm ? pm.passe : V.i,
      g: typeof P !== "undefined" ? P.gota : null,
      fl: !P.xgMapeamento && (V.aplicando || (pm && pm.esgotar)) ? R(V.vazaoAtual || 0, 4) : 0,
      pausa: !!(window.PAUSA_SIM && window.PAUSA_SIM.pausado),
      v: R(V.v || 0, 3), dose: P.vazao,
      vxz: V.estado === "manual" ? [R(V.mvx || 0, 3), R(V.mvz || 0, 3)] :
        [R((V.v || 0) * (V.dirx || 0), 3), R((V.v || 0) * (V.dirz || 0), 3)],
      pf: X && X.perfil ? X.perfil : null,
      cl: X && X.vento ? [X.vento.temperatura, X.vento.umidade] : null,
      dr: X && X.deriva ? R(X.deriva(), 3) : 0,
      vt: X && X.vento ? [R(X.vento.vel, 3), R(X.vento.dir, 4), R(X.vento.rajada || X.vento.vel, 3)] : null,
      /* a cobertura foi zerada (talhao novo, voo reiniciado): o controle zera tambem */
      cg: window.__xgCobGer || 0,
      /* operador: onde esta, para onde olha e qual boneco */
      op: o ? [R(o.position.x, 2), R(o.position.y, 2), R(o.position.z, 2), R(o.rotation.y, 3)] : null,
      av: typeof avatarEscolhido !== "undefined" ? avatarEscolhido : null,
    };
  }

  function instalarEspelhoNoCampo(poseFpv, poseEspelho) {
    if (window.__xgPoseFpv) return true;
    window.__xgPoseFpv = poseFpv;
    window.__xgEspelhoPc = poseEspelho;
    /* cada vez que o campo zera a cobertura, a contagem sobe */
    if (typeof limparCobertura === "function") {
      var limpar = limparCobertura;
      limparCobertura = function () { window.__xgCobGer = (window.__xgCobGer || 0) + 1; return limpar.apply(this, arguments); };
    }
    return true;
  }

  var espelhoNoCampo = null;
  function prepararEspelho() {
    var p = ponte();
    if (!p || !p.janela) return;
    if (espelhoNoCampo === p.janela && p.janela.__xgPoseFpv) return;
    if (rodar("(" + instalarEspelhoNoCampo.toString() + ")(" + poseFpvNoCampo.toString() + "," + poseEspelhoNoCampo.toString() + ")") === true) {
      espelhoNoCampo = p.janela;
    }
  }

  /* O controle avisa que a camera 3D dele assumiu (cmd "fpv"): enquanto o
     aviso estiver valendo, o PC nao desenha nem codifica o video da camera
     (controle_real.js). O app repete o aviso a cada 2 s; se ele parar
     (app fechado, 3D caiu sem avisar), o video volta sozinho em 6 s. */
  function modoFpv(m) {
    window.__xgFpv3dAte = m && m.modo === "3d" ? Date.now() + 6000 : 0;
  }

  var cobGuardada = null, cobQuando = 0;

  /* a rota inteira muda pouco: só manda quando muda (o resto vai sempre) */
  var rotaEnviada = "", rotaQuando = 0;
  function enviarEstado() {
    /* vai pela ponte (WebSocket) e, se o WebRTC com o controle estiver aberto
       (controle_real.js), direto por ele */
    var wsOk = !!(ws && ws.readyState === 1 && ws.bufferedAmount <= 200000);
    var rtcOk = !!(window.__xgRtc && window.__xgRtc.aberto());
    if (!wsOk && !rtcOk) return;
    var est = juntarEstado();
    if (!est) return;
    var rotaTxt = JSON.stringify(est.rota);
    /* a rota inteira vai de novo a cada 5 s, mesmo igual: um controle que
       conectou depois (ou perdeu um pacote no Wi-Fi) nao fica sem ela */
    if (Date.now() - rotaQuando > 5000) { rotaEnviada = ""; rotaQuando = Date.now(); }
    if (rotaTxt === rotaEnviada) est.rota = "igual"; else rotaEnviada = rotaTxt;
    var txt = JSON.stringify({ t: "estado", e: est });
    if (txt === ultimoEstado) return;
    ultimoEstado = txt;
    if (rtcOk) window.__xgRtc.estado(txt);
    if (wsOk) { try { ws.send(txt); } catch (e) { /* proxima volta */ } }
  }

  /* ------------------------------------------------- foto do mapa do nível */

  function enviarFoto() {
    if (!ws || ws.readyState !== 1) return;
    var p = ponte();
    if (!p || !p.janela) return;
    var nivel = ler("(typeof cen!=='undefined' && cen ? (cen.id||cen.nome||'') : '') + '|' + (typeof P!=='undefined'?P.terreno:'')");
    if (nivel === fotoFeita) return;
    fotoFeita = nivel;
    fotoDoMapa(p).then(function (b) {
      if (!b || !ws || ws.readyState !== 1) { fotoFeita = null; return; }
      /* a ponte guarda cada mapa com o nome do nivel (e o APK leva todos) */
      ws.send(JSON.stringify({ t: "mapa-chave", k: String(nivel).split("|")[0] }));
      ws.send(new Blob([new Uint8Array([77, 65, 80, 65]), b]));
    });
  }

  /* A foto de fundo do mapa do controle, em JPEG (3072x1920, o dobro da area
     do mapa, com o campo no meio). E a cena vista de cima - e, no mapa real,
     o ORTOMOSAICO ORIGINAL por cima, encaixado onde ele esta no chao: na cena
     o relevo atravessa a foto aerea em alguns pontos e ela sai com furos. O
     cinza de "sem dado" do ortomosaico fica transparente (aparece a cena). */
  function fotoDoMapa(p) {
    p = p || ponte();
    if (!p || !p.janela) return Promise.resolve(null);
    // O mapa pode entrar antes de o navegador terminar de decodificar a foto.
    if (p.janela.eval("(function(){var m=mundo.getObjectByName('fotoDoMapaReal');var i=m&&m.material.map.image;return !!m&&(!i||!i.complete||!i.naturalWidth);})()")) return Promise.resolve(null);
    var L = 3072, A = 1920, LM = 2 * 1920 * ESCALA, AM = 2 * 1200 * ESCALA;
    var foto = p.fotografarDeCima({ larguraM: LM, alturaM: AM, px: L });
    if (!foto || !foto.imagem) return Promise.resolve(null);
    var orto = null, centro = null;
    try {
      centro = p.janela.eval("({x: TALHAO.x0 + TALHAO.larg/2, z: TALHAO.z0 + TALHAO.prof/2})");
      orto = p.janela.eval("(function(){ var m = mundo.getObjectByName('fotoDoMapaReal');" +
        " if (!m || !m.material || !m.material.map || !m.material.map.image) return null;" +
        " m.geometry.computeBoundingBox(); var b = m.geometry.boundingBox;" +
        " return { img: m.material.map.image, x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z }; })()");
    } catch (e) { orto = null; }
    return new Promise(function (pronto) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = L; c.height = A;
        var g = c.getContext("2d");
        g.drawImage(img, 0, 0, L, A);
        if (orto && centro) colarOrto(g, orto, centro, L / LM, A / AM, L, A);
        c.toBlob(pronto, "image/jpeg", 0.85);
      };
      img.onerror = function () { pronto(null); };
      img.src = foto.imagem;
    });
  }

  /* Mapa HD do mapeamento (07/10/2026, pedido do Eduardo): as fotos a 30 m mostram a
     lavoura bem mais nítida que a foto de fundo do mapa; depois de processar, a área
     fotografada aparece nessa qualidade (só onde houve foto - o app recorta pelas
     capturas). É a cena vista de cima, só na caixa das capturas, com 1024 px (Médio)
     ou 2048 px (Alta) no lado maior; no mapa real, o ortomosaico original por cima. */
  var mapasHD = {};          // id da missão -> { id, mk, x0, z0, x1, z1, url, blob }
  function caixaDasCapturas(capturas) {
    var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    capturas.forEach(function (c) {
      x0 = Math.min(x0, c.x - c.largura / 2); x1 = Math.max(x1, c.x + c.largura / 2);
      z0 = Math.min(z0, c.z - c.altura / 2); z1 = Math.max(z1, c.z + c.altura / 2);
    });
    return { x0: x0, z0: z0, x1: x1, z1: z1 };
  }
  /* Tamanho da imagem HD pela área, não fixo (07/10, 3a rodada): com 1024 px fixos, uma
     área de 300 m saía com os mesmos ~29 cm/pixel do fundo do mapa e só mudava a cor.
     Médio ~8 cm/pixel (o ortomosaico dos mapas reais tem 8,4), Alta ~4 cm/pixel, com teto
     no lado maior. A cena é fotografada em pedaços de até 2048 px: o alvo do render é
     FloatType (16 bytes por pixel) e uma foto só de 6000 px não cabe na memória. */
  function fotoHD(caixa, alta) {
    var p = ponte();
    if (!p || !p.janela) return Promise.resolve(null);
    var LM = Math.max(1, caixa.x1 - caixa.x0), AM = Math.max(1, caixa.z1 - caixa.z0);
    var MAX = alta ? 6144 : 4096, ppm = Math.min(alta ? 24 : 12, MAX / Math.max(LM, AM));
    var L = Math.max(1, Math.round(LM * ppm)), A = Math.max(1, Math.round(AM * ppm));
    var ex = L / LM, ey = A / AM, PEDACO = 2048;
    var cx = (caixa.x0 + caixa.x1) / 2, cz = (caixa.z0 + caixa.z1) / 2;
    var orto = null;
    try {
      orto = p.janela.eval("(function(){ var m = mundo.getObjectByName('fotoDoMapaReal');" +
        " if (!m || !m.material || !m.material.map || !m.material.map.image) return null;" +
        " m.geometry.computeBoundingBox(); var b = m.geometry.boundingBox;" +
        " return { img: m.material.map.image, x0: b.min.x, z0: b.min.z, x1: b.max.x, z1: b.max.z }; })()");
    } catch (e) { orto = null; }
    var c = document.createElement("canvas");
    c.width = L; c.height = A;
    var g = c.getContext("2d");
    var pedacos = [];
    for (var oy = 0; oy < A; oy += PEDACO) for (var ox = 0; ox < L; ox += PEDACO) pedacos.push([ox, oy]);
    function pedaco(i) {
      if (i >= pedacos.length) return Promise.resolve(true);
      var ox = pedacos[i][0], oy = pedacos[i][1], w = Math.min(PEDACO, L - ox), h = Math.min(PEDACO, A - oy);
      var foto = p.fotografarDeCima({ larguraM: w / ex, alturaM: h / ey, px: w,
        cx: caixa.x0 + (ox + w / 2) / ex, cz: caixa.z0 + (oy + h / 2) / ey });
      if (!foto || !foto.imagem) return Promise.resolve(false);
      return new Promise(function (pronto) {
        var img = new Image();
        img.onload = function () { g.drawImage(img, ox, oy, w, h); pronto(true); };
        img.onerror = function () { pronto(false); };
        img.src = foto.imagem;
      }).then(function (ok) {
        /* folga entre um pedaço e outro: o voo de volta não engasga */
        return ok ? new Promise(function (r) { setTimeout(function () { r(pedaco(i + 1)); }, 30); }) : false;
      });
    }
    return pedaco(0).then(function (ok) {
      if (!ok) return null;
      if (orto) colarOrto(g, orto, { x: cx, z: cz }, ex, ey, L, A);
      return new Promise(function (pronto) { c.toBlob(pronto, "image/jpeg", 0.9); });
    });
  }
  /* quando o drone pousa e começa a reconstrução, a imagem HD é feita uma vez por missão */
  var fazendoHD = null;
  setInterval(function () {
    var m = ler("window.xgMapeamento ? xgMapeamento.estado() : null");
    /* assim que as fotos terminam (ainda voltando para a base) - pedido do Eduardo */
    if (!m || !(m.completa || ["reconstruindo", "concluido"].indexOf(m.estado) >= 0) || !m.capturas || !m.capturas.length) return;
    if (mapasHD[m.id] || fazendoHD === m.id) return;
    var mk = ler("typeof cen!=='undefined' && cen ? (cen.id||cen.nome||'') : ''") || null;
    var caixa = caixaDasCapturas(m.capturas);
    if (!isFinite(caixa.x0) || !isFinite(caixa.z0)) return;
    fazendoHD = m.id;
    fotoHD(caixa, m.res === "Alta").then(function (blob) {
      fazendoHD = null;
      if (!blob) return;
      mapasHD[m.id] = Object.assign({ id: m.id, mk: mk, blob: blob, url: URL.createObjectURL(blob) }, caixa);
    }, function () { fazendoHD = null; });
  }, 1000);

  /* Máscara do ortomosaico feita uma vez, no tamanho original da foto, e guardada (3a
     rodada do mapa HD): antes era refeita no tamanho de cada imagem, e na HD isso seria
     uma foto de milhares de pixels varrida a cada missão. "Sem dado" = o cinza que vem
     da BORDA da foto (a cor do canto, com folga para o ruido do JPEG): fica transparente
     e ali aparece a grama da cena. Preenche a partir das bordas: um telhado cinza no
     meio nao vira buraco. */
  var ortosMascarados = typeof WeakMap === "function" ? new WeakMap() : null;
  function ortoMascarado(img) {
    var feito = ortosMascarados && ortosMascarados.get(img);
    if (feito) return feito;
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    var t = document.createElement("canvas");
    t.width = w; t.height = h;
    var tg = t.getContext("2d");
    tg.drawImage(img, 0, 0, w, h);
    var d = tg.getImageData(0, 0, w, h), px = d.data;
    var nr = px[0], ng = px[1], nb = px[2], TOL = 30;
    var vazio = function (k) {
      var i = k * 4;
      return Math.abs(px[i] - nr) < TOL && Math.abs(px[i + 1] - ng) < TOL && Math.abs(px[i + 2] - nb) < TOL;
    };
    var visto = new Uint8Array(w * h), fila = new Int32Array(w * h), ini = 0, fim = 0;
    var semear = function (k) { if (!visto[k] && vazio(k)) { visto[k] = 1; fila[fim++] = k; } };
    for (var xx = 0; xx < w; xx++) { semear(xx); semear((h - 1) * w + xx); }
    for (var yy = 0; yy < h; yy++) { semear(yy * w); semear(yy * w + w - 1); }
    while (ini < fim) {
      var k = fila[ini++], kx = k % w;
      px[k * 4 + 3] = 0;
      if (kx > 0) semear(k - 1);
      if (kx < w - 1) semear(k + 1);
      if (k >= w) semear(k - w);
      if (k < (h - 1) * w) semear(k + w);
    }
    tg.putImageData(d, 0, 0);
    if (ortosMascarados) ortosMascarados.set(img, t);
    return t;
  }
  function colarOrto(g, o, centro, ex, ey, L, A) {
    var x = Math.round(L / 2 + (o.x0 - centro.x) * ex), y = Math.round(A / 2 + (o.z0 - centro.z) * ey);
    var w = Math.round((o.x1 - o.x0) * ex), h = Math.round((o.z1 - o.z0) * ey);
    if (w < 2 || h < 2) return;
    var t = ortoMascarado(o.img);
    if (!t) return;
    /* por baixo, na cena 3D, a mesma area tambem tem o cinza: pinta de grama
       (um pedaco do canto da foto, repetido) antes de colar o ortomosaico */
    var grama = document.createElement("canvas");
    grama.width = grama.height = 256;
    grama.getContext("2d").drawImage(g.canvas, 24, 24, 256, 256, 0, 0, 256, 256);
    g.save();
    g.fillStyle = g.createPattern(grama, "repeat");
    g.fillRect(x, y, w, h);
    g.restore();
    g.save();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(t, x, y, w, h);
    g.restore();
  }

  /* ---------------------------------------------------------- comandos */

  function noChao() {
    return ler("typeof V==='undefined' || V.estado==='em solo' || V.estado==='concluído'") === true;
  }

  var retomarDe = null;      // ponto da tarefa "Em andamento" para o próximo Iniciar
  function executar(m) {
    if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
    if (ler("window.xgBateria && xgBateria.corte")) return;
    var manual = xg() && xg().manual && xg().manual();
    if (manual && manual.demarcando() === "Controlador" &&
        ["iniciar", "holofote", "pausar", "retomar", "rth", "encerrar", "fluxoM", "subir", "modo", "origem", "badeco"].indexOf(m.c) >= 0) return;
    var o = op();
    switch (m.c) {
      case "demarcacao":
        window.__xgDemarcacao = {
          metodo: ["Retículo", "Controlador", "Aeronave"].indexOf(m.metodo) >= 0 ? m.metodo : null,
          em: Date.now()
        };
        return;
      case "talhao": {
        /* {lim:[[x,z]...], obs:[[[x,z]...]], circ:[{c:[x,z], r}], esp, ang, seg:[a,b], cob, sentido,
            geo:{v, laco, folgaLig, folgaObs, sem:[[[x,z]...]], con:[[x,z]...], chave} (novo, opcional)} */
        // A gravação 17:16 mostra "Use" ainda em voo manual. Nunca apagar
        // posição, carga ou bateria ao preparar a tarefa no ar.
        if (!Array.isArray(m.lim) || m.lim.length < 3 || m.lim.some(function(p){return !Array.isArray(p) || p.length!==2 || !p.every(Number.isFinite);})) return;
        var emManual = ler("V.estado==='manual' && !V.retomar") === true;
        if (!noChao() && !emManual) return;
        var mapaAereo = !!(m.geo && Array.isArray(m.geo.map));
        if (mapaAereo && !mapeamentoAutorizado) { recusarMapeamento(); return; }
        if (mapaAereo && (!ler("P.xgRtk===true") || m.geo.map.length < 2 || m.geo.map.some(function(p){return !Array.isArray(p) || p.length<2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]);}))) return;
        if (mapaAereo) {
          if (!rodar("(" + instalarMapeamentoNoCampo.toString() + ")()")) return;
          if (!rodar("xgMapeamento.preparar(" + JSON.stringify(m.geo.mapeamento || {}) + "," + JSON.stringify(m.geo.map) + ")")) return;
        }
        var partes = ["P.xgMapeamento=" + mapaAereo];
        if (mapaAereo) partes.push("P.xgPulverizar=false; if(window.xgPulvManual){xgPulvManual.ligado=false;xgPulvManual.esgotar=false;}");
        if (typeof m.esp === "number" && isFinite(m.esp)) partes.push("P.faixa=" + Math.max(1.6, Math.min(59.03, m.esp)));
        partes.push("P.xgAngulo=" + (typeof m.ang === "number" ? m.ang : "undefined"));
        partes.push("P.xgSeg=" + JSON.stringify(m.seg || [0, 100]));
        partes.push("P.xgCobertura=" + JSON.stringify(m.cob || "Somente rota"));
        partes.push("P.xgSentido=" + JSON.stringify(m.sentido === "anti" ? "anti" : "horario"));
        /* geometria nova (app novo): margem, laco, folgas, areas sem aplicacao,
           pontos de conexao e a chave do limite. App antigo: null (caminho antigo) */
        partes.push("P.xgGeo=" + JSON.stringify(m.geo && typeof m.geo === "object" ? m.geo : null));
        rodar(partes.join(";"));
        rodar("window.__xgRotaApp = " + rotaDoAppNoJogo.toString());
        var obst = (m.obs || []).map(function (pts) { return { tipo: "poligono", pts: pts }; })
          .concat((m.circ || []).map(function (c) { return { tipo: "circulo", c: c.c, r: c.r }; }));
        ponte().definirMapa(m.lim, obst);
        if (emManual) rodar("gerarRota(); V.i=0; V.aplicando=false; V.xgTarefaPreparada=true;");
        else rodar("reiniciarVoo(); V.xgTarefaPreparada=true;");
        retomarDe = null;           // "Use" pela aba Tarefa: começa do zero
        if (ponte().prepararCobertura) ponte().prepararCobertura();
        return;
      }
      case "iniciar": {
        if (!mapeamentoAutorizado && ler("!!P.xgMapeamento")) { recusarMapeamento(); return; }
        if (ler("P.xgMapeamento && !P.xgRtk")) { rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:'recusa:rtk'}"); return; }
        if (ler("P.xgMapeamento && !(Number.isFinite(V.tan) && V.tan <= 0)")) { rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:'recusa:tanque-mapeamento'}"); return; }
        if (ler("V.estado==='manual' && V.xgTarefaPreparada && rota.length>1")) {
          rodar("V.retomar={p:rota[0].p.slice(),i:1}; V.estado='subindo'; V.rodando=true; V.xgFreio=false; V.xgTarefaPreparada=false; fecharAlerta();");
          return;
        }
        if (ler("window.xgProtecao && xgProtecao.bloqueioDecolagem()")) {
          rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:\"recusa:pessoa-perto\"}");
          return;
        }
        if (ler("V.estado") === "reabastecendo") {
          /* sai com o que o badeco deixou (Encher tanque / Trocar bateria): nada enche sozinho */
          rodar("V.recargas++; V.espera=0; V.estado='subindo'; V.rodando=true;");
          return;
        }
        var r = ponte().iniciarOperacao();
        if (r && r.ok) rodar("V.xgTarefaPreparada=false;");
        /* 12/11/2026 (Eduardo: "tem que separar nova operacao de operacao em andamento"): o andamento do campo guarda o progresso
           pela FORMA da rota, nao pela tarefa; uma tarefa nova no mesmo talhao ia para onde a antiga parou. So retoma quando o app
           abriu a tarefa pela aba "Em andamento" (retomarDe); tarefa nova apaga o progresso velho e comeca do zero. */
        if (r && r.ok && o && o.andamento) {
          o.andamento.novaOperacao();
          if (retomarDe) o.andamento.retomar();
          else { o.andamento.antes = null; o.andamento.gravar(null); rodar("V.retomar=null;"); }
        }
        /* tarefa da aba "Em andamento": decola e vai direto ao último ponto */
        if (r && r.ok && retomarDe) {
          rodar("(function(){var a=" + JSON.stringify(retomarDe) + ", g=" + GS_JOGO + ";" +
            "if(typeof rota==='undefined' || rota.length<2 || !(a.i<rota.length)) return;" +
            "V.retomar={p:[a.p[0]+g[0],a.p[1]+g[1]], i:Math.max(0,a.i|0)};})()");
          retomarDe = null;
        }
        /* recusou (já voando pelo CSC, sem rota, pessoa perto): o app mostra o cartão */
        if (r && !r.ok) rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:" + JSON.stringify("recusa:" + (r.motivo || "")) + "}");
        return;
      }
      case "holofote":
        /* L2 (Interruptor de holofote): os 4 LEDs da frente do T50 e a luz
           que eles jogam a frente. Os LEDs sao montados uma vez, na frente
           da fuselagem medida no proprio modelo. */
        if (window.HOLOFOTE) {
          window.HOLOFOTE.instalar(ponte());
          rodar("window.xgHolofote(" + (m.v ? "true" : "false") + ")");
        }
        return;
      case "retomarDe":
        /* {i, p:[x, z]}: o app reabriu uma tarefa "Em andamento"; vale no próximo Iniciar */
        retomarDe = m.p && m.p.length === 2 ? { i: Number(m.i) || 0, p: [Number(m.p[0]), Number(m.p[1])] } : null;
        return;
      case "pausar":
        /* Freio de emergência (voo automático, retomada, RTH e pouso): a
           aeronave freia forte até parar (V.xgFreio, manual.js) e paira no
           manual. O ponto de interrupção segue a regra única (manual.js,
           xgGravarInterrupcao): não troca na subida nem no translado. */
        rodar("if(['aplicando','indo','voltando','subindo','descendo','pairando','pousando'].includes(V.estado)){" +
          "if(typeof xgGravarInterrupcao==='function')xgGravarInterrupcao();" +
          "else V.retomar=(V.estado==='aplicando'||!V.retomar)?pontoAtual():V.retomar;" +
          "V.estado='manual'; V.rodando=true; V.xgFreio=true;" +
          "V.aplicando=false; V.mvx=V.v*(V.dirx||0); V.mvz=V.v*(V.dirz||0); V.xgAx=0; V.xgAz=0; V.xgIx=0; V.xgIz=0;" +
          "delete V.xgAgl; fecharAlerta();}");
        return;
      case "retomar": {
        if (!mapeamentoAutorizado && ler("!!P.xgMapeamento")) { recusarMapeamento(); return; }
        if (ler("P.xgMapeamento && !P.xgRtk")) return;
        if (ler("P.xgMapeamento && !(Number.isFinite(V.tan) && V.tan <= 0)")) { rodar("window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:'recusa:tanque-mapeamento'}"); return; }
        rodar("if(V.estado==='pairando' && !V.retomar && typeof xgGravarInterrupcao==='function') xgGravarInterrupcao();");
        // Pairando por tanque vazio também é uma pausa; no chão, conservar
        // a interrupção em vez de reiniciar a operação e perder o progresso.
        if (ler("V.retomar && ['pairando','reabastecendo','em solo','concluído'].includes(V.estado)")) {
          if (ler("window.xgProtecao && xgProtecao.bloqueioDecolagem()")) return;
          rodar("V.estado='subindo'; V.rodando=true; V.xgFreio=false; fecharAlerta();");
          return;
        }
        /* {alvo: 'c' | '1' | '2' | 'conexao' | 'inicio'} (app novo); sem alvo,
           volta ao ponto de interrupção como antes */
        var alvo = m.alvo == null ? "c" : String(m.alvo);
        if (alvo === "1" || alvo === "2") {
          /* ponto de retorno 1/2: recalculado agora, com o drone onde está */
          var s = ler("({est: V.estado, ret: (V.retomar && V.retomar.p ? {i: V.retomar.i, p: [V.retomar.p[0], V.retomar.p[1]]} : null)," +
            " dp: [drone.position.x, drone.position.z], vi: V.i, gs: " + GS_JOGO + "})");
          var rc = ponte() && ponte().rotaDoCampo ? ponte().rotaDoCampo() : null;
          var pr = s && s.est === "manual" && s.ret && rc ? pontosRetorno(rc.rota, naRota(s.ret, s.gs), naRota(s.dp, s.gs), true, s.vi) : null;
          var e = pr && !pr.ida ? (alvo === "1" ? pr.e1 : pr.e2) : null;
          if (e) {
            /* vai reta até o ponto (desvio lateral do jogo, sem pulverizar) e
               segue a rota dali pulverizando; o trecho C -> ponto fica sem
               produto e o app o desenha em branco (V.pulos) */
            /* pulos na rota (o app desenha junto com ela); o alvo de voo, com o deslocamento */
            rodar("(function(){var C=" + JSON.stringify(naRota(s.ret, s.gs)) + ", e=" + JSON.stringify(e) +
              ", a=" + JSON.stringify(comRota(e.p, s.gs)) + ";" +
              "V.pulos=V.pulos||[]; V.pulos.push({de:{i:C.i,p:C.p},ate:{i:e.i,p:e.p}});" +
              "V.i=e.i; V.xgVolta=[a[0],a[1]]; V.desvioLat={pontos:[[a[0],a[1]]],obs:null,p:[a[0],a[1]]};" +
              "V.retomar=null; V.desce=false; V.freando=false; V.sonda=null; V.aguardaSubida=false; V.xgFreio=false;" +
              "V.v=Math.hypot(V.mvx||0,V.mvz||0); V.estado='aplicando'; V.rodando=true; fecharAlerta();})()");
            return;
          }
        }
        /* "Ponto inicial" na ida: o começo da primeira passada (sem os pontos de conexão) */
        if (alvo === "inicio") {
          rodar("if(V.estado==='manual' && V.retomar && rota.length){var k=0; while(k<rota.length-1 && rota[k].con) k++;" +
            "V.retomar={p:[rota[k].p[0],rota[k].p[1]], i:k+1};}");
        }
        rodar("if(V.estado==='manual' && V.retomar){V.estado='subindo'; V.rodando=true; V.xgFreio=false;} " +
          "else if(!V.rodando && V.estado!=='em solo' && V.estado!=='concluído'){V.rodando=true;}");
        return;
      }
      case "rth":
        /* só com a aeronave no ar (Fase 0, 0.5): caída, no chão, abastecendo
           ou já voltando/pousando, nada acontece */
        rodar("(function(){var st=V.estado;" +
          "if(['caiu','em solo','concluído','reabastecendo','voltando','pousando'].indexOf(st)>=0) return;" +
          "if(drone.position.y - alt(drone.position.x, drone.position.z) < 0.3) return;" +
          "if(typeof xgGravarInterrupcao==='function') xgGravarInterrupcao();" +
          "else if(['aplicando','pairando','descendo','manual','indo'].includes(st)) V.retomar=pontoAtual();" +
          "V.xgFreio=false; iniciarRetorno(V.retomar); V.rodando=true; fecharAlerta();})()");
        return;
      case "encerrar":
        rodar("if(window.xgMapeamento && P.xgMapeamento)xgMapeamento.cancelar('encerrado');");
        rodar("(function(){var st=V.estado;" +
          "if(st==='caiu' || st==='em solo' || st==='concluído') return;" +
          /* abastecendo: a tarefa termina no chão, sem decolar */
          "if(st==='reabastecendo'){V.retomar=null; V.estado='concluído'; V.rodando=false; if(typeof mostrarFim==='function') mostrarFim(); return;}" +
          /* manual com os motores girando no chão: só tira a tarefa */
          "if(st==='manual' && drone.position.y - alt(drone.position.x, drone.position.z) < 0.05){V.retomar=null; return;}" +
          "V.retomar=null; V.xgFreio=false; V.xgVolta=null; iniciarRetorno(null); V.rodando=true; fecharAlerta();})()");
        return;
      case "mapConfirmar":
        if (!mapeamentoAutorizado) { recusarMapeamento(); return; }
        rodar("if(window.xgMapeamento)xgMapeamento.confirmar(" + JSON.stringify(m.id) + ");");
        return;
      case "mapDescartar":
        if (!mapeamentoAutorizado) { recusarMapeamento(); return; }
        rodar("if(window.xgMapeamento)xgMapeamento.descartar(" + JSON.stringify(m.id) + ");");
        return;
      case "fluxoM": {
        /* o Fluxo do painel M = o fluxo da roda esquerda (L/min, 1 a 16) */
        var nv = Number(m.v);
        if (!(nv > 0)) return;
        rodar("(function(){var p=window.xgPulvManual||(window.xgPulvManual={ligado:false,fluxo:10,passe:50000});" +
          "p.fluxo=Math.max(1,Math.min(16," + nv + "));})()");
        return;
      }
      case "pulvManual": {
        /* "Iniciar" do M / M+ no app (24/10/2026): liga a pulverizacao do voo manual, como o botao do RC Plus. No ar liga na hora
           (e o app mostra "Habilitar pulverizacao"); no chao fica ARMADA e a bomba liga quando a aeronave sai do solo (manual.js).
           {v:false} (Encerrar) desliga e desarma. Mapeamento, sistemas desligados nas configuracoes e tanque vazio nao ligam. */
        /* {mmais:true} (aba M+): alem da bomba, a aeronave mantem a altura configurada e o fluxo acompanha a velocidade (manual.js) */
        rodar("(function(){var p=window.xgPulvManual||(window.xgPulvManual={ligado:false,fluxo:10,passe:50000}),r=null;" +
          "if(!" + (m.v ? "true" : "false") + "){p.ligado=false;p.armada=false;p.mmais=false;return;}" +
          "p.mmais=" + (m.mmais ? "true" : "false") + ";" +
          "if(P.xgMapeamento)r='mapeamento';else if(P.xgPulverizar===false)r='desligado';else if(V.tan<=0)r='vazio';" +
          "else if(V.estado==='manual' && drone.position.y>alt(drone.position.x,drone.position.z)+0.05){p.esgotar=false;if(!p.ligado){p.ligado=true;p.passe++;}p.armada=false;r='ligou';}" +
          "else if(!(drone.position.y>alt(drone.position.x,drone.position.z)+0.05))p.armada=true;" +
          "if(r)window.__xgRecado={n:((window.__xgRecado||{}).n||0)+1,c:r};})()");
        return;
      }
      case "subir":
        rodar("subirSobreObstaculo(); fecharAlerta();");
        return;
      case "p": {
        if (!mapeamentoAutorizado && m.v && (m.v.xgMapeamento || (m.v.xgGeo && Array.isArray(m.v.xgGeo.map)))) { recusarMapeamento(); return; }
        /* ajustes: {v:{chave: valor}} -> P.chave = valor (estab e faixa só no chão) */
        var chao = noChao(), cmds = [];
        Object.keys(m.v || {}).forEach(function (k) {
          if (!/^[A-Za-z]+$/.test(k)) return;
          if ((k === "estab" || k === "faixa") && !chao) return;
          var valor = k === "faixa" ? Math.max(1.6, Math.min(59.03, Number(m.v[k]) || 1.6)) : m.v[k];
          cmds.push("P." + k + "=" + JSON.stringify(valor) + ";");
          if (k === "faixa") cmds.push("reiniciarVoo();");
          if (k === "gota") cmds.push("if(typeof desenharFaixas==='function')desenharFaixas();");
        });
        if (cmds.length) {
          rodar(cmds.join(""));
          rodar("if(P.xgMapeamento)P.xgPulverizar=false;");
          if (m.v && m.v.xgRtk === false && ler("P.xgMapeamento && ['subindo','indo','aplicando','descendo'].includes(V.estado)")) executar({c:"pausar"});
        }
        return;
      }
      case "modo": {
        /* modo do joystick: o manual.js lê do controle virtual */
        try { document.getElementById("controle").contentWindow.eval("modoJoystick=" + (Number(m.v) || 2)); } catch (e) { /* sem controle */ }
        return;
      }
      case "origem":
        rodar(m.v === "rc" && "grupoOperador" ? "if(typeof grupoOperador!=='undefined'&&grupoOperador){BASE.x=grupoOperador.position.x;BASE.z=grupoOperador.position.z;}"
          : "BASE.x=drone.position.x; BASE.z=drone.position.z;");
        return;
      case "badeco":
        /* A retirada prepara o mapeamento mesmo antes de usar a tarefa. */
        if (m.v === "esvaziar" && !mapeamentoAutorizado) { recusarMapeamento(); return; }
        if (m.v === "tanque" || m.v === "esvaziar" || m.v === "bateria" || m.v === "parar")
          rodar("window.xgEquipe && xgEquipe.pedir && xgEquipe.pedir(" + JSON.stringify(m.v) + ")");
        return;
      case "foto":
        fotoFeita = null;
        enviarFoto();
        return;
      case "fpv":
        /* {modo: '3d' | 'video'}: a camera 3D do controle assumiu ou caiu */
        modoFpv(m);
        return;
    }
  }

  /* 30 vezes por segundo (era 10: o drone andava aos pulos no mapa do controle).
     O relógio fica num Web Worker: com a janela do jogo escondida (o aluno
     olhando o RC Plus) o Chrome derruba o setInterval da página para 1 por
     segundo, mas não o do Worker. */
  var ultimaVolta = 0;
  function voltaDoEstado() {
    var agora = performance.now();
    if (agora - ultimaVolta < 95) return;   // 10x/s: 30x/s deixou o PC lento (02/10)
    ultimaVolta = agora;
    if (!real()) { if (ws) { try { ws.close(); } catch (e) { /* ja */ } } return; }
    conectar();
    enviarEstado();
  }
  try {
    var relogioEstado = new Worker(URL.createObjectURL(new Blob(["setInterval(function(){postMessage(0)},100)"], { type: "text/javascript" })));
    relogioEstado.onmessage = voltaDoEstado;
  } catch (e) { /* sem Worker: só o da página */ }
  setInterval(voltaDoEstado, 100);
  setInterval(function () { if (real()) enviarFoto(); }, 3000);

  window.APP_RCPLUS = {
    mapaHD: function (id) { return mapasHD[id] || null; }, executar: executar, estado: juntarEstado, fotoDoMapa: fotoDoMapa,
    autorizarMapeamento: autorizarMapeamento,
    mapeamentoDisponivel: function() { return mapeamentoAutorizado; },
    instalarMapeamento: function() { return mapeamentoAutorizado && rodar("(" + instalarMapeamentoNoCampo.toString() + ")()") === true; } };
})();
