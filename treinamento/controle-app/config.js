/* ==========================================================================
   Engrenagem (SettingUIDialog): painel da direita com menu de 7 páginas.
   Textos e valores das gravações (com e sem drone conectado).
   ========================================================================== */
"use strict";

var ICONES_CFG = {
  aeronave: '<svg viewBox="0 0 24 24"><path d="M3.4 12.6 20.6 4.6 12.6 20.6l-2-7z" fill="currentColor"/></svg>',
  pulverizacao: '<svg viewBox="0 0 24 24"><rect x="5" y="4.4" width="14" height="3.4" rx="1.2" fill="currentColor"/><path d="M12 2.2v2.2" stroke="currentColor" stroke-width="1.8"/><g fill="currentColor"><circle cx="7" cy="11" r="1"/><circle cx="10" cy="12.4" r="1"/><circle cx="13" cy="11" r="1"/><circle cx="16" cy="12.4" r="1"/><circle cx="8.6" cy="15" r="1"/><circle cx="11.6" cy="16.6" r="1"/><circle cx="14.6" cy="15" r="1"/><circle cx="10" cy="19.4" r="1"/><circle cx="13.4" cy="19.4" r="1"/></g></svg>',
  controle: '<svg viewBox="0 0 24 24"><rect x="2.4" y="7" width="19.2" height="12.6" rx="2.6" fill="currentColor"/><circle cx="7.4" cy="11.4" r="1.8" fill="#fff"/><circle cx="16.6" cy="11.4" r="1.8" fill="#fff"/><path d="M6.6 7 4.6 3.2M17.4 7l2-3.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  sensor: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 5 6 15h12z" fill="#fff"/></svg>',
  rtk: '<svg viewBox="0 0 24 24"><rect x="1.6" y="6.4" width="20.8" height="11.2" rx="2.4" fill="currentColor"/><text x="12" y="15.4" text-anchor="middle" font-size="7.4" font-weight="700" fill="#fff" font-family="Roboto">RTK</text></svg>',
  bateria: '<svg viewBox="0 0 24 24"><rect x="6.4" y="4.4" width="11.2" height="16.4" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="9.6" y="2.2" width="4.8" height="2.4" rx="1" fill="currentColor"/><path d="M12.6 8.4 8.8 14h3.2l-1 4.4L16 12.4h-3.4z" fill="currentColor"/></svg>',
  aovivo: '<svg viewBox="0 0 24 24"><rect x="1.6" y="6.4" width="20.8" height="11.2" rx="2.4" fill="currentColor"/><text x="12" y="15.4" text-anchor="middle" font-size="7.6" font-weight="700" fill="#fff" font-family="Roboto">HD</text></svg>'
};
var NOMES_CFG = { aeronave: "Aeronave", pulverizacao: "Pulveriz", controle: "Controle", sensor: "Sensor", rtk: "RTK", bateria: "Bateria", aovivo: "Ao vivo" };

var DIAG = {
  rth: '<svg viewBox="0 0 240 150"><path d="M58 104V44h126v60" fill="none" stroke="#00ad53" stroke-width="5" stroke-dasharray="14 8"/><path d="M58 40l-10 14h20zM184 108l-10-14h20z" fill="#00ad53"/><path d="M8 116l40-14-40-14 10 14z" fill="#1f2224"/><circle cx="184" cy="122" r="20" fill="#00ad53"/><text x="184" y="131" text-anchor="middle" font-size="24" font-weight="700" fill="#fff" font-family="Roboto">H</text></svg>',
  pesos: '<svg viewBox="0 0 240 150"><rect x="70" y="30" width="100" height="90" rx="12" fill="#3c4245"/><g stroke="#8d9296" stroke-width="10" stroke-linecap="round"><path d="M70 40 24 16M170 40l46-24M70 110 24 134M170 110l46 24"/></g><g fill="none" stroke="#00ad53" stroke-width="5"><circle cx="85" cy="75" r="12"/><circle cx="155" cy="75" r="12"/></g></svg>',
  frenagem: '<svg viewBox="0 0 240 150"><path d="M40 30v90M200 30v90" stroke="#1f2224" stroke-width="10" stroke-linecap="round"/><circle cx="120" cy="75" r="44" fill="none" stroke="#bfe3c8" stroke-width="5"/><circle cx="120" cy="75" r="28" fill="none" stroke="#7fcf96" stroke-width="5"/><path d="M120 58l14 30h-28z" fill="#00ad53"/></svg>',
  desvio: '<svg viewBox="0 0 600 160"><path d="M0 150h600" stroke="#c9cbcd" stroke-width="3"/><path d="M280 150 340 100l60 30 80-40 60 60z" fill="#e2e3e4"/><rect x="300" y="40" width="14" height="110" fill="#2f3336"/><g transform="translate(180 70)"><rect x="-26" y="-8" width="52" height="16" rx="5" fill="#2f3336"/><path d="M-40 -10h26M14 -10h26" stroke="#2f3336" stroke-width="5"/></g><path d="M250 50q60-60 120 0" fill="none" stroke="#00ad53" stroke-width="7"/><path d="m370 50 4-22 16 16z" fill="#00ad53"/></svg>',
  rota1: '<svg viewBox="0 0 220 110"><path d="M90 26h18v60h18V26h18v60h18V26h18" fill="none" stroke="#f0a63a" stroke-width="5"/><circle cx="92" cy="26" r="7" fill="#e8442e"/><path d="M30 44 52 54 30 64z" fill="#1f2224"/><path d="M56 56 86 30" fill="none" stroke="#3ab54a" stroke-width="4" stroke-dasharray="7 5"/></svg>',
  rota2: '<svg viewBox="0 0 220 110"><path d="M90 86h18V26h18v60h18V26h18v60h18" fill="none" stroke="#f0a63a" stroke-width="5"/><circle cx="92" cy="86" r="7" fill="#e8442e"/><path d="M30 76 52 86 30 96z" fill="#1f2224"/><path d="M56 86h30" fill="none" stroke="#3ab54a" stroke-width="4" stroke-dasharray="7 5"/></svg>',
  tanque: '<svg viewBox="0 0 220 130"><rect x="4" y="4" width="212" height="122" fill="none" stroke="#d8d8d7" stroke-width="3"/><path d="M36 104V30h30v74h30V30h30v74h30V30h30v74" fill="none" stroke="#f0c419" stroke-width="5"/><circle cx="36" cy="108" r="7" fill="#3ab54a"/><path d="M36 82V40" stroke="#e8442e" stroke-width="5"/><path d="M36 32l-8 13h16z" fill="#e8442e"/></svg>',
  faixas: '<svg viewBox="0 0 220 130"><rect width="220" height="130" fill="#6f8f4f"/><g stroke="#fff" stroke-width="2.6" stroke-dasharray="8 8"><path d="M0 26h220M0 52h220M0 78h220M0 104h220"/></g><path d="M128 52 98 65l30 13-7-13z" fill="#e8442e" stroke="#fff" stroke-width="2.6"/></svg>'
};

function conectadoCfg() { return APP.conectado; }

