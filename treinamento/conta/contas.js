/* INICIO HORAS CERTIFICADO COMPARTILHADO */
/* Contabilidade de origem das horas. A mesma fonte é incorporada em contas.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HORAS_CERTIFICADO = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const n = v => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
  const copia = v => JSON.parse(JSON.stringify(v));
  const soma = obj => Object.values(obj || {}).reduce((a, b) => a + n(b), 0);
  // Acesso vitalício: esses minutos não gastam saldo, ficam fora desta conta
  // de origem (minutosVitalicio/porDroneVitalicio) e valem como pagos no certificado.
  const treinado = c => Math.max(0, n(c.minutosTreinados) - n(c.minutosVitalicio));
  function porDroneSaldo(c) {
    const v = c.porDroneVitalicio || {}, r = {};
    for (const [drone, minutos] of Object.entries(c.porDrone || {})) r[drone] = Math.max(0, n(minutos) - n(v[drone]));
    return r;
  }
  function juntar(a, b) {
    const r = { ...(a || {}) };
    for (const [drone, minutos] of Object.entries(b || {})) r[drone] = n(r[drone]) + n(minutos);
    return r;
  }
  function origens(c) {
    const eventos = [];
    for (const p of c.compras || []) if (!p.mapa && p.pacote !== 'escola' && n(p.horas)) eventos.push({ em: p.em, pago: n(p.horas) * 60 });
    for (const p of c.patrociniosEscola || []) eventos.push({ em: p.resgatadoEm, pago: p.minutos == null ? 900 : n(p.minutos) });
    if (c.testeGratisEm) eventos.push({ em: c.testeGratisEm, gratis: n(c.testeGratisMin == null ? 10 : c.testeGratisMin) });
    if (c.bonusAvaliacaoEm) eventos.push({ em: c.bonusAvaliacaoEm, gratis: n(c.bonusAvaliacaoMin == null ? 10 : c.bonusAvaliacaoMin) });
    for (const a of c.ajustes || []) eventos.push({ em: a.em, gratis: n(a.minutos), retirar: n(-a.minutos) });
    return { eventos, pago: eventos.reduce((s, e) => s + (e.pago || 0), 0), gratis: eventos.reduce((s, e) => s + (e.gratis || 0), 0), retirado: eventos.reduce((s, e) => s + (e.retirar || 0), 0) };
  }
  function vazio(c, o) {
    return { versao: 1, saldoPagoMin: 0, saldoGratisMin: 0, minutosPagos: 0, porDronePago: {},
      pagoRecebidoMin: o.pago, gratisRecebidoMin: o.gratis, retiradoMin: o.retirado,
      treinadoAteMin: treinado(c), porDroneAte: porDroneSaldo(c) };
  }
  function consumir(e, minutos, drone) {
    const gratis = Math.min(e.saldoGratisMin, minutos);
    const pago = Math.min(e.saldoPagoMin, Math.max(0, minutos - gratis));
    e.saldoGratisMin -= gratis; e.saldoPagoMin -= pago;
    if (drone && pago) { e.minutosPagos += pago; e.porDronePago[drone] = (e.porDronePago[drone] || 0) + pago; }
    return pago;
  }
  function ajustarSaldo(e, saldo) {
    const diferenca = n(saldo) - e.saldoGratisMin - e.saldoPagoMin;
    if (diferenca > 0) e.saldoGratisMin += diferenca; // Crédito sem origem comprovada é gratuito.
    if (diferenca < 0) consumir(e, -diferenca);
  }
  function reconstruir(c, treinos) {
    const o = origens(c), e = vazio(c, o), total = treinado(c);
    const desconhecido = Math.max(0, n(c.saldoMin) + total + o.retirado - o.pago - o.gratis);
    if (o.pago === 0) { e.saldoGratisMin = n(c.saldoMin); return e; }
    const doSaldo = t => Math.max(0, n(t.minutos) - n(t.minutosVitalicio));
    if (Array.isArray(treinos) && treinos.reduce((s, t) => s + doSaldo(t), 0) === total && o.eventos.every(x => Number.isFinite(Date.parse(x.em))) && treinos.filter(t => doSaldo(t) > 0).every(t => Number.isFinite(Date.parse(t.fim)))) {
      const eventos = o.eventos.map(x => ({ ...x, t: Date.parse(x.em), ordem: 0 }));
      if (desconhecido) eventos.push({ t: -1, gratis: desconhecido, ordem: 0 });
      for (const t of treinos) if (doSaldo(t) > 0) {
        if (o.eventos.some(x => Date.parse(x.em) > Date.parse(t.inicio) && Date.parse(x.em) < Date.parse(t.fim))) e.legadoConservador = true;
        eventos.push({ t: Date.parse(t.fim), treino: doSaldo(t), drone: t.drone || 'Treinamento anterior', ordem: 1 });
      }
      eventos.sort((a, b) => a.t - b.t || a.ordem - b.ordem);
      for (const x of eventos) {
        e.saldoPagoMin += x.pago || 0; e.saldoGratisMin += x.gratis || 0;
        if (x.retirar) consumir(e, x.retirar);
        if (x.treino) consumir(e, x.treino, x.drone);
      }
    } else {
      // Sem cronologia completa, só conta a parcela comprovadamente não gratuita.
      e.minutosPagos = Math.min(o.pago, Math.max(0, total - o.gratis - desconhecido));
      if (e.minutosPagos) e.porDronePago['Treinamento anterior (origem não detalhada)'] = e.minutosPagos;
      e.saldoPagoMin = Math.max(0, o.pago - e.minutosPagos - o.retirado);
      e.saldoGratisMin = Math.max(0, o.gratis + desconhecido - (total - e.minutosPagos));
      e.legadoConservador = total > 0;
    }
    ajustarSaldo(e, c.saldoMin);
    return e;
  }
  function estado(c) {
    const o = origens(c), salvo = c.horasCertificado, total = treinado(c);
    if (!salvo || salvo.versao !== 1 || salvo.treinadoAteMin > total || o.pago < salvo.pagoRecebidoMin || o.gratis < salvo.gratisRecebidoMin || o.retirado < salvo.retiradoMin) return reconstruir(c);
    const e = copia(salvo);
    e.saldoPagoMin += o.pago - e.pagoRecebidoMin; e.saldoGratisMin += o.gratis - e.gratisRecebidoMin;
    consumir(e, o.retirado - e.retiradoMin);
    e.pagoRecebidoMin = o.pago; e.gratisRecebidoMin = o.gratis; e.retiradoMin = o.retirado;
    // Compatibilidade com minutos gravados por uma revisão antiga durante a publicação.
    let falta = total - e.treinadoAteMin;
    const porDrone = porDroneSaldo(c);
    for (const [drone, minutos] of Object.entries(porDrone)) {
      const parte = Math.min(falta, Math.max(0, n(minutos) - n(e.porDroneAte[drone])));
      if (parte) { consumir(e, parte, drone); falta -= parte; }
    }
    if (falta) consumir(e, falta, 'Treinamento anterior (origem não detalhada)');
    e.treinadoAteMin = total; e.porDroneAte = copia(porDrone);
    ajustarSaldo(e, c.saldoMin);
    return e;
  }
  // soPago (XAG, 11/10/2026): o teste gratis de cada marca e separado; depois do teste do XAG
  // o minuto do XAG gasta so hora paga, nunca o gratis do DJI que esta no mesmo saldo.
  function registrar(c, drone, soPago) {
    const e = estado(c);
    let pago;
    if (soPago) {
      pago = Math.min(1, e.saldoPagoMin); e.saldoPagoMin -= pago;
      if (drone && pago) { e.minutosPagos += pago; e.porDronePago[drone] = (e.porDronePago[drone] || 0) + pago; }
    } else pago = consumir(e, 1, drone);
    e.treinadoAteMin += 1; e.porDroneAte[drone] = n(e.porDroneAte[drone]) + 1;
    return { estado: e, pago, gratis: 1 - pago };
  }
  function resumo(c) {
    const e = estado(c), vitalicio = n(c.minutosVitalicio), total = treinado(c) + vitalicio, autorizado = c.autorizaGratisCertificado === true;
    const minutosPagos = Math.min(treinado(c), e.minutosPagos) + vitalicio;
    const porDrone = autorizado ? c.porDrone || {} : juntar(e.porDronePago, c.porDroneVitalicio);
    return { minutos: autorizado ? total : minutosPagos, minutosPagos, minutosGratis: total - minutosPagos,
      autorizado, saldoPagoMin: e.saldoPagoMin, saldoGratisMin: e.saldoGratisMin, legadoConservador: !!e.legadoConservador,
      porDrone: Object.entries(porDrone).filter(([, m]) => m > 0).map(([drone, minutos]) => ({ drone, minutos })).sort((a, b) => b.minutos - a.minutos) };
  }
  function ler(doc) {
    if (typeof doc.data === 'function') return doc.data();
    return Object.fromEntries(['saldoMin', 'minutosTreinados', 'porDrone', 'compras', 'patrociniosEscola', 'testeGratisEm', 'testeGratisMin', 'bonusAvaliacaoEm', 'bonusAvaliacaoMin', 'ajustes', 'horasCertificado', 'autorizaGratisCertificado', 'minutosVitalicio', 'porDroneVitalicio'].map(k => [k, doc.get(k)]));
  }
  /* Minimo para certificado valido: 15 h; aluno de instituto de ensino precisa so das
     horas que recebeu da escola (codigo antigo = 15 h; vaga = o que o administrador deu). */
  function minimoCertificado(c) {
    const escola = (c.patrociniosEscola || []).reduce((s, p) => s + (p.minutos == null ? 900 : n(p.minutos)), 0);
    return escola > 0 ? Math.min(900, escola) : 900;
  }
  return { origens, reconstruir, estado, registrar, resumo, ler, minimoCertificado };
});

/* FIM HORAS CERTIFICADO COMPARTILHADO */
/* ==========================================================================
   CONTAS DO ALUNO

   Cadastro, login, saldo de horas, controles, horas treinadas e certificado.
   As paginas so falam com window.CONTAS. Por baixo ha dois "motores",
   escolhidos em conta/config.js:

   - demonstracao: tudo no navegador (localStorage). Compra sem cobrar.
   - firebase:     contas no Firebase; saldo, minutos e certificados so o
                   servidor grava (servidor/funcoes); compra pelo Mercado Pago.

   Quase tudo devolve Promise. Unidade interna: MINUTOS (inteiros).
   ========================================================================== */

