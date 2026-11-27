/* ============================================================
   Telas com o drone conectado, tiradas da gravação "drone
   conectado" do RC Plus (30/09/2026): modos da tarefa, painel
   manual (M/M+), mapeamento de rota, tipo de mapa, mapa de
   prescrição, janelinhas da barra de estado, diálogos de
   segurança e a engrenagem com as opções liberadas.

   O mapa de fundo é sempre o terreno do jogo (#terreno); daqui
   só sai interface por cima dele.
   ============================================================ */

const conectado = () => document.body.classList.contains('conectado');
const raizTela = el => el.closest('.tela-app') || document.querySelector('.tela-app.ativa');

/* ---------- alertas empilhados no canto (cinza = informação) ---------- */
function alertaApp(tela, texto, tipo) {
  /* dentro do treinamento, a pilha de alertas é a do jogo (alertas.js) */
  if (window.__xgAlertar) return window.__xgAlertar(texto, tipo);
  let pilha = tela.querySelector('.alertas-app');
  if (!pilha) {
    pilha = document.createElement('div');
    pilha.className = 'alertas-app';
    tela.appendChild(pilha);
  }
  const a = document.createElement('div');
  a.className = 'alerta-app ' + (tipo || 'info');
  a.innerHTML = '<span>' + texto + ' &gt;&gt;</span><button aria-label="Fechar">×</button>';
  a.querySelector('button').addEventListener('click', () => a.remove());
  pilha.prepend(a);
  setTimeout(() => a.remove(), 6000);
}

/* Um clique que precisa de confirmação: segura o clique original, pergunta,
   e só deixa passar (clicando de novo) se a pessoa confirmar. Assim quem já
   escuta o clique — inclusive o jogo — só fica sabendo da mudança aprovada. */
