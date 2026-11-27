/* ==========================================================================
   EQUIPE DA BASE: o operador e o badeco, sentados

   12/10/2026 (Eduardo) - fluxo do auxiliar, em todos os drones (DJI e XAG):
   comeca em pe ao lado do drone, sem bateria e com o tanque vazio; o piloto
   manda "Ligar o drone", depois "Encher tanque" (com tudo pronto ele senta).
   Na volta ele espera sentado e pergunta se troca a bateria ou abastece;
   abastecer nao troca a bateria; com algo faltando ele espera ao lado, e o
   piloto escolhe "Trocar bateria" ou "Afastar do drone" para decolar assim.
   Nada enche nem troca sozinho. O texto abaixo e o historico anterior.

   16/10/2026 (Eduardo) - piloto a pe: um botao ("Andar a pe", falar_auxiliar.js)
   levanta o piloto da cadeira; ele anda com os mesmos comandos do drone
   (manual.js) e vira o rosto com o mouse (xgAndar.olharMouse). A pe, ele mesmo
   coloca a bateria e liga o drone, troca a bateria e abastece (pega a ponta da
   mangueira no misturador, leva ate o drone e devolve), tecla E. Veja
   "piloto a pe" mais abaixo.

   Pedido dele:
   - o operador fica sentado numa cadeira, e ao lado dele outra pessoa
     sentada: o badeco;
   - o badeco troca a bateria e abastece o drone. Quando a operacao comeca,
     a bateria ja esta ligada, mas ele esta ao lado do drone abastecendo;
     termina, vem e senta na cadeira dele, ao lado do piloto;
   - o piloto so levanta quando escolhe o mapeamento caminhando (metodo
     Controlador, manual.js); ao sair dele, volta andando para a cadeira.

   Como funciona aqui:
   - duas cadeiras de camping 8 m atras da base (do lado oposto ao talhao),
     viradas para o campo;
   - o badeco e um dos bonecos do jogo (carregarTrabalhador), sem o controle
     na mao. Andando, o passo e o mesmo do operador;
   - tanque e bateria passam a ser de verdade: reiniciar a operacao (o
     Iniciar faz isso) nao enche mais o tanque nem troca a bateria - quem
     enche e o badeco. Depois de uma queda, volta tudo novo como antes;
   - de pe perto do drone, o badeco e um obstaculo (entra em `colisores`):
     o radar o ve, o app avisa "Pedestres ou obstaculos perto da aeronave" e
     a decolagem nao sai com ele a menos de 6 m (decolar e o CSC do manual);
   - na volta para reabastecer (estado "reabastecendo"), o jogo espera o
     badeco terminar e se afastar.
   Roda DENTRO do campo; precisa do avatar do operador carregado e da
   visao do piloto (ponte.js) montada.
   ========================================================================== */

