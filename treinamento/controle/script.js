/* ============================================================
   Controle T25 / T50 — comportamento das telas
   ============================================================ */

const METROS_POR_UNIDADE = 0.2327;   // escala do mapa desenhado
const LARGURA_MAPA = 1920;
const ALTURA_MAPA = 1200;

/* o mapa da tela de mapeamento é o mesmo terreno, só que ampliado */
const ZOOM_TRABALHO = 1.5;
const DESLOCA_TRABALHO = { x: -315, y: -450 };

const estado = {
  tela: 'inicial',
  tipoPonto: 'Ponto limite',
  metodo: 'Retículo',
  espacamento: 6.0,
  margem: 1.5,
  modoMargem: 'Geral',
  cobertura: 'Somente rota',
  umLado: false,
  reticulo: { x: 960, y: 640 },
  limite: [],
  obstaculo: [],
  marcas: [],
  droneLigado: false,
  conectado: false,
  conectando: false
};

const tarefas = [];          // mapas de aplicação salvos
const emAndamento = [];      // tarefas já enviadas para execução
let abaLista = 'Tarefa';
let selecionada = null;
let ordenacao = 'Distância';

const $ = (s, raiz = document) => raiz.querySelector(s);
const $$ = (s, raiz = document) => Array.from(raiz.querySelectorAll(s));

/* O botão físico inicia o controle. A conexão do drone é uma etapa separada. */
let faseControle = 'desligado';
let temporizadoresInicializacao = [];
let temporizadorConexao = null;
let temporizadorPressao = null;
let botaoEnergiaPressionado = false;
/* 12/10/2026 (Eduardo, T50 e T25): segurar 1,5 s liga (depois do toque que acende as luzes) e,
   com o controle ligado, segurar 1,5 s desliga; um toque só apaga/acende a tela. */
const DURACAO_PRESSAO = 1500;
const DURACAO_DESLIGAR = 1500;
let telaApagada = false;
function definirTelaApagada(apagada) {
  telaApagada = !!apagada;
  document.body.classList.toggle('tela-apagada', telaApagada);
}

function cancelarTemporizadores() {
  temporizadoresInicializacao.forEach(clearTimeout);
  temporizadoresInicializacao = [];
  clearTimeout(temporizadorConexao);
  temporizadorConexao = null;
  clearTimeout(temporizadorPressao);
  temporizadorPressao = null;
}

function definirFaseControle(fase) {
  faseControle = fase;
  document.body.classList.toggle('desligado', fase === 'desligado');
  document.body.classList.toggle('armado', fase === 'armado');
  document.body.classList.toggle('ligando', !['desligado', 'armado', 'pronto'].includes(fase));
  $('#tela-energia').dataset.fase = fase;
  $('#tela-energia').setAttribute('aria-label', {
    desligado: 'Controle desligado', armado: 'Luzes acesas. Pressione e segure o botão de energia por 1,5 segundo.', logo: 'Iniciando o controle',
    aeronave: 'Carregando o assistente agrícola', carregando: 'Carregando aplicativo',
    pronto: 'Controle ligado'
  }[fase]);
  $('.t-power').setAttribute('aria-label', fase === 'desligado' ? 'Acender luzes do controle' : fase === 'armado' ? 'Pressione e segure por 1,5 segundo para ligar o controle' : 'Toque: apaga ou acende a tela. Segure 1,5 segundo: desliga o controle');
  $('.t-power').title = fase === 'armado' ? 'Segure por 1,5 segundo para ligar' : fase === 'desligado' ? 'Toque uma vez para acender as luzes' : 'Toque: apaga a tela · Segure 1,5 s: desliga';
}

function desligarControle() {
  cancelarTemporizadores();
  botaoEnergiaPressionado = false;
  definirTelaApagada(false);
  estado.conectando = false;
  estado.conectado = false;
  atualizarConexao();
  $('#painel-config').classList.remove('aberto');
  $('#painel-extra').classList.remove('aberto');
  $('#painel-tarefas').classList.remove('aberto');
  historicoTelas.length = 0;
  mostrarTela('inicial', false);
  definirFaseControle('desligado');
}

function ligarControle() {
  definirFaseControle('logo');
  temporizadoresInicializacao = [
    setTimeout(() => definirFaseControle('aeronave'), 1300),
    setTimeout(() => definirFaseControle('carregando'), 3100),
    setTimeout(() => {
      definirFaseControle('pronto');
      mostrarTela('inicial');
      temporizadoresInicializacao = [];
      sincronizarConexao();
    }, 4100)
  ];
}

/* Primeiro toque consulta a bateria; só uma nova pressão contínua liga o controle. */
const botaoEnergia = $('.t-power');
function iniciarPressaoEnergia() {
  if (botaoEnergiaPressionado) return;
  botaoEnergiaPressionado = true;
  if (faseControle === 'armado') {
    temporizadorPressao = setTimeout(() => {
      temporizadorPressao = null;
      if (botaoEnergiaPressionado && faseControle === 'armado') ligarControle();
    }, DURACAO_PRESSAO);
  } else if (faseControle === 'pronto') {
    /* ligado: segurando 1,5 s desliga (soltar antes so apaga/acende a tela) */
    temporizadorPressao = setTimeout(() => {
      temporizadorPressao = null;
      if (botaoEnergiaPressionado && faseControle === 'pronto') desligarControle();
    }, DURACAO_DESLIGAR);
  }
}
function finalizarPressaoEnergia() {
  if (!botaoEnergiaPressionado) return;
  botaoEnergiaPressionado = false;
  if (temporizadorPressao !== null) {
    clearTimeout(temporizadorPressao);
    temporizadorPressao = null;
  }
  if (faseControle === 'desligado') definirFaseControle('armado');
  else if (faseControle === 'pronto') definirTelaApagada(!telaApagada);
}
botaoEnergia.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  botaoEnergia.setPointerCapture(e.pointerId);
  iniciarPressaoEnergia();
});
botaoEnergia.addEventListener('pointerup', finalizarPressaoEnergia);
botaoEnergia.addEventListener('pointercancel', () => {
  botaoEnergiaPressionado = false;
  clearTimeout(temporizadorPressao);
  temporizadorPressao = null;
});
botaoEnergia.addEventListener('keydown', e => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  if (!e.repeat) iniciarPressaoEnergia();
});
botaoEnergia.addEventListener('keyup', e => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    finalizarPressaoEnergia();
  }
});

