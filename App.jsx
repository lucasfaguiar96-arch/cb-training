import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const C = {
  red:'#cc1a1a', white:'#ffffff', offwhite:'#f5f0f0',
  gray:'#9a8f8f', grayLight:'#c8c0c0', black:'#0d0d0d',
  blackAlt:'#161010', border:'#2a1818',
}
const LEVELS     = ['Intermediário','Avançado']
const CATEGORIES = ['Masculino','Feminino','Misto']
const GENDERS    = ['Masculino','Feminino']
const SIDES      = ['Direita','Esquerda','Ambos']
const LW         = { Intermediário:2, Avançado:3 }
const MULTS      = { 6:1, 5:1.5, 4:2, 3:2.5 }

function getMult(l1,l2){ return MULTS[(LW[l1]??2)+(LW[l2]??2)]??1 }
function calcPts(win,lMe,lPart){ return win ? Math.round(3*getMult(lMe,lPart)*10)/10 : 0 }

function shuffle(arr){
  const a=[...arr]
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]] }
  return a
}

function formDuplas(players){
  const rights=shuffle(players.filter(p=>p.side==='Direita'))
  const lefts =shuffle(players.filter(p=>p.side==='Esquerda'))
  const jokers=shuffle(players.filter(p=>p.side==='Ambos'))
  const duplas=[]
  while(rights.length>0&&lefts.length>0)  duplas.push([rights.shift(),lefts.shift()])
  while(rights.length>0&&jokers.length>0) duplas.push([rights.shift(),jokers.shift()])
  while(lefts.length>0 &&jokers.length>0) duplas.push([lefts.shift(), jokers.shift()])
  while(jokers.length>=2)                 duplas.push([jokers.shift(),jokers.shift()])
  return { duplas, leftover:[...rights,...lefts,...jokers] }
}

