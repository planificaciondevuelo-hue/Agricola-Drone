/* ============================================================
   Telas abertas pelos ícones da tela inicial e pelos cartões
   (perfil, sino, configurações gerais, arquivos, dispositivo)
   ============================================================ */

const painelExtra = document.getElementById('painel-extra');

/* ---------- miniatura de talhão usada na lista de arquivos ---------- */
function miniatura(tipo) {
  const fundos = {
    terra: '#8a7a68', escuro: '#5e5346', verde: '#6d7a45', cinza: '#e8e8e7'
  };
  if (tipo === 'grade') {
    return '<span class="mini"><svg viewBox="0 0 60 48"><rect width="60" height="48" fill="#efefee"/>' +
      '<g fill="none" stroke="#c4c8ca" stroke-width="2"><rect x="14" y="12" width="32" height="24"/>' +
      '<path d="M30 12v24M14 24h32"/></g></svg></span>';
  }
  const cor = fundos[tipo] || fundos.terra;
  return '<span class="mini"><svg viewBox="0 0 60 48"><rect width="60" height="48" fill="' + cor + '"/>' +
    '<g opacity=".35" stroke="#3f382e" stroke-width="2"><path d="M-4 10 64 2M-4 22 64 14M-4 34 64 26M-4 46 64 38"/></g>' +
    '<path d="M18 12 44 16 40 38 14 32z" fill="none" stroke="#fff" stroke-width="2.4"/></svg></span>';
}

const nuvemOk = '<span class="nuvem ok"><svg viewBox="0 0 24 24"><path d="M6.4 19.6a4.6 4.6 0 0 1-.6-9.2 6 6 0 0 1 11.6-1.2 4.2 4.2 0 0 1-.6 10.4z"/><path d="m9.6 14.2 2 2 4-4.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
const nuvemErro = '<span class="nuvem erro"><svg viewBox="0 0 24 24"><path d="M6.4 19.6a4.6 4.6 0 0 1-.6-9.2 6 6 0 0 1 11.6-1.2 4.2 4.2 0 0 1-.6 10.4z"/><path d="m9.8 12.2 4.4 4.4m0-4.4-4.4 4.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg></span>';
const nuvemBaixar = c => '<span class="nuvem ' + c + '"><svg viewBox="0 0 24 24"><path d="M6.4 19.6a4.6 4.6 0 0 1-.6-9.2 6 6 0 0 1 11.6-1.2 4.2 4.2 0 0 1-.6 10.4z"/><path d="M12 10.4v5.4m-2.6-2.4 2.6 2.8 2.6-2.8" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';

const LOCAL_LONGO = 'Linha do Cedro, Região de Santa Helena, Estado do Sul, 00000-000, Brasil';
const LOCAL_CURTO = 'Linha do Cedro, Região de Santa Helena';

function itemArquivo(o) {
  return '<div class="item-arquivo">' + (o.mini === false ? '' : miniatura(o.tipoMini)) +
    '<div class="dados"><span class="data">' + o.data + '</span>' +
    '<span class="nome">' + o.nome + '</span>' +
    (o.local ? '<span class="local"><svg><use href="#ic-pin"></use></svg>' + o.local + '</span>' : '') +
    '</div>' +
    '<div class="direita">' + (o.area ? '<b>' + o.area + '<i>Ha</i></b>' : '') +
    '<span class="etiquetas-arquivo">' +
      (o.etiqueta ? '<em>' + o.etiqueta + '</em>' : '') +
      (o.etiqueta2 ? '<em>' + o.etiqueta2 + '</em>' : '') +
      (o.nuvem || '') +
    '</span></div></div>';
}

function listaArquivos(itens, fim) {
  return itens.map(itemArquivo).join('') + (fim ? '<p class="sem-mais">Sem mais dados</p>' : '');
}

