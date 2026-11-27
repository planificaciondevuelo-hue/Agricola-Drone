/* ============================================================
   Telas e comportamentos tirados das gravações do RC Plus de
   verdade (Gravador de Telas, 30/09/2026): registros de voo,
   pastinha com microSD e seleção, gerenciamento de registros,
   firmware, calibração do controle, listas suspensas e RTK.
   ============================================================ */

/* ---------- peças comuns ---------- */
function avisoRapido(raiz, texto) {
  const t = document.createElement('div');
  t.className = 'aviso-rapido';
  t.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m7.6 12.4 3 3 5.8-6.2" fill="none" ' +
    'stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' + texto;
  raiz.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function dialogoApp(raiz, html, classe) {
  const fundo = document.createElement('div');
  fundo.className = 'dialogo-fundo aberto dialogo-app ' + (classe || '');
  fundo.innerHTML = '<div class="dialogo">' + html + '</div>';
  raiz.appendChild(fundo);
  return fundo;
}

function dialogoConfirmar(raiz, titulo, rotuloSim, aoConfirmar) {
  const d = dialogoApp(raiz,
    '<div class="marca-aviso">!</div><h3>' + titulo + '</h3>' +
    '<div class="botoes-dialogo"><button class="cancelar">Cancelar(R2)</button>' +
    '<button class="vermelho">' + rotuloSim + '(R3)</button></div>');
  d.querySelector('.cancelar').addEventListener('click', () => d.remove());
  d.querySelector('.vermelho').addEventListener('click', () => { d.remove(); aoConfirmar(); });
}

/* lista suspensa igual à do app: abre embaixo do campo, opção escolhida em verde */
let listaAberta = null;
function fecharLista() {
  if (listaAberta) { listaAberta.botao.classList.remove('aberta'); listaAberta.el.remove(); listaAberta = null; }
}
function abrirLista(botao, opcoes, aoEscolher) {
  const mesma = listaAberta && listaAberta.botao === botao;
  fecharLista();
  if (mesma) return;
  const atual = botao.firstChild.nodeValue.trim();
  const raiz = botao.closest('.painel-config');
  const caixa = raiz.getBoundingClientRect();
  const r = botao.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'lista-suspensa';
  el.style.left = (r.left - caixa.left) + 'px';
  el.style.top = (r.bottom - caixa.top + 2) + 'px';
  el.style.width = r.width + 'px';
  el.innerHTML = opcoes.map(o => '<button class="' + (o === atual ? 'ativa' : '') + '">' + o + '</button>').join('');
  raiz.appendChild(el);
  botao.classList.add('aberta');
  listaAberta = { botao, el, desde: performance.now() };
  const ativa = el.querySelector('.ativa');
  if (ativa) el.scrollTop = ativa.offsetTop - el.clientHeight / 2;
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    botao.firstChild.nodeValue = b.textContent;
    fecharLista();
    if (aoEscolher) aoEscolher(b.textContent);
  }));
}
document.addEventListener('click', e => {
  if (listaAberta && !listaAberta.el.contains(e.target) && e.target !== listaAberta.botao &&
      !listaAberta.botao.contains(e.target)) fecharLista();
});
document.addEventListener('scroll', e => {
  /* a rolagem que a própria troca de página provoca não fecha a lista recém-aberta */
  if (listaAberta && !listaAberta.el.contains(e.target) && performance.now() - listaAberta.desde > 400) fecharLista();
}, true);

/* ============================================================
   Painel da engrenagem
   ============================================================ */
const FUNCOES_BOTAO = [
  'Indefinida', 'Interruptor de holofote', 'Ativar/desativar desvio de obstáculos multidirecional',
  'Estabilizador de inclinação para baixo/recentralização', 'Direção para a esquerda (M+)',
  'Direção para a direita (M+)', 'Retorno (modo manual)', 'Adicionar ponto',
  'Defina o Ponto A (Rota A-B)', 'Defina o Ponto B (Rota A-B)'
];
$$c('.painel-config .personalizados .caixa-select').forEach(b =>
  b.addEventListener('click', e => { e.stopPropagation(); abrirLista(b, FUNCOES_BOTAO); }));