function gerarJogos(duplas){
  const n=duplas.length
  if(n<2) return []
  const pc=new Array(n).fill(0)
  const matches=[]
  const add=(a,b)=>{ matches.push({duplaA:a,duplaB:b,winner:null}); pc[a]++;pc[b]++ }
  const idx=shuffle(duplas.map((_,i)=>i))
  for(let i=0;i+1<idx.length;i+=2) add(idx[i],idx[i+1])
  if(idx.length%2!==0){
    const odd=idx[idx.length-1]
    const best=[...Array(n).keys()].filter(x=>x!==odd).sort((a,b)=>pc[a]-pc[b])[0]
    add(odd,best)
  }
  for(let iter=0;iter<100;iter++){
    const under=[...Array(n).keys()].filter(i=>pc[i]<2)
    if(under.length<2) break
    const u=shuffle(under)
    for(let i=0;i+1<u.length;i+=2) add(u[i],u[i+1])
    if(u.length%2!==0){
      const odd=u[u.length-1]
      const best=[...Array(n).keys()].filter(x=>x!==odd).sort((a,b)=>pc[a]-pc[b])[0]
      add(odd,best)
    }
  }
  return matches
export default function App(){
  const [players,  setPlayers]  = useState([])
  const [matches,  setMatches]  = useState([])
  const [sorteio,  setSorteio]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('ranking')
  const [error,    setError]    = useState(null)
  const [filterCat,   setFilterCat]   = useState('Masculino')
  const [filterLevel, setFilterLevel] = useState('Avançado')
  const [sorteioCat,    setSorteioCat]    = useState('Masculino')
  const [presentIds,    setPresentIds]    = useState([])
  const [sorteioError,  setSorteioError]  = useState(null)
  const [pForm, setPForm] = useState({ name:'', gender:'Masculino', level:'Avançado', side:'Direita' })
  const initMF = { category:'Masculino', matchLevel:'Avançado',
    p1:'',p1level:'Avançado', p2:'',p2level:'Avançado',
    p3:'',p3level:'Avançado', p4:'',p4level:'Avançado', winner:'A' }
  const [mForm, setMForm] = useState(initMF)

  const loadAll = useCallback(async (showLoader=false) => {
    if(showLoader) setLoading(true)
    const [{ data: pl }, { data: ma }, { data: so }] = await Promise.all([
      supabase.from('players').select('*').order('name'),
      supabase.from('matches').select('*').order('created_at', { ascending: false }),
      supabase.from('sorteios').select('*').order('created_at', { ascending: false }).limit(1),
    ])
    if(pl) setPlayers(pl)
    if(ma) setMatches(ma)
    if(so && so.length > 0) setSorteio(so[0])
    else setSorteio(null)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll(true) }, [loadAll])

  useEffect(() => {
    const ch1 = supabase.channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => loadAll())
      .subscribe()
    const ch2 = supabase.channel('matches-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => loadAll())
      .subscribe()
    const ch3 = supabase.channel('sorteios-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteios' }, () => loadAll())
      .subscribe()
    const interval = setInterval(() => loadAll(), 5000)
    return () => { ch1.unsubscribe(); ch2.unsubscribe(); ch3.unsubscribe(); clearInterval(interval) }
  }, [loadAll])

  const getRanking = (category, level) => {
    const pts={}, games={}, wins={}, losses={}
    players.filter(p=>(category==='Misto'?true:p.gender===category)&&p.level===level)
      .forEach(p=>{ pts[p.id]=0; games[p.id]=0; wins[p.id]=0; losses[p.id]=0 })
    matches.filter(m=>m.category===category).forEach(m=>{
      const getLevel=(id,matchLv)=>{
        if(matchLv&&matchLv!=='mixed'&&matchLv!=='null') return matchLv
        return players.find(p=>p.id===id)?.level??'Avançado'
      }
      const l1=getLevel(m.p1,m.p1_level), l2=getLevel(m.p2,m.p2_level)
      const l3=getLevel(m.p3,m.p3_level), l4=getLevel(m.p4,m.p4_level)
      const tA=[{id:m.p1,level:l1,partner:l2},{id:m.p2,level:l2,partner:l1}]
      const tB=[{id:m.p3,level:l3,partner:l4},{id:m.p4,level:l4,partner:l3}]
      ;[...tA,...tB].forEach(({id,level:lv,partner})=>{
        const pl=players.find(p=>p.id===id)
        if(!pl) return
        if(category!=='Misto'&&pl.gender!==category) return
        if(lv!==level) return
        const inA=tA.some(t=>t.id===id)
        const won=(m.winner==='A'&&inA)||(m.winner==='B'&&!inA)
        pts[id]=(pts[id]??0)+calcPts(won,lv,partner)
        games[id]=(games[id]??0)+1
        wins[id]=(wins[id]??0)+(won?1:0)
        losses[id]=(losses[id]??0)+(won?0:1)
      })
    })
    return players
      .filter(p=>(category==='Misto'?true:p.gender===category)&&p.level===level)
      .map(p=>({...p,pts:pts[p.id]??0,games:games[p.id]??0,wins:wins[p.id]??0,losses:losses[p.id]??0}))
      .sort((a,b)=>b.pts-a.pts)
  }

  const addPlayer = async () => {
    if(!pForm.name.trim()) return
    const { error } = await supabase.from('players').insert({
      name: pForm.name.trim(), gender: pForm.gender, level: pForm.level, side: pForm.side,
    })
    if(error) { setError('Erro ao adicionar jogador: '+error.message); return }
    setPForm(f=>({...f, name:''}))
  }

  const deletePlayer = async (id) => { await supabase.from('players').delete().eq('id', id) }

  const addMatch = async () => {
    const {p1,p2,p3,p4,category,matchLevel,p1level,p2level,p3level,p4level,winner} = mForm
    if(!p1||!p2||!p3||!p4) { setError('Selecione todos os jogadores'); return }
    if(new Set([p1,p2,p3,p4]).size!==4) { setError('Jogadores repetidos'); return }
    const { error } = await supabase.from('matches').insert({
      category, match_level: matchLevel,
      p1,p1_level:p1level, p2,p2_level:p2level,
      p3,p3_level:p3level, p4,p4_level:p4level,
      winner, source:'manual',
      match_date: new Date().toLocaleDateString('pt-BR'),
    })
    if(error) { setError('Erro ao registrar partida: '+error.message); return }
    setMForm(initMF)
  }

  const deleteMatch = async (id) => { await supabase.from('matches').delete().eq('id', id) }

  const realizarSorteio = async () => {
    let pool = players.filter(p=>presentIds.includes(p.id))
    if(sorteioCat==='Masculino') pool=pool.filter(p=>p.gender==='Masculino')
    else if(sorteioCat==='Feminino') pool=pool.filter(p=>p.gender==='Feminino')
    if(pool.length<4){ setSorteioError('Mínimo de 4 jogadores presentes para sortear.'); return }
    const {duplas,leftover}=formDuplas(pool)
    if(duplas.length<2){
      setSorteioError('Não foi possível formar duplas. Sem par de lado: '+leftover.map(p=>p.name).join(', ')+'.')
      return
    }
    const jogos = gerarJogos(duplas)
    const leftoverMsg = leftover.length>0 ? leftover.map(p=>p.name).join(', ')+' ficaram fora (sem par de lado compatível).' : null
    await supabase.from('sorteios').delete().neq('id','00000000-0000-0000-0000-000000000000')
    const { data, error } = await supabase.from('sorteios').insert({
      category: sorteioCat,
      duplas: duplas.map(d=>d.map(p=>({id:p.id,name:p.name,side:p.side,level:p.level,gender:p.gender}))),
      jogos,
      leftover_msg: leftoverMsg,
    }).select().single()
    if(error){ setSorteioError('Erro ao salvar sorteio: '+error.message); return }
    setSorteioError(null)
    setSorteio(data)
    setTab('resultados')
  }

  const setJogoWinner = async (idx, winner) => {
    if(!sorteio) return
    const jogo = sorteio.jogos[idx]
    if(jogo.winner) return
    const dA = sorteio.duplas[jogo.duplaA]
    const dB = sorteio.duplas[jogo.duplaB]
    await supabase.from('matches').insert({
      category: sorteio.category,
      match_level: 'mixed',
      p1:dA[0].id, p1_level:dA[0].level,
      p2:dA[1].id, p2_level:dA[1].level,
      p3:dB[0].id, p3_level:dB[0].level,
      p4:dB[1].id, p4_level:dB[1].level,
      winner, source: 'sorteio',
      match_date: new Date().toLocaleDateString('pt-BR'),
    })
    const updatedJogos = sorteio.jogos.map((j,i)=>i===idx?{...j,winner}:j)
    const { data } = await supabase.from('sorteios')
      .update({ jogos: updatedJogos })
      .eq('id', sorteio.id)
      .select().single()
    if(data) setSorteio(data)
    await loadAll()
  }

  const undoWinner = async (idx) => {
    if(!sorteio) return
    const jogo = sorteio.jogos[idx]
    if(!jogo.winner) return
    const dA = sorteio.duplas[jogo.duplaA]
    await supabase.from('matches').delete().eq('p1', dA[0].id).eq('p2', dA[1].id).eq('source', 'sorteio')
    const updatedJogos = sorteio.jogos.map((j,i)=>i===idx?{...j,winner:null}:j)
    const { data } = await supabase.from('sorteios')
      .update({ jogos: updatedJogos })
      .eq('id', sorteio.id)
      .select().single()
    if(data) setSorteio(data)
    loadAll()
  }

  const pName   = id=>players.find(p=>p.id===id)?.name??id
  const pGender = id=>players.find(p=>p.id===id)?.gender??''
  const sideIcon= s=>s==='Direita'?'→':s==='Esquerda'?'←':'↔'
  const avail   = (cat,lv)=>cat==='Misto'?players.filter(p=>p.level===lv):players.filter(p=>p.gender===cat&&p.level===lv)
  const mOpts   = (g,lv)=>players.filter(p=>p.gender===g&&p.level===lv)
  const selPlayer=(field,lvField,gField,id)=>{
    const pl=players.find(p=>p.id===id)
    setMForm(f=>({...f,[field]:id,[lvField]:f.matchLevel,[gField]:pl?.gender??f[gField]}))
  }
  const isMisto = mForm.category==='Misto'
  const ranking = getRanking(filterCat,filterLevel)
  const pendingCount = sorteio?.jogos?.filter(j=>!j.winner).length??0
  const tabs = [
    {id:'ranking',  label:'Ranking'},
    {id:'sorteio',  label:'Sorteio'},
    {id:'resultados',label:'Resultados', badge: pendingCount>0?pendingCount:null},
    {id:'match',    label:'Partida'},
    {id:'players',  label:'Jogadores'},
    {id:'history',  label:'Histórico'},
  ]

  if(loading) return(
    <div style={{minHeight:'100vh',background:C.black,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
      <div style={{width:48,height:48,borderRadius:'50%',background:C.red,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif',fontWeight:900,fontSize:18,color:C.white}}>CB</div>
      <div style={{color:C.gray,fontSize:13,letterSpacing:2,textTransform:'uppercase'}}>Carregando...</div>
    </div>
  )
  return(
    <div style={{minHeight:'100vh',background:C.black,color:C.offwhite,fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#0d0d0d}::-webkit-scrollbar-thumb{background:#cc1a1a}
        select option{background:#161010;color:#f5f0f0}
        .btn{cursor:pointer;border:none;font-family:inherit;transition:all .15s}.btn:hover{opacity:.88;transform:translateY(-1px)}.btn:active{transform:translateY(0)}
        .row:hover{background:rgba(204,26,26,.06)!important}
        .del{background:none;border:none;cursor:pointer;color:#9a8f8f;font-size:13px;transition:color .2s;padding:4px}.del:hover{color:#cc1a1a}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.fade{animation:fadeUp .25s ease forwards}
        .tab{cursor:pointer;background:none;border:none;font-family:inherit;transition:all .2s}
        .pcard{cursor:pointer;transition:all .15s;user-select:none}.pcard:hover{opacity:.85}
      `}</style>

      <div style={{background:C.blackAlt,borderBottom:`3px solid ${C.red}`}}>
        <div style={{maxWidth:700,margin:'0 auto',padding:'20px 20px 0'}}>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:C.red,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:18,color:C.white,flexShrink:0}}>CB</div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:26,color:C.white,letterSpacing:1,lineHeight:1}}>CBallon d'Or</div>
              <div style={{fontSize:11,color:C.gray,letterSpacing:2,textTransform:'uppercase',marginTop:2}}>Ballon D'Or</div>
            </div>
          </div>
          <div style={{display:'flex',overflowX:'auto'}}>
            {tabs.map(t=>(
              <button key={t.id} className="tab" onClick={()=>setTab(t.id)}
                style={{padding:'10px 14px',fontSize:12,fontWeight:600,letterSpacing:.5,textTransform:'uppercase',whiteSpace:'nowrap',
                  color:tab===t.id?C.white:C.gray,
                  borderBottom:tab===t.id?`2px solid ${C.red}`:'2px solid transparent',marginBottom:-3}}>
                {t.label}
                {t.badge&&<span style={{marginLeft:5,background:C.red,color:C.white,borderRadius:'50%',fontSize:10,padding:'1px 5px',fontWeight:800}}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:700,margin:'0 auto',padding:'24px 20px 80px'}}>
        {error&&(
          <div style={{background:'rgba(204,26,26,.15)',border:'1px solid rgba(204,26,26,.4)',borderRadius:8,padding:'12px 14px',marginBottom:16,fontSize:13,color:'#f5a0a0',display:'flex',justifyContent:'space-between'}}>
            ⚠ {error}
            <button className="del" onClick={()=>setError(null)}>✕</button>
          </div>
        )}

        {tab==='ranking'&&(
          <div className="fade">
            <Rw gap={8} wrap mb={12}>{CATEGORIES.map(c=><Tog key={c} on={filterCat===c} onClick={()=>setFilterCat(c)}>{c}</Tog>)}</Rw>
            <Rw gap={8} wrap mb={28}>{LEVELS.map(l=><Tog key={l} on={filterLevel===l} onClick={()=>setFilterLevel(l)}>{l}</Tog>)}</Rw>
            <SL>{filterCat} · {filterLevel}</SL>
            {ranking.length===0?<Emp>Nenhum jogador nesta categoria ainda.</Emp>:ranking.map((p,i)=>(
              <div key={p.id} className="row" style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:8,marginBottom:6,
                background:i===0?'rgba(204,26,26,.1)':'rgba(255,255,255,.025)',
                border:i===0?'1px solid rgba(204,26,26,.3)':'1px solid rgba(255,255,255,.05)',transition:'background .15s'}}>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:i===0?32:22,
                  color:i===0?C.red:i===1?C.grayLight:C.gray,minWidth:36,textAlign:'center'}}>{i+1}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600}}>
                    {p.name}
                    {filterCat==='Misto'&&<span style={{marginLeft:8,fontSize:11,color:C.gray,fontWeight:400}}>{p.gender}</span>}
                  </div>
                  <div style={{display:'flex',gap:10,marginTop:4}}>
                    <span style={{fontSize:11,color:C.gray}}>{p.games}J</span>
                    <span style={{fontSize:11,color:'#4caf7d',fontWeight:600}}>{p.wins}V</span>
                    <span style={{fontSize:11,color:'#e05555',fontWeight:600}}>{p.losses}D</span>
                  </div>
                </div>
                <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:24,color:i===0?C.red:C.offwhite}}>
                  {p.pts} <span style={{fontSize:12,fontWeight:400,color:C.gray}}>pts</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {tab==='sorteio'&&(
          <div className="fade">
            <div style={{marginBottom:20}}>
              <SL>Categoria do sorteio</SL>
              <Rw gap={8} wrap mb={8}>{CATEGORIES.map(c=><Tog key={c} on={sorteioCat===c} onClick={()=>{setSorteioCat(c);setSorteioError(null)}}>{c}</Tog>)}</Rw>
              <div style={{fontSize:12,color:C.gray}}>
                {sorteioCat==='Misto'?'Todos os presentes entram (masculino e feminino). Todos os níveis.'
                  :`Apenas ${sorteioCat.toLowerCase()} presentes. Todos os níveis participam.`}
              </div>
            </div>
            <div style={{marginBottom:20,padding:16,background:'rgba(255,255,255,.03)',border:`1px solid ${C.border}`,borderRadius:10}}>
              <SL>Quem está presente hoje?</SL>
              {(()=>{
                const pool=players.filter(p=>sorteioCat==='Misto'?true:p.gender===sorteioCat)
                if(pool.length===0) return <Emp>Nenhum jogador cadastrado nesta categoria.</Emp>
                const groups=sorteioCat==='Misto'
                  ?[{label:'Masculino',pls:pool.filter(p=>p.gender==='Masculino')},{label:'Feminino',pls:pool.filter(p=>p.gender==='Feminino')}]
                  :[{label:'',pls:pool}]
                return groups.map(g=>g.pls.length===0?null:(
                  <div key={g.label} style={{marginBottom:g.label?16:0}}>
                    {g.label&&<div style={{fontSize:10,color:C.gray,letterSpacing:1,textTransform:'uppercase',marginBottom:8}}>{g.label}</div>}
                    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                      {g.pls.map(p=>{
                        const on=presentIds.includes(p.id)
                        return(
                          <div key={p.id} className="pcard" onClick={()=>setPresentIds(cur=>on?cur.filter(x=>x!==p.id):[...cur,p.id])}
                            style={{padding:'8px 12px',borderRadius:8,fontSize:13,fontWeight:600,
                              background:on?C.red:'rgba(255,255,255,.05)',color:on?C.white:C.gray,
                              border:`1px solid ${on?C.red:C.border}`}}>
                            {p.name}
                            <span style={{marginLeft:5,fontSize:10,opacity:.8}}>{sideIcon(p.side)}</span>
                            <span style={{marginLeft:3,fontSize:10,opacity:.6}}>{p.level==='Avançado'?'Av':'Int'}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              })()}
              <div style={{marginTop:12,fontSize:12,color:C.gray}}>
                {presentIds.filter(id=>{const p=players.find(pl=>pl.id===id);return p&&(sorteioCat==='Misto'?true:p.gender===sorteioCat)}).length} presente(s)
              </div>
            </div>
            {sorteioError&&<ErrBox msg={sorteioError}/>}
            <button className="btn" onClick={realizarSorteio}
              style={{width:'100%',padding:14,background:C.red,color:C.white,borderRadius:8,fontSize:14,fontWeight:700,letterSpacing:2,textTransform:'uppercase',fontFamily:'inherit'}}>
              Sortear Jogos →
            </button>
          </div>
        )}

        {tab==='resultados'&&(
          <div className="fade">
            {!sorteio?(
              <div style={{textAlign:'center',padding:'60px 0'}}>
                <div style={{fontSize:14,color:C.gray,marginBottom:16}}>Nenhum sorteio realizado ainda.</div>
                <button className="btn" onClick={()=>setTab('sorteio')}
                  style={{padding:'10px 24px',background:C.red,color:C.white,borderRadius:8,fontSize:13,fontWeight:700,letterSpacing:1,textTransform:'uppercase',fontFamily:'inherit'}}>
                  Ir para Sorteio
                </button>
              </div>
            ):(
              <>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                  <div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:22,color:C.white,letterSpacing:1}}>{sorteio.category}</div>
                    <div style={{fontSize:12,color:C.gray,marginTop:2}}>{sorteio.jogos.filter(j=>j.winner).length}/{sorteio.jogos.length} concluídos</div>
                  </div>
                  <button className="btn" onClick={async()=>{
                    await supabase.from('sorteios').delete().eq('id',sorteio.id)
                    setSorteio(null); setTab('sorteio')
                  }} style={{padding:'6px 14px',background:'transparent',color:C.gray,borderRadius:6,fontSize:12,fontWeight:600,border:`1px solid ${C.border}`,fontFamily:'inherit'}}>
                    Novo sorteio
                  </button>
                </div>
                {sorteio.leftover_msg&&(
                  <div style={{background:'rgba(255,200,0,.08)',border:'1px solid rgba(255,200,0,.25)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'#f5d97a'}}>
                    ⚠ {sorteio.leftover_msg}
                  </div>
                )}
                {(()=>{
                  const done=sorteio.jogos.filter(j=>j.winner).length
                  const pct=sorteio.jogos.length>0?Math.round(done/sorteio.jogos.length*100):0
                  return(
                    <div style={{marginBottom:20}}>
                      <div style={{height:4,background:'rgba(255,255,255,.08)',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${pct}%`,background:C.red,borderRadius:2,transition:'width .4s ease'}}/>
                      </div>
                    </div>
                  )
                })()}
                {sorteio.jogos.map((j,idx)=>{
                  const dA=sorteio.duplas[j.duplaA]
                  const dB=sorteio.duplas[j.duplaB]
                  const done=!!j.winner
                  return(
                    <div key={idx} style={{background:done?'rgba(255,255,255,.02)':'rgba(255,255,255,.035)',
                      border:`1px solid ${done?'rgba(255,255,255,.05)':C.border}`,borderRadius:12,padding:16,marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                        <span style={{fontSize:12,color:done?C.gray:C.offwhite,fontWeight:600,letterSpacing:1}}>JOGO {idx+1}</span>
                        {done&&<button className="del" onClick={()=>undoWinner(idx)} style={{fontSize:11}}>desfazer</button>}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 36px 1fr',gap:10,alignItems:'center',marginBottom:done?0:14}}>
                        {[{d:dA,team:'A'},{d:null},{d:dB,team:'B'}].map((item,ti)=>{
                          if(!item.d) return <div key="vs" style={{textAlign:'center',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:C.gray}}>VS</div>
                          const won=j.winner===item.team
                          const lost=j.winner&&!won
                          return(
                            <div key={item.team} style={{padding:12,borderRadius:10,
                              background:won?'rgba(204,26,26,.15)':lost?'rgba(0,0,0,.2)':'rgba(255,255,255,.04)',
                              border:won?'1px solid rgba(204,26,26,.4)':lost?'1px solid rgba(255,255,255,.03)':'1px solid rgba(255,255,255,.08)',
                              opacity:lost?.6:1,transition:'all .2s'}}>
                              <div style={{fontSize:10,fontWeight:700,color:won?C.red:C.gray,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>
                                Time {item.team} {won?'✓':''}
                              </div>
                              {item.d.map(pl=>(
                                <div key={pl.id} style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                                  <span style={{fontSize:13,fontWeight:600,color:won?C.offwhite:C.grayLight}}>{pl.name}</span>
                                  <span style={{fontSize:10,color:C.gray}}>{sideIcon(pl.side)}</span>
                                  <span style={{fontSize:10,color:C.gray,opacity:.7}}>{pl.level==='Avançado'?'Av':'Int'}</span>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                      {!done&&(
                        <div style={{display:'flex',gap:8}}>
                          {['A','B'].map(t=>(
                            <button key={t} onClick={()=>setJogoWinner(idx,t)}
                              style={{flex:1,padding:'10px',borderRadius:6,cursor:'pointer',border:`1px solid rgba(204,26,26,.3)`,
                                background:'rgba(204,26,26,.15)',color:C.offwhite,fontFamily:"'Barlow Condensed',sans-serif",
                                fontWeight:700,fontSize:14,letterSpacing:2,transition:'all .15s'}}
                              onMouseOver={e=>e.currentTarget.style.background='rgba(204,26,26,.3)'}
                              onMouseOut={e=>e.currentTarget.style.background='rgba(204,26,26,.15)'}>
                              ✓ Time {t} venceu
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {sorteio.jogos.length>0&&sorteio.jogos.every(j=>j.winner)&&(
                  <div style={{textAlign:'center',padding:'24px 0',fontSize:14,color:'#4caf7d',fontWeight:600}}>
                    ✓ Todos os jogos concluídos! Ranking atualizado.
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {tab==='match'&&(
          <div className="fade">
            <div style={{marginBottom:16}}>
              <SL>Categoria</SL>
              <Rw gap={8} wrap mb={12}>{CATEGORIES.map(c=><Tog key={c} on={mForm.category===c} onClick={()=>setMForm({...initMF,category:c})}>{c}</Tog>)}</Rw>
              {isMisto&&<InfoBox>Misto: slot 1 = Masculino · slot 2 = Feminino</InfoBox>}
            </div>
            <div style={{marginBottom:20}}>
              <SL>Nível</SL>
              <Rw gap={8} wrap>{LEVELS.map(l=><Tog key={l} on={mForm.matchLevel===l} onClick={()=>setMForm({...initMF,category:mForm.category,matchLevel:l})}>{l}</Tog>)}</Rw>
            </div>
            {[
              {team:'A',p:'p1',pl:'p1level',pg:'p1gender',p2k:'p2',p2l:'p2level',p2g:'p2gender'},
              {team:'B',p:'p3',pl:'p3level',pg:'p3gender',p2k:'p4',p2l:'p4level',p2g:'p4gender'},
            ].map(({team,p,pl,pg,p2k,p2l,p2g})=>{
              const mult=getMult(mForm[pl],mForm[p2l])
              return(
                <div key={team} style={{background:'rgba(255,255,255,.03)',border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                    <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:20,color:C.white,letterSpacing:1}}>TIME {team}</span>
                    {mult>1&&<span style={{background:C.red,color:C.white,borderRadius:6,padding:'3px 10px',fontSize:12,fontWeight:700}}>×{mult}</span>}
                  </div>
                  {isMisto?
                    [{pid:p,plv:pl,pgd:pg,gs:'Masculino',n:1,lbl:'Masculino'},{pid:p2k,plv:p2l,pgd:p2g,gs:'Feminino',n:2,lbl:'Feminino'}].map(({pid,plv,pgd,gs,n,lbl})=>(
                      <div key={pid} style={{marginBottom:n===1?10:0}}>
                        <div style={{fontSize:10,color:C.gray,letterSpacing:1,textTransform:'uppercase',marginBottom:4}}>{lbl}</div>
                        <div style={{display:'flex',gap:8}}>
                          <Sel value={mForm[pid]} onChange={e=>selPlayer(pid,plv,pgd,e.target.value)} style={{flex:1}}>
                            <option value=''>Jogador {n}</option>
                            {mOpts(gs,mForm.matchLevel).map(pp=><option key={pp.id} value={pp.id}>{pp.name}</option>)}
                          </Sel>
                          <Sel value={mForm[plv]} onChange={e=>setMForm(f=>({...f,[plv]:e.target.value}))} style={{maxWidth:148}}>
                            {LEVELS.map(lv=><option key={lv}>{lv}</option>)}
                          </Sel>
                        </div>
                      </div>
                    ))
                  :
                    [{pid:p,plv:pl,pgd:pg,n:1},{pid:p2k,plv:p2l,pgd:p2g,n:2}].map(({pid,plv,pgd,n})=>(
                      <div key={pid} style={{display:'flex',gap:8,marginBottom:n===1?10:0}}>
                        <Sel value={mForm[pid]} onChange={e=>selPlayer(pid,plv,pgd,e.target.value)} style={{flex:1}}>
                          <option value=''>Jogador {n}</option>
                          {avail(mForm.category,mForm.matchLevel).map(pp=><option key={pp.id} value={pp.id}>{pp.name}</option>)}
                        </Sel>
                        <Sel value={mForm[plv]} onChange={e=>setMForm(f=>({...f,[plv]:e.target.value}))} style={{maxWidth:148}}>
                          {LEVELS.map(lv=><option key={lv}>{lv}</option>)}
                        </Sel>
                      </div>
                    ))
                  }
                </div>
              )
            })}
            <div style={{marginBottom:20}}>
              <SL>Vencedor</SL>
              <Rw gap={8}>{['A','B'].map(t=>(
                <button key={t} className="btn" onClick={()=>setMForm(f=>({...f,winner:t}))}
                  style={{padding:'10px 32px',borderRadius:6,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,letterSpacing:2,
                    background:mForm.winner===t?C.red:'transparent',color:mForm.winner===t?C.white:C.gray,
                    border:`1px solid ${mForm.winner===t?C.red:C.border}`}}>
                  TIME {t}
                </button>
              ))}</Rw>
            </div>
            {mForm.p1&&mForm.p2&&mForm.p3&&mForm.p4&&(
              <div style={{background:'rgba(204,26,26,.07)',border:'1px solid rgba(204,26,26,.2)',borderRadius:8,padding:14,marginBottom:16}}>
                <div style={{fontSize:11,color:C.red,marginBottom:10,letterSpacing:2,textTransform:'uppercase',fontWeight:600}}>Preview de pontos</div>
                {[
                  {ids:[mForm.p1,mForm.p2],levels:[mForm.p1level,mForm.p2level],team:'A'},
                  {ids:[mForm.p3,mForm.p4],levels:[mForm.p3level,mForm.p4level],team:'B'},
                ].map(({ids,levels,team})=>{
                  const won=mForm.winner===team
                  return ids.map((id,i)=>(
                    <div key={id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',color:won?C.offwhite:C.gray}}>
                      <span style={{fontSize:13}}>{pName(id)}</span>
                      <span style={{fontWeight:700,color:won?C.red:C.gray}}>+{calcPts(won,levels[i],levels[1-i])} pts</span>
                    </div>
                  ))
                })}
              </div>
            )}
            <button className="btn" onClick={addMatch}
              style={{width:'100%',padding:14,background:C.red,color:C.white,borderRadius:8,fontSize:14,fontWeight:700,letterSpacing:2,textTransform:'uppercase',fontFamily:'inherit'}}>
              Registrar Partida
            </button>
          </div>
        )}

        {tab==='players'&&(
          <div className="fade">
            <div style={{background:'rgba(255,255,255,.03)',border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:28}}>
              <SL>Novo Jogador</SL>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <input placeholder="Nome completo" value={pForm.name}
                  onChange={e=>setPForm(f=>({...f,name:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&addPlayer()}
                  style={{...selStyle,flex:1,minWidth:160}}/>
                <Sel value={pForm.gender} onChange={e=>setPForm(f=>({...f,gender:e.target.value}))} style={{flex:1}}>
                  {GENDERS.map(g=><option key={g}>{g}</option>)}
                </Sel>
                <Sel value={pForm.level} onChange={e=>setPForm(f=>({...f,level:e.target.value}))} style={{flex:1}}>
                  {LEVELS.map(l=><option key={l}>{l}</option>)}
                </Sel>
                <Sel value={pForm.side} onChange={e=>setPForm(f=>({...f,side:e.target.value}))} style={{flex:1}}>
                  {SIDES.map(sd=><option key={sd}>{sd}</option>)}
                </Sel>
                <button className="btn" onClick={addPlayer}
                  style={{padding:'10px 20px',background:C.red,color:C.white,borderRadius:6,fontSize:13,fontWeight:700,letterSpacing:1,textTransform:'uppercase',fontFamily:'inherit'}}>
                  Adicionar
                </button>
              </div>
            </div>
            {GENDERS.map(g=>(
              <div key={g} style={{marginBottom:28}}>
                <SL>{g}</SL>
                {players.filter(p=>p.gender===g).length===0?<Emp>Nenhum jogador ainda.</Emp>
                  :players.filter(p=>p.gender===g).map(p=>(
                  <div key={p.id} className="row" style={{display:'flex',alignItems:'center',gap:10,padding:'11px 12px',borderBottom:'1px solid rgba(255,255,255,.05)',borderRadius:4,transition:'background .15s'}}>
                    <span style={{flex:1,fontSize:14,fontWeight:500}}>{p.name}</span>
                    <LvBadge level={p.level}/>
                    <SideBadge side={p.side}/>
                    <button className="del" onClick={()=>deletePlayer(p.id)}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab==='history'&&(
          <div className="fade">
            {matches.length===0?<Emp>Nenhuma partida registrada ainda.</Emp>
              :matches.map(m=>(
              <div key={m.id} style={{background:'rgba(255,255,255,.025)',border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <span style={{fontSize:11,color:C.gray,letterSpacing:1}}>{m.match_date}</span>
                    <span style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',padding:'1px 7px',borderRadius:10,
                      background:m.category==='Misto'?'rgba(204,26,26,.15)':'rgba(255,255,255,.06)',
                      color:m.category==='Misto'?C.red:C.gray}}>{m.category}</span>
                  </div>
                  <button className="del" onClick={()=>deleteMatch(m.id)}>✕</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 36px 1fr',gap:8,alignItems:'center'}}>
                  {[{ids:[m.p1,m.p2],levels:[m.p1_level,m.p2_level],team:'A',mult:getMult(m.p1_level,m.p2_level)},null,
                    {ids:[m.p3,m.p4],levels:[m.p3_level,m.p4_level],team:'B',mult:getMult(m.p3_level,m.p4_level)}].map((item,ti)=>{
                    if(!item) return <div key="vs" style={{textAlign:'center',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:C.gray}}>VS</div>
                    const won=m.winner===item.team
                    return(
                      <div key={item.team} style={{padding:12,borderRadius:8,background:won?'rgba(204,26,26,.12)':'rgba(255,255,255,.03)',border:won?'1px solid rgba(204,26,26,.35)':'1px solid rgba(255,255,255,.05)'}}>
                        <div style={{fontSize:11,fontWeight:700,letterSpacing:1,color:won?C.red:C.gray,marginBottom:8,textTransform:'uppercase'}}>Time {item.team} {won?'✓':''}</div>
                        {item.ids.map((id,i)=>(
                          <div key={id||i} style={{marginBottom:i===0?4:0}}>
                            <div style={{fontSize:13,fontWeight:600}}>{pName(id)}</div>
                            <div style={{fontSize:11,color:C.gray}}>{item.levels[i]}{m.category==='Misto'&&<span style={{marginLeft:6}}>{pGender(id)}</span>}</div>
                          </div>
                        ))}
                        {item.mult>1&&<div style={{marginTop:8,fontSize:11,color:C.red,fontWeight:700}}>×{item.mult}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Tog({on,onClick,children}){
  return <button className="btn" onClick={onClick} style={{padding:'6px 16px',borderRadius:6,fontSize:12,fontWeight:600,fontFamily:'inherit',letterSpacing:.5,textTransform:'uppercase',background:on?'#cc1a1a':'transparent',color:on?'#fff':'#9a8f8f',border:`1px solid ${on?'#cc1a1a':'#2a1818'}`}}>{children}</button>
}
function Rw({gap=8,wrap,mb,children}){
  return <div style={{display:'flex',gap,flexWrap:wrap?'wrap':undefined,marginBottom:mb}}>{children}</div>
}
function SL({children}){
  return <div style={{fontSize:11,color:'#9a8f8f',letterSpacing:2,textTransform:'uppercase',marginBottom:10,fontWeight:600}}>{children}</div>
}
function Emp({children}){
  return <div style={{color:'#9a8f8f',fontSize:13,padding:'32px 0',textAlign:'center'}}>{children}</div>
}
function InfoBox({children}){
  return <div style={{marginTop:10,padding:'8px 12px',background:'rgba(204,26,26,.07)',borderRadius:6,fontSize:12,color:'#9a8f8f',border:'1px solid rgba(204,26,26,.15)'}}>{children}</div>
}
function ErrBox({msg}){
  return <div style={{background:'rgba(204,26,26,.12)',border:'1px solid rgba(204,26,26,.4)',borderRadius:8,padding:'12px 14px',marginBottom:12,fontSize:13,color:'#f5a0a0'}}>⚠ {msg}</div>
}
function LvBadge({level}){
  const s={Avançado:{bg:'rgba(204,26,26,.15)',color:'#cc1a1a'},Intermediário:{bg:'rgba(200,192,192,.12)',color:'#c8c0c0'}}[level]??{}
  return <span style={{background:s.bg,color:s.color,borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:600}}>{level}</span>
}
function SideBadge({side}){
  const icon=side==='Direita'?'→ Dir':side==='Esquerda'?'← Esq':'↔ Amb'
  return <span style={{background:'rgba(255,255,255,.06)',color:'#9a8f8f',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:600}}>{icon}</span>
}
function Sel({value,onChange,style,children}){
  return <select value={value} onChange={onChange} style={{...selStyle,...style}}>{children}</select>
}
const selStyle={background:'rgba(255,255,255,.05)',border:'1px solid #2a1818',color:'#f5f0f0',borderRadius:6,padding:'10px 12px',fontSize:13,fontFamily:'inherit',width:'100%',outline:'none',cursor:'pointer'}
