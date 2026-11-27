/* ============================================================
   Painel de configurações do controle (engrenagem da barra)
   Cada página é montada a partir da descrição abaixo.
   ============================================================ */

const ICONES_MENU = {
  aeronave: '<svg viewBox="0 0 24 24"><path d="M3.4 12.6 20.6 4.6 12.6 20.6l-2-7z"/></svg>',
  pulverizacao: '<svg viewBox="0 0 24 24"><rect x="5" y="4.4" width="14" height="3.4" rx="1.2"/>' +
    '<path d="M12 2.2v2.2" stroke="currentColor" stroke-width="1.8"/>' +
    '<g fill="currentColor"><circle cx="7" cy="11" r="1"/><circle cx="10" cy="12.4" r="1"/>' +
    '<circle cx="13" cy="11" r="1"/><circle cx="16" cy="12.4" r="1"/><circle cx="8.6" cy="15" r="1"/>' +
    '<circle cx="11.6" cy="16.6" r="1"/><circle cx="14.6" cy="15" r="1"/><circle cx="10" cy="19.4" r="1"/>' +
    '<circle cx="13.4" cy="19.4" r="1"/></g></svg>',
  controle: '<svg viewBox="0 0 24 24"><rect x="2.4" y="7" width="19.2" height="12.6" rx="2.6" fill="none" ' +
    'stroke="currentColor" stroke-width="2"/><circle cx="7.4" cy="11.4" r="1.6"/><circle cx="16.6" cy="11.4" r="1.6"/>' +
    '<path d="M6.6 7 4.6 3.2M17.4 7l2-3.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sensor: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2"/>' +
    '<path d="M12 12 5.6 7.4 10.2 12 5.6 16.6zM12 12l6.4-4.6L13.8 12l4.6 4.6z"/></svg>',
  rtk: '<svg viewBox="0 0 24 24"><rect x="1.6" y="6.4" width="20.8" height="11.2" rx="2.4"/>' +
    '<text x="12" y="15.4" text-anchor="middle" font-size="7.4" font-weight="700" fill="#fff" ' +
    'font-family="Inter,sans-serif">RTK</text></svg>',
  bateria: '<svg viewBox="0 0 24 24"><rect x="6.4" y="4.4" width="11.2" height="16.4" rx="2" fill="none" ' +
    'stroke="currentColor" stroke-width="2"/><rect x="9.6" y="2.2" width="4.8" height="2.4" rx="1"/>' +
    '<path d="M12.6 8.4 8.8 14h3.2l-1 4.4L16 12.4h-3.4z"/></svg>',
  aovivo: '<svg viewBox="0 0 24 24"><rect x="1.6" y="6.4" width="20.8" height="11.2" rx="2.4"/>' +
    '<text x="12" y="15.4" text-anchor="middle" font-size="7.6" font-weight="700" fill="#fff" ' +
    'font-family="Inter,sans-serif">HD</text></svg>'
};

