/* ==========================================================================
   CAMIONETE RANZER + CARRETINHA LM: fisica da direcao (sem tela, sem three)

   24/10/2026 (Eduardo): "ela leva o carro e a carretinha onde ela quiser,
   dirigindo pelo mapa". Este arquivo so tem a conta; quem desenha, colide e
   estaciona e o veiculo.js. Fica separado para poder ser testado no Node
   (ferramentas/testar_veiculo_fisica.cjs).

   Convencao (a mesma do jogo para caixas de colisao, ver bloqueiaCaminhada):
   - angulo psi em radianos, frente do veiculo f = (cos psi, sin psi) no plano
     (x, z); a direita de quem dirige e n = (-sin psi, cos psi);
   - o grupo three da camionete gira com rotation.y = -psi (o GLB aponta +X);
   - posicao do estado = EIXO TRASEIRO (x, z), que e o ponto onde a conta da
     bicicleta e exata. A origem do modelo fica 1,54 m a frente dele.

   Medidas (todas tiradas dos .glb, ver AGENTS.md):
   - camionete: entre-eixos 3,22 m (eixo traseiro a -1,54, dianteiro a +1,68
     da origem), bola do engate a -2,80 m da origem, caixa 5,3 x 1,95 m;
   - carretinha: bocal a 3,15 m a frente da origem dela, tandem de dois eixos
     com o meio a 0,315 m atras da origem (distancia bocal-eixo efetivo
     L = 3,465 m), caixa de -1,93 a +3,24 m e 2,47 m de largura.
   ========================================================================== */