let liberarClique = null;
function pedirConfirmacao(el, quando, montar) {
  document.addEventListener('click', e => {
    const alvo = e.target.closest ? e.target.closest('*') : null;
    if (!alvo || !(el() && el().contains(e.target))) return;
    if (liberarClique === el()) { liberarClique = null; return; }
    if (!quando()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    montar(() => { liberarClique = el(); el().click(); });
  }, true);
}

function dialogo(raiz, html, botoes) {
  const fundo = document.createElement('div');
  fundo.className = 'dialogo-fundo aberto dialogo-app';
  fundo.innerHTML = '<div class="dialogo">' + html + '<div class="botoes-dialogo">' +
    botoes.map((b, i) => '<button class="' + (b.classe || '') + '" data-i="' + i + '">' + b.rotulo + '</button>').join('') +
    '</div></div>';
  raiz.appendChild(fundo);
  fundo.querySelectorAll('[data-i]').forEach(btn => btn.addEventListener('click', () => {
    fundo.remove();
    const acao = botoes[Number(btn.dataset.i)].acao;
    if (acao) acao();
  }));
  return fundo;
}

/* acha o interruptor de uma linha pelo texto do rótulo */
function interruptorPorRotulo(raiz, texto) {
  const linhas = Array.from((raiz || document).querySelectorAll('.linha-toggle-config, .linha-toggle'));
  const linha = linhas.find(l => {
    const r = l.querySelector('.rotulo-toggle, .rotulo-campo');
    return r && (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(r) : r.textContent).replace(/\s+/g, ' ').trim() === texto;
  });
  return linha ? linha.querySelector('.interruptor') : null;
}

/* ============================================================
   Selecione o modo da tarefa
   ============================================================ */
const MODOS_APP = ['rota', 'manual', 'arvore', 'maprota', 'maparvore'];
let modoApp = 'rota';
function escolherModo(modo) {
  modoApp = modo;
  MODOS_APP.forEach(m => document.body.classList.toggle('app-modo-' + m, m === modo));
  document.querySelectorAll('.cartao-modo').forEach(c => c.classList.toggle('ativo', c.dataset.modo === modo));
  mostrarTela('mapa');
}
document.body.classList.add('app-modo-rota');
document.querySelectorAll('.cartao-modo').forEach(c =>
  c.addEventListener('click', () => escolherModo(c.dataset.modo)));

/* ---------- painel do modo Manual (M / M+) ---------- */
(function () {
  const tela = document.querySelector('[data-tela="mapa"]');
  const painel = document.createElement('aside');
  painel.className = 'painel-manual';
  const passo = (rotulo, unidade, id, valor) =>
    '<p class="rotulo-campo">' + rotulo + ' <span>(' + unidade + ')</span></p>' +
    '<div class="passo"><button class="passo-botao" data-man="' + id + '" data-delta="-1">−</button>' +
    '<span class="passo-valor" id="man-' + id + '">' + valor + '</span>' +
    '<button class="passo-botao" data-man="' + id + '" data-delta="1">+</button></div>';
  painel.innerHTML =
    '<div class="abas-mm"><button class="ativa" data-mm="M">M</button><button data-mm="M+">M+</button></div>' +
    '<div class="abas-exec"><button class="ativa" data-aba-man="tarefa">Tarefa</button><button data-aba-man="voo">Voo</button></div>' +
    '<div class="conteudo-man ativa" data-man-aba="tarefa">' +
      '<div class="linha-gabarito"><button class="caixa-select">Nenhum gabarito aplicado<i>⌄</i></button>' +
      '<button class="botao-reset"><svg viewBox="0 0 24 24"><path d="M12 5.4a6.6 6.6 0 1 0 6.4 8.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 1.8v7l3.6-3.5z"/></svg></button></div>' +
      '<div class="so-m">' + passo('Fluxo', 'L/Min', 'fluxo', '10.0') + '</div>' +
      '<div class="so-mmais">' + passo('Taxa de aplicação', 'L/Ha', 'taxa', '49.95') +
        '<div class="linha-info"><span>Fluxo</span><em id="man-fluxo-calc">12.05L/Min</em></div></div>' +
      '<button class="linha-link"><span>Tamanho da gota de pulverização</span><em class="verde-valor">500 µm</em><i>›</i></button>' +
      '<div class="so-m"><div class="linha-toggle-config"><span class="rotulo-toggle">Velocidade máxima de voo</span>' +
        '<button class="interruptor"><i></i></button></div></div>' +
      '<div class="so-mmais">' + passo('Velocidade do voo', 'km/h', 'velocidade', '24.1') +
        passo('Altura acima das culturas', 'm', 'altura', '4.5') + passo('Espaçamento de rota', 'm', 'espacamento', '6.0') + '</div>' +
    '</div>' +
    '<div class="conteudo-man" data-man-aba="voo">' +
      '<p class="rotulo-campo">Cenário</p><div class="segmentado-cenario"><button class="ativa">Planícies</button>' +
      '<button>Pomar<br>Colina</button><button>Acima da água</button></div>' +
      passo('Roteamento de conexão e velocidade RTH', 'km/h', 'rthvel', '36.0') +
      passo('Roteamento de conexão e altitude RTH', 'm', 'rthalt', '7') +
    '</div>';
  tela.appendChild(painel);

  const rotaFixa = document.createElement('button');
  rotaFixa.className = 'botao-claro botao-rota-fixa';
  rotaFixa.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>Rota Fixa</span>';
  tela.appendChild(rotaFixa);
  const iniciar = document.createElement('button');
  iniciar.className = 'botao-claro botao-iniciar-manual';
  iniciar.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7.6 8.4 12 4l4.4 4.4M5 15v4h14v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Iniciar</span>';
  tela.appendChild(iniciar);

  rotaFixa.addEventListener('click', () => {
    const t = document.createElement('div');
    t.className = 'aviso-centro';
    t.textContent = 'A Rota fixa será ativada assim que a tarefa for iniciada';
    tela.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  });
  painel.querySelectorAll('[data-mm]').forEach(b => b.addEventListener('click', () => {
    painel.querySelectorAll('[data-mm]').forEach(o => o.classList.toggle('ativa', o === b));
    painel.classList.toggle('mmais', b.dataset.mm === 'M+');
  }));
  painel.querySelectorAll('[data-aba-man]').forEach(b => b.addEventListener('click', () => {
    painel.querySelectorAll('[data-aba-man]').forEach(o => o.classList.toggle('ativa', o === b));
    painel.querySelectorAll('[data-man-aba]').forEach(c => c.classList.toggle('ativa', c.dataset.manAba === b.dataset.abaMan));
  }));
  painel.querySelectorAll('.segmentado-cenario button').forEach(b => b.addEventListener('click', () =>
    painel.querySelectorAll('.segmentado-cenario button').forEach(o => o.classList.toggle('ativa', o === b))));
  painel.querySelectorAll('.interruptor').forEach(i => i.addEventListener('click', () => i.classList.toggle('ligado')));
  const PASSOS = { fluxo: .5, taxa: 1, velocidade: .5, altura: .5, espacamento: .5, rthvel: 1, rthalt: 1 };
  painel.querySelectorAll('[data-man]').forEach(b => b.addEventListener('click', () => {
    const v = painel.querySelector('#man-' + b.dataset.man);
    const casas = b.dataset.man === 'espacamento' ? 2 : v.textContent.indexOf('.') >= 0 ? (v.textContent.split('.')[1].length) : 0;
    const novo = Math.min(b.dataset.man === 'espacamento' ? 59.03 : Infinity,
      Math.max(b.dataset.man === 'espacamento' ? 1.6 : 0, Number(v.textContent) + Number(b.dataset.delta) * PASSOS[b.dataset.man]));
    v.textContent = novo.toFixed(casas);
    /* fluxo do M+ = taxa × largura × velocidade / 600 */
    const taxa = Number(painel.querySelector('#man-taxa').textContent);
    const vel = Number(painel.querySelector('#man-velocidade').textContent);
    const esp = Number(painel.querySelector('#man-espacamento').textContent);
    painel.querySelector('#man-fluxo-calc').textContent = (taxa * esp * vel / 600).toFixed(2) + 'L/Min';
  }));
})();

/* ---------- Árvore frutífera / Mapeamento de árvores: lista vazia ---------- */
(function () {
  const tela = document.querySelector('[data-tela="mapa"]');
  const lista = document.createElement('aside');
  lista.className = 'lista-arvores';
  lista.innerHTML = '<h3>Tarefa</h3><div class="filtros-arvores"><span class="busca"><svg><use href="#ic-lupa"></use></svg></span>' +
    '<button><svg><use href="#ic-ordenar"></use></svg>Distância</button></div>' +
    '<div class="vazio-arvores"><svg viewBox="0 0 64 64"><path d="M12 6h30l10 10v42H12z" fill="#dcdcdb"/><path d="M42 6v10h10z" fill="#c9c9c8"/></svg>' +
    '<p>Nenhuma tarefa encontrada</p></div>';
  tela.appendChild(lista);
})();

/* ---------- Mapeamento de rota: "Configurações da tarefa" ---------- */
(function () {
  const tela = document.querySelector('[data-tela="mapeamento"]');
  const painel = document.createElement('aside');
  painel.className = 'painel-tarefa-map';
  painel.innerHTML = '<h2>Configurações da tarefa</h2>' +
    '<p class="rotulo-campo">Modo de rota</p>' +
    '<button class="cartao-rota-map ativa" data-rota-map="area"><span class="bolha"></span><b>Rota da área</b>' +
      '<i class="ic"><svg viewBox="0 0 24 24"><path d="M4 5h16M4 10h16M4 15h16M4 20h16" stroke="currentColor" stroke-width="2"/></svg></i>' +
      '<span class="desc">Mapeia toda a área. O mapeamento desse tipo de rota é demorado e de alta precisão</span></button>' +
    '<button class="cartao-rota-map" data-rota-map="fronteira"><span class="bolha"></span><b>Rota de fronteira</b>' +
      '<i class="ic"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/></svg></i>' +
      '<span class="desc">Mapeia um limite da área com uma largura de 20m. O mapeamento deste tipo de rota é eficiente em termos de tempo e de precisão moderada</span></button>' +
    '<p class="rotulo-campo">Resolução</p>' +
    '<div class="segmentado"><button class="ativa">Médio</button><button>Alta</button></div>' +
    '<p class="desc-resolucao">A reconstrução de alta resolução (2K) produz imagens de alta qualidade, mas é mais demorada do que a reconstrução de média resolução (1K)</p>';
  tela.appendChild(painel);
  painel.querySelectorAll('[data-rota-map]').forEach(b => b.addEventListener('click', () =>
    painel.querySelectorAll('[data-rota-map]').forEach(o => o.classList.toggle('ativa', o === b))));
  painel.querySelectorAll('.segmentado button').forEach(b => b.addEventListener('click', () =>
    painel.querySelectorAll('.segmentado button').forEach(o => o.classList.toggle('ativa', o === b))));

  /* caixa de números do mapeamento, calculada da área marcada */
  const caixa = document.createElement('div');
  caixa.className = 'caixa-areas caixa-mapeamento';
  caixa.innerHTML = '<div><span>Mapeamento de área</span><b id="map-area">0.0</b><i>Ha</i></div>' +
    '<div><span>Número de fotos estimada</span><b id="map-fotos">0</b><i></i></div>' +
    '<div><span>Tempo de voo estimado</span><b id="map-tempo">0</b><i>minuto</i></div>';
  tela.appendChild(caixa);
  const area = document.getElementById('area-campo');
  const atualizar = () => {
    const ha = Number(area.textContent) || 0;
    document.getElementById('map-area').textContent = ha.toFixed(1);
    document.getElementById('map-fotos').textContent = Math.round(ha * 62);
    document.getElementById('map-tempo').textContent = Math.ceil(ha * 3.2);
  };
  new MutationObserver(atualizar).observe(area, { childList: true, characterData: true, subtree: true });
})();

/* ============================================================
   Ferramentas do mapa: Mapa de prescrição e Tipo de mapa
   ============================================================ */
function fecharFlutuantes(exceto) {
  document.querySelectorAll('.flutuante-mapa').forEach(f => { if (f !== exceto) f.remove(); });
}
document.addEventListener('click', e => {
  if (!e.target.closest('.flutuante-mapa, .botao-mapa, .status-voo, .dialogo-app')) fecharFlutuantes();
});

function abrirPrescricao(tela) {
  fecharFlutuantes();
  const p = document.createElement('aside');
  p.className = 'flutuante-mapa painel-prescricao';
  const vazio = '<div class="vazio-prescricao"><svg viewBox="0 0 64 64"><path d="M12 6h30l10 10v42H12z" fill="#dcdcdb"/>' +
    '<path d="M42 6v10h10z" fill="#c9c9c8"/><g fill="#fff"><rect x="20" y="24" width="24" height="4" rx="2"/>' +
    '<rect x="20" y="32" width="24" height="4" rx="2"/><rect x="20" y="40" width="16" height="4" rx="2"/></g></svg>' +
    '<p>Nenhum mapa de prescrição disponível. Acesse a página SmartFarm para criar um mapa de prescrição</p></div>';
  p.innerHTML = '<h3>Mapa de prescrição</h3><div class="abas-prescricao"><button class="ativa" data-p="Local">Local</button>' +
    '<button data-p="Nuvem">Nuvem</button></div><div class="corpo-prescricao">' + vazio + '</div>' +
    '<div class="botoes-dialogo"><button class="cancelar">Cancelar(R2)</button><button class="verde">Sim(R3)</button></div>';
  tela.appendChild(p);
  p.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
    p.querySelectorAll('[data-p]').forEach(o => o.classList.toggle('ativa', o === b));
    const corpo = p.querySelector('.corpo-prescricao');
    corpo.innerHTML = '<span class="girando-p"></span>';
    setTimeout(() => { corpo.innerHTML = vazio; }, 800);
  }));
  p.querySelectorAll('.botoes-dialogo button').forEach(b => b.addEventListener('click', () => p.remove()));
}