const PAGINAS_CONFIG = [
  /* ================= AERONAVE ================= */
  {
    id: 'aeronave', rotulo: 'Aeronave', titulo: 'Configurações da aeronave',
    blocos: [
      { t: 'secao', texto: 'Roteamento de conexão e RTH' },
      { t: 'faixa', rotulo: 'Roteamento de conexão e velocidade RTH', valor: 10.8, min: 10.8, max: 36, passo: 0.2, unidade: 'km/h' },
      { t: 'faixa', rotulo: 'Roteamento de conexão e altitude RTH', valor: 3, min: 3, max: 30, passo: 1, unidade: 'm' },
      { t: 'nota', texto: 'A aeronave subirá a uma altitude predefinida durante a decolagem e antes de retornar à base<br>' +
          'O roteamento de conexão/altitude RTH devem ser inferiores a <b class="verde">Altitude de voo máx.</b>', diagrama: 'rth' },
      { t: 'titulo', texto: 'Atualizar Ponto de origem' },
      { t: 'grupo', opcoes: ['Definir localização da aeronave', 'Definir localização do controle remoto'], ativo: -1, desativado: true, comDrone: -1 },
      { t: 'secao', texto: 'Resposta da aeronave' },
      { t: 'titulo', texto: 'Tanque vazio' },
      { t: 'grupo', opcoes: ['Voo estacionário', 'Subir 3 m', 'Retorno à base (RTH)'], ativo: -1, desativado: true, comDrone: 2 },
      { t: 'desc', texto: 'Disponível nos modos Rota, Árvores e Manual Plus (M+)' },
      { t: 'titulo', texto: 'Tarefa concluída' },
      { t: 'grupo', opcoes: ['Voo estacionário', 'Retorno à base (RTH)'], ativo: -1, desativado: true, comDrone: 1 },
      { t: 'desc', texto: 'Disponível nos modos Rota, Árvores e Mapeamento' },
      { t: 'titulo', texto: 'Sinal do CR perdido' },
      { t: 'grupo', opcoes: ['Voo estacionário', 'Aterrissagem', 'Retorno à base (RTH)'], ativo: -1, desativado: true, comDrone: 2 },
      { t: 'toggle', rotulo: 'Continuar tarefa em sinal perdido', ligado: false, caixa: true },
      { t: 'secao', texto: 'Outras configurações' },
      { t: 'titulo', texto: 'Holofote' },
      { t: 'grupo', opcoes: ['Automático', 'Desl.', 'Lig.'], ativo: -1, desativado: true, comDrone: 0 },
      { t: 'desc', texto: 'Fornece iluminação para sensoriamento de visão e operação da tarefa à noite' },
      { t: 'link', rotulo: 'Otimização de voo', subtela: 'otimizacao' },
      { t: 'link', rotulo: 'Alerta e assistência', subtela: 'alerta' },
      { t: 'link', rotulo: 'Proteção de voo', subtela: 'protecao' },
      { t: 'link', rotulo: 'Calibração do sensor', subtela: 'calibracao' },
      { t: 'textoverde', texto: 'Vinculando' },
      { t: 'textoverde', texto: 'Restaurar tarefa não concluída', apagado: true }
    ],
    subtelas: {
      otimizacao: {
        titulo: 'Otimização de voo',
        blocos: [
          { t: 'toggle', rotulo: 'Ajuste automático do espaçamento da rota', ligado: true,
            desc: 'Otimiza a cobertura de pulverização e dispersão nas bordas do campo' },
          { t: 'toggle', rotulo: 'Resumo inteligente', ligado: true,
            desc: 'Melhora a eficiência do voo reduzindo a distância para onde a aeronave voa com carga útil total antes de retomar a operação' },
          { t: 'escolha', opcoes: [
              { titulo: 'Desabilitado', desc: 'Retomar tarefa do último ponto de interrupção registrado', diagrama: 'rota1' },
              { titulo: 'Habilitado', desc: 'Retomar tarefa da trajetória mais próxima', diagrama: 'rota2' }
            ], ativo: 0 },
          { t: 'toggle', rotulo: 'Exibir ponto de tanque vazio', ligado: false,
            desc: 'Disponível apenas no modo Rota. Quando ativado, o sistema calculará e exibirá automaticamente a localização do ponto de tanque vazio na rota do voo',
            diagrama: 'tanque' },
          { t: 'toggle', rotulo: 'Retificar compensação de calibração', ligado: false,
            desc: 'Habilite este recurso para corrigir quaisquer deslocamentos criados pela aplicação de campo com pontos de calibração (habilitado automaticamente no modo Árvore de fruta)' }
        ]
      },
      alerta: {
        titulo: 'Alerta e assistência',
        blocos: [
          { t: 'toggle', rotulo: 'Visualização da rota (M+)', ligado: true },
          { t: 'nota', texto: 'Quando esta função estiver ativada junto ao modo M+, a rota de voo visualizada será exibida em ambos os lados da aeronave com base no espaçamento de rota definido',
            diagrama: 'faixas' }
        ]
      },
      protecao: {
        titulo: 'Proteção de voo',
        blocos: [
          { t: 'faixa', rotulo: 'Distância máxima de voo', valor: 1000, min: 50, max: 2000, passo: 10, unidade: 'm', preenchida: true },
          { t: 'faixa', rotulo: 'Altitude de voo máx.', valor: 100, min: 15, max: 100, passo: 1, unidade: 'm', preenchida: true, rotuloMax: '30' },
          { t: 'toggle', rotulo: 'Detecção de travamento do braço da estrutura', ligado: true, apagado: true,
            desc: 'Verifica automaticamente se as travas do braço da estrutura estão presas com segurança e proíbe o voo se os braços não estiverem presos' },
          { t: 'toggle', rotulo: 'Detecção de reabastecimento', ligado: true, apagado: true,
            desc: 'Detecta automaticamente se os materiais de pulverização ou dispersão estão sendo adicionados à aeronave. Decolagem não permitida durante o reabastecimento' },
          { t: 'toggle', rotulo: 'Verificação de segurança na aterrissagem', ligado: true, apagado: true,
            desc: 'Solicita confirmação de segurança quando a aeronave pousa automaticamente. Pode ser desativada quando o posicionamento RTK estiver disponível' },
          { t: 'toggle', rotulo: 'Permitir Modo Atitude (ATTI)', ligado: false,
            desc: 'O modo Attitude será ativado quando a alternância do modo de voo do CR for alterada para o modo S. Voe com cuidado' },
          { t: 'link', rotulo: 'Desbloquear Zona GEO', subtela: 'geo' }
        ]
      },
      geo: {
        titulo: 'Desbloquear Zona GEO', volta: 'protecao',
        blocos: [{ t: 'zona-geo' }]
      },
      calibracao: {
        titulo: 'Calibração do sensor',
        blocos: [
          { t: 'acao', rotulo: 'Calibração do sensor de atitude (IMU)', botao: 'Calibrar', apagado: true },
          { t: 'erros' },
          { t: 'acao', rotulo: 'Calibração do gimbal', botao: 'Calibrar' },
          { t: 'marcado', marca: 'Erro de movimento do gimbal', texto: 'Calibre o gimbal quando a atitude do gimbal for imprecisa' },
          { t: 'titulo', texto: 'Nº do motor.' },
          { t: 'tabela', cabecalho: ['Nº do motor.', 'Velocidade de rotação (RPM)', 'Torque de orientação (%)'],
            linhas: [['M1', '-', '-'], ['M2', '-', '-'], ['M3', '-', '-'], ['M4', '-', '-']] }
        ]
      }
    }
  },

  /* ================= PULVERIZAÇÃO ================= */
  {
    id: 'pulverizacao', rotulo: 'Pulveriz', titulo: 'Configurações do sistema de pulverização',
    blocos: [
      { t: 'secao', texto: 'Configurações da tarefa' },
      { t: 'toggle', rotulo: 'Sistemas de pulverização e distribuição', ligado: true, apagado: true,
        desc: 'Depois que os sistemas de pulverização e distribuição forem desligados, a aeronave não poderá pulverizar ou distribuir. As tarefas de rota de voo ainda podem ser executadas' },
      { t: 'toggle', rotulo: 'Pulverização atomizada', ligado: true, apagado: true,
        desc: 'Quando desativado, os motores centrífugos param de funcionar durante a pulverização. Os sprinklers pulverizarão jatos líquidos sem atomização' },
      { t: 'secao', texto: 'Gerenciamento e calibração' },
      { t: 'titulo', texto: 'Dados em tempo real do sistema de pulverização' },
      { t: 'dados', itens: [
          { valor: '-- L/Min', rotulo: 'Quociente de vazão' },
          { valor: '-- l', rotulo: 'Volume pulverizado' },
          { valor: '--', rotulo: 'Carga líquida restante', verde: true },
          { valor: '-- kg', rotulo: 'Carga no tanque' },
          { valor: '--', rotulo: 'Status de flutuação' }
        ] },
      { t: 'tabela-bomba' },
      { t: 'acao', rotulo: 'Mangueira limpa', botao: 'Limpar', apagado: true,
        desc: 'Enxágue a mangueira com água doce para remover os resíduos. Os aspersores são desativados durante a limpeza' },
      { t: 'acao', rotulo: 'Liberar ar preso', botao: 'Iniciar', apagado: true,
        desc: 'A ativação desse recurso libera o ar preso nas mangueiras da bomba do pulverizador. Pressione e mantenha pressionado o botão Pulverização para ativar rapidamente esse recurso quando estiver na visualização de tarefas.' },
      { t: 'select', rotulo: 'Alerta de erro do fluxômetro', valor: 'Não exibir', apagado: true, valorDrone: '10%',
        desc: 'O controle remoto alertará o usuário quando uma grande diferença entre o nível de fluxo padrão e o nível de fluxo real for detectada no fluxômetro' },
      { t: 'titulo', texto: 'Tipo de disco giratório' },
      { t: 'escolha', colunas: true, opcoes: [
          { titulo: 'Camada dupla (padrão)', desc: 'Adequado para líquidos em geral' },
          { titulo: 'Camada única', desc: 'Adequado para líquidos de alta viscosidade ou pó pulverulento' }
        ], ativo: 0 },
      { t: 'marcado', marca: 'Observação após a substituição',
        texto: 'Selecione o tipo de disco giratório que corresponde à sua configuração atual. Caso contrário, as configurações de tamanho da gotícula podem ser imprecisas' },
      { t: 'link', rotulo: 'Calibração do sistema de pulverização', subtela: 'calibracao-pulv' }
    ],
    subtelas: {
      'calibracao-pulv': {
        titulo: 'Calibração do sistema de pulverização',
        blocos: [
          { t: 'acao', rotulo: 'Calibração do fluxômetro', botao: 'Calibrar', apagado: true },
          { t: 'marcado', marca: 'Vazão imprecisa', texto: 'Calibre o medidor de vazão no solo quando a leitura do fluxo for imprecisa' },
          { t: 'acao', rotulo: 'Redefinição de fábrica do medidor de vazão', botao: 'Restaurar', apagado: true,
            desc: 'Restaurar o medidor de vazão para as configurações de fábrica quando a leitura da vazão permanecer imprecisa após a calibração' },
          { t: 'acao', rotulo: 'Calibração da bomba', botao: 'Calibrar', apagado: true },
          { t: 'marcado', marca: 'Pulverização imprecisa</b> <b class="marca-verde">Após substituir a bomba ou o aspersor',
            texto: 'Calibre a bomba no solo quando a taxa de pulverização real for diferente da taxa de aplicação definida ou após a substituição de bombas ou aspersores. Recomenda-se calibrar o medidor de vazão antes de calibrar a bomba' },
          { t: 'acao', rotulo: 'Calibração do sensor de peso (Tara)', botao: 'Calibrar', apagado: true },
          { t: 'marcado', marca: 'Redefinir para zero', texto: 'Execute a calibração da tara e redefina a exibição do peso para 0' },
          { t: 'coeficientes-peso' }
        ]
      }
    }
  },

  /* ================= CONTROLE ================= */
  {
    id: 'controle', rotulo: 'Controle', titulo: 'Configurações do CR',
    blocos: [
      { t: 'titulo', texto: 'Modo do joystick' },
      { t: 'modos' },
      { t: 'joysticks' },
      { t: 'acao', rotulo: 'Calibração do controle remoto', botao: 'Calibrar', acao: 'calibrar-cr' },
      { t: 'calibracao-cr' },
      { t: 'link', rotulo: 'Visão geral dos botões', subtela: 'botoes' },
      { t: 'titulo', texto: 'Botão personalizado' },
      { t: 'personalizados' }
    ],
    subtelas: {
      botoes: { titulo: 'Visão geral dos botões', semMenu: true, blocos: [{ t: 'visao-botoes' }] }
    }
  },

  /* ================= SENSOR ================= */
  {
    id: 'sensor', rotulo: 'Sensor', titulo: 'Configurações do sensor',
    blocos: [
      { t: 'toggle', rotulo: 'desvio de obstáculos multidirecional', ligado: true,
        desc: 'Quando ativada, a aeronave detecta obstáculos na horizontal dentro de 16,0 m e acima e abaixo dentro de 5,0 m, freando para evitar colisões. A detecção para baixo é usada para auxiliar no acompanhamento do terreno e na estabilização da altitude. A eficácia da detecção pode diferir em diferentes ambientes ou dependendo do tipo e tamanho do obstáculo' },
      { t: 'titulo', texto: 'Cenário' },
      { t: 'grupo', opcoes: ['Planícies', 'Colina/Pomar', 'Acima da água'], ativo: 0, apagado: true },
      { t: 'toggle', rotulo: 'Estabilização da altitude', ligado: true,
        desc: 'A aeronave segue o terreno automaticamente e ajusta a altitude durante o voo com base na altura definida acima das culturas' },
      { t: 'toggle', rotulo: 'Desvio de obstáculos', ligado: true, alerta: true,
        desc: 'Quando habilitado, a aeronave tentará desviar automaticamente dos obstáculos. Mova os pinos de controle para cancelar o desvio<br>' +
              'Quando ativada, a altura acima dos cultivos é limitada entre 2,5 e 8,0 m para maior segurança de voo' },
      { t: 'desvio-prioridade' },
      { t: 'link', rotulo: 'Configurações de radar', subtela: 'radar' }
    ],
    subtelas: {
      radar: {
        titulo: 'Configurações avançadas',
        blocos: [
          { t: 'titulo', texto: 'Sensibilidade do radar' },
          { t: 'grupo', opcoes: ['Alta', 'Média'], ativo: 1, apagado: true },
          { t: 'desc', texto: 'A sensibilidade alta permite que o radar detecte objetos pequenos<br>' +
              'A sensibilidade média ajuda a minimizar alarmes falsos quando há metais ou outros refletores bons nas proximidades, como contêineres, torres de alta tensão, painéis solares e veículos ' +
              '<b class="laranja">Voe em aeronaves com velocidade abaixo de 18.0km/h</b> quando a sensibilidade do radar estiver definida como média, para aumentar a segurança do voo' },
          { t: 'faixa', rotulo: 'Distância de frenagem para obstáculo lateral', valor: 6, min: 4, max: 6, passo: 0.5, unidade: 'm', preenchida: true },
          { t: 'nota', texto: 'Ajuste a distância a partir da qual a aeronave freia para evitar obstáculos em ambos os lados', diagrama: 'frenagem' },
          { t: 'toggle', rotulo: 'Desvio de obstáculos aprimorado', ligado: false,
            desc: 'Quando ativada, a capacidade da aeronave de evitar pequenos obstáculos, como galhos de árvores, é aprimorada. Desative quando ocorrerem erros de evasão com frequência durante o voo' }
        ]
      }
    }
  },

  /* ================= RTK ================= */
  {
    id: 'rtk', rotulo: 'RTK', titulo: 'Configurações RTK',
    blocos: [
      { t: 'toggle', rotulo: 'Posicionamento RTK', ligado: false, forte: true, id: 'rtk-ligado' },
      { t: 'rtk-corpo' },
      { t: 'toggle', rotulo: 'Orientação RTK', ligado: false }
    ]
  },

  /* ================= BATERIA / AO VIVO ================= */
  {
    id: 'bateria', rotulo: 'Bateria', titulo: 'Bateria Inteligente',
    blocos: [
      { t: 'linha-titulo', texto: 'Dados da bateria em tempo real', direita: 'Unidade: Volt' },
      { t: 'celulas' },
      { t: 'dados', quatro: true, itens: [
          { valor: 'N/A<i>v</i>', rotulo: 'Tensão' },
          { valor: 'N/A<i>°C</i>', rotulo: 'Temperatura' },
          { valor: 'N/A', rotulo: 'Número de ciclos' },
          { valor: 'N/A<i>A</i>', rotulo: 'Corrente da bateria' }
        ] },
      { t: 'secao', texto: 'Com bateria fraca' },
      { t: 'titulo-marcado', cor: '#f0a63a', texto: 'Com bateria fraca (abaixo de <b class="laranja">-%</b>)' },
      { t: 'grupo', opcoes: ['Advertência', 'RTH'], ativo: -1, desativado: true, comDrone: 1 },
      { t: 'desc', texto: 'Quando o nível da bateria estiver baixo, o controle remoto vibrará para alertar ou a aeronave retornará automaticamente à base' },
      { t: 'titulo-marcado', cor: '#e8442e', texto: 'Bateria muito fraca (abaixo de <b class="laranja">-%</b>)', direita: 'Aterrissagem' },
      { t: 'desc', texto: 'Quando o nível da bateria estiver muito baixo, o controle remoto vibrará para alertar e a aeronave retornará automaticamente à base' },
      { t: 'titulo', texto: 'Limites de bateria fraca e muito fraca' },
      { t: 'faixa-dupla' },
      { t: 'linha-titulo', texto: 'Aterrissa', direita: '-' },
      { t: 'linha-titulo', texto: 'Número de série da bateria', direita: 'N/A' }
    ]
  },
  {
    id: 'aovivo', rotulo: 'Ao vivo', titulo: 'Configurações da transmissão de imagem',
    blocos: [{ t: 'link', rotulo: 'Configurações do Canal de Transmissão Direta', subtela: 'canal' }],
    subtelas: {
      canal: {
        titulo: 'Configurações do Canal de Transmissão ...',
        blocos: [
          { t: 'titulo', texto: 'Modo canal' },
          { t: 'grupo', opcoes: ['Automático', 'Personalizado'], ativo: -1, desativado: true },
          { t: 'select', rotulo: 'Frequência', valor: '', apagado: true },
          { t: 'grafico-canal' },
          { t: 'select', rotulo: 'Largura de banda', valor: '', apagado: true },
          { t: 'select', rotulo: 'Canal', valor: '', apagado: true }
        ]
      }
    }
  }
];