/* dados das seções da pastinha */
const ARQUIVOS = {
  Local: {
    'Tarefa': { filtros: ['Distância', 'Todos os Tipos', 'busca', 'Selecione'], itens: [
      { data: '2026/07/04 14:12', nome: 'vo m1_Dividir_2', local: LOCAL_CURTO, area: '0.4', etiqueta: 'Rota', nuvem: nuvemErro },
      { data: '2026/09/23 01:48', nome: 'teste_Dividir_2', local: LOCAL_LONGO, area: '0.3', etiqueta: 'Rota', nuvem: nuvemErro },
      { data: '2026/09/10 08:50', nome: 'teste', local: LOCAL_LONGO, area: '0.6', etiqueta: 'Rota', nuvem: nuvemOk }
    ] },
    'Tarefas em andamento': { filtros: ['Tempo', 'Todos os Tipos', 'busca', 'Sincronizar', 'Selecione'], itens: [
      { data: '2026/08/18 16:54', nome: '2026-08-18 16:50', local: LOCAL_CURTO },
      { data: '2026/08/18 16:43', nome: '50 micras', local: LOCAL_CURTO },
      { data: '2026/08/05 16:48', nome: 'Limite', local: 'Estrada da Linha do Cedro, Região de Santa Helena' }
    ] },
    'Modelos de tarefa': { filtros: ['Tempo', 'Todos os Tipos', 'Todos os Modelos', 'busca', 'Selecione'], fim: true, itens: [
      { data: '2025/11/28 16:35', nome: 'tx m2(1)', mini: false, etiqueta: 'Dispersão', etiqueta2: 'T50', nuvem: nuvemErro },
      { data: '2025/11/28 16:16', nome: 'tx 1(1)', mini: false, etiqueta: 'Dispersão', etiqueta2: 'T50', nuvem: nuvemErro },
      { data: '2025/01/04 16:59', nome: 'Padrão', mini: false, etiqueta: 'Pulverização', etiqueta2: 'T50', nuvem: nuvemErro }
    ] },
    'Material': { filtros: ['Tempo', 'Todos os Tipos', 'busca', 'Selecione'], material: true, itens: [
      { data: '2026/07/04 14:37', nome: 'fósforo', fim: '64.9', etiqueta: 'Saída grande', nuvem: nuvemErro },
      { data: '2025/11/28 15:58', nome: 'kcl', fim: '74.8', etiqueta: 'Saída grande', nuvem: nuvemErro },
      { data: '2025/10/31 19:19', nome: 'bra 2', fim: '70.2', etiqueta: 'Saída grande', nuvem: nuvemErro }
    ] },
    'Saída de reconstrução': { filtros: ['Tempo', 'busca', 'Selecione'], fim: true, itens: [
      { data: '2026/06/23 14:13', nome: 'varzea', tipoMini: 'verde',
        local: 'Fazenda Três Barras, Linha do Cedro, Região de Santa Helena', etiqueta: 'Mapeamento de árvores' }
    ] },
    'Mapa de prescrição': { filtros: ['Tempo', 'busca', 'Selecione'], itens: [
      { data: '2026/07/05 01:11', nome: 'Fosforo', tipoMini: 'grade', local: LOCAL_LONGO, area: '39.7', nuvem: nuvemOk },
      { data: '2026/05/27 17:13', nome: 'tx_Rx', tipoMini: 'grade', local: LOCAL_CURTO, area: '0.49', nuvem: nuvemErro },
      { data: '2026/04/10 01:41', nome: 'et', tipoMini: 'grade',
        local: 'Fazenda Três Barras, Linha do Cedro, Região de Santa Helena, Brasil',
        area: '5.49', nuvem: nuvemOk }
    ] }
  },
  Nuvem: {
    'Tarefa': { filtros: ['Tempo', 'busca', 'Selecione'], itens: [
      { data: '2026/09/10 08:50', nome: 'teste', local: LOCAL_LONGO, area: '0.62', etiqueta: 'Rota', nuvem: nuvemBaixar('ok') },
      { data: '2026/09/10 08:50', nome: 'teste', local: LOCAL_LONGO, area: '0.62', etiqueta: 'Rota', nuvem: nuvemBaixar('erro') },
      { data: '2026/08/04 23:37', nome: 'iyfgh', tipoMini: 'escuro', local: LOCAL_CURTO, area: '0.02', etiqueta: 'Rota', nuvem: nuvemBaixar('ok') }
    ] },
    'Tarefas em andamento': { filtros: ['Tempo', 'busca', 'Selecione'], fim: true, itens: [] },
    'Modelos de tarefa': { filtros: ['Tempo', 'busca', 'Selecione'], fim: true, itens: [] },
    'Material': { filtros: ['Tempo', 'busca', 'Selecione'], fim: true, itens: [] },
    'Saída de reconstrução': { filtros: ['Tempo', 'busca', 'Selecione'], fim: true, itens: [] },
    'Mapa de prescrição': { filtros: ['Tempo', 'busca', 'Selecione'], fim: true, itens: [] }
  }
};