const opcoesMapa = { tipo: 'Satélite', hd: 'Não exibir', girar: false, campos: true, auxilios: { Horizonte: true, Orientação: true, Grade: false } };
/* véu claro do mapa "Padrão", por cima do terreno de cada tela de mapa */
document.querySelectorAll('.tela-app > svg.arte-mapa').forEach(svg => {
  const veu = document.createElement('div');
  veu.className = 'veu-padrao';
  svg.after(veu);
});
function aplicarTipoMapa() {
  document.body.classList.toggle('mapa-padrao', opcoesMapa.tipo === 'Padrão');
  document.body.classList.toggle('sem-campos-proximos', !opcoesMapa.campos);
}
function abrirTipoMapa(tela, botao) {
  fecharFlutuantes();
  const p = document.createElement('div');
  p.className = 'flutuante-mapa painel-tipo-mapa';
  const miniatura = (nome, satelite) => '<button class="mini-mapa' + (opcoesMapa.tipo === nome ? ' ativa' : '') + '" data-tipo-mapa="' + nome + '">' +
    '<svg viewBox="0 0 1920 1200" preserveAspectRatio="xMidYMid slice"><use href="#terreno" width="1920" height="1200"/>' +
    (satelite ? '' : '<rect width="1920" height="1200" fill="rgb(222,238,214)" opacity=".58"/>') + '</svg><span>' + nome + '</span></button>';
  const chave = (rotulo, campo) => '<div class="linha-tipo"><span>' + rotulo + '</span><button class="interruptor' +
    (opcoesMapa[campo] ? ' ligado' : '') + '" data-chave="' + campo + '"><i></i></button></div>';
  p.innerHTML =
    '<div class="linha-tipo"><span>Tipo de<br>mapa</span><div class="minis">' + miniatura('Padrão', false) + miniatura('Satélite', true) + '</div></div>' +
    '<div class="linha-tipo"><span>Sobrepor<br>mapa HD</span><button class="link-hd">' + opcoesMapa.hd + ' <svg viewBox="0 0 24 24"><path d="M4 17.6V20h2.4L17.8 8.6l-2.4-2.4z"/></svg></button></div>' +
    chave('Girar mapa', 'girar') + chave('Mostrar campos próximos', 'campos') +
    '<p class="titulo-auxilios">Auxílios visuais</p><div class="auxilios">' +
    ['Horizonte', 'Orientação', 'Grade'].map(a => '<button class="aux' + (opcoesMapa.auxilios[a] ? ' ativa' : '') + '" data-aux="' + a + '">' +
      '<i class="fig-aux ' + a.normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase() + '"></i><span>' + a + '</span></button>').join('') + '</div>';
  tela.appendChild(p);
  const tb = botao.getBoundingClientRect(), tt = tela.getBoundingClientRect();
  p.style.top = ((tb.bottom - tt.top) / tt.height * 100 + 1) + '%';

  p.querySelectorAll('[data-tipo-mapa]').forEach(b => b.addEventListener('click', () => {
    opcoesMapa.tipo = b.dataset.tipoMapa;
    p.querySelectorAll('[data-tipo-mapa]').forEach(o => o.classList.toggle('ativa', o === b));
    aplicarTipoMapa();
  }));
  p.querySelectorAll('[data-chave]').forEach(b => b.addEventListener('click', () => {
    opcoesMapa[b.dataset.chave] = !opcoesMapa[b.dataset.chave];
    b.classList.toggle('ligado', opcoesMapa[b.dataset.chave]);
    aplicarTipoMapa();
  }));
  p.querySelectorAll('[data-aux]').forEach(b => b.addEventListener('click', () => {
    opcoesMapa.auxilios[b.dataset.aux] = !opcoesMapa.auxilios[b.dataset.aux];
    b.classList.toggle('ativa', opcoesMapa.auxilios[b.dataset.aux]);
  }));
  p.querySelector('.link-hd').addEventListener('click', () => {
    let escolha = opcoesMapa.hd;
    const d = dialogo(tela, '<h3>Sobrepor mapa HD</h3><p class="texto-aviso">Certifique-se de que a conexão de rede seja estável. ' +
      'Carregar o mapa HD em tempo real pode consumir mais dados.</p><div class="radios-hd">' +
      ['Não exibir', 'Mapa de conta pessoal', 'Link do URL'].map(o =>
        '<button class="linha-radio' + (o === escolha ? ' ativa' : '') + '" data-hd="' + o + '"><span class="bolha"></span><span>' + o + '</span></button>').join('') +
      '</div>', [{ rotulo: 'Cancelar(R2)' }, { rotulo: 'Sim(R3)', classe: 'verde', acao: () => {
        opcoesMapa.hd = escolha;
        p.querySelector('.link-hd').firstChild.nodeValue = escolha + ' ';
      } }]);
    d.querySelectorAll('[data-hd]').forEach(r => r.addEventListener('click', () => {
      escolha = r.dataset.hd;
      d.querySelectorAll('[data-hd]').forEach(o => o.classList.toggle('ativa', o === r));
    }));
  });
}