/* ---------------- diagramas ---------------- */
const DIAGRAMAS = {
  rth: '<svg viewBox="0 0 120 60"><path d="M18 46v-12h16v-12h16v-12h34" fill="none" stroke="#3ab54a" stroke-width="2.4" ' +
    'stroke-dasharray="5 4"/><path d="M84 10v30" fill="none" stroke="#3ab54a" stroke-width="2.4" stroke-dasharray="5 4"/>' +
    '<path d="m84 44-4-6h8z" fill="#3ab54a"/><path d="m18 32 4 6h-8z" fill="#3ab54a"/>' +
    '<path d="M2 40 14 46 2 52z" fill="#1f2326"/>' +
    '<circle cx="84" cy="48" r="8" fill="none" stroke="#3ab54a" stroke-width="2.2"/>' +
    '<text x="84" y="51.5" text-anchor="middle" font-size="8" font-weight="700" fill="#3ab54a" font-family="Inter,sans-serif">H</text></svg>',
  rota1: '<svg viewBox="0 0 120 60"><path d="M46 14h10v32h10V14h10v32h10V14h10" fill="none" stroke="#f0a63a" stroke-width="2.6"/>' +
    '<path d="M30 12h14" fill="none" stroke="#b9bdc0" stroke-width="2.2"/>' +
    '<circle cx="48" cy="14" r="4" fill="#e8442e"/><path d="M18 22 30 28 18 34z" fill="#1f2326"/>' +
    '<path d="M32 30 44 18" fill="none" stroke="#3ab54a" stroke-width="2" stroke-dasharray="4 3"/></svg>',
  rota2: '<svg viewBox="0 0 120 60"><path d="M46 46h10V14h10v32h10V14h10v32h10" fill="none" stroke="#f0a63a" stroke-width="2.6"/>' +
    '<path d="M30 12h14" fill="none" stroke="#b9bdc0" stroke-width="2.2"/>' +
    '<circle cx="48" cy="46" r="4" fill="#e8442e"/><path d="M18 40 30 46 18 52z" fill="#1f2326"/>' +
    '<path d="M32 46h12" fill="none" stroke="#3ab54a" stroke-width="2" stroke-dasharray="4 3"/></svg>',
  tanque: '<svg viewBox="0 0 120 70"><rect x="2" y="2" width="116" height="66" fill="none" stroke="#d8d8d7" stroke-width="2"/>' +
    '<path d="M20 56V16h16v40h16V16h16v40h16V16h16v40" fill="none" stroke="#f0c419" stroke-width="3"/>' +
    '<circle cx="20" cy="58" r="4" fill="#3ab54a"/><circle cx="100" cy="58" r="4" fill="#f0a63a"/>' +
    '<path d="M20 44V22" fill="none" stroke="#e8442e" stroke-width="3"/><path d="m20 18-4 7h8z" fill="#e8442e"/>' +
    '<path d="M50 30 46 38h4l-2 6 6-9h-4z" fill="#e8442e"/></svg>',
  faixas: '<svg viewBox="0 0 120 70"><rect width="120" height="70" fill="#6f8f4f"/>' +
    '<g stroke="#fff" stroke-width="1.4" stroke-dasharray="4 4" opacity=".85">' +
    '<path d="M0 14h120M0 28h120M0 42h120M0 56h120"/></g>' +
    '<g fill="#fff"><circle cx="60" cy="14" r="3"/><circle cx="60" cy="28" r="3"/><circle cx="60" cy="42" r="3"/><circle cx="60" cy="56" r="3"/></g>' +
    '<path d="M70 28 54 35l16 7-4-7z" fill="#e8442e" stroke="#fff" stroke-width="1.4"/></svg>',
  frenagem: '<svg viewBox="0 0 90 70"><path d="M14 16v38M76 16v38" stroke="#1f2326" stroke-width="5" stroke-linecap="round"/>' +
    '<circle cx="45" cy="35" r="20" fill="none" stroke="#bfe3c8" stroke-width="2.4"/>' +
    '<circle cx="45" cy="35" r="13" fill="none" stroke="#7fcf96" stroke-width="2.4"/>' +
    '<path d="M45 27 51 41h-12z" fill="#3ab54a"/></svg>',
  desvio: '<svg viewBox="0 0 240 60"><path d="M0 54h240" stroke="#c9cbcd" stroke-width="2"/>' +
    '<path d="M110 54 140 30l30 14 40-20 30 30z" fill="#e2e3e4"/>' +
    '<rect x="118" y="14" width="6" height="40" fill="#2f3336"/>' +
    '<g transform="translate(70 26)"><rect x="-10" y="-3" width="20" height="6" rx="2" fill="#2f3336"/>' +
    '<path d="M-16 -4h10M6 -4h10" stroke="#2f3336" stroke-width="2"/><path d="M-6 3v4M6 3v4" stroke="#2f3336" stroke-width="1.6"/></g>' +
    '<path d="M100 18q20-20 40 0" fill="none" stroke="#3ab54a" stroke-width="3"/><path d="m140 18 2-8 6 6z" fill="#3ab54a"/></svg>',
  pesos: '<svg viewBox="0 0 120 70"><rect x="34" y="14" width="52" height="42" rx="6" fill="#3c4245"/>' +
    '<rect x="44" y="22" width="32" height="26" rx="4" fill="#5e6367"/>' +
    '<g stroke="#8d9296" stroke-width="5" stroke-linecap="round"><path d="M34 20 12 8M86 20l22-12M34 50 12 62M86 50l22 12"/></g>' +
    '<g fill="none" stroke="#3ab54a" stroke-width="2.4"><circle cx="40" cy="35" r="6"/><circle cx="80" cy="35" r="6"/></g></svg>'
};