function graficoMaterial(fim) {
  return '<div class="grafico-material"><span class="eixo-y">Fluxo(kg/min)</span>' +
    '<svg viewBox="0 0 150 80"><path d="M22 62h112M22 62V14" stroke="#d8d8d7" stroke-width="1.4" fill="none"/>' +
    '<path d="M22 14h112M134 14v48" stroke="#e2e2e1" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/>' +
    '<path d="M22 62C60 60 104 44 134 14" fill="none" stroke="#3ab54a" stroke-width="2.4"/>' +
    '<circle cx="22" cy="62" r="3" fill="#3ab54a"/><circle cx="134" cy="14" r="3" fill="#3ab54a"/>' +
    '<text x="16" y="17" text-anchor="end" font-size="8" fill="#8b8f93" font-family="Inter,sans-serif">72.0</text>' +
    '<text x="16" y="65" text-anchor="end" font-size="8" fill="#8b8f93" font-family="Inter,sans-serif">0.0</text>' +
    '<text x="22" y="74" text-anchor="middle" font-size="8" fill="#8b8f93" font-family="Inter,sans-serif">0.0</text>' +
    '<text x="134" y="74" text-anchor="middle" font-size="8" fill="#8b8f93" font-family="Inter,sans-serif">' + fim + '</text>' +
    '</svg><span class="eixo-x">Saída da tremonha(%)</span></div>';
}

function barraFiltros(filtros) {
  return '<div class="filtros-arquivo">' + filtros.map(f => {
    if (f === 'busca') return '<div class="campo-busca-arquivo"><svg><use href="#ic-lupa"></use></svg><span>Nome ou lo</span></div>';
    if (f === 'Tempo' || f === 'Distância')
      return '<button class="filtro"><svg><use href="#ic-ordenar"></use></svg><span>' + f + '</span></button>';
    if (f === 'Selecione' || f === 'Sincronizar') return '<button class="filtro claro">' + f + '</button>';
    return '<button class="filtro"><span>' + f + '</span><i>⌄</i></button>';
  }).join('') + '</div>';
}

/* ============================================================
   As telas
   ============================================================ */