/* RTK: desligado mostra só as duas chaves; a fonte troca o miolo */
(function () {
  const pagina = $c('.pagina-config[data-config="rtk"]');
  const chave = pagina.querySelector('#rtk-ligado .interruptor');
  const sincronizar = () => pagina.classList.toggle('rtk-desligado', !chave.classList.contains('ligado'));
  chave.addEventListener('click', sincronizar);
  sincronizar();
  const fonte = pagina.querySelector('[data-lista="fonte-rtk"]');
  pagina.classList.add('fonte-rede');
  fonte.addEventListener('click', e => {
    e.stopPropagation();
    abrirLista(fonte, ['Estação móvel D-RTK 2', 'RTK de rede personalizada'], v => {
      pagina.classList.toggle('fonte-rede', v !== 'Estação móvel D-RTK 2');
      pagina.classList.toggle('fonte-drtk', v === 'Estação móvel D-RTK 2');
    });
  });
})();

/* ---------- calibração do controle remoto ----------
   1/2 manches e 2/2 rodas. Anda sozinha quando cada lado chega no fim:
   com o RC Plus de verdade pelos eixos do gamepad; no PC, arrastando o
   pino no quadro (manches) ou girando a roda do mouse (rodas). */
function abrirCalibracaoCR() {
  const raiz = painelConfig;
  const pinos = { esq: { x: 0, y: 0, max: [0, 0, 0, 0] }, dir: { x: 0, y: 0, max: [0, 0, 0, 0] } };
  const rodas = { esq: { v: 0, min: 0, max: 0 }, dir: { v: 0, min: 0, max: 0 } };
  let etapa = 1, laco = null;

  const fundo = dialogoApp(raiz, '', 'calibracao-cr');
  const caixa = fundo.querySelector('.dialogo');

  const cartaoPinoCal = (lado, nome) =>
    '<div class="cal-pino" data-lado="' + lado + '"><p>' + nome + '</p>' +
    '<span class="c cima">0%</span><span class="c baixo">0%</span><span class="c esquerda">0%</span><span class="c direita">0%</span>' +
    '<div class="cal-cruz"><i class="ponto"></i></div></div>';
  const cartaoRoda = (lado, nome) =>
    '<div class="cal-roda" data-lado="' + lado + '"><p>' + nome + '</p>' +
    '<div class="barra-roda"><span class="min">0%</span><div class="trilho"><i class="neg"></i><i class="pos"></i></div>' +
    '<span class="max">0%</span></div>' + DIAGRAMA_RODA(lado) + '</div>';

  function desenhar() {
    if (etapa === 1) {
      caixa.innerHTML = '<h3>1/2 Calibração da alavanca de controle</h3>' +
        '<p class="texto-aviso">Mova lentamente os dois pinos de controle por toda a sua amplitude de movimento</p>' +
        '<div class="cal-cartoes">' + cartaoPinoCal('esq', 'Pino esquerdo') + cartaoPinoCal('dir', 'Pino direito') + '</div>' +
        '<div class="botoes-dialogo"><button class="sair">Sair e calibrar mais tarde(R2)</button></div>';
    } else if (etapa === 2) {
      caixa.innerHTML = '<h3>2/2 Calibração do botão rotativo</h3>' +
        '<p class="texto-aviso">Gire repetidamente os botões de rolagem esquerdo e direito ao máximo</p>' +
        '<div class="cal-cartoes">' + cartaoRoda('esq', 'Botão rotativo esquerdo') + cartaoRoda('dir', 'Botão rotativo direito') + '</div>' +
        '<div class="botoes-dialogo"><button class="sair">Sair e calibrar mais tarde(R2)</button></div>';
    } else {
      caixa.innerHTML = '<div class="marca-ok"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/>' +
        '<path d="m7.6 12.4 3 3 5.8-6.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
        '<h3>Calibrado</h3><div class="botoes-dialogo"><button class="ok">OK(R3)</button></div>';
      caixa.querySelector('.ok').addEventListener('click', fechar);
      return;
    }
    caixa.querySelector('.sair').addEventListener('click', fechar);
    ligarArraste();
  }

  function fechar() { cancelAnimationFrame(laco); fundo.remove(); }

  function ligarArraste() {
    caixa.querySelectorAll('.cal-pino').forEach(c => {
      const cruz = c.querySelector('.cal-cruz');
      let ativo = false;
      const mover = e => {
        const r = cruz.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
        pinos[c.dataset.lado].x = x; pinos[c.dataset.lado].y = y;
      };
      cruz.addEventListener('pointerdown', e => { ativo = true; cruz.setPointerCapture(e.pointerId); mover(e); });
      cruz.addEventListener('pointermove', e => { if (ativo) mover(e); });
      cruz.addEventListener('pointerup', () => { ativo = false; pinos[c.dataset.lado].x = 0; pinos[c.dataset.lado].y = 0; });
    });
    caixa.querySelectorAll('.cal-roda').forEach(c => {
      c.addEventListener('wheel', e => {
        e.preventDefault();
        const r = rodas[c.dataset.lado];
        r.v = Math.max(-1, Math.min(1, r.v + (e.deltaY > 0 ? 0.25 : -0.25)));
      }, { passive: false });
      const trilho = c.querySelector('.trilho');
      let ativo = false;
      const mover = e => {
        const b = trilho.getBoundingClientRect();
        rodas[c.dataset.lado].v = Math.max(-1, Math.min(1, (e.clientX - b.left) / b.width * 2 - 1));
      };
      trilho.addEventListener('pointerdown', e => { ativo = true; trilho.setPointerCapture(e.pointerId); mover(e); });
      trilho.addEventListener('pointermove', e => { if (ativo) mover(e); });
      trilho.addEventListener('pointerup', () => { ativo = false; rodas[c.dataset.lado].v = 0; });
    });
  }

  function lerGamepad() {
    const g = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(p => p && p.axes.length >= 4) : null;
    if (!g) return;
    const a = g.axes;
    if (etapa === 1) {
      if (Math.abs(a[0]) > .05 || Math.abs(a[1]) > .05) { pinos.esq.x = a[0]; pinos.esq.y = a[1]; }
      if (Math.abs(a[2]) > .05 || Math.abs(a[3]) > .05) { pinos.dir.x = a[2]; pinos.dir.y = a[3]; }
    } else if (etapa === 2 && a.length >= 6) {
      if (Math.abs(a[4]) > .05) rodas.esq.v = a[4];
      if (Math.abs(a[5]) > .05) rodas.dir.v = a[5];
    }
  }

  function quadro() {
    lerGamepad();
    if (etapa === 1) {
      let completo = true;
      ['esq', 'dir'].forEach(l => {
        const p = pinos[l];
        const m = p.max;
        m[0] = Math.max(m[0], -p.y); m[1] = Math.max(m[1], p.y); m[2] = Math.max(m[2], -p.x); m[3] = Math.max(m[3], p.x);
        const c = caixa.querySelector('.cal-pino[data-lado="' + l + '"]');
        if (!c) return;
        ['cima', 'baixo', 'esquerda', 'direita'].forEach((n, i) =>
          c.querySelector('.' + n).textContent = Math.round(Math.max(0, m[i]) * 100) + '%');
        const ponto = c.querySelector('.ponto');
        ponto.style.left = 'calc(' + (50 + p.x * 50) + '% - 1cqw)';
        ponto.style.top = 'calc(' + (50 + p.y * 50) + '% - 1cqw)';
        if (m.some(v => v < .95)) completo = false;
      });
      if (completo) { etapa = 2; desenhar(); }
    } else if (etapa === 2) {
      let completo = true;
      ['esq', 'dir'].forEach(l => {
        const r = rodas[l];
        r.min = Math.min(r.min, r.v); r.max = Math.max(r.max, r.v);
        const c = caixa.querySelector('.cal-roda[data-lado="' + l + '"]');
        if (!c) return;
        c.querySelector('.min').textContent = Math.round(-r.min * 100) + '%';
        c.querySelector('.max').textContent = Math.round(r.max * 100) + '%';
        c.querySelector('.neg').style.width = (-r.min * 50) + '%';
        c.querySelector('.pos').style.width = (r.max * 50) + '%';
        if (r.min > -.95 || r.max < .95) completo = false;
      });
      if (completo) { etapa = 3; desenhar(); }
    }
    if (etapa < 3) laco = requestAnimationFrame(quadro);
  }

  desenhar();
  laco = requestAnimationFrame(quadro);
}
const DIAGRAMA_RODA = lado => '<svg class="figura-roda" viewBox="0 0 120 60">' +
  '<rect x="10" y="22" width="100" height="30" rx="6" fill="#8d9296"/><rect x="30" y="14" width="60" height="16" rx="3" fill="#5e6367"/>' +
  '<rect x="' + (lado === 'esq' ? 14 : 92) + '" y="16" width="14" height="8" rx="3" fill="#3c4245"/>' +
  '<path d="' + (lado === 'esq' ? 'M8 30a12 12 0 0 1 12-14' : 'M112 30a12 12 0 0 0-12-14') + '" fill="none" stroke="#3ab54a" stroke-width="3"/>' +
  '<path d="' + (lado === 'esq' ? 'm16 12 6 4-6 3z' : 'm104 12-6 4 6 3z') + '" fill="#3ab54a"/></svg>';

