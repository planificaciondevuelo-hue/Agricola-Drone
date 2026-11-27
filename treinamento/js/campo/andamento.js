/* ==========================================================================
   TAREFA EM ANDAMENTO (controle do T50)

   As cores da rota no app de verdade (fotos dele, DJI Agras):
     - VERDE   o que a aeronave ja passou nesta operacao;
     - AMARELO o que ainda falta;
     - CINZA   o que ja tinha sido feito antes de o controle ser desligado
               (a tarefa retomada em outro dia fica "em andamento").

   O progresso fica guardado no navegador, por rota (a mesma rota do mesmo
   talhao). Quando o aparelho liga, o que estava feito vira o "de antes"; no
   Iniciar, a aeronave vai direto para onde parou, sem refazer o cinza.

   Uso (principal.js / operacao.js):
     var a = ANDAMENTO.criar(ponte, "tpd_dji_andamento");
     a.ciclo(faseDoAparelho)        - a cada leitura
     a.cor(i, feitos)               - cor do trecho i da rota
     a.retomar()                    - logo depois de decolar
   ========================================================================== */

window.ANDAMENTO = (function () {
  "use strict";

  var CINZA = "#b9bfc4", VERDE = "#7ed321", AMARELO = "#f2e03c";

  /* ate onde a aeronave foi na rota do campo, e a assinatura da rota */
  var LER_PROGRESSO =
    "(function(){ if (typeof rota==='undefined' || !rota || rota.length < 2 || typeof V==='undefined') return null;" +
    "  var a = rota[0].p, b = rota[rota.length-1].p;" +
    "  var assinatura = [rota.length, Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1])].join('|');" +
    "  var e = V.estado, k = null, corte = null;" +
    "  if (e === 'concluído') k = rota.length;" +
    "  else if (e === 'aplicando') { k = V.i; corte = [drone.position.x, drone.position.z]; }" +
    "  else if (V.retomar && e !== 'em solo') { k = V.retomar.i; corte = V.retomar.p; }" +
    "  return {assinatura: assinatura, k: k, corte: corte, estado: e}; })()";

  function Andamento(ponte, chave) {
    this.ponte = ponte;
    this.chave = chave;
    this.antes = null;        // o que estava feito quando o aparelho ligou
    this.faseAntes = null;
    this.assinatura = "";
    this.kSessao = 0;         // ate onde foi desde que o aparelho ligou
  }

  Andamento.prototype.ler = function () {
    try { return JSON.parse(window.localStorage.getItem(this.chave) || "null"); }
    catch (e) { return null; }
  };

  Andamento.prototype.gravar = function (a) {
    try {
      if (a) window.localStorage.setItem(this.chave, JSON.stringify(a));
      else window.localStorage.removeItem(this.chave);
    } catch (e) { /* sem guardar */ }
  };

  Andamento.prototype.ciclo = function (fase) {
    /* aparelho acabou de ligar: o que estava guardado vira o "de antes" */
    if (fase === "pronto" && this.faseAntes !== "pronto") {
      this.antes = this.ler();
      this.kSessao = 0;
    }
    this.faseAntes = fase;

    var p = this.ponte.ler(LER_PROGRESSO);
    if (!p) return;

    /* rota nova (outro talhao, outra direcao): comeca do zero */
    if (p.assinatura !== this.assinatura) {
      this.assinatura = p.assinatura;
      this.kSessao = 0;
    }

    if (p.estado === "concluído") { this.gravar(null); this.kSessao = 1e9; this.concluida = true; return; }
    if (p.k === null || !p.k) return;

    this.kSessao = Math.max(this.kSessao, p.k);
    var guardado = this.ler();
    if (guardado && guardado.assinatura === p.assinatura && guardado.k > p.k) return;  // nunca volta atras
    this.gravar({ assinatura: p.assinatura, k: p.k, corte: p.corte, quando: Date.now() });
  };

  /* quantos trechos estavam feitos antes de o aparelho ligar, nesta rota */
  Andamento.prototype.kAntes = function () {
    var a = this.antes;
    return a && a.assinatura === this.assinatura ? a.k : 0;
  };

  /* `feitos`: o trecho em curso agora (ou -1 com a aeronave no chao). O
     trecho em curso fica AMARELO: o verde dele e desenhado a parte, so ate
     onde a aeronave chegou (operacao.js, linha parcial). */
  Andamento.prototype.cor = function (i, feitos) {
    if (i < this.kAntes()) return CINZA;
    if (i < this.kSessao && i !== feitos) return VERDE;
    if (feitos >= 0 && i < feitos) return VERDE;
    return AMARELO;
  };

  /* Operacao nova (Iniciar): o verde recomeca. Sem isto, depois de uma
     operacao concluida a rota inteira ja nascia verde na seguinte. */
  Andamento.prototype.novaOperacao = function () {
    this.kSessao = 0;
    this.concluida = false;
  };

  /* Iniciar de uma tarefa em andamento: vai direto para onde parou. */
  Andamento.prototype.retomar = function () {
    var a = this.antes;
    if (!a || !a.k || !a.corte) return false;
    return this.ponte.ler(
      "(function(){ var a = " + JSON.stringify(a) + ";" +
      "  if (typeof rota==='undefined' || rota.length < 2) return false;" +
      "  var p = rota[0].p, q = rota[rota.length-1].p;" +
      "  var s = [rota.length, Math.round(p[0]), Math.round(p[1]), Math.round(q[0]), Math.round(q[1])].join('|');" +
      "  if (s !== a.assinatura || a.k >= rota.length) return false;" +
      "  V.retomar = {p: a.corte, i: a.k}; return true; })()"
    ) === true;
  };

  return {
    criar: function (ponte, chave) { return new Andamento(ponte, chave); },
  };
})();