(function () {
  "use strict";

  var HC = window.HORAS_CERTIFICADO;
  var CFG = window.TREINO_CONFIG || {};
  var MODO = CFG.modo === "firebase" ? "firebase" : "demonstracao";
  /* Para onde o link de confirmacao do e-mail volta (este arquivo mora em conta/). */
  var PAGINA_INICIO = new URL("inicio.html", (document.currentScript && document.currentScript.src) || location.href).href;

  /* Teste gratis: o servidor guarda so um resumo destes sinais, para o
     administrador ver contas criadas no mesmo navegador (termos, Privacidade). */
  function sinaisDoAparelho() {
    var marca = null;
    try {
      marca = localStorage.getItem("tpd_aparelho");
      if (!/^[a-f0-9]{32}$/.test(marca || "")) {
        var b = new Uint8Array(16); crypto.getRandomValues(b);
        marca = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
        localStorage.setItem("tpd_aparelho", marca);
      }
    } catch (e) { marca = null; }
    var s = window.screen || {}, fuso = "";
    try { fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var tela = [s.width, s.height, s.colorDepth, window.devicePixelRatio, navigator.hardwareConcurrency, navigator.deviceMemory, fuso, navigator.language].join("|");
    return { aparelho: marca, tela: tela.slice(0, 160) };
  }
  function lembrarLinkEnviado(email) {
    try { localStorage.setItem("tpd_link_email", JSON.stringify({ email: email, em: Date.now() })); } catch (e) {}
  }
  function linkJaEnviado(email) {
    try { var l = JSON.parse(localStorage.getItem("tpd_link_email") || "null"); return !!(l && l.email === email); } catch (e) { return false; }
  }

  /* Os mesmos valores do servidor (servidor/funcoes/catalogo.js).
     Quem cobra e o servidor: mudar so aqui nao muda o preco. */
  /* 24/10/2026 (Eduardo): R$ 10 por hora para todos (hoje cedo R$ 5; antes R$ 55). Antes: 30 min R$ 30, 1 h R$ 55, 10 h R$ 500, 15 h R$ 645. */
  var PACOTES = [
    { id: "m30",  horas: 0.5, preco: 5 },
    { id: "h1",   horas: 1,   preco: 10 },
    { id: "h10",  horas: 10,  preco: 100 },
    { id: "h15",  horas: 15,  preco: 150 },
  ];

  /* Liberacao do certificado (24/10/2026): baixar e confirmar na consulta publica so depois de pagar. R$ 800;
     R$ 200 com horas de instituicao de ensino (so em reais); US$ 150 em dolar. Igual ao CERTIFICADO de
     servidor/funcoes/catalogo.js (quem cobra e o servidor). */
  var CERTIFICADO = { brl: 800, brlInstituicao: 200, usd: 150 };

  function pacotePersonalizado(horas) {
    if (typeof horas !== "number" || !Number.isFinite(horas) || horas < 1) return null;
    var minutos = Math.round(horas * 60);
    if (!Number.isSafeInteger(minutos) || Math.abs(horas * 60 - minutos) > 0.000001) return null;
    var porHora = 10;   // 24/10/2026: preco unico (antes R$ 55 / 50 / 43 por faixa)
    var centavos = Math.round(horas * porHora * 100);
    if (!Number.isSafeInteger(centavos)) return null;
    return { id: "personalizado", horas: horas, preco: centavos / 100 };
  }

  /* Boleto custa R$ 3,49 fixos por venda ao vendedor: em compra pequena come
     boa parte do valor. So e oferecido a partir deste preco. Mantenha IGUAL
     ao servidor/funcoes/catalogo.js (e la que a regra vale de verdade). */
  var BOLETO_A_PARTIR_DE = 100;

  var DRONES = { t50: "DJI Agras T50", t25: "DJI Agras T25", p60: "XAG P60", p150: "XAG P150", p150max: "XAG P150 Max", p100pro: "XAG P100 Pro", j100: "EAVision J100",
    t100: "DJI Agras T100", t10: "DJI Agras T10", j150: "EAVision J150",   // 13/10/2026: novos, so administrador
    c31: "Ceres Air C31 Black Betty",   // 13/10/2026: so administrador
    t70p: "DJI Agras T70P",   // 26/10/2026: so administrador
    air2s: "DJI Air 2S" };   // 13/10/2026: Mapeamento / voo livre, so administrador
  var DRONES_SO_ADMIN = ["j100", "j150", "p150", "p150max", "p100pro", "t100", "c31", "t70p"];   // t70p: 26/10/2026; p100pro: 13/10/2026; air2s liberado para todos em 15/10/2026; t10 em 23/10/2026

  /* Loja de mapas. O preco sai da AREA do mapa: precoPorHectare por hectare.
     Cada vendedor pode ter ate limiteHectares a venda, somando os mapas dele
     (logo, nenhum mapa passa disso). Mantenha IGUAL ao
     servidor/funcoes/catalogo.js: quem cobra de verdade e o servidor. */
  var MAPAS = {
    precoPorHectare: 30,
    limiteHectares: 100,
  };

  /* Como cada drone aparece para o simulador (js/marcas.js e js/config.js). */
  var SIMULADOR = {
    t50: { marca: "dji", modelo: "t50" },
    t25: { marca: "dji", modelo: "t25" },
    p60: { marca: "xag", modelo: "p60" },
    p150: { marca: "xag", modelo: "p150" },   // 21/11/2026: so administrador
    p150max: { marca: "xag", modelo: "p150max" },
    p100pro: { marca: "xag", modelo: "p100pro" },
    j100: { marca: "eavision", modelo: "j100" },
    j150: { marca: "eavision", modelo: "j150" },
    t100: { marca: "dji", modelo: "t100" },
    t10: { marca: "dji", modelo: "t10" },
    c31: { marca: "dji", modelo: "c31" },   // Ceres Air com o app do T50 (13/10/2026)
    t70p: { marca: "dji", modelo: "t70p" },   // 26/10/2026, so administrador
    air2s: { marca: "dji", modelo: "air2s" },   // RC-N1 + celular, voo livre (13/10/2026)
  };
  var CENARIOS_SIMULADOR = ["plano", "mediano", "montanhoso"];

  var ESTADOS = [
    ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"],
    ["BA", "Bahia"], ["CE", "Ceará"], ["DF", "Distrito Federal"],
    ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"],
    ["MT", "Mato Grosso"], ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"],
    ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"], ["PE", "Pernambuco"],
    ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
    ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"],
    ["SC", "Santa Catarina"], ["SP", "São Paulo"], ["SE", "Sergipe"],
    ["TO", "Tocantins"],
  ];

  var PAISES = [
    ['BR', 'Brasil'], ['US', 'Estados Unidos'], ['CA', 'Canadá'],
    ['GB', 'Reino Unido'], ['IE', 'Irlanda'], ['AU', 'Austrália'],
    ['NZ', 'Nova Zelândia'], ['ZA', 'África do Sul'], ['IN', 'Índia'],
    ['ES', 'Espanha'], ['MX', 'México'], ['AR', 'Argentina'], ['CL', 'Chile'],
    ['CO', 'Colômbia'], ['PE', 'Peru'], ['UY', 'Uruguai'], ['PY', 'Paraguai'],
    ['BO', 'Bolívia'], ['EC', 'Equador'], ['VE', 'Venezuela'],
    ['CR', 'Costa Rica'], ['PA', 'Panamá'], ['GT', 'Guatemala'],
    ['HN', 'Honduras'], ['SV', 'El Salvador'], ['NI', 'Nicarágua'],
    ['CU', 'Cuba'], ['DO', 'República Dominicana'], ['OUTRO', 'Outro'],
  ];

  /* Todos os países (ISO 3166-1 e Kosovo): [código, português, inglês, espanhol].
     "Outro" no cadastro pede o nome do país e só aceita um que exista; quem
     ficou com "Outro" antes recebe o pedido ao entrar (Eduardo, 07/10/2026).
     Nomes tirados do ICU (Intl.DisplayNames). */
  var PAISES_TODOS = "AF|Afeganistão|Afghanistan|Afganistán;ZA|África do Sul|South Africa|Sudáfrica;AL|Albânia|Albania|Albania;DE|Alemanha|Germany|Alemania;AD|Andorra|Andorra|Andorra;AO|Angola|Angola|Angola;AI|Anguila|Anguilla|Anguila;AQ|Antártida|Antarctica|Antártida;AG|Antígua e Barbuda|Antigua & Barbuda|Antigua y Barbuda;SA|Arábia Saudita|Saudi Arabia|Arabia Saudí;DZ|Argélia|Algeria|Argelia;AR|Argentina|Argentina|Argentina;AM|Armênia|Armenia|Armenia;AW|Aruba|Aruba|Aruba;AU|Austrália|Australia|Australia;AT|Áustria|Austria|Austria;AZ|Azerbaijão|Azerbaijan|Azerbaiyán;BS|Bahamas|Bahamas|Bahamas;BD|Bangladesh|Bangladesh|Bangladés;BB|Barbados|Barbados|Barbados;BH|Barein|Bahrain|Baréin;BE|Bélgica|Belgium|Bélgica;BZ|Belize|Belize|Belice;BJ|Benin|Benin|Benín;BM|Bermudas|Bermuda|Bermudas;BY|Bielorrússia|Belarus|Bielorrusia;BO|Bolívia|Bolivia|Bolivia;BA|Bósnia e Herzegovina|Bosnia & Herzegovina|Bosnia y Herzegovina;BW|Botsuana|Botswana|Botsuana;BR|Brasil|Brazil|Brasil;BN|Brunei|Brunei|Brunéi;BG|Bulgária|Bulgaria|Bulgaria;BF|Burquina Faso|Burkina Faso|Burkina Faso;BI|Burundi|Burundi|Burundi;BT|Butão|Bhutan|Bután;CV|Cabo Verde|Cape Verde|Cabo Verde;CM|Camarões|Cameroon|Camerún;KH|Camboja|Cambodia|Camboya;CA|Canadá|Canada|Canadá;QA|Catar|Qatar|Catar;KZ|Cazaquistão|Kazakhstan|Kazajistán;TD|Chade|Chad|Chad;CL|Chile|Chile|Chile;CN|China|China|China;CY|Chipre|Cyprus|Chipre;VA|Cidade do Vaticano|Vatican City|Ciudad del Vaticano;CO|Colômbia|Colombia|Colombia;KM|Comores|Comoros|Comoras;CD|Congo - Kinshasa|Congo - Kinshasa|República Democrática del Congo;KP|Coreia do Norte|North Korea|Corea del Norte;KR|Coreia do Sul|South Korea|Corea del Sur;CI|Costa do Marfim|Côte d’Ivoire|Côte d’Ivoire;CR|Costa Rica|Costa Rica|Costa Rica;HR|Croácia|Croatia|Croacia;CU|Cuba|Cuba|Cuba;CW|Curaçao|Curaçao|Curazao;DK|Dinamarca|Denmark|Dinamarca;DJ|Djibuti|Djibouti|Yibuti;DM|Dominica|Dominica|Dominica;EG|Egito|Egypt|Egipto;SV|El Salvador|El Salvador|El Salvador;AE|Emirados Árabes Unidos|United Arab Emirates|Emiratos Árabes Unidos;EC|Equador|Ecuador|Ecuador;ER|Eritreia|Eritrea|Eritrea;SK|Eslováquia|Slovakia|Eslovaquia;SI|Eslovênia|Slovenia|Eslovenia;ES|Espanha|Spain|España;SZ|Essuatíni|Eswatini|Esuatini;US|Estados Unidos|United States|Estados Unidos;EE|Estônia|Estonia|Estonia;ET|Etiópia|Ethiopia|Etiopía;FJ|Fiji|Fiji|Fiyi;PH|Filipinas|Philippines|Filipinas;FI|Finlândia|Finland|Finlandia;FR|França|France|Francia;GA|Gabão|Gabon|Gabón;GM|Gâmbia|Gambia|Gambia;GH|Gana|Ghana|Ghana;GE|Geórgia|Georgia|Georgia;GI|Gibraltar|Gibraltar|Gibraltar;GD|Granada|Grenada|Granada;GR|Grécia|Greece|Grecia;GL|Groenlândia|Greenland|Groenlandia;GP|Guadalupe|Guadeloupe|Guadalupe;GU|Guam|Guam|Guam;GT|Guatemala|Guatemala|Guatemala;GG|Guernsey|Guernsey|Guernesey;GY|Guiana|Guyana|Guyana;GF|Guiana Francesa|French Guiana|Guayana Francesa;GN|Guiné|Guinea|Guinea;GQ|Guiné Equatorial|Equatorial Guinea|Guinea Ecuatorial;GW|Guiné-Bissau|Guinea-Bissau|Guinea-Bisáu;HT|Haiti|Haiti|Haití;HN|Honduras|Honduras|Honduras;HK|Hong Kong, RAE da China|Hong Kong SAR China|RAE de Hong Kong (China);HU|Hungria|Hungary|Hungría;YE|Iêmen|Yemen|Yemen;BV|Ilha Bouvet|Bouvet Island|Isla Bouvet;CX|Ilha Christmas|Christmas Island|Isla de Navidad;IM|Ilha de Man|Isle of Man|Isla de Man;NF|Ilha Norfolk|Norfolk Island|Isla Norfolk;AX|Ilhas Aland|Åland Islands|Islas Aland;KY|Ilhas Cayman|Cayman Islands|Islas Caimán;CC|Ilhas Cocos (Keeling)|Cocos (Keeling) Islands|Islas Cocos;CK|Ilhas Cook|Cook Islands|Islas Cook;FO|Ilhas Faroé|Faroe Islands|Islas Feroe;GS|Ilhas Geórgia do Sul e Sandwich do Sul|South Georgia & South Sandwich Islands|Islas Georgia del Sur y Sandwich del Sur;HM|Ilhas Heard e McDonald|Heard & McDonald Islands|Islas Heard y McDonald;FK|Ilhas Malvinas|Falkland Islands|Islas Malvinas;MP|Ilhas Marianas do Norte|Northern Mariana Islands|Islas Marianas del Norte;MH|Ilhas Marshall|Marshall Islands|Islas Marshall;UM|Ilhas Menores Distantes dos EUA|U.S. Outlying Islands|Islas menores alejadas de EE. UU.;PN|Ilhas Pitcairn|Pitcairn Islands|Islas Pitcairn;SB|Ilhas Salomão|Solomon Islands|Islas Salomón;TC|Ilhas Turcas e Caicos|Turks & Caicos Islands|Islas Turcas y Caicos;VI|Ilhas Virgens Americanas|U.S. Virgin Islands|Islas Vírgenes de EE. UU.;VG|Ilhas Virgens Britânicas|British Virgin Islands|Islas Vírgenes Británicas;IN|Índia|India|India;ID|Indonésia|Indonesia|Indonesia;IR|Irã|Iran|Irán;IQ|Iraque|Iraq|Irak;IE|Irlanda|Ireland|Irlanda;IS|Islândia|Iceland|Islandia;IL|Israel|Israel|Israel;IT|Itália|Italy|Italia;JM|Jamaica|Jamaica|Jamaica;JP|Japão|Japan|Japón;JE|Jersey|Jersey|Jersey;JO|Jordânia|Jordan|Jordania;XK|Kosovo|Kosovo|Kosovo;KW|Kuwait|Kuwait|Kuwait;LA|Laos|Laos|Laos;LS|Lesoto|Lesotho|Lesoto;LV|Letônia|Latvia|Letonia;LB|Líbano|Lebanon|Líbano;LR|Libéria|Liberia|Liberia;LY|Líbia|Libya|Libia;LI|Liechtenstein|Liechtenstein|Liechtenstein;LT|Lituânia|Lithuania|Lituania;LU|Luxemburgo|Luxembourg|Luxemburgo;MO|Macau, RAE da China|Macao SAR China|RAE de Macao (China);MK|Macedônia do Norte|North Macedonia|Macedonia del Norte;MG|Madagascar|Madagascar|Madagascar;MY|Malásia|Malaysia|Malasia;MW|Malaui|Malawi|Malaui;MV|Maldivas|Maldives|Maldivas;ML|Mali|Mali|Mali;MT|Malta|Malta|Malta;MA|Marrocos|Morocco|Marruecos;MQ|Martinica|Martinique|Martinica;MU|Maurício|Mauritius|Mauricio;MR|Mauritânia|Mauritania|Mauritania;YT|Mayotte|Mayotte|Mayotte;MX|México|Mexico|México;MM|Mianmar (Birmânia)|Myanmar (Burma)|Myanmar (Birmania);FM|Micronésia|Micronesia|Micronesia;MZ|Moçambique|Mozambique|Mozambique;MD|Moldávia|Moldova|Moldavia;MC|Mônaco|Monaco|Mónaco;MN|Mongólia|Mongolia|Mongolia;ME|Montenegro|Montenegro|Montenegro;MS|Montserrat|Montserrat|Montserrat;NA|Namíbia|Namibia|Namibia;NR|Nauru|Nauru|Nauru;NP|Nepal|Nepal|Nepal;NI|Nicarágua|Nicaragua|Nicaragua;NE|Níger|Niger|Níger;NG|Nigéria|Nigeria|Nigeria;NU|Niue|Niue|Niue;NO|Noruega|Norway|Noruega;NC|Nova Caledônia|New Caledonia|Nueva Caledonia;NZ|Nova Zelândia|New Zealand|Nueva Zelanda;OM|Omã|Oman|Omán;NL|Países Baixos|Netherlands|Países Bajos;BQ|Países Baixos Caribenhos|Caribbean Netherlands|Caribe neerlandés;PW|Palau|Palau|Palaos;PA|Panamá|Panama|Panamá;PG|Papua-Nova Guiné|Papua New Guinea|Papúa Nueva Guinea;PK|Paquistão|Pakistan|Pakistán;PY|Paraguai|Paraguay|Paraguay;PE|Peru|Peru|Perú;PF|Polinésia Francesa|French Polynesia|Polinesia Francesa;PL|Polônia|Poland|Polonia;PR|Porto Rico|Puerto Rico|Puerto Rico;PT|Portugal|Portugal|Portugal;KE|Quênia|Kenya|Kenia;KG|Quirguistão|Kyrgyzstan|Kirguistán;KI|Quiribati|Kiribati|Kiribati;GB|Reino Unido|United Kingdom|Reino Unido;CF|República Centro-Africana|Central African Republic|República Centroafricana;CG|República do Congo|Congo - Brazzaville|Congo;DO|República Dominicana|Dominican Republic|República Dominicana;RE|Reunião|Réunion|Reunión;RO|Romênia|Romania|Rumanía;RW|Ruanda|Rwanda|Ruanda;RU|Rússia|Russia|Rusia;EH|Saara Ocidental|Western Sahara|Sáhara Occidental;WS|Samoa|Samoa|Samoa;AS|Samoa Americana|American Samoa|Samoa Americana;SM|San Marino|San Marino|San Marino;SH|Santa Helena|St. Helena|Santa Elena;LC|Santa Lúcia|St. Lucia|Santa Lucía;BL|São Bartolomeu|St. Barthélemy|San Bartolomé;KN|São Cristóvão e Névis|St. Kitts & Nevis|San Cristóbal y Nieves;MF|São Martinho|St. Martin|San Martín;PM|São Pedro e Miquelão|St. Pierre & Miquelon|San Pedro y Miquelón;ST|São Tomé e Príncipe|São Tomé & Príncipe|Santo Tomé y Príncipe;VC|São Vicente e Granadinas|St. Vincent & Grenadines|San Vicente y las Granadinas;SC|Seicheles|Seychelles|Seychelles;SN|Senegal|Senegal|Senegal;SL|Serra Leoa|Sierra Leone|Sierra Leona;RS|Sérvia|Serbia|Serbia;SG|Singapura|Singapore|Singapur;SX|Sint Maarten|Sint Maarten|Sint Maarten;SY|Síria|Syria|Siria;SO|Somália|Somalia|Somalia;LK|Sri Lanka|Sri Lanka|Sri Lanka;SD|Sudão|Sudan|Sudán;SS|Sudão do Sul|South Sudan|Sudán del Sur;SE|Suécia|Sweden|Suecia;CH|Suíça|Switzerland|Suiza;SR|Suriname|Suriname|Surinam;SJ|Svalbard e Jan Mayen|Svalbard & Jan Mayen|Svalbard y Jan Mayen;TJ|Tadjiquistão|Tajikistan|Tayikistán;TH|Tailândia|Thailand|Tailandia;TW|Taiwan|Taiwan|Taiwán;TZ|Tanzânia|Tanzania|Tanzania;CZ|Tchéquia|Czechia|Chequia;IO|Território Britânico do Oceano Índico|British Indian Ocean Territory|Territorio Británico del Océano Índico;TF|Territórios Franceses do Sul|French Southern Territories|Territorios Australes Franceses;PS|Territórios palestinos|Palestinian Territories|Territorios Palestinos;TL|Timor-Leste|Timor-Leste|Timor-Leste;TG|Togo|Togo|Togo;TK|Tokelau|Tokelau|Tokelau;TO|Tonga|Tonga|Tonga;TT|Trinidad e Tobago|Trinidad & Tobago|Trinidad y Tobago;TN|Tunísia|Tunisia|Túnez;TM|Turcomenistão|Turkmenistan|Turkmenistán;TR|Turquia|Türkiye|Turquía;TV|Tuvalu|Tuvalu|Tuvalu;UA|Ucrânia|Ukraine|Ucrania;UG|Uganda|Uganda|Uganda;UY|Uruguai|Uruguay|Uruguay;UZ|Uzbequistão|Uzbekistan|Uzbekistán;VU|Vanuatu|Vanuatu|Vanuatu;VE|Venezuela|Venezuela|Venezuela;VN|Vietnã|Vietnam|Vietnam;WF|Wallis e Futuna|Wallis & Futuna|Wallis y Futuna;ZM|Zâmbia|Zambia|Zambia;ZW|Zimbábue|Zimbabwe|Zimbabue".split(";").map(function (l) { return l.split("|"); });
  function chaveDeNome(t) {
    return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/&/g, " e ").replace(/[^a-z0-9]+/g, " ").trim();
  }
  var APELIDOS_PAIS = { "eua": "US", "usa": "US", "estados unidos da america": "US", "united states of america": "US",
    "holanda": "NL", "inglaterra": "GB", "escocia": "GB", "pais de gales": "GB", "irlanda do norte": "GB",
    "gra bretanha": "GB", "uk": "GB", "russia": "RU", "tchequia": "CZ", "republica tcheca": "CZ",
    "birmania": "MM", "suazilandia": "SZ", "macedonia": "MK", "palestina": "PS", "vaticano": "VA" };
  /* nome digitado (qualquer um dos três idiomas, sem ligar para acento) -> código; "" se não existe */
  function codigoDoPais(texto) {
    var t = chaveDeNome(texto);
    if (!t) return "";
    if (APELIDOS_PAIS[t]) return APELIDOS_PAIS[t];
    var achados = PAISES_TODOS.filter(function (p) { return p.slice(1).some(function (n) { return chaveDeNome(n) === t; }); });
    return achados.length === 1 ? achados[0][0] : "";
  }
  function nomeDoPais(codigo) {
    var p = PAISES_TODOS.find(function (x) { return x[0] === codigo; });
    return p ? p[1] : String(codigo || "");
  }
  /* coluna do nome na lista: 1 português, 2 inglês, 3 espanhol (idioma da página) */
  function colunaDoIdioma() {
    var l = String((typeof document !== "undefined" && document.documentElement.lang) || "pt").toLowerCase();
    return /^en/.test(l) ? 2 : /^es/.test(l) ? 3 : 1;
  }
  function paisExiste(codigo) { return PAISES_TODOS.some(function (x) { return x[0] === codigo; }); }

  /* Fora do Brasil: preço em dólar, cartão internacional, pela Stripe (07/10/2026).
     Igual ao PRECO_DOLAR de servidor/funcoes/stripe.js (é lá que vale a cobrança). */
  var PRECO_DOLAR = { m30: 2, h1: 4, h10: 30, h15: 40 };   // 24/10/2026 (Eduardo): US$ 4 por hora (R$ 10 por hora); antes 9 / 15 / 120 / 165

  function localidade(c) {
    var pais = c.pais || 'BR'; // Contas anteriores tinham somente estado brasileiro.
    if (pais === 'BR') return nomeDoEstado(c.estado) + ', Brasil';
    return pais === 'OUTRO' ? 'Outro país' : nomeDoPais(pais);
  }

  /* ------------------------------------------------------------ utilidades */

  function falha(msg) { return Promise.reject(new Error(msg)); }
  function copia(o) { return JSON.parse(JSON.stringify(o)); }
  function normalizarEmail(email) { return String(email || "").trim().toLowerCase(); }
  function limparNome(nome) { return String(nome || "").trim().replace(/\s+/g, " "); }
  function normalizarCodigo(codigo) { return String(codigo || "").toUpperCase().replace(/[\s-]/g, ""); }

  /* Lista de escolas do CAAR so para conta do Brasil (10/10/2026). Conta antiga
     sem pais conta como BR, igual ao servidor (podeVerEscolas). */
  function contaDoBrasil(c) { return !!c && String(c.pais || "BR").trim().toUpperCase() === "BR"; }
  function recusaEscolas(codigo) {
    var e = new Error(codigo === "pais" ? "A lista de escolas do CAAR é só para contas do Brasil." : "Entre na sua conta para ver as escolas.");
    e.codigo = codigo;
    return e;
  }

  /* Escola aprovada pelo administrador (servidor/funcoes/escolas.js, escolaAprovada):
     quem ja tinha comprado horas de escola antes da regra continua liberada. */
  function escolaAprovada(c) {
    if (typeof (c && c.escolaAprovada) === "boolean") return c.escolaAprovada;
    return ((c && c.compras) || []).some(function (x) { return x && x.pacote === "escola"; });
  }

  /* Horas de escola pagas (servidor/funcoes/vitrine-escolas.js, horasCompradas). */
  function horasEscola(c) {
    return ((c && c.compras) || []).reduce(function (t, x) { return t + (x && x.pacote === "escola" && Number(x.horas) > 0 ? Number(x.horas) : 0); }, 0);
  }

  /* Dados da escola para a lista do CAAR: mesmas regras de servidor/funcoes/vitrine-escolas.js
     (limpar). CNPJ numerico ou alfanumerico (Receita, julho de 2026): letra vale ASCII - 48. */
  function cnpjLimpo(valor) {
    var t = String(valor || "").toUpperCase().replace(/[.\/\-\s]/g, "");
    function dv(base, pesos) {
      var r = base.split("").reduce(function (s, c, i) { return s + (c.charCodeAt(0) - 48) * pesos[i]; }, 0) % 11;
      return r < 2 ? 0 : 11 - r;
    }
    if (!/^[0-9A-Z]{12}\d{2}$/.test(t) || /^(.)\1{13}$/.test(t)) throw new Error("CNPJ inválido.");
    var d1 = dv(t.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    var d2 = dv(t.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    if (t.slice(12) !== String(d1) + d2) throw new Error("CNPJ inválido.");
    return t;
  }
  function formatarCnpj(t) {
    t = String(t || "").toUpperCase().replace(/[.\/\-\s]/g, "");
    return t.length === 14 ? t.slice(0, 2) + "." + t.slice(2, 5) + "." + t.slice(5, 8) + "/" + t.slice(8, 12) + "-" + t.slice(12) : t;
  }
  function dadosEscolaLimpos(d) {
    var registro = limparNome(d.registroMapa), tel = String(d.telefone || "").replace(/\D/g, "");
    var cnpj = cnpjLimpo(d.cnpj);
    if (!/^[A-Za-z0-9][A-Za-z0-9 .\/\-]{2,39}$/.test(registro)) throw new Error("Registro no MAPA: informe o número do registro (letras, números, ponto, barra ou hífen).");
    if (tel.length === 10 || tel.length === 11) tel = "55" + tel;
    if (!/^55\d{10,11}$/.test(tel)) throw new Error("Telefone de contato: informe DDD e número.");
    return { cnpj: cnpj, registroMapa: registro, telefone: tel };
  }
  function formatarTelefone(t) {
    var n = String(t || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    return n.length === 11 ? "(" + n.slice(0, 2) + ") " + n.slice(2, 7) + "-" + n.slice(7)
      : n.length === 10 ? "(" + n.slice(0, 2) + ") " + n.slice(2, 6) + "-" + n.slice(6) : n;
  }

  function validarCadastro(d, semSenha) {
    if (d.tipoConta && !['pessoal', 'escola'].includes(d.tipoConta)) return 'Escolha pessoal ou escola de formação de pilotos.';
    if (d.tipoConta === 'escola' && (limparNome(d.nomeEscola).length < 3 || limparNome(d.nomeEscola).length > 120)) return 'Informe o nome da escola (de 3 a 120 caracteres).';
    if (!d.aceitouTermos) return "Para criar a conta é preciso aceitar os termos de uso e a política de privacidade.";
    if (limparNome(d.nome).split(" ").length < 2) return "Informe o nome completo (nome e sobrenome).";
    if (!semSenha && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(d.email))) return "E-mail inválido.";
    if (!semSenha && String(d.senha || "").length < 6) return "A senha precisa ter pelo menos 6 caracteres.";
    if (d.pais === 'OUTRO') return "Escreva o nome do país onde você mora.";
    if (!paisExiste(d.pais)) return "Escolha o país onde você mora.";
    if (d.pais === 'BR' && !ESTADOS.some(function (e) { return e[0] === d.estado; })) return "Escolha o estado onde você mora.";
    return null;
  }

  function validarCodigoControle(codigo) {
    return /^[A-Z0-9]{6,12}$/.test(codigo) ? null : "Código inválido. Digite o código que aparece no aplicativo do controle.";
  }

  function codigoCertificado(codigo) {
    var c = String(codigo || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return c.length === 8 ? c.slice(0, 4) + "-" + c.slice(4) : null;
  }

  /* Sem 0/O/1/I/L para ninguem confundir ao digitar. */
  function novoCodigoCertificado() {
    var letras = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", b = new Uint8Array(8), c = "";
    crypto.getRandomValues(b);
    for (var i = 0; i < 8; i++) c += letras[b[i] % letras.length];
    return c.slice(0, 4) + "-" + c.slice(4);
  }

  /* Deixa a conta no formato que as paginas esperam, venha de onde vier. */
  function padronizar(c) {
    if (!c) return null;
    c = copia(c);
    c.saldoMin = c.saldoMin || 0;
    c.compras = c.compras || [];
    c.treinos = c.treinos || [];
    c.controles = c.controles || [];
    c.certificados = c.certificados || [];
    c.mapas = c.mapas || [];
    c.anuncios = c.anuncios || [];
    if (!c.porDrone) {
      c.porDrone = {};
      c.treinos.forEach(function (t) { if (t.minutos > 0) c.porDrone[t.drone] = (c.porDrone[t.drone] || 0) + t.minutos; });
    }
    if (c.minutosTreinados == null) {
      c.minutosTreinados = Object.keys(c.porDrone).reduce(function (s, d) { return s + c.porDrone[d]; }, 0);
    }
    var feitos = c.treinos.filter(function (t) { return t.minutos > 0; });
    if (!c.primeiroTreino && feitos.length) c.primeiroTreino = feitos[0].inicio;
    if (!c.ultimoTreino && feitos.length) c.ultimoTreino = feitos[feitos.length - 1].fim;
    return c;
  }

  /* ================================================== motor: demonstracao */

  function motorLocal() {
    var CHAVE_CONTAS = "tpd_contas", CHAVE_SESSAO = "tpd_conta_sessao", CHAVE_CERTIFICADOS = "tpd_certificados";

    function ler(chave, padrao) {
      try { var v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; }
      catch (e) { return padrao; }
    }
    function gravar(chave, valor) {
      try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
    }
    function contas() { return ler(CHAVE_CONTAS, {}); }
    function salvarDadosEscolaDemo(uid, dados) {
      var limpo = dadosEscolaLimpos(dados), vitrines = ler('tpd_vitrine_escolas', {});
      Object.keys(vitrines).forEach(function (k) {
        if (k !== uid && vitrines[k].cnpj === limpo.cnpj) throw new Error('Este CNPJ já está cadastrado em outra conta de escola. Fale com o suporte.');
      });
      vitrines[uid] = Object.assign({}, vitrines[uid] || {}, limpo, { atualizadoEm: new Date().toISOString() });
      if (!gravar('tpd_vitrine_escolas', vitrines)) throw new Error('Não foi possível salvar neste navegador.');
      return { dados: vitrines[uid] };
    }
    function salvar(conta) {
      var todas = contas();
      todas[conta.email] = conta;
      if (!gravar(CHAVE_CONTAS, todas)) throw new Error("Não foi possível salvar os dados neste navegador.");
    }
    function daSessao() {
      var s = ler(CHAVE_SESSAO, null);
      return s && s.email ? contas()[s.email] || null : null;
    }
    function concederTeste(conta) {
      if (conta && conta.tipoConta !== 'escola' && !conta.bloqueada && !conta.testeGratisEm) {
        var minutos = ler('tpd_tempo_novos', { minutos: 10 }).minutos;
        /* Como no servidor: so com o e-mail confirmado (aqui, simulado em confirmarEmail).
           Contas antigas da demonstracao nao tem o campo e seguem valendo. */
        if (conta.emailConfirmado === false) { conta.testeGratisPendente = 'confirmarEmail'; conta.testeGratisOferta = minutos; return conta; }
        conta.saldoMin = (conta.saldoMin || 0) + minutos;
        conta.testeGratisEm = new Date().toISOString();
        conta.testeGratisMin = minutos;
        salvar(conta);
      }
      return conta;
    }
    function publica(conta) {
      if (!conta) return null;
      var c = copia(conta);
      delete c.senhaResumo;
      delete c.senhaSal;
      delete c.senhaGuardada;
      return padronizar(c);
    }
    function hex(buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    }
    function resumoSenha(senha, sal) {
      if (!window.crypto || !crypto.subtle) return falha("Abra o site por https para criar conta ou entrar.");
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(sal + ":" + senha)).then(hex);
    }
    function logada() {
      var c = daSessao();
      return c ? Promise.resolve(c) : falha("Entre na sua conta.");
    }

    /* Esqueci a senha (demonstracao). A senha fica guardada de forma que da
       para mostrar de novo; so serve porque aqui tudo mora neste navegador. */
    var CHAVE_CODIGO = "tpd_senha_codigo";
    function embrulhar(s) { try { return btoa(unescape(encodeURIComponent(String(s)))); } catch (e) { return ""; } }
    function desembrulhar(s) { try { return decodeURIComponent(escape(atob(String(s || "")))); } catch (e) { return ""; } }
    function codigoCerto(email, codigo) {
      var p = ler(CHAVE_CODIGO, null);
      if (!p || p.email !== email || !contas()[email]) return falha("Peça um código novo.");
      if (Date.now() > p.expira) return falha("Este código venceu. Peça um código novo.");
      if (p.tentativas >= 5) return falha("Muitas tentativas. Peça um código novo.");
      if (String(codigo) !== p.codigo) {
        p.tentativas++;
        gravar(CHAVE_CODIGO, p);
        return falha("Código incorreto.");
      }
      return Promise.resolve(p);
    }

    return {
      iniciar: function () { return Promise.resolve(publica(concederTeste(daSessao()))); },

      cadastrar: function (d) {
        var email = normalizarEmail(d.email);
        if (contas()[email]) return falha("Já existe uma conta com este e-mail. Entre com sua senha.");
        var b = new Uint8Array(16); crypto.getRandomValues(b);
        var sal = hex(b.buffer);
        return resumoSenha(String(d.senha), sal).then(function (resumo) {
          var conta = {
            nome: limparNome(d.nome), email: email, pais: d.pais, estado: d.pais === 'BR' ? d.estado : '', criadaEm: new Date().toISOString(),
            termosEm: new Date().toISOString(), tipoConta: d.tipoConta || 'pessoal', nomeEscola: d.tipoConta === 'escola' ? limparNome(d.nomeEscola) : '',
            senhaSal: sal, senhaResumo: resumo, senhaGuardada: embrulhar(d.senha),
            saldoMin: 0, compras: [], treinos: [], controles: [], certificados: [],
            emailConfirmado: false, linkConfirmacaoEm: new Date().toISOString(),
          };
          if (idiomaValido(d.idioma)) conta.idioma = d.idioma;
          salvar(conta);
          gravar(CHAVE_SESSAO, { email: email, desde: conta.criadaEm });
          return publica(concederTeste(conta));
        });
      },

      entrarComGoogle: function () { return falha("Entrar com Google funciona só no site publicado."); },
      loginSemCadastro: function () { return Promise.resolve(null); },
      completarCadastroGoogle: function () { return falha("Entrar com Google funciona só no site publicado."); },

      entrar: function (email, senha) {
        email = normalizarEmail(email);
        var conta = contas()[email];
        if (!conta) return falha("E-mail ou senha incorretos.");
        return resumoSenha(String(senha || ""), conta.senhaSal).then(function (resumo) {
          if (resumo !== conta.senhaResumo) throw new Error("E-mail ou senha incorretos.");
          if (conta.bloqueada) throw new Error("Esta conta está bloqueada. Fale com o suporte.");
          gravar(CHAVE_SESSAO, { email: email, desde: new Date().toISOString() });
          return publica(concederTeste(conta));
        });
      },

      /* ------------------------------------------------ esqueci a senha
         Demonstracao: nao existe servidor para mandar e-mail, entao o
         codigo e devolvido para a tela mostrar. No modo firebase o codigo
         vai por e-mail e a tela nunca o recebe. */

      pedirCodigoSenha: function (email) {
        if (!contas()[email]) return falha("Não existe conta com este e-mail neste navegador.");
        var n = new Uint32Array(1); crypto.getRandomValues(n);
        var codigo = ("000000" + (n[0] % 1000000)).slice(-6);
        gravar(CHAVE_CODIGO, { email: email, codigo: codigo, expira: Date.now() + 15 * 60 * 1000, tentativas: 0 });
        return Promise.resolve({ email: email, codigoDemonstracao: codigo });
      },

      conferirCodigoSenha: function (email, codigo) {
        return codigoCerto(email, codigo).then(function () {
          return { podeRevelar: !!contas()[email].senhaGuardada };
        });
      },

      revelarSenha: function (email, codigo) {
        return codigoCerto(email, codigo).then(function () {
          var conta = contas()[email];
          if (!conta.senhaGuardada) {
            throw new Error("Esta conta foi criada antes de existir a opção de revelar. Escolha Criar outra senha.");
          }
          return { senha: desembrulhar(conta.senhaGuardada) };
        });
      },

      criarOutraSenha: function (email, codigo, senha) {
        return codigoCerto(email, codigo).then(function () {
          var b = new Uint8Array(16); crypto.getRandomValues(b);
          var sal = hex(b.buffer);
          return resumoSenha(senha, sal).then(function (resumo) {
            var conta = contas()[email];
            conta.senhaSal = sal;
            conta.senhaResumo = resumo;
            conta.senhaGuardada = embrulhar(senha);
            salvar(conta);
            try { localStorage.removeItem(CHAVE_CODIGO); } catch (e) { /* vence sozinho */ }
            return true;
          });
        });
      },

      /* ------------------------------------------------ administracao
         Demonstracao: o painel mostra as contas deste navegador, e quem
         estiver logado e tratado como administrador. O "uid" e o e-mail. */

      adminAcessoVitalicio: function (uid, ativar, motivo) {
        return logada().then(function () {
          var conta = contas()[uid];
          if (!conta) throw new Error('Conta não encontrada.');
          if (ativar && String(motivo || '').trim().length < 3) throw new Error('Escreva o motivo do acesso vitalício.');
          conta.acessoVitalicio = !!ativar;
          salvar(conta);
          return { acessoVitalicio: !!ativar };
        });
      },
      adminAutorizarGratisCertificado: function (uid, autorizar) {
        return logada().then(function () {
          var conta = contas()[uid];
          if (!conta) throw new Error('Conta não encontrada.');
          conta.autorizaGratisCertificado = autorizar;
          var anulados = 0, registros = ler(CHAVE_CERTIFICADOS, {}), em = new Date().toISOString();
          if (!autorizar) (conta.certificados || []).forEach(function (c) {
            if (c.situacao !== 'anulado' && (c.minutosGratisContabilizados > 0 || (!c.regraHoras && c.minutos > HC.resumo(padronizar(conta)).minutos))) {
              c.situacao = 'anulado'; c.anuladoEm = em; anulados++;
              if (registros[c.codigo]) Object.assign(registros[c.codigo], {situacao:'anulado',anuladoEm:em});
            }
          });
          if (!gravar(CHAVE_CERTIFICADOS, registros)) throw new Error('Não foi possível salvar.');
          salvar(conta);
          return {autorizado:autorizar,certificadosAnulados:anulados};
        });
      },
      /* Demonstracao: quem pediu o link conta como se tivesse clicado nele. */
      confirmarEmail: function (enviar) {
        return logada().then(function (conta) {
          if (enviar) { conta.linkConfirmacaoEm = new Date().toISOString(); salvar(conta); return false; }
          if (conta.emailConfirmado === false && conta.linkConfirmacaoEm) { conta.emailConfirmado = true; salvar(conta); }
          return conta.emailConfirmado !== false;
        });
      },
      adminTestesRepetidos: function (dados) {
        return logada().then(function () {
          return { dias: (dados && dados.dias) || 30, registros: 0, limiteAtingido: false, grupos: [], demonstracao: true };
        });
      },
      adminRelatorioCadastros: function () {
        var todas = contas(), lista = Object.keys(todas).map(function (k) { return todas[k]; }), r = { ativos: 0, escolas: 0, testaram: 0, semTestar: 0, compraram: 0 };
        lista.forEach(function (c) { if (c.tipoConta === 'escola') { r.escolas++; return; } r.ativos++; if ((c.minutosTreinados || 0) + (c.minutosTesteXag || 0) > 0) r.testaram++; else r.semTestar++; if ((c.compras || []).length) r.compraram++; });
        return Promise.resolve(Object.assign(r, { cadastrados: lista.length, saidas: 0, porMotivo: {}, lista: [] }));
      },
      adminTempoNovos: function (dados) {
        return logada().then(function () {
          if (dados.acao === 'ler') return ler('tpd_tempo_novos', { minutos: 10 });
          if (dados.acao !== 'salvar' || !Number.isInteger(dados.minutos) || dados.minutos < 1 || dados.minutos > 60000) throw new Error('Informe de 1 minuto até 1.000 horas.');
          var config = { minutos: dados.minutos, atualizadoEm: new Date().toISOString() };
          if (!gravar('tpd_tempo_novos', config)) throw new Error('Não foi possível salvar neste navegador.');
          return config;
        });
      },
      /* Lista das escolas do CAAR (no servidor: vitrine-escolas.js). Aqui fica no
         navegador, com as contas de escola deste navegador. */
      adminVitrineEscolas: function (dados) {
        return logada().then(function () {
          var vitrines = ler('tpd_vitrine_escolas', {}), todas = contas();
          if (dados.acao === 'listar') {
            return { escolas: Object.keys(todas).filter(function (k) { return todas[k].tipoConta === 'escola'; }).map(function (k) {
              var c = todas[k], v = vitrines[k] || null, completo = !!(v && v.cnpj && v.registroMapa && v.telefone);
              return { uid: k, nome: c.nomeEscola || '', responsavel: c.nome || '', email: c.email || k, estado: c.estado || '', criadaEm: c.criadaEm || null,
                bloqueada: !!c.bloqueada, excluida: false, horasCompradas: horasEscola(c), dados: v, completo: completo,
                aprovada: escolaAprovada(c), recusada: c.escolaAprovada === false,
                oculta: !!(v && v.oculta), naLista: completo && !v.oculta && !c.bloqueada && escolaAprovada(c) };
            }).sort(function (a, b) {
              var pa = !a.aprovada && !a.recusada ? 0 : 1, pb = !b.aprovada && !b.recusada ? 0 : 1;
              return pa - pb || b.horasCompradas - a.horasCompradas || String(a.criadaEm || '9999').localeCompare(String(b.criadaEm || '9999'));
            }), demonstracao: true };
          }
          var conta = todas[dados.uid];
          if (!conta || conta.tipoConta !== 'escola') throw new Error('Esta conta não é de escola.');
          if (dados.acao === 'aprovar') {
            todas[dados.uid].escolaAprovada = !!dados.aprovar;
            if (!gravar(CHAVE_CONTAS, todas)) throw new Error('Não foi possível salvar neste navegador.');
            return { aprovada: !!dados.aprovar };
          }
          if (dados.acao === 'ocultar') {
            vitrines[dados.uid] = Object.assign({}, vitrines[dados.uid] || {}, { oculta: !!dados.oculta });
            if (!gravar('tpd_vitrine_escolas', vitrines)) throw new Error('Não foi possível salvar neste navegador.');
            return { oculta: !!dados.oculta };
          }
          if (dados.acao !== 'salvar') throw new Error('Ação inválida.');
          return salvarDadosEscolaDemo(dados.uid, dados);
        });
      },
      dadosEscola: function (dados) {
        return logada().then(function (conta) {
          if (conta.tipoConta !== 'escola') throw new Error('Esta área é exclusiva para escolas.');
          var v = ler('tpd_vitrine_escolas', {})[conta.email] || null, completo = !!(v && v.cnpj && v.registroMapa && v.telefone);
          if (dados.acao === 'ler') return { dados: v, completo: completo, oculta: !!(v && v.oculta), aprovada: escolaAprovada(conta), recusada: conta.escolaAprovada === false,
            naLista: completo && !v.oculta && !conta.bloqueada && escolaAprovada(conta) };
          if (dados.acao !== 'salvar') throw new Error('Ação inválida.');
          return salvarDadosEscolaDemo(conta.email, dados);
        });
      },
      escolasPublicas: function () {
        var eu = daSessao();
        if (!eu) return Promise.reject(recusaEscolas('login'));
        if (!eu.admin && !contaDoBrasil(eu)) return Promise.reject(recusaEscolas('pais'));
        var vitrines = ler('tpd_vitrine_escolas', {}), todas = contas();
        return Promise.resolve({ demonstracao: true, escolas: Object.keys(vitrines).filter(function (k) {
          var v = vitrines[k];
          return v.cnpj && v.registroMapa && v.telefone && !v.oculta && todas[k] && todas[k].tipoConta === 'escola' && !todas[k].bloqueada && escolaAprovada(todas[k]);
        }).sort(function (a, b) {
          // Mesma ordem do servidor: mais horas compradas no topo; sem compra, por ordem de cadastro.
          return horasEscola(todas[b]) - horasEscola(todas[a]) || String(todas[a].criadaEm || '9999').localeCompare(String(todas[b].criadaEm || '9999'));
        }).map(function (k) {
          var v = vitrines[k];
          return { nome: todas[k].nomeEscola, uf: todas[k].estado || '', cnpj: formatarCnpj(v.cnpj), registroMapa: v.registroMapa, telefone: v.telefone };
        }) });
      },
      adminRelatorioEstados: function () {
        return this.adminPainel().then(function (p) {
          var r = { geradoEm: new Date().toISOString(), total: 0, brasil: 0, semEstado: 0, estados: {}, outrosPaises: {} };
          ESTADOS.forEach(function (e) { r.estados[e[0]] = 0; });
          p.contas.forEach(function (c) {
            r.total++; var pais = String(c.pais || "BR").trim().toUpperCase(), uf = String(c.estado || "").trim().toUpperCase();
            if (pais === "BR") { r.brasil++; if (Object.prototype.hasOwnProperty.call(r.estados, uf)) r.estados[uf]++; else r.semEstado++; }
            else r.outrosPaises[pais] = (r.outrosPaises[pais] || 0) + 1;
          });
          return r;
        });
      },
      adminPainel: function () {
        return logada().then(function (eu) {
          var todas = contas();
          if (!eu.admin) { eu.admin = true; salvar(eu); }
          return montarPainel(Object.keys(todas).map(function (e) { return { uid: e, conta: todas[e] }; }), eu.email);
        });
      },

      adminConta: function (uid) {
        return logada().then(function () {
          var conta = contas()[uid];
          if (!conta) throw new Error("Conta não encontrada.");
          return { uid: uid, conta: publica(conta), treinos: publica(conta).treinos, bloqueada: !!conta.bloqueada };
        });
      },

      adminAjustarHoras: function (uid, minutos, motivo, operacao) {
        return logada().then(function (eu) {
          var conta = contas()[uid];
          if (!conta) throw new Error("Conta não encontrada.");
          var anterior = (conta.ajustes || []).find(function (a) { return operacao && a.operacao === operacao && a.por === eu.email; });
          if (anterior) {
            if (anterior.solicitadoMin !== minutos || anterior.motivo !== motivo) throw new Error("Esta operação já foi usada para outro ajuste.");
            return { saldoMin: anterior.saldoDepois, repetida: true };
          }
          var antes = conta.saldoMin || 0;
          conta.saldoMin = Math.max(0, antes + minutos);
          conta.ajustes = (conta.ajustes || []).concat([{ minutos: conta.saldoMin - antes, motivo: motivo, em: new Date().toISOString(), por: eu.email, operacao: operacao || null, solicitadoMin: minutos, saldoDepois: conta.saldoMin }]);
          salvar(conta);
          return { saldoMin: conta.saldoMin };
        });
      },

      adminBloquear: function (uid, bloquear) {
        return logada().then(function (eu) {
          if (uid === eu.email) throw new Error("Você não pode bloquear a própria conta.");
          var conta = contas()[uid];
          if (!conta) throw new Error("Conta não encontrada.");
          conta.bloqueada = !!bloquear;
          /* bloqueou: os controles ficam livres para outra conta (como no servidor) */
          var liberados = [];
          if (bloquear && (conta.controles || []).length) {
            liberados = conta.controles.map(function (k) { return k.codigo; });
            conta.controlesLiberados = (conta.controlesLiberados || []).concat(conta.controles.map(function (k) {
              return { codigo: k.codigo, apelido: k.apelido, em: k.em, liberadoEm: new Date().toISOString(), por: eu.email };
            }));
            conta.controles = [];
          }
          salvar(conta);
          return { bloqueada: conta.bloqueada, controlesLiberados: liberados };
        });
      },

      adminExcluirConta: function (uid) {
        return logada().then(function (eu) {
          var todas = contas(), conta = todas[uid];
          if (uid === eu.email || (conta && conta.admin)) throw new Error("Não é permitido excluir uma conta administrativa.");
          if (!conta) return { excluida: true };
          delete todas[uid];
          if (!gravar(CHAVE_CONTAS, todas)) throw new Error("Não foi possível salvar os dados neste navegador.");
          return { excluida: true };
        });
      },

      sair: function () {
        try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ }
        return Promise.resolve();
      },

      registrarCliqueOfertaTeste: function (evento) {
        return logada().then(function (conta) {
          var antes = conta.cliquesOfertaTeste || {}, em = new Date().toISOString();
          if (antes.ultimoEvento !== evento) {
            conta.cliquesOfertaTeste = { quantidade: (antes.quantidade || 0) + 1, primeiroEm: antes.primeiroEm || em, ultimoEm: em, ultimoEvento: evento };
            salvar(conta);
          }
          return { salvo: true };
        });
      },
      /* enquete "qual drone voce gostaria no simulador" (drones.html) */
      sugerirDrone: function (dados) {
        return logada().then(function (conta) {
          var marca = String(dados && dados.marca || "").trim().slice(0, 40), modelo = String(dados && dados.modelo || "").trim().slice(0, 60);
          if (!marca || !modelo) throw new Error("Preencha a marca e o modelo do drone.");
          var lista = conta.sugestoesDrone || [];
          if (lista.length >= 10) throw new Error("Você já enviou 10 sugestões. Obrigado!");
          conta.sugestoesDrone = lista.concat([{ marca: marca, modelo: modelo, em: new Date().toISOString() }]);
          salvar(conta);
          return { salvo: true };
        });
      },
      avaliarTeste: function (dados) {
        return logada().then(function (conta) {
          conta.avaliacaoTeste = { nota: dados.tempoCurto ? null : dados.nota, tempoCurto: dados.tempoCurto, sugestao: dados.sugestao === undefined ? ((conta.avaliacaoTeste || {}).sugestao || "") : String(dados.sugestao).trim(), em: new Date().toISOString() };
          salvar(conta);
          return { salvo: true };
        });
      },
      /* Pix na tela (11/10/2026): na demonstracao paga na hora, como a compra comum */
      comprarPix: function (pacote) { return this.comprar(pacote); },
      pagarCartao: function (pacote) { return this.comprar(pacote); },
      comprarDolarEmbutido: function (pacoteId) { return this.comprar({ id: pacoteId, horas: (PACOTES.filter(function (p) { return p.id === pacoteId; })[0] || {}).horas || 1, preco: 0 }); },
      conferirPagamento: function () { return Promise.resolve({ situacao: "pago" }); },
      comprar: function (pacote) {
        return logada().then(function (conta) {
          if (pacote.oferta === "teste30" && (conta.compras || []).some(function (c) { return c && c.oferta === "teste30"; }))
            throw new Error("A oferta de 30% já foi usada nesta conta.");
          conta.saldoMin += Math.round(pacote.horas * 60);
          conta.compras.push({ pacote: pacote.id, horas: pacote.horas, preco: pacote.preco, oferta: pacote.oferta || null, em: new Date().toISOString(), demonstracao: true });
          salvar(conta);
          return { conta: publica(conta) };
        });
      },

      /* Demonstracao: o anuncio (dados e miniatura) fica na conta deste
         navegador; o arquivo do mapa nao vai para lugar nenhum. */
      anunciarMapa: function (a) {
        return logada().then(function (conta) {
          conta.anuncios = conta.anuncios || [];
          var usado = conta.anuncios.reduce(function (s, x) { return s + x.area; }, 0);
          if (usado + a.area > MAPAS.limiteHectares + 1e-6) {
            throw new Error("Passa do limite de " + MAPAS.limiteHectares + " hectares à venda por vendedor.");
          }
          var n = new Uint32Array(1); crypto.getRandomValues(n);
          a.id = a.id + "-" + (n[0] % 1679616).toString(36);
          a.situacao = "analise";
          a.em = new Date().toISOString();
          conta.anuncios.push(a);
          salvar(conta);
          return publica(conta);
        });
      },

      removerAnuncio: function (id) {
        return logada().then(function (conta) {
          conta.anuncios = (conta.anuncios || []).filter(function (x) { return x.id !== id; });
          salvar(conta);
          return publica(conta);
        });
      },

      comprarMapa: function (m) {
        return logada().then(function (conta) {
          conta.mapas = conta.mapas || [];
          if (conta.mapas.indexOf(m.id) !== -1) throw new Error("Este mapa já está na sua conta.");
          conta.mapas.push(m.id);
          conta.compras.push({ mapa: m.id, nome: m.nome, preco: m.preco, em: new Date().toISOString(), demonstracao: true });
          salvar(conta);
          return { conta: publica(conta) };
        });
      },

      /* 08/10/2026: o admin libera o teste de um drone ainda nao publico por e-mail */
      adminCompartilharDrone: function (dados) {
        return logada().then(function (eu) {
          if (eu.admin !== true) throw new Error("Esta área é só do administrador.");
          var drone = String(dados && dados.drone || ""), email = String(dados && dados.email || "").trim().toLowerCase(), ligar = !dados || dados.ligar !== false;
          if (DRONES_PREVIA.indexOf(drone) < 0) throw new Error("Esse drone não tem teste para compartilhar.");
          var c = contas()[email];
          if (!c) throw new Error("Nenhuma conta com esse e-mail. A pessoa precisa se cadastrar primeiro.");
          var l = (c.previas || []).filter(function (x) { return x !== drone; });
          if (ligar) l.push(drone);
          c.previas = l; salvar(c);
          return { email: email, nome: c.nome || "", liberado: ligar };
        });
      },
      adminListarCompartilhados: function (dados) {
        return logada().then(function (eu) {
          if (eu.admin !== true) throw new Error("Esta área é só do administrador.");
          var drone = String(dados && dados.drone || ""), todas = contas();
          return { lista: Object.keys(todas).filter(function (e) { return (todas[e].previas || []).indexOf(drone) >= 0; })
            .map(function (e) { return { email: e, nome: todas[e].nome || "" }; }) };
        });
      },

      autorizarMapeamento: function (droneId) {
        return logada().then(function (conta) {
          if (conta.admin !== true) throw new Error("Esta área é só do administrador.");
          if (droneId !== "t25" && droneId !== "t50") throw new Error("Mapeamento de teste disponível somente para DJI T25 e T50.");
          return { permitido: true };
        });
      },

      iniciarTreino: function (droneId, controle) {
        return logada().then(function (conta) {
          if (!Object.prototype.hasOwnProperty.call(DRONES, droneId)) throw new Error("Drone indisponível.");
          if (DRONES_SO_ADMIN.indexOf(droneId) >= 0 && conta.admin !== true && !testaPrevia(conta, droneId)) throw new Error("Este drone é exclusivo do administrador.");
          if (conta.saldoMin <= 0 && !conta.acessoVitalicio) throw new Error("Sem horas de simulador.");
          /* sem controle = controle virtual (teclado e mouse); com controle, tem que ser um da conta */
          if (controle && !(conta.controles || []).some(function (c) { return c.codigo === controle; })) throw new Error("Controle não registrado nesta conta.");
          var t = new Date().toISOString();
          conta.treinos.push({ drone: DRONES[droneId] || droneId, inicio: t, fim: t, minutos: 0 });
          salvar(conta);
          return { treino: String(conta.treinos.length - 1), saldoMin: conta.saldoMin, vitalicio: !!conta.acessoVitalicio };
        });
      },

      registrarMinuto: function (treino) {
        var conta = daSessao(), t = conta && conta.treinos[Number(treino)];
        if (!t || (conta.saldoMin <= 0 && !conta.acessoVitalicio)) return Promise.resolve(0);
        if (conta.acessoVitalicio) {
          /* Igual ao servidor: nao gasta saldo e conta como pago no certificado. */
          conta.minutosTreinados = (conta.minutosTreinados || 0) + 1;
          conta.minutosVitalicio = (conta.minutosVitalicio || 0) + 1;
          conta.porDrone = conta.porDrone || {}; conta.porDroneVitalicio = conta.porDroneVitalicio || {};
          conta.porDrone[t.drone] = (conta.porDrone[t.drone] || 0) + 1;
          conta.porDroneVitalicio[t.drone] = (conta.porDroneVitalicio[t.drone] || 0) + 1;
          t.minutos += 1; t.minutosVitalicio = (t.minutosVitalicio || 0) + 1;
          t.fim = new Date().toISOString();
          salvar(conta);
          return Promise.resolve(Infinity);
        }
        var atual = padronizar(conta), origem = HC.registrar(atual, t.drone);
        conta.horasCertificado = origem.estado;
        conta.minutosTreinados = atual.minutosTreinados + 1;
        conta.porDrone = atual.porDrone;
        conta.porDrone[t.drone] = (conta.porDrone[t.drone] || 0) + 1;
        t.minutosPagos = (t.minutosPagos || 0) + origem.pago;
        t.minutosGratis = (t.minutosGratis || 0) + origem.gratis;
        t.minutos += 1;
        t.fim = new Date().toISOString();
        conta.saldoMin -= 1;
        salvar(conta);
        return Promise.resolve(conta.saldoMin);
      },

      registrarControle: function (codigo, apelido) {
        return logada().then(function (conta) {
          conta.controles = conta.controles || [];
          if (conta.controles.some(function (c) { return c.codigo === codigo; })) throw new Error("Este controle já está registrado na sua conta.");
          var todas = contas();
          var outra = Object.keys(todas).some(function (e) {
            return e !== conta.email && (todas[e].controles || []).some(function (c) { return c.codigo === codigo; });
          });
          if (outra) throw new Error("Este controle já está registrado em outra conta.");
          conta.controles.push({ codigo: codigo, apelido: apelido || "Controle " + (conta.controles.length + 1), em: new Date().toISOString() });
          salvar(conta);
          return publica(conta);
        });
      },

      guardarIdioma: function (v) {
        return logada().then(function (conta) { conta.idioma = v; salvar(conta); return publica(conta); });
      },

      informarPais: function (pais, estado) {
        return logada().then(function (conta) {
          if (conta.pais !== 'OUTRO') throw new Error("O país desta conta já está informado.");
          conta.pais = pais; conta.estado = pais === 'BR' ? estado : '';
          salvar(conta);
          return publica(conta);
        });
      },

      removerControle: function (codigo) {
        return logada().then(function (conta) {
          conta.controles = (conta.controles || []).filter(function (c) { return c.codigo !== codigo; });
          salvar(conta);
          return publica(conta);
        });
      },

      emitirCertificado: function (nome, cpf) {
        return logada().then(function (conta) {
          conta.nome = nome;
          cpf = cpf || "";
          var c = padronizar(conta);
          var elegivel = HC.resumo(c);
          if (!elegivel.minutos) throw new Error("Você ainda não tem horas treinadas válidas para certificado. Horas de teste e gratuitas não contam sem autorização individual do administrador.");
          var libera = certificadoLiberaEm(c);
          if (libera) throw new Error("O certificado fica disponível 7 dias depois da última compra de horas: a partir de " + libera.toLocaleDateString("pt-BR") + ".");
          var minimoMin = HC.minimoCertificado(c);
          if (elegivel.minutos < minimoMin) return {
            situacao: "invalido", nome: nome, cpf: cpf, pais: c.pais || 'BR', estado: c.estado, minutos: elegivel.minutos, minimoMin: minimoMin,
            porDrone: elegivel.porDrone, inicio: c.primeiroTreino, fim: c.ultimoTreino, emitidoEm: new Date().toISOString()
          };
          var registro = ler(CHAVE_CERTIFICADOS, {}), codigo, agora = new Date().toISOString();
          do { codigo = novoCodigoCertificado(); } while (registro[codigo]);
          conta.certificados = (conta.certificados || []).map(function (x) {
            if (x.situacao === "anulado") return x;
            if (registro[x.codigo]) { registro[x.codigo].situacao = "anulado"; registro[x.codigo].anuladoEm = agora; }
            return Object.assign({}, x, { situacao: "anulado", anuladoEm: agora });
          });
          var cert = {
            codigo: codigo, situacao: "valido", nome: nome, cpf: cpf, pais: conta.pais || 'BR', estado: conta.estado, minutos: elegivel.minutos, minimoMin: minimoMin,
            regraHoras: 1, minutosGratisContabilizados: elegivel.autorizado ? elegivel.minutosGratis : 0,
            porDrone: elegivel.porDrone, inicio: c.primeiroTreino, fim: c.ultimoTreino, emitidoEm: agora,
            instituicoes: (c.patrociniosEscola || []).map(function (x) { return x.nome; }).filter(function (x, i, l) { return x && l.indexOf(x) === i; }),
          };
          /* Igual ao servidor: a consulta publica so ve o nome com parte escondida. */
          registro[codigo] = Object.assign({}, cert, { nome: mascararNome(nome), privacidade: 1 });
          if (!gravar(CHAVE_CERTIFICADOS, registro)) throw new Error("Não foi possível registrar o certificado.");
          conta.certificados.push(copia(cert));
          salvar(conta);
          return cert;
        });
      },

      consultarCertificado: function (codigo) {
        return Promise.resolve(ler(CHAVE_CERTIFICADOS, {})[codigo] || null);
      },
    };
  }

  /* O resumo do painel de administracao a partir de [{ uid, conta }].
     O servidor (servidor/funcoes/index.js) monta o mesmo formato. */
  function montarPainel(lista, eu) {
    var agora = Date.now(), DIA = 86400000;
    var r = { contas: 0, contasNovas7d: 0, compradores: 0, vendasTotal: 0, nVendas: 0, vendas30d: 0, nVendas30d: 0,
              minutosVendidos: 0, minutosTreinados: 0, saldoAbertoMin: 0, certificados: 0, bloqueadas: 0 };
    var linhas = [], vendas = [];
    lista.forEach(function (x) {
      var c = padronizar(x.conta), comprado = 0;
      r.contas++;
      if (agora - new Date(c.criadaEm).getTime() < 7 * DIA) r.contasNovas7d++;
      c.compras.forEach(function (v) {
        comprado += v.preco || 0;
        r.vendasTotal += v.preco || 0; r.nVendas++;
        r.minutosVendidos += Math.round((v.horas || 0) * 60);
        if (agora - new Date(v.em).getTime() < 30 * DIA) { r.vendas30d += v.preco || 0; r.nVendas30d++; }
        vendas.push({ uid: x.uid, nome: c.nome, email: c.email, em: v.em, preco: v.preco || 0,
                      item: v.mapa ? "Mapa: " + (v.nome || v.mapa) : nomeDoPacote(v.horas), forma: v.forma || "", demonstracao: !!v.demonstracao });
      });
      if (c.compras.length) r.compradores++;
      r.minutosTreinados += c.minutosTreinados || 0;
      r.saldoAbertoMin += c.saldoMin || 0;
      var cert = certificadoAtual(c);
      if (cert) r.certificados++;
      if (c.bloqueada) r.bloqueadas++;
      linhas.push({ uid: x.uid, nome: c.nome, email: c.email, pais: c.pais || 'BR', estado: c.estado, criadaEm: c.criadaEm, saldoMin: c.saldoMin || 0,
                    minutosTreinados: c.minutosTreinados || 0, comprado: comprado, certificado: cert ? cert.codigo : "", bloqueada: !!c.bloqueada,
                    acessoVitalicio: c.acessoVitalicio === true, tipoConta: c.tipoConta === "escola" ? "escola" : "pessoal", nomeEscola: c.nomeEscola || "",
                    testeGratisEm: c.testeGratisEm || null, avaliacaoTeste: c.avaliacaoTeste || null, cliquesOfertaTeste: c.cliquesOfertaTeste || null,
                    comprasOfertaTeste: c.compras.filter(function (v) { return v.oferta === "teste30"; }).map(function (v) { return { em: v.em, preco: v.preco }; }) });
    });
    linhas.sort(function (a, b) { return String(b.criadaEm).localeCompare(String(a.criadaEm)); });
    vendas.sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); });
    return { eu: eu, resumo: r, contas: linhas, vendas: vendas.slice(0, 300) };
  }

  /* ====================================================== motor: firebase */

  function motorFirebase() {
    var VERSAO = "10.14.1";
    var BASE = "https://www.gstatic.com/firebasejs/" + VERSAO + "/";
    var fb = null, auth = null, banco = null, funcoes = null;

    /* 25/10/2026 (troca de pagina lenta): os 4 scripts do Firebase baixam ao mesmo tempo e rodam na ordem
       em que entram (async = false). Antes baixava o "app" e so depois os outros 3, uma ida e volta a mais
       em toda pagina de quem ainda nao tinha o Firebase no cache. */
    function carregarScriptsEmOrdem(lista) {
      return new Promise(function (ok, erro) {
        var faltam = lista.length, falhou = false;
        lista.forEach(function (src) {
          var s = document.createElement("script");
          s.src = src;
          s.async = false;
          s.onload = function () { if (--faltam === 0 && !falhou) ok(); };
          s.onerror = function () {
            if (falhou) return;
            falhou = true;
            erro(new Error("Sem conexão com o servidor. Verifique a internet e recarregue a página."));
          };
          document.head.appendChild(s);
        });
      });
    }

    /* Abre ja a conexao (DNS + TLS) com os servidores que o Firebase vai usar, enquanto os scripts dele
       ainda baixam: a primeira leitura do Firestore numa pagina nova pagava essa conexao inteira. */
    if (typeof document !== "undefined" && document.head && !CFG.emulador && CFG.firebase && CFG.firebase.projectId) {
      ["https://firestore.googleapis.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com",
       "https://" + (CFG.regiao || "southamerica-east1") + "-" + CFG.firebase.projectId + ".cloudfunctions.net"].forEach(function (origem) {
        var dica = document.createElement("link");
        dica.rel = "preconnect"; dica.href = origem; dica.crossOrigin = "anonymous";
        document.head.appendChild(dica);
      });
    }

    var preparado = null;
    function preparar() {
      if (preparado) return preparado;
      preparado = carregarScriptsEmOrdem(["app", "auth", "firestore", "functions"].map(function (m) {
          return BASE + "firebase-" + m + "-compat.js";
        }))
        .then(function () {
          fb = window.firebase;
          fb.initializeApp(CFG.firebase);
          auth = fb.auth();
          banco = fb.firestore();
          funcoes = fb.app().functions(CFG.regiao || "southamerica-east1");
          if (CFG.emulador) {
            auth.useEmulator("http://localhost:9099", { disableWarnings: true });
            banco.useEmulator("localhost", 8080);
            funcoes.useEmulator("localhost", 5001);
          }
          auth.languageCode = window.TPD_IDIOMAS ? TPD_IDIOMAS.atual() : "pt";
          /* espera o Firebase dizer se ha alguem logado */
          return new Promise(function (ok) {
            var parar = auth.onAuthStateChanged(function () { parar(); ok(); });
          });
        });
      return preparado;
    }

    function chamar(nome, dados) {
      return preparar().then(function () { return funcoes.httpsCallable(nome)(dados || {}); })
        .then(function (r) { return r.data; })
        .catch(function (e) { throw new Error(traduzir(e)); });
    }

    /* 30/10/2026: ir ao Google na propria aba so funciona com o login no endereco da pagina (config.js). */
    function googleNaAbaPossivel() {
      return !!(CFG.firebase && CFG.firebase.authDomain === location.hostname);
    }
    /* Sem janela de verdade: icone da tela de inicio (iPhone/Android) ou navegador de dentro de outro app. */
    function googleNaAba() {
      if (!googleNaAbaPossivel()) return false;
      try {
        if (window.navigator.standalone === true) return true;
        if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
        return /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|; wv\)|GSA\//.test(navigator.userAgent || "");
      } catch (e) { return false; }
    }

    function traduzir(e) {
      var c = (e && e.code) || "";
      if (c === "auth/email-already-in-use") return "Já existe uma conta com este e-mail. Entre com sua senha.";
      if (c === "auth/invalid-email") return "E-mail inválido.";
      if (c === "auth/weak-password") return "A senha precisa ter pelo menos 6 caracteres.";
      if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found" || c === "auth/invalid-login-credentials") return "E-mail ou senha incorretos.";
      if (c === "auth/user-disabled") return "Esta conta está bloqueada. Fale com o suporte.";
      if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request" || c === "auth/user-cancelled" || c === "auth/redirect-cancelled-by-user") return "";
      if (c === "auth/popup-blocked") return "O navegador bloqueou a janela do Google. Permita janelas deste site e toque de novo em Entrar com Google.";
      if (c === "auth/account-exists-with-different-credential") return "Já existe uma conta com este e-mail. Entre com e-mail e senha (ou use Esqueci a senha).";
      if (c === "auth/operation-not-allowed" || c === "auth/unauthorized-domain" || c === "auth/operation-not-supported-in-this-environment")
        return "Entrar com Google não está disponível aqui. Use e-mail e senha ou abra o site no Chrome ou no Safari.";
      if (c === "auth/web-storage-unsupported") return "Este navegador bloqueia o login do Google. Abra o site no Chrome ou no Safari.";
      if (c === "auth/too-many-requests") return "Muitas tentativas. Espere alguns minutos e tente de novo.";
      if (c === "auth/network-request-failed" || c === "unavailable") return (e && e.message && c === "unavailable") ? e.message : "Sem conexão com o servidor. Verifique a internet.";
      if (c === "permission-denied") return "Sem permissão para essa ação.";
      return (e && e.message) || "Algo deu errado. Tente de novo.";
    }

    function contaRef() { return banco.collection("contas").doc(auth.currentUser.uid); }

    var sessaoServidorAte = 0, sessaoServidorPendente = null;
    /* 13/10/2026 (troca de pagina lenta): a validade fica na aba (sessionStorage), por conta.
       Antes ficava so na memoria da pagina e TODA pagina pedia a sessao de novo ao servidor. */
    function chaveDaAba(nome) { return "tpd_" + nome + "_" + (auth.currentUser ? auth.currentUser.uid : ""); }
    function lerDaAba(nome) { try { return sessionStorage.getItem(chaveDaAba(nome)); } catch (e) { return null; } }
    function gravarNaAba(nome, valor) { try { if (valor == null) sessionStorage.removeItem(chaveDaAba(nome)); else sessionStorage.setItem(chaveDaAba(nome), valor); } catch (e) { /* sem sessionStorage: so fica mais lento */ } }
    /* Pede ao servidor (so se for preciso) o cookie de sessao do simulador; resolve quando ele esta valido. */
    function pedirSessao() {
      if (!CFG.protegerArquivos) return Promise.resolve();
      if (!sessaoServidorAte) sessaoServidorAte = Number(lerDaAba("sessao_sim_ate")) || 0;
      if (Date.now() < sessaoServidorAte) return Promise.resolve();
      if (!sessaoServidorPendente) {
        sessaoServidorPendente = auth.currentUser.getIdToken().then(function (token) {
          return fetch('/api/sessaoSimulador', {method:'POST', credentials:'same-origin', headers:{Authorization:'Bearer '+token}});
        }).then(function (r) {
          if (!r.ok) throw new Error('Não foi possível autorizar o simulador. Entre novamente.');
          sessaoServidorAte = Date.now() + 20 * 60000;
          gravarNaAba("sessao_sim_ate", String(sessaoServidorAte));
        }).finally(function () { sessaoServidorPendente = null; });
      }
      return sessaoServidorPendente;
    }

    /* 18/11/2026 (Eduardo: "to notando uma lentidao da tela de login pra tela inicial"). Depois de ler a conta, o login
       fazia TRES pedidos ao servidor, um esperando o outro: horas da escola, teste gratis e sessao do simulador. Medido nos
       registros do servidor (48 h): 0,55 s + 1,5 s + 1,0 s na mediana, 1,4 + 1,8 + 2,9 s em 1 de cada 10 logins (maquina
       parada tem de ligar). Agora os tres saem JUNTOS e a pagina espera so o mais demorado. O resultado e o mesmo de antes:
       mesmos pedidos, mesmas respostas, mesma conta no fim; so a ordem de espera mudou. No servidor os dois que mexem no
       saldo usam transacao (escolas.js e teste-gratis.js), entao um nao apaga o que o outro gravou. */
    function carregarConta() {
      if (!auth.currentUser) return Promise.resolve(null);
      return Promise.all([
        contaRef().get(),
        contaRef().collection("treinos").orderBy("inicio", "desc").limit(50).get(),
      ]).then(function (r) {
        if (!r[0].exists) return null;
        var c = r[0].data();
        c.treinos = r[1].docs.map(function (d) { return d.data(); }).reverse();
        var pessoal = !c.bloqueada && c.tipoConta !== 'escola' && !c.beta;   // beta da XAG: sem teste gratis nem escola (21/11/2026)

        /* 1) sessao do simulador: nao depende dos outros dois. O erro dela e tratado no fim (este catch so evita o aviso
              de promessa sem tratamento quando outro pedido falha antes). */
        var sessao = pedirSessao();
        sessao.catch(function () {});

        /* 2) Horas que um instituto de ensino cadastrou para este e-mail (servidor/funcoes/escolas.js, acao receber): uma
              consulta por aba depois que o e-mail esta confirmado. Resolve com a lista recebida agora, ou null. */
        var escola = Promise.resolve(null);
        if (pessoal) {
          var chaveVagas = 'tpd_vagas_escola_' + auth.currentUser.uid, conferido = false;
          try { conferido = sessionStorage.getItem(chaveVagas) === '1'; } catch (e) { /* sem sessionStorage: consulta de novo */ }
          /* sem e-mail confirmado: de novo so depois de 10 min nesta aba (13/10/2026) */
          if (!conferido && Date.now() - (Number(lerDaAba("vagas_sem_confirmar")) || 0) < 10 * 60000) conferido = true;
          if (!conferido) escola = chamar('escolas', { acao: 'receber' }).then(function (r) {
            if (r.confirmado) try { sessionStorage.setItem(chaveVagas, '1'); } catch (e) { /* idem */ }
            else gravarNaAba("vagas_sem_confirmar", String(Date.now()));
            return r.recebidos && r.recebidos.length ? r.recebidos : null;
          }, function () { return null; });
        }

        /* 3) Teste gratis. 11/10/2026: o teste do XAG e separado do DJI; quem ja tem o do DJI pede o do XAG.
              13/10/2026: se o servidor ja respondeu nesta aba ha menos de 10 min sem liberar nada, nao pergunta de novo. */
        var faltaTeste = (!c.testeGratisEm || !c.testeXagEm) && pessoal, daAba = null;
        if (faltaTeste) {
          try { daAba = JSON.parse(lerDaAba("teste_conferido") || "null"); } catch (e) { daAba = null; }
          if (!(daAba && Date.now() - daAba.em < 10 * 60000)) daAba = null;
        }
        var tinhaXag = !!c.testeXagEm;
        var teste = faltaTeste && !daAba ? chamar("liberarTesteGratis", sinaisDoAparelho()) : Promise.resolve(null);

        return Promise.all([escola, teste]).then(function (v) {
          var recebidos = v[0], bonus = v[1];
          /* relida = a conta foi lida de novo DEPOIS dos dois pedidos (a escola entregou horas): o saldo dela ja e o final */
          function fechar(conta, relida) {
            if (bonus) {
              var liberou = !!bonus.concedido || (!!bonus.testeXagEm && !tinhaXag);
              gravarNaAba("teste_conferido", liberou ? null : JSON.stringify({ em: Date.now(), pendente: bonus.pendente || null, oferta: bonus.testeGratisMin }));
              if (!relida) conta.saldoMin = bonus.saldoMin;
              if (bonus.testeXagEm) { conta.testeXagEm = bonus.testeXagEm; conta.testeXagMin = bonus.testeXagMin; }
              if (bonus.testeGratisEm) {
                conta.testeGratisEm = bonus.testeGratisEm;
                conta.testeGratisMin = bonus.testeGratisMin;
              } else {
                /* Sem e-mail confirmado (ou caixa ja usada): o topo da pagina avisa. */
                conta.testeGratisPendente = bonus.pendente || null;
                conta.testeGratisOferta = bonus.testeGratisMin;
              }
            } else if (daAba && !conta.testeGratisEm) {
              conta.testeGratisPendente = daAba.pendente || null; conta.testeGratisOferta = daAba.oferta;
            }
            return padronizar(conta);
          }
          if (!recebidos) return fechar(c, false);
          return contaRef().get().then(function (d) {
            var novo = d.data(); novo.treinos = c.treinos; novo.horasEscolaRecebidas = recebidos;
            return fechar(novo, true);
          });
        }).then(function (pronta) { return sessao.then(function () { return pronta; }); });
      });
    }

    function logada() {
      return preparar().then(function () {
        if (!auth.currentUser) throw new Error("Entre na sua conta.");
      });
    }

    /* Link do Firebase para confirmar o e-mail; depois do clique, o botao
       Continuar volta para o Inicio. Dominio fora da lista do Firebase: manda sem a volta. */
    function enviarLinkConfirmacao() {
      var u = auth.currentUser;
      /* 09/10/2026: o link sai pelo nosso e-mail (mesmo remetente do "Esqueci a senha"), no idioma da pessoa;
         o do Firebase (noreply@...firebaseapp.com, em inglês) caía no spam. Se o nosso falhar, vai o do Firebase. */
      var idioma = (window.TPD_IDIOMAS && TPD_IDIOMAS.atual()) || "pt";
      return chamar("enviarConfirmacaoEmail", { idioma: idioma }).catch(function () {
        return u.sendEmailVerification({ url: PAGINA_INICIO }).catch(function (e) {
          if (e && /continue-uri|unauthorized-domain/.test(e.code || "")) return u.sendEmailVerification();
          throw e;
        });
      }).then(function () { lembrarLinkEnviado(u.email); });
    }

    return {
      iniciar: function () { return preparar().then(carregarConta); },

      /* Beta da XAG (21/11/2026): entra sem cadastro, com login anonimo, e o servidor (entrarBeta) confere o codigo
         do link e o limite de 3 navegadores. Quem esta logado com conta de verdade tem de sair antes. */
      entrarBeta: function (codigo, aparelho, idioma) {
        function pedir() { return funcoes.httpsCallable("entrarBeta")({ codigo: codigo, aparelho: aparelho, idioma: idioma }); }
        return preparar().then(function () {
          var u = auth.currentUser;
          if (u && !u.isAnonymous) { var e = new Error("Você está conectado com a sua conta do Guri dos Drones. Saia dela para abrir a versão beta."); e.code = "conta-normal"; throw e; }
          return u ? null : auth.signInAnonymously();
        }).then(pedir).catch(function (e) {
          var c = String((e && e.code) || "");
          /* login anonimo antigo encerrado (link desligado e ligado de novo, navegador trocado): um login novo e tenta UMA vez */
          if (/unauthenticated/.test(c) || (/permission-denied/.test(c) && /indispon/i.test(String(e.message || ""))) || /auth\/user-token-expired|auth\/user-disabled/.test(c))
            return auth.signOut().then(function () { return auth.signInAnonymously(); }).then(pedir);
          throw e;
        }).then(carregarConta).catch(function (e) {
          if (e && e.code === "conta-normal") throw e;
          throw new Error(traduzir(e));
        });
      },

      cadastrar: function (d) {
        return preparar()
          .then(function () { return auth.createUserWithEmailAndPassword(normalizarEmail(d.email), String(d.senha)); })
          .then(function (cred) {
            return banco.collection("contas").doc(cred.user.uid).set(Object.assign({
              nome: limparNome(d.nome), email: cred.user.email, pais: d.pais, estado: d.pais === 'BR' ? d.estado : '', criadaEm: new Date().toISOString(),
              termosEm: new Date().toISOString(), tipoConta: d.tipoConta || 'pessoal', nomeEscola: d.tipoConta === 'escola' ? limparNome(d.nomeEscola) : '',
              saldoMin: 0, minutosTreinados: 0, porDrone: {}, compras: [], controles: [], certificados: [],
            }, idiomaValido(d.idioma) ? { idioma: d.idioma } : {}));
          })
          .then(function () {
            /* O link de confirmacao ja sai no cadastro; se falhar, o aviso tem "Enviar link". */
            if (d.tipoConta !== 'escola') return enviarLinkConfirmacao().catch(function () {});
          })
          .then(carregarConta)
          .catch(function (e) { throw new Error(traduzir(e)); });
      },

      entrar: function (email, senha) {
        return preparar()
          .then(function () { return auth.signInWithEmailAndPassword(normalizarEmail(email), String(senha || "")); })
          .then(carregarConta)
          .catch(function (e) { throw new Error(traduzir(e)); });
      },

      /* Entrar com Google (11/10/2026). Janela do Google (popup). Mesmo e-mail de uma conta com senha = mesma conta.
         Primeira vez (sem contas/{uid}): devolve null e a pagina leva para completar o cadastro.
         30/10/2026: aberto pelo icone da tela de inicio ou no navegador de dentro de outro app, nao ha janela de
         verdade (o iPhone abria o Google solto e dava "missing initial state"); ali, e se a janela for bloqueada,
         vai ao Google na propria aba e volta para a mesma pagina, que entra pelo CONTAS.iniciar/loginSemCadastro.
         So quando o login mora no proprio endereco (config.js), senao a volta perde o login como antes. */
      entrarComGoogle: function () {
        var p;
        function naAba() {
          return auth.signInWithRedirect(p).then(function () { return new Promise(function () { /* a pagina vai ao Google */ }); });
        }
        return preparar()
          .then(function () {
            p = new fb.auth.GoogleAuthProvider();
            p.setCustomParameters({ prompt: "select_account" });
            if (googleNaAba()) return naAba();
            return auth.signInWithPopup(p).catch(function (e) {
              var c = (e && e.code) || "";
              if (googleNaAbaPossivel() && (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment" || c === "auth/web-storage-unsupported")) return naAba();
              throw e;
            });
          })
          .then(carregarConta)
          .catch(function (e) { throw new Error(traduzir(e)); });
      },
      /* Logado no Firebase, mas sem a conta do treinamento (entrou pelo Google e nao completou).
         Voltando do Google pela propria aba, um erro de la (conta, rede) aparece aqui. */
      loginSemCadastro: function () {
        return preparar().then(function () {
          return googleNaAbaPossivel() ? auth.getRedirectResult().catch(function (e) { throw new Error(traduzir(e)); }) : null;
        }).then(function () {
          var u = auth.currentUser;
          if (!u) return null;
          return { email: u.email || "", nome: u.displayName || "",
            google: (u.providerData || []).some(function (p) { return p && p.providerId === "google.com"; }) };
        });
      },
      completarCadastroGoogle: function (d) {
        return logada()
          .then(function () {
            var u = auth.currentUser;
            if (!u.emailVerified || !u.email) throw new Error("Esta conta do Google não tem e-mail confirmado. Crie a conta com e-mail e senha.");
            return contaRef().set(Object.assign({
              nome: limparNome(d.nome), email: u.email, pais: d.pais, estado: d.pais === 'BR' ? d.estado : '', criadaEm: new Date().toISOString(),
              termosEm: new Date().toISOString(), tipoConta: 'pessoal', nomeEscola: '',
              saldoMin: 0, minutosTreinados: 0, porDrone: {}, compras: [], controles: [], certificados: [],
            }, idiomaValido(d.idioma) ? { idioma: d.idioma } : {}));
          })
          .then(carregarConta)
          .catch(function (e) { throw new Error(traduzir(e)); });
      },

      /* Esqueci a senha: o servidor gera o codigo, manda por e-mail e confere
         (servidor/funcoes/index.js). A resposta de pedir e a mesma exista ou
         nao a conta, para ninguem descobrir quais e-mails tem cadastro. */
      pedirCodigoSenha: function (email) { return chamar("senhaPedirCodigo", { email: email }); },
      conferirCodigoSenha: function (email, codigo) { return chamar("senhaConferirCodigo", { email: email, codigo: codigo }); },
      criarOutraSenha: function (email, codigo, senha) {
        return chamar("senhaCriarOutra", { email: email, codigo: codigo, senha: senha });
      },
      /* O servidor nao guarda a senha de ninguem, so um resumo que nao volta
         atras. Por isso, com contas de verdade, nao ha o que revelar. */
      revelarSenha: function () {
        return falha("Por segurança a senha não fica guardada, então não dá para mostrar. Escolha Criar outra senha.");
      },

      /* administracao: so o servidor le as contas de todo mundo */
      escolas: function (dados) { return chamar('escolas', dados); },
      comprarEscola: function (horas) { return chamar('criarPagamento', {pacote:'escola',horas:horas}); },
      adminRelatorioEstados: function () { return chamar("adminRelatorioEstados"); },
      adminPainel: function () { return chamar("adminPainel"); },
      adminManutencao: function (dados) { return chamar("adminManutencao", dados); },
      adminTempoNovos: function (dados) { return chamar("adminTempoNovos", dados); },
      adminRelatorioCadastros: function () { return chamar("adminRelatorioCadastros", {}); },
      adminTestesRepetidos: function (dados) { return chamar("adminTestesRepetidos", dados); },
      adminVitrineEscolas: function (dados) { return chamar("adminVitrineEscolas", dados); },
      adminSugestoesDrones: function () { return chamar("adminSugestoesDrones", {}); },
      dadosEscola: function (dados) { return chamar("dadosEscola", dados); },
      /* Pela regra /api/escolasPublicas do Hosting, com o login: so conta do Brasil
         (ou administrador) recebe a lista (10/10/2026). erro.codigo = "login" | "pais". */
      escolasPublicas: function () {
        return logada().then(function () { return auth.currentUser.getIdToken(); }, function () {
          throw recusaEscolas("login");
        }).then(function (token) {
          return fetch("/api/escolasPublicas", { headers: { Accept: "application/json", Authorization: "Bearer " + token } })
            .catch(function () { throw new Error("Sem conexão com o servidor. Verifique a internet."); });
        }).then(function (r) {
          if (r.status === 401) throw recusaEscolas("login");
          if (r.status === 403) throw recusaEscolas("pais");
          if (r.status === 503) throw new Error("A lista está indisponível no momento. Tente de novo em alguns minutos.");
          if (!r.ok) throw new Error("Não foi possível carregar a lista de escolas.");
          return r.json();
        });
      },
      /* enviar = true manda o link; false confere se ja foi clicado (token novo). */
      confirmarEmail: function (enviar) {
        return logada().then(function () {
          if (enviar) return enviarLinkConfirmacao().then(function () { return false; });
          var u = auth.currentUser;
          return u.reload().then(function () { return u.getIdToken(true); }).then(function () { return u.emailVerified; });
        }).catch(function (e) { throw new Error(traduzir(e)); });
      },
      adminAutorizarGratisCertificado: function (uid, autorizar) { return chamar('adminAutorizarGratisCertificado', {uid:uid,autorizar:autorizar}); },
      adminAcessoVitalicio: function (uid, ativar, motivo) { return chamar('adminAcessoVitalicio', {uid:uid,ativar:ativar,motivo:motivo}); },
      adminVagasEscola: function (dados) { return chamar('adminVagasEscola', dados); },
      adminConta: function (uid) { return chamar("adminConta", { uid: uid }); },
      adminAjustarHoras: function (uid, minutos, motivo, operacao) { return chamar("adminAjustarHoras", Object.assign({ uid: uid, minutos: minutos, motivo: motivo }, operacao ? { operacao: operacao } : {})); },
      adminBloquear: function (uid, bloquear) { return chamar("adminBloquear", { uid: uid, bloquear: bloquear }); },
      adminExcluirConta: function (uid) { return chamar("adminExcluirConta", { uid: uid, confirmacao: "EXCLUIR" }); },

      sair: function () {
        sessaoServidorAte = 0;
        gravarNaAba("sessao_sim_ate", null);
        gravarNaAba("teste_conferido", null);
        return preparar().then(function () { return auth.signOut(); }).then(function () {
          if (CFG.protegerArquivos) return fetch('/api/sessaoSimulador', {method:'DELETE', credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('Feche o navegador para concluir a saída.');});
        });
      },

      registrarCliqueOfertaTeste: function (evento) { return chamar("registrarCliqueOfertaTeste", { evento: evento }); },
      sugerirDrone: function (dados) { return chamar("sugerirDrone", dados); },
      adminCompartilharDrone: function (dados) { return chamar("adminCompartilharDrone", dados); },
      adminListarCompartilhados: function (dados) { return chamar("adminListarCompartilhados", dados); },
      avaliarTeste: function (dados) { return chamar("avaliarTeste", dados); },
      /* devolve o endereco do Checkout Pro; a pagina redireciona */
      comprar: function (pacote) {
        return chamar("criarPagamento", pacote.certificado ? { certificado: true } : { pacote: pacote.id, horas: pacote.horas, oferta: pacote.oferta || null }).then(function (r) { return { redirecionar: r.url }; });
      },
      /* Pix pela nossa tela (11/10/2026): { pedido, pix: { copiaECola, qr (base64), expiraEm, valor } } */
      comprarPix: function (pacote) {
        return chamar("criarPagamento", pacote.certificado ? { certificado: true, forma: "pix" } : { pacote: pacote.id, horas: pacote.horas, oferta: pacote.oferta || null, forma: "pix" })
          .then(function (r) { return r.pix ? r : { redirecionar: r.url }; });   // desconto ja aberto pelo Checkout Pro: segue o mesmo link
      },
      conferirPagamento: function (pedido) { return chamar("conferirPagamento", { pedido: pedido }); },
      /* Cartao na nossa pagina (11/10/2026): so o token do formulario do Mercado Pago -> { pedido, status, detalhe } */
      pagarCartao: function (pacote, cartao) {
        return chamar("criarPagamento", pacote.certificado ? { certificado: true, forma: "cartao", cartao: cartao } : { pacote: pacote.id, horas: pacote.horas, oferta: pacote.oferta || null, forma: "cartao", cartao: cartao })
          .then(function (r) { return r.url ? { redirecionar: r.url } : r; });
      },
      /* Dolar dentro da nossa pagina (Stripe Embedded Checkout) -> { pedido, clientSecret } */
      comprarDolarEmbutido: function (pacoteId) {
        return chamar("criarPagamentoDolar", pacoteId === "certificado" ? { certificado: true, embutido: true } : { pacote: pacoteId, embutido: true }).then(function (r) { return r.clientSecret ? r : { redirecionar: r.url }; });
      },
      comprarDolar: function (pacoteId) {
        return chamar("criarPagamentoDolar", pacoteId === "certificado" ? { certificado: true } : { pacote: pacoteId }).then(function (r) { return { redirecionar: r.url }; });
      },

      comprarMapa: function (m) {
        return chamar("criarPagamento", { mapa: m.id, nome: m.nome }).then(function (r) { return { redirecionar: r.url }; });
      },

      /* O envio do arquivo do mapa para o servidor ainda nao foi ligado
         (precisa do Firebase Storage e da tela de aprovacao). */
      mapasDaConta: function (dados) { return logada().then(function () { return chamar('mapasDaConta', dados); }); },
      verificarEmailMapas: function (enviar) { return logada().then(async function () { if(enviar){await auth.currentUser.sendEmailVerification();return false;}await auth.currentUser.reload();await auth.currentUser.getIdToken(true);return auth.currentUser.emailVerified; }); },
      financeiroMapas: function (dados) { return logada().then(function () { return chamar('financeiroMapas', dados); }); },
      anunciarMapa: function (dados) { return chamar('mapasDaConta', {acao:'anunciar',mapa:dados.dados,origemId:dados.origemId||null,autorizacao:dados.autorizacao}).then(carregarConta); },
      removerAnuncio: function (id) { return chamar('mapasDaConta', {acao:'retirarAnuncio',id:id}).then(carregarConta); },

      autorizarMapeamento: function (droneId) {
        return chamar("autorizarMapeamento", { drone: droneId });
      },

      iniciarTreino: function (droneId, controle) {
        return chamar("iniciarTreino", { drone: droneId, controle: controle });
      },

      registrarMinuto: function (treino) {
        /* Acesso vitalicio: o saldo nao acaba (Infinity); o medidor mostra "Vitalício". */
        return chamar("registrarMinuto", { treino: treino }).then(function (r) { return r.vitalicio ? Infinity : r.saldoMin; });
      },

      registrarControle: function (codigo, apelido) {
        return logada().then(function () {
          var ref = banco.collection("controles").doc(codigo);
          return ref.get().then(function (doc) {
            if (doc.exists) {
              throw new Error(doc.data().uid === auth.currentUser.uid
                ? "Este controle já está registrado na sua conta."
                : "Este controle já está registrado em outra conta.");
            }
            return contaRef().get();
          }).then(function (c) {
            var lista = (c.data().controles || []).slice();
            lista.push({ codigo: codigo, apelido: apelido || "Controle " + (lista.length + 1), em: new Date().toISOString() });
            var lote = banco.batch();
            lote.set(ref, { uid: auth.currentUser.uid, em: new Date().toISOString() });
            lote.update(contaRef(), { controles: lista });
            return lote.commit();
          }).then(carregarConta);
        }).catch(function (e) { throw new Error(traduzir(e)); });
      },

      guardarIdioma: function (v) {
        return logada().then(function () { return contaRef().update({ idioma: v }); });
      },

      informarPais: function (pais, estado) {
        return logada().then(function () {
          return contaRef().update({ pais: pais, estado: pais === 'BR' ? estado : '' });
        }).then(carregarConta).catch(function (e) { throw new Error(traduzir(e)); });
      },

      removerControle: function (codigo) {
        return logada().then(function () { return contaRef().get(); }).then(function (c) {
          var lote = banco.batch();
          lote.delete(banco.collection("controles").doc(codigo));
          lote.update(contaRef(), { controles: (c.data().controles || []).filter(function (x) { return x.codigo !== codigo; }) });
          return lote.commit();
        }).then(carregarConta).catch(function (e) { throw new Error(traduzir(e)); });
      },

      emitirCertificado: function (nome, cpf) { return chamar("emitirCertificado", { nome: nome, cpf: cpf || "" }); },
      adminProtegerCertificados: function () { return chamar("adminProtegerCertificados", {}); },

      consultarCertificado: function (codigo) {
        return preparar().then(function () { return banco.collection("certificados").doc(codigo).get(); })
          .then(function (d) { return d.exists ? d.data() : null; })
          .catch(function (e) { throw new Error(traduzir(e)); });
      },
    };
  }

  var motor = MODO === "firebase" ? motorFirebase() : motorLocal();

  /* ============================================ conta guardada na aba
     25/10/2026 (troca de pagina lenta). Cada pagina da conta comecava do zero: conexao nova com o Firestore,
     leitura da conta e de 50 treinos, e so entao desenhava o topo e os dados (1 a 2 s em celular, a cada clique).
     Agora, nas paginas de navegacao (PAGINAS_COM_CONTA_DA_ABA), a ultima conta lida NESTA ABA (sessionStorage,
     some ao fechar a aba) desenha a pagina na hora e o servidor confere por tras:
       - o servidor diz que nao ha mais sessao  -> vai para o login, como antes;
       - a conta mudou (assinaturaDaConta)       -> a pagina recarrega uma vez, ja com a conta nova;
       - sem rede ou servidor fora               -> segue com a da aba.
     A conta da aba vale 2 min e e APAGADA em toda escrita feita por este site (qualquer chamada do motor, menos
     as de leitura), no login e no logout: depois de treinar, comprar, confirmar e-mail ou trocar o pais, a
     proxima pagina le do servidor, como sempre foi. Fora do atalho: retorno de pagamento (?pedido, ?pagamento),
     conta de escola, conta bloqueada, administracao e o simulador (esses usam o servidor direto). */
  var CHAVE_CONTA_ABA = "tpd_conta_aba", CHAVE_RECARGA_ABA = "tpd_conta_aba_recarga";
  /* 12/11/2026 (Eduardo: "as trocas de páginas tão lentas demais"): 2 min fazia quase toda troca cair no caminho lento
     (Firebase + login + conta, 1,5 a 3 s). 30 min: o servidor continua conferindo por trás em toda página e recarrega
     se a conta mudou, e toda escrita deste site continua apagando a conta da aba. */
  var VALIDADE_CONTA_ABA = 30 * 60000, INTERVALO_RECARGA_ABA = 30000;
  var PAGINAS_COM_CONTA_DA_ABA = /\/(inicio|drones|creditos|certificado|gerar)\.html$/;
  var escritasDaPagina = 0;   // sobe a cada escrita: uma leitura que comecou antes dela nao pode guardar a conta velha

  function apagarContaDaAba() { try { sessionStorage.removeItem(CHAVE_CONTA_ABA); } catch (e) { /* sem sessionStorage: sem atalho */ } }
  function sujarContaDaAba() { escritasDaPagina++; apagarContaDaAba(); }
  function guardarContaNaAba(c, escritasAntes) {
    if (MODO !== "firebase") return;
    if (!c || escritasAntes !== escritasDaPagina) { apagarContaDaAba(); return; }
    try { sessionStorage.setItem(CHAVE_CONTA_ABA, JSON.stringify({ v: 1, em: Date.now(), conta: c })); }
    catch (e) { apagarContaDaAba(); /* cheio ou bloqueado: sem atalho */ }
  }
  function contaRapidaDaAba() {
    if (MODO !== "firebase" || !PAGINAS_COM_CONTA_DA_ABA.test(location.pathname) || /[?&](pedido|pagamento)=/.test(location.search)) return null;
    try {
      var g = JSON.parse(sessionStorage.getItem(CHAVE_CONTA_ABA) || "null"), idade = g ? Date.now() - g.em : -1;
      if (!g || g.v !== 1 || !(idade >= 0 && idade < VALIDADE_CONTA_ABA)) return null;
      var c = g.conta;
      if (!c || !c.email || !c.nome || c.tipoConta === "escola" || c.bloqueada) return null;
      return g;
    } catch (e) { return null; }
  }
  /* O que as paginas mostram ou decidem com a conta: se isto mudou, a pagina desenhada esta velha. */
  function assinaturaDaConta(c) {
    var t = c.treinos || [], u = t[t.length - 1] || {};
    return JSON.stringify([c.email, c.saldoMin, c.minutosTreinados, t.length, u.inicio, u.minutos,
      (c.compras || []).length, (c.certificados || []).length, (c.controles || []).length, (c.mapas || []).length,
      c.admin === true, !!c.bloqueada, c.tipoConta, c.pais, c.estado, c.idioma, !!c.acessoVitalicio,
      c.testeGratisEm, c.testeXagEm, c.testeGratisPendente || null, c.previas || null,
      (c.horasEscolaRecebidas || []).length, c.certificadoLiberadoEm || null]);
  }
  /* Toda chamada do motor que nao e so leitura apaga a conta da aba antes de sair e de novo quando termina. */
  if (MODO === "firebase") {
    var SO_LEITURA = { iniciar: 1, consultarCertificado: 1, escolasPublicas: 1 };
    Object.keys(motor).forEach(function (nome) {
      var original = motor[nome];
      if (typeof original !== "function" || SO_LEITURA[nome]) return;
      motor[nome] = function () {
        sujarContaDaAba();
        var r = original.apply(motor, arguments);
        if (r && typeof r.then === "function") r.then(sujarContaDaAba, sujarContaDaAba);
        return r;
      };
    });
  }

  /* ------------------------------------------------------------ interface */

  var contaAtual = null;
  function guardar(c) { contaAtual = c; aplicarIdiomaDaConta(c); return c; }

  /* Idioma da conta (08/10/2026): ao entrar, o site e o simulador mudam para o idioma gravado na conta;
     trocar no seletor com a pessoa logada grava o novo idioma. */
  function idiomaValido(v) { return v === 'pt' || v === 'en' || v === 'es'; }
  function aplicarIdiomaDaConta(c) {
    try {
      if (c && idiomaValido(c.idioma) && window.TPD_IDIOMAS && TPD_IDIOMAS.atual() !== c.idioma) TPD_IDIOMAS.definir(c.idioma);
    } catch (e) { /* segue no idioma atual */ }
  }
  window.addEventListener('tpd:idioma', function (ev) {
    var v = ev && ev.detail && ev.detail.idioma;
    if (!contaAtual || !idiomaValido(v) || contaAtual.idioma === v || !motor.guardarIdioma) return;
    contaAtual.idioma = v;
    motor.guardarIdioma(v).catch(function () { /* fica só neste aparelho */ });
  });

  /* Carrega a conta logada (ou null). Toda pagina comeca por aqui. */
  function iniciar() {
    var escritasAntes = escritasDaPagina;
    return motor.iniciar().then(function (c) { guardar(c); guardarContaNaAba(c, escritasAntes); return c; });
  }
  function recarregar() { return iniciar(); }

  function irParaOLogin(paginaDeLogin) {
    location.replace((paginaDeLogin || "index.html") + "?volta=" + encodeURIComponent(location.pathname + location.search));
  }

  /* Pagina desenhada na hora com a conta da aba; o servidor confere depois que ela pintou (o Firebase baixa
     e compila na mesma hora, e isso nao pode atrasar o primeiro desenho). */
  function exigirComContaDaAba(guardada, paginaDeLogin) {
    var c = guardar(guardada.conta), assinatura = assinaturaDaConta(c);
    pedirPais(c);
    function conferirNoServidor() {
      var escritasAntes = escritasDaPagina;
      iniciar().then(function (nova) {
        if (!nova) { irParaOLogin(paginaDeLogin); return; }
        if (escritasAntes !== escritasDaPagina || assinaturaDaConta(nova) === assinatura) return;
        /* A conta mudou desde que a aba a guardou. Recarrega uma vez (ja com a conta nova na aba); se acabou de
           recarregar, so atualiza o que o topo mostra, para nunca ficar em laco. */
        var ultima = 0;
        try { ultima = Number(sessionStorage.getItem(CHAVE_RECARGA_ABA)) || 0; } catch (e) { ultima = Date.now(); }
        if (Date.now() - ultima < INTERVALO_RECARGA_ABA) { atualizarSaldo(nova); avisoTesteGratis(nova); return; }
        try { sessionStorage.setItem(CHAVE_RECARGA_ABA, String(Date.now())); } catch (e) { /* idem */ }
        location.reload();
      }, function () { /* sem rede ou servidor fora do ar: a pagina segue com a conta da aba */ });
    }
    /* Comeca depois do primeiro desenho; o relogio de 1,5 s garante a conferencia mesmo se o navegador nao
       entregar o quadro (aba ou painel escondido, navegador de TV ou de oculos): nunca fica sem conferir. */
    var conferido = false;
    function conferirUmaVez() { if (conferido) return; conferido = true; conferirNoServidor(); }
    var depoisDoDesenho = function () { setTimeout(conferirUmaVez, 0); };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(depoisDoDesenho); else depoisDoDesenho();
    setTimeout(conferirUmaVez, 1500);
    return Promise.resolve(c);
  }

  /* Para paginas que so abrem logado: sem conta, vai para o login. */
  function irParaOBeta(c) {
    if (!c || !c.beta || /\/beta\.html$/.test(location.pathname)) return false;
    location.replace((/\/conta\//.test(location.pathname) ? "" : "conta/") + "beta.html");
    return true;
  }
  function exigir(paginaDeLogin) {
    var guardada = contaRapidaDaAba();
    if (guardada && irParaOBeta(guardada.conta)) return new Promise(function () {});
    if (guardada) return exigirComContaDaAba(guardada, paginaDeLogin);
    return iniciar().then(function (c) {
      if (!c) {
        irParaOLogin(paginaDeLogin);
        return new Promise(function () {});   // a pagina para aqui
      }
      if (irParaOBeta(c)) return new Promise(function () {});
      if (c.tipoConta === 'escola' && !/\/(empresa|admin)\.html$/.test(location.pathname)) {
        location.replace('empresa.html');
        return new Promise(function () {});
      }
      pedirPais(c);
      return c;
    });
  }

  /* Conta antiga com país "Outro": a pessoa informa o país, que tem de existir. */
  function informarPais(nome, estado) {
    var codigo = codigoDoPais(nome);
    if (!codigo) return falha("Não encontramos esse país. Confira o nome (por exemplo: Alemanha, Japão, Portugal).");
    if (codigo === 'BR' && !ESTADOS.some(function (e) { return e[0] === estado; })) return falha("Escolha o estado onde você mora.");
    return motor.informarPais(codigo, codigo === 'BR' ? estado : '').then(guardar);
  }

  function cadastrar(d) {
    var erro = validarCadastro(d);
    return erro ? falha(erro) : motor.cadastrar(d).then(guardar);
  }

  /* 12/11/2026: a conta que acabou de chegar do servidor no login fica guardada na aba, para o Inicio abrir na hora
     (antes o login apagava a conta da aba e o Inicio sempre fazia o caminho lento). O motor apaga a conta da aba quando
     a chamada termina; este .then roda depois disso. */
  function guardarDepoisDoLogin(c) {
    guardar(c);
    if (c && c.email && c.nome && c.tipoConta !== "escola" && !c.bloqueada) guardarContaNaAba(c, escritasDaPagina);
    return c;
  }
  function entrar(email, senha) { return motor.entrar(email, senha).then(guardarDepoisDoLogin); }
  /* Google (11/10/2026): null = primeira vez, completar em cadastro.html?google=1 */
  function entrarComGoogle() { return motor.entrarComGoogle().then(function (c) { return c ? guardarDepoisDoLogin(c) : null; }); }
  function completarCadastroGoogle(d) {
    var erro = validarCadastro(Object.assign({}, d, { tipoConta: 'pessoal' }), true);
    return erro ? falha(erro) : motor.completarCadastroGoogle(d).then(guardar);
  }
  /* Esqueci a senha: e-mail -> codigo -> revelar ou criar outra. */
  function codigoLimpo(codigo) { return String(codigo || "").replace(/\D/g, ""); }

  function pedirCodigoSenha(email) {
    email = normalizarEmail(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return falha("Digite o e-mail da sua conta.");
    return motor.pedirCodigoSenha(email);
  }

  function conferirCodigoSenha(email, codigo) {
    codigo = codigoLimpo(codigo);
    if (codigo.length !== 6) return falha("O código tem 6 números.");
    return motor.conferirCodigoSenha(normalizarEmail(email), codigo);
  }

  function revelarSenha(email, codigo) {
    return motor.revelarSenha(normalizarEmail(email), codigoLimpo(codigo));
  }

  function criarOutraSenha(email, codigo, senha) {
    if (String(senha || "").length < 6) return falha("A senha precisa ter pelo menos 6 caracteres.");
    return motor.criarOutraSenha(normalizarEmail(email), codigoLimpo(codigo), String(senha));
  }

  function sair() { contaAtual = null; sujarContaDaAba(); return motor.sair(); }
  function entrarBeta(codigo, aparelho, idioma) {
    if (!motor.entrarBeta) return falha("A versão beta só funciona no site.");
    sujarContaDaAba();
    return motor.entrarBeta(codigo, aparelho, idioma).then(guardar);
  }

  /* demonstracao: { conta }   firebase: { redirecionar: url do Mercado Pago } */
  /* Liberacao do certificado (24/10/2026): o "pacote" vira um item sem horas, com o valor do certificado da conta
     (R$ 800; R$ 200 com horas de instituicao de ensino) ou em dolar (US$ 150, nao vale para instituicao). */
  function certificadoPendenteDaConta(c) {
    var lista = (c && c.certificados) || [], cert = lista[lista.length - 1];
    return cert && cert.situacao === "valido" && cert.liberado === false && !c.certificadoLiberadoEm ? cert : null;
  }
  function certificadoDeInstituicao(cert) { return !!(cert && cert.instituicoes && cert.instituicoes.length); }
  function pacoteCertificado(c, dolar) {
    var cert = certificadoPendenteDaConta(c);
    if (!cert) return null;
    if (dolar && certificadoDeInstituicao(cert)) return null;
    return { id: "certificado", horas: 0, certificado: true,
      preco: dolar ? CERTIFICADO.usd : (certificadoDeInstituicao(cert) ? CERTIFICADO.brlInstituicao : CERTIFICADO.brl) };
  }
  function acharPacote(pacoteId, horas) {
    if (pacoteId === "certificado") return pacoteCertificado(contaAtual, false);
    return pacoteId === "personalizado" ? pacotePersonalizado(horas) : PACOTES.filter(function (p) { return p.id === pacoteId; })[0];
  }

  function comprar(pacoteId, oferta, horas) {
    var pacote = acharPacote(pacoteId, horas);
    if (!pacote) return falha("Pacote inválido.");
    if (oferta) {
      if (oferta !== "teste30" || pacote.id !== "h10") return falha("Oferta inválida.");
      pacote = Object.assign({}, pacote, { preco: Math.round(pacote.preco * 70) / 100, oferta: oferta });
    }
    return motor.comprar(pacote).then(function (r) { if (r.conta) guardar(r.conta); return r; });
  }

  /* Saldo que vale para cada drone (11/10/2026, igual ao servidor, saldoParaDrone): no XAG, o teste do XAG
     mais as horas pagas; o gratis do DJI nao vale no XAG. Nos outros, o saldo inteiro. */
  var DRONES_XAG = ["p60", "p150", "p150max", "p100pro"];
  function saldoDaMarca(c, droneId) {
    if (!c) return 0;
    if (DRONES_XAG.indexOf(droneId) < 0) return Math.max(0, Number(c.saldoMin) || 0);
    return Math.max(0, Number(c.testeXagMin) || 0) + Math.max(0, Math.round(HC.resumo(c).saldoPagoMin || 0));
  }

  /* Pix pela nossa tela, sem ir ao Mercado Pago (11/10/2026). */
  function comprarPix(pacoteId, oferta, horas) {
    var pacote = acharPacote(pacoteId, horas);
    if (!pacote) return falha("Pacote inválido.");
    if (oferta) {
      if (oferta !== "teste30" || pacote.id !== "h10") return falha("Oferta inválida.");
      pacote = Object.assign({}, pacote, { preco: Math.round(pacote.preco * 70) / 100, oferta: oferta });
    }
    return motor.comprarPix(pacote).then(function (r) { if (r.conta) guardar(r.conta); return r; });
  }
  function conferirPagamento(pedido) { return motor.conferirPagamento(pedido); }
  function pacoteDaCompra(pacoteId, oferta, horas) {
    var pacote = acharPacote(pacoteId, horas);
    if (pacote && oferta) pacote = (oferta === "teste30" && pacote.id === "h10") ? Object.assign({}, pacote, { preco: Math.round(pacote.preco * 70) / 100, oferta: oferta }) : null;
    return pacote;
  }
  function pagarCartao(pacoteId, oferta, horas, cartao) {
    var pacote = pacoteDaCompra(pacoteId, oferta, horas);
    if (!pacote) return falha("Pacote inválido.");
    return motor.pagarCartao(pacote, cartao).then(function (r) { if (r.conta) guardar(r.conta); return r; });
  }
  function comprarDolarEmbutido(pacoteId) {
    if (!PRECO_DOLAR[pacoteId] && !(pacoteId === "certificado" && pacoteCertificado(contaAtual, true))) return falha("Pacote inválido.");
    return motor.comprarDolarEmbutido(pacoteId).then(function (r) { if (r.conta) guardar(r.conta); return r; });
  }

  /* Fora do Brasil: em dólar, pela Stripe. Na demonstração, igual à compra comum. */
  function comprarDolar(pacoteId) {
    if (!PRECO_DOLAR[pacoteId] && !(pacoteId === "certificado" && pacoteCertificado(contaAtual, true))) return falha("Pacote inválido.");
    if (MODO !== "firebase") return comprar(pacoteId);
    return motor.comprarDolar(pacoteId);
  }
  function formatarDolar(v) {
    return "US$ " + Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  /* conta pessoal de quem mora fora do Brasil (com o país informado) */
  function pagaEmDolar(c) { return !!c && c.tipoConta !== "escola" && !!c.pais && c.pais !== "BR" && c.pais !== "OUTRO"; }

  /* { treino, saldoMin } */
  /* ------------------------------------------------------ loja de mapas */

  /* preco de um mapa pela area, em reais inteiros */
  function precoDoMapa(areaHa) {
    return Math.round((Number(areaHa) || 0) * MAPAS.precoPorHectare);
  }

  /* Os mapas reais a venda: [{ id, nome, nivel, desc, area, preco, vendedor, miniatura }].
     A miniatura e gravada por ferramentas/miniaturas_mapas.py. */
  function listarMapas() {
    var pasta = /\/conta\/[^/]*$/.test(location.pathname) ? "../cenarios/" : "cenarios/";
    /* So vai a venda o mapa cujo id esta em cenarios/loja.json ("liberados").
       Mapa novo do gerador nasce bloqueado. */
    var liberados = fetch(pasta + "loja.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { return (d && d.liberados) || []; })
      .catch(function () { return []; });
    return Promise.all([fetch(pasta + "lista.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }), liberados])
      .then(function (r) {
        var lista = r[0], lib = r[1];
        return (lista || []).filter(function (m) {
          return m && /^real-[a-z0-9-]{1,80}$/.test(m.id || "") && lib.indexOf(m.id) !== -1 &&
            Number(m.area_ha) > 0 && Number(m.area_ha) <= MAPAS.limiteHectares;
        }).map(function (m) {
          return {
            id: m.id,
            nome: m.nome || m.id,
            nivel: Array.isArray(m.nivel) ? String(m.nivel[0] || "") : String(m.nivel || ""),
            desc: m.desc || "",
            area: Number(m.area_ha),
            preco: precoDoMapa(m.area_ha),
            vendedor: m.vendedor || "Guri dos Drones",
            miniatura: pasta + String(m.arquivo || "").replace(/\.cenario\.json$/, "") + ".miniatura.jpg",
          };
        });
      });
  }

  /* m = um item de listarMapas() */
  function comprarMapa(m) {
    if (!m || !/^real-[a-z0-9-]{1,80}$/.test(m.id || "")) return falha("Mapa inválido.");
    return motor.comprarMapa({ id: m.id, nome: String(m.nome || m.id).slice(0, 60), preco: m.preco })
      .then(function (r) { if (r.conta) guardar(r.conta); return r; });
  }

  /* -------------------------------------------------- vender meu mapa */

  function semAcento(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  /* figurinha da foto aerea, pequena o bastante para guardar na conta */
  function miniaturaDe(textura) {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 480 / Math.max(img.width, img.height));
        var tela = document.createElement("canvas");
        tela.width = Math.max(1, Math.round(img.width * k));
        tela.height = Math.max(1, Math.round(img.height * k));
        tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
        try { ok(tela.toDataURL("image/jpeg", 0.72)); } catch (e) { ok(""); }
      };
      img.onerror = function () { ok(""); };
      img.src = textura;
    });
  }

  /* Le o .cenario.json escolhido, confere e devolve
     { id, nome, desc, nivel, area, preco, miniatura }. Nao envia nada. */
  function lerArquivoDeMapa(arquivo, conta) {
    if (!arquivo) return falha("Escolha o arquivo do mapa.");
    if (arquivo.size > 60 * 1024 * 1024) return falha("Arquivo grande demais (mais de 60 MB).");
    return new Promise(function (ok, erro) {
      var leitor = new FileReader();
      leitor.onload = function () { ok(String(leitor.result)); };
      leitor.onerror = function () { erro(new Error("Não foi possível ler o arquivo.")); };
      leitor.readAsText(arquivo);
    }).then(function (texto) {
      var d;
      try { d = JSON.parse(texto); } catch (e) { throw new Error("Este arquivo não é um mapa: não deu para ler como .cenario.json."); }
      if (!d || d.formato !== "xguri-cenario-real" || !d.area || !d.relevo || !d.textura || !Array.isArray(d.talhao)) {
        throw new Error("Este arquivo não é um mapa do Gerador de Mapas Reais (.cenario.json).");
      }
      var area = Number(d.area.larg) * Number(d.area.prof) / 10000;
      if (!(area > 0)) throw new Error("O mapa está sem a área. Exporte de novo pelo gerador.");
      area = Math.round(area * 10) / 10;
      if (area > MAPAS.limiteHectares) {
        throw new Error("Este mapa tem " + String(area).replace(".", ",") + " ha. O limite é de " + MAPAS.limiteHectares + " hectares.");
      }
      var usado = ((conta && conta.anuncios) || []).reduce(function (s, x) { return s + x.area; }, 0);
      if (usado + area > MAPAS.limiteHectares + 1e-6) {
        throw new Error("Com este mapa você passaria de " + MAPAS.limiteHectares + " hectares à venda. Hoje você tem " +
          String(Math.round(usado * 10) / 10).replace(".", ",") + " ha enviados.");
      }
      var nome = limparNome(d.nome || arquivo.name.replace(/\.cenario\.json$|\.json$/i, "")).slice(0, 60);
      var id = "real-" + (semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "mapa");
      return miniaturaDe(d.textura).then(function (mini) {
        return {
          id: id, nome: nome, desc: "",
          nivel: Array.isArray(d.nivel) ? String(d.nivel[0] || "") : String(d.nivel || ""),
          area: area, preco: precoDoMapa(area), miniatura: mini, dados: d,
        };
      });
    });
  }

  /* mapa = o que lerArquivoDeMapa devolveu */
  function anunciarMapa(mapa, nome, desc, autorizacao) {
    if (MODO !== 'firebase') return falha('Entre com sua conta online para enviar documentos de venda. A demonstração não recebe documentos pessoais.');
    nome = limparNome(nome).slice(0, 60);
    if (nome.length < 3) return falha("Dê um nome para o mapa.");
    if (!mapa || !(mapa.area > 0) || mapa.area > MAPAS.limiteHectares) return falha("Escolha o arquivo do mapa.");
    return motor.anunciarMapa({
      id: mapa.id, nome: nome, desc: limparNome(desc).slice(0, 160), nivel: mapa.nivel,
      area: mapa.area, preco: precoDoMapa(mapa.area), miniatura: mapa.miniatura,
      dados: Object.assign({}, mapa.dados, {nome:nome, desc:limparNome(desc).slice(0,160)}), autorizacao:autorizacao, origemId:mapa.origemId||null,
    }).then(guardar);
  }

  function removerAnuncio(id) { return motor.removerAnuncio(String(id || "")).then(guardar); }

  /* ----------------------------------------------------- administracao */

  function adminPainel() { return motor.adminPainel(); }
  function adminConta(uid) { return motor.adminConta(String(uid || "")); }
  function adminAjustarHoras(uid, minutos, motivo, operacao) {
    minutos = Math.round(Number(minutos) || 0);
    motivo = limparNome(motivo).slice(0, 200);
    if (!minutos) return falha("Informe quantas horas ou minutos.");
    if (Math.abs(minutos) > 60000) return falha("Ajuste grande demais: o máximo é de 1.000 horas por vez.");
    if (motivo.length < 3) return falha("Escreva o motivo do ajuste.");
    return motor.adminAjustarHoras(String(uid || ""), minutos, motivo, operacao);
  }
  function adminBloquear(uid, bloquear) { return motor.adminBloquear(String(uid || ""), !!bloquear); }

  function autorizarMapeamento(droneId) { return motor.autorizarMapeamento(droneId); }
  function iniciarTreino(droneId, controle) { return motor.iniciarTreino(droneId, normalizarCodigo(controle)); }
  /* saldo restante em minutos (0 = acabou) */
  function registrarMinuto(treino) { return motor.registrarMinuto(treino); }

  function registrarControle(codigo, apelido) {
    codigo = normalizarCodigo(codigo);
    var erro = validarCodigoControle(codigo);
    return erro ? falha(erro) : motor.registrarControle(codigo, String(apelido || "").trim().slice(0, 40)).then(guardar);
  }

  function removerControle(codigo) { return motor.removerControle(codigo).then(guardar); }

  /* Cada emissao gera codigo novo e ANULA os anteriores. O CPF completo nunca
     e enviado nem gravado: so a forma escondida (***.456.789-**), se o aluno quiser. */
  function emitirCertificado(nome, cpfMascarado) {
    nome = limparNome(nome);
    if (nome.split(" ").length < 2) return falha("Informe o nome completo (nome e sobrenome).");
    cpfMascarado = String(cpfMascarado || "");
    if (cpfMascarado && !/^\*\*\*\.\d{3}\.\d{3}-\*\*$/.test(cpfMascarado)) return falha("CPF inválido.");
    return motor.emitirCertificado(nome, cpfMascarado).then(function (cert) { return iniciar().then(function () { return cert; }); });
  }

  function consultarCertificado(codigo) {
    codigo = codigoCertificado(codigo);
    return codigo ? motor.consultarCertificado(codigo) : Promise.resolve(null);
  }

  /* 08/10/2026: drones ainda nao publicos que o admin pode compartilhar por e-mail */
  var DRONES_PREVIA = ["p60"];
  function testaPrevia(conta, droneId) {
    if (conta && conta.beta) return !conta.bloqueada && (conta.previas || []).indexOf(droneId) >= 0;   // beta da XAG (21/11/2026)
    return DRONES_PREVIA.indexOf(droneId) >= 0 && !!conta && (conta.previas || []).indexOf(droneId) >= 0;
  }

  /* O sim.html so abre com a sessao dele (js/sessao.js, chave tpd_sessao).
     Antes de abrir, grava uma sessao de aluno com o drone liberado. */
  function prepararSimulador(conta, droneId) {
    var s = SIMULADOR[droneId];
    if (!s || ((droneId === "p60" || DRONES_SO_ADMIN.indexOf(droneId) >= 0) && conta.admin !== true && !testaPrevia(conta, droneId))) return false;
    try {
      localStorage.setItem("tpd_sessao", JSON.stringify({
        codigo: "ALUNO", turma: "Aluno", aluno: conta.nome,
        marcas: [s.marca], cenarios: CENARIOS_SIMULADOR.slice(),
        aparelhos: [{ marca: s.marca, modelo: s.modelo, plano: "completo", horas: null }],
        entrouEm: new Date().toISOString(), livre: false, direto: true, origem: "conta",
        /* mapas comprados na loja (js/campo/cenario_real.js). 18/11/2026 (Eduardo: "deixa 3 mapas so ate pra mim q sou adm"):
           a conta do administrador nao leva os mapas dela para o simulador, e fica so com os 3 mapas de todos (Coxilha,
           Baixada do acude, Encosta). Voltar = tirar a condicao do admin. Aluno que comprou mapa continua com os dele. */
        mapas: conta.admin === true ? [] : (conta.mapas || []).slice(),
      }));
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------- leitura (sincrona) */

  function minutosTreinados(conta) { return (conta && conta.minutosTreinados) || 0; }

  /* [{ drone, minutos }], maior primeiro */
  function minutosPorDrone(conta) {
    var p = (conta && conta.porDrone) || {};
    return Object.keys(p).map(function (d) { return { drone: d, minutos: p[d] }; })
      .filter(function (d) { return d.minutos > 0; })
      .sort(function (a, b) { return b.minutos - a.minutos; });
  }

  /* O certificado so sai 7 dias depois da ULTIMA compra de horas (regra do
     Eduardo, 02/10/2026): fecha a brecha de comprar, treinar, pegar o
     certificado e pedir a devolucao. Devolve a data em que libera, ou null. */
  var CARENCIA_CERTIFICADO_DIAS = 7;
  function certificadoLiberaEm(conta) {
    var compras = ((conta && conta.compras) || []).filter(function (c) { return !c.mapa && !c.certificado; });
    compras = compras.concat(((conta && conta.patrociniosEscola) || []).map(function (c) { return {em:c.compraEm}; }));
    var ultima = compras.reduce(function (m, c) { return c.em > m ? c.em : m; }, "");
    if (!ultima) return null;
    var libera = new Date(ultima).getTime() + CARENCIA_CERTIFICADO_DIAS * 86400000;
    return libera > Date.now() ? new Date(libera) : null;
  }

  function certificadoAtual(conta) {
    var lista = (conta && conta.certificados) || [];
    var c = lista[lista.length - 1];
    return c && c.situacao === "valido" && c.minutos >= (c.minimoMin || 15 * 60) ? c : null;
  }

  /* So confere os digitos verificadores. O CPF nao e guardado. */
  function cpfValido(cpf) {
    var n = String(cpf || "").replace(/\D/g, "");
    if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(n[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(n[t])) return false;
    }
    return true;
  }

  function formatarCpf(cpf) {
    var n = String(cpf || "").replace(/\D/g, "").slice(0, 11);
    return n.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  /* CPF com parte escondida, no padrao do governo: ***.456.789-**.
     So esta forma sai do navegador; o CPF completo nunca e enviado. */
  function mascararCpf(cpf) {
    var n = String(cpf || "").replace(/\D/g, "");
    if (n.length !== 11) return "";
    return "***." + n.slice(3, 6) + "." + n.slice(6, 9) + "-**";
  }

  /* Igual ao servidor (index.js mascararNome): primeiro nome inteiro; dos
     outros, so a primeira letra. Particulas (da, de, dos...) ficam como estao. */
  var PARTICULAS_NOME = ["da", "de", "do", "das", "dos", "e", "di", "du", "del", "van", "von"];
  function mascararNome(nome) {
    return String(nome || "").trim().split(/\s+/).filter(Boolean).map(function (parte, i) {
      if (i === 0 || PARTICULAS_NOME.indexOf(parte.toLowerCase()) >= 0) return parte;
      var letras = Array.from(parte);
      return letras[0] + new Array(letras.length).join("*");
    }).join(" ");
  }

  function formatarHoras(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + " min";
    return m ? h + " h " + m + " min" : h + " h";
  }

  /* "30 minutos", "1 hora", "10 horas" - o pacote de meia hora vale 0.5 */
  function nomeDoPacote(horas) {
    horas = Number(horas) || 0;
    if (horas < 1) return Math.round(horas * 60) + " minutos";
    return horas + (horas === 1 ? " hora" : " horas");
  }

  function aceitaBoleto(preco) { return Number(preco) >= BOLETO_A_PARTIR_DE; }

  /* frase da janela de compra, quando o pagamento esta ligado */
  function formasDePagamento(preco) {
    return "Você será levado ao Mercado Pago para pagar com " +
      (aceitaBoleto(preco) ? "Pix, cartão ou boleto" : "Pix ou cartão") +
      ". No Pix a liberação é na hora.";
  }

  function formatarReais(v) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0 });
  }

  function nomeDoEstado(sigla) {
    var e = ESTADOS.filter(function (x) { return x[0] === sigla; })[0];
    return e ? e[1] : sigla;
  }

  /* ------------------------------------------------------------------ topo */

  /* Topo comum das paginas logadas. ativo: "drones" | "creditos" | "loja" | "certificado" | "".
     "Consultar certificado" nao entra aqui: fica so na tela de login. */
  /* Rodape comum: links dos termos. Roda em toda pagina que tem <footer class="rodape">. */
  /* Quem se cadastrou com "Outro" recebe este pedido em toda página da conta até
     informar o país de verdade (07/10/2026). "Agora não" fecha só nesta página. */
  var pedindoPais = false;
  function pedirPais(c) {
    if (!c || c.pais !== 'OUTRO' || pedindoPais || typeof document === "undefined") return;
    if (!document.body) { document.addEventListener("DOMContentLoaded", function () { pedirPais(c); }); return; }
    pedindoPais = true;
    var d = document.createElement("dialog");
    d.setAttribute("aria-labelledby", "pp-titulo");
    d.style.cssText = "border:1px solid #63B23C;border-radius:16px;padding:24px;max-width:min(440px,90vw);background:#0E1A14;color:#F3F7F1";
    d.innerHTML =
      '<h2 id="pp-titulo" style="margin-top:0">Informe o país onde você mora</h2>' +
      '<p class="fraco">No seu cadastro o país ficou como "Outro". Escreva o nome do país onde você mora.</p>' +
      '<div class="campo"><label for="pp-pais">País</label>' +
      '<input id="pp-pais" list="pp-lista" maxlength="60" autocomplete="country-name" placeholder="Digite o nome do país"></div>' +
      '<datalist id="pp-lista"></datalist>' +
      '<div class="campo" id="pp-campo-estado" hidden><label for="pp-estado">Estado</label>' +
      '<select id="pp-estado"><option value="">Selecione…</option></select></div>' +
      '<p class="aviso aviso--erro" id="pp-erro" role="alert" hidden></p>' +
      '<div style="display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap">' +
      '<button class="botao botao--linha" type="button" id="pp-depois">Agora não</button>' +
      '<button class="botao botao--principal" type="button" id="pp-salvar">Salvar</button></div>';
    document.body.appendChild(d);
    var campo = d.querySelector("#pp-pais"), lista = d.querySelector("#pp-lista"), uf = d.querySelector("#pp-estado");
    var erro = d.querySelector("#pp-erro"), salvar = d.querySelector("#pp-salvar");
    var col = colunaDoIdioma();
    PAISES_TODOS.slice().sort(function (x, y) { return x[col].localeCompare(y[col]); }).forEach(function (p) { var o = document.createElement("option"); o.value = p[col]; lista.appendChild(o); });
    ESTADOS.forEach(function (e) { var o = document.createElement("option"); o.value = e[0]; o.textContent = e[1]; uf.appendChild(o); });
    campo.addEventListener("input", function () { d.querySelector("#pp-campo-estado").hidden = codigoDoPais(campo.value) !== 'BR'; erro.hidden = true; });
    d.querySelector("#pp-depois").onclick = function () { d.close(); };
    salvar.onclick = function () {
      salvar.disabled = true; erro.hidden = true;
      informarPais(campo.value, uf.value).then(function () { d.close(); location.reload(); },
        function (e) { erro.textContent = e.message; erro.hidden = false; salvar.disabled = false; });
    };
    d.addEventListener("close", function () { d.remove(); });
    try { d.showModal(); } catch (e) { d.setAttribute("open", ""); }
  }

  function montarRodape() {
    var r = document.querySelector("footer.rodape");
    if (!r || r.querySelector(".rodape__links")) return;
    var links = document.createElement("nav");
    links.className = "rodape__links";
    [["termos.html#termos", "Termos de uso"], ["termos.html#privacidade", "Privacidade"], ["termos.html#devolucao", "Devolução"]].forEach(function (l) {
      var a = document.createElement("a"); a.href = l[0]; a.textContent = l[1]; links.appendChild(a);
    });
    var J = CFG.juridico || {};
    if (J.suporteEmail) { var m = document.createElement("a"); m.href = "mailto:" + J.suporteEmail; m.textContent = "Suporte"; links.appendChild(m); }
    else if (J.suporteWhatsapp) { var w = document.createElement("a"); w.href = "https://wa.me/" + String(J.suporteWhatsapp).replace(/\D/g, ""); w.textContent = "Suporte"; links.appendChild(w); }
    r.appendChild(links);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarRodape);
  else montarRodape();

  function montarTopo(conta, ativo) {
    var topo = document.getElementById("topo");
    if (!topo) return;
    function botao(id, href, texto) {
      return '<a class="topo__botao' + (ativo === id ? " ativo" : "") + '" href="' + href + '">' + texto + '</a>';
    }
    topo.innerHTML =
      '<div class="topo__interno">' +
        '<a class="marca" href="inicio.html" aria-label="Início">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
            '<circle cx="6" cy="6" r="3" stroke="#63B23C" stroke-width="1.6"/>' +
            '<circle cx="18" cy="6" r="3" stroke="#63B23C" stroke-width="1.6"/>' +
            '<circle cx="6" cy="18" r="3" stroke="#63B23C" stroke-width="1.6"/>' +
            '<circle cx="18" cy="18" r="3" stroke="#63B23C" stroke-width="1.6"/>' +
            '<rect x="9" y="9" width="6" height="6" rx="1.6" fill="#F3F7F1"/>' +
          '</svg><span>Treinamento</span>' +
        '</a>' +
        '<nav class="topo__menu">' +
          botao("drones", "drones.html", "Drones disponíveis") +
          botao("creditos", "creditos.html", "Crédito de horas") +
          botao("meusmapas", "meus-mapas.html", "Meus mapas") +
          botao("certificado", "certificado.html", "Gerar certificado") +
          (conta.admin ? botao("admin", "admin.html", "Administração") : "") +
          '<a class="saldo" href="creditos.html" title="Horas de simulador disponíveis">' +
            '<span class="saldo__rotulo">Saldo</span><strong id="saldo-horas"></strong>' +
          '</a>' +
        '</nav>' +
        '<div class="topo__usuario">' +
          '<span class="topo__nome"></span>' +
          '<a href="#" id="btn-sair">Sair</a>' +
        '</div>' +
      '</div>';
    topo.querySelector(".topo__nome").textContent = conta.nome.split(" ")[0];
    atualizarSaldo(conta);
    avisoTesteGratis(conta);
    avisoHorasEscola(conta);
    document.getElementById("btn-sair").addEventListener("click", function (ev) {
      ev.preventDefault();
      sair().then(function () { location.href = "index.html"; });
    });
  }

  function atualizarSaldo(conta) {
    var alvo = document.getElementById("saldo-horas");
    if (!alvo) return;
    alvo.textContent = conta.acessoVitalicio ? "Vitalício" : formatarHoras(conta.saldoMin);
    alvo.parentNode.classList.toggle("saldo--vazio", conta.saldoMin <= 0 && !conta.acessoVitalicio);
  }

  if (window.TPD_TRADUCOES) Object.assign(window.TPD_TRADUCOES, {
    "Confirme seu e-mail para ganhar o teste grátis": ["Confirm your e-mail to get the free trial", "Confirma tu correo para recibir la prueba gratis"],
    "Seu teste grátis:": ["Your free trial:", "Tu prueba gratis:"],
    "Enviamos um link de confirmação para:": ["We sent a confirmation link to:", "Enviamos un enlace de confirmación a:"],
    "Abra o e-mail, clique no link e volte aqui. Não chegou? Veja o spam ou a aba Promoções, ou envie de novo.": ["Open the e-mail, click the link and come back here. Didn't get it? Check spam or the Promotions tab, or send it again.", "Abre el correo, haz clic en el enlace y vuelve aquí. ¿No llegó? Revisa el spam o la pestaña Promociones, o envíalo de nuevo."],
    "Toque em Enviar link. Depois abra o e-mail, clique no link e volte aqui.": ["Tap Send link. Then open the e-mail, click the link and come back here.", "Toca Enviar enlace. Después abre el correo, haz clic en el enlace y vuelve aquí."],
    "Já confirmei": ["I've confirmed", "Ya confirmé"],
    "Enviar link de novo": ["Send link again", "Enviar enlace de nuevo"],
    "Enviar link": ["Send link", "Enviar enlace"],
    "Conferindo…": ["Checking…", "Verificando…"],
    "Enviando…": ["Sending…", "Enviando…"],
    "E-mail confirmado! Liberando seu teste grátis…": ["E-mail confirmed! Unlocking your free trial…", "¡Correo confirmado! Liberando tu prueba gratis…"],
    "Ainda não aparece confirmado. Abra o link do e-mail e tente de novo.": ["It doesn't show as confirmed yet. Open the link in the e-mail and try again.", "Todavía no aparece confirmado. Abre el enlace del correo e inténtalo de nuevo."],
    "Link enviado. Pode levar alguns minutos para chegar.": ["Link sent. It may take a few minutes to arrive.", "Enlace enviado. Puede tardar unos minutos en llegar."],
    "Teste grátis já usado": ["Free trial already used", "Prueba gratis ya usada"],
    "Este e-mail já recebeu o teste grátis em outra conta. Para treinar, compre horas.": ["This e-mail already received the free trial on another account. To train, buy hours.", "Este correo ya recibió la prueba gratis en otra cuenta. Para entrenar, compra horas."],
    "Comprar horas": ["Buy hours", "Comprar horas"],
    /* termos.html */
    "O teste grátis é liberado depois que você confirma o e-mail, uma vez por pessoa. Criar contas extras para ganhar o teste de novo é tentar burlar a cobrança de horas.": ["The free trial is unlocked after you confirm your e-mail, once per person. Creating extra accounts to get the trial again is an attempt to get around paying for hours.", "La prueba gratis se libera después de que confirmes tu correo, una vez por persona. Crear cuentas extra para recibir la prueba de nuevo es intentar evadir el cobro de horas."],
    "No teste grátis": ["In the free trial", "En la prueba gratis"],
    "quando o teste é liberado, guardamos a data, o e-mail e um resumo embaralhado do endereço de internet (IP) e do navegador (tela, idioma, fuso horário e uma marca aleatória guardada nele). O resumo não permite ler o IP de volta; serve só para ver se várias contas pegaram o teste do mesmo lugar.": ["when the trial is unlocked, we store the date, the e-mail and a scrambled summary of the internet address (IP) and of the browser (screen, language, time zone and a random mark stored in it). The summary does not allow the IP to be read back; it only shows whether several accounts got the trial from the same place.", "cuando se libera la prueba, guardamos la fecha, el correo y un resumen cifrado de la dirección de internet (IP) y del navegador (pantalla, idioma, zona horaria y una marca aleatoria guardada en él). El resumen no permite leer la IP de vuelta; solo sirve para ver si varias cuentas recibieron la prueba desde el mismo lugar."],
    "Para evitar que a mesma pessoa pegue o teste grátis várias vezes.": ["To prevent the same person from getting the free trial several times.", "Para evitar que la misma persona reciba la prueba gratis varias veces."],
    "Os dados do teste grátis ficam até 6 meses. Para o teste não ser usado de novo, um resumo embaralhado do e-mail que já recebeu o teste continua guardado mesmo depois de a conta ser excluída.": ["Free trial data is kept for up to 6 months. So the trial is not used again, a scrambled summary of the e-mail that already received it stays stored even after the account is deleted.", "Los datos de la prueba gratis se guardan hasta 6 meses. Para que la prueba no se use de nuevo, un resumen cifrado del correo que ya la recibió sigue guardado incluso después de eliminar la cuenta."],
    "O site guarda no próprio navegador a sessão aberta, o nível de qualidade do simulador, preferências de tela e a marca aleatória usada só no teste grátis. Não usamos cookies de rastreamento nem ferramentas de anúncio.": ["The site stores in your own browser the open session, the simulator quality level, screen preferences and the random mark used only for the free trial. We do not use tracking cookies or advertising tools.", "El sitio guarda en tu propio navegador la sesión abierta, el nivel de calidad del simulador, las preferencias de pantalla y la marca aleatoria usada solo en la prueba gratis. No usamos cookies de rastreo ni herramientas de publicidad."],
  });

  /* Aviso de horas recebidas de um instituto de ensino (so na carga em que chegaram). */
  function avisoHorasEscola(conta) {
    var lista = (conta && conta.horasEscolaRecebidas) || [];
    if (!lista.length || document.getElementById("aviso-horas-escola")) return;
    var caixa = document.createElement("section");
    caixa.id = "aviso-horas-escola"; caixa.className = "aviso aviso--ok"; caixa.setAttribute("role", "status");
    caixa.textContent = lista.map(function (x) { return "Você recebeu " + formatarHoras(x.minutos) + " de treinamento do instituto de ensino " + (x.escola || "") + "."; }).join(" ");
    var envelope = document.querySelector("main .envelope");
    if (envelope) envelope.insertBefore(caixa, envelope.firstChild);
    else if (document.getElementById("topo")) document.getElementById("topo").insertAdjacentElement("afterend", caixa);
  }

  /* Aviso no alto da pagina enquanto o teste gratis espera o e-mail confirmado
     (ou quando a caixa de e-mail ja ganhou o teste em outra conta). */
  var conferindoEmail = false, ultimaConferencia = 0;
  function avisoTesteGratis(conta) {
    var velho = document.getElementById("aviso-teste-gratis");
    if (velho) velho.remove();
    var pendente = conta && conta.testeGratisPendente;
    if (pendente !== "confirmarEmail" && pendente !== "emailRepetido") return;
    function cria(tag, classe, texto) {
      var e = document.createElement(tag);
      if (classe) e.className = classe;
      if (texto != null) e.textContent = texto;
      return e;
    }
    var caixa = cria("section", "cartao pilha");
    caixa.id = "aviso-teste-gratis";
    caixa.setAttribute("style", "gap:10px;margin-bottom:24px;border-color:rgba(99,178,60,.5)");
    var botoes = cria("div", "janela__botoes"), situacao = cria("p", "fraco");
    situacao.setAttribute("role", "status");

    if (pendente === "emailRepetido") {
      caixa.appendChild(cria("h3", "", "Teste grátis já usado"));
      caixa.appendChild(cria("p", "", "Este e-mail já recebeu o teste grátis em outra conta. Para treinar, compre horas."));
      var comprar = cria("a", "botao botao--principal", "Comprar horas");
      comprar.href = "creditos.html";
      botoes.appendChild(comprar);
      caixa.appendChild(botoes);
    } else {
      var enviado = linkJaEnviado(conta.email);
      caixa.appendChild(cria("h3", "", "Confirme seu e-mail para ganhar o teste grátis"));
      if (conta.testeGratisOferta) {
        var oferta = cria("p", "fraco");
        oferta.appendChild(cria("span", "", "Seu teste grátis:"));
        oferta.appendChild(document.createTextNode(" "));
        oferta.appendChild(cria("strong", "", formatarHoras(conta.testeGratisOferta)));
        caixa.appendChild(oferta);
      }
      if (enviado) {
        caixa.appendChild(cria("p", "", "Enviamos um link de confirmação para:"));
        var email = cria("p"); email.appendChild(cria("strong", "", conta.email)); email.style.wordBreak = "break-all";
        caixa.appendChild(email);
        caixa.appendChild(cria("p", "fraco", "Abra o e-mail, clique no link e volte aqui. Não chegou? Veja o spam ou a aba Promoções, ou envie de novo."));
      } else {
        caixa.appendChild(cria("p", "", "Toque em Enviar link. Depois abra o e-mail, clique no link e volte aqui."));
      }
      var ja = cria("button", "botao botao--principal", "Já confirmei"), mandar = cria("button", "botao botao--linha", enviado ? "Enviar link de novo" : "Enviar link");
      ja.type = mandar.type = "button";
      botoes.appendChild(ja); botoes.appendChild(mandar);
      caixa.appendChild(botoes);
      caixa.appendChild(situacao);

      var conferir = function (calado) {
        if (conferindoEmail) return;
        conferindoEmail = true; ultimaConferencia = Date.now();
        if (!calado) { ja.disabled = true; situacao.textContent = "Conferindo…"; }
        motor.confirmarEmail(false).then(function (ok) {
          if (ok) { situacao.textContent = "E-mail confirmado! Liberando seu teste grátis…"; location.reload(); return; }
          if (!calado) situacao.textContent = "Ainda não aparece confirmado. Abra o link do e-mail e tente de novo.";
        }).catch(function (e) { if (!calado) situacao.textContent = e.message; })
          .then(function () { conferindoEmail = false; ja.disabled = false; });
      };
      ja.addEventListener("click", function () { conferir(false); });
      mandar.addEventListener("click", function () {
        mandar.disabled = true; situacao.textContent = "Enviando…";
        motor.confirmarEmail(true).then(function () {
          situacao.textContent = "Link enviado. Pode levar alguns minutos para chegar.";
          mandar.textContent = "Enviar link de novo";
        }).catch(function (e) { situacao.textContent = e.message; })
          .then(function () { mandar.disabled = false; });
      });
      /* Quem clicou no link em outra aba e voltou para esta: confere sozinho. */
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible" && document.getElementById("aviso-teste-gratis") === caixa && Date.now() - ultimaConferencia > 5000) conferir(true);
      });
    }
    var envelope = document.querySelector("main .envelope");
    if (envelope) envelope.insertBefore(caixa, envelope.firstChild);
    else document.getElementById("topo").insertAdjacentElement("afterend", caixa);
  }

  window.CONTAS = {
    escolas: function (dados) { return motor.escolas ? motor.escolas(dados) : falha('Entre na versão online para usar a escola.'); },
    comprarEscola: function (horas) { return motor.comprarEscola ? motor.comprarEscola(horas) : falha('Compras de escola exigem a versão online.'); },
    MODO: MODO,
    DEMONSTRACAO: MODO === "demonstracao",
    APK_URL: CFG.apkUrl || "",
    GERADOR_URL: CFG.geradorUrl || "",
    JURIDICO: CFG.juridico || {},
    PACOTES: PACOTES,
    CERTIFICADO: CERTIFICADO,
    pacoteCertificado: function (dolar) { return pacoteCertificado(contaAtual, !!dolar); },
    certificadoPendente: function () { return certificadoPendenteDaConta(contaAtual); },
    pacotePersonalizado: pacotePersonalizado,
    DRONES: DRONES,
    SIMULADOR: SIMULADOR,
    ESTADOS: ESTADOS,
    PAISES: PAISES,
    PAISES_TODOS: PAISES_TODOS,
    codigoDoPais: codigoDoPais,
    colunaDoIdioma: colunaDoIdioma,
    nomeDoPais: nomeDoPais,
    informarPais: informarPais,
    localidade: localidade,
    iniciar: iniciar,
    recarregar: recarregar,
    exigir: exigir,
    atual: function () { return contaAtual; },
    cadastrar: cadastrar,
    entrar: entrar,
    entrarComGoogle: entrarComGoogle,
    completarCadastroGoogle: completarCadastroGoogle,
    loginSemCadastro: function () { return motor.loginSemCadastro(); },
    sair: sair,
    entrarBeta: entrarBeta,
    pedirCodigoSenha: pedirCodigoSenha,
    conferirCodigoSenha: conferirCodigoSenha,
    revelarSenha: revelarSenha,
    criarOutraSenha: criarOutraSenha,
    comprar: comprar,
    comprarPix: comprarPix,
    pagarCartao: pagarCartao,
    comprarDolarEmbutido: comprarDolarEmbutido,
    PAGAMENTO: CFG.pagamento || {},
    saldoDaMarca: saldoDaMarca,
    conferirPagamento: conferirPagamento,
    comprarDolar: comprarDolar,
    PRECO_DOLAR: PRECO_DOLAR,
    formatarDolar: formatarDolar,
    pagaEmDolar: pagaEmDolar,
    registrarCliqueOfertaTeste: function (evento) { return motor.registrarCliqueOfertaTeste(evento); },
    sugerirDrone: function (dados) { return motor.sugerirDrone(dados); },
    adminCompartilharDrone: function (dados) { return motor.adminCompartilharDrone(dados); },
    adminListarCompartilhados: function (dados) { return motor.adminListarCompartilhados(dados); },
    testaPrevia: testaPrevia,
    avaliarTeste: function (dados) { return motor.avaliarTeste(dados); },
    adminRelatorioEstados: function () { return motor.adminRelatorioEstados(); },
    adminPainel: adminPainel,
    adminConta: adminConta,
    adminAjustarHoras: adminAjustarHoras,
    adminBloquear: adminBloquear,
    adminManutencao: function (dados) { return motor.adminManutencao ? motor.adminManutencao(dados) : falha("Manutenção disponível somente no site online."); },
    adminTempoNovos: function (dados) { return motor.adminTempoNovos(dados); },
    adminRelatorioCadastros: function () { return motor.adminRelatorioCadastros ? motor.adminRelatorioCadastros() : falha('Relatório indisponível.'); },
    adminTestesRepetidos: function (dados) { return motor.adminTestesRepetidos(dados || {}); },
    adminVitrineEscolas: function (dados) { return motor.adminVitrineEscolas(dados || {}); },
    adminSugestoesDrones: function () { return motor.adminSugestoesDrones ? motor.adminSugestoesDrones() : Promise.resolve({ itens: [], demonstracao: true }); },
    escolasPublicas: function () { return motor.escolasPublicas(); },
    dadosEscola: function (dados) { return motor.dadosEscola(dados || {}); },
    validarDadosEscola: dadosEscolaLimpos,
    formatarCnpj: formatarCnpj,
    formatarTelefone: formatarTelefone,
    confirmarEmail: function (enviar) { return motor.confirmarEmail(!!enviar); },
    adminAutorizarGratisCertificado: function (uid, autorizar) { return motor.adminAutorizarGratisCertificado(String(uid || ''), autorizar); },
    adminAcessoVitalicio: function (uid, ativar, motivo) { return motor.adminAcessoVitalicio(String(uid || ''), !!ativar, String(motivo || '')); },
    adminVagasEscola: function (dados) { return motor.adminVagasEscola ? motor.adminVagasEscola(dados || {}) : falha('Entre na versão online para dar vagas às escolas.'); },
    minimoCertificado: function (conta) { return HC.minimoCertificado(padronizar(conta)); },
    resumoCertificado: function (conta) { return HC.resumo(padronizar(conta)); },
    adminExcluirConta: function (uid) { return motor.adminExcluirConta(String(uid || "")); },
    REGRA_MAPAS: MAPAS,
    mapasDaConta: function (dados) { return motor.mapasDaConta ? motor.mapasDaConta(dados) : falha('Entre com seu e-mail e senha na versão online para usar seus 2 mapas pessoais.'); },
    verificarEmailMapas: function (enviar) { return motor.verificarEmailMapas ? motor.verificarEmailMapas(enviar) : falha('Entre na versão online.'); },
    financeiroMapas: function (dados) { return motor.financeiroMapas ? motor.financeiroMapas(dados) : falha('O cadastro fiscal e os recebimentos exigem a versão online.'); },
    precoDoMapa: precoDoMapa,
    listarMapas: listarMapas,
    comprarMapa: comprarMapa,
    lerArquivoDeMapa: lerArquivoDeMapa,
    anunciarMapa: anunciarMapa,
    removerAnuncio: removerAnuncio,
    autorizarMapeamento: autorizarMapeamento,
    iniciarTreino: iniciarTreino,
    registrarMinuto: registrarMinuto,
    registrarControle: registrarControle,
    removerControle: removerControle,
    emitirCertificado: emitirCertificado,
    prepararSimulador: prepararSimulador,
    consultarCertificado: consultarCertificado,
    minutosTreinados: minutosTreinados,
    minutosPorDrone: minutosPorDrone,
    certificadoAtual: certificadoAtual,
    certificadoLiberaEm: certificadoLiberaEm,
    cpfValido: cpfValido,
    formatarCpf: formatarCpf,
    mascararCpf: mascararCpf,
    mascararNome: mascararNome,
    adminProtegerCertificados: function () { return motor.adminProtegerCertificados ? motor.adminProtegerCertificados() : Promise.resolve({ conferidos: 0, protegidos: 0 }); },
    formatarHoras: formatarHoras,
    formatarReais: formatarReais,
    nomeDoPacote: nomeDoPacote,
    BOLETO_A_PARTIR_DE: BOLETO_A_PARTIR_DE,
    aceitaBoleto: aceitaBoleto,
    formasDePagamento: formasDePagamento,
    nomeDoEstado: nomeDoEstado,
    montarTopo: montarTopo,
    atualizarSaldo: atualizarSaldo,
  };
})();
