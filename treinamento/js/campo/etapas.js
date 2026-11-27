/* ==========================================================================
   AS ETAPAS, EM CIMA DO CAMPO

   Aqui a camada de treinamento nao FAZ a operacao: ela acompanha o aluno
   fazendo, no campo que ja existe.

   Cada etapa tem:
     titulo     o que se aprende
     instrucao  o que fazer agora, em uma linha
     conferir   lista do que o simulador cobra (cada item vira um visto)
     pronta     quando a etapa esta cumprida
     boletim    o que vai para a nota, lido do estado do campo

   Nenhuma etapa comanda o campo sem o aluno pedir: no maximo abre a tela
   certa quando ele chega ali.
   ========================================================================== */

window.ETAPAS_CAMPO = (function () {
  "use strict";

  function pct(v) { return Math.round((v || 0) * 100); }

  var ETAPAS = {

    /* ------------------------------------------------------ 1. a maquina */
    conhecer: {
      titulo: "Conhecer a aeronave",
      instrucao: "Olhe o T50 de perto: use a vista Drone e gire a câmera em volta dele.",
      porque:
        "Quem não sabe o nome das peças não entende o alarme que aparece na " +
        "tela. Antes de voar, reconheça cada parte e saiba o que ela faz.",
      conferir: function (e) {
        return [
          { texto: "Ver a aeronave na vista Drone", feito: e.vista === "drone" },
          { texto: "Ver a máquina pelos olhos do operador", feito: this.viuOperador || (this.viuOperador = e.vista === "operador") },
          { texto: "Ver a tela do controle", feito: this.viuControle || (this.viuControle = e.vista === "controle") },
        ];
      },
      pronta: function (e, itens) { return itens.every(function (i) { return i.feito; }); },
    },

    /* --------------------------------------------------------- 2. mapear */
    mapear: {
      titulo: "Mapear o campo",
      instrucao: "No painel, toque em Mapear e feche o limite do talhão. Marque os obstáculos que existirem.",
      porque:
        "O drone só trabalha dentro de um limite que alguém desenhou. Limite " +
        "errado é aplicação fora da área — ou dentro da mata do vizinho.",
      preparar: function (ponte) {
        // campo sem mapa: quem desenha o limite nesta etapa é o aluno
        ponte.esquecerMapa();
      },
      conferir: function (e) {
        var m = e.mapa || {};
        return [
          { texto: "Entrar no modo de mapa", feito: this.entrou || (this.entrou = e.tela === "mapa") },
          { texto: "Fechar o limite do talhão", feito: !!m.pronto },
          { texto: "Marcar os obstáculos que existem no campo", feito: (m.obstaculos || 0) > 0 || !!this.semObstaculos },
        ];
      },
      pronta: function (e) { return !!(e.mapa && e.mapa.pronto); },
      boletim: function (e, ponte) {
        var area = ponte.areaHectares();
        return [{
          titulo: "Campo mapeado",
          valor: area.toFixed(2).replace(".", ",") + " ha · " +
                 ((e.mapa && e.mapa.obstaculos) || 0) + " obstáculo(s)",
          bom: area > 0.05,
          texto: "É dentro desse limite que a rota vai nascer. Tudo que ficou de " +
                 "fora não recebe produto; tudo que sobrou vira aplicação fora da área.",
        }];
      },
    },

    /* ----------------------------------------------------- 3. parametros */
    parametros: {
      titulo: "Parâmetros da operação",
      instrucao: "No painel, ajuste faixa, altura, velocidade e volume até as faixas fecharem sem sobra.",
      porque:
        "É aqui que se decide quanto produto vai no chão. Errar um número " +
        "nesta tela custa mais caro que errar o voo inteiro.",
      conferir: function (e) {
        var p = e.parametros || {};
        var m = e.maquina || {};
        var vazao = (p.vazao || 0) * (p.faixa || 0) * (p.vel || 0) * 0.006;
        var cabe = vazao <= (m.vazaoMaxLmin || 16);

        this.ultimaVazao = vazao;
        this.cabe = cabe;

        return [
          { texto: "Abrir o painel de configuração", feito: this.abriu || (this.abriu = e.tela === "painel") },
          { texto: "Vazão exigida dentro do que a bomba entrega (" +
                   vazao.toFixed(1).replace(".", ",") + " de " + (m.vazaoMaxLmin || 16) + " L/min)",
            feito: cabe && vazao > 0 },
          { texto: "Altura entre 2 e 4 m (faixa e deriva dependem dela)",
            feito: p.altura >= 2 && p.altura <= 4 },
        ];
      },
      pronta: function (e, itens) { return itens.every(function (i) { return i.feito; }); },
      boletim: function (e) {
        var p = e.parametros || {};
        var m = e.maquina || {};
        var vazao = (p.vazao || 0) * (p.faixa || 0) * (p.vel || 0) * 0.006;
        return [{
          titulo: "Regulagem escolhida",
          valor: p.vazao + " L/ha · faixa " + p.faixa + " m · " + p.vel + " m/s · " + p.altura + " m",
          bom: vazao <= (m.vazaoMaxLmin || 16),
          texto: "A bomba precisa entregar " + vazao.toFixed(1).replace(".", ",") +
                 " L/min para essa combinação. O limite da máquina é " +
                 (m.vazaoMaxLmin || 16) + " L/min.",
        }];
      },
    },

    /* ------------------------------------------------------- 4. decolar */
    decolar: {
      titulo: "Verificação e decolagem",
      instrucao: "Toque em Iniciar operação, leia a verificação e deslize para decolar.",
      porque:
        "A decolagem é o momento em que o erro vira acidente. Por isso o " +
        "fabricante exige um gesto deliberado — ninguém decola sem querer.",
      conferir: function (e) {
        return [
          { texto: "Passar pela verificação antes de voar",
            feito: this.viuVerificacao || (this.viuVerificacao = e.tela === "verificacao") },
          { texto: "Aeronave no ar", feito: !!(e.voo && e.voo.rodando) },
        ];
      },
      pronta: function (e) { return !!(e.voo && e.voo.rodando); },
    },

    /* ------------------------------------------------------- 5. aplicar */
    aplicar: {
      titulo: "Pulverizar o talhão",
      instrucao: "Acompanhe a operação. Use as vistas e o tempo acelerado; pare se algo sair do lugar.",
      porque:
        "Aqui o treinamento deixa de ser sobre o drone e passa a ser sobre a " +
        "lavoura: o que importa é o que chegou na folha.",
      conferir: function (e) {
        var c = e.cobertura || {};
        return [
          { texto: "Cobrir pelo menos 80% do talhão (está em " + pct(c.pct / 100) + "%)",
            feito: (c.pct || 0) >= 80 },
          { texto: "Sobreposição abaixo de 15% (está em " + Math.round(c.sobrePct || 0) + "%)",
            feito: (c.sobrePct || 0) < 15 },
          { texto: "Não aplicar fora do talhão (" + (c.foraHa || 0).toFixed(2).replace(".", ",") + " ha fora)",
            feito: (c.foraHa || 0) < 0.05 },
        ];
      },
      pronta: function (e) { return (e.cobertura && e.cobertura.pct >= 80); },
      boletim: function (e) {
        var c = e.cobertura || {};
        var v = e.voo || {};
        return [
          {
            titulo: "Cobertura do talhão",
            valor: Math.round(c.pct || 0) + "%",
            bom: (c.pct || 0) >= 90,
            texto: (c.pct || 0) >= 90
              ? "Talhão coberto. É o que se espera de uma operação bem planejada."
              : "Onde ficou sem cor no mapa, a praga continua de pé.",
          },
          {
            titulo: "Sobreposição",
            valor: Math.round(c.sobrePct || 0) + "% da área com dose dobrada",
            bom: (c.sobrePct || 0) < 15,
            texto: (c.sobrePct || 0) < 15
              ? "Faixa bem conduzida: as passadas fecharam sem repassar."
              : "Produto pago duas vezes na mesma planta — e risco de fitotoxidez.",
          },
          {
            titulo: "Aplicação fora do talhão",
            valor: (c.foraHa || 0).toFixed(2).replace(".", ",") + " ha",
            bom: (c.foraHa || 0) < 0.05,
            texto: (c.foraHa || 0) < 0.05
              ? "Nada saiu da área contratada."
              : "Isso é produto na divisa do vizinho — e conta que o cliente não vai pagar.",
          },
          {
            titulo: "Recargas",
            valor: (v.recargas || 0) + " parada(s) · " + Math.round(v.tempo || 0) + " s de operação",
            bom: true,
            texto: "É esse número que fecha o orçamento: quantas cargas o talhão pede e quanto tempo leva no dia.",
          },
        ];
      },
    },
  };

  /* Treino livre: o mesmo campo com o controle, sem tarefa, sem cobranca e
     sem boletim. Nao entra na ORDEM das aulas e nunca se conclui. */
  ETAPAS.livre = {
    titulo: "Treino livre",
    instrucao: "",
    livre: true,
    conferir: function () { return []; },
    pronta: function () { return false; },
  };

  /* Cada etapa guarda marcas proprias (o que o aluno ja viu). Ao entrar de
     novo, elas comecam limpas. */
  function preparar(id) {
    var base = ETAPAS[id];
    if (!base) return null;

    var etapa = Object.create(base);
    etapa.id = id;
    return etapa;
  }

  return {
    /* so as aulas: o treino livre nao e etapa do curso */
    lista: function () {
      return Object.keys(ETAPAS).filter(function (id) { return !ETAPAS[id].livre; });
    },
    criar: preparar,
    titulo: function (id) { return (ETAPAS[id] || {}).titulo || id; },
  };
})();
