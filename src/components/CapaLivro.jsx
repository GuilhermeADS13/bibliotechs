import React, { forwardRef } from 'react';

// Cores de tecido de encadernação, na família da paleta do app. A cor de cada
// livro sai do título, então o mesmo livro tem sempre a mesma capa — na
// estante, no destaque e nas recomendações.
const TECIDOS = [
  '#6B1E2A', // vinho
  '#1F4D3A', // verde-garrafa
  '#1E2A44', // azul-tinta
  '#8A5E1A', // ocre
  '#4A2340', // ameixa
  '#24555A', // petróleo
  '#5A3A22', // nogueira
];
const PAPEL = '#F3E9D2';

// FNV-1a com uma mistura final: o hash simples (h*31) concentrava títulos
// curtos na mesma cor — "O Hobbit" e "Duna" saíam idênticos lado a lado.
export function corDaCapa(titulo) {
  let h = 0x811c9dc5;
  for (const c of String(titulo || '')) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return TECIDOS[(h >>> 0) % TECIDOS.length];
}

// Abaixo disto o título não cabe legível: a capa mostra só a inicial.
const LARGURA_MINIMA_TITULO = 70;

/**
 * Capa do livro: a imagem quando existe; sem ela, uma capa tipográfica de
 * livro encadernado — lombada, moldura gravada e título composto em Literata.
 *
 * Antes, livro sem capa virava um bloco marrom com um emoji de livros, e numa
 * estante com poucas capas a página inteira era o mesmo bloco repetido.
 *
 * Aceita `ref` porque a foto do exemplar carrega sob demanda (useFotos): o
 * observador precisa do elemento mesmo enquanto a capa é a tipográfica.
 */
export const CapaLivro = forwardRef(function CapaLivro(
  { src, titulo = '', autor = '', largura, style = {}, className, onClick },
  ref
) {
  if (src) {
    return <img ref={ref} src={src} alt={titulo} loading="lazy" className={className} onClick={onClick} style={style} />;
  }

  const fundo = corDaCapa(titulo);
  const pequena = typeof largura === 'number' && largura < LARGURA_MINIMA_TITULO;
  const autorPrincipal = String(autor || '').split(',')[0].trim();

  return (
    <div
      ref={ref}
      role="img"
      aria-label={titulo}
      className={['capa-tipografica', className].filter(Boolean).join(' ')}
      onClick={onClick}
      style={{
        ...style,
        // Lombada: faixa mais escura com um vinco de luz, como a dobra do tecido.
        backgroundColor: fundo,
        backgroundImage: [
          'linear-gradient(90deg, rgba(0,0,0,.38) 0, rgba(0,0,0,.16) 5%, rgba(255,255,255,.10) 6.5%, rgba(0,0,0,0) 9%)',
          'radial-gradient(120% 90% at 70% 20%, rgba(255,255,255,.08), rgba(0,0,0,.18))',
        ].join(', '),
        color: PAPEL,
        position: 'relative',
        overflow: 'hidden',
        containerType: 'inline-size',
      }}
    >
      {/* Moldura gravada a seco, recuada da lombada. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: '7% 7% 7% 13%',
        border: '1px solid rgba(217,178,111,.55)',
        borderRadius: '2px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: pequena ? 'center' : 'space-between',
        padding: pequena ? 0 : '14cqw 8cqw 10cqw',
        textAlign: 'center',
      }}>
        {pequena ? (
          <span style={{ fontFamily: 'var(--fonte-livro)', fontWeight: 600, fontSize: '46cqw', lineHeight: 1 }}>
            {titulo.trim().charAt(0).toUpperCase() || '?'}
          </span>
        ) : (
          <>
            <span style={{
              fontFamily: 'var(--fonte-livro)', fontWeight: 600,
              fontSize: titulo.length > 28 ? '9.5cqw' : '11.5cqw',
              lineHeight: 1.18, letterSpacing: '-0.01em',
              display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              textWrap: 'balance', overflowWrap: 'anywhere',
            }}>
              {titulo}
            </span>
            <span aria-hidden="true" style={{ width: '18cqw', height: '1px', background: 'rgba(217,178,111,.7)' }} />
            {autorPrincipal && (
              <span style={{
                fontFamily: 'var(--fonte-livro)', fontStyle: 'italic', fontWeight: 400,
                fontSize: '7.5cqw', lineHeight: 1.25, opacity: 0.88,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {autorPrincipal}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
});