$('#botao-drone').addEventListener('click', () => {
  estado.droneLigado = !estado.droneLigado;
  $('#indicador-drone').textContent = estado.droneLigado ? 'Drone T50 ligado' : 'Drone T50 desligado';
  $('#botao-drone').textContent = estado.droneLigado ? 'Desligar drone' : 'Ligar drone';
  $('#botao-drone').setAttribute('aria-pressed', String(estado.droneLigado));
  document.body.classList.toggle('drone-ligado', estado.droneLigado);
  sincronizarConexao();
});

/* ---------------- navegação entre telas ---------------- */
const historicoTelas = [];
function mostrarTela(nome, guardarHistorico = true) {
  if (guardarHistorico && nome !== estado.tela) historicoTelas.push(estado.tela);
  $$('.tela-app').forEach(t => t.classList.toggle('ativa', t.dataset.tela === nome));
  estado.tela = nome;
}
$$('[data-ir]').forEach(b => b.addEventListener('click', () => mostrarTela(b.dataset.ir)));
$('.t-voltar').addEventListener('click', () => {
  if (faseControle !== 'pronto') return;
  if ($('#painel-extra').classList.contains('aberto')) {
    $('#painel-extra').classList.remove('aberto');
    return;
  }
  if ($('#painel-config').classList.contains('aberto')) {
    $('#painel-config').classList.remove('aberto');
    return;
  }
  if ($('#painel-tarefas').classList.contains('aberto')) {
    $('#painel-tarefas').classList.remove('aberto');
    return;
  }
  const destino = {inicial: 'sistema', mapa: 'inicial', modos: 'mapa', mapeamento: 'mapa', execucao: 'mapa', dividir: 'mapa'}[estado.tela];
  if (destino) mostrarTela(destino, false);
});
$('#botao-comecar').addEventListener('click', () => {
  if (faseControle !== 'pronto') return;
  mostrarTela('mapa');
});

/* ---------------- painel de tarefas ---------------- */
const painelTarefas = $('#painel-tarefas');
$('#aba-lista').addEventListener('click', () => painelTarefas.classList.add('aberto'));
$('#aba-fechar').addEventListener('click', () => painelTarefas.classList.remove('aberto'));

$$('.abas-painel .aba').forEach(aba => {
  aba.addEventListener('click', () => {
    $$('.abas-painel .aba').forEach(a => a.classList.toggle('ativa', a === aba));
    abaLista = aba.dataset.aba;
    selecionada = null;
    renderizarLista();
  });
});

/* ---------------- abas do painel de rota ---------------- */
$$('.aba-rota').forEach(aba => {
  aba.addEventListener('click', () => {
    $$('.aba-rota').forEach(a => a.classList.toggle('ativa', a === aba));
    $$('.conteudo-rota').forEach(c => c.classList.toggle('ativa', c.dataset.conteudo === aba.dataset.aba));
  });
});

/* ---------------- + e − dos campos ---------------- */
$$('.passo-botao').forEach(botao => {
  botao.addEventListener('click', () => {
    const delta = parseFloat(botao.dataset.delta);
    if (botao.dataset.passo === 'espacamento') {
      estado.espacamento = Math.min(59.03, Math.max(1.6, +(estado.espacamento + delta).toFixed(2)));
      $('#valor-espacamento').textContent = estado.espacamento.toFixed(2);
    } else {
      estado.margem = Math.min(100, Math.max(0, +(estado.margem + delta).toFixed(1)));
      $('#valor-margem').textContent = estado.margem.toFixed(1);
    }
    redesenhar();
  });
});

/* ---------------- Geral / Um lado ---------------- */
$$('#seg-margem button').forEach(b => {
  b.addEventListener('click', () => {
    $$('#seg-margem button').forEach(o => o.classList.toggle('ativa', o === b));
    estado.modoMargem = b.dataset.margem;
    redesenhar();
  });
});

/* ---------------- área de cobertura ---------------- */
$$('#lista-cobertura button').forEach(b => {
  b.addEventListener('click', () => {
    $$('#lista-cobertura button').forEach(o => o.classList.toggle('ativa', o === b));
    estado.cobertura = b.dataset.cobertura;
    redesenhar();
  });
});

/* ---------------- pulverização de um lado ---------------- */
$('#interruptor-umlado').addEventListener('click', e => {
  estado.umLado = !estado.umLado;
  e.currentTarget.classList.toggle('ligado', estado.umLado);
  redesenhar();
});

/* ---------------- tipos de ponto ---------------- */
$$('#lista-tipos button').forEach(b => {
  b.addEventListener('click', () => {
    $$('#lista-tipos button').forEach(o => o.classList.toggle('ativa', o === b));
    estado.tipoPonto = b.dataset.tipo;
  });
});

/* ---------------- método do ponto ---------------- */
const menuMetodo = $('#menu-metodo');
$('#botao-reticulo').addEventListener('click', e => {
  e.stopPropagation();
  menuMetodo.classList.toggle('aberto');
});
$$('#menu-metodo button').forEach(b => {
  b.addEventListener('click', () => {
    $$('#menu-metodo button').forEach(o => o.classList.toggle('ativa', o === b));
    estado.metodo = b.dataset.metodo;
    menuMetodo.classList.remove('aberto');
  });
});
document.addEventListener('click', e => {
  if (!menuMetodo.contains(e.target)) menuMetodo.classList.remove('aberto');
});

/* ---------------- aviso amarelo ---------------- */
$('#fechar-aviso').addEventListener('click', () => $('#aviso-amarelo').classList.add('escondido'));

/* ---------------- retículo ---------------- */
const mapaTrabalho = $('#mapa-trabalho');
const mapaPanoramica = $('#mapa-panoramica');
let deslocamentoMapa = { x: 0, y: 0 };
let arrastoMapa = null;

function pontoSVG(evento, elemento) {
  const ponto = mapaTrabalho.createSVGPoint();
  ponto.x = evento.clientX;
  ponto.y = evento.clientY;
  return ponto.matrixTransform(elemento.getScreenCTM().inverse());
}

mapaTrabalho.addEventListener('contextmenu', e => e.preventDefault());
mapaTrabalho.addEventListener('pointerdown', e => {
  if (e.button !== 2) return;
  e.preventDefault();
  const origem = pontoSVG(e, mapaTrabalho);
  arrastoMapa = { id: e.pointerId, origem, x: deslocamentoMapa.x, y: deslocamentoMapa.y };
  mapaTrabalho.setPointerCapture(e.pointerId);
  mapaTrabalho.classList.add('arrastando');
});
mapaTrabalho.addEventListener('pointermove', e => {
  if (!arrastoMapa || e.pointerId !== arrastoMapa.id) return;
  const atual = pontoSVG(e, mapaTrabalho);
  deslocamentoMapa.x = arrastoMapa.x + atual.x - arrastoMapa.origem.x;
  deslocamentoMapa.y = arrastoMapa.y + atual.y - arrastoMapa.origem.y;
  mapaPanoramica.setAttribute('transform', 'translate(' + deslocamentoMapa.x + ' ' + deslocamentoMapa.y + ')');
});
function terminarArrastoMapa(e) {
  if (!arrastoMapa || e.pointerId !== arrastoMapa.id) return;
  arrastoMapa = null;
  mapaTrabalho.classList.remove('arrastando');
}
mapaTrabalho.addEventListener('pointerup', terminarArrastoMapa);
mapaTrabalho.addEventListener('pointercancel', terminarArrastoMapa);

