/* ==========================================================================
   RADAR DE TERRENO: o quanto a aeronave consegue acompanhar o relevo

   Palavras dele (02/10/2026), sobre o T50 em terreno montanhoso:
   - o radar tem um certo atraso e nem sempre acompanha certo;
   - quase vazio, o acompanhamento e ~80% eficiente; cheio, ~40%;
   - com o tanque cheio, 25 km/h e o limite para ainda ter ~70%; quanto
     mais rapido, mais dificil de acompanhar;
   - quando a aeronave fica 1,5 m abaixo da altura programada, ela reduz um
     pouco a velocidade para acompanhar;
   - terreno muito ingreme acima de 33 km/h: ~97% de chance de bater no chao.

   O campo acompanhava o relevo como um radar perfeito (e, com o desvio
   ligado, nunca descia de 1,5 m do chao de verdade). Aqui:

   eficiencia e   e0 = 0,80 - 0,10 x carga (cheio 0,70, vazio 0,80)
                  acima de 25 km/h cai (0,15 + 0,15 x carga) a cada 8 km/h
                  -> cheio a 33 km/h = 0,40; vazio a 33 km/h = 0,65
                  cada voo sorteia uma variacao (desvio 0,06, ate +-0,15), e ela
                  oscila um pouco em voo (o radar nao e constante)
   subindo        a aeronave so consegue fazer a fracao `e` da subida que o
                  controle pede (rota e manual com estabilizacao): em encosta
                  ingreme e rapida ela fica para tras e bate
   1,5 m abaixo   da altura programada (rota): cai para ~75% da velocidade
                  ate voltar a menos de 0,5 m dela
   So vale com a Estabilizacao da altitude ligada (acompanhando terreno) e
   nas passadas; deslocamentos em altura de RTH nao acompanham terreno.
   ========================================================================== */