/* ---------------- montagem ---------------- */
const painelConfig = document.getElementById('painel-config');

function faixaHTML(b) {
  const casas = String(b.passo).indexOf('.') >= 0 ? 1 : 0;
  const texto = casas ? b.valor.toFixed(1).replace('.', ',') : String(b.valor);
  return '<div class="linha-faixa"><span class="rotulo-faixa">' + b.rotulo + '</span>' +
    '<span class="valor-faixa">' + texto + '<i>' + b.unidade + '</i></span></div>' +
    '<div class="faixa' + (b.preenchida ? ' preenchida' : '') + '">' +
    '<button class="passo-config" data-faixa="-1">−</button>' +
    '<div class="trilho"><input type="range" min="' + b.min + '" max="' + b.max + '" step="' + b.passo + '" value="' + b.valor + '">' +
    '<div class="limites"><span>' + b.min + '</span><span>' + (b.rotuloMax || b.max) + '</span></div></div>' +
    '<button class="passo-config" data-faixa="1">+</button></div>';
}

function blocoHTML(b) {
  switch (b.t) {
    case 'secao': return '<p class="config-secao">' + b.texto + '</p>';
    case 'titulo': return '<p class="config-titulo">' + b.texto + '</p>';
    case 'desc': return '<p class="config-desc">' + b.texto + '</p>';
    case 'textoverde': return '<p class="config-verde' + (b.apagado ? ' apagado' : '') + '">' + b.texto + '</p>';
    case 'faixa': return '<div class="config-bloco">' + faixaHTML(b) + '</div>';
    case 'nota':
      return '<div class="config-nota"><p>' + b.texto + '</p>' +
        (b.diagrama ? '<div class="diagrama">' + DIAGRAMAS[b.diagrama] + '</div>' : '') + '</div>';
    case 'grupo':
      return '<div class="grupo-opcoes' + (b.desativado ? ' desativado' : '') + (b.apagado ? ' apagado' : '') + '"' +
        (b.comDrone !== undefined ? ' data-ativo-drone="' + b.comDrone + '"' : '') + '>' +
        b.opcoes.map((o, i) => '<button class="' + (i === b.ativo ? 'ativa' : '') + '">' + o + '</button>').join('') + '</div>';
    case 'toggle':
      return '<div class="config-bloco' + (b.caixa ? ' caixa' : '') + '"' + (b.id ? ' id="' + b.id + '"' : '') + '>' +
        '<div class="linha-toggle-config"><span class="rotulo-toggle' + (b.forte ? ' forte' : '') + '">' + b.rotulo +
        (b.alerta ? ' <i class="alerta">!</i>' : '') + '</span>' +
        '<button class="interruptor' + (b.ligado ? ' ligado' : '') + (b.apagado ? ' apagado' : '') + '"><i></i></button></div>' +
        (b.desc ? '<p class="config-desc">' + b.desc + '</p>' : '') +
        (b.diagrama ? '<div class="nota-diagrama"><div class="diagrama">' + DIAGRAMAS[b.diagrama] + '</div></div>' : '') +
        '</div>';
    case 'escolha':
      return '<div class="grupo-escolha' + (b.colunas ? ' colunas' : '') + '">' +
        b.opcoes.map((o, i) =>
          '<button class="' + (i === b.ativo ? 'ativa' : '') + '">' +
          (b.colunas ? '<span class="radio"></span>' : '') +
          '<span class="texto"><b>' + o.titulo + '</b><i>' + o.desc + '</i></span>' +
          (o.diagrama ? '<span class="diagrama">' + DIAGRAMAS[o.diagrama] + '</span>' : '') +
          '</button>').join('') + '</div>';
    case 'link':
      return '<button class="linha-link"' + (b.subtela ? ' data-abre-subtela="' + b.subtela + '"' : '') + '>' +
        '<span>' + b.rotulo + '</span><i>›</i></button>';
    case 'acao':
      return '<div class="config-bloco"><div class="linha-acao"><span>' + b.rotulo + '</span>' +
        '<button class="botao-contorno' + (b.apagado ? ' apagado' : '') + '"' +
        (b.acao ? ' data-acao="' + b.acao + '"' : '') + '>' + b.botao + '</button></div>' +
        (b.desc ? '<p class="config-desc">' + b.desc + '</p>' : '') + '</div>';
    case 'select':
      return '<div class="config-bloco"><div class="linha-select' + (b.simples ? ' simples' : '') + '">' +
        '<span>' + b.rotulo + '</span>' +
        '<button class="caixa-select' + (b.apagado ? ' apagado' : '') + '"' +
        (b.valorDrone ? ' data-valor-drone="' + b.valorDrone + '" data-valor-sem="' + b.valor + '"' : '') + '>' + b.valor + '<i>⌄</i></button></div>' +
        (b.desc ? '<p class="config-desc">' + b.desc + '</p>' : '') + '</div>';
    case 'marcado':
      return '<p class="config-desc"><b class="marca-verde">' + b.marca + '</b> ' + b.texto + '</p>';
    case 'dados':
      return '<div class="grade-dados' + (b.quatro ? ' quatro' : '') + '">' + b.itens.map(i =>
        '<div><b' + (i.verde ? ' class="verde"' : '') + '>' + i.valor + '</b><span>' + i.rotulo + '</span></div>').join('') + '</div>';
    case 'erros':
      return '<div class="grade-erros">' +
        '<div><span>Erro de deslocamento zero do acelerômetro</span><b>0.01</b><div class="barra"><i></i></div></div>' +
        '<div><span>Erro de deslocamento zero do giroscópio</span><b>0.01</b><div class="barra"><i></i></div></div></div>';
    case 'tabela':
      return '<div class="tabela-config"><div class="linha cabecalho">' +
        b.cabecalho.map(c => '<span>' + c + '</span>').join('') + '</div>' +
        (b.linhas || []).map(l => '<div class="linha">' + l.map(c => '<span>' + c + '</span>').join('') + '</div>').join('') +
        '</div>';
    case 'tabela-bomba':
      return '<div class="tabela-bomba">' +
        '<div class="topo"><div><b>Bomba</b><span>Os números da bomba estão localizados em ambos os lados no fundo do tanque</span></div>' +
        '<div><b>Bico centrífugo</b><span>Os aspersores são numerados da mesma forma que os braços da aeronave em que estão instalados</span></div></div>' +
        '<div class="grade"><span>Nº</span><span>Velocidade rotacional <i>(rev/min)</i></span><span>Fluxo <i>(L/Min)</i></span>' +
        '<span>Nº</span><span>Velocidade rotacional <i>(rev/min)</i></span>' +
        '<span>1</span><span>--</span><span>--</span><span>3</span><span>--</span>' +
        '<span>2</span><span>--</span><span>--</span><span>4</span><span>--</span></div></div>';
    case 'status-rtk':
      return '<div class="config-bloco"><div class="linha-select simples"><span>Status de posicionamento</span>' +
        '<span class="etiquetas"><b class="sinal">4G <i>▮▮▯</i></b><b class="cinza">Desconectado</b></span></div></div>';
    case 'tabela-rtk':
      return '<div class="tabela-rtk"><div class="linha cabecalho"><span></span><span>Aeronave</span><span>Status de RTK de rede</span></div>' +
        ['Orientação', 'Posicionament', 'Latitude', 'Longitude', 'Altitude', 'Ângulo de curso'].map((r, i) =>
          '<div class="linha' + (i % 2 ? ' par' : '') + '"><span>' + r + '</span><span>-</span><span>-</span></div>').join('') +
        '</div>';
    case 'modos':
      return '<div class="modos-joystick">' +
        ['Modo 1', 'Modo 2', 'Modo 3'].map((m, i) =>
          '<button class="' + (i === 1 ? 'ativa' : '') + '" data-modo="' + (i + 1) + '">' + m + '</button>').join('') + '</div>';
    case 'joysticks':
      return '<div class="cartoes-joystick" id="cartoes-joystick">' + joysticksHTML(2) + '</div>';
    case 'calibracao-cr':
      return '<div class="cartoes-calibracao">' +
        ['esquerdo', 'direito'].map(lado =>
          '<div class="cartao-cal"><p>Botão rotativo ' + lado + '</p>' +
          '<div class="barra-cal"><span>0%</span><div class="trilho-cal"><i></i></div><span>0%</span></div>' +
          '<p class="pino">Pino ' + lado + '<b>0%</b></p>' +
          '<div class="cruz-cal"><span>0%</span><div class="cruz"></div><span>0%</span></div>' +
          '<p class="baixo">0%</p></div>').join('') + '</div>';
    case 'personalizados':
      return '<div class="personalizados">' +
        '<div class="figura">' + figuraControle('L') + '</div>' +
        '<div class="campos">' +
        campoBotao('L1', 'Adicionar ponto') + campoBotao('L2', 'Interruptor de holofote') +
        campoBotao('L3', 'Estabilizador de inclinação para baixo/recentralização') +
        '</div></div>' +
        '<div class="personalizados">' +
        '<div class="figura">' + figuraControle('D') + '</div>' +
        '<div class="campos">' +
        campoBotao('Para cima', 'Indefinida') + campoBotao('Para baixo', 'Indefinida') +
        campoBotao('Esquerda', 'Indefinida') + campoBotao('Direita', 'Indefinida') +
        campoBotao('Centro', 'Indefinida') +
        '</div></div>' +
        '<div class="personalizados">' +
        '<div class="figura">' + figuraControle('C3') + '</div>' +
        '<div class="campos">' + campoBotao('C3', 'Adicionar ponto') + '</div></div>';
    case 'visao-botoes':
      return visaoBotoesHTML();
    case 'linha-titulo':
      return '<div class="linha-titulo-config"><span>' + b.texto + '</span><i>' + (b.direita || '') + '</i></div>';
    case 'titulo-marcado':
      return '<div class="titulo-marcado"><span><b class="marca" style="background:' + b.cor + '"></b>' +
        b.texto + '</span>' + (b.direita ? '<i>' + b.direita + '</i>' : '') + '</div>';
    case 'celulas':
      var celula = '<div><svg viewBox="0 0 22 44"><rect x="7" y="1" width="8" height="3" rx="1.2" fill="#c9cbcd"/>' +
        '<rect x="1.4" y="4" width="19.2" height="39" rx="3" fill="none" stroke="#c9cbcd" stroke-width="1.6"/></svg>' +
        '<span>N/A</span></div>';
      return '<div class="celulas-bateria">' + celula.repeat(12) + '</div>';
    case 'faixa-dupla':
      return '<div class="faixa-dupla"><span class="alca">|||</span><div class="trilho-duplo"></div>' +
        '<span class="alca">|||</span></div><div class="limites-duplos"><span>-%</span><span>-%</span></div>';
    case 'grafico-canal':
      return '<div class="grafico-canal"><div class="eixo"><span>dBm/MHz</span><b>-70.0dBm</b></div>' +
        '<div class="area"><div class="marcas"><span>-70</span><span>-90</span><span>-110</span></div>' +
        '<div class="quadro"><div class="coluna"></div></div>' +
        '<div class="distancias"><span>&#8776; 1km</span><span>&#8776; 4km</span><span class="mhz">MHz</span></div></div>' +
        '<div class="rodape-grafico">0.0<b>0</b>.0</div></div>';
    case 'coeficientes-peso':
      return '<div class="config-bloco"><div class="linha-select"><span>Coeficientes do sensor de peso</span>' +
        '<span class="campo-lapis"><svg viewBox="0 0 24 24"><path d="M4 17.6V20h2.4L17.8 8.6l-2.4-2.4zM19.6 6.8a1 1 0 0 0 0-1.4l-1-1a1 1 0 0 0-1.4 0l-1 1 2.4 2.4z"/></svg></span></div>' +
        '<div class="config-nota"><p>Insira os valores dos coeficientes gravados nos sensores de peso nos campos a seguir. ' +
        'Após a inserção, todos os parâmetros de peso serão recalculados. Tenha cuidado ao realizar esta operação</p>' +
        '<div class="diagrama">' + DIAGRAMAS.pesos + '</div></div></div>';
    case 'rtk-corpo':
      return rtkCorpoHTML();
    case 'zona-geo':
      return '<div class="abas-geo"><button class="ativa">Licenças de desbloqueio de conta</button>' +
        '<button>Licenças de desbloqueio da aeronave</button><span class="botao-cinza atualizar-geo">Atualizar</span></div>' +
        '<div class="vazio-geo"><svg viewBox="0 0 64 64"><path d="M12 6h30l10 10v42H12z" fill="#dcdcdb"/><path d="M42 6v10h10z" fill="#c9c9c8"/>' +
        '<g fill="#fff"><rect x="20" y="24" width="24" height="4" rx="2"/><rect x="20" y="32" width="24" height="4" rx="2"/>' +
        '<rect x="20" y="40" width="16" height="4" rx="2"/></g></svg>' +
        '<p>Nenhuma licença disponível. Importar ou atualizar</p></div>';
    case 'desvio-prioridade':
      return '<div class="desvio-prioridade so-com-drone"><div class="diagrama">' + DIAGRAMAS.desvio + '</div>' +
        '<div class="faixa-desvio"><button class="passo-config" data-desvio="-10">−</button>' +
        '<input type="range" min="0" max="100" step="1" value="50">' +
        '<button class="passo-config" data-desvio="10">+</button></div>' +
        '<div class="rotulos-desvio"><span>Desviar horizontalmente primeiro</span><span>Desviar verticalmente primeiro</span></div></div>';
    default: return '';
  }
}