mapaTrabalho.addEventListener('click', e => {
  if (e.button !== 0) return;
  const p = pontoSVG(e, mapaPanoramica);
  estado.reticulo = { x: p.x, y: p.y };
  redesenhar();
});

mapaTrabalho.addEventListener('dblclick', e => {
  if (e.button !== 0) return;
  const p = pontoSVG(e, mapaPanoramica);
  let proximo = null;
  for (const tipo of ['limite', 'obstaculo', 'marcas']) {
    estado[tipo].forEach((ponto, indice) => {
      const distancia = Math.hypot(ponto.x - p.x, ponto.y - p.y);
      if (distancia <= 28 && (!proximo || distancia < proximo.distancia)) {
        proximo = { tipo, indice, distancia };
      }
    });
  }
  if (!proximo) return;
  e.preventDefault();
  estado[proximo.tipo].splice(proximo.indice, 1);
  redesenhar();
});

/* ---------------- arrastar os pontos já marcados ---------------- */
let arrastoPonto = null;
let acabouDeArrastar = false;
mapaTrabalho.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const p = pontoSVG(e, mapaPanoramica);
  let perto = null;
  for (const tipo of ['limite', 'obstaculo', 'marcas']) {
    estado[tipo].forEach((ponto, indice) => {
      const distancia = Math.hypot(ponto.x - p.x, ponto.y - p.y);
      if (distancia <= 28 && (!perto || distancia < perto.distancia)) perto = { tipo, indice, distancia };
    });
  }
  if (!perto) return;
  arrastoPonto = { id: e.pointerId, tipo: perto.tipo, indice: perto.indice, moveu: false };
  mapaTrabalho.setPointerCapture(e.pointerId);
});
mapaTrabalho.addEventListener('pointermove', e => {
  if (!arrastoPonto || e.pointerId !== arrastoPonto.id) return;
  const p = pontoSVG(e, mapaPanoramica);
  const ponto = estado[arrastoPonto.tipo][arrastoPonto.indice];
  if (!ponto) return;
  ponto.x = p.x;
  ponto.y = p.y;
  arrastoPonto.moveu = true;
  redesenhar();
});
function terminarArrastoPonto(e) {
  if (!arrastoPonto || e.pointerId !== arrastoPonto.id) return;
  acabouDeArrastar = arrastoPonto.moveu;
  arrastoPonto = null;
}
mapaTrabalho.addEventListener('pointerup', terminarArrastoPonto);
mapaTrabalho.addEventListener('pointercancel', terminarArrastoPonto);
/* soltar o ponto arrastado não pode mover o retículo */
mapaTrabalho.addEventListener('click', e => {
  if (!acabouDeArrastar) return;
  acabouDeArrastar = false;
  e.stopImmediatePropagation();
}, true);

/* ---------------- aba do painel de rota ---------------- */
$('#alternar-painel-rota').addEventListener('click', () => {
  const tela = $('[data-tela="mapeamento"]');
  const recolhido = tela.classList.toggle('painel-recolhido');
  const aba = $('#alternar-painel-rota');
  aba.innerHTML = recolhido ? '&#8250;' : '&#8249;';
  aba.setAttribute('aria-label', recolhido ? 'Abrir o painel' : 'Recolher o painel');
});

/* ---------------- adicionar ponto ---------------- */
$('#botao-adicionar-ponto').addEventListener('click', () => {
  const p = { x: estado.reticulo.x, y: estado.reticulo.y };
  if (estado.tipoPonto === 'Ponto limite') estado.limite.push(p);
  else if (estado.tipoPonto === 'Ponto de obstáculo') estado.obstaculo.push(p);
  else estado.marcas.push({ x: p.x, y: p.y, tipo: estado.tipoPonto });
  redesenhar();
});

/* ---------------- borracha ---------------- */
$('#botao-apagar').addEventListener('click', () => {
  if (estado.marcas.length) estado.marcas.pop();
  else if (estado.obstaculo.length) estado.obstaculo.pop();
  else estado.limite.pop();
  redesenhar();
});

/* ============================================================
   Desenho
   ============================================================ */
const NS = 'http://www.w3.org/2000/svg';
const camada = $('#camada-desenho');
const camadaTarefas = $('#camada-tarefas');

function el(nome, atributos, conteudo) {
  const e = document.createElementNS(NS, nome);
  for (const k in atributos) e.setAttribute(k, atributos[k]);
  if (conteudo !== undefined) e.textContent = conteudo;
  return e;
}

function areaPoligono(pontos) {
  if (pontos.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i], b = pontos[(i + 1) % pontos.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

function perimetro(pontos) {
  if (pontos.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i], b = pontos[(i + 1) % pontos.length];
    s += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return s;
}

function centro(pontos) {
  return {
    x: pontos.reduce((t, p) => t + p.x, 0) / pontos.length,
    y: pontos.reduce((t, p) => t + p.y, 0) / pontos.length
  };
}

/* ângulo da aresta mais longa — as faixas seguem o formato do talhão */
function anguloDaRota(pontos) {
  let melhor = 0, maior = -1;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i], b = pontos[(i + 1) % pontos.length];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > maior) { maior = d; melhor = Math.atan2(b.y - a.y, b.x - a.x); }
  }
  return melhor;
}

/* faixas paralelas dentro do talhão, pulando os obstáculos */
function faixasDeRota(limite, obstaculo, passoPx, ang) {
  const arestas = [];
  const juntar = pts => {
    for (let i = 0; i < pts.length; i++) arestas.push([pts[i], pts[(i + 1) % pts.length]]);
  };
  juntar(limite);
  if (obstaculo.length >= 3) juntar(obstaculo);

  const cos = Math.cos(-ang), sin = Math.sin(-ang);
  const gira = p => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos });
  const desgira = p => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos });

  const girados = arestas.map(par => [gira(par[0]), gira(par[1])]);
  const ys = girados.flat().map(p => p.y);
  const yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);

  const linhas = [];
  for (let y = yMin + passoPx / 2; y < yMax; y += passoPx) {
    const cortes = [];
    for (const par of girados) {
      const a = par[0], b = par[1];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        cortes.push(a.x + t * (b.x - a.x));
      }
    }
    cortes.sort((p, q) => p - q);
    for (let i = 0; i + 1 < cortes.length; i += 2) {
      linhas.push([desgira({ x: cortes[i], y: y }), desgira({ x: cortes[i + 1], y: y })]);
    }
  }
  return linhas;
}