$$c('[data-acao="calibrar-cr"]').forEach(b => b.addEventListener('click', abrirCalibracaoCR));

/* ============================================================
   Telas da tela inicial
   ============================================================ */

/* ---------- perfil > Registros de voo ---------- */
const VOOS_LOCAIS = [
  ['2026-08-18 16:52:49', 'Verificando on-line…', '0.14Ha', '01minuto58s', '1.99l', 'Rota automática'],
  ['2026-08-18 16:42:04', 'Verificando on-line…', '0.11Ha', '01minuto48s', '0.90l', 'Rota automática'],
  ['2026-08-18 16:40:59', 'Verificando on-line…', '0.00Ha', '00minuto22s', '0.00l', 'Manual'],
  ['2026-08-18 16:36:47', 'Verificando on-line…', '0.00Ha', '00minuto29s', '0.00l', 'Manual'],
  ['2026-08-17 21:13:41', 'Linha do Cedro', '0.00Ha', '00minuto30s', '0.00l', 'Manual']
];
(function () {
  const def = TELAS_EXTRA.usuario;
  const corpo = def.corpo;
  def.corpo = () => corpo().replace('<button class="linha-link"><span>Registros de voo',
    '<button class="linha-link" data-abre-sub="voos"><span>Registros de voo');
  def.subtelas = { voos: { titulo: 'Registros de voos locais', blocos: [{ t: 'voos-locais' }] } };
})();

