/* ==========================================================================
   TREINAMENTO PILOTO DE DRONE - CONFIGURACAO

   Este e o UNICO arquivo que se edita no dia a dia.

   Quem edita:
     - VOCE, para o site de venda (WhatsApp, precos, texto).
     - A EMPRESA que contratou a licenca, para dizer quais marcas de drone
       ela treina e quais turmas existem.

   Enquanto faltar algo obrigatorio aparece uma tarja amarela no topo
   dizendo o que falta. Ela some sozinha quando estiver tudo preenchido.
   ========================================================================== */

/* Este computador (testes) ou a internet (alunos)?
   A entrada por codigo de turma abre o simulador SEM conta e SEM gastar horas.
   Por isso ela so funciona aqui, no computador de quem esta montando o sistema;
   no site publicado nao existe turma nem entrada livre. Para vender acesso por
   turma a uma escola no futuro, cadastre a turma fora deste "TPD_LOCAL". */
var TPD_LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

window.TREINAMENTO = {

  /* ------------------------------------------------------------- o produto */

  nome: "Treinamento Piloto de Drone",
  chamada: "Treine a operação inteira do drone agrícola antes de encostar na máquina de verdade.",

  // Quem vende o treinamento (voce).
  fornecedor: "Guri dos Drones",
  email: "guridosdrones@gmail.com",

  // WhatsApp com DDI e DDD, so numeros: 5555999998888
  // ENQUANTO ESTIVER VAZIO, os botoes de contato ficam travados.
  whatsapp: "",

  instagram: "",
  youtube: "",

  /* ---------------------------------------------------------- a licenca

     A empresa que contrata escolhe QUAIS MARCAS ela treina. O aluno so ve
     as marcas liberadas aqui - as outras nem aparecem no painel.

     marcas disponiveis hoje:  "dji"  "xag"
     previstas (ainda sem simulador):  "eavision"  "topxgun"
     ---------------------------------------------------------------------- */

  licenca: {
    // Nome da empresa que aparece no topo do painel do aluno.
    // Vazio = aparece so o nome do treinamento.
    empresa: "",

    // Marcas contratadas por essa empresa.
    marcas: ["dji", "xag"],

    // Ate quando a licenca vale (AAAA-MM-DD). Vazio = sem prazo.
    validade: "",
  },

  /* ----------------------------------------------------------- as turmas

     A empresa cadastra o cliente dando a ele um CODIGO DE TURMA. O aluno
     digita esse codigo em entrar.html e cai direto no treinamento.

     Sem servidor nesta fase: o codigo vale como chave de entrada e o
     progresso fica salvo no proprio aparelho do aluno. Quando entrar o
     login de verdade (Supabase), o codigo continua funcionando - so passa
     a ser conferido no servidor.

     codigo   o que o aluno digita (sem espaco, sem acento; maiusculas)
     nome     como a turma aparece na tela
     marcas   quais marcas ESSA turma treina (subconjunto das contratadas)
     cenarios quais relevos essa turma pode usar
     ---------------------------------------------------------------------- */

  turmas: TPD_LOCAL ? [
    {
      codigo: "DEMO",
      nome: "Demonstração",
      marcas: ["dji", "xag"],
      cenarios: ["plano", "mediano", "montanhoso"],
    },
  ] : [],

  // Qualquer codigo entra - mas so neste computador (ver TPD_LOCAL la em cima).
  // No site publicado fica sempre desligada.
  entradaLivre: TPD_LOCAL,

  /* ------------------------------------------------------------- precos

     Preco em texto, do jeito que aparece na tela. null = "Sob consulta".
     Aqui o cliente e a EMPRESA, nao o aluno: preco por acesso.
     ---------------------------------------------------------------------- */

  precos: {
    licenca: null,   // licença anual da empresa
    acesso:  null,   // por aluno
    marca:   null,   // cada marca adicional
  },

  pagamento: "Pix ou cartão. A empresa compra os acessos de uma vez.",

  /* A venda ao aluno (pacotes de horas) fica na area do aluno:
     treinamento/conta/contas.js e servidor/funcoes/catalogo.js. */

  /* --------------------------------------------------------- depoimentos

     Lista vazia = a secao some. Nao invente depoimento.
     { nome, empresa, texto }
     ---------------------------------------------------------------------- */

  depoimentos: [],

  /* ------------------------------------------------------------ perguntas */

  faq: [
    {
      pergunta: "O que exatamente o aluno faz no treinamento?",
      resposta:
        "Ele entra no campo em 3D, no lugar do operador, e conduz a operação " +
        "inteira: reconhecer a aeronave, conferir antes de voar, mapear o " +
        "talhão, ajustar os parâmetros, decolar, pulverizar, voltar para " +
        "trocar bateria e resolver o que der errado. Cada etapa vem com a " +
        "explicação do que aquilo faz e do que acontece se for feito errado.",
    },
    {
      pergunta: "Precisa instalar alguma coisa?",
      resposta:
        "Não. Roda no navegador do computador. O aluno recebe o código da " +
        "turma, entra e começa.",
    },
    {
      pergunta: "Quais marcas estão prontas?",
      resposta:
        "Agras T50 e XAG P60. eAvision e TopXGun estão previstas — a empresa escolhe " +
        "quais marcas quer na licença dela.",
    },
    {
      pergunta: "Substitui o curso obrigatório?",
      resposta:
        "Não. Habilitação e certificação são da ANAC e dos cursos " +
        "credenciados. Isto aqui é treinamento de operação: a parte prática " +
        "que hoje só se aprende quebrando equipamento de verdade.",
    },
    {
      pergunta: "O aluno pode errar?",
      resposta:
        "Deve. O simulador deixa bater no obstáculo, deixar a bateria acabar " +
        "no meio do talhão e aplicar com a calda errada — e depois mostra no " +
        "boletim o que aquilo custaria em reais.",
    },
  ],

  /* ------------------------------------------------------------ cenarios

     Relevo do campo. O aluno escolhe antes de entrar.
     ---------------------------------------------------------------------- */

  cenarios: [
    {
      id: "plano",
      nome: "Terra plana",
      resumo: "Talhão de soja sem ondulação. É onde se aprende a rotina.",
      detalhe:
        "Sem desnível para atrapalhar: a altura de voo fica constante e o " +
        "operador enxerga o drone o tempo todo. Serve para fixar a sequência " +
        "sem susto.",
      dificuldade: 1,
    },
    {
      id: "mediano",
      nome: "Terreno mediano",
      resumo: "Ondulação suave, um capão de mata e rede elétrica na divisa.",
      detalhe:
        "O drone precisa acompanhar o relevo e o operador perde o drone de " +
        "vista atrás da elevação. Aparecem os primeiros obstáculos de verdade.",
      dificuldade: 2,
    },
    {
      id: "montanhoso",
      nome: "Terreno montanhoso",
      resumo: "Encosta forte, vento de vale e pouso longe do talhão.",
      detalhe:
        "Rampa acima do que o radar corrige sozinho, vento que muda de " +
        "direção na encosta e caminhada até a base. Aqui se aprende a " +
        "desistir do voo na hora certa.",
      dificuldade: 3,
    },
  ],
};
