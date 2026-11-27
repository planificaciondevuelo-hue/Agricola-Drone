/* ----------------------------------------------------------------------
   Cenários de MAPA REAL no campo (feitos no "Gerador de Mapas Reais").

   O gerador grava em treinamento/cenarios/:
     lista.json            [{arquivo, id:"real-...", nome, nivel, desc, area_ha}]
     <nome>.cenario.json   relevo, foto aérea, talhão, base, árvores, casas, rede

   Este arquivo NÃO edita o campo nem a ponte: embrulha PONTE.criar por fora
   (mesma regra do resto da integração). Com ?cenario=real-xxx na URL o campo
   abre no mapa real; no Treino livre os mapas reais aparecem no seletor de
   terreno, depois de Fácil/Médio/Difícil.

   O que vira o quê no campo:
     relevo         -> altura(x,z) do cenário (o chão do jogo segue o mapa)
     foto aérea     -> malha por cima do chão, com a beirada esfumada
     árvores        -> arvores() do jogo (colidem e aparecem ao radar)
     casas          -> predio() do jogo
     rede           -> redeEletrica() do jogo (o fio só é visto de perto)
     talhão / base  -> TALHAO e BASE do jogo, centrados onde o jogo pinta a
                       cobertura (a caixa de pintura é fixa: talhão até
                       ~240 x 280 m cabe inteiro)
   ---------------------------------------------------------------------- */
