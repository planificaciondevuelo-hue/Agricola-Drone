/* DESTRUICAO DA AERONAVE NA QUEDA.
   18/11/2026 (Eduardo): "precisamos estudar o sistema de destruicao quando drone cai ou bate em arvore ou bate o carro ou bate em
   uma pessoa"; "ele nao pode sempre quebrar da mesma forma"; depois de ver so na conta dele: "ta sem fisica"; "coloca um botao de
   ir la ver o drone caido e ai a pessoa vai la e se tiver como a pessoa pode ver o replay de como o drone caiu estando la
   olhando"; "arruma essas coisas e pode liberar pra todos".

   QUEM VE: todos (funcao liberado). localStorage tpd_destruicao = "0" desliga neste navegador (volta a queda antiga: drone
   inteiro, girando igual, poeira e a tela "Bateu em ..."), para comparar.

   O que faz, embrulhando cair / quedaPasso / reiniciarVoo do campo:
   - mede a batida (velocidade na horizontal e na vertical, em que bateu, de que lado) e tira dai a GRAVIDADE (0,08 a 1,25);
   - sorteia um plano de quebra que depende da gravidade, do tipo de obstaculo e de um sorteio (a mesma batida nao da duas vezes
     o mesmo resultado): helices que saem voando, bracos que se partem, corpo partido ao meio, fumaca;
   - o corpo quica, capota e para de um jeito sorteado (em pe torto, de lado, de ponta-cabeca);
   - arvore: pode ficar presa na copa um instante antes de cair, soltam folhas; fio: faiscas; veiculo: ricocheteia e solta cacos;
     pane no ar (bateria, anel de vortice): queda quase vertical;
   - FISICA COM O QUE ESTA EM VOLTA: o corpo e os pedacos nao atravessam camionete, carretinha, gerador, misturador, casas e
     troncos: batem de lado e voltam, ou param em cima. E a aeronave passa a CAIR se voar para dentro da carretinha, do gerador
     ou do misturador (eles nao estao em `colisores`, entao o radar e o voo nao mudam; so a batida e conferida aqui);
   - a tela "Bateu em ..." do jogo aparece 2,2 s depois de tocar o chao e ganha o botao "Ver o drone caido": some a tela, a
     camera vai para perto da queda, na altura dos olhos (vista Livre: da para girar e aproximar), com uma barrinha "Rever a
     queda" (replay: a aeronave volta a voar os ultimos segundos e cai de novo, igual) e "Voltar".
   Os pedacos sao o proprio modelo cortado por planos (clipping), entao serve para qualquer aeronave, inclusive as que tem as
   pecas juntadas por material (modelo_drone.js). As helices sao as da lista `helices` do campo. */
