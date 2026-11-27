/* ==========================================================================
   FISICA DO JOGO NO CAMPO: inclinacao da aeronave e queda

   Trazida do jogo Unity "Vida de Piloto" (Drone.cs). O campo e uma copia
   que nao se edita: tudo entra por fora, embrulhando funcoes dele.

   1) Inclinacao. O campo so inclinava para a frente, no maximo 8 graus. Agora:
      - no voo manual, a inclinacao e a da fisica do manual.js (V.xgInc): a
        aeronave inclina para o lado em que acelera - manche para a direita,
        lado direito para baixo; frente, nariz para baixo; ao soltar, empina
        para tras para frear. No maximo 18 graus (16 cruzando a 10 m/s);
        so a freada brusca chega a 30 (pedido dele);
      - na rota, a mesma conta feita com a aceleracao medida mais o arrasto;
      - no chao, reta.
      Entra no posCamera, que o laco do campo chama depois de inclinar a
      aeronave do jeito antigo e antes de desenhar.

   2) Queda. O campo girava a aeronave sempre igual (2,1 e 1,2 rad/s) e jogava
      fora 40% da velocidade. Agora, como no jogo:
      - a velocidade de verdade no momento (inclusive de lado, no manual);
      - as helices perdem giro aos poucos (bateria: 0,25 s; batida: 0,2 s);
      - o tombo vem do lado que bateu: o obstaculo segura a ponta da helice e
        a aeronave vira e gira para aquele lado;
      - arrasto do ar conforme a posicao (de chapa freia muito, de lado pouco)
        e o vento leva a aeronave que cai;
      - no chao, deita na posicao mais proxima (de pe, de lado ou de costas).
      O resto (poeira, cartao da queda) continua sendo o do campo.
   ========================================================================== */