const TELAS_EXTRA = {
  usuario: {
    titulo: 'Informação do usuário',
    corpo: () =>
      '<div class="usuario-topo">' +
        '<span class="avatar"><svg><use href="#ic-perfil"></use></svg></span>' +
        '<span class="usuario-dados"><b>Operador de Exemplo <em>Proprietário</em></b>' +
        '<span class="email">operador@exemplo.com</span></span>' +
        '<span class="atualizado">Atualizado em:2026/09/23 02:06:58</span>' +
      '</div>' +
      '<div class="cartoes-usuario">' +
        '<div><b>1375<i>Ha</i></b><span>Área da tarefa</span>' +
          '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 19 19 5" stroke="currentColor" stroke-width="1.4"/><path d="M5 14 14 5M10 19 19 10" stroke="currentColor" stroke-width="1.4"/></svg></div>' +
        '<div><b>245<i>Hora</i></b><span>Horas de voo</span>' +
          '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5.4l3.6 2.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
        '<div><b>3662</b><span>Total de voos</span>' +
          '<svg viewBox="0 0 24 24"><path d="M3.4 12.6 20.6 4.6 12.6 20.6l-2-7z"/></svg></div>' +
      '</div>' +
      '<div class="linha-equipe"><span>Minha Equipe</span><em>Anjos</em>' +
        '<button class="botao-cinza"><svg><use href="#ic-ordenar"></use></svg>Alterar</button></div>' +
      '<button class="linha-link"><span>Registros de voo</span><i>›</i></button>' +
      '<p class="sair-conta">Sair</p>'
  },

  notificacoes: {
    abas: ['Não lido', 'Histórico'],
    corpo: () =>
      '<div class="vazio-central">' +
        '<svg viewBox="0 0 64 64"><path d="M12 6h30l10 10v42H12z" fill="#dcdcdb"/><path d="M42 6v10h10z" fill="#c9c9c8"/>' +
        '<g fill="#fff"><rect x="20" y="24" width="5" height="20" rx="2"/><rect x="29" y="24" width="5" height="20" rx="2"/><rect x="38" y="24" width="5" height="20" rx="2"/></g></svg>' +
        '<p>Sem mais dados</p>' +
      '</div>'
  },

  registros: {
    titulo: 'Gerenciamento de registros',
    corpo: () =>
      '<div class="vazio-central">' +
        '<svg viewBox="0 0 64 64"><path d="M12 6h30l10 10v42H12z" fill="#dcdcdb"/><path d="M42 6v10h10z" fill="#c9c9c8"/>' +
        '<g fill="#fff"><rect x="20" y="24" width="5" height="20" rx="2"/><rect x="29" y="24" width="5" height="20" rx="2"/><rect x="38" y="24" width="5" height="20" rx="2"/></g></svg>' +
        '<p>Sem mais dados</p>' +
      '</div>'
  },

  dispositivo: {
    titulo: 'Gerenciamento do dispositivo',
    corpo: () => {
      const cartoes = [
        { nome: 'Controlador', ativo: true, icone: 'rc', campos: [
            ['NS', '4LGZL2R007025P'], ['Versão', '06.05.0921(BR)'], ['Versão do aplicativo', '8.6.38'] ] },
        { nome: 'Aeronave', icone: 'drone', campos: [
            ['NS', '-'], ['Versão', '-'], ['Número de série da bateria', '-'] ] },
        { nome: 'Dispositivo de carregamento', icone: 'carga', campos: [
            ['NS', '-'], ['Versão', '-'], ['NS do controlador CC', '-'] ] },
        { nome: 'Dongle CR RTK', icone: 'dongle', campos: [ ['NS', '-'], ['Versão', '-'] ] },
        { nome: 'Relé', icone: 'rele', campos: [ ['NS', '-'] ] },
        { nome: 'Estação móvel D-RTK', icone: 'drtk', campos: [ ['NS', '-'] ] }
      ];
      const figuras = {
        rc: '<svg viewBox="0 0 40 30"><rect x="6" y="8" width="28" height="18" rx="3"/><rect x="10" y="11" width="20" height="12" rx="1.5" fill="#f4f4f3"/><path d="M11 8 9 2M29 8l2-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        drone: '<svg viewBox="0 0 40 30"><g stroke="currentColor" stroke-width="2" fill="none"><path d="M4 8h12M24 8h12M20 12v10"/><ellipse cx="6" cy="8" rx="5" ry="1.6"/><ellipse cx="34" cy="8" rx="5" ry="1.6"/></g><rect x="14" y="10" width="12" height="6" rx="2"/><path d="M12 22h16M14 22v4M26 22v4" stroke="currentColor" stroke-width="2" fill="none"/></svg>',
        carga: '<svg viewBox="0 0 40 30"><rect x="8" y="8" width="24" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 11l-5 7h4l-1 5 5-7h-4z"/></svg>',
        dongle: '<svg viewBox="0 0 40 30"><circle cx="20" cy="15" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="15" r="3.4"/></svg>',
        rele: '<svg viewBox="0 0 40 30"><rect x="8" y="14" width="24" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 11a9 9 0 0 1 12 0M17 8a14 14 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="19" r="1.4"/></svg>',
        drtk: '<svg viewBox="0 0 40 30"><path d="M20 6v16M12 26 20 10l8 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="5" r="2.4"/></svg>'
      };
      return '<div class="abas-dispositivo"><button class="ativa">Atualização de firmware</button>' +
        '<button>Integridade do dispositivo</button></div>' +
        '<div class="grade-dispositivos">' + cartoes.map(c =>
          '<div class="cartao-dispositivo' + (c.ativo ? ' ativo' : '') + '">' +
            '<div class="topo">' + figuras[c.icone] + '<span>' + c.nome + '</span></div>' +
            '<div class="campos">' + c.campos.map(f =>
              '<p><span>' + f[0] + '</span><b>' + f[1] + '</b></p>').join('') + '</div>' +
          '</div>').join('') + '</div>';
    }
  },

  arquivos: {
    abas: ['Local', 'Nuvem'],
    menu: ['Tarefa', 'Tarefas em andamento', 'Modelos de tarefa', 'Material',
           'Saída de reconstrução', 'Mapa de prescrição'],
    corpo: (aba, secao) => {
      const dados = ARQUIVOS[aba][secao];
      if (!dados) return '<p class="sem-mais">Sem mais dados</p>';
      const lista = dados.material
        ? dados.itens.map(i =>
            '<div class="item-arquivo material">' + graficoMaterial(i.fim) +
            '<div class="dados"><span class="data">' + i.data + '</span><span class="nome">' + i.nome + '</span></div>' +
            '<div class="direita"><span class="etiquetas-arquivo"><em>' + i.etiqueta + '</em>' + i.nuvem + '</span></div></div>').join('')
        : listaArquivos(dados.itens, dados.fim);
      return barraFiltros(dados.filtros) + '<div class="lista-arquivos">' +
        (dados.itens.length ? lista : '<p class="sem-mais">Sem mais dados</p>') + '</div>';
    }
  },

  gerais: {
    titulo: 'Configurações gerais',
    blocos: [
      { t: 'link', rotulo: 'Unidades de medida', subtela: 'unidades' },
      { t: 'link-valor', rotulo: 'Idioma', valor: 'Padrão do sistema', subtela: 'idioma' },
      { t: 'link', rotulo: 'Arquivos de áudio em vários idiomas', subtela: 'audio' },
      { t: 'espaco' },
      { t: 'link', rotulo: 'Configurações de privacidade', subtela: 'privacidade' },
      { t: 'link', rotulo: 'Gerenciamento de armazenamento', subtela: 'armazenamento' },
      { t: 'link', rotulo: 'Diagnóstico de rede', subtela: 'rede' },
      { t: 'acao', rotulo: 'Guia para iniciantes', botao: 'Redefinir' },
      { t: 'espaco' },
      { t: 'link', rotulo: 'Requerimentos da Política' },
      { t: 'rodape-legal' }
    ],
    subtelas: {
      unidades: { titulo: 'Unidades de medida', blocos: [
        { t: 'linha-seg', rotulo: 'Unidades', opcoes: ['Métrica', 'Inglesa'] },
        { t: 'linha-seg', rotulo: 'Unidade de velocidade', opcoes: ['km/h', 'm/s'] }
      ] },
      idioma: { titulo: 'Idioma', blocos: [
        { t: 'radio', rotulo: 'Padrão do sistema', ativo: true },
        { t: 'radio', rotulo: 'ئۇيغۇر تىلى' }
      ] },
      audio: { titulo: 'Arquivos de áudio em vários idiomas', blocos: [
        { t: 'audios', itens: [
          ['Arquivo de áudio em alemão', '14,46MB'], ['Arquivo de áudio em espanhol', '13,63MB'],
          ['Arquivo de áudio em francês', '13,58MB'], ['Arquivo de áudio em japonês', '14,89MB'],
          ['Arquivo de áudio em coreano', '12,76MB'], ['Arquivo de áudio em russo', '13,68MB'],
          ['Arquivo de áudio em italiano', '14,62MB'], ['Arquivo de áudio em holandês', '14,51MB'],
          ['Arquivo de áudio em português do Brasil', 'baixado'],
          ['Arquivo de áudio em português europeu', '13,82MB'],
          ['Ficheiro áudio romeno', '13,80MB'], ['Arquivo de áudio cazaque', '12,75MB']
        ] }
      ] },
      privacidade: { titulo: 'Configurações de privacidade', blocos: [
        { t: 'toggle', rotulo: 'Informações de localização aproximada', ligado: true, apagado: true,
          desc: 'Usado para atualização do banco de dados FlySafe, previsão de atividade ionosférica ao usar posicionamento RTK (disponível apenas na China continental) e outros recursos. Habilitar esta opção é necessário para o funcionamento adequado do aplicativo.' },
        { t: 'toggle', rotulo: 'Informações GNSS', ligado: true,
          desc: 'As informações GNSS do controle remoto e dos dispositivos são usadas para posicionamento em mapas de terceiros. Quando desativado, recursos como mapeamento, operação de tarefas, monitoramento em tempo real e cálculo de área de tarefa ficarão indisponíveis.' },
        { t: 'toggle', rotulo: 'Número de série do dispositivo', ligado: true,
          desc: 'Usado para ativação de dispositivos, login e registro, solicitações de interface de dados, etc. Quando desativado, serviços como cálculo de área de tarefa e gerenciamento em nuvem ficarão indisponíveis.' },
        { t: 'toggle', rotulo: 'Sincronizar dados de voo em tempo real', ligado: true,
          desc: 'Quando habilitado, o posicionamento em tempo real da aeronave será informado automaticamente à plataforma de gerenciamento SmartFarm para supervisão de qualidade em tempo real' },
        { t: 'toggle', rotulo: 'Sincronização automática do registro de voo', ligado: true,
          desc: 'Flight Record Auto Sync carrega os dados detalhados da sua tarefa no servidor na nuvem para gerenciamento e recuperação convenientes' },
        { t: 'toggle', rotulo: 'Autorizar o uso de registros de voo', ligado: true,
          desc: 'Autorize o fabricante a acessar e analisar registos de voo que você sincronizou com o servidor dele na sua conta. Esses dados nos ajudarão a localizar problemas com o seu dispositivo e fornecerão serviços pós-venda de acordo com o necessário' },
        { t: 'espaco' },
        { t: 'toggle', rotulo: 'Programa de Melhoria do Produto', ligado: true,
          desc: 'Por meio deste projeto, você fornecerá ao fabricante os seguintes dados para nos ajudar a fornecer melhores produtos e serviços. Para obter detalhes, consulte <b class="verde">Política de privacidade</b>. Visando proteger sua privacidade, seus dados serão dessensibilizados e anonimizados antes da análise' },
        { t: 'lista-pontos', itens: [
          ['Informações do dispositivo', 'Inclui o modelo do dispositivo, firmware, status e informações de uso. Esses dados são usados apenas para fins de análise e melhoria do produto'],
          ['Dados de diagnóstico e uso', 'Inclui propriedades do produto e dados de uso. Esses dados são usados apenas para fins de análise e melhoria do produto']
        ] },
        { t: 'espaco' },
        { t: 'toggle', rotulo: 'Modo de dados locais', ligado: false,
          desc: 'Quando ativado, você pode usar o aplicativo offline. Como o aplicativo não se conectará ao servidor em nuvem, os registros de voo e arquivos de tarefas gerados durante o uso serão armazenados com segurança no dispositivo local<br>' +
                'Neste modo, recursos que requerem internet, como serviços de mapa e ativação de dispositivo, estarão indisponíveis. Enquanto isso, certifique-se de que os dados locais estejam devidamente armazenados. Os dados não podem ser recuperados uma vez excluídos' }
      ] },
      armazenamento: { titulo: 'Gerenciamento de armazenamento', blocos: [
        { t: 'barra-armazenamento' },
        { t: 'espaco-usado' },
        { t: 'aviso-vermelho', texto: 'Os dados a seguir não podem ser recuperados depois de excluídos. Tenha cuidado ao excluir dados' },
        { t: 'secao', texto: 'Dados gerais' },
        { t: 'item-armazenamento', cor: '#f0c419', rotulo: 'Registro do aplicativo', valor: '218,49MB' },
        { t: 'item-armazenamento', cor: '#e055c8', rotulo: 'Registro de perguntas frequentes', valor: '2,34GB' },
        { t: 'item-armazenamento', cor: '#f08a24', rotulo: 'Pacotes de atualização de firmware', valor: '6,43GB' },
        { t: 'item-armazenamento', cor: '#e8442e', rotulo: 'Cache do mapa HD', valor: '0bytes' },
        { t: 'item-armazenamento', cor: '#2ec4b6', rotulo: 'Cache de mapeamento', valor: '0bytes' },
        { t: 'secao', texto: 'Dados importantes' },
        { t: 'item-armazenamento', cor: '#2b7fe0', rotulo: 'Dados de tarefa local', valor: '309Entradas' },
        { t: 'desc', texto: 'Recomenda-se sincronizar todos os dados para a plataforma de gerenciamento SmartFarm antes de limpar os dados, incluindo quaisquer dados de campo e dados para tarefas em andamento não carregados.' },
        { t: 'item-armazenamento', cor: '#3ab54a', rotulo: 'Registros de voo', valor: '1,56GB', semBotao: true }
      ] },
      rede: { titulo: 'Diagnóstico de rede', blocos: [{ t: 'diagrama-rede' }] }
    }
  }
};

