/* ==========================================================================
   MARCAS E MODELOS DE DRONE

   Cada marca traz:
     - os numeros da maquina (usados pela fisica do simulador e pelas aulas)
     - o nome proprio de cada coisa naquela marca (o aluno precisa aprender
       o vocabulario do fabricante com que ele vai trabalhar)
     - a sequencia de operacao daquela marca

   IMPORTANTE sobre os numeros:
     DJI T50 - conferidos no manual oficial PT-BR v1.0 (2024), secao de
     especificacoes. Sao dados de fabricante, nao chute.
     XAG P60 - marcados com `conferir: true` os campos que ainda preciso
     bater com o manual/telas reais. Estao no campo `conferir` de cada
     modelo para voce nao esquecer o que falta.

   Marca sem simulador ainda entra aqui com `pronta: false`: ela aparece no
   site de venda como "prevista" e NAO aparece para o aluno.
   ========================================================================== */

window.MARCAS = {

  /* ====================================================================== DJI */
  dji: {
    id: "dji",
    nome: "Agras",          // sem a palavra DJI em lugar nenhum (pedido dele)
    pronta: true,

    // Cor de interface da marca (usada na tela do controle do simulador).
    cor: "#1F7AE0",
    corEscura: "#0E1A28",

    // Como o fabricante chama as coisas. O aluno aprende o vocabulario certo.
    vocabulario: {
      app: "Agras",
      controle: "RC Plus (RM700B)",
      rota: "rota de operação",
      mapear: "mapeamento do campo",
      obstaculo: "obstáculo",
      retorno: "RTH (retorno ao ponto de partida)",
      seguirTerreno: "acompanhamento do terreno",
      modoMontanha: "modo Montanha",
      armar: "combinação CSC para ligar os motores",
      confirmar: "deslizar para decolar",
    },

    modelos: [
      {
        id: "t50",
        nome: "T50",
        modeloOficial: "3WWDZ-40B",
        ano: 2024,

        // --- números conferidos no manual oficial -----------------------
        specs: {
          pesoVazio: 39.9,          // kg, sem bateria
          pesoComBateria: 52,       // kg
          mtowPulverizacao: 92,     // kg, ao nível do mar
          mtowDispersao: 103,       // kg
          entreEixos: 2.2,          // m (diagonal máxima)
          dimensoesAbertas: [2.8, 3.085, 0.82],  // m, braços e hélices abertos

          tanque: 40,               // L
          cargaPulverizacao: 40,    // kg
          rotores: 8,               // 4 braços, rotor coaxial
          heliceDiametro: 1.3716,   // m
          motorPotencia: 4000,      // W por rotor

          aspersores: 2,            // modelo LX8060SZ
          gotaMin: 50,              // µm
          gotaMax: 500,             // µm
          faixaMin: 4,              // m, a 3 m acima da cultura
          faixaMax: 11,             // m
          vazaoMax2Bicos: 16,       // L/min
          vazaoMax4Bicos: 24,       // L/min

          bateriaCapacidade: 30,    // Ah
          vooParadoVazio: 16.5,     // min (52 kg)
          vooParadoCheio: 7,        // min (92 kg)
          raioMax: 2000,            // m
          ventoMax: 6,              // m/s — acima disso não se voa
          tempMin: 0, tempMax: 45,  // °C

          radarAlcance: 50,         // m
          radarMinimo: 1,           // m
          inclinacaoMaxMontanha: 50,// graus, modo Montanha
          estabilizacaoMin: 1.5,    // m
          estabilizacaoMax: 30,     // m
          distanciaSeguranca: 2.5,  // m entre hélice e obstáculo após frear
          velocidadeMaxObstaculo: 10, // m/s para o desvio funcionar
          velocidadeVerticalMax: 3, // m/s

          precisaoRTK: 0.10,        // m
          precisaoSemRTK: 0.60,     // m horizontal

          // --- sistema de dispersão (sólido), carga opcional -----------
          // Substitui o tanque de pulverização na mesma aeronave.
          tanqueDispersao: 75,      // L de volume
          cargaDispersao: 50,       // kg de material
          pesoSistemaDispersao: 6,  // kg do conjunto, com para-lamas
          materialMin: 0.5,         // mm de diâmetro do grão
          materialMax: 5,           // mm
          faixaDispersaoMin: 4.5,   // m recomendados
          faixaDispersaoMax: 7,     // m
          vooDispersaoVazio: 15,    // min
          vooDispersaoCheio: 5.5,   // min (103 kg de decolagem)
        },

        // Modelo 3D: se o arquivo existir, o simulador usa; senão monta em
        // código com as medidas de cima.
        modelo3d: {
          arquivo: "assets/modelos/dji_t50.obj",
          escala: 1,
          origem: "modelo do usuário (DAT50) — sem logotipo do fabricante",
        },

        conferir: [],

        /* Os modos de operacao da maquina, como o app do fabricante os
           apresenta. Cada um tem a sua hora - e e isso que separa o
           operador que sabe a maquina do que so aperta "iniciar". */
        modos: [
          {
            id: "rota",
            nome: "Rota (campo)",
            para: "Área grande, já mapeada.",
            como: "Você planeja o campo, marca os obstáculos e define os parâmetros; " +
                  "o app calcula a rota e a aeronave voa sozinha.",
            ganha: [
              "Retomada do ponto exato depois da troca de bateria",
              "Estabilização de altitude e desvio de obstáculo trabalhando",
              "Aceita mapa de prescrição para taxa variável",
            ],
            perde: ["Precisa do campo mapeado antes"],
          },
          {
            id: "ab",
            nome: "Rota A-B",
            para: "Talhão retangular sem mapa pronto.",
            como: "Você leva a aeronave até o começo da linha, registra o ponto A, " +
                  "vai até o fim e registra o B. Ela replica essa linha em faixas paralelas.",
            ganha: [
              "Começa a aplicar sem mapear o campo inteiro",
              "Com três linhas ou mais dá para salvar como campo e reaproveitar",
            ],
            perde: [
              "A e B não se corrigem depois de gravados: erra, recomeça",
              "Só pulveriza nas linhas paralelas a A-B, não nas passagens entre elas",
              "Mexeu nos manches, ela cai para Manual e fica parada esperando Retomar",
            ],
          },
          {
            id: "manual",
            nome: "Manual",
            para: "Área pequena ou de formato torto.",
            como: "Você controla tudo: voo, altura e o botão de pulverização. " +
                  "A taxa se ajusta pela rolagem do controle.",
            ganha: ["Entra onde rota nenhuma entra", "Resolve reboleira e canto sobrando"],
            perde: [
              "A faixa e a sobreposição passam a depender do seu olho",
              "É onde mais se erra dose, por excesso e por falta",
            ],
          },
          {
            id: "manualplus",
            nome: "Manual Plus",
            para: "Manual com disciplina de faixa.",
            como: "Você define o espaçamento de rota; um toque manda a aeronave " +
                  "andar de lado exatamente uma faixa.",
            ganha: [
              "Mantém a faixa constante sem precisar de campo mapeado",
              "Pulveriza indo e voltando, e corta ao andar de lado",
            ],
            perde: ["Continua sendo você quem decide onde é a próxima linha"],
          },
          {
            id: "dispersao",
            nome: "Dispersão (sólido)",
            para: "Semente, adubo e isca — não é calda.",
            como: "O tanque de pulverização sai e entra o sistema de dispersão, " +
                  "com disco giratório e sensor de peso.",
            ganha: [
              "75 L de tanque e até 50 kg de carga",
              "O sensor de peso acerta a taxa e avisa tanque vazio",
            ],
            perde: [
              "Carregado, o voo cai para cerca de 5,5 min",
              "A faixa muda com o grão, a rotação do disco e a altura",
              "Grão úmido ou fora de 0,5 a 5 mm entope e desregula a faixa",
            ],
          },
        ],
      },
      {
        id: "t40",
        nome: "Agras T40",
        modeloOficial: "3WWDZ-40A",
        ano: 2022,

        /* ATENÇÃO: números de partida, a conferir com o manual oficial deste modelo. */
        specs: {
          pesoVazio: 38,
          pesoComBateria: 50,
          mtowPulverizacao: 90,
          mtowDispersao: 101,
          entreEixos: 2.2,
          dimensoesAbertas: [2.8, 3.15, 0.78],
          tanque: 40,
          cargaPulverizacao: 40,
          rotores: 8,
          heliceDiametro: 1.3716,
          motorPotencia: 4000,
          aspersores: 2,
          gotaMin: 50,
          gotaMax: 300,
          faixaMin: 4,
          faixaMax: 11,
          vazaoMax2Bicos: 12,
          vazaoMax4Bicos: 16,
          bateriaCapacidade: 30,
          vooParadoVazio: 18,
          vooParadoCheio: 7,
          radarAlcance: 50,
          inclinacaoMaxMontanha: 50,
          tanqueDispersao: 70,
          cargaDispersao: 50,
          faixaDispersaoMin: 4.5,
          faixaDispersaoMax: 7,
          tempMin: 0, tempMax: 45,
          radarMinimo: 1,
          estabilizacaoMin: 1.5,
          estabilizacaoMax: 30,
          distanciaSeguranca: 2.5,
          velocidadeMaxObstaculo: 10,
          velocidadeVerticalMax: 3,
          precisaoRTK: 0.10,
          precisaoSemRTK: 0.60,
          raioMax: 2000,
          ventoMax: 6,
        },

        modelo3d: {
          arquivo: "assets/modelos/dji_t50.obj",
          escala: 1,
          origem: "mesmo modelo 3D do T50 até chegar o arquivo do T40",
        },

        conferir: [
          "todos os números: são valores de partida (tanque, pesos, faixa, vazão, bateria e autonomia) - bater com o manual oficial",
          "modelo 3D: usa o da mesma família até ter o arquivo próprio",
        ],
      },
      {
        id: "t25",
        nome: "Agras T25",
        modeloOficial: "3WWDZ-20B",
        ano: 2024,

        /* ATENÇÃO: números de partida, a conferir com o manual oficial deste modelo. */
        specs: {
          pesoVazio: 21.4,
          pesoComBateria: 32,
          mtowPulverizacao: 52,
          mtowDispersao: 58,
          entreEixos: 1.9,
          dimensoesAbertas: [2.585, 2.675, 0.78],
          tanque: 20,
          cargaPulverizacao: 20,
          rotores: 4,
          heliceDiametro: 1.32,
          motorPotencia: 4000,
          aspersores: 2,
          gotaMin: 50,
          gotaMax: 500,
          faixaMin: 4,
          faixaMax: 7,
          vazaoMax2Bicos: 16,
          vazaoMax4Bicos: 24,
          bateriaCapacidade: 15.5,
          vooParadoVazio: 19,
          vooParadoCheio: 8.7,
          radarAlcance: 50,
          inclinacaoMaxMontanha: 50,
          tanqueDispersao: 35,
          cargaDispersao: 25,
          faixaDispersaoMin: 4,
          faixaDispersaoMax: 6,
          tempMin: 0, tempMax: 45,
          radarMinimo: 1,
          estabilizacaoMin: 1.5,
          estabilizacaoMax: 30,
          distanciaSeguranca: 2.5,
          velocidadeMaxObstaculo: 10,
          velocidadeVerticalMax: 3,
          precisaoRTK: 0.10,
          precisaoSemRTK: 0.60,
          raioMax: 2000,
          ventoMax: 6,
        },

        modelo3d: {
          arquivo: "assets/modelos/t25/DJI_Agras_T25.obj",
          escala: 1,
          origem: "modelo DJI Agras T25 fornecido pelo usuário (OBJ e texturas)",
        },

        conferir: [
          "todos os números: são valores de partida (tanque, pesos, faixa, vazão, bateria e autonomia) - bater com o manual oficial",
        ],
      },
    ],

    /* Sequencia de operacao da marca. Cada etapa vira uma aula guiada.
       O campo `checa` e o que o simulador cobra do aluno para dar a etapa
       por cumprida. */
    fluxo: [
      { id: "conhecer",   titulo: "Conhecer a aeronave",       checa: "olhou-todas-as-pecas" },
      { id: "montagem",   titulo: "Abrir braços e travar",     checa: "aeronave-montada" },
      { id: "bateria",    titulo: "Encaixar a bateria",        checa: "bateria-travada" },
      { id: "prevoo",     titulo: "Checagem antes de voar",    checa: "checklist-completo" },
      { id: "mapear",     titulo: "Mapear o campo",            checa: "talhao-fechado" },
      { id: "parametros", titulo: "Parâmetros da operação",    checa: "parametros-coerentes" },
      { id: "decolar",    titulo: "Ligar motores e decolar",   checa: "decolou" },
      { id: "testeagua",  titulo: "Voo de teste com água",     checa: "vazao-conferida" },
      { id: "aplicar",    titulo: "Pulverizar a rota",         checa: "cobertura-80" },
      { id: "retorno",    titulo: "Retorno e troca de bateria",checa: "retomou-do-ponto" },
      { id: "modos",      titulo: "Os modos de operação",      checa: "escolheu-o-modo-certo" },
      { id: "ab",         titulo: "Operação Rota A-B",         checa: "linha-ab-aplicada" },
      { id: "manual",     titulo: "Manual e Manual Plus",      checa: "area-irregular-coberta" },
      { id: "dispersao",  titulo: "Dispersão de sólido",       checa: "dispersao-regulada" },
      { id: "emergencia", titulo: "Quando algo dá errado",     checa: "emergencia-resolvida" },
    ],
  },

  /* ====================================================================== XAG */
  xag: {
    id: "xag",
    nome: "XAG",
    pronta: true,

    cor: "#00AB7F",       // verde do app XAG One, conferido em vídeo de tela
    corEscura: "#0E1F1A",

    vocabulario: {
      app: "XAG One",
      controle: "SRC4",
      rota: "operação",
      mapear: "mapeamento",
      obstaculo: "obstáculos",
      retorno: "voltar para casa",
      seguirTerreno: "seguimento de terreno",
      modoMontanha: "modo de encosta",
      armar: "destravar a aeronave",
      confirmar: "iniciar operação",
    },

    modelos: [
      {
        id: "p60",
        nome: "P60",
        modeloOficial: "",
        ano: 2022,

        /* ATENÇÃO: números de partida, a conferir com o manual do P60.
           O simulador já roda com eles, mas não trate como verdade de
           fabricante enquanto estiverem na lista `conferir`. */
        specs: {
          pesoVazio: 32,
          pesoComBateria: 41,
          mtowPulverizacao: 91,
          mtowDispersao: 100,
          entreEixos: 2.0,
          dimensoesAbertas: [2.6, 2.6, 0.78],

          tanque: 30,               // RevoSpray — ele confirmou 30 L em 26/09/2026
          cargaPulverizacao: 50,
          rotores: 4,               // quadricóptero, ao contrário do T50
          heliceDiametro: 1.30,
          motorPotencia: 3600,

          aspersores: 2,            // bicos centrífugos, não de pressão
          gotaMin: 60,
          gotaMax: 400,
          faixaMin: 3,
          faixaMax: 10,
          vazaoMax2Bicos: 16,
          vazaoMax4Bicos: 22,

          bateriaCapacidade: 30,
          vooParadoVazio: 15,
          vooParadoCheio: 8,
          raioMax: 2000,
          ventoMax: 6,
          tempMin: 0, tempMax: 45,

          radarAlcance: 30,
          radarMinimo: 1,
          inclinacaoMaxMontanha: 45,
          estabilizacaoMin: 1.5,
          estabilizacaoMax: 30,
          distanciaSeguranca: 2.5,
          velocidadeMaxObstaculo: 10,
          velocidadeVerticalMax: 3,

          precisaoRTK: 0.10,
          precisaoSemRTK: 0.60,
        },

        modelo3d: {
          arquivo: "assets/modelos/xag_p60.glb",
          escala: 1,
          origem: "P60_Articulado_v3.glb (enviado em 23/09/2026): braços que dobram, hélices e bateria removível",
        },

        conferir: [
          "volume do tanque e carga máxima (o modelo 3D chama a peça de Tanque_30L; aqui está 50)",
          "peso vazio e MTOW",
          "faixa efetiva e vazão máxima por bico",
          "autonomia carregado e vazio",
          "alcance do radar e inclinação máxima em encosta",
        ],
      },
      {
        id: "p150",
        nome: "P150",
        modeloOficial: "XAG P150",
        ano: 2024,

        /* 21/11/2026 (feito no Mac, pedido do Eduardo: "coloca o p150 no app o p150 vai duas baterias por voo"): peso, entre-eixos,
           medidas, tanque, helice, faixa e vazao sao da ficha oficial (xa.com/en/p150/p150specs, RevoSpray 4). O resto continua
           como numero de partida, a conferir. */
        specs: {
          pesoVazio: 54,                // ficha: com RevoSpray 4 e as duas baterias
          pesoComBateria: 54,
          mtowPulverizacao: 124,
          mtowDispersao: 150,
          entreEixos: 2.203,
          dimensoesAbertas: [3.118, 3.11, 0.764],
          tanque: 70,                   // nominal 60 L, maximo 70 L
          cargaPulverizacao: 70,
          rotores: 4,
          heliceDiametro: 1.53,
          motorPotencia: 4500,
          aspersores: 2,
          gotaMin: 60,
          gotaMax: 400,
          faixaMin: 5,
          faixaMax: 10,
          vazaoMax2Bicos: 30,
          vazaoMax4Bicos: 30,
          bateriaCapacidade: 40,        // sao DUAS baterias por voo
          vooParadoVazio: 16,
          vooParadoCheio: 7,
          radarAlcance: 40,
          inclinacaoMaxMontanha: 45,
          tanqueDispersao: 115,
          cargaDispersao: 80,
          faixaDispersaoMin: 5,
          faixaDispersaoMax: 8,
          tempMin: 0, tempMax: 45,
          radarMinimo: 1,
          estabilizacaoMin: 1.5,
          estabilizacaoMax: 30,
          distanciaSeguranca: 2.5,
          velocidadeMaxObstaculo: 10,
          velocidadeVerticalMax: 3,
          precisaoRTK: 0.10,
          precisaoSemRTK: 0.60,
          raioMax: 2000,
          ventoMax: 6,
        },

        modelo3d: {
          arquivo: "assets/modelos/xag_p150.glb",
          escala: 1,
          origem: "xag_p150.glb feito no Mac (19/11/2026) pelos renders e pelo desenho de dimensoes da XAG: 2,203 m entre motores, helices de 1,53 m, duas baterias (Bateria_dianteira e Bateria_traseira), tampa Tank_lid",
        },

        conferir: [
          "autonomia, capacidade da bateria, gota, radar e vento: valores de partida (a ficha nao traz ou nao foi conferida)",
          "modelo 3D: replica visual, nao e CAD",
        ],
      },
      {
        id: "p150max",
        nome: "P150 Max",
        modeloOficial: "XAG P150 Max",
        ano: 2025,

        /* Ficha oficial (xa.com/en/p150max/p150maxspecs, conferida em 12/10/2026). O que a
           ficha nao traz (autonomia, vento) segue como valor de partida, em `conferir`. */
        specs: {
          pesoVazio: 56,
          pesoComBateria: 56,           // a ficha ja conta a bateria B141050 no peso vazio
          mtowPulverizacao: 136,
          mtowDispersao: 140,
          entreEixos: 2.335,
          dimensoesAbertas: [3.252, 3.257, 0.767],
          tanque: 80,                   // RevoSpray 5
          cargaPulverizacao: 80,
          rotores: 4,
          heliceDiametro: 1.6,
          motorPotencia: 4850,
          aspersores: 2,                // atomizadores centrifugos, 1500-16000 rpm
          gotaMin: 60,
          gotaMax: 500,
          faixaMin: 5,
          faixaMax: 10,
          vazaoMax2Bicos: 32,           // 2 bombas de 0,5-16 L/min
          vazaoMax4Bicos: 46,           // kit de 4 bicos (folheto)
          bateriaCapacidade: 20,        // Ah (52,5 V, ~1050 Wh)
          vooParadoVazio: 15,
          vooParadoCheio: 6.5,
          radarAlcance: 100,            // radar 4D RD2488_25: 1,5 a 100 m
          inclinacaoMaxMontanha: 45,
          tanqueDispersao: 115,         // RevoCast 5
          cargaDispersao: 80,
          faixaDispersaoMin: 5,
          faixaDispersaoMax: 9,
          tempMin: 0, tempMax: 40,
          radarMinimo: 1.5,
          estabilizacaoMin: 1.5,
          estabilizacaoMax: 30,
          distanciaSeguranca: 2.5,
          velocidadeMaxObstaculo: 13.8,
          velocidadeMax: 20,
          velocidadeVerticalMax: 3,
          precisaoRTK: 0.10,
          precisaoSemRTK: 0.60,
          raioMax: 2000,
          ventoMax: 6,
        },

        modelo3d: {
          arquivo: "assets/modelos/xag_p150max.glb",
          escala: 1,
          girarY: Math.PI,              // o arquivo olha para -Z; o campo quer +Z
          origem: "P150_Max_v1.glb (enviado em 12/10/2026): 2,335 m entre motores, helices de 1,6 m, baterias removiveis",
        },

        conferir: [
          "autonomia vazio e cheio (a ficha nao traz)",
          "vento maximo (a ficha nao traz)",
        ],
      },
      {
        id: "p100pro",
        nome: "P100 Pro",
        modeloOficial: "XAG P100 Pro",
        ano: 2023,

        /* Ficha oficial (xa.com/en/p100pro/p100prospecs, conferida em 13/10/2026). O que a
           ficha nao traz (autonomia, vento, MTOW) segue como valor de partida, em `conferir`.
           13/10/2026: modelo 3D proprio e controle ARC3 Pro com o celular; app = o do P60. */
        specs: {
          pesoVazio: 46,                // com bateria, sem o modulo (RevoSpray/RevoCast)
          pesoComBateria: 46,
          mtowPulverizacao: 102,
          mtowDispersao: 102,
          entreEixos: 2.094,
          dimensoesAbertas: [2.927, 2.868, 0.725],   // altura com o RevoSpray 3
          tanque: 50,                   // RevoSpray 3
          cargaPulverizacao: 50,
          rotores: 4,
          heliceDiametro: 1.397,        // 5515 (55 x 15 pol)
          motorPotencia: 4100,          // A50
          aspersores: 2,                // atomizadores rotativos, 1000-16000 rpm
          gotaMin: 60,
          gotaMax: 400,
          faixaMin: 5,
          faixaMax: 10,
          vazaoMax2Bicos: 22,           // 2 bombas peristalticas de 0,5-11 L/min
          vazaoMax4Bicos: 22,
          bateriaCapacidade: 20,        // Ah (B13960S, 962 Wh)
          vooParadoVazio: 16,
          vooParadoCheio: 7.5,
          radarAlcance: 80,             // radar 4D RD24912: 1,5 a 80 m
          inclinacaoMaxMontanha: 45,
          tanqueDispersao: 80,          // RevoCast 3
          cargaDispersao: 50,
          faixaDispersaoMin: 3,
          faixaDispersaoMax: 7,
          tempMin: 0, tempMax: 40,
          radarMinimo: 1.5,
          estabilizacaoMin: 1,          // radar de terreno: altura fixa de 1 a 30 m
          estabilizacaoMax: 30,
          distanciaSeguranca: 2.5,
          velocidadeMaxObstaculo: 13.8,
          velocidadeMax: 13.8,
          velocidadeVerticalMax: 3,
          precisaoRTK: 0.10,
          precisaoSemRTK: 0.60,
          raioMax: 2000,
          ventoMax: 6,
        },

        modelo3d: {
          arquivo: "assets/modelos/xag_p100pro.glb",
          escala: 1,
          origem: "gerado por D:\\Area de trabalho\\modelos-3d\\xag_p100_pro\\gerar_p100pro.py (13/10/2026), pelas fotos oficiais e pela planta com medidas",
        },
        controle3d: "assets/modelos/xag_arc3pro.glb",   // ARC3 Pro + celular (controle_xag_3d.js)

        conferir: [
          "autonomia vazio e cheio (a ficha nao traz)",
          "vento maximo e MTOW (a ficha nao traz)",
        ],
      },
    ],

    /* A XAG mapeia e opera em ordem diferente da DJI: o limite e os
       obstáculos são desenhados antes, o mapa é salvo, e só então nasce a
       operação. O aluno precisa sentir essa diferença. */
    fluxo: [
      { id: "conhecer",   titulo: "Conhecer a aeronave",        checa: "olhou-todas-as-pecas" },
      { id: "montagem",   titulo: "Abrir braços e travar",      checa: "aeronave-montada" },
      { id: "bateria",    titulo: "Encaixar a bateria",         checa: "bateria-travada" },
      { id: "mapear",     titulo: "Limite do mapa e obstáculos",checa: "mapa-salvo" },
      { id: "prevoo",     titulo: "Checagem antes de voar",     checa: "checklist-completo" },
      { id: "parametros", titulo: "Parâmetros da operação",     checa: "parametros-coerentes" },
      { id: "decolar",    titulo: "Destravar e iniciar",        checa: "decolou" },
      { id: "aplicar",    titulo: "Pulverizar a operação",      checa: "cobertura-80" },
      { id: "retorno",    titulo: "Voltar para casa e retomar", checa: "retomou-do-ponto" },
      { id: "emergencia", titulo: "Quando algo dá errado",      checa: "emergencia-resolvida" },
    ],
  },

  /* ================================================================ previstas */
  eavision: {
    id: "eavision",
    nome: "eAvision",
    pronta: false,
    cor: "#C8412E",
    corEscura: "#241210",
    vocabulario: { app: "eAvision", controle: "controle remoto" },
    modelos: [],
    fluxo: [],
  },

  topxgun: {
    id: "topxgun",
    nome: "TopXGun",
    pronta: false,
    cor: "#2F5AA8",
    corEscura: "#10182A",
    vocabulario: { app: "TopXGun", controle: "controle remoto" },
    modelos: [],
    fluxo: [],
  },
};