document.querySelectorAll('.ferramentas-mapa').forEach(f => {
  const botoes = f.querySelectorAll('.botao-mapa');
  const tela = raizTela(f);
  botoes[0].addEventListener('click', e => { e.stopPropagation(); abrirPrescricao(tela); });
  botoes[botoes.length - 1].addEventListener('click', e => { e.stopPropagation(); abrirTipoMapa(tela, botoes[botoes.length - 1]); });
});

/* ============================================================
   Janelinhas da barra de estado (bateria, sinal, RTK, tanque, CR)
   ============================================================ */
function abrirJanelinha(icone) {
  const tela = raizTela(icone);
  const jaAberta = tela.querySelector('.janelinha[data-de="' + icone.className + '"]');
  fecharFlutuantes();
  if (jaAberta) return;
  const texto = s => (icone.textContent || '').replace(/\s+/g, ' ').trim() || s;
  const meia = (v, n, extra) => '<div class="meia' + (extra || '') + '"><b>' + v + '</b><span>' + n + '</span></div>';
  const cheia = (v, n) => '<div class="cheia"><b>' + v + '</b><span>' + n + '</span></div>';
  let titulo, corpo, pagina;
  const c = icone.classList;
  if (c.contains('bat-drone')) {
    titulo = 'Bateria Inteligente'; pagina = 'bateria';
    corpo = '<div class="duas">' + meia(texto('--'), 'Nível da bateria') + meia('21.8˚C', 'Temperatura') + '</div>';
  } else if (c.contains('sinal')) {
    titulo = 'Configurações da transmissão de imagem'; pagina = 'aovivo';
    corpo = cheia('<svg viewBox="0 0 24 24"><rect x="3" y="15" width="3.4" height="6" rx="1"/><rect x="8.4" y="11" width="3.4" height="10" rx="1"/><rect x="13.8" y="7" width="3.4" height="14" rx="1"/></svg>Bom', 'Sinal Direto');
  } else if (c.contains('gnss')) {
    titulo = 'Configurações RTK'; pagina = 'rtk';
    const sat = (icone.querySelector('b') || {}).textContent || '--';
    corpo = '<div class="duas">' + meia('GNSS Normal', 'Precisão do Posicionamento', ' verde') + meia(sat, 'Satélites', ' verde') + '</div>' +
      '<p class="titulo-ionosfera">Previsão de Atividade Ionosférica</p>' +
      '<p class="texto-ionosfera">Fornece previsão para a atividade ionosférica na região atual nas próximas horas. Quando o nível de atividade ' +
      'é moderado, alto ou muito alto, a precisão do posicionamento RTK pode ser afetada</p>';
  } else if (c.contains('tanque')) {
    titulo = 'Configurações do sistema de pulverização'; pagina = 'pulverizacao';
    const partes = texto('0.0/0.0').replace(/l$/, '').split('/');
    const resta = Number(partes[0]) || 0;
    corpo = '<div class="duas">' + meia(resta.toFixed(1) + '<i>l</i>', 'Carga líquida restante', resta <= 0 ? ' vermelha' : '') +
      meia((partes[1] || '--') + '<i>l</i>', 'Carga Útil Recomendada') + '</div>';
  } else if (c.contains('bat-rc')) {
    titulo = 'Configurações do CR'; pagina = 'controle';
    const modo = (document.querySelector('.modos-joystick .ativa') || {}).textContent || 'Modo 2';
    corpo = cheia(texto('--') + '%', 'Nível da Bateria Interna') + cheia(modo, 'Modo do joystick');
  } else return;
  const j = document.createElement('div');
  j.className = 'flutuante-mapa janelinha';
  j.dataset.de = icone.className;
  j.innerHTML = '<button class="titulo-janelinha"><span>' + titulo + '</span><i>›</i></button>' + corpo;
  tela.appendChild(j);
  const ri = icone.getBoundingClientRect(), rt = tela.getBoundingClientRect();
  const centro = (ri.left + ri.width / 2 - rt.left) / rt.width * 100;
  j.style.left = Math.min(Math.max(centro, 18), 82) + '%';
  j.style.top = ((ri.bottom - rt.top) / rt.height * 100 + 1.4) + '%';
  j.querySelector('.titulo-janelinha').addEventListener('click', () => {
    j.remove();
    painelConfig.classList.add('aberto');
    const b = document.querySelector('.menu-config [data-config="' + pagina + '"]');
    if (b) b.click();
  });
}
document.querySelectorAll('.status-voo > i').forEach(i => {
  i.style.cursor = 'pointer';
  i.addEventListener('click', e => { e.stopPropagation(); abrirJanelinha(i); });
});

