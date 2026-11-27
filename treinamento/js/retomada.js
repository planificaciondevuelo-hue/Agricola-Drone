/* Um checkpoint por conta, neste navegador. Registro e resumo são gravados
   na mesma transação; só anunciar sucesso depois de oncomplete. */
(function () {
  'use strict';
  const sim=location.pathname.endsWith('/sim.html'), params=new URLSearchParams(location.search);
  const pedido=sim&&params.get('retomar'), gravador=crypto.randomUUID();
  let banco, conexao, dono='', id=pedido||crypto.randomUUID(), assumiu=false, pronto=false, ocupado=null, ultima=null;
  const api=window.RETOMADA_SIM={carregando:!!pedido,salvar, get pronto(){return pronto;}, get ultimo(){return ultima;}};
  function abrir() {
    if(banco)return banco;
    let encerrado=false;
    const abertura=new Promise((resolve,reject)=>{
      const r=indexedDB.open('tpd-operacao',1);
      r.onupgradeneeded=()=>{r.result.createObjectStore('operacoes');r.result.createObjectStore('resumos');};
      r.onsuccess=()=>{
        if(encerrado){r.result.close();return;}
        conexao=r.result;
        const invalidar=()=>{if(conexao===r.result){conexao=null;banco=null;}};
        r.result.onversionchange=()=>{r.result.close();invalidar();};
        r.result.onclose=invalidar;
        resolve(r.result);
      };
      r.onerror=()=>{encerrado=true;reject(r.error);};
      r.onblocked=()=>{encerrado=true;reject(Error('Feche as outras abas do simulador e tente novamente.'));};
    }).catch(e=>{if(banco===abertura)banco=null;throw e;});
    banco=abertura;return banco;
  }
  async function comBanco(acao) {
    for(let tentativa=0;tentativa<2;tentativa++){
      try{return await acao(await abrir());}
      catch(e){
        // Reabre uma vez após falha interna/conexão fechada. Nunca apaga o banco
        // nem repete erros de cota, serialização ou disputa entre abas.
        if(tentativa||!['UnknownError','InvalidStateError'].includes(e?.name))throw e;
        conexao?.close();conexao=null;banco=null;
      }
    }
  }
  async function ler(loja) {
    return comBanco(db=>new Promise((resolve,reject)=>{
      const t=db.transaction(loja),r=t.objectStore(loja).get(dono);
      t.oncomplete=()=>resolve(r.result);t.onabort=()=>reject(t.error||r.error||Error('Leitura interrompida.'));t.onerror=()=>{};
    }));
  }
  function status(texto,erro=false) {
    let e=document.getElementById('retomada-status');
    if(!e){e=document.createElement('small');e.id='retomada-status';e.setAttribute('role','status');
      const painel=document.querySelector('#pausa-painel>div');if(painel)painel.appendChild(e);else return;}
    e.textContent=texto;e.style.cssText='display:block;margin-top:14px;color:'+(erro?'#ffbe85':'#b9c8bb');
  }
  function avisoFalha(e) {
    const outraAba=e?.message?.includes('outra aba');
    const msg=outraAba?'Esta operação foi aberta em outra aba. Continue o treino nela.':e?.name==='QuotaExceededError'?'Não há espaço para salvar a operação neste navegador.':e?.name==='UnknownError'?'O navegador não conseguiu acessar o armazenamento da operação. Mantenha esta página aberta e tente salvar novamente.':'Não foi possível salvar a operação. Mantenha esta página aberta e tente novamente.';
    api.falha={nome:e?.name||'Error',mensagem:e?.message||String(e)};
    if(outraAba)window.PAUSA_SIM?.definir(true);
    status(msg,true);console.warn('Salvamento da operação:',e);
    // Erros não podem ficar escondidos enquanto a pessoa continua voando.
    let aviso=document.getElementById('retomada-erro');
    if(!aviso){aviso=document.createElement('p');aviso.id='retomada-erro';aviso.setAttribute('role','alert');aviso.style.cssText='position:fixed;top:56px;left:12px;right:12px;z-index:2147483647;background:#462411;color:#fff;padding:10px;font:14px sans-serif';document.body.appendChild(aviso);}
    aviso.textContent=msg;
    if(!outraAba){
      const tentar=document.createElement('button');tentar.type='button';tentar.textContent='Tentar salvar novamente';
      tentar.style.cssText='margin-left:12px;padding:6px 10px;cursor:pointer';
      tentar.onclick=async()=>{
        tentar.disabled=true;
        try{
          if(await salvar())return;
          await ler('resumos');
          api.falha=null;aviso.remove();status('Armazenamento disponível. A operação será salva ao entrar no simulador.');
        }catch(erro){avisoFalha(erro);}
        finally{tentar.disabled=false;}
      };
      aviso.appendChild(tentar);
    }
  }
  function urlDoEstado(s) {
    const u=new URL(location.href);u.searchParams.delete('retomar');
    u.searchParams.set('cenario',({coxilha:'plano',baixada:'mediano',encosta:'montanhoso'})[s.campo.cenario]||s.campo.cenario);
    return u.pathname+u.search;
  }
  async function gravar(s) {
    const resumo={id,gravador,dono,versao:1,em:Date.now(),drone:params.get('drone'),url:urlDoEstado(s)};
    await comBanco(db=>new Promise((resolve,reject)=>{
      const t=db.transaction(['operacoes','resumos'],'readwrite'),m=t.objectStore('resumos');
      const r=m.get(dono);let falha;
      r.onsuccess=()=>{
        try {
          if(assumiu&&(!r.result||r.result.id!==id||r.result.gravador!==gravador))throw Error('Esta operação foi aberta em outra aba.');
          m.put(resumo,dono);t.objectStore('operacoes').put({resumo,estado:s,segundos:window.MEDIDOR_SESSAO?.exportar()||0},dono);
        }catch(e){falha=e;t.abort();}
      };
      t.oncomplete=resolve;t.onabort=()=>reject(falha||t.error||Error('Gravação interrompida.'));t.onerror=()=>{};
    }));
    assumiu=true;ultima=resumo;api.falha=null;document.getElementById('retomada-erro')?.remove();
    const endereco=new URL(resumo.url,location.origin);endereco.searchParams.set('retomar',id);
    history.replaceState(history.state,'',endereco.pathname+endereco.search);
    status('Operação salva neste navegador às '+new Date(resumo.em).toLocaleTimeString('pt-BR')+'.');
    return true;
  }
  async function salvar() {
    if(ocupado){await ocupado;return salvar();}
    if(api.carregando)return false;
    if(!pronto||!dono){
      if(window.XG?.ponte?.ler('telaInicial')===false)throw Error('Aguarde o carregamento do salvamento antes de sair.');
      return false;
    }
    // Entrar na escolha do cenário não substitui a operação anterior.
    if(XG.ponte.ler('telaInicial')!==false)return false;
    ocupado=Promise.resolve().then(()=>gravar(RETOMADA_ESTADO.capturar())).catch(e=>{avisoFalha(e);throw e;}).finally(()=>{ocupado=null;});
    return ocupado;
  }
  function carregando(texto) {
    let e=document.getElementById('retomada-carregando');
    if(!e){e=document.createElement('div');e.id='retomada-carregando';e.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;padding:24px;background:#14271e;color:white;font:18px sans-serif';document.body.appendChild(e);}
    e.textContent=texto;return e;
  }
  async function aguardar(fn) {
    for(let n=0;n<600;){if(fn())return;if(!document.querySelector('#primeiro-voo-dialogo[open]'))n++;await new Promise(r=>setTimeout(r,500));}
    throw Error('O simulador não terminou de carregar. A operação salva foi preservada.');
  }
  async function iniciarSim() {
    if(pedido)carregando('Recuperando sua operação…');
    await window.TREINO_AUTORIZADO;
    const c=CONTAS.atual();if(!c)return;dono=String(c.email).trim().toLowerCase();
    if(!pedido)ler('resumos').catch(avisoFalha); // testa também a leitura antes da primeira operação
    let salvo;
    if(pedido){
      salvo=await ler('operacoes');
      if(!salvo||salvo.resumo.id!==pedido||salvo.resumo.dono!==dono||salvo.resumo.versao!==1)throw Error('Esta operação salva não está disponível nesta conta e navegador.');
      const antiga=new URL(salvo.resumo.url,location.origin);
      if(['drone','marca','modelo','cenario'].some(k=>antiga.searchParams.get(k)!==params.get(k)))throw Error('Abra a operação pelo botão Continuar de onde parou.');
    }
    await aguardar(()=>window.RETOMADA_ESTADO&&window.XG?.ponte?.janela&&XG.manual()?.instalado&&document.getElementById('carregando')?.classList.contains('esconder')&&
      (/^(p60|p150|p150max|p100pro)$/.test(params.get('drone')||'')?document.getElementById('controle')?.contentWindow?.RETOMADA_XAG:window.__xgAppVirtual?.M&&__xgAppVirtual.document.readyState!=='loading'&&XG.ponte.janela.xgBateria&&XG.ponte.janela.xgEquipe?.b));
    RETOMADA_ESTADO.instalar();pronto=true;
    if(salvo){
      PAUSA_SIM.definir(true);
      RETOMADA_ESTADO.restaurar(salvo.estado);
      window.MEDIDOR_SESSAO?.restaurar(salvo.segundos);
      // Reclama o checkpoint; uma aba antiga não pode sobrescrevê-lo depois.
      await comBanco(db=>new Promise((resolve,reject)=>{
        const t=db.transaction('resumos','readwrite'),m=t.objectStore('resumos'),r=m.get(dono);
        let falha;
        r.onsuccess=()=>{try{if(r.result?.id!==id)throw Error('Outra operação foi iniciada. Volte à tela inicial.');m.put({...r.result,gravador},dono);}catch(e){falha=e;t.abort();}};
        t.oncomplete=resolve;t.onabort=()=>reject(falha||t.error||Error('Gravação interrompida.'));t.onerror=()=>{};
      }));assumiu=true;ultima=salvo.resumo;api.carregando=false;
      document.getElementById('retomada-carregando')?.remove();
      document.getElementById('pausa-titulo').textContent='Operação recuperada';
      status('Tudo pronto. Toque em Continuar treinamento quando quiser retomar.');
    }
    const p=document.querySelector('#pausa-painel>div>p:nth-of-type(2)');
    if(p)p.textContent='O salvamento é automático neste navegador. Na tela inicial, use Continuar de onde parou.';
    setInterval(()=>salvar().catch(()=>{}),5000);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){PAUSA_SIM.definir(true);salvar().catch(()=>{});}});
    addEventListener('pagehide',()=>{PAUSA_SIM.definir(true);salvar().catch(()=>{});});
    addEventListener('pausa-simulador',()=>salvar().catch(()=>{}));
    addEventListener('treino-minuto-registrado',()=>salvar().catch(()=>{}));
    await salvar();
  }
  async function inicio() {
    await aguardar(()=>window.CONTAS?.atual());const c=CONTAS.atual();dono=String(c.email).trim().toLowerCase();
    const s=await ler('resumos');if(!s||s.dono!==dono)return;
    const caixa=document.createElement('section');caixa.id='retomada-inicio';caixa.style.cssText='padding:18px;margin:16px 0;border:1px solid #63b23c;border-radius:12px;background:rgba(99,178,60,.08)';
    const h=document.createElement('h2');h.textContent='Sua operação está salva';
    const p=document.createElement('p');p.textContent=(CONTAS.DRONES[s.drone]||s.drone)+' · '+new Date(s.em).toLocaleString('pt-BR')+' · neste navegador';
    const b=document.createElement('button');b.className='botao botao--principal';b.textContent='Continuar de onde parou';b.type='button';
    const msg=document.createElement('p');msg.setAttribute('role','status');
    msg.textContent='Ao começar outro treino, ele passa a ser a operação salva.';
    b.onclick=async()=>{
      b.disabled=true;
      try {
        const atual=await CONTAS.recarregar();
        if(!atual||String(atual.email).trim().toLowerCase()!==dono)throw Error('Entre na conta que salvou esta operação.');
        if(!CONTAS.prepararSimulador(atual,s.drone))throw Error('Este drone não está disponível para sua conta.');
        const u=new URL(s.url,location.origin);
        if(u.origin!==location.origin||u.pathname!=='/treinamento/sim.html')throw Error('Endereço da operação inválido.');
        u.searchParams.set('retomar',s.id);location.assign(u.href);
      }catch(e){msg.textContent=e.message;b.disabled=false;}
    };
    caixa.append(h,p,b,msg);const lugar=document.querySelector('main .envelope')||document.querySelector('main');lugar?.prepend(caixa);
  }
  function executar() {
    (sim?iniciarSim():inicio()).catch(e=>{
      api.erro=e.message;console.warn('Recuperação da operação:',e);
      if(sim&&pedido){PAUSA_SIM?.definir(true);const el=carregando(e.message+' Seu salvamento não foi apagado.');const a=document.createElement('a');a.href='conta/inicio.html';a.textContent='Voltar à tela inicial';a.style.cssText='color:#acd991;margin-top:20px';el.appendChild(a);}
      else if(sim)avisoFalha(e);
      else console.warn('Retomada:',e);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',executar);else executar();
})();