/* RTK: o que aparece depende da fonte de sinal escolhida */
function tabelaRtkHTML(segunda) {
  return '<div class="tabela-rtk"><div class="linha cabecalho"><span></span><span>Aeronave</span><span>' + segunda + '</span></div>' +
    ['Orientação', 'Posicionament', 'Latitude', 'Longitude', 'Altitude', 'Ângulo de curso'].map((r, i) =>
      '<div class="linha' + (i % 2 ? ' par' : '') + '"><span>' + r + '</span><span>-</span><span>-</span></div>').join('') +
    '</div>';
}
function rtkCorpoHTML() {
  return '<div class="rtk-corpo">' +
    '<div class="config-bloco"><div class="linha-select"><span>Fonte de sinal RTK</span>' +
      '<button class="caixa-select" data-lista="fonte-rtk">RTK de rede personalizada<i>⌄</i></button></div>' +
      '<p class="config-desc so-rede">Certifique-se de que a conexão de rede seja estável</p>' +
      '<div class="aviso-drtk so-drtk"><b>!</b><p>Certifique-se de que:<br>' +
        '1. A estação móvel RTK está colocada em uma área aberta e desobstruída<br>' +
        '2. O local de instalação e a altura da estação móvel RTK permanecem inalterados durante a operação da tarefa<br>' +
        '3. As coordenadas da estação móvel RTK definidas abaixo permanecem consistentes ao operar a mesma tarefa</p></div></div>' +
    '<div class="so-rede">' + blocoHTML({ t: 'select', rotulo: 'RTK de rede personalizada', valor: 'Configurado', simples: true }) + '</div>' +
    blocoHTML({ t: 'status-rtk' }) +
    '<div class="so-drtk"><div class="coordenadas-rtk"><div class="topo"><span>Coordenadas atuais</span>' +
      '<button class="botao-cinza">Trocar</button></div><p class="nome">Não definido</p>' +
      '<div class="valores"><div><b>--</b><span>Longitude</span></div><div><b>--</b><span>Latitude</span></div>' +
      '<div><b>--</b><span>Altitude</span></div></div></div></div>' +
    '<div class="so-rede">' + tabelaRtkHTML('Status de RTK de rede personalizado') + '</div>' +
    '<div class="so-drtk">' + tabelaRtkHTML('Status da a estação móvel RTK') +
      '<p class="config-secao">Bateria da estação móvel RTK</p>' +
      blocoHTML({ t: 'linha-titulo', texto: 'Dados da bateria em tempo real' }) +
      blocoHTML({ t: 'dados', quatro: true, itens: [
        { valor: 'N/A<i>%</i>', rotulo: 'Nível da bateria' }, { valor: 'N/A<i>V</i>', rotulo: 'Tensão' },
        { valor: 'N/A<i>mA</i>', rotulo: 'Corrente da bateria' }, { valor: 'N/A<i>°C</i>', rotulo: 'Temperatura' }] }) +
      blocoHTML({ t: 'faixa', rotulo: 'Alerta de bateria fraca', valor: 30, min: 10, max: 50, passo: 1, unidade: '%', preenchida: true }) +
      blocoHTML({ t: 'desc', texto: 'Receber um lembrete quando o nível da bateria atingir o limite' }) + '</div>' +
    blocoHTML({ t: 'link', rotulo: 'Diagnóstico RTK' }) +
    '</div>';
}

