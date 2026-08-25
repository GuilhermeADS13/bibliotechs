import React, { useState, useEffect, useMemo } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useLivros } from './hooks/useLivros';
import { useFotos } from './hooks/useFotos';
import { Auth } from './components/Auth';
import { BookForm } from './components/BookForm';
import { StarRating } from './components/StarRating';
import { BookCard } from './components/BookCard';
import { Stats } from './components/Stats';
import { ResenhaModal } from './components/ResenhaModal';
import { BackgroundCarousel } from './components/BackgroundCarousel';
import { LoveStories } from './components/LoveStories';
import { loginGoogle, completeRedirectLogin } from './login';
import { bookPlaceholder } from './placeholder';
import { LiteraryAgent } from './components/LiteraryAgent';
import { Estatisticas } from './components/Estatisticas';
import { BiaAvatar } from './components/BiaAvatar';
import { HistoricoConversas } from './components/HistoricoConversas';
import { useConversas } from './hooks/useConversas';
import { ritmoMeta, estadoDaEstante } from './estatisticas';

const DA = {
  mustard:'#C49A22', burntOrange:'#C4612A', brickRed:'#9E3D2E', oxblood:'#6B1E2A',
  warmBurgundy:'#7B2D42', olive:'#6B7238', forestGreen:'#2E5E44', teal:'#2A7B7A',
  warmNavy:'#2C3E6B', aubergine:'#5E2D6B', camel:'#C49A6C', copper:'#B5622A',
  chocolate:'#4A2E1E', espresso:'#2C1A14', darkOlive:'#3A4220', cream:'#F5F0E0',
  warmBeige:'#D4C5A9', walnut:'#4A3428',
};

const GRAD_HERO     = `linear-gradient(135deg, ${DA.espresso} 0%, ${DA.oxblood} 35%, ${DA.warmBurgundy} 65%, ${DA.burntOrange} 100%)`;
const GRAD_BTN      = `linear-gradient(135deg, ${DA.oxblood}, ${DA.warmBurgundy}, ${DA.burntOrange})`;
const GRAD_PROGRESS = `linear-gradient(90deg, ${DA.oxblood}, ${DA.warmBurgundy}, ${DA.mustard})`;
const GRAD_NAV_ACT  = `linear-gradient(135deg, ${DA.copper}, ${DA.burntOrange})`;
const GLASS_PANEL = 'rgba(245,240,224,0.85)';
const GLASS_PANEL_STRONG = 'rgba(245,240,224,0.94)';
const PANEL_SHADOW = '0 18px 60px rgba(131,84,30,0.18)';
const CTA_BTN = {
  background: GRAD_BTN, color: DA.cream, border: 'none', borderRadius: '10px',
  padding: '12px 28px', fontWeight: '800', cursor: 'pointer', fontSize: '14px',
  boxShadow: '0 4px 14px rgba(107,30,42,0.35)', transition: 'transform .15s, box-shadow .15s',
};

const ABAS = [
  { key:'inicio', label:'Início', emoji:'🏠' },
  { key:'estante', label:'Minha Estante', emoji:'📚' },
  { key:'agente', label:'B.IA', emoji:'🤖', avatar:true },
  { key:'adicionar', label:'Adicionar', emoji:'➕' },
  { key:'estatisticas', label:'Estatísticas', emoji:'📊' },
  { key:'metas', label:'Metas', emoji:'🎯' },
  { key:'love', label:'I ❤️ YOU', emoji:'💝', special:true },
];

function FotoModal({ src, titulo, onFechar }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(44,26,20,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:'20px', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }} onClick={onFechar}>
      <div style={{ position:'relative', maxWidth:'500px', width:'100%' }} onClick={e=>e.stopPropagation()}>
        <img src={src} alt={titulo} style={{ width:'100%', maxHeight:'80vh', objectFit:'contain', borderRadius:'16px', boxShadow:'0 32px 80px rgba(0,0,0,0.5)', display:'block' }} />
        <p style={{ textAlign:'center', color:'rgba(245,240,224,0.8)', fontSize:'14px', fontWeight:'600', marginTop:'12px' }}>{titulo}</p>
        <button onClick={onFechar} style={{ position:'absolute', top:'-14px', right:'-14px', background:DA.cream, border:'none', borderRadius:'50%', width:'34px', height:'34px', cursor:'pointer', fontWeight:'800', fontSize:'16px', color:DA.espresso, boxShadow:'0 4px 12px rgba(131,84,30,0.18)', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
      </div>
    </div>
  );
}