/* ---------- blocos exclusivos destas telas ---------- */
function blocoExtra(b) {
  switch (b.t) {
    case 'espaco': return '<div class="espaco-config"></div>';
    case 'link-valor':
      return '<button class="linha-link"' + (b.subtela ? ' data-abre-sub="' + b.subtela + '"' : '') + '>' +
        '<span>' + b.rotulo + '</span><em class="valor-link">' + b.valor + '</em><i>›</i></button>';
    case 'rodape-legal':
      return '<p class="rodape-legal"><b>Política de privacidade</b>·<b>Termos de Uso do Software</b>·' +
        '<b>Termos de Uso de Produtos UAS</b></p>' +
        '';
    case 'linha-seg':
      return '<div class="linha-seg"><span>' + b.rotulo + '</span>' +
        '<div class="grupo-opcoes">' + b.opcoes.map((o, i) =>
          '<button class="' + (i === 0 ? 'ativa' : '') + '">' + o + '</button>').join('') + '</div></div>';
    case 'radio':
      return '<button class="linha-radio' + (b.ativo ? ' ativa' : '') + '">' +
        '<span class="bolha"></span><span>' + b.rotulo + '</span></button>';
    case 'audios':
      return '<div class="lista-audios">' + b.itens.map(i =>
        '<div><span>' + i[0] + '</span>' +
        (i[1] === 'baixado' ? '<button class="botao-contorno apagado">Baixado</button>'
                            : '<em>' + i[1] + '</em><button class="botao-contorno">Baixar</button>') +
        '</div>').join('') + '</div>';
    case 'lista-pontos':
      return '<div class="lista-pontos">' + b.itens.map(i =>
        '<div><b>· ' + i[0] + '</b><span>' + i[1] + '</span></div>').join('') + '</div>';
    case 'barra-armazenamento':
      return '<div class="barra-armazenamento">' +
        '<i style="width:7%;background:#e055c8"></i><i style="width:18%;background:#f08a24"></i>' +
        '<i style="width:5%;background:#3ab54a"></i><i style="width:32%;background:#8b8f93"></i>' +
        '</div><div class="legenda-armazenamento">' +
        '<span><b class="faixas"></b>Espaço do aplicativo utilizado</span>' +
        '<span><b style="background:#8b8f93"></b>Usado</span>' +
        '<span><b class="vazio"></b>Disponível</span></div>';
    case 'espaco-usado':
      return '<p class="config-secao">Espaço do aplicativo utilizado</p>' +
        '<p class="valor-armazenamento">10,54GB</p>' +
        '<p class="config-desc">22% armazenamento usado</p>';
    case 'aviso-vermelho':
      return '<p class="aviso-vermelho">' + b.texto + '</p>';
    case 'item-armazenamento':
      return '<div class="item-armazenamento"><b style="background:' + b.cor + '"></b>' +
        '<span>' + b.rotulo + '</span><em>' + b.valor + '</em>' +
        (b.semBotao ? '' : '<button class="botao-contorno">Limpar</button>') + '</div>';
    case 'diagrama-rede':
      return '<div class="diagrama-rede">' +
        '<span class="etiqueta-wifi">Wi-Fi <svg viewBox="0 0 24 24"><path d="M12 18.4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/><path d="M7.4 14.6a7 7 0 0 1 9.2 0M4.2 11a11.4 11.4 0 0 1 15.6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>' +
        '<svg class="linhas" viewBox="0 0 400 150">' +
          '<path d="M60 60v-20h120M340 60v-20H220" fill="none" stroke="#3ab54a" stroke-width="2.4"/>' +
          '<path d="M60 90v22h100M340 90v22H240" fill="none" stroke="#d8d8d7" stroke-width="2.4"/>' +
        '</svg>' +
        '<div class="nos">' +
          '<div class="no verde"><svg><use href="#ic-rc"></use></svg><span>Controlador</span></div>' +
          '<div class="no centro"><svg viewBox="0 0 24 24"><path d="M12 18.4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/><path d="M7.4 14.6a7 7 0 0 1 9.2 0M4.2 11a11.4 11.4 0 0 1 15.6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg><span>Wi-Fi</span></div>' +
          '<div class="no verde"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 2.8c5 5.6 5 12.8 0 18.4-5-5.6-5-12.8 0-18.4z" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>Plataforma de<br>gerenciamento Agras</span></div>' +
        '</div>' +
        '<button class="botao-cinza atualizar">Atualizar</button>' +
        '<div class="nos baixo">' +
          '<div class="no"><svg viewBox="0 0 24 24"><rect x="7" y="4" width="8" height="14" rx="2"/><path d="M17 8a4 4 0 0 1 0 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>Dongle 4G</span></div>' +
          '<div class="no"><svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="10" width="6" height="7" rx="1"/></svg><span>Cartão SIM</span></div>' +
        '</div></div>';
    default: return blocoHTML(b);
  }
}

