/* ==========================================================================
   O VINCULO ENTRE O CONTROLE E O CAMPO

   O aluno opera no controle; o drone voa no campo. Para os dois falarem,
   duas coisas precisam atravessar:

     1. A IMAGEM  - o mapa do controle deixa de ser uma paisagem desenhada
                    e passa a ser a foto do campo onde ele vai voar.
     2. O TALHAO  - o limite que ele desenha no controle, em pixels do
                    mapa, vira o talhao do campo, em metros.

   A conta que liga os dois mundos e uma so, e ela vale porque a FOTO e
   tirada na escala do proprio controle (0,2327 m por unidade do mapa):

       x_metros = centro.x + (px - 960)  * metrosPorUnidade
       z_metros = centro.z + (py - 600)  * metrosPorUnidade

   Sem rotacao e sem inverter sinal: a camera que tira a foto olha de cima
   com o topo apontando para -Z, entao +X vai para a direita e +Z para
   baixo, que e como o SVG cresce.
   ========================================================================== */

window.VINCULO = (function () {
  "use strict";

  var MAPA_LARGURA = 1920;      // viewBox do mapa no controle
  var MAPA_ALTURA = 1200;

  function Vinculo(ponte, quadroDoControle) {
    this.ponte = ponte;
    this.quadro = quadroDoControle;
    this.foto = null;
    this.escala = 0.2327;       // lida do controle assim que ele carregar
    this.tarefasVistas = 0;
    this.aoCarregarTalhao = null;
  }

  Vinculo.prototype.janela = function () {
    try { return this.quadro.contentWindow; } catch (e) { return null; }
  };

  Vinculo.prototype.documento = function () {
    try { return this.quadro.contentDocument; } catch (e) { return null; }
  };

  /* Le do proprio controle, em tempo de execucao, a escala do mapa dele.
     Fixar 0,2327 no nosso codigo quebraria calado se o controle mudasse. */
  Vinculo.prototype.lerEscala = function () {
    var j = this.janela();
    if (!j) return this.escala;

    try {
      var v = j.eval("typeof METROS_POR_UNIDADE !== 'undefined' ? METROS_POR_UNIDADE : null");
      if (typeof v === "number" && v > 0) this.escala = v;
    } catch (e) { /* fica o valor anterior */ }

    return this.escala;
  };

  /* --------------------------------------------------------- coordenadas */

  /* Se o controle ganhar zoom no mapa, os pontos continuam sendo guardados
     no referencial BASE (1920x1200), que e o que `paraMapaGeral` ja faz.
     Enquanto for assim, a conta aqui nao muda com o zoom. Este gancho
     existe para o caso de o controle passar a guardar em outro referencial:
     basta ele publicar `window.XG_MAPA = {zoom, deslocaX, deslocaY}`. */
  Vinculo.prototype.referencial = function () {
    var j = this.janela();
    if (!j) return null;
    try { return j.eval("typeof XG_MAPA !== 'undefined' ? XG_MAPA : null"); }
    catch (e) { return null; }
  };

  Vinculo.prototype.paraMetros = function (ponto) {
    return {
      x: this.foto.centro.x + (ponto.x - MAPA_LARGURA / 2) * this.escala,
      z: this.foto.centro.z + (ponto.y - MAPA_ALTURA / 2) * this.escala,
    };
  };

  Vinculo.prototype.paraPixels = function (metros) {
    return {
      x: MAPA_LARGURA / 2 + (metros.x - this.foto.centro.x) / this.escala,
      y: MAPA_ALTURA / 2 + (metros.z - this.foto.centro.z) / this.escala,
    };
  };

  /* ----------------------------------------------------------- 1. imagem */

  /* Troca o terreno desenhado do controle pela foto do campo. A foto entra
     dentro do proprio <symbol id="terreno">, entao TODAS as telas que o
     usam (mapa, mapeamento, dividir, execucao) passam a mostrar o campo. */
  Vinculo.prototype.plantarImagem = function () {
    var doc = this.documento();
    if (!doc) return false;

    var simbolo = doc.getElementById("terreno");
    if (!simbolo) return false;

    this.lerEscala();

    /* Resolucao acima do tamanho do mapa (1920 px) de proposito: o app tem
       zoom, e no zoom o pedaco aproximado tem de continuar nitido. A 2560
       px, cada pixel da foto vale cerca de 17 cm de campo. */
    this.foto = this.ponte.fotografarDeCima({
      larguraM: MAPA_LARGURA * this.escala,
      alturaM: MAPA_ALTURA * this.escala,
      px: 2560,
    });

    if (!this.foto || !this.foto.imagem) return false;

    var svg = "http://www.w3.org/2000/svg";
    var imagem = doc.getElementById("xg-foto");

    if (!imagem) {
      imagem = doc.createElementNS(svg, "image");
      imagem.id = "xg-foto";
      imagem.setAttribute("x", "0");
      imagem.setAttribute("y", "0");
      imagem.setAttribute("width", String(MAPA_LARGURA));
      imagem.setAttribute("height", String(MAPA_ALTURA));
      imagem.setAttribute("preserveAspectRatio", "none");
      simbolo.insertBefore(imagem, simbolo.firstChild);

      /* o desenho antigo (paisagem inventada) fica escondido, nao apagado:
         se a foto falhar, basta tirar este estilo e o mapa volta */
      var estilo = doc.createElement("style");
      estilo.id = "xg-foto-estilo";
      estilo.textContent = "#terreno > *:not(#xg-foto){display:none!important}";
      doc.head.appendChild(estilo);
    }

    imagem.setAttributeNS("http://www.w3.org/1999/xlink", "href", this.foto.imagem);
    imagem.setAttribute("href", this.foto.imagem);
    /* 21/11/2026 (Eduardo: "quando criar orthomosaico e armazenar vai aparecer em todos os controles da dji"): o
       ortomosaico que o aluno armazenou no DGuri do Air 2S (app_guri.js) entra por cima da foto, no mesmo lugar */
    if (window.GURI_MAPAS) window.GURI_MAPAS.compor(this.foto, "orto", 4096).then(function (orto) {
      if (!orto || !imagem.isConnected) return;
      imagem.setAttributeNS("http://www.w3.org/1999/xlink", "href", orto);
      imagem.setAttribute("href", orto);
    });
    return true;
  };

  /* ----------------------------------------------------------- 2. talhao */

  /* O controle guarda cada mapa salvo em `tarefas`. Aqui a gente so olha:
     apareceu tarefa nova, ela vira o talhao do campo. */
  Vinculo.prototype.conferirTarefas = function () {
    var j = this.janela();
    if (!j || !this.foto) return;

    /* Contar tarefas nao basta: apagar uma e salvar outra deixa a conta no
       mesmo lugar, e o campo ficaria com o talhao velho calado. O que a
       gente acompanha e a ASSINATURA da ultima tarefa. */
    var assinatura;
    try {
      assinatura = j.eval(
        "(function(){" +
        "  if(typeof tarefas==='undefined' || !tarefas.length) return '';" +
        "  var t = tarefas[tarefas.length-1];" +
        "  if(!t || !t.limite || !t.limite.length) return '';" +
        "  var p = t.limite[0];" +
        /* o controle da a cada tarefa um `id` (Date.now()): e o sinal mais
           firme de "tarefa nova". O resto cobre tarefa sem id. */
        "  return [tarefas.length, t.id, t.nome, t.area, t.limite.length," +
        "          Math.round(p.x), Math.round(p.y)].join('|');" +
        "})()"
      );
    } catch (e) { return; }

    if (assinatura === this.assinaturaVista) return;

    this.assinaturaVista = assinatura;
    if (assinatura) this.carregarUltimaTarefa();
  };

  Vinculo.prototype.carregarUltimaTarefa = function () {
    return this.carregarTarefa(null);
  };

  /* Leva uma tarefa do controle para o campo. Sem `id`, a ultima salva;
     com `id`, a que o aluno escolheu (no "Use") - procurada tambem entre
     as que estao em andamento. */
  Vinculo.prototype.carregarTarefa = function (id) {
    /* com o RC Plus de verdade, quem define o talhão é o app do controle
       (app_rcplus.js); o controle virtual escondido não manda tarefa */
    if (window.CONTROLE_REAL && window.CONTROLE_REAL.escolhido() === "real") return false;
    var j = this.janela();
    if (!j) return false;

    var tarefa;
    try {
      tarefa = j.eval(
        "(function(){" +
        "  var id = " + JSON.stringify(id == null ? null : id) + ";" +
        "  var lista = tarefas.concat(typeof emAndamento !== 'undefined' ? emAndamento : []);" +
        "  var t = id === null ? tarefas[tarefas.length-1]" +
        "        : lista.filter(function(x){ return x.id === id; })[0];" +
        "  if (!t) return null;" +
        /* O plano da rota fica guardado NA tarefa: espacamento, area de
           cobertura, angulo das passadas e segmentacao. O controle salva so
           o contorno; na primeira vez que a tarefa chega aqui (logo depois
           de salva), o plano de agora e o dela. */
        "  if (!t.xgPlano) {" +
        "    var r = window.xgRota || {ini: 0, fim: 100};" +
        "    t.xgPlano = { esp: estado.espacamento, cob: estado.cobertura," +
        "                  ang: anguloDaRota(t.limite), seg: [r.ini, r.fim]," +
        "                  sentido: r.sentido || 'horario' };" +
        "  }" +
        "  return {nome: t.nome, area: t.area, plano: t.xgPlano," +
        "    limite: t.limite.map(function(p){return [p.x,p.y]})," +
        "    obstaculo: (t.obstaculo || []).map(function(p){return [p.x,p.y]})};" +
        "})()"
      );
    } catch (e) { return false; }

    if (!tarefa || !tarefa.limite || tarefa.limite.length < 3) return false;

    var self = this;
    var limite = tarefa.limite.map(function (p) {
      var m = self.paraMetros({ x: p[0], y: p[1] });
      return [m.x, m.z];
    });

    var obstaculos = [];
    if (tarefa.obstaculo && tarefa.obstaculo.length >= 3) {
      obstaculos.push({
        tipo: "poligono",
        pts: tarefa.obstaculo.map(function (p) {
          var m = self.paraMetros({ x: p[0], y: p[1] });
          return [m.x, m.z];
        }),
      });
    }

    var aviso = this.conferirTalhao(limite);
    if (aviso) return { erro: aviso, nome: tarefa.nome };

    /* o plano antes do mapa: reiniciarVoo() gera a rota ja com ele. O
       angulo do desenho do controle vale direto no campo (x e z no mesmo
       sentido nos dois). */
    var pl = tarefa.plano;
    if (pl) {
      this.ponte.rodar(
        (typeof pl.esp === "number" && pl.esp > 0 ? "P.faixa = " + pl.esp + ";" : "") +
        (typeof pl.ang === "number" ? "P.xgAngulo = " + pl.ang + ";" : "") +
        "P.xgSeg = " + JSON.stringify(pl.seg || [0, 100]) + ";" +
        "P.xgCobertura = " + JSON.stringify(pl.cob || "Somente rota") + ";" +
        "P.xgSentido = " + JSON.stringify(pl.sentido || "horario") + ";"
      );
    }

    this.ponte.definirMapa(limite, obstaculos);
    /* mapa deste fluxo: a geometria do app RC Plus (app_rcplus.js) nao vale aqui */
    this.ponte.rodar("if(typeof P!=='undefined' && P) P.xgGeo=null; if(typeof reiniciarVoo==='function') reiniciarVoo();");

    var resultado = {
      nome: tarefa.nome,
      pontos: limite.length,
      areaControle: tarefa.area,
      areaCampo: this.areaHectares(limite),
      obstaculos: obstaculos.length,
    };

    if (this.aoCarregarTalhao) this.aoCarregarTalhao(resultado);
    return resultado;
  };

  /* Area pela formula do agrimensor, para comparar com a que o controle
     mostrou: se as duas nao baterem, a conversao esta errada. */
  Vinculo.prototype.areaHectares = function (pontos) {
    var soma = 0;
    for (var i = 0; i < pontos.length; i++) {
      var a = pontos[i], b = pontos[(i + 1) % pontos.length];
      soma += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(soma / 2) / 10000;
  };

  /* O campo so molha dentro de uma caixa em volta do talhao: um poligono
     fora dela voa, mas nao pinta - e a cobertura sai mentindo. */
  Vinculo.prototype.conferirTalhao = function (limite) {
    /* PINT e a grade de tinta do campo: fora dela o drone voa, mas o
       produto nao e contabilizado - e a cobertura sai mentindo. Os limites
       sao lidos do proprio campo porque mudam com o cenario. */
    var c = this.caixaDeAplicacao();

    var dentro = limite.every(function (p) {
      return p[0] >= c.x0 && p[0] <= c.x1 && p[1] >= c.z0 && p[1] <= c.z1;
    });

    if (!dentro) return "O talhão desenhado cai fora da área que o campo aplica.";
    if (this.areaHectares(limite) < 0.05) return "Talhão pequeno demais para uma operação.";
    return null;
  };

  Vinculo.prototype.caixaDeAplicacao = function () {
    if (this.caixa) return this.caixa;

    var p = this.ponte.ler(
      "(typeof PINT!=='undefined' ? " +
      "{x0:PINT.x0, z0:PINT.z0, x1:PINT.x0+PINT.larg, z1:PINT.z0+PINT.prof} : null)"
    );

    this.caixa = p || { x0: -120, z0: -230, x1: 120, z1: 50 };
    return this.caixa;
  };

  /* ------------------------------------------------- 3. estado da aeronave

     O controle tem a propria maquina de conexao: `sincronizarConexao()`
     so liga quando o aparelho esta ligado (faseControle === 'pronto') E o
     drone esta ligado, e entao passa por "Conectando..." antes de fechar.

     Antes daqui a gente escrevia `estado.conectado = true` na marra. O
     controle desfazia na primeira sincronizacao, e no meio do caminho o
     <body> ficava com "desligado conectado" ao mesmo tempo - aparelho
     apagado jurando ter aeronave. Pior: a sincronizacao **expulsa da tela
     de execucao** quem nao esta conectado, entao o aluno era mandado de
     volta ao mapa sem explicacao.

     Agora a integracao diz so o que lhe cabe: a aeronave esta ali. Quem
     decide o resto e o aparelho.
     ---------------------------------------------------------------------- */

  Vinculo.prototype.refletirConexao = function (ligado) {
    if (this.conectado === ligado) return;      // chamado a cada ciclo
    this.conectado = ligado;

    var j = this.janela();
    if (!j) return;

    try {
      j.eval(
        "(function(){" +
        "  if(typeof estado === 'undefined') return;" +
        "  estado.droneLigado = " + (ligado ? "true" : "false") + ";" +
        "  if(typeof sincronizarConexao === 'function') sincronizarConexao();" +
        "})()"
      );
    } catch (e) { /* o controle pode estar recarregando */ }
  };

  /* O aparelho esta ligado? Enquanto nao estiver, nada de conexao - e a
     tela de execucao devolve o aluno para o mapa sozinha. */
  Vinculo.prototype.aparelhoPronto = function () {
    return this.faseDoAparelho() === "pronto";
  };

  /* Em que ponto da ligacao o aparelho esta: desligado, armado (luzes
     acesas depois do primeiro toque), logo/aeronave/carregando (a abertura)
     ou pronto. Controle sem essa maquina conta como pronto. */
  Vinculo.prototype.faseDoAparelho = function () {
    var j = this.janela();
    if (!j) return null;

    try {
      return j.eval("typeof faseControle !== 'undefined' ? faseControle : 'pronto'");
    } catch (e) { return null; }
  };


  return {
    criar: function (ponte, quadro) { return new Vinculo(ponte, quadro); },
  };
})();