/* páginas: cada bloco vira HTML; "drone" = só liberado com drone conectado */
var PAG = {
  aeronave: { titulo: "Configurações da aeronave", blocos: [
    { t: "sec", x: "Roteamento de conexão e RTH" },
    { t: "faixa", rot: "Roteamento de conexão e velocidade RTH", p: "rthVel", min: 10.8, max: 36, passo: .2, un: "km/h", casas: 1 },
    { t: "faixa", rot: "Roteamento de conexão e altitude RTH", p: "rthAlt", min: 3, max: 30, passo: 1, un: "m", casas: 0 },
    { t: "nota", x: 'A aeronave subirá a uma altitude predefinida durante a decolagem e antes de retornar à base<br>O roteamento de conexão/altitude RTH devem ser inferiores a <span class="verde">Altitude de voo máx.</span>', d: "rth" },
    { t: "tit", x: "Atualizar Ponto de origem" },
    { t: "grupo", ops: ["Definir localização da aeronave", "Definir localização do controle remoto"], ativo: -1, drone: true, acao: "origem" },
    { t: "sec", x: "Resposta da aeronave" },
    { t: "tit", x: "Tanque vazio" }, { t: "grupo", ops: ["Voo estacionário", "Subir 3 m", "Retorno à base (RTH)"], ativo: 2, drone: true },
    { t: "desc", x: "Disponível nos modos Rota, Árvores e Manual Plus (M+)" },
    { t: "tit", x: "Tarefa concluída" }, { t: "grupo", ops: ["Voo estacionário", "Retorno à base (RTH)"], ativo: 1, drone: true },
    { t: "desc", x: "Disponível nos modos Rota, Árvores e Mapeamento" },
    { t: "tit", x: "Sinal do CR perdido" }, { t: "grupo", ops: ["Voo estacionário", "Aterrissagem", "Retorno à base (RTH)"], ativo: 2, drone: true },
    { t: "chave", rot: "Continuar tarefa em sinal perdido", lig: false },
    { t: "sec", x: "Outras configurações" },
    { t: "tit", x: "Holofote" }, { t: "grupo", ops: ["Automático", "Desl.", "Lig."], ativo: 0, drone: true },
    { t: "desc", x: "Fornece iluminação para sensoriamento de visão e operação da tarefa à noite" },
    { t: "link", rot: "Otimização de voo", sub: "otimizacao" }, { t: "link", rot: "Alerta e assistência", sub: "alerta" },
    { t: "link", rot: "Proteção de voo", sub: "protecao" }, { t: "link", rot: "Calibração do sensor", sub: "calibracao" },
    { t: "verde", x: "Vinculando" }, { t: "verde", x: "Restaurar tarefa não concluída", desl: true }
  ], subs: {
    otimizacao: { titulo: "Otimização de voo", blocos: [
      { t: "chave", rot: "Ajuste automático do espaçamento da rota", lig: true, desc: "Otimiza a cobertura de pulverização e dispersão nas bordas do campo" },
      { t: "chave", rot: "Resumo inteligente", lig: true, desc: "Melhora a eficiência do voo reduzindo a distância para onde a aeronave voa com carga útil total antes de retomar a operação" },
      { t: "escolha", ops: [["Desabilitado", "Retomar tarefa do último ponto de interrupção registrado", "rota1"], ["Habilitado", "Retomar tarefa da trajetória mais próxima", "rota2"]], ativo: 0 },
      { t: "chave", rot: "Exibir ponto de tanque vazio", lig: true, desc: "Disponível apenas no modo Rota. Quando ativado, o sistema calculará e exibirá automaticamente a localização do ponto de tanque vazio na rota do voo", d: "tanque" },
      { t: "chave", rot: "Retificar compensação de calibração", lig: true, desc: "Habilite este recurso para corrigir quaisquer deslocamentos criados pela aplicação de campo com pontos de calibração (habilitado automaticamente no modo Árvore de fruta)" }] },
    alerta: { titulo: "Alerta e assistência", blocos: [
      { t: "chave", rot: "Visualização da rota (M+)", lig: true },
      { t: "nota", x: "Quando esta função estiver ativada junto ao modo M+, a rota de voo visualizada será exibida em ambos os lados da aeronave com base no espaçamento de rota definido", d: "faixas" }] },
    protecao: { titulo: "Proteção de voo", blocos: [
      { t: "faixa", rot: "Distância máxima de voo", local: "distMax", v: 2000, min: 50, max: 2000, passo: 10, un: "m", casas: 0, enviar: "xgDistMax" },
      { t: "faixa", rot: "Altitude de voo máx.", local: "altMax", v: 100, min: 15, max: 100, passo: 1, un: "m", casas: 0, enviar: "xgAltMax" },
      { t: "chave", rot: "Detecção de travamento do braço da estrutura", lig: true, drone: true, desc: "Verifica automaticamente se as travas do braço da estrutura estão presas com segurança e proíbe o voo se os braços não estiverem presos" },
      { t: "chave", rot: "Detecção de reabastecimento", lig: true, drone: true, desc: "Detecta automaticamente se os materiais de pulverização ou dispersão estão sendo adicionados à aeronave. Decolagem não permitida durante o reabastecimento" },
      { t: "chave", rot: "Verificação de segurança na aterrissagem", lig: false, drone: true, desc: "Solicita confirmação de segurança quando a aeronave pousa automaticamente. Pode ser desativada quando o posicionamento RTK estiver disponível" },
      { t: "chave", rot: "Permitir Modo Atitude (ATTI)", lig: false, atti: true, desc: "O modo Attitude será ativado quando a alternância do modo de voo do CR for alterada para o modo S. Voe com cuidado" },
      { t: "link", rot: "Desbloquear Zona GEO", sub: "geo" }] },
    geo: { titulo: "Desbloquear Zona GEO", volta: "protecao", blocos: [{ t: "geo" }] },
    calibracao: { titulo: "Calibração do sensor", blocos: [
      { t: "acao", rot: "Calibração do sensor de atitude (IMU)", bt: "Calibrar", drone: true },
      { t: "dados", itens: [["0.01", "Erro de deslocamento zero do acelerômetro"], ["0.01", "Erro de deslocamento zero do giroscópio"]] },
      { t: "acao", rot: "Calibração do gimbal", bt: "Calibrar" },
      { t: "desc", x: '<b class="marca">Erro de movimento do gimbal</b>Calibre o gimbal quando a atitude do gimbal for imprecisa' },
      { t: "tabela", cols: ["Nº do motor.", "Velocidade de rotação (RPM)", "Torque de orientação (%)"], linhas: [["M1", "-", "-"], ["M2", "-", "-"], ["M3", "-", "-"], ["M4", "-", "-"]] }] }
  } },
  pulverizacao: { titulo: "Configurações do sistema de pulverização", blocos: [
    { t: "sec", x: "Configurações da tarefa" },
    { t: "chave", rot: "Sistemas de pulverização e distribuição", p: "sistemas", lig: true, drone: true, desc: "Depois que os sistemas de pulverização e distribuição forem desligados, a aeronave não poderá pulverizar ou distribuir. As tarefas de rota de voo ainda podem ser executadas" },
    { t: "chave", rot: "Pulverização atomizada", lig: true, drone: true, desc: "Quando desativado, os motores centrífugos param de funcionar durante a pulverização. Os sprinklers pulverizarão jatos líquidos sem atomização" },
    { t: "sec", x: "Gerenciamento e calibração" },
    { t: "tit", x: "Dados em tempo real do sistema de pulverização" },
    { t: "dadosVivos" },
    { t: "bomba" },
    { t: "acao", rot: "Mangueira limpa", bt: "Limpar", drone: true, desc: "Enxágue a mangueira com água doce para remover os resíduos. Os aspersores são desativados durante a limpeza" },
    { t: "acao", rot: "Liberar ar preso", bt: "Iniciar", drone: true, desc: "A ativação desse recurso libera o ar preso nas mangueiras da bomba do pulverizador. Pressione e mantenha pressionado o botão Pulverização para ativar rapidamente esse recurso quando estiver na visualização de tarefas." },
    { t: "sel", rot: "Alerta de erro do fluxômetro", v: "10%", ops: ["Não exibir", "5%", "10%", "15%", "20%"], semDrone: "Não exibir", desc: "O controle remoto alertará o usuário quando uma grande diferença entre o nível de fluxo padrão e o nível de fluxo real for detectada no fluxômetro" },
    { t: "tit", x: "Tipo de disco giratório" },
    { t: "escolha", col: true, ops: [["Camada dupla (padrão)", "Adequado para líquidos em geral"], ["Camada única", "Adequado para líquidos de alta viscosidade ou pó pulverulento"]], ativo: 0 },
    { t: "desc", x: '<b class="marca">Observação após a substituição</b>Selecione o tipo de disco giratório que corresponde à sua configuração atual. Caso contrário, as configurações de tamanho da gotícula podem ser imprecisas' },
    { t: "link", rot: "Calibração do sistema de pulverização", sub: "calpulv" }
  ], subs: {
    calpulv: { titulo: "Calibração do sistema de pulverização", blocos: [
      { t: "acao", rot: "Calibração do fluxômetro", bt: "Calibrar", drone: true, desc: '<b class="marca">Vazão imprecisa</b>Calibre o medidor de vazão no solo quando a leitura do fluxo for imprecisa' },
      { t: "acao", rot: "Redefinição de fábrica do medidor de vazão", bt: "Restaurar", drone: true, desc: "Restaurar o medidor de vazão para as configurações de fábrica quando a leitura da vazão permanecer imprecisa após a calibração" },
      { t: "acao", rot: "Calibração da bomba", bt: "Calibrar", drone: true, desc: '<b class="marca">Pulverização imprecisa</b><b class="marca">Após substituir a bomba ou o aspersor</b>Calibre a bomba no solo quando a taxa de pulverização real for diferente da taxa de aplicação definida ou após a substituição de bombas ou aspersores. Recomenda-se calibrar o medidor de vazão antes de calibrar a bomba' },
      { t: "acao", rot: "Calibração do sensor de peso (Tara)", bt: "Calibrar", drone: true, desc: '<b class="marca">Redefinir para zero</b>Execute a calibração da tara e redefina a exibição do peso para 0' },
      { t: "sel", rot: "Coeficientes do sensor de peso", v: "7322-7232-7527 ✎", ops: [], semDrone: "✎" },
      { t: "nota", x: "Insira os valores dos coeficientes gravados nos sensores de peso nos campos a seguir. Após a inserção, todos os parâmetros de peso serão recalculados. Tenha cuidado ao realizar esta operação", d: "pesos" }] }
  } },
  controle: { titulo: "Configurações do CR", blocos: [
    { t: "tit", x: "Modo do joystick" }, { t: "modos" }, { t: "pinos" },
    { t: "acao", rot: "Calibração do controle remoto", bt: "Calibrar" }, { t: "calcr" },
    { t: "link", rot: "Visão geral dos botões", sub: "botoes" },
    { t: "tit", x: "Botão personalizado" }, { t: "personal" },
    /* a conta do treinamento usada neste controle (conta.js) */
    { t: "link", rot: "Conta do Treinamento", sub: "cadastro" }
  ], subs: { botoes: { titulo: "Visão geral dos botões", blocos: [{ t: "botoes" }] },
             cadastro: { titulo: "Conta do Treinamento", blocos: [{ t: "cadastro" }] } } },
  sensor: { titulo: "Configurações do sensor", blocos: [
    { t: "chave", rot: "desvio de obstáculos multidirecional", p: "desvio", lig: true, desc: "Quando ativada, a aeronave detecta obstáculos na horizontal dentro de 16,0 m e acima e abaixo dentro de 5,0 m, freando para evitar colisões. A detecção para baixo é usada para auxiliar no acompanhamento do terreno e na estabilização da altitude. A eficácia da detecção pode diferir em diferentes ambientes ou dependendo do tipo e tamanho do obstáculo" },
    { t: "tit", x: "Cenário" }, { t: "cenario" },
    { t: "chave", rot: "Estabilização da altitude", p: "estab", lig: true, desc: "A aeronave segue o terreno automaticamente e ajusta a altitude durante o voo com base na altura definida acima das culturas" },
    { t: "chave", rot: "Desvio de obstáculos", p: "contornar", lig: true, desc: "Quando habilitado, a aeronave tentará desviar automaticamente dos obstáculos. Mova os pinos de controle para cancelar o desvio<br>Quando ativada, a altura acima dos cultivos é limitada entre 2,5 e 8,0 m para maior segurança de voo" },
    { t: "desvioPref" },
    { t: "link", rot: "Configurações de radar", sub: "radar" }
  ], subs: { radar: { titulo: "Configurações avançadas", blocos: [
    { t: "tit", x: "Sensibilidade do radar" }, { t: "grupo", ops: ["Alta", "Média"], ativo: 0, enviar: "xgRadarMedia" },
    { t: "desc", x: 'A sensibilidade alta permite que o radar detecte objetos pequenos<br>A sensibilidade média ajuda a minimizar alarmes falsos quando há metais ou outros refletores bons nas proximidades, como contêineres, torres de alta tensão, painéis solares e veículos <span style="color:#f08a24">Voe em aeronaves com velocidade abaixo de 18.0km/h</span> quando a sensibilidade do radar estiver definida como média, para aumentar a segurança do voo' },
    { t: "faixa", rot: "Distância de frenagem para obstáculo lateral", local: "frenagem", v: 6, min: 4, max: 6, passo: .1, un: "m", casas: 1, enviar: "xgFrenagem" },
    { t: "nota", x: "Ajuste a distância a partir da qual a aeronave freia para evitar obstáculos em ambos os lados", d: "frenagem" },
    { t: "chave", rot: "Desvio de obstáculos aprimorado", lig: true, aprimorado: true, desc: "Quando ativada, a capacidade da aeronave de evitar pequenos obstáculos, como galhos de árvores, é aprimorada. Desative quando ocorrerem erros de evasão com frequência durante o voo" }] } } },
  rtk: { titulo: "Configurações RTK", blocos: [{ t: "rtk" }] },
  bateria: { titulo: "Bateria Inteligente", blocos: [
    { t: "lt", x: "Dados da bateria em tempo real", d: "Unidade: Volt" }, { t: "celulas" }, { t: "dadosBat" },
    { t: "sec", x: "Com bateria fraca" },
    { t: "tit", x: '<i style="display:inline-block;width:12px;height:36px;background:#f0a63a;border-radius:3px;vertical-align:middle;margin-right:12px"></i>Com bateria fraca (abaixo de <span style="color:#f08a24">20%</span>)' },
    { t: "grupo", ops: ["Advertência", "RTH"], ativo: 1, drone: true },
    { t: "desc", x: "Quando o nível da bateria estiver baixo, o controle remoto vibrará para alertar ou a aeronave retornará automaticamente à base" },
    { t: "lt", x: '<i style="display:inline-block;width:12px;height:36px;background:#e8442e;border-radius:3px;vertical-align:middle;margin-right:12px"></i>Bateria muito fraca (abaixo de <span style="color:#f08a24">5%</span>)', d: "Aterrissagem" },
    { t: "desc", x: "Quando o nível da bateria estiver muito baixo, o controle remoto vibrará para alertar e a aeronave retornará automaticamente à base" },
    { t: "tit", x: "Limites de bateria fraca e muito fraca" }, { t: "faixaDupla" },
    { t: "lt", x: "Número de série da bateria", d: "N/A" }
  ] },
  aovivo: { titulo: "Configurações da transmissão de imagem", blocos: [{ t: "link", rot: "Configurações do Canal de Transmissão Direta", sub: "canal" }],
    subs: { canal: { titulo: "Configurações do Canal de Transmissão Direta", blocos: [
      { t: "tit", x: "Modo canal" }, { t: "grupo", ops: ["Automático", "Personalizado"], ativo: 0, drone: true },
      { t: "sel", rot: "Frequência", v: "2.4GHz", ops: ["2.4GHz", "5.8GHz"], semDrone: "" },
      { t: "canal" },
      { t: "sel", rot: "Largura de banda", v: "20MHz", ops: ["10MHz", "20MHz", "40MHz"], semDrone: "" },
      { t: "sel", rot: "Canal", v: "Automático", ops: ["Automático"], semDrone: "" }] } } }
};

