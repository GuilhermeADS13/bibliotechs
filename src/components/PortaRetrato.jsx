import React, { useEffect, useState } from 'react';
import { FOTOS } from '../fotosFundo';

const TROCA_MS = 7000;

const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * As fotos inteiras e nítidas, num porta-retrato no Início.
 *
 * Antes elas só existiam como fundo de tela: retratos em pé esticados para
 * cobrir uma tela larga, o que mostrava um recorte gigante do rosto, cortado e
 * borrado, atrás dos painéis. Aqui cada foto aparece em proporção de retrato,
 * com o rosto enquadrado — e um clique abre em tela cheia.
 */
export function PortaRetrato({ onAbrir }) {
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    if (prefereMenosMovimento()) return undefined;
    const t = setInterval(() => setAtual(i => (i + 1) % FOTOS.length), TROCA_MS);
    return () => clearInterval(t);
  }, [atual]); // escolher uma foto reinicia a contagem

  return (
    <figure className="porta-retrato" style={{
      margin: 0, padding: '10px 10px 12px', background: '#FBF7EE',
      borderRadius: '6px', boxShadow: '0 14px 40px rgba(20,10,6,0.35), 0 2px 6px rgba(20,10,6,0.2)',
      display: 'flex', flexDirection: 'column', gap: '10px',
    }}>
      <button
        type="button"
        onClick={() => onAbrir?.(FOTOS[atual])}
        aria-label="Ver a foto em tela cheia"
        style={{
          position: 'relative', display: 'block', width: '100%', aspectRatio: '4 / 5',
          padding: 0, border: 'none', borderRadius: '3px', overflow: 'hidden',
          cursor: 'zoom-in', background: '#2C1A14',
        }}
      >
        {FOTOS.map((f, i) => (
          <img
            key={f.src}
            src={f.src}
            alt=""
            aria-hidden={i !== atual}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: f.foco,
              // Aparar a faixa do topo ampliando 5% a partir de baixo.
              transform: f.aparar ? 'scale(1.05)' : 'none',
              transformOrigin: '50% 100%',
              opacity: i === atual ? 1 : 0,
              transition: 'opacity 1.2s ease',
            }}
          />
        ))}
      </button>

      <div role="group" aria-label="Escolher foto" style={{ display: 'flex', justifyContent: 'center', gap: '2px', marginTop: '-4px' }}>
        {FOTOS.map((f, i) => (
          <button
            key={f.src}
            type="button"
            onClick={() => setAtual(i)}
            aria-label={`Foto ${i + 1} de ${FOTOS.length}`}
            aria-pressed={i === atual}
            style={{
              width: '24px', height: '24px', padding: 0, border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span aria-hidden="true" style={{
              width: '8px', height: '8px', borderRadius: '50%',
              border: '1px solid #8A6A4A', background: i === atual ? '#8A6A4A' : 'transparent',
            }} />
          </button>
        ))}
      </div>
    </figure>
  );
}
