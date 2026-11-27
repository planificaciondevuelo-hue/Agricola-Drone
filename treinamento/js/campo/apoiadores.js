/* ==========================================================================
   APOIADORES: painéis para as logos das empresas apoiadoras do simulador

   17/10/2026 (Eduardo): "prepare um lado da carretinha, lá eu quero colocar a
   logo de algumas empresas apoiadoras do simulador de drones, assim como a
   lateral da camionete, e nela vai dos dois lados".

   O que faz: cola, em cima das laterais dos modelos 3D, um adesivo branco (vinil)
   com as logos lado a lado, sem mexer nos .glb:
   - carretinha LM (equipe.js): UM lado, a tampa lateral, que é plana;
   - camionete RANZER (campo/index.html, camioneta()): os DOIS lados, na porta e
     na lateral da caçamba. O adesivo acompanha a curva da pintura (raios
     lançados de fora para dentro), por isso não "flutua" nem some na chapa.

   Enquanto a lista LOGOS estiver vazia, os painéis aparecem prontos e com
   espaços tracejados "LOGO" no lugar de cada empresa. Para colocar as logos:
     1. copie os arquivos (PNG com fundo transparente, ou SVG) para
        assets/apoiadores/ ;
     2. acrescente uma linha em LOGOS aqui embaixo, por exemplo
          { nome: "Empresa X", arquivo: "assets/apoiadores/empresa-x.png" },
        (o caminho vale a partir da raiz do projeto; "onde" é opcional e
        restringe a ["carretinha"] ou ["camionete"]; "marcas" é opcional e
        restringe à marca do drone, por exemplo ["xag"]: as revendas da XAG só
        aparecem nos drones XAG; sem "marcas" a logo vale para todos);
     3. na publicação: este arquivo entra no manifesto do simulador e as
        imagens vão no Hosting (assets/apoiadores/ não é bloqueada).
   As logos se organizam sozinhas em linhas e colunas, cada uma no maior
   tamanho que cabe no painel, mantendo a proporção.

   Chamado de:  xgApoiadores.carretinha(cena_do_glb)   (equipe.js)
                xgApoiadores.camionete(modelo)         (campo/index.html)
   Testar sem abrir o simulador: ferramentas/visualizador_apoiadores.html
   ========================================================================== */

