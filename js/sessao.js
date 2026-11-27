window.SESSAO = (function () {
  "use strict";

  var CHAVE = "tpd_sessao";
  var CHAVE_PROGRESSO = "tpd_progresso";
  var C = window.TREINAMENTO || {};

  function guardar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  function ler(chave) {
    try {
      var bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      return null;
    }
  }

  function sessaoLocalPorDefecto() {
    var s = ler(CHAVE);
    if (s) return s;

    var todasMarcas = Object.keys(window.MARCAS || { dji: 1, xag: 1 });
    var todosCenarios = (C.cenarios || []).map(function (c) { return c.id; });
    if (!todosCenarios.length) todosCenarios = ["plano", "pomar", "morro", "energia"];

    var nova = {
      codigo: "LOCAL",
      turma: "Treinamento Offline",
      aluno: "Piloto",
      marcas: todasMarcas,
      cenarios: todosCenarios,
      entrouEm: new Date().toISOString(),
      livre: true
    };
    guardar(CHAVE, nova);
    return nova;
  }

  return {
    entrar: function () {
      return { ok: true, sessao: sessaoLocalPorDefecto() };
    },
    atual: function () {
      return sessaoLocalPorDefecto();
    },
    sair: function () {
      try { localStorage.removeItem(CHAVE); } catch (e) {}
    },
    progresso: function () {
      return ler(CHAVE_PROGRESSO) || {};
    },
    salvarProgresso: function (chaveTreino, etapa, dados) {
      var tudo = ler(CHAVE_PROGRESSO) || {};
      if (!tudo[chaveTreino]) tudo[chaveTreino] = {};
      tudo[chaveTreino][etapa] = Object.assign({ em: new Date().toISOString() }, dados || {});
      guardar(CHAVE_PROGRESSO, tudo);
      return tudo;
    },
    exigir: function () {
      return sessaoLocalPorDefecto();
    }
  };
})();