(function (raiz) {
  "use strict";

  var K = {
    entreEixos: 3.22,
    origemAoEixoTraseiro: 1.54,
    origemAoEixoDianteiro: 1.68,
    bolaAtrasDaOrigem: 2.80,
    bocalAdiante: 3.15,           // origem da carretinha -> bocal
    eixoCarretaAtras: 0.315,      // origem da carretinha -> meio do tandem
    caminhao: { frente: 2.5, tras: 2.8, meia: 0.98 },   // caixa em relacao a ORIGEM (frente = +f)
    carreta: { frente: 2.9, tras: 1.93, meia: 1.2 },    // idem, em relacao a origem da carretinha
    vMaxFrente: 6.5, vMaxRe: 2.4,                        // m/s (23 km/h e 8,6 km/h)
    acel: 2.2, acelRe: 1.4, freio: 5.5, freioMao: 8, arrasto: 0.9,
    deltaMax0: 0.52, deltaMax1: 0.2,                     // 30 graus parado, 11 graus a 23 km/h
    taxaVolante: 1.3, taxaVolanteVolta: 2.4,
    gamaMaxAssist: 0.52,                                 // articulacao pedida em re (30 graus)
    kd: 0.45,                                            // ganho do controle da re assistida (1/m)
    gamaLimite: 1.15,                                    // 66 graus: acima disso a re para
    subpasso: 1 / 120,
  };
  K.bolaAoEixo = K.bolaAtrasDaOrigem - K.origemAoEixoTraseiro;   // 1,26 m para tras
  K.L = K.bocalAdiante + K.eixoCarretaAtras;                     // bocal -> eixo efetivo

  function trava(v, a, b) { return v < a ? a : v > b ? b : v; }
  function aproxima(v, alvo, passo) { return v < alvo ? Math.min(alvo, v + passo) : Math.max(alvo, v - passo); }
  function normaliza(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  /* estado a partir da ORIGEM do grupo da camionete e do rumo; a carretinha sai reta, atras */
  function criar(ox, oz, psi) {
    return {
      x: ox - Math.cos(psi) * K.origemAoEixoTraseiro,
      z: oz - Math.sin(psi) * K.origemAoEixoTraseiro,
      psi: psi, psit: psi,
      v: 0, delta: 0, giroRoda: 0, giroRodaCarreta: 0,
      assistida: true, dobrada: false,
    };
  }
  function origem(s) {
    return { x: s.x + Math.cos(s.psi) * K.origemAoEixoTraseiro, z: s.z + Math.sin(s.psi) * K.origemAoEixoTraseiro };
  }
  function bola(s) {
    return { x: s.x - Math.cos(s.psi) * K.bolaAoEixo, z: s.z - Math.sin(s.psi) * K.bolaAoEixo };
  }
  /* origem do grupo da carretinha: o bocal fica sobre a bola */
  function carreta(s) {
    var b = bola(s);
    return { x: b.x - Math.cos(s.psit) * K.bocalAdiante, z: b.z - Math.sin(s.psit) * K.bocalAdiante, psi: s.psit };
  }
  function articulacao(s) { return normaliza(s.psi - s.psit); }

  /* caixas orientadas (centro, rumo, meio comprimento, meia largura) */
  function caixaDe(px, pz, psi, caixa) {
    var c = Math.cos(psi), sn = Math.sin(psi), m = (caixa.frente - caixa.tras) / 2;
    return { x: px + c * m, z: pz + sn * m, psi: psi, meiaL: (caixa.frente + caixa.tras) / 2, meiaW: caixa.meia };
  }
  function caixas(s) {
    var o = origem(s), t = carreta(s);
    return { caminhao: caixaDe(o.x, o.z, s.psi, K.caminhao), carreta: caixaDe(t.x, t.z, t.psi, K.carreta) };
  }

  /* o volante pedido pelo piloto: a velocidade fecha o angulo; em re com a carretinha a ajuda
     transforma A/D no sentido para onde a CARRETINHA deve ir (feedback linear do angulo de
     articulacao: gama' = psi' (1 + HR cos g / L) - v sin g / L) */
  function deltaPedido(s, cmd) {
    var fator = Math.min(1, Math.abs(s.v) / K.vMaxFrente);
    var maximo = K.deltaMax0 - (K.deltaMax0 - K.deltaMax1) * fator;
    if (s.assistida && s.v < -0.05) {
      var g = articulacao(s);
      var alvoG = cmd.dir * K.gamaMaxAssist;
      var termo = Math.sin(g) / K.L + K.kd * (g - alvoG);
      var tg = K.entreEixos / (1 + K.bolaAoEixo * Math.cos(g) / K.L) * termo;
      return trava(Math.atan(tg), -K.deltaMax0, K.deltaMax0);
    }
    return cmd.dir * maximo;
  }

  /* um passo de dt segundos (cmd = { acel: -1..1, dir: -1..1, freio: bool }); devolve o estado */
  function passo(s, cmd, dt) {
    var n = Math.max(1, Math.ceil(dt / K.subpasso)), h = dt / n;
    for (var i = 0; i < n; i++) subpasso(s, cmd, h);
    return s;
  }
  function subpasso(s, cmd, h) {
    /* velocidade */
    var v = s.v;
    if (cmd.freio) v = aproxima(v, 0, K.freioMao * h);
    else if (cmd.acel > 0) v = v < -0.02 ? aproxima(v, 0, K.freio * h) : aproxima(v, K.vMaxFrente * cmd.acel, K.acel * h);
    else if (cmd.acel < 0) v = v > 0.02 ? aproxima(v, 0, K.freio * h) : aproxima(v, K.vMaxRe * cmd.acel, K.acelRe * h);
    else v = aproxima(v, 0, K.arrasto * h);
    /* a carretinha dobrando demais: a re para (so se desfaz indo para a frente) */
    s.dobrada = false;
    if (v < 0 && Math.abs(articulacao(s)) > K.gamaLimite) { v = 0; s.dobrada = true; }
    s.v = v;

    /* volante */
    var alvo = deltaPedido(s, cmd), d = s.delta;
    var taxa = Math.abs(alvo) > Math.abs(d) ? K.taxaVolante : K.taxaVolanteVolta;
    s.delta = aproxima(d, alvo, taxa * h);

    /* camionete (bicicleta, referencia no eixo traseiro) */
    var w = v * Math.tan(s.delta) / K.entreEixos;
    var fx = Math.cos(s.psi), fz = Math.sin(s.psi), nx = -fz, nz = fx;
    /* velocidade da bola do engate: v f - (bola atras do eixo) * psi' n */
    var hvx = v * fx - K.bolaAoEixo * w * nx, hvz = v * fz - K.bolaAoEixo * w * nz;
    /* carretinha: o eixo efetivo so anda ao longo do proprio rumo */
    var ntx = -Math.sin(s.psit), ntz = Math.cos(s.psit);
    var wt = (hvx * ntx + hvz * ntz) / K.L;
    s.x += v * fx * h;
    s.z += v * fz * h;
    s.psi = normaliza(s.psi + w * h);
    s.psit = normaliza(s.psit + wt * h);
    s.giroRoda += v * h / 0.385;
    s.giroRodaCarreta += (hvx * Math.cos(s.psit) + hvz * Math.sin(s.psit)) * h / 0.35;
  }

  /* ---------------------------------------------------------- colisao (so geometria) */
  /* SAT entre duas caixas orientadas { x, z, psi, meiaL, meiaW } */
  function caixaComCaixa(a, b) {
    var eixos = [
      [Math.cos(a.psi), Math.sin(a.psi)], [-Math.sin(a.psi), Math.cos(a.psi)],
      [Math.cos(b.psi), Math.sin(b.psi)], [-Math.sin(b.psi), Math.cos(b.psi)],
    ];
    var dx = b.x - a.x, dz = b.z - a.z;
    for (var i = 0; i < 4; i++) {
      var ex = eixos[i][0], ez = eixos[i][1];
      var ra = Math.abs(Math.cos(a.psi) * ex + Math.sin(a.psi) * ez) * a.meiaL + Math.abs(-Math.sin(a.psi) * ex + Math.cos(a.psi) * ez) * a.meiaW;
      var rb = Math.abs(Math.cos(b.psi) * ex + Math.sin(b.psi) * ez) * b.meiaL + Math.abs(-Math.sin(b.psi) * ex + Math.cos(b.psi) * ez) * b.meiaW;
      if (Math.abs(dx * ex + dz * ez) > ra + rb) return false;
    }
    return true;
  }
  function caixaComCirculo(a, cx, cz, r) {
    var dx = cx - a.x, dz = cz - a.z;
    var lx = trava(dx * Math.cos(a.psi) + dz * Math.sin(a.psi), -a.meiaL, a.meiaL);
    var lz = trava(-dx * Math.sin(a.psi) + dz * Math.cos(a.psi), -a.meiaW, a.meiaW);
    var px = a.x + lx * Math.cos(a.psi) - lz * Math.sin(a.psi), pz = a.z + lx * Math.sin(a.psi) + lz * Math.cos(a.psi);
    return Math.hypot(cx - px, cz - pz) < r;
  }
  /* os 4 cantos e os 4 meios dos lados (para testar agua e limite do mapa) */
  function pontosDe(a) {
    var c = Math.cos(a.psi), sn = Math.sin(a.psi), pts = [];
    [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1], [0, 0]].forEach(function (k) {
      var lx = k[0] * a.meiaL, lz = k[1] * a.meiaW;
      pts.push([a.x + lx * c - lz * sn, a.z + lx * sn + lz * c]);
    });
    return pts;
  }

  var API = {
    K: K, criar: criar, passo: passo, origem: origem, bola: bola, carreta: carreta,
    articulacao: articulacao, caixas: caixas, caixaDe: caixaDe, normaliza: normaliza,
    caixaComCaixa: caixaComCaixa, caixaComCirculo: caixaComCirculo, pontosDe: pontosDe,
  };
  raiz.XGVeiculoFisica = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
