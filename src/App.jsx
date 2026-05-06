import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useLivros } from './hooks/useLivros';
import { Auth } from './components/Auth';
import { BookForm } from './components/BookForm';
import { StarRating } from './components/StarRating';
import { BookCard } from './components/BookCard';
import { Stats } from './components/Stats';
import { ResenhaModal } from './components/ResenhaModal';

const DA = {
  mustard:'#C49A22', burntOrange:'#C4612A', brickRed:'#9E3D2E', oxblood:'#6B1E2A',
  warmBurgundy:'#7B2D42', olive:'#6B7238', forestGreen:'#2E5E44', teal:'#2A7B7A',
  warmNavy:'#2C3E6B', aubergine:'#5E2D6B', camel:'#C49A6C', copper:'#B5622A',
  chocolate:'#4A2E1E', espresso:'#2C1A14', darkOlive:'#3A4220', cream:'#F5F0E0',
  warmBeige:'#D4C5A9', walnut:'#4A3428',
};

const GRAD_HEADER   = `linear-gradient(135deg, ${DA.espresso} 0%, ${DA.chocolate} 40%, ${DA.walnut} 70%, ${DA.copper} 100%)`;
const GRAD_HERO     = `linear-gradient(135deg, ${DA.espresso} 0%, ${DA.oxblood} 35%, ${DA.warmBurgundy} 65%, ${DA.burntOrange} 100%)`;
const GRAD_BG       = `linear-gradient(160deg, ${DA.cream} 0%, #ede4d0 40%, #e0d0b8 70%, ${DA.warmBeige} 100%)`;
const GRAD_BTN      = `linear-gradient(135deg, ${DA.oxblood}, ${DA.warmBurgundy}, ${DA.burntOrange})`;
const GRAD_PROGRESS = `linear-gradient(90deg, ${DA.oxblood}, ${DA.warmBurgundy}, ${DA.mustard})`;
const GRAD_NAV_ACT  = `linear-gradient(135deg, ${DA.copper}, ${DA.burntOrange})`;

const ABAS = [
  { key:'inicio', label:'Início' }, { key:'estante', label:'Minha Estante' },
  { key:'adicionar', label:'+ Adicionar' }, { key:'metas', label:'Metas' },
];