var CFG = { pag: "aeronave", sub: null, local: lerGuardado("cfgLocal", {}), modoJoy: lerGuardado("modoJoy", 2) };

function enviarAjuste(chave, valor) { var v = {}; v[chave] = valor; cmd("p", { v: v }); }

/* ------------------------------------------------------- blocos -> HTML */
function bFaixa(b) {
  var val = b.p ? M.P[b.p] : (CFG.local[b.local] != null ? CFG.local[b.local] : b.v);
  var pct = (val - b.min) / (b.max - b.min) * 100;
  var d = el("div", "cfg-bloco faixa-pad",
    '<div class="cfg-lin"><span class="cfg-tit">' + b.rot + '</span><span class="cfg-val">' + virg(val, b.casas) + "<i>" + b.un + "</i></span></div>" +
    '<div class="faixa"><button data-f="-1"><svg viewBox="0 0 48 48"><path d="M10 24h28" stroke="#2b2e31" stroke-width="4" stroke-linecap="round"/></svg></button>' +
    '<div class="trilho"><i class="base"></i><i class="cheio" style="width:' + pct + '%"></i><i class="bola" style="left:' + pct + '%"></i>' +
    '<span class="lim">' + b.min + '</span><span class="lim d">' + b.max + "</span></div>" +
    '<button data-f="1">' + ic("i-mais") + "</button></div>");
  var aplicar = function (nv) {
    nv = Math.max(b.min, Math.min(b.max, Math.round(nv / b.passo) * b.passo));
    if (b.p === "rthVel" && nv > 25.2 && val <= 25.2) {
      dialogo({ icone: "alerta", titulo: "Definir a velocidade de voo acima de 25,2 km/h pode afetar a segurança do voo. Continuar?",
        botoes: [{ t: "Cancelar(R2)" }, { t: "OK(R3)", cls: "verde", fn: function () { gravarF(nv); } }] });
      return;
    }
    gravarF(nv);
  };
  var gravarF = function (nv) {
    val = nv;
    if (b.p) { M.P[b.p] = nv; salvarP(); enviarP(); }
    else { CFG.local[b.local] = nv; guardar("cfgLocal", CFG.local); if (b.enviar) enviarAjuste(b.enviar, nv); }
    var p = (nv - b.min) / (b.max - b.min) * 100;
    $(".cheio", d).style.width = p + "%"; $(".bola", d).style.left = p + "%";
    $(".cfg-val", d).innerHTML = virg(nv, b.casas) + "<i>" + b.un + "</i>";
  };
  $$("[data-f]", d).forEach(function (x) { x.addEventListener("click", function () { aplicar(val + Number(x.dataset.f) * b.passo); }); });
  var tr = $(".trilho", d);
  tr.addEventListener("pointerdown", function (e) {
    tr.setPointerCapture(e.pointerId);
    var mover = function (ev) { var r = tr.getBoundingClientRect(); aplicar(b.min + (ev.clientX - r.left) / r.width * (b.max - b.min)); };
    mover(e);
    tr.onpointermove = mover;
    tr.onpointerup = function () { tr.onpointermove = null; };
  });
  return d;
}
function bChave(b) {
  var lig = b.p ? !!M.P[b.p] : (CFG.local[b.rot] != null ? CFG.local[b.rot] : b.lig);
  var desl = b.drone && !conectadoCfg();
  var d = el("div", "cfg-bloco", '<div class="cfg-lin"><span class="cfg-tit">' + b.rot + '</span><button class="chave' + (lig ? " lig" : "") + '"' + (desl ? ' style="opacity:.45"' : "") + "></button></div>" +
    (b.desc ? '<p class="cfg-desc">' + b.desc + "</p>" : "") + (b.d ? '<div class="nota" style="justify-content:center">' + DIAG[b.d] + "</div>" : ""));
  var ch = $(".chave", d);
  ch.addEventListener("click", function () {
    if (desl) return;
    var novo = !ch.classList.contains("lig");
    var gravar = function () {
      ch.classList.toggle("lig", novo);
      if (b.p) {
        M.P[b.p] = novo; if (b.p === "contornar" && novo && M.P.altura > 8) M.P.altura = 8;
        salvarP(); enviarP();
      } else { CFG.local[b.rot] = novo; guardar("cfgLocal", CFG.local); }
    };
    if (b.p === "contornar" && novo) {
      return dialogo({ icone: "alerta", titulo: "Habilitando o desvio de obstáculos",
        itens: [{ t: "Evite usar em clima chuvoso ou quando houver linhas de energia, galhos de árvores ou outros pequenos obstáculos", verm: true },
          { t: "Mantenha os sensores de visão binocular limpos para evitar obstáculos com mais eficiência" }],
        botoes: [{ t: "Agora não(R2)" }, { t: "Habilitar(R3)", cls: "verde", fn: gravar }] });
    }
    if (b.atti && novo) {
      return dialogo({ icone: "alerta", titulo: "Ativar modo Atitude?", texto: "Quando ativada, a aeronave não consegue pairar de forma estável e é difícil de ser controlada manualmente, o que pode representar um risco grave para a segurança do voo. Tenha cuidado",
        botoes: [{ t: "Cancelar(R2)" }, { t: "Habilitar(R3)", cls: "verm", fn: gravar }] });
    }
    if (b.aprimorado && !novo) {
      return dialogo({ icone: "alerta", titulo: "Quando desativada, a capacidade da aeronave de detectar pequenos obstáculos, como galhos de árvore, diminui.",
        botoes: [{ t: "Cancelar(R2)" }, { t: "Desativar(R3)", cls: "verm", fn: gravar }] });
    }
    gravar();
  });
  return d;
}
function bGrupo(b) {
  var desl = b.drone && !conectadoCfg();
  var chaveL = "g:" + b.ops.join("|");
  var ativo = desl ? -1 : (CFG.local[chaveL] != null ? CFG.local[chaveL] : b.ativo);
  var g = el("div", "grupo" + (desl ? " desl" : ""));
  b.ops.forEach(function (o, i) {
    var bt = botao(i === ativo ? "ativo" : "", o, function () {
      if (desl) return;
      if (b.acao === "origem") { cmd("origem", { v: i === 0 ? "drone" : "rc" }); toast("Ponto de origem atualizado", "ok"); return; }
      CFG.local[chaveL] = i; guardar("cfgLocal", CFG.local);
      $$("button", g).forEach(function (x) { x.classList.toggle("ativo", x === bt); });
      if (b.enviar) enviarAjuste(b.enviar, i === 1);
    });
    g.appendChild(bt);
  });
  var d = el("div", "", "");
  d.appendChild(g);
  return d;
}
function bSel(b) {
  var desl = !conectadoCfg();
  var v = desl ? b.semDrone : (CFG.local["s:" + b.rot] || b.v);
  var d = el("div", "cfg-bloco", '<div class="cfg-lin"><span class="cfg-tit">' + b.rot + '</span><button class="sel-c' + (desl ? " desl" : "") + '"><span>' + v + "</span>" + (b.ops.length ? ic("i-abaixo") : "") + "</button></div>" +
    (b.desc ? '<p class="cfg-desc">' + b.desc + "</p>" : ""));
  var s = $(".sel-c", d);
  s.addEventListener("click", function (e) {
    e.stopPropagation();
    if (desl || !b.ops.length) return;
    listaSuspensa(s, b.ops, v, function (nv) { v = nv; CFG.local["s:" + b.rot] = nv; guardar("cfgLocal", CFG.local); s.firstChild.textContent = nv; });
  });
  return d;
}
function bAcao(b) {
  var desl = b.drone && !conectadoCfg();
  var d = el("div", "cfg-bloco", '<div class="cfg-lin"><span class="cfg-tit">' + b.rot + '</span><button class="bt-verde-c' + (desl ? " desl" : "") + '">' + b.bt + "</button></div>" +
    (b.desc ? '<p class="cfg-desc">' + b.desc + "</p>" : ""));
  $(".bt-verde-c", d).addEventListener("click", function () {
    if (desl) return;
    if (b.rot === "Calibração do controle remoto") return calibrarCR();
    dialogo({ icone: "alerta", titulo: b.rot, texto: "Mantenha a aeronave em solo plano durante o processo.", botoes: [{ t: "Cancelar(R2)" }, { t: b.bt + "(R3)", cls: "verde", fn: function () { toast(b.rot + " concluída", "ok"); } }] });
  });
  return d;
}