/* ============================================================
   Diálogos e avisos do mapa
   ============================================================ */

/* Sair do mapeamento com pontos marcados */
pedirConfirmacao(
  () => document.querySelector('[data-tela="mapeamento"] .acoes-inferiores [data-ir="mapa"]'),
  () => estado.limite.length + estado.obstaculo.length + estado.marcas.length > 0,
  seguir => dialogo(document.querySelector('[data-tela="mapeamento"]'),
    '<div class="marca-aviso">!</div><h3>Sair do plano atual?</h3><p class="texto-aviso">Sair descartará as alterações no plano atual</p>',
    [{ rotulo: 'Cancelar(R2)' }, { rotulo: 'Sim(R3)', classe: 'vermelho', acao: seguir }]));

/* Ponto de conexão */
(function () {
  const bloco = document.querySelector('[data-tela="execucao"] .bloco-conexao');
  if (!bloco) return;
  const botao = bloco.querySelector('button') || bloco.nextElementSibling;
  const alvo = bloco.querySelector('button:last-child') || botao;
  (alvo || bloco).addEventListener('click', () =>
    alertaApp(document.querySelector('[data-tela="execucao"]'), 'Ponto de conexão adicionado com sucesso'));
})();

/* Ligar o desvio de obstáculos pede confirmação (painel da tarefa e engrenagem) */
const TEXTO_HABILITANDO = '<div class="marca-aviso">!</div><h3>Habilitando o desvio de obstáculos</h3>' +
  '<ul class="lista-aviso vermelha"><li>Evite usar em clima chuvoso ou quando houver linhas de energia, galhos de árvores ou outros pequenos obstáculos</li></ul>' +
  '<ul class="lista-aviso"><li>Mantenha os sensores de visão binocular limpos para evitar obstáculos com mais eficiência</li></ul>';