const pontosSVG = pontos => pontos.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');

function redesenhar() {
  camada.textContent = '';
  const limite = estado.limite, obstaculo = estado.obstaculo;
  const fechado = limite.length >= 3;

  if (fechado && estado.cobertura !== 'Somente fronteira') {
    const passo = Math.max(6, estado.espacamento / METROS_POR_UNIDADE * ZOOM_TRABALHO);
    const linhas = faixasDeRota(limite, obstaculo, passo, anguloDaRota(limite));
    const g = el('g', { stroke: '#f2e03c', 'stroke-width': 6, 'stroke-linecap': 'round' });
    linhas.forEach((par, i) => {
      if (estado.umLado && i % 2) return;
      g.appendChild(el('line', { x1: par[0].x, y1: par[0].y, x2: par[1].x, y2: par[1].y }));
    });
    camada.appendChild(g);
  }

  if (limite.length >= 2) {
    camada.appendChild(el(fechado ? 'polygon' : 'polyline', {
      points: pontosSVG(limite), fill: 'none', stroke: '#dfe4e6', 'stroke-width': 6, 'stroke-linejoin': 'round'
    }));
  }
  if (fechado && estado.cobertura === 'Rota e fronteira') {
    camada.appendChild(el('polygon', {
      points: pontosSVG(limite), fill: 'none', stroke: '#f2e03c', 'stroke-width': 6, 'stroke-linejoin': 'round'
    }));
  }

  if (obstaculo.length >= 3) {
    camada.appendChild(el('polygon', {
      points: pontosSVG(obstaculo), fill: 'rgba(232,68,46,.78)', stroke: '#e8442e', 'stroke-width': 4
    }));
  } else if (obstaculo.length === 2) {
    camada.appendChild(el('line', {
      x1: obstaculo[0].x, y1: obstaculo[0].y, x2: obstaculo[1].x, y2: obstaculo[1].y,
      stroke: '#e8442e', 'stroke-width': 5
    }));
  }
  obstaculo.forEach(p => camada.appendChild(
    el('circle', { cx: p.x, cy: p.y, r: 11, fill: '#e8442e', stroke: '#fff', 'stroke-width': 4 })));

  limite.forEach((p, i) => {
    if (i === 0) {
      camada.appendChild(el('circle', { cx: p.x, cy: p.y, r: 12, fill: '#3ad46a', stroke: '#fff', 'stroke-width': 4 }));
      camada.appendChild(el('path', {
        d: 'M' + (p.x + 16) + ' ' + p.y + ' l22 0 m-8 -7 l8 7 l-8 7',
        fill: 'none', stroke: '#3ad46a', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    } else {
      camada.appendChild(el('circle', { cx: p.x, cy: p.y, r: 11, fill: '#b84fd6', stroke: '#fff', 'stroke-width': 4 }));
    }
  });

  estado.marcas.forEach(m => {
    const cor = m.tipo === 'Área sem aplicação' ? '#a8acae' : m.tipo === 'Redondo' ? '#ef3b2c' : '#20242a';
    camada.appendChild(el('circle', { cx: m.x, cy: m.y, r: 10, fill: cor, stroke: '#fff', 'stroke-width': 4 }));
  });

  camada.appendChild(el('circle', { cx: 560, cy: 880, r: 18, fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-dasharray': '6 6' }));
  camada.appendChild(el('circle', { cx: 560, cy: 880, r: 10, fill: '#f0c419' }));
  camada.appendChild(el('path', { d: 'M1090 600 v-34 M1090 632 v14 M1058 616 h22 M1102 616 h22', stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round' }));
  camada.appendChild(el('circle', { cx: 1090, cy: 616, r: 15, fill: '#2b7fe0', stroke: '#fff', 'stroke-width': 3 }));

  const r = estado.reticulo;
  camada.appendChild(el('path', {
    d: 'M' + r.x + ' ' + (r.y - 30) + ' v20 M' + r.x + ' ' + (r.y + 10) + ' v20 M' +
       (r.x - 30) + ' ' + r.y + ' h20 M' + (r.x + 10) + ' ' + r.y + ' h20',
    stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round'
  }));

  atualizarAreas();
}

function calcularAreas(limite, obstaculo) {
  const metro = METROS_POR_UNIDADE / ZOOM_TRABALHO;
  const campoM2 = areaPoligono(limite) * metro * metro;
  const obstaculoM2 = areaPoligono(obstaculo) * metro * metro;
  const margem = estado.modoMargem === 'Um lado' ? estado.margem / 2 : estado.margem;
  const perdaMargem = perimetro(limite) * metro * margem;

  let tarefaM2 = campoM2 - obstaculoM2 - perdaMargem;
  if (estado.cobertura === 'Somente fronteira') tarefaM2 = 0;
  if (estado.umLado) tarefaM2 /= 2;
  return { campo: campoM2 / 10000, tarefa: Math.max(0, tarefaM2) / 10000 };
}

function atualizarAreas() {
  const a = calcularAreas(estado.limite, estado.obstaculo);
  $('#area-campo').textContent = a.campo.toFixed(2);
  $('#area-tarefa').textContent = a.tarefa.toFixed(2);
}

/* ============================================================
   Tarefas salvas
   ============================================================ */
const dialogoSalvar = $('#dialogo-salvar');
const dialogoRenomear = $('#dialogo-renomear');

const doisDigitos = n => String(n).padStart(2, '0');

function agoraFormatado(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate()) +
         ' ' + doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
}
function dataCurta(d) {
  return doisDigitos(d.getFullYear() % 100) + '/' + doisDigitos(d.getMonth() + 1) + '/' +
         doisDigitos(d.getDate()) + ' ' + doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
}

/* do mapa ampliado para o mapa geral */
const paraMapaGeral = p => ({
  x: (p.x - DESLOCA_TRABALHO.x) / ZOOM_TRABALHO,
  y: (p.y - DESLOCA_TRABALHO.y) / ZOOM_TRABALHO
});

/* Edição: o talhão escolhido abre no mapeamento; ao salvar, ele é
   substituído (e não duplicado). Adicionar: mapa novo, tela limpa. */
let editandoTarefa = null;
const paraMapaTrabalho = p => ({
  x: p.x * ZOOM_TRABALHO + DESLOCA_TRABALHO.x,
  y: p.y * ZOOM_TRABALHO + DESLOCA_TRABALHO.y
});
$('#botao-novo-mapa').addEventListener('click', () => {
  editandoTarefa = null;
  estado.limite = [];
  estado.obstaculo = [];
  estado.marcas = [];
  redesenhar();
});
$('#botao-edicao').addEventListener('click', () => {
  const t = tarefaEscolhida();
  if (!t) return;
  editandoTarefa = t;
  estado.limite = t.limite.map(paraMapaTrabalho);
  estado.obstaculo = (t.obstaculo || []).map(paraMapaTrabalho);
  estado.marcas = [];
  mostrarTela('mapeamento');
  redesenhar();
});

$('#botao-salvar').addEventListener('click', () => {
  if (estado.limite.length < 3) return;
  $('#nome-tarefa').value = editandoTarefa ? editandoTarefa.nome : agoraFormatado();
  dialogoSalvar.classList.add('aberto');
  $('#nome-tarefa').select();
});
$('#cancelar-salvar').addEventListener('click', () => dialogoSalvar.classList.remove('aberto'));
$('#confirmar-salvar').addEventListener('click', () => {
  const areas = calcularAreas(estado.limite, estado.obstaculo);
  /* editando: sai a versão antiga; a nova entra no fim da lista */
  if (editandoTarefa) {
    const i = tarefas.indexOf(editandoTarefa);
    if (i >= 0) tarefas.splice(i, 1);
    if (selecionada === editandoTarefa.id) selecionada = null;
    editandoTarefa = null;
  }
  tarefas.push({
    id: Date.now(),
    nome: $('#nome-tarefa').value.trim() || agoraFormatado(),
    data: new Date(),
    area: areas.campo,
    limite: estado.limite.map(paraMapaGeral),
    obstaculo: estado.obstaculo.map(paraMapaGeral)
  });
  estado.limite = [];
  estado.obstaculo = [];
  estado.marcas = [];
  redesenhar();
  dialogoSalvar.classList.remove('aberto');
  mostrarTela('mapa');
  painelTarefas.classList.add('aberto');
  abaLista = 'Tarefa';
  $$('.abas-painel .aba').forEach(a => a.classList.toggle('ativa', a.dataset.aba === 'Tarefa'));
  renderizarLista();
});

/* ordenar: distância <-> tempo */
$('.ordenar').addEventListener('click', () => {
  ordenacao = ordenacao === 'Distância' ? 'Tempo' : 'Distância';
  $('.ordenar span').textContent = ordenacao;
  renderizarLista();
});

function listaAtual() {
  return abaLista === 'Tarefa' ? tarefas : emAndamento;
}
function listaOrdenada() {
  const copia = listaAtual().slice();
  if (ordenacao === 'Tempo') copia.sort((a, b) => b.data - a.data);
  return copia;
}

function renderizarLista() {
  const lista = $('#lista-tarefas');
  lista.textContent = '';
  const itens = listaOrdenada();
  const vazia = $('#lista-vazia');
  vazia.style.display = itens.length ? 'none' : 'block';
  vazia.textContent = abaLista === 'Tarefa' ? 'Nenhuma tarefa salva' : 'Nenhuma tarefa em andamento';

  itens.forEach((t, i) => {
    const andamento = abaLista === 'Em andamento';
    const item = document.createElement('div');
    item.className = 'item-tarefa' + (selecionada === t.id ? ' selecionada' : '');
    item.innerHTML =
      '<span class="numero">' + (i + 1) + '</span>' +
      '<div class="linha-topo"><span class="data"></span><span class="area">' +
        (andamento ? t.progresso + '%' : t.area.toFixed(2) + 'Ha') + '</span></div>' +
      '<div class="nome"></div>' +
      '<div class="local"><svg><use href="#ic-pin"></use></svg><span>Fazenda Três Barras, Linha do Cedro, ' +
        'Região de Santa Helena</span></div>' +
      '<div class="acoes-item">' +
        '<button data-acao="renomear"><svg><use href="#ic-renomear"></use></svg><span>Renomear</span></button>' +
        (andamento ? '<button data-acao="concluir"><svg><use href="#ic-check"></use></svg><span>Concluir</span></button>' : '') +
        '<button data-acao="excluir"><svg><use href="#ic-lixeira"></use></svg><span>Excluir</span></button>' +
      '</div>';
    item.querySelector('.data').textContent = dataCurta(t.data);
    item.querySelector('.nome').textContent = t.nome;

    item.addEventListener('click', e => {
      if (e.target.closest('[data-acao]')) return;
      selecionada = selecionada === t.id ? null : t.id;
      renderizarLista();
    });
    item.querySelector('[data-acao="renomear"]').addEventListener('click', () => abrirRenomear(t));
    item.querySelector('[data-acao="excluir"]').addEventListener('click', () => excluirItem(t));
    const concluir = item.querySelector('[data-acao="concluir"]');
    if (concluir) concluir.addEventListener('click', () => concluirItem(t));

    lista.appendChild(item);
  });

  atualizarBotoesDoMapa();
  desenharTarefasNoMapa();
}

function excluirItem(t) {
  const lista = listaAtual();
  const i = lista.indexOf(t);
  if (i >= 0) lista.splice(i, 1);
  if (selecionada === t.id) selecionada = null;
  renderizarLista();
}

function concluirItem(t) {
  const i = emAndamento.indexOf(t);
  if (i >= 0) emAndamento.splice(i, 1);
  if (selecionada === t.id) selecionada = null;
  renderizarLista();
}

let itemRenomeando = null;
function abrirRenomear(t) {
  itemRenomeando = t;
  $('#novo-nome').value = t.nome;
  dialogoRenomear.classList.add('aberto');
  $('#novo-nome').select();
}
$('#cancelar-renomear').addEventListener('click', () => dialogoRenomear.classList.remove('aberto'));
$('#confirmar-renomear').addEventListener('click', () => {
  if (itemRenomeando) itemRenomeando.nome = $('#novo-nome').value.trim() || itemRenomeando.nome;
  dialogoRenomear.classList.remove('aberto');
  renderizarLista();
});

/* Edição / Use ficam ativos quando há uma tarefa escolhida */
function tarefaEscolhida() {
  return tarefas.concat(emAndamento).filter(t => t.id === selecionada)[0] || null;
}
function atualizarBotoesDoMapa() {
  const t = tarefaEscolhida();
  const tem = !!t;
  $$('[data-tela="mapa"] .acoes-inferiores .alterna').forEach(b => b.classList.toggle('desativado', !tem));
  $('#caixa-info-tarefa').style.display = tem ? 'block' : 'none';
  $('#botao-dividir').style.display = tem ? 'flex' : 'none';
  $('#botao-cancelar-selecao').style.display = tem ? 'flex' : 'none';
  if (t) {
    $('#info-area').textContent = t.area.toFixed(2);
    $('#info-volume').textContent = (t.area * 30).toFixed(1);
  }
}

$('#botao-cancelar-selecao').addEventListener('click', () => {
  selecionada = null;
  renderizarLista();
});
$('#botao-usar').addEventListener('click', () => {
  const t = tarefaEscolhida();
  if (!t || emAndamento.indexOf(t) >= 0) return;
  emAndamento.push({
    id: Date.now(), nome: t.nome, data: new Date(), area: t.area,
    progresso: 0, limite: t.limite, obstaculo: t.obstaculo
  });
  abaLista = 'Em andamento';
  selecionada = null;
  $$('.abas-painel .aba').forEach(a => a.classList.toggle('ativa', a.dataset.aba === 'Em andamento'));
  renderizarLista();
});

function desenharTarefasNoMapa() {
  camadaTarefas.textContent = '';
  const todas = tarefas.concat(emAndamento);
  todas.forEach((t, i) => {
    const escolhida = selecionada === t.id;
    camadaTarefas.appendChild(el('polygon', {
      points: pontosSVG(t.limite),
      fill: escolhida ? 'rgba(242,224,60,.7)' : 'rgba(255,255,255,.1)',
      stroke: escolhida ? '#f2e03c' : '#fff',
      'stroke-width': 4, 'stroke-linejoin': 'round'
    }));
    if (t.obstaculo.length >= 3) {
      camadaTarefas.appendChild(el('polygon', {
        points: pontosSVG(t.obstaculo), fill: 'rgba(20,20,20,.55)', stroke: '#fff', 'stroke-width': 3
      }));
    }
    const c = centro(t.limite);
    camadaTarefas.appendChild(el('text', {
      x: c.x, y: c.y - 26, 'text-anchor': 'middle', fill: '#fff', 'font-size': 26, 'font-weight': 600
    }, t.nome));
    camadaTarefas.appendChild(el('circle', {
      cx: c.x, cy: c.y + 16, r: 20,
      fill: escolhida ? '#3ad46a' : 'rgba(0,0,0,.5)', stroke: '#fff', 'stroke-width': 3
    }));
    camadaTarefas.appendChild(el('text', {
      x: c.x, y: c.y + 25, 'text-anchor': 'middle', fill: '#fff', 'font-size': 24, 'font-weight': 700
    }, String(i + 1)));
  });
}

/* ---------------- botões físicos R2 / R3 ---------------- */
$$('.botao-lateral').forEach(botao => {
  botao.addEventListener('click', () => {
    const aberto = $('.dialogo-fundo.aberto');
    if (!aberto) return;
    if (botao.textContent === 'R2') aberto.querySelector('button:not(.verde)').click();
    if (botao.textContent === 'R3') aberto.querySelector('button.verde').click();
  });
});

redesenhar();
renderizarLista();

const tipoAtivo = $('#lista-tipos button.ativa');
if (tipoAtivo) $('#lista-tipos').scrollTop = Math.max(0, tipoAtivo.offsetTop - 60);

/* ============================================================
   Dividir campo
   ============================================================ */
const mapaDividir = $('#mapa-dividir');
const camadaDividir = $('#camada-dividir');
const grupoZoom = $('#zoom-dividir');
const grupoReticulo = $('#reticulo-dividir');

const divisao = { tarefa: null, partes: [], ancoras: [], reticulo: { x: 1150, y: 620 } };
let zoomDiv = { s: 1, tx: 0, ty: 0 };

const paraTela = p => ({ x: p.x * zoomDiv.s + zoomDiv.tx, y: p.y * zoomDiv.s + zoomDiv.ty });
const paraMapa = p => ({ x: (p.x - zoomDiv.tx) / zoomDiv.s, y: (p.y - zoomDiv.ty) / zoomDiv.s });

function areaHa(pontos) {
  return areaPoligono(pontos) * METROS_POR_UNIDADE * METROS_POR_UNIDADE / 10000;
}

$('#botao-dividir').addEventListener('click', () => {
  const t = tarefaEscolhida();
  if (!t) return;
  divisao.tarefa = t;
  divisao.partes = [t.limite.slice()];
  divisao.ancoras = [];
  mostrarTela('dividir');
  enquadrar(t.limite);
  divisao.reticulo = { x: 1150, y: 620 };
  desenharDivisao();
});

function enquadrar(pontos) {
  const xs = pontos.map(p => p.x), ys = pontos.map(p => p.y);
  const minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  const minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  const s = Math.min(760 / Math.max(maxX - minX, 1), 620 / Math.max(maxY - minY, 1));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  zoomDiv = { s: s, tx: 840 - cx * s, ty: 600 - cy * s };
  grupoZoom.setAttribute('transform',
    'translate(' + zoomDiv.tx.toFixed(1) + ' ' + zoomDiv.ty.toFixed(1) + ') scale(' + s.toFixed(4) + ')');
}

mapaDividir.addEventListener('click', e => {
  const r = mapaDividir.getBoundingClientRect();
  divisao.reticulo = {
    x: (e.clientX - r.left) / r.width * LARGURA_MAPA,
    y: (e.clientY - r.top) / r.height * ALTURA_MAPA
  };
  desenharDivisao();
});

$('#botao-adicionar-ancora').addEventListener('click', () => {
  if (divisao.ancoras.length >= 2) {   // "Próximo": aplica o corte e libera outro
    aplicarCorte();
    divisao.ancoras = [];
  } else {
    divisao.ancoras.push(paraMapa(divisao.reticulo));
  }
  desenharDivisao();
});

$('#apagar-ancora').addEventListener('click', () => {
  divisao.ancoras.pop();
  desenharDivisao();
});

/* corta um polígono por uma reta e devolve as duas metades */
function cortarPoligono(pontos, a, b) {
  const lado = p => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  const um = [], outro = [];
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i], q = pontos[(i + 1) % pontos.length];
    const lp = lado(p), lq = lado(q);
    if (lp >= 0) um.push(p);
    if (lp <= 0) outro.push(p);
    if ((lp > 0 && lq < 0) || (lp < 0 && lq > 0)) {
      const t = lp / (lp - lq);
      const corte = { x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) };
      um.push(corte); outro.push(corte);
    }
  }
  return [um, outro].filter(m => m.length >= 3 && areaPoligono(m) > 50);
}

function partesCortadas() {
  if (divisao.ancoras.length < 2) return divisao.partes;
  const a = divisao.ancoras[0], b = divisao.ancoras[1];
  const novas = [];
  divisao.partes.forEach(parte => cortarPoligono(parte, a, b).forEach(m => novas.push(m)));
  return novas.length ? novas : divisao.partes;
}

function aplicarCorte() {
  divisao.partes = partesCortadas();
}

function desenharDivisao() {
  camadaDividir.textContent = '';
  grupoReticulo.textContent = '';
  const e = 1 / zoomDiv.s;                    // espessura constante na tela
  const partes = partesCortadas();

  /* contorno do campo inteiro */
  if (divisao.tarefa) {
    camadaDividir.appendChild(el('polygon', {
      points: pontosSVG(divisao.tarefa.limite), fill: 'rgba(232,110,46,.35)',
      stroke: '#e8742e', 'stroke-width': 3 * e
    }));
  }

  /* as partes resultantes */
  partes.forEach(parte => {
    camadaDividir.appendChild(el('polygon', {
      points: pontosSVG(parte), fill: 'rgba(240,166,58,.45)',
      stroke: '#dfe4e6', 'stroke-width': 4 * e, 'stroke-linejoin': 'round'
    }));
    parte.forEach(p => camadaDividir.appendChild(el('circle', {
      cx: p.x, cy: p.y, r: 9 * e, fill: '#c9d2d6', stroke: '#fff', 'stroke-width': 2.5 * e
    })));
  });

  /* marca de confirmação em cada parte, quando já há corte */
  if (partes.length > 1) {
    partes.forEach(parte => {
      const c = centro(parte);
      camadaDividir.appendChild(el('circle', {
        cx: c.x, cy: c.y, r: 22 * e, fill: '#1c1f22', stroke: '#3ad46a', 'stroke-width': 6 * e
      }));
      camadaDividir.appendChild(el('path', {
        d: 'M' + (c.x - 10 * e) + ' ' + c.y + ' l7 8 l13 -15',
        fill: 'none', stroke: '#3ad46a', 'stroke-width': 5 * e,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    });
  }

  /* linha de divisão e pontos de ancoragem */
  if (divisao.ancoras.length === 2) {
    const a = divisao.ancoras[0], b = divisao.ancoras[1];
    const dx = b.x - a.x, dy = b.y - a.y, n = Math.hypot(dx, dy) || 1;
    const longe = 4000 / zoomDiv.s;
    camadaDividir.appendChild(el('line', {
      x1: a.x - dx / n * longe, y1: a.y - dy / n * longe,
      x2: b.x + dx / n * longe, y2: b.y + dy / n * longe,
      stroke: '#fff', 'stroke-width': 3 * e, 'stroke-dasharray': (8 * e) + ' ' + (8 * e)
    }));
  }
  divisao.ancoras.forEach(p => camadaDividir.appendChild(el('circle', {
    cx: p.x, cy: p.y, r: 16 * e, fill: '#e9eef0', stroke: '#fff', 'stroke-width': 3 * e
  })));

  /* retículo (tamanho fixo, fora do zoom) */
  const r = divisao.reticulo;
  grupoReticulo.appendChild(el('path', {
    d: 'M' + r.x + ' ' + (r.y - 26) + ' v18 M' + r.x + ' ' + (r.y + 8) + ' v18 M' +
       (r.x - 26) + ' ' + r.y + ' h18 M' + (r.x + 8) + ' ' + r.y + ' h18',
    stroke: '#dfe4e6', 'stroke-width': 5, 'stroke-linecap': 'round'
  }));

  const temCorte = partes.length > 1;
  $('#botao-adicionar-ancora').textContent = divisao.ancoras.length >= 2 ? 'Próximo' : 'Adicionar';
  $('#botao-salvar-divisao').classList.toggle('desativado', !temCorte);
}

$('#botao-salvar-divisao').addEventListener('click', () => {
  aplicarCorte();
  divisao.ancoras = [];
  if (divisao.partes.length < 2) return;
  const base = divisao.tarefa.nome;
  divisao.partes.forEach((parte, i) => {
    tarefas.push({
      id: Date.now() + i,
      nome: base + '_Dividir_' + (i + 1),
      data: new Date(),
      area: areaHa(parte),
      limite: parte,
      obstaculo: []
    });
  });
  selecionada = null;
  mostrarTela('mapa');
  painelTarefas.classList.add('aberto');
  abaLista = 'Tarefa';
  $$('.abas-painel .aba').forEach(a => a.classList.toggle('ativa', a.dataset.aba === 'Tarefa'));
  renderizarLista();
});

/* ============================================================
   Aeronave conectada / desconectada
   ============================================================ */
function sincronizarConexao() {
  if (!estado.droneLigado || faseControle !== 'pronto') {
    clearTimeout(temporizadorConexao);
    temporizadorConexao = null;
    estado.conectando = false;
    estado.conectado = false;
    if (estado.tela === 'execucao') mostrarTela('mapa');
    if (estado.tela === 'modos') mostrarTela('inicial');
    atualizarConexao();
    return;
  }
  if (estado.conectado || estado.conectando) return;
  estado.conectando = true;
  atualizarConexao();
  temporizadorConexao = setTimeout(() => {
    estado.conectando = false;
    estado.conectado = true;
    temporizadorConexao = null;
    atualizarConexao();
  }, 650);
}

function atualizarConexao() {
  document.body.classList.toggle('conectado', estado.conectado);
  document.body.classList.toggle('conectando', estado.conectando);
  const titulo = $('#cartao-conexao .cartao-titulo');
  titulo.textContent = estado.conectando ? 'Conectando…' : estado.conectado ? 'T50 conectado' : 'Aeronave desconectada';
  titulo.style.color = estado.conectado ? '#2f3336' : '';
  $('#cartao-conexao').setAttribute('aria-label', estado.conectado ? 'Drone T50 conectado na simulação' : 'Aeronave desconectada');
  $('#mensagem-conexao').hidden = !estado.conectando;
  const statusConfig = $('#status-config-drone');
  if (statusConfig) statusConfig.textContent = estado.conectado ? 'T50 conectado (simulado)' : 'Aeronave desconectada';
  $$('.estado-aeronave').forEach(item => {
    item.textContent = estado.conectado ? 'T50 conectado' : 'Aeronave desconectada';
  });
  desenharTarefasNoMapa();
}

$$('.aviso-branco button').forEach(b =>
  b.addEventListener('click', () => b.parentElement.style.display = 'none'));

/* ============================================================
   Escolher entre mapas sobrepostos
   ============================================================ */
const mapaGeral = $('[data-tela="mapa"] .arte-mapa');
const caixaEscolha = $('#escolher-mapa');

function dentroDoPoligono(p, pontos) {
  let dentro = false;
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
    const a = pontos[i], b = pontos[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

mapaGeral.addEventListener('click', e => {
  const r = mapaGeral.getBoundingClientRect();
  const p = {
    x: (e.clientX - r.left) / r.width * LARGURA_MAPA,
    y: (e.clientY - r.top) / r.height * ALTURA_MAPA
  };
  const sob = tarefas.concat(emAndamento).filter(t => t.limite.length >= 3 && dentroDoPoligono(p, t.limite));
  caixaEscolha.classList.remove('aberto');
  if (!sob.length) return;
  if (sob.length === 1) { escolherTarefa(sob[0]); return; }

  /* mais de um mapa no mesmo ponto: o controle pede para escolher */
  const lista = caixaEscolha.querySelector('.opcoes-mapa');
  lista.textContent = '';
  sob.forEach(t => {
    const b = document.createElement('button');
    b.innerHTML = '<span></span><em>' + t.area.toFixed(2) + ' Ha</em>';
    b.dataset.numero = String(sob.indexOf(t) + 1);
    if (t.id === selecionada) b.classList.add('ativa');
    b.querySelector('span').textContent = t.nome;
    b.addEventListener('click', ev => {
      ev.stopPropagation();
      escolherTarefa(t);
      caixaEscolha.classList.remove('aberto');
    });
    lista.appendChild(b);
  });
  caixaEscolha.style.left = Math.min(70, (e.clientX - r.left) / r.width * 100) + '%';
  caixaEscolha.style.top = Math.min(60, (e.clientY - r.top) / r.height * 100) + '%';
  caixaEscolha.classList.add('aberto');
});

function escolherTarefa(t) {
  selecionada = t.id;
  painelTarefas.classList.add('aberto');
  renderizarLista();
}

document.addEventListener('click', e => {
  if (!caixaEscolha.contains(e.target) && e.target !== mapaGeral)
    caixaEscolha.classList.remove('aberto');
});

atualizarConexao();

/* ============================================================
   Tela de execução da tarefa
   ============================================================ */
$('#botao-usar').addEventListener('click', e => {
  if (e.currentTarget.classList.contains('desativado')) return;
  if (estado.conectado) abrirExecucao();
});

$$('[data-aba-exec]').forEach(b => b.addEventListener('click', () => {
  $$('[data-aba-exec]').forEach(o => o.classList.toggle('ativa', o === b));
  $$('[data-exec-aba]').forEach(c => c.classList.toggle('ativa', c.dataset.execAba === b.dataset.abaExec));
}));

const PASSOS_EXEC = {
  taxa: 0.05, velocidade: 0.1, altura: 0.1, 'espacamento-exec': 0.01, 'rth-vel': 0.2, 'rth-alt': 1
};
$$('.passo-botao[data-exec]').forEach(botao => {
  botao.addEventListener('click', () => {
    const campo = botao.dataset.exec;
    const alvo = $('#exec-' + campo);
    const passo = PASSOS_EXEC[campo] || 1;
    const casas = String(passo).split('.')[1] ? String(passo).split('.')[1].length : 0;
    const novo = Math.min(campo === 'espacamento-exec' ? 59.03 : Infinity,
      Math.max(campo === 'espacamento-exec' ? 1.6 : 0, Number(alvo.textContent) + passo * Number(botao.dataset.delta)));
    alvo.textContent = novo.toFixed(casas);
    if (campo === 'taxa' || campo === 'velocidade' || campo === 'espacamento-exec') {
      const taxa = Number($('#exec-taxa').textContent);
      const vel = Number($('#exec-velocidade').textContent);
      const esp = Number($('#exec-espacamento-exec').textContent);
      $('.linha-info em').textContent = (taxa * vel * esp / 600).toFixed(2) + ' L/Min';
    }
  });
});

$$('[data-tela="execucao"] .lista-cenario button').forEach(b =>
  b.addEventListener('click', () => $$('[data-tela="execucao"] .lista-cenario button')
    .forEach(o => o.classList.toggle('ativa', o === b))));

$$('[data-tela="execucao"] .interruptor').forEach(i =>
  i.addEventListener('click', () => i.classList.toggle('ligado')));

/* ---- retificar a compensação ---- */
const painelRetificar = $('#painel-retificar');
let compensacao = 0;

$('#botao-retificar').addEventListener('click', () => {
  compensacao = 0;
  $('#valor-compensacao').textContent = '0.0';
  painelRetificar.classList.add('aberto');
});
$$('.dpad .seta').forEach(b => b.addEventListener('click', () => {
  compensacao = Math.round((compensacao + 0.1) * 10) / 10;
  $('#valor-compensacao').textContent = compensacao.toFixed(1);
}));
$('#cancelar-retificar').addEventListener('click', () => painelRetificar.classList.remove('aberto'));
$('#confirmar-retificar').addEventListener('click', () => painelRetificar.classList.remove('aberto'));

/* R2 / R3 também fecham o painel de compensação */
$$('.botao-lateral').forEach(botao => {
  botao.addEventListener('click', () => {
    if (!painelRetificar.classList.contains('aberto')) return;
    if (botao.textContent === 'R2') $('#cancelar-retificar').click();
    if (botao.textContent === 'R3') $('#confirmar-retificar').click();
  });
});

$$('[data-tela="execucao"] .aviso-branco button').forEach(b =>
  b.addEventListener('click', () => b.parentElement.style.display = 'none'));

/* ---------- clicar na câmera troca com o mapa ---------- */
const telaMapa = $('[data-tela="mapa"]');
$('#fpv-mapa').addEventListener('click', e => {
  e.stopPropagation();
  telaMapa.classList.toggle('trocado');
});

/* ---------- a execução usa os dados do mapa escolhido ---------- */
function abrirExecucao() {
  const t = tarefaEscolhida();
  if (t) {
    $('#exec-area').textContent = t.area.toFixed(2);
    atualizarVolume();
  }
  mostrarTela('execucao');
}
function atualizarVolume() {
  const area = Number($('#exec-area').textContent);
  const taxa = Number($('#exec-taxa').textContent);
  $('#exec-volume').textContent = (area * taxa).toFixed(1);
}
$$('.passo-botao[data-exec="taxa"]').forEach(b => b.addEventListener('click', atualizarVolume));

/* ---------- Iniciar: o controle tenta subir a tarefa ---------- */
const dialogoUpload = $('#dialogo-upload');
$('#botao-iniciar').addEventListener('click', () => dialogoUpload.classList.add('aberto'));
$('#cancelar-upload').addEventListener('click', () => dialogoUpload.classList.remove('aberto'));
$('#tentar-upload').addEventListener('click', () => dialogoUpload.classList.remove('aberto'));

// Papel de parede do sistema reutiliza a ilustração do controle.
$('#papel-sistema').appendChild($('.arte-capa').cloneNode(true));