/* Conta do Treinamento (06/10/2026): o controle entra com o e-mail e a senha
   da conta do site (conta.js) e conecta no simulador aberto nessa mesma conta.
   O número de cadastro antigo não é mais usado. */
function bCadastro() {
  var d = el("div", "cfg-cadastro",
    '<div class="cfg-lin"><span class="cfg-tit">Conta</span><span class="cad-email" style="font-size:34px;color:#20242a"></span></div>' +
    '<div class="cfg-lin"><span class="cfg-tit">Status</span><span class="cad-est" style="font-size:32px;color:#8a8f94">Conferindo…</span></div>' +
    '<p class="cfg-desc">O controle usa a mesma conta do site do treinamento. Abra o simulador no computador, na TV ou no tablet ' +
    'com essa conta: a aeronave conecta neste controle.</p>' +
    '<button class="cfg-verde cad-sair" style="color:#e5372e">Sair da conta</button>');
  var virtual = !(window.CONTA_CONTROLE && CONTA_CONTROLE.ativo);
  function atualizar() {
    if (!d.isConnected) return;
    var logado = !virtual && CONTA_CONTROLE.logado();
    $(".cad-email", d).textContent = virtual ? "Conta deste navegador" : logado ? CONTA_CONTROLE.email() : "Nenhuma";
    var est = $(".cad-est", d);
    est.textContent = virtual ? "Controle virtual" : logado ? "Controle liberado" : "Entre com a conta do treinamento";
    est.style.color = virtual || logado ? "#09c25a" : "#e8901a";
    $(".cad-sair", d).style.display = logado ? "block" : "none";
    setTimeout(atualizar, 2000);
  }
  $(".cad-sair", d).addEventListener("click", function () { if (!virtual) CONTA_CONTROLE.sair(); });
  setTimeout(atualizar, 0);
  return d;
}