export default function App() {
  const [aba, setAba]                   = useState('inicio');
  const [user, setUser]                 = useState(null);
  const [authLoading, setAuthLoading]   = useState(true);
  const [busca, setBusca]               = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modalResenha, setModalResenha] = useState(null);
  const [fotoModal, setFotoModal]       = useState(null);
  const [metaAnual, setMetaAnual]       = useState(() => Number(localStorage.getItem('da-meta') || 12));
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [navMobile, setNavMobile]       = useState(false);

  const { livros: livrosSemFoto, loading, adicionar, atualizar, remover } = useLivros(user);
  // As fotos não vêm mais dentro do livro (ver src/fotos.js). `observar` é o
  // ref que dispara a busca quando o card chega perto da tela; `mesclar`
  // devolve `fotoUsuario` preenchido, para o resto do app não mudar.
  const { observar, mesclar } = useFotos(user);
  // `useMemo` não é enfeite aqui: a aba de Recomendações tem `livros` nas
  // dependências de um `useEffect` que busca na Google Books. Um array novo
  // a cada render dispararia essa busca sem parar.
  const livros = useMemo(() => mesclar(livrosSemFoto), [mesclar, livrosSemFoto]);
  // O hook vive aqui, não dentro do chat: a aba da B.IA e o widget flutuante
  // precisam enxergar a mesma coisa, e duas instâncias criariam dois listeners
  // com estados que divergem.
  const {
    conversas,
    carregando: carregandoConversas,
    salvar: salvarConversa,
    apagarDia,
  } = useConversas(user);

  useEffect(() => {
    completeRedirectLogin();
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => { localStorage.setItem('da-meta', String(metaAnual)); }, [metaAnual]);

  // Fecha menu mobile ao clicar fora
  useEffect(() => {
    if (!navMobile) return;
    const handler = (e) => {
      if (!e.target.closest('#mobile-menu') && !e.target.closest('#hamburger-btn')) {
        setNavMobile(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [navMobile]);

  const adicionarLivro = async (l) => { await adicionar(l); setAba('estante'); };
  const atualizarLivro = async (id, d) => { await atualizar(id, d); };
  const removerLivro   = async (id) => { if (confirm('Remover este livro da estante?')) await remover(id); };

  const ano        = new Date().getFullYear();
  const lidos      = livros.filter(l => l.status === 'lido');
  const lendoAgora = livros.filter(l => l.status === 'lendo');
  const queroLer   = livros.filter(l => l.status === 'quero-ler');
  const abandonei  = livros.filter(l => l.status === 'abandonei');
  const lidosAno   = lidos.filter(l => l.dataTermino?.startsWith(String(ano)));
  const pctMeta    = Math.min(100, Math.round((lidosAno.length / metaAnual) * 100));
  const ritmo      = ritmoMeta(lidosAno.length, metaAnual);

  const livrosFiltrados = livros.filter(l => {
    const q  = busca.toLowerCase();
    const ok = !q || l.titulo?.toLowerCase().includes(q) || l.autor?.toLowerCase().includes(q) || l.genero?.toLowerCase().includes(q);
    const st = filtroStatus === 'todos' || l.status === filtroStatus;
    return ok && st;
  });

  const ultimoLido = lidos.length > 0
    ? [...lidos].filter(l => l.dataTermino).sort((a,b) => new Date(b.dataTermino) - new Date(a.dataTermino))[0]
    : null;

  // Livro a destacar no Início quando ainda não há nenhum concluído. Prioriza o
  // que está sendo lido; depois a fila; por fim qualquer um — inclusive um
  // "lido" sem dataTermino, que não entra em `ultimoLido` mas existe.
  const destaqueSemLeitura = lendoAgora[0] || queroLer[0] || livros[0] || null;

  const salvarResenha = (resenha, nota, fotoUsuario) => {
    const dados = { resenha, nota };
    if (fotoUsuario !== undefined) dados.fotoUsuario = fotoUsuario;
    atualizarLivro(modalResenha.id, dados);
    setModalResenha(null);
  };

  if (authLoading) return (
    <div style={{ minHeight:'100vh', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'12px' }}>
      <BackgroundCarousel />
      <div style={{ background:'rgba(245,240,224,0.85)', borderRadius:'16px', padding:'32px 48px', textAlign:'center', backdropFilter:'blur(4px)' }}>
        <div style={{ fontSize:'40px', marginBottom:'12px', animation:'pulse 1.4s ease-in-out infinite' }}>📚</div>
        <p style={{ color:DA.walnut, fontWeight:'700', fontSize:'14px' }}>Carregando sua estante...</p>
      </div>
    </div>
  );

  const NavButton = ({ a }) => (
    <button onClick={() => { setAba(a.key); setNavMobile(false); }} style={{
      padding:'8px 14px', borderRadius:'9px', border:'none', cursor:'pointer',
      fontWeight:'700', fontSize:'13px', transition:'all .2s',
      background: a.special ? 'linear-gradient(135deg, #FF2D78, #C2185B)' : (aba === a.key ? GRAD_NAV_ACT : 'rgba(255,255,255,0.08)'),
      color: a.special ? '#fff' : (aba === a.key ? DA.cream : DA.warmBeige),
      boxShadow: a.special ? '0 2px 14px rgba(255,45,120,0.5)' : (aba === a.key ? '0 2px 10px rgba(0,0,0,0.3)' : 'none'),
      display:'flex', alignItems:'center', gap:'6px',
    }}>
      {a.avatar
        ? <BiaAvatar size={18} />
        : <span className={a.special ? 'heartbeat' : undefined} style={{ fontSize:'14px' }}>{a.emoji}</span>}
      <span>{a.label}</span>
    </button>
  );

  return (
    <div style={{ minHeight:'100vh', background:'transparent', fontFamily:"'Segoe UI', sans-serif" }}>
      <BackgroundCarousel />
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .page-content { animation: fadeIn .3s ease forwards; }
        .nav-desktop { display: flex !important; }
        .hamburger-btn { display: none !important; }
        .mobile-menu { animation: slideDown .2s ease forwards; }
        @media(max-width:768px) {
          .nav-desktop { display: none !important; }
          .hamburger-btn { display: flex !important; }
        }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 25%{transform:scale(1.3)} 50%{transform:scale(1.05)} 75%{transform:scale(1.25)} }
        .heartbeat { animation: heartbeat 1.4s ease-in-out infinite; display:inline-block; }
        @media(max-width:520px) { .auth-label { display:none; } .auth-btn { padding: 10px 12px !important; } }
        @media(max-width:480px) { .stats-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @keyframes piscaCursor { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        .cursor-bia { animation: piscaCursor 1s step-end infinite; margin-left: 1px; }
        /* Celular: o chat assume a tela inteira. Numa janela estreita, uma
           caixa de 420x600 flutuando deixava pouco espaço para ler e digitar. */
        @media(max-width:640px) {
          .bia-chat {
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            height: 100% !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .bia-chat > div:first-child { border-radius: 0 !important; }
        }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'rgba(44,26,20,0.92)', backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)', borderBottom:`1px solid rgba(196,154,108,0.25)`, boxShadow:'0 4px 24px rgba(0,0,0,0.35)', position:'sticky', top:0, zIndex:200 }}>
        <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'0 16px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', gap:'12px' }}>

            {/* Logo */}
            <button onClick={() => setAba('inicio')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', padding:0, flexShrink:0 }}>
              <div style={{ background:GRAD_BTN, borderRadius:'10px', padding:'7px 14px', fontWeight:'900', fontSize:'18px', color:DA.cream, letterSpacing:'-0.5px', boxShadow:'0 2px 10px rgba(131,84,30,0.18)', whiteSpace:'nowrap' }}>
                biblio<span style={{ color:DA.mustard }}>tech</span>
              </div>
            </button>

            {/* Nav Desktop */}
            <nav className="nav-desktop" style={{ gap:'4px', flex:1, justifyContent:'center' }}>
              {ABAS.map(a => <NavButton key={a.key} a={a} />)}
            </nav>

            {/* Auth + Hamburguer */}
            <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
              <Auth user={user} DA={DA} GRAD_BTN={GRAD_BTN} />
              <button
                id="hamburger-btn"
                className="hamburger-btn"
                onClick={() => setNavMobile(v => !v)}
                style={{
                  background: navMobile ? GRAD_NAV_ACT : 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(196,154,108,0.3)', borderRadius:'9px',
                  width:'42px', height:'42px', cursor:'pointer',
                  flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'5px',
                  transition:'background .2s',
                }}
              >
                <span style={{ display:'block', width:'20px', height:'2px', background:DA.cream, borderRadius:'2px', transition:'transform .2s', transform: navMobile ? 'rotate(45deg) translate(5px,5px)' : 'none' }} />
                <span style={{ display:'block', width:'20px', height:'2px', background:DA.cream, borderRadius:'2px', opacity: navMobile ? 0 : 1, transition:'opacity .2s' }} />
                <span style={{ display:'block', width:'20px', height:'2px', background:DA.cream, borderRadius:'2px', transition:'transform .2s', transform: navMobile ? 'rotate(-45deg) translate(5px,-5px)' : 'none' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Menu mobile dropdown */}
        {navMobile && (
          <div id="mobile-menu" className="mobile-menu" style={{ background:'rgba(25,10,5,0.97)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderTop:'1px solid rgba(196,154,108,0.2)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
            {ABAS.map((a, i) => (
              <button key={a.key} onClick={() => { setAba(a.key); setNavMobile(false); }} style={{
                width:'100%', padding:'16px 24px', border:'none', cursor:'pointer',
                fontWeight:'700', fontSize:'16px', display:'flex', alignItems:'center', gap:'14px',
                transition:'background .15s', fontFamily:"'Segoe UI', sans-serif",
                background: aba === a.key ? 'rgba(181,98,42,0.2)' : 'transparent',
                color: aba === a.key ? DA.mustard : DA.warmBeige,
                borderBottom: i < ABAS.length - 1 ? '1px solid rgba(196,154,108,0.1)' : 'none',
                borderLeft: aba === a.key ? `3px solid ${DA.copper}` : '3px solid transparent',
                textAlign:'left',
              }}>
                {a.avatar
                  ? <BiaAvatar size={24} />
                  : <span style={{ fontSize:'22px' }}>{a.emoji}</span>}
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Banner sem login */}
      {!user && (
        <div style={{ background:'rgba(20,10,6,0.82)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)', borderBottom:'1px solid rgba(196,154,108,0.30)', padding:'10px 16px', textAlign:'center' }}>
          <span style={{ fontSize:'13px', color:'rgba(245,240,224,0.95)', fontWeight:'600' }}>
            📖 Navegando sem conta — livros salvos só neste dispositivo.{' '}
            <button onClick={() => loginGoogle()}
              style={{ background:'none', border:'none', color:'#C49A22', fontWeight:'800', cursor:'pointer', textDecoration:'underline', fontSize:'13px', textUnderlineOffset:'3px' }}>
              Entre com Google
            </button>{' '}para sincronizar em qualquer lugar.
          </span>
        </div>
      )}

      <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'24px 16px' }}>

        {/* INÍCIO */}
        {aba === 'inicio' && (
          <div className="page-content" style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            {ultimoLido ? (
              <div style={{ background:GRAD_HERO, borderRadius:'20px', padding:'36px', display:'flex', alignItems:'center', gap:'36px', flexWrap:'wrap', boxShadow:'0 12px 40px rgba(107,30,42,0.35)', border:`1px solid ${DA.warmBurgundy}` }}>
                <div style={{ position:'relative', flexShrink:0 }}>
                  <img ref={observar(ultimoLido)} src={ultimoLido.fotoUsuario || ultimoLido.capa || bookPlaceholder(130, 185)} alt={ultimoLido.titulo}
                    style={{ width:'130px', height:'185px', objectFit:'cover', borderRadius:'10px', boxShadow:'0 8px 24px rgba(131,84,30,0.22)', cursor:'pointer', display:'block' }}
                    onClick={() => { const src = ultimoLido.fotoUsuario || ultimoLido.capa; if (src) setFotoModal({ src, titulo: ultimoLido.titulo }); }} />
                  {(ultimoLido.fotoUsuario || ultimoLido.temFoto) && (
                    <div style={{ position:'absolute', bottom:'-8px', right:'-8px', background:DA.copper, borderRadius:'50%', width:'26px', height:'26px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', border:'2px solid white', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>📷</div>
                  )}
                </div>
                <div>
                  <p style={{ color:DA.mustard, fontSize:'11px', fontWeight:'800', textTransform:'uppercase', letterSpacing:'3px', marginBottom:'10px' }}>📖 Último livro lido</p>
                  <h2 style={{ fontSize:'28px', fontWeight:'900', color:DA.cream, marginBottom:'6px', lineHeight:1.2 }}>{ultimoLido.titulo}</h2>
                  <p style={{ color:DA.warmBeige, fontSize:'15px', marginBottom:'14px', opacity:0.85 }}>{ultimoLido.autor}</p>
                  <StarRating rating={ultimoLido.nota} DA={DA} />
                  {ultimoLido.resenha && (
                    <p style={{ marginTop:'14px', color:DA.warmBeige, fontSize:'14px', fontStyle:'italic', maxWidth:'420px', opacity:0.8, lineHeight:1.6 }}>
                      "{ultimoLido.resenha.slice(0,160)}{ultimoLido.resenha.length > 160 ? '…' : ''}"
                    </p>
                  )}
                </div>
              </div>
            ) : estadoDaEstante(livros, ultimoLido) === 'vazia' ? (
              <div style={{ background:GLASS_PANEL_STRONG, borderRadius:'20px', padding:'52px 48px', textAlign:'center', border:'2px dashed rgba(196,154,108,0.5)', boxShadow:PANEL_SHADOW, backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
                <div style={{ fontSize:'52px', marginBottom:'14px' }}>📚</div>
                <p style={{ color:DA.espresso, fontSize:'17px', fontWeight:'700', marginBottom:'6px' }}>Sua estante está vazia</p>
                <p style={{ color:DA.espresso, fontSize:'14px', marginBottom:'22px', opacity:0.92 }}>Adicione seu primeiro livro para começar!</p>
                <button onClick={() => setAba('adicionar')} style={{ ...CTA_BTN }}>➕ Adicionar Primeiro Livro</button>
              </div>
            ) : (
              /* Tem livro, só não tem nenhum concluído. Antes esse caso caía no
                 card de estante vazia: quem acabava de cadastrar um livro lia
                 "Sua estante está vazia" logo depois de adicioná-lo. */
              <div style={{ background:GRAD_HERO, borderRadius:'20px', padding:'36px', display:'flex', alignItems:'center', gap:'36px', flexWrap:'wrap', boxShadow:'0 12px 40px rgba(107,30,42,0.35)', border:`1px solid ${DA.warmBurgundy}` }}>
                {destaqueSemLeitura && (
                  <div style={{ position:'relative', flexShrink:0, cursor:'pointer' }}
                    onClick={() => { const src = destaqueSemLeitura.fotoUsuario || destaqueSemLeitura.capa; if (src) setFotoModal({ src, titulo: destaqueSemLeitura.titulo }); }}>
                    <img ref={observar(destaqueSemLeitura)} src={destaqueSemLeitura.fotoUsuario || destaqueSemLeitura.capa || bookPlaceholder(130, 185)} alt={destaqueSemLeitura.titulo}
                      style={{ width:'130px', height:'185px', objectFit:'cover', borderRadius:'10px', boxShadow:'0 8px 24px rgba(131,84,30,0.22)', display:'block' }} />
                  </div>
                )}
                <div style={{ minWidth:0 }}>
                  <p style={{ color:DA.mustard, fontSize:'11px', fontWeight:'800', textTransform:'uppercase', letterSpacing:'3px', marginBottom:'10px' }}>
                    {lendoAgora.length > 0 ? '📖 Lendo agora' : '⏳ Na fila'}
                  </p>
                  <h2 style={{ fontSize:'28px', fontWeight:'900', color:DA.cream, marginBottom:'6px', lineHeight:1.2 }}>
                    {destaqueSemLeitura?.titulo}
                  </h2>
                  {destaqueSemLeitura?.autor && (
                    <p style={{ color:DA.warmBeige, fontSize:'15px', marginBottom:'14px', opacity:0.85 }}>{destaqueSemLeitura.autor}</p>
                  )}
                  <p style={{ color:DA.warmBeige, fontSize:'14px', maxWidth:'420px', opacity:0.85, lineHeight:1.6 }}>
                    {livros.length === 1
                      ? 'Seu primeiro livro está na estante. Quando terminar, marque como lido e dê uma nota — é a partir daí que eu monto seu ritmo e suas recomendações.'
                      : `Você tem ${livros.length} livros na estante, mas nenhum concluído ainda. Marque um como lido para começar a ver seu ritmo de leitura.`}
                  </p>
                  <button onClick={() => setAba('estante')} style={{ ...CTA_BTN, marginTop:'16px' }}>
                    📚 Ver Minha Estante
                  </button>
                </div>
              </div>
            )}

            <Stats lidos={lidos.length} lendo={lendoAgora.length} queroLer={queroLer.length} abandonei={abandonei.length} DA={DA} GRAD_BTN={GRAD_BTN} />

            {/* Meta de leitura */}
            <div style={{ background:GLASS_PANEL_STRONG, borderRadius:'18px', padding:'26px', boxShadow:PANEL_SHADOW, border:'1px solid rgba(196,154,108,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso }}>🎯 Meta de Leitura {ano}</h3>
                <button onClick={() => setEditandoMeta(v => !v)} style={{ fontSize:'12px', color:DA.oxblood, background:'none', border:`1px solid ${DA.oxblood}`, borderRadius:'6px', padding:'4px 10px', cursor:'pointer', fontWeight:'700' }}>
                  {editandoMeta ? '✓ Salvar' : '✏️ Editar'}
                </button>
              </div>
              {editandoMeta ? (
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'14px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'14px', color:DA.espresso }}>Quero ler</span>
                  <input type="number" min="1" max="365" value={metaAnual} onChange={e => setMetaAnual(Number(e.target.value))}
                    style={{ width:'80px', padding:'6px 10px', borderRadius:'8px', border:`2px solid ${DA.copper}`, textAlign:'center', fontWeight:'800', fontSize:'18px' }} />
                  <span style={{ fontSize:'14px', color:DA.espresso }}>livros em {ano}</span>
                </div>
              ) : (
                <p style={{ fontSize:'14px', color:DA.espresso, marginBottom:'14px' }}>
                  <strong style={{ color:DA.oxblood, fontSize:'22px' }}>{lidosAno.length}</strong> de <strong>{metaAnual}</strong> livros em {ano}
                </p>
              )}
              <div style={{ background:`${DA.warmBeige}55`, borderRadius:'999px', height:'16px', overflow:'hidden' }}>
                <div style={{ background:GRAD_PROGRESS, height:'100%', borderRadius:'999px', width:`${pctMeta}%`, transition:'width .6s ease' }} />
              </div>
              <p style={{ fontSize:'12px', color:DA.warmBeige, marginTop:'6px', textAlign:'right', fontWeight:'600' }}>{pctMeta}% da meta</p>
            </div>

            {/* Lendo agora */}
            {lendoAgora.length > 0 && (
              <div style={{ background:GLASS_PANEL, borderRadius:'18px', padding:'26px', boxShadow:PANEL_SHADOW, border:'1px solid rgba(196,154,108,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
                <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso, marginBottom:'18px' }}>📖 Lendo Agora</h3>
                <div style={{ display:'flex', gap:'20px', overflowX:'auto', paddingBottom:'8px' }}>
                  {lendoAgora.map(l => (
                    <div key={l.id} style={{ minWidth:'100px', textAlign:'center', cursor:'pointer' }}
                      onClick={() => { const src = l.fotoUsuario || l.capa; if (src) setFotoModal({ src, titulo: l.titulo }); }}>
                      <div style={{ position:'relative', display:'inline-block' }}>
                        <img ref={observar(l)} src={l.fotoUsuario || l.capa || bookPlaceholder(100, 140)} alt={l.titulo}
                          style={{ width:'100px', height:'140px', objectFit:'cover', borderRadius:'8px', boxShadow:'0 6px 16px rgba(44,26,20,0.2)', display:'block' }} />
                        {(l.fotoUsuario || l.temFoto) && (
                          <div style={{ position:'absolute', bottom:'-5px', right:'-5px', background:DA.copper, borderRadius:'50%', width:'18px', height:'18px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', border:'2px solid white' }}>📷</div>
                        )}
                      </div>
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
          <div className="page-content">
            <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap', alignItems:'center' }}>
              <input type="text" placeholder="🔍 Pesquisar por título, autor ou gênero..." value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ flex:1, minWidth:'200px', padding:'10px 16px', borderRadius:'10px', border:`2px solid ${DA.warmBeige}`, outline:'none', fontSize:'14px', background:'rgba(245,240,224,0.90)', transition:'border-color .2s' }}
                onFocus={e => e.target.style.borderColor = DA.copper}
                onBlur={e => e.target.style.borderColor = DA.warmBeige}
              />
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {[
                  {key:'todos',label:'Todos'},
                  {key:'lendo',label:'📖 Lendo'},
                  {key:'lido',label:'✅ Lidos'},
                  {key:'quero-ler',label:'⏳ Quero Ler'},
                  {key:'abandonei',label:'❌ Abandonei'},
                ].map(f => (
                  <button key={f.key} onClick={() => setFiltroStatus(f.key)} style={{
                    padding:'8px 14px', borderRadius:'8px', border:'none', cursor:'pointer',
                    fontWeight:'700', fontSize:'12px', transition:'all .2s',
                    background: filtroStatus === f.key ? GRAD_BTN : 'rgba(245,240,224,0.85)',
                    color: filtroStatus === f.key ? DA.cream : DA.espresso,
                    boxShadow: filtroStatus === f.key ? '0 2px 8px rgba(107,30,42,0.25)' : 'none',
                  }}>{f.label}</button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'60px', color:DA.warmBeige, fontSize:'14px', fontWeight:'600' }}>
                <div style={{ fontSize:'32px', marginBottom:'12px', display:'inline-block', animation:'spin 1s linear infinite' }}>⚙️</div>
                <p>Carregando livros...</p>
              </div>
            ) : livrosFiltrados.length === 0 ? (
              <div style={{ background:GLASS_PANEL_STRONG, borderRadius:'20px', padding:'52px 32px', textAlign:'center', border:'2px dashed rgba(196,154,108,0.5)', backdropFilter:'blur(12px)' }}>
                <div style={{ fontSize:'48px', marginBottom:'14px' }}>🔍</div>
                <p style={{ color:DA.espresso, fontSize:'16px', fontWeight:'700', marginBottom:'8px' }}>Nenhum livro encontrado</p>
                <p style={{ color:DA.warmBeige, fontSize:'14px', marginBottom:'22px' }}>{busca ? `Nenhum resultado para "${busca}"` : 'Sua estante está vazia'}</p>
                <button onClick={() => setAba('adicionar')} style={{ ...CTA_BTN }}>➕ Adicionar Livro</button>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'16px' }}>
                {livrosFiltrados.map(l => (
                  <BookCard key={l.id} livro={l} refFoto={observar(l)} DA={DA} GRAD_BTN={GRAD_BTN}
                    onAtualizar={(d) => atualizarLivro(l.id, d)} onRemover={() => removerLivro(l.id)}
                    onResenha={() => setModalResenha(l)}
                    onFoto={(src) => setFotoModal({ src, titulo: l.titulo })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADICIONAR */}
        {aba === 'adicionar' && (
          <div className="page-content">
            <div style={{ background:GLASS_PANEL_STRONG, borderRadius:'20px', padding:'32px', boxShadow:PANEL_SHADOW, border:'1px solid rgba(196,154,108,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', maxWidth:'640px', margin:'0 auto' }}>
              <h2 style={{ fontWeight:'900', fontSize:'20px', color:DA.espresso, marginBottom:'24px' }}>➕ Adicionar Livro</h2>
              <BookForm onSave={adicionarLivro} DA={DA} GRAD_BTN={GRAD_BTN} />
            </div>
          </div>
        )}

        {/* ESTATÍSTICAS */}
        {aba === 'estatisticas' && (
          <Estatisticas
            livros={livros}
            DA={DA}
            GRAD_BTN={GRAD_BTN}
            googleBooksKey={import.meta.env.VITE_GOOGLE_BOOKS_API_KEY}
            onIrParaAdicionar={() => setAba('adicionar')}
            onIrParaMetas={() => setAba('metas')}
            onAdicionarLivro={adicionar}
          />
        )}

        {/* METAS */}
        {aba === 'metas' && (
          <div className="page-content" style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <div style={{ background:GLASS_PANEL_STRONG, borderRadius:'20px', padding:'30px', boxShadow:PANEL_SHADOW, border:'1px solid rgba(196,154,108,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
                <h3 style={{ fontWeight:'800', fontSize:'18px', color:DA.espresso }}>🎯 Meta de Leitura {ano}</h3>
                <button onClick={() => setEditandoMeta(v => !v)} style={{ fontSize:'13px', color:DA.oxblood, background:'none', border:`1px solid ${DA.oxblood}`, borderRadius:'8px', padding:'6px 14px', cursor:'pointer', fontWeight:'700' }}>
                  {editandoMeta ? '✓ Salvar' : '✏️ Editar meta'}
                </button>
              </div>
              {editandoMeta && (
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'14px', color:DA.espresso }}>Quero ler</span>
                  <input type="number" min="1" max="365" value={metaAnual} onChange={e => setMetaAnual(Number(e.target.value))}
                    style={{ width:'80px', padding:'6px 10px', borderRadius:'8px', border:`2px solid ${DA.copper}`, textAlign:'center', fontWeight:'800', fontSize:'18px' }} />
                  <span style={{ fontSize:'14px', color:DA.espresso }}>livros em {ano}</span>
                </div>
              )}
              <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'16px' }}>
                <span style={{ fontSize:'48px', fontWeight:'900', color:DA.oxblood, lineHeight:1 }}>{lidosAno.length}</span>
                <span style={{ fontSize:'20px', color:DA.warmBeige, fontWeight:'600' }}>/ {metaAnual} livros</span>
              </div>
              <div style={{ background:`${DA.warmBeige}55`, borderRadius:'999px', height:'22px', overflow:'hidden', marginBottom:'8px' }}>
                <div style={{ background:GRAD_PROGRESS, height:'100%', borderRadius:'999px', width:`${pctMeta}%`, transition:'width .6s ease', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:'10px' }}>
                  {pctMeta > 12 && <span style={{ color:'white', fontSize:'11px', fontWeight:'800' }}>{pctMeta}%</span>}
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', color:DA.warmBeige, fontWeight:'600' }}>
                <span>{lidosAno.length} lidos em {ano}</span><span>{Math.max(0, metaAnual - lidosAno.length)} restantes</span>
              </div>
            </div>

            {/* Ritmo necessário para fechar a meta — a análise mês a mês fica na aba Estatísticas */}
            <div style={{ background:GLASS_PANEL, borderRadius:'20px', padding:'30px', boxShadow:PANEL_SHADOW, border:'1px solid rgba(196,154,108,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
              <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso, marginBottom:'18px' }}>⏱️ Seu ritmo</h3>

              {ritmo.cumprida ? (
                <div style={{ textAlign:'center', padding:'12px 0 4px' }}>
                  <div style={{ fontSize:'40px', marginBottom:'8px' }}>🎉</div>
                  <p style={{ fontSize:'16px', fontWeight:'800', color:DA.forestGreen, marginBottom:'4px' }}>Meta de {ano} cumprida!</p>
                  <p style={{ fontSize:'13px', color:DA.walnut, opacity:0.85 }}>
                    Você leu {ritmo.feitos} de {ritmo.meta} livros. Que tal aumentar a meta?
                  </p>
                </div>
              ) : (
                <>
                  <div className="stats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'16px' }}>
                    {[
                      { valor: ritmo.restantes, rotulo: 'Faltam', sub: `para os ${ritmo.meta}`, cor: DA.oxblood },
                      { valor: ritmo.porMes, rotulo: 'Por mês', sub: `em ${ritmo.mesesRestantes} ${ritmo.mesesRestantes === 1 ? 'mês' : 'meses'}`, cor: DA.burntOrange },
                      { valor: ritmo.projecao, rotulo: 'Projeção', sub: `no ritmo atual`, cor: ritmo.noRitmo ? DA.forestGreen : DA.warmBurgundy },
                    ].map(c => (
                      <div key={c.rotulo} style={{ background:`${c.cor}18`, border:`1px solid ${c.cor}44`, borderRadius:'12px', padding:'16px', textAlign:'center' }}>
                        <div style={{ fontSize:'26px', fontWeight:'900', color:c.cor, lineHeight:1.1 }}>{c.valor}</div>
                        <div style={{ fontSize:'11px', color:c.cor, fontWeight:'700', marginTop:'4px' }}>{c.rotulo}</div>
                        <div style={{ fontSize:'10px', color:DA.walnut, opacity:0.7, marginTop:'2px' }}>{c.sub}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize:'13px', color:DA.walnut, textAlign:'center', fontWeight:'600', lineHeight:1.5 }}>
                    {ritmo.feitos === 0
                      ? `Nenhum livro concluído em ${ano} ainda. Comece por um: são ${ritmo.porMes} por mês até dezembro.`
                      : ritmo.noRitmo
                        ? `✅ Você está no ritmo — lendo ${ritmo.ritmoAtual}/mês, deve fechar o ano com ${ritmo.projecao}.`
                        : `⚠️ Seu ritmo atual é ${ritmo.ritmoAtual}/mês. Para bater a meta, precisa subir para ${ritmo.porMes}/mês.`}
                  </p>
                </>
              )}

              <button onClick={() => setAba('estatisticas')} style={{
                marginTop:'18px', width:'100%', background:'none', border:`1px dashed ${DA.warmBeige}`,
                borderRadius:'10px', padding:'11px', cursor:'pointer', fontWeight:'700',
                fontSize:'13px', color:DA.oxblood, fontFamily:'inherit',
              }}>
                📊 Ver análise mês a mês em Estatísticas →
              </button>
            </div>

            {lidosAno.length > 0 && (
              <div style={{ background:GLASS_PANEL, borderRadius:'20px', padding:'30px', boxShadow:PANEL_SHADOW, border:'1px solid rgba(196,154,108,0.4)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }}>
                <h3 style={{ fontWeight:'800', fontSize:'16px', color:DA.espresso, marginBottom:'18px' }}>✅ Lidos em {ano}</h3>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {lidosAno.sort((a,b)=>new Date(b.dataTermino)-new Date(a.dataTermino)).map(l => (
                    <div key={l.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px', borderRadius:'12px', background:DA.cream }}>
                      <div style={{ position:'relative', flexShrink:0, cursor:'pointer' }}
                        onClick={() => { const src = l.fotoUsuario||l.capa; if(src) setFotoModal({src,titulo:l.titulo}); }}>
                        <img ref={observar(l)} src={l.fotoUsuario||l.capa||bookPlaceholder(40, 56)} alt={l.titulo}
                          style={{ width:'40px', height:'56px', objectFit:'cover', borderRadius:'5px', display:'block' }} />
                        {(l.fotoUsuario || l.temFoto) && (
                          <div style={{ position:'absolute', bottom:'-4px', right:'-4px', background:DA.copper, borderRadius:'50%', width:'14px', height:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'7px', border:'1px solid white' }}>📷</div>
                        )}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:'800', fontSize:'14px', color:DA.espresso, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.titulo}</p>
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

        {/* B.IA */}
        {aba === 'agente' && (
          <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'center', background: 'rgba(245,240,224,0.9)', padding: '40px', borderRadius: '20px', boxShadow: PANEL_SHADOW, maxWidth: '600px', width: '100%', backdropFilter: 'blur(12px)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <BiaAvatar size={96} style={{ border: `3px solid ${DA.oxblood}`, boxShadow: '0 8px 24px rgba(107,30,42,0.35)' }} />
              </div>
              <h2 style={{ color: DA.espresso, fontSize: '24px', fontWeight: '900', marginBottom: '16px' }}>B.IA - Sua Agente Literária</h2>
              <p style={{ color: DA.walnut, lineHeight: '1.6', marginBottom: '20px' }}>
                Clique no botão no canto inferior direito para conversar. Ela conhece
                sua estante, tem opinião sobre livros e não tem papas na língua.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px', textAlign: 'left', maxWidth: '380px', margin: '0 auto 24px' }}>
                {[
                  '“Tô lendo demais do mesmo tipo?”',
                  '“Me indica algo diferente do que costumo ler”',
                  '“Vale a pena esse livro que eu adicionei?”',
                ].map(exemplo => (
                  <div key={exemplo} style={{ fontSize: '13px', color: DA.walnut, background: 'rgba(255,255,255,0.55)', borderRadius: '9px', padding: '9px 13px', border: `1px solid ${DA.warmBeige}` }}>
                    {exemplo}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setAba('estatisticas')} style={CTA_BTN}>
                  📊 Ver Estatísticas
                </button>
                <button onClick={() => setAba('estante')} style={{ ...CTA_BTN, background: 'rgba(255,255,255,0.7)', color: DA.espresso, boxShadow: 'none', border: `1px solid ${DA.warmBeige}` }}>
                  Ver Minha Estante
                </button>
              </div>
            </div>

            {/* Conversas guardadas. Ficam aqui porque o widget flutuante é
                estreito demais para reler uma conversa inteira. */}
            <div style={{ maxWidth: '600px', width: '100%' }}>
              <HistoricoConversas
                conversas={conversas}
                carregando={carregandoConversas}
                onApagar={apagarDia}
                DA={DA}
                user={user}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modo I ❤️ YOU — stories de Dia dos Namorados */}
      {aba === 'love' && <LoveStories onFechar={() => setAba('inicio')} />}

      {/* Modal de resenha */}
      {modalResenha && (
        <ResenhaModal livro={modalResenha} DA={DA} GRAD_BTN={GRAD_BTN} onSalvar={salvarResenha} onFechar={() => setModalResenha(null)} />
      )}
      {fotoModal && (
        <FotoModal src={fotoModal.src} titulo={fotoModal.titulo} onFechar={() => setFotoModal(null)} />
      )}

      {/* AGENTE LITERÁRIO FLUTUANTE */}
      <LiteraryAgent
        livros={livros}
        conversas={conversas}
        onSalvarConversa={salvarConversa}
        onApagarDia={apagarDia}
        DA={DA}
        GRAD_BTN={GRAD_BTN}
        googleBooksKey={import.meta.env.VITE_GOOGLE_BOOKS_API_KEY}
      />
    </div>
  );
}
