/* ==========================================================================
   CAMIONETE DIRIGIVEL (fase 1, so administrador) - roda DENTRO do campo.

   24/10/2026 (Eduardo): na tela inicial, ao escolher o mapa, o aluno decide se
   o ponto de decolagem e AUTOMATICO (o que o mapa traz) ou se ELE leva a
   camionete com a carretinha, dirigindo pelo mapa. Depois de parar o carro, ele
   clica em "Escolher onde colocar o drone": aparece o circulo, que segue o
   mouse, e ele clica para confirmar. So vale a ate 20 m do veiculo (eram 10) e onde
   o chao do circulo e plano. Confirmar define o ponto de decolagem (BASE) e o
   acampamento inteiro (cadeiras, misturador, gerador, carregador, operador,
   auxiliar, drone) vai para la.

   Carregado no fim do campo/index.html (como o apoiadores.js), por isso enxerga
   as globais do jogo: BASE, colisores, acudes, alt, mundo, cam, drone, comecar...
   Nada do jogo e editado: o seletor entra na tela inicial por fora, a camera
   entra pelo gancho do orbitarInicio (o jogo ja o chama no laco enquanto a
   tela inicial esta ativa) e o resto e embrulho de funcao.

   Fisica: veiculo_fisica.js (testada no Node).

   Regras (Eduardo, 24/10/2026):
   - so administrador (ou localhost), como o "Andar a pe";
   - so a camera externa (a vista de dentro da cabine foi guardada em
     copias-de-seguranca/camionete-dirigivel-20261024/cabine-guardada);
   - o tempo da pessoa NAO conta enquanto a base nao esta montada: a tela
     inicial e pausada (PAUSA_SIM.emOperacao = false) ate o comecar() final;
   - pouca informacao na tela: uma linha de mensagem e dois botoes;
   - W/S acelera e da re, A/D volante, ESPACO freio de mao, T liga/desliga a
     re assistida, ENTER avanca (escolher o ponto / confirmar), BACKSPACE volta;
   - o carro comeca onde fica hoje no automatico (BASE + 10, +8);
   - agua, construcao, arvore, poste e o limite do mapa bloqueiam; lavoura passa.
   ========================================================================== */