/* ---------- pastinha: Local, Nuvem e microSD, com seleção ---------- */
ARQUIVOS.microSD = {
  'Tarefa': { aviso: ['O arquivo de tarefa deve ser colocado em /DJI/routes/, e o arquivo SHP deve ser colocado em /DJI/Shapefile/'],
    itens: [['2026/09/29 17:19:26', 'Pomar de laranja'], ['2026/09/30 14:45:40', 'mapa_1'],
            ['2026/09/29 23:58:14', 'teste 4'], ['2026/09/29 23:49:28', 'teste 3']] },
  'Saída de reconstrução': { aviso: ['Certifique-se de colocar os arquivos no local correto: /DJI/rebuild/',
      'Baixe ou importe as restrições para arquivos de reconstrução: Tamanho total do arquivo menor que 1,2GB, ' +
      'tamanho do arquivo TIF menor que 800,0MB, área do campo menor que 20Ha'],
    itens: [['2026/09/29 17:17:20', 'teste 1']] },
  'Mapa de prescrição': { aviso: ['Certifique-se de colocar os arquivos no local correto: /DJI/RX/'],
    itens: [['2026/09/29 23:58:14', 'teste 4'], ['2026/09/29 23:49:28', 'teste 3'],
            ['2026/09/29 23:37:26', 'teste 2'], ['2026/09/29 23:17:38', 'ortho_aplicacao']] }
};
const MENU_ARQUIVOS = {
  Local: ['Tarefa', 'Tarefas em andamento', 'Modelos de tarefa', 'Material', 'Saída de reconstrução', 'Mapa de prescrição'],
  Nuvem: ['Tarefa', 'Tarefas em andamento', 'Modelos de tarefa', 'Material', 'Saída de reconstrução', 'Mapa de prescrição'],
  microSD: ['Tarefa', 'Saída de reconstrução', 'Mapa de prescrição']
};
const selecao = { ativa: false, marcados: new Set() };

/* botão verde do rodapé da seleção, conforme a aba e a seção */
function acaoSelecao(aba, secao) {
  if (aba === 'microSD') return 'Importar';
  if (aba === 'Nuvem') return 'Baixar';
  return secao === 'Tarefas em andamento' ? 'Concluir' : 'Carregar';
}

