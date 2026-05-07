import { useState, useEffect, useRef } from 'react';

const IMAGES = [
  '/carousel/img1.jpg',
  '/carousel/img2.jpg',
  '/carousel/img3.jpg',
];

const DISPLAY = 9000;  // 9s por imagem
const FADE    = 2500;  // 2.5s de dissolve

const layerBase = {
  position: 'fixed',
  inset: 0,
  zIndex: -2,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  willChange: 'opacity, transform',
};

export function BackgroundCarousel() {
  const [activeSlot, setActiveSlot] = useState(0);
  const [slots, setSlots]           = useState([IMAGES[0], IMAGES[1]]);
  const idxRef                      = useRef(0);

  useEffect(() => {
    const tick = () => {
      const nextIdx  = (idxRef.current + 1) % IMAGES.length;
      idxRef.current = nextIdx;
      const nextSlot = activeSlot === 0 ? 1 : 0;

      setSlots(prev => {
        const s = [...prev];
        s[nextSlot] = IMAGES[nextIdx];
        return s;
      });

      setTimeout(() => setActiveSlot(nextSlot), 80);
    };

    const timer = setInterval(tick, DISPLAY + FADE);
    return () => clearInterval(timer);
  }, [activeSlot]);

  return (
    <>
      {/* Camada A */}
      <div style={{
        ...layerBase,
        backgroundImage: `url(${slots[0]})`,
        opacity: activeSlot === 0 ? 1 : 0,
        transition: `opacity ${FADE}ms cubic-bezier(0.45, 0, 0.55, 1)`,
        animation: `kb-a ${DISPLAY + FADE}ms ease-in-out infinite`,
      }} />

      {/* Camada B */}
      <div style={{
        ...layerBase,
        backgroundImage: `url(${slots[1]})`,
        opacity: activeSlot === 1 ? 1 : 0,
        transition: `opacity ${FADE}ms cubic-bezier(0.45, 0, 0.55, 1)`,
        animation: `kb-b ${DISPLAY + FADE}ms ease-in-out infinite`,
      }} />

      {/* ── Overlay principal: escurece o fundo sem matar a imagem ── */}
      {/* Camada base uniforme */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
        background: 'rgba(20, 10, 6, 0.48)',
      }} />

      {/* Vinheta radial — borda mais escura, centro respira */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
        background: `radial-gradient(
          ellipse 80% 70% at 50% 50%,
          transparent            0%,
          rgba(20,10,6, 0.25)  60%,
          rgba(20,10,6, 0.55) 100%
        )`,
      }} />

      {/* Gradiente topo → garante header legível */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '110px', zIndex: -1, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(20,10,6,0.80) 0%, transparent 100%)',
      }} />

      {/* Gradiente base → ancora o rodapé */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: '140px', zIndex: -1, pointerEvents: 'none',
        background: 'linear-gradient(to top, rgba(20,10,6,0.75) 0%, transparent 100%)',
      }} />

      <style>{`
        @keyframes kb-a {
          0%   { transform: scale(1.00) translate(0px, 0px);    }
          100% { transform: scale(1.07) translate(-16px, -5px); }
        }
        @keyframes kb-b {
          0%   { transform: scale(1.05) translate(12px, 3px); }
          100% { transform: scale(1.00) translate(0px,  0px); }
        }
      `}</style>
    </>
  );
}