function campoBotao(rotulo, valor) {
  return '<div class="campo-botao"><span>' + rotulo + '</span>' +
    '<button class="caixa-select">' + valor + '<i>⌄</i></button></div>';
}

/* desenho simplificado do RC Plus usado nas figuras */
function figuraControle(destaque) {
  const marca = destaque === 'L'
    ? '<g stroke="#3ab54a" stroke-width="1.4" fill="none"><path d="M34 62h26v-10M34 66h20v-14M34 70h14v-18"/></g>' +
      '<g fill="#3ab54a" font-size="6" font-family="Inter,sans-serif"><text x="30" y="78">L3</text>' +
      '<text x="46" y="78">L2</text><text x="62" y="78">L1</text></g>'
    : destaque === 'D'
      ? '<g fill="#3ab54a"><path d="M116 50v-7l3 3.5zM116 58v7l3-3.5zM110 54h-7l3.5-3zM122 54h7l-3.5-3z"/>' +
        '<circle cx="116" cy="54" r="4"/></g>'
      : '<g stroke="#3ab54a" stroke-width="1.4" fill="none"><path d="M70 74V62h44"/></g>' +
        '<rect x="112" y="30" width="8" height="4" rx="1.6" fill="#3ab54a"/>' +
        '<text x="66" y="80" font-size="6" fill="#3ab54a" font-family="Inter,sans-serif">C3</text>';
  return '<svg viewBox="0 0 150 90">' +
    '<path d="M22 14 V6 M128 14 V6" stroke="#b9bdc0" stroke-width="3.4" stroke-linecap="round"/>' +
    '<rect x="14" y="14" width="122" height="58" rx="8" fill="#c9cdd0"/>' +
    '<rect x="34" y="20" width="82" height="42" rx="3" fill="#20242a"/>' +
    '<circle cx="24" cy="26" r="6" fill="#8d9296"/><circle cx="126" cy="26" r="6" fill="#8d9296"/>' +
    '<circle cx="24" cy="62" r="4" fill="#9aa0a4"/><circle cx="126" cy="62" r="4" fill="#9aa0a4"/>' +
    '<circle cx="132" cy="20" r="2.6" fill="#e8442e"/>' +
    marca + '</svg>';
}