(function () {
  const def = TELAS_EXTRA.arquivos;
  def.abas = ['Local', 'Nuvem', 'microSD'];
  Object.defineProperty(def, 'menu', { get: () => MENU_ARQUIVOS[abaExtra || 'Local'], configurable: true });
  def.corpo = (aba, secao) => {
    const dados = ARQUIVOS[aba][secao];
    if (!dados) return '<p class="sem-mais">Sem mais dados</p>';
    const sd = aba === 'microSD';
    const marcando = sd || selecao.ativa;
    const caixa = i => marcando ? '<span class="marcar' + (selecao.marcados.has(i) ? ' marcado' : '') + '" data-marcar="' + i + '"></span>' : '';
    let lista;
    if (sd) {
      lista = dados.itens.map((it, i) =>
        '<div class="item-arquivo sd' + (selecao.marcados.has(i) ? ' marcado' : '') + '" data-item="' + i + '">' + caixa(i) +
        '<div class="dados"><span class="data">' + it[0] + '</span><span class="nome">' + it[1] + '</span></div></div>').join('');
    } else if (dados.material) {
      lista = dados.itens.map((it, i) =>
        '<div class="item-arquivo material' + (selecao.marcados.has(i) ? ' marcado' : '') + '" data-item="' + i + '">' + caixa(i) +
        graficoMaterial(it.fim) +
        '<div class="dados"><span class="data">' + it.data + '</span><span class="nome">' + it.nome + '</span></div>' +
        '<div class="direita"><span class="etiquetas-arquivo"><em>' + it.etiqueta + '</em>' + it.nuvem + '</span></div></div>').join('');
    } else {
      lista = dados.itens.map((it, i) => itemArquivo(it).replace('<div class="item-arquivo">',
        '<div class="item-arquivo' + (selecao.marcados.has(i) ? ' marcado' : '') + '" data-item="' + i + '">' + caixa(i))).join('');
    }
    const vazio = '<div class="vazio-central"><svg viewBox="0 0 64 64"><path d="M12 6h30l10 10v42H12z" fill="#dcdcdb"/>' +
      '<path d="M42 6v10h10z" fill="#c9c9c8"/><g fill="#fff"><rect x="20" y="24" width="24" height="4" rx="2"/>' +
      '<rect x="20" y="32" width="24" height="4" rx="2"/><rect x="20" y="40" width="16" height="4" rx="2"/></g></svg>' +
      '<p>Nenhum arquivo encontrado</p></div>';
    const topo = sd
      ? '<div class="aviso-sd">' + dados.aviso.map(a => '<p><i>!</i>' + a + '</p>').join('') + '</div>'
      : (selecao.ativa ? '' : barraFiltros(dados.filtros));
    const n = selecao.marcados.size;
    const todos = dados.itens.length > 0 && n === dados.itens.length;
    const naoCarregado = !sd && aba === 'Local' && secao !== 'Tarefas em andamento';
    const comExcluir = aba === 'Local';
    const rodape = marcando
      ? '<div class="rodape-selecao"><div class="marcas-rodape">' +
          '<label class="marcar-linha" data-sel="todos"><span class="marcar' + (todos ? ' marcado' : '') + '"></span>Selecionar tudo</label>' +
          (naoCarregado ? '<label class="marcar-linha" data-sel="nao-carregado"><span class="marcar"></span>Não carregado</label>' : '') +
        '</div><button class="desmarcar" data-sel="desmarcar">Desmarcar tudo</button>' +
        '<span class="contagem">' + n + ' selecionado</span>' +
        (comExcluir ? '<button class="botao-excluir' + (n ? '' : ' apagado') + '" data-sel="excluir">Excluir</button>' : '') +
        '<button class="botao-verde' + (n ? '' : ' apagado') + '" data-sel="acao">' + acaoSelecao(aba, secao) + '</button></div>'
      : '';
    return topo + '<div class="lista-arquivos">' +
      (dados.itens.length ? lista : vazio) +
      (dados.itens.length && dados.fim ? '<p class="sem-mais">Sem mais dados</p>' : '') + '</div>' + rodape;
  };
})();