(function () {
  "use strict";
  if (!window.PONTE) return;

  var pedido = new URLSearchParams(location.search).get("cenario") || "";
  var ehReal = function (id) { return /^real-/.test(id || ""); };

  /* Aluno da area de conta so ve os mapas que comprou na Loja de mapas
     (conta/contas.js grava a lista em tpd_sessao.mapas ao iniciar a sessao)
     E que estao liberados em cenarios/loja.json. Mapa novo do gerador nasce
     bloqueado; os da propriedade do Eduardo ficam bloqueados.
     Quem entra por codigo de turma (so neste computador) ve todos. */
  var loja = fetch("cenarios/loja.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; });
  var liberados = loja.then(function (d) { return (d && d.liberados) || []; });
  /* "gratis" na loja.json: abertos a todo aluno com conta, sem comprar */
  var gratis = loja.then(function (d) { return (d && d.gratis) || []; });

  function soDaConta(l) {
    try {
      var s = JSON.parse(window.localStorage.getItem("tpd_sessao") || "null");
      if (!s || s.origem !== "conta") return l;
      var meus = s.mapas || [];
      return Promise.all([liberados, gratis]).then(function (r) {
        var lib = r[0], livre = r[1];
        return l.filter(function (x) { return livre.indexOf(x.id) !== -1 || (meus.indexOf(x.id) !== -1 && lib.indexOf(x.id) !== -1); });
      });
    } catch (e) { return l; }
  }

  var lista = fetch("cenarios/lista.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(soDaConta)
    .catch(function () { return []; });
  var cache = {};

  /* Mapas de aplicação do próprio aluno ("Gerenciar mapa de aplicação" na
     tela inicial do campo): o .cenario.json que ele gerou fica guardado
     NESTE navegador (IndexedDB - o arquivo tem vários MB, não cabe no
     localStorage). Não passam pela Loja: o mapa é dele. Id "real-meu-...". */
  var ehMeu = function (id) { return /^real-meu-/.test(id || ""); };
  var meus = {
    chamar: function (dados) {
      if (!window.CONTAS) return Promise.reject(new Error('Entre na sua conta para usar seus mapas.'));
      return CONTAS.mapasDaConta(dados);
    },
    listar: function () { return this.chamar({acao:'listar'}).then(function(r){return r.mapas.concat(r.recebidos||[]).map(function(m){return Object.assign(m,{meu:true});});}); },
    ler: function (id) { return this.chamar({acao:'ler',id:id}); },
    guardar: function (m) { return this.chamar({acao:'guardar',mapa:m.dados}).then(function(r){return Object.assign(r,{meu:true});}); },
    remover: function (id) { delete cache[id]; return this.chamar({acao:'remover',id:id}); }
  };

  function semAcento(t) { return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }

  /* arquivo escolhido pelo aluno -> mapa guardado (ou erro em português) */
  function lerArquivo(arquivo) {
    if (!arquivo) return Promise.reject(new Error("Escolha o arquivo do mapa."));
    if (arquivo.size > 20 * 1024 * 1024) return Promise.reject(new Error("O mapa deve ter até 20 MB."));
    return arquivo.text().then(function (texto) {
      var d;
      try { d = JSON.parse(texto); } catch (e) { throw new Error("Este arquivo não é um mapa: não deu para ler como .cenario.json."); }
      if (!d || !d.relevo || !d.area || !d.textura || !(d.area.larg > 0)) {
        throw new Error("Este arquivo não é um mapa do Gerador de Mapas Reais (.cenario.json).");
      }
      var nome = String(d.nome || arquivo.name.replace(/\.cenario\.json$|\.json$/i, "")).trim().slice(0, 60) || "Meu mapa";
      var slug = semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "mapa";
      var id = "real-meu-" + slug;
      var area = Math.round(d.area.larg * d.area.prof / 1000) / 10;
      d.id = id;
      d.nome = nome;
      if (!Array.isArray(d.nivel)) d.nivel = ["Médio", "m"];
      d.arvores = d.arvores || [];
      d.construcoes = d.construcoes || [];
      d.objetos = [];   // modelos .glb/.obj ficam na pasta do gerador, não vêm no arquivo
      delete cache[id];
      return meus.guardar({ id: id, nome: nome, desc: d.desc || "", area_ha: area, em: new Date().toISOString(), dados: d });
    });
  }

  function baixar(id) {
    if (ehMeu(id)) {
      cache[id] = meus.ler(id).then(function (m) {
        if (!m) throw new Error("O mapa não está mais disponível nesta conta: " + id);
        return m.dados;
      });
    }
    if (!cache[id]) {
      cache[id] = lista.then(function (l) {
        var e = l.filter(function (x) { return x.id === id; })[0];
        if (!e) throw new Error("mapa real não está em cenarios/lista.json: " + id);
        return fetch("cenarios/" + encodeURIComponent(e.arquivo), { cache: "no-cache" }).then(function (r) {
          if (!r.ok) throw new Error("não abriu cenarios/" + e.arquivo);
          return r.json();
        });
      });
    }
    return cache[id];
  }

  /* Roda DENTRO do campo (janela.eval): ali CENARIOS, TALHAO, BASE, mundo,
     arvores, predio e redeEletrica existem como globais do jogo. */
  var INSTALAR = String(function () {
    if (window.__xgReal) return;
    var ORIG = { talhao: Object.assign({}, TALHAO), base: Object.assign({}, BASE) };
    window.__xgReal = { registrar: registrarCenario };

    /* TALHAO e BASE valem desde o começo de construirCenario (cor do chão,
       palha, marcos de canto, camionete): por isso são trocados ANTES dele */
    /* Radar de altura da aeronave: com acompanhamento de terreno ligado, o
       radar mede até o TOPO da cultura, não até o chão (milho de 2,4 m com
       altura 3 m = 3 m acima do pendão). Só na operação: nos deslocamentos
       (altura de RTH, contada da decolagem) não há acompanhamento. */
    if (typeof alturaAlvo === "function") {
      var alvoSemCultura = alturaAlvo;
      alturaAlvo = function (agl) {
        var y = alvoSemCultura(agl);
        var hc = window.__xgDossel;
        /* 18/11/2026: na ida ao ponto inicial (altura programada desde 23/10) tambem nao ha acompanhamento (manual.js) */
        if (!hc || !P.estab || agl === P.rth || (V.estado === "indo" && !window.xgVooXag)) return y;
        var d = drone.position, olhar = Math.max(1.5, V.v * (P.terreno === "montanha" ? 1.1 : 0.5));
        return y + Math.max(hc(d.x, d.z), hc(d.x + V.dirx * olhar, d.z + V.dirz * olhar));
      };
    }

    var construirOrig = construirCenario;
    construirCenario = function (c) {
      window.__xgDossel = null;   // cada cenário real põe o seu em montar()
      Object.assign(TALHAO, c.real ? c.real.talhao : ORIG.talhao);
      Object.assign(BASE, c.real ? c.real.base : ORIG.base);
      return construirOrig(c);
    };

    /* não pode se chamar "registrar": esconderia o registrar() do jogo,
       que põe obstáculo (poste e fio sumiam do radar e da colisão) */
    /* GADO (24/10/2026, Eduardo: "da pra ate colocar alguns bois ali", mapa da pastagem). O .cenario.json pode trazer "animais"
       ([{x, z, rot, cor}], rot em radianos no sentido do jogo para as caixas de colisao); a pastagem do treinamento (real-pasto-arvores) nao
       traz, entao ganha 4 grupos de 4 a 7 bois sorteados sempre iguais, longe das arvores, da base e da borda. Boi feito em codigo (sem
       arquivo): tronco, cupim, pescoco, cabeca, chifres, patas e rabo juntos numa malha, o rebanho todo num InstancedMesh. Cada boi e obstaculo. */
    function boiGeometria() {
      var partes = [];
      var esf = new THREE.SphereGeometry(1, 10, 8), cil = new THREE.CylinderGeometry(1, 1, 1, 8), cone = new THREE.ConeGeometry(1, 1, 6);
      function parte(geo, cor, x, y, z, sx, sy, sz, rx, ry, rz) {
        var m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz));
        var g = geo.clone().applyMatrix4(m), n = g.attributes.position.count, c = new Float32Array(n * 3), k = new THREE.Color(cor);
        for (var i = 0; i < n; i++) { c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b; }
        g.setAttribute("color", new THREE.BufferAttribute(c, 3)); g.deleteAttribute("uv");
        partes.push(g);
      }
      /* nelore: tronco comprido e reto, corcova, pescoco e cabeca mais escuros, chifres, orelhas, papada, pernas longas, rabo com pincel */
      parte(cil, "#ffffff", 0, 1.12, 0, 0.52, 1.55, 0.46, 0, 0, Math.PI / 2);   // tronco
      parte(esf, "#f2efe8", 0.78, 1.12, 0, 0.5, 0.52, 0.46);         // peito
      parte(esf, "#ebe7de", -0.78, 1.1, 0, 0.5, 0.5, 0.46);          // garupa
      parte(esf, "#a39d92", 0.62, 1.58, 0, 0.34, 0.34, 0.3);         // cupim (corcova)
      parte(cil, "#a8a297", 1.25, 1.2, 0, 0.2, 0.78, 0.22, 0, 0, -1.45);   // pescoco
      parte(esf, "#b5afa4", 1.05, 0.85, 0, 0.3, 0.3, 0.14);          // papada
      parte(esf, "#9a948a", 1.72, 1.05, 0, 0.36, 0.2, 0.18, 0, 0, -0.3);   // cabeca
      parte(esf, "#6f685f", 2.02, 0.93, 0, 0.14, 0.11, 0.13);        // focinho
      parte(cil, "#d6d1c6", -1.42, 0.95, 0, 0.03, 0.9, 0.03, 0, 0, 0.12);   // rabo
      parte(esf, "#3a3530", -1.48, 0.45, 0, 0.07, 0.15, 0.07);       // pincel do rabo
      [-1, 1].forEach(function (l) {
        parte(esf, "#8f897f", 1.5, 1.17, l * 0.3, 0.17, 0.05, 0.13);   // orelha
        parte(cone, "#3a3530", 1.62, 1.3, l * 0.15, 0.04, 0.32, 0.04, l * 0.55, 0, 0.45);   // chifre
        [0.7, -0.7].forEach(function (px) {
          parte(cil, "#a39d92", px, 0.37, l * 0.2, 0.09, 0.74, 0.09);   // pata
          parte(cil, "#2e2a26", px, 0.04, l * 0.2, 0.11, 0.1, 0.11);    // casco
        });
      });
      return THREE.BufferGeometryUtils.mergeBufferGeometries(partes);
    }
    function rebanhoDoPasto(d) {
      var s = 20261024, r = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      var A = d.area, base = d.base || { x: A.x0 + A.larg / 2, z: A.z0 + A.prof / 2 }, out = [];
      var cores = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#b88a5a", "#6b4a32", "#3a3633"];
      function livre(x, z, folga) {
        if (x < A.x0 + 25 || x > A.x0 + A.larg - 25 || z < A.z0 + 25 || z > A.z0 + A.prof - 25) return false;
        if (Math.hypot(x - base.x, z - base.z) < 45) return false;
        for (var i = 0; i < d.arvores.length; i++) { var a = d.arvores[i]; if (Math.hypot(x - a.x, z - a.z) < (a.copa || 2) + folga) return false; }
        return true;
      }
      for (var h = 0, tent = 0; h < 4 && tent < 600; tent++) {
        var cx = A.x0 + 25 + r() * (A.larg - 50), cz = A.z0 + 25 + r() * (A.prof - 50);
        if (!livre(cx, cz, 6)) continue;
        var n = 4 + Math.floor(r() * 4), dir = r() * 6.283;
        for (var k = 0, t2 = 0; k < n && t2 < 120; t2++) {
          var ax = cx + (r() - 0.5) * 26, az = cz + (r() - 0.5) * 26;
          if (!livre(ax, az, 2.5) || out.some(function (o) { return Math.hypot(o.x - ax, o.z - az) < 3.4; })) continue;
          out.push({ x: ax, z: az, rot: dir + (r() - 0.5) * 1.4, cor: cores[Math.floor(r() * cores.length)] }); k++;
        }
        h++;
      }
      return out;
    }
    function gado(d, dx, dz, altura) {
      var lista = d.animais || (d.id === "real-pasto-arvores" && d.area && d.arvores ? rebanhoDoPasto(d) : null);
      if (!lista || !lista.length) return;
      var im = new THREE.InstancedMesh(boiGeometria(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), lista.length), cc = new THREE.Color();
      lista.forEach(function (b, i) {
        var x = b.x + dx, z = b.z + dz, y = altura(x, z), e = 0.78 * (0.92 + ((i * 7) % 5) / 25);
        im.setMatrixAt(i, matriz(x, y - 0.03, z, -(b.rot || 0), e, e, e));
        cc.set(b.cor || "#ffffff"); im.setColorAt(i, cc);
        registrar({ tipo: "caixa", x: x, z: z, sx: 3.4 * e, sz: 1.2 * e, rot: b.rot || 0, y0: y, y1: y + 2.0 * e, nome: "o boi",
          dica: "Gado solto no pasto: o boi e um obstaculo baixo (1,5 m). Marque a area dele no planejamento e passe com folga; o animal pode se assustar com o drone." });
      });
      im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.name = "gadoDoMapaReal";
      mundo.add(im);
    }

    function registrarCenario(d) {
      var ja = CENARIOS.filter(function (c) { return c.id === d.id; })[0];
      if (ja) return d.id;

      /* talhão é opcional no gerador: sem ele, vale o mapa inteiro (o aluno
         mapeia o talhão no controle, como no campo) */
      var temTalhao = d.talhao && d.talhao.length >= 3;
      var contorno = temTalhao ? d.talhao : [[d.area.x0, d.area.z0], [d.area.x0 + d.area.larg, d.area.z0 + d.area.prof]];
      var xs = contorno.map(function (p) { return p[0]; }), zs = contorno.map(function (p) { return p[1]; });
      var bx0 = Math.min.apply(null, xs), bx1 = Math.max.apply(null, xs);
      var bz0 = Math.min.apply(null, zs), bz1 = Math.max.apply(null, zs);
      /* o centro do talhão vai para o centro do TALHAO original do jogo */
      var dx = (ORIG.talhao.x0 + ORIG.talhao.larg / 2) - (bx0 + bx1) / 2;
      var dz = (ORIG.talhao.z0 + ORIG.talhao.prof / 2) - (bz0 + bz1) / 2;

      var R = d.relevo, A = d.area, bin = atob(R.dados), n = bin.length >> 1;
      var h = new Float32Array(n);
      for (var i = 0; i < n; i++) h[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) * R.escala;
      function hReal(x, z) {
        var gx = (x - A.x0) / A.larg * (R.nx - 1), gz = (z - A.z0) / A.prof * (R.nz - 1);
        gx = Math.max(0, Math.min(R.nx - 1.001, gx)); gz = Math.max(0, Math.min(R.nz - 1.001, gz));
        var a = Math.floor(gx), b = Math.floor(gz), fx = gx - a, fz = gz - b, k = b * R.nx + a;
        return h[k] * (1 - fx) * (1 - fz) + h[k + 1] * fx * (1 - fz) + h[k + R.nx] * (1 - fx) * fz + h[k + R.nx + 1] * fx * fz;
      }
      var h0 = hReal((bx0 + bx1) / 2, (bz0 + bz1) / 2);
      var altura = function (x, z) { return hReal(x - dx, z - dz) - h0; };

      var tl = new THREE.TextureLoader();
      var foto = tl.load(d.textura); foto.encoding = THREE.sRGBEncoding;
      foto.anisotropy = render.capabilities.getMaxAnisotropy();
      var mascara = tl.load(d.mascara);
      var mv = function (p) { return { x: p.x + dx, z: p.z + dz }; };

      CENARIOS.push({
        id: d.id, nome: d.nome, nivel: d.nivel, desc: d.desc,
        terrenoSugerido: d.terrenoSugerido || "planicie",
        altura: altura,
        real: {
          talhao: { x0: bx0 + dx, z0: bz0 + dz, larg: bx1 - bx0, prof: bz1 - bz0 },
          /* base opcional: sem ela, fica no meio do talhão (ou do mapa) */
          base: d.base ? mv(d.base) : { x: (bx0 + bx1) / 2 + dx, z: (bz0 + bz1) / 2 + dz },
          poligono: temTalhao ? d.talhao.map(function (p) { return [p[0] + dx, p[1] + dz]; }) : null,
          /* 14/10/2026: a area inteira das fotos, para a cerca virtual (cerca_virtual.js) */
          area: { x0: A.x0 + dx, z0: A.z0 + dz, larg: A.larg, prof: A.prof },
        },
        montar: function () {
          /* a palha de lavoura colhida do jogo é desenho, não o mapa: sai */
          mundo.children.forEach(function (o) { if (o.isInstancedMesh && o.count === 120000) o.visible = false; });

          var sx = Math.min(500, Math.ceil(A.larg / 1.5)), sz = Math.min(500, Math.ceil(A.prof / 1.5));
          var g = new THREE.PlaneGeometry(A.larg, A.prof, sx, sz);
          g.rotateX(-Math.PI / 2);
          g.translate(A.x0 + A.larg / 2 + dx, 0, A.z0 + A.prof / 2 + dz);
          var p = g.attributes.position;
          for (var i = 0; i < p.count; i++) p.setY(i, altura(p.getX(i), p.getZ(i)) + 0.04);
          g.computeVertexNormals();
          var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
            map: foto, alphaMap: mascara, transparent: true, depthWrite: false, roughness: 0.95,
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
          }));
          m.renderOrder = -1; m.receiveShadow = true; m.name = "fotoDoMapaReal";
          mundo.add(m);

          if (d.arvores.length) arvores(d.arvores.map(function (a) {
            return { x: a.x + dx, z: a.z + dz, alt: a.alt, copa: a.copa, eucalipto: !!a.eucalipto, seca: !!a.seca, palito: !!a.palito };   /* 24/10/2026: arvore seca e palito vindos do mapa */
          }), "as árvores do mapa");
          try { gado(d, dx, dz, altura); } catch (e) { console.warn("[mapa real] gado", e); }   /* 24/10/2026: bois na pastagem */
          d.construcoes.forEach(function (c) {
            predio(c.x + dx, c.z + dz, c.larg, c.prof, c.alt, c.rot || 0,
              c.corParede || "#d9d2c3", c.corTelhado || "#8a4b35", c.tipo === "galpao" ? "o galpão" : "a casa");
          });
          /* rede (monofásica, baixa tensão, trifásica) e cabo de fibra pelo
             estruturas_reais.js - o mesmo desenho do gerador. Postes e fios
             entram como obstáculo; o fio, como no jogo, o radar só vê de perto. */
          var ER = window.parent && window.parent.EstruturasReais;
          var redesM = (d.redes || []).map(function (r) {
            return Object.assign({}, r, { pontos: r.pontos.map(function (q) { return [q[0] + dx, q[1] + dz]; }) });
          });
          if (ER) {
            var casasM = d.construcoes.map(function (c) { return Object.assign({}, c, { x: c.x + dx, z: c.z + dz }); });
            var fibrasM = (d.fibras || []).map(function (f) {
              return { altura: f.altura, pontos: f.pontos.map(function (q) { return { x: q.x + dx, z: q.z + dz, apoio: q.apoio || null }; }) };
            });
            var DICA_FIO = "Fio fino quase não aparece para o radar: ele só enxerga de muito perto e a aeronave não para a tempo. Perto de rede ou de cabo, reduza a velocidade, passe bem acima ou marque como obstáculo.";
            var montarEm = function (r) {
              r.grupo.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
              mundo.add(r.grupo);
              (r.postes || []).forEach(function (q) {
                registrar({ tipo: "cil", x: q.x, z: q.z, r: 0.35, y0: q.y0, y1: q.y1, nome: "o poste",
                  dica: "O radar detecta poste. Sem desvio de obstáculos, marque cada poste no planejamento do campo." });
              });
              r.segmentos.forEach(function (sg) {
                registrar({ tipo: "seg", a: sg.a, b: sg.b, r: sg.raio || 0.03, fio: sg.fio !== false, nome: sg.nome, dica: sg.fio === false ? "Torre de transmissão: confira a estrutura, os braços e os estais antes de planejar o voo." : DICA_FIO });
              });
            };
            if (redesM.length) montarEm(ER.redes(THREE, redesM, altura));
          /* objetos 3D que a pessoa importou no gerador (.glb/.obj): o obstáculo
             entra na hora, com a base medida no gerador; o modelo chega depois */
          (d.objetos || []).forEach(function (o) {
            var x = o.x + dx, z = o.z + dz, y = altura(x, z);
            registrar({ tipo: "caixa", x: x, z: z, sx: (o.larg || 2) + 0.6, sz: (o.prof || 2) + 0.6, rot: o.rot || 0, y0: y, y1: y + o.altura,
              nome: (o.nome || "o objeto").toLowerCase(), dica: "Objeto alto perto da rota: marque como obstáculo no planejamento e confira a altura de voo e a de RTH." });
            var url = new URL("cenarios/" + o.arquivo, window.parent.location.href).href;
            var pronto = function (obj) {
              obj.updateMatrixWorld(true);
              var bx = new THREE.Box3().setFromObject(obj), e = o.altura / Math.max(1e-6, bx.max.y - bx.min.y), t = o.rot || 0;
              var cx = (bx.min.x + bx.max.x) / 2 * e, cz = (bx.min.z + bx.max.z) / 2 * e;
              obj.scale.setScalar(e); obj.rotation.y = t;
              obj.position.set(x - (cx * Math.cos(t) + cz * Math.sin(t)), y - bx.min.y * e, z - (-cx * Math.sin(t) + cz * Math.cos(t)));
              obj.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
              if (cen.id === d.id) mundo.add(obj);
            };
            var falhou = function (e) { console.warn("[mapa real] modelo não abriu", o.arquivo, e); };
            if (/\.obj$/i.test(o.arquivo)) new THREE.OBJLoader().load(url, pronto, undefined, falhou);
            else new THREE.GLTFLoader().load(url, function (g) { pronto(g.scene); }, undefined, falhou);
          });
            if (fibrasM.length) montarEm(ER.fibras(THREE, fibrasM, altura, casasM));
          } else {
            redesM.forEach(function (r) { redeEletrica(r.pontos, r.altura || 9.5, r.flecha || 0.9, r.tipo || "baixa tensão"); });
          }

          /* culturas e daninhas pintadas no gerador: desenhadas por
             plantas_reais.js (o mesmo arquivo do editor): pés de verdade em
             volta do drone e do operador, "copa" no resto do talhão */
          var PR = window.parent && window.parent.PlantasReais;
          if (window.__xgPlantas) { clearInterval(window.__xgPlantas.timer); window.__xgPlantas.g.descartar(); window.__xgPlantas = null; }
          if (d.plantio && PR) {
            /* o dossel pintado no chão: é o que se vê além dos 40 m */
            var pl = d.plantio, gd = g.clone();
            var uv = gd.attributes.uv, pos = gd.attributes.position;
            for (var u = 0; u < uv.count; u++) {   // a grade da pintura tem o próprio retângulo
              uv.setXY(u, (pos.getX(u) - dx - pl.x0) / (pl.nx * pl.res), 1 - (pos.getZ(u) - dz - pl.z0) / (pl.nz * pl.res));
              pos.setY(u, pos.getY(u) + 0.03);
            }
            var md = new THREE.Mesh(gd, new THREE.MeshStandardMaterial({ map: PR.dossel(THREE, pl, document), transparent: true,
              depthWrite: false, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
            md.renderOrder = -0.5; md.receiveShadow = true; md.name = "dosselDoMapaReal";
            mundo.add(md);
            /* altura do dossel em cada ponto (estádio pintado) */
            var cul = PR.b64(pl.culturas), hEst = pl.paleta.map(function (e) {
              var def = PR.CULTURAS[e.cultura], est = def && def.estagios.filter(function (s) { return s.id === e.estagio; })[0];
              return est ? est.h : 0;
            });
            var alturaPes = PR.alturaPerenes ? PR.alturaPerenes(pl) : function () { return 0; };
            window.__xgDossel = function (x, z) {
              var i = Math.floor((x - dx - pl.x0) / pl.res), j = Math.floor((z - dz - pl.z0) / pl.res);
              if (i < 0 || j < 0 || i >= pl.nx || j >= pl.nz) return alturaPes(x - dx, z - dz);
              var v = cul[j * pl.nx + i];
              return Math.max(v ? hEst[v - 1] || 0 : 0, alturaPes(x - dx, z - dz));
            };
            /* a calda molha a FOLHA: a camada que o jogo pinta sobe para o topo
               da cultura (senão some debaixo do milho e do algodão) */
            mundo.children.forEach(function (o) {
              if (!o.isMesh || o.material.map !== pintTx) return;
              var q = o.geometry.attributes.position;
              for (var u = 0; u < q.count; u++) q.setY(u, q.getY(u) + window.__xgDossel(q.getX(u), q.getZ(u)));
              q.needsUpdate = true; o.geometry.computeBoundingSphere();
              o.material.opacity = 0.6;   // em cima da folha lê como "molhado", não como terra
            });
            /* pés de verdade perto do drone e do operador, "copa" fotografada no
               resto do talhão; os pedaços novos entram aos poucos (sem engasgo) */
            var plantas = PR.criar(THREE, { plantio: pl, alt: altura, dx: dx, dz: dz, grupo: mundo, raioPerto: 18, documento: document });
            plantas.atualizarVarios([{ x: drone.position.x, z: drone.position.z }, { x: grupoOperador.position.x, z: grupoOperador.position.z }], true);
            var timer = setInterval(function () {
              if (cen.id !== d.id) { clearInterval(timer); plantas.descartar(); return; }
              var o = grupoOperador.position, a = drone.position;
              plantas.atualizarVarios([{ x: a.x, z: a.z }, { x: o.x, z: o.z }]);
            }, 100);
            window.__xgPlantas = { g: plantas, timer: timer };
          }
        },
      });
      return d.id;
    }
  });

  function registrarNoCampo(ponte, dados) {
    var j = ponte.janela;
    if (!j) return false;
    if (!j.__xgReal) j.eval("(" + INSTALAR + ")()");
    j.__xgReal.registrar(dados);
    return true;
  }

  function construirReal(ponte, id) {
    return ponte.ler(
      "(function(){ var c = CENARIOS.filter(function(x){return x.id===" + JSON.stringify(id) + "})[0];" +
      " if (!c) return false;" +
      " if (typeof cen==='undefined' || cen.id !== c.id) { construirCenario(c); reiniciarVoo(); posCamera(true,0);" +
      "   if (typeof montarLista==='function') montarLista(); }" +
      " return true; })()"
    ) === true;
  }

  var criarOrig = window.PONTE.criar;
  window.PONTE.criar = function (iframe) {
    var p = criarOrig(iframe);
    var esperarOrig = p.esperar, embutirOrig = p.embutir, trocarOrig = p.trocarCenario, seletorOrig = p.seletorDeTerreno;

    /* o mapa pedido na URL é baixado antes da montagem continuar */
    p.esperar = function (aoPronto, aoFalhar) {
      return esperarOrig.call(p, function (self) {
        if (!ehReal(pedido)) return aoPronto(self);
        baixar(pedido).then(function (d) { registrarNoCampo(p, d); }, function (e) { console.warn("[mapa real]", e); })
          .then(function () { aoPronto(self); });
      }, aoFalhar);
    };

    p.embutir = function (id) {
      var r = embutirOrig.call(p, id);   // telas e esconderijos do embutir valem igual
      if (ehReal(id)) construirReal(p, id);
      return r;
    };

    p.trocarCenario = function (id) {
      if (!ehReal(id)) return trocarOrig.call(p, id);
      baixar(id).then(function (d) { registrarNoCampo(p, d); construirReal(p, id); }, function (e) { console.warn("[mapa real]", e); });
      return true;
    };

    /* Treino livre: os mapas reais entram no fim do seletor de terreno */
    p.seletorDeTerreno = function (atual, aoEscolher) {
      var ok = seletorOrig.call(p, ehReal(atual) ? "plano" : atual, aoEscolher);
      if (!ok) return ok;
      /* 21/11/2026 (Eduardo, versão beta de avaliação da XAG: "aqui tem q ter os tres mapas so" — Coxilha, Baixada do
         açude e Encosta): aberto pelo conta/beta.html (?beta=1), o seletor fica só com os 3 terrenos do jogo, sem os
         mapas reais nem os do aluno. Fora do beta, nada muda. */
      try { if (new URLSearchParams(location.search).get("beta") === "1") return ok; } catch (e) { /* segue normal */ }
      var doc = p.janela.document, grupo = doc.getElementById("xgTerreno"), desc = doc.getElementById("xgTerrenoDesc");

      function botaoMapa(c) {
        var b = doc.createElement("button");
        b.type = "button"; b.dataset.cen = c.id; b.title = c.nome;
        b.textContent = c.nome.length > 18 ? c.nome.slice(0, 17) + "…" : c.nome;
        b.addEventListener("click", function () {
          p.trocarCenario(c.id);
          grupo.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          desc.textContent = c.nome + " (" + (c.compartilhado ? "mapa compartilhado" : c.meu ? "seu mapa de aplicação" : "mapa real") +
            (c.area_ha ? ", " + String(c.area_ha).replace(".", ",") + " ha" : "") + "). " + (c.desc || "");
          if (aoEscolher) aoEscolher(c.id);
        });
        grupo.appendChild(b);
        return b;
      }

      /* os da loja primeiro, depois os do aluno */
      Promise.all([lista, meus.listar().catch(function(){return [];})]).then(function (r) {
        r[0].concat(r[1]).forEach(function (c) {
          var b = botaoMapa(c);
          if (c.id === atual) b.click();
        });
      });

      gerenciarMapas(doc, grupo, botaoMapa);
      return ok;
    };
    return p;
  };

  /* Botão "Gerenciar mapa de aplicação" em cima do nível do terreno e a
     janela dele: adicionar o .cenario.json, treinar num mapa ou remover. */
  /* 08/10/2026: "Gerenciar mapa de aplicação" fora do menu (DJI e XAG) até a DJI
     responder ao pedido de autorização. Religar: MAPAS_DE_APLICACAO = true. */
  var MAPAS_DE_APLICACAO = false;
  function gerenciarMapas(doc, grupo, botaoMapa) {
    if (!MAPAS_DE_APLICACAO) return;
    if (doc.getElementById("xgGerenciar")) return;

    var estilo = doc.createElement("style");
    estilo.textContent =
      "#xgGerenciar{width:100%;margin:18px 0 0;padding:11px 12px;border-radius:9px;border:1.5px solid var(--linha);" +
        "background:rgba(255,255,255,.05);font-size:14px;font-weight:500;color:var(--texto);cursor:pointer}" +
      "#xgGerenciar:hover{border-color:var(--azul2)}" +
      "#xgMapas{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:rgba(7,9,12,.78)}" +
      "#xgMapas[hidden]{display:none}" +
      "#xgMapas .cx{width:min(460px,100%);max-height:100%;overflow-y:auto;background:#10161D;border:1px solid var(--linha);" +
        "border-radius:14px;padding:22px;color:var(--texto)}" +
      "#xgMapas h2{margin:0 0 6px;font-size:21px;font-weight:600}" +
      "#xgMapas .fr{margin:0 0 14px;font-size:13.5px;line-height:1.5;color:#B4BEC9}" +
      "#xgMapas ul{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:6px}" +
      "#xgMapas li{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--linha);border-radius:9px}" +
      "#xgMapas li span{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#xgMapas li small{color:var(--fraco)}" +
      "#xgMapas li button,#xgMapas .bt{padding:7px 11px;border-radius:8px;border:1.5px solid var(--linha);" +
        "background:rgba(255,255,255,.05);font-size:13px;color:var(--texto);cursor:pointer}" +
      "#xgMapas li button.tr{background:var(--azul);border-color:var(--azul)}" +
      "#xgMapas .bt.pr{width:100%;padding:12px;background:var(--azul);border-color:var(--azul);font-size:15px;font-weight:600}" +
      "#xgMapas .bt.fe{width:100%;margin-top:8px}" +
      "#xgMapas .msg{margin:10px 0 0;font-size:13.5px;line-height:1.45}" +
      "#xgMapas .msg:empty{display:none}" +
      "#xgMapas .msg.erro{color:#F08A74}#xgMapas .msg.ok{color:#8FD16A}";
    doc.head.appendChild(estilo);

    var abrir = doc.createElement("button");
    abrir.type = "button";
    abrir.id = "xgGerenciar";
    abrir.textContent = "Gerenciar mapa de aplicação";
    var rotulo = grupo.previousElementSibling;   // o "Nível do terreno"
    grupo.parentNode.insertBefore(abrir, rotulo);

    var janela = doc.createElement("div");
    janela.id = "xgMapas";
    janela.hidden = true;
    janela.innerHTML =
      '<div class="cx" role="dialog" aria-label="Mapas de aplicação">' +
        '<h2>Mapas de aplicação</h2>' +
        '<p class="fr">Coloque o arquivo .cenario.json gerado no Gerador de Mapas Reais. ' +
          'Entre com e-mail e senha. Sua conta tem 2 vagas para mapas próprios e outras 2 para compartilhados. Aceite convites em Meus mapas no site. Mapas antigos deste navegador podem ser reenviados pelo arquivo original.</p>' +
        '<ul></ul>' +
        '<button type="button" class="bt pr" data-a="adicionar">Adicionar mapa</button>' +
        '<button type="button" class="bt" data-a="legados">Recuperar mapas antigos deste navegador</button>' +
        '<input type="file" accept=".json,application/json" hidden>' +
        '<p class="msg" aria-live="polite"></p>' +
        '<button type="button" class="bt fe" data-a="fechar">Fechar</button>' +
      '</div>';
    doc.body.appendChild(janela);

    var ul = janela.querySelector("ul"), msg = janela.querySelector(".msg"), entrada = janela.querySelector("input");

    function avisar(texto, tipo) { msg.textContent = texto || ""; msg.className = "msg" + (tipo ? " " + tipo : ""); }

    function botaoDoMapa(id) {
      var bs = grupo.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) if (bs[i].dataset.cen === id) return bs[i];
      return null;
    }

    function desenhar() {
      meus.listar().then(function (l) {
        ul.innerHTML = "";
        if (!l.length) {
          var vazio = doc.createElement("li");
          vazio.innerHTML = "<span><small>Nenhum mapa seu ainda.</small></span>";
          ul.appendChild(vazio);
        }
        l.forEach(function (c) {
          var li = doc.createElement("li");
          var nome = doc.createElement("span");
          nome.textContent = c.nome + " ";
          var ha = doc.createElement("small");
          ha.textContent = String(c.area_ha).replace(".", ",") + " ha";
          nome.appendChild(ha);
          var treinar = doc.createElement("button");
          treinar.type = "button"; treinar.className = "tr"; treinar.textContent = "Treinar";
          treinar.addEventListener("click", function () {
            (botaoDoMapa(c.id) || botaoMapa(c)).click();
            janela.hidden = true;
          });
          var tirar = doc.createElement("button");
          tirar.type = "button"; tirar.textContent = "Remover";
          tirar.addEventListener("click", function () {
            if (!doc.defaultView.confirm("Remover o mapa \u201c" + c.nome + "\u201d da sua conta?")) return;
            meus.remover(c.id).then(function () {
              var b = botaoDoMapa(c.id);
              if (b) {
                var marcado = b.getAttribute("aria-pressed") === "true";
                b.remove();
                if (marcado && grupo.querySelector("button")) grupo.querySelector("button").click();
              }
              avisar("Mapa removido.", "ok");
              desenhar();
            }, function () { avisar("Não deu para remover o mapa.", "erro"); });
          });
          li.appendChild(nome); li.appendChild(treinar); li.appendChild(tirar);
          ul.appendChild(li);
        });
      }).catch(function(e){ avisar(e.message, 'erro'); });
    }

    abrir.addEventListener("click", function () { avisar(""); desenhar(); janela.hidden = false; });
    janela.addEventListener("click", function (e) {
      var a = e.target.dataset && e.target.dataset.a;
      if (a === "fechar" || e.target === janela) janela.hidden = true;
      if (a === "adicionar") entrada.click();
      if (a === "legados") {
        avisar('Buscando mapas locais antigos…');
        var pedidoLocal=indexedDB.open('tpd_mapas_aluno',1);
        pedidoLocal.onupgradeneeded=function(){pedidoLocal.result.createObjectStore('mapas',{keyPath:'id'});};
        pedidoLocal.onerror=function(){avisar('Não foi possível ler os mapas antigos.','erro');};
        pedidoLocal.onsuccess=function(){
          var db=pedidoLocal.result,tx=db.transaction('mapas','readonly'),r=tx.objectStore('mapas').getAll();
          tx.oncomplete=function(){db.close();};
          r.onsuccess=function(){
            var antigos=r.result||[];avisar(antigos.length?'Escolha quais mapas deseja enviar à conta. O limite continua sendo 2.':'Nenhum mapa antigo neste navegador.');
            ul.innerHTML='';antigos.forEach(function(m){
              var li=doc.createElement('li'),nome=doc.createElement('span'),bt=doc.createElement('button');nome.textContent=m.nome||'Mapa antigo';bt.textContent='Adicionar à conta';bt.type='button';
              bt.onclick=function(){bt.disabled=true;lerArquivo(new File([JSON.stringify(m.dados)],(m.nome||'mapa')+'.cenario.json',{type:'application/json'})).then(function(c){if(!botaoDoMapa(c.id))botaoMapa(c);avisar('Mapa adicionado à conta; a cópia antiga foi preservada.','ok');desenhar();}).catch(function(e){bt.disabled=false;avisar(e.message,'erro');});};
              li.appendChild(nome);li.appendChild(bt);ul.appendChild(li);
            });
          };
        };
      }
    });
    entrada.addEventListener("change", function () {
      var arquivo = entrada.files && entrada.files[0];
      entrada.value = "";
      if (!arquivo) return;
      avisar("Lendo o mapa\u2026");
      lerArquivo(arquivo).then(function (c) {
        if (!botaoDoMapa(c.id)) botaoMapa(c);
        avisar("Pronto! \u201c" + c.nome + "\u201d está nos seus mapas. Toque em Treinar para usar.", "ok");
        desenhar();
      }, function (e) {
        avisar(e && e.name === "QuotaExceededError" ? "Não há espaço neste navegador para guardar o mapa." : (e && e.message) || "Não deu para ler o mapa.", "erro");
      });
    });
  }

  window.CENARIO_REAL = { lista: function () { return lista; }, baixar: baixar };
})();
