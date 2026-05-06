import React, { useState } from 'react';
import { StarRating } from './StarRating';

const STATUS_OPTS = [
  { value: 'lendo',     label: '📖 Lendo' },
  { value: 'lido',      label: '✅ Lido' },
  { value: 'quero-ler', label: '⏳ Quero Ler' },
  { value: 'abandonei', label: '❌ Abandonei' },
];

export function BookCard({ livro, DA, GRAD_BTN, onAtualizar, onRemover, onResenha }) {
  const [hover, setHover]       = useState(false);
  const [editando, setEditando] = useState(false);

  const STATUS_STYLE = {
    'lendo':     { bg: `${DA.forestGreen}22`, color: DA.forestGreen, border: DA.forestGreen },
    'lido':      { bg: `${DA.teal}22`,        color: DA.teal,        border: DA.teal },
    'quero-ler': { bg: `${DA.mustard}22`,     color: DA.copper,      border: DA.mustard },
    'abandonei': { bg: `${DA.oxblood}22`,     color: DA.oxblood,     border: DA.oxblood },
  };
  const cor = STATUS_STYLE[livro.status] || STATUS_STYLE['quero-ler'];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setEditando(false); }}
      style={{
        background: 'white', borderRadius: '14px', overflow: 'hidden',
        boxShadow: hover ? `0 12px 32px rgba(44,26,20,0.22)` : `0 2px 10px rgba(44,26,20,0.08)`,
        transition: 'all .22s ease', transform: hover ? 'translateY(-5px)' : 'none',
        cursor: 'pointer', position: 'relative', border: `1px solid ${DA.warmBeige}`,
      }}>

      <div style={{ position: 'relative' }}>
        <img
          src={livro.capa || `https://via.placeholder.com/160x220/4A2E1E/F5F0E0?text=📚`}
          alt={livro.titulo}
          style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }}
        />
        {/* Badge status */}
        <div style={{
          position: 'absolute', top: '8px', left: '8px',
          background: cor.bg, color: cor.color, border: `1px solid ${cor.border}`,
          borderRadius: '6px', fontSize: '10px', fontWeight: '800', padding: '2px 7px',
          backdropFilter: 'blur(4px)'
        }}>
          {STATUS_OPTS.find(s => s.value === livro.status)?.label}
        </div>

        {/* Overlay hover */}
        {hover && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(180deg, ${DA.espresso}cc, ${DA.oxblood}dd)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}>
            <button onClick={onResenha} style={{
              background: GRAD_BTN, color: DA.cream, border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', width: '136px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>✏️ Resenha/Nota</button>
            <button onClick={() => setEditando(v => !v)} style={{
              background: DA.cream, color: DA.espresso, border: 'none', borderRadius: '8px',
              padding: '8px 16px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', width: '136px'
            }}>🔄 Mudar Status</button>
            <button onClick={onRemover} style={{
              background: 'transparent', color: DA.mustard, border: `1px solid ${DA.mustard}`,
              borderRadius: '8px', padding: '8px 16px', fontWeight: '700', fontSize: '12px', cursor: 'pointer', width: '136px'
            }}>🗑️ Remover</button>
          </div>
        )}

        {editando && hover && (
          <div style={{ position: 'absolute', bottom: '8px', left: '8px', right: '8px' }}>
            <select value={livro.status}
              onChange={e => { onAtualizar({ status: e.target.value }); setEditando(false); }}
              style={{ width: '100%', padding: '7px', borderRadius: '7px', border: 'none', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}>
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ padding: '12px' }}>
        <h4 style={{ fontWeight: '800', fontSize: '13px', color: DA.espresso, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {livro.titulo}
        </h4>
        <p style={{ fontSize: '11px', color: DA.warmBeige, marginBottom: '7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {livro.autor}
        </p>
        <StarRating rating={livro.nota} DA={DA} />
        {livro.resenha && (
          <p style={{ fontSize: '10px', color: DA.walnut, marginTop: '7px', fontStyle: 'italic',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            "{livro.resenha}"
          </p>
        )}
      </div>
    </div>
  );
}