window.EQUIPE = (function () {
  "use strict";

  function instalarNoCampo() {
    if (window.xgEquipe) return true;
    if (typeof carregarTrabalhador !== "function" || typeof TRABALHADORES === "undefined" ||
        typeof grupoOperador === "undefined" || !grupoOperador || !grupoOperador.children.length ||
        typeof posCamera !== "function" || typeof reiniciarVoo !== "function" ||
        typeof decolar !== "function" || typeof registrar !== "function" || typeof quadro !== "function") return false;

    /* FLUXO_LMIN: a bomba de abastecimento do badeco joga 80 L/min (dito por
       ele) - o tanque de 40 L do T50 enche em 30 s */
    var RAIO_DECOLAGEM = 6, VEL_ANDAR = 1.4, FLUXO_LMIN = 80, TROCA_BATERIA_S = 25;
    /* 19/11/2026 (Eduardo, testando o P60): no voo do XAG o auxiliar perto nao barra mais a decolagem. A aeronave apita 1 s antes
       de ligar as helices (campo, V.xgApito) e ele grita, tira a mangueira e corre (VEL_FUGA vezes o passo: ~4,8 m/s). */
    var VEL_FUGA = 3.4;
    function ehXag() { return !!window.xgVooXag; }
    var Q = window.xgEquipe = {
      fala: null,                // fala do auxiliar esperando o falar_auxiliar.js tocar (aqui, matar, pronto-tanque, louco...)
      fuga: null,                // correndo da decolagem: { fase: tirar | correr | reclamar, t, zangado, tanque }
      liberou: false,            // ja disse "pode decolar" neste servico
      pedido: { bat: false, ligou: false, tanque: false },   // o que o piloto pediu neste servico (para a fala do fim)
      agacha: 0, relogio: 0,     // abaixado por causa do drone no manual (0 a 1); tempo de simulacao do auxiliar
      /* 12/10/2026 (Eduardo): a operacao comeca com ele em pe ao lado do drone, sem
         bateria e com o tanque vazio, esperando o piloto mandar ligar o drone */
      estado: "aguardando",      // sentado | indo | trabalhando | aguardando | voltando
      tarefa: { ligar: false, bateria: false, tanque: false, esvaziar: false },
      semBateria: true,          // o drone ainda nao tem bateria (Ligar o drone)
      pergunta: false,           // o drone voltou: ele pergunta se troca a bateria ou abastece
      voou: false,
      prendeu: false,            // segurando o "reabastecendo" do jogo
      trabalho: 0, fase: 0, amp: 0,
      retirado: 0,               // litros recolhidos pelo auxiliar, sem pulverizar
      operadorSentado: false,
      aPe: false,                // 16/10/2026: o piloto levantou e anda (botao Andar a pe)
      fazendo: null,             // servico que o piloto faz com as proprias maos: { o: ligar|bateria|tanque, t }
      perto: function () { return Q.b ? Math.hypot(Q.b.position.x - drone.position.x, Q.b.position.z - drone.position.z) : Infinity; },
    };

    /* ---------------------------------------------------------- cadeiras */
    var mat = function (c, r) { return new THREE.MeshStandardMaterial({ color: c, roughness: r || 0.8 }); };
    function cadeira() {
      var g = new THREE.Group(), lona = mat("#2f4a3a", 0.9), metal = mat("#3a3d40", 0.5);
      var assento = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.46), lona); assento.position.y = 0.44;
      var encosto = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.03), lona); encosto.position.set(0, 0.72, -0.23); encosto.rotation.x = -0.12;
      g.add(assento, encosto);
      [[-0.23, -0.21], [0.23, -0.21], [-0.23, 0.21], [0.23, 0.21]].forEach(function (p) {
        var perna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 6), metal);
        perna.position.set(p[0], 0.23, p[1]); g.add(perna);
      });
      [-0.25, 0.25].forEach(function (x) {
        var braco = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.42), metal); braco.position.set(x, 0.62, 0); g.add(braco);
      });
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      cena.add(g);
      return g;
    }
    var cad = { op: cadeira(), bd: cadeira() };

    /* atras da base, do lado oposto ao talhao, virado para o campo */
    function lugares() {
      var tx = TALHAO.x0 + TALHAO.larg / 2, tz = TALHAO.z0 + TALHAO.prof / 2;
      var ux = BASE.x - tx, uz = BASE.z - tz, n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
      var yaw = Math.atan2(-ux, -uz);                         // frente = (sin, cos)
      var rx = -Math.cos(yaw), rz = Math.sin(yaw);           // direita de quem esta sentado
      var px = BASE.x + ux * 8, pz = BASE.z + uz * 8, r = { yaw: yaw, op: { x: px, z: pz }, bd: { x: px + rx * 1.1, z: pz + rz * 1.1 } };
      /* 24/10/2026 (camionete dirigivel): o aluno escolhe a base, entao as cadeiras podem cair em cima do carro.
         So com a camionete dirigida (pose guardada), gira a posicao em volta da base ate as duas cadeiras ficarem livres;
         sem ela o lugar e o de sempre. As cadeiras continuam viradas para o campo (yaw). */
      if (window.xgVeiculo && window.xgVeiculo.carreta && window.xgVeiculo.carreta()) {
        var giros = [0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7, Math.PI];
        for (var g = 0; g < giros.length && (naCarretinha(r.op.x, r.op.z, 1.5) || naCarretinha(r.bd.x, r.bd.z, 1.5)); g++) {
          var cg = Math.cos(giros[g]), sg = Math.sin(giros[g]), vx = ux * cg - uz * sg, vz = ux * sg + uz * cg;
          px = BASE.x + vx * 8; pz = BASE.z + vz * 8;
          r = { yaw: yaw, op: { x: px, z: pz }, bd: { x: px + rx * 1.1, z: pz + rz * 1.1 } };
        }
      }
      return r;
    }
    function porCadeiras() {
      var L = lugares();
      [["op", L.op], ["bd", L.bd]].forEach(function (c) {
        cad[c[0]].position.set(c[1].x, alt(c[1].x, c[1].z), c[1].z);
        cad[c[0]].rotation.y = L.yaw;
      });
      return L;
    }
    var L = porCadeiras();

    /* ------------------------------------------------------------ poses */
    function apontar(g, osso, filho, dir) {
      var B = g.userData.B; if (!B || !B[osso] || !B[filho]) return;
      g.updateMatrixWorld(true);
      var qf = g.getWorldQuaternion(new THREE.Quaternion());
      var a = new THREE.Vector3().setFromMatrixPosition(B[osso].matrixWorld), b = new THREE.Vector3().setFromMatrixPosition(B[filho].matrixWorld);
      var alvo = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize().applyQuaternion(qf);
      var dq = new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), alvo);
      var wq = B[osso].getWorldQuaternion(new THREE.Quaternion()), pq = B[osso].parent.getWorldQuaternion(new THREE.Quaternion());
      B[osso].quaternion.copy(pq.invert().multiply(dq.multiply(wq)));
    }
    function repouso(g) {
      var R = g.userData.repouso, B = g.userData.B;
      for (var n in R) B[n].quaternion.copy(R[n]);
    }
    /* o controle na mao fica preso ao boneco (nao a mao), montado na altura
       de quem esta em pe: desce e sobe junto com o corpo */
    function alturaDoControle(g, sentado) {
      var esc = g.scale.x || 1;
      g.children.forEach(function (c) {
        if (c === g.userData.av || !c.isGroup) return;
        if (c.userData.xgY === undefined) c.userData.xgY = c.position.y;
        c.position.y = c.userData.xgY - (sentado ? descida(g) / esc : 0);
      });
    }

    /* quanto o corpo desce para o quadril cair no assento (0,47 m): cada
       boneco tem uma altura de quadril, medida uma vez em pe */
    var ASSENTO = 0.47;
    function descida(g) {
      if (g.userData.xgDesce === undefined) {
        var B = g.userData.B, pel = B.pelvis || B.spine_01;
        repouso(g); g.userData.av.position.y = g.userData.avY; g.updateMatrixWorld(true);
        var chao = new THREE.Vector3().setFromMatrixPosition(g.matrixWorld).y;
        var quadril = pel ? new THREE.Vector3().setFromMatrixPosition(pel.matrixWorld).y - chao : 0.9;
        g.userData.xgDesce = Math.max(0.15, quadril - ASSENTO);
      }
      return g.userData.xgDesce;
    }

    /* sentado: quadril no assento, coxa para a frente, canela para baixo */
    function sentar(g) {
      /* a pose sentada e parada: monta uma vez (recalcular o esqueleto a
         cada quadro pesava no PC e na camera que vai para o RC Plus) */
      if (g.userData.xgSentado) return;
      g.userData.xgSentado = true;
      var desce = descida(g);
      repouso(g);
      var esc = g.scale.x || 1;
      g.userData.av.position.y = g.userData.avY - desce / esc;
      alturaDoControle(g, true);
      ["l", "r"].forEach(function (lado) {
        apontar(g, "thigh_" + lado, "calf_" + lado, [0, -0.08, 1]);
        apontar(g, "calf_" + lado, "foot_" + lado, [0, -1, 0.12]);
      });
    }
    /* em pe: a caminhada (pose do jogo, para qualquer boneco). Nao chamar de
       "passo": esse e o nome do passo do voo do jogo, que a trava embrulha */
    function caminhar(g, fase, amp) {
      var vinhaSentado = g.userData.xgSentado;
      g.userData.xgSentado = false;
      if (amp < 0.01 && g.userData.xgParado && !vinhaSentado) return;   // parado em pe: nada muda
      g.userData.xgParado = amp < 0.01;
      repouso(g);
      g.userData.av.position.y = g.userData.avY;
      alturaDoControle(g, false);
      if (amp < 0.01) return;
      ["l", "r"].forEach(function (lado, k) {
        var f = fase + k * Math.PI, a = amp * Math.sin(f), dobra = amp * 1.5 * Math.max(0, Math.cos(f));
        apontar(g, "thigh_" + lado, "calf_" + lado, [0, -Math.cos(a), Math.sin(a)]);
        apontar(g, "calf_" + lado, "foot_" + lado, [0, -Math.cos(a - dobra), Math.sin(a - dobra)]);
      });
    }

    function trocarBateria(g) {
      // Bracos junto a aeronave durante a retirada e a colocacao da bateria.
      g.userData.xgParado = false;
      caminhar(g, 0, 0);
      var levantar = Math.sin(Math.PI * Math.min(1, Q.trabalho / TROCA_BATERIA_S));
      ["l", "r"].forEach(function (lado) {
        apontar(g, "upperarm_" + lado, "lowerarm_" + lado, [lado === "l" ? 0.15 : -0.15, -0.6 + levantar * 0.35, 0.65]);
        apontar(g, "lowerarm_" + lado, "hand_" + lado, [0, -0.15 + levantar * 0.25, 0.8]);
      });
      // A proxima pose em pe deve restaurar tambem os bracos.
      g.userData.xgParado = false;
    }

    /* -------------------------------------------------------------- badeco */
    var defB = TRABALHADORES.filter(function (t) { return t.id !== avatarEscolhido; })[0];
    carregarTrabalhador(defB).then(function (g) {
      /* 18/11/2026 (Eduardo: "o drone ta muito grande perto do auxiliar"): cada boneco do pacote tem um tamanho no arquivo e a
         escala do campo (1,78 / 2,52) so serve ao primeiro; o auxiliar (o segundo da lista) saia com 1,20 m de altura. Aqui ele
         e medido, da sola ao alto da cabeca, e posto com altura de adulto. */
      try {
        g.updateMatrixWorld(true);
        var cx = new THREE.Box3(), mediu = false;
        g.traverse(function (m) {
          if (!m.isSkinnedMesh || !m.geometry) return;
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          cx.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); mediu = true;
        });
        var hB = mediu ? cx.max.y - cx.min.y : 0;
        if (hB > 0.6 && hB < 3 && Math.abs(hB - 1.74) > 0.03) g.scale.multiplyScalar(1.74 / hB);
        Q.alturaBoneco = hB;
      } catch (e) { /* fica do tamanho que veio */ }
      Q.b = new THREE.Group(); Q.b.add(g); cena.add(Q.b); Q.g = g;
      /* sem o controle na mao: bracos soltos */
      g.children.forEach(function (c) { if (c !== g.userData.av) c.visible = false; });
      /* 18/11/2026 (Eduardo: "tem que melhorar as animacoes"): o antebraco ficava a 53 graus para a frente, com as maos na altura da
         barriga como quem segura uma caixa invisivel; agora o braco cai ao lado do corpo, com o cotovelo so um pouco dobrado */
      apontar(g, "upperarm_r", "lowerarm_r", [-0.12, -1, 0.06]); apontar(g, "lowerarm_r", "hand_r", [-0.04, -0.94, 0.34]);
      apontar(g, "upperarm_l", "lowerarm_l", [0.12, -1, 0.06]); apontar(g, "lowerarm_l", "hand_l", [0.04, -0.94, 0.34]);
      capturarRepouso(g);                                     // troca de bateria animada: volta a esta pose
      /* a operacao comeca com ele ao lado do drone, sem bateria e com o tanque vazio */
      ladoDoDrone(Q.b.position);
      Q.b.rotation.y = Math.atan2(drone.position.x - Q.b.position.x, drone.position.z - Q.b.position.z);
      V.tan = 0;
      if (Q.semBateria) V.bat = Q.batAntes = 0;
      comecarComMangueira();
    });

    function ladoDoDrone(p) {
      var ux = L.bd.x - drone.position.x, uz = L.bd.z - drone.position.z, n = Math.hypot(ux, uz) || 1;
      p.set(drone.position.x + ux / n * 1.6, 0, drone.position.z + uz / n * 1.6);
      p.y = alt(p.x, p.z);
      return p;
    }

    /* ------------------------------------------------------ misturador
       Pedido dele (11/10/2026): o misturador JR Drone Mix 320 L fica a uns
       2 m do auxiliar; para abastecer (ou esvaziar), o auxiliar vai ate ele,
       pega a ponta da mangueira e leva junto ate o drone; no fim devolve.
       A mangueira do modelo tem 128 juntas soltas em Mangueira_Rig (a ponta
       e Ponta_Mangueira). O modelo traz 5,4 m; aqui ela tem MANG_M para
       chegar da cadeira ao drone (8 m). Drone pousado mais longe que isso:
       ele vai sem a mangueira, como antes. */
    var MANG_M = 8, MIST_ARQ = "../../assets/modelos/misturador_jr_320l.glb";
    /* O checkpoint do simulador (retomada_estado.js) transforma `window.xgEquipe` inteiro em JSON a cada 5 s. Os objetos de cena que
       moram aqui dentro (misturador, gerador, carretinha, mesa, pecas dos modelos) viravam dezenas de MB e travavam o simulador por
       ~2 s a cada 5 s para quem esta logado. Estes campos ficam fora do JSON (nao enumeraveis) e a restauracao nao os reescreve. */
    function escondido(nome, obj) {
      Object.defineProperty(Q, nome, { get: function () { return obj; }, set: function () { /* nao e estado de operacao */ }, enumerable: false, configurable: true });
      return obj;
    }
    var M = escondido("mist", { g: null, rig: null, juntas: [], ponta: null, naMao: false, w: 0, pega: new THREE.Vector3(),
      piloto: false, soltando: null, ancora: new THREE.Vector3(), caixa: null });
    function porMisturador() {
      M.kPin = null;                                               // a ancora da mangueira pode ter mudado de lugar
      if (!M.g) return;
      /* 1,4 m para a frente e 1,4 m para a direita da cadeira do auxiliar (~2 m); se a
         carretinha (atras da camionete) estiver ali, as proximas posicoes, sempre a ~2 m */
      var fx = Math.sin(L.yaw), fz = Math.cos(L.yaw), rx = -Math.cos(L.yaw), rz = Math.sin(L.yaw);
      var opcoes = [[1.4, 1.4], [1.9, 1.4], [2.4, 1.4], [2.0, 0.8]], x, z;
      for (var i = 0; i < opcoes.length; i++) {
        x = L.bd.x + fx * opcoes[i][0] + rx * opcoes[i][1]; z = L.bd.z + fz * opcoes[i][0] + rz * opcoes[i][1];
        if (!naCarretinha(x, z, 0.5)) break;
      }
      M.g.position.set(x, alt(x, z), z);
      /* o lado da mangueira (+X do modelo) virado para onde o drone pousa */
      var alvo = ladoDoDrone(new THREE.Vector3()), dx = alvo.x - x, dz = alvo.z - z, d = Math.hypot(dx, dz) || 1;
      M.g.rotation.y = Math.atan2(-dz, dx);
      M.g.updateMatrixWorld(true);
      M.pega.set(x + dx / d * 0.95, 0, z + dz / d * 0.95); M.pega.y = alt(M.pega.x, M.pega.z);
      M.naMao = false;
      /* ancora da mangueira e corpo do misturador (o piloto a pe nao atravessa nem estica alem do comprimento) */
      if (M.juntas.length && M.w === 0) M.juntas[0].getWorldPosition(M.ancora);
      if (!M.caixa) M.caixa = caixaLocal(M.g);
      porEquipamentos();
    }
    new THREE.GLTFLoader().load(MIST_ARQ, function (gltf) {
      var g = gltf.scene, rig = null;
      g.traverse(function (o) { if (o.name === "Mangueira_Rig") rig = o; });
      /* pecas paradas juntas por material: 313 pecas pesavam no celular */
      g.updateMatrixWorld(true);
      var porMat = new Map(), soltas = [];
      g.traverse(function (o) {
        if (!o.isMesh || o.isSkinnedMesh) return;
        for (var p = o; p; p = p.parent) if (p === rig || p.name === "Ponta_Mangueira") return;
        var geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (!geo.index) geo.setIndex(Array.from({ length: geo.attributes.position.count }, function (_, i) { return i; }));
        if (!porMat.has(o.material)) porMat.set(o.material, []);
        porMat.get(o.material).push(geo); soltas.push(o);
      });
      soltas.forEach(function (o) { o.parent.remove(o); });
      porMat.forEach(function (geos, mat) {
        var comUv = !!mat.map && geos.every(function (x) { return x.attributes.uv; });
        geos.forEach(function (x) { if (!comUv) x.deleteAttribute("uv"); ["uv2", "color", "tangent"].forEach(function (a) { x.deleteAttribute(a); }); });
        var junto = THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
        if (!junto) { console.warn("misturador: nao juntou", mat.name); return; }
        var m = new THREE.Mesh(junto, mat); m.castShadow = m.receiveShadow = true; g.add(m);
      });
      /* a mangueira esticada sai da caixa original: sem recorte por camera */
      g.traverse(function (o) { if (o.isSkinnedMesh) { o.frustumCulled = false; o.castShadow = true; } });
      if (rig) {
        rig.children.forEach(function (j) {
          if (j.name === "Ponta_Mangueira") M.ponta = j;
          else if (j.userData && j.userData.hose_s !== undefined) M.juntas.push(j);
        });
        M.juntas.sort(function (a, b) { return a.userData.hose_s - b.userData.hose_s; });
        var n = M.juntas.length;
        M.restoL = n ? M.juntas[n - 1].userData.hose_s : 1;
        M.juntas.forEach(function (j, k) {
          j.userData.p0 = j.position.clone(); j.userData.q0 = j.quaternion.clone();
          var a = M.juntas[k === n - 1 ? k - 1 : k], b = M.juntas[k === n - 1 ? k : k + 1];
          /* eixo da mangueira no espaco da junta (a direcao para a proxima) */
          j.userData.eixo = b.position.clone().sub(a.position).normalize().applyQuaternion(j.quaternion.clone().invert());
        });
        if (M.ponta) { M.ponta.userData.p0 = M.ponta.position.clone(); M.ponta.userData.q0 = M.ponta.quaternion.clone(); }
        if (n > 1) M.rig = rig;
      }
      M.g = new THREE.Group(); M.g.add(g); cena.add(M.g);
      porMisturador();
      comecarComMangueira();
    }, undefined, function (e) { console.warn("misturador nao carregou:", e); });

    /* ---------------------------------------- gerador e carretinha
       Pedido dele (12/10/2026): só colocar os modelos, sem mexer em nada do voo
       (nao entram em `colisores`). Gerador Toyama TG22000 ao lado do misturador,
       painel (+Z do modelo) virado para a cadeira do auxiliar. Carretinha LM
       (laterais abertas) engatada atras da camionete do campo, que fica em
       BASE + (10, 8), sem giro, com a traseira em x = -2,76 (campo/index.html). */
    var EQ = escondido("equip", { gerador: null, carretinha: null, caixa: null });
    /* Carretinha fechada (2,47 m de largura; aberta seriam 4,46 m e cobria o misturador).
       Engate do modelo no -Z (ponta em -3,24 m, caixa ate +1,93 m): girada -90 graus aponta
       para +X, para a camionete; a bola do engate ~0,1 m atras do para-choque. */
    /* 24/10/2026: com a camionete dirigivel (veiculo.js) a carretinha fica onde o aluno a deixou:
       xgVeiculo.carreta() devolve { x, z, psi } (psi = rumo do engate, 0 = engate para +X, o padrao). */
    function lugarDaCarretinha() {
      var v = window.xgVeiculo && window.xgVeiculo.carreta && window.xgVeiculo.carreta();
      return v || { x: BASE.x + 10 - 2.85 - 3.1, z: BASE.z + 8, psi: 0 };
    }
    function naCarretinha(x, z, folga) {
      var c = lugarDaCarretinha(), cs = Math.cos(c.psi), sn = Math.sin(c.psi);
      var dx = x - c.x, dz = z - c.z, s = dx * cs + dz * sn, w = -dx * sn + dz * cs;
      if (s > -1.93 - folga && s < 3.24 + folga && Math.abs(w) < 1.24 + folga) return true;
      /* camionete dirigivel (veiculo.js): tambem nao pode haver nada em cima da camionete */
      return !!(window.xgVeiculo && window.xgVeiculo.camionete && window.xgVeiculo.camionete(x, z, folga));
    }
    function porEquipamentos() {
      if (EQ.gerador && M.g) {
        /* ao lado do misturador, do lado livre (direita, esquerda ou a frente) */
        var rx = -Math.cos(L.yaw), rz = Math.sin(L.yaw), fx = Math.sin(L.yaw), fz = Math.cos(L.yaw);
        var mx = M.g.position.x, mz = M.g.position.z, lados = [[rx, rz], [-rx, -rz], [fx, fz]], gx, gz;
        for (var i = 0; i < lados.length; i++) {
          gx = mx + lados[i][0] * 1.3; gz = mz + lados[i][1] * 1.3;
          if (!naCarretinha(gx, gz, 0.5)) break;
        }
        EQ.gerador.position.set(gx, alt(gx, gz), gz);
        EQ.gerador.rotation.y = Math.atan2(L.bd.x - gx, L.bd.z - gz);
      }
      if (EQ.carretinha) {
        var c = lugarDaCarretinha();
        /* dirigindo (veiculo.js) a altura e a inclinacao sao dele; aqui so o padrao */
        if (!(window.xgVeiculo && window.xgVeiculo.carreta && window.xgVeiculo.carreta())) EQ.carretinha.position.set(c.x, alt(c.x, c.z), c.z);
        EQ.carretinha.rotation.y = -(c.psi || 0) - Math.PI / 2;
      }
      try { porCarregador(); } catch (e) { /* o carregador espera o gerador */ }
    }
    function carregarEquipamento(arq, chave) {
      new THREE.GLTFLoader().load(arq, function (gltf) {
        var g = new THREE.Group(); g.add(gltf.scene);
        gltf.scene.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        EQ[chave] = g; cena.add(g);
        porEquipamentos();
        /* 17/10/2026: adesivo das empresas apoiadoras na lateral da carretinha (apoiadores.js) */
        if (chave === "carretinha" && window.xgApoiadores) {
          try { window.xgApoiadores.carretinha(gltf.scene); } catch (e) { console.warn("apoiadores:", e); }
        }
      }, undefined, function (e) { console.warn(chave + " nao carregou:", e); });
    }
    carregarEquipamento("../../assets/modelos/gerador_toyama_tg22000.glb", "gerador");
    carregarEquipamento("../../assets/modelos/carretinha_lm.glb", "carretinha");
    /* a operacao comeca com ele abastecendo ao lado do drone: ja com a mangueira */
    function comecarComMangueira() {
      if (M.rig && Q.b && Q.estado === "trabalhando" && !Q.tarefa.bateria && precisaMangueira() && Q.perto() < 1.8) { M.naMao = true; M.w = 1; }
    }

    /* a mangueira so vai se alcanca o lugar de abastecer, com folga */
    function mangueiraAlcanca() {
      if (!M.rig) return false;
      var a = M.juntas[0].getWorldPosition(new THREE.Vector3()), p = ladoDoDrone(new THREE.Vector3());
      return Math.hypot(p.x - a.x, p.z - a.z) + 1.2 <= MANG_M;
    }
    function precisaMangueira() { return (Q.tarefa.tanque || Q.tarefa.esvaziar) && mangueiraAlcanca(); }

    /* caminho da mangueira: desce da ancora ao chao, corre pelo chao com uma
       barriga de lado (o que sobra do comprimento) e sobe ate a mao */
    var tmpA = new THREE.Vector3(), tmpH = new THREE.Vector3();
    function caminhoMangueira(A, H, barriga, arco) {
      var dx = H.x - A.x, dz = H.z - A.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
      var ini = Math.min(0.25, d * 0.2), fim = arco ? Math.min(0.35, d * 0.25) : Math.min(0.75, d * 0.3), pts = [A.clone()], N = 40;
      for (var i = 0; i <= N; i++) {
        var t = i / N, s = ini + (d - ini - fim) * t, b = barriga * Math.sin(Math.PI * t);
        var x = A.x + ux * s - uz * b, z = A.z + uz * s + ux * b;
        pts.push(new THREE.Vector3(x, alt(x, z) + 0.03, z));
      }
      if (arco) {
        /* presa no tanque: chega por cima e a ponta entra na tampa, virada para baixo */
        pts.push(new THREE.Vector3(H.x - ux * 0.14, H.y + 0.2, H.z - uz * 0.14));
        pts.push(new THREE.Vector3(H.x - ux * 0.03, H.y + 0.1, H.z - uz * 0.03));
        pts.push(new THREE.Vector3(H.x, H.y - 0.07, H.z));
      } else {
        /* 18/11/2026 (Eduardo: animacao da mangueira): do chao ate a mao ela ia RETA, como uma vara; agora sobe em curva,
           deitada perto do chao e mais em pe perto da mao, como mangueira pendurada */
        var Gc = pts[pts.length - 1];
        for (var q = 1; q < 7; q++) {
          var tq = q / 7;
          pts.push(new THREE.Vector3(Gc.x + (H.x - Gc.x) * tq, Gc.y + (H.y - Gc.y) * Math.pow(tq, 2.1), Gc.z + (H.z - Gc.z) * tq));
        }
        pts.push(H.clone());
      }
      return pts;
    }
    function comprimento(pts) { var c = 0; for (var i = 1; i < pts.length; i++) c += pts[i].distanceTo(pts[i - 1]); return c; }
    function seguirMao(H, arco) {
      var A = M.juntas[0].getWorldPosition(tmpA).clone(), pts = caminhoMangueira(A, H, 0, arco);
      if (comprimento(pts) < MANG_M) {
        var lo = 0, hi = MANG_M;
        for (var it = 0; it < 16; it++) { var mid = (lo + hi) / 2; if (comprimento(caminhoMangueira(A, H, mid, arco)) > MANG_M) hi = mid; else lo = mid; }
        pts = caminhoMangueira(A, H, lo, arco);
      }
      var acum = [0]; for (var i = 1; i < pts.length; i++) acum.push(acum[i - 1] + pts[i].distanceTo(pts[i - 1]));
      var total = acum[acum.length - 1] || 1, inv = M.rig.matrixWorld.clone().invert();
      var qRig = M.rig.getWorldQuaternion(new THREE.Quaternion()).invert();
      var seg = 1, n = M.juntas.length;
      M.juntas.forEach(function (j, k) {
        var s = j.userData.hose_s / M.restoL * total;
        while (seg < pts.length - 1 && acum[seg] < s) seg++;
        var a = pts[seg - 1], b = pts[seg], t = (s - acum[seg - 1]) / ((acum[seg] - acum[seg - 1]) || 1);
        var p = a.clone().lerp(b, Math.max(0, Math.min(1, t))).applyMatrix4(inv);
        var q = new THREE.Quaternion().setFromUnitVectors(j.userData.eixo, b.clone().sub(a).normalize().applyQuaternion(qRig));
        j.position.copy(j.userData.p0).lerp(p, M.w);
        j.quaternion.copy(j.userData.q0).slerp(q, M.w);
        if (k === n - 1 && M.ponta) {
          M.ponta.position.copy(j.position);
          M.ponta.quaternion.copy(j.quaternion).multiply(j.userData.q0.clone().invert()).multiply(M.ponta.userData.q0);
        }
      });
    }
    function enrolada() {
      M.juntas.forEach(function (j) { j.position.copy(j.userData.p0); j.quaternion.copy(j.userData.q0); });
      if (M.ponta) { M.ponta.position.copy(M.ponta.userData.p0); M.ponta.quaternion.copy(M.ponta.userData.q0); }
    }
    /* braco direito segurando a ponta; abastecendo, estica para o tanque */
    function segurar(g, abastecendo) {
      g.userData.xgParado = false;
      if (abastecendo) {
        apontar(g, "upperarm_r", "lowerarm_r", [-0.12, -0.35, 0.9]); apontar(g, "lowerarm_r", "hand_r", [-0.05, 0.1, 1]);
      } else {
        /* 18/11/2026: carregava a ponta com o antebraco quase na horizontal, de braco esticado; agora mais baixa, ao lado do corpo */
        apontar(g, "upperarm_r", "lowerarm_r", [-0.14, -0.96, 0.2]); apontar(g, "lowerarm_r", "hand_r", [-0.05, -0.74, 0.6]);
      }
    }
    /* a cada quadro, depois da pose: segue a mao (pegando e devolvendo, 0,8 s de transicao) */
    /* 21/11/2026 (Eduardo, com o video IMG_7293 do P60 de verdade: troca de bateria, tampa do tanque e mangueira; das 4
       diferencas que mostrei ele respondeu "Todas"). So no XAG:
       - a ponta da mangueira e um BICO DE GATILHO, que o auxiliar segura na boca do tanque enquanto enche;
       - a TAMPA do tanque (no do modelo) sai antes de por o bico e volta depois de tirar: fica pendurada ao lado da boca, como
         a do aparelho, que e presa por um fio. TB.tampaK: 0 fechada, 1 aberta. */
    function tampaXag() {
      var t = TB.tampa;
      if (!t || !t.parent) return;
      var k = TB.tampaK || 0;
      if (!TB.tampaP0) {
        if (!k) return;
        /* a tampa e as ranhuras dela (malhas irmas no modelo do P60) andam juntas */
        TB.tampaNos = [t].concat(t.parent.children.filter(function (o) { return /^Ranhura_tampa/.test(o.name); }));
        TB.tampaP0 = TB.tampaNos.map(function (o) { return o.position.clone(); });
      }
      var nos = TB.tampaNos, G = TB.G;
      if (!k || !G || !G.boca) { nos.forEach(function (o, i) { o.position.copy(TB.tampaP0[i]); }); if (!k) { TB.tampaP0 = null; TB.tampaNos = null; } return; }
      /* sobe 6 cm (primeira metade) e depois vai 20 cm para fora e desce 12 cm, encostada no tanque */
      var sobe = suave(k / 0.5), lado = suave((k - 0.5) / 0.5), fora = G.boca.clone().sub(drone.position); fora.y = 0;
      if (fora.lengthSq() < 1e-4) fora.copy(G.left); fora.normalize();
      t.parent.updateMatrixWorld(true);
      nos.forEach(function (o, i) {
        var w = o.parent.localToWorld(TB.tampaP0[i].clone());
        w.y += 0.06 * sobe - 0.12 * lado; w.addScaledVector(fora, 0.2 * lado);
        o.position.copy(o.parent.worldToLocal(w));
      });
    }
    function bicoXag() {
      if (!ehXag() || !Q.g) { if (M.bico) M.bico.visible = false; return; }
      var ponta = M.fixo ? M.fixo : (M.naMao && M.w > 0.5 ? oM(Q.g, "hand_r") : null);
      if (!ponta) { if (M.bico) M.bico.visible = false; return; }
      if (!M.bico) {
        var mat = new THREE.MeshStandardMaterial({ color: "#b7a47c", roughness: 0.7 }), esc = new THREE.MeshStandardMaterial({ color: "#3a3d40", roughness: 0.8 });
        var g = new THREE.Group(), cano = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.15, 10), mat);
        cano.position.y = 0.005; g.add(cano);
        var corpo = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.17), mat); corpo.position.set(0, 0.095, 0.06); g.add(corpo);
        var cabo = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.04), mat); cabo.position.set(0, 0.035, 0.125); cabo.rotation.x = -0.35; g.add(cabo);
        var gat = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.08, 0.014), esc); gat.position.set(0, 0.04, 0.085); gat.rotation.x = -0.25; g.add(gat);
        g.traverse(function (o) { o.castShadow = true; });
        cena.add(g); M.bico = g;
      }
      M.bico.visible = true; M.bico.position.copy(ponta);
      /* o cabo aponta para quem segura */
      var b = Q.b ? Q.b.position : ponta;
      M.bico.rotation.set(0, Math.atan2(b.x - ponta.x, b.z - ponta.z), 0);
      if (!M.fixo) M.bico.position.y -= 0.06;
    }
    function mangueira(dt) { mangueiraBase(dt); try { tampaXag(); bicoXag(); } catch (e) { /* nunca derruba o servico */ } }
    function mangueiraBase(dt) {
      if (!M.rig || !Q.g) return;
      var alvoW = (M.naMao || M.piloto || M.fixo) ? 1 : 0;
      if (M.w === 0 && alvoW === 0) { M.soltando = null; return; }   // enrolada e parada
      M.w += Math.sign(alvoW - M.w) * Math.min(Math.abs(alvoW - M.w), dt / 0.8);
      if (M.w <= 0) { M.w = 0; M.soltando = null; enrolada(); return; }
      /* na mao do auxiliar ou do piloto a pe; devolvida pelo piloto, recolhe ate o fim na mao dele */
      if (M.fixo) {                                               // ponta enfiada na boca do tanque
        var arcoP = !!(TB.G && TB.G.boca && M.fixo.distanceTo(TB.G.boca) < 0.03), kP = M.fixo.x + "|" + M.fixo.y + "|" + M.fixo.z + "|" + arcoP;
        if (M.w >= 1 && M.kPin === kP) return;                    // parada na boca do tanque: nada a recalcular (era ~700 consultas ao terreno por quadro)
        M.kPin = kP; seguirMao(M.fixo, arcoP); return;
      }
      M.kPin = null;
      var doPiloto = !!(M.piloto || (!M.naMao && M.soltando === "piloto"));
      var corpo = doPiloto ? grupoOperador : Q.b, avatar = doPiloto ? grupoOperador.children[0] : Q.g;
      var mao = avatar && avatar.userData.B && avatar.userData.B.hand_r;
      if (!mao) return;
      corpo.updateMatrixWorld(true);
      seguirMao(mao.getWorldPosition(tmpH).clone());
    }

    /* ======================================================================
       TROCA DE BATERIA ANIMADA - 17/10/2026 (pedido do Eduardo)
       O auxiliar vai ao carregador (mesa ao lado do gerador), pega uma bateria
       carregada, passa no misturador para pegar a mangueira e vai ate o drone.
       La: poe a ponta da mangueira no tanque (que enche sozinho), tira a bateria
       descarregada do drone e a pousa no chao, pega a carregada, encaixa no
       drone e liga. Espera o tanque encher, tira a mangueira, pega a bateria
       descarregada, devolve a mangueira no misturador, poe a bateria no
       carregador (cada marca tem o seu) e vai sentar.
       As maos vao nos pontos certos por cinematica inversa e os pes ficam
       plantados: nao e animacao gravada, serve para qualquer drone. A bateria
       vem do proprio modelo (no `Bateria_*` do .glb); no T50 (.obj) usa uma
       baia padrao na traseira.
       ====================================================================== */
    var URL_P = (function () { try { return new URLSearchParams(parent.location.search); } catch (e) { return new URLSearchParams(location.search); } })();
    var MODELO_ID = URL_P.get("modelo") || URL_P.get("drone") || "t50", MARCA_ID = URL_P.get("marca") || "dji";
    /* cores de cada marca (sem logotipo) para a bateria, o carregador e a mesa */
    var ESTILOS = {
      dji:      { corpo: "#2b2e33", alca: "#9aa0a6", faixa: "#e4e7ea", caixa: "#3d4247", painel: "#cfd4d8", led: "#35e06a", mesa: "#8d9296" },
      xag:      { corpo: "#1d1f22", alca: "#c8232c", faixa: "#d9d9d9", caixa: "#2a2d31", painel: "#b9262e", led: "#35e06a", mesa: "#8d9296" },
      eavision: { corpo: "#232a36", alca: "#2f6fd0", faixa: "#ffffff", caixa: "#dfe4e8", painel: "#2f6fd0", led: "#35e06a", mesa: "#8d9296" },
      ceres:    { corpo: "#262b27", alca: "#58a64a", faixa: "#e9efe6", caixa: "#394239", painel: "#58a64a", led: "#35e06a", mesa: "#8d9296" }
    };
    var ESTILO = (MODELO_ID === "c31" && ESTILOS.ceres) || ESTILOS[MARCA_ID] || ESTILOS.dji;
    /* 21/11/2026 (Eduardo, P150: "o p150 vai duas baterias por voo"; "o auxiliar tem que trazer 2 baterias e tem q ser as baterias
       do drone ... ele precisa levar duas e trocar uma de cada vez ... se tiver q abastecer ele leva a mangueira primeiro depois
       busca as baterias e troca"). So o P150: duas baterias no drone (Bateria_dianteira e Bateria_traseira), quatro na conta
       (duas no drone, duas na mesa), mesa com quatro bandejas. Uma bateria em cada mao; no drone, uma de cada vez. */
    var DUPLO = MODELO_ID === "p150", NB = DUPLO ? 4 : 2;
    var NOS_BATERIA = /^(bateria_removivel|bateria_principal|battery_removable|bateria_b13960s|bateria_ctb45ah_removivel|bateria_1$|bateria_2$|bateria_traseira$|bateria_dianteira$)/i;
    /* a bateria que o auxiliar carrega e a do proprio modelo 3D: no T50 (.obj) sao as pecas Back + Battery_P1,
       no T25 a peca `battery`, nos .glb o no `Bateria_*`. A tampa do tanque e onde a mangueira entra. */
    /* ritmo do auxiliar no roteiro: os passos duram 1/RITMO do tempo e ele anda VEL_TB vezes mais depressa que o passo antigo (24/10/2026) */
    var RITMO = 1.8, VEL_TB = 1.25;   /* 18/11/2026: 1,8 dava 2,5 m/s (corrida) com perna de caminhada; 1,25 = 1,75 m/s, passo apressado */
    var PECAS_BATERIA = { t50: /^DAT50_(Back|Battery_P1)$/, t25: /^battery$/i };
    var TAMPA_TANQUE = /^(DAT50_WaterTank_P1|Tank_lid)$/i;
    var TB = escondido("troca", {
      rot: null, i: 0, pose: null, G: null,
      props: [], noDrone: null, fresca: null, velha: null, maoE: null,
      nos: [], pecas: [], baia: null, tampa: null, nosHora: 0, dimKey: "", dim: { L: 0.40, H: 0.19, W: 0.21 },
      enchendo: false, semAntes: true, trocada: false,
      rep: null, medido: false, BR: 0.35, HR: 0.68, maoRep: null, maoCar: null,
      ledAte: 0, led: null, sv: {}, perf: { por: {} }
    });
    var CH = escondido("carregador", { g: null, baias: [], leds: [], pega: new THREE.Vector3(), cabo: null });
    /* A "previa" do simulador vale para TODAS as contas (ehAdmin: () => true no servidor), por isso a trava "so admin" fica aqui:
       sem ela o auxiliar segue com o servico antigo (liberadoParaPe: admin ou localhost). Para liberar aos alunos: devolver true. */
    Q.animacaoLiberada = function () { return liberadoParaPe(); };
    function animar() { try { return !!Q.animacaoLiberada(); } catch (e) { return false; } }

    /* ---------- utilidades */
    function v3(x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); }
    function entre(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function suave(k) { k = entre(k, 0, 1); return k * k * (3 - 2 * k); }
    function misturar(a, b, k) { return a.clone().lerp(b, k); }
    function oM(g, n, v) { return (v || v3()).setFromMatrixPosition(g.userData.B[n].matrixWorld); }
    function sombras(o) { o.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); }
    function caixaEm(ref, obj) {
      ref.updateMatrixWorld(true);
      var inv = ref.matrixWorld.clone().invert(), box = new THREE.Box3(), cada = new THREE.Box3(), primeira = true;
      obj.traverse(function (o) {
        if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        if (!o.geometry.boundingBox) return;
        cada.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        if (primeira) box.copy(cada); else box.union(cada);
        primeira = false;
      });
      return primeira ? null : box;
    }

    /* ---------- cinematica inversa: osso `o` -> `m` -> ponta `p` ate `alvo` (mundo); `polo` dobra o cotovelo/joelho */
    function apontarM(g, osso, filho, dir) {
      var B = g.userData.B; if (!B || !B[osso] || !B[filho]) return;
      g.updateMatrixWorld(true);
      var a = oM(g, osso), b = oM(g, filho);
      var dq = new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(), dir.clone().normalize());
      var wq = B[osso].getWorldQuaternion(new THREE.Quaternion()), pq = B[osso].parent.getWorldQuaternion(new THREE.Quaternion());
      B[osso].quaternion.copy(pq.invert().multiply(dq.multiply(wq)));
    }
    function ik2(g, o, m, p, alvo, polo) {
      g.updateMatrixWorld(true);
      var S = oM(g, o), E0 = oM(g, m), P0 = oM(g, p), l1 = S.distanceTo(E0), l2 = E0.distanceTo(P0);
      var to = alvo.clone().sub(S), d = to.length();
      if (d < 1e-4) return;
      d = entre(d, Math.abs(l1 - l2) + 0.02, l1 + l2 - 0.003);
      var u = to.normalize(), a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      var q = polo.clone().addScaledVector(u, -polo.dot(u)); if (q.lengthSq() < 1e-6) q.set(0, -1, 0); q.normalize();
      var E = S.clone().addScaledVector(u, a).addScaledVector(q, h), T = S.clone().addScaledVector(u, d);
      apontarM(g, o, m, E.clone().sub(S));
      apontarM(g, m, p, T.clone().sub(E));
    }
    /* o `repouso` do jogo so guarda as pernas: bracos, coluna e cabeca voltam daqui */
    var OSSOS_POSE = ["spine_01", "spine_02", "spine_03", "neck_01", "head", "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l",
      "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r", "thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r"];
    function capturarRepouso(g) {
      var B = g.userData.B, r = {};
      OSSOS_POSE.forEach(function (n) { if (B[n]) r[n] = B[n].quaternion.clone(); });
      g.userData.repTB = r; g.userData.avX0 = g.userData.av.position.x; g.userData.avZ0 = g.userData.av.position.z;
    }
    function restaurarRepouso(g) {
      var r = g.userData.repTB, B = g.userData.B, av = g.userData.av;
      if (!r) return;
      for (var n in r) B[n].quaternion.copy(r[n]);
      av.position.x = g.userData.avX0; av.position.y = g.userData.avY; av.position.z = g.userData.avZ0;
    }
    function frente(rot) { return v3(Math.sin(rot), 0, Math.cos(rot)); }
    function medirCorpo() {
      var g = Q.g;
      if (TB.medido || !g || !Q.b || !g.userData.repTB) return;
      Q.b.updateMatrixWorld(true);
      restaurarRepouso(g); g.userData.xgParado = false; g.updateMatrixWorld(true);
      var H = oM(g, "hand_l"), S = oM(g, "upperarm_l"), E = oM(g, "lowerarm_l");
      TB.BR = S.distanceTo(E) + E.distanceTo(H);
      TB.HR = H.y - Q.b.position.y;
      TB.maoRep = { l: Q.b.worldToLocal(H.clone()), r: Q.b.worldToLocal(oM(g, "hand_r")) };
      apontar(g, "upperarm_l", "lowerarm_l", [0.22, -1, 0.05]); apontar(g, "lowerarm_l", "hand_l", [0.12, -0.9, 0.35]);
      g.updateMatrixWorld(true);
      TB.maoCar = { l: Q.b.worldToLocal(oM(g, "hand_l")) };
      restaurarRepouso(g); segurar(g, false); g.updateMatrixWorld(true);
      TB.maoCar.r = Q.b.worldToLocal(oM(g, "hand_r"));
      restaurarRepouso(g);
      TB.medido = true;
    }
    function maoRepouso(l) { medirCorpo(); Q.b.updateMatrixWorld(true); return Q.b.localToWorld(TB.maoRep[l].clone()); }
    function maoCarga(l) { medirCorpo(); Q.b.updateMatrixWorld(true); return Q.b.localToWorld(TB.maoCar[l].clone()); }

    /* ---------- bateria (peca que o auxiliar carrega): copia da bateria do proprio modelo 3D,
       refeita com a origem no centro, +x para o lado de fora (onde o auxiliar fica) e y para cima */
    function criarBateriaDoModelo() {
      var bay = TB.baia, x = bay.dir.clone(), y = v3(0, 1, 0), z = new THREE.Vector3().crossVectors(x, y);
      var Rt = new THREE.Matrix4().makeBasis(x, y, z).transpose();
      var T = new THREE.Matrix4().makeTranslation(-bay.c.x, -bay.c.y, -bay.c.z);
      drone.updateMatrixWorld(true);
      var inv = drone.matrixWorld.clone().invert(), g = new THREE.Group();
      TB.pecas.forEach(function (n) {
        n.traverse(function (o) {
          if (!o.isMesh || o.isSkinnedMesh) return;
          var m = new THREE.Mesh(o.geometry, o.material), rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
          m.matrixAutoUpdate = false; m.matrix.copy(Rt.clone().multiply(T).multiply(rel));
          m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
          g.add(m);
        });
      });
      fundirPorMaterial(g);
      g.userData = { L: bay.L, H: bay.H, W: bay.W, grip: v3(0, bay.H / 2 + 0.01, 0) };
      return g;
    }
    /* a bateria de alguns modelos tem dezenas de pecas soltas: junta por material (uma chamada de desenho por material) */
    function fundirPorMaterial(g) {
      var alvo = g.children.filter(function (o) { return o.isMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && !o.material.vertexColors; });
      if (alvo.length < 3) return g;
      var porMat = new Map();
      alvo.forEach(function (o) {
        var geo = o.geometry.clone().applyMatrix4(o.matrix);
        if (!geo.index) geo.setIndex(Array.from({ length: geo.attributes.position.count }, function (_, i) { return i; }));
        if (!porMat.has(o.material)) porMat.set(o.material, []);
        porMat.get(o.material).push(geo);
      });
      var novos = [];
      porMat.forEach(function (geos, material) {
        var comUv = geos.every(function (x) { return x.attributes.uv; }), comNormal = geos.every(function (x) { return x.attributes.normal; });
        geos.forEach(function (x) {
          if (!comUv) x.deleteAttribute("uv");
          if (!comNormal) x.deleteAttribute("normal");
          ["uv2", "color", "tangent"].forEach(function (a) { x.deleteAttribute(a); });
        });
        var junto = geos.length === 1 ? geos[0] : THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
        if (junto) { var m = new THREE.Mesh(junto, material); m.castShadow = true; m.receiveShadow = true; novos.push(m); }
      });
      if (novos.length !== porMat.size) return g;                 // algum material nao juntou: deixa como esta
      alvo.forEach(function (o) { g.remove(o); });
      novos.forEach(function (m) { g.add(m); });
      return g;
    }
    /* sem a bateria do modelo (modelo ainda carregando): caixa com alca, so para nao ficar vazio */
    function criarBateria(d) {
      var E = ESTILO, g = new THREE.Group(), L = d.L, H = d.H, W = d.W;
      var corpo = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), mat(E.corpo, 0.55));
      var faixa = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, H * 0.3, W + 0.004), mat(E.faixa, 0.5)); faixa.position.y = H * 0.05;
      var topo = new THREE.Mesh(new THREE.BoxGeometry(L * 0.92, 0.014, W * 0.88), mat(E.caixa, 0.7)); topo.position.y = H / 2 + 0.005;
      var mA = mat(E.alca, 0.5), alca = new THREE.Group();
      var barra = new THREE.Mesh(new THREE.BoxGeometry(L * 0.34, 0.022, 0.034), mA); barra.position.y = H / 2 + 0.058;
      alca.add(barra);
      [-1, 1].forEach(function (s) {
        var p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.062, 0.034), mA); p.position.set(s * L * 0.15, H / 2 + 0.03, 0); alca.add(p);
      });
      var led = new THREE.Mesh(new THREE.BoxGeometry(0.006, Math.max(0.012, H * 0.1), W * 0.4),
        new THREE.MeshStandardMaterial({ color: "#222", emissive: E.led, emissiveIntensity: 0, roughness: 0.4 }));
      led.position.set(L / 2 + 0.003, H * 0.28, 0);
      var botao = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 14), mat("#e8e8e8", 0.4));
      botao.rotation.z = Math.PI / 2; botao.position.set(L / 2 + 0.004, -H * 0.06, W * 0.27);
      g.add(corpo, faixa, topo, alca, led, botao);
      sombras(g);
      g.userData = { L: L, H: H, W: W, led: led, grip: v3(0, H / 2 + 0.058, 0) };
      return g;
    }

    /* ---------- mesa + carregador (duas baias) */
    function criarCarregador() {
      var E = ESTILO, g = new THREE.Group(), D = TB.dim;
      var TH = entre(0.85 - 0.132 - D.H, 0.26, 0.6);                    // a alca da bateria fica na altura do peito dele
      var aco = mat(E.mesa, 0.5), escuro = mat("#15181b", 0.8), bx = D.W / 2 + 0.07, larg = Math.max(1.0, (DUPLO ? 8 : 4) * bx + 0.22);
      var fundo = Math.max(0.34, D.L + 0.14);
      TB.caixaMesa = new THREE.Box3(v3(-larg / 2 - 0.05, 0, -0.32), v3(larg / 2 + 0.05, 1, 0.32));
      var tampo = new THREE.Mesh(new THREE.BoxGeometry(larg, 0.035, 0.64), aco); tampo.position.y = TH - 0.0175; g.add(tampo);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
        var perna = new THREE.Mesh(new THREE.BoxGeometry(0.035, TH - 0.035, 0.035), aco);
        perna.position.set(p[0] * (larg / 2 - 0.05), (TH - 0.035) / 2, p[1] * 0.27); g.add(perna);
      });
      var caixa = new THREE.Mesh(new THREE.BoxGeometry(larg - 0.1, 0.12, 0.54), mat(E.caixa, 0.55)); caixa.position.y = TH + 0.06; g.add(caixa);
      var painel = new THREE.Mesh(new THREE.BoxGeometry(larg - 0.14, 0.078, 0.012), mat(E.painel, 0.5)); painel.position.set(0, TH + 0.06, 0.272); g.add(painel);
      var tela = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.034, 0.006),
        new THREE.MeshStandardMaterial({ color: "#0b1d2a", emissive: "#2a6f9c", emissiveIntensity: 0.7 }));
      tela.position.set(0, TH + 0.06, 0.279); g.add(tela);
      /* 18/11/2026 (Eduardo: "olha o carregador tambem"), pelas fotos da XAG (xa.com/en/p60): o carregador CM13600BH e uma caixa
         pequena prateada de pontas pretas, com cabo; cada bateria carrega em pe no berco preto da Torre de Resfriamento, a caixa
         branca com ventoinha e tampa vermelha da agua. A caixa larga com painel vermelho e tela nao existe no XAG. */
      var xag = MARCA_ID === "xag";
      if (xag) {
        caixa.material = mat("#17191c", 0.8); painel.material = mat("#24272b", 0.7); tela.visible = false;
        var prataX = mat("#c5c9cd", 0.42), pretoX = mat("#16181b", 0.75), cgX = new THREE.Group();
        cgX.add(new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.085, 0.2), prataX));
        [-1, 1].forEach(function (s) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.095, 0.05), pretoX); p.position.z = s * 0.12; cgX.add(p); });
        var etq = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.02, 0.06), mat("#f0c419", 0.6)); etq.position.set(0.054, 0.02, 0.04); cgX.add(etq);
        var caboX = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.2), pretoX); caboX.position.set(0, -0.03, -0.24); cgX.add(caboX);
        cgX.position.set(larg / 2 - 0.085, TH + 0.12 + 0.0475, 0.06); g.add(cgX);
      }
      CH.leds = []; CH.baias = [];
      (DUPLO ? [-3, -1, 1, 3] : [-1, 1]).forEach(function (s) {
        var x = s * bx;
        var cama = new THREE.Mesh(new THREE.BoxGeometry(D.W + 0.04, 0.012, fundo), escuro); cama.position.set(x, TH + 0.126, 0); g.add(cama);
        [-1, 1].forEach(function (t) {
          var guia = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.034, fundo), mat(xag ? "#17191c" : E.painel, 0.5));
          guia.position.set(x + t * (D.W / 2 + 0.026), TH + 0.143, 0); g.add(guia);
        });
        var led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.006),
          new THREE.MeshStandardMaterial({ color: "#222", emissive: E.led, emissiveIntensity: 0 }));
        led.position.set(x, TH + 0.06, 0.2815); g.add(led); CH.leds.push(led);
        if (xag) {
          /* torre de resfriamento atras de cada bateria: caixa branca, ventoinha escura e tampa vermelha */
          var tz = -(D.L / 2 + 0.065), th = Math.max(0.2, D.H * 0.82);
          var torre = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.16, D.W * 0.9), th, 0.11), mat("#e9ebed", 0.6)); torre.position.set(x, TH + 0.12 + th / 2, tz); g.add(torre);
          var vent = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 20), mat("#2a2d31", 0.6)); vent.rotation.x = Math.PI / 2; vent.position.set(x, TH + 0.12 + th * 0.58, tz - 0.058); g.add(vent);
          var tampaV = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16), mat("#d7262e", 0.5)); tampaV.position.set(x - 0.03, TH + 0.12 + th + 0.01, tz); g.add(tampaV);
        }
        CH.baias.push({ x: x, y: TH + 0.132 + D.H / 2, z: 0 });
      });
      sombras(g);
      CH.g = g; cena.add(g);
      return g;
    }
    function bandeja(k) { CH.g.updateMatrixWorld(true); var b = CH.baias[k]; return CH.g.localToWorld(v3(b.x, b.y, b.z)); }
    function montarBancada() {
      if (CH.g) { cena.remove(CH.g); }
      TB.props.forEach(function (p) { cena.remove(p.g); });
      criarCarregador();
      var antigas = TB.props.map(function (p) { return p.loc; });
      TB.props = (DUPLO ? [0, 1, 2, 3] : [0, 1]).map(function (k) {
        var g = TB.pecas.length && TB.baia ? criarBateriaDoModelo() : criarBateria(TB.dim); cena.add(g);
        return { g: g, loc: antigas[k] || ("tray" + k) };
      });
      TB.fresca = TB.velha = TB.maoE = null; TB.noDrone = null;
      TB.props.forEach(function (p) { if (p.loc === "drone") TB.noDrone = p; });
      porCarregador();
    }
    /* ao lado do gerador, no lado oposto ao misturador (ou no que estiver livre) */
    function porCarregador() {
      if (!CH.g) return;
      var mx = M.g ? M.g.position.x : BASE.x, mz = M.g ? M.g.position.z : BASE.z, gx, gz;
      if (EQ.gerador) { gx = EQ.gerador.position.x; gz = EQ.gerador.position.z; } else { gx = mx + 1.3; gz = mz; }
      var ux = gx - mx, uz = gz - mz, n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
      var op = [[ux, uz, 1.45], [-uz, ux, 1.4], [uz, -ux, 1.4], [ux, uz, 2.1]], x = gx, z = gz;
      for (var i = 0; i < op.length; i++) {
        x = gx + op[i][0] * op[i][2]; z = gz + op[i][1] * op[i][2];
        if (!naCarretinha(x, z, 0.9)) break;
      }
      CH.g.position.set(x, alt(x, z), z);
      /* a frente da mesa (+Z) fica para o lado do drone, o mesmo do misturador */
      var al = ladoDoDrone(v3());
      CH.g.rotation.y = Math.atan2(al.x - x, al.z - z);
      CH.g.updateMatrixWorld(true);
      var f = frente(CH.g.rotation.y);
      CH.pega.set(x + f.x * 0.66, 0, z + f.z * 0.66); CH.pega.y = alt(CH.pega.x, CH.pega.z);
      /* extensao do gerador ate a mesa */
      if (CH.cabo) { cena.remove(CH.cabo); CH.cabo.geometry.dispose(); CH.cabo = null; }
      if (EQ.gerador) {
        var lado = v3(-f.z, 0, f.x), saida = EQ.gerador.localToWorld(v3(0, 0.32, 0.38));
        var fim = CH.g.localToWorld(v3(-0.42, 0.06, 0.2));
        var pts = [saida, v3(saida.x + (fim.x - saida.x) * 0.2, alt(saida.x, saida.z) + 0.02, saida.z + (fim.z - saida.z) * 0.2),
          v3((saida.x + fim.x) / 2 + lado.x * 0.15, alt((saida.x + fim.x) / 2, (saida.z + fim.z) / 2) + 0.02, (saida.z + fim.z) / 2 + lado.z * 0.15),
          v3(fim.x, alt(fim.x, fim.z) + 0.02, fim.z), fim];
        CH.cabo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 6), mat("#101214", 0.8));
        CH.cabo.castShadow = true; cena.add(CH.cabo);
      }
    }

    /* ---------- bateria do proprio modelo (.glb) ou baia padrao (T50) */
    function refrescarNos() {
      var todos = [], pecas = [], re = PECAS_BATERIA[MODELO_ID], tampa = null;
      drone.traverse(function (o) {
        if (!o.name) return;
        /* 21/11/2026: no xag_p60.glb a tampa do tanque e a malha "Tampa" (com as "Ranhura_tampa" ao lado); sem ela a mangueira ia para o alto do drone */
        if (!tampa && (TAMPA_TANQUE.test(o.name) || (ehXag() && o.name === "Tampa"))) tampa = o;
        if (re) { if (o.isMesh && re.test(o.name)) { todos.push(o); pecas.push(o); } return; }
        if (!NOS_BATERIA.test(o.name)) return;
        for (var p = o.parent; p; p = p.parent) if (todos.indexOf(p) >= 0) return;
        todos.push(o);
      });
      if (!re && todos.length) pecas = [todos[0]];
      if (DUPLO && TB.rot) { TB.nos = todos; TB.tampa = tampa; return; }   // no meio da troca do P150 a bateria da vez e escolhida pelo roteiro
      TB.nos = todos; TB.pecas = pecas; TB.tampa = tampa;
      /* mede so com o drone pousado (no ar ele inclina) */
      if (TB.rot || drone.position.y > alt(drone.position.x, drone.position.z) + 0.1) return;
      var baia = null, box = null;
      pecas.forEach(function (n) { var b = caixaEm(drone, n); if (b) { if (box) box.union(b); else box = b.clone(); } });
      if (box) {
        var c = box.getCenter(v3()), s = box.getSize(v3());
        var dir = Math.abs(c.z) >= Math.abs(c.x) ? v3(0, 0, c.z >= 0 ? 1 : -1) : v3(c.x >= 0 ? 1 : -1, 0, 0);
        if (Math.hypot(c.x, c.z) < 0.12) dir = v3(0, 0, -1);
        var ao = dir.z !== 0 ? s.z : s.x, atraves = dir.z !== 0 ? s.x : s.z;
        baia = { c: c, dir: dir, L: entre(ao, 0.08, 0.6), H: entre(s.y, 0.1, 0.5), W: entre(atraves, 0.1, 0.5) };
      }
      TB.baia = baia;
      var b = baiaDoDrone(), chave = [b.L, b.H, b.W].map(function (x) { return x.toFixed(2); }).join("x") + "|" + pecas.length;
      if (chave !== TB.dimKey) {
        TB.dimKey = chave; TB.dim = { L: b.L, H: b.H, W: b.W };
        montarBancada();
      }
    }
    function baiaDoDrone() {
      return TB.baia || { c: v3(0, 0.47, -0.22), dir: v3(0, 0, -1), L: 0.40, H: 0.19, W: 0.21 };
    }
    /* pontos do trabalho, em coordenadas do mundo, com o drone parado no chao */
    function geometriaDaTroca() {
      drone.updateMatrixWorld(true);
      var bay = baiaDoDrone(), m = drone.matrixWorld, G = { bay: bay }, D = TB.dim, BR = TB.BR;
      G.c = bay.c.clone().applyMatrix4(m);
      G.dir = bay.dir.clone().transformDirection(m); G.dir.y = 0; G.dir.normalize();
      G.f = G.dir.clone().negate();
      G.left = v3(G.f.z, 0, -G.f.x);
      var chao = function (p) { p.y = alt(p.x, p.z); return p; };
      /* a bateria entra e sai POR CIMA (Eduardo, 24/10/2026: "tem que ser por cima, ele esta empurrando para dentro da carenagem"):
         sobe reta ate fora da carenagem (G.alto) e depois vem para a frente do peito dele (G.out) */
      /* 18/11/2026 (Eduardo: "a bateria tem que subir um pouco mais pra cima, ainda bate na estrutura do drone"): ela sobe ate o
         fundo ficar 12 cm acima do ponto mais alto do drone e atravessa nessa altura ate a frente do peito dele (G.out tambem
         fica alto: ele ainda esta por cima da traseira do drone) */
      var cbD = caixaEm(drone, drone), livre = -Infinity;
      if (cbD) livre = v3(0, cbD.max.y, 0).applyMatrix4(m).y + D.H / 2 + 0.12;
      G.alto = G.c.clone(); G.alto.y = Math.max(G.c.y + D.H + 0.06, livre);
      G.est = chao(G.c.clone().addScaledVector(G.dir, D.L / 2 + 0.40));
      G.out = G.est.clone().addScaledVector(G.f, 0.34 * BR + D.L / 2 + 0.06); G.out.y = Math.max(G.est.y + 0.8, livre - 0.04);
      G.G1 = chao(G.est.clone().addScaledVector(G.left, 0.62).addScaledVector(G.f, 0.05));      // bateria nova
      G.G2 = chao(G.est.clone().addScaledVector(G.f, 0.18));                                      // bateria velha: logo a frente dele (as duas maos alcancam)
      G.G1b = chao(G.G1.clone().addScaledVector(G.left, 0.3)); G.G2b = chao(G.G2.clone().addScaledVector(G.left, -0.34));   // P150: a segunda nova e a segunda usada
      /* boca do tanque: topo da tampa do proprio modelo; sem ela, o topo do centro do drone */
      var tb = TB.tampa && caixaEm(drone, TB.tampa);
      if (tb) G.boca = v3((tb.min.x + tb.max.x) / 2, tb.max.y - 0.005, (tb.min.z + tb.max.z) / 2).applyMatrix4(m);
      else { var cb = caixaEm(drone, drone), topo = cb ? Math.min(cb.max.y, 1.05) : 0.9; G.boca = v3(0, topo - 0.04, 0.0).applyMatrix4(m); }
      var rear = Math.max(0.4, Math.abs(bay.dir.z !== 0 ? bay.c.z : bay.c.x) + D.L / 2);
      G.estT = chao(drone.position.clone().addScaledVector(G.dir, rear + 0.3));
      G.estT.addScaledVector(G.left, G.boca.clone().sub(drone.position).dot(G.left) * 0.85); chao(G.estT);   // de frente para a tampa
      G.botao = G.c.clone().addScaledVector(G.dir, D.L / 2 + 0.02); G.botao.y += D.H * 0.1;
      return G;
    }
    function grips(c, dir) {
      var D = TB.dim, left = v3(-dir.z, 0, dir.x), base = c.clone().addScaledVector(dir, D.L / 2 - 0.05);
      return { l: base.clone().addScaledVector(left, D.W / 2 + 0.012), r: base.clone().addScaledVector(left, -(D.W / 2 + 0.012)) };
    }
    function poeProp(p, pos, dir) {
      p.g.position.copy(pos); p.g.visible = true;
      var alvo = Math.atan2(-dir.z, dir.x), d = Math.atan2(Math.sin(alvo - p.g.rotation.y), Math.cos(alvo - p.g.rotation.y));
      p.g.rotation.y += d * 0.35;
    }
    function emBandeja(p, k) {
      var w = bandeja(k); p.g.position.copy(w); p.g.rotation.y = CH.g.rotation.y - Math.PI / 2; p.g.visible = true;
    }
    function prender(p, lado, dt) {
      var mao = oM(Q.g, "hand_" + lado), G = p.g, alvo = Q.b.rotation.y + Math.PI / 2;
      var d = Math.atan2(Math.sin(alvo - G.rotation.y), Math.cos(alvo - G.rotation.y));
      G.rotation.y += d * Math.min(1, (dt || 0.016) * 8);
      G.position.set(mao.x, mao.y - G.userData.grip.y, mao.z); G.visible = true;
    }
    function bandejaLivre() {
      for (var k = 0; k < NB; k++) if (!TB.props.some(function (p) { return p.loc === "tray" + k; })) return k;
      return -1;
    }
    /* o no da bateria do modelo so aparece com a bateria dentro */
    function mostrarNos(sim, todas) {
      if (DUPLO && !todas && TB.rot && TB.nos[TB.bi || 0]) { TB.nos[TB.bi || 0].visible = !!sim; return; }   // P150: so a bateria da vez
      TB.nos.forEach(function (n) { n.visible = !!sim; });
    }

    /* aquece, enquanto ninguem esta olhando, o que pesa so na PRIMEIRA vez (medidas do boneco, caixas dos modelos, cinematica
       inversa): sem isso o inicio da animacao engasgava (codigo frio + conta das caixas de todas as pecas do drone) */
    function aquecer() {
      if (TB.aqueceu || TB.rot || Q.estado !== "aguardando" || !Q.g || !Q.b || !CH.g || !TB.props.length || !Q.g.userData.repTB) return;
      if (drone.position.y > alt(drone.position.x, drone.position.z) + 0.1) return;
      TB.aqueceu = true;
      var t0 = performance.now(), g = Q.g;
      medirCorpo();
      if (EQ.gerador && !EQ.caixa) EQ.caixa = caixaLocal(EQ.gerador);
      var G = geometriaDaTroca();                                  // calcula (e guarda) as caixas dos modelos
      var baixo = G.G1.clone(); baixo.y += 0.25;
      posar({ l: G.out.clone(), r: G.c.clone() });
      posar({ l: baixo, r: null });
      restaurarRepouso(g); g.userData.xgParado = false; g.updateMatrixWorld(true);
      TB.perf.aquecer = +(performance.now() - t0).toFixed(1);
    }

    /* ---------- fora do servico: tudo no lugar, coerente com o estado do drone */
    function sincronizar() {
      if (!animar()) return;
      var agora = performance.now();
      if (agora > TB.nosHora) { TB.nosHora = agora + 1000; try { refrescarNos(); } catch (e) { if (!TB.errou) { TB.errou = true; console.warn("troca de bateria:", e); } } }
      if (!CH.g) return;
      if (!TB.aqueceu) { try { aquecer(); } catch (e) { TB.aqueceu = true; if (!TB.errou) { TB.errou = true; console.warn("troca de bateria (aquecer):", e); } } }
      if (!TB.rot) {
        mostrarNos(!Q.semBateria, true);
        if (DUPLO) {
          /* com as duas baterias no drone, so duas ficam na mesa; sem bateria no drone, as quatro */
          var noD = TB.props.filter(function (p) { return p.loc === "drone"; }), quer = Q.semBateria ? 0 : 2;
          for (var qi = TB.props.length - 1; qi >= 0 && noD.length < quer; qi--) if (TB.props[qi].loc !== "drone") { TB.props[qi].loc = "drone"; noD.push(TB.props[qi]); }
          while (noD.length > quer) noD.pop().loc = "oculta";
        }
        TB.props.forEach(function (p) {
          if (/^tray[0-3]$/.test(p.loc)) emBandeja(p, Number(p.loc.slice(4)));
          else if (p.loc === "drone" || p.loc === "oculta") p.g.visible = false;
          else { var k = bandejaLivre(); if (k >= 0) { p.loc = "tray" + k; emBandeja(p, k); } else { p.loc = "oculta"; p.g.visible = false; } }
        });
      }
      CH.leds.forEach(function (l, k) {
        l.material.emissiveIntensity = TB.props.some(function (p) { return p.loc === "tray" + k; }) ? 1.3 : 0;
      });
      if (TB.led) { TB.led.visible = agora < TB.ledAte; }
    }

    /* ---------- pose: pes plantados, coluna, bracos nos alvos */
    function posar(o) {
      var g = Q.g, av = g.userData.av, esc = g.scale.x || 1, base = Q.b.position, fw = frente(Q.b.rotation.y), left = v3(fw.z, 0, -fw.x);
      g.userData.xgParado = false; g.userData.xgSentado = false;
      restaurarRepouso(g); g.updateMatrixWorld(true);
      var pe = [oM(g, "foot_l"), oM(g, "foot_r")];
      var alvos = [o.l, o.r].filter(Boolean), kd = 0, ext = 0;
      if (alvos.length) {
        var baixo = Math.min.apply(null, alvos.map(function (a) { return a.y; })) - base.y;
        var dh = Math.max.apply(null, alvos.map(function (a) { return Math.hypot(a.x - base.x, a.z - base.z); }));
        kd = entre((TB.HR - 0.02 - baixo) / 0.5, 0, 1);
        ext = entre((dh - TB.BR * 0.55) / (TB.BR * 0.8), 0, 1);
      }
      var ang = entre(kd * 0.85 + ext * 0.5, 0, 1.15), queda = kd * 0.2, recuo = ang * 0.1;
      av.position.y = g.userData.avY - queda / esc; av.position.z = g.userData.avZ0 - recuo / esc;
      if (ang > 0.01) {
        apontar(g, "spine_01", "spine_02", [0, Math.cos(ang * 0.3), Math.sin(ang * 0.3)]);
        apontar(g, "spine_02", "spine_03", [0, Math.cos(ang * 0.65), Math.sin(ang * 0.65)]);
        apontar(g, "spine_03", "neck_01", [0, Math.cos(ang), Math.sin(ang)]);
      }
      g.updateMatrixWorld(true);
      var joelho = fw.clone().multiplyScalar(1).add(v3(0, 0.2, 0));
      ik2(g, "thigh_l", "calf_l", "foot_l", pe[0], joelho);
      ik2(g, "thigh_r", "calf_r", "foot_r", pe[1], joelho);
      bracos(g, o, fw, left);
    }
    function bracos(g, o, fw, left) {
      var poloE = v3(0, -1, 0).addScaledVector(left, 0.7).addScaledVector(fw, -0.3), poloD = v3(0, -1, 0).addScaledVector(left, -0.7).addScaledVector(fw, -0.3);
      if (o.l) ik2(g, "upperarm_l", "lowerarm_l", "hand_l", o.l, poloE);
      else if (TB.maoE) { apontar(g, "upperarm_l", "lowerarm_l", [0.22, -1, 0.05]); apontar(g, "lowerarm_l", "hand_l", [0.12, -0.9, 0.35]); }
      if (o.r) ik2(g, "upperarm_r", "lowerarm_r", "hand_r", o.r, poloD);
      else if (M.naMao) segurar(g, false);
    }
    function aplicarPose(dt) {
      var g = Q.g, o = TB.pose || {};
      Q.b.updateMatrixWorld(true);
      medirCorpo();
      if (o.andando) {
        restaurarRepouso(g); g.userData.xgParado = false; g.userData.xgSentado = false;
        caminhar(g, Q.fase, Q.amp);
        var fw = frente(Q.b.rotation.y);
        bracos(g, o, fw, v3(fw.z, 0, -fw.x));
      } else posar(o);
      g.updateMatrixWorld(true);
      var erro = 0;                                                  // quanto as maos ficaram longe dos alvos (diagnostico)
      if (o.l) erro = Math.max(erro, oM(g, "hand_l").distanceTo(o.l));
      if (o.r) erro = Math.max(erro, oM(g, "hand_r").distanceTo(o.r));
      TB.err = erro;
      TB.props.forEach(function (p) { if (p.loc === "maoE") prender(p, "l", dt); else if (p.loc === "maoD") prender(p, "r", dt); });
    }
    function virar(alvo, dt) {
      var d = Math.atan2(Math.sin(alvo - Q.b.rotation.y), Math.cos(alvo - Q.b.rotation.y)), s = Math.min(Math.abs(d), 5 * dt) * (d < 0 ? -1 : 1);
      Q.b.rotation.y += s;
      return Math.abs(d) - Math.abs(s) < 0.05;
    }
    function paraOnde(p) { return Math.atan2(p.x - Q.b.position.x, p.z - Q.b.position.z); }

    /* anda ate o ponto desviando da mesa, do gerador e da carretinha; se empacar, teletransporta */
    function andarAteTB(alvo, dt, s) {
      var p = Q.b.position, dx = alvo.x - p.x, dz = alvo.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { Q.amp = 0; return true; }
      var corre = !!(Q.fuga && Q.fuga.fase === "correr");            /* 19/11/2026: fugindo da decolagem (XAG) ele corre */
      var passo = Math.min(d, VEL_ANDAR * (corre ? VEL_FUGA : VEL_TB) * dt), nx = p.x + dx / d * passo, nz = p.z + dz / d * passo;
      var eu = colisores.indexOf(corpo); if (eu >= 0) colisores.splice(eu, 1);
      var bl = bloqueiaCaminhada(nx, nz); if (bl) { nx = bl[0]; nz = bl[1]; }
      if (eu >= 0) colisores.push(corpo);
      var r;
      if (EQ.gerador) {
        if (!EQ.caixa) EQ.caixa = caixaLocal(EQ.gerador);
        if (!dentroDe(EQ.gerador, EQ.caixa, alvo.x, alvo.z, 0.12) && (r = forasDaCaixa(EQ.gerador, EQ.caixa, nx, nz, 0.12))) { nx = r[0]; nz = r[1]; }
      }
      if (CH.g && !dentroDe(CH.g, TB.caixaMesa, alvo.x, alvo.z, 0.12) && (r = forasDaCaixa(CH.g, TB.caixaMesa, nx, nz, 0.12))) { nx = r[0]; nz = r[1]; }
      var antes = d;
      p.x = nx; p.z = nz; p.y = alt(p.x, p.z);
      Q.b.rotation.y = Math.atan2(dx, dz);
      /* 18/11/2026: a fase andava meia volta a cada 1,35 m, mas a perna desenhada so cobre ~0,8 m por passo: os pes escorregavam */
      Q.fase += passo / (corre ? 1.3 : 0.78) * Math.PI; Q.amp += ((corre ? 0.8 : 0.46) - Q.amp) * Math.min(1, dt * (corre ? 12 : 8));
      var depois = Math.hypot(alvo.x - p.x, alvo.z - p.z);
      s.parado = depois > antes - passo * 0.2 ? (s.parado || 0) + dt : 0;
      if (s.parado > 1.2) { p.x = alvo.x; p.z = alvo.z; p.y = alt(p.x, p.z); s.parado = 0; return true; }
      return depois < 0.05;
    }
    function dentroDe(g, caixa, x, z, folga) {
      if (!g || !caixa) return false;
      var c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y), dx = x - g.position.x, dz = z - g.position.z;
      var lx = dx * c - dz * s, lz = dx * s + dz * c;
      return lx > caixa.min.x - folga && lx < caixa.max.x + folga && lz > caixa.min.z - folga && lz < caixa.max.z + folga;
    }
    TB.caixaMesa = new THREE.Box3(v3(-0.6, 0, -0.32), v3(0.6, 1, 0.32));

    /* ---------- passos do roteiro */
    function ir(alvoFn, olharFn) {
      return {
        id: "ir",
        ini: function (s) { s.alvo = alvoFn(); s.t = 0; s.parado = 0; },
        upd: function (s, dt) {
          s.t += dt; TB.pose = { andando: true };
          var chegou = andarAteTB(s.alvo, dt, s);
          if (chegou) { Q.amp = 0; var o = olharFn && olharFn(); if (o) chegou = virar(paraOnde(o), dt); }
          if (s.t > 40) chegou = true;
          return chegou;
        }
      };
    }
    function tempo(id, dur, f, ini, fim) {
      return { id: id, dur: dur / RITMO, t: 0, f: f, ini: ini, fim: fim, upd: function (s, dt) {
        s.t += dt; var k = Math.min(1, s.t / s.dur); TB.pose = { l: null, r: null };
        s.f(k, s, dt); return s.t >= s.dur; } };
    }
    /* para na frente da BAIA certa da mesa (a ocupada, para pegar; a livre, para guardar): do meio da mesa a mao nao alcanca a bandeja */
    function irCarregador(modo) {
      return ir(function () {
        var k = 0;
        if (modo === "livre") k = Math.max(0, bandejaLivre());
        else for (var i = 0; i < 2; i++) if (TB.props.some(function (x) { return x.loc === "tray" + i; })) { k = i; break; }
        CH.g.updateMatrixWorld(true);
        var b = CH.baias[k] || { x: 0 }, p = CH.g.localToWorld(v3(b.x, 0, 0.58)); p.y = alt(p.x, p.z);
        return p;
      }, function () { return CH.g.position; });
    }
    function irMist() { return ir(function () { return M.pega.clone(); }, function () { return M.g.position; }); }
    function irEst() { return ir(function () { return TB.G.est.clone(); }, function () { return drone.position; }); }
    function irTanque() { return ir(function () { return TB.G.estT.clone(); }, function () { return drone.position; }); }
    function irSpot(nome) {
      return ir(function () {
        var sp = TB.G[nome], a = Q.b.position, dx = a.x - sp.x, dz = a.z - sp.z, d = Math.hypot(dx, dz) || 1, r = TB.BR * 0.95 + 0.05;
        if (d <= r + 0.04) return a.clone();
        return v3(sp.x + dx / d * r, 0, sp.z + dz / d * r);
      }, function () { return TB.G[nome]; });
    }
    /* 18/11/2026 (Eduardo: animacao da mangueira): pegar e devolver a ponta no misturador era num estalo; agora a mao direita
       vai ate a ponta enrolada, pega (ou solta) e volta */
    function pontaEnrolada() {
      if (!M.rig || !M.ponta || !M.ponta.parent || !M.ponta.userData.p0) return null;
      M.rig.updateMatrixWorld(true);
      return M.ponta.parent.localToWorld(M.ponta.userData.p0.clone());
    }
    function passoPegarMang() {
      return tempo("mang", 1.5, function (k, s) {
        if (!s.alvo) { M.naMao = true; M.soltando = null; return; }
        if (k < 0.5) TB.pose.r = misturar(maoRepouso("r"), s.alvo, suave(k / 0.5));
        else { if (!M.naMao) { M.naMao = true; M.soltando = null; } TB.pose.r = misturar(s.alvo, maoCarga("r"), suave((k - 0.5) / 0.5)); }
      }, function (s) { s.alvo = pontaEnrolada(); }, function () { M.naMao = true; M.soltando = null; });
    }
    function passoDevolver() {
      return tempo("devolver", 1.5, function (k, s) {
        if (!s.alvo) { M.naMao = false; M.soltando = null; return; }
        if (k < 0.5) TB.pose.r = misturar(maoCarga("r"), s.alvo, suave(k / 0.5));
        else { if (M.naMao) { M.naMao = false; M.soltando = null; } TB.pose.r = misturar(s.alvo, maoRepouso("r"), suave((k - 0.5) / 0.5)); }
      }, function (s) { s.alvo = pontaEnrolada(); }, function () { M.naMao = false; M.soltando = null; });
    }

    /* pega uma bateria carregada na bandeja do carregador */
    function passoBuscar() {
      return tempo("buscar", 1.9, function (k, s) {
        var p = s.prop, rep = maoCarga("l");
        if (k < 0.45) TB.pose.l = misturar(maoRepouso("l"), s.topo, suave(k / 0.45));
        else {
          if (p.loc !== "maoE") { p.loc = "maoE"; TB.maoE = p; }
          TB.pose.l = misturar(s.topo, rep, suave((k - 0.45) / 0.55));
        }
      }, function (s) {
        var p = null;
        for (var k = 0; k < 2 && !p; k++) p = TB.props.filter(function (x) { return x.loc === "tray" + k; })[0] || null;
        if (!p) { p = TB.props.filter(function (x) { return x !== TB.noDrone; })[0]; p.loc = "tray0"; emBandeja(p, 0); }
        s.prop = TB.fresca = p; p.g.updateMatrixWorld(true);
        s.topo = p.g.localToWorld(p.g.userData.grip.clone());
      });
    }
    /* pousa a bateria que esta na mao esquerda no ponto `nome` do chao */
    function passoPousarMao(nome, getProp) {
      return tempo("pousar-mao", 2.0, function (k, s) {
        var G = TB.G, p = s.prop, d = TB.dim, sp = G[nome];
        var centro = v3(sp.x, sp.y + d.H / 2 + 0.004, sp.z), mao = centro.clone(); mao.y += p.g.userData.grip.y;
        var baixa = suave(k / 0.42), sobe = suave((k - 0.62) / 0.38);
        TB.pose.l = misturar(TB.maoE ? maoCarga("l") : maoRepouso("l"), mao, baixa * (1 - sobe));
        if (k >= 0.52 && p.loc === "maoE") { p.loc = "chao"; TB.maoE = null; p.g.position.copy(centro); }
      }, function (s) { s.prop = getProp(); });
    }
    /* pega do chao (ponto `nome`) com a mao esquerda */
    function passoPegarChao(nome, getProp) {
      return tempo("pegar-chao", 2.0, function (k, s) {
        var G = TB.G, p = s.prop, d = TB.dim, sp = G[nome];
        var centro = v3(sp.x, sp.y + d.H / 2 + 0.004, sp.z), mao = centro.clone(); mao.y += p.g.userData.grip.y;
        var baixa = suave(k / 0.42), sobe = suave((k - 0.62) / 0.38);
        TB.pose.l = misturar(maoRepouso("l"), mao, baixa);
        if (k >= 0.5 && p.loc !== "maoE") { p.loc = "maoE"; TB.maoE = p; }
        if (k >= 0.62) TB.pose.l = misturar(mao, maoCarga("l"), sobe);
      }, function (s) { s.prop = getProp(); });
    }
    /* ---------- P150: duas baterias (21/11/2026) */
    function maoLoc(lado) { return lado === "r" ? "maoD" : "maoE"; }
    function buscarLado(lado, idx) {
      return tempo("buscar", 1.9, function (k, s) {
        var p = s.prop;
        if (k < 0.45) TB.pose[lado] = misturar(maoRepouso(lado), s.topo, suave(k / 0.45));
        else { if (p.loc !== maoLoc(lado)) p.loc = maoLoc(lado); TB.pose[lado] = misturar(s.topo, maoCarga(lado), suave((k - 0.45) / 0.55)); }
        if (lado === "r" && TB.frescas[0] && TB.frescas[0].loc === "maoE") TB.pose.l = maoCarga("l");
      }, function (s) {
        var p = null;
        for (var k = 0; k < NB && !p; k++) p = TB.props.filter(function (x) { return x.loc === "tray" + k; })[0] || null;
        if (!p) { p = TB.props.filter(function (x) { return x.loc !== "drone" && TB.frescas.indexOf(x) < 0; })[0] || TB.props[idx]; p.loc = "tray" + idx; emBandeja(p, idx); }
        s.prop = TB.frescas[idx] = p; p.g.updateMatrixWorld(true);
        s.topo = p.g.localToWorld(p.g.userData.grip.clone());
      });
    }
    function seguraOutra(lado) {   // a outra mao continua carregando a dela
      var o = lado === "l" ? "r" : "l";
      if (TB.props.some(function (x) { return x.loc === maoLoc(o); })) TB.pose[o] = maoCarga(o);
    }
    function pousarLado(nome, lado, getProp) {
      return tempo("pousar-mao", 2.0, function (k, s) {
        var G = TB.G, p = s.prop, d = TB.dim, sp = G[nome];
        var centro = v3(sp.x, sp.y + d.H / 2 + 0.004, sp.z), mao = centro.clone(); mao.y += p.g.userData.grip.y;
        var baixa = suave(k / 0.42), sobe = suave((k - 0.62) / 0.38);
        TB.pose[lado] = misturar(p.loc === maoLoc(lado) ? maoCarga(lado) : maoRepouso(lado), mao, baixa * (1 - sobe));
        if (k >= 0.52 && p.loc === maoLoc(lado)) { p.loc = "chao"; p.g.position.copy(centro); }
        seguraOutra(lado);
      }, function (s) { s.prop = getProp(); });
    }
    function pegarLado(nome, lado, getProp) {
      return tempo("pegar-chao", 2.0, function (k, s) {
        var G = TB.G, p = s.prop, d = TB.dim, sp = G[nome];
        var centro = v3(sp.x, sp.y + d.H / 2 + 0.004, sp.z), mao = centro.clone(); mao.y += p.g.userData.grip.y;
        var baixa = suave(k / 0.42), sobe = suave((k - 0.62) / 0.38);
        TB.pose[lado] = misturar(maoRepouso(lado), mao, baixa);
        if (k >= 0.5 && p.loc !== maoLoc(lado)) p.loc = maoLoc(lado);
        if (k >= 0.62) TB.pose[lado] = misturar(mao, maoCarga(lado), sobe);
        seguraOutra(lado);
      }, function (s) { s.prop = getProp(); });
    }
    function carregarLado(lado, getProp) {
      return tempo("carregar", 2.6, function (k, s) {
        var p = s.prop, w = bandeja(s.baia), topo = w.clone(); topo.y += p.g.userData.grip.y;
        var alto = topo.clone(); alto.y += 0.07;
        var sobe = suave(k / 0.4), baixa = suave((k - 0.4) / 0.2), volta = suave((k - 0.74) / 0.26);
        var t = misturar(maoCarga(lado), alto, sobe); t.lerp(topo, baixa);
        TB.pose[lado] = volta > 0 ? misturar(topo, maoRepouso(lado), volta) : t;
        if (k >= 0.66 && p.loc === maoLoc(lado)) { p.loc = "tray" + s.baia; emBandeja(p, s.baia); }
        seguraOutra(lado);
      }, function (s) { s.prop = getProp(); s.baia = Math.max(0, bandejaLivre()); });
    }
    /* escolhe a bateria da vez (0 = dianteira, 1 = traseira): a baia, os pontos de pegar e o que esta em jogo */
    function baiaDe(pecas) {
      var box = null;
      pecas.forEach(function (n) { var b = caixaEm(drone, n); if (b) { if (box) box.union(b); else box = b.clone(); } });
      if (!box) return null;
      var c = box.getCenter(v3()), sz = box.getSize(v3());
      return { c: c, dir: v3(0, 0, -1), L: entre(sz.z, 0.08, 0.6), H: entre(sz.y, 0.1, 0.5), W: entre(sz.x, 0.1, 0.5) };
    }
    function escolherBateria(bi) {
      return { id: "bateria-" + (bi + 1), upd: function () {
        var fixo = TB.G0 || TB.G;
        TB.bi = bi; TB.pecas = [TB.nos[bi] || TB.nos[0]];
        var eraVisivel = TB.pecas[0].visible; TB.pecas[0].visible = true;
        var b = baiaDe(TB.pecas); TB.pecas[0].visible = eraVisivel;
        if (b) TB.baia = b;
        var G = geometriaDaTroca();
        ["est", "out", "G1", "G1b", "G2", "G2b", "estT", "boca", "dir", "f", "left"].forEach(function (k) { if (fixo && fixo[k]) G[k] = fixo[k]; });
        G.alto.x = G.c.x; G.alto.z = G.c.z;
        G.G2a = G.G2;
        if (bi === 1) { G.G1 = G.G1b; G.G2 = G.G2b; }
        TB.G = G; TB.fresca = TB.frescas[bi]; TB.velha = TB.velhas[bi];
        TB.noDrone = TB.velhas[bi] && TB.temVelha ? TB.velhas[bi] : null;
        return true;
      } };
    }

    /* a ponta da mangueira vai da mao para a boca do tanque */
    function passoPinar() {
      return tempo("pinar", 2.4, function (k, s) {
        var G = TB.G, mao = G.boca.clone().addScaledVector(G.dir, 0.3); mao.y += 0.1;
        var sobe = suave(k / 0.45), desce = suave((k - 0.66) / 0.34);
        TB.pose.r = desce > 0 && !ehXag() ? misturar(mao, maoRepouso("r"), desce) : misturar(maoCarga("r"), mao, sobe);   /* XAG: a mao fica no bico de gatilho */
        if (k < 0.5) { M.fixo = null; M.naMao = true; M.soltando = null; }
        else {
          if (M.naMao) { s.p0 = oM(Q.g, "hand_r"); M.naMao = false; M.soltando = null; }
          M.fixo = misturar(s.p0 || G.boca, G.boca, suave((k - 0.5) / 0.28));
          if (k >= 0.78) { M.fixo = G.boca.clone(); TB.enchendo = Q.tarefa.tanque || Q.tarefa.esvaziar; }
        }
      });
    }
    /* 21/11/2026: abre (ou fecha) a tampa do tanque com a mao direita - so XAG */
    function passoTampa(abrir) {
      return tempo(abrir ? "abrir-tampa" : "fechar-tampa", 2.2, function (k, s) {
        var G = TB.G, boca = G.boca.clone(); boca.y += 0.05;
        var chega = suave(k / 0.3), sai = suave((k - 0.82) / 0.18), m = entre((k - 0.3) / 0.5, 0, 1);
        TB.tampaK = abrir ? m : 1 - m;
        var fora = G.boca.clone().sub(drone.position); fora.y = 0; if (fora.lengthSq() < 1e-4) fora.copy(G.left); fora.normalize();
        var lado = boca.clone().addScaledVector(fora, 0.2 * suave((TB.tampaK - 0.5) / 0.5)); lado.y += 0.06 * suave(TB.tampaK / 0.5) - 0.12 * suave((TB.tampaK - 0.5) / 0.5);
        TB.pose.l = misturar(maoRepouso("l"), lado, chega * (1 - sai));
      }, null, function () { TB.tampaK = abrir ? 1 : 0; });
    }
    function passoTirarMang() {
      return tempo("tirar-mang", 2.4, function (k, s) {
        var G = TB.G, mao = G.boca.clone().addScaledVector(G.dir, 0.3); mao.y += 0.1;
        var sobe = suave(k / 0.4), desce = suave((k - 0.72) / 0.28);
        TB.pose.r = ehXag() ? mao.clone() : misturar(maoRepouso("r"), mao, sobe);
        if (desce > 0) TB.pose.r = misturar(mao, maoCarga("r"), desce);
        if (k < 0.45) M.fixo = G.boca.clone();
        else if (k < 0.8) M.fixo = misturar(G.boca, oM(Q.g, "hand_r"), suave((k - 0.45) / 0.35));
        else { M.fixo = null; M.naMao = true; M.soltando = null; }
      });
    }
    /* tira a bateria do drone: o no some e a peca sai para o lado do auxiliar */
    function passoTirarVelha() {
      return tempo("tirar-velha", 3.2, function (k, s) {
        var G = TB.G, p = s.prop, b = G.bay, D = TB.dim;
        var sobe = k < 0.22 ? 0 : suave((k - 0.22) / 0.38), vem = k < 0.6 ? 0 : suave((k - 0.6) / 0.3);
        if (k >= 0.22 && p.loc !== "livre") {
          p.loc = "livre"; mostrarNos(false); Q.semBateria = true; TB.noDrone = null; p.g.rotation.y = Math.atan2(-G.dir.z, G.dir.x);
        }
        var c = misturar(misturar(G.c, G.alto, sobe), G.out, vem);      // por cima: reta para cima, depois para o peito
        if (p.loc === "livre") poeProp(p, c, G.dir);
        var gr = grips(c, G.dir), r = suave(k / 0.22);
        TB.pose.l = misturar(maoRepouso("l"), gr.l, r); TB.pose.r = misturar(maoRepouso("r"), gr.r, r);
      }, function (s) {
        s.prop = TB.velha = TB.noDrone || TB.props.filter(function (x) { return x !== TB.fresca; })[0];
        if (s.prop.loc !== "drone") { s.prop.loc = "drone"; }
        s.prop.g.visible = false;
      });
    }
    /* leva a bateria descarregada (nas duas maos) para o chao, ao lado */
    function passoPousarVelha() {
      return tempo("pousar-velha", 2.8, function (k, s) {
        var G = TB.G, p = s.prop, D = TB.dim;
        var alvo = v3(G.G2.x, G.G2.y + D.H / 2 + 0.004, G.G2.z), e = suave(k / 0.7), c = misturar(G.out, alvo, e);
        if (p.loc === "livre") poeProp(p, c, G.dir);
        var gr = grips(c, G.dir), w = 1 - suave((k - 0.78) / 0.22);
        TB.pose.l = misturar(maoRepouso("l"), gr.l, w); TB.pose.r = misturar(maoRepouso("r"), gr.r, w);
        if (k >= 0.74 && p.loc === "livre") p.loc = "chao";
      }, function (s) { s.prop = TB.velha; });
    }
    /* levanta a bateria nova e encaixa no drone */
    function passoColocar() {
      return tempo("colocar", 3.4, function (k, s) {
        var G = TB.G, p = s.prop, D = TB.dim;
        var a = suave(k / 0.26), b = suave((k - 0.26) / 0.2), d = suave((k - 0.46) / 0.34);
        var c = k < 0.26 ? misturar(s.p0, G.out, a) : k < 0.46 ? misturar(G.out, G.alto, b) : misturar(G.alto, G.c, d);   // por cima: desce reta na baia
        if (p.loc === "livre") poeProp(p, c, G.dir);
        var gr = grips(c, G.dir), r = suave(k / 0.25), w = 1 - suave((k - 0.82) / 0.18);
        TB.pose.l = misturar(s.hl0, gr.l, r).lerp(maoRepouso("l"), 1 - w);
        TB.pose.r = misturar(maoRepouso("r"), gr.r, r).lerp(maoRepouso("r"), 1 - w);
        if (k >= 0.82 && p.loc === "livre") { p.loc = "drone"; p.g.visible = false; TB.noDrone = p; mostrarNos(true); }
      }, function (s) {
        s.prop = TB.fresca; s.p0 = s.prop.g.position.clone(); s.hl0 = oM(Q.g, "hand_l");
        s.prop.loc = "livre"; TB.maoE = null;
      });
    }
    /* aperta o botao da bateria */
    function passoLigar() {
      return tempo("ligar", 2.6, function (k, s) {
        var G = TB.G, alvo = G.botao.clone().addScaledVector(G.dir, 0.035);
        var chega = suave(k / 0.35), sai = suave((k - 0.78) / 0.22), aperta = Math.sin(Math.PI * entre((k - 0.42) / 0.2, 0, 1)) * 0.022;
        alvo.addScaledVector(G.dir, -aperta);
        TB.pose.r = misturar(maoRepouso("r"), alvo, chega * (1 - sai));
        if (k >= 0.55 && !s.ligou) {
          s.ligou = true;
          V.bat = Q.batAntes = 100; V.avisoBat = false; Q.semBateria = false;
          if (window.xgBateria) xgBateria.rever();
          Q.tarefa.ligar = Q.tarefa.bateria = false; TB.trocada = true;
          if (!TB.led) { TB.led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), new THREE.MeshBasicMaterial({ color: ESTILO.led })); cena.add(TB.led); }
          TB.led.position.copy(G.botao).addScaledVector(G.dir, 0.014); TB.led.position.y += TB.dim.H * 0.18; TB.ledAte = performance.now() + 4000;
          /* 21/11/2026 (video IMG_7293, aos 18 s): no XAG acende uma FILA de luzes verdes ao lado do botao */
          if (ehXag()) {
            while (TB.led.children.length) TB.led.remove(TB.led.children[0]);
            for (var li = 1; li <= 4; li++) { var lz = new THREE.Mesh(TB.led.geometry, TB.led.material); lz.scale.setScalar(0.75); lz.position.copy(G.left).multiplyScalar(0.03 * li); TB.led.add(lz); }
          }
        }
      });
    }
    function passoEsperar() {
      return { id: "esperar",
        ini: function () { if (Q.tarefa.tanque || Q.tarefa.esvaziar) TB.enchendo = true; },
        upd: function (s, dt) {
          TB.pose = { l: null, r: null };
          /* XAG: segura o bico de gatilho na boca do tanque enquanto enche */
          if (ehXag() && M.fixo && TB.G && TB.G.boca) { var pa = Q.b.position.clone().sub(TB.G.boca); pa.y = 0; pa.normalize(); var mb = TB.G.boca.clone().addScaledVector(pa, 0.13); mb.y += 0.07; TB.pose.r = mb; }   // a mao no cabo do bico
          virar(paraOnde(drone.position), dt); Q.amp = 0;
          return !TB.enchendo && !Q.tarefa.tanque && !Q.tarefa.esvaziar;
        } };
    }
    /* poe a bateria (na mao esquerda) na bandeja livre do carregador */
    function passoCarregar() {
      return tempo("carregar", 2.6, function (k, s) {
        var p = s.prop, D = TB.dim, w = bandeja(s.baia);
        var centro = w.clone(), topo = centro.clone(); topo.y += p.g.userData.grip.y;
        var alto = topo.clone(); alto.y += 0.07;
        var sobe = suave(k / 0.4), baixa = suave((k - 0.4) / 0.2), volta = suave((k - 0.74) / 0.26);
        var t = misturar(maoCarga("l"), alto, sobe); t.lerp(topo, baixa);
        TB.pose.l = volta > 0 ? misturar(topo, maoRepouso("l"), volta) : t;
        if (k >= 0.66 && p.loc === "maoE") { p.loc = "tray" + s.baia; TB.maoE = null; emBandeja(p, s.baia); }
      }, function (s) {
        s.prop = TB.velha; s.baia = Math.max(0, bandejaLivre());
      });
    }

    /* ---------- bomba do tanque (a mangueira ja esta na boca) */
    function bombaTanque(dt) {
      if (!TB.enchendo) return;
      if (Q.tarefa.esvaziar) {
        var retirar = Math.min(V.tan, FLUXO_LMIN / 60 * dt);
        V.tan = Q.tanAntes = Math.max(0, V.tan - retirar);
        Q.retirado = (Number.isFinite(Q.retirado) ? Q.retirado : 0) + retirar;
        if (!(V.tan > 0)) { Q.tarefa.esvaziar = false; TB.enchendo = false; }
      } else if (Q.tarefa.tanque) {
        V.tan = Q.tanAntes = Math.min(T50.tanque, V.tan + FLUXO_LMIN / 60 * dt);
        if (V.tan >= T50.tanque) { Q.tarefa.tanque = false; TB.enchendo = false; }
      } else TB.enchendo = false;
    }

    /* P150 (21/11/2026): a mangueira vai PRIMEIRO (com a tampa aberta), depois ele busca as duas baterias, uma em cada mao,
       poe as duas no chao e troca uma de cada vez; no fim leva as duas usadas para a mesa */
    function roteiroDuplo(T, bat, tanque, mang) {
      var r = [], velha = bat && !Q.semBateria;
      TB.bi = 0; TB.frescas = [null, null]; TB.temVelha = velha;
      TB.velhas = TB.props.filter(function (p) { return p.loc === "drone"; }).slice(0, 2);
      TB.props.forEach(function (p) { if (TB.velhas.length < 2 && TB.velhas.indexOf(p) < 0 && !/^tray[01]$/.test(p.loc)) TB.velhas.push(p); });
      TB.G0 = TB.G;
      if (mang) { if (!M.naMao) r.push(irMist(), passoPegarMang()); r.push(irTanque(), passoTampa(true), passoPinar()); }
      else if (tanque) r.push(irEst(), { id: "bomba", upd: function () { TB.enchendo = true; return true; } });
      if (bat) {
        r.push(irCarregador("ocupada"), buscarLado("l", 0), buscarLado("r", 1), irEst(),
          pousarLado("G1", "l", function () { return TB.frescas[0]; }), pousarLado("G1b", "r", function () { return TB.frescas[1]; }));
        [0, 1].forEach(function (bi) {
          r.push(escolherBateria(bi));
          if (velha) r.push(passoTirarVelha(), passoPousarVelha());
          r.push(passoPegarChao("G1", function () { return TB.frescas[bi]; }), passoColocar());
        });
        r.push(passoLigar());
      }
      if (tanque) r.push(passoEsperar());
      if (mang) r.push(irTanque(), passoTirarMang(), passoTampa(false));
      if (velha) r.push(irEst(), pegarLado("G2a", "l", function () { return TB.velhas[0]; }), pegarLado("G2b", "r", function () { return TB.velhas[1]; }));
      r.push({ id: "avisar", upd: function () { avisarPronto(); return true; } });
      if (mang) r.push(irMist(), passoDevolver());
      if (velha) r.push(irCarregador("livre"), carregarLado("l", function () { return TB.velhas[0]; }), carregarLado("r", function () { return TB.velhas[1]; }));
      return r;
    }

    /* ---------- monta a lista de passos pelo que foi pedido */
    function construirRoteiro() {
      var T = Q.tarefa, bat = !!(T.ligar || T.bateria), tanque = !!(T.tanque || T.esvaziar), r = [];
      var mang = tanque && mangueiraAlcanca();
      TB.tampaK = 0; try { tampaXag(); } catch (e) { /* segue */ }   // a tampa fechada antes de medir a boca do tanque
      TB.G = geometriaDaTroca(); TB.trocada = false; TB.semAntes = Q.semBateria; TB.fresca = TB.velha = null;
      var velha = bat && !Q.semBateria;
      /* 21/11/2026 (video IMG_7293; ele: "Todas"): no XAG a bateria vem PRIMEIRO e o tanque depois, com a tampa aberta antes
         do bico e fechada no fim. Nas outras marcas a ordem antiga continua (mangueira antes, enchendo durante a troca). */
      var xagOrdem = ehXag() && mang && !DUPLO;
      if (DUPLO) return roteiroDuplo(T, bat, tanque, mang);
      if (bat) r.push(irCarregador("ocupada"), passoBuscar());
      if (mang && !xagOrdem && !M.naMao) r.push(irMist(), passoPegarMang());
      if (mang && !xagOrdem) r.push(irTanque(), passoPinar());
      if (bat) {
        r.push(irEst());
        if (!mang && tanque) r.push({ id: "bomba", upd: function () { TB.enchendo = true; return true; } });
        if (velha) {
          r.push(irSpot("G1"), passoPousarMao("G1", function () { return TB.fresca; }), irEst(),
            passoTirarVelha(), passoPousarVelha(),
            irSpot("G1"), passoPegarChao("G1", function () { return TB.fresca; }), irEst());
        }
        r.push(passoColocar(), passoLigar());
      } else if (tanque && !mang) r.push(irEst(), { id: "bomba", upd: function () { TB.enchendo = true; return true; } });
      if (xagOrdem) { if (!M.naMao) r.push(irMist(), passoPegarMang()); r.push(irTanque(), passoTampa(true), passoPinar()); }
      if (tanque) r.push(passoEsperar());
      if (mang) r.push(irTanque(), passoTirarMang());
      if (xagOrdem) r.push(passoTampa(false));
      if (velha) r.push(irSpot("G2"), passoPegarChao("G2", function () { return TB.velha; }));
      /* 19/11/2026: acabou o que tinha de fazer junto da aeronave; avisa o piloto antes de levar a mangueira e a bateria embora */
      r.push({ id: "avisar", upd: function () { avisarPronto(); return true; } });
      if (mang) r.push(irMist(), passoDevolver());
      if (velha) r.push(irCarregador("livre"), passoCarregar());
      return r;
    }
    function rodarRoteiro(dt) {
      var s = TB.rot[TB.i];
      bombaTanque(dt);
      if (!s.iniciado) { s.iniciado = true; if (s.ini) s.ini(s); }
      var feito = s.upd(s, dt);
      aplicarPose(dt);
      if (feito) { if (s.fim) s.fim(s); TB.i++; return TB.i >= TB.rot.length; }
      return false;
    }
    /* interrompido: tudo volta a um estado coerente (a bateria no drone se ainda nao foi trocada) */
    function abortarRoteiro() {
      if (!TB.rot) return;
      TB.rot = null; TB.enchendo = false; TB.maoE = null; TB.tampaK = 0;
      if (M.fixo) { M.fixo = null; M.naMao = true; }
      if (!TB.trocada) {
        Q.semBateria = TB.semAntes;
        TB.props.forEach(function (p) { if (p.loc !== "drone") p.loc = "oculta"; });
        var vivos = TB.props.filter(function (p) { return p.loc === "drone"; });
        TB.noDrone = vivos[0] || null;
        TB.props.forEach(function (p) { if (p.loc === "oculta" && p !== TB.noDrone) { var k = bandejaLivre(); if (k >= 0) p.loc = "tray" + k; } });
      } else {
        TB.props.forEach(function (p) { if (p.loc !== "drone" && !/^tray[0-3]$/.test(p.loc)) p.loc = "oculta"; });
        TB.props.forEach(function (p) { if (p.loc === "oculta") { var k = bandejaLivre(); if (k >= 0) p.loc = "tray" + k; } });
      }
      if (Q.g) { restaurarRepouso(Q.g); Q.g.userData.xgParado = false; }
    }
    function terminarServico() {
      TB.rot = null;
      if (Q.g) { restaurarRepouso(Q.g); Q.g.userData.xgParado = false; }
      /* 18/11/2026 (Eduardo, testando o P60: "depois que a pessoa enche ela tem que se afastar"): terminou o que foi pedido,
         o auxiliar sai de perto da aeronave e volta para a cadeira, mesmo faltando bateria ou tanque. Antes ele ficava em pe
         ao lado esperando o proximo pedido, e era preciso mandar "Afastar do drone" para poder decolar. */
      if (semServico()) Q.estado = "voltando";
    }

    /* obstaculo enquanto esta de pe */
    var corpo = { tipo: "cil", x: 0, z: 0, r: 0.3, y0: 0, y1: 1.8, nome: "o badeco", xgAuxiliar: true,   /* xgAuxiliar: radar.js, bloqueioDecolagem */
      dica: "Gente perto da aeronave: o radar ve, e o app nao deixa decolar com alguem a menos de 6 m. Espere o badeco terminar e se afastar." };
    function marcarObstaculo(de_pe) {
      var i = colisores.indexOf(corpo);
      if (!de_pe || !Q.b) { if (i >= 0) colisores.splice(i, 1); return; }
      var p = Q.b.position;
      corpo.x = corpo.cx = p.x; corpo.z = corpo.cz = p.z; corpo.raio = corpo.r;
      corpo.y0 = alt(p.x, p.z); corpo.y1 = corpo.y0 + 1.8 - 0.8 * (Q.agacha || 0);   /* abaixado, e mais baixo */
      if (i < 0) colisores.push(corpo);
    }

    function andarAte(alvo, dt) {
      var p = Q.b.position, dx = alvo.x - p.x, dz = alvo.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { Q.amp = 0; return true; }
      var s = Math.min(d, VEL_ANDAR * (Q.fuga && Q.fuga.fase === "correr" ? VEL_FUGA : 1) * dt);
      var nx = p.x + dx / d * s, nz = p.z + dz / d * s;
      /* o corpo dele e obstaculo: fora da conta enquanto ele mesmo anda */
      var eu = colisores.indexOf(corpo); if (eu >= 0) colisores.splice(eu, 1);
      var bl = bloqueiaCaminhada(nx, nz); if (bl) { nx = bl[0]; nz = bl[1]; }
      if (eu >= 0) colisores.push(corpo);
      p.x = nx; p.z = nz; p.y = alt(p.x, p.z);
      Q.b.rotation.y = Math.atan2(dx, dz);
      var corre = !!(Q.fuga && Q.fuga.fase === "correr");                             /* correndo: passada de 1,3 m e perna bem aberta */
      Q.fase += s / (corre ? 1.3 : 0.72) * Math.PI; Q.amp += ((corre ? 0.8 : 0.42) - Q.amp) * Math.min(1, dt * (corre ? 12 : 6));   /* 18/11/2026: passo de 0,72 m, o que a perna cobre com esta abertura */
      return d - s < 0.05;
    }

    /* Pedidos do piloto ("Falar com auxiliar", falar_auxiliar.js) - 12/10/2026, Eduardo:
       - "ligar": poe a bateria e liga o drone (comeco da operacao);
       - "tanque" / "esvaziar": so o tanque (nao troca a bateria junto);
       - "bateria": troca a bateria;
       - "parar": para de abastecer/esvaziar e fica ao lado do drone;
       - "afastar": sai de perto do drone e senta (para decolar com o que tem).
       Terminado o servico ele fica esperando ao lado do drone enquanto ainda falta
       algo (bateria abaixo de 100% ou tanque sem encher); com tudo pronto, senta.
       Tudo so com o drone parado no chao e os motores desligados. */
    function podeAtender() {
      return drone.position.y <= alt(drone.position.x, drone.position.z) + 0.1 &&
        (["em solo", "concluído", "reabastecendo"].indexOf(V.estado) >= 0 || (V.estado === "manual" && !V.rodando));
    }
    function tanqueOk() {
      return P.xgMapeamento ? !(V.tan > 0) : V.tan >= T50.tanque - 0.05;
    }
    function semServico() { return !Q.tarefa.ligar && !Q.tarefa.bateria && !Q.tarefa.tanque && !Q.tarefa.esvaziar; }
    function zerarTarefas() { Q.tarefa = { ligar: false, bateria: false, tanque: false, esvaziar: false }; }
    /* 19/11/2026 (Eduardo: "quando o auxiliar encher o tanque ele fala que pode decolar que o tanque ta cheio ou quando ele so
       troca a bateria a bateria ta trocada pode decolar"): terminado o servico junto da aeronave, o auxiliar avisa. A fala vai
       em Q.fala e quem toca e o falar_auxiliar.js. */
    function avisarPronto() {
      if (!semServico() || Q.liberou) return;                      // ainda ha pedido: avisa no fim do proximo roteiro
      var p = Q.pedido || {}, cheio = !!p.tanque && !P.xgMapeamento && V.tan >= T50.tanque - 0.05;
      Q.fala = p.bat && cheio ? "pronto-completo" : p.bat ? (p.ligou ? "pronto-ligar" : "pronto-bateria") : cheio ? "pronto-tanque" : "pronto";
      Q.liberou = true; Q.pedido = { bat: false, ligou: false, tanque: false };
    }
    Q.pode = function (o) {
      if (!Q.b) return false;
      if (Q.aPe) return false;                                     // a pe, quem faz o servico e o piloto
      if (o === "afastar") return Q.estado !== "sentado" && Q.estado !== "voltando";
      if (o === "parar") return !!(Q.tarefa.tanque || Q.tarefa.esvaziar);
      if (!podeAtender()) return false;
      if (o === "completo") return animar() && Q.pode("tanque") && (Q.pode("ligar") || Q.pode("bateria"));   // bateria + tanque no mesmo roteiro
      if (o === "ligar") return !!Q.semBateria && !Q.tarefa.ligar;
      if (o === "bateria") return !Q.semBateria && !Q.tarefa.bateria && V.bat < 99.5;
      if (o === "tanque") return !Q.tarefa.tanque && !P.xgMapeamento && V.tan < T50.tanque - 0.05;
      if (o === "esvaziar") return !Q.tarefa.esvaziar && Number.isFinite(V.tan) && V.tan > 0;
      return false;
    };
    Q.pedir = function (o) {
      if (!Q.pode(o)) return false;
      Q.pergunta = false; TB.perf.linha = [];
      if (o === "afastar") { zerarTarefas(); abortarRoteiro(); Q.estado = "voltando"; Q.trabalho = 0; Q.liberou = true; return true; }
      if (o === "parar") { Q.tarefa.tanque = Q.tarefa.esvaziar = false; return true; }
      /* servico novo: o que for pedido daqui ate o fim entra na fala "pode decolar" (avisarPronto) */
      if ((semServico() && !TB.rot) || !Q.pedido) Q.pedido = { bat: false, ligou: false, tanque: false };
      Q.liberou = false;
      if (o === "completo" || o === "ligar" || o === "bateria") { Q.pedido.bat = true; if (Q.semBateria) Q.pedido.ligou = true; }
      if (o === "completo" || o === "tanque") Q.pedido.tanque = true;
      if (o === "completo") { Q.tarefa.tanque = true; Q.tarefa.esvaziar = false; if (Q.semBateria) Q.tarefa.ligar = true; else Q.tarefa.bateria = true; }
      if (o === "ligar") Q.tarefa.ligar = true;
      if (o === "bateria") Q.tarefa.bateria = true;
      if (o === "tanque") { Q.tarefa.tanque = true; Q.tarefa.esvaziar = false; }
      if (o === "esvaziar") { Q.tarefa.esvaziar = true; Q.tarefa.tanque = false; }
      if (Q.estado === "sentado" || Q.estado === "voltando" || Q.estado === "aguardando") { Q.estado = "indo"; Q.trabalho = 0; }
      if (V.estado === "reabastecendo") Q.prendeu = true;
      return true;
    };

    var conversa = false, rumoAntesConversa = 0;
    Q.conversar = function (ativa) {
      if (ativa && !conversa && Q.b) rumoAntesConversa = Q.b.rotation.y;
      if (!ativa && conversa && Q.b) Q.b.rotation.y = rumoAntesConversa;
      conversa = !!ativa;
      return conversa;
    };
    Q.emConversa = function () { return conversa; };

    /* ------------------------------------------------- fuga da decolagem (XAG)
       19/11/2026 (Eduardo, testando o P60): "quando o drone vai decolar ele da um apito antes de ligar a helice ai se a pessoa ta
       abastecendo ela grita 'ei to aqui' mas ela tira a mangueira e corre pra longe do drone ... o auxiliar tem q fazer esse
       movimento rapidamente pra simular a realidade depois q o drone levanta ela vem pra perto e fala 'ta querendo me matar,
       espera eu falar quando terminei d encher o tanque'". A decolagem NAO e barrada: so o "Abortar decolagem" da contagem do
       aplicativo a interrompe. Vale no voo do XAG; no DJI o app continua recusando a decolagem com gente perto (bloquear). */
    var fugaPresa = null;                                          // ponta da mangueira ainda na boca do tanque (fora do JSON da retomada)
    function comecarFuga() {
      if (Q.fuga || !Q.b || Q.estado === "sentado" || Q.aPe) return;
      var servico = !Q.liberou && (Q.estado === "indo" || Q.estado === "trabalhando");
      fugaPresa = M.fixo ? M.fixo.clone() : null;
      Q.fuga = { fase: fugaPresa ? "tirar" : "correr", t: 0, zangado: servico, tanque: !!(Q.tarefa.tanque || TB.enchendo || fugaPresa), falou: false };
      if (servico) Q.fala = "aqui";
      zerarTarefas(); abortarRoteiro();
      if (fugaPresa) { M.fixo = fugaPresa.clone(); M.naMao = false; }   // abortarRoteiro poe a ponta na mao de uma vez; aqui ela sai num tranco
      Q.estado = "voltando"; Q.trabalho = 0; Q.prendeu = false; Q.pergunta = false; Q.liberou = true; Q.agacha = 0;
    }
    /* o aplicativo comecou a contagem da decolagem e a aeronave apitou (campo, xgApitar): com ele de pe por perto, corre ja */
    Q.apitou = function () {
      if (ehXag() && Q.b && Q.estado !== "sentado" && !Q.aPe && !Q.semBateria && Q.perto() < RAIO_DECOLAGEM + 1) comecarFuga();
    };
    function irNaFuga(alvo, dt) { return animar() ? andarAteTB(alvo, dt, TB.sv) : andarAte(alvo, dt); }
    function bracosCorrendo(g, fase) {
      ["l", "r"].forEach(function (lado, k) {
        var a = 0.85 * Math.sin(fase + (k ? 0 : Math.PI)), sx = lado === "l" ? 0.12 : -0.12;   // o braco vai ao contrario da perna do mesmo lado
        apontar(g, "upperarm_" + lado, "lowerarm_" + lado, [sx, -Math.cos(a), Math.sin(a)]);
        apontar(g, "lowerarm_" + lado, "hand_" + lado, [sx * 0.3, -Math.cos(a + 1.25), Math.sin(a + 1.25)]);
      });
      g.userData.xgParado = false;
    }
    function bracosReclamando(g, t) {
      var w = Math.sin(t * 9) * 0.14;
      apontar(g, "upperarm_r", "lowerarm_r", [-0.5, -0.3, 0.6]); apontar(g, "lowerarm_r", "hand_r", [-0.2, 0.75 + w, 0.6]);
      apontar(g, "upperarm_l", "lowerarm_l", [0.5, -0.3, 0.6]); apontar(g, "lowerarm_l", "hand_l", [0.2, 0.75 - w, 0.6]);
      g.userData.xgParado = false;
    }
    function fugir(dt) {
      var F = Q.fuga, d = drone.position, g = Q.g;
      F.t += dt; F.total = (F.total || 0) + dt;
      if (F.fase === "tirar") {
        /* puxa a ponta da boca do tanque num tranco (0,45 s) */
        if (!fugaPresa) { F.fase = "correr"; F.t = 0; }
        else {
          var k = Math.min(1, F.t / 0.45);
          caminhar(g, 0, 0); segurar(g, k < 0.6);
          Q.b.updateMatrixWorld(true);
          M.fixo = misturar(fugaPresa, oM(g, "hand_r"), suave(k));
          if (k >= 1) { M.fixo = null; M.naMao = true; M.soltando = null; fugaPresa = null; F.fase = "correr"; F.t = 0; }
          mangueira(dt); marcarObstaculo(false);
          return;
        }
      }
      var o = grupoOperador.position, p = Q.b.position, dx = p.x - o.x, dz = p.z - o.z, n = Math.hypot(dx, dz) || 1;
      if (F.fase === "correr") {
        var chegou = false;
        if (F.zangado) {
          /* 19/11/2026 (ele, depois de ver no ar: "quando apitar o badeco sai correndo e vai ate o piloto correndo e grita com ele"):
             solta a mangueira (ela recolhe sozinha para o misturador) e corre direto ate o piloto */
          M.naMao = false;
          chegou = n <= 2.7 || irNaFuga(v3(o.x + dx / n * 2.4, 0, o.z + dz / n * 2.4), dt) || F.t > 10;
        } else {
          /* ja tinha avisado que terminou (ou estava indo embora): so corre; larga a mangueira no misturador e segue para a cadeira */
          if (M.naMao) { if (irNaFuga(M.pega, dt)) M.naMao = false; }
          else chegou = irNaFuga(L.bd, dt);
          var subiu = d.y > alt(d.x, d.z) + 2 || !V.rodando || F.t > 12;
          if (!M.naMao && subiu && Q.perto() > RAIO_DECOLAGEM + 3) chegou = true;
        }
        caminhar(g, Q.fase, Q.amp); bracosCorrendo(g, Q.fase);
        if (M.naMao) segurar(g, false);
        mangueira(dt); marcarObstaculo(false);                     // correndo ao lado dela, nao e obstaculo
        if (chegou) {
          restaurarRepouso(g); g.userData.xgParado = false; Q.amp = 0;
          if (!F.zangado) { Q.fuga = null; Q.estado = "voltando"; return; }
          F.fase = "reclamar"; F.t = 0; F.falou = false;
        }
        return;
      }
      /* reclamar: chegou no piloto; vira para ele e briga (espera o "Ei, to aqui!" acabar: 2,1 s desde o comeco da fuga) */
      marcarObstaculo(true);
      if (!F.falou && F.total < 2.1) {
        Q.b.rotation.y = Math.atan2(o.x - p.x, o.z - p.z);
        caminhar(g, 0, 0); bracosReclamando(g, F.total); mangueira(dt);
        F.t = 0;
        return;
      }
      if (!F.falou) { F.falou = true; F.t = 0; Q.amp = 0; Q.fala = F.tanque ? "matar-tanque" : "matar"; }
      Q.b.rotation.y = Math.atan2(o.x - p.x, o.z - p.z);
      caminhar(g, 0, 0); bracosReclamando(g, F.t);
      mangueira(dt);
      if (F.t > 5.5) { Q.fuga = null; restaurarRepouso(g); g.userData.xgParado = false; Q.estado = "voltando"; }
    }

    /* ------------------------------------------------- abaixar (drone no manual perto dele)
       19/11/2026 (Eduardo: o drone chegando perto do auxiliar no manual: ele se abaixa e grita "ta louco tira esse drone daqui") */
    var OSSOS_AGACHA = ["spine_01", "spine_02", "spine_03", "neck_01", "head", "upperarm_l", "lowerarm_l", "hand_l",
      "upperarm_r", "lowerarm_r", "hand_r", "thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r"];
    function perigoManual() {
      if (V.estado !== "manual" || !V.rodando || Q.aPe) return false;
      var d = drone.position, p = Q.b.position;
      if (d.y <= alt(d.x, d.z) + 0.4) return false;                // pousada ou quase
      return Math.hypot(d.x - p.x, d.z - p.z) < (Q.agacha > 0 ? 6 : 4.5) && d.y - p.y < 5;
    }
    /* a pose abaixada e montada uma vez por boneco (em pe e sentado) e depois so misturada com a de repouso */
    function poseAgachado(g, sentado) {
      var chave = sentado ? "xgAgS" : "xgAgP";
      if (g.userData[chave]) return g.userData[chave];
      var B = g.userData.B, av = g.userData.av, esc = g.scale.x || 1, C = { base: {}, q: {}, y0: 0, y1: 0 };
      restaurarRepouso(g); g.userData.xgSentado = false; g.userData.xgParado = false;
      if (sentado) sentar(g);
      OSSOS_AGACHA.forEach(function (n) { if (B[n]) C.base[n] = B[n].quaternion.clone(); });
      C.y0 = C.y1 = av.position.y;
      if (!sentado) {
        Q.b.updateMatrixWorld(true);
        var pe0 = Math.min(oM(g, "foot_l").y, oM(g, "foot_r").y);
        ["l", "r"].forEach(function (lado) {
          var s = lado === "l" ? 1 : -1;
          apontar(g, "thigh_" + lado, "calf_" + lado, [0.16 * s, -0.15, 1]);     // coxa quase deitada, para a frente
          apontar(g, "calf_" + lado, "foot_" + lado, [0, -1, -0.75]);            // canela para baixo e para tras
          apontar(g, "foot_" + lado, "ball_" + lado, [0, -0.2, 1]);              // pe no chao
        });
        Q.b.updateMatrixWorld(true);
        C.y1 = C.y0 - (Math.min(oM(g, "foot_l").y, oM(g, "foot_r").y) - pe0) / esc;   // o corpo desce o que os pes subiram
      }
      apontar(g, "spine_01", "spine_02", [0, 0.82, 0.57]);
      apontar(g, "spine_02", "spine_03", [0, 0.68, 0.73]);
      apontar(g, "neck_01", "head", [0, 0.45, 0.89]);
      ["l", "r"].forEach(function (lado) {                          // maos na cabeca
        var s = lado === "l" ? 1 : -1;
        apontar(g, "upperarm_" + lado, "lowerarm_" + lado, [0.4 * s, 0.35, 0.85]);
        apontar(g, "lowerarm_" + lado, "hand_" + lado, [-0.85 * s, 0.45, -0.25]);
      });
      OSSOS_AGACHA.forEach(function (n) { if (B[n]) C.q[n] = B[n].quaternion.clone(); });
      for (var n in C.base) B[n].quaternion.copy(C.base[n]);
      av.position.y = C.y0;
      g.userData[chave] = C;
      return C;
    }
    function agachar(g, k, sentado) {
      var C = poseAgachado(g, sentado), B = g.userData.B, e = suave(k);
      for (var n in C.q) B[n].quaternion.slerpQuaternions(C.base[n], C.q[n], e);
      g.userData.av.position.y = C.y0 + (C.y1 - C.y0) * e;
      g.userData.xgParado = false;
    }

    function badeco(dt) {
      if (!Q.b || !(dt > 0)) return;
      Q.relogio = (Q.relogio || 0) + dt;
      /* XAG: a aeronave vai sair do chao (apitando, ou com os motores ja ligados) e ele esta de pe por perto: corre */
      if (!Q.fuga && ehXag() && Q.estado !== "sentado" && !Q.aPe && !Q.semBateria && V.estado !== "caiu" && !podeAtender() &&
          drone.position.y <= alt(drone.position.x, drone.position.z) + 0.15 && Q.perto() < RAIO_DECOLAGEM + 1) comecarFuga();
      if (Q.fuga) { fugir(dt); return; }
      /* drone voando no manual perto dele: abaixa (e grita, no maximo uma vez a cada 8 s) */
      var risco = perigoManual();
      if (risco) Q.agachaAte = Q.relogio + 1.2;
      var baixo = risco || Q.relogio < (Q.agachaAte || 0);
      if (baixo && !Q.agachou) {
        Q.agachou = true;
        if (Q.relogio - (Q.gritoEm == null ? -99 : Q.gritoEm) > 8) { Q.fala = "louco"; Q.gritoEm = Q.relogio; }
      }
      if (baixo || Q.agacha > 0) {
        Q.agacha = entre(Q.agacha + (baixo ? dt : -dt) / 0.25, 0, 1);
        if (Q.agacha <= 0) { Q.agachou = false; restaurarRepouso(Q.g); Q.g.userData.xgParado = false; Q.g.userData.xgSentado = false; }
        else {
          agachar(Q.g, Q.agacha, Q.estado === "sentado");
          mangueira(dt); marcarObstaculo(Q.estado !== "sentado");
          return;
        }
      }
      if (conversa && !TB.rot) {
        var piloto = cam.getWorldPosition(new THREE.Vector3());
        Q.b.rotation.y = Math.atan2(piloto.x - Q.b.position.x, piloto.z - Q.b.position.z);
        if (Q.estado === 'sentado') sentar(Q.g); else caminhar(Q.g, 0, 0);
        marcarObstaculo(Q.estado !== 'sentado');
        if (V.estado === 'reabastecendo') V.espera = Math.max(V.espera || 0, 1);
        return;
      }
      /* o drone saiu do chao (ou ligou os motores) no meio do servico: larga e sai de perto */
      if ((Q.estado === "indo" || Q.estado === "trabalhando" || Q.estado === "aguardando") && !podeAtender()) { zerarTarefas(); abortarRoteiro(); Q.estado = "voltando"; }
      if (!animar() && Q.estado === "trabalhando" && Q.perto() > 1.8) { Q.estado = "indo"; Q.trabalho = 0; }

      /* voltou de um voo: sentado, ele pergunta se troca a bateria ou abastece (uma vez por pouso) */
      if (drone.position.y > alt(drone.position.x, drone.position.z) + 0.5) { Q.voou = true; Q.pergunta = false; }
      else if (Q.voou && podeAtender()) { Q.voou = false; if (Q.estado === "sentado" && (V.bat < 99.5 || !tanqueOk())) Q.pergunta = true; }
      /* pousado para reabastecer, a aeronave so decola de novo quando o piloto manda
         (Continuar); nada enche nem troca sozinho */
      if (V.estado === "reabastecendo") V.espera = Math.max(V.espera || 0, 1);

      if (animar() && (Q.estado === "indo" || Q.estado === "trabalhando")) {
        /* o servico (carregador, mangueira, drone, bateria, tanque, volta) e um roteiro animado: veja "troca de bateria animada" */
        Q.estado = "trabalhando";
        if (!TB.rot) {
          var tc = performance.now(); TB.rot = construirRoteiro(); TB.i = 0; TB.perf.construir = +(performance.now() - tc).toFixed(1);
          if (!TB.rot.length) { TB.rot = null; zerarTarefas(); terminarServico(); }
        } else if (rodarRoteiro(dt)) terminarServico();
      } else if (Q.estado === "indo") {
        /* abastecer: primeiro passa no misturador e pega a mangueira */
        if (!M.naMao && precisaMangueira()) { if (andarAte(M.pega, dt)) M.naMao = true; }
        else if (andarAte(ladoDoDrone(new THREE.Vector3()), dt)) { Q.estado = "trabalhando"; Q.trabalho = 0; }
      } else if (Q.estado === "trabalhando" && !Q.tarefa.ligar && !Q.tarefa.bateria && !M.naMao && precisaMangueira()) {
        Q.estado = "indo";                                         // pediram tanque depois: busca a mangueira
      } else if (Q.estado === "trabalhando") {
        Q.amp = 0;
        Q.b.rotation.y = Math.atan2(drone.position.x - Q.b.position.x, drone.position.z - Q.b.position.z);
        Q.trabalho += dt;
        if (Q.tarefa.ligar || Q.tarefa.bateria) {
          if (Q.trabalho >= TROCA_BATERIA_S) {
            V.bat = Q.batAntes = 100; V.avisoBat = false; Q.semBateria = false;
            if (window.xgBateria) xgBateria.rever();
            Q.tarefa.ligar = Q.tarefa.bateria = false; Q.trabalho = 0;
          }
        } else if (Q.tarefa.esvaziar) {
          // Transferencia para o recipiente do auxiliar: nao passa pela bomba
          // de pulverizacao e nao conta como calda aplicada na cultura.
          var retirar = Math.min(V.tan, FLUXO_LMIN / 60 * dt);
          V.tan = Q.tanAntes = Math.max(0, V.tan - retirar);
          Q.retirado = (Number.isFinite(Q.retirado) ? Q.retirado : 0) + retirar;
          if (!(V.tan > 0)) Q.tarefa.esvaziar = false;
        } else if (Q.tarefa.tanque) {
          V.tan = Q.tanAntes = Math.min(T50.tanque, V.tan + FLUXO_LMIN / 60 * dt);
          if (V.tan >= T50.tanque) Q.tarefa.tanque = false;
        }
        /* 18/11/2026: terminou o pedido, afasta-se sempre (ver terminarServico) */
        if (semServico()) { avisarPronto(); Q.estado = "voltando"; }
      } else if (Q.estado === "aguardando") {
        /* em pe ao lado do drone, esperando o proximo pedido (ou "afastar") */
        if (andarAte(ladoDoDrone(new THREE.Vector3()), dt)) {
          Q.amp = 0;
          Q.b.rotation.y = Math.atan2(drone.position.x - Q.b.position.x, drone.position.z - Q.b.position.z);
        }
      } else if (Q.estado === "voltando") {
        /* com a mangueira na mao, devolve no misturador antes de sentar */
        var chegou = false;
        if (M.naMao) { if (andarAte(M.pega, dt)) M.naMao = false; }
        else chegou = animar() ? andarAteTB(L.bd, dt, TB.sv) : andarAte(L.bd, dt);
        /* longe do drone, ele solta a trava. A espera NAO zera: quem manda decolar
           de novo e o operador (Continuar) */
        if (Q.prendeu && Q.perto() > RAIO_DECOLAGEM) Q.prendeu = false;
        if (chegou) { Q.estado = "sentado"; Q.b.rotation.y = L.yaw; }
      }

      if (Q.estado === "sentado") { Q.b.position.set(L.bd.x, alt(L.bd.x, L.bd.z), L.bd.z); sentar(Q.g); }
      else if (TB.rot) { /* a pose vem do roteiro (aplicarPose) */ }
      else if (!animar() && Q.estado === "trabalhando" && (Q.tarefa.bateria || Q.tarefa.ligar)) trocarBateria(Q.g);
      else caminhar(Q.g, Q.fase, Q.amp);
      if (M.naMao && Q.estado !== "sentado" && !TB.rot && (animar() || !(Q.estado === "trabalhando" && (Q.tarefa.bateria || Q.tarefa.ligar))))
        segurar(Q.g, !animar() && Q.estado === "trabalhando");
      mangueira(dt);
      marcarObstaculo(Q.estado !== "sentado");
    }

    /* ------------------------------------------------- piloto a pe
       Pedido do Eduardo (16/10/2026): "um botao pra pessoa ativar e, ativado, o
       personagem caminha com os mesmos comandos do drone, mas o rosto usa o mouse
       pra virar". O botao e o `Q.andar` (falar_auxiliar.js). A pe, ele faz com as
       proprias maos o que o auxiliar faz - com os mesmos numeros (25 s para a
       bateria, 80 L/min no tanque) - e na mesma ordem das coisas:
       - perto do drone: "Colocar a bateria e ligar" (sem bateria) ou "Trocar a
         bateria" (abaixo de 100%);
       - perto do misturador: "Pegar a mangueira"; com ela na mao, perto do drone:
         "Abastecer o tanque"; de volta ao misturador: "Devolver a mangueira"
         (de maos ocupadas ele nao troca a bateria);
       - tecla E (ou clique com o mouse preso); E de novo para.
       So com o drone parado no chao e os motores desligados: se ele sair do chao,
       o piloto volta para a cadeira. A menos de 6 m do drone o app nao decola
       (xgProtecao.bloqueioDecolagem ja conta o operador). O auxiliar ocioso ao
       lado do drone vai sentar. */
    var ALCANCE_MAOS = 2.8;
    var TX = {
      pt: { ligar: "Colocar a bateria e ligar o drone", bateria: "Trocar a bateria", tanque: "Abastecer o tanque",
        pegar: "Pegar a mangueira", devolver: "Devolver a mangueira", parar: "parar",
        fazligar: "Colocando a bateria e ligando o drone…", fazbateria: "Trocando a bateria…", faztanque: "Abastecendo o tanque…",
        okligar: "Bateria colocada. Drone ligado.", okbateria: "Bateria trocada.", oktanque: "Tanque cheio.",
        semMangueira: "Pegue a mangueira no misturador para abastecer.",
        guardeMangueira: "Devolva a mangueira no misturador.",
        travar: "Clique na cena para olhar com o mouse (se não prender, arraste com o botão esquerdo).",
        dica: "Andar e girar: as mesmas teclas do drone · Mouse: olhar · Shift: correr · E: interagir · Esc: soltar o mouse",
        travarCheia: "Para olhar, arraste com o botão esquerdo do mouse.",
        dicaCheia: "Andar e girar: as mesmas teclas do drone · Arrastar o mouse: olhar · Shift: correr · E: interagir",
        sentar: "Voltar à cadeira" },
      en: { ligar: "Put the battery in and turn on the drone", bateria: "Change the battery", tanque: "Fill the tank",
        pegar: "Pick up the hose", devolver: "Put the hose back", parar: "stop",
        fazligar: "Installing the battery and turning on the drone…", fazbateria: "Changing the battery…", faztanque: "Filling the tank…",
        okligar: "Battery installed. Drone on.", okbateria: "Battery changed.", oktanque: "Tank full.",
        semMangueira: "Pick up the hose at the mixer to fill the tank.",
        guardeMangueira: "Put the hose back at the mixer.",
        travar: "Click the view to look around with the mouse (if it does not lock, drag with the left button).",
        dica: "Walk and turn: the same keys as the drone · Mouse: look · Shift: run · E: interact · Esc: release the mouse",
        travarCheia: "To look around, drag with the left mouse button.",
        dicaCheia: "Walk and turn: the same keys as the drone · Drag the mouse: look · Shift: run · E: interact",
        sentar: "Back to the chair" },
      es: { ligar: "Poner la batería y encender el dron", bateria: "Cambiar la batería", tanque: "Llenar el tanque",
        pegar: "Tomar la manguera", devolver: "Devolver la manguera", parar: "parar",
        fazligar: "Poniendo la batería y encendiendo el dron…", fazbateria: "Cambiando la batería…", faztanque: "Llenando el tanque…",
        okligar: "Batería puesta. Dron encendido.", okbateria: "Batería cambiada.", oktanque: "Tanque lleno.",
        semMangueira: "Toma la manguera en la mezcladora para llenar el tanque.",
        guardeMangueira: "Devuelve la manguera en la mezcladora.",
        travar: "Haz clic en la escena para mirar con el mouse (si no se fija, arrastra con el botón izquierdo).",
        dica: "Caminar y girar: las mismas teclas del dron · Mouse: mirar · Shift: correr · E: interactuar · Esc: soltar el mouse",
        travarCheia: "Para mirar, arrastra con el botón izquierdo del mouse.",
        dicaCheia: "Caminar y girar: las mismas teclas del dron · Arrastrar el mouse: mirar · Shift: correr · E: interactuar",
        sentar: "Volver a la silla" }
    };
    function lingua() {
      try { var l = parent.TPD_IDIOMAS && parent.TPD_IDIOMAS.atual(); return TX[l] ? l : "pt"; } catch (e) { return "pt"; }
    }
    function tx(k) { return (TX[lingua()] || TX.pt)[k] || TX.pt[k] || k; }

    function gdist(x, z) { var o = grupoOperador.position; return Math.hypot(o.x - x, o.z - z); }
    function noDrone() { return gdist(drone.position.x, drone.position.z) <= ALCANCE_MAOS && podeAtender(); }
    function noMisturador() { return !!(M.g && M.rig) && gdist(M.pega.x, M.pega.z) <= 1.6; }
    function pilotoPerto() { return Q.aPe && gdist(drone.position.x, drone.position.z) < RAIO_DECOLAGEM; }
    function precisaTanque() { return !P.xgMapeamento && V.tan < T50.tanque - 0.05; }

    /* o que a tecla E faz agora; { dica } e so um recado, sem acao */
    function acao() {
      if (!Q.aPe) return null;
      if (Q.fazendo) return { id: Q.fazendo.o, parar: true };
      var perto = noDrone();
      if (M.piloto) {
        if (perto && precisaTanque()) return { id: "tanque" };
        if (noMisturador()) return { id: "devolver" };
        return perto ? { dica: "guardeMangueira" } : null;
      }
      if (perto) {
        if (Q.semBateria) return { id: "ligar" };
        if (V.bat < 99.5) return { id: "bateria" };
        if (precisaTanque() && !mangueiraAlcanca()) return { id: "tanque" };    // sem mangueira que alcance: direto, como o auxiliar
      }
      if (precisaTanque() && mangueiraAlcanca() && !M.naMao) {
        if (noMisturador()) return { id: "pegar" };
        if (perto) return { dica: "semMangueira" };
      }
      return null;
    }
    Q.acao = function () { var a = acao(); return a ? { id: a.id || null, parar: !!a.parar, dica: a.dica || null } : null; };

    Q.interagir = function () {
      if (!Q.aPe) return false;
      if (Q.fazendo) { Q.fazendo = null; return true; }           // E de novo: para
      var a = acao();
      if (!a || !a.id) return false;
      if (a.id === "pegar") { M.piloto = true; M.soltando = null; }
      else if (a.id === "devolver") { M.piloto = false; M.soltando = "piloto"; }
      else Q.fazendo = { o: a.id, t: 0 };
      return true;
    };

    /* 16/10/2026: por enquanto so o administrador (e o teste em localhost), como o RC Plus pelo cabo
       (rc_plus_cabo.js): a publicacao de simulador-previa entrega os MESMOS arquivos a todas as contas,
       entao a trava e aqui, no codigo. Quando for para os alunos, e so tirar esta linha. */
    function liberadoParaPe() {
      try {
        if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return true;
        var c = parent.CONTAS && parent.CONTAS.atual && parent.CONTAS.atual();
        return !!(c && c.admin === true);
      } catch (e) { return false; }
    }
    /* o botao: so aparece com o drone parado, motores desligados e o auxiliar sem servico */
    Q.podeAndar = function () {
      if (Q.aPe) return true;
      if (!liberadoParaPe()) return false;
      return !!(window.__xgPiloto && Q.b && grupoOperador && grupoOperador.children.length && grupoOperador.children[0].userData.B &&
        !modoMapa && !conversa && podeAtender() && semServico());
    };
    Q.andar = function (ativa) {
      if (!ativa) {
        if (!Q.aPe) return false;
        Q.aPe = false; Q.fazendo = null;
        if (M.piloto) { M.piloto = false; M.soltando = "piloto"; }
        try { if (window.xgAndar && xgAndar.soltar) xgAndar.soltar(); } catch (e) { /* segue */ }
        return false;
      }
      if (Q.aPe) return true;
      if (!Q.podeAndar()) return false;
      Q.aPe = true; Q.fazendo = null;
      if (typeof definirVista === "function" && vista !== "operador") definirVista("operador");
      return true;
    };

    /* corpos que nao entram em `colisores` (nao mexem no voo): o piloto a pe nao os atravessa */
    function caixaLocal(g) {
      g.updateMatrixWorld(true);
      var inv = g.matrixWorld.clone().invert(), box = new THREE.Box3(), cada = new THREE.Box3(), primeira = true;
      g.traverse(function (o) {
        if (!o.isMesh || o.isSkinnedMesh || !o.geometry) return;
        o.geometry.computeBoundingBox();
        cada.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        if (primeira) box.copy(cada); else box.union(cada);
        primeira = false;
      });
      return primeira ? null : box;
    }
    function forasDaCaixa(g, caixa, x, z, folga) {
      if (!g || !caixa) return null;
      var c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y), dx = x - g.position.x, dz = z - g.position.z;
      var lx = dx * c - dz * s, lz = dx * s + dz * c;
      var x0 = caixa.min.x - folga, x1 = caixa.max.x + folga, z0 = caixa.min.z - folga, z1 = caixa.max.z + folga;
      if (lx <= x0 || lx >= x1 || lz <= z0 || lz >= z1) return null;
      var d = [lx - x0, x1 - lx, lz - z0, z1 - lz], i = d.indexOf(Math.min.apply(null, d));
      if (i === 0) lx = x0; else if (i === 1) lx = x1; else if (i === 2) lz = z0; else lz = z1;
      return [g.position.x + lx * c + lz * s, g.position.z - lx * s + lz * c];
    }
    Q.bloquearPe = function (x, z) {
      var mexeu = false, r;
      /* o drone: corpo e bracos */
      var raio = Math.max(1.3, (T50.raioHelice || 0.6) * 2);
      var dx = x - drone.position.x, dz = z - drone.position.z, d = Math.hypot(dx, dz);
      if (d < raio) { var k = raio / Math.max(0.01, d); x = drone.position.x + dx * k; z = drone.position.z + dz * k; mexeu = true; }
      /* a mangueira so vai ate onde ela alcanca */
      if (M.piloto) {
        var ex = x - M.ancora.x, ez = z - M.ancora.z, e = Math.hypot(ex, ez), lim = MANG_M - 0.8;
        if (e > lim) { x = M.ancora.x + ex / e * lim; z = M.ancora.z + ez / e * lim; mexeu = true; }
      }
      /* misturador e gerador */
      if (M.g && (r = forasDaCaixa(M.g, M.caixa, x, z, 0.3))) { x = r[0]; z = r[1]; mexeu = true; }
      if (EQ.gerador) {
        if (!EQ.caixa) EQ.caixa = caixaLocal(EQ.gerador);
        if ((r = forasDaCaixa(EQ.gerador, EQ.caixa, x, z, 0.3))) { x = r[0]; z = r[1]; mexeu = true; }
      }
      /* carretinha (caixa alinhada aos eixos, ver naCarretinha) */
      if (EQ.carretinha && naCarretinha(x, z, 0.3)) {
        var c = lugarDaCarretinha(), x0 = c.x - 1.93 - 0.3, x1 = c.x + 3.24 + 0.3, z0 = c.z - 1.24 - 0.3, z1 = c.z + 1.24 + 0.3;
        var dd = [x - x0, x1 - x, z - z0, z1 - z], i = dd.indexOf(Math.min.apply(null, dd));
        if (i === 0) x = x0; else if (i === 1) x = x1; else if (i === 2) z = z0; else z = z1;
        mexeu = true;
      }
      return mexeu ? [x, z] : null;
    };

    /* ---- recado na tela (dentro do campo) */
    var hud = null, avisoChave = "", avisoAte = 0;
    function avisar(chave) { avisoChave = chave; avisoAte = performance.now() + 2600; }
    function hudCriar() {
      function div(css) { var e = document.createElement("div"); e.style.cssText = css; return e; }
      var raiz = div("position:fixed;left:50%;top:56%;transform:translateX(-50%);z-index:40;width:min(600px,calc(100vw - 24px));" +
        "display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;font:600 15px/1.35 system-ui,sans-serif;" +
        "color:#fff;text-align:center");
      raiz.id = "xg-ape"; raiz.setAttribute("data-sem-traducao", "");
      var cartao = div("padding:8px 16px;border-radius:9px;background:rgba(13,30,21,.92);border:1px solid #8dac7c;display:none");
      var barra = div("width:260px;height:8px;border-radius:5px;background:rgba(255,255,255,.22);overflow:hidden;display:none");
      var enche = div("height:100%;width:0;background:#7cc955"); barra.appendChild(enche);
      var aviso = div("padding:6px 14px;border-radius:8px;background:rgba(40,90,40,.94);display:none");
      var trava = div("font:600 13px/1.4 system-ui,sans-serif;color:#ffe9a8;text-shadow:0 1px 3px #000;display:none");
      var dica = div("font:500 12px/1.4 system-ui,sans-serif;opacity:.92;text-shadow:0 1px 3px #000;max-width:540px");
      var volta = document.createElement("button"); volta.type = "button";
      volta.style.cssText = "pointer-events:auto;min-height:34px;padding:6px 12px;border:1px solid #8dac7c;border-radius:7px;background:#183527;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;display:none";
      volta.onclick = function () { Q.andar(false); };
      raiz.appendChild(cartao); raiz.appendChild(barra); raiz.appendChild(aviso); raiz.appendChild(trava); raiz.appendChild(dica); raiz.appendChild(volta);
      document.body.appendChild(raiz);
      hud = { raiz: raiz, cartao: cartao, barra: barra, enche: enche, aviso: aviso, trava: trava, dica: dica, volta: volta, sig: "" };
    }
    function hudAtualizar() {
      if (!hud) hudCriar();
      var a = acao(), travado = !!document.pointerLockElement, agora = performance.now(), mostrarAviso = agora < avisoAte;
      /* 23/11/2026: em tela cheia o mouse nao e preso (manual.js, xgAndar.telaCheia): a dica nao fala do Esc */
      var cheia = !!(window.xgAndar && xgAndar.telaCheia && xgAndar.telaCheia());
      hud.raiz.style.display = "flex";
      var sig = [lingua(), a ? (a.id || "") + (a.parar ? "!" : "") + (a.dica || "") : "-", travado, mostrarAviso ? avisoChave : "", cheia].join("|");
      if (sig !== hud.sig) {
        hud.sig = sig;
        var t = a ? (a.parar ? tx("faz" + a.id) + "   ·   [E] " + tx("parar") : a.id ? "[E] " + tx(a.id) : tx(a.dica)) : "";
        hud.cartao.textContent = t; hud.cartao.style.display = t ? "block" : "none";
        hud.aviso.textContent = mostrarAviso ? tx(avisoChave) : ""; hud.aviso.style.display = mostrarAviso ? "block" : "none";
        hud.trava.textContent = tx(cheia ? "travarCheia" : "travar"); hud.trava.style.display = travado ? "none" : "block";
        hud.dica.textContent = tx(cheia ? "dicaCheia" : "dica");
        hud.volta.textContent = tx("sentar"); hud.volta.style.display = travado ? "none" : "inline-block";
        hud.barra.style.display = a && a.parar ? "block" : "none";
      }
      if (a && a.parar) {
        var f = Q.fazendo, frac = f.o === "tanque" ? V.tan / T50.tanque : f.t / TROCA_BATERIA_S;
        hud.enche.style.width = Math.max(0, Math.min(100, frac * 100)).toFixed(1) + "%";
      }
    }

    function piloto(dt) {
      if (!Q.aPe) { if (hud && hud.raiz.style.display !== "none") hud.raiz.style.display = "none"; return; }
      /* o drone saiu do chao ou ligou os motores: volta para a cadeira e pega os manches */
      if (!podeAtender()) { Q.andar(false); return; }
      /* o auxiliar ocioso ao lado do drone vai sentar: agora quem faz e o piloto */
      if (Q.estado === "aguardando" && semServico()) Q.estado = "voltando";
      var F = Q.fazendo;
      if (F) {
        if (gdist(drone.position.x, drone.position.z) > ALCANCE_MAOS + 0.8) Q.fazendo = null;          // afastou: larga
        else if (F.o === "tanque") {
          V.tan = Q.tanAntes = Math.min(T50.tanque, V.tan + FLUXO_LMIN / 60 * dt);
          if (V.tan >= T50.tanque - 0.001) { Q.fazendo = null; avisar("oktanque"); }
        } else {
          F.t += dt;
          if (F.t >= TROCA_BATERIA_S) {
            V.bat = Q.batAntes = 100; V.avisoBat = false; Q.semBateria = false;
            if (window.xgBateria) xgBateria.rever();
            Q.fazendo = null; avisar(F.o === "ligar" ? "okligar" : "okbateria");
          }
        }
      }
      hudAtualizar();
    }
    /* a tecla E: antes dos botoes do controle (E e o L2 do holofote) */
    function teclaE(e, desceu) {
      if (e.code !== "KeyE" || !Q.aPe) return;
      if (window.PAUSA_SIM && PAUSA_SIM.pausado) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (desceu && !e.repeat) Q.interagir();
    }
    window.addEventListener("keydown", function (e) { teclaE(e, true); }, true);
    window.addEventListener("keyup", function (e) { teclaE(e, false); }, true);

    /* ----------------------------------------------------------- operador */
    function operador(dt) {
      var A = window.xgAndar, o = grupoOperador.position, g = grupoOperador.children[0];
      Q.operadorSentado = false;
      Q.operadorIndo = false;
      if (!g || !g.userData.B) return;
      /* demarcando (manual.js) ou no mapa do jogo: em pe, quem anda e outro */
      if (modoMapa || (A && A.ativo) || Q.aPe) { g.userData.xgSentado = false; g.userData.av.position.y = g.userData.avY; alturaDoControle(g, false); return; }
      var dx = L.op.x - o.x, dz = L.op.z - o.z, d = Math.hypot(dx, dz);
      if (d > 0.05) {
        /* volta andando para a cadeira */
        var s = Math.min(d, VEL_ANDAR * dt);
        o.x += dx / d * s; o.z += dz / d * s; o.y = alt(o.x, o.z);
        grupoOperador.rotation.y = Math.atan2(dx, dz);
        andar.fase += s / 1.35 * Math.PI; andar.amp += (0.42 - andar.amp) * Math.min(1, dt * 6);
        g.userData.xgSentado = false;
        g.userData.av.position.y = g.userData.avY;   // levantou da cadeira
        alturaDoControle(g, false);
        pose(andar.fase);
        if (d - s > 0.05) { Q.operadorIndo = true; return; }
      }
      o.set(L.op.x, alt(L.op.x, L.op.z), L.op.z);
      grupoOperador.rotation.y = L.yaw; andar.amp = 0;
      sentar(g);
      Q.operadorSentado = true;
    }

    /* -------------------------------------------------- ganchos no jogo */
    // O servico acompanha o relogio do jogo, mesmo em VR, com motores parados.
    // posCamera nao e chamada no VR nem deve avancar o trabalho ao trocar vista.
    /* 24/10/2026 (veiculo.js, camionete dirigivel): enquanto o aluno leva a camionete o acampamento some (cadeiras,
       misturador, gerador, carregador, baterias da bandeja, auxiliar e o proprio operador: vao no carro). Ao estacionar,
       reposicionar() leva tudo para a base nova - o operador ja na cadeira e o auxiliar ao lado do drone. */
    var recolhido = false, estavaRecolhido = false;
    Q.acampamento = function (visivel) { recolhido = !visivel; };
    Q.reposicionar = function () {
      L = porCadeiras();
      porMisturador();
      if (Q.b) { ladoDoDrone(Q.b.position); Q.b.rotation.y = Math.atan2(drone.position.x - Q.b.position.x, drone.position.z - Q.b.position.z); }
      grupoOperador.position.set(L.op.x, alt(L.op.x, L.op.z), L.op.z);
      grupoOperador.rotation.y = L.yaw;
    };
    /* 24/10/2026 (Eduardo: "o auxiliar tem que estar sempre perto da estrutura, ele esta comecando la no fim do mundo"): ao trocar de mapa,
       ou quando a base muda, o operador e a mesa iam para a base nova mas o auxiliar ficava onde estava no mapa anterior (140 m no mapa
       das matas) e tinha de andar ate la. Ao reiniciar o voo, quem ficou a mais de 20 m da estrutura vai para o lado dela. */
    function juntarNaBase() {
      if (Q.b && Math.hypot(Q.b.position.x - drone.position.x, Q.b.position.z - drone.position.z) > 20) {
        ladoDoDrone(Q.b.position);
        Q.b.rotation.y = Math.atan2(drone.position.x - Q.b.position.x, drone.position.z - Q.b.position.z);
      }
      var o = grupoOperador.position;
      if (Math.hypot(o.x - L.op.x, o.z - L.op.z) > 20) { o.set(L.op.x, alt(L.op.x, L.op.z), L.op.z); grupoOperador.rotation.y = L.yaw; }
    }
    function aplicarAcampamento() {
      if (!recolhido && !estavaRecolhido) return;
      var v = !recolhido;
      [cad.op, cad.bd, M.g, EQ.gerador, CH.g, CH.cabo, Q.b, grupoOperador].forEach(function (o) { if (o) o.visible = v; });
      if (recolhido) TB.props.forEach(function (p) { if (p.g) p.g.visible = false; });
      estavaRecolhido = recolhido;
    }
    var quadroAntes = quadro;
    quadro = function (t, frame) {
      if (!(window.PAUSA_SIM && PAUSA_SIM.pausado) && inclina.children.length) {
        var dt = Math.max(0, Math.min(0.05, (t - ant) / 1000));
        var gasto0 = performance.now();
        try { sincronizar(); } catch (e) { /* nao derruba o laco */ }
        try { badeco(dt * (V.mult || 1)); }
        catch (e) {
          /* um erro no auxiliar nunca pode congelar o simulador: desiste do servico e manda ele sentar */
          if (!TB.errouBadeco) { TB.errouBadeco = true; console.warn("auxiliar:", e); }
          try { abortarRoteiro(); zerarTarefas(); if (Q.estado === "indo" || Q.estado === "trabalhando") Q.estado = "voltando"; } catch (e2) { /* segue */ }
        }
        try { piloto(dt * (V.mult || 1)); } catch (e) { /* nao derruba o laco */ }
        var gasto = performance.now() - gasto0, ps = TB.perf, pid = TB.rot && TB.rot[TB.i] ? TB.rot[TB.i].id : Q.estado;   // diagnostico: ms do auxiliar por quadro
        var pa = ps.por[pid] || (ps.por[pid] = { n: 0, soma: 0, max: 0 }); pa.n++; pa.soma += gasto; if (gasto > pa.max) pa.max = gasto;
        if (ps.linha && ps.linha.length < 90) ps.linha.push(+gasto.toFixed(1));            // os primeiros 90 quadros depois do pedido
      }
      try { aplicarAcampamento(); } catch (e) { /* nao derruba o laco */ }
      return quadroAntes.apply(this, arguments);
    };
    /* o piloto sentado so existe com a visao do piloto do DJI (ponte.visaoDoPiloto);
       no XAG (12/10/2026) entra so o auxiliar, o misturador e as travas */
    if (window.__xgPiloto) {
    var posAntes = posCamera;
    posCamera = function (a, dt) {
      try { operador(dt || 0); } catch (e) { /* nao derruba o laco */ }
      return posAntes.apply(this, arguments);
    };
    /* sentado ou indo para a cadeira, o corpo nao vira para o drone */
    var acompAntes = acompanharDrone;
    acompanharDrone = function () { if (Q.operadorSentado || Q.operadorIndo) return; return acompAntes.apply(this, arguments); };
    /* indo para a cadeira, olha para onde anda (a cadeira), nao para o drone;
       sentado, os olhos ficam mais baixos */
    var mirarAntes = mirarOperador;
    mirarOperador = function () {
      if (Q.operadorIndo) {
        var o = grupoOperador.position, r = grupoOperador.rotation.y;
        var olho = new THREE.Vector3(o.x, o.y + 1.62, o.z), b = -0.2;
        cam.position.copy(olho);
        cam.lookAt(olho.x + Math.sin(r) * 10 * Math.cos(b), olho.y + Math.sin(b) * 10, olho.z + Math.cos(r) * 10 * Math.cos(b));
        cam.updateMatrixWorld();
        return;
      }
      if (!Q.operadorSentado) return mirarAntes.apply(this, arguments);
      var dz = descida(grupoOperador.children[0]);
      grupoOperador.position.y -= dz;
      try { return mirarAntes.apply(this, arguments); } finally { grupoOperador.position.y += dz; }
    };
    }
    /* tanque e bateria de verdade: so uma queda devolve tudo novo */
    var reiniciarAntes = reiniciarVoo;
    reiniciarVoo = function () {
      var caiu = V.estado === "caiu", tan = V.tan, bat = V.bat;
      var r = reiniciarAntes.apply(this, arguments);
      if (!caiu && typeof tan === "number") { V.tan = tan; V.bat = bat; }
      L = porCadeiras();
      porMisturador();
      juntarNaBase();
      return r;
    };
    /* Trava geral: o Iniciar do app, o "Continuar da base" depois de
       reabastecer e o decolar do jogo mandam a aeronave subir por caminhos
       diferentes (e os dois primeiros ainda enchiam tanque e bateria na
       hora). Com o badeco a menos de 6 m, nenhum deles sai do chao: volta
       ao que era, sem o enchimento magico, e o app avisa. */
    Q.tanAntes = V.tan; Q.batAntes = V.bat;
    function avisoSemBateria() {
      if (typeof mostrarAlerta === "function")
        mostrarAlerta("Aeronave sem bateria", "Peça ao auxiliar para ligar o drone (Falar com auxiliar → Ligar o drone).",
          [{ txt: "Ok", fn: function () { if (typeof fecharAlerta === "function") fecharAlerta(); } }], true);
    }
    function bloquear() {
      var noChao = drone.position.y <= alt(drone.position.x, drone.position.z) + 0.3;
      /* sem bateria nada liga: nem rota, nem Continuar, nem os motores no manual */
      if (Q.semBateria && noChao && V.rodando && ["subindo", "indo", "aplicando", "manual"].indexOf(V.estado) >= 0) {
        V.tan = Q.tanAntes; V.bat = Q.batAntes = 0;
        V.estado = "em solo"; V.rodando = false; V.v = 0; V.vy = 0; V.mvx = 0; V.mvz = 0;
        avisoSemBateria();
        return true;
      }
      /* 19/11/2026: no voo do XAG o auxiliar perto nao barra (ele corre: comecarFuga); o piloto a pe continua barrando */
      if (!noChao || ((Q.estado === "sentado" || Q.perto() >= RAIO_DECOLAGEM || ehXag()) && !pilotoPerto())) return false;
      if (["subindo", "indo", "aplicando"].indexOf(V.estado) < 0) return false;
      V.tan = Q.tanAntes; V.bat = Q.batAntes;
      if (Q.prendeu) { V.estado = "reabastecendo"; V.rodando = true; V.espera = 1; }
      else { V.estado = "em solo"; V.rodando = false; }
      if (typeof mostrarAlerta === "function")
        mostrarAlerta("Não é possível decolar", "Pedestres ou obstáculos detectados perto da aeronave.",
          [{ txt: "Ok", fn: function () { if (typeof fecharAlerta === "function") fecharAlerta(); } }], true);
      return true;
    }
    var passoAntes = passo;
    passo = function (dt) {
      if (bloquear()) return;
      var r = passoAntes.apply(this, arguments);
      Q.tanAntes = V.tan; Q.batAntes = V.bat;
      return r;
    };

    /* gente a menos de 6 m: o app nao deixa decolar */
    var decolarAntes = decolar;
    decolar = function () {
      if (Q.semBateria) { avisoSemBateria(); return; }
      if ((!ehXag() && Q.estado !== "sentado" && Q.perto() < RAIO_DECOLAGEM) || pilotoPerto()) {
        if (typeof mostrarAlerta === "function")
          mostrarAlerta("Não é possível decolar", "Pedestres ou obstáculos detectados perto da aeronave.", [{ txt: "Ok", fn: function () { if (typeof fecharAlerta === "function") fecharAlerta(); } }], true);
        return;
      }
      return decolarAntes.apply(this, arguments);
    };
    return true;
  }

  function Equipe(ponte) { this.ponte = ponte; this.instalado = false; }
  Equipe.prototype.ciclo = function () {
    if (this.instalado) return;
    var j = this.ponte && this.ponte.janela;
    if (!j) return;
    try { this.instalado = j.eval("(" + instalarNoCampo.toString() + ")()") === true; } catch (e) { console.warn("equipe:", e); }
  };

  return { criar: function (ponte) { return new Equipe(ponte); } };
})();
