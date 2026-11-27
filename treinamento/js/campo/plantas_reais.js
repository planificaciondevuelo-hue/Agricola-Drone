/* ===================================================================
   PLANTAS — culturas por estágio fenológico e plantas daninhas em 3D.

   Tudo desenhado aqui, em código (não existe modelo grátis com licença
   comercial de soja, algodão e canola). Cada "instância" é um pedaço de
   linha com alguns pés, para caber milhares no quadro.

   Usado nos DOIS lugares, o mesmo arquivo:
     - editor do Gerador de Mapas Reais (web/plantas.js)
     - treinamento (treinamento/js/campo/plantas_reais.js, copiado pelo
       gerador a cada exportação)
   Por isso não usa nada global além de quem chama: recebe o THREE do
   lugar onde a cena vive (o campo é um iframe com o THREE dele).

   Pintura (o que o editor grava):
     { x0, z0, res, nx, nz,
       paleta: [{cultura, estagio, angulo}],   // índice 1..n na grade
       culturas: Uint8 (0 = nada, k = paleta[k-1]),
       daninhas: Uint8 (0..255 = densidade) }
   =================================================================== */
(function (raiz) {
  "use strict";

  /* ---------------- catálogo ---------------- */
  // linha = espaçamento entre linhas de plantio; passo = distância entre
  // instâncias na linha (cada instância tem "pes" plantas). Nas culturas de
  // plantadeira quem manda é o que a pessoa escolhe (espacamento()):
  // linhaPadrao (m) e porMetro (plantas por metro de linha)
  const CULTURAS = {
    soja: {
      nome: "Soja", cor: "#58a83a", linha: 0.5, passo: 0.24, falha: 0.04, pes: 3, porMetro: 12,
      estagios: [
        { id: "VE", nome: "VE · emergência", h: 0.06, desc: "Cotilédones abertos logo acima do solo." },
        { id: "V2", nome: "V2 · 2º trifólio", h: 0.15, desc: "Duas folhas trifolioladas abertas." },
        { id: "V4", nome: "V4 · 4º trifólio", h: 0.3, desc: "Plantas ainda separadas, entrelinha aberta." },
        { id: "R1", nome: "R1 · início da floração", h: 0.55, desc: "Flor roxa nos nós; entrelinha quase fechando." },
        { id: "R5", nome: "R5 · enchimento de grãos", h: 0.85, desc: "Lavoura fechada, verde-escura, cheia de vagem." },
        { id: "R7", nome: "R7 · maturação fisiológica", h: 0.85, desc: "Folhas amarelando, vagens maduras." },
        { id: "R8", nome: "R8 · ponto de colheita", h: 0.8, desc: "Sem folha, hastes e vagens marrons." },
      ],
    },
    milho: {
      nome: "Milho", cor: "#e3c13b", linha: 0.7, passo: 0.25, falha: 0.03, pes: 1, porMetro: 4,
      estagios: [
        { id: "VE", nome: "VE · emergência", h: 0.08, desc: "Coleóptilo e primeira folha." },
        { id: "V4", nome: "V4 · 4 folhas", h: 0.35, desc: "Linhas bem marcadas, solo à vista." },
        { id: "V8", nome: "V8 · 8 folhas", h: 0.9, desc: "Crescimento rápido, entrelinha fechando." },
        { id: "V12", nome: "V12 · 12 folhas", h: 1.7, desc: "Lavoura fechada, acima da cintura." },
        { id: "VT", nome: "VT · pendoamento", h: 2.3, desc: "Pendão aberto no topo." },
        { id: "R3", nome: "R3 · grão leitoso", h: 2.4, desc: "Espiga formada, cabelo seco." },
        { id: "R6", nome: "R6 · maturidade", h: 2.3, desc: "Palha seca, cor de palha." },
      ],
    },
    algodao: {
      nome: "Algodão", cor: "#e8e4dc", linha: 0.9, passo: 0.22, falha: 0.05, pes: 2, porMetro: 9,
      estagios: [
        { id: "V2", nome: "V2 · 2 folhas", h: 0.12, desc: "Planta pequena, muito solo à vista." },
        { id: "V6", nome: "V6 · 6 folhas", h: 0.4, desc: "Folhas largas, linhas abertas." },
        { id: "B1", nome: "B1 · botão floral", h: 0.6, desc: "Primeiros botões (\"maçãzinhas\") verdes." },
        { id: "F1", nome: "F1 · florescimento", h: 0.9, desc: "Flores creme e rosadas." },
        { id: "C1", nome: "C1 · maçãs formadas", h: 1.1, desc: "Maçãs verdes, lavoura fechada." },
        { id: "CA", nome: "Capulho aberto", h: 1.1, desc: "Pluma branca exposta, folhas avermelhadas." },
      ],
    },
    trigo: {
      nome: "Trigo", cor: "#c9a63c", linha: 0.34, passo: 0.36, falha: 0.02, linhasPorInst: 2, pes: 3, porMetro: 8,
      estagios: [
        { id: "EM", nome: "Emergência", h: 0.08, desc: "Folhas finas em linhas de 17 cm." },
        { id: "PE", nome: "Perfilhamento", h: 0.22, desc: "Touceiras, cobertura do solo crescendo." },
        { id: "AL", nome: "Alongamento", h: 0.5, desc: "Colmos subindo, lavoura fechada." },
        { id: "ES", nome: "Espigamento", h: 0.8, desc: "Espigas verdes para fora da bainha." },
        { id: "GL", nome: "Grão leitoso", h: 0.85, desc: "Espigas cheias, verde-amarelado." },
        { id: "MA", nome: "Maturação", h: 0.8, desc: "Dourado, pronto para colher." },
      ],
    },
    canola: {
      nome: "Canola", cor: "#f2d22e", linha: 0.45, passo: 0.25, falha: 0.05, pes: 3, porMetro: 12,
      estagios: [
        { id: "RO", nome: "Roseta", h: 0.15, desc: "Folhas largas rente ao chão." },
        { id: "AL", nome: "Alongamento", h: 0.6, desc: "Haste subindo, botões fechados." },
        { id: "FL", nome: "Floração", h: 1.2, desc: "Lavoura toda amarela." },
        { id: "SI", nome: "Síliquas", h: 1.3, desc: "Vagens finas verdes no lugar das flores." },
        { id: "MA", nome: "Maturação", h: 1.2, desc: "Síliquas e hastes marrons." },
      ],
    },
    pastagem: {
      nome: "Pastagem (braquiária)", cor: "#7dbb4a", linha: 0.38, passo: 0.38, falha: 0.0, semLinha: true,
      estagios: [
        { id: "RB", nome: "Rebrota", h: 0.15, desc: "Logo depois do pastejo ou roçada." },
        { id: "CR", nome: "Crescimento", h: 0.4, desc: "Touceiras verdes se fechando." },
        { id: "PP", nome: "Ponto de pastejo", h: 0.7, desc: "Altura de entrada do gado." },
        { id: "FL", nome: "Florescida", h: 1.0, desc: "Passou do ponto, com cachos de semente." },
        { id: "SE", nome: "Seca (estiagem)", h: 0.5, desc: "Palha amarelada." },
      ],
    },
    grama: {
      nome: "Grama (gramado)", cor: "#6fbf4a", linha: 0.3, passo: 0.3, falha: 0.0, semLinha: true,
      estagios: [
        { id: "AP", nome: "Aparada", h: 0.05, desc: "Gramado roçado, de quintal ou beira de sede." },
        { id: "ME", nome: "Média", h: 0.15, desc: "Gramado sem roçar há algumas semanas." },
        { id: "AL", nome: "Alta", h: 0.3, desc: "Grama alta, beira de estrada e carreador." },
        { id: "SE", nome: "Seca (estiagem)", h: 0.1, desc: "Gramado amarelado de seca." },
      ],
    },
  };
  // Dimensões iniciais para representação visual; o operador ajusta ao campo.
  for (const [id, nome, linha, distancia, copa, alturas] of [
    ["cafe", "Café", 3.5, 0.8, 1.5, [0.4, 1.2, 2.2, 2.2]],
    ["mamao", "Mamão", 3.5, 2, 2.3, [0.5, 1.8, 3, 3]],
    ["laranja", "Laranja", 6, 4, 3.5, [0.6, 1.8, 3.5, 3.5]],
    ["uva", "Uva", 3, 1.5, 1.2, [0.5, 1.5, 2, 2]],
  ]) CULTURAS[id] = {
    nome, perene: true, cor: "#429447", linha, distancia, copa,
    passo: distancia, pes: 1, porMetro: 1 / distancia, falha: 0,
    estagios: alturas.map((h, i) => ({id: ["muda", "formacao", "floracao", "frutos"][i],
      nome: ["Muda", "Em formação", "Floração", "Com frutos"][i], h,
      desc: "Representação visual ajustável ao tamanho observado na lavoura."})),
  };

  // Pontos equidistantes ao longo de toda a polilinha, inclusive nas curvas.
  function pontosLinha(pontos, passo) {
    if (!Number.isFinite(passo) || passo < 0.2) throw Error("Espaçamento mínimo: 0,2 m.");
    const out = []; let falta = 0;
    for (let i = 1; i < pontos.length; i++) {
      const [x, z] = pontos[i - 1], [b, c] = pontos[i], L = Math.hypot(b-x, c-z);
      if (!L) continue;
      const a = Math.atan2(c-z, b-x);
      for (; falta <= L + 1e-8; falta += passo) {
        if (out.length >= 50000) throw Error("Limite de 50 mil pés por mapa. Divida a área em mapas menores.");
        out.push({x:x+(b-x)*falta/L, z:z+(c-z)*falta/L, a});
      }
      falta -= L;
    }
    return out;
  }
  function dentroPoligono(x,z,t) {
    let dentro=false;
    for(let i=0,j=t.length-1;i<t.length;j=i++)
      if((t[i][1]>z)!==(t[j][1]>z) && x<(t[j][0]-t[i][0])*(z-t[i][1])/(t[j][1]-t[i][1])+t[i][0]) dentro=!dentro;
    return dentro;
  }
  function pontosArea(t, ent) {
    const a=(+ent.angulo||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    const local=t.map(([x,z])=>[x*c+z*s,-x*s+z*c]);
    const xs=local.map(p=>p[0]),zs=local.map(p=>p[1]);
    const passo=+ent.distancia,linha=+ent.linha;
    if (!(passo>=0.2 && linha>=0.2)) throw Error("Espaçamento mínimo: 0,2 m.");
    const out=[];
    const x0=Math.floor(Math.min(...xs)/passo)*passo,x1=Math.max(...xs);
    const z0=Math.floor(Math.min(...zs)/linha)*linha,z1=Math.max(...zs);
    if ((x1-x0)/passo*(z1-z0)/linha>200000) throw Error("Área muito grande para esse espaçamento. Divida em mapas menores.");
    for(let z=z0;z<=z1;z+=linha) for(let x=x0;x<=x1;x+=passo) {
      if(!dentroPoligono(x,z,local)) continue;
      if(out.length>=50000) throw Error("Limite de 50 mil pés por mapa.");
      out.push({x:x*c-z*s,z:x*s+z*c,a});
    }
    return out;
  }
  function medidas(ent) {
    const def=CULTURAS[ent.cultura], est=def.estagios.find(e=>e.id===ent.estagio)||def.estagios[0];
    return {h:Math.min(12,Math.max(0.2,+ent.altura||est.h)),
      copa:Math.min(12,Math.max(0.2,+ent.copa||def.copa*(est.id==="muda"?.3:est.id==="formacao"?.65:1))),
      distancia:Math.min(20,Math.max(0.2,+ent.distancia||def.distancia)),
      linha:Math.min(20,Math.max(0.2,+ent.linha||def.linha))};
  }
  // Consulta espacial do dossel dos pés individuais, também usada no treinamento.
  function alturaPerenes(p) {
    const cel=new Map(), S=16;
    for(const pe of p.pes||[]) {
      const ent=p.paleta[pe.p-1]; if(!ent||!CULTURAS[ent.cultura]?.perene) continue;
      const m=medidas(ent), r=ent.cultura==="uva"&&ent.conducao==="parreiral"?Math.hypot(m.distancia,m.linha)/2:m.copa/2;
      const item={...pe,ent,m,r};
      for(let j=Math.floor((pe.z-r)/S);j<=Math.floor((pe.z+r)/S);j++)
        for(let i=Math.floor((pe.x-r)/S);i<=Math.floor((pe.x+r)/S);i++) {
          const k=i+","+j; if(!cel.has(k)) cel.set(k,[]); cel.get(k).push(item);
        }
    }
    return (x,z)=>{
      let h=0;
      for(const q of cel.get(Math.floor(x/S)+","+Math.floor(z/S))||[]) {
        const xx=x-q.x,zz=z-q.z;
        const u=xx*Math.cos(q.a)+zz*Math.sin(q.a),v=-xx*Math.sin(q.a)+zz*Math.cos(q.a);
        const par=q.ent.cultura==="uva"&&q.ent.conducao==="parreiral";
        if(par? Math.abs(u)<=q.m.distancia/2&&Math.abs(v)<=q.m.linha/2:xx*xx+zz*zz<=q.r*q.r) h=Math.max(h,q.m.h);
      }
      return h;
    };
  }
  /* cor e cobertura do dossel visto de longe, por estágio (o chão pintado
     embaixo das plantas: depois dos 40 m em volta só ele aparece) */
  const DOSSEL = {
    soja: [["#7fa14a", 0.05], ["#4f8a2b", 0.2], ["#4f8a2b", 0.4], ["#3a7421", 0.75], ["#2f6a1c", 0.95], ["#b9a63a", 0.9], ["#7a5a32", 0.8]],
    milho: [["#6aa83a", 0.03], ["#4c8a2e", 0.15], ["#4c8a2e", 0.5], ["#3f7d27", 0.85], ["#3f7d27", 0.9], ["#4a8030", 0.9], ["#c8b37a", 0.85]],
    algodao: [["#4a8a32", 0.05], ["#3d7a2a", 0.3], ["#3d7a2a", 0.55], ["#3d7a2a", 0.8], ["#3a7428", 0.9], ["#cfc4b4", 0.8]],
    trigo: [["#6aa83a", 0.15], ["#5f9a34", 0.5], ["#5f9a34", 0.85], ["#6aa83a", 0.95], ["#a9b04a", 0.95], ["#d2b45a", 0.95]],
    canola: [["#4f8a3a", 0.4], ["#5a9244", 0.7], ["#e8cf2a", 0.95], ["#7aa44a", 0.9], ["#8b6b3e", 0.85]],
    grama: [["#5fae3a", 0.97], ["#58a838", 0.98], ["#5a9f36", 0.98], ["#b8a466", 0.95]],
    pastagem: [["#6fae44", 0.6], ["#5f9a3a", 0.85], ["#5f9a3a", 0.95], ["#7a9a4a", 0.95], ["#b8a466", 0.9]],
  };
  const DANINHAS = ["buva", "capim-amargoso", "caruru", "picão-preto", "corda-de-viola"];
  const VARIANTES = 3;

  /* ---------------- utilidades ---------------- */
  /* espaçamento de uma cor da pintura: o que a pessoa pôs (linha entre
     linhas em m, plantas por metro) ou o padrão da cultura.
     Devolve: lin/pas = passo das INSTÂNCIAS; esp = distância entre os pés
     dentro da instância; linhaReal/porMetro = o que mostrar na tela */
  function espacamento(ent, def) {
    if (def.semLinha) return { lin: def.linha, pas: def.passo, esp: 0, linhaReal: def.linha, porMetro: 0 };
    const nl = def.linhasPorInst || 1;
    const linhaReal = Math.min(3, Math.max(0.1, +ent.linha || def.linha / nl));
    const porMetro = Math.min(80, Math.max(0.5, +ent.porMetro || def.porMetro));
    const esp = Math.round(1000 / porMetro) / 1000;
    return { lin: linhaReal * nl, pas: esp * def.pes, esp, linhaReal, porMetro };
  }

  function hash(a, b, c) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function rng(semente) {
    let s = (semente * 2654435761) >>> 0 || 1;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  function b64(s) {
    const t = atob(s), a = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i);
    return a;
  }
  function paraB64(a) {
    let s = "";
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }

  /* ---------------- construtor de malha (triângulos soltos com cor) ---------------- */
  function fabrica(T) {
    const cache = {};
    const cor = hex => cache[hex] || (cache[hex] = (c => [c.r, c.g, c.b])(new T.Color(hex).convertSRGBToLinear()));

    function Malha(simples) { this.p = []; this.c = []; this.simples = !!simples; }
    Malha.prototype.tri = function (a, b, c, k) {
      this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
      this.c.push(k[0], k[1], k[2], k[0], k[1], k[2], k[0], k[1], k[2]);
    };
    Malha.prototype.quad = function (a, b, c, d, k) { this.tri(a, b, c, k); this.tri(a, c, d, k); };
    /* folha: sai de b na direção yaw, inclinada "incl" da vertical e caindo
       "queda" até a ponta; largura máxima no meio */
    Malha.prototype.folha = function (b, yaw, incl, L, W, k, queda = 0.6, segs = 3) {
      const dx = Math.cos(yaw), dz = Math.sin(yaw), sx = -dz, sz = dx;
      // de longe: a mesma folha (mesma curva e área), só que em 2 triângulos
      if (this.simples) {
        let x = b[0], y = b[1], z = b[2], meio = null;
        for (let i = 1; i <= segs; i++) {
          const aa = incl + queda * (i - 0.5) / segs, st = L / segs;
          x += Math.sin(aa) * dx * st; y += Math.cos(aa) * st; z += Math.sin(aa) * dz * st;
          if (!meio && i >= segs / 2) meio = [x, y, z];     // 3 trechos: o fim do 2º
        }
        // dobrada na largura maior: acompanha o arco da folha (fica deitada como ela)
        const w = W * 0.55, t = [x, y, z];
        const e = [meio[0] - sx * w, meio[1], meio[2] - sz * w], d = [meio[0] + sx * w, meio[1], meio[2] + sz * w];
        this.tri(b, d, e, k);
        this.tri(e, d, t, k);
        return t;
      }
      let x = b[0], y = b[1], z = b[2], ant = null;
      const w0 = W / 2 * Math.sin(Math.PI * 0.08);
      ant = [[x - sx * w0, y, z - sz * w0], [x + sx * w0, y, z + sz * w0]];
      for (let i = 1; i <= segs; i++) {
        const a = incl + queda * (i - 0.5) / segs, t = i / segs, st = L / segs;
        x += Math.sin(a) * dx * st; y += Math.cos(a) * st; z += Math.sin(a) * dz * st;
        const w = W / 2 * Math.sin(Math.PI * (0.08 + 0.92 * t));
        const at = [[x - sx * w, y, z - sz * w], [x + sx * w, y, z + sz * w]];
        this.quad(ant[0], ant[1], at[1], at[0], k);
        ant = at;
      }
      return [x, y, z];
    };
    /* caule: prisma de 3 lados */
    Malha.prototype.caule = function (b, h, r, k, yaw = 0, incl = 0) {
      const d = [Math.sin(incl) * Math.cos(yaw), Math.cos(incl), Math.sin(incl) * Math.sin(yaw)];
      const t = [b[0] + d[0] * h, b[1] + d[1] * h, b[2] + d[2] * h];
      const u = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let ux = d[1] * u[2] - d[2] * u[1], uy = d[2] * u[0] - d[0] * u[2], uz = d[0] * u[1] - d[1] * u[0];
      const n = Math.hypot(ux, uy, uz); ux /= n; uy /= n; uz /= n;
      const vx = d[1] * uz - d[2] * uy, vy = d[2] * ux - d[0] * uz, vz = d[0] * uy - d[1] * ux;
      const pts = [0, 2.094, 4.189].map(a => [Math.cos(a), Math.sin(a)]);
      for (let i = 0; i < (this.simples ? 1 : 3); i++) {
        const [c1, s1] = pts[i], [c2, s2] = pts[(i + 1) % 3];
        const o1 = [ux * c1 + vx * s1, uy * c1 + vy * s1, uz * c1 + vz * s1], o2 = [ux * c2 + vx * s2, uy * c2 + vy * s2, uz * c2 + vz * s2];
        const rt = r * 0.6;
        this.quad([b[0] + o1[0] * r, b[1] + o1[1] * r, b[2] + o1[2] * r], [b[0] + o2[0] * r, b[1] + o2[1] * r, b[2] + o2[2] * r],
          [t[0] + o2[0] * rt, t[1] + o2[1] * rt, t[2] + o2[2] * rt], [t[0] + o1[0] * rt, t[1] + o1[1] * rt, t[2] + o1[2] * rt], k);
      }
      return t;
    };
    /* bolinha (flor, vagem, maçã, pluma): octaedro, sy estica na vertical */
    Malha.prototype.bola = function (c, r, k, sy = 1) {
      if (this.simples && r < 0.02) return;
      const P = [[r, 0, 0], [-r, 0, 0], [0, r * sy, 0], [0, -r * sy, 0], [0, 0, r], [0, 0, -r]].map(o => [c[0] + o[0], c[1] + o[1], c[2] + o[2]]);
      const F = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
      for (const [a, b, d] of F) this.tri(P[a], P[b], P[d], k);
    };
    Malha.prototype.geometria = function () {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    };

    /* ---------------- desenho de cada cultura ---------------- */
    const PI = Math.PI;
    const D = {
      soja(m, x, z, r, k) {
        const H = [0.06, 0.15, 0.3, 0.55, 0.85, 0.85, 0.8][k] * (0.88 + 0.24 * r());
        const N = [0, 2, 4, 6, 8, 8, 7][k], S = [0.025, 0.045, 0.06, 0.08, 0.09, 0.08, 0][k] * (0.85 + 0.3 * r());
        const caule = k === 6 ? cor("#7a5a32") : k === 5 ? cor("#8f8a3a") : cor("#6d8a3a");
        m.caule([x, 0, z], H, 0.003 + 0.003 * k / 6, caule, r() * 6, 0.08 * r());
        if (k === 0) {
          const a = r() * 6;
          m.folha([x, H, z], a, 1.4, 0.022, 0.02, cor("#86a64a"), 0.1, 2);
          m.folha([x, H, z], a + PI, 1.4, 0.022, 0.02, cor("#86a64a"), 0.1, 2);
          return;
        }
        const corFolha = () => k === 5 ? cor(r() < 0.65 ? "#c9b23a" : "#9aa33a") : (k >= 3 ? cor(r() < 0.4 ? "#2f6a1c" : r() < 0.5 ? "#3a7421" : "#447d26") : cor(r() < 0.4 ? "#3f7a24" : r() < 0.5 ? "#4f8a2b" : "#5a9631"));
        /* trifólio: pecíolo subindo para fora e três folíolos ovais na ponta */
        const trifolio = (no, a, tam) => {
          const pe = m.caule(no, S * (1.3 + 0.7 * r()), 0.0015, caule, a, 0.75 + 0.35 * r());
          if (k < 6) for (const da of [-1.15, 0, 1.15]) m.folha(pe, a + da + (r() - 0.5) * 0.3, 1.0 + 0.45 * r(), S * tam, S * tam * 0.7, corFolha(), 0.55, 3);
          return pe;
        };
        const fruto = no => {
          if (k === 3 && r() < 0.7) m.bola(no, 0.008, cor("#8a5bb5"));
          if (k >= 4) for (let v = 0; v < 2; v++) m.bola([no[0] + (r() - 0.5) * 0.03, no[1] - 0.02 - v * 0.015, no[2] + (r() - 0.5) * 0.03], 0.009,
            cor(k === 4 ? "#5f9a34" : k === 5 ? "#a8963c" : "#6d5130"), 2.4);
        };
        for (let i = 1; i <= N; i++) {
          const no = [x, H * (0.18 + 0.82 * i / N), z], a = i * 2.4 + r();
          trifolio(no, a, 0.8 + 0.4 * i / N);
          fruto(no);
        }
        /* ramos laterais a partir do V4: é o que fecha a entrelinha */
        const ramos = k >= 3 ? 3 : k >= 2 ? 1 : 0;
        for (let b = 0; b < ramos; b++) {
          const a = b * 2.1 + r() * 0.8;
          const ponta = m.caule([x, H * (0.15 + 0.08 * b), z], H * 0.55, 0.002, caule, a, 0.45 + 0.2 * r());
          const meio = [(x + ponta[0]) / 2, (H * 0.15 + ponta[1]) / 2, (z + ponta[2]) / 2];
          trifolio(meio, a + 1.2, 0.9); trifolio(ponta, a - 0.4, 1.0); fruto(meio);
        }
      },
      milho(m, x, z, r, k) {
        const H = [0.08, 0.35, 0.9, 1.7, 2.3, 2.4, 2.3][k] * (0.92 + 0.16 * r());
        const N = [2, 4, 8, 12, 14, 14, 13][k], seco = k === 6;
        const folha = () => cor(seco ? (r() < 0.5 ? "#c8b37a" : "#b39c66") : (r() < 0.5 ? "#4c8a2e" : "#3f7d27"));
        const hc = k < 2 ? H * 0.25 : H * (k >= 4 ? 0.8 : 0.7);
        m.caule([x, 0, z], hc, 0.004 + 0.0022 * k, cor(seco ? "#b8a06a" : "#5d8f34"));
        const L = Math.min(0.95, 0.1 + H * 0.45), W = 0.03 + 0.055 * Math.min(k, 4) / 4;
        const lado = r() * PI;
        for (let i = 0; i < N; i++) {
          const y = k < 2 ? hc * (0.4 + 0.6 * i / N) : hc * (0.12 + 0.88 * (i + 1) / (N + 1));
          const a = lado + (i % 2) * PI + (r() - 0.5) * 0.6, perto = Math.abs(i / N - 0.55);
          m.folha([x, y, z], a, k < 2 ? 0.35 : 0.55, L * (1 - 0.45 * perto), W, folha(), k < 2 ? 0.7 : 1.5, 3);
        }
        if (k >= 4) for (let j = 0; j < 6; j++) m.folha([x, hc, z], j * 1.05 + r(), 0.25, 0.28, 0.012, cor(seco ? "#a88c5a" : "#c7b06a"), 0.6, 2);
        if (k >= 5) m.bola([x + Math.cos(lado) * 0.05, hc * 0.55, z + Math.sin(lado) * 0.05], 0.035, cor(seco ? "#cdb98a" : "#7aa046"), 3.5);
      },
      algodao(m, x, z, r, k) {
        const H = [0.12, 0.4, 0.6, 0.9, 1.1, 1.1][k] * (0.9 + 0.2 * r());
        const N = [2, 5, 7, 9, 10, 9][k], aberto = k === 5;
        const caule = cor(k >= 4 ? "#8a4a3a" : "#7a6a3a");
        m.caule([x, 0, z], H, 0.004 + 0.004 * k / 5, caule, r() * 6, 0.04);
        const Lf = (0.05 + 0.1 * Math.min(1, k / 3)) * (0.85 + 0.3 * r());
        /* folha de três lobos na ponta de um pecíolo comprido */
        const folha = (no, a, tam) => {
          if (aberto && r() < 0.4) return;                           // capulho: desfolhando
          const c = aberto && r() < 0.6 ? cor(r() < 0.5 ? "#9a4a32" : "#b0703a") : cor(r() < 0.5 ? "#2f6e24" : "#3d7a2a");
          const pe = m.caule(no, Lf * 0.9 * tam, 0.0015, caule, a, 0.9 + 0.3 * r());
          for (const da of [-0.55, 0, 0.55]) m.folha(pe, a + da, 1.1 + 0.3 * r(), Lf * tam * (da ? 0.85 : 1), Lf * tam * 0.75, c, 0.45, 3);
        };
        const fruto = p => {
          if (k === 2 && r() < 0.7) m.bola(p, 0.01, cor("#6aa040"), 1.2);
          if (k === 3 && r() < 0.6) m.bola(p, 0.022, cor(r() < 0.7 ? "#f1e6b8" : "#e2a3b8"));
          if (k === 4 && r() < 0.7) m.bola(p, 0.024, cor("#5f9a3a"), 1.25);
          if (aberto && r() < 0.8) m.bola(p, 0.038, cor(r() < 0.85 ? "#f6f4ee" : "#e4ddd0"), 0.9);
        };
        for (let i = 1; i <= N; i++) {
          const t = i / N, no = [x, H * (0.12 + 0.88 * t), z], a = i * 2.4 + r();
          folha(no, a, 1.1 - 0.3 * t);
          /* ramos frutíferos: compridos embaixo, curtos em cima (planta em cone) */
          if (k >= 2 && t < 0.9) {
            const ponta = m.caule(no, (0.08 + 0.22 * (1 - t)) * Math.min(1, k / 3), 0.002, caule, a + PI * 0.8, 1.15);
            folha(ponta, a + PI * 0.8, 0.8);
            fruto(ponta);
            fruto([(no[0] + ponta[0]) / 2, no[1] + 0.01, (no[2] + ponta[2]) / 2]);
          }
        }
      },
      trigo(m, x, z, r, k) {
        const H = [0.08, 0.22, 0.5, 0.8, 0.85, 0.8][k] * (0.9 + 0.2 * r());
        const cv = cor(k === 5 ? "#d2b45a" : k === 4 ? "#a9b04a" : r() < 0.5 ? "#5f9a34" : "#6aa83a");
        const colmos = k < 1 ? 1 : k < 2 ? 3 : 2;
        for (let c = 0; c < colmos; c++) {
          const a = r() * 6, inc = 0.06 + 0.12 * r();
          if (k >= 2) {
            const t = m.caule([x, 0, z], H, 0.0035, cv, a, inc);
            if (k >= 3) m.bola([t[0], t[1] - 0.03, t[2]], 0.009, cor(k === 5 ? "#ddc06a" : k === 4 ? "#b9b452" : "#7fae45"), 4);
            m.folha([x, H * 0.4, z], a + 2, 0.6, 0.18, 0.012, cv, 0.9, 2);
          } else {
            m.folha([x, 0, z], a, 0.25, H * 1.2, 0.01, cv, 0.7, 2);
            m.folha([x, 0, z], a + 2.5, 0.45, H, 0.01, cv, 0.8, 2);
          }
        }
      },
      canola(m, x, z, r, k) {
        const H = [0.15, 0.6, 1.2, 1.3, 1.2][k] * (0.9 + 0.2 * r());
        const verde = cor(r() < 0.5 ? "#4f8a3a" : "#5a9244"), seca = cor("#8b6b3e");
        const ros = k === 0 ? 7 : k === 1 ? 5 : 3;
        for (let i = 0; i < ros; i++) m.folha([x, 0.01, z], i * 2.4 + r(), 1.0 + 0.3 * r(), k === 0 ? 0.13 : 0.1, 0.07, k === 4 ? seca : verde, 0.5, 2);
        if (k === 0) return;
        const t = m.caule([x, 0, z], H, 0.006, k === 4 ? seca : cor("#6e9a46"), r() * 6, 0.05);
        /* folhas abraçando a haste (a canola não é só flor no palito) */
        for (let i = 0; i < 7; i++) m.folha([x, H * (0.12 + 0.55 * i / 7), z], i * 2.4 + r(), 0.8 + 0.4 * r(), 0.13 - 0.01 * i, 0.06, k === 4 ? seca : verde, 0.7, 3);
        const ramos = k === 1 ? 2 : 7;
        for (let i = 0; i < ramos; i++) {
          const y = H * (0.55 + 0.4 * i / ramos), a = i * 2.2 + r();
          const p = m.caule([x, y, z], H * 0.25, 0.003, k === 4 ? seca : cor("#6e9a46"), a, 0.5);
          if (k === 1) m.bola(p, 0.012, cor("#8fae4a"));
          if (k === 2) for (let f = 0; f < 5; f++) m.bola([p[0] + (r() - 0.5) * 0.05, p[1] + r() * 0.04, p[2] + (r() - 0.5) * 0.05], 0.018, cor(r() < 0.8 ? "#f2d22e" : "#e8c21f"));
          if (k >= 3) for (let f = 0; f < 4; f++) m.folha(p, r() * 6, 0.35, 0.06, 0.006, k === 4 ? cor("#7a5a32") : cor("#7aa44a"), 0.2, 1);
        }
        if (k === 2) for (let f = 0; f < 4; f++) m.bola([t[0] + (r() - 0.5) * 0.06, t[1] + r() * 0.04, t[2] + (r() - 0.5) * 0.06], 0.02, cor("#f2d22e"));
      },
      grama(m, x, z, r, k) {
        const H = [0.05, 0.15, 0.3, 0.1][k];
        for (let i = 0; i < 22; i++) {
          const c = k === 3 ? cor(r() < 0.6 ? "#c2ad6a" : "#a99a5c") : cor(r() < 0.4 ? "#4f9a30" : r() < 0.5 ? "#62ad3c" : "#57a034");
          m.folha([x + (r() - 0.5) * 0.3, 0, z + (r() - 0.5) * 0.3], r() * 6, 0.15 + 0.4 * r(), H * (0.7 + 0.6 * r()), 0.012, c, 0.6 + 0.6 * r(), 2);
        }
      },
      pastagem(m, x, z, r, k) {
        const H = [0.15, 0.4, 0.7, 1.0, 0.5][k] * (0.85 + 0.3 * r());
        const n = [18, 26, 32, 30, 24][k];
        for (let i = 0; i < n; i++) {
          const c = k === 4 ? cor(r() < 0.6 ? "#c2ad6a" : "#a9975c") : cor(r() < 0.5 ? "#5f9a3a" : r() < 0.5 ? "#6fae44" : "#4f8a30");
          const ox = (r() - 0.5) * 0.3, oz = (r() - 0.5) * 0.3;
          m.folha([x + ox, 0, z + oz], r() * 6, 0.15 + 0.35 * r(), H * (0.7 + 0.5 * r()), 0.022, c, 0.9 + 0.6 * r(), 2);
        }
        if (k === 3) for (let i = 0; i < 4; i++) {
          const t = m.caule([x, 0, z], H * 1.25, 0.002, cor("#7a8a4a"), r() * 6, 0.15 * r());
          m.bola(t, 0.012, cor("#9a7a5a"), 3);
        }
      },
    };

    // Folhas individuais, ramos irregulares e frutos arredondados. Semente fixa:
    // reabrir o mapa não muda o desenho da planta nem a sua posição.
    function perene(ent, variante = 0) {
      const m=new Malha(), {h,copa,distancia,linha}=medidas(ent), w=copa/2;
      const k=Math.max(0,CULTURAS[ent.cultura].estagios.findIndex(e=>e.id===ent.estagio));
      const r=rng(941+variante*7919+k*37+ent.cultura.length*131);
      const madeira=cor("#66503a"), verdes=(ent.cultura==="cafe"?["#153f1c","#1f5026","#285b2d","#366d30","#54833b"]:["#244e21","#335f28","#416d30","#527d37","#638b42"]).map(cor);
      const folhasUV=[];
      const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
      function ramo(a,b,raio,c=madeira,afinar=.65) {
        const d=b.map((v,i)=>v-a[i]),L=Math.hypot(...d);if(L<1e-7)return;
        const v=new T.Vector3(...d).normalize(),u=new T.Vector3(0,1,0);
        if(Math.abs(v.y)>.95)u.set(1,0,0);u.cross(v).normalize();
        const q=new T.Vector3().crossVectors(v,u);
        const anel=(p,rr,j)=>{const ang=j*Math.PI/3;return p.map((x,i)=>x+rr*(u.getComponent(i)*Math.cos(ang)+q.getComponent(i)*Math.sin(ang)));};
        for(let j=0;j<6;j++)m.quad(anel(a,raio,j),anel(b,raio*afinar,j),anel(b,raio*afinar,j+1),anel(a,raio,j+1),c);
      }
      function fruto(p,raio,c,sy=1) {
        const n=8,faixas=5;
        const pt=(i,j)=>{const v=Math.PI*i/faixas,a=j*2*Math.PI/n;return [p[0]+raio*Math.sin(v)*Math.cos(a),p[1]+raio*Math.cos(v)*sy,p[2]+raio*Math.sin(v)*Math.sin(a)];};
        for(let i=0;i<faixas;i++)for(let j=0;j<n;j++)m.quad(pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1),c);
      }
      // Lâmina com nervura central dobrada; uva/mamão recebem borda lobada.
      function folha(p,L,W,yaw,inclinacao,lobos=0) {
        const primeiro=m.p.length/3;
        const u=[Math.cos(yaw)*Math.cos(inclinacao),Math.sin(inclinacao),Math.sin(yaw)*Math.cos(inclinacao)];
        const v=[-Math.sin(yaw),0,Math.cos(yaw)];
        const normal=[-Math.cos(yaw)*Math.sin(inclinacao),Math.cos(inclinacao),-Math.sin(yaw)*Math.sin(inclinacao)];
        const point=(x,y,d)=>p.map((p0,i)=>p0+u[i]*x+v[i]*y+normal[i]*d);
        const verde=verdes[Math.floor(r()*verdes.length)],claro=verde.map(x=>Math.min(1,x*1.17));
        if(lobos) {
          const n=lobos*8,centro=point(L*.43,0,L*.022);
          for(let i=0;i<n;i++) {
            const edge=j=>{const a=j*2*Math.PI/n,rr=(lobos===7?.6+.4*Math.cos(lobos*a):.8+.2*Math.cos(lobos*a))*(Math.abs(a-Math.PI)<.3?.6:1);return point(L*.45+Math.cos(a)*L*.52*rr,Math.sin(a)*W*.5*rr,-L*.04*Math.abs(Math.sin(a)));};
            m.tri(centro,edge(i),edge(i+1),i%4<2?verde:claro);
          }
        } else {
          for(let i=0;i<3;i++) {
            const t=i/3,t1=(i+1)/3;
            const meio=t=>point(L*t,0,L*(.035*Math.sin(t*Math.PI)-.08*t*t));
            const borda=(t,sg)=>point(L*t,sg*W*.5*Math.pow(Math.sin(Math.PI*t),.8),-L*.08*t*t);
            for(const sg of [-1,1])m.quad(meio(t),borda(t,sg),borda(t1,sg),meio(t1),sg===1?verde:claro);
          }
        }
        for(let i=primeiro;i<m.p.length/3;i++) {
          const d=[m.p[i*3]-p[0],m.p[i*3+1]-p[1],m.p[i*3+2]-p[2]];
          folhasUV[i]=[d.reduce((s,x,j)=>s+x*u[j],0)/L,.5+d.reduce((s,x,j)=>s+x*v[j],0)/W];
        }
      }
      function cacho(p) {
        ramo([p[0],p[1]+.07,p[2]],p,.004,cor("#6e8050"));
        for(let j=0;j<5;j++) {
          const n= Math.max(1,5-j),rr=.047*(1-j*.14);
          for(let i=0;i<n;i++){const a=i*2*Math.PI/n+j*1.2;
            fruto([p[0]+Math.cos(a)*rr,p[1]-j*.037,p[2]+Math.sin(a)*rr],.026+r()*.005,cor(r()<.25?"#534e6e":"#373146"));}
        }
      }
      if(ent.cultura==="uva") {
        const par=ent.conducao==="parreiral",topo=Math.max(1.85,h);
        const posteX=-distancia*.48;
        ramo([posteX,0,0],[posteX,topo+.08,0],.035,cor("#9b8870"),1);
        for(const y of par?[topo*.94]:[topo*.43,topo*.67,topo*.94])ramo([-distancia/2,y,0],[distancia/2,y,0],.004,cor("#969a94"),1);
        if(par) for(const x of [-distancia/2,0,distancia/2])ramo([x,topo*.94,-linha/2],[x,topo*.94,linha/2],.004,cor("#969a94"),1);
        const tronco=[.035,h*(par?.87:.43),.04];
        ramo([0,0,0],[.055,tronco[1]*.52,-.025],k===0?.008:.03);
        ramo([.055,tronco[1]*.52,-.025],tronco,k===0?.006:.021);
        if(k===0) {
          for(let j=0;j<7;j++)folha([.03,h*(.3+j*.09),.02],.08,.085,j*2.4,.1,5);
        } else for(const lado of [-1,1]) {
          const ponta=[lado*distancia*.46,tronco[1]+.05,.015];ramo(tronco,ponta,.014);
          const n=par?7:5;
          for(let j=0;j<n;j++) {
            const base=mix(tronco,ponta,(j+.3)/n),sg=j%2?1:-1;
            const fim=par?[base[0]+(r()-.5)*.25,h*.96,sg*linha*.47]:[base[0]+(r()-.5)*.24,h*(.82+r()*.16),sg*(.12+r()*.16)];
            const meio=mix(base,fim,.5);meio[0]+=(r()-.5)*.1;ramo(base,meio,.006,cor("#637444"));ramo(meio,fim,.004,cor("#74834b"));
            const folhas=k===1?7:12;
            for(let f=0;f<folhas;f++) {
              const t=(f+.5)/folhas,p=mix(base,fim,t),yaw=par?sg*Math.PI/2+(r()-.5)*2:f*2.4+lado;
              const L=(.19+r()*.085)*(k===1?.75:1);
              folha(p,L,L*.95,yaw,par?(r()-.5)*.4:(r()-.65)*1.1,5);
            }
            if(k===3&&j%2===0)cacho([base[0],par?h*.83:base[1]+.18,sg*.08]);
            if(k===2&&j%2===0)for(let f=0;f<8;f++)fruto([base[0]+(r()-.5)*.05,base[1]+.12-f*.008,sg*.055],.009,cor("#b8bd79"));
          }
        }
      } else if(ent.cultura==="mamao") {
        const raioTronco=k===0?.009:Math.max(.04,h*.036);
        const top=[.02,h*.84,.015];ramo([0,0,0],top,raioTronco,cor("#96977c"),.7);
        if(k>0)for(let j=0;j<24;j++) {
          const a=j*2.399,y=h*(.035+j*.03),raio=raioTronco*(1-y/h*.35),x=Math.cos(a)*raio,z=Math.sin(a)*raio;
          const corMarca=cor(j%2?"#b2a488":"#7e8067");
          const marca=(ang,dy)=>[Math.cos(a+ang)*(raio+.001),y+dy,Math.sin(a+ang)*(raio+.001)];
          m.tri(marca(-.28,0),marca(0,.012),marca(.28,0),corMarca);
          m.tri(marca(-.28,0),marca(.28,0),marca(0,-.009),corMarca);
        }
        const n=k===0?7:13;
        for(let i=0;i<n;i++) {
          const a=i*2.399,base=[.015,h*(.73+(i%5)*.026),0];
          const p=[Math.cos(a)*w*.61,h*(.77+(i%5)*.035),Math.sin(a)*w*.61];
          const meio=mix(base,p,.55);meio[1]-=h*.015;
          ramo(base,meio,k===0?.004:.013,cor("#829d4d"));ramo(meio,p,k===0?.003:.01,cor("#96a953"));
          folha(p,w*.65,w*.85,a,(i%5-2)*.15,7);
        }
        if(k>=2)for(let j=0;j<(k===3?27:9);j++) {
          const a=j*2.399,raio=k===3?(.07+.028*(1-j/27)):.018;
          const y=h*(.45+j*.011),dist=raioTronco*.75+raio*.95;
          const fp=[Math.cos(a)*dist,y,Math.sin(a)*dist];
          ramo([0,y+.08,0],[fp[0],y+raio*1.5,fp[2]],.008,cor("#9dab60"));
          fruto(fp,raio,cor(k===3?(j<2?"#baae3d":j%3?"#47702b":"#638d38"):"#eee5be"),k===3?1.8:1);
        }
      } else {
        const cafe=ent.cultura==="cafe",troncoH=h*(cafe?.9:.58);
        ramo([0,0,0],[.035,troncoH,0],Math.max(.012,h*.022));
        const n=k===0?8:cafe?30:36;
        for(let j=0;j<n;j++) {
          const a=j*2.399+(r()-.5)*.4,t=j/(n-1);
          const y=cafe?h*(.14+.72*t):h*(.17+.23*r());
          const largura=cafe?w*(.55+.4*Math.sin(Math.PI*t))*(.92+r()*.12):w*(.3+.65*Math.sin(Math.PI*t));
          const base=[0,y,0],fim=[Math.cos(a)*largura,cafe?y+h*(.02+.08*r()):h*(.55+.36*Math.cos(Math.PI*t)),Math.sin(a)*largura];
          ramo(base,fim,cafe?.008:.015,madeira,.08);
          // Florada branca e frutos agrupados nos nós ao longo dos ramos do café.
          if(cafe&&k>=2)for(let no=1;no<10;no++) {
            const centro=mix(base,fim,no/10);
            for(let flor=0;flor<(k===2?5:4);flor++) {
              const aa=flor*2.4+no,fp=[centro[0]+Math.cos(aa)*.025,centro[1]+Math.sin(aa)*.025,centro[2]+Math.sin(aa)*.025];
              if(k===2) {
                for(let petala=0;petala<5;petala++) {
                  const ang=petala*Math.PI*2/5,rr=.018+r()*.005;
                  const b=[fp[0]+Math.cos(ang)*rr,fp[1]+.009,fp[2]+Math.sin(ang)*rr];
                  m.tri(fp,[b[0]-.006,b[1],b[2]],[b[0]+.006,b[1]+.003,b[2]+.01],cor("#f4f0df"));
                }
              } else fruto(fp,.013+r()*.005,cor(r()<.7?"#538434":"#a03927"),1.12);
            }
          }
          const nRamos=cafe?4:k===0?2:6;
          for(let b=0;b<nRamos;b++) {
            const pp=mix(base,fim,(b+1)/(nRamos+1)),ang=a+(b%2?1:-1)*(.6+r()*.6);
            const ponta=[pp[0]+Math.cos(ang)*w*.32,pp[1]+h*.07,pp[2]+Math.sin(ang)*w*.32];ramo(pp,ponta,.0035,cor("#59703b"));
            const nFolhas=k===0?3:cafe?10:14;
            for(let f=0;f<nFolhas;f++) {
              const pos=mix(pp,ponta,(f+.3)/nFolhas),sg=f%2?1:-1;
              const L=Math.min(cafe?.24:.21,w*(k===0?1.1:.6))*(.8+r()*.4);
              folha(pos,L,L*(cafe?.55:.52),ang+sg*1.1,cafe?-.35-r()*.55:(r()-.5)*.7);
              if(k>=2&&f===2){
                if(!cafe&&b%2===0)fruto([pos[0],pos[1]-.065,pos[2]],k===3?.069:.017,cor(k===3?(j%4?"#df941f":"#b7ad31"):"#f1ead9"));
              }
            }
          }
        }
        if(!cafe&&k>0) {
          // Copa de citros ocupa um volume arredondado; folhas não ficam só
          // enfileiradas nos ramos, deixando a árvore adulta transparente.
          const quantidade=k===1?900:1800;
          for(let j=0;j<quantidade;j++) {
            const a=j*2.399+r()*.25,u=(r()*2-1)*.96,raio=Math.sqrt(1-u*u)*(.76+r()*.23);
            const p=[Math.cos(a)*w*raio,h*(.55+.35*u),Math.sin(a)*w*raio];
            const L=.16+r()*.1;
            folha(p,L,L*.56,a+(r()-.5)*2,-.5+(r()-.5)*1.7);
            if(k===3&&j%65===0)fruto([p[0],p[1]-.08,p[2]],.068,cor("#df941f"));
          }
        }
      }
      const g=m.geometria();
      const uv=[];for(let i=0;i<m.p.length/3;i++)uv.push(...(folhasUV[i]||[-1,-1]));
      g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
      if(ent.cultura!=="uva") {g.computeBoundingBox();g.scale(1,h/g.boundingBox.max.y,1);g.computeBoundingSphere();}
      // Normais compartilhadas suavizam os frutos, o tronco e a curvatura das folhas.
      const pos=g.attributes.position,normais=g.attributes.normal,somas=new Map(),chaves=[];
      for(let i=0;i<pos.count;i++) {
        const chave=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>Math.round(v*1e6)).join(',');chaves.push(chave);
        const n=somas.get(chave)||new T.Vector3();n.x+=normais.getX(i);n.y+=normais.getY(i);n.z+=normais.getZ(i);somas.set(chave,n);
      }
      for(const n of somas.values())n.normalize();
      chaves.forEach((chave,i)=>{const n=somas.get(chave);normais.setXYZ(i,n.x,n.y,n.z);});normais.needsUpdate=true;
      return g;
    }
    /* plantas que cada instância carrega, em volta da linha (eixo x local) */
    /* esp = distância entre os pés na linha; meiaLinha = meia entrelinha (trigo: 2 linhas por instância) */
    function instancia(cultura, k, variante, esp, meiaLinha, simples) {
      if(CULTURAS[cultura].perene) return perene({cultura,estagio:CULTURAS[cultura].estagios[k].id});
      const m = new Malha(simples), r = rng(variante * 7919 + k * 131 + cultura.length);
      if (cultura === "soja" || cultura === "canola") { const e = esp || 0.08; for (const x of [-e, 0, e]) D[cultura](m, x, (r() - 0.5) * 0.03, r, k); }
      else if (cultura === "algodao") { const e = esp || 0.11; for (const x of [-e / 2, e / 2]) D.algodao(m, x, (r() - 0.5) * 0.03, r, k); }
      else if (cultura === "trigo") { const e = esp || 0.12, h = meiaLinha || 0.085; for (const z of [-h, h]) for (const x of [-e, 0, e]) D.trigo(m, x + (r() - 0.5) * e * 0.3, z, r, k); }
      else D[cultura](m, 0, 0, r, k);
      return m.geometria();
    }

    /* ---------------- daninhas (sem espécie escolhida: mistura) ---------------- */
    function daninha(tipo, variante) {
      const m = new Malha(), r = rng(variante * 104729 + tipo * 17 + 3);
      if (tipo === 0) {        // buva: haste reta, folhas estreitas em espiral
        const H = 0.5 + 0.5 * r();
        m.caule([0, 0, 0], H, 0.006, cor("#7a8a46"));
        for (let i = 0; i < 28; i++) m.folha([0, H * (0.08 + 0.85 * i / 28), 0], i * 2.4, 1.05, 0.1 - 0.04 * i / 28, 0.02, cor(r() < 0.5 ? "#6f9446" : "#86a456"), 0.4, 2);
        for (let i = 0; i < 6; i++) m.bola([(r() - 0.5) * 0.06, H + r() * 0.05, (r() - 0.5) * 0.06], 0.008, cor("#e9e4cf"));
      } else if (tipo === 1) { // capim-amargoso: touceira com pendão claro
        const H = 0.5 + 0.4 * r();
        for (let i = 0; i < 14; i++) m.folha([(r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06], r() * 6, 0.2 + 0.3 * r(), H * 0.8, 0.012, cor(r() < 0.5 ? "#5f8f3a" : "#77a04a"), 1.0, 2);
        for (let i = 0; i < 3; i++) { const t = m.caule([0, 0, 0], H, 0.002, cor("#8a8a5a"), r() * 6, 0.12); m.bola(t, 0.03, cor("#d9cdb0"), 1.6); }
      } else if (tipo === 2) { // caruru: moita de folha larga, caule avermelhado
        const H = 0.35 + 0.35 * r();
        m.caule([0, 0, 0], H, 0.008, cor("#9a4a4a"));
        for (let i = 0; i < 14; i++) m.folha([0, H * (0.1 + 0.85 * i / 14), 0], i * 2.4, 1.3, 0.12 - 0.04 * i / 14, 0.085, cor(r() < 0.5 ? "#4a7a2e" : "#5e8a36"), 0.4, 2);
        m.bola([0, H + 0.04, 0], 0.025, cor("#8a6a4a"), 2.5);
      } else if (tipo === 3) { // picão-preto: ramificado, florzinha amarela
        const H = 0.3 + 0.3 * r();
        for (let i = 0; i < 4; i++) {
          const t = m.caule([0, 0, 0], H, 0.004, cor("#5e7a3a"), r() * 6, 0.25);
          for (let j = 0; j < 3; j++) m.folha([t[0] * (0.4 + 0.2 * j), t[1] * (0.4 + 0.2 * j), t[2] * (0.4 + 0.2 * j)], r() * 6, 1.2, 0.08, 0.045, cor("#4f8a34"), 0.3, 2);
          m.bola(t, 0.012, cor("#f1cf2a"));
        }
      } else {                 // corda-de-viola: rasteira, folha de coração
        for (let i = 0; i < 10; i++) {
          const a = r() * 6, d = 0.05 + 0.2 * r();
          m.folha([Math.cos(a) * d, 0.01, Math.sin(a) * d], r() * 6, 1.35, 0.06, 0.06, cor(r() < 0.5 ? "#3f7a2a" : "#4f8a34"), 0.15, 2);
        }
        if (r() < 0.7) m.bola([0, 0.08, 0], 0.02, cor("#f3f0f5"));
      }
      return m.geometria();
    }
    /* lavoura de longe: tampa (copa vista de cima) + duas faces em cruz.
       Tamanho 1 x 1 x 1: a instância escala para o lado e a altura. */
    function cartao() {
      const m = new Malha(), topo = [1, 1, 1], lado = [0.72, 0.72, 0.72];
      m.quad([-0.5, 1, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5], topo);
      m.quad([-0.5, 0, 0], [0.5, 0, 0], [0.5, 1, 0], [-0.5, 1, 0], lado);
      m.quad([0, 0, -0.5], [0, 0, 0.5], [0, 1, 0.5], [0, 1, -0.5], lado);
      return m.geometria();
    }
    return { perene, instancia, daninha, cartao };
  }

  /* ---------------- gerente: põe as plantas em volta de um ponto ---------------- */
  function criar(T, op) {
    /* op: { plantio, alt(x,z), dx, dz, grupo, raioPerto, documento }
       PERTO dos centros (câmera / drone / operador): os pés de verdade, em
       pedaços de 8 m montados aos poucos (nada de engasgo ao andar); só os
       primeiros metros com todos os detalhes, o resto com a folha simplificada.
       LONGE: uma "copa" contínua na altura da cultura, com a textura tirada
       fotografando de cima os mesmos pés (mesmo espaçamento e direção).
       Entre os dois, uma faixa de 5 m onde um vai sumindo e o outro entrando. */
    let p = null, cul = null, dan = null, versao = 0, tCopa = 0;
    const f = fabrica(T), doc = op.documento || document;
    const dx = op.dx || 0, dz = op.dz || 0;
    const grupo = new T.Group(); grupo.name = "plantas";
    op.grupo.add(grupo);
    const grupoLonge = new T.Group(); grupoLonge.name = "plantas-longe";
    op.grupo.add(grupoLonge);
    const R = (op.raioPerto || 18) - 4, FAIXA = 5, S = 8;
    const unif = { uC0: { value: new T.Vector3(1e9, 0, 1e9) }, uC1: { value: new T.Vector3(1e9, 0, 1e9) }, uR: { value: R }, uB: { value: FAIXA } };
    const NL = String.fromCharCode(10);
    const CABECA = "uniform vec3 uC0; uniform vec3 uC1; uniform float uR; uniform float uB;" + NL;

    // pés de perto: cada pé some inteiro depois do raio (sorteio pelo lugar dele na faixa)
    const mat = new T.MeshStandardMaterial({ vertexColors: true, side: T.DoubleSide, roughness: 0.88 });
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, unif);
      sh.vertexShader = CABECA + sh.vertexShader.replace("#include <project_vertex>", [
        "#include <project_vertex>",
        "{ vec3 cI = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;",
        "  float d = min(distance(cI.xz, uC0.xz), distance(cI.xz, uC1.xz));",
        "  float h = fract(sin(dot(cI.xz, vec2(12.9898, 78.233))) * 43758.5453);",
        "  if (d > uR - uB * h) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }"].join(NL));
    };
    const geos = {};
    const geo = (chave, fn) => geos[chave] || (geos[chave] = fn());

    const grupoPerenes=new T.Group(); grupoPerenes.name="pes-perenes"; grupo.add(grupoPerenes);
    const matPerene=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.78});
    matPerene.defines={USE_UV:""};
    matPerene.onBeforeCompile=sh=>{
      sh.fragmentShader=sh.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
        if(vUv.x>=0.0) {
          float nervura=1.0-smoothstep(0.008,0.02,abs(vUv.y-.5));
          float laterais=1.0-smoothstep(.02,.065,abs(fract(vUv.x*9.0-abs(vUv.y-.5)*1.8)-.5));
          float variacao=sin(vUv.x*53.0+sin(vUv.y*27.0))*sin(vUv.y*47.0)*.035;
          diffuseColor.rgb *= .89+variacao+laterais*.08;
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.4+vec3(.025,.04,.007),nervura*.65);
        }`);
      sh.fragmentShader=sh.fragmentShader.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\n if(vUv.x>=0.0) roughnessFactor=.48;");
    };
    const modelosPerenes=new Map();let lotesPerenes=[],centrosPerenes=null,fotoPerenes=null;
    function modeloPerene(ent) {
      const chave=JSON.stringify(ent);if(modelosPerenes.has(chave))return modelosPerenes.get(chave);
      const g=f.perene(ent,ent.variante||0);g.computeBoundingBox();
      const box=g.boundingBox,W=Math.max(.2,box.max.x-box.min.x)*1.08,H=box.max.y*1.05,D=Math.max(.2,box.max.z-box.min.z)*1.08;
      const cx=(box.max.x+box.min.x)/2,cz=(box.max.z+box.min.z)/2;
      if(!fotoPerenes){fotoPerenes=new T.WebGLRenderer({canvas:doc.createElement("canvas"),alpha:true,antialias:true,preserveDrawingBuffer:true});fotoPerenes.outputEncoding=T.sRGBEncoding;fotoPerenes.setClearColor(0,0);}
      const N=256;fotoPerenes.setSize(N,N,false);
      const atlas=doc.createElement("canvas");atlas.width=N*3;atlas.height=N;const ac=atlas.getContext("2d");
      const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x65724f,1.1));const luz=new T.DirectionalLight(0xffffff,.9);luz.position.set(4,8,5);scene.add(luz);
      scene.add(new T.Mesh(g,matPerene));
      for(let i=0;i<3;i++) {
        const largura=i===1?D:W,altura=i===2?D:H,cam=new T.OrthographicCamera(-largura/2,largura/2,altura/2,-altura/2,.01,100);
        if(i===0){cam.position.set(cx,H/2,cz+25);cam.lookAt(cx,H/2,cz);}
        if(i===1){cam.position.set(cx+25,H/2,cz);cam.lookAt(cx,H/2,cz);}
        if(i===2){cam.position.set(cx,25,cz);cam.up.set(0,0,-1);cam.lookAt(cx,0,cz);}
        fotoPerenes.render(scene,cam);ac.drawImage(fotoPerenes.domElement,i*N,0);
      }
      const tex=new T.CanvasTexture(atlas);tex.encoding=T.sRGBEncoding;tex.anisotropy=4;
      const pos=[],uv=[];
      const quad=(pts,i)=>{for(const k of [0,1,2,0,2,3]){pos.push(...pts[k]);const u=[0,1,1,0][k],v=[0,0,1,1][k];uv.push((i+.002+u*.996)/3,.002+v*.996);}};
      quad([[cx-W/2,0,cz],[cx+W/2,0,cz],[cx+W/2,H,cz],[cx-W/2,H,cz]],0);
      quad([[cx,0,cz+D/2],[cx,0,cz-D/2],[cx,H,cz-D/2],[cx,H,cz+D/2]],1);
      quad([[cx-W/2,H*.73,cz+D/2],[cx+W/2,H*.73,cz+D/2],[cx+W/2,H*.73,cz-D/2],[cx-W/2,H*.73,cz-D/2]],2);
      const leve=new T.BufferGeometry();leve.setAttribute("position",new T.Float32BufferAttribute(pos,3));leve.setAttribute("uv",new T.Float32BufferAttribute(uv,2));leve.computeBoundingSphere();
      const matLeve=new T.MeshBasicMaterial({map:tex,alphaTest:.3,side:T.DoubleSide});
      const modelo={g,leve,matLeve,tex};modelosPerenes.set(chave,modelo);return modelo;
    }
    function montarPerenes() {
      for(const o of [...grupoPerenes.children]) {grupoPerenes.remove(o);o.dispose();}
      lotesPerenes=[];centrosPerenes=null;
      const lotes=new Map();
      for(const pe of p?.pes||[]) {
        const ent=p.paleta[pe.p-1];if(!ent||!CULTURAS[ent.cultura]?.perene)continue;
        const variante=Math.floor(hash(Math.round(pe.x*13),Math.round(pe.z*13),97)*3),chave=pe.p+"|"+variante;
        if(!lotes.has(chave))lotes.set(chave,{idx:pe.p,variante,pes:[]});lotes.get(chave).pes.push(pe);
      }
      const m=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),s=new T.Vector3(1,1,1),up=new T.Vector3(0,1,0);
      for(const {idx,pes,variante} of lotes.values()) {
        const ent={...p.paleta[idx-1],variante},modelo=modeloPerene(ent);
        const perto=new T.InstancedMesh(modelo.g,matPerene,pes.length),longe=new T.InstancedMesh(modelo.leve,modelo.matLeve,pes.length);
        perto.name=ent.cultura+"-"+ent.estagio;longe.name=perto.name+"-distante";
        const matrizes=pes.map((pe,i)=>{m.compose(v.set(pe.x+dx,op.alt(pe.x+dx,pe.z+dz),pe.z+dz),q.setFromAxisAngle(up,-pe.a||0),s);perto.setMatrixAt(i,m);return m.clone();});
        perto.frustumCulled=longe.frustumCulled=false;perto.receiveShadow=true;longe.count=0;
        grupoPerenes.add(perto,longe);lotesPerenes.push({perto,longe,pes,matrizes});
      }
    }
    function atualizarPerenes(centros,forcar) {
      if(!forcar&&centrosPerenes&&centros.length===centrosPerenes.length&&centros.every((c,i)=>Math.hypot(c.x-centrosPerenes[i].x,c.z-centrosPerenes[i].z)<2))return;
      centrosPerenes=centros.map(c=>({x:c.x,z:c.z}));
      const candidatos=[];
      for(const lote of lotesPerenes)lote.pes.forEach((pe,i)=>{const d=Math.min(...centros.map(c=>(pe.x+dx-c.x)**2+(pe.z+dz-c.z)**2));if(d<36*36)candidatos.push({lote,i,d});});
      candidatos.sort((a,b)=>a.d-b.d);
      const escolhidos=new Map();for(const c of candidatos.slice(0,256)){if(!escolhidos.has(c.lote))escolhidos.set(c.lote,new Set());escolhidos.get(c.lote).add(c.i);}
      for(const lote of lotesPerenes){let np=0,nl=0;const sel=escolhidos.get(lote);
        lote.matrizes.forEach((m,i)=>{if(sel?.has(i))lote.perto.setMatrixAt(np++,m);else lote.longe.setMatrixAt(nl++,m);});
        lote.perto.count=np;lote.longe.count=nl;lote.perto.instanceMatrix.needsUpdate=lote.longe.instanceMatrix.needsUpdate=true;
      }
    }
    function dados(plantio) {
      p = plantio;
      cul = p && (typeof p.culturas === "string" ? b64(p.culturas) : p.culturas);
      dan = p && (typeof p.daninhas === "string" ? b64(p.daninhas) : p.daninhas);
      montarPerenes();
      versao++;                       // os pedaços de perto vão sendo refeitos, o mais perto primeiro
      // pincelada atrás de pincelada: a copa só é refeita quando a pessoa parar
      clearTimeout(tCopa);
      if (!grupoLonge.children.length) montarCopa(); else tCopa = setTimeout(montarCopa, 400);
    }

    function amostra(a, x, z) {
      const i = Math.floor((x - dx - p.x0) / p.res), j = Math.floor((z - dz - p.z0) / p.res);
      return i < 0 || j < 0 || i >= p.nx || j >= p.nz ? 0 : a[j * p.nx + i];
    }
    const estagio = (def, ent) => Math.max(0, def.estagios.findIndex(s => s.id === ent.estagio));

    /* ---------------- copa (longe) ---------------- */
    const texturas = {};
    let fotografo = null;
    function fotografar(ent, def, k, s) {
      const chave = `${ent.cultura}|${k}|${s.esp}|${s.linhaReal}`;
      if (texturas[chave]) return texturas[chave];
      const lin = s.lin, pas = s.pas;
      const nU = Math.max(1, Math.round(2 / pas)), nV = Math.max(1, Math.round(2 / lin));
      const tU = nU * pas, tV = nV * lin, maior = Math.max(tU, tV);
      const px = Math.min(512, Math.max(64, Math.round(maior * 170)));
      const wpx = Math.max(16, Math.round(px * tU / maior)), hpx = Math.max(16, Math.round(px * tV / maior));
      if (!fotografo) {
        fotografo = new T.WebGLRenderer({ canvas: doc.createElement("canvas"), alpha: true, antialias: true, preserveDrawingBuffer: true });
        fotografo.outputEncoding = T.sRGBEncoding;
        fotografo.setClearColor(0x000000, 0);
      }
      fotografo.setSize(wpx, hpx, false);
      const cena = new T.Scene();
      cena.add(new T.HemisphereLight(0xffffff, 0x6a7448, 1.25));
      const sol = new T.DirectionalLight(0xffffff, 0.75); sol.position.set(0.4, 1, 0.3); cena.add(sol);
      // 3 x 3 cópias do mesmo ladrilho: a textura emenda sem costura
      const listas = {}, m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), v3 = new T.Vector3();
      for (let jv = -nV; jv < 2 * nV; jv++) for (let iu = -nU; iu < 2 * nU; iu++) {
        const a = ((iu % nU) + nU) % nU, b = ((jv % nV) + nV) % nV;
        if (hash(a, b + 5, 31) < def.falha) continue;
        const h = hash(a, b, 31);
        const u = iu * pas + (def.semLinha ? (h - 0.5) * pas * 0.8 : (h - 0.5) * pas * 0.15);
        const v = jv * lin + (def.semLinha ? (hash(b, a, 38) - 0.5) * lin * 0.8 : 0);
        const vr = Math.floor(hash(a + 3, b, 31) * VARIANTES), esc = 0.92 + 0.16 * hash(a, b, 34);
        const ch = `${ent.cultura}|${k}|${vr}|${s.esp}|${s.linhaReal}`;
        const L = listas[ch] || (listas[ch] = { vr, m: [] });
        m4.compose(v3.set(u, 0, v), q.setFromEuler(e.set(0, def.semLinha ? h * 6.283 : h > 0.5 ? Math.PI : 0, 0)), sc.set(esc, esc * (0.9 + 0.2 * h), esc));
        L.m.push(m4.clone());
      }
      const matF = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
      for (const ch in listas) {
        const L = listas[ch];
        const im = new T.InstancedMesh(geo(ch, () => f.instancia(ent.cultura, k, L.vr, s.esp, s.linhaReal / 2)), matF, L.m.length);
        L.m.forEach((m, i) => im.setMatrixAt(i, m));
        im.frustumCulled = false;
        cena.add(im);
      }
      // de cima, olhando para baixo: direita = +u (ao longo da linha), alto da imagem = v 0
      const cam = new T.OrthographicCamera(0, tU, 0, -tV, 0.1, 20);
      cam.position.set(0, 10, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
      fotografo.render(cena, cam);
      const c2 = doc.createElement("canvas"); c2.width = wpx; c2.height = hpx;
      c2.getContext("2d").drawImage(fotografo.domElement, 0, 0);
      cena.traverse(o => { if (o.isInstancedMesh) o.dispose(); });
      matF.dispose();
      const tex = new T.CanvasTexture(c2);
      tex.encoding = T.sRGBEncoding; tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.anisotropy = 8;
      return (texturas[chave] = { tex, tU, tV });
    }

    const matsCopa = [];
    function materialCopa(tex) {
      // transparência (não recorte): de longe as linhas se misturam em vez de virar listras
      const m = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: true, side: T.DoubleSide });
      m.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, unif);
        sh.vertexShader = "varying vec3 vMundo;" + NL + sh.vertexShader.replace("#include <project_vertex>",
          "#include <project_vertex>" + NL + "vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        sh.fragmentShader = CABECA + "varying vec3 vMundo;" + NL + sh.fragmentShader.replace("void main() {", [
          "void main() {",
          "  float d = min(distance(vMundo.xz, uC0.xz), distance(vMundo.xz, uC1.xz));",
          "  float h = fract(sin(dot(floor(vMundo.xz * 8.0), vec2(12.9898, 78.233))) * 43758.5453);",
          "  if (d < uR - uB + uB * h) discard;"].join(NL));
      };
      matsCopa.push(m);
      return m;
    }

    function montarCopa() {
      for (const o of [...grupoLonge.children]) { grupoLonge.remove(o); o.geometry.dispose(); }
      for (const m of matsCopa) m.dispose();
      matsCopa.length = 0;
      if (!p || !cul) return;
      const C = Math.max(1, Math.round(1 / p.res));          // célula da copa: ~1 m
      const ni = Math.ceil(p.nx / C), nj = Math.ceil(p.nz / C);
      // cor (da pintura) que domina cada célula
      const dono = new Uint8Array(ni * nj), conta = new Uint16Array(256);
      for (let J = 0; J < nj; J++) for (let I = 0; I < ni; I++) {
        let melhor = 0, n = 0;
        const usados = [];
        for (let j = J * C; j < Math.min(p.nz, J * C + C); j++) for (let i = I * C; i < Math.min(p.nx, I * C + C); i++) {
          const v = cul[j * p.nx + i]; if (!v) continue;
          if (!conta[v]) usados.push(v);
          if (++conta[v] > n) { n = conta[v]; melhor = v; }
        }
        for (const v of usados) conta[v] = 0;
        if (n * 2 >= C * C) dono[J * ni + I] = melhor;
      }
      const lado = C * p.res;
      p.paleta.forEach((ent, iPal) => {
        const idx = iPal + 1, def = CULTURAS[ent.cultura]; if (!def) return;
        const k = estagio(def, ent), hEst = def.estagios[k].h;
        if (hEst < 0.12) return;                           // rente ao chão: o dossel pintado basta
        let tem = false;
        for (let n = 0; n < dono.length && !tem; n++) tem = dono[n] === idx;
        if (!tem) return;
        const s = espacamento(ent, def), foto = fotografar(ent, def, k, s);
        const a = (ent.angulo || 0) * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
        const hC = hEst * 0.8;
        const pos = [], uv = [], ind = [], vert = new Map();
        const ponto = (I, J) => {
          const ch = J * (ni + 1) + I;
          let n = vert.get(ch);
          if (n === undefined) {
            const x = dx + p.x0 + I * lado, z = dz + p.z0 + J * lado;
            n = pos.length / 3; vert.set(ch, n);
            pos.push(x, op.alt(x, z) + hC, z);
            uv.push((x * ux + z * uz) / foto.tU, -(x * vx + z * vz) / foto.tV);
          }
          return n;
        };
        for (let J = 0; J < nj; J++) for (let I = 0; I < ni; I++) {
          if (dono[J * ni + I] !== idx) continue;
          const a0 = ponto(I, J), a1 = ponto(I + 1, J), a2 = ponto(I + 1, J + 1), a3 = ponto(I, J + 1);
          ind.push(a0, a2, a1, a0, a3, a2);
        }
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
        g.setIndex(ind);
        g.computeBoundingSphere();
        const m = new T.Mesh(g, materialCopa(foto.tex));
        m.name = "copa-" + ent.cultura; m.renderOrder = 2;
        grupoLonge.add(m);
      });
    }

    /* ---------------- pedaços de perto ---------------- */
    const pedacos = new Map();      // "ci,cj" -> { g: Group, versao, visto }
    let quadroN = 0;
    function montarPedaco(ci, cj, simples) {
      const x0 = ci * S, x1 = x0 + S, z0 = cj * S, z1 = z0 + S;
      const g = new T.Group();
      const listas = {};
      const m4 = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), sc = new T.Vector3(), v3 = new T.Vector3();
      const por = (chave, fn, x, z, giro, esc, altura) => {
        const L = listas[chave] || (listas[chave] = { fn, m: [], c: [] });
        m4.compose(v3.set(x, op.alt(x, z) - 0.015, z), q.setFromEuler(e.set(0, giro, 0)), sc.set(esc, esc * altura, esc));
        for (let i = 0; i < 16; i++) L.m.push(m4.elements[i]);
        const t = 0.82 + 0.36 * hash(Math.round(x * 13), Math.round(z * 13), 5);
        L.c.push(t, t * (0.97 + 0.06 * hash(Math.round(x * 7), 1, 2)), t);
      };
      const presentes = new Set();
      for (let x = x0 + 0.25; x < x1; x += 1) for (let z = z0 + 0.25; z < z1; z += 1) { const v = amostra(cul, x, z); if (v) presentes.add(v); }
      for (const idx of presentes) {
        const ent = p.paleta[idx - 1], def = ent && CULTURAS[ent.cultura];
        if (!def) continue;
        const k = estagio(def, ent);
        const a = (ent.angulo || 0) * Math.PI / 180, ux = Math.cos(a), uz = Math.sin(a), vx = -uz, vz = ux;
        const s = espacamento(ent, def), lin = s.lin, pas = s.pas;
        let u0 = 1e9, u1 = -1e9, w0 = 1e9, w1 = -1e9;
        for (const x of [x0, x1]) for (const z of [z0, z1]) {
          const uu = x * ux + z * uz, vv = x * vx + z * vz;
          u0 = Math.min(u0, uu); u1 = Math.max(u1, uu); w0 = Math.min(w0, vv); w1 = Math.max(w1, vv);
        }
        for (let jv = Math.floor(w0 / lin) - 1; jv <= Math.ceil(w1 / lin) + 1; jv++) for (let iu = Math.floor(u0 / pas) - 1; iu <= Math.ceil(u1 / pas) + 1; iu++) {
          const h = hash(iu, jv, idx);
          const uu = iu * pas + (def.semLinha ? (h - 0.5) * pas * 0.8 : (h - 0.5) * pas * 0.15);
          const vv = jv * lin + (def.semLinha ? (hash(jv, iu, idx + 7) - 0.5) * lin * 0.8 : 0);
          const x = uu * ux + vv * vx, z = uu * uz + vv * vz;
          if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;        // cada pé em um pedaço só
          if (hash(iu, jv + 5, idx) < def.falha) continue;             // falha de estande
          if (amostra(cul, x, z) !== idx) continue;
          const vr = Math.floor(hash(iu + 3, jv, idx) * VARIANTES);
          const giro = -a + (def.semLinha ? h * 6.283 : h > 0.5 ? Math.PI : 0);
          por(`${simples ? "s" : "d"}|${ent.cultura}|${k}|${vr}|${s.esp}|${s.linhaReal}`, () => f.instancia(ent.cultura, k, vr, s.esp, s.linhaReal / 2, simples), x, z, giro, 0.92 + 0.16 * hash(iu, jv, idx + 3), 0.9 + 0.2 * h);
        }
      }
      // daninhas: grade de 0,5 m, chance pela densidade pintada (até ~4 por m²)
      if (dan) {
        const P = 0.5;
        for (let j = Math.floor(z0 / P); j < Math.floor(z1 / P); j++) for (let i = Math.floor(x0 / P); i < Math.floor(x1 / P); i++) {
          const x = (i + hash(i, j, 91)) * P, z = (j + hash(j, i, 92)) * P;
          const den = amostra(dan, x, z);
          if (!den || hash(i, j, 93) > den / 255) continue;
          const t = Math.floor(hash(i, j, 95) * DANINHAS.length), vr = Math.floor(hash(i, j, 96) * 2);
          por(`dan|${t}|${vr}`, () => f.daninha(t, vr), x, z, hash(i, j, 97) * 6.283, 0.6 + 0.7 * hash(i, j, 98), 1);
        }
      }
      for (const chave in listas) {
        const L = listas[chave], n = L.m.length / 16;
        const im = new T.InstancedMesh(geo(chave, L.fn), mat, n);
        im.instanceMatrix.array.set(L.m);
        // o array tem de nascer do lado do THREE: no treinamento ele vive no
        // iframe do campo, e um Float32Array desta janela é "outro tipo" lá
        const F32 = im.instanceMatrix.array.constructor;
        im.instanceColor = new T.InstancedBufferAttribute(new F32(L.c), 3);
        im.frustumCulled = false;   // a esfera é da planta, não do conjunto
        im.receiveShadow = true;
        g.add(im);
      }
      return g;
    }
    function largar(chave) {
      const pd = pedacos.get(chave); if (!pd) return;
      grupo.remove(pd.g);
      for (const o of pd.g.children) o.dispose();
      pedacos.delete(chave);
    }

    const frustum = new T.Frustum(), mProj = new T.Matrix4(), esfera = new T.Sphere();
    function atualizarVarios(centros, forcar, camera) {
      atualizarPerenes(centros,forcar);
      quadroN++;
      if (camera) { camera.updateMatrixWorld(); mProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(mProj); }
      unif.uC0.value.set(centros[0] ? centros[0].x : 1e9, 0, centros[0] ? centros[0].z : 1e9);
      unif.uC1.value.set(centros[1] ? centros[1].x : 1e9, 0, centros[1] ? centros[1].z : 1e9);
      if (!p || !cul) return;
      // pedaços que encostam no círculo de algum centro; detalhado só o pedaço onde está o 1º (câmera / drone)
      const falta = [], perto = new Map();
      for (const c of centros) {
        for (let ci = Math.floor((c.x - R) / S); ci <= Math.floor((c.x + R) / S); ci++)
          for (let cj = Math.floor((c.z - R) / S); cj <= Math.floor((c.z + R) / S); cj++) {
            const qx = Math.max(ci * S, Math.min(c.x, ci * S + S)), qz = Math.max(cj * S, Math.min(c.z, cj * S + S));
            const d = Math.hypot(qx - c.x, qz - c.z);
            if (d > R) continue;
            const chave = ci + "," + cj;
            const ant = perto.get(chave);
            if (ant === undefined || d < ant.d) perto.set(chave, { ci, cj, d });
          }
      }
      for (const [chave, q] of perto) {
        const pd = pedacos.get(chave), c0 = centros[0];
        const simples = !(c0 && Math.floor(c0.x / S) === q.ci && Math.floor(c0.z / S) === q.cj);
        let ve = true;
        if (camera) {
          const cx = q.ci * S + S / 2, cz = q.cj * S + S / 2;
          esfera.center.set(cx, op.alt(cx, cz) + 1, cz); esfera.radius = S * 0.75 + 2.5;
          ve = frustum.intersectsSphere(esfera);
        }
        if (pd) { pd.visto = quadroN; pd.g.visible = ve; }
        if (!pd || pd.versao !== versao || pd.simples !== simples) falta.push({ chave, ci: q.ci, cj: q.cj, d: q.d + (ve ? 0 : 1000), simples });
      }
      for (const [, pd] of pedacos) if (pd.visto !== quadroN) pd.g.visible = false;
      // monta o que falta, o mais perto primeiro, sem passar de ~6 ms por chamada
      falta.sort((a, b) => a.d - b.d);
      const t0 = performance.now();
      for (const fz of falta) {
        if (!forcar && performance.now() - t0 > 6) break;
        const pd = pedacos.get(fz.chave), vis = pd ? pd.g.visible : true;
        if (pd) largar(fz.chave);
        const g = montarPedaco(fz.ci, fz.cj, fz.simples);
        g.visible = vis;
        grupo.add(g);
        pedacos.set(fz.chave, { g, versao, visto: quadroN, simples: fz.simples });
      }
      // guarda até 160 pedaços; os que ninguém vê há mais tempo saem primeiro
      if (pedacos.size > 160) {
        const velhos = [...pedacos].filter(([, pd]) => pd.visto !== quadroN).sort((a, b) => a[1].visto - b[1].visto);
        const sobra = pedacos.size - 160;
        for (let i = 0; i < sobra && i < velhos.length; i++) largar(velhos[i][0]);
      }
    }

    dados(op.plantio);

    return {
      grupo,
      grupoLonge,
      dados,
      atualizar(cx, cz, forcar, camera) { atualizarVarios([{ x: cx, z: cz }], forcar, camera); },
      atualizarVarios,
      contagem() { let n = (p?.pes||[]).length; for (const [, pd] of pedacos) if (pd.g.visible) for (const m of pd.g.children) n += m.count; return n; },
      descartar() {
        clearTimeout(tCopa);
        for (const ch of [...pedacos.keys()]) largar(ch);
        for (const o of [...grupoLonge.children]) { grupoLonge.remove(o); o.geometry.dispose(); }
        for (const m of matsCopa) m.dispose();
        for (const k in texturas) texturas[k].tex.dispose();
        if (fotografo) { fotografo.dispose(); if (fotografo.forceContextLoss) fotografo.forceContextLoss(); fotografo = null; }
        for (const k in geos) geos[k].dispose();
        for(const o of grupoPerenes.children) o.dispose();
        for(const modelo of modelosPerenes.values()){modelo.g.dispose();modelo.leve.dispose();modelo.matLeve.dispose();modelo.tex.dispose();}
        modelosPerenes.clear();
        if(fotoPerenes){fotoPerenes.dispose();fotoPerenes.forceContextLoss();}
        matPerene.dispose();
        mat.dispose();
        if (grupo.parent) grupo.parent.remove(grupo);
        if (grupoLonge.parent) grupoLonge.parent.remove(grupoLonge);
      },
    };
  }

  /* textura do dossel do mapa inteiro (uma célula da pintura = um pixel) */
  function dossel(T, p, documento) {
    const cul = typeof p.culturas === "string" ? b64(p.culturas) : p.culturas;
    const c = (documento || document).createElement("canvas");
    c.width = p.nx; c.height = p.nz;
    const g = c.getContext("2d"), img = g.createImageData(p.nx, p.nz), d = img.data;
    const cores = p.paleta.map(e => {
      const def = CULTURAS[e.cultura], k = def ? Math.max(0, def.estagios.findIndex(s => s.id === e.estagio)) : 0;
      const [hex, cob] = (DOSSEL[e.cultura] || [["#5f9a3a", 0.8]])[k] || ["#5f9a3a", 0.8];
      const n = parseInt(hex.slice(1), 16);
      return [n >> 16, (n >> 8) & 255, n & 255, Math.round(cob * 255)];
    });
    for (let k = 0; k < cul.length; k++) {
      const v = cul[k]; if (!v || !cores[v - 1]) continue;
      const o = k * 4, q = cores[v - 1], ruido = 0.9 + 0.2 * hash(k, 3, 7);
      d[o] = q[0] * ruido; d[o + 1] = q[1] * ruido; d[o + 2] = q[2] * ruido; d[o + 3] = q[3];
    }
    g.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    return t;
  }

  raiz.PlantasReais = { pontosLinha, pontosArea, dentroPoligono, medidas, alturaPerenes, CULTURAS, DANINHAS, DOSSEL, criar, dossel, hash, b64, paraB64, espacamento };
})(typeof window !== "undefined" ? window : this);
