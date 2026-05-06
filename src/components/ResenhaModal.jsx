import React, { useState } from 'react';
import { StarRating } from './StarRating';

export function ResenhaModal({ livro, DA, GRAD_BTN, onSalvar, onFechar }) {
  const [resenha, setResenha] = useState(livro.resenha || '');
  const [nota, setNota]       = useState(livro.nota || 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(44,26,20,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
    }} onClick={onFechar}>
      <div style={{
        background: 'white', borderRadius: '22px', padding: '36px',
        maxWidth: '520px', width: '100%', boxShadow: `0 24px 64px rgba(44,26,20,0.4)`,
        border: `1px solid ${DA.warmBeige}`
      }} onClick={e => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', gap: '18px', marginBottom: '26px' }}>
          <img src={livro.capa || `https://via.placeholder.com/70x100/4A2E1E/F5F0E0?text=📚`} alt={livro.titulo}
            style={{ width: '72px', height: '102px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontWeight: '900', fontSize: '18px', color: DA.espresso, marginBottom: '4px', lineHeight: 1.3 }}>{livro.titulo}</h3>
            <p style={{ color: DA.warmBeige, fontSize: '14px', marginBottom: '14px' }}>{livro.autor}</p>
            <p style={{ fontSize: '12px', color: DA.walnut, marginBottom: '8px', fontWeight: '700' }}>Sua nota:</p>
            <StarRating rating={nota} setRating={setNota} interactive={true} DA={DA} />
          </div>
        </div>

        {/* Textarea resenha */}
        <div style={{ marginBottom: '22px' }}>
          <label style={{ display: 'block', fontWeight: '800', fontSize: '14px', color: DA.espresso, marginBottom: '8px' }}>
            ✏️ Sua resenha
          </label>
          <textarea value={resenha} onChange={e => setResenha(e.target.value)} rows={5}
            placeholder="O que você achou do livro? Conte sua experiência de leitura..."
            style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: `2px solid ${DA.warmBeige}`,
              fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit',
              boxSizing: 'border-box', color: DA.espresso, lineHeight: 1.6
            }}
            onFocus={e => e.target.style.borderColor = DA.copper}
            onBlur={e => e.target.style.borderColor = DA.warmBeige} />
          <p style={{ fontSize: '11px', color: DA.warmBeige, marginTop: '4px', textAlign: 'right', fontWeight: '600' }}>{resenha.length} caracteres</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onFechar} style={{
            flex: 1, padding: '13px', borderRadius: '12px', border: `2px solid ${DA.warmBeige}`,
            background: 'white', color: DA.walnut, fontWeight: '700', cursor: 'pointer', fontSize: '14px'
          }}>Cancelar</button>
          <button onClick={() => onSalvar(resenha, nota)} style={{
            flex: 1, padding: '13px', borderRadius: '12px', border: 'none',
            background: GRAD_BTN, color: DA.cream, fontWeight: '800', cursor: 'pointer', fontSize: '14px',
            boxShadow: `0 4px 14px rgba(107,30,42,0.35)`
          }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}