function ligarSelecaoArquivos() {
  const aba = abaExtra, secao = secaoExtra;
  const dados = ARQUIVOS[aba] && ARQUIVOS[aba][secao];
  if (!dados) return;
  const q = s => Array.from(painelExtra.querySelectorAll(s));
  q('.filtro.claro').forEach(b => {
    if ((window.TPD_IDIOMAS ? TPD_IDIOMAS.original(b) : b.textContent) === 'Selecione') b.addEventListener('click', () => {
      selecao.ativa = true; selecao.marcados.clear(); montarExtra();
    });
  });
  const alternar = i => {
    selecao.marcados.has(i) ? selecao.marcados.delete(i) : selecao.marcados.add(i);
    montarExtra();
  };
  if (selecao.ativa || aba === 'microSD') {
    q('[data-item]').forEach(el => el.addEventListener('click', () => alternar(Number(el.dataset.item))));
  }
  const sel = n => painelExtra.querySelector('[data-sel="' + n + '"]');
  if (sel('todos')) sel('todos').addEventListener('click', () => {
    const todos = selecao.marcados.size === dados.itens.length;
    selecao.marcados.clear();
    if (!todos) dados.itens.forEach((_, i) => selecao.marcados.add(i));
    montarExtra();
  });
  if (sel('nao-carregado')) sel('nao-carregado').addEventListener('click', () => {
    selecao.marcados.clear();
    dados.itens.forEach((it, i) => { if (it.nuvem === nuvemErro) selecao.marcados.add(i); });
    montarExtra();
  });
  if (sel('desmarcar')) sel('desmarcar').addEventListener('click', () => {
    selecao.marcados.clear();
    if (aba !== 'microSD') selecao.ativa = false;
    montarExtra();
  });
  const marcados = () => Array.from(selecao.marcados).sort((a, b) => b - a);
  const tirar = () => marcados().forEach(i => dados.itens.splice(i, 1));
  if (sel('excluir')) sel('excluir').addEventListener('click', () => {
    if (!selecao.marcados.size) return;
    dialogoConfirmar(painelExtra, 'Excluir arquivos selecionados do controle remoto atual?', 'Excluir', () => {
      tirar(); selecao.marcados.clear(); montarExtra();
      avisoRapido(painelExtra, 'Arquivos excluídos');
    });
  });
  if (sel('acao')) sel('acao').addEventListener('click', () => {
    if (!selecao.marcados.size) return;
    const acao = acaoSelecao(aba, secao);
    if (acao === 'Baixar') return baixarDaNuvem(dados, marcados());
    if (acao === 'Concluir') tirar();
    if (acao === 'Carregar') marcados().forEach(i => { if (dados.itens[i].nuvem === nuvemErro) dados.itens[i].nuvem = nuvemOk; });
    if (acao === 'Importar') {
      const destino = ARQUIVOS.Local[secao];
      marcados().forEach(i => destino.itens.unshift({ data: dados.itens[i][0].slice(0, 16), nome: dados.itens[i][1],
        local: 'N/A', area: secao === 'Tarefa' ? '0.0' : null, etiqueta: secao === 'Tarefa' ? 'Rota' : null,
        tipoMini: secao === 'Mapa de prescrição' ? 'grade' : 'terra', nuvem: nuvemErro }));
    }
    selecao.marcados.clear();
    if (aba !== 'microSD') selecao.ativa = false;
    montarExtra();
  });
}

function baixarDaNuvem(dados, indices) {
  const d = dialogoApp(painelExtra,
    '<div class="icone-baixar">' + nuvemBaixar('ok') + '</div>' +
    '<h3>Baixando arquivo. Verifique se a conexão de rede é estável</h3>' +
    '<div class="progresso-baixar"><i></i></div><p class="porcento">0%</p>' +
    '<div class="botoes-dialogo"><button class="cancelar">Cancelar(R2)</button></div>', 'dialogo-baixar');
  let p = 0, cancelado = false;
  d.querySelector('.cancelar').addEventListener('click', () => { cancelado = true; d.remove(); });
  const passo = () => {
    if (cancelado) return;
    p = Math.min(100, p + 10);
    d.querySelector('.progresso-baixar i').style.width = p + '%';
    d.querySelector('.porcento').textContent = p + '%';
    if (p < 100) return setTimeout(passo, 160);
    d.remove();
    indices.forEach(i => {
      const it = dados.itens[i];
      it.nuvem = nuvemBaixar('ok');
      ARQUIVOS.Local.Tarefa.itens.unshift(Object.assign({}, it, { nuvem: nuvemOk }));
    });
    selecao.marcados.clear();
    const ok = dialogoApp(painelExtra, '<div class="marca-ok"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/>' +
      '<path d="m7.6 12.4 3 3 5.8-6.2" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
      '<h3>Arquivos baixados</h3><div class="botoes-dialogo"><button class="ok">OK(R3)</button></div>');
    ok.querySelector('.ok').addEventListener('click', () => { ok.remove(); montarExtra(); });
  };
  setTimeout(passo, 300);
}