function blocoCfg(b) {
  switch (b.t) {
    case "sec": return el("p", "cfg-sec", b.x);
    case "tit": return el("div", "cfg-tit", b.x);
    case "desc": return el("p", "cfg-desc", b.x);
    case "lt": return el("div", "cfg-lin", '<span class="cfg-tit">' + b.x + '</span><span style="font-size:32px;color:#8a8f94">' + (b.d || "") + "</span>");
    case "faixa": return bFaixa(b);
    case "chave": return bChave(b);
    case "grupo": return bGrupo(b);
    case "sel": return bSel(b);
    case "acao": return bAcao(b);
    case "nota": return el("div", "nota", "<p>" + b.x + "</p>" + (b.d ? DIAG[b.d] : ""));
    case "verde": return el("button", "cfg-verde" + (b.desl ? " desl" : ""), b.x);
    case "cadastro": return bCadastro();
    case "link": {
      var l = el("button", "cfg-link", "<span>" + b.rot + "</span>" + ic("i-direita"));
      l.addEventListener("click", function () { CFG.sub = b.sub; montarCfg(); });
      return l;
    }
    case "escolha": {
      var chaveE = "e:" + b.ops[0][0], at = CFG.local[chaveE] != null ? CFG.local[chaveE] : b.ativo;
      var e = el("div", "escolha" + (b.col ? " col" : ""));
      b.ops.forEach(function (o, i) {
        var bt = botao(i === at ? "ativo" : "", '<span class="r"></span><span class="t"><b>' + o[0] + "</b><i>" + o[1] + "</i></span>" + (o[2] ? DIAG[o[2]] : ""), function () {
          CFG.local[chaveE] = i; guardar("cfgLocal", CFG.local);
          $$("button", e).forEach(function (x) { x.classList.toggle("ativo", x === bt); });
        });
        e.appendChild(bt);
      });
      return e;
    }
    case "dados": return el("div", "dados", b.itens.map(function (i) { return "<div><b>" + i[0] + "</b><span>" + i[1] + "</span></div>"; }).join(""));
    case "dadosVivos": {
      var v = APP.E && APP.E.v || {}, con = conectadoCfg();
      return el("div", "dados", [[con ? num(v.vazao) + "<i>L/Min</i>" : "--<i>L/Min</i>", "Quociente de vazão"],
        [con ? num(v.calda, 2) + "<i>l</i>" : "--<i>l</i>", "Volume pulverizado"],
        ['<span class="verde">' + (con ? num(v.tanque, 2) : "--") + "</span><i>l</i> ✎", "Carga líquida restante"],
        [con ? num((v.tanque || 0) * 1, 1) + "<i>kg</i>" : "--<i>kg</i>", "Carga no tanque"], [con ? (v.tanque > .05 ? "Flutuando" : "Afundou") : "--", "Status de flutuação"]]
        .map(function (i) { return "<div><b>" + i[0] + "</b><span>" + i[1] + "</span></div>"; }).join(""));
    }
    case "bomba": {
      var c = conectadoCfg() ? "0" : "--", f = conectadoCfg() ? "0.0" : "--";
      return el("div", "tabela", '<div class="l cab" style="--cols:2"><span><b>Bomba</b><br>Os números da bomba estão localizados em ambos os lados no fundo do tanque</span><span><b>Bico centrífugo</b><br>Os aspersores são numerados da mesma forma que os braços da aeronave em que estão instalados</span></div>' +
        '<div class="l cab" style="--cols:5"><span>Nº</span><span>Velocidade rotacional<br>(rev/min)</span><span>Fluxo<br>(L/Min)</span><span>Nº</span><span>Velocidade rotacional<br>(rev/min)</span></div>' +
        '<div class="l" style="--cols:5"><span>1</span><span>' + c + "</span><span>" + f + "</span><span>3</span><span>" + c + "</span></div>" +
        '<div class="l" style="--cols:5"><span>2</span><span>' + c + "</span><span>" + f + "</span><span>4</span><span>" + c + "</span></div>");
    }
    case "tabela":
      return el("div", "tabela", '<div class="l cab" style="--cols:' + b.cols.length + '">' + b.cols.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>" +
        b.linhas.map(function (l) { return '<div class="l" style="--cols:' + l.length + '">' + l.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>"; }).join(""));
    case "geo": {
      var g = el("div", "", '<div style="display:flex;align-items:center;gap:48px;border-bottom:1px solid #ececec"><button class="ativo-geo" style="height:96px;font-size:34px;color:#0ca35c;border-bottom:6px solid #00ad53">Licenças de desbloqueio de conta</button>' +
        '<button style="height:96px;font-size:34px">Licenças de desbloqueio da aeronave</button><button class="bt-verde-c" style="margin-left:auto;height:72px">Atualizar</button></div>' +
        '<div class="vazio" style="padding-top:240px">' + ic("i-documento") + "<b>Nenhuma licença disponível. Importar ou atualizar</b></div>");
      return g;
    }
    case "cenario": {
      var mapa = { "Planícies": "planicie", "Colina/Pomar": "montanha", "Acima da água": "agua" };
      var gr = el("div", "grupo");
      Object.keys(mapa).forEach(function (o) {
        var bt = botao(M.P.terreno === mapa[o] ? "ativo" : "", o, function () {
          M.P.terreno = mapa[o]; salvarP(); enviarP();
          $$("button", gr).forEach(function (x) { x.classList.toggle("ativo", x === bt); });
          var pref = document.getElementById("cfg-desvio-pref");
          if (pref) pref.style.display = mapa[o] === "montanha" ? "" : "none";
        });
        gr.appendChild(bt);
      });
      return gr;
    }
    case "desvioPref": {
      var dp = el("div", "nota", "", "");
      dp.style.flexDirection = "column";
      /* só aparece em Colina/Pomar; de fábrica, desvia por cima (vertical) primeiro */
      dp.id = "cfg-desvio-pref";
      dp.style.display = M.P.terreno === "montanha" ? "" : "none";
      var pv = CFG.local.desvioPref != null ? CFG.local.desvioPref : 100;
      dp.innerHTML = DIAG.desvio.replace("<svg", '<svg style="width:100%;height:160px"') + '<div style="display:flex;align-items:center;gap:24px"><button class="bt-icone" style="background:#e6e6e6;width:72px;height:72px" data-d="-10">−</button>' +
        '<input type="range" min="0" max="100" value="' + pv + '" style="flex:1;accent-color:#00ad53;height:48px"><button class="bt-icone" style="background:#e6e6e6;width:72px;height:72px" data-d="10">+</button></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:28px"><span>Desviar horizontalmente<br>primeiro</span><span style="text-align:right">Desviar verticalmente<br>primeiro</span></div>';
      var rg = $("input", dp);
      var mandar = function () { CFG.local.desvioPref = Number(rg.value); guardar("cfgLocal", CFG.local); enviarAjuste("xgDesvioPref", Number(rg.value)); };
      rg.addEventListener("change", mandar);
      $$("[data-d]", dp).forEach(function (x) { x.style.fontSize = "48px"; x.addEventListener("click", function () { rg.value = Number(rg.value) + Number(x.dataset.d); mandar(); }); });
      return dp;
    }
    case "modos": {
      var m = el("div", "modos-joy");
      [1, 2, 3].forEach(function (n) {
        m.appendChild(botao(n === CFG.modoJoy ? "ativo" : "", "Modo " + n, function () {
          if (n === CFG.modoJoy) return;
          var r = ROT_MODOS[n];
          dialogo({ icone: "alerta", largura: 1200, titulo: "Mudar para o Modo " + n + "?",
            texto: "Mudar o modo do joystick de controle altera a forma como a aeronave é operada. Escolher um modo de controle com o qual você não está familiarizado pode causar a queda da aeronave. Tenha cuidado",
            depois: function (d) { $(".conteudo", d).appendChild(pinosHTML(n)); },
            botoes: [{ t: "Cancelar(R2)" }, { t: "Alterar(R3)", cls: "verm", fn: function () {
              CFG.modoJoy = n; guardar("modoJoy", n); cmd("modo", { v: n }); montarCfg();
            } }] });
        }));
      });
      return m;
    }
    case "pinos": return pinosHTML(CFG.modoJoy);
    case "calcr":
      return el("div", "cal-cr", ["esquerdo", "direito"].map(function (l) {
        return '<div><div>Botão rotativo ' + l + '</div><div style="display:flex;justify-content:space-between;margin:12px 0;color:#8a8f94"><span>0%</span><span>0%</span></div>' +
          '<div>Pino ' + l + '</div><div style="height:120px;display:flex;align-items:center;justify-content:center;color:#8a8f94">0%</div></div>';
      }).join(""));
    case "personal": {
      var pe = el("div", "");
      [["L1", "Adicionar ponto"], ["L2", "Interruptor de holofote"], ["L3", "Estabilizador de inclinação para baixo/recentralização"],
        ["Para cima", "Indefinida"], ["Para baixo", "Indefinida"], ["Esquerda", "Indefinida"], ["Direita", "Indefinida"], ["Centro", "Indefinida"], ["C3", "Adicionar ponto"]]
        .forEach(function (x) {
          var v2 = CFG.local["b:" + x[0]] || x[1];
          var linha = el("div", "cfg-lin", '<span class="cfg-tit" style="text-align:right;padding-right:12px">' + x[0] + '</span><button class="sel-c" style="width:378px"><span style="text-align:left">' + v2 + "</span>" + ic("i-abaixo") + "</button>");
          linha.style.padding = "12px 0";
          var s2 = $(".sel-c", linha);
          s2.addEventListener("click", function (e) {
            e.stopPropagation();
            listaSuspensa(s2, ["Indefinida", "Interruptor de holofote", "Ativar/desativar desvio de obstáculos multidirecional", "Estabilizador de inclinação para baixo/recentralização",
              "Direção para a esquerda (M+)", "Direção para a direita (M+)", "Retorno (modo manual)", "Adicionar ponto", "Defina o Ponto A (Rota A-B)", "Defina o Ponto B (Rota A-B)"], v2,
              function (nv) { v2 = nv; CFG.local["b:" + x[0]] = nv; guardar("cfgLocal", CFG.local); s2.firstChild.textContent = nv; });
          });
          pe.appendChild(linha);
        });
      return pe;
    }
    case "botoes":
      return el("div", "lista-num", [["01", "Indicador de taxa de pulverização"], ["02", "Botão Pulverizar/Espalhar"], ["03", "Interruptor de modo de voo"], ["04", "Troca de mapa/FPV"],
        ["05", "Botão do estabilizador"], ["06", "Botão HOME"], ["07", "Botão RTH"], ["08", "Estabilizador de inclinação para baixo/recentralização"], ["09", "Interruptor de holofote"],
        ["10", "Adicionar ponto"], ["11", "Botão liga/desliga (pressione + pressione e mantenha pressionado)"], ["12", "Para cima&nbsp;&nbsp; Indefinida"], ["13", "Para baixo&nbsp;&nbsp; Indefinida"],
        ["14", "Esquerda&nbsp;&nbsp; Indefinida"], ["15", "Direita&nbsp;&nbsp; Indefinida"], ["16", "Centro&nbsp;&nbsp; Indefinida"],
        ["17", "Freio de emergência (durante voo automático, retomada de tarefas, RTH, pouso)"], ["18", "Defina o Ponto B (Rota A-B)<br>Direção para a direita (M+)"],
        ["19", "Defina o Ponto A (Rota A-B)<br>Direção para a esquerda (M+)"], ["20", "Adicionar ponto"]]
        .map(function (i) { return "<div><b>" + i[0] + "</b><span>" + i[1] + "</span></div>"; }).join(""));
    case "rtk": return blocoRtk();
    case "celulas": {
      var pct = APP.E && APP.E.v ? APP.E.v.bateria : null, cv = pct == null ? "N/A" : (3.2 + .45 * pct / 100).toFixed(2);
      var cel = "";
      for (var i = 0; i < 14; i++) cel += '<div><i style="--c:' + (pct == null ? 0 : pct * .9) + '%"></i>' + cv + "</div>";
      return el("div", "celulas", cel);
    }
    case "dadosBat": {
      var vb = APP.E && APP.E.v, cn = conectadoCfg() && vb;
      return el("div", "dados", [[cn ? virg((3.2 + .45 * vb.bateria / 100) * 14, 1) + "<i>v</i>" : "N/A<i>v</i>", "Tensão"], [cn ? "21,8<i>°C</i>" : "N/A<i>°C</i>", "Temperatura"],
        [cn ? "196" : "N/A", "Número de ciclos"], [cn ? virg(vb.estado === "em solo" ? 1.4 : 42, 1) + "<i>A</i>" : "N/A<i>A</i>", "Corrente da bateria"]]
        .map(function (i) { return "<div><b>" + i[0] + "</b><span>" + i[1] + "</span></div>"; }).join(""));
    }
    case "faixaDupla":
      return el("div", "faixa-pad", '<div style="position:relative;height:96px;margin-top:24px"><i style="position:absolute;left:0;right:0;top:42px;height:12px;border-radius:6px;background:#e3e3e3"></i>' +
        '<i style="position:absolute;left:5%;width:15%;top:42px;height:12px;background:#f0a63a"></i><i style="position:absolute;left:0;width:5%;top:42px;height:12px;background:#e8442e;border-radius:6px 0 0 6px"></i>' +
        '<span style="position:absolute;left:5%;top:18px;width:30px;height:60px;margin-left:-15px;border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)"></span>' +
        '<span style="position:absolute;left:20%;top:18px;width:30px;height:60px;margin-left:-15px;border-radius:8px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)"></span></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:30px"><span style="color:#e8442e">5%</span><span style="color:#f0a63a">20%</span></div>');
    case "canal":
      return el("div", "nota", '<div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:28px;color:#8a8f94"><span>dBm/MHz</span><b style="color:#1f2224">-70.0dBm</b></div>' +
        '<div style="height:220px;border-left:2px solid #d0d3d6;border-bottom:2px solid #d0d3d6;margin-top:12px;position:relative"><i style="position:absolute;left:40%;bottom:0;width:18%;height:60%;background:rgba(0,173,83,.25);border:2px solid #00ad53"></i></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:28px;color:#8a8f94;margin-top:8px"><span>≈ 1km</span><span>≈ 4km</span><span>MHz</span></div></div>');
  }
  return el("div", "");
}

var ROT_MODOS = {
  1: { e: ["Para frente", "Guinada para a direita", "Para trás", "Guinada para a esquerda"], d: ["Subir", "Direita", "Descer", "Esquerda"] },
  2: { e: ["Subir", "Guinada para a direita", "Descer", "Guinada para a esquerda"], d: ["Para frente", "Direita", "Para trás", "Esquerda"] },
  3: { e: ["Para frente", "Direita", "Para trás", "Esquerda"], d: ["Subir", "Guinada para a direita", "Descer", "Guinada para a esquerda"] }
};
function pinosHTML(n) {
  var r = ROT_MODOS[n];
  var pin = function (nome, l) {
    return '<div class="pino"><span class="n">' + nome + '</span><span class="d c">' + l[0] + '</span><span class="d r">' + l[1] + '</span><span class="d b">' + l[2] +
      '</span><span class="d e">' + l[3] + '</span><svg class="m" viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" fill="#3c4245"/><circle cx="40" cy="40" r="26" fill="#5e6367"/>' +
      '<g fill="#8d9296"><path d="M40 16l8 12H32z"/><path d="M40 64l8-12H32z"/><path d="M16 40l12-8v16z"/><path d="M64 40l-12-8v16z"/></g><circle cx="40" cy="40" r="7" fill="#c9cbcd"/></svg></div>';
  };
  return el("div", "pinos", pin("Pino esquerdo", r.e) + pin("Pino direito", r.d));
}

function blocoRtk() {
  var d = el("div", "");
  var on = CFG.local.rtkOn === true, fonte = CFG.local.rtkFonte || "RTK de rede personalizada";
  var t = bChave({ rot: "Posicionamento RTK", lig: on });
  $(".chave", t).addEventListener("click", function () { setTimeout(function () { CFG.local.rtkOn = $(".chave", t).classList.contains("lig"); guardar("cfgLocal", CFG.local); cmd("p", {v:{xgRtk:CFG.local.rtkOn}}); atualizarBarra(); montarDireita(); montarCfg(); }, 0); });
  d.appendChild(t);
  if (on) {
    var s = bSel({ rot: "Fonte de sinal RTK", v: fonte, ops: ["Estação móvel D-RTK 2", "RTK de rede personalizada"], semDrone: fonte,
      desc: fonte === "Estação móvel D-RTK 2" ? "" : "Certifique-se de que a conexão de rede seja estável" });
    $(".sel-c", s).addEventListener("click", function () { setTimeout(function () { var l = $(".lista-sus"); if (l) $$("button", l).forEach(function (b) { b.addEventListener("click", function () { CFG.local.rtkFonte = b.textContent; guardar("cfgLocal", CFG.local); setTimeout(montarCfg, 0); }); }); }, 0); });
    d.appendChild(s);
    if (fonte === "Estação móvel D-RTK 2") {
      d.appendChild(el("div", "nota", "<p>Certifique-se de que:<br>1. A estação móvel RTK está colocada em uma área aberta e desobstruída<br>2. O local de instalação e a altura da estação móvel RTK permanecem inalterados durante a operação da tarefa<br>3. As coordenadas da estação móvel RTK definidas abaixo permanecem consistentes ao operar a mesma tarefa</p>"));
    } else {
      d.appendChild(el("div", "cfg-bloco", '<div class="cfg-lin"><span class="cfg-tit">RTK de rede personalizada</span><span style="font-size:34px;color:#8a8f94">Configurado ›</span></div>'));
    }
    d.appendChild(el("div", "cfg-bloco", '<div class="cfg-lin"><span class="cfg-tit">Status de posicionamento</span><span style="font-size:30px"><b style="background:#e6f6ec;color:#0ca35c;padding:4px 12px;border-radius:6px">4G ▮▮▯</b> <b style="background:#ececec;color:#8a8f94;padding:4px 12px;border-radius:6px">' + (rtkAtivo() ? "Conectado" : "Desconectado") + '</b></span></div>'));
    d.appendChild(blocoCfg({ t: "tabela", cols: ["", "Aeronave", fonte === "Estação móvel D-RTK 2" ? "Status da a estação móvel RTK" : "Status de RTK de rede personalizado"],
      linhas: [["Orientação", "-", "-"], ["Posicionamento", "-", "-"], ["Latitude", "-", "-"], ["Longitude", "-", "-"], ["Altitude", "-", "-"], ["Ângulo de curso", "-", "-"]] }));
    d.appendChild(blocoCfg({ t: "link", rot: "Diagnóstico RTK" }));
  }
  d.appendChild(bChave({ rot: "Orientação RTK", lig: false }));
  return d;
}

/* calibração do controle: os eixos do RC Plus chegam pelo gamepad do WebView */
function calibrarCR() {
  var max = { a: [0, 0, 0, 0] }, etapa = 1, laco;
  var d = dialogo({ largura: 1200, titulo: "1/2 Calibração da alavanca de controle", texto: "Mova lentamente os dois pinos de controle por toda a sua amplitude de movimento",
    botoes: [{ t: "Sair e calibrar mais tarde(R2)", fn: function () { cancelAnimationFrame(laco); } }] });
  var barra = el("div", "", '<div style="height:24px;border-radius:12px;background:#e3e3e3;margin-top:36px"><i style="display:block;height:24px;width:0;border-radius:12px;background:#00ad53"></i></div>');
  $(".conteudo", d).appendChild(barra);
  var passoCal = function () {
    var g = navigator.getGamepads ? Array.prototype.slice.call(navigator.getGamepads()).filter(Boolean)[0] : null;
    if (g) for (var i = 0; i < 4; i++) max.a[i] = Math.max(max.a[i], Math.abs(g.axes[i] || 0));
    var pct = max.a.reduce(function (s, v) { return s + Math.min(1, v); }, 0) / 4 * 100;
    $("i", barra).style.width = pct + "%";
    if (pct >= 95 && etapa === 1) {
      etapa = 2; fecharDialogo(); toast("Calibrado", "ok"); return;
    }
    laco = requestAnimationFrame(passoCal);
  };
  laco = requestAnimationFrame(passoCal);
}

/* ------------------------------------------------------------- montagem */
function montarCfg() {
  var c = $("#cfg"), pg = PAG[CFG.pag], sub = CFG.sub && pg.subs && pg.subs[CFG.sub];
  var semMenu = CFG.sub === "botoes";
  c.innerHTML = "";
  if (!semMenu) {
    var menu = el("div", "cfg-menu");
    Object.keys(PAG).forEach(function (k) {
      menu.appendChild(botao(k === CFG.pag ? "ativo" : "", ICONES_CFG[k] + "<span>" + NOMES_CFG[k] + "</span>", function () { CFG.pag = k; CFG.sub = null; montarCfg(); }));
    });
    c.appendChild(menu);
  }
  c.style.left = semMenu ? "0px" : "624px";
  c.style.width = semMenu ? "1920px" : "1296px";
  var corpo = el("div", "cfg-corpo");
  var topo = el("div", "cfg-topo", (sub ? '<button class="voltar">' + '<svg viewBox="0 0 48 48"><path d="M30 10 16 24l14 14" fill="none" stroke="#1f2224" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : "") +
    "<h2>" + (sub ? sub.titulo : pg.titulo) + '</h2><button class="fechar">' + ic("i-x") + "</button>");
  if (sub) $(".voltar", topo).addEventListener("click", function () { CFG.sub = sub.volta || null; montarCfg(); });
  $(".fechar", topo).addEventListener("click", fecharConfig);
  corpo.appendChild(topo);
  var rol = el("div", "cfg-rol");
  (sub ? sub.blocos : pg.blocos).forEach(function (b) { rol.appendChild(blocoCfg(b)); });
  corpo.appendChild(rol);
  c.appendChild(corpo);
}
function abrirConfig(pag) {
  if (pag) { CFG.pag = pag; CFG.sub = null; }
  $("#cfg").classList.add("aberto");
  montarCfg();
}
function fecharConfig() { $("#cfg").classList.remove("aberto"); }
window.abrirConfig = abrirConfig;
ouvir("conexao", function () { if ($("#cfg").classList.contains("aberto")) montarCfg(); });

/* ------------------------------------------ reenviar ao conectar (Fase 0, 0.4)
   O jogo recarregado volta aos valores dele (modo do manche 2, radar Alta,
   estabilização...). Ao conectar, o app manda tudo de novo e, por ~6 s,
   confere o estado contra o que mostra; se algo diferir, manda outra vez
   (no máximo 3). O talhão só vai com a aeronave no chão e sem rota no jogo:
   em voo, o reiniciarVoo levaria o drone de volta à base. */
function ajustesLocais() {
  var L = CFG.local || {};
  return { xgRtk: L.rtkOn === true, xgDistMax: L.distMax != null ? L.distMax : 2000, xgAltMax: L.altMax != null ? L.altMax : 100,
    xgFrenagem: L.frenagem != null ? L.frenagem : 6, xgRadarMedia: L["g:Alta|Média"] === 1,
    xgDesvioPref: L.desvioPref != null ? L.desvioPref : 100 };
}
function reenviarAjustes() {
  enviarP();
  cmd("p", { v: ajustesLocais() });
  cmd("modo", { v: CFG.modoJoy });
  if (M.P.fluxoM) cmd("fluxoM", { v: M.P.fluxoM });
}
function reenviarTudo() {
  reenviarAjustes();
  var E = APP.E, v = E && E.v;
  var chao = !v || ["em solo", "concluído"].indexOf(v.estado) >= 0;
  var semRota = !(E && E.rota && E.rota.r && E.rota.r.length);
  if (M.sub === "execucao" && M.exec && chao && semRota) enviarTalhao(M.exec);
}
/* o que o jogo tem e o app mostra diferente (lista vazia = tudo certo) */
function ajustesDiferentes() {
  var E = APP.E, p = E && E.p, P = M.P, L = ajustesLocais(), d = [];
  if (!p) return d;
  var v = E.v, chao = !v || ["em solo", "concluído"].indexOf(v.estado) >= 0;
  if (!!p.xgRtk !== L.xgRtk) d.push("xgRtk");
  if (p.desvio !== P.desvio) d.push("desvio");
  if (p.xgContornar !== P.contornar) d.push("xgContornar");
  if (p.terreno !== P.terreno) d.push("terreno");
  if (Math.abs((Number(p.altura) || 0) - P.altura) > .05) d.push("altura");
  if (Math.abs((Number(p.rth) || 0) - P.rthAlt) > .05) d.push("rth");
  if (Math.abs((Number(p.xgFrenagem) || 0) - L.xgFrenagem) > .05) d.push("xgFrenagem");
  if (!!p.xgRadarMedia !== L.xgRadarMedia) d.push("xgRadarMedia");
  if (chao && p.estab !== P.estab) d.push("estab");
  if (E.mj != null && E.mj !== CFG.modoJoy) d.push("modo");
  return d;
}
var conferenciaAjustes = null;
ouvir("conexao", function (vivo) {
  clearInterval(conferenciaAjustes);
  if (!vivo) return;
  reenviarTudo();
  var voltas = 0, reenvios = 0;
  conferenciaAjustes = setInterval(function () {
    voltas++;
    if (voltas > 4 || !APP.conectado) { clearInterval(conferenciaAjustes); return; }
    if (ajustesDiferentes().length && reenvios < 3) { reenvios++; reenviarAjustes(); }
  }, 1500);
});

var rtkMostrado;
ouvir("estado", function(E) { if (rtkMostrado !== E.rtk) { rtkMostrado=E.rtk; if (CFG.pag === "rtk" && $("#cfg").classList.contains("aberto")) montarCfg(); } });