/* ============================================================
   Montagem e navegação
   ============================================================ */
let telaExtra = null, abaExtra = null, secaoExtra = null, subExtra = 'raiz';

function montarExtra() {
  const def = TELAS_EXTRA[telaExtra];
  if (!def) return;

  const sub = def.subtelas && def.subtelas[subExtra];
  const titulo = sub ? sub.titulo : (def.titulo || '');
  const temAbas = !!def.abas && !sub;

  const topo =
    '<div class="topo-config">' +
      '<button class="voltar-config" id="voltar-extra"' +
        (sub ? '' : ' style="visibility:hidden"') + '>‹</button>' +
      (temAbas
        ? '<div class="abas-topo">' + def.abas.map(a =>
            '<button class="' + (a === abaExtra ? 'ativa' : '') + '" data-aba-extra="' + a + '">' + a + '</button>').join('') + '</div>'
        : '<h2>' + titulo + '</h2>') +
      '<button class="fechar-config" id="fechar-extra">✕</button>' +
    '</div>';

  let conteudo;
  if (sub) conteudo = sub.blocos.map(blocoExtra).join('');
  else if (def.blocos) conteudo = def.blocos.map(blocoExtra).join('');
  else conteudo = def.corpo(abaExtra, secaoExtra);

  const menu = def.menu
    ? '<div class="menu-arquivos">' + def.menu.map(m =>
        '<button class="' + (m === secaoExtra ? 'ativa' : '') + '" data-secao="' + m + '">' + m + '</button>').join('') + '</div>'
    : '';

  painelExtra.innerHTML =
    '<div class="caixa-config caixa-extra extra-' + telaExtra + (def.menu ? ' com-menu' : '') + '">' +
      '<div class="corpo-config">' + topo +
        '<div class="corpo-extra">' + menu +
          '<div class="rolagem-config">' + conteudo + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  ligarEventosExtra();
}