export default function App() {
  const [aba, setAba]                   = useState('inicio');
  const [user, setUser]                 = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [busca, setBusca]               = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalResenha, setModalResenha] = useState(null);
  const [metaAnual, setMetaAnual]       = useState(() => Number(localStorage.getItem('da-meta') || 12));
  const [editandoMeta, setEditandoMeta] = useState(false);

  const { livros, loading, adicionar, atualizar, remover } = useLivros(user);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => { localStorage.setItem('da-meta', String(metaAnual)); }, [metaAnual]);

  const adicionarLivro = async (l) => { await adicionar(l); setAba('estante'); };
  const atualizarLivro = async (id, d) => { await atualizar(id, d); };
  const removerLivro   = async (id) => { if (confirm('Remover este livro?')) await remover(id); };

  const ano        = new Date().getFullYear();
  const lidos      = livros.filter(l => l.status === 'lido');
  const lendoAgora = livros.filter(l => l.status === 'lendo');
  const queroLer   = livros.filter(l => l.status === 'quero-ler');
  const abandonei  = livros.filter(l => l.status === 'abandonei');
  const lidosAno   = lidos.filter(l => l.dataTermino?.startsWith(String(ano)));
  const pctMeta    = Math.min(100, Math.round((lidosAno.length / metaAnual) * 100));

  const livrosFiltrados = livros.filter(l => {
    const q  = busca.toLowerCase();
    const ok = !q || l.titulo?.toLowerCase().includes(q) || l.autor?.toLowerCase().includes(q);
    const st = filtroStatus === 'todos' || l.status === filtroStatus;
    return ok && st;
  });

  const ultimoLido = [...lidos].filter(l => l.dataTermino)
    .sort((a,b) => new Date(b.dataTermino) - new Date(a.dataTermino))[0];

  if (authLoading) return (
    <div style={{ minHeight:'100vh', background: GRAD_BG, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:'32px' }}>📚</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:GRAD_BG, fontFamily:"'Segoe UI', sans-serif" }}>

      {/* HEADER */}
      <header style={{ background:GRAD_HEADER, borderBottom:`3px solid ${DA.espresso}`, boxShadow:'0 4px 20px rgba(44,26,20,0.4)' }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', flexWrap:'wrap', gap:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <div style={{ background:GRAD_BTN, borderRadius:'10px', padding:'7px 16px', fontWeight:'900', fontSize:'20px', color:DA.cream, letterSpacing:'-0.5px', boxShadow:'0 2px 10px rgba(0,0,0,0.3)' }}>
                biblio<span style={{ color:DA.mustard }}>tech</span>
              </div>
              <span style={{ fontSize:'11px', color:DA.camel, fontStyle:'italic', opacity:0.8 }}>Deep Autumn</span>
            </div>
            <nav style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
              {ABAS.map(a => (
                <button key={a.key} onClick={() => setAba(a.key)} style={{
                  padding:'8px 14px', borderRadius:'8px', border:'none', cursor:'pointer',
                  fontWeight:'700', fontSize:'13px', transition:'all .2s',
                  background: aba === a.key ? GRAD_NAV_ACT : 'rgba(255,255,255,0.08)',
                  color: aba === a.key ? DA.cream : DA.warmBeige,
                  boxShadow: aba === a.key ? '0 2px 10px rgba(0,0,0,0.3)' : 'none',
                }}>{a.label}</button>
              ))}
            </nav>
            <Auth user={user} DA={DA} GRAD_BTN={GRAD_BTN} />
          </div>
        </div>
      </header>

      {/* Banner login */}
      {!user && (
        <div style={{ background:`${DA.mustard}22`, borderBottom:`1px solid ${DA.mustard}44`, padding:'10px 16px', textAlign:'center' }}>
          <span style={{ fontSize:'13px', color:DA.chocolate, fontWeight:'600' }}>
            📖 Navegando sem conta — seus livros ficam salvos só neste dispositivo.{' '}
            <button onClick={() => auth.signInWithPopup?.() } style={{ background:'none', border:'none', color:DA.oxblood, fontWeight:'800', cursor:'pointer', textDecoration:'underline', fontSize:'13px' }}>
              Entre com Google
            </button>{' '}para sincronizar em qualquer lugar.
          </span>
        </div>
      )}

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'24px 16px' }}>

        {/* INÍCIO */}
        {aba === 'inicio' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            {ultimoLido ? (
              <div style={{ background:GRAD_HERO, borderRadius:'20px', padding:'36px', display:'flex', alignItems:'center', gap:'36px', flexWrap:'wrap', boxShadow:`0 12px 40px rgba(107,30,42,0.35)`, border:`1px solid ${DA.warmBurgundy}` }}>
                <img src={ultimoLido.capa || `https://via.placeholder.com/130x185/4A2E1E/F5F0E0?text=📚`} alt={ultimoLido.titulo}
                  style={{ width:'130px', height:'185px', objectFit:'cover', borderRadius:'10px', boxShadow:'0 8px 24px rgba(0,0,0,0.5)', flexShrink:0 }} />
                <div>
                  <p style={{ color:DA.mustard, fontSize:'11px', fontWeight:'800', textTransform:'uppercase', letterSpacing:'3px', marginBottom:'10px' }}>📖 Último livro lido</p>
                  <h2 style={{ fontSize:'30px', fontWeight:'900', color:DA.cream, marginBottom:'6px', lineHeight:1.2 }}>{ultimoLido.titulo}</h2>
                  <p style={{ color:DA.warmBeige, fontSize:'16px', marginBottom:'14px', opacity:0.85 }}>{ultimoLido.autor}</p>
                  <StarRating rating={ultimoLido.nota} DA={DA} />
                  {ultimoLido.resenha && (
                    <p style={{ marginTop:'14px', color:DA.warmBeige, fontSize:'14px', fontStyle:'italic', maxWidth:'420px', opacity:0.8, lineHeight:1.6 }}>
                      "{ultimoLido.resenha.slice(0,140)}{ultimoLido.resenha.length > 140 ? '…' : ''}"
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background:'white', borderRadius:'20px', padding:'48px', textAlign:'center', border:`2px dashed ${DA.warmBeige}` }}>
                <div style={{ fontSize:'52px', marginBottom:'14px' }}>📚</div>
                <p style={{ color:DA.chocolate, fontSize:'17px', fontWeight:'700', marginBottom:'6px' }}>Sua estante está vazia</p>
                <p style={{ color:DA.warmBeige, fontSize:'14px', marginBottom:'20px' }}>Adicione seu primeiro livro para começar!</p>
                <button onClick={() => setAba('adicionar')} style={{ background:GRAD_BTN, color:DA.cream, border:'none', borderRadius:'10px', padding:'12px 28px', fontWeight:'800', cursor:'pointer', fontSize:'14px', boxShadow:`0 4px 14px rgba(107,30,42,0.35)` }}>Adicionar Livro</button>
              </div>
            )}
            <Stats lidos={lidos.length} lendo={lendoAgora.length} queroLer={queroLer.length} abandonei={abandonei.length} DA={DA} GRAD_BTN={GRAD_BTN} />
            {/* Meta */}
            <div style={{ background:'white', borderRadius:'18px', padding:'26px', boxShadow:'0 2px 12px rgba(44,26,20,0.08)', border:`1px solid ${DA.warmBeige}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso }}>🎯 Meta de Leitura {ano}</h3>
                <button onClick={() => setEditandoMeta(v => !v)} style={{ fontSize:'12px', color:DA.oxblood, background:'none', border:`1px solid ${DA.oxblood}`, borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontWeight:'700' }}>{editandoMeta ? 'Salvar' : 'Editar'}</button>
              </div>
              {editandoMeta ? (
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px' }}>
                  <span style={{ fontSize:'14px', color:DA.walnut }}>Quero ler</span>
                  <input type="number" min="1" max="365" value={metaAnual} onChange={e => setMetaAnual(Number(e.target.value))}
                    style={{ width:'80px', padding:'6px 10px', borderRadius:'8px', border:`2px solid ${DA.copper}`, textAlign:'center', fontWeight:'800', fontSize:'18px' }} />
                  <span style={{ fontSize:'14px', color:DA.walnut }}>livros em {ano}</span>
                </div>
              ) : (
                <p style={{ fontSize:'14px', color:DA.walnut, marginBottom:'14px' }}>
                  <strong style={{ color:DA.oxblood, fontSize:'22px' }}>{lidosAno.length}</strong> de <strong>{metaAnual}</strong> livros em {ano}
                </p>
              )}
              <div style={{ background:`${DA.warmBeige}55`, borderRadius:'999px', height:'16px', overflow:'hidden' }}>
                <div style={{ background:GRAD_PROGRESS, height:'100%', borderRadius:'999px', width:`${pctMeta}%`, transition:'width .6s ease' }} />
              </div>
              <p style={{ fontSize:'12px', color:DA.warmBeige, marginTop:'6px', textAlign:'right', fontWeight:'600' }}>{pctMeta}% da meta</p>
            </div>
            {lendoAgora.length > 0 && (
              <div style={{ background:'white', borderRadius:'18px', padding:'26px', boxShadow:'0 2px 12px rgba(44,26,20,0.08)', border:`1px solid ${DA.warmBeige}` }}>
                <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso, marginBottom:'18px' }}>📖 Lendo Agora</h3>
                <div style={{ display:'flex', gap:'20px', overflowX:'auto', paddingBottom:'8px' }}>
                  {lendoAgora.map(l => (
                    <div key={l.id} style={{ minWidth:'100px', textAlign:'center' }}>
                      <img src={l.capa || `https://via.placeholder.com/100x140/4A2E1E/F5F0E0?text=📚`} alt={l.titulo}
                        style={{ width:'100px', height:'140px', objectFit:'cover', borderRadius:'8px', boxShadow:`0 6px 16px rgba(44,26,20,0.2)` }} />
                      <p style={{ fontSize:'11px', fontWeight:'700', marginTop:'8px', color:DA.chocolate, maxWidth:'100px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.titulo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ESTANTE */}
        {aba === 'estante' && (
          <div>
            <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
              <input type="text" placeholder="🔍 Pesquisar livros..." value={busca} onChange={e => setBusca(e.target.value)}
                style={{ flex:1, minWidth:'200px', padding:'10px 16px', borderRadius:'10px', border:`2px solid ${DA.warmBeige}`, outline:'none', fontSize:'14px', background:'white' }} />
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {[{key:'todos',label:'Todos'},{key:'lendo',label:'📖 Lendo'},{key:'lido',label:'✅ Lidos'},{key:'quero-ler',label:'⏳ Quero Ler'},{key:'abandonei',label:'❌ Abandonei'}].map(f => (
                  <button key={f.key} onClick={() => setFiltroStatus(f.key)} style={{
                    padding:'8px 14px', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'700', fontSize:'12px', transition:'all .15s',
                    background: filtroStatus === f.key ? GRAD_BTN : 'white',
                    color: filtroStatus === f.key ? DA.cream : DA.walnut,
                    boxShadow: filtroStatus === f.key ? `0 3px 10px rgba(107,30,42,0.3)` : '0 1px 4px rgba(0,0,0,0.08)',
                  }}>{f.label}</button>
                ))}
              </div>
            </div>
            {loading ? (
              <div style={{ textAlign:'center', padding:'60px', color:DA.warmBeige }}>
                <div style={{ fontSize:'32px', marginBottom:'12px' }}>⏳</div>
                <p style={{ fontWeight:'600' }}>Carregando estante...</p>
              </div>
            ) : livrosFiltrados.length === 0 ? (
              <div style={{ textAlign:'center', padding:'60px', color:DA.warmBeige }}>
                <div style={{ fontSize:'52px', marginBottom:'12px' }}>📭</div>
                <p style={{ fontSize:'16px', fontWeight:'700', color:DA.walnut }}>Nenhum livro encontrado</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'20px' }}>
                {livrosFiltrados.map(livro => (
                  <BookCard key={livro.id} livro={livro} DA={DA} GRAD_BTN={GRAD_BTN}
                    onAtualizar={d => atualizarLivro(livro.id, d)}
                    onRemover={() => removerLivro(livro.id)}
                    onResenha={() => setModalResenha(livro)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADICIONAR */}
        {aba === 'adicionar' && (
          <div style={{ maxWidth:'600px', margin:'0 auto' }}>
            <div style={{ background:'white', borderRadius:'20px', padding:'36px', boxShadow:'0 4px 20px rgba(44,26,20,0.1)', border:`1px solid ${DA.warmBeige}` }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px', color:DA.espresso, marginBottom:'26px' }}>📚 Adicionar à Estante</h2>
              <BookForm onSave={adicionarLivro} DA={DA} GRAD_BTN={GRAD_BTN} />
            </div>
          </div>
        )}

        {/* METAS */}
        {aba === 'metas' && (
          <div style={{ maxWidth:'700px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'20px' }}>
            <div style={{ background:'white', borderRadius:'20px', padding:'30px', boxShadow:'0 4px 20px rgba(44,26,20,0.1)', border:`1px solid ${DA.warmBeige}` }}>
              <h2 style={{ fontWeight:'900', fontSize:'18px', color:DA.espresso, marginBottom:'22px' }}>🎯 Meta de Leitura {ano}</h2>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'22px' }}>
                <span style={{ fontSize:'14px', color:DA.walnut }}>Quero ler</span>
                <input type="number" min="1" max="365" value={metaAnual} onChange={e => setMetaAnual(Number(e.target.value))}
                  style={{ width:'90px', padding:'8px 12px', borderRadius:'8px', border:`2px solid ${DA.copper}`, textAlign:'center', fontWeight:'800', fontSize:'20px' }} />
                <span style={{ fontSize:'14px', color:DA.walnut }}>livros em {ano}</span>
              </div>
              <div style={{ background:`${DA.warmBeige}55`, borderRadius:'999px', height:'22px', overflow:'hidden', marginBottom:'8px' }}>
                <div style={{ background:GRAD_PROGRESS, height:'100%', borderRadius:'999px', width:`${pctMeta}%`, transition:'width .6s ease', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:'10px' }}>
                  {pctMeta > 12 && <span style={{ color:'white', fontSize:'11px', fontWeight:'800' }}>{pctMeta}%</span>}
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', color:DA.warmBeige, fontWeight:'600' }}>
                <span>{lidosAno.length} lidos</span><span>{Math.max(0, metaAnual - lidosAno.length)} restantes</span>
              </div>
            </div>
            <div style={{ background:'white', borderRadius:'20px', padding:'30px', boxShadow:'0 4px 20px rgba(44,26,20,0.1)', border:`1px solid ${DA.warmBeige}` }}>
              <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso, marginBottom:'22px' }}>📅 Leituras por Mês ({ano})</h3>
              <div style={{ display:'flex', gap:'8px', alignItems:'flex-end', height:'110px' }}>
                {Array.from({ length:12 }, (_,i) => {
                  const mes   = String(i+1).padStart(2,'0');
                  const count = lidos.filter(l => l.dataTermino?.startsWith(`${ano}-${mes}`)).length;
                  const max   = Math.max(1,...Array.from({length:12},(_,j)=>lidos.filter(l=>l.dataTermino?.startsWith(`${ano}-${String(j+1).padStart(2,'0')}`)).length));
                  const h     = count ? Math.max(14,(count/max)*90) : 5;
                  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                      <span style={{ fontSize:'10px', color:DA.oxblood, fontWeight:'800' }}>{count||''}</span>
                      <div style={{ width:'100%', height:`${h}px`, borderRadius:'5px 5px 0 0', background:count?`linear-gradient(180deg,${DA.mustard},${DA.burntOrange},${DA.oxblood})`:`${DA.warmBeige}55`, transition:'height .4s ease' }} />
                      <span style={{ fontSize:'9px', color:DA.warmBeige, fontWeight:'700' }}>{MESES[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {lidosAno.length > 0 && (
              <div style={{ background:'white', borderRadius:'20px', padding:'30px', boxShadow:'0 4px 20px rgba(44,26,20,0.1)', border:`1px solid ${DA.warmBeige}` }}>
                <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso, marginBottom:'18px' }}>✅ Lidos em {ano}</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {lidosAno.sort((a,b)=>new Date(b.dataTermino)-new Date(a.dataTermino)).map(l => (
                    <div key={l.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px', borderRadius:'12px', background:DA.cream }}>
                      <img src={l.capa||`https://via.placeholder.com/40x56/4A2E1E/F5F0E0?text=📚`} alt={l.titulo} style={{ width:'40px', height:'56px', objectFit:'cover', borderRadius:'5px' }} />
                      <div style={{ flex:1 }}>
                        <p style={{ fontWeight:'800', fontSize:'14px', color:DA.espresso }}>{l.titulo}</p>
                        <p style={{ fontSize:'12px', color:DA.warmBeige }}>{l.autor} · {l.dataTermino}</p>
                      </div>
                      <StarRating rating={l.nota} DA={DA} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalResenha && (
        <ResenhaModal livro={modalResenha} DA={DA} GRAD_BTN={GRAD_BTN}
          onSalvar={(resenha, nota) => { atualizarLivro(modalResenha.id, { resenha, nota }); setModalResenha(null); }}
          onFechar={() => setModalResenha(null)} />
      )}
    </div>
  );
}