[
  () => interruptorPorRotulo(document.querySelector('[data-exec-aba="voo"]'), 'Desvio de obstáculos'),
  () => interruptorPorRotulo(document.querySelector('.pagina-config[data-config="sensor"]'), 'Desvio de obstáculos !')
    || interruptorPorRotulo(document.querySelector('.pagina-config[data-config="sensor"]'), 'Desvio de obstáculos')
].forEach(achar => pedirConfirmacao(achar,
  () => achar() && !achar().classList.contains('ligado'),
  seguir => dialogo(raizTela(achar()) || painelConfig, TEXTO_HABILITANDO,
    [{ rotulo: 'Agora não(R2)' }, { rotulo: 'Habilitar(R3)', classe: 'verde', acao: seguir }])));

/* ============================================================
   Engrenagem com o drone conectado
   ============================================================ */
function aplicarDroneNaEngrenagem() {
  const ligado = conectado();
  document.querySelectorAll('.painel-config [data-ativo-drone]').forEach(g => {
    const botoes = g.querySelectorAll('button');
    if (ligado && !g.querySelector('.ativa') && Number(g.dataset.ativoDrone) >= 0) botoes[Number(g.dataset.ativoDrone)].classList.add('ativa');
    if (!ligado) botoes.forEach(b => b.classList.remove('ativa'));
  });
  document.querySelectorAll('.painel-config [data-valor-drone]').forEach(s => {
    s.firstChild.nodeValue = ligado ? s.dataset.valorDrone : s.dataset.valorSem;
  });
}
new MutationObserver(aplicarDroneNaEngrenagem).observe(document.body, { attributes: true, attributeFilter: ['class'] });
aplicarDroneNaEngrenagem();