function visaoBotoesHTML() {
  const itens = [
    ['01', 'Indicador de taxa de pulverização'], ['02', 'Botão Pulverizar/Espalhar'],
    ['03', 'Interruptor de modo de voo'], ['04', 'Troca de mapa/FPV'], ['05', 'Botão do estabilizador'],
    ['06', 'Botão HOME'], ['07', 'Botão RTH'], ['08', 'Estabilizador de inclinação para baixo/ recentralização'],
    ['09', 'Interruptor de holofote'], ['10', 'Adicionar ponto'],
    ['11', 'Botão liga/desliga (pressione + pressione e mantenha pressionado)'],
    ['12', 'Para cima&nbsp;&nbsp;Indefinida'], ['13', 'Para baixo&nbsp;&nbsp;Indefinida'],
    ['14', 'Esquerda&nbsp;&nbsp;Indefinida'], ['15', 'Direita&nbsp;&nbsp;Indefinida'],
    ['16', 'Centro&nbsp;&nbsp;Indefinida'],
    ['17', 'Freio de emergência (durante voo automático, retomada de tarefas, RTH, pouso)'],
    ['18', 'Defina o Ponto B (Rota A-B)<br>Direção para a direita (M+)'],
    ['19', 'Defina o Ponto A (Rota A-B)<br>Direção para a esquerda (M+)'],
    ['20', 'Adicionar ponto']
  ];
  return '<div class="visao-botoes">' +
    '<div class="figuras">' + figuraTopo() + figuraFrente() + figuraTras() + '</div>' +
    '<div class="lista-numerada">' + itens.map(i =>
      '<div><b>' + i[0] + '</b><span>' + i[1] + '</span></div>').join('') + '</div></div>';
}

function figuraTopo() {
  return '<svg viewBox="0 0 170 60">' +
    '<rect x="26" y="18" width="118" height="24" rx="5" fill="#b9bdc0"/>' +
    '<path d="M58 18a27 6 0 0 1 54 0" fill="none" stroke="#9aa0a4" stroke-width="3"/>' +
    '<rect x="52" y="22" width="66" height="10" rx="2" fill="#6d7276"/>' +
    '<g fill="#8d9296"><rect x="56" y="34" width="14" height="6" rx="1.4"/><rect x="74" y="34" width="14" height="6" rx="1.4"/>' +
    '<rect x="92" y="34" width="14" height="6" rx="1.4"/><rect x="110" y="34" width="10" height="6" rx="1.4"/></g>' +
    '<rect x="20" y="16" width="16" height="16" rx="4" fill="#9aa0a4"/><rect x="134" y="16" width="16" height="16" rx="4" fill="#9aa0a4"/>' +
    '<g fill="#3ab54a"><rect x="22" y="20" width="10" height="3.4" rx="1.6"/><rect x="138" y="20" width="10" height="3.4" rx="1.6"/>' +
    '<rect x="22" y="30" width="5" height="6" rx="1.4"/><rect x="29" y="30" width="5" height="6" rx="1.4"/>' +
    '<rect x="140" y="30" width="6" height="6" rx="1.4"/></g>' +
    '<g font-size="6" fill="#3ab54a" font-family="Inter,sans-serif">' +
    '<text x="4" y="24">01</text><text x="14" y="52">02</text><text x="28" y="52">03</text>' +
    '<text x="152" y="24">05</text><text x="140" y="52">04</text></g>' +
    '<g stroke="#3ab54a" stroke-width="1" fill="none"><path d="M14 22h8M24 46v-10M32 46v-8M148 22h-8M142 46v-10"/></g></svg>';
}
function figuraFrente() {
  return '<svg viewBox="0 0 170 80">' +
    '<path d="M44 16V6M126 16V6" stroke="#b9bdc0" stroke-width="3.4" stroke-linecap="round"/>' +
    '<rect x="26" y="16" width="118" height="52" rx="7" fill="#c9cdd0"/>' +
    '<rect x="46" y="22" width="78" height="38" rx="3" fill="#20242a"/>' +
    '<circle cx="36" cy="28" r="6" fill="#8d9296"/><circle cx="134" cy="28" r="6" fill="#8d9296"/>' +
    '<circle cx="36" cy="58" r="4" fill="#9aa0a4"/><circle cx="134" cy="58" r="4" fill="#9aa0a4"/>' +
    '<circle cx="140" cy="20" r="2.6" fill="#8ccf5a"/>' +
    '<g fill="#3ab54a"><circle cx="34" cy="44" r="2.4"/><circle cx="34" cy="52" r="2.4"/>' +
    '<rect x="40" y="42" width="4" height="5" rx="1"/><rect x="45" y="42" width="4" height="5" rx="1"/><rect x="50" y="42" width="4" height="5" rx="1"/>' +
    '<circle cx="134" cy="46" r="3"/><path d="M134 38v5M134 49v5M126 46h5M137 46h5"/></g>' +
    '<g font-size="6" fill="#3ab54a" font-family="Inter,sans-serif">' +
    '<text x="10" y="46">06</text><text x="10" y="56">07</text><text x="36" y="76">08</text>' +
    '<text x="48" y="76">09</text><text x="60" y="76">10</text><text x="112" y="76">11</text>' +
    '<text x="126" y="76">12~16</text><text x="140" y="14">17</text></g></svg>';
}
function figuraTras() {
  return '<svg viewBox="0 0 170 80">' +
    '<path d="M44 18V8M126 18V8" stroke="#b9bdc0" stroke-width="3.4" stroke-linecap="round"/>' +
    '<rect x="26" y="18" width="118" height="50" rx="7" fill="#8d9296"/>' +
    '<rect x="44" y="26" width="82" height="36" rx="3" fill="#a5abaf"/>' +
    '<rect x="26" y="26" width="18" height="38" rx="5" fill="#5e6367"/><rect x="126" y="26" width="18" height="38" rx="5" fill="#5e6367"/>' +
    '<g fill="#3ab54a"><rect x="32" y="34" width="5" height="9" rx="1.6"/><rect x="133" y="34" width="5" height="9" rx="1.6"/>' +
    '<rect x="130" y="24" width="9" height="3.4" rx="1.6"/></g>' +
    '<g font-size="6" fill="#3ab54a" font-family="Inter,sans-serif"><text x="30" y="78">18</text>' +
    '<text x="128" y="78">19</text><text x="150" y="28">20</text></g>' +
    '<g stroke="#3ab54a" stroke-width="1" fill="none"><path d="M34 72v-27M136 72v-27M148 26h-9"/></g></svg>';
}

/* diagramas dos dois pinos, conforme o modo escolhido */
const MODOS = {
  1: { esq: ['Para frente', 'Guinada para a direita', 'Para trás', 'Guinada para a esquerda'],
       dir: ['Subir', 'Direita', 'Descer', 'Esquerda'] },
  2: { esq: ['Subir', 'Guinada para a direita', 'Descer', 'Guinada para a esquerda'],
       dir: ['Para frente', 'Direita', 'Para trás', 'Esquerda'] },
  3: { esq: ['Para frente', 'Direita', 'Para trás', 'Esquerda'],
       dir: ['Subir', 'Guinada para a direita', 'Descer', 'Guinada para a esquerda'] }
};

