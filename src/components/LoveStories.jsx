import { useState, useEffect, useMemo, useRef } from 'react';
import { LOVE_SLIDES, LOVE_CONFIG } from '../love/slides';

const ROSE = '#FF2D78';
const PINK_DEEP = '#C2185B';
const WINE = '#7B1232';
const GRAD_LOVE = `linear-gradient(135deg, ${ROSE}, ${PINK_DEEP}, ${WINE})`;
const GRAD_RING = `linear-gradient(45deg, #F9CE34, #EE2A7B, #6228D7)`; // anel de story do Instagram

const BTN_LOVE = {
  background: GRAD_LOVE,
  color: '#fff',
  border: 'none',
  borderRadius: '999px',
  padding: '14px 32px',
  fontWeight: '800',
  fontSize: '15px',
  cursor: 'pointer',
  boxShadow: '0 6px 24px rgba(255,45,120,0.45)',
  transition: 'transform .15s',
};

export function LoveStories({ onFechar }) {
  const [fase, setFase]         = useState('intro'); // intro | stories | fim
  const [idx, setIdx]           = useState(0);
  const [pausado, setPausado]   = useState(false);
  const [mudo, setMudo]         = useState(false);
  const [temMusica, setTemMusica] = useState(false);
  const [burst, setBurst]       = useState([]);
  const audioRef = useRef(null);
  const ytRef    = useRef(null);
  const downRef  = useRef(0);

  const usaYoutube = Boolean(LOVE_CONFIG.youtubeId);
  const temSom     = usaYoutube || temMusica;

  const total = LOVE_SLIDES.length;
  const dur   = LOVE_CONFIG.duracaoSlide;
  const slide = LOVE_SLIDES[idx];

  // Trava o scroll do app enquanto o modo love está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Mudo: controla o <audio> local e o player do YouTube (via postMessage da API oficial)
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = mudo;
    const win = ytRef.current?.contentWindow;
    if (win) win.postMessage(JSON.stringify({ event: 'command', func: mudo ? 'mute' : 'unMute', args: [] }), '*');
  }, [mudo]);

  const avancar = () => { if (idx + 1 >= total) setFase('fim'); else setIdx(idx + 1); };
  const voltar  = () => setIdx(i => Math.max(0, i - 1));

  const iniciar = () => {
    setIdx(0);
    setPausado(false);
    setFase('stories');
    const a = audioRef.current;
    if (a) { a.currentTime = 0; a.play().catch(() => {}); }
  };

  // Teclado: ← → navegam, Esc fecha (re-registra a cada render para pegar idx/fase atuais)
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { onFechar(); return; }
      if (fase !== 'stories') return;
      if (e.key === 'ArrowRight') avancar();
      if (e.key === 'ArrowLeft') voltar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Chuva de corações — posições/tempos sorteados uma vez
  const hearts = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 9,
    queda: 7 + Math.random() * 7,
    size: 14 + Math.random() * 22,
    emoji: ['❤️', '💕', '💖', '💘', '💗'][i % 5],
  })), []);

  // Burst de corações ao clicar em "Te amo ❤️"
  const teAmo = () => {
    const novos = Array.from({ length: 12 }, (_, i) => ({
      id: `${Date.now()}-${i}`,
      left: 8 + Math.random() * 84,
      delay: Math.random() * 0.4,
      size: 18 + Math.random() * 28,
      emoji: ['❤️', '💖', '😍', '💞'][i % 4],
    }));
    setBurst(b => [...b, ...novos]);
    setTimeout(() => setBurst(b => b.filter(h => !novos.some(n => n.id === h.id))), 2800);
  };

  // Segurar pausa; toque rápido navega (esquerda volta, direita avança)
  const onDown = () => { downRef.current = Date.now(); setPausado(true); };
  const onUp = e => {
    setPausado(false);
    if (Date.now() - downRef.current < 250) {
      if (e.clientX < window.innerWidth / 2) voltar(); else avancar();
    }
  };

  const fallback = e => {
    e.target.onerror = null;
    e.target.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="${WINE}"/><text x="270" y="490" font-size="90" text-anchor="middle">💝</text></svg>`
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000, background: '#14040c',
      fontFamily: "'Segoe UI', sans-serif", userSelect: 'none', WebkitUserSelect: 'none',
      touchAction: 'manipulation', overflow: 'hidden',
    }} onContextMenu={e => e.preventDefault()}>

      {/* ── CHUVA DE CORAÇÕES ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', overflow: 'hidden' }}>
        {hearts.map(h => (
          <span key={h.id} style={{
            position: 'absolute', left: `${h.left}%`, top: '-8vh',
            fontSize: `${h.size}px`, opacity: 0.8,
            animation: `loveFall ${h.queda}s linear ${h.delay}s infinite`,
          }}>{h.emoji}</span>
        ))}
      </div>

      {/* ── INTRO: "Toque para começar" (gesto libera o áudio) ── */}
      {fase === 'intro' && (
        <div onClick={iniciar} style={{
          position: 'absolute', inset: 0, zIndex: 10, cursor: 'pointer',
          background: `radial-gradient(circle at 50% 35%, rgba(255,45,120,0.35), transparent 60%), linear-gradient(160deg, #2a0514, #14040c)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px',
          textAlign: 'center', padding: '24px', animation: 'loveFadeIn .4s ease',
        }}>
          <div style={{ fontSize: '88px', animation: 'loveBeat 1.3s ease-in-out infinite' }}>💝</div>
          <h1 style={{ color: '#fff', fontSize: '26px', fontWeight: '900', letterSpacing: '-0.5px' }}>
            Para você, {LOVE_CONFIG.nomeDela} ❤️
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', maxWidth: '320px', lineHeight: 1.5 }}>
            Preparei uma surpresinha de Dia dos Namorados…
          </p>
          <button onClick={iniciar} style={{ ...BTN_LOVE, marginTop: '10px' }}>
            Toque para começar 💌
          </button>
        </div>
      )}

      {/* ── STORIES ── */}
      {fase === 'stories' && (
        <>
          {/* Área da foto — toque navega, segurar pausa */}
          <div onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={() => setPausado(false)}
            style={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'pointer' }}>
            {/* fundo desfocado da própria foto (como o Instagram) */}
            <img src={slide.src} alt="" aria-hidden onError={fallback} draggable={false} style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', filter: 'blur(30px) brightness(0.4)', transform: 'scale(1.2)',
            }} />
            <img key={idx} src={slide.src} alt={slide.caption} onError={fallback} draggable={false} style={{
              position: 'relative', width: '100%', height: '100%', objectFit: 'contain',
              animation: `loveZoom ${dur}ms ease-out forwards, loveFadeIn .35s ease`,
            }} />
          </div>

          {/* Legenda */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 6, pointerEvents: 'none',
            padding: '70px 22px 34px',
            background: 'linear-gradient(to top, rgba(20,4,12,0.85), transparent)',
            textAlign: 'center',
          }}>
            <p key={`cap-${idx}`} style={{
              color: '#fff', fontSize: '18px', fontWeight: '700', lineHeight: 1.45,
              textShadow: '0 2px 12px rgba(0,0,0,0.6)', animation: 'loveSlideUp .45s ease',
              maxWidth: '500px', margin: '0 auto',
            }}>{slide.caption}</p>
          </div>

          {/* Topo: progresso + header estilo Instagram */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
            padding: '10px 12px 26px',
            background: 'linear-gradient(to bottom, rgba(20,4,12,0.8), transparent)',
          }}>
            {/* Barras de progresso segmentadas */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              {LOVE_SLIDES.map((_, i) => (
                <div key={i} style={{ flex: 1, height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                  {i < idx && <div style={{ width: '100%', height: '100%', background: '#fff' }} />}
                  {i === idx && (
                    <div key={`fill-${idx}`} onAnimationEnd={avancar} style={{
                      height: '100%', background: '#fff',
                      animation: `loveFill ${dur}ms linear forwards`,
                      animationPlayState: pausado ? 'paused' : 'running',
                    }} />
                  )}
                </div>
              ))}
            </div>

            {/* Header: perfil + nome + "Te amo" no lugar do "Seguir" */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                background: GRAD_RING, borderRadius: '50%', padding: '2.5px',
                flexShrink: 0, display: 'flex',
              }}>
                <img src={LOVE_CONFIG.perfilFoto} alt="" onError={fallback} style={{
                  width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover',
                  border: '2px solid #14040c', display: 'block',
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#fff', fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {LOVE_CONFIG.nomeInsta || LOVE_CONFIG.nomeDela} ❤️
                </p>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>Patrocinado pelo seu namorado 😄</p>
              </div>
              <button onClick={teAmo} style={{
                background: 'transparent', color: '#fff', border: '1.5px solid rgba(255,255,255,0.85)',
                borderRadius: '999px', padding: '7px 16px', fontWeight: '700', fontSize: '13px',
                cursor: 'pointer', flexShrink: 0,
              }}>Te amo ❤️</button>
              {temSom && (
                <button onClick={() => setMudo(m => !m)} style={{
                  background: 'rgba(255,255,255,0.12)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer',
                  fontSize: '15px', flexShrink: 0,
                }}>{mudo ? '🔇' : '🔊'}</button>
              )}
              <button onClick={onFechar} style={{
                background: 'none', color: '#fff', border: 'none', fontSize: '22px',
                cursor: 'pointer', fontWeight: '300', flexShrink: 0, padding: '0 4px', lineHeight: 1,
              }}>✕</button>
            </div>
          </div>
        </>
      )}

      {/* ── FINAL ── */}
      {fase === 'fim' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: `radial-gradient(circle at 50% 30%, rgba(255,45,120,0.4), transparent 60%), linear-gradient(160deg, #2a0514, #14040c)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
          textAlign: 'center', padding: '24px', animation: 'loveFadeIn .5s ease',
        }}>
          <div style={{ fontSize: '80px', animation: 'loveBeat 1.3s ease-in-out infinite' }}>💖</div>
          <h1 style={{ color: '#fff', fontSize: '28px', fontWeight: '900', lineHeight: 1.3, maxWidth: '420px' }}>
            Feliz Dia dos Namorados, {LOVE_CONFIG.nomeDela}!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '16px', maxWidth: '360px', lineHeight: 1.6 }}>
            Te amo hoje, amanhã e sempre. ❤️
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={iniciar} style={BTN_LOVE}>Ver de novo 🔁</button>
            <button onClick={onFechar} style={{
              ...BTN_LOVE, background: 'rgba(255,255,255,0.12)', boxShadow: 'none',
              border: '1.5px solid rgba(255,255,255,0.4)',
            }}>Voltar à estante 📚</button>
          </div>
        </div>
      )}

      {/* ── BURST de corações do botão "Te amo" ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden' }}>
        {burst.map(h => (
          <span key={h.id} style={{
            position: 'absolute', left: `${h.left}%`, bottom: '10vh',
            fontSize: `${h.size}px`,
            animation: `loveRise 2.2s ease-out ${h.delay}s forwards`, opacity: 0,
          }}>{h.emoji}</span>
        ))}
      </div>

      {/* Música via player oficial do YouTube — monta após o toque na intro (gesto libera o autoplay) */}
      {usaYoutube && fase !== 'intro' && (
        <iframe
          ref={ytRef}
          title="Nossa música 🎵"
          src={`https://www.youtube.com/embed/${LOVE_CONFIG.youtubeId}?autoplay=1&playsinline=1&loop=1&playlist=${LOVE_CONFIG.youtubeId}&enablejsapi=1&rel=0&modestbranding=1`}
          allow="autoplay; encrypted-media"
          style={{
            position: 'absolute', right: '12px', bottom: '118px', zIndex: 8,
            width: '200px', height: '112px', border: 'none', borderRadius: '12px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.55)', opacity: 0.95,
          }}
        />
      )}

      {/* Música mp3 local (fallback quando youtubeId está vazio) */}
      {!usaYoutube && (
        <audio ref={audioRef} src={LOVE_CONFIG.musica} loop
          onCanPlayThrough={() => setTemMusica(true)}
          onError={() => setTemMusica(false)} />
      )}

      <style>{`
        @keyframes loveFill   { from { width: 0 } to { width: 100% } }
        @keyframes loveFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes loveZoom   { from { transform: scale(1) } to { transform: scale(1.06) } }
        @keyframes loveBeat   { 0%,100% { transform: scale(1) } 25% { transform: scale(1.22) } 50% { transform: scale(1.04) } 75% { transform: scale(1.18) } }
        @keyframes loveFall   {
          0%   { transform: translateY(0) translateX(0) rotate(-8deg); }
          50%  { transform: translateY(60vh) translateX(18px) rotate(10deg); }
          100% { transform: translateY(122vh) translateX(-12px) rotate(-6deg); }
        }
        @keyframes loveRise {
          0%   { transform: translateY(0) scale(.5); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translateY(-68vh) scale(1.3); opacity: 0; }
        }
        @keyframes loveSlideUp { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