/* grupos e chaves que só funcionam com o drone */
document.querySelectorAll('.painel-config .grupo-opcoes[data-ativo-drone]').forEach(g =>
  g.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if (!conectado()) return;
    g.querySelectorAll('button').forEach(o => o.classList.toggle('ativa', o === b));
  })));
document.querySelectorAll('#painel-config .interruptor.apagado').forEach(i =>
  i.addEventListener('click', () => { if (conectado()) i.classList.toggle('ligado'); }));

/* Zona GEO volta para a Proteção de voo */
(function () {
  const geo = document.querySelector('.subtela-config[data-subtela="geo"]');
  if (!geo) return;
  document.getElementById('voltar-config').addEventListener('click', e => {
    if (!geo.classList.contains('ativa')) return;
    e.stopImmediatePropagation();
    mostrarSubtela('protecao');
  }, true);
  geo.querySelectorAll('.abas-geo button').forEach(b => b.addEventListener('click', () => {
    geo.querySelectorAll('.abas-geo button').forEach(o => o.classList.toggle('ativa', o === b));
    const vazio = geo.querySelector('.vazio-geo');
    vazio.classList.add('carregando');
    setTimeout(() => vazio.classList.remove('carregando'), 700);
  }));
})();

/* Modo Atitude */
const chaveAtti = () => interruptorPorRotulo(document.querySelector('[data-subtela="protecao"]'), 'Permitir Modo Atitude (ATTI)');
pedirConfirmacao(chaveAtti, () => chaveAtti() && !chaveAtti().classList.contains('ligado'),
  seguir => dialogo(painelConfig, '<div class="marca-aviso">!</div><h3>Ativar modo Atitude?</h3>' +
    '<p class="texto-aviso">Quando ativada, a aeronave não consegue pairar de forma estável e é difícil de ser controlada manualmente, ' +
    'o que pode representar um risco grave para a segurança do voo. Tenha cuidado</p>',
    [{ rotulo: 'Cancelar(R2)' }, { rotulo: 'Habilitar(R3)', classe: 'vermelho', acao: seguir }]));