function ligarEventosExtra() {
  const q = s => Array.from(painelExtra.querySelectorAll(s));
  painelExtra.querySelector('#fechar-extra').addEventListener('click', fecharExtra);
  painelExtra.querySelector('#voltar-extra').addEventListener('click', () => { subExtra = 'raiz'; montarExtra(); });

  q('[data-aba-extra]').forEach(b => b.addEventListener('click', () => {
    abaExtra = b.dataset.abaExtra; montarExtra();
  }));
  q('[data-secao]').forEach(b => b.addEventListener('click', () => {
    secaoExtra = b.dataset.secao; montarExtra();
  }));
  q('[data-abre-sub]').forEach(b => b.addEventListener('click', () => {
    subExtra = b.dataset.abreSub; montarExtra();
  }));
  q('.linha-link[data-abre-subtela]').forEach(b => b.addEventListener('click', () => {
    subExtra = b.dataset.abreSubtela; montarExtra();
  }));
  q('.interruptor').forEach(i => i.addEventListener('click', () => {
    if (!i.classList.contains('apagado')) i.classList.toggle('ligado');
  }));
  q('.grupo-opcoes').forEach(g => g.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => g.querySelectorAll('button')
      .forEach(o => o.classList.toggle('ativa', o === b)))));
  q('.linha-radio').forEach(r => r.addEventListener('click', () => {
    q('.linha-radio').forEach(o => o.classList.toggle('ativa', o === r));
  }));
  q('.abas-dispositivo button').forEach(b => b.addEventListener('click', () => {
    q('.abas-dispositivo button').forEach(o => o.classList.toggle('ativa', o === b));
  }));
}

function abrirExtra(nome) {
  telaExtra = nome;
  subExtra = 'raiz';
  const def = TELAS_EXTRA[nome];
  abaExtra = def.abas ? def.abas[0] : null;
  secaoExtra = def.menu ? def.menu[0] : null;
  painelExtra.classList.add('aberto');
  montarExtra();
}
function fecharExtra() {
  painelExtra.classList.remove('aberto');
  painelExtra.innerHTML = '';
}

Array.from(document.querySelectorAll('[data-abre]')).forEach(b =>
  b.addEventListener('click', () => abrirExtra(b.dataset.abre)));