(function () {
  "use strict";
  if (window.xgVeiculo) return;
  var F = window.XGVeiculoFisica;
  if (!F || typeof construirCenario !== "function" || typeof BASE === "undefined" || typeof colisores === "undefined" || typeof orbitarInicio !== "function") {
    console.warn("veiculo: campo ou fisica nao encontrados");
    return;
  }

  var RAIO_ESCOLHA = 20;        // o drone so pode ficar a ate 20 m do veiculo (da superficie da camionete ou da carretinha); eram 10 m, ele pediu a area verde maior (25/10/2026)
  var FOLGA_DECOLAGEM = 6.6;    // e a mais de 6 m: no jogo qualquer obstaculo a menos de 6 m do drone no chao bloqueia a decolagem (radar.js, bloqueioDecolagem); 0,6 m de margem
  var PLANO_MAX = 0.25;         // desnivel maximo (m) no circulo de 5,4 m: chao "reto"

  var ativo = false, modo = "automatico", fase = "dirigindo";
  var st = null;                            // estado da fisica; null = posicao padrao do cenario
  var baseOrig = { x: BASE.x, z: BASE.z };  // ponto de decolagem que o cenario traz
  var G = null, COL = null, rodasT = null;  // grupo, colisor e rodas da camionete do cenario
  var T = null, rodasCarreta = null;        // grupo da carretinha (equipe.js) e pivos das rodas
  var teclas = {}, cmd = { acel: 0, dir: 0, freio: false };
  var yawExt = 0, pitchExt = 0, distExt = 15, camRumo = null, olhaTras = false, tRe = 0, kEsc = 0, dedo = null;
  var suave = { y: null, pitch: 0, roll: 0, ty: null, tp: 0, tr: 0 };
  var incl = { caminhao: 0, carreta: 0 };
  var msg = { txt: "", tipo: "", ate: 0 };
  /* 25/10/2026: EN/ES das frases montadas com numero ou nome (as fixas estao em traducao_jogo.js) */
  function trR(pt, en, es) { return window.XG_TR ? window.XG_TR.reg(pt, en, es) : pt; }
  function trN(n, i) { return window.XG_TR ? window.XG_TR.nome(n, i) : n; }
  var pronto = { ok: false, msg: "" };           // fase "dirigindo": pode escolher o ponto?
  var cand = { x: 0, z: 0 }, aval = { ok: false, msg: "" }, mouse = { x: 0, y: 0, tem: false }, fixo = false;
  var tHud = 0, tAval = 0, erros = 0, anel = null, previa = null, anelRaio = null, hud = null, vistaAntes = null;
  var toque = { esq: false, dir: false, acel: false, re: false, freio: false }, pad = { ant: {}, vivo: false }, telaToque = null;

  var API = { versao: 8, ativo: false };

  /* ---------------------------------------------------------------- acesso */
  function liberado() {
    try {
      if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return true;
      var c = parent.CONTAS && parent.CONTAS.atual && parent.CONTAS.atual();
      return true;   /* 25/10/2026 (ordem dele): liberada para todos os alunos; antes so administrador (c.admin) */
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------- o que o jogo montou */
  function achar() {
    if (G && G.parent && COL) return true;
    G = null; COL = null; rodasT = null;
    for (var i = colisores.length - 1; i >= 0; i--) if (colisores[i].nome === "a camionete") { COL = colisores[i]; break; }
    if (!COL) return false;
    for (var k = 0; k < mundo.children.length; k++) {
      var o = mundo.children[k];
      if (o.isGroup && Math.abs(o.position.x - COL.x) < 1e-4 && Math.abs(o.position.z - COL.z) < 1e-4) { G = o; break; }
    }
    if (!G) { COL = null; return false; }
    G.rotation.order = "YZX";            // guinada, depois cabeceio, depois rolagem
    return true;
  }
  function acharAnel() {
    if (anel && anel.parent) return anel;
    anel = null;
    mundo.children.forEach(function (o) {
      if (!anel && o.isMesh && o.geometry && o.geometry.type === "RingGeometry" && o.geometry.parameters.innerRadius === 2.4) anel = o;
    });
    return anel;
  }
  /* as rodas da carretinha sao pecas soltas sem pivo: junta cada roda num grupo no centro do pneu */
  function prepararRodasDaCarreta(cenaGltf) {
    var nos = {}, pivos = [];
    cenaGltf.traverse(function (o) {
      var m = /^Roda_([12])_(esquerda|direita)_/.exec(o.name || "");
      if (m) (nos[m[1] + m[2]] = nos[m[1] + m[2]] || []).push(o);
    });
    cenaGltf.updateMatrixWorld(true);
    Object.keys(nos).forEach(function (k) {
      var pneu = nos[k].filter(function (o) { return /_pneu$/.test(o.name); })[0];
      if (!pneu) return;
      var c = new THREE.Box3().setFromObject(pneu).getCenter(new THREE.Vector3());
      cenaGltf.worldToLocal(c);
      var p = new THREE.Group(); p.name = "xgRoda_" + k; p.position.copy(c);
      cenaGltf.add(p); p.updateMatrixWorld(true);
      nos[k].forEach(function (o) { p.attach(o); });
      pivos.push(p);
    });
    return pivos;
  }
  function acharCarreta() {
    var eq = window.xgEquipe && window.xgEquipe.equip;
    if (!eq || !eq.carretinha) { T = null; return false; }
    if (T === eq.carretinha) return true;
    T = eq.carretinha;
    T.rotation.order = "YXZ";
    try { rodasCarreta = prepararRodasDaCarreta(T.children[0]); } catch (e) { rodasCarreta = []; console.warn("veiculo: rodas da carretinha", e); }
    return true;
  }

  /* ------------------------------------------------------------ mundo / limites */
  function limites() {
    var r = cen && cen.real && cen.real.area;
    if (r) return { x0: r.x0 + 5, x1: r.x0 + r.larg - 5, z0: r.z0 + 5, z1: r.z0 + r.prof - 5 };
    return { x0: -580, x1: 580, z0: -640, z1: 430 };
  }
  /* nao contam: a propria camionete, o fio (passa por cima) e o auxiliar (some enquanto se dirige) */
  function ignorado(c) { return c === COL || c.tipo === "seg" || /badeco|auxiliar/i.test(c.nome || ""); }
  /* nome do que a caixa encosta, ou null */
  function obstaculo(cx) {
    var caixas = [cx.caminhao];
    if (T) caixas.push(cx.carreta);
    var lim = limites(), i, j, c, b;
    for (i = 0; i < caixas.length; i++) {
      b = caixas[i];
      var pts = F.pontosDe(b);
      for (j = 0; j < pts.length; j++) {
        if (pts[j][0] < lim.x0 || pts[j][0] > lim.x1 || pts[j][1] < lim.z0 || pts[j][1] > lim.z1) return "o limite do mapa";
        for (var a = 0; a < acudes.length; a++) if (Math.hypot(pts[j][0] - acudes[a].x, pts[j][1] - acudes[a].z) < acudes[a].r - 0.6) return "a água";
      }
      for (j = 0; j < colisores.length; j++) {
        c = colisores[j];
        if (ignorado(c)) continue;
        if (Math.hypot(c.cx - b.x, c.cz - b.z) > c.raio + b.meiaL + 1) continue;
        var chao = alt(c.cx, c.cz);
        if (c.tipo === "cil") {
          var r;
          if (c.tronco !== undefined) {
            /* arbusto (mato baixo): a moita toda bloqueia, nao so o talo; arvore: o tronco */
            r = (c.y1 - chao) < 3.3 ? Math.max(c.tronco + 0.2, c.r * 0.6) : c.tronco + 0.2;
          } else r = c.y0 - chao < 2.2 ? c.r : -1;
          if (r > 0 && F.caixaComCirculo(b, c.x, c.z, r)) return c.nome || "um obstáculo";
        } else if (c.tipo === "caixa") {
          if (c.y0 !== undefined && c.y0 - chao > 2.2) continue;
          if (F.caixaComCaixa(b, { x: c.x, z: c.z, psi: c.rot || 0, meiaL: c.sx / 2, meiaW: c.sz / 2 })) return c.nome || "um obstáculo";
        }
      }
    }
    return null;
  }

  /* ---------------------------------------- onde pode ficar o drone (a base) */
  /* distancia de um ponto ate a caixa orientada (negativa por dentro) */
  function distCaixa(b, x, z) {
    var dx = x - b.x, dz = z - b.z, c = Math.cos(b.psi), s = Math.sin(b.psi);
    var lx = Math.abs(dx * c + dz * s) - b.meiaL, lz = Math.abs(-dx * s + dz * c) - b.meiaW;
    return Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
  }
  /* a mesma disposicao do automatico: 10 m atras da origem da camionete e 8 m ao lado, do lado do talhao
     (so serve de ponto inicial do circulo antes de o mouse se mexer) */
  function candidatasDeBase() {
    var o = F.origem(st), fx = Math.cos(st.psi), fz = Math.sin(st.psi), nx = -fz, nz = fx;
    var tx = TALHAO.x0 + TALHAO.larg / 2, tz = TALHAO.z0 + TALHAO.prof / 2;
    var esq = { x: o.x - 10 * fx - 8 * nx, z: o.z - 10 * fz - 8 * nz }, dir = { x: o.x - 10 * fx + 8 * nx, z: o.z - 10 * fz + 8 * nz };
    var de = Math.hypot(esq.x - tx, esq.z - tz), dd = Math.hypot(dir.x - tx, dir.z - tz);
    return de <= dd ? [esq, dir] : [dir, esq];
  }
  /* texto do que atrapalha o circulo, ou null se esta livre */
  function baseLivre(x, z) {
    var lim = limites();
    if (x < lim.x0 + 3 || x > lim.x1 - 3 || z < lim.z0 + 3 || z > lim.z1 - 3) return "O círculo ficou fora da área do mapa.";
    for (var a = 0; a < acudes.length; a++) if (Math.hypot(x - acudes[a].x, z - acudes[a].z) < acudes[a].r + 3) return "Perto demais da água.";
    for (var j = 0; j < colisores.length; j++) {
      var c = colisores[j];
      if (ignorado(c)) continue;
      if (Math.hypot(c.cx - x, c.cz - z) > c.raio + 6) continue;
      var chao = alt(c.cx, c.cz);
      if (c.tipo === "cil") {
        if (c.y0 - chao < 10 && Math.hypot(c.x - x, c.z - z) < c.r + 2.7) return "Tem obstáculo dentro do círculo.";
      } else if (c.tipo === "caixa") {
        if (F.caixaComCirculo({ x: c.x, z: c.z, psi: c.rot || 0, meiaL: c.sx / 2, meiaW: c.sz / 2 }, x, z, 2.7)) return "Tem obstáculo dentro do círculo.";
      }
    }
    return null;
  }
  /* maior diferenca de altura dentro do circulo (centro, meio e borda) */
  function desnivel(x, z) {
    var mn = 1e9, mx = -1e9;
    function p(px, pz) { var h = alt(px, pz); if (h < mn) mn = h; if (h > mx) mx = h; }
    p(x, z);
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      p(x + Math.cos(a) * 2.7, z + Math.sin(a) * 2.7);
      if (i % 2 === 0) p(x + Math.cos(a) * 1.35, z + Math.sin(a) * 1.35);
    }
    return mx - mn;
  }
  /* distancia do ponto ate a superficie do veiculo (camionete ou carretinha, a que estiver mais perto) */
  function distAoVeiculo(x, z) {
    var cx = F.caixas(st), d = distCaixa(cx.caminhao, x, z);
    return T ? Math.min(d, distCaixa(cx.carreta, x, z)) : d;
  }
  function pontoMaisProximo(b, x, z) {
    var dx = x - b.x, dz = z - b.z, c = Math.cos(b.psi), s = Math.sin(b.psi);
    var lx = trava(dx * c + dz * s, -b.meiaL, b.meiaL), lz = trava(-dx * s + dz * c, -b.meiaW, b.meiaW);
    return { x: b.x + lx * c - lz * s, z: b.z + lx * s + lz * c };
  }
  /* a MESMA regra do jogo (radar.js, bloqueioDecolagem): no chao, qualquer obstaculo a menos de 6 m do drone (distColisor, a 0,4 m do chao)
     impede a decolagem ("obstaculos detectados perto da aeronave"). Aqui com 0,6 m de folga. A propria camionete e um colisor do jogo. */
  function bloqueioDeDecolagem(x, z) {
    if (typeof distColisor !== "function") return null;
    var p = new THREE.Vector3(x, alt(x, z) + 0.4, z);
    for (var j = 0; j < colisores.length; j++) {
      var c = colisores[j];
      if (/badeco|auxiliar/i.test(c.nome || "")) continue;     // o auxiliar e posto ao lado do drone e se afasta ou senta (equipe.js)
      if (Math.hypot(c.cx - x, c.cz - z) > c.raio + FOLGA_DECOLAGEM) continue;
      if (distColisor(c, p) < FOLGA_DECOLAGEM) return c;
    }
    return null;
  }
  function avaliarPonto(x, z) {
    var dv = distAoVeiculo(x, z);
    if (dv > RAIO_ESCOLHA) return { ok: false, msg: trR("Longe demais do veículo: no máximo " + RAIO_ESCOLHA + " m.", "Too far from the vehicle: " + RAIO_ESCOLHA + " m at most.", "Demasiado lejos del vehículo: máximo " + RAIO_ESCOLHA + " m.") };
    if (dv < FOLGA_DECOLAGEM) return { ok: false, msg: "Perto demais do veículo: o drone não decola a menos de 6 m de um obstáculo. Afaste o círculo." };
    var livre = baseLivre(x, z);
    if (livre) return { ok: false, msg: livre };
    if (bloqueioDeDecolagem(x, z)) return { ok: false, msg: "Há obstáculo a menos de 6 m do círculo: o drone não decolaria aqui." };
    var dn = desnivel(x, z);
    if (dn > PLANO_MAX) return { ok: false, msg: trR("O chão do círculo não é plano (desnível de " + Math.round(dn * 100) + " cm). Procure um lugar reto.", "The ground in the circle is not level (" + Math.round(dn * 100) + " cm difference). Look for a flat spot.", "El suelo del círculo no es plano (desnivel de " + Math.round(dn * 100) + " cm). Busca un lugar plano.") };
    return { ok: true, msg: "Chão plano e livre: clique para colocar o drone aqui." };
  }
  /* fase "dirigindo": ja da para escolher o ponto do drone? */
  function prontoParaEscolher() {
    if (Math.abs(st.v) > 0.3) return { ok: false, msg: "" };
    if (Math.abs(F.articulacao(st)) > 0.35) return { ok: false, msg: "Endireite a carretinha para continuar." };
    if (incl.caminhao > 0.2 || incl.carreta > 0.2) return { ok: false, msg: "Terreno inclinado: pare em um lugar mais plano." };
    return { ok: true, msg: "Pronto. Clique em “Escolher onde colocar o drone”." };
  }
  /* onde o mouse toca o chao (o relevo e uma funcao alt(x, z): anda pelo raio ate ele ficar abaixo do chao) */
  function pontoDoMouse() {
    if (!mouse.tem) return null;
    var rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), cam);
    var o = rc.ray.origin, d = rc.ray.direction;
    if (d.y > -0.02) return null;                       // olhando para o horizonte: nao ha chao ali
    for (var t = 1; t < 320; t += 1) {
      if (o.y + d.y * t < alt(o.x + d.x * t, o.z + d.z * t)) {
        var a = t - 1, b = t;
        for (var i = 0; i < 14; i++) { var m = (a + b) / 2; if (o.y + d.y * m < alt(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
        return { x: o.x + d.x * b, z: o.z + d.z * b };
      }
    }
    return null;
  }

  /* ----------------------------------------------------- posicao e inclinacao */
  function aplicarPoses(dt, forca) {
    if (!st) return;
    var k = forca ? 1 : 1 - Math.exp(-(dt || 0.016) * 14);
    if (G) {
      var o = F.origem(st), fx = Math.cos(st.psi), fz = Math.sin(st.psi), nx = -fz, nz = fx;
      var h = function (a, b) { return alt(o.x + fx * a + nx * b, o.z + fz * a + nz * b); };
      var hFL = h(1.68, -0.78), hFR = h(1.68, 0.78), hRL = h(-1.54, -0.78), hRR = h(-1.54, 0.78);
      var hF = (hFL + hFR) / 2, hR = (hRL + hRR) / 2;
      var pitch = Math.atan2(hF - hR, 3.22), roll = Math.atan2((hFR + hRR) / 2 - (hFL + hRL) / 2, 1.56);
      incl.caminhao = Math.max(Math.abs(pitch), Math.abs(roll));
      var y = hR + (hF - hR) * 1.54 / 3.22;
      if (suave.y === null || forca) { suave.y = y; suave.pitch = pitch; suave.roll = roll; }
      else { suave.y += (y - suave.y) * k; suave.pitch += (pitch - suave.pitch) * k; suave.roll += (roll - suave.roll) * k; }
      G.position.set(o.x, suave.y, o.z);
      G.rotation.set(-suave.roll, -st.psi, suave.pitch);
      var cx = F.caixas(st).caminhao;
      COL.x = COL.cx = cx.x; COL.z = COL.cz = cx.z; COL.rot = st.psi; COL.y0 = suave.y; COL.y1 = suave.y + 2.45;
      if (!rodasT) {
        var d1 = G.getObjectByName("Roda_Dianteira_Direita");
        if (d1) {
          rodasT = { fd: d1, fe: G.getObjectByName("Roda_Dianteira_Esquerda"), td: G.getObjectByName("Roda_Traseira_Direita"), te: G.getObjectByName("Roda_Traseira_Esquerda") };
          [rodasT.fd, rodasT.fe].forEach(function (n) { if (n) n.rotation.order = "YXZ"; });
        }
      }
      if (rodasT) {
        var giro = st.giroRoda % (2 * Math.PI);
        [rodasT.fd, rodasT.fe].forEach(function (n) { if (n) { n.rotation.y = -st.delta; n.rotation.x = giro; } });
        [rodasT.td, rodasT.te].forEach(function (n) { if (n) n.rotation.x = giro; });
      }
    }
    if (acharCarreta()) {
      var t = F.carreta(st), tfx = Math.cos(t.psi), tfz = Math.sin(t.psi), tnx = -tfz, tnz = tfx;
      var ht = function (a, b) { return alt(t.x + tfx * a + tnx * b, t.z + tfz * a + tnz * b); };
      var hAL = ht(-0.315, -1.04), hAR = ht(-0.315, 1.04), hH = ht(2.9, 0), hAx = (hAL + hAR) / 2;
      var tp = Math.atan2(hH - hAx, 3.215), tr = Math.atan2(hAR - hAL, 2.08), ty = hAx + (hH - hAx) * 0.315 / 3.215;
      incl.carreta = Math.max(Math.abs(tp), Math.abs(tr));
      if (suave.ty === null || forca) { suave.ty = ty; suave.tp = tp; suave.tr = tr; }
      else { suave.ty += (ty - suave.ty) * k; suave.tp += (tp - suave.tp) * k; suave.tr += (tr - suave.tr) * k; }
      T.position.set(t.x, suave.ty, t.z);
      T.rotation.set(suave.tp, -t.psi - Math.PI / 2, suave.tr);
      var gr = -(st.giroRodaCarreta % (2 * Math.PI));
      if (rodasCarreta) rodasCarreta.forEach(function (p) { p.rotation.x = gr; });
    }
  }

  /* ---------------------------------------------------------------- avisos / HUD */
  function aviso(txt, tipo, ms) { msg.txt = txt; msg.tipo = tipo || ""; msg.ate = performance.now() + (ms || 2600); }
  function criarHud() {
    if (hud) return hud;
    var css = document.createElement("style");
    css.textContent =
      "#xgDirigir{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:30;width:min(560px,94vw);padding:12px 14px;" +
      "border-radius:14px;background:rgba(10,14,20,.84);border:1px solid #2b3644;color:#E9EEF3;font:14px/1.35 Roboto,Arial,sans-serif;" +
      "backdrop-filter:blur(6px)}" +
      "#xgDirigir[hidden]{display:none}" +
      "#xgDirigir .msg{margin:0;min-height:20px;font-weight:600}" +
      "#xgDirigir .msg.ok{color:#5fe39a}#xgDirigir .msg.erro{color:#ff7a6e}#xgDirigir .msg.info{color:#cfe0f2}" +
      "#xgDirigir .bot{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}" +
      "#xgDirigir button{padding:8px 12px;border-radius:9px;border:1.5px solid #33445a;background:rgba(255,255,255,.06);color:#E9EEF3;font-size:13px;cursor:pointer}" +
      "#xgDirigir button.principal{border-color:#2f80ed;background:rgba(47,128,237,.28);font-weight:600}" +
      "#xgDirigir button:disabled{opacity:.45;cursor:default}" +
      "#xgDirigir button:hover:not(:disabled){background:rgba(255,255,255,.12)}" +
      "@media (pointer:coarse){#xgDirigir{bottom:8px;padding:10px 12px}#xgDirigir button{min-height:44px;font-size:15px;padding:8px 14px}}";
    document.head.appendChild(css);
    hud = document.createElement("div");
    hud.id = "xgDirigir"; hud.hidden = true;
    hud.innerHTML =
      "<p class='msg' id='xgdMsg'></p>" +
      "<div class='bot'><button type='button' class='principal' id='xgdAcao'></button><button type='button' id='xgdVoltar'></button>" +
      "<button type='button' id='xgdAssist' hidden></button></div>";   /* ré assistida: so aparece no toque e no gamepad (no teclado e a tecla T) */
    document.body.appendChild(hud);
    hud.querySelector("#xgdAcao").onclick = function () { avancarFase(); };
    hud.querySelector("#xgdVoltar").onclick = function () { recuarFase(); };
    hud.querySelector("#xgdAssist").onclick = function () { if (fase === "dirigindo") alternarAssist(); };
    return hud;
  }
  function atualizarHud() {
    if (!hud) return;
    var m = hud.querySelector("#xgdMsg"), a = hud.querySelector("#xgdAcao"), b = hud.querySelector("#xgdVoltar"), as = hud.querySelector("#xgdAssist"), agora = performance.now(), txt, cls;
    if (fase === "dirigindo") {
      if (st.dobrada) { txt = "A carretinha está dobrando demais: siga em frente para desfazer."; cls = "erro"; }
      else if (agora < msg.ate) { txt = msg.txt; cls = msg.tipo; }
      else if (pronto.msg) { txt = pronto.msg; cls = pronto.ok ? "ok" : "info"; }
      else { txt = "Leve a camionete até onde quer decolar."; cls = "info"; }
      a.textContent = "Escolher onde colocar o drone"; a.disabled = !pronto.ok; b.textContent = "Voltar à tela inicial";
      as.hidden = !(ehToque() || pad.vivo); as.textContent = "Ré assistida: " + (st.assistida ? "ligada" : "desligada");
    } else {
      if (agora < msg.ate) { txt = msg.txt; cls = msg.tipo; }
      else { txt = aval.msg; cls = aval.ok ? "ok" : "erro"; }
      a.textContent = "Colocar o drone aqui"; a.disabled = !aval.ok; b.textContent = "Voltar a dirigir"; as.hidden = true;
    }
    m.textContent = txt; m.className = "msg " + cls;
    if (telaToque) telaToque.style.setProperty("--xgh", (hud.offsetHeight + 14) + "px");
  }
  /* o circulo da base: segue o mouse; verde se vale, vermelho se nao */
  function criarPrevia() {
    if (previa) return previa;
    previa = new THREE.Group();
    var anelP = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.7, 56), new THREE.MeshBasicMaterial({ color: "#5fe39a", transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
    anelP.rotation.x = -Math.PI / 2; anelP.position.y = 0.08;
    var disco = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), new THREE.MeshBasicMaterial({ color: "#5fe39a", transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    disco.rotation.x = -Math.PI / 2; disco.position.y = 0.07;
    var feixe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 14, 8, 1, true), new THREE.MeshBasicMaterial({ color: "#5fe39a", transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    feixe.position.y = 7;
    previa.add(anelP, disco, feixe);
    previa.userData.cor = [anelP.material, disco.material, feixe.material];
    previa.visible = false;
    cena.add(previa);
    return previa;
  }
  function pintarPrevia() {
    var p = criarPrevia();
    p.visible = fase === "escolhendo";
    if (!p.visible) return;
    p.position.set(cand.x, alt(cand.x, cand.z), cand.z);
    var cor = aval.ok ? "#5fe39a" : "#ff7a6e";
    p.userData.cor.forEach(function (m) { m.color.set(cor); });
  }
  function limparRaio() {
    if (!anelRaio) return;
    cena.remove(anelRaio); anelRaio.geometry.dispose(); if (anelRaio.material.map) anelRaio.material.map.dispose(); anelRaio.material.dispose(); anelRaio = null;
  }
  /* a faixa onde o drone pode ficar, colada no relevo: verde entre 6,6 e RAIO_ESCOLHA m do veiculo (da superficie), vermelha perto demais para decolar,
     com uma linha branca em cada limite. Um quadrado de 80 m em volta do conjunto (o veiculo tem ate ~12 m de comprimento + 20 m de cada lado), textura de 800 px. */
  function desenharRaio() {
    limparRaio();
    var cx = F.caixas(st), A = cx.caminhao, B = T ? cx.carreta : null, N = 800, L = 80;
    var mx = B ? (A.x + B.x) / 2 : A.x, mz = B ? (A.z + B.z) / 2 : A.z;
    var cv = document.createElement("canvas"); cv.width = cv.height = N;
    var g = cv.getContext("2d"), img = g.createImageData(N, N), dados = img.data;
    var ca = Math.cos(A.psi), sa = Math.sin(A.psi), cb = B ? Math.cos(B.psi) : 1, sb = B ? Math.sin(B.psi) : 0;
    function dist(b, c, s, x, z) {
      var dx = x - b.x, dz = z - b.z, lx = Math.abs(dx * c + dz * s) - b.meiaL, lz = Math.abs(-dx * s + dz * c) - b.meiaW;
      return Math.sqrt(Math.max(lx, 0) * Math.max(lx, 0) + Math.max(lz, 0) * Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0);
    }
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var x = mx - L / 2 + (i + 0.5) / N * L, z = mz - L / 2 + (j + 0.5) / N * L, k = (j * N + i) * 4;
      var d = dist(A, ca, sa, x, z); if (B) d = Math.min(d, dist(B, cb, sb, x, z));
      var r = 0, ve = 0, az = 0, al = 0;
      if (Math.abs(d - RAIO_ESCOLHA) < 0.2 || Math.abs(d - FOLGA_DECOLAGEM) < 0.12) { r = ve = az = 255; al = 210; }
      else if (d > FOLGA_DECOLAGEM && d < RAIO_ESCOLHA) { r = 95; ve = 227; az = 154; al = 50; }
      else if (d > 0 && d <= FOLGA_DECOLAGEM) { r = 255; ve = 90; az = 80; al = 46; }
      dados[k] = r; dados[k + 1] = ve; dados[k + 2] = az; dados[k + 3] = al;
    }
    g.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    var geo = new THREE.PlaneGeometry(L, L, 160, 160); geo.rotateX(-Math.PI / 2); geo.translate(mx, 0, mz);
    var pos = geo.attributes.position; for (var v = 0; v < pos.count; v++) pos.setY(v, alt(pos.getX(v), pos.getZ(v)) + 0.12);
    anelRaio = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    anelRaio.renderOrder = 5; cena.add(anelRaio);
  }

  /* ---------------------------------------------------------------- entrada */
  /* ---- entradas: teclado (o direcional do controle remoto da TV manda as setas e o OK = Enter), toque na tela e gamepad ---- */
  function ehToque() { return !!(window.matchMedia && matchMedia("(pointer:coarse)").matches); }
  function padConectado() { var l = navigator.getGamepads ? navigator.getGamepads() : [], i; for (i = 0; i < l.length; i++) if (l[i] && l[i].connected) return true; return false; }
  function alternarAssist() { st.assistida = !st.assistida; aviso("Ré assistida " + (st.assistida ? "ligada" : "desligada"), "info"); }
  function lerGamepad() {
    var r = { x: 0, y: 0, freio: false }, lista = navigator.getGamepads ? navigator.getGamepads() : [], g = null, i;
    for (i = 0; i < lista.length; i++) if (lista[i] && lista[i].connected) { g = lista[i]; break; }
    pad.vivo = !!g;
    if (!g) { pad.ant = {}; return r; }
    var zona = function (v) { return Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82; };
    var b = function (n) { return !!(g.buttons[n] && g.buttons[n].pressed); }, ant = pad.ant;
    r.x = zona(g.axes[0] || 0);                                                          // analogico esquerdo: volante
    r.y = ((g.buttons[7] ? g.buttons[7].value : 0) - (g.buttons[6] ? g.buttons[6].value : 0)) || -zona(g.axes[1] || 0);   // RT acelera, LT da re (ou o analogico)
    r.freio = b(5) || b(2);                                                              // RB ou X: freio de mao
    var a = b(0) && !ant[0], voltar = b(1) && !ant[1], assist = b(3) && !ant[3];         // A avanca, B volta, Y liga/desliga a re assistida
    pad.ant = { 0: b(0), 1: b(1), 3: b(3) };
    if (a) avancarFase(); else if (voltar) recuarFase(); else if (assist && fase === "dirigindo") alternarAssist();
    return r;
  }
  /* escolhendo o ponto sem mouse (setas, direcional da TV, analogico): o circulo anda em relacao a camera e nunca passa do limite (RAIO_ESCOLHA) do veiculo */
  function moverCirculo(dt, x, y) {
    if (Math.abs(x) + Math.abs(y) < 0.05) return;
    var r = camRumo === null ? st.psi : camRumo, fx = Math.cos(r), fz = Math.sin(r), nx = -fz, nz = fx, v = 7 * dt;
    cand.x += (fx * y + nx * x) * v; cand.z += (fz * y + nz * x) * v;
    var cxs = F.caixas(st), alvo = cxs.caminhao, max = RAIO_ESCOLHA - 0.05;
    if (T && distCaixa(cxs.carreta, cand.x, cand.z) < distCaixa(alvo, cand.x, cand.z)) alvo = cxs.carreta;
    if (distCaixa(alvo, cand.x, cand.z) > max) {            // passou: volta para a linha do limite, medida da superficie do veiculo
      var pn = pontoMaisProximo(alvo, cand.x, cand.z), dx = cand.x - pn.x, dz = cand.z - pn.z, h = Math.hypot(dx, dz) || 1;
      cand.x = pn.x + dx / h * max; cand.z = pn.z + dz / h * max;
    }
    fixo = true;
  }
  function lerEntradas(dt) {
    var g = lerGamepad();
    if (!ativo) return;                                   // o gamepad pode ter confirmado a base agora
    var kx = (teclas.KeyD || teclas.ArrowRight ? 1 : 0) - (teclas.KeyA || teclas.ArrowLeft ? 1 : 0);
    var ky = (teclas.KeyW || teclas.ArrowUp ? 1 : 0) - (teclas.KeyS || teclas.ArrowDown ? 1 : 0);
    var tx = (toque.dir ? 1 : 0) - (toque.esq ? 1 : 0), ty = (toque.acel ? 1 : 0) - (toque.re ? 1 : 0);
    var x = trava(kx + tx + g.x, -1, 1), y = trava(ky + ty + g.y, -1, 1);
    if (fase === "dirigindo") { cmd.dir = x; cmd.acel = y; cmd.freio = !!teclas.Space || toque.freio || g.freio; }
    else { cmd.dir = 0; cmd.acel = 0; cmd.freio = true; moverCirculo(dt, x, y); }
  }
  /* botao Voltar do controle remoto: Android TV (4 / Escape), Tizen (10009), webOS (461) */
  function ehVoltar(e) { return e.code === "Backspace" || e.code === "Escape" || e.key === "Escape" || e.key === "BrowserBack" || e.key === "GoBack" || e.keyCode === 4 || e.keyCode === 10009 || e.keyCode === 461; }
  function aoTeclar(e) {
    if (!ativo) return;
    var alvo = e.target && e.target.tagName;
    if (alvo === "INPUT" || alvo === "TEXTAREA" || alvo === "SELECT") return;
    var usada = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter", "NumpadEnter", "KeyT"];
    var voltar = ehVoltar(e);
    if (!voltar && usada.indexOf(e.code) < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type === "keyup") { teclas[e.code] = false; return; }
    teclas[e.code] = true;
    if (e.repeat) return;
    if (voltar) recuarFase();
    else if (e.code === "Enter" || e.code === "NumpadEnter") avancarFase();
    else if (e.code === "KeyT" && fase === "dirigindo") alternarAssist();
  }
  /* ---- toque (celular, tablet): volante e pedais na tela; so aparecem na fase de dirigir ---- */
  function criarToque() {
    if (telaToque || !ehToque()) return;
    var css = document.createElement("style");
    css.textContent =
      "#xgToque{position:fixed;inset:0;z-index:29;pointer-events:none}#xgToque[hidden]{display:none}" +
      "#xgToque button{position:absolute;width:84px;height:84px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(10,14,20,.55);color:#fff;font:700 30px/1 Arial,sans-serif;" +
      "pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;backdrop-filter:blur(3px)}" +
      "#xgToque button.ativa{background:rgba(47,128,237,.7);border-color:#9fc2ff}" +
      "#xgToque .peq{width:58px;height:58px;font-size:15px}" +
      "#xgToque button svg{width:30px;height:30px;display:block;margin:0 auto;fill:currentColor;pointer-events:none}";
    document.head.appendChild(css);
    telaToque = document.createElement("div"); telaToque.id = "xgToque"; telaToque.hidden = true;
    /* --xgh = altura do painel (atualizarHud): os botoes ficam sempre logo acima dele */
    var acima = function (extra) { return "bottom:calc(var(--xgh,150px) + " + extra + "px)"; };
    /* 24/10/2026: as quatro setas sao desenhadas (SVG) e ficam iguais em qualquer aparelho; os caracteres ◀ ▶ viravam emoji azul no iPhone */
    var SETA = {
      esq: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12L20 2V22Z"/></svg>', dir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12L4 2V22Z"/></svg>',
      acel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4L22 20H2Z"/></svg>', re: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20L22 4H2Z"/></svg>' };
    var defs = [["esq", "◀", "left:14px;" + acima(10), ""], ["dir", "▶", "left:112px;" + acima(10), ""], ["acel", "▲", "right:14px;" + acima(104), ""],
      ["re", "▼", "right:14px;" + acima(10), ""], ["freio", "P", "right:112px;" + acima(22), "peq"]];
    defs.forEach(function (d) {
      var b = document.createElement("button"); b.type = "button"; b.dataset.t = d[0]; if (SETA[d[0]]) b.innerHTML = SETA[d[0]]; else b.textContent = d[1]; b.style.cssText = d[2]; if (d[3]) b.className = d[3];
      b.setAttribute("aria-label", { esq: "Volante para a esquerda", dir: "Volante para a direita", acel: "Acelerar", re: "Ré ou freio", freio: "Freio de mão" }[d[0]]);
      var soltar = function () { toque[d[0]] = false; b.classList.remove("ativa"); };
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); toque[d[0]] = true; b.classList.add("ativa"); try { b.setPointerCapture(e.pointerId); } catch (x) { /* segue */ } });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) { b.addEventListener(t, soltar); });
      b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      telaToque.appendChild(b);
    });
    document.body.appendChild(telaToque);
  }
  function mostrarToque(v) {
    if (!telaToque) return;
    telaToque.hidden = !v;
    if (!v) { toque.esq = toque.dir = toque.acel = toque.re = toque.freio = false; telaToque.querySelectorAll("button").forEach(function (b) { b.classList.remove("ativa"); }); }
  }
  function ligarEntrada() {
    window.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("keyup", aoTeclar, true);
    window.addEventListener("blur", function () { teclas = {}; });
    var el = render.domElement;
    var apontar = function (e) {
      var r = el.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) / r.width * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height * 2 - 1); mouse.tem = true; fixo = false;
    };
    el.addEventListener("pointerdown", function (e) {
      if (!ativo) return;
      dedo = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, moveu: false, tipo: e.pointerType };
      if (fase === "escolhendo") apontar(e);               // no toque, encostar o dedo ja poe o circulo ali
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* segue */ }
    });
    el.addEventListener("pointermove", function (e) {
      if (!ativo) return;
      if (e.pointerType !== "touch" || fase === "escolhendo") apontar(e);
      if (!dedo) return;
      if (Math.hypot(e.clientX - dedo.x0, e.clientY - dedo.y0) > 6) dedo.moveu = true;
      /* arrastar gira a camera com o mouse (e com o dedo enquanto dirige); com o dedo, escolhendo o ponto, arrastar move o circulo */
      if (!(dedo.tipo === "touch" && fase === "escolhendo")) { yawExt -= (e.clientX - dedo.x) * 0.006; pitchExt = trava(pitchExt + (e.clientY - dedo.y) * 0.05, -3, 9); }
      dedo.x = e.clientX; dedo.y = e.clientY;
    });
    el.addEventListener("pointerup", function (e) {
      /* confirmar com um clique so vale para o mouse; no toque confirma o botao "Colocar o drone aqui" (um toque sem querer nao monta a base) */
      var clique = ativo && dedo && !dedo.moveu && e.button === 0 && e.pointerType === "mouse";
      dedo = null;
      if (clique && fase === "escolhendo") confirmar();
    });
    el.addEventListener("wheel", function (e) { if (!ativo) return; e.preventDefault(); distExt = trava(distExt * (e.deltaY > 0 ? 1.1 : 0.91), 8, 34); }, { passive: false });
  }

  /* ------------------------------------------------------------------ passo */
  function copiar(de) { var c = {}; for (var k in de) c[k] = de[k]; return c; }
  function avancar(dt) {
    var antes = copiar(st);
    F.passo(st, cmd, dt);
    var cx = F.caixas(st), nome = obstaculo(cx);
    aplicarPoses(dt, true);
    var inclinado = incl.caminhao > 0.36 || incl.carreta > 0.36;
    if (nome || inclinado) {
      var estavaLivre = !obstaculo(F.caixas(antes));
      if (estavaLivre) {
        var delta = st.delta;
        for (var k in antes) st[k] = antes[k];
        st.delta = delta; st.v = 0;
        aplicarPoses(dt, true);
        aviso(nome ? trR("Bateu em " + nome + ". Dê ré para sair.", "Hit " + trN(nome, 0) + ". Reverse to get out.", "Chocaste con " + trN(nome, 1) + ". Da marcha atrás para salir.") : "Declive forte demais para a camionete.", "erro", 1800);
      }
    }
  }
  function quadroDirecao(dt) {
    dt = Math.min(dt, 0.05);
    lerEntradas(dt);
    if (!ativo) return;                                   // o gamepad confirmou a base neste quadro
    if (fase === "dirigindo") avancar(dt); else st.v = 0;
    aplicarPoses(dt, false);
    drone.visible = false;
    /* o piloto e o auxiliar somem (vao no carro): o ponte.js religa o operador a cada quadro (posCamera), depois do equipe.js;
       aqui, que roda depois do posCamera e antes de desenhar, o ultimo a falar e o que vale */
    grupoOperador.visible = false;
    if (window.xgEquipe && window.xgEquipe.b) window.xgEquipe.b.visible = false;
    var a = acharAnel(); if (a) a.visible = false;
    tHud -= dt; tAval -= dt;
    if (fase === "escolhendo") {
      if (!fixo) { var p = pontoDoMouse(); if (p) { cand.x = p.x; cand.z = p.z; } }
      if (tAval <= 0) { tAval = 0.06; aval = avaliarPonto(cand.x, cand.z); }
      pintarPrevia();
    }
    if (tHud <= 0) { tHud = 0.08; if (fase === "dirigindo") pronto = prontoParaEscolher(); atualizarHud(); }
    cameraDirecao(dt);
    var o = F.origem(st);
    if (typeof sol !== "undefined") { sol.position.set(o.x + 40, 70, o.z + 30); sol.target.position.set(o.x, 0, o.z); }
  }
  function cameraDirecao(dt) {
    var o = F.origem(st), t = F.carreta(st);
    var cx = (o.x + t.x) / 2, cz = (o.z + t.z) / 2, cy = (G ? G.position.y : alt(cx, cz)) + 1.3;
    var esc = fase === "escolhendo";
    kEsc += ((esc ? 1 : 0) - kEsc) * (1 - Math.exp(-dt * 4));
    /* em re a camera passa para a frente e olha para tras, para o fundo da carretinha */
    if (st.v < -0.4) tRe = Math.min(tRe + dt, 1); else if (st.v > 0.4) tRe = Math.max(tRe - dt, 0);
    olhaTras = olhaTras ? tRe > 0.2 : tRe > 0.7;
    var rumo = F.normaliza(st.psi - 0.5 * F.articulacao(st)) + (olhaTras && !esc ? Math.PI : 0) + yawExt;
    if (camRumo === null) camRumo = rumo;
    camRumo += F.normaliza(rumo - camRumo) * (1 - Math.exp(-dt * 2.6));
    if (!dedo) yawExt *= 1 - Math.min(1, dt * 0.8);
    /* escolhendo o ponto, a camera sobe para ver toda a faixa em volta do carro (com 10 m eram 11 m atras e 24 m de altura) */
    var dEsc = 11 + (RAIO_ESCOLHA - 10) * 1.15, altoEsc = 24 + (RAIO_ESCOLHA - 10) * 3.4;
    var dDir = distExt + (olhaTras ? 2 : 0), altoDir = 5.2 + (distExt - 15) * 0.22 + pitchExt;
    var d = dDir + (dEsc - dDir) * kEsc, alto = altoDir + (altoEsc + pitchExt - altoDir) * kEsc;
    var px = cx - Math.cos(camRumo) * d, pz = cz - Math.sin(camRumo) * d;
    var py = Math.max(cy + alto, alt(px, pz) + 1.6);
    cam.position.set(px, py, pz);
    /* mira um pouco abaixo do carro (ele sobe na tela e sai de tras do painel); la de cima, mira o centro */
    cam.lookAt(cx + Math.cos(camRumo) * 3 * (1 - kEsc), cy - 1.3 * (1 - kEsc), cz + Math.sin(camRumo) * 3 * (1 - kEsc));
  }

  /* ------------------------------------------------------------ entrar e sair */
  function mostrarCampo(v) {
    drone.visible = v;
    var a = acharAnel(); if (a) a.visible = v;
    if (window.xgEquipe && window.xgEquipe.acampamento) window.xgEquipe.acampamento(v);
    if (previa) previa.visible = false;
    limparRaio();
  }
  function entrar() {
    if (!liberado()) return false;
    if (!achar()) { alert("A camionete ainda não carregou. Espere um instante e tente de novo."); return false; }
    if (ativo) return true;
    acharCarreta();
    if (!st) { st = F.criar(baseOrig.x + 10, baseOrig.z + 8, 0); st.assistida = true; }
    API.ativo = ativo = true; fase = "dirigindo";
    /* o tempo da pessoa so conta depois de a base montada (comecar()): aqui e a tela inicial, fora da operacao */
    if (window.PAUSA_SIM && PAUSA_SIM.definirOperacao) PAUSA_SIM.definirOperacao(false);
    /* o laco desenha a vista "controle" (FPV do drone) sem olhar a camera: dirigindo, e a vista "drone" */
    vistaAntes = vista;
    if (vista !== "drone") definirVista("drone");
    teclas = {}; camRumo = null; yawExt = 0; tRe = 0; kEsc = 0; olhaTras = false; mouse.tem = false; fixo = false; suave.y = suave.ty = null;
    /* a tela inicial continua "aberta" (hidden = false) so que invisivel: o painel do auxiliar e o
       resto da pagina decidem o que mostrar olhando se ela esta aberta (ponte.estado) */
    var ini = document.getElementById("inicio");
    ini.style.visibility = "hidden"; ini.style.pointerEvents = "none";
    document.body.classList.add("dirigindo");
    criarHud().hidden = false;
    criarToque(); mostrarToque(true);
    render.domElement.style.touchAction = "none";          // arrastar o dedo gira a camera, nao rola a pagina
    mostrarCampo(false);
    aplicarPoses(0, true);
    pronto = prontoParaEscolher(); atualizarHud();
    aviso(ehToque() ? "Volante ◀\uFE0E ▶\uFE0E · ▲ acelera · ▼ ré e freio" : (padConectado() ? "Analógico esquerdo: volante · RT acelera · LT ré" : "W/S ou setas: acelera e ré · A/D: volante · Espaço freia"), "info", 6000);
    return true;
  }
  function sairDaDirecao() {
    API.ativo = ativo = false; fase = "dirigindo";
    teclas = {};
    var ini = document.getElementById("inicio");
    ini.style.visibility = ""; ini.style.pointerEvents = "";
    if (hud) hud.hidden = true;
    mostrarToque(false);
    render.domElement.style.touchAction = "";
    document.body.classList.remove("dirigindo");
    mostrarCampo(true);
    cam.up.set(0, 1, 0);
    if (vistaAntes && vistaAntes !== vista) definirVista(vistaAntes);
    vistaAntes = null;
  }
  /* de volta ao ponto que o cenario traz (camionete e carretinha no lugar de sempre) */
  function voltarAoAutomatico() {
    var teveEstado = !!st;
    st = null;
    BASE.x = baseOrig.x; BASE.z = baseOrig.z;
    if (achar()) {
      var padrao = F.criar(baseOrig.x + 10, baseOrig.z + 8, 0);
      var guarda = st; st = padrao; suave.y = suave.ty = null; aplicarPoses(0, true); st = guarda;
    }
    var a = acharAnel(); if (a) a.position.set(BASE.x, alt(BASE.x, BASE.z) + 0.06, BASE.z);
    if (teveEstado) { try { reiniciarVoo(); if (window.xgEquipe && window.xgEquipe.reposicionar) window.xgEquipe.reposicionar(); } catch (e) { console.warn("veiculo:", e); } }
  }
  /* 1o passo: o carro parou, a pessoa quer escolher onde fica o drone */
  function escolher() {
    if (!ativo || !st || fase !== "dirigindo") return false;
    pronto = prontoParaEscolher();
    if (!pronto.ok) { aviso(pronto.msg || "Pare a camionete primeiro.", "erro"); return false; }
    fase = "escolhendo"; st.v = 0; teclas = {}; mouse.tem = false; fixo = false;
    /* o circulo nasce ao lado do carro, do lado do talhao, a 8,5 m da origem (dentro da faixa verde, longe da carretinha); se ali o chao nao
       serve, vai para o ponto bom mais perto desse (uma grade de 1,5 m dentro da faixa), para ele ja comecar numa posicao valida quando houver uma */
    var o = F.origem(st), fx = Math.cos(st.psi), fz = Math.sin(st.psi), nx = -fz, nz = fx, c0 = candidatasDeBase()[0];
    var lado = ((c0.x - o.x) * nx + (c0.z - o.z) * nz) >= 0 ? 1 : -1;
    cand.x = o.x - 3 * fx + 8.5 * lado * nx; cand.z = o.z - 3 * fz + 8.5 * lado * nz;
    aval = avaliarPonto(cand.x, cand.z);
    if (!aval.ok) {
      var grade = [], gi, gj, passo = 1.5, alcance = RAIO_ESCOLHA + 8;
      for (gi = -alcance; gi <= alcance; gi += passo) for (gj = -alcance; gj <= alcance; gj += passo) {
        var gx = cand.x + gi, gz = cand.z + gj, dv = distAoVeiculo(gx, gz);
        if (dv > FOLGA_DECOLAGEM + 0.4 && dv < RAIO_ESCOLHA - 0.4) grade.push({ x: gx, z: gz, k: gi * gi + gj * gj });
      }
      grade.sort(function (a, b) { return a.k - b.k; });
      for (gi = 0; gi < grade.length; gi++) {
        var av = avaliarPonto(grade[gi].x, grade[gi].z);
        if (av.ok) { cand.x = grade[gi].x; cand.z = grade[gi].z; aval = av; break; }
      }
    }
    desenharRaio(); pintarPrevia();
    mostrarToque(false);
    aviso(ehToque() ? trR("Toque no chão para mover o círculo (de 6 a " + RAIO_ESCOLHA + " m do veículo) e confirme no botão.", "Tap the ground to move the circle (6 to " + RAIO_ESCOLHA + " m from the vehicle) and confirm with the button.", "Toca el suelo para mover el círculo (de 6 a " + RAIO_ESCOLHA + " m del vehículo) y confirma con el botón.") : trR("Mova o círculo com o mouse ou as setas (de 6 a " + RAIO_ESCOLHA + " m do veículo) e clique ou aperte Enter para confirmar.", "Move the circle with the mouse or the arrow keys (6 to " + RAIO_ESCOLHA + " m from the vehicle) and click or press Enter to confirm.", "Mueve el círculo con el mouse o las flechas (de 6 a " + RAIO_ESCOLHA + " m del vehículo) y haz clic o pulsa Enter para confirmar."), "info", 7000);
    atualizarHud();
    return true;
  }
  function voltarADirigir() {
    if (fase !== "escolhendo") return;
    fase = "dirigindo";
    mostrarToque(true);
    if (previa) previa.visible = false;
    limparRaio();
    atualizarHud();
  }
  /* 2o passo: confirma o circulo, monta a base ali e segue para o jogo */
  function confirmar() {
    if (!ativo || !st || fase !== "escolhendo") return false;
    aval = avaliarPonto(cand.x, cand.z);
    if (!aval.ok) { aviso(aval.msg, "erro"); return false; }
    BASE.x = cand.x; BASE.z = cand.z;
    sairDaDirecao();
    var a = acharAnel(); if (a) a.position.set(BASE.x, alt(BASE.x, BASE.z) + 0.06, BASE.z);
    try { reiniciarVoo(); if (window.xgEquipe && window.xgEquipe.reposicionar) window.xgEquipe.reposicionar(); } catch (e) { console.warn("veiculo:", e); }
    drone.visible = true;
    comecar();
    return true;
  }
  function avancarFase() { return fase === "dirigindo" ? escolher() : confirmar(); }
  function recuarFase() { if (fase === "escolhendo") voltarADirigir(); else cancelar(); }
  function cancelar() {
    if (!ativo) return;
    sairDaDirecao();
    abrirInicio();
  }

  /* --------------------------------------------------- tela inicial (so admin) */
  function criarSeletor() {
    var comecarBtn = document.getElementById("bComecar");
    if (!comecarBtn || document.getElementById("xgPonto")) return;
    var bloco = document.createElement("div");
    bloco.id = "xgPonto";
    bloco.innerHTML =
      "<p class='rot' style='margin-top:18px'>Ponto de decolagem</p>" +
      "<div class='avatares' role='group' aria-label='Ponto de decolagem'>" +
      "<button type='button' data-m='automatico' aria-pressed='true'>Automático</button>" +
      "<button type='button' data-m='dirigir' aria-pressed='false'>Eu levo a camionete</button></div>" +
      "<p id='xgPontoDesc' style='margin:8px 0 0;font-size:13px;line-height:1.5;color:#C3CCD5'></p>";
    var desc = bloco.querySelector("#xgPontoDesc");
    var textos = {
      automatico: "O ponto de decolagem é o que o mapa traz: camionete, carretinha e equipe já estão no lugar.",
      dirigir: trR("Você dirige a camionete com a carretinha pelo mapa, para e escolhe onde colocar o drone, de 6 a " + RAIO_ESCOLHA + " m do veículo (mais perto o drone não decola). Seu tempo só conta depois da base montada.", "You drive the truck with the trailer around the map, stop, and choose where to put the drone, 6 to " + RAIO_ESCOLHA + " m from the vehicle (closer than that the drone will not take off). Your time only counts after the base is set up.", "Conduces la camioneta con el remolque por el mapa, te detienes y eliges dónde colocar el dron, de 6 a " + RAIO_ESCOLHA + " m del vehículo (más cerca el dron no despega). Tu tiempo solo cuenta después de montar la base."),
    };
    function marcar(m) {
      modo = m;
      bloco.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.m === m)); });
      desc.textContent = textos[m];
    }
    bloco.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () { marcar(b.dataset.m); }); });
    marcar("automatico");
    /* so administrador: a conta pode demorar a ficar pronta, entao confere de tempos em tempos */
    function acesso() {
      var ok = liberado();
      bloco.hidden = !ok;
      if (!ok && modo !== "automatico") marcar("automatico");
    }
    acesso(); setInterval(acesso, 1500);
    /* as opcoes da tela inicial vivem num recipiente unico colado no Comecar (vento_opcao.js); o ponto de decolagem vai em cima do vento */
    var cont = window.xgOpcoesInicio && window.xgOpcoesInicio();
    if (cont) cont.insertBefore(bloco, cont.firstChild);
    else {
      var posicionar = function () { if (comecarBtn.parentNode && bloco.nextSibling !== comecarBtn) comecarBtn.parentNode.insertBefore(bloco, comecarBtn); };
      posicionar();
      if (comecarBtn.parentNode && window.MutationObserver) new MutationObserver(posicionar).observe(comecarBtn.parentNode, { childList: true });
    }
    /* o botao Comecar: o jogo usa a propriedade onclick */
    var original = comecarBtn.onclick;
    comecarBtn.onclick = function (ev) {
      if (modo === "dirigir") { entrar(); return; }
      if (st) voltarAoAutomatico();
      restaurarVistaDoJogo();                             // o botao chama o comecar original, nao o embrulhado
      if (typeof original === "function") return original.call(this, ev);
      return comecar();
    };
  }

  /* --------------------------------------------------------- ganchos no jogo */
  /* A tela inicial mostra a camera orbital. Com a vista "Controle" ativa o laco desenhava a camera do controle (FPV) por cima: um
     retangulo com outra imagem, piscando (relato do Eduardo, 24/10/2026, ao voltar para a tela inicial). Ao abrir a tela inicial a vista
     vai para "Drone"; ao comecar de novo volta a que a pessoa estava usando. */
  var vistaDoJogo = null;
  function restaurarVistaDoJogo() {
    if (!vistaDoJogo) return;
    var v = vistaDoJogo; vistaDoJogo = null;
    if (vista !== v) definirVista(v);
  }
  var abrirInicioAntes = abrirInicio;
  abrirInicio = function () {
    var r = abrirInicioAntes.apply(this, arguments);
    if (vista === "controle") { vistaDoJogo = "controle"; definirVista("drone"); }
    return r;
  };
  var comecarAntes = comecar;
  comecar = function () { restaurarVistaDoJogo(); return comecarAntes.apply(this, arguments); };
  /* o botao "Tela inicial" do jogo guarda a funcao original (onclick = abrirInicio): passa a chamar a daqui */
  var botaoInicio = document.getElementById("bInicio");
  if (botaoInicio) botaoInicio.onclick = function () { return abrirInicio.apply(this, arguments); };

  var construirAntes = construirCenario;
  construirCenario = function () {
    var r = construirAntes.apply(this, arguments);
    st = null; G = null; COL = null; rodasT = null; anel = null; suave.y = suave.ty = null;
    baseOrig = { x: BASE.x, z: BASE.z };
    if (ativo) sairDaDirecao();
    return r;
  };
  var orbitarAntes = orbitarInicio;
  orbitarInicio = function (dt) {
    if (!ativo) return orbitarAntes.apply(this, arguments);
    try { quadroDirecao(dt); }
    catch (e) { if (erros++ < 3) console.warn("veiculo:", e); if (erros > 20) { try { cancelar(); } catch (x) { /* desiste */ } } }
  };

  /* ------------------------------------------------------------ API publica */
  API.liberado = liberado;
  /* pose da carretinha para o equipe.js (null = padrao do cenario) */
  API.carreta = function () { return st ? F.carreta(st) : null; };
  /* o ponto esta na camionete (mais a folga)? o equipe.js nao poe cadeira, mesa nem gerador em cima dela */
  API.camionete = function (x, z, folga) { return !!st && distCaixa(F.caixas(st).caminhao, x, z) < (folga || 0); };
  API.entrar = entrar;
  API.escolher = escolher;
  API.voltarADirigir = voltarADirigir;
  API.confirmar = confirmar;
  API.estacionar = confirmar;
  API.cancelar = cancelar;
  /* teste: poe o circulo num ponto (sem mouse) */
  API.apontar = function (x, z) { cand.x = x; cand.z = z; fixo = true; aval = st ? avaliarPonto(x, z) : aval; pintarPrevia(); return aval; };
  API.avaliar = function (x, z) { return st ? avaliarPonto(x, z) : null; };
  API.desnivel = desnivel;
  API.salvar = function () { return st ? { x: st.x, z: st.z, psi: st.psi, psit: st.psit } : null; };
  API.restaurar = function (s, tentativa) {
    if (!s) return;
    st = F.criar(0, 0, s.psi); st.x = s.x; st.z = s.z; st.psit = s.psit;
    if (achar()) { aplicarPoses(0, true); if (window.xgEquipe && window.xgEquipe.reposicionar) window.xgEquipe.reposicionar(); }
    else if ((tentativa || 0) < 20) setTimeout(function () { API.restaurar(s, (tentativa || 0) + 1); }, 500);
  };
  /* para teste no navegador (o laco de desenho para com a aba oculta): anda o mesmo passo do jogo */
  API.simular = function (segundos, comando) {
    if (!st && !(achar() && (st = F.criar(baseOrig.x + 10, baseOrig.z + 8, 0)))) return null;
    achar(); acharCarreta();
    var c0 = cmd; cmd = { acel: (comando && comando.acel) || 0, dir: (comando && comando.dir) || 0, freio: !!(comando && comando.freio) };
    var n = Math.round(segundos * 60);
    for (var i = 0; i < n; i++) avancar(1 / 60);
    aplicarPoses(0.016, true);
    cmd = c0;
    pronto = prontoParaEscolher();
    return API.estado();
  };
  API.estado = function () {
    if (!st) return null;
    var o = F.origem(st), t = F.carreta(st);
    return { x: o.x, z: o.z, psi: st.psi, v: st.v, delta: st.delta, gama: F.articulacao(st), carreta: t, fase: fase, pode: pronto.ok, msg: pronto.msg, cand: { x: cand.x, z: cand.z }, aval: aval, incl: copiar(incl) };
  };
  API.entradas = function () { return { toque: copiar(toque), gamepad: pad.vivo, cmd: copiar(cmd), cand: { x: cand.x, z: cand.z }, fixo: fixo }; };
  API.ver = function () { return { G: !!G, COL: !!COL, T: !!T, rodasT: !!rodasT, rodasCarreta: rodasCarreta ? rodasCarreta.length : 0, modo: modo, ativo: ativo, fase: fase }; };
  window.xgVeiculo = API;

  criarSeletor(); ligarEntrada();
})();
