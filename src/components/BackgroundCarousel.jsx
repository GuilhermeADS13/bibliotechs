import { useState, useEffect } from 'react';
import { FOTOS } from '../fotosFundo';

const DISPLAY = 9000;  // 9s por imagem
const FADE    = 2500;  // 2.5s de dissolve

/**
 * Fundo da página: as fotos como luz de cor, bem desfocadas.
 *
 * Antes eram mostradas nítidas com `cover` e zoom animado. Como são retratos
 * em pé numa tela larga, o `cover` ampliava e cortava — o que aparecia atrás
 * dos painéis era um pedaço gigante do rosto. Para ver as fotos de verdade
 * existe o porta-retrato do Início (PortaRetrato.jsx); aqui elas só dão o tom.
 */
export function BackgroundCarousel() {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setAtual(i => (i + 1) % FOTOS.length), DISPLAY + FADE);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {FOTOS.map((f, i) => (
        <div key={f.src} aria-hidden="true" className="fundo-foto" style={{
          position: 'fixed',
          // Sangra além da tela: o desfoque apaga as bordas da imagem, e sem
          // essa sobra apareceria um contorno claro nos cantos.
          inset: '-60px',
          zIndex: -2,
          backgroundImage: `url(${f.src})`,
          backgroundSize: 'cover',
          backgroundPosition: f.foco,
          filter: 'blur(36px) saturate(1.15) brightness(0.62)',
          opacity: i === atual ? 1 : 0,
          transition: `opacity ${FADE}ms ease`,
        }} />
      ))}

      {/* Gradiente topo → garante header legível */}
      <div aria-hidden="true" style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '110px', zIndex: -1, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(44,26,20,0.88) 0%, transparent 100%)',
      }} />

      {/* Gradiente base → ancora o rodapé */}
      <div aria-hidden="true" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '140px', zIndex: -1, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(44,26,20,0.78) 0%, transparent 100%)',
      }} />

      <style>{`
        /* Quem pede menos movimento no sistema vê a troca sem dissolve. */
        @media (prefers-reduced-motion: reduce) {
          .fundo-foto { transition: none !important; }
        }
      `}</style>
    </>
  );
}
