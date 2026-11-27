/* Pacotes de gotas e dose acumulada. Coeficientes de treinamento, nao CFD.
   Ver estudos/fisica-gotas.md. P.faixa pertence a rota e nunca e alterado aqui. */
window.PULVERIZACAO = (function () {
  "use strict";
  // Autossuficiente: executado no iframe por toString e nos testes Node.
  function criarMotor(perfil, superficie, depositar) {
    var gotas = [], sequencia = 0;
    var total = { emitido: 0, depositado: 0, evaporado: 0, disperso: 0 };
    function limitar(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function largura(h, gota, velocidade, contra) {
      h = Math.max(0, h);
      var movimento = limitar(velocidade, 0, 1);
      var parado = 2 * Math.max.apply(null, perfil.bicos.map(function (b) { return Math.abs(b.lado); })) + .45;
      // 18/11/2026 (Eduardo, sobre o vento abrir a faixa): "so se o vento estiver do lado contrario; se tiver no mesmo
      // sentido ele fecha e lateralmente ele move; quando ele ta no mesmo sentido o produto cai direto de baixo do drone,
      // porem quando ta o contrario o produto fica mais longe, igual quando aumenta e diminuiu a velocidade".
      // contra = parte do vento CONTRA o sentido do voo, m/s (de frente = positivo; a favor = negativo; de lado = 0).
      // A tabela e lida na velocidade do drone EM RELACAO AO AR: vento de frente vale como voar mais rapido (abre) e vento
      // a favor como voar mais devagar (fecha). Vento de lado nao entra aqui: so desloca as gotas (em "avancar").
      var fina = limitar((500 - gota) / 450, 0, 1), kmh = Math.max(0, velocidade + (contra || 0)) * 3.6;
      // Numeros do operador, nao uma lei agronomica universal.
      // 17/11/2026 (Eduardo, T50 a 4 m de altura): "36 km/h com gota mais fina faz 12 metros de faixa ... com a gota grossa
      // dele faz 9, 25 km e gota mais fina faz 9, gota grossa faz 8, abaixo de 18 km/h gota fina faz 8 gota grossa faz 6,
      // reveja os outros modelos, cada parametros modifica um pouco a faixa onde o drone reduz velocidade tambem afeta".
      // perfil.f4 = essa tabela a 4 m: largura com a gota mais grossa e com a mais fina em tres velocidades (km/h). Entre os
      // pontos vai em reta; abaixo da primeira velocidade e acima da ultima fica no valor da ponta. A velocidade e a REAL do
      // drone no instante: onde ele freia (curva, obstaculo) a faixa fecha.
      var T = perfil.f4 || { v: [18, 25, 36], grossa: [6, 8, 9], fina: [8, 9, 12] };
      function naVelocidade(t) {
        var v = T.v;
        return kmh <= v[0] ? t[0] : kmh <= v[1] ? t[0] + (t[1] - t[0]) * (kmh - v[0]) / (v[1] - v[0]) :
          kmh <= v[2] ? t[1] + (t[2] - t[1]) * (kmh - v[1]) / (v[2] - v[1]) : t[2];
      }
      var grossa4 = naVelocidade(T.grossa), w4 = grossa4 + (naVelocidade(T.fina) - grossa4) * fina;
      if (perfil.revo) {
        // Atomizador rotativo (XAG, EAVision, Ceres): faixa de referencia do modelo a 3 m (P60: "a 3 de altura coloca 6,5 de
        // faixa", Eduardo, 08/10/2026), abrindo com a altura. 17/11/2026 (Eduardo: "o xag tambem precisa ter esse tipo de
        // variacao ela nunca e sempre da mesma forma"): gota e velocidade mexem nela pela metade do efeito que tem no T50,
        // em volta do ponto do meio (25 km/h, gota media). No P60 a 3 m da de 5,5 a 7,8 m (ficha: 5 a 8 m). Estimativa:
        // nao ha medida real desses modelos.
        var meio = (T.grossa[1] + T.fina[1]) / 2;
        var wr = perfil.revo * limitar(.45 + .55 * h / 3, .6, 1.15) * (1 + .5 * (w4 / meio - 1));
        return parado * (1 - movimento) + Math.min(perfil.max, wr) * movimento;
      }
      // A = em que ponto da tabela esta (0 = gota grossa devagar; 1 = gota mais fina na velocidade maxima).
      var A = limitar((w4 - T.grossa[0]) / (T.fina[2] - T.grossa[0]), 0, 1);
      // A 3 m continuam os pontos anteriores dele e do manual: gota grossa devagar = 4 m (perfil.min); gota mais fina na
      // velocidade maxima = teto do manual (perfil.max; T50: 11 m). Abaixo de 3 m fecha na proporcao 1,5 / 2,5 / 4 m (1 / 2 /
      // 3 m de altura). De 3 a 4 m vai em reta ate a tabela. Acima de 4 m ainda abre um pouco e para aos 6 m.
      var min3 = perfil.min == null ? 4 : perfil.min, w3 = min3 + (perfil.max - min3) * A;
      var base = h <= 1 ? .45 + 1.05 * h : h <= 2 ? 1.5 + (h - 1) : 2.5 + 1.5 * (h - 2);
      var w = h < 3 ? w3 * base / 4 : h <= 4 ? w3 + (w4 - w3) * (h - 3) :
        w4 + (w4 - w3) * (.4 * Math.min(1, h - 4) + .2 * limitar(h - 5, 0, 1));
      // perfil.teto = largura que o modelo nunca passa, em nenhuma altura (T25: 9 m).
      if (perfil.teto) w = Math.min(perfil.teto, w);
      return parado * (1 - movimento) + w * movimento;
    }
    function emitir(e, litros, dt) {
      if (!(litros > 0) || !(dt > 0)) return;
      var n = Math.max(2, Math.ceil(dt * 1200 / 2) * 2);
      var fx = Math.cos(e.yaw), fz = -Math.sin(e.yaw), lx = fz, lz = -fx;
      var h = Math.max(0, e.y - superficie(e.x, e.z));
      // 19/11/2026 (Eduardo, P60: na virada "a faixa tambem da uma reduzida"): e.estreita = fator da faixa na troca de faixa do
      // XAG (campo: V.xgFaixaK; 1 fora da curva).
      var w = largura(h, e.gota, e.vel, e.contra) * (e.estreita || 1);
      // 19/11/2026: "Somente bicos externos" na troca de faixa do XAG. e.soLado = lado de fora da curva (1 = esquerda, -1 =
      // direita; vem do campo, V.xgSoLado): so os atomizadores desse lado emitem e as gotas abrem so para esse lado.
      var bicos = perfil.bicos;
      if (e.soLado) { var deFora = bicos.filter(function (q) { return (q.lado >= 0 ? 1 : -1) === e.soLado; }); if (deFora.length) bicos = deFora; }
      for (var k = 0; k < n; k++) {
        var s = ++sequencia, b = bicos[s % bicos.length];
        var ang = s * 2.399963229728653, raio = Math.sqrt((s * .7548776662466927) % 1);
        var diam = limitar(e.gota * [0.7, 1, 1, 1, 1.3][s % 5], 35, 650);
        // Fracao de gotas finas que escapa do jato descendente: mesmo volume,
        // nao uma segunda emissao. Fracao e limiar sao calibracao didatica.
        var movimento = limitar(e.vel, 0, 1);
        var intensidade = limitar(e.vel / perfil.velMax, 0, 1) * limitar((500 - diam) / 450, 0, 1);
        var fracaoVeu = intensidade;
        var veu = h > .5 && e.rotores && (s * .5698402909980532) % 1 < fracaoVeu;
        var tau = .025 + .16 * Math.pow(diam / 500, 1.4);
        var x = e.x + lx * b.lado - fx * b.tras;
        var z = e.z + lz * b.lado - fz * b.tras;
        var y = Math.max(e.y + .3, superficie(x, z) + .03);
        var queda = (e.rotores ? 2.8 / (1 + e.vel * .025) : 0) + 9.81 * tau;
        // Revisao do operador: ate 2 s com rotores, jato descendente reforcado.
        // Fluxo muda a massa/visibilidade, nao multiplica o tempo de queda.
        if (e.rotores) queda = Math.max((y - superficie(x, z)) / 2,
          queda * (1 - intensidade) + (3.3 / 2) * intensidade);
        var tempo = Math.max(.03, (y - superficie(x, z)) / queda);
        // Solo: circulos separados. No ar: arraste dos jatos para o centro.
        var centro = b.lado * (1 - .85 * limitar(h, 0, 1) * movimento);
        var r = .22 * (1 - movimento) + Math.max(.22, w / 2 - Math.abs(centro)) * movimento;
        var abre = Math.cos(ang) * raio * r;
        if (e.soLado) abre = e.soLado * Math.abs(abre);
        var lateral = centro - b.lado + abre;
        // 19/11/2026 (Eduardo, vendo o comeco da passada: "quando o drone acelera ele joga o produto pra tras entao nao fica esse
        // furo ali"): e.tras = metros que a calda cai para tras do bico enquanto a aeronave acelera (campo: V.xgTras; 0 fora disso).
        var longitudinal = Math.sin(ang) * raio * r / (1 + e.vel * .2) - (e.tras || 0);
        var p = { x: x, y: y, z: z, vy: -queda,
          vx: e.vx || 0, vz: e.vz || 0,
          ax: (lx * lateral + fx * longitudinal) / tempo,
          az: (lz * lateral + fz * longitudinal) / tempo,
          tau: tau, d: diam, d0: diam, l: litros / n, inicial: litros / n,
          idade: 0, voo: 0, rotores: !!e.rotores, veu: veu, intensidade: intensidade, jato: tempo, passe: e.passe, dose: Math.max(.1, e.dose || 20) };
        // Campo lateral calibrado; velocidade herdada do drone relaxa no ar.
        gotas.push(p);
      }
      total.emitido += litros;
    }
    function avancar(dt, clima) {
      if (!(dt > 0)) return;
      var wx = Math.cos(clima.dir) * clima.vel, wz = Math.sin(clima.dir) * clima.vel;
      var umidade = limitar(clima.umidade == null ? 70 : clima.umidade, 0, 100);
      var temperatura = limitar(clima.temperatura == null ? 25 : clima.temperatura, 0, 50);
      for (var i = gotas.length - 1; i >= 0; i--) {
        var p = gotas[i], t = Math.min(dt, Math.max(0, (p.y - superficie(p.x, p.z)) / -p.vy));
        var relax = Math.exp(-t / p.tau), f = p.tau * (1 - relax);
        var ux = wx, uz = wz;
        // O sopro mantem o inicio do jato vertical; a abertura cresce depois.
        // Integral suave preserva a faixa final e independe da taxa de quadros.
        var a0 = limitar(p.voo / p.jato, 0, 1), a1 = limitar((p.voo + t) / p.jato, 0, 1);
        var abertura = p.rotores ? a1 * a1 * (3 - 2 * a1) - a0 * a0 * (3 - 2 * a0) : a1 - a0;
        p.x += p.ax * p.jato * abertura; p.z += p.az * p.jato * abertura;
        p.voo += t;
        p.x += ux * t + (p.vx - ux) * f; p.z += uz * t + (p.vz - uz) * f;
        p.vx = ux + (p.vx - ux) * relax; p.vz = uz + (p.vz - uz) * relax;
        p.y += p.vy * t; p.idade += dt;
        // Lei d² simplificada; 5% de residuo nao volatil, valor de treinamento.
        var d2 = Math.max(p.d0 * p.d0 * Math.pow(.05, 2 / 3),
          p.d * p.d - 160 * (1 - umidade / 100) * Math.exp((temperatura - 25) / 20) * t);
        p.d = Math.sqrt(d2);
        var restante = p.inicial * Math.pow(p.d / p.d0, 3);
        total.evaporado += Math.max(0, p.l - restante); p.l = restante;
        if (p.y <= superficie(p.x, p.z) + .001) {
          depositar(p); total.depositado += p.l;
          gotas[i] = gotas[gotas.length - 1]; gotas.pop();
        } else if (p.idade > 30) {
          total.disperso += p.l; gotas[i] = gotas[gotas.length - 1]; gotas.pop();
        }
      }
    }
    return { gotas: gotas, total: total, largura: largura, emitir: emitir, avancar: avancar,
      limpar: function () { gotas.length = 0; sequencia = 0; Object.keys(total).forEach(function (k) { total[k] = 0; }); } };
  }

  function instalarNoCampo(perfil, criar, climaAvancar) {
    if (window.xgPulv) return true;
    if (typeof pintarFaixa !== "function" || typeof passo !== "function") return false;
    var X = window.xgPulv = {
      versao: 2, perfil: perfil, bicos: perfil.bicos,
      vento: { vel: .8 + Math.random() * 3.7, dir: Math.random() * Math.PI * 2, temperatura: 25, umidade: 70, dinamico: true },
      litros: new Float32Array(COB_W * COB_H), dose: new Float32Array(COB_W * COB_H),
      dosePasse: new Float32Array(COB_W * COB_H),
      foraGrade: 0, espelho: false
    };
    function superficie(x, z) {
      var cultura = typeof window.__xgDossel === "function" ? Number(window.__xgDossel(x, z)) || 0 : 0;
      return alt(x, z) + Math.max(0, cultura);
    }
    /* 21/11/2026 (Eduardo, P60 no beta: "ta circulado o problema" - manchas claras DENTRO da faixa pulverizada): cada gota
       pintava so 2 x 2 celulas (50 cm); com ~1,5 gota por celula, 14% do miolo da faixa ficava abaixo da metade da dose e, de
       longe, esses pontos viravam manchas claras. Agora cada gota molha uma pegada de ~1,25 m (5 x 5 celulas, peso em cone):
       mesmo volume e mesma faixa, sem celula abaixo da metade da dose. Antes era bilinear 2 x 2 (dx/dz). */
    var PESO = new Float32Array(25);
    function depositar(p) {
      var gx = (p.x - PINT.x0) * COB_PX - .5, gz = (p.z - PINT.z0) * COB_PX - .5;
      var ix = Math.round(gx), iz = Math.round(gz), soma = 0;
      for (var a = -2; a <= 2; a++) for (var b = -2; b <= 2; b++) {
        var w = Math.max(0, 2.5 - Math.sqrt((ix + b - gx) * (ix + b - gx) + (iz + a - gz) * (iz + a - gz)));
        PESO[(a + 2) * 5 + b + 2] = w; soma += w;
      }
      for (var j = -2; j <= 2; j++) for (var k = -2; k <= 2; k++) {
        var peso = PESO[(j + 2) * 5 + k + 2];
        if (!(peso > 0)) continue;
        var l = p.l * peso / soma, cx = ix + k, cz = iz + j;
        if (cx < 0 || cz < 0 || cx >= COB_W || cz >= COB_H) { X.foraGrade += l; continue; }
        var c = cz * COB_W + cx;
        var relativa = l * COB_PX * COB_PX * 10000 / p.dose;
        X.litros[c] += l; X.dose[c] += relativa;
        if (cobPasse[c] !== p.passe) { X.dosePasse[c] = 0; cobPasse[c] = p.passe; }
        var antes = X.dosePasse[c]; X.dosePasse[c] += relativa;
        // Uma passada so conta ao atingir 50% da dose-alvo nesta celula.
        // Ficar parado escurece a dose, mas nao inventa outra passada.
        if (antes < .5 && X.dosePasse[c] >= .5 && cobN[c] < 255) cobN[c]++;
        var t = ((COB_H - 1 - cz) * COB_W + cx) * 4;
        pintDados[t] = 40; pintDados[t + 1] = 30; pintDados[t + 2] = 19;
        pintDados[t + 3] = Math.min(225, Math.round(170 * (1 - Math.exp(-X.dose[c])) + 35 * Math.min(1, X.dose[c])));
        pintMudou = true;
      }
    }
    var motor = X.motor = criar(perfil, superficie, depositar);
    // Nuvem visivel amostrada SOMENTE dos pacotes finos ainda suspensos.
    // Uma chamada de desenho, sem inventar litros ou manter gotas no chao.
    var veuVisual = null, NV = 256;
    X.veu = { ativos: 0, litros: 0 };
    if (typeof THREE !== "undefined" && typeof cena !== "undefined") {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
      geo.setAttribute("opacidade", new THREE.BufferAttribute(new Float32Array(NV), 1));
      geo.setAttribute("tamanho", new THREE.BufferAttribute(new Float32Array(NV), 1));
      var mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
        uniforms: { escala: { value: 500 } },
        vertexShader: 'attribute float opacidade; attribute float tamanho; varying float op; uniform float escala; void main(){op=opacidade;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(tamanho*escala/max(0.1,-p.z),1.0,96.0);}',
        fragmentShader: 'varying float op; void main(){float r=length(gl_PointCoord-vec2(0.5))*2.0;if(r>1.0||op<=0.0)discard;gl_FragColor=vec4(0.94,0.97,1.0,op*pow(1.0-r*r,2.0));}' });
      veuVisual = new THREE.Points(geo, mat); veuVisual.frustumCulled = false;
      veuVisual.name = "veu-de-noiva"; cena.add(veuVisual);
    }
    function desenharVeu() {
      var finas = motor.gotas; // Inclui os dois jatos concentrados em baixa velocidade.
      X.veu.ativos = finas.length;
      X.veu.litros = finas.reduce(function (s, p) { return s + p.l; }, 0);
      if (!veuVisual) return;
      var atributos = veuVisual.geometry.attributes, n = Math.min(NV, finas.length);
      for (var i = 0; i < NV; i++) {
        var p = i < n ? finas[Math.floor(i * finas.length / n)] : null;
        atributos.opacidade.array[i] = p ? Math.min(.18, .028 * p.l / .00008333 * Math.max(1, finas.length / NV) * Math.pow(250 / p.d, .65)) * Math.min(1, p.idade * 3) * Math.min(1, (30 - p.idade) / 3) : 0;
        if (!p) continue;
        atributos.position.array[i * 3] = p.x;
        atributos.position.array[i * 3 + 1] = p.y;
        atributos.position.array[i * 3 + 2] = p.z;
        atributos.tamanho.array[i] = .22 + Math.min(1.1, p.idade * (.08 + .22 * p.intensidade));
      }
      Object.keys(atributos).forEach(function (k) { atributos[k].needsUpdate = true; });
      if (typeof render !== "undefined") veuVisual.material.uniforms.escala.value = render.domElement.height * .6;
      veuVisual.visible = n > 0;
    }
    // Parte do vento contra o sentido em que o drone anda, m/s (de frente = positivo, a favor = negativo). X.vento.dir e
    // para onde o ar vai (o mesmo vetor que leva as gotas em "avancar"). Sem velocidade util, vale a frente do drone.
    function contraVento(e) {
      var m = Math.hypot(e.vx, e.vz), tx = m > .2 ? e.vx / m : Math.cos(e.yaw), tz = m > .2 ? e.vz / m : -Math.sin(e.yaw);
      return -(Math.cos(X.vento.dir) * tx + Math.sin(X.vento.dir) * tz) * (Number(X.vento.vel) || 0);
    }
    function estado() {
      var d = drone.position, manual = V.estado === "manual";
      var e = { x: d.x, y: d.y, z: d.z, yaw: V.yaw || 0, vel: Math.max(0, V.v || 0),
        vx: manual ? V.mvx || 0 : (V.v || 0) * (V.dirx || 0),
        vz: manual ? V.mvz || 0 : (V.v || 0) * (V.dirz || 0),
        gota: Number(P.gota) || 250, dose: P.vazao, rotores: !!V.rodando, soLado: V.xgSoLado || 0, estreita: V.xgFaixaK || 1, tras: V.xgTras || 0,
        passe: manual && window.xgPulvManual ? window.xgPulvManual.passe : V.i };
      e.contra = contraVento(e);
      return e;
    }
    larguraEfetiva = function () {
      var e = estado(); return motor.largura(Math.max(0, e.y - superficie(e.x, e.z)), e.gota, e.vel, e.contra) * e.estreita;
    };
    X.deriva = function () { return X.vento.vel * Math.max(0, drone.position.y - superficie(drone.position.x, drone.position.z)) / 3; };
    pintarFaixa = function () {}; // apenas gotas que atingem o alvo pintam
    var limparAntes = limparCobertura;
    limparCobertura = function () {
      limparAntes.apply(this, arguments); X.litros.fill(0); X.dose.fill(0); X.dosePasse.fill(0); X.foraGrade = 0; motor.limpar();
      desenharVeu();
    };
    var passoAntes = passo, avancou = false;
    passo = function (dt) {
      if (!X.espelho) climaAvancar(X.vento, dt);
      var tanque = V.tan, x = drone.position.x, z = drone.position.z;
      var resultado = passoAntes.apply(this, arguments);
      var litros = Math.max(0, tanque - V.tan);
      if (litros > 0 && !P.xgMapeamento && P.xgPulverizar !== false && !window.__xgSemPintar) {
        var e = estado(); e.x = (e.x + x) / 2; e.z = (e.z + z) / 2;
        motor.emitir(e, litros, dt);
      }
      motor.avancar(dt, X.vento); avancou = true;
      return resultado;
    };
    X.receber = function (x, dt) {
      X.espelho = true;
      // Pausa congela tambem as gotas; emitir apenas atualiza a geometria.
      if (x.pausa) { avancou = true; return; }
      if (x.pf) { perfil.min = x.pf.min; perfil.max = x.pf.max; perfil.f4 = x.pf.f4; perfil.revo = x.pf.revo; perfil.teto = x.pf.teto; perfil.velMax = x.pf.velMax; perfil.bicos = x.pf.bicos; }
      V.yaw = (x.ry || 0) - Math.PI / 2; V.v = x.v || 0; V.rodando = !!x.h;
      if (x.g != null) P.gota = x.g;
      if (x.vt) { X.vento.vel = x.vt[0]; X.vento.dir = x.vt[1]; X.vento.rajada = x.vt[2] == null ? x.vt[0] : x.vt[2]; }
      if (x.cl) { X.vento.temperatura = x.cl[0]; X.vento.umidade = x.cl[1]; }
      var e = estado(); e.passe = x.ps; e.dose = x.dose || 20;
      e.vx = x.vxz ? x.vxz[0] : Math.cos(e.yaw) * e.vel;
      e.vz = x.vxz ? x.vxz[1] : -Math.sin(e.yaw) * e.vel;
      e.contra = contraVento(e);
      motor.emitir(e, Math.max(0, x.fl || 0) / 60 * dt, dt);
      motor.avancar(dt, X.vento); avancou = true;
    };
    emitir = function (dt) {
      var pul = window.xgPulvManual;
      // Mapeamento nunca aciona a bomba, inclusive com esgotamento restaurado.
      if (!X.espelho && P.xgMapeamento) {
        if (pul) { pul.ligado = false; pul.esgotar = false; }
        V.aplicando = false; V.vazaoAtual = 0;
      }
      if (!X.espelho && pul && pul.esgotar) {
        var litros = Math.min(T50.vazaoMaxLmin / 60 * dt, V.tan);
        V.tan -= litros; V.calda = (V.calda || 0) + litros; V.vazaoAtual = dt > 0 ? litros / dt * 60 : 0;
        motor.emitir(estado(), litros, dt);
        if (V.tan <= 0) { pul.esgotar = false; V.vazaoAtual = 0; }
      }
      if (!avancou) {
        if (!X.espelho) climaAvancar(X.vento, dt);
        motor.avancar(dt, X.vento);
      }
      avancou = false;
      if (nevoa) {
        var lista = motor.gotas, salto = Math.max(1, lista.length / NP);
        for (var i = 0; i < NP; i++) {
          var q = lista[Math.floor(i * salto)];
          nPos[i * 3] = q ? q.x : 0; nPos[i * 3 + 1] = q ? q.y : -999; nPos[i * 3 + 2] = q ? q.z : 0;
        }
        nevoa.material.size = .08 + Math.max(50, Number(P.gota) || 250) / 2500;
        nevoa.geometry.attributes.position.needsUpdate = true;
      }
      /* 18/11/2026 (Eduardo: "o drone ta travando no simulador"): a pintura do chao e uma textura de 960 x 1120 que era
         reenviada a placa de video a CADA quadro enquanto pulverizava (4,3 MB por quadro). Agora vai no maximo 20 vezes por
         segundo: a olho nu o rastro aparece na hora, e a placa trabalha um terco. */
      X.pintEm = (X.pintEm || 0) + dt;
      if (pintMudou && X.pintEm >= .05) { pintTx.needsUpdate = true; pintMudou = false; X.pintEm = 0; }
      desenharVeu();
    };
    var topo = document.getElementById("topo");
    if (topo && !document.getElementById("hVento")) {
      var caixa = document.createElement("div"); caixa.className = "v";
      caixa.innerHTML = '<span>Vento</span><b id="hVento"></b>';
      caixa.querySelector("b").textContent = X.vento.vel.toFixed(1) + " m/s";
      topo.appendChild(caixa);
    }
    return true;
  }
  /* Faixa de cada modelo (17/11/2026). max = teto do manual a 3 m de altura; min = gota grossa devagar a 3 m (4 m se nao
     vier); f4 = tabela a 4 m de altura (gota mais grossa e mais fina em tres velocidades, km/h); revo = atomizador
     rotativo: faixa de referencia a 3 m.
     T50: os seis numeros do f4 sao do Eduardo (17/11/2026).
     T25 (Eduardo, 17/11/2026): "faixa que vai de 5 e chega a no maximo 9 conforme as configuracoes de velocidade, tamanho
     de gota e altura": 5 a 9 m a 4 m, no desenho do T50, e nunca passa de 9 (teto).
     T70P (Eduardo, 17/11/2026): "mesmo esquema do t50 porem reduz menos faixa": mesmo topo do T50 e dois tercos da queda
     dele (a 4 m vai de 8 a 12 m; a 3 m, de 6,3 a 11 m). Os dois tercos sao estimativa.
     T100 e T10 NAO tem medida real: desenho do T50 na faixa oficial de cada um (T100: ficha da DJI, 5 a 13 m). */
  var PERFIS = {
    t50: { max: 11, f4: { v: [18, 25, 36], grossa: [6, 8, 9], fina: [8, 9, 12] }, velMax: 10, bicos: [{ lado: .9, tras: .55 }, { lado: -.9, tras: .55 }] },
    t25: { max: 8.25, teto: 9, f4: { v: [18, 25, 36], grossa: [5, 6.3, 7], fina: [6.3, 7, 9] }, velMax: 10, bicos: [{ lado: .7, tras: .45 }, { lado: -.7, tras: .45 }] },
    p60: { max: 8, revo: 6.5, velMax: 13.8, bicos: [{ lado: 1.05, tras: .77 }, { lado: -1.05, tras: .77 }] },
    /* P150 (21/11/2026): faixa oficial 5 a 10 m; atomizadores sob os motores de tras (xag_p150_dados.json) */
    p150: { max: 10, revo: 8, velMax: 13.8, bicos: [{ lado: .78, tras: .77 }, { lado: -.78, tras: .77 }] },
    /* P150 Max: faixa oficial 5 a 10 m; atomizadores embaixo dos motores de tras (medido no modelo) */
    p150max: { max: 10, revo: 8, velMax: 13.8, bicos: [{ lado: .84, tras: .84 }, { lado: -.84, tras: .84 }] },
    /* P100 Pro (13/10/2026): faixa oficial 5 a 10 m; atomizadores sob os motores de tras (gerar_p100pro.py) */
    p100pro: { max: 10, revo: 7.5, velMax: 13.8, bicos: [{ lado: .69, tras: .73 }, { lado: -.69, tras: .73 }] },
    /* 13/10/2026 - faixas das fichas oficiais; bicos medidos nos modelos 3D */
    t100: { min: 5, max: 13, f4: { v: [18, 25, 36], grossa: [7.5, 9.7, 10.8], fina: [9.7, 10.8, 14] }, velMax: 13.8, bicos: [{ lado: .85, tras: .8 }, { lado: -.85, tras: .8 }] },
    /* T70P (26/10/2026): 2 bicos pendurados nos motores de tras (medido no modelo), faixa 4 a 11 m */
    t70p: { min: 6.3, max: 11, f4: { v: [18, 25, 36], grossa: [8, 9.3, 10], fina: [9.3, 10, 12] }, velMax: 13.8, bicos: [{ lado: .937, tras: .79 }, { lado: -.937, tras: .79 }] },
    /* T10: 4 bicos de leque embaixo dos motores, faixa 3 a 5,5 m; voa ate 25 km/h, por isso a tabela dele vai ate ai */
    t10: { max: 5.5, f4: { v: [12.5, 17.5, 25], grossa: [4.8, 5.2, 5.4], fina: [5.2, 5.4, 6] }, velMax: 7, bicos: [{ lado: .54, tras: .49 }, { lado: -.54, tras: .49 }, { lado: .54, tras: -.49 }, { lado: -.54, tras: -.49 }] },
    /* EAVision: atomizadores centrifugos so nos bracos de tras (J150 tem 2 por braco) */
    j100: { max: 10, revo: 7, velMax: 10, bicos: [{ lado: .85, tras: .75 }, { lado: -.85, tras: .75 }] },
    j150: { max: 15, revo: 9, velMax: 13.8, bicos: [{ lado: .94, tras: .86 }, { lado: -.94, tras: .86 }, { lado: .76, tras: .71 }, { lado: -.76, tras: .71 }] },
    /* Ceres Air C31: 2 atomizadores na ponta de cada barra traseira (medido no modelo), ate 50 pes */
    c31: { max: 15, revo: 9, velMax: 17.9, bicos: [{ lado: .89, tras: 1.01 }, { lado: -.89, tras: 1.01 }, { lado: .72, tras: .84 }, { lado: -.72, tras: .84 }] }
  };
  function instalar(ponte, modelo) {
    if (ponte.janela && ponte.janela.xgPulv && ponte.janela.xgPulv.versao === 2) return true;
    var perfil = PERFIS[modelo && modelo.id] || PERFIS.t50;
    try {
      return ponte.ler("(" + instalarNoCampo.toString() + ")(" + JSON.stringify(perfil) + "," + criarMotor.toString() + "," + (window.METEOROLOGIA ? window.METEOROLOGIA.avancar.toString() : "function () {}") + ")") === true;
    } catch (e) { console.warn("Falha na fisica de pulverizacao", e); return false; }
  }
  return { instalar: instalar, criarMotor: criarMotor, perfis: PERFIS };
})();