/* ---------- Gerenciamento de registros ---------- */
const REGISTROS_CR = [
  ['688', '2026-09-30 23:43', '23:52'], ['687', '2026-09-30 23:33', '23:36'], ['686', '2026-09-30 23:21', '23:30'],
  ['685', '2026-09-30 23:09', '23:17'], ['684', '2026-09-30 22:20', '22:28'], ['683', '2026-09-30 22:12', '22:19'],
  ['682', '2026-09-30 14:44', '14:49'], ['681', '2026-09-29 23:40', '23:58'], ['680', '2026-09-29 22:51', '23:12']
];
TELAS_EXTRA.registros = {
  titulo: 'Gerenciamento de registros',
  corpo: () => {
    const cartao = (titulo, texto, apagado, sub) =>
      '<button class="cartao-registro' + (apagado ? ' apagado' : '') + '"' + (sub ? ' data-abre-sub="' + sub + '"' : '') + '>' +
      '<b>' + titulo + '</b>' + (texto ? '<span>' + texto + '</span>' : '') +
      '<svg viewBox="0 0 24 24"><path d="M3.4 12.6 20.6 4.6 12.6 20.6l-2-7z"/></svg></button>';
    return '<div class="topo-registros"><button class="chip">Salvo em Local</button>' +
      '<button class="chip">Histórico de carregamento</button>' +
      '<button class="chip direita">Carregamento personalizado<i>›</i></button></div>' +
      '<div class="grade-registros">' +
        cartao('Problemas gerais', 'Oferece suporte para problemas relacionados a voo, detecção de obstáculos, planejamento de rotas e outros', true) +
        cartao('Problemas de transmissão', 'Oferece suporte para problemas relacionados à atualização de firmware, transmissão de imagens, ' +
          'velocidade de transferência de dados, conexão da aeronave com controle remoto e outros', false, 'transmissao') +
        cartao('Problemas de mapeamento e reconstrução', '', false, 'mapeamento') +
        cartao('Problemas com o dispositivo de carregamento', '', true) +
      '</div><p class="dica-registros">Carregar registros quando conectado ao Wi-Fi</p>';
  },
  subtelas: {
    transmissao: { titulo: 'Problemas de transmissão', blocos: [{ t: 'lista-registros' }] },
    mapeamento: { titulo: 'Problemas de mapeamento e reconstrução', blocos: [{ t: 'lista-registros' }] }
  }
};

/* ---------- Gerenciamento do dispositivo > firmware ---------- */
let painelFirmwareAberto = false;
(function () {
  const def = TELAS_EXTRA.dispositivo;
  def.subtelas = { firmware: { titulo: 'Atualização de firmware', blocos: [{ t: 'firmware' }] } };
})();

/* ---------- blocos novos ---------- */
const blocoExtraAntes = blocoExtra;
blocoExtra = function (b) {
  switch (b.t) {
    case 'voos-locais':
      return '<div class="topo-voos"><button class="filtro">T25<i>⌄</i></button><button class="botao-verde">Carregar</button></div>' +
        '<div class="tabela-voos"><div class="linha cabecalho"><span>Data/localização</span><span>Área da tarefa</span>' +
        '<span>Duração do voo</span><span>Quantidade</span><span>Modo</span></div>' +
        VOOS_LOCAIS.map(v => '<div class="linha"><span><b>' + v[0] + '</b><i>' + v[1] + '</i></span><span>' + v[2] + '</span>' +
          '<span>' + v[3] + '</span><span>' + v[4] + '</span><span>' + v[5] + '</span>' + nuvemOk + '</div>').join('') + '</div>';
    case 'lista-registros':
      return '<p class="config-desc">Os registros contêm informações sobre o dispositivo, a conta e a localização, bem como ' +
        'filmagens de vídeo feitas pela câmera da aeronave. Essas informações só serão utilizadas para ajudar o suporte ' +
        'a localizar problemas com o seu dispositivo<br>Uma entrada de registro gerada para ligar e desligar o controle remoto</p>' +
        '<div class="lista-registros carregando"><span class="girando"></span>' +
        REGISTROS_CR.map(r => '<label class="registro"><span class="marcar"></span>[Registro-' + r[0] + '] ' + r[1] +
          '&nbsp;&nbsp;-&nbsp;&nbsp;' + r[2] + '</label>').join('') + '</div>';
    case 'firmware': {
      const cartoes = [['Controlador', true, 'rc'], ['Relé', false, 'rele'], ['Estação móvel D-RTK', false, 'drtk']];
      return '<div class="lista-firmware">' + cartoes.map(c =>
        '<div class="cartao-firmware' + (c[1] ? '' : ' apagado') + '"><span class="marcar"></span>' +
        '<span class="nome">' + c[0] + '</span>' +
        (c[1] ? '<button class="versao-firmware"><span>Versão atual<b>06.05.0921</b></span><i>›</i></button>' : '') +
        '</div>').join('') + '</div>' +
        '<div class="rodape-selecao"><button class="desmarcar">Desmarcar tudo</button><span class="contagem"></span>' +
        '<button class="botao-verde apagado">Atualizar todos os selecionados</button></div>' +
        (painelFirmwareAberto ? painelFirmwareHTML() : '');
    }
    default: return blocoExtraAntes(b);
  }
};

