/* VRS didatico do T50. Os limiares NAO sao limites DJI medidos.
   Fontes, escolhas e limites em estudos/vortice-e-veu.md. */
window.VORTICE = (function () {
  "use strict";
  function criarModelo(perfil) {
    var q = { dentro: false, forca: 0, afunda: 0, exposicao: 0, tempo: 0,
      vh: 0, velocidadeAr: 0, vy: 0, wob: { p: 0, r: 0 } };
    function limpar() {
      q.dentro = false; q.forca = q.afunda = q.exposicao = q.tempo = 0;
      q.vy = 0; q.wob.p = q.wob.r = 0;
    }
    function passo(e, dt) {
      if (!(dt > 0)) return q;
      if (!e.noAr || !e.motores) { limpar(); q.vy = e.vy || 0; return q; }
      var carga = Math.max(0, Math.min(perfil.carga, e.carga || 0));
      q.vh = Math.sqrt((perfil.massa + carga) * 9.81 / (2 * 1.225 * perfil.area));
      q.velocidadeAr = Math.hypot((e.vx || 0) - (e.wx || 0), (e.vz || 0) - (e.wz || 0));
      var tentativa = Math.min(e.vy, 0) + Math.max(e.vy, 0) * (1 - .85 * q.forca) - q.afunda;
      var x = Math.max(0, -tentativa) / q.vh, y = q.velocidadeAr / q.vh;
      // Envelope empirico de treinamento; nao e o modelo integral de Johnson.
      var regiao = x > .35 && x < 1.5 && y < .55;
      q.exposicao = regiao ? q.exposicao + dt : 0;
      if (!q.dentro && q.exposicao >= .4) q.dentro = true;
      if (q.dentro && (y > .75 || x < .15 || x > 1.7)) q.dentro = false;
      var alvo = q.dentro ? Math.max(.35, 1 - Math.min(1, Math.abs(x - .75) / .75)) * Math.max(0, 1 - y / .75) : 0;
      q.forca += (alvo - q.forca) * (1 - Math.exp(-dt * 2));
      q.afunda += (3 * q.forca - q.afunda) * (1 - Math.exp(-dt * (q.dentro ? 1.2 : 2.5)));
      q.vy = Math.min(e.vy, 0) + Math.max(e.vy, 0) * (1 - .85 * q.forca) - q.afunda;
      q.tempo += dt;
      var amp = .24 * q.forca;
      q.wob.p = amp * (.65 * Math.sin(q.tempo * 8.1) + .35 * Math.sin(q.tempo * 17.3));
      q.wob.r = amp * (.65 * Math.sin(q.tempo * 9.7 + .6) + .35 * Math.sin(q.tempo * 15.1));
      return q;
    }
    return { estado: q, passo: passo, limpar: limpar, perfil: perfil };
  }
  function instalarNoCampo(criar, perfil) {
    if (window.xgVortice) return true;
    if (typeof passo !== "function" || typeof cair !== "function") return false;
    var motor = criar(perfil), q = window.xgVortice = motor.estado;
    q.modelo = motor;
    var anterior = passo, baseVy = null, ultimoVy = null, ultimoEstado = null;
    passo = function (dt) {
      if (!(dt > 0)) return anterior.apply(this, arguments);
      // Devolve ao controlador seu estado anterior, evitando somar o afundamento duas vezes.
      if (ultimoEstado === V.estado && ultimoVy !== null && Math.abs((V.vy || 0) - ultimoVy) < 1e-8) V.vy = baseVy;
      var y0 = drone.position.y, estado0 = V.estado;
      var r = anterior.apply(this, arguments), d = drone.position;
      var noAr = V.estado !== "caiu" && ["em solo", "concluído", "reabastecendo"].indexOf(V.estado) < 0 &&
        (y0 > alt(d.x, d.z) + .3 || q.forca > .02);
      var W = window.xgPulv && window.xgPulv.vento;
      var wx = W ? Math.cos(W.dir) * W.vel : 0, wz = W ? Math.sin(W.dir) * W.vel : 0;
      baseVy = V.vy || 0;
      var comandada = (d.y - y0) / dt;
      var manual = V.estado === "manual";
      var e = { noAr: noAr, motores: !!V.rodando, carga: V.tan, vy: comandada,
        vx: manual ? V.mvx : (V.v || 0) * (V.dirx || 0),
        vz: manual ? V.mvz : (V.v || 0) * (V.dirz || 0), wx: wx, wz: wz };
      motor.passo(e, dt);
      if (noAr && V.rodando && estado0 !== "caiu") {
        var corre = (q.vy - comandada) * dt;
        d.y += corre;
        if (manual && typeof V.xgAgl === "number") V.xgAgl = Math.max(0, V.xgAgl + corre);
        V.vy = q.vy;
        if (q.forca > .02 && d.y <= alt(d.x, d.z) + .05 && q.vy < -2.5) {
          d.y = alt(d.x, d.z) + .05;
          cair({ nome: "o chão (anel de vórtice)", dica: "Nesta simulação, a descida com pouca velocidade em relação ao ar provocou perda de sustentação por anel de vórtice. Faltou altura para recuperar. O deslocamento horizontal pode ajudar a sair do fluxo recirculante. Os limiares deste exercício não são limites operacionais do fabricante." });
          motor.limpar(); baseVy = ultimoVy = null; ultimoEstado = null;
          return r;
        }
      }
      ultimoVy = V.vy; ultimoEstado = V.estado;
      if (!noAr) baseVy = ultimoVy = null;
      return r;
    };
    var reset = reiniciarVoo;
    reiniciarVoo = function () {
      motor.limpar(); baseVy = ultimoVy = ultimoEstado = null;
      return reset.apply(this, arguments);
    };
    return true;
  }
  var T50 = { massa: 52, carga: 40, area: 4 * Math.PI * Math.pow(1.3716 / 2, 2) };
  return { criarModelo: criarModelo, perfilT50: T50,
    instalar: function (ponte, modelo) {
      // Nao aplicar a massa/geometria do T50 a outras aeronaves.
      if (!modelo || modelo.id !== "t50") return true;
      if (ponte.janela && ponte.janela.xgVortice) return true;
      try { return ponte.ler("(" + instalarNoCampo.toString() + ")(" + criarModelo.toString() + "," + JSON.stringify(T50) + ")") === true; }
      catch (e) { console.warn("Anel de vortice indisponivel", e); return false; }
    }
  };
})();
