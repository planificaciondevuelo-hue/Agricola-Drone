/* Holofote compartilhado pelo simulador e pela camera espelhada. */
(function () {
  "use strict";
  /* Roda DENTRO do campo (toString + eval): usa THREE, inclina e cena. */
  function instalarNoCampo() {
    if (window.xgHolofote) return true;
    window.xgHolofote = function (ligar) {
      var H = window.__xgHolofote;
      /* Air 2S (app_fly.js marca window.__xgFly): drone de imagem sem farol (13/10/2026) */
      if (window.__xgFly) {
        if (H && H.grupo.parent) H.grupo.parent.remove(H.grupo);
        if (H) H.ligado = false;
        return false;
      }
      if (H && H.grupo.parent !== inclina) {
        H.leds[0].geometry.dispose();
        H.aceso.dispose(); H.apagado.dispose();
        H = null;
      }
      if (!H) {
        /* a frente da fuselagem: o ponto mais a frente (+Z) dos vertices do
           miolo do modelo (|x| pequeno), contado no grupo inclina */
        inclina.updateMatrixWorld(true);
        var inv = new THREE.Matrix4().copy(inclina.matrixWorld).invert(), v = new THREE.Vector3();
        var zMax = -Infinity, yMin = Infinity, yMax = -Infinity;
        inclina.traverse(function (o) {
          if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
          var pos = o.geometry.attributes.position, mat = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
          var passo = Math.max(1, Math.floor(pos.count / 4000));
          for (var k = 0; k < pos.count; k += passo) {
            v.fromBufferAttribute(pos, k).applyMatrix4(mat);
            if (v.y < yMin) yMin = v.y;
            if (v.y > yMax) yMax = v.y;
            if (Math.abs(v.x) < 0.18 && v.z > zMax) zMax = v.z;
          }
        });
        if (!isFinite(zMax)) zMax = 0.5;
        var alto = isFinite(yMin) ? yMin + (yMax - yMin) * 0.55 : 0.4;
        var grupo = new THREE.Group();
        grupo.name = "xg-holofote";
        grupo.userData.xgModelo = true;
        grupo.position.set(0, alto, zMax + 0.01);
        var bolinha = new THREE.SphereGeometry(0.022, 12, 8);
        var apagado = new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.4 });
        var aceso = new THREE.MeshBasicMaterial({ color: 0xffffff });
        var leds = [];
        /* quatro LEDs: dois de cada lado do centro, como na frente do T50 */
        [-0.13, -0.075, 0.075, 0.13].forEach(function (x) {
          var b = new THREE.Mesh(bolinha, apagado);
          b.position.set(x, 0, 0);
          /* 13/10/2026 (Eduardo): as bolinhas apareciam soltas na frente de TODOS os drones
             (grandes nos pequenos, como o Air 2S). So a luz continua; os LEDs nao aparecem. */
          b.visible = false;
          grupo.add(b); leds.push(b);
        });
        /* a luz: um foco para a frente e um pouco para baixo, como o holofote do T50 */
        var foco = new THREE.SpotLight(0xffffff, 0, 45, Math.PI / 5, 0.5, 1.2);
        foco.position.set(0, 0, 0.02);
        var alvo = new THREE.Object3D();
        alvo.position.set(0, -2.5, 10);
        grupo.add(alvo); foco.target = alvo; grupo.add(foco);
        inclina.add(grupo);
        H = window.__xgHolofote = { grupo: grupo, leds: leds, foco: foco, aceso: aceso, apagado: apagado, ligado: false };
      }
      H.ligado = !!ligar;
      H.leds.forEach(function (b) { b.material = H.ligado ? H.aceso : H.apagado; });
      H.foco.intensity = H.ligado ? 6 : 0;
      return H.ligado;
    };
    // O carregamento/troca do modelo remove os filhos de inclina. Reanexar
    // antes de desenhar, inclusive quando a luz ja estava ligada.
    var antes = cena.onBeforeRender;
    cena.onBeforeRender = function () {
      var H = window.__xgHolofote;
      if (H && !window.__xgFly && H.grupo.parent !== inclina) window.xgHolofote(H.ligado);
      if (antes) antes.apply(this, arguments);
    };
    return true;
  }

  window.HOLOFOTE = { instalar: function (ponte) {
    if (!ponte) return false;
    return ponte.rodar("(" + instalarNoCampo.toString() + ")()");
  } };
})();