function painelFirmwareHTML() {
  return '<div class="fundo-firmware"><div class="painel-firmware">' +
    '<div class="topo"><h2>Controlador Firmware</h2><button class="botao-verde" id="ok-firmware">OK</button></div>' +
    '<p class="tipo-versao">Nova versão</p>' +
    '<div class="versao atual"><span class="bolha"></span><div><b>06.05.0921 <em>Versão atual</em></b>' +
      '<span>2026-01-15 Versão oficial</span></div></div>' +
    '<div class="notas-versao">Notes:<br>· This firmware includes Intelligent Flight Battery firmware. If you have multiple ' +
      'batteries, please run this firmware update on all of them.<br>· Make sure that the firmware of the aircraft and the ' +
      'remote controller are the latest versions. Otherwise, they will not be compatible with each other. The firmware ' +
      'cannot revert to an earlier version after this update.</div>' +
    '<p class="tipo-versao">Histórico da versão</p>' +
    '<div class="versao"><span class="bolha"></span><div><b>06.05.0919</b><span>2025-07-29 Versão oficial</span></div>' +
      '<i>1495,6MB</i></div>' +
    '</div></div>';
}

/* ---------- eventos: a função original e as telas novas ---------- */
const ligarEventosExtraAntes = ligarEventosExtra;
ligarEventosExtra = function () {
  ligarEventosExtraAntes();
  const q = s => Array.from(painelExtra.querySelectorAll(s));
  painelExtra.querySelector('.caixa-extra').classList.toggle('em-sub', subExtra !== 'raiz');

  if (telaExtra === 'arquivos') {
    /* trocar de aba ou de seção sai da seleção; a seção que não existe na aba volta para a primeira */
    q('[data-aba-extra]').forEach(b => b.addEventListener('click', () => {
      selecao.ativa = false; selecao.marcados.clear();
      if (!MENU_ARQUIVOS[abaExtra].includes(secaoExtra)) secaoExtra = MENU_ARQUIVOS[abaExtra][0];
      montarExtra();
    }));
    q('[data-secao]').forEach(b => b.addEventListener('click', () => {
      selecao.ativa = false; selecao.marcados.clear(); montarExtra();
    }));
    ligarSelecaoArquivos();
  }
  if (telaExtra === 'registros' && subExtra !== 'raiz') {
    const lista = painelExtra.querySelector('.lista-registros');
    setTimeout(() => lista && lista.classList.remove('carregando'), 700);
    q('.registro').forEach(r => r.addEventListener('click', () => r.querySelector('.marcar').classList.toggle('marcado')));
  }
  if (telaExtra === 'dispositivo') {
    if (subExtra === 'raiz') {
      const c = painelExtra.querySelector('.cartao-dispositivo.ativo');
      c.style.cursor = 'pointer';
      c.addEventListener('click', () => { subExtra = 'firmware'; painelFirmwareAberto = true; montarExtra(); });
    } else {
      q('.versao-firmware').forEach(b => b.addEventListener('click', () => { painelFirmwareAberto = true; montarExtra(); }));
      const ok = painelExtra.querySelector('#ok-firmware');
      if (ok) ok.addEventListener('click', () => { painelFirmwareAberto = false; montarExtra(); });
      q('.cartao-firmware:not(.apagado) .marcar').forEach(m => m.addEventListener('click', () => m.classList.toggle('marcado')));
    }
  }
};

/* abrir uma tela sempre começa sem seleção */
const abrirExtraAntes = abrirExtra;
abrirExtra = function (nome) {
  selecao.ativa = false; selecao.marcados.clear(); painelFirmwareAberto = false;
  abrirExtraAntes(nome);
};
