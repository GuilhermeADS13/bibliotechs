import { useState, useEffect } from 'react';

const IMAGES = [
  '/carousel/img1.jpg',
  '/carousel/img2.jpg',
  '/carousel/img3.jpg',
];

export function BackgroundCarousel() {
  const [current, setCurrent] = useState(0);
  const [next, setNext]       = useState(1);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Inicia a transição
      setTransitioning(true);

      // Após o fade terminar, avança o índice
      setTimeout(() => {
        setCurrent(c => (c + 1) % IMAGES.length);
        setNext(c => (c + 1) % IMAGES.length);
        setTransitioning(false);
      }, 1200); // duração do crossfade
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const base = {
    position: 'fixed',
    inset: 0,
    zIndex: -1,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };

  return (
    <>
      {/* Camada de baixo: imagem atual */}
      <div style={{
        ...base,
        backgroundImage: `url(${IMAGES[current]})`,
        transition: 'opacity 1.2s ease-in-out',
        opacity: transitioning ? 0 : 1,
      }} />

      {/* Camada de cima: próxima imagem, aparece durante a transição */}
      <div style={{
        ...base,
        backgroundImage: `url(${IMAGES[next]})`,
        transition: 'opacity 1.2s ease-in-out',
        opacity: transitioning ? 1 : 0,
      }} />

      {/* Overlay escuro para manter legibilidade do conteúdo */}
      <div style={{
        ...base,
        background: 'rgba(44, 26, 20, 0.72)',
        backdropFilter: 'blur(1px)',
        WebkitBackdropFilter: 'blur(1px)',
      }} />
    </>
  );
}