/* Desvio de obstáculos aprimorado: desligar pede confirmação */
const chaveAprimorado = () => interruptorPorRotulo(document.querySelector('[data-subtela="radar"]'), 'Desvio de obstáculos aprimorado');
pedirConfirmacao(chaveAprimorado, () => chaveAprimorado() && chaveAprimorado().classList.contains('ligado'),
  seguir => dialogo(painelConfig, '<div class="marca-aviso vermelha">!</div>' +
    '<h3 class="forte">Quando desativada, a capacidade da aeronave de detectar pequenos obstáculos, como galhos de árvore, diminui.</h3>',
    [{ rotulo: 'Cancelar(R2)' }, { rotulo: 'Desativar(R3)', classe: 'vermelho', acao: seguir }]));

/* Velocidade RTH acima de 25,2 km/h */
(function () {
  const linha = Array.from(document.querySelectorAll('#painel-config .linha-faixa'))
    .find(l => (window.TPD_IDIOMAS ? TPD_IDIOMAS.original(l) : l.textContent).indexOf('velocidade RTH') >= 0);
  if (!linha) return;
  const faixa = linha.nextElementSibling;
  const barra = faixa.querySelector('input[type="range"]');
  let aprovado = Number(barra.value) > 25.2;
  const conferir = () => {
    const v = Number(barra.value);
    if (v <= 25.2) { aprovado = false; return; }
    if (aprovado || document.querySelector('.dialogo-velocidade')) return;
    const d = dialogo(painelConfig, '<div class="marca-aviso">!</div><h3 class="forte">Definir a velocidade de voo acima de 25,2 km/h pode afetar a segurança do voo. Continuar?</h3>',
      [{ rotulo: 'Cancelar(R2)', acao: () => { barra.value = 25.2; barra.dispatchEvent(new Event('input')); } },
       { rotulo: 'OK(R3)', classe: 'verde', acao: () => { aprovado = true; } }]);
    d.classList.add('dialogo-velocidade');
  };
  barra.addEventListener('change', conferir);
  faixa.querySelectorAll('[data-faixa]').forEach(b => b.addEventListener('click', conferir));
})();

/* faixa "Desviar horizontalmente / verticalmente primeiro" */
document.querySelectorAll('.faixa-desvio').forEach(f => {
  const barra = f.querySelector('input');
  f.querySelectorAll('[data-desvio]').forEach(b => b.addEventListener('click', () => {
    barra.value = Number(barra.value) + Number(b.dataset.desvio);
  }));
});