window.RADAR = (function () {
  "use strict";

  function instalarNoCampo() {
    if (window.xgRadar) return true;
    if (typeof passo !== "function" || typeof alt !== "function" || typeof efetivo !== "function") return false;

    function normal() { var u = Math.random() || 1e-9, v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var R = window.xgRadar = {
      sorteio: Math.max(-0.15, Math.min(0.15, normal() * 0.06)),   // o deste voo
      oscila: 0, t: 0, lento: false, e: 0.8,
      /* eficiencia agora, de 0 a 1 */
      eficiencia: function () {
        var carga = Math.max(0, Math.min(1, (V.tan || 0) / (T50.tanque || 40)));
        var v = (V.estado === "manual" ? Math.hypot(V.mvx || 0, V.mvz || 0) : (V.v || 0)) * 3.6;
        var e = 0.80 - 0.10 * carga - Math.max(0, v - 25) / 8 * (0.15 + 0.15 * carga);
        return Math.max(0.12, Math.min(0.92, e + R.sorteio + R.oscila));
      },
    };

    /* cada voo novo, um radar um pouco diferente */
    if (typeof reiniciarVoo === "function") {
      var reiniciarAntes = reiniciarVoo;
      reiniciarVoo = function () { R.sorteio = Math.max(-0.15, Math.min(0.15, normal() * 0.06)); R.lento = false; return reiniciarAntes.apply(this, arguments); };
    }

    /* manual.js pergunta por aqui o chao que o radar ve (estabilizacao ligada) */
    R.soloManual = null;
    window.xgRadarSolo = function (dt, soloReal) {
      if (R.soloManual === null || !isFinite(R.soloManual)) R.soloManual = soloReal;
      var sobe = soloReal - R.soloManual;
      /* relevo subindo: como na rota, a aeronave sobe no maximo a fracao e
         dos 3 m/s que o controle pediria (e com um pequeno atraso) */
      if (sobe > 0) R.soloManual += Math.min(sobe * Math.min(1, dt * 6), 3 * R.eficiencia() * dt);
      else R.soloManual = soloReal;                                                // descendo: o radar ve na hora
      return R.soloManual;
    };

    var passoAntes = passo;
    passo = function (dt) {
      /* oscilacao lenta da eficiencia (o radar nao e constante) */
      R.t += dt; if (R.t > 0.5) { R.t = 0; R.oscila += (normal() * 0.05 - R.oscila) * 0.3; }
      var acompanha = P.estab && V.estado === "aplicando";
      var y0 = drone.position.y;
      var r = passoAntes.apply(this, arguments);
      if (V.estado === "manual") { R.soloManual = R.soloManual === null ? null : R.soloManual; return r; }
      R.soloManual = null;
      if (!acompanha || V.estado === "caiu") { R.lento = false; return r; }

      var d = drone.position, e = R.eficiencia(); R.e = e;
      var dy = d.y - y0;
      if (dy > 0) {
        /* subindo para acompanhar o relevo: so a fracao e da subida pedida */
        d.y = y0 + dy * e;   // o controle pede a subida toda; a aeronave so faz a fracao e
        /* o campo ja conferiu a colisao com a altura antiga: confere de novo */
        if (d.y < alt(d.x, d.z) + 0.25 && typeof cair === "function") {
          cair({ nome: "o relevo", dica: "O terreno subiu mais rápido do que o radar conseguiu acompanhar. Com o tanque cheio o radar acompanha bem até uns 25 km/h; acima de 33 km/h em encosta íngreme a aeronave quase sempre bate. Em morro, reduza a velocidade e a carga." });
          return r;
        }
      }

      /* 1,5 m abaixo da altura programada: reduz um pouco a velocidade */
      var E = efetivo(), programada = E.altura;
      var dossel = typeof window.__xgDossel === "function" ? Math.max(0, window.__xgDossel(d.x, d.z) || 0) : 0;
      var agl = d.y - alt(d.x, d.z) - dossel;
      if (agl < programada - 1.5) R.lento = true;
      else if (agl > programada - 0.5) R.lento = false;
      if (R.lento) {
        var teto = 0.75 * E.vel;
        if (V.v > teto) V.v = Math.max(teto, V.v - 4 * dt);   // o jogo acelera 2,5 m/s2: sobra freando
      }
      return r;
    };
    return true;
  }

  /* Proteções observadas na gravação 8. Distâncias são parâmetros do
     simulador, não uma calibração do firmware DJI. Roda no escopo do campo. */
  function instalarProtecao() {
    if (window.xgProtecao) return true;
    if (typeof sondar !== "function") return false;
    var sequencia = 0;
    function estado() {
      return V.xgProtecao || (V.xgProtecao = { horizontal: null, inferior: null });
    }
    /* Obstáculos verticais são colisores da cena. Solo e dossel continuam
       na altimetria, mas nunca geram aviso/bloqueio de obstáculo inferior. */
    function objetosVerticais() {
      var d = drone.position, leituras = { inferior: null, superior: null };
      colisores.forEach(function (c) {
        if (Math.hypot(c.cx - d.x, c.cz - d.z) > c.raio + 6) return;
        var x, y, z;
        if (c.tipo === "seg") {
          // Segmento real do fio: inclui cabos inclinados e vão entre postes.
          var ex = c.b.x-c.a.x, ey = c.b.y-c.a.y, ez = c.b.z-c.a.z;
          var t = Math.max(0, Math.min(1, ((d.x-c.a.x)*ex+(d.y-c.a.y)*ey+(d.z-c.a.z)*ez)/(ex*ex+ey*ey+ez*ez || 1)));
          x=c.a.x+t*ex; y=c.a.y+t*ey; z=c.a.z+t*ez;
        } else {
          if (d.y >= c.y0 && d.y <= c.y1) return;
          y = d.y > c.y1 ? c.y1 : c.y0;
          if (c.tipo === "cil") {
            var dx=d.x-c.x, dz=d.z-c.z, n=Math.hypot(dx,dz), f=n>c.r ? c.r/n : 1;
            x=c.x+dx*f; z=c.z+dz*f;
          } else if (c.tipo === "caixa") {
            var cs=Math.cos(c.rot||0), sn=Math.sin(c.rot||0), qx=d.x-c.x, qz=d.z-c.z;
            var lx=Math.max(-c.sx/2,Math.min(c.sx/2,qx*cs+qz*sn));
            var lz=Math.max(-c.sz/2,Math.min(c.sz/2,-qx*sn+qz*cs));
            x=c.x+lx*cs-lz*sn; z=c.z+lx*sn+lz*cs;
          } else return;
        }
        var dy=y-d.y, dh=Math.hypot(x-d.x,z-d.z);
        if (Math.abs(dy)<.05 || (dy<0 ? dh>Math.abs(dy) : dh>6)) return;
        var raio=c.tipo==="seg" ? c.r||0 : 0;
        // Barra lateral: separação vertical. Arco: projeção horizontal.
        // Não usar a distância diagonal para os dois indicadores.
        var distancia=Math.max(0,Math.abs(dy)-raio);
        if (distancia>5.5) return;
        var lado=dy>0 ? "superior" : "inferior";
        if (!leituras[lado] || distancia<leituras[lado].distancia)
          leituras[lado]={distancia:distancia,distanciaHorizontal:Math.max(0,dh-raio),topo:y,fio:!!c.fio};
      });
      return leituras;
    }
    function piso() { return objetosVerticais().inferior; }
    function limpar() { var e=estado();e.horizontal=e.inferior=e.superior=null; }
    function atualizarVerticais() {
      var e=estado(), d=drone.position;
      var ativo=P.desvio && V.rodando && V.estado!=="caiu" && d.y>alt(d.x,d.z)+.05;
      var leituras=ativo ? objetosVerticais() : {inferior:null,superior:null};
      ["inferior","superior"].forEach(function(lado){
        var l=leituras[lado];
        // Histerese da detecção vertical; independente da medida do arco.
        if (!l || (!e[lado] && l.distancia>5)) { e[lado]=null;return; }
        if (!e[lado]) e[lado]={id:++sequencia,bloqueado:false};
        e[lado].distancia=l.distancia;e[lado].distanciaHorizontal=l.distanciaHorizontal;e[lado].fio=l.fio;
      });
      return e;
    }
    function horizontal(dt) {
      var e = estado(), d = drone.position;
      if (!P.desvio || !V.rodando || V.estado !== "manual" || d.y <= alt(d.x, d.z) + 0.05) { limpar(); return; }
      var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw), rx = Math.sin(V.yaw), rz = Math.cos(V.yaw);
      var m = window.xgManches || {}, px = fx * (m.pitch || 0) + rx * (m.roll || 0), pz = fz * (m.pitch || 0) + rz * (m.roll || 0);
      var sp = Math.hypot(V.mvx, V.mvz), comando = Math.hypot(px, pz);
      var h = e.horizontal, margem = T50.distSeguranca + T50.raioHelice;
      if (h) {
        var atual = sondar(h.x, h.z);
        if (!atual || atual.d > margem + 2 || (px * h.x + pz * h.z < -0.15)) e.horizontal = h = null;
        else { h.distancia = atual.d; h.tempo += dt; }
      }
      var ux = sp > 0.3 ? V.mvx / sp : comando > 0.1 ? px / comando : 0;
      var uz = sp > 0.3 ? V.mvz / sp : comando > 0.1 ? pz / comando : 0;
      var s = (ux || uz) ? sondar(ux, uz) : null;
      if (s) {
        var folga = s.d - margem;
        var vmax = Math.sqrt(2 * T50.frenagem * Math.max(0, folga));
        if (!h && folga <= sp * sp / (2 * T50.frenagem) + 0.4) {
          h = e.horizontal = { id: ++sequencia, x: ux, z: uz, distancia: s.d, tempo: 0, fase: "freando" };
        }
        if (sp > vmax) { V.mvx *= vmax / sp; V.mvz *= vmax / sp; }
        V.ultimoObs = s.c;
      }
      if (h) {
        /* Trava somente o avanço contra o obstáculo; ré/lateral continuam
           disponíveis. Não confundir com o freio do botão Pausa. */
        var entrando = V.mvx * h.x + V.mvz * h.z;
        if (entrando > 0) {
          var restante = Math.max(0, entrando - T50.frenagem * dt);
          if (restante < 0.15) restante = 0;
          V.mvx -= (entrando - restante) * h.x; V.mvz -= (entrando - restante) * h.z;
          V.xgIx = 0; V.xgIz = 0;
        }
        h.fase = Math.hypot(V.mvx, V.mvz) < 0.15 ? "parado" : "freando";
      }
    }
    /* 25/10/2026 (pedido do Eduardo, so DJI T25 e T50): com o freio do radar ativo diante de um obstaculo, SO o comando que o app mostra
       ("Mova a aeronave para tras / frente / esquerda / direita", a direcao oposta ao obstaculo) destrava a aeronave; o resto do manche
       horizontal e ignorado (nao desliza de lado nem avanca). Giro e acelerador seguem livres. Devolve uma COPIA dos manches (o objeto
       original e do teclado/joystick e nao pode ser alterado). A escolha do eixo e a mesma do app (orientacaoRadar, protecao.js). */
    function comando(m) {
      var h = V.xgProtecao && V.xgProtecao.horizontal, mod = window.xgModeloId;
      if (!h || !m || (mod !== "t25" && mod !== "t50") || V.estado !== "manual") return m;
      var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw), rx = Math.sin(V.yaw), rz = Math.cos(V.yaw);
      var fw = h.x * fx + h.z * fz, rt = h.x * rx + h.z * rz;
      var c = Object.assign({}, m, { pitch: 0, roll: 0 });
      if (Math.abs(rt) > Math.abs(fw)) { if (m.roll * (rt > 0 ? -1 : 1) > 0) c.roll = m.roll; }
      else if (m.pitch * (fw >= 0 ? -1 : 1) > 0) c.pitch = m.pitch;
      return c;
    }
    function vertical(dt) {
      var e=atualizarVerticais(), m=window.xgManches||{};
      if (V.estado!=="manual") return;
      var thr=m.thr||0;
      ["inferior","superior"].forEach(function(lado){
        var l=e[lado];if(!l)return;
        // Um fio ainda afastado horizontalmente não bloqueia a subida.
        if(lado==="superior" && l.distanciaHorizontal>1.7){l.bloqueado=false;return;}
        // Acima: cobrir também o volume de colisão (centro +0,4 m, raio 1,3 m).
        var sinal=lado==="superior" ? 1 : -1, limite=lado==="superior" ? 2 : 2.8;
        if(thr*sinal<-.05){l.bloqueado=false;return;}
        if(thr*sinal>.05 || V.vy*sinal>0 || l.bloqueado){
          var folga=Math.max(0,l.distancia-limite);
          var teto=Math.min(Math.sqrt(2*3*folga),folga/Math.max(dt,.001));
          if(V.vy*sinal>teto)V.vy=sinal*teto;
          if(l.distancia<=limite+.15){
            if(V.vy*sinal>0)V.vy=0;
            l.bloqueado=true;
          }
          if(lado==="inferior")V.xgDespenca=false;
        }
      });
    }
    function bloqueioDecolagem() {
      var d = drone.position;
      if (d.y > alt(d.x, d.z) + 0.05) return false;
      /* 19/11/2026 (Eduardo, XAG: a decolagem "nao ser interrompida a nao ser que a pessoa clique em interromper decolagem
         durante a contagem"): no voo do XAG o auxiliar perto nao barra; a aeronave apita e ele corre (equipe.js). O resto
         (piloto a pe, veiculo, arvore) continua barrando. */
      var xag = !!window.xgVooXag;
      if (!xag && window.xgEquipe && xgEquipe.estado !== "sentado" && xgEquipe.perto() < 6) return true;
      if (typeof grupoOperador !== "undefined" && grupoOperador && Math.hypot(grupoOperador.position.x - d.x, grupoOperador.position.z - d.z) < 6) return true;
      var p = new THREE.Vector3(d.x, d.y + 0.4, d.z);
      return colisores.some(function (c) { return !(xag && c.xgAuxiliar) && Math.hypot(c.cx - d.x, c.cz - d.z) < c.raio + 6 && distColisor(c, p) < 6; });
    }
    window.xgProtecao = {
      horizontal: horizontal, vertical: vertical, piso: piso, objetosVerticais: objetosVerticais, bloqueioDecolagem: bloqueioDecolagem, comando: comando,
      ler: function () {
        if (!P.desvio || !V.rodando || V.estado === "caiu" || drone.position.y <= alt(drone.position.x, drone.position.z) + 0.05) limpar();
        var e = atualizarVerticais(), h = e.horizontal;
        return { horizontal: h ? { id: h.id, distancia: h.distancia, fase: h.fase, painel: h.tempo < 2.5,
          direcao: Math.atan2(h.x * Math.sin(V.yaw) + h.z * Math.cos(V.yaw), h.x * Math.cos(V.yaw) - h.z * Math.sin(V.yaw)) } : null,
          inferior: e.inferior, superior: e.superior, bloqueioDecolagem: bloqueioDecolagem() };
      }
    };
    return true;
  }

  function Radar(ponte, protecao) { this.ponte = ponte; this.protecao = protecao !== false; this.instalado = false; }
  Radar.prototype.ciclo = function () {
    if (this.instalado) return;
    var j = this.ponte && this.ponte.janela;
    if (!j) return;
    try { this.instalado = j.eval("(" + instalarNoCampo.toString() + ")()") === true &&
      (!this.protecao || j.eval("(" + instalarProtecao.toString() + ")()") === true); } catch (e) { console.warn("radar:", e); }
  };

  return { criar: function (ponte, protecao) { return new Radar(ponte, protecao); } };
})();
