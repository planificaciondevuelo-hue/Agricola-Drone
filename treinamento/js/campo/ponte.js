/* ==========================================================================
   PONTE COM O CAMPO

   O campo (voo, HUD, mapeamento, vistas) e o simulador que ja estava
   pronto e aprovado: ele roda inteiro dentro de um iframe, sem alteracao.
   Esta ponte le o estado dele e chama as funcoes dele de fora.

   Por que iframe e nao copiar o codigo para dentro: assim o campo continua
   sendo UM arquivo so, que pode ser atualizado inteiro quando melhorar, e
   a camada de treinamento nao vira remendo dentro dele.

   Como funciona o acesso: a pagina e o iframe estao na MESMA origem, entao
   `janela.eval(...)` roda no escopo global do campo e enxerga tudo -
   inclusive o que foi declarado com `const`, que nao aparece em `window`.
   ========================================================================== */

window.PONTE = (function () {
  "use strict";

  function Ponte(iframe) {
    this.iframe = iframe;
    this.janela = null;
  }

  /* Espera o campo terminar de montar. O sinal de que ele esta de pe e a
     funcao `passo` existir e o drone ja estar na cena. */
  Ponte.prototype.esperar = function (aoPronto, aoFalhar) {
    var self = this;
    var tentativas = 0;

    function tentar() {
      tentativas++;
      var pronto = false;

      try {
        var j = self.iframe.contentWindow;
        if (j && j.document && j.document.readyState === "complete" &&
            typeof j.passo === "function" && self.ler("typeof drone") === "object" &&
            self.ler("drone.parent !== null && typeof V.bat === 'number'") === true) {
          self.janela = j;
          pronto = true;
        }
      } catch (e) { /* ainda carregando */ }

      /* Fora do try, de proposito: com aoPronto la dentro, qualquer erro na
         montagem era engolido como "ainda carregando", e a montagem inteira
         rodava de novo 100 ms depois - dois paineis de voo, dois manuais (um
         ligava os motores e o outro desligava). Agora ela roda uma vez so, e
         um erro aparece no console em vez de sumir. */
      if (pronto) {
        aoPronto(self);
        return;
      }

      if (tentativas > 300) {            // 30 s e desiste
        if (aoFalhar) aoFalhar();
        return;
      }
      setTimeout(tentar, 100);
    }

    tentar();
  };

  /* Le uma expressao no escopo do campo. Devolve `undefined` se quebrar -
     a camada de treinamento nunca pode derrubar o campo por causa de uma
     leitura. */
  Ponte.prototype.ler = function (expressao) {
    try {
      return (this.janela || this.iframe.contentWindow).eval("(" + expressao + ")");
    } catch (e) {
      return undefined;
    }
  };

  Ponte.prototype.rodar = function (expressao) {
    try {
      return (this.janela || this.iframe.contentWindow).eval(expressao);
    } catch (e) {
      return undefined;
    }
  };

  /* ------------------------------------------------------------- estado */

  /* Tudo que a camada de treinamento precisa saber, numa leitura so.
     Uma leitura por quadro, nao uma por campo: `eval` custa. */
  Ponte.prototype.estado = function () {
    var e = this.ler(
      "{" +
      "  tela: (function(){" +
      "    if(!document.getElementById('inicio').hidden) return 'inicio';" +
      "    if(!document.getElementById('painel').hidden) return 'painel';" +
      "    if(!document.getElementById('verif').hidden) return 'verificacao';" +
      "    if(typeof modoMapa!=='undefined' && modoMapa) return 'mapa';" +
      "    return 'campo';" +
      "  })()," +
      "  voo: (typeof V!=='undefined' ? {" +
      "     rodando: !!V.rodando, estado: V.estado, aplicando: !!V.aplicando," +
      "     bateria: V.bat, tanque: V.tan, aplicadoHa: V.aplicado," +
      "     calda: V.calda, recargas: V.recargas, tempo: V.tempo," +
      "     vazao: V.vazaoAtual, velocidade: V.v, multiplicador: V.mult," +
      "     temRota: !!V.retomar," +
      /* ponto de retomada (app RC Plus: cinza do feito na pausa); campo novo */
      "     retomar: (V.retomar && V.retomar.p ? {i: V.retomar.i, p: [V.retomar.p[0], V.retomar.p[1]]} : null)," +
      "     alturaSolo: (typeof alt==='function' && typeof drone!=='undefined' && drone" +
      "        ? drone.position.y - alt(drone.position.x, drone.position.z) : 0)" +
      "  } : null)," +
      "  cobertura: (typeof coberturaReal==='function' ? coberturaReal() : null)," +
      /* Atencao: mapaPronto() nao diz se o campo esta mapeado - ela GERA um
         retangulo pronto, sempre com pronto:true. O estado de verdade vem
         de mapaAtual(), que devolve null enquanto ninguem mapeou. */
      "  mapa: (typeof mapaAtual==='function' ? (function(){" +
      "     var m = mapaAtual();" +
      "     return { pronto: !!(m && m.limite && m.limite.length >= 3)," +
      "              pontos: (m&&m.limite?m.limite.length:0)," +
      "              obstaculos: (m&&m.obstaculos?m.obstaculos.length:0) };" +
      "  })() : null)," +
      "  vista: (typeof vista!=='undefined' ? vista : '')," +
      "  parametros: (typeof P!=='undefined' ? JSON.parse(JSON.stringify(P)) : null)," +
      "  maquina: (typeof T50!=='undefined' ? JSON.parse(JSON.stringify(T50)) : null)," +
      "  talhao: (typeof TALHAO!=='undefined' ? JSON.parse(JSON.stringify(TALHAO)) : null)," +
      "  pontosDaRota: (typeof rota!=='undefined' && rota ? rota.length : 0)," +
      /* rumo: V.yaw, com a frente em (cos, -sin) - e a conta que o proprio
         campo usa ao derrubar a aeronave */
      "  drone: (typeof drone!=='undefined' && drone ? " +
      /* GNSS (gnss.js): o app ve a aeronave e o controle onde o GNSS diz
         que estao - com o erro de agora (zero no RTK) */
      "     {x: drone.position.x + (window.xgGnss ? xgGnss.erro().x : 0), y: drone.position.y," +
      "      z: drone.position.z + (window.xgGnss ? xgGnss.erro().z : 0)," +
      "      rumo: (typeof V!=='undefined' && typeof V.yaw==='number' ? V.yaw : Math.PI/2)} : null)," +
      /* y: o chao no ponto de origem - e dele que o app conta a altura
         "relativa a origem" */
      "  base: (typeof BASE!=='undefined' ? {x: BASE.x, z: BASE.z," +
      "     y: (typeof alt==='function' ? alt(BASE.x, BASE.z) : 0)} : null)," +
      "  operador: (typeof grupoOperador!=='undefined' && grupoOperador ? " +
      "     {x: grupoOperador.position.x + (window.xgGnss ? xgGnss.erro().x : 0)," +
      "      z: grupoOperador.position.z + (window.xgGnss ? xgGnss.erro().z : 0)} : null)" +
      "}"
    );

    return e || { tela: "carregando" };
  };

  /* A area do talhao mapeado, em hectares. */
  Ponte.prototype.areaHectares = function () {
    return this.ler(
      "(function(){" +
      "  var m = (typeof mapaAtual==='function') ? mapaAtual() : null;" +
      "  if(!m || !m.limite || m.limite.length < 3) return 0;" +
      "  var p = m.limite, s = 0;" +
      "  for(var i=0;i<p.length;i++){ var a=p[i], b=p[(i+1)%p.length];" +
      "    s += a[0]*b[1] - b[0]*a[1]; }" +
      "  return Math.abs(s/2)/10000;" +
      "})()"
    ) || 0;
  };

  /* ------------------------------------------------- modo embutido

     Dentro do treinamento, o campo nao decide mais nada: o cenario ja foi
     escolhido no painel do aluno e as configuracoes de tarefa passam a ser
     feitas no CONTROLE, que e a tela que o operador usa de verdade.

     Entao as telas proprias do campo (escolha de cenario e configuracoes)
     saem de cena. O que fica e o campo, o HUD e as vistas.
     ---------------------------------------------------------------------- */

  /* De qual cenario do treinamento para qual cenario do campo. */
  var CENARIOS = {
    plano: "coxilha",         // 4 ha em relevo suave
    mediano: "baixada",       // desce até o açude, capão e torre
    montanhoso: "encosta",    // declive de 16° com rede na coxilha
  };

  /* Troca o cenario do campo. Recebe o nosso nome (plano, mediano,
     montanhoso) e devolve true se o campo conhece o cenario. */
  Ponte.prototype.trocarCenario = function (cenarioId) {
    var alvo = CENARIOS[cenarioId] || "coxilha";

    return this.ler(
      "(function(){" +
      "  var c = CENARIOS.filter(function(x){return x.id==='" + alvo + "'})[0];" +
      "  if (!c) return false;" +
      "  if (typeof cen==='undefined' || cen.id !== c.id) {" +
      "    construirCenario(c); reiniciarVoo(); posCamera(true,0);" +
      "    if (typeof montarLista==='function') montarLista();" +
      "  }" +
      "  return true;" +
      "})()"
    ) === true;
  };

  /* O seletor de terreno do Treino livre.

     No livre nao existe o painel do treinamento antes do campo, entao o
     terreno e escolhido na propria tela inicial do jogo, junto do nome e
     do operador - e o "Começar" ja leva ao drone. O botao e o do mesmo
     feitio dos operadores (.avatares), e a lista vem dos CENARIOS do jogo:
     nome, nivel e descricao sao os dele, nao uma copia nossa. */
  Ponte.prototype.seletorDeTerreno = function (atual, aoEscolher) {
    var j = this.janela;
    if (!j) return false;

    var doc = j.document;
    var comecar = doc.getElementById("bComecar");
    if (!comecar || doc.getElementById("xgTerreno")) return false;

    var lista = this.ler(
      "CENARIOS.map(function(c){ return {id:c.id, nome:c.nome, nivel:c.nivel[0], desc:c.desc||''} })"
    );
    if (!lista || !lista.length) return false;

    /* do cenario do campo de volta para o nosso nome */
    var nosso = {};
    Object.keys(CENARIOS).forEach(function (k) { nosso[CENARIOS[k]] = k; });

    var rotulo = doc.createElement("p");
    rotulo.className = "rot";
    rotulo.style.marginTop = "18px";
    rotulo.textContent = "Mapas disponíveis";

    var grupo = doc.createElement("div");
    grupo.className = "avatares";
    grupo.id = "xgTerreno";
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Mapas disponíveis");

    var descricao = doc.createElement("p");
    descricao.id = "xgTerrenoDesc";
    descricao.style.cssText = "margin:8px 0 0;font-size:13px;line-height:1.5;color:#C3CCD5";

    var self = this;

    function marcar(idCampo) {
      var botoes = grupo.querySelectorAll("button");
      for (var i = 0; i < botoes.length; i++) {
        botoes[i].setAttribute("aria-pressed", String(botoes[i].dataset.cen === idCampo));
      }
      var c = lista.filter(function (x) { return x.id === idCampo; })[0];
      descricao.textContent = c ? c.nome + ". " + c.desc : "";
    }

    lista.forEach(function (c) {
      if (!nosso[c.id]) return;          // cenario que o treinamento nao usa

      var b = doc.createElement("button");
      b.type = "button";
      b.dataset.cen = c.id;
      b.textContent = ({ coxilha: "Coxilha", baixada: "Baixada do açude", encosta: "Encosta" })[c.id] || c.nivel;   /* 24/10/2026: o botao mostra o nome do terreno, nao o nivel */
      b.title = c.nome;
      b.addEventListener("click", function () {
        if (!self.trocarCenario(nosso[c.id])) return;
        marcar(c.id);
        if (aoEscolher) aoEscolher(nosso[c.id]);
      });
      grupo.appendChild(b);
    });

    comecar.parentNode.insertBefore(rotulo, comecar);
    comecar.parentNode.insertBefore(grupo, comecar);
    comecar.parentNode.insertBefore(descricao, comecar);

    marcar(CENARIOS[atual] || "coxilha");
    return true;
  };

  Ponte.prototype.embutir = function (cenarioId) {
    var alvo = CENARIOS[cenarioId] || "coxilha";

    this.rodar(
      "(function(){" +
      /* 1. o cenário certo, sem passar pela tela de escolha */
      "  var c = CENARIOS.filter(function(x){return x.id==='" + alvo + "'})[0];" +
      "  if (c && (typeof cen==='undefined' || cen.id !== c.id)) {" +
      "    construirCenario(c); reiniciarVoo(); posCamera(true,0);" +
      "    if (typeof montarLista==='function') montarLista();" +
      "  }" +

      /* 2. a tela INICIAL fica: e ela que apresenta o campo, pede o nome e
            deixa escolher o operador. Some so o painel de configuracao de
            tarefa, porque isso passou a ser feito no controle. */
      "  document.getElementById('painel').hidden = true;" +

      /* 3. o botão que reabriria o painel some: quem configura é o controle */
      "  var b = document.getElementById('bCen'); if (b) b.style.display='none';" +

      /* 4. a faixa de dados do alto sai: bateria, tanque, vazão, velocidade,
            altura e área aplicada sao leitura DO CONTROLE, e e la que o
            operador aprende a procurar por elas.
            Por CSS, nao por `hidden`: aplicarVista() reescreve o hidden a
            cada troca de vista e traria a faixa de volta.
            O radar do canto esquerdo sai junto, a pedido dele. */
      "  if (!document.getElementById('xg-esconde')) {" +
      "    var e = document.createElement('style');" +
      "    e.id = 'xg-esconde';" +
      /* #fim e o modal "Operacao concluida" do jogo: ficava atras do
         aparelho; o fim da tarefa e mostrado na tela do controle */
      "    e.textContent = '#topo,#radar,#fim{display:none!important}';" +
      "    document.head.appendChild(e);" +
      "  }" +

      /* 4. e a tela de configuração nunca mais abre sozinha */
      "  if (typeof abrirPainel==='function') { window.abrirPainel = function(){}; }" +

      /* 5. o contorno do talhao que o jogo risca no chao: no campo de
            verdade nao ha linha nenhuma, o limite so existe no aparelho.
            desenharMapa3D() refaz os filhos do grupo, mas nao mexe nele. */
      "  if (typeof grupoMapa!=='undefined' && grupoMapa) grupoMapa.visible = false;" +
      "})()"
    );
  };

  /* A camera do drone na tela do controle.

     O jogo ja desenha a imagem da camera (camFpv) na tela do aparelho, a
     cada quadro, na vista Controle - so que ela fica POR BAIXO do controle.
     Aqui, logo depois de o jogo desenhar, a imagem e copiada para os
     <canvas> que o controle recebeu nas janelas de camera.

     Tem de ser dentro do mesmo quadro: o canvas do jogo nao guarda o
     desenho depois que o quadro e mostrado (preserveDrawingBuffer falso).
     Por isso o renderControle() dele e embrulhado. A copia e feita em
     quadro sim, quadro nao - a camera a 30 quadros basta e custa metade. */
  Ponte.prototype.cameraNoControle = function (telas) {
    var j = this.janela;
    if (!j) return false;

    j.xgFpvAlvos = telas;

    return this.rodar(
      "(function(){" +
      "  if (window.__xgFpv) return true;" +
      "  if (typeof renderControle !== 'function') return false;" +
      "  window.__xgFpv = true;" +
      "  var original = renderControle, n = 0;" +
      "  renderControle = function(){" +
      "    original();" +
      "    var alvos = window.xgFpvAlvos;" +
      "    if (!alvos || (n++ % 2)) return;" +
      "    var c = rcCaixa, pr = render.getPixelRatio(), fonte = render.domElement;" +
      "    if (!c.sw || !c.sh) return;" +
      /* campoAtrasDoAparelho() trocou este desenho pela cena inteira (o
         campo atras do aparelho) e a camera deixou de ser desenhada. Ela
         volta aqui, so na area da tela do aparelho - que fica coberta pelo
         controle, entao o aluno nao ve este desenho, so a copia. */
      "    var H = innerHeight;" +
      "    atualizarFpv();" +
      /* o gimbal: o jogo deixa a camera fixa a -19 graus; aqui ela segue o
         angulo que o aluno escolhe na roda do mouse (o dial do RC Plus) */
      "    if (typeof window.xgGimbal === 'number') {" +
      "      var p = camFpv.position, a = window.xgGimbal * Math.PI / 180;" +
      "      var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw);" +
      "      camFpv.up.set(0, 1, 0);" +
      "      camFpv.lookAt(p.x + fx * Math.cos(a) * 10, p.y + Math.sin(a) * 10, p.z + fz * Math.cos(a) * 10);" +
      "    }" +
      "    render.setScissorTest(true);" +
      "    render.setScissor(c.sx, H - c.sy - c.sh, c.sw, c.sh);" +
      "    render.setViewport(c.sx, H - c.sy - c.sh, c.sw, c.sh);" +
      "    render.render(cena, camFpv);" +
      "    render.setScissorTest(false);" +
      "    render.setViewport(0, 0, innerWidth, innerHeight);" +
      /* A queda, filmada de fora: enquanto a aeronave cai (e o jogo a
         desmonta), uma camera de perseguicao a filma e cada quadro vai
         para window.__xgQuedaFilme. O cartao de queda mostra em loop. */
      "    if (V.estado === 'caiu') {" +
      "      if (!window.__xgQuedaFilme) { window.__xgQuedaFilme = []; window.__xgQuedaCam = new THREE.PerspectiveCamera(50, 1.6, 0.3, 2500); }" +
      "      var F = window.__xgQuedaFilme;" +
      "      if (F.length < 100) {" +
      "        var qc = window.__xgQuedaCam, d = drone.position;" +
      "        if (!qc.userData.fixa) { qc.userData.fixa = new THREE.Vector3(d.x - V.dirx * 14 + 6, d.y + 5, d.z - V.dirz * 14 + 4); }" +
      "        qc.position.copy(qc.userData.fixa); qc.position.y = Math.max(qc.position.y, alt(qc.position.x, qc.position.z) + 1.5);" +
      "        qc.lookAt(d.x, d.y, d.z);" +
      "        render.setScissorTest(true);" +
      "        render.setScissor(c.sx, H - c.sy - c.sh, c.sw, c.sh);" +
      "        render.setViewport(c.sx, H - c.sy - c.sh, c.sw, c.sh);" +
      "        render.render(cena, qc);" +
      "        render.setScissorTest(false);" +
      "        render.setViewport(0, 0, innerWidth, innerHeight);" +
      "        var cv = document.createElement('canvas'); cv.width = 480; cv.height = 300;" +
      "        cv.getContext('2d').drawImage(fonte, c.sx * pr, c.sy * pr, c.sw * pr, c.sh * pr, 0, 0, 480, 300);" +
      "        F.push(cv);" +
      "      }" +
      "    } else if (window.__xgQuedaFilme) { window.__xgQuedaFilme = null; window.__xgQuedaCam = null; }" +
      "    for (var i = 0; i < alvos.length; i++) {" +
      "      var tela = alvos[i], w = tela.clientWidth, h = tela.clientHeight;" +
      "      if (!w || !h) continue;" +
      "      var dpr = (tela.ownerDocument.defaultView || window).devicePixelRatio || 1;" +
      "      var W = Math.round(w * dpr), H = Math.round(h * dpr);" +
      "      if (tela.width !== W) tela.width = W;" +
      "      if (tela.height !== H) tela.height = H;" +
      "      tela.getContext('2d').drawImage(fonte, c.sx * pr, c.sy * pr, c.sw * pr, c.sh * pr, 0, 0, W, H);" +
      "    }" +
      "  };" +
      "  return true;" +
      "})()"
    ) === true;
  };

  /* Escreve os parametros de tarefa no campo. E assim que o controle vai
     mandar altura, velocidade, faixa, volume e gota para o voo. */
  Ponte.prototype.definirParametros = function (p) {
    if (!p) return;
    var campos = ["altura", "vel", "faixa", "gota", "vazao", "rth", "modo", "terreno", "desvio", "estab"];
    var partes = [];

    campos.forEach(function (nome) {
      if (p[nome] === undefined) return;
      partes.push("P." + nome + " = " + JSON.stringify(p[nome]) + ";");
    });

    if (!partes.length) return;
    this.rodar("(function(){" + partes.join("") +
      "if(typeof atualizarPainel==='function') atualizarPainel();" +
      "if(typeof desenharFaixas==='function') desenharFaixas();})()");
  };

  /* Entrega ao campo um talhao mapeado de fora (pelo controle).
     `limite` e `obstaculos` em METROS, no mesmo referencial do campo. */
  Ponte.prototype.definirMapa = function (limite, obstaculos) {
    if (!limite || limite.length < 3) return false;

    return !!this.rodar(
      "(function(){" +
      "  var m = {limite: " + JSON.stringify(limite) +
      ", obstaculos: " + JSON.stringify(obstaculos || []) + "};" +
      "  salvarMapa(m);" +
      "  if(typeof desenharMapa3D==='function') desenharMapa3D();" +
      "  if(typeof atualizarMapaPainel==='function') atualizarMapaPainel();" +
      "  return true;" +
      "})()"
    );
  };

  /* Avisa o treinamento quando o aluno troca de vista no campo.

     Em vez de descobrir isso no proximo ciclo de leitura (ate 400 ms
     depois), embrulhamos a funcao do campo: a troca chega na hora, que e
     o que faz a tela do controle parecer parte do aparelho e nao um
     pop-up atrasado. */
  Ponte.prototype.aoTrocarVista = function (aviso) {
    var janela = this.janela || this.iframe.contentWindow;
    janela.__aoTrocarVista = aviso;

    this.rodar(
      "(function(){" +
      "  if (window.__vistaEmbrulhada) return;" +
      "  window.__vistaEmbrulhada = true;" +
      "  var original = definirVista;" +
      "  window.definirVista = function (v) {" +
      "    original(v);" +
      "    if (window.__aoTrocarVista) window.__aoTrocarVista(v);" +
      "  };" +
      /* os botões da barra chamam a função antiga por referência: religa */
      "  var botoes = document.querySelectorAll('#vistas button');" +
      "  for (var i = 0; i < botoes.length; i++) {" +
      "    (function (b) {" +
      "      b.onclick = function () { window.definirVista(b.dataset.v); };" +
      "    })(botoes[i]);" +
      "  }" +
      "})()"
    );
  };

  /* ------------------------------------------------- foto aerea do campo

     O mapa do controle vinha com uma paisagem desenhada, sem relacao
     nenhuma com o campo onde o drone voa: acude, casario e estradas que
     nao existem no cenario. Aqui o proprio campo e fotografado de cima,
     com camera ortografica, e essa foto vira o terreno do controle.

     A extensao fotografada fica registrada junto com a imagem: e ela que
     define, depois, a conta de pixel para metro do mapa.
     ---------------------------------------------------------------------- */

  Ponte.prototype.fotografarDeCima = function (opcoes) {
    opcoes = opcoes || {};

    var larguraM = opcoes.larguraM || 446.8;     // 1920 px x 0,2327 m
    var alturaM = opcoes.alturaM || 279.2;       // 1200 px x 0,2327 m
    var px = opcoes.px || 1440;                  // resolução da foto
    var py = Math.round(px * alturaM / larguraM);

    var dados = this.rodar(
      "(function(){" +
      "  var T = TALHAO;" +
      /* centro opcional (mapa HD do mapeamento: só a área fotografada); sem ele, o talhão */
      "  var cx = " + (Number.isFinite(opcoes.cx) ? opcoes.cx : "T.x0 + T.larg/2") +
      ", cz = " + (Number.isFinite(opcoes.cz) ? opcoes.cz : "T.z0 + T.prof/2") + ";" +
      "  var lm = " + larguraM + ", am = " + alturaM + ";" +
      "  var px = " + px + ", py = " + py + ";" +

      /* retângulo, não quadrado: a foto tem de ter a MESMA proporção do
         mapa do controle, senão o campo entra esticado */
      "  var cam = new THREE.OrthographicCamera(-lm/2, lm/2, am/2, -am/2, 1, 1400);" +
      "  cam.position.set(cx, 700, cz);" +
      "  cam.up.set(0, 0, -1);" +
      "  cam.lookAt(cx, 0, cz);" +
      "  cam.updateProjectionMatrix();" +

      "  var nevoa = cena.fog; cena.fog = null;" +
      "  var escondidos = [];" +
      "  [typeof drone!=='undefined'?drone:null," +
      "   typeof grupoOperador!=='undefined'?grupoOperador:null]" +
      "   .forEach(function(o){ if(o && o.visible){ o.visible=false; escondidos.push(o); } });" +

      /* 21/11/2026 (Eduardo: "tem que melhorar significativamente a qualidade da imagem nos controles"): ate 4096 px e com
         superamostragem (desenha 2x maior e reduz), em 8 bits - o alvo em ponto flutuante de 4096 px passava de 160 MB.
         O alvo ja sai em sRGB com tone mapping (ver abaixo): 8 bits guardam o mesmo valor. */
      "  var k = Math.max(1, Math.min(2, Math.floor(6144 / Math.max(px, py)))), qx = px * k, qy = py * k;" +
      "  var alvo = new THREE.WebGLRenderTarget(qx, qy, {type: THREE.UnsignedByteType, samples: 4});" +
      "  var antes = render.getRenderTarget();" +
      "  render.setRenderTarget(alvo);" +
      "  render.render(cena, cam);" +
      "  render.setRenderTarget(antes);" +

      "  cena.fog = nevoa;" +
      "  escondidos.forEach(function(o){ o.visible = true; });" +

      "  var dados = new Uint8Array(qx*qy*4);" +
      "  render.readRenderTargetPixels(alvo, 0, 0, qx, qy, dados);" +
      "  alvo.dispose();" +

      "  var grande = document.createElement('canvas');" +
      "  grande.width = qx; grande.height = qy;" +
      "  var gctx = grande.getContext('2d');" +
      "  var img = gctx.createImageData(qx, qy);" +

      /* o alvo já sai em sRGB com tone mapping: converter de novo lavaria
         a imagem inteira */
      /* a leitura vem de baixo para cima: vira as linhas */
      "  for (var y = 0; y < qy; y++) {" +
      "    var de = (qy - 1 - y) * qx * 4;" +
      "    img.data.set(dados.subarray(de, de + qx * 4), y * qx * 4);" +
      "  }" +
      "  for (var a = 3; a < img.data.length; a += 4) img.data[a] = 255;" +
      "  gctx.putImageData(img, 0, 0);" +
      "  var tela = document.createElement('canvas');" +
      "  tela.width = px; tela.height = py;" +
      "  var ctx = tela.getContext('2d');" +
      "  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';" +
      "  ctx.drawImage(grande, 0, 0, px, py);" +
      /* 21/11/2026 (Eduardo: "esse verde em volta do mapa ta feio deixa ele mais verde"): so na foto dos controles. O pasto tem
         manchas escuras grandes (parecia camuflagem). Em cada pixel de grama (verde ou oliva: g >= 0,8 r e g > 2 b) a luz e comprimida
         para perto de um verde medio (as manchas quase somem, o detalhe fino fica) e a cor puxa para o verde; terra (vermelha), estrada
         e telhado nao passam no teste e nao mudam. */
      "  var fd = ctx.getImageData(0, 0, px, py), d = fd.data, ALVO = 92;" +
      "  for (var p = 0; p < d.length; p += 4) {" +
      "    var r = d[p], g = d[p+1], b = d[p+2];" +
      "    var escuro = r + g + b < 140;" +
      "    if (g < r * (escuro ? 0.62 : 0.8) || g <= b * (escuro ? 1.4 : 2)) continue;" +
      "    var l = (r * 0.3 + g * 0.59 + b * 0.11), l2 = ALVO * Math.pow(Math.max(l, 4) / ALVO, 0.3), k2 = l2 / Math.max(l, 4);" +
      "    r = r * k2 * 0.78; g = g * k2 * 1.12; b = b * k2 * 1.05;" +
      "    d[p] = r > 255 ? 255 : r; d[p+1] = g > 255 ? 255 : g; d[p+2] = b > 255 ? 255 : b;" +
      "  }" +
      "  ctx.putImageData(fd, 0, 0);" +

      "  return { imagem: tela.toDataURL('image/jpeg', 0.92)," +
      "           larguraM: lm, alturaM: am, centro: {x: cx, z: cz}," +
      "           talhao: {x0:T.x0, z0:T.z0, larg:T.larg, prof:T.prof} };" +
      "})()"
    );

    return dados || null;
  };

  /* Onde fica a TELA do aparelho que o campo desenha, em pixels da janela.

     O campo ja desenha o controle na mao do operador, com a cena atras -
     e isso e o que da a sensacao de estar ali, perto do drone. Entao a
     moldura continua sendo a dele; o que troca e o conteudo da tela, que
     passa a ser o app de verdade.

     `rcCaixa` (campo: layoutControle) tem a moldura em x,y,w,h e a tela em
     sx,sy,sw,sh, recalculadas a cada resize. */
  Ponte.prototype.caixaDaTela = function () {
    return this.ler(
      "(typeof rcCaixa!=='undefined' && rcCaixa) ? " +
      "{x:rcCaixa.sx, y:rcCaixa.sy, largura:rcCaixa.sw, altura:rcCaixa.sh} : null"
    );
  };

  /* Na vista do controle o campo limpa a tela e desenha SO o FPV dentro do
     visor (renderControle, campo: setScissor) - o resto fica preto. Como
     agora o visor mostra o app de verdade, o FPV nao e mais usado: melhor
     a cena inteira ao fundo, que e o que o operador ve quando levanta os
     olhos do aparelho. */
  Ponte.prototype.campoAtrasDoAparelho = function (ligado) {
    if (ligado) {
      this.rodar(
        "(function(){" +
        "  if (window.__renderControleOriginal) return;" +
        "  window.__renderControleOriginal = renderControle;" +
        "  window.renderControle = function(){" +
        "    render.setClearColor('#c6d4dc', 1);" +
        /* O fundo e o que o PILOTO ve: dos olhos dele, na direcao em que
           esta virado (o jogo o vira para o drone). Antes usava a camera
           que a vista anterior deixou - saindo da vista Drone, o fundo
           ficava no meio da lavoura. */
        "    if (typeof grupoOperador === 'undefined' || !grupoOperador) {" +
        "      render.render(cena, cam); return;" +
        "    }" +
        "    var c = window.__camFrente;" +
        "    if (!c) c = window.__camFrente = new THREE.PerspectiveCamera(55, 1, 0.1, 2500);" +
        "    c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix();" +
        "    var o = grupoOperador.position, a = grupoOperador.rotation.y;" +
        "    var fx = Math.sin(a), fz = Math.cos(a);" +
        "    var olho = new THREE.Vector3(o.x, o.y + 1.62, o.z);" +
        "    c.position.copy(olho);" +
        /* o olhar sobe atras do drone quando ele sobe, sem virar ceu nem chao */
        "    var d = drone.position;" +
        "    var longe = Math.max(4, Math.hypot(d.x - o.x, d.z - o.z));" +
        "    var olhar = Math.max(-0.15, Math.min(0.45, Math.atan2(d.y - olho.y, longe)));" +
        "    c.lookAt(olho.x + fx * 10 * Math.cos(olhar), olho.y + 10 * Math.sin(olhar), olho.z + fz * 10 * Math.cos(olhar));" +
        /* o proprio operador sai do desenho: a camera esta na cabeca dele */
        "    var visivel = grupoOperador.visible;" +
        "    grupoOperador.visible = false;" +
        "    render.render(cena, c);" +
        "    grupoOperador.visible = visivel;" +
        "  };" +
        "})()"
      );
      return;
    }

    this.rodar(
      "(function(){" +
      "  if (!window.__renderControleOriginal) return;" +
      "  window.renderControle = window.__renderControleOriginal;" +
      "  window.__renderControleOriginal = null;" +
      "})()"
    );
  };

  /* A vista Operador vira a visao do PILOTO (pedido dele): em primeira
     pessoa, dos olhos do operador, olhando para o drone - e o aparelho
     baixo, so com a parte de cima a mostra, como quem levanta os olhos do
     controle para acompanhar a aeronave.

     O jogo monta essa vista por cima do ombro do avatar e esconde o
     aparelho nela. Aqui, sem editar o jogo, quatro funcoes dele sao
     embrulhadas:
       posCamera     esconde o avatar so nesta vista (a camera esta na cabeca)
       mirarOperador poe a camera nos olhos, olhando para o drone
       aplicarVista  mostra o aparelho tambem nesta vista
       layoutControle desce o aparelho - no calculo do jogo (rcCaixa), para
                      a tela do app continuar encaixada nele */
  Ponte.prototype.visaoDoPiloto = function () {
    return this.rodar(
      "(function(){" +
      "  if (window.__xgPiloto) return true;" +
      "  if (typeof mirarOperador !== 'function' || typeof layoutControle !== 'function') return false;" +
      "  window.__xgPiloto = true;" +
      "  var noPiloto = function(){ return vista === 'operador' && !modoMapa && !telaInicial; };" +

      "  var posOriginal = posCamera;" +
      "  posCamera = function(a, b){" +
      "    if (grupoOperador) grupoOperador.visible = !noPiloto();" +
      "    return posOriginal(a, b);" +
      "  };" +

      "  mirarOperador = function(){" +
      "    var o = grupoOperador.position, d = drone.position;" +
      "    var olho = new THREE.Vector3(o.x, o.y + 1.62, o.z);" +
      "    cam.position.copy(olho);" +
      "    var dx = d.x - o.x, dz = d.z - o.z, h = Math.hypot(dx, dz);" +
      "    if (h < 0.5) { dx = Math.sin(grupoOperador.rotation.y); dz = Math.cos(grupoOperador.rotation.y); h = 1; }" +
      /* olha para o drone; sem virar ceu nem chao puro */
      "    var olhar = Math.max(-0.6, Math.min(1.2, Math.atan2(d.y + 0.4 - olho.y, Math.max(h, 1))));" +
      "    cam.lookAt(olho.x + dx / h * Math.cos(olhar) * 10, olho.y + Math.sin(olhar) * 10, olho.z + dz / h * Math.cos(olhar) * 10);" +
      "    cam.updateMatrixWorld();" +
      "  };" +

      "  var layoutOriginal = layoutControle;" +
      "  layoutControle = function(){" +
      "    layoutOriginal();" +
      "    if (!noPiloto()) return;" +
      /* so a parte de cima do aparelho aparece: antenas e o alto da tela */
      "    var c = rcCaixa, desce = (innerHeight - 64 - c.h * 0.36) - c.y;" +
      "    c.y += desce; c.sy += desce;" +
      "    $('vCtrlRc').style.top = c.y + 'px';" +
      "    $('tela').style.top = c.sy + 'px';" +
      "  };" +
      "  addEventListener('resize', function(){ layoutControle(); });" +

      "  var aplicarOriginal = aplicarVista;" +
      "  aplicarVista = function(){" +
      "    aplicarOriginal();" +
      "    if (noPiloto()) $('vCtrl').hidden = false;" +
      "    document.body.classList.toggle('xg-piloto', noPiloto());" +
      "    layoutControle();" +
      "  };" +
      "  aplicarVista();" +
      "  return true;" +
      "})()"
    ) === true;
  };

  /* ------------------------------------------------------- comandos */

  Ponte.prototype.trocarVista = function (nome) {
    this.rodar("definirVista('" + nome + "')");
  };

  Ponte.prototype.abrirPainelDeTarefa = function () {
    this.rodar("abrirPainel()");
  };

  Ponte.prototype.entrarNoMapa = function () {
    this.rodar("document.getElementById('painel').hidden=true; entrarMapa()");
  };

  Ponte.prototype.comecar = function () {
    this.rodar("if(typeof comecar==='function' && !document.getElementById('inicio').hidden) comecar()");
  };

  Ponte.prototype.pausar = function (pausado) {
    this.rodar("if(typeof V!=='undefined') V.pausado=" + (pausado ? "true" : "false"));
  };

  /* Apaga o mapa do cenario atual.

     Na etapa de mapeamento o campo nao pode comecar com o limite pronto:
     e o aluno que tem de caminhar a divisa. O campo guarda os mapas por
     cenario, entao aqui basta salvar `null` no cenario de agora. */
  Ponte.prototype.esquecerMapa = function () {
    this.rodar(
      "if(typeof salvarMapa==='function'){ salvarMapa(null);" +
      "  if(typeof rota!=='undefined') rota.length=0;" +
      "  if(typeof desenharMapa3D==='function') desenharMapa3D();" +
      "  if(typeof montarLista==='function') montarLista(); }"
    );
  };

  /* ------------------------------------------------- decolagem de verdade

     O aluno decola pelo CONTROLE, nao pelo painel do campo (que fica
     escondido dentro do treinamento). Estas duas funcoes sao o caminho:
     uma le a verificacao que o campo ja calcula, a outra manda decolar.
     ---------------------------------------------------------------------- */

  /* A verificacao antes da tarefa, com os numeros do proprio campo.

     Nao recalculamos nada aqui: `abrirVerificacao()` ja monta a lista com
     as formulas do jogo. A gente chama, le o que ela escreveu e fecha o
     modal - assim, se a conta mudar la, muda aqui junto. */
  Ponte.prototype.lerVerificacao = function () {
    return this.ler(
      "(function(){" +
      "  if(typeof mapaAtual!=='function' || !mapaAtual()) return null;" +
      "  if(typeof abrirVerificacao!=='function') return null;" +
      "  var m = document.getElementById('verif');" +
      "  var estavaFechado = !m || m.hidden;" +
      "  abrirVerificacao();" +
      "  var d = { campo: (document.getElementById('vCampo')||{}).textContent || '', linhas: [] };" +
      "  var itens = document.querySelectorAll('#vLista .check');" +
      "  for (var i = 0; i < itens.length; i++) {" +
      "    var n = itens[i].querySelector('.n'), r = itens[i].querySelector('.r');" +
      "    if (!n || !r) continue;" +
      "    d.linhas.push({ nome: n.textContent, valor: r.textContent," +
      "                    alerta: r.classList.contains('al') });" +
      "  }" +
      "  if (estavaFechado && m) m.hidden = true;" +
      "  return d;" +
      "})()"
    );
  };

  /* Decola. Devolve {ok:false, motivo} em vez de estourar, porque quem
     chama e a tela do controle e ela precisa dizer o porque ao aluno.

     `reiniciarVoo()` so entra com a aeronave em solo: chamada em voo, ela
     apaga a operacao que esta acontecendo. */
  Ponte.prototype.iniciarOperacao = function () {
    var r = this.ler(
      "(function(){" +
      "  if(typeof mapaAtual!=='function' || !mapaAtual()) return {ok:false, motivo:'sem-mapa'};" +
      "  if(typeof V!=='undefined' && V.rodando) return {ok:false, motivo:'ja-voando'};" +
      "  if(typeof decolar!=='function') return {ok:false, motivo:'sem-campo'};" +
      "  var m = document.getElementById('verif'); if(m) m.hidden = true;" +
      /* o badeco abastecendo ao lado do drone (equipe.js): nao decola. 19/11/2026: no voo do XAG decola; a aeronave apita
         e ele tira a mangueira e corre (equipe.js, fuga) */
      "  if(!window.xgVooXag && window.xgEquipe && xgEquipe.estado!=='sentado' && xgEquipe.perto()<6) return {ok:false, motivo:'pessoa-perto'};" +
      "  if(window.xgProtecao && xgProtecao.bloqueioDecolagem()) return {ok:false, motivo:'pessoa-perto'};" +
      "  if(typeof reiniciarVoo==='function') reiniciarVoo();" +
      "  decolar();" +
      "  var subiu = (typeof V!=='undefined' && V.rodando);" +
      /* decolar() sem rota abre um alerta do campo, que ficaria por cima
         do aparelho; some com ele e devolve o motivo */
      "  if(!subiu){ var a=document.getElementById('alerta'); if(a) a.hidden=true;" +
      "              return {ok:false, motivo:'sem-rota'}; }" +
      "  return {ok:true, pontos:(typeof rota!=='undefined'?rota.length:0)};" +
      "})()"
    );

    return r || { ok: false, motivo: "sem-campo" };
  };

  /* Parar e retomar a operacao, como os botoes Encerrar/Retomar do app.
     O campo nao tem `V.pausado`: quem segura o voo e `V.rodando`. */
  Ponte.prototype.segurarOperacao = function (segurar) {
    this.rodar(
      "if(typeof V!=='undefined' && V.estado!=='em solo' && V.estado!=='concluído'){" +
      "  V.rodando = " + (segurar ? "false" : "true") + ";" +
      "  var b = document.getElementById('bPausa');" +
      "  if(b) b.textContent = V.rodando ? 'Pausar' : 'Continuar';" +
      "}"
    );
  };

  /* ------------------------------------------------- cobertura de verdade

     `coberturaReal()` do campo mede contra `TALHAO`, um retangulo fixo do
     cenario - nunca contra o limite que o aluno desenhou no controle. No
     treinamento isso faria a nota sair contra a area errada.

     Aqui a conta e refeita por fora, sobre a mesma grade de tinta do campo
     (`cobN`), so que recortada pelo poligono de `mapaAtual()`. O campo nao
     e editado: ele so e lido.

     A mascara do talhao custa caro, entao e calculada uma vez por mapa e
     guardada em `XG_MASC`; depois cada medicao e so uma contagem. */
  Ponte.prototype.prepararCobertura = function () {
    return this.ler(
      "(function(){" +
      "  var m = (typeof mapaAtual==='function') ? mapaAtual() : null;" +
      "  if(!m || !m.limite || m.limite.length < 3) { window.XG_MASC = null; return false; }" +
      "  var pts = m.limite, n = pts.length;" +
      "  var masc = new Uint8Array(COB_W * COB_H), dentro = 0;" +
      "  for (var y = 0; y < COB_H; y++) {" +
      "    var mz = PINT.z0 + (y + 0.5) / COB_PX;" +
      "    for (var x = 0; x < COB_W; x++) {" +
      "      var mx = PINT.x0 + (x + 0.5) / COB_PX, bate = false;" +
      "      for (var i = 0, j = n - 1; i < n; j = i++) {" +
      "        var xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];" +
      "        if (((zi > mz) !== (zj > mz)) &&" +
      "            (mx < (xj - xi) * (mz - zi) / (zj - zi) + xi)) bate = !bate;" +
      "      }" +
      "      if (bate) { masc[y * COB_W + x] = 1; dentro++; }" +
      "    }" +
      "  }" +
      "  window.XG_MASC = masc; window.XG_MASC_TOT = dentro;" +
      "  return dentro > 0;" +
      "})()"
    );
  };

  /* Amostra de 2 em 2 pixels: cada pixel da grade vale 25 cm, entao a
     amostra mede de meio em meio metro - sobra precisao para hectare e
     custa um quarto do tempo. */
  Ponte.prototype.cobertura = function () {
    return this.ler(
      "(function(){" +
      "  if(!window.XG_MASC || !window.XG_MASC_TOT) return null;" +
      "  var masc = window.XG_MASC, passo = 2;" +
      "  var tot = 0, dentro = 0, dupla = 0, fora = 0;" +
      "  for (var y = 0; y < COB_H; y += passo) {" +
      "    for (var x = 0; x < COB_W; x += passo) {" +
      "      var i = y * COB_W + x, n = cobN[i];" +
      "      if (masc[i]) { tot++; if (n > 0) dentro++; if (n > 1) dupla++; }" +
      "      else if (n > 0) fora++;" +
      "    }" +
      "  }" +
      "  if(!tot) return null;" +
      "  var m2 = (passo / COB_PX) * (passo / COB_PX);" +
      "  return { pct: dentro / tot * 100," +
      "           sobrePct: dupla / tot * 100," +
      "           foraHa: fora * m2 / 10000," +
      "           haCobertos: dentro * m2 / 10000," +
      "           haTalhao: tot * m2 / 10000 };" +
      "})()"
    );
  };

  /* ------------------------------------------------------ a queda, contada

     Quando a aeronave cai, o campo guarda em `V.motivo` o proprio colisor -
     com nome, altura do topo (y1) e uma dica escrita para aquele obstaculo.
     E dai que sai o diagnostico: nada de tabela de alturas nossa, que
     envelheceria calada se o cenario mudasse.

     A altura do obstaculo e medida a partir do solo DELE, nao do nivel da
     base: numa encosta, um poste de 9 m no alto do morro esta muito acima
     da altura de retorno contada la embaixo. */
  Ponte.prototype.lerQueda = function () {
    return this.ler(
      "(function(){" +
      "  if(typeof V==='undefined' || V.estado!=='caiu' || !V.motivo) return null;" +
      "  var m = V.motivo;" +
      "  var temPonto = (m.cx !== undefined && m.cz !== undefined);" +
      "  var solo = (typeof alt==='function' && temPonto) ? alt(m.cx, m.cz) : null;" +
      "  var d = (typeof drone!=='undefined' && drone) ? drone.position : null;" +
      "  return {" +
      "    nome: m.nome || 'um obstáculo'," +
      "    dica: m.dica || ''," +
      "    fio: !!m.fio," +
      "    relevo: m.tipo === 'relevo'," +
      /* caixa e cilindro trazem o topo em y1; o fio e um segmento a->b e a
         altura que interessa e a dele no ponto onde bateu, nao a media do vao */
      "    alturaObstaculo: (function(){" +
      "      if(m.y1 !== undefined && solo !== null) return m.y1 - solo;" +
      "      if(m.tipo === 'seg' && m.a && m.b && typeof alt === 'function'){" +
      "        var px = (m.a.x + m.b.x)/2, pz = (m.a.z + m.b.z)/2;" +
      "        if(d){" +
      "          var vx = m.b.x - m.a.x, vz = m.b.z - m.a.z;" +
      "          var comp = vx*vx + vz*vz;" +
      "          var u = comp > 0 ? ((d.x-m.a.x)*vx + (d.z-m.a.z)*vz)/comp : 0;" +
      "          u = Math.max(0, Math.min(1, u));" +
      "          px = m.a.x + vx*u; pz = m.a.z + vz*u;" +
      "        }" +
      "        return (m.a.y + m.b.y)/2 - alt(px, pz);" +
      "      }" +
      "      return null;" +
      "    })()," +
      "    alturaQueda: (d && typeof alt==='function') ? (d.y - alt(d.x, d.z)) : null," +
      "    rth: (typeof P!=='undefined' ? P.rth : null)," +
      /* quanto o chao onde caiu esta acima do ponto de decolagem: e a conta
         do "deslocamento reto na altitude de RTH" batendo no morro */
      "    relevoSobreOrigem: (d && typeof alt==='function' && typeof BASE!=='undefined')" +
      "       ? (alt(d.x, d.z) - alt(BASE.x, BASE.z)) : null," +
      "    desvio: (typeof P!=='undefined' ? !!P.desvio : null)," +
      "    terreno: (typeof P!=='undefined' ? P.terreno : null)," +
      "    altura: (typeof P!=='undefined' ? P.altura : null)" +
      "  };" +
      "})()"
    );
  };

  /* A rota que o drone voa passa a ser a PLANEJADA no controle: angulo das
     passadas, trecho da segmentacao e area de cobertura (so rota, rota e
     fronteira, so fronteira). O gerarRota() do campo so sabe fazer passadas
     norte-sul; embrulhado, ele recebe o talhao girado para o angulo do
     plano, gera as passadas e elas sao desgiradas. Sem plano (P.xgAngulo
     indefinido), fica tudo como o jogo fazia.

     Os valores chegam em P: xgAngulo (radianos, o mesmo angulo do desenho do
     controle - o mapa dele e o campo tem x e z no mesmo sentido), xgSeg
     ([inicio, fim] em %) e xgCobertura. */
  Ponte.prototype.instalarRotaPlanejada = function () {
    return this.rodar(
      "(function(){" +
      "  if (window.__xgRotaPlanejada) return true;" +
      "  if (typeof gerarRota !== 'function') return false;" +
      "  window.__xgRotaPlanejada = true;" +
      "  var original = gerarRota;" +

      "  function girar(p, cx, cz, b) {" +
      "    var dx = p[0] - cx, dz = p[1] - cz;" +
      "    return [cx + dx * Math.cos(b) - dz * Math.sin(b), cz + dx * Math.sin(b) + dz * Math.cos(b)];" +
      "  }" +

      /* a borda por dentro do talhao, a meia faixa do limite */
      "  function bordaPorDentro(lim, d) {" +
      "    var n = lim.length, s = 0;" +
      "    for (var i = 0; i < n; i++) { var a = lim[i], b = lim[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }" +
      "    var dentro = s > 0 ? 1 : -1, linhas = [];" +
      "    for (var i = 0; i < n; i++) {" +
      "      var a = lim[i], b = lim[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1;" +
      "      var nx = -ez / l * dentro, nz = ex / l * dentro;" +
      "      linhas.push([[a[0] + nx * d, a[1] + nz * d], [ex, ez]]);" +
      "    }" +
      "    var pts = [];" +
      "    for (var i = 0; i < n; i++) {" +
      "      var L1 = linhas[(i + n - 1) % n], L2 = linhas[i];" +
      "      var den = L1[1][0] * L2[1][1] - L1[1][1] * L2[1][0];" +
      "      if (Math.abs(den) < 1e-9) { pts.push(L2[0]); continue; }" +
      "      var t = ((L2[0][0] - L1[0][0]) * L2[1][1] - (L2[0][1] - L1[0][1]) * L2[1][0]) / den;" +
      "      pts.push([L1[0][0] + L1[1][0] * t, L1[0][1] + L1[1][1] * t]);" +
      "    }" +
      "    return pts;" +
      "  }" +

      /* O drone nao sai da area de aplicacao (palavras dele). O jogo liga
         o fim de uma passada ao comeco da proxima em linha reta; num talhao
         com reentrancia essa reta cruza por fora. Aqui, quando a ligacao
         sai do poligono, ela recua pelas proprias passadas ate uma
         profundidade em que a travessia fica toda por dentro. */
      "  function dentroPol(p, lim) {" +
      "    var ok = false;" +
      "    for (var i = 0, j = lim.length - 1; i < lim.length; j = i++) {" +
      "      var a = lim[i], b = lim[j];" +
      "      if (((a[1] > p[1]) !== (b[1] > p[1])) && (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0])) ok = !ok;" +
      "    }" +
      "    return ok;" +
      "  }" +
      "  function segDentro(a, b, lim) {" +
      "    var n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));" +
      "    for (var k = 0; k <= n; k++) { var t = k / n; if (!dentroPol([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], lim)) return false; }" +
      "    return true;" +
      "  }" +
      "  function recua(p, rumo, d) {" +
      "    var l = Math.hypot(rumo[0] - p[0], rumo[1] - p[1]) || 1;" +
      "    return [p[0] + (rumo[0] - p[0]) / l * d, p[1] + (rumo[1] - p[1]) / l * d];" +
      "  }" +
      "  function arrumarTransicoes(lim) {" +
      "    if (!lim || lim.length < 3) return;" +
      "    for (var i = 1; i + 1 < rota.length; i++) {" +
      "      if (rota[i].aplica || !rota[i - 1].aplica || !rota[i + 1].aplica || i < 2) continue;" +
      "      var A = rota[i - 1].p, B = rota[i].p;" +
      "      if (segDentro(A, B, lim)) continue;" +
      "      var anterior = rota[i - 2].p, seguinte = rota[i + 1].p, feito = false;" +
      "      for (var d = 2; d <= 60 && !feito; d += 2) {" +
      "        var A2 = recua(A, anterior, d), B2 = recua(B, seguinte, d);" +
      "        if (segDentro(A2, B2, lim)) {" +
      "          rota.splice(i, 0, { p: A2, aplica: false }, { p: B2, aplica: false });" +
      "          i += 2; feito = true;" +
      "        }" +
      "      }" +
      "    }" +
      "  }" +

      "  gerarRota = function () {" +
      /* app do RC Plus com o gerador novo (app_rcplus.js): a MESMA rota da
         previa do controle; sem geo/chave diferente, segue o caminho antigo */
      "    if (P.xgGeo && typeof window.__xgRotaApp === 'function' && window.__xgRotaApp()) return;" +
      "    var M = mapaAtual(), ang = P.xgAngulo;" +
      "    if (!M || typeof ang !== 'number') { original(); arrumarTransicoes(M ? M.limite : null); return; }" +
      "    var lim = M.limite, cx = 0, cz = 0;" +
      "    lim.forEach(function (p) { cx += p[0]; cz += p[1]; });" +
      "    cx /= lim.length; cz /= lim.length;" +
      /* a direcao das faixas do controle vira o eixo das passadas do campo */
      "    var b = Math.PI / 2 - ang;" +
      "    var girado = Object.assign({}, M, {" +
      "      limite: lim.map(function (p) { return girar(p, cx, cz, b); })," +
      "      obstaculos: (M.obstaculos || []).map(function (o) {" +
      "        if (o.pts) return Object.assign({}, o, { pts: o.pts.map(function (p) { return girar(p, cx, cz, b); }) });" +
      "        if (o.c) return Object.assign({}, o, { c: girar(o.c, cx, cz, b) });" +
      "        return o;" +
      "      })" +
      "    });" +
      "    var chave = cen.id, antes = MAPAS[chave];" +
      "    MAPAS[chave] = girado;" +
      "    try { original(); } finally { MAPAS[chave] = antes; }" +
      "    arrumarTransicoes(girado.limite);" +

      /* a segmentacao: as passadas sao os trechos que aplicam, agrupados pela
         coluna (no quadro girado cada passada tem x constante) */
      "    var seg = P.xgSeg;" +
      "    if (seg && (seg[0] > 0 || seg[1] < 100) && rota.length) {" +
      "      var blocos = [], atual = [];" +
      "      rota.forEach(function (w) { atual.push(w); if (w.aplica) { blocos.push(atual); atual = []; } });" +
      "      var colunas = [];" +
      "      blocos.forEach(function (bl) { var x = Math.round(bl[bl.length - 1].p[0] * 10) / 10; if (colunas.indexOf(x) < 0) colunas.push(x); });" +
      "      colunas.sort(function (p, q) { return p - q; });" +
      "      var n = colunas.length, i0 = Math.floor(n * seg[0] / 100), i1 = Math.ceil(n * seg[1] / 100);" +
      "      var ficam = colunas.slice(i0, i1), nova = [];" +
      "      blocos.forEach(function (bl) {" +
      "        var x = Math.round(bl[bl.length - 1].p[0] * 10) / 10;" +
      "        if (ficam.indexOf(x) < 0) return;" +
      /* o primeiro trecho que fica comeca no inicio da passada, sem o
         deslocamento que vinha da passada cortada */
      "        if (!nova.length) bl = bl.slice(Math.max(0, bl.length - 2));" +
      "        nova = nova.concat(bl);" +
      "      });" +
      "      rota.length = 0; nova.forEach(function (w) { rota.push(w); });" +
      "    }" +

      "    rota.forEach(function (w) { w.p = girar(w.p, cx, cz, -b); });" +

      /* area de cobertura: a volta da fronteira, por dentro, a meia faixa */
      "    var cob = P.xgCobertura;" +
      "    if (cob === 'Somente fronteira' || cob === 'Rota e fronteira') {" +
      "      var borda = bordaPorDentro(lim, Math.max(1, P.faixa / 2));" +
      /* o sentido da volta: o limite vem no sentido em que foi marcado;
         a orientacao real sai do sinal da area (shoelace) */
      "      var s2 = 0; for (var q = 0; q < borda.length; q++) { var a2 = borda[q], b2 = borda[(q + 1) % borda.length]; s2 += a2[0] * b2[1] - b2[0] * a2[1]; }" +
      /* no mapa (x direita, z para baixo) area positiva = horario */
      "      var horarioAgora = s2 > 0;" +
      "      if ((P.xgSentido === 'anti') === horarioAgora) borda = borda.slice().reverse();" +
      "      if (cob === 'Somente fronteira') rota.length = 0;" +
      "      var zonas = (M.obstaculos || []).map(zonaObstaculo).filter(function (z) { return z.length >= 3; });" +
      "      if (rota.length) {" +
      "        var ult = rota[rota.length - 1].p;" +
      "        contornar(ult, borda[0], zonas, lim, 0).forEach(function (w) { rota.push(w); });" +
      "      }" +
      "      rota.push({ p: borda[0], aplica: false });" +
      "      for (var k = 1; k <= borda.length; k++) rota.push({ p: borda[k % borda.length], aplica: true, fr: true });" +
      "    }" +
      "  };" +
      "  return true;" +
      "})()"
    ) === true;
  };

  /* O mapa e a rota que o drone vai voar, em metros do campo: e o que a tela
     de execucao do controle tem de mostrar (e nao o desenho de exemplo que
     vem no HTML dele). Cada ponto da rota diz se a aeronave pulveriza no
     trecho que chega nele. */
  Ponte.prototype.rotaDoCampo = function () {
    return this.ler(
      "(function(){" +
      "  var m = (typeof mapaAtual === 'function') ? mapaAtual() : null;" +
      "  if (!m || !m.limite || m.limite.length < 3) return null;" +
      "  var obst = (m.obstaculos || []).filter(function (o) { return o && o.pts && o.pts.length >= 3; })" +
      "                                 .map(function (o) { return o.pts; });" +
      /* marcado no campo como ponto com raio */
      "  var circ = (m.obstaculos || []).filter(function (o) { return o && o.c && o.r; })" +
      "                                 .map(function (o) { return [o.c[0], o.c[1], o.r]; });" +
      "  var r = (typeof rota !== 'undefined' && rota ? rota : [])" +
      "            .filter(function (w) { return w && w.p; })" +
      /* 4o valor (novo; o 3o nao muda): 4 ponto de conexao, 1 fronteira, 2 trecho alto, 0 normal */
      "            .map(function (w) { return [w.p[0], w.p[1], w.aplica ? 1 : 0, w.con ? 4 : w.fr ? 1 : w.alto ? 2 : 0]; });" +
      /* feitos: o indice do trecho em curso (V.i e o proximo ponto) */
      "  return { limite: m.limite, obstaculos: obst, circulos: circ, rota: r, faixa: P.faixa," +
      "           feitos: (typeof V !== 'undefined' && V.estado !== 'em solo') ? (V.i || 0) : -1 };" +
      "})()"
    );
  };

  /* O radar de obstaculos: para cada um dos 12 setores de 30 graus em volta
     do drone (0 = o nariz dele), o obstaculo mais perto dentro do alcance.
     A distancia e a mesma que o campo usa na colisao (distColisor, ate a
     superficie do obstaculo). Fio so entra a partir de T50.alcanceFio (4 m):
     e o que o radar de verdade enxerga - e por isso a rede derruba. */
  Ponte.prototype.radar = function (alcance) {
    return this.ler(
      "(function(){" +
      "  if (typeof colisores === 'undefined' || typeof distColisor !== 'function') return null;" +
      "  var A = " + (alcance || 15) + ", d = drone.position;" +
      "  var fx = Math.cos(V.yaw), fz = -Math.sin(V.yaw), rx = Math.sin(V.yaw), rz = Math.cos(V.yaw);" +
      "  var p = new THREE.Vector3(d.x, d.y + 0.3, d.z), setores = {};" +
      "  for (var i = 0; i < colisores.length; i++) {" +
      "    var c = colisores[i];" +
      "    if (Math.hypot(c.cx - d.x, c.cz - d.z) > c.raio + A) continue;" +
      /* arvore seca: acima de 15 km/h o radar nao a ve (campo, sondar) */
      "    if (c.seca && T50.velArvoreSeca && (typeof velHorizontal === 'function' ? velHorizontal() : V.v) > T50.velArvoreSeca) continue;" +
      "    var lim = c.fio ? Math.min(A, T50.alcanceFio) : A;" +
      "    var dist = distColisor(c, p);" +
      "    if (dist > lim) continue;" +
      "    var dx = c.cx - d.x, dz = c.cz - d.z;" +
      "    var ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);" +
      "    var s = ((Math.round(ang / (Math.PI / 6)) % 12) + 12) % 12;" +
      "    if (!(s in setores) || setores[s] > dist) setores[s] = dist;" +
      "  }" +
      "  return Object.keys(setores).map(function(k){ return [Number(k), setores[k]]; });" +
      "})()"
    );
  };

  /* ------------------------------------------------ o controle na mao

     O jogo monta o controle do operador com tres caixas: um corpo liso,
     uma tela azul e duas antenas em bloco. De longe passa; de perto vira
     um "T" que nao lembra o RC Plus. Aqui a face do aparelho passa a ser
     o MESMO desenho da vista Controle (montarControleSvg do jogo), com a
     foto do campo na tela - o que o app mostra no mapa.

     O jogo refaz o operador quando o aluno troca de avatar, e com ele o
     controle antigo. Por isso isto e chamado a cada ciclo: sai cedo quando
     o controle ja e o nosso. */
  Ponte.prototype.controleNaMao = function (fotoMapa) {
    var j = this.janela;
    if (!j || !j.THREE) return false;

    var grupo = this.ler("typeof grupoOperador !== 'undefined' ? grupoOperador : null");
    if (!grupo || !grupo.children.length) return false;

    /* o trabalhador carregado: o avatar e, ao lado dele, o grupo do controle */
    var g = grupo.children[0];
    var av = g.userData && g.userData.av;
    var rc = null;
    g.children.forEach(function (c) { if (c !== av && c.isGroup) rc = c; });
    if (!rc) return false;

    var tipo = fotoMapa ? "foto" : "sem";
    var marca = rc.userData.xgRc || "";
    if (marca === tipo || marca === "montando:" + tipo || marca === "falhou") return true;
    rc.userData.xgRc = "montando:" + tipo;

    var svg = this.ler("typeof montarControleSvg === 'function' ? montarControleSvg() : null");
    var RC = this.ler("typeof RC !== 'undefined' ? RC : null");
    if (!svg || !RC) { rc.userData.xgRc = "falhou"; return false; }

    /* o SVG do jogo vai direto para o DOM, sem xmlns; como imagem, precisa */
    svg = svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="' +
                      RC.w + '" height="' + RC.h + '" ');

    function carregar(src) {
      return new Promise(function (ok, erro) {
        var im = new j.Image();
        im.onload = function () { ok(im); };
        im.onerror = erro;
        im.src = src;
      });
    }

    var self = this;
    Promise.all([
      carregar("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)),
      fotoMapa ? carregar(fotoMapa) : Promise.resolve(null),
    ]).then(function (imagens) {
      if (rc.userData.xgRc !== "montando:" + tipo) return;   // outro pedido passou na frente

      /* metade da resolucao do desenho sobra para um objeto de 30 cm */
      var K = 0.5;
      var tela = j.document.createElement("canvas");
      tela.width = RC.w * K;
      tela.height = RC.h * K;

      var ctx = tela.getContext("2d");
      ctx.scale(K, K);
      /* o buraco da tela no desenho e transparente: a foto vai por baixo */
      ctx.fillStyle = "#0b0f13";
      ctx.fillRect(RC.tx, RC.ty, RC.tw, RC.th);
      if (imagens[1]) ctx.drawImage(imagens[1], RC.tx, RC.ty, RC.tw, RC.th);
      ctx.drawImage(imagens[0], 0, 0, RC.w, RC.h);

      self.montarRcNaMao(j.THREE, g, rc, tela, RC);
      rc.userData.xgRc = tipo;
    }).catch(function () { rc.userData.xgRc = "falhou"; });

    return true;
  };

  Ponte.prototype.montarRcNaMao = function (T, g, rc, tela, RC) {
    var escala = g.scale.x || 1;

    /* 31,6 cm de ponta a ponta das empunhaduras, como o RC Plus */
    var W = 0.316 / escala;
    var H = W * RC.h / RC.w;
    var D = 0.03 / escala;

    /* o corpo no desenho vai de y=345 a 1422 (o que fica acima sao as
       antenas): o centro do corpo, e nao o do desenho, fica entre as maos */
    var sobe = (RC.h / 2 - (345 + 1422) / 2) / RC.h * -H;

    var tex = new T.CanvasTexture(tela);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 4;

    var frente = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({
      map: tex, alphaTest: 0.5, roughness: 0.55, metalness: 0.08,
      /* um pouco de luz propria: a tela de um aparelho ligado se le no sol */
      emissive: new T.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.22,
    }));
    /* a face olha para o operador: e o lado -z do grupo, como no jogo */
    frente.rotation.y = Math.PI;
    frente.position.set(0, sobe, -D / 2);

    var costas = new T.Mesh(new T.PlaneGeometry(W, H), new T.MeshStandardMaterial({
      map: tex, color: new T.Color("#3a3d41"), alphaTest: 0.5, roughness: 0.75,
    }));
    costas.position.set(0, sobe, D / 2);

    /* a espessura, so no corpo */
    var corpo = new T.Mesh(
      new T.BoxGeometry(W * 0.92, H * (1422 - 345) / RC.h * 0.94, D * 0.96),
      new T.MeshStandardMaterial({ color: new T.Color("#4d5155"), roughness: 0.7 })
    );

    rc.clear();
    rc.add(corpo, frente, costas);
    rc.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    this.poseDeSegurar(T, g, rc);
  };

  /* Como se segura o RC Plus (foto que ele mandou): cotovelos junto ao
     corpo, antebracos subindo para o peito, as maos nas empunhaduras e a
     tela inclinada para o rosto.

     O jogo faz a pose apontando cada osso para uma direcao, no referencial
     do trabalhador (que olha para +z). Aqui e o mesmo metodo, com as
     direcoes da foto. O controle do jogo estava inclinado ao contrario
     (rotation.x = -0.75): a tela olhava para a barriga do operador. */
  Ponte.prototype.poseDeSegurar = function (T, g, rc) {
    var B = g.userData && g.userData.B;
    if (!B || !B.upperarm_r || !B.hand_r || !B.hand_l) return;

    var giro = new T.Quaternion();

    function apontar(osso, filho, dir) {
      g.updateMatrixWorld(true);
      var a = new T.Vector3().setFromMatrixPosition(B[osso].matrixWorld);
      var b = new T.Vector3().setFromMatrixPosition(B[filho].matrixWorld);
      g.getWorldQuaternion(giro);
      var alvo = new T.Vector3(dir[0], dir[1], dir[2]).normalize().applyQuaternion(giro);
      var dq = new T.Quaternion().setFromUnitVectors(b.sub(a).normalize(), alvo);
      var wq = B[osso].getWorldQuaternion(new T.Quaternion());
      var pq = B[osso].parent.getWorldQuaternion(new T.Quaternion());
      B[osso].quaternion.copy(pq.invert().multiply(dq.multiply(wq)));
    }

    /* braco quase na vertical, cotovelo encostado no corpo */
    apontar("upperarm_r", "lowerarm_r", [-0.12, -0.97, 0.06]);
    apontar("upperarm_l", "lowerarm_l", [0.12, -0.97, 0.06]);
    /* Antebraco para a frente, subindo ate o peito - e aberto o bastante
       para as maos cairem nas EMPUNHADURAS, nas laterais do aparelho, e
       nao no meio da tela (foto dele). O quanto abrir depende do corpo de
       cada avatar, entao e medido: procura a abertura que deixa os punhos
       a 29 cm um do outro, a largura entre as empunhaduras do RC Plus. */
    var ENTRE_PUNHOS = 0.29;
    var melhor = null;

    function maos() {
      g.updateMatrixWorld(true);
      return {
        r: new T.Vector3().setFromMatrixPosition(B.hand_r.matrixWorld),
        l: new T.Vector3().setFromMatrixPosition(B.hand_l.matrixWorld),
      };
    }

    function antebracos(dentro) {
      apontar("lowerarm_r", "hand_r", [dentro, 0.44, 0.82]);
      apontar("lowerarm_l", "hand_l", [-dentro, 0.44, 0.82]);
    }

    for (var dentro = 0.44; dentro >= -0.1; dentro -= 0.02) {
      antebracos(dentro);
      var m = maos();
      var erro = Math.abs(m.r.distanceTo(m.l) - ENTRE_PUNHOS);
      if (!melhor || erro < melhor.erro) melhor = { dentro: dentro, erro: erro };
    }
    antebracos(melhor.dentro);

    /* as maos, no referencial do trabalhador (que olha para +z) */
    var escala = g.scale.x || 1;
    var mao = maos();
    var r = g.worldToLocal(mao.r.clone());
    var l = g.worldToLocal(mao.l.clone());

    /* o eixo do controle vai da mao direita para a esquerda: o aparelho
       gira junto com a linha das maos e as duas empunhaduras caem nelas */
    var dx = l.x - r.x, dz = l.z - r.z;
    var giroY = Math.atan2(-dz, dx);

    /* o centro um pouco a frente do punho (na palma) e um pouco acima: as
       maos pegam a metade de baixo das empunhaduras, com o polegar no manche */
    var meio = r.clone().add(l).multiplyScalar(0.5);
    rc.position.copy(meio).add(new T.Vector3(0, 0.03 / escala, 0.06 / escala));

    /* primeiro gira para a linha das maos, depois inclina a tela para o
       rosto (a borda das antenas mais longe do corpo) */
    rc.rotation.set(0.62, giroY, 0, "YXZ");
  };

  return {
    criar: function (iframe) { return new Ponte(iframe); },
  };
})();