window.FISICA = (function () {
  "use strict";

  /* Roda DENTRO do campo (toString + eval). Nao usa nada deste arquivo. */
  function instalarNoCampo() {
    if (window.__xgFisica) return true;
    if (typeof posCamera !== "function" || typeof cair !== "function" || typeof atualizarFpv !== "function" ||
        typeof quedaPasso !== "function" || typeof inclina === "undefined") return false;
    window.__xgFisica = true;

    var G = 9.8;
    var MASSA_VAZIO = 52;                 // kg, com bateria (T50)
    var CDA_CHAPA = 1.4, CDA_LADO = 0.5;  // m2 x coeficiente de arrasto
    var ARRASTO_ROTA = G * Math.tan(16 * Math.PI / 180) / 100;   // o mesmo do manual
    var CM = 0.45;                        // centro de massa acima dos pes (m)

    /* Consumo operacional do T50. Coeficientes de simulacao, nao uma ficha
       de autonomia certificada. Tiros longos economizam por terem menos
       frenagens/retomadas; nao existe um bonus artificial por tamanho de area.
       Embrulha o passo manual e automatico mantendo os avisos e a queda
       originais, que precisam enxergar o consumo corrigido no mesmo passo. */
    var energiaAnterior = null, esforcoManobra = 0;
    var passoEnergia = passo;
    passo = function (dt) {
      if (!(dt > 0) || T50.tanque !== 40 ||
          ["em solo", "concluído", "reabastecendo", "caiu"].indexOf(V.estado) >= 0) {
        energiaAnterior = null;
        esforcoManobra = 0;
        return passoEnergia.apply(this, arguments);
      }
      var d = drone.position;
      var vx = V.estado === "manual" ? (V.mvx || 0) : V.v * (V.dirx || 0);
      var vz = V.estado === "manual" ? (V.mvz || 0) : V.v * (V.dirz || 0);
      var velocidade = Math.hypot(vx, vz);
      var carga = Math.max(0, Math.min(1, V.tan / T50.tanque));
      var acel = 0, vertical = 0;
      if (energiaAnterior) {
        var intervalo = energiaAnterior.dt;
        acel = Math.min(5, Math.hypot(vx - energiaAnterior.vx, vz - energiaAnterior.vz) / intervalo);
        vertical = Math.max(-5, Math.min(5, (d.y - energiaAnterior.y) / intervalo));
      }
      energiaAnterior = { vx: vx, vz: vz, y: d.y, dt: dt };
      // A rota pode inverter a direcao em um quadro. Distribui o esforco
      // da retomada por alguns segundos, sem depender da taxa de quadros.
      esforcoManobra = Math.max(acel, esforcoManobra * Math.exp(-dt / 3));
      // Pairar e manobrar continua gastando mesmo com a pulverizacao parada.
      var lento = 1 - Math.min(1, velocidade / 7);
      var esforco = 1 + 0.28 * lento + 0.18 * esforcoManobra +
        0.22 * Math.max(0, vertical) + 0.07 * Math.max(0, -vertical);
      var vazio = T50.autonomiaVazioMin, cheio = T50.autonomiaCheioMin;
      // Interpola potencia (consumo), nao minutos de autonomia.
      var taxa = (100 / vazio + (100 / cheio - 100 / vazio) * carga) *
        1.3 * (1 + 0.15 * carga) * esforco;
      T50.autonomiaVazioMin = T50.autonomiaCheioMin = 100 / taxa;
      try { return passoEnergia.apply(this, arguments); }
      finally {
        T50.autonomiaVazioMin = vazio;
        T50.autonomiaCheioMin = cheio;
      }
    };

    function vento() {
      var W = window.xgPulv && window.xgPulv.vento;
      return W ? { x: Math.cos(W.dir) * W.vel, z: Math.sin(W.dir) * W.vel } : { x: 0, z: 0 };
    }

    /* -------------------------------------------------------- inclinacao */

    var ultimo = null, acel = { x: 0, z: 0 };
    /* inclinacao na rota, suavizada: nas viradas do fim das passadas a
       direcao da rota muda de uma vez e a aceleracao medida dava um pico
       para um lado e outro logo em seguida - a aeronave balancava de lado
       (pedido dele, 03/10). Agora a inclinacao segue o alvo com ~0,35 s e
       no maximo 45 graus por segundo, como o T50 nas curvas. */
    var incRota = { p: 0, r: 0 };
    var TAU_INC = 0.35, GIRO_MAX = 45 * Math.PI / 180;
    var posOriginal = posCamera;
    posCamera = function (instantaneo, dt) {
      if (V.estado !== "caiu" && inclina.children.length) inclinar(dt || 0);
      var r = posOriginal.apply(this, arguments);
      /* Vista Drone: a camera do jogo chegava na posicao dela em ~0,3 s; com
         a fisica nova (36 km/h, arrancadas e freadas fortes) ela ficava uns
         3 m atras e parecia lenta (palavras dele). Aqui ela anda mais um
         pouco no mesmo quadro: chega em ~0,1 s. */
      if (!instantaneo && dt > 0 && vista === "drone" && !modoMapa && !telaInicial) {
        var k = 1 - Math.exp(-dt * 6);
        cam.position.lerp(camPos, k);
        orb.target.lerp(camAlvo, Math.min(1, k * 2));
      }
      return r;
    };

    function inclinar(dt) {
      var d = drone.position;
      var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);
      var rx = Math.sin(V.yaw), rz = Math.cos(V.yaw);
      var noChao = d.y <= alt(d.x, d.z) + 0.05;
      var p = 0, r = 0;
      if (V.estado === "manual" && V.xgInc) {
        p = V.xgInc.p; r = V.xgInc.r;
      } else if (!noChao && V.rodando && ["em solo", "concluído", "reabastecendo"].indexOf(V.estado) < 0) {
        /* rota: aceleracao medida quadro a quadro, suavizada, mais o arrasto */
        var vx = V.v * (V.dirx || 0), vz = V.v * (V.dirz || 0);
        if (ultimo && dt > 0) {
          var k = Math.min(1, dt / 0.25);
          acel.x += ((vx - ultimo.x) / dt - acel.x) * k;
          acel.z += ((vz - ultimo.z) / dt - acel.z) * k;
        }
        ultimo = { x: vx, z: vz };
        var w = vento(), arx = vx - w.x, arz = vz - w.z, ar = Math.hypot(arx, arz);
        var ax = acel.x + ARRASTO_ROTA * ar * arx, az = acel.z + ARRASTO_ROTA * ar * arz;
        var n = Math.hypot(ax, az), vr = Math.hypot(vx, vz);
        var freando = vr > 3 && (ax * vx + az * vz) < -0.7 * n * vr;
        var amax = G * Math.tan((freando ? 30 : 18) * Math.PI / 180);
        if (n > amax) { ax *= amax / n; az *= amax / n; }
        p = Math.atan((ax * fx + az * fz) / G);
        r = Math.atan((ax * rx + az * rz) / G);
        if (dt > 0) {
          var kk = 1 - Math.exp(-dt / TAU_INC), lim = GIRO_MAX * dt;
          incRota.p += Math.max(-lim, Math.min(lim, (p - incRota.p) * kk));
          incRota.r += Math.max(-lim, Math.min(lim, (r - incRota.r) * kk));
        }
        p = incRota.p; r = incRota.r;
      } else {
        ultimo = null; acel.x = acel.z = 0;
        incRota.p = p; incRota.r = r;
      }
      /* no corpo: x positivo = nariz para baixo, z positivo = lado direito para baixo */
      // Somar uma vez a atitude calculada, sem acumular rotacao entre quadros.
      if (!noChao && window.xgVortice) { p += xgVortice.wob.p; r += xgVortice.wob.r; }
      inclina.rotation.set(p, 0, r);
    }

    /* ------------------------------------------------- camera FPV no corpo

       A camera FPV do T50 so tem o eixo de inclinacao (a roda direita):
       quando a aeronave tomba de lado, a imagem tomba junto - inclusive a
       que vai para o RC Plus. Todos os caminhos que desenham a FPV (o campo,
       o controle virtual, o envio ao RC Plus) chamam camFpv.lookAt depois de
       posicionar; o lookAt da camera passa a somar a rolagem do corpo. */
    var olhar = THREE.Object3D.prototype.lookAt;
    camFpv.lookAt = function () {
      olhar.apply(this, arguments);
      /* Air 2S (app_fly.js, window.__xgFly): gimbal de 3 eixos, o horizonte fica nivelado (14/10/2026) */
      if (V.estado !== "caiu" && (!window.__xgFly || window.xgGimbalFpv)) this.rotateZ(-inclina.rotation.z);   // Air 2S no Modo FPV: o horizonte inclina
    };
    var fpvOriginal = atualizarFpv;
    atualizarFpv = function () {
      fpvOriginal.apply(this, arguments);
      /* o campo ja somava 30% da rolagem depois do lookAt: tira, a rolagem inteira ja entrou */
      if (!window.__xgFly) camFpv.rotateZ(inclina.rotation.z * 0.3);
    };

    /* ------------------------------------------------------------- queda */

    var Q = null;   // estado da queda: velocidade angular (no grupo do drone), empuxo que sobra

    var cairOriginal = cair;
    cair = function (c) {
      var d = drone.position;
      /* velocidade de verdade antes do campo mexer nela */
      var vx, vz, vy = V.vy || 0;
      if (V.estado === "manual") { vx = V.mvx || 0; vz = V.mvz || 0; }
      else { vx = (V.v || 0) * (V.dirx || 0); vz = (V.v || 0) * (V.dirz || 0); }
      var inc = { p: inclina.rotation.x, r: inclina.rotation.z };
      var r = cairOriginal.apply(this, arguments);
      V.vqx = vx; V.vqz = vz; V.vy = vy;
      inclina.rotation.set(inc.p, 0, inc.r);

      var massa = MASSA_VAZIO + (V.tan || 0);
      var bateria = c && /bateria/i.test(c.nome || "");
      var chao = c && /chão/i.test(c.nome || "");
      Q = { w: new THREE.Vector3(), empuxo: massa * G * (bateria ? 0.5 : 0.4), tau: bateria ? 0.25 : 0.2, massa: massa, deitando: null };

      /* para o grupo do drone (so guinada): o mundo girado por -rotation.y */
      var praDrone = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -drone.rotation.y);
      var v = new THREE.Vector3(vx, vy, vz);
      var vel = v.length();
      if (!bateria && vel > 0.05) {
        /* onde bateu: no obstaculo, na direcao dele; sem posicao, na frente do movimento */
        var dir;
        if (c && typeof c.cx === "number" && !chao) dir = new THREE.Vector3(c.cx - d.x, 0, c.cz - d.z);
        else dir = new THREE.Vector3(vx, chao ? 0 : vy, vz);
        if (dir.lengthSq() < 1e-6) dir.set(Math.cos(V.yaw), 0, -Math.sin(V.yaw));
        dir.normalize();
        var normal = dir.clone().negate();                   // do obstaculo para a aeronave
        /* ponto do toque: ponta da helice daquele lado (as helices ficam uns
           25 cm acima do centro de massa: batida de frente empina para tras);
           no chao, embaixo dos pes */
        var braco = chao ? new THREE.Vector3(0, -CM, 0) : dir.clone().multiplyScalar(1.15).add(new THREE.Vector3(0, 0.25, 0));
        var vn = Math.max(Math.abs(v.dot(normal)), vel * 0.35);
        var w = new THREE.Vector3().crossVectors(braco, normal).multiplyScalar(vn * 0.7);
        if (chao) {
          /* raspando no chao andando: o pe trava e a aeronave capota para a frente do movimento */
          var vh = new THREE.Vector3(vx, 0, vz);
          w.add(new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), vh).multiplyScalar(0.9));
        } else {
          /* a ponta da helice presa puxa a aeronave no eixo */
          var giro = new THREE.Vector3().crossVectors(braco, v.clone().negate()).y * 0.35;
          w.y += giro;
        }
        w.add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(vn * 0.25));
        Q.w.copy(w.applyQuaternion(praDrone));
        if (chao) {
          /* ja esta no chao: nao da tempo de girar no ar. O pe trava e ela
             capota na hora para a frente do movimento, mais quanto mais rapido
             (a 5 m/s fica de lado; devagar volta a ficar de pe) */
          var eixo = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(vx, 0, vz));
          if (eixo.lengthSq() > 1e-6) {
            eixo.normalize().applyQuaternion(praDrone);
            var tombo = Math.min(Math.PI * 0.62, Math.hypot(vx, vz) * 0.35);
            inclina.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(eixo, tombo));
          }
        }
      } else {
        Q.w.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
      }
      return r;
    };

    var quedaOriginal = quedaPasso;
    quedaPasso = function (dt) {
      if (V.noChao || !Q) {
        if (!Q || !V.noChao) return quedaOriginal(dt);
        return deitar(dt);
      }
      var d = drone.position;
      var q = inclina.quaternion;
      var praMundo = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), drone.rotation.y);
      var cima = new THREE.Vector3(0, 1, 0).applyQuaternion(q).applyQuaternion(praMundo);

      /* helices perdendo giro */
      var ax = 0, ay = -G, az = 0;
      if (Q.empuxo > 1) {
        ax += cima.x * Q.empuxo / Q.massa; ay += cima.y * Q.empuxo / Q.massa; az += cima.z * Q.empuxo / Q.massa;
        Q.empuxo *= Math.exp(-dt / Q.tau);
      }
      /* arrasto do ar contra a velocidade relativa ao vento (rho 1,2) */
      var w = vento();
      var rx = V.vqx - w.x, ry = V.vy, rz = V.vqz - w.z, rv = Math.hypot(rx, ry, rz);
      if (rv > 0.05) {
        var chapa = Math.abs((cima.x * rx + cima.y * ry + cima.z * rz) / rv);
        var k = 0.6 * (CDA_LADO + (CDA_CHAPA - CDA_LADO) * chapa) * rv / Q.massa;
        ax -= k * rx; ay -= k * ry; az -= k * rz;
      }
      V.vqx += ax * dt; V.vy += ay * dt; V.vqz += az * dt;
      /* o ar freia o giro */
      Q.w.multiplyScalar(Math.exp(-0.18 * dt));
      var ang = Q.w.length() * dt;
      if (ang > 1e-6) q.premultiply(new THREE.Quaternion().setFromAxisAngle(Q.w.clone().normalize(), ang));

      /* o campo anda com a posicao e detecta o chao; sem as contas dele de
         velocidade e giro (elas ficam zeradas neste passo) */
      var vqx = V.vqx, vqz = V.vqz, vy = V.vy;
      var rot = inclina.quaternion.clone();
      d.x += vqx * dt; d.z += vqz * dt; d.y += vy * dt;
      V.vqx = 0; V.vqz = 0; V.vy = 9.8 * dt;     // o passo dele soma -9,8 dt: fica parado
      var y = d.y;
      quedaOriginal(dt);
      inclina.quaternion.copy(rot);
      d.y = V.noChao ? d.y : y;
      V.vqx = vqx; V.vqz = vqz; V.vy = vy;
      if (V.noChao) { Q.deitando = poseDeitada(rot); }
    };

    /* a posicao de repouso mais perto: de pe, de lado ou de costas, mantendo a guinada */
    function poseDeitada(qAtual) {
      var cima = new THREE.Vector3(0, 1, 0).applyQuaternion(qAtual);
      var alvos = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0),
                   new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
      var melhor = null, maior = -2;
      for (var i = 0; i < alvos.length; i++) {
        /* o eixo "cima" do corpo vai para o vetor do mundo mais proximo */
        var p = cima.dot(alvos[i]);
        if (p > maior) { maior = p; melhor = alvos[i]; }
      }
      var ajuste = new THREE.Quaternion().setFromUnitVectors(cima, new THREE.Vector3(0, 1, 0));
      /* de pe: corpo reto; senao, o corpo deita com o "cima" virado para o lado escolhido */
      var alvoCima = melhor.y > 0.5 ? new THREE.Vector3(0, 1, 0) : (melhor.y < -0.5 ? new THREE.Vector3(0, -1, 0) : melhor);
      ajuste.setFromUnitVectors(cima, alvoCima);
      return ajuste.multiply(qAtual.clone());
    }

    function deitar(dt) {
      if (!Q.deitando) return;
      inclina.quaternion.slerp(Q.deitando, Math.min(1, dt * 6));
    }

    return true;
  }

  function instalar(ponte) {
    var j = ponte && ponte.janela;
    if (!j) return false;
    try { return j.eval("(" + instalarNoCampo.toString() + ")()") === true; }
    catch (e) { console.warn("física do jogo no campo:", e); return false; }
  }

  return { instalar: instalar };
})();
