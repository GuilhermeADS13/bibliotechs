import { useState, useEffect } from 'react';

const IMAGES = [
  '/carousel/img1.jpg',
  '/carousel/img2.jpg',
  '/carousel/img3.jpg',
];

export function BackgroundCarousel() {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true); // controla o fade da imagem atual

  useEffect(() => {
    const DISPLAY_TIME  = 7000;  // 7s exibindo a imagem
    const FADE_DURATION = 2000;  // 2s de crossfade suave

    const timer = setInterval(() => {
      // 1. Inicia fade out suave
      setVisible(false);

      // 2. Após o fade terminar, troca a imagem e faz fade in
      setTimeout(() => {
        setIdx(i => (i + 1) % IMAGES.length);
        setVisible(true);
      }, FADE_DURATION);

    }, DISPLAY_TIME + FADE_DURATION);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Imagem de fundo com fade suave */}
      <div
        key={idx}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -2,
          backgroundImage: `url(${IMAGES[idx]})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: visible ? 1 : 0,
          transition: 'opacity 2s ease-in-out',
          // Ken Burns: zoom lento e suave
          animation: 'kenburns 9s ease-in-out infinite alternate',
        }}
      />

      {/* Overlay com gradiente Deep Autumn — opacidade equilibrada */}
      {/* Escurece levemente a borda e mantém centro visível */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        background: `
          linear-gradient(
            to bottom,
            rgba(44, 26, 20, 0.55) 0%,
            rgba(44, 26, 20, 0.30) 35%,
            rgba(44, 26, 20, 0.30) 65%,
            rgba(44, 26, 20, 0.60) 100%
          )
        `,
      }} />

      {/* CSS do efeito Ken Burns */}
      <style>{`
        @keyframes kenburns {
          from { transform: scale(1.00) translateX(0px); }
          to   { transform: scale(1.06) translateX(-12px); }
        }
      `}</style>
    </>
  );
}