/* Modelos novos (13/10/2026, so administrador como o P150 Max). Herdam do T50 os modos
   e as aulas; a ficha e o modelo 3D sao os proprios. O voo do campo le da ficha:
   tanque, vazao, autonomia, radar e velocidade (modelo_drone.js). */
(function () {
  var T50 = window.MARCAS.dji.modelos[0];
  function base(extra) {
    var m = Object.assign({}, T50, extra);
    m.specs = Object.assign({}, T50.specs, extra.specs);
    return m;
  }

  /* T100: ficha oficial ag.dji.com/t100/specs (conferida 13/10/2026). */
  window.MARCAS.dji.modelos.push(base({
    id: "t100", nome: "Agras T100", modeloOficial: "DJI Agras T100", ano: 2025, somenteAdmin: true,
    specs: {
      pesoVazio: 75, pesoComBateria: 75,       // ficha: 75 kg pulverizando com 2 bicos, ja com bateria
      mtowPulverizacao: 175, mtowDispersao: 175,
      entreEixos: 2.33, dimensoesAbertas: [3.22, 3.224, 0.975],
      tanque: 100, cargaPulverizacao: 100,
      rotores: 8, heliceDiametro: 1.575,       // 62", rotor coaxial
      aspersores: 2, gotaMin: 50, gotaMax: 500,
      faixaMin: 5, faixaMax: 11,
      vazaoMax2Bicos: 30, vazaoMax4Bicos: 40,
      bateriaCapacidade: 41,                    // Ah, 52 V (DB2160)
      vooParadoVazio: 20, vooParadoCheio: 9,    // ficha nao traz: revendas dao 20-23 e 9-13 min
      radarAlcance: 60, velocidadeMaxObstaculo: 13.8, velocidadeMax: 13.8,
      ventoMax: 6, tempMin: 0, tempMax: 40,
      tanqueDispersao: 150, cargaDispersao: 100, faixaDispersaoMin: 3, faixaDispersaoMax: 10,
    },
    modelo3d: { arquivo: "assets/modelos/dji_t100.glb", escala: 1,
      origem: "DJI_T100_Treinamento.glb (enviado em 13/10/2026): 8 rotores coaxiais, bateria removivel" },
    conferir: ["autonomia vazio e cheio (a ficha oficial nao traz)"],
  }));

  /* T10: ficha oficial ag.dji.com/t10/specs (conferida 13/10/2026). */
  window.MARCAS.dji.modelos.push(base({
    id: "t10", nome: "Agras T10", modeloOficial: "3WWDZ-10A", ano: 2021, somenteAdmin: true,
    specs: {
      pesoVazio: 13, pesoComBateria: 16.8,      // bateria BAX501 ~3,8 kg
      mtowPulverizacao: 24.8, mtowDispersao: 24.8,
      entreEixos: 1.48, dimensoesAbertas: [1.958, 1.833, 0.553],
      tanque: 8, cargaPulverizacao: 8,
      rotores: 4, heliceDiametro: 0.8382,       // 33"
      aspersores: 4,                            // bicos XR11001VS
      faixaMin: 3, faixaMax: 5.5,
      vazaoMax2Bicos: 1.8, vazaoMax4Bicos: 1.8, // padrao; 3 L/min com XR11002VS
      bateriaCapacidade: 9.5,
      vooParadoVazio: 17, vooParadoCheio: 9,    // 16 kg e 24,8 kg
      radarAlcance: 30, radarMinimo: 1.5, velocidadeMaxObstaculo: 7, velocidadeMax: 7,
      ventoMax: 6, tempMin: 0, tempMax: 45,
      tanqueDispersao: 12, cargaDispersao: 10,
    },
    modelo3d: { arquivo: "assets/modelos/dji_t10.glb", escala: 1, girarY: Math.PI,
      origem: "DJI_Agras_T10_v1.glb (enviado em 13/10/2026): 4 bicos, bateria e tanque removiveis" },
    conferir: [],
  }));

  /* Ceres Air C31 "Black Betty Stacked" (EUA; no Brasil Timber AT150), 13/10/2026, so
     administrador. Usa o app e o fluxo do T50 (o app da Ceres nao existe no simulador).
     Ficha: Raptor Dynamic (revenda oficial) + Timber/Band Agrishow 2026. Modelo 3D feito
     por D:\Area de trabalho\modelos-3d\ceres_air_black_betty\gerar_black_betty.py. */
  window.MARCAS.dji.modelos.push(base({
    id: "c31", nome: "Ceres Air C31 Black Betty", modeloOficial: "Ceres Air C31 (Timber AT150)", ano: 2026, somenteAdmin: true,
    specs: {
      pesoVazio: 94, pesoComBateria: 94,        // MTOW 603 lb - carga 397 lb
      mtowPulverizacao: 274, mtowDispersao: 274,
      entreEixos: 3.34, dimensoesAbertas: [3.86, 3.96, 1.07],
      tanque: 150, cargaPulverizacao: 150,      // 31 gal de fabrica, 40 gal (151 L) no AT150
      rotores: 8, heliceDiametro: 1.55,         // coaxial; ficha nao traz o tamanho (estimado ~61")
      aspersores: 4, gotaMin: 50, gotaMax: 500, // 4 atomizadores centrifugos
      faixaMin: 5, faixaMax: 15,                // ate 50 pes
      vazaoMax2Bicos: 40, vazaoMax4Bicos: 40,   // 11 gpm; Timber: 40 L/min
      bateriaCapacidade: 76,                    // 2 x 38000 mAh
      vooParadoVazio: 18, vooParadoCheio: 8,    // ficha nao traz
      radarAlcance: 40, velocidadeMaxObstaculo: 13.8, velocidadeMax: 17.88,   // 40 mph
      ventoMax: 6, tempMin: 0, tempMax: 40,
      tanqueDispersao: 200, cargaDispersao: 180, faixaDispersaoMin: 3, faixaDispersaoMax: 10,   // 53 gal
    },
    modelo3d: { arquivo: "assets/modelos/ceres_air_c31.glb", escala: 1,
      origem: "ceres_air_black_betty_sem_marca.glb (13/10/2026): 8 rotores coaxiais, 4 bicos em 2 barras traseiras" },
    conferir: ["autonomia, alcance do radar e diametro da helice (a ficha nao traz)"],
  }));

  /* T70P (26/10/2026, so administrador): ficha do manual oficial AGRAS T70P v1.0 (pag. 27:
     vazio 56 kg, carga 70 kg, MTOW 126 kg com 2 bicos, bateria 41000 mAh, pairado 7 min a
     126 kg e 21,5 min a 70 kg, vento 6 m/s) e das revendas (vazao 30 L/min com 2 bicos e 40
     com 4, faixa 4 a 11 m). Medidas de dji.com: 3200 x 3520 x 960 mm, diagonal 2440 mm,
     helice de 62". Usa o app do T50. Modelo 3D feito pelas fotos por
     D:\Area de trabalho\modelos-3d\dji_agras_t70p\gerar_t70p.py (versao sem marca). */
  window.MARCAS.dji.modelos.push(base({
    id: "t70p", nome: "Agras T70P", modeloOficial: "DJI Agras T70P", ano: 2025, somenteAdmin: true,
    specs: {
      pesoVazio: 56, pesoComBateria: 56,        // "Basic Empty Weight" do manual (126 kg - 70 kg de carga)
      mtowPulverizacao: 126, mtowDispersao: 126, // 126 kg com 2 bicos, 130 kg com 4; dispersao nao consta
      entreEixos: 2.44, dimensoesAbertas: [3.2, 3.52, 0.96],
      tanque: 70, cargaPulverizacao: 70,
      rotores: 4, heliceDiametro: 1.5748,       // 62", um rotor por braco
      aspersores: 2, gotaMin: 50, gotaMax: 500,
      faixaMin: 4, faixaMax: 11,
      vazaoMax2Bicos: 30, vazaoMax4Bicos: 40,
      bateriaCapacidade: 41,                    // Ah (41000 mAh)
      vooParadoVazio: 21.5, vooParadoCheio: 7,  // 70 kg e 126 kg de decolagem
      velocidadeMaxObstaculo: 13.8, velocidadeMax: 13.8,
      ventoMax: 6, tempMin: 0, tempMax: 40,
    },
    modelo3d: { arquivo: "assets/modelos/dji_t70p.glb", escala: 1,
      origem: "dji_agras_t70p_sem_marca.glb (26/10/2026): 4 rotores, 2 bicos nos bracos de tras, tanque de 70 L" },
    conferir: ["alcance do radar, vazao e dispersao (o manual remete ao site e as revendas divergem)"],
  }));

  /* DJI Air 2S (13/10/2026, so administrador): categoria "Mapeamento / voo livre".
     Nao pulveriza: e o drone de imagem para conhecer a area voando livre. Controle
     RC-N1 (sem tela) com o celular no suporte; a tela do celular e a do app de voo
     (js/campo/app_fly.js). Ficha oficial: dji.com/support/product/air-2s (conferida
     13/10/2026). Modelos 3D feitos por D:\Area de trabalho\modelos-3d\dji_air2s e
     \controle_rc_n1 (versoes sem marca). */
  window.MARCAS.dji.modelos.push(base({
    id: "air2s", nome: "Air 2S", modeloOficial: "DJI Air 2S", ano: 2021, somenteAdmin: true,
    categoria: "Mapeamento / voo livre", vooLivre: true,
    specs: {
      pesoVazio: 0.595, pesoComBateria: 0.595,
      mtowPulverizacao: 0.595, mtowDispersao: 0.595,
      entreEixos: 0.302, dimensoesAbertas: [0.183, 0.253, 0.077],
      tanque: 0, cargaPulverizacao: 0, aspersores: 0, vazaoMax2Bicos: 0, vazaoMax4Bicos: 0,
      rotores: 4, heliceDiametro: 0.183,          // 7238F
      vooParadoVazio: 30, vooParadoCheio: 30,     // 30 min pairando, 31 min voando (sem vento)
      velocidadeMax: 15, velocidadeMaxSport: 19, velocidadeMaxCine: 5,
      subidaMax: 6, descidaMax: 6, giroMaxGraus: 90,   // modo N: 90 graus/s
      velocidadeMaxObstaculo: 15, radarAlcance: 0,
      ventoMax: 10.7, tempMin: 0, tempMax: 40,
      cameraFov: 88, cameraSensor: "1 pol. 20 MP", gimbalMin: -90, gimbalMax: 0,
    },
    modelo3d: { arquivo: "assets/modelos/dji_air2s.glb", escala: 1,
      origem: "dji_air2s_sem_marca.glb (13/10/2026): gimbal com camera de 1 pol., 4 rotores dobraveis" },
    controle3d: "assets/modelos/dji_rc_n1.glb",
    conferir: [],
  }));

  /* EAVision: o aparelho e o app EAV (controle-app/j100*.js) valem para os dois. */
  window.MARCAS.eavision.modelos = [
    /* J100: manual oficial EA-J100 3WWDZ-45A (apendice "Specifications"). */
    base({
      id: "j100", nome: "J100", modeloOficial: "EA-J100 (3WWDZ-45A)", ano: 2024, somenteAdmin: true,
      specs: {
        pesoVazio: 54.6, pesoComBateria: 54.6,  // manual: 54,6 kg com bateria
        mtowPulverizacao: 100, mtowDispersao: 105,
        entreEixos: 2.26, dimensoesAbertas: [2.95, 3.1, 0.82],
        tanque: 45, cargaPulverizacao: 45,       // 60 L opcional
        rotores: 4, heliceDiametro: 1.4224,      // 56" (modelo 5620)
        motorPotencia: 4000,
        aspersores: 2,                           // atomizadores EAV-CCMS50, 2 ou 4
        gotaMin: 10, gotaMax: 300,
        faixaMin: 4, faixaMax: 10,
        vazaoMax2Bicos: 24, vazaoMax4Bicos: 24,  // 2 bombas de 12 L/min
        bateriaCapacidade: 29,
        vooParadoVazio: 16.5, vooParadoCheio: 7,
        radarAlcance: 40,                        // lidar frontal 40 m efetivo, radar 360 40 m
        velocidadeMaxObstaculo: 10, velocidadeMax: 10,
        ventoMax: 12, tempMin: -10, tempMax: 45,
        tanqueDispersao: 70, cargaDispersao: 50, faixaDispersaoMin: 3, faixaDispersaoMax: 10,
      },
      modelo3d: { arquivo: "assets/modelos/eavision_j100.glb", escala: 1,
        origem: "Eavision_J100.glb (revisao 2, 12/10/2026): 2 atomizadores traseiros" },
      conferir: [],
    }),
    /* J150: ficha oficial eavision.com/spraying-drones/j150-specs (conferida 13/10/2026). */
    base({
      id: "j150", nome: "J150", modeloOficial: "EA-J150", ano: 2025, somenteAdmin: true,
      specs: {
        pesoVazio: 75, pesoComBateria: 75,
        mtowPulverizacao: 145, mtowDispersao: 149.9,
        entreEixos: 2.58, dimensoesAbertas: [3.375, 3.51, 0.95],
        tanque: 70, cargaPulverizacao: 70,
        rotores: 4, heliceDiametro: 1.6,
        aspersores: 4,                           // atomizadores EAV-CCMS60, 2 ou 4
        gotaMin: 10, gotaMax: 300,
        faixaMin: 4, faixaMax: 15,
        vazaoMax2Bicos: 40, vazaoMax4Bicos: 40,
        bateriaCapacidade: 45,                   // CTB 45 Ah
        vooParadoVazio: 16, vooParadoCheio: 7,   // ficha nao traz
        radarAlcance: 60,                        // radares 4D 60 m efetivos, lidar 80 m
        velocidadeMaxObstaculo: 13.8, velocidadeMax: 13.8,
        ventoMax: 12, tempMin: -10, tempMax: 45,
        tanqueDispersao: 100, cargaDispersao: 100, faixaDispersaoMin: 3, faixaDispersaoMax: 8,
      },
      modelo3d: { arquivo: "assets/modelos/eavision_j150.glb", escala: 1,
        origem: "Eavision_J150.glb (12/10/2026): 4 atomizadores nos bracos de tras" },
      conferir: ["autonomia vazio e cheio (a ficha oficial nao traz)"],
    }),
  ];
})();