window.xgApoiadores = (function () {
  "use strict";

  /* ------------------------------------------------------------------ LOGOS */
  var LOGOS = [
    /* em todos os drones */
    /* destaque: true = logo GRANDE (cerca de 60% do adesivo, 26/10/2026, pedido do Eduardo: "a power citros coloca um bem grandão ao lado");
       as outras logos dividem o resto */
    { nome: "Power Citros", arquivo: "assets/apoiadores/power-citros.png", destaque: true },
    { nome: "geoRTK", arquivo: "assets/apoiadores/geortk.svg" },
    /* revendas XAG: só quando o drone é da XAG (marca=xag na página do simulador) */
    { nome: "Fênix Aero Agro", arquivo: "assets/apoiadores/fenix-aero-agro.png", marcas: ["xag"] },
    { nome: "Caltech", arquivo: "assets/apoiadores/caltech.png", marcas: ["xag"] },
    { nome: "Fronteira Sul Drones", arquivo: "assets/apoiadores/fronteira-sul-drones.png", marcas: ["xag"] }
  ];

  /* ---------------------------------------------------------------- PAINÉIS
     Tudo no referencial do modelo (.glb): +Y para cima, Z ao longo do veículo,
     X para o lado. `lado` = -1 (X negativo) ou +1 (X positivo).
     z0..z1 = trecho ao longo do veículo, y0..y1 = altura, em metros.
     modo "plano": um quadrilátero em x = lado * xPlano (tampa lateral lisa).
     modo "superficie": segue a pintura (materiais), folga de 4 mm para fora. */
  var PAINEIS = {
    /* Tampa lateral da carretinha LM: face externa em x = -0,99 (rebites até
       -1,00), 3,28 m de comprimento; os puxadores ficam abaixo de y = 1,16. */
    carretinha: [
      { nome: "carretinha-esquerda", lado: -1, modo: "plano", xPlano: 1.004,
        z0: -1.58, z1: 1.58, y0: 1.20, y1: 2.16, vazios: 6 }
    ],
    /* Camionete RANZER (frente +Z, esquerda +X). Porta: entre o fim do capô e a
       coluna da cabine; caçamba: entre a cabine e a caixa da roda traseira. */
    camionete: [
      { nome: "camionete-porta", lados: [-1, 1], modo: "superficie", materiais: ["Pintura"],
        z0: 0.10, z1: 1.13, y0: 0.52, y1: 1.03, xPlano: 0.93, vazios: 2 },
      { nome: "camionete-cacamba", lados: [-1, 1], modo: "superficie", materiais: ["Pintura"],
        z0: -0.98, z1: -0.20, y0: 0.54, y1: 1.16, xPlano: 0.93, vazios: 2 }
    ]
  };

  var FOLGA = 0.004;          // distância do adesivo à chapa, em metros
  var COR_VINIL = "#f4f5f2";
  var COR_BORDA = "#c9cdca";
  var feitos = [];            // painéis criados: { canvas, textura, spec, onde }

  /* --------------------------------------------------------------- desenho */
  function arredondado(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  /* melhor divisão de n logos em linhas x colunas dentro de W x H, para
     logos de proporção aproximada `prop` (largura/altura) */
  function melhorGrade(n, W, H, prop) {
    var melhor = null;
    for (var linhas = 1; linhas <= n; linhas++) {
      var cols = Math.ceil(n / linhas), sw = W / cols, sh = H / linhas;
      var lw = Math.min(sw, sh * prop), lh = lw / prop;
      var area = lw * lh;
      if (!melhor || area > melhor.area + 1e-6) melhor = { linhas: linhas, cols: cols, area: area };
    }
    return melhor;
  }

  /* grade de logos dentro de um retângulo (x, y, w, h) do canvas */
  function desenharGrade(c, itens, x, y, w, h) {
    var qtd = 0, soma = 0, n = itens.length;
    itens.forEach(function (L) { if (L.img && L.img.naturalWidth) { soma += L.img.naturalWidth / L.img.naturalHeight; qtd++; } });
    var prop = qtd ? Math.max(1, Math.min(4, soma / qtd)) : 2.2;
    var g = melhorGrade(n, w, h, prop), sh = h / g.linhas, k = 0;
    for (var l = 0; l < g.linhas; l++) {
      var nl = Math.min(g.cols, n - l * g.cols), sw = w / g.cols, x0 = x + (w - nl * sw) / 2;
      for (var q = 0; q < nl; q++, k++) {
        var sx = x0 + q * sw, sy = y + l * sh, p = Math.min(sw, sh) * 0.05, img = itens[k].img;
        if (!img || !img.naturalWidth) continue;
        var esc = Math.min((sw - 2 * p) / img.naturalWidth, (sh - 2 * p) / img.naturalHeight);
        var dw = img.naturalWidth * esc, dh = img.naturalHeight * esc;
        c.drawImage(img, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
      }
    }
  }

  function desenhar(P) {
    var c = P.canvas.getContext("2d"), W = P.canvas.width, H = P.canvas.height;
    c.clearRect(0, 0, W, H);
    arredondado(c, 2, 2, W - 4, H - 4, H * 0.07);
    c.fillStyle = COR_VINIL; c.fill();
    c.lineWidth = Math.max(2, H * 0.006); c.strokeStyle = COR_BORDA; c.stroke();

    var itens = P.logos.length ? P.logos : [];
    var vazio = !itens.length;
    var n = vazio ? Math.max(1, P.spec.vazios || 4) : itens.length;
    var m = H * 0.05, aw = W - 2 * m, ah = H - 2 * m;   // margem do adesivo: pequena, para as logos crescerem
    /* logo em destaque (Power Citros): fica com ~60% do adesivo (a esquerda, se o adesivo e comprido; em cima, se e alto); as outras dividem o resto */
    var dest = itens.filter(function (L) { return L.destaque; }), resto = itens.filter(function (L) { return !L.destaque; });
    if (dest.length && resto.length) {
      c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high";
      var f = 0.6, vao = H * 0.03;
      if (W / H >= 1.7) {
        var wd = aw * f;
        desenharGrade(c, dest, m, m, wd - vao / 2, ah);
        desenharGrade(c, resto, m + wd + vao / 2, m, aw - wd - vao / 2, ah);
      } else {
        var hd = ah * f;
        desenharGrade(c, dest, m, m, aw, hd - vao / 2);
        desenharGrade(c, resto, m, m + hd + vao / 2, aw, ah - hd - vao / 2);
      }
      P.textura.needsUpdate = true;
      return;
    }
    var prop = 2.2, soma = 0, qtd = 0;
    for (var i = 0; i < itens.length; i++) {
      var im = itens[i].img;
      if (im && im.naturalWidth) { soma += im.naturalWidth / im.naturalHeight; qtd++; }
    }
    if (qtd) prop = Math.max(1, Math.min(4, soma / qtd));
    var g = melhorGrade(n, aw, ah, prop);
    var sh = ah / g.linhas, k = 0;
    for (var l = 0; l < g.linhas; l++) {
      var nl = Math.min(g.cols, n - l * g.cols), sw = aw / g.cols;
      var x0 = m + (aw - nl * sw) / 2;
      for (var q = 0; q < nl; q++, k++) {
        var sx = x0 + q * sw, sy = m + l * sh, p = Math.min(sw, sh) * 0.05;
        if (vazio) {
          c.save();
          c.setLineDash([H * 0.03, H * 0.022]); c.lineWidth = Math.max(2, H * 0.008);
          c.strokeStyle = "#9aa09c";
          arredondado(c, sx + p, sy + p, sw - 2 * p, sh - 2 * p, H * 0.04); c.stroke();
          c.setLineDash([]);
          c.fillStyle = "#9aa09c"; c.textAlign = "center"; c.textBaseline = "middle";
          c.font = "700 " + Math.round(Math.min(sh - 2 * p, (sw - 2 * p) / 3) * 0.34) + "px Arial, sans-serif";
          c.fillText("LOGO", sx + sw / 2, sy + sh / 2);
          c.restore();
        } else {
          var img = itens[k].img;
          if (!img || !img.naturalWidth) continue;
          var esc = Math.min((sw - 2 * p) / img.naturalWidth, (sh - 2 * p) / img.naturalHeight);
          var dw = img.naturalWidth * esc, dh = img.naturalHeight * esc;
          c.drawImage(img, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
        }
      }
    }
    P.textura.needsUpdate = true;
  }

  /* marca do drone em uso ("xag", "dji"...): vem de sim.html?marca=xag, a página que
     contém o campo. `API.marca` força um valor (só para teste no visualizador). */
  function marcaAtual() {
    if (API.marca) return String(API.marca).toLowerCase();
    var fontes = [window];
    try { if (window.parent && window.parent !== window) fontes.push(window.parent); } catch (e) { /* outra origem */ }
    for (var i = 0; i < fontes.length; i++) {
      try {
        var m = new URLSearchParams(fontes[i].location.search).get("marca");
        if (m) return m.toLowerCase();
      } catch (e) { /* sem acesso */ }
    }
    return "";
  }

  function logosDe(onde) {
    var lista = [], marca = marcaAtual();
    for (var i = 0; i < LOGOS.length; i++) {
      var L = LOGOS[i];
      if (L.onde && L.onde.indexOf(onde) < 0) continue;
      if (L.marcas && L.marcas.indexOf(marca) < 0) continue;
      lista.push(L);
    }
    return lista;
  }

  /* abre cada imagem uma vez; ao chegar, todos os painéis são redesenhados */
  function carregarImagens() {
    LOGOS.forEach(function (L) {
      if (L.img || !L.arquivo) return;
      var im = L.img = new Image();
      im.onload = function () { feitos.forEach(desenhar); };
      im.onerror = function () { console.warn("apoiadores: não abriu", L.arquivo); };
      /* caminho a partir da raiz do projeto; o campo fica em treinamento/campo/ */
      im.src = /^(\/|https?:|data:|\.\.\/)/.test(L.arquivo) ? L.arquivo : "../../" + L.arquivo;
    });
  }

  /* --------------------------------------------------------------- geometria */
  function casa(material, nomes) {
    var lista = Array.isArray(material) ? material : [material];
    for (var i = 0; i < lista.length; i++) if (lista[i] && nomes.indexOf(lista[i].name) >= 0) return true;
    return false;
  }

  /* x da pintura em cada ponto da grade, medido de fora para dentro */
  function medirSuperficie(modelo, spec, lado, nz, ny) {
    modelo.updateMatrixWorld(true);
    var alvos = [];
    modelo.traverse(function (o) { if (o.isMesh && casa(o.material, spec.materiais)) alvos.push(o); });
    var rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
    rc.near = 0; rc.far = 20;
    d.set(-lado, 0, 0).transformDirection(modelo.matrixWorld);
    var xs = new Float32Array((nz + 1) * (ny + 1)), faltam = 0;
    for (var j = 0; j <= ny; j++) for (var i = 0; i <= nz; i++) {
      var z = spec.z0 + (spec.z1 - spec.z0) * i / nz, y = spec.y0 + (spec.y1 - spec.y0) * j / ny;
      o.set(lado * 3, y, z); modelo.localToWorld(o);
      rc.set(o, d);
      var h = alvos.length ? rc.intersectObjects(alvos, false)[0] : null;
      if (h) { p.copy(h.point); modelo.worldToLocal(p); xs[j * (nz + 1) + i] = p.x; }
      else { xs[j * (nz + 1) + i] = NaN; faltam++; }
    }
    /* buracos (janela, vão da roda): usa o vizinho mais próximo; sem nenhum, o plano */
    if (faltam) {
      var passos = 0;
      while (faltam && passos++ < nz + ny) {
        var copia = xs.slice();
        for (var jj = 0; jj <= ny; jj++) for (var ii = 0; ii <= nz; ii++) {
          var kk = jj * (nz + 1) + ii;
          if (!isNaN(xs[kk])) continue;
          var viz = [ii > 0 ? kk - 1 : -1, ii < nz ? kk + 1 : -1, jj > 0 ? kk - (nz + 1) : -1, jj < ny ? kk + (nz + 1) : -1];
          for (var v = 0; v < 4; v++) if (viz[v] >= 0 && !isNaN(xs[viz[v]])) { copia[kk] = xs[viz[v]]; faltam--; break; }
        }
        xs = copia;
      }
      for (var t = 0; t < xs.length; t++) if (isNaN(xs[t])) xs[t] = lado * (spec.xPlano || 1);
    }
    return xs;
  }

  function malha(modelo, spec, lado, textura) {
    var plano = spec.modo === "plano";
    var nz = plano ? 1 : 28, ny = plano ? 1 : Math.max(4, Math.round(28 * (spec.y1 - spec.y0) / (spec.z1 - spec.z0)));
    var xs = plano ? null : medirSuperficie(modelo, spec, lado, nz, ny);
    var pos = new Float32Array((nz + 1) * (ny + 1) * 3), uv = new Float32Array((nz + 1) * (ny + 1) * 2), idx = [];
    for (var j = 0; j <= ny; j++) for (var i = 0; i <= nz; i++) {
      var k = j * (nz + 1) + i, t = i / nz, v = j / ny;
      pos[k * 3] = plano ? lado * spec.xPlano : xs[k] + lado * FOLGA;
      pos[k * 3 + 1] = spec.y0 + (spec.y1 - spec.y0) * v;
      pos[k * 3 + 2] = spec.z0 + (spec.z1 - spec.z0) * t;
      uv[k * 2] = lado < 0 ? t : 1 - t;   // visto de fora, a esquerda da imagem fica para a frente
      uv[k * 2 + 1] = v;
      if (i < nz && j < ny) idx.push(k, k + 1, k + nz + 1, k + 1, k + nz + 2, k + nz + 1);
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    /* normal para fora (computeVertexNormals depende da ordem dos índices) */
    var nm = geo.getAttribute("normal");
    for (var a = 0; a < nm.count; a++) if (nm.getX(a) * lado < 0) { nm.setXYZ(a, -nm.getX(a), -nm.getY(a), -nm.getZ(a)); }
    var mat = new THREE.MeshStandardMaterial({
      map: textura, roughness: 0.5, metalness: 0, transparent: true, depthWrite: false,
      /* um pouco de luz própria: com o tom do campo (ACES) o branco do vinil saía cinza ao lado da tinta */
      emissive: new THREE.Color("#ffffff"), emissiveMap: textura, emissiveIntensity: 0.28,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    var m = new THREE.Mesh(geo, mat);
    m.name = "Apoiadores_" + spec.nome + (spec.lados ? (lado < 0 ? "_E" : "_D") : "");
    m.renderOrder = 5; m.receiveShadow = true;
    return m;
  }

  /* ------------------------------------------------------------------ painel */
  function painel(modelo, spec, onde) {
    var lados = spec.lados || [spec.lado];
    var aspecto = (spec.z1 - spec.z0) / (spec.y1 - spec.y0);
    /* 24/11/2026 (montar42): no celular o painel e desenhado com metade da largura (1024): 4x menos memoria; o desenho e proporcional */
    var larg = window.XG_MOVEL ? 1024 : 2048, alt = Math.max(256, Math.round(larg / aspecto));
    var criados = [];
    lados.forEach(function (lado) {
      var canvas = document.createElement("canvas"); canvas.width = larg; canvas.height = alt;
      var tex = new THREE.CanvasTexture(canvas);
      tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 8;
      var P = { canvas: canvas, textura: tex, spec: spec, lado: lado, onde: onde, logos: logosDe(onde) };
      var m = malha(modelo, spec, lado, tex);
      P.malha = m; modelo.add(m);
      feitos.push(P); criados.push(m);
      desenhar(P); carregarImagens();
    });
    return criados;
  }

  function aplicar(modelo, onde) {
    if (!modelo || typeof THREE === "undefined") return [];
    var todos = [];
    PAINEIS[onde].forEach(function (spec) {
      try { todos = todos.concat(painel(modelo, spec, onde)); }
      catch (e) { console.warn("apoiadores:", spec.nome, e); }
    });
    return todos;
  }

  /* refaz o desenho depois de mudar LOGOS (só para teste) */
  function redesenhar() {
    carregarImagens();
    feitos.forEach(function (P) { P.logos = logosDe(P.onde); desenhar(P); });
  }

  var API = {
    LOGOS: LOGOS,
    PAINEIS: PAINEIS,
    marca: "",
    carretinha: function (modelo) { return aplicar(modelo, "carretinha"); },
    camionete: function (modelo) { return aplicar(modelo, "camionete"); },
    painel: painel,
    redesenhar: redesenhar
  };
  return API;
})();