function cartaoPino(nome, rotulos) {
  return '<div class="cartao-pino"><span class="nome">' + nome + '</span>' +
    '<span class="cima">' + rotulos[0] + '</span>' +
    '<span class="direita">' + rotulos[1] + '</span>' +
    '<span class="baixo">' + rotulos[2] + '</span>' +
    '<span class="esquerda">' + rotulos[3] + '</span>' +
    '<svg class="manche-svg" viewBox="0 0 80 80">' +
    '<circle cx="40" cy="40" r="26" fill="#b9bdc0"/>' +
    '<g fill="#e4e6e7"><path d="M40 16l7 10H33z"/><path d="M40 64l7-10H33z"/><path d="M16 40l10-7v14z"/><path d="M64 40l-10-7v14z"/></g>' +
    '<circle cx="40" cy="40" r="9" fill="#8d9296"/><circle cx="40" cy="40" r="4" fill="#d8dadb"/></svg></div>';
}
function joysticksHTML(modo) {
  const m = MODOS[modo];
  return cartaoPino('Pino esquerdo', m.esq) + cartaoPino('Pino direito', m.dir);
}

/* ---------------- render ---------------- */
function montarConfig() {
  const menu = PAGINAS_CONFIG.map((p, i) =>
    '<button class="' + (i === 0 ? 'ativa' : '') + '" data-config="' + p.id + '">' +
    ICONES_MENU[p.id] + '<span>' + p.rotulo + '</span></button>').join('');

  const paginas = PAGINAS_CONFIG.map((p, i) => {
    const sub = p.subtelas || {};
    const subHTML = Object.keys(sub).map(k =>
      '<div class="subtela-config" data-subtela="' + k + '" data-titulo="' + sub[k].titulo + '">' +
      sub[k].blocos.map(blocoHTML).join('') + '</div>').join('');
    return '<div class="pagina-config' + (i === 0 ? ' ativa' : '') + '" data-config="' + p.id +
      '" data-titulo="' + p.titulo + '">' +
      '<div class="lista-config">' + p.blocos.map(blocoHTML).join('') + '</div>' + subHTML + '</div>';
  }).join('');

  painelConfig.innerHTML =
    '<div class="caixa-config">' +
      '<div class="menu-config">' + menu + '</div>' +
      '<div class="corpo-config">' +
        '<div class="topo-config">' +
          '<button id="voltar-config" class="voltar-config">‹</button>' +
          '<h2 id="titulo-config"></h2>' +
          '<small class="status-config-drone" id="status-config-drone">Aeronave desconectada</small>' +
          '<button id="fechar-config" class="fechar-config">✕</button>' +
        '</div>' +
        '<div class="rolagem-config">' + paginas + '</div>' +
      '</div>' +
    '</div>';
}

montarConfig();

/* ---------------- comportamento ---------------- */
const $c = (s, r = document) => r.querySelector(s);
const $$c = (s, r = document) => Array.from(r.querySelectorAll(s));

function mostrarSubtela(nome) {
  const pagina = $c('.pagina-config.ativa');
  $$c('.subtela-config').forEach(s => s.classList.remove('ativa'));
  if (nome !== 'raiz') {
    const alvo = pagina.querySelector('[data-subtela="' + nome + '"]');
    if (alvo) alvo.classList.add('ativa');
  }
  pagina.querySelector('.lista-config').classList.toggle('escondida', nome !== 'raiz');
  $c('#voltar-config').style.visibility = nome === 'raiz' ? 'hidden' : 'visible';
  const sub = pagina.querySelector('.subtela-config.ativa');
  $c('#titulo-config').textContent = nome === 'raiz' ? pagina.dataset.titulo : sub.dataset.titulo;
  $c('.rolagem-config').scrollTop = 0;
  painelConfig.classList.toggle('sem-menu', !!(sub && sub.dataset.subtela === 'botoes'));
}

$$c('.abre-config').forEach(b => b.addEventListener('click', () => {
  painelConfig.classList.add('aberto');
  mostrarSubtela('raiz');
}));
$c('#fechar-config').addEventListener('click', () => painelConfig.classList.remove('aberto'));
$c('#voltar-config').addEventListener('click', () => mostrarSubtela('raiz'));

$$c('.menu-config button').forEach(b => {
  b.addEventListener('click', () => {
    $$c('.menu-config button').forEach(o => o.classList.toggle('ativa', o === b));
    $$c('.pagina-config').forEach(p => p.classList.toggle('ativa', p.dataset.config === b.dataset.config));
    mostrarSubtela('raiz');
  });
});
$$c('[data-abre-subtela]').forEach(b =>
  b.addEventListener('click', () => mostrarSubtela(b.dataset.abreSubtela)));

/* interruptores */
$$c('.painel-config .interruptor').forEach(i =>
  i.addEventListener('click', () => { if (!i.classList.contains('apagado')) i.classList.toggle('ligado'); }));

/* grupos de opção */
$$c('.painel-config .grupo-opcoes, .painel-config .grupo-escolha').forEach(g => {
  if (g.classList.contains('desativado')) return;
  g.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => g.querySelectorAll('button')
      .forEach(o => o.classList.toggle('ativa', o === b))));
});

/* faixas com − e + */
$$c('.painel-config .faixa').forEach(faixa => {
  const barra = faixa.querySelector('input[type="range"]');
  const valor = faixa.previousElementSibling.querySelector('.valor-faixa');
  const casas = barra.step.indexOf('.') >= 0 ? 1 : 0;
  const atualizar = () => {
    valor.firstChild.nodeValue = casas
      ? Number(barra.value).toFixed(1).replace('.', ',')
      : String(Math.round(barra.value));
    const p = (barra.value - barra.min) / (barra.max - barra.min) * 100;
    barra.style.setProperty('--preenchido', p + '%');
  };
  barra.addEventListener('input', atualizar);
  faixa.querySelectorAll('[data-faixa]').forEach(b => b.addEventListener('click', () => {
    barra.value = Number(barra.value) + Number(b.dataset.faixa) * Number(barra.step);
    atualizar();
  }));
  atualizar();
});

/* modo do joystick, com o aviso antes de trocar */
let modoJoystick = 2;
$$c('.modos-joystick button').forEach(b => {
  b.addEventListener('click', () => {
    const novo = Number(b.dataset.modo);
    if (novo === modoJoystick) return;
    abrirAvisoModo(novo);
  });
});

function abrirAvisoModo(novo) {
  const m = MODOS[novo];
  const fundo = document.createElement('div');
  fundo.className = 'dialogo-fundo aberto aviso-modo';
  fundo.innerHTML =
    '<div class="dialogo largo">' +
      '<div class="marca-aviso">!</div>' +
      '<h3>Mudar para o Modo ' + novo + '?</h3>' +
      '<p class="texto-aviso">Mudar o modo do joystick de controle altera a forma como a aeronave é operada. ' +
        'Escolher um modo de controle com o qual você não está familiarizado pode causar a queda da aeronave. Tenha cuidado</p>' +
      '<div class="cartoes-joystick">' + cartaoPino('Pino esquerdo', m.esq) + cartaoPino('Pino direito', m.dir) + '</div>' +
      '<div class="botoes-dialogo"><button class="cancelar">Cancelar(R2)</button>' +
      '<button class="verde vermelho">Alterar(R3)</button></div>' +
    '</div>';
  painelConfig.appendChild(fundo);
  fundo.querySelector('.cancelar').addEventListener('click', () => fundo.remove());
  fundo.querySelector('.verde').addEventListener('click', () => {
    modoJoystick = novo;
    $$c('.modos-joystick button').forEach(o => o.classList.toggle('ativa', Number(o.dataset.modo) === novo));
    $c('#cartoes-joystick').innerHTML = joysticksHTML(novo);
    fundo.remove();
  });
}
