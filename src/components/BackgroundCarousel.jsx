import { useState, useEffect, useRef } from 'react';

const IMAGES = [
  '/carousel/img1.jpg',
  '/carousel/img2.jpg',
  '/carousel/img3.jpg',
];

/*
  Técnica profissional de crossfade:
  - Duas camadas sempre montadas (A e B)
  - A camada "ativa" mostra a imagem atual (opacity: 1)
  - A camada "inativa" fica com opacity: 0 e já carrega a próxima imagem
  - Na troca: a inativa vira ativa suavemente (crossfade real sem piscar)
  - Ken Burns separado por camada, sem reiniciar na troca
*/

const DISPLAY   = 9000;   // 9s exibindo cada imagem
const FADE      = 2500;   // 2.5s de dissolve suave

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
  // Qual "slot" (A=0 ou B=1) está ativo agora
  const [activeSlot, setActiveSlot] = useState(0);
  // Imagem em cada slot
  const [slots, setSlots] = useState([IMAGES[0], IMAGES[1]]);
  const idxRef = useRef(0); // índice global da imagem atual

  useEffect(() => {
    const tick = () => {
      // Calcula o próximo índice
      const nextIdx = (idxRef.current + 1) % IMAGES.length;
      idxRef.current = nextIdx;

      // Slot que vai ENTRAR (o inativo)
      const nextSlot = activeSlot === 0 ? 1 : 0;

      // Coloca a próxima imagem no slot inativo (ele já está invisible)
      setSlots(prev => {
        const s = [...prev];
        s[nextSlot] = IMAGES[nextIdx];
        return s;
      });

      // Pequeno delay para garantir que a imagem foi assignada antes de trocar opacity
      setTimeout(() => {
        setActiveSlot(nextSlot);
      }, 50);
    };

    const timer = setInterval(tick, DISPLAY + FADE);
    return () => clearInterval(timer);
  }, [activeSlot]);

  // Ken Burns: cada slot tem uma animação diferente para variar o movimento
  const kbAnimations = [
    'kb-zoom-in-left',
    'kb-zoom-in-right',
  ];

  return (
    <>
      {/* Camada A */}
      <div style={{
        ...layerBase,
        backgroundImage: `url(${slots[0]})`,
        opacity: activeSlot === 0 ? 1 : 0,
        transition: `opacity ${FADE}ms cubic-bezier(0.45, 0, 0.55, 1)`,
        animation: `${kbAnimations[0]} ${DISPLAY + FADE}ms ease-in-out infinite`,
      }} />

      {/* Camada B */}
      <div style={{
        ...layerBase,
        backgroundImage: `url(${slots[1]})`,
        opacity: activeSlot === 1 ? 1 : 0,
        transition: `opacity ${FADE}ms cubic-bezier(0.45, 0, 0.55, 1)`,
        animation: `${kbAnimations[1]} ${DISPLAY + FADE}ms ease-in-out infinite`,
      }} />

      {/* Overlay em vinheta — escurece as bordas, centro fica respirando */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: `
          radial-gradient(
            ellipse at center,
            rgba(44,26,20,0.10) 0%,
            rgba(44,26,20,0.28) 55%,
            rgba(44,26,20,0.58) 100%
          )
        `,
        pointerEvents: 'none',
      }} />

      {/* Faixa escura no topo para o header legível */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: '90px',
        zIndex: -1,
        background: 'linear-gradient(to bottom, rgba(44,26,20,0.70) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Faixa escura em baixo */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: '120px',
        zIndex: -1,
        background: 'linear-gradient(to top, rgba(44,26,20,0.65) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      <style>{`
        /* Ken Burns A: zoom in vindo da esquerda */
        @keyframes kb-zoom-in-left {
          0%   { transform: scale(1.00) translate(0px,   0px); }
          100% { transform: scale(1.08) translate(-18px, -6px); }
        }
        /* Ken Burns B: zoom in vindo da direita */
        @keyframes kb-zoom-in-right {
          0%   { transform: scale(1.04) translate(14px,  4px); }
          100% { transform: scale(1.00) translate(0px,   0px); }
        }
      `}</style>
    </>
  );
}