(function () {
  "use strict";
  if (window.xgDestruicao) return;
  if (typeof cair !== "function" || typeof quedaPasso !== "function" || typeof reiniciarVoo !== "function" ||
      typeof THREE === "undefined" || typeof drone === "undefined" || typeof inclina === "undefined") return;

  var X = window.xgDestruicao = { ligado: true, semente: null, ultimo: null, quedas: 0 };
  function liberado() {
    try { return localStorage.getItem("tpd_destruicao") !== "0"; } catch (e) { return true; }
  }
  X.liberado = liberado;
  var G = 9.8;

  /* sorteio com semente: X.semente fixa o resultado (testes); sem ela, cada queda sorteia a sua */
  function sorteador(s) {
    var a = (s >>> 0) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function trava(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function tipoDe(c) {
    var n = String((c && c.nome) || "").toLowerCase();
    if (/badeco|auxiliar|piloto|operador|pessoa|pedestre/.test(n)) return "pessoa";
    if (/camionete|caminh|carro|trator|ve[ií]culo|reboque|carret/.test(n)) return "veiculo";
    if (c && c.fio || /rede|fio|cabo/.test(n)) return "fio";
    if (/poste/.test(n)) return "poste";
    if (/relevo|ch[aã]o/.test(n)) return "chao";
    if (/bateria|v[oó]rtice|motor|pane/.test(n)) return "pane";
    if (/silo|casa|galp|bomba|constru|caixa|tanque|gerador|misturador/.test(n)) return "construcao";
    if (c && (c.tipo === "cil" || c.copa != null) || /[aá]rvore|palmeira|bananeira|mata|eucalipto|pinheiro/.test(n)) return "arvore";
    return "obstaculo";
  }
  function idioma() {
    try { var t = (window.parent && window.parent.TPD_IDIOMAS) || window.TPD_IDIOMAS; var i = t && t.atual && t.atual(); return i === "en" ? 1 : i === "es" ? 2 : 0; } catch (e) { return 0; }
  }
  var TXT = { ver: ["Ver o drone caído", "See the crashed drone", "Ver el dron caído"], rever: ["Rever a queda", "Replay the crash", "Repetir la caída"],
    voltar: ["Voltar", "Back", "Volver"],
    carretinha: ["A carretinha de apoio fica perto do ponto de decolagem. Decole e pouse longe dela e da camionete.", "The support trailer sits near the takeoff point. Take off and land away from it and from the truck.", "El remolque de apoyo queda cerca del punto de despegue. Despega y aterriza lejos de él y de la camioneta."],
    equipamento: ["Os equipamentos de apoio ficam ao lado da base. Mantenha a aeronave longe deles ao decolar e pousar.", "The support equipment sits beside the base. Keep the aircraft away from it when taking off and landing.", "Los equipos de apoyo quedan junto a la base. Mantén la aeronave lejos de ellos al despegar y aterrizar."] };
  function tx(k) { return TXT[k][idioma()] || TXT[k][0]; }

  /* ------------------------------------------------------------------ particulas (poeira, folhas, faiscas, fumaca, cacos) */
  var NPART = 420, pPos = new Float32Array(NPART * 3), pCor = new Float32Array(NPART * 3), pTam = new Float32Array(NPART), pAlfa = new Float32Array(NPART),
    pVel = new Float32Array(NPART * 3), pVida = new Float32Array(NPART), pIdade = new Float32Array(NPART), pTipo = new Uint8Array(NPART), pProx = 0;
  for (var i0 = 0; i0 < NPART; i0++) pPos[i0 * 3 + 1] = -999;
  var gP = new THREE.BufferGeometry();
  gP.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  gP.setAttribute("cor", new THREE.BufferAttribute(pCor, 3));
  gP.setAttribute("tam", new THREE.BufferAttribute(pTam, 1));
  gP.setAttribute("alfa", new THREE.BufferAttribute(pAlfa, 1));
  var mP = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { escala: { value: 500 } },
    vertexShader: "attribute vec3 cor;attribute float tam;attribute float alfa;varying vec3 vC;varying float vA;uniform float escala;void main(){vC=cor;vA=alfa;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(tam*escala/max(0.2,-p.z),1.0,200.0);}",
    fragmentShader: "varying vec3 vC;varying float vA;void main(){float r=length(gl_PointCoord-vec2(0.5))*2.0;if(r>1.0||vA<=0.003)discard;gl_FragColor=vec4(vC,vA*(1.0-r*r));}" });
  var pontos = new THREE.Points(gP, mP); pontos.frustumCulled = false; pontos.renderOrder = 5; pontos.name = "xg-destruicao"; cena.add(pontos);
  var CORES = { poeira: [0.55, 0.45, 0.33], folha: [0.25, 0.5, 0.2], faisca: [1, 0.85, 0.35], fumaca: [0.12, 0.12, 0.13], caco: [0.85, 0.9, 0.95] };
  var TIPOS = { poeira: 0, folha: 1, faisca: 2, fumaca: 3, caco: 4 };
  function soltar(tipo, x, y, z, n, forca, R) {
    /* o replay solta de novo as mesmas nuvens: cada chamada fica anotada com o tempo da queda */
    if (Q && Q.rec && !Q.rec.fim && !X.replay && Q.rec.ev.length < 300) Q.rec.ev.push([Q.t, tipo, x, y, z, n, forca]);
    var c = CORES[tipo];
    for (var k = 0; k < n; k++) {
      var i = pProx; pProx = (pProx + 1) % NPART;
      var a = R() * 6.2832, s = forca * (0.3 + R());
      pPos[i * 3] = x + (R() - 0.5) * 0.6; pPos[i * 3 + 1] = y + R() * 0.4; pPos[i * 3 + 2] = z + (R() - 0.5) * 0.6;
      pVel[i * 3] = Math.cos(a) * s; pVel[i * 3 + 2] = Math.sin(a) * s;
      pVel[i * 3 + 1] = tipo === "fumaca" ? 0.8 + R() * 0.8 : tipo === "folha" ? R() * 2 : 0.6 + R() * forca * 0.8;
      pCor[i * 3] = c[0] * (0.8 + R() * 0.3); pCor[i * 3 + 1] = c[1] * (0.8 + R() * 0.3); pCor[i * 3 + 2] = c[2] * (0.8 + R() * 0.3);
      pTipo[i] = TIPOS[tipo]; pIdade[i] = 0;
      pVida[i] = tipo === "fumaca" ? 2.5 + R() * 2 : tipo === "folha" ? 1.8 + R() * 1.8 : tipo === "faisca" ? 0.35 + R() * 0.4 : 0.9 + R() * 0.8;
      pTam[i] = tipo === "fumaca" ? 0.5 : tipo === "poeira" ? 0.35 : tipo === "folha" ? 0.09 : 0.06;
    }
  }
  function moverParticulas(dt) {
    for (var i = 0; i < NPART; i++) {
      if (pVida[i] <= 0) { pAlfa[i] = 0; continue; }
      pIdade[i] += dt;
      if (pIdade[i] >= pVida[i]) { pVida[i] = 0; pAlfa[i] = 0; pPos[i * 3 + 1] = -999; continue; }
      var t = pTipo[i], k = i * 3, f = pIdade[i] / pVida[i];
      if (t === 3) { pVel[k + 1] += 0.3 * dt; pVel[k] *= 0.98; pVel[k + 2] *= 0.98; pTam[i] += dt * 0.9; pAlfa[i] = 0.5 * Math.min(1, pIdade[i] * 3) * (1 - f); }   // fumaca sobe e engorda
      else if (t === 0) { pVel[k + 1] -= 1.5 * dt; pVel[k] *= 0.95; pVel[k + 2] *= 0.95; pTam[i] += dt * 1.1; pAlfa[i] = 0.45 * (1 - f); }                         // poeira
      else if (t === 1) { pVel[k + 1] -= 2.2 * dt; pVel[k] += Math.sin(pIdade[i] * 7 + i) * 2 * dt; pVel[k + 1] = Math.max(pVel[k + 1], -1.6); pAlfa[i] = 0.95 * (1 - f * f); }   // folha plana
      else { pVel[k + 1] -= G * dt; pAlfa[i] = 1 - f; }                                                                                                              // faisca e caco
      pPos[k] += pVel[k] * dt; pPos[k + 1] += pVel[k + 1] * dt; pPos[k + 2] += pVel[k + 2] * dt;
      var ch = alt(pPos[k], pPos[k + 2]) + 0.03;
      if (pPos[k + 1] < ch) { pPos[k + 1] = ch; pVel[k + 1] = t === 4 || t === 2 ? -pVel[k + 1] * 0.3 : 0; pVel[k] *= 0.5; pVel[k + 2] *= 0.5; }
    }
    gP.attributes.position.needsUpdate = gP.attributes.cor.needsUpdate = gP.attributes.tam.needsUpdate = gP.attributes.alfa.needsUpdate = true;
    mP.uniforms.escala.value = render.domElement.height * 0.6;
  }

  /* ------------------------------------------------------------------ solidos: o que segura ou rebate os destrocos
     Caixas dos `colisores` do campo (camionete, casas...), troncos e postes (cilindros finos) e os objetos da base que nao sao
     colisores (carretinha, gerador, misturador: equipe.js). Tudo vira { tipo, ... } com as contas no espaco do proprio solido. */
  var caixasLocais = new WeakMap(), vT = new THREE.Vector3(), mT = new THREE.Matrix4();
  function caixaLocalDe(o) {
    if (caixasLocais.has(o)) return caixasLocais.get(o);
    o.updateWorldMatrix(true, true);
    var inv = o.matrixWorld.clone().invert(), cx = new THREE.Box3(), v = new THREE.Vector3(), tem = false;
    o.traverse(function (m) {
      if (!m.isMesh || !m.geometry || !m.visible) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      var b = m.geometry.boundingBox, mm = inv.clone().multiply(m.matrixWorld);
      for (var k = 0; k < 8; k++) { v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(mm); cx.expandByPoint(v); tem = true; }
    });
    var r = tem && cx.max.y - cx.min.y > 0.2 ? cx : null;
    caixasLocais.set(o, r);
    return r;
  }
  function objetosDaBase() {
    var lista = [];
    try {
      var q = window.xgEquipe;
      if (q && q.equip && q.equip.carretinha) lista.push({ o: q.equip.carretinha, nome: "a carretinha", dica: tx("carretinha") });
      if (q && q.equip && q.equip.gerador) lista.push({ o: q.equip.gerador, nome: "o gerador", dica: tx("equipamento") });
      if (q && q.mist && q.mist.g) lista.push({ o: q.mist.g, nome: "o misturador", dica: tx("equipamento") });
    } catch (e) { /* sem a equipe: so os colisores do campo */ }
    return lista.filter(function (it) { return it.o && it.o.visible !== false && caixaLocalDe(it.o); });
  }
  function listarSolidos() {
    var S = [];
    (typeof colisores !== "undefined" ? colisores : []).forEach(function (c) {
      if (c.tipo === "caixa") S.push({ tipo: "caixa", x: c.x, z: c.z, hx: c.sx / 2, hz: c.sz / 2, cs: Math.cos(-(c.rot || 0)), sn: Math.sin(-(c.rot || 0)), y0: c.y0, y1: c.y1 });
      else if (c.tipo === "cil" && !/badeco/.test(c.nome || "")) S.push({ tipo: "cil", x: c.x, z: c.z, r: Math.min(c.r || 0.3, 0.45), y1: c.y1 });
    });
    objetosDaBase().forEach(function (it) {
      it.o.updateWorldMatrix(true, false);
      S.push({ tipo: "obj", o: it.o, cx: caixaLocalDe(it.o), inv: it.o.matrixWorld.clone().invert(), mundo: it.o.matrixWorld.clone() });
    });
    return S;
  }
  /* ajusta posicao e velocidade de um corpo de raio r contra os solidos; devolve a altura em que ele pode apoiar */
  function resolver(pos, vel, r, S) {
    var apoio = alt(pos.x, pos.z);
    for (var i = 0; i < S.length; i++) {
      var s = S[i];
      if (s.tipo === "cil") {
        var dx = pos.x - s.x, dz = pos.z - s.z, dh = Math.hypot(dx, dz), rr = s.r + r * 0.5;
        if (dh < rr && pos.y < s.y1 && dh > 1e-4) {
          var nx = dx / dh, nz = dz / dh; pos.x = s.x + nx * rr; pos.z = s.z + nz * rr;
          var vn = vel.x * nx + vel.z * nz; if (vn < 0) { vel.x -= 1.2 * vn * nx; vel.z -= 1.2 * vn * nz; }
        }
        continue;
      }
      var lx, lz, hx, hz, y0, y1;
      if (s.tipo === "caixa") {
        lx = (pos.x - s.x) * s.cs - (pos.z - s.z) * s.sn; lz = (pos.x - s.x) * s.sn + (pos.z - s.z) * s.cs;
        hx = s.hx; hz = s.hz; y0 = s.y0; y1 = s.y1;
        if (Math.abs(lx) >= hx || Math.abs(lz) >= hz || pos.y < y0 - 0.2) continue;
        if (pos.y >= y1 - 0.45) { apoio = Math.max(apoio, y1); continue; }
        /* entrou pelo lado: sai pela face mais perto e perde a velocidade contra ela */
        var ex = hx - Math.abs(lx), ez = hz - Math.abs(lz), nlx = 0, nlz = 0;
        if (ex < ez) { nlx = lx >= 0 ? 1 : -1; lx = nlx * hx; } else { nlz = lz >= 0 ? 1 : -1; lz = nlz * hz; }
        /* volta para o mundo (a rotacao inversa da usada acima) */
        pos.x = s.x + lx * s.cs + lz * s.sn; pos.z = s.z - lx * s.sn + lz * s.cs;
        var wnx = nlx * s.cs + nlz * s.sn, wnz = -nlx * s.sn + nlz * s.cs, v2 = vel.x * wnx + vel.z * wnz;
        if (v2 < 0) { vel.x -= 1.25 * v2 * wnx; vel.z -= 1.25 * v2 * wnz; }
        continue;
      }
      /* objeto da base: caixa no espaco dele (pode estar girado, se a camionete andou) */
      vT.copy(pos).applyMatrix4(s.inv);
      var b = s.cx;
      if (vT.x <= b.min.x || vT.x >= b.max.x || vT.z <= b.min.z || vT.z >= b.max.z || vT.y < b.min.y - 0.2) continue;
      var topo = new THREE.Vector3(vT.x, b.max.y, vT.z).applyMatrix4(s.mundo).y;
      if (pos.y >= topo - 0.45) { apoio = Math.max(apoio, topo); continue; }
      var fx = Math.min(vT.x - b.min.x, b.max.x - vT.x), fz = Math.min(vT.z - b.min.z, b.max.z - vT.z), n = new THREE.Vector3();
      if (fx < fz) { n.set(vT.x - b.min.x < b.max.x - vT.x ? -1 : 1, 0, 0); vT.x = n.x < 0 ? b.min.x : b.max.x; }
      else { n.set(0, 0, vT.z - b.min.z < b.max.z - vT.z ? -1 : 1); vT.z = n.z < 0 ? b.min.z : b.max.z; }
      var py = pos.y; pos.copy(vT).applyMatrix4(s.mundo); pos.y = py;
      n.transformDirection(s.mundo); n.y = 0; if (n.lengthSq() > 1e-6) n.normalize();
      var v3 = vel.x * n.x + vel.z * n.z; if (v3 < 0) { vel.x -= 1.25 * v3 * n.x; vel.z -= 1.25 * v3 * n.z; }
    }
    return apoio;
  }
  /* a aeronave voou para dentro de um objeto da base (carretinha, gerador, misturador)? */
  var baseEm = -1e9, baseLista = [];
  function bateuNaBase() {
    if (relogio - baseEm > 2) { baseEm = relogio; baseLista = objetosDaBase(); }
    var d = drone.position;
    for (var i = 0; i < baseLista.length; i++) {
      var it = baseLista[i], o = it.o, b = caixaLocalDe(o);
      if (!b) continue;
      if (Math.abs(d.x - o.position.x) > 12 || Math.abs(d.z - o.position.z) > 12) continue;   // longe: nem faz a conta
      o.updateWorldMatrix(true, false);
      vT.set(d.x, d.y + 0.4, d.z).applyMatrix4(mT.copy(o.matrixWorld).invert());
      var m = 0.35;   // o centro da aeronave tem de chegar a 35 cm da caixa: so conta batida de verdade, nunca pouso ao lado
      if (vT.x > b.min.x - m && vT.x < b.max.x + m && vT.z > b.min.z - m && vT.z < b.max.z + m && vT.y > b.min.y && vT.y < b.max.y + m)
        return { nome: it.nome, dica: it.dica, tipo: "caixa", cx: o.position.x, cz: o.position.z, raio: 2 };
    }
    return null;
  }

  /* ------------------------------------------------------------------ o modelo: caixa, helices e cortes */
  var Q = null;   // a queda em andamento
  function objetoDaHelice(h) { return h.alvo || h; }
  function caixaLocal() {
    /* caixa do modelo no espaco do `inclina` (x = lado, y = altura, z = frente), sem as helices que ja sairam */
    inclina.updateWorldMatrix(true, true);
    var inv = inclina.matrixWorld.clone().invert(), cx = new THREE.Box3(), v = new THREE.Vector3(), tem = false;
    inclina.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      var b = o.geometry.boundingBox, m = inv.clone().multiply(o.matrixWorld);
      for (var k = 0; k < 8; k++) { v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(m); cx.expandByPoint(v); tem = true; }
    });
    return tem ? cx : null;
  }
  function clonarMateriais(raiz, planos, guardar) {
    raiz.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      if (guardar) guardar.push({ o: o, m: o.material });
      var lista = Array.isArray(o.material) ? o.material : [o.material];
      var novos = lista.map(function (m) { var c = m.clone(); c.clippingPlanes = planos; c.side = THREE.DoubleSide; c.clipShadows = true; return c; });
      o.material = Array.isArray(o.material) ? novos : novos[0];
    });
  }
  /* corpo solto simples: posicao, velocidade, giro; quica no chao (ou em cima de um solido) e para */
  function corpoSolto(obj, raio, vx, vy, vz, R, quique) {
    return { o: obj, r: raio, v: new THREE.Vector3(vx, vy, vz), w: new THREE.Vector3((R() - 0.5), (R() - 0.5), (R() - 0.5)).normalize(), wv: 3 + R() * 9,
      e: quique, parado: false, toques: 0 };
  }
  var eixoTmp = new THREE.Quaternion();
  function moverCorpo(b, dt) {
    if (b.parado) return;
    b.v.y -= G * dt;
    b.o.position.addScaledVector(b.v, dt);
    eixoTmp.setFromAxisAngle(b.w, b.wv * dt); b.o.quaternion.premultiply(eixoTmp);
    var ch = resolver(b.o.position, b.v, b.r, Q.solidos) + b.r;
    if (b.o.position.y <= ch) {
      b.o.position.y = ch; b.toques++;
      if (b.toques === 1) soltar("poeira", b.o.position.x, ch, b.o.position.z, 6, 1.2, Q.R);
      if (-b.v.y > 1.2 && b.toques < 4) { b.v.y = -b.v.y * b.e; b.v.x *= 0.6; b.v.z *= 0.6; b.wv *= 0.55; }
      else { b.v.y = 0; b.v.x *= 0.8; b.v.z *= 0.8; b.wv *= 0.8; if (b.v.lengthSq() < 0.05) { b.parado = true; b.wv = 0; } }
    }
  }

  function prepararQuebra(plano) {
    var R = Q.R, cx = caixaLocal();
    if (!cx) return;
    var cen = cx.getCenter(new THREE.Vector3()), meio = cx.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    Q.meio = meio; Q.altura = meio.y * 2;
    inclina.updateWorldMatrix(true, true);
    var mundo = inclina.matrixWorld.clone(), qMundo = new THREE.Quaternion(); inclina.getWorldQuaternion(qMundo);
    var vBase = Q.v.clone();

    /* 1) helices que saem voando sozinhas (as do lado da batida primeiro) */
    var lista = (typeof helices !== "undefined" ? helices : []).map(function (h) {
      var o = objetoDaHelice(h), p = new THREE.Vector3(); o.getWorldPosition(p);
      var loc = inclina.worldToLocal(p.clone());
      return { h: h, o: o, mundo: p, loc: loc, lado: (loc.x - cen.x) * Q.nLocal.x + (loc.z - cen.z) * Q.nLocal.z };
    }).sort(function (a, b) { return a.lado - b.lado; });   // primeiro as mais perto do obstaculo (nLocal aponta do obstaculo para o drone)
    var voam = Math.min(lista.length, plano.helices);
    for (var k = 0; k < voam; k++) {
      var it = lista[k], o = it.o;
      Q.restaurar.push({ o: o, pai: o.parent, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() });
      cena.attach(o);
      var fora = it.mundo.clone().sub(drone.position); fora.y = 0; if (fora.lengthSq() < 1e-4) fora.set(R() - 0.5, 0, R() - 0.5); fora.normalize();
      var s = 2 + R() * 5 * Q.grav;
      Q.corpos.push(corpoSolto(o, 0.05, vBase.x * 0.5 + fora.x * s, 1 + R() * 4 * Q.grav, vBase.z * 0.5 + fora.z * s, R, 0.3));
      it.fora = true;
    }

    /* 2) cortes: cada um separa um pedaco (um braco, ou metade do corpo) do resto */
    if (!plano.cortes.length) return;
    render.localClippingEnabled = true;
    clonarMateriais(inclina, [], Q.materiais);
    var planosDoCorpo = [];
    plano.cortes.forEach(function (ct) {
      /* n: direcao (local, horizontal) do pedaco que sai; f: em que fracao do caminho ate a ponta fica o corte */
      var n = new THREE.Vector3(ct.nx, 0, ct.nz).normalize();
      var alcance = Math.abs(n.x) * meio.x + Math.abs(n.z) * meio.z, k = n.dot(cen) + ct.f * alcance;
      var restoLocal = new THREE.Plane(n.clone().negate(), k);
      planosDoCorpo.push({ local: restoLocal, mundo: new THREE.Plane() });
      /* centro aproximado do pedaco (no espaco do inclina) */
      var cLoc = cen.clone().addScaledVector(n, (ct.f + 1) / 2 * alcance); cLoc.y = cen.y;
      var grupo = new THREE.Group(), copia = inclina.clone(true);
      copia.position.copy(cLoc).negate(); copia.quaternion.identity(); copia.scale.set(1, 1, 1);
      grupo.add(copia); grupo.position.copy(cLoc).applyMatrix4(mundo); grupo.quaternion.copy(qMundo);
      var planoPedaco = { local: new THREE.Plane(n.clone(), -(k - n.dot(cLoc))), mundo: new THREE.Plane() };
      clonarMateriais(copia, [planoPedaco.mundo]);
      cena.add(grupo); Q.pedacos.push({ g: grupo, plano: planoPedaco });
      var sv = 1 + R() * 3 * Q.grav, nm = n.clone().applyQuaternion(qMundo);
      var b = corpoSolto(grupo, Math.max(0.12, meio.y * 0.5), vBase.x * 0.7 + nm.x * sv, vBase.y * 0.5 + 0.5 + R() * 2.5, vBase.z * 0.7 + nm.z * sv, R, 0.25);
      b.wv = 2 + R() * 6; Q.corpos.push(b);
      /* helices que ficaram no pedaco somem do corpo (a copia ja as leva) */
      lista.forEach(function (it) { if (!it.fora && n.dot(it.loc) > k) { Q.escondidos.push(it.o); it.o.visible = false; } });
    });
    /* o corpo fica com todos os cortes: e o que sobra depois de tirar os pedacos */
    Q.planosCorpo = planosDoCorpo;
    var mundos = planosDoCorpo.map(function (p) { return p.mundo; });
    inclina.traverse(function (o) { if (!o.isMesh || !o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.clippingPlanes = mundos; }); });
  }
  function atualizarPlanos() {
    if (!Q) return;
    if (Q.planosCorpo && Q.planosCorpo.length) { inclina.updateWorldMatrix(true, false); Q.planosCorpo.forEach(function (p) { p.mundo.copy(p.local).applyMatrix4(inclina.matrixWorld); }); }
    Q.pedacos.forEach(function (pd) { pd.g.updateWorldMatrix(true, false); pd.plano.mundo.copy(pd.plano.local).applyMatrix4(pd.g.matrixWorld); });
  }
  /* desmonta a quebra (materiais, helices e pedacos) sem esquecer a queda: o replay monta de novo */
  function recolher() {
    if (!Q) return;
    Q.materiais.forEach(function (g) { (Array.isArray(g.o.material) ? g.o.material : [g.o.material]).forEach(function (m) { if (m && m.dispose) m.dispose(); }); g.o.material = g.m; });
    Q.escondidos.forEach(function (o) { o.visible = true; });
    Q.restaurar.forEach(function (r) { r.pai.add(r.o); r.o.position.copy(r.p); r.o.quaternion.copy(r.q); r.o.scale.copy(r.s); });
    Q.pedacos.forEach(function (pd) { cena.remove(pd.g); pd.g.traverse(function (o) { if (o.isMesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.dispose(); }); }); });
    Q.materiais = []; Q.escondidos = []; Q.restaurar = []; Q.pedacos = []; Q.corpos = []; Q.planosCorpo = [];
  }

  /* ------------------------------------------------------------------ o plano de quebra: gravidade + obstaculo + sorteio */
  function planejar(tipo, grav, R) {
    var p = { helices: 0, cortes: [], fumaca: false, repouso: "em pe, torta", prende: 0, nome: [] };
    /* lado da batida no espaco do drone: o braco que quebra e o que estava virado para o obstaculo */
    var bx = -Q.nLocal.x, bz = -Q.nLocal.z, sx = bx >= 0 ? 1 : -1, sz = bz >= 0 ? 1 : -1;
    if (Math.abs(bx) + Math.abs(bz) < 0.2) { sx = R() < 0.5 ? 1 : -1; sz = R() < 0.5 ? 1 : -1; }
    function braco(ax, az) { p.cortes.push({ nx: ax, nz: az, f: 0.42 + R() * 0.2 }); }
    if (grav < 0.3) {                                   // batida leve
      p.helices = R() < 0.6 ? 1 : 0; if (R() < 0.25) p.helices = 2;
      p.repouso = R() < 0.75 ? "em pe, torta" : "de lado";
    } else if (grav < 0.65) {                           // media
      p.helices = 1 + Math.floor(R() * 2);
      if (R() < 0.75) braco(sx, sz);
      p.repouso = R() < 0.45 ? "de lado" : R() < 0.8 ? "em pe, torta" : "de ponta-cabeca";
    } else if (grav < 1) {                              // forte
      p.helices = 2 + Math.floor(R() * 2);
      braco(sx, sz); if (R() < 0.7) { if (R() < 0.5) braco(-sx, sz); else braco(sx, -sz); }
      p.fumaca = R() < 0.5;
      p.repouso = R() < 0.4 ? "de ponta-cabeca" : R() < 0.8 ? "de lado" : "em pe, torta";
    } else {                                            // muito forte: parte ao meio
      p.helices = 3 + Math.floor(R() * 3);
      var a = R() * Math.PI; p.cortes.push({ nx: Math.cos(a), nz: Math.sin(a), f: -0.1 + R() * 0.2 });
      if (R() < 0.6) braco(Math.cos(a) > 0 ? -1 : 1, Math.sin(a) > 0 ? -1 : 1);   // o braco que quebra junto fica do lado do corpo que sobrou
      p.fumaca = R() < 0.8;
      p.repouso = R() < 0.5 ? "de ponta-cabeca" : "de lado";
    }
    if (tipo === "arvore" && Q.alturaBatida > 2.5 && R() < 0.4) p.prende = 0.5 + R() * 1.3;   // fica presa na copa um instante
    if (tipo === "chao" && Q.pancada) { p.repouso = "em pe, torta"; p.cortes = p.cortes.slice(0, grav > 0.8 ? 1 : 0); }   // pancada de barriga: nao capota
    if (tipo === "pane") p.helices = Math.min(p.helices, 2);
    if (p.helices) p.nome.push(p.helices + (p.helices > 1 ? " helices soltas" : " helice solta"));
    if (p.cortes.length) p.nome.push(grav >= 1 ? "corpo partido" + (p.cortes.length > 1 ? " e 1 braco quebrado" : "") : p.cortes.length + (p.cortes.length > 1 ? " bracos quebrados" : " braco quebrado"));
    if (p.fumaca) p.nome.push("fumaca"); if (p.prende) p.nome.push("ficou presa na copa");
    if (!p.nome.length) p.nome.push("sem peca solta");
    p.nome.push("parou " + p.repouso);
    return p;
  }

  /* ------------------------------------------------------------------ embrulhos do campo */
  var cairAntes = cair, quedaAntes = quedaPasso, reiniciarAntes = reiniciarVoo;
  var relogio = 0, antes = [];   // relogio do arquivo e os ultimos segundos de voo (para o replay)
  function desfazer() {
    if (!Q) return;
    recolher();
    Q = null; X.replay = null;
    esconderBarra(true);
    for (var i = 0; i < NPART; i++) { pVida[i] = 0; pAlfa[i] = 0; pPos[i * 3 + 1] = -999; }
    gP.attributes.position.needsUpdate = gP.attributes.alfa.needsUpdate = true;
  }
  cair = function (c) {
    if (!X.ligado || V.estado === "caiu" || !liberado()) return cairAntes.apply(this, arguments);
    var manual = V.estado === "manual", d = drone.position;
    var vx = manual ? (V.mvx || 0) : (V.v || 0) * (V.dirx || 0), vz = manual ? (V.mvz || 0) : (V.v || 0) * (V.dirz || 0), vy = V.vy || 0;
    var r = cairAntes.apply(this, arguments);
    if (V.estado !== "caiu") return r;
    desfazer();
    var semente = X.semente != null ? X.semente : ((Date.now() ^ (Math.random() * 1e9)) >>> 0), R = sorteador(semente);
    var tipo = tipoDe(c), vh = Math.hypot(vx, vz), chao = alt(d.x, d.z);
    Q = { R: R, tipo: tipo, v: new THREE.Vector3(vx, Math.min(vy, 0), vz), corpos: [], pedacos: [], materiais: [], escondidos: [], restaurar: [], planosCorpo: [],
      t: 0, tocou: false, quiques: 0, alturaBatida: d.y - chao, pancada: tipo === "chao" && Math.abs(vy) > vh * 0.8, giro: new THREE.Vector3(), alvo: null, fumacaAte: 0, preso: 0,
      solidos: [], rec: { pre: antes.map(function (s) { return [s[0] - relogio, s[1], s[2], s[3], s[4], s[5], s[6], s[7]]; }), quadros: [], ev: [], fim: false } };
    antes = [];
    try { Q.solidos = listarSolidos(); } catch (err) { Q.solidos = []; }
    /* normal da batida: do obstaculo para o drone (na horizontal); no chao e na pane nao ha lado */
    var n = new THREE.Vector3();
    if (c && c.cx != null && tipo !== "chao" && tipo !== "pane") n.set(d.x - c.cx, 0, d.z - c.cz);
    if (n.lengthSq() < 1e-4 && vh > 0.3) n.set(-vx, 0, -vz);
    if (n.lengthSq() > 1e-6) n.normalize();
    Q.n = n;
    var inv = new THREE.Quaternion(); inclina.getWorldQuaternion(inv); inv.invert();
    Q.nLocal = n.clone().applyQuaternion(inv);
    /* gravidade: quanto de velocidade a batida matou (contra o obstaculo conta mais que de raspao), com um sorteio pequeno */
    var contra = n.lengthSq() ? Math.max(0, -(vx * n.x + vz * n.z)) : 0;
    var queda = Math.sqrt(vy * vy + 2 * G * Math.max(0, Q.alturaBatida - 0.3));   // velocidade com que ainda vai chegar ao chao
    var energia = tipo === "chao" || tipo === "pane" ? vh * 0.55 + queda * 0.8 : contra * 0.9 + (vh - contra) * 0.35 + queda * 0.45;
    if (tipo === "pessoa") energia *= 0.8; if (tipo === "veiculo" || tipo === "construcao" || tipo === "poste") energia *= 1.1;
    Q.grav = trava(energia / 13 * (0.85 + R() * 0.3), 0.08, 1.25);
    /* velocidade depois da batida: perde o que ia contra o obstaculo (ricocheteia um pouco), o resto segue */
    if (n.lengthSq() && contra > 0) {
      var e = tipo === "veiculo" || tipo === "construcao" ? 0.35 : tipo === "arvore" || tipo === "pessoa" ? 0.05 : 0.15;
      Q.v.x += (1 + e) * contra * n.x; Q.v.z += (1 + e) * contra * n.z;
      var atrito = tipo === "arvore" ? 0.35 : 0.6; Q.v.x *= atrito; Q.v.z *= atrito;
    }
    var plano = planejar(tipo, Q.grav, R);
    Q.plano = plano; Q.preso = plano.prende;
    /* giro do corpo: tomba para o lado da batida, mais rapido quanto mais forte */
    Q.giro.set((R() - 0.5) * 2, (R() - 0.5) * 0.6, (R() - 0.5) * 2).multiplyScalar(Q.pancada ? 0.5 : 1.5 + 5 * Q.grav);
    try { prepararQuebra(plano); } catch (err) { X.erro = String(err && err.message || err); }
    if (tipo === "arvore") soltar("folha", d.x, d.y, d.z, 30 + Math.round(40 * Q.grav), 2.5, R);
    if (tipo === "fio") soltar("faisca", d.x, d.y + 0.4, d.z, 40, 5, R);
    if (tipo === "veiculo") soltar("caco", d.x, d.y, d.z, 20 + Math.round(30 * Q.grav), 3, R);
    if (tipo === "pessoa") X.pessoaAtingida = { em: Date.now(), grav: Q.grav };
    X.quedas++;
    X.ultimo = { semente: semente, tipo: tipo, kmh: Math.round(vh * 36) / 10, descida: Math.round(-Math.min(vy, 0) * 10) / 10, altura: Math.round(Q.alturaBatida * 10) / 10,
      gravidade: Math.round(Q.grav * 100) / 100, resultado: plano.nome.join("; "), helices: plano.helices, cortes: plano.cortes.length, fumaca: plano.fumaca, repouso: plano.repouso };
    gravar();
    return r;
  };
  /* a queda do jogo (corpo inteiro, sempre o mesmo giro) da lugar a esta; o tempo corre no quadro (tique), nao aqui */
  quedaPasso = function (dt) { if (!Q || !X.ligado) return quedaAntes.apply(this, arguments); };
  reiniciarVoo = function () { desfazer(); antes = []; return reiniciarAntes.apply(this, arguments); };

  function angPerto(atual, alvo) { var d = alvo - atual; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return atual + d; }

  /* ------------------------------------------------------------------ a tela da queda, "Ver o drone caido" e o replay */
  var barra = null, vistaAntes = null;
  function criarBarra() {
    if (barra) return;
    barra = document.createElement("div"); barra.id = "xgQuedaBarra"; barra.hidden = true;
    barra.style.cssText = "position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:1200;display:flex;gap:8px;padding:8px;background:rgba(15,20,26,.86);border:1px solid #4a5560;border-radius:10px";
    var bt = function (id, cor) { var b = document.createElement("button"); b.type = "button"; b.id = id; b.style.cssText = "font:600 14px system-ui,sans-serif;min-height:40px;padding:8px 14px;border-radius:8px;border:1px solid " + (cor ? "#2f7cf6" : "#5b6670") + ";background:" + (cor ? "#2f7cf6" : "#232a31") + ";color:#fff;cursor:pointer"; barra.appendChild(b); return b; };
    bt("xgQuedaRever", true).onclick = function () { rever(); this.blur(); };
    bt("xgQuedaVoltar", false).onclick = function () { esconderBarra(false); try { $("queda").hidden = false; } catch (e) { /* segue */ } };
    ["pointerdown", "pointerup", "click", "touchstart", "touchend", "keydown"].forEach(function (t) { barra.addEventListener(t, function (e) { e.stopPropagation(); }); });
    document.body.appendChild(barra);
  }
  function esconderBarra(voltarVista) {
    if (barra) barra.hidden = true;
    if (voltarVista && vistaAntes) { try { definirVista(vistaAntes); } catch (e) { /* segue */ } }
    if (voltarVista) vistaAntes = null;
  }
  function verQueda() {
    if (!Q) return;
    criarBarra();
    document.getElementById("xgQuedaRever").textContent = tx("rever"); document.getElementById("xgQuedaVoltar").textContent = tx("voltar");
    try { $("queda").hidden = true; } catch (e) { /* segue */ }
    barra.hidden = false;
    try {
      if (!vistaAntes) vistaAntes = vista;
      definirVista("livre");
      /* a pessoa chega pelo lado de onde estava o operador e para a uns 6 m, olhando a aeronave na altura dos olhos */
      var d = drone.position, o = typeof grupoOperador !== "undefined" ? grupoOperador.position : null;
      var dx = o ? o.x - d.x : 1, dz = o ? o.z - d.z : 0, L = Math.hypot(dx, dz);
      if (L < 1) { dx = 1; dz = 0; L = 1; }
      var px = d.x + dx / L * 6.5, pz = d.z + dz / L * 6.5;
      cam.position.set(px, alt(px, pz) + 1.7, pz); orb.target.set(d.x, alt(d.x, d.z) + 0.6, d.z); orb.update();
    } catch (e) { X.erro = String(e && e.message || e); }
  }
  X.ver = verQueda;
  function mostrarTela() {
    try {
      if (!Q || V.estado !== "caiu") return;
      $("qMotivo").textContent = "Bateu em " + V.motivo.nome + ".";
      $("qLicao").textContent = V.motivo.dica || "";
      var bts = document.querySelector("#queda .bts"), b = document.getElementById("qVer");
      if (bts && !b) { b = document.createElement("button"); b.id = "qVer"; b.type = "button"; b.onclick = verQueda; bts.appendChild(b); }
      if (b) { b.textContent = tx("ver"); b.hidden = !!(window.xgVR && xgVR.ativo); }
      $("queda").hidden = false;
    } catch (e) { /* sem a tela do jogo: segue */ }
  }

  /* gravacao: cada quadro da queda guarda onde estavam o corpo e os pedacos */
  function gravar() {
    if (!Q || Q.rec.fim) return;
    var d = drone.position, r = inclina.rotation;
    Q.rec.quadros.push({ t: Q.t, p: [d.x, d.y, d.z], r: [r.x, r.y, r.z], c: Q.corpos.map(function (b) { var p = b.o.position, q = b.o.quaternion; return [p.x, p.y, p.z, q.x, q.y, q.z, q.w]; }) });
    var parados = Q.corpos.every(function (b) { return b.parado; });
    if ((Q.alvo && Q.alvo.t >= 1 && parados) || Q.t > 10 || Q.rec.quadros.length > 900) Q.rec.fim = true;
  }
  function rever() {
    if (!Q || X.replay) return;
    /* a queda ainda nao assentou: adianta ate assentar (gravando), para o replay terminar no mesmo lugar */
    for (var g = 0; !Q.rec.fim && g < 900; g++) { passoQueda(1 / 60); gravar(); }
    Q.rec.fim = true;
    if (!Q.rec.quadros.length) return;
    var pre = Q.rec.pre, t0 = pre.length ? Math.max(pre[0][0], -4) : -0.4;
    recolher();
    X.replay = { t: t0, fase: "antes", k: 0, e: 0 };
    for (var i = 0; i < NPART; i++) { pVida[i] = 0; pAlfa[i] = 0; pPos[i * 3 + 1] = -999; }
    aplicarAntes(t0);
    var b = document.getElementById("xgQuedaRever"); if (b) b.disabled = true;
  }
  X.rever = rever;
  function aplicarAntes(t) {
    var pre = Q.rec.pre, q0 = Q.rec.quadros[0], d = drone.position;
    if (!pre.length) { d.set(q0.p[0], q0.p[1], q0.p[2]); inclina.rotation.set(q0.r[0], q0.r[1], q0.r[2]); return; }
    var i = 0; while (i < pre.length - 1 && pre[i + 1][0] <= t) i++;
    var a = pre[i], b = pre[Math.min(pre.length - 1, i + 1)], f = b[0] > a[0] ? trava((t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
    d.set(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f);
    drone.rotation.y = a[4]; inclina.rotation.set(a[5], a[6], a[7]);
  }
  function passoReplay(dt) {
    var P = X.replay, rec = Q.rec, qs = rec.quadros, d = drone.position;
    P.t += dt;
    if (P.fase === "antes") {
      if (P.t < 0) {
        aplicarAntes(P.t);
        try { helices.forEach(function (h) { h.rotation.y += h.userData.sentido * dt * 52; }); } catch (e) { /* sem helices */ }
        return;
      }
      /* a batida: a aeronave volta ao ponto e ao jeito em que estava e quebra de novo, do mesmo jeito */
      d.set(qs[0].p[0], qs[0].p[1], qs[0].p[2]); inclina.rotation.set(qs[0].r[0], qs[0].r[1], qs[0].r[2]);
      try { prepararQuebra(Q.plano); } catch (err) { X.erro = String(err && err.message || err); }
      P.fase = "queda"; P.t = 0;
    }
    while (P.k < qs.length - 1 && qs[P.k + 1].t <= P.t) P.k++;
    var q = qs[P.k];
    d.set(q.p[0], q.p[1], q.p[2]); inclina.rotation.set(q.r[0], q.r[1], q.r[2]);
    for (var i = 0; i < Q.corpos.length && i < q.c.length; i++) { var c = q.c[i], o = Q.corpos[i].o; o.position.set(c[0], c[1], c[2]); o.quaternion.set(c[3], c[4], c[5], c[6]); }
    while (P.e < rec.ev.length && rec.ev[P.e][0] <= P.t) { var ev = rec.ev[P.e++]; soltar(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6], Q.R); }
    if (P.k >= qs.length - 1 && P.t > qs[qs.length - 1].t + 0.2) {
      Q.corpos.forEach(function (b) { b.parado = true; });
      X.replay = null;
      var bt = document.getElementById("xgQuedaRever"); if (bt) bt.disabled = false;
    }
  }

  function passoQueda(dt) {
    var d = drone.position, R = Q.R;
    Q.t += dt;
    if (!Q.alvo) {
      if (Q.preso > 0) {                                  // presa na copa: treme e solta folhas
        Q.preso -= dt; inclina.rotation.z += Math.sin(Q.t * 40) * 0.02; inclina.rotation.x += Math.cos(Q.t * 33) * 0.02;
        if (R() < dt * 12) soltar("folha", d.x, d.y, d.z, 2, 1.2, R);
        if (Q.preso <= 0) { Q.v.set((R() - 0.5) * 1.5, 0, (R() - 0.5) * 1.5); }
      } else {
        Q.v.y -= G * dt; d.x += Q.v.x * dt; d.y += Q.v.y * dt; d.z += Q.v.z * dt;
        inclina.rotation.x += Q.giro.x * dt; inclina.rotation.y += Q.giro.y * dt; inclina.rotation.z += Q.giro.z * dt;
        var apoio = resolver(d, Q.v, 0.7, Q.solidos), chao = apoio + 0.2;
        if (d.y <= chao) {
          d.y = chao; Q.quiques++;
          var forca = Math.min(4, 1 + Math.hypot(Q.v.x, Q.v.z) * 0.3 + -Q.v.y * 0.3);
          soltar("poeira", d.x, chao, d.z, Math.round(18 + 30 * Q.grav), forca, R);
          if (!Q.tocou) { Q.tocou = true; V.noChao = true; try { nevoa.material.color.set("#8b7355"); } catch (e) { /* sem a nevoa antiga */ } Q.telaEm = Q.t + 2.2; }
          if (-Q.v.y > 2 && Q.quiques < 3 && !Q.pancada) { Q.v.y = -Q.v.y * (0.2 + 0.2 * R()); Q.v.x *= 0.55; Q.v.z *= 0.55; Q.giro.multiplyScalar(0.6); }
          else {
            /* para: assenta num dos jeitos sorteados; a altura depende de como ficou */
            var rep = Q.plano.repouso, lado = R() < 0.5 ? 1 : -1, tz = 0, tx2 = 0;
            if (rep === "de lado") { tz = lado * (1.05 + R() * 0.35); tx2 = (R() - 0.5) * 0.4; }
            else if (rep === "de ponta-cabeca") { tz = lado * (Math.PI + (R() - 0.5) * 0.3); tx2 = (R() - 0.5) * 0.3; }
            else { tz = (R() - 0.5) * 0.6; tx2 = (R() - 0.5) * 0.45; }
            Q.alvo = { x: angPerto(inclina.rotation.x, tx2), z: angPerto(inclina.rotation.z, tz), t: 0,
              sobe: Math.abs(Math.sin(tz)) * (Q.meio ? Q.meio.x : 1) * 0.3 + (1 - Math.cos(tz)) / 2 * (Q.altura || 0.8) };
            if (Q.plano.fumaca) Q.fumacaAte = Q.t + 5 + R() * 6;
          }
        }
      }
    } else if (Q.alvo.t < 1) {
      var a = Q.alvo; a.t = Math.min(1, a.t + dt / 0.45); var s = a.t * a.t * (3 - 2 * a.t);
      inclina.rotation.x += (a.x - inclina.rotation.x) * s; inclina.rotation.z += (a.z - inclina.rotation.z) * s;
      d.x += Q.v.x * dt * (1 - s); d.z += Q.v.z * dt * (1 - s);     // ainda escorrega um pouco
      d.y = resolver(d, Q.v, 0.7, Q.solidos) + 0.2 + a.sobe * s;
    }
    if (Q.telaEm && Q.t >= Q.telaEm) { Q.telaEm = 0; mostrarTela(); }
    if (Q.fumacaAte > Q.t && R() < dt * 14) soltar("fumaca", d.x, d.y + 0.3, d.z, 1, 0.4, R);
    for (var k = 0; k < Q.corpos.length; k++) moverCorpo(Q.corpos[k], dt);
  }
  /* o tempo corre a cada quadro desenhado (como o jato do graficos.js), em passos de no maximo 1/60 s */
  var ultimoQuadro = performance.now();
  var NO_AR = { manual: 1, aplicando: 1, indo: 1, voltando: 1, descendo: 1, subindo: 1, pairando: 1 };
  pontos.onBeforeRender = function () {
    var agora = performance.now(), dt = Math.min(0.05, (agora - ultimoQuadro) / 1000); ultimoQuadro = agora;
    if (window.PAUSA_SIM && PAUSA_SIM.pausado) dt = 0;
    if (dt <= 0 || !X.ligado) return;
    relogio += dt;
    if (Q && V.estado === "caiu") {
      if (X.replay) passoReplay(dt);
      else { for (var resta = dt; resta > 1e-4; resta -= 1 / 60) passoQueda(Math.min(1 / 60, resta)); gravar(); }
      atualizarPlanos();
    } else if (Q) desfazer();
    else if (V.rodando && NO_AR[V.estado] && liberado()) {
      /* voando: guarda os ultimos 4 s (para o replay) e confere a batida nos objetos da base */
      var d = drone.position, r = inclina.rotation;
      antes.push([relogio, d.x, d.y, d.z, drone.rotation.y, r.x, r.y, r.z]);
      while (antes.length && antes[0][0] < relogio - 4) antes.shift();
      if (d.y - alt(d.x, d.z) > 0.5) { var bateu = null; try { bateu = bateuNaBase(); } catch (e) { bateu = null; } if (bateu) cair(bateu); }
    } else if (antes.length) antes = [];
    moverParticulas(dt);
  };
})();
