import React, { useState } from 'react';
import { StarRating } from './StarRating';
import { PhotoUpload } from './PhotoUpload';

export function ResenhaModal({ livro, DA, GRAD_BTN, onSalvar, onFechar }) {
  const [resenha, setResenha]         = useState(livro.resenha || '');
  const [nota, setNota]               = useState(livro.nota || 0);
  const [fotoUsuario, setFotoUsuario] = useState(livro.fotoUsuario || null);
  const [abaFoto, setAbaFoto]         = useState(false); // toggle seção de foto

  const imgExibida = livro.fotoUsuario || livro.capa;
  const placeholder = `https://via.placeholder.com/70x100/4A2E1E/F5F0E0?text=📚`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(44,26,20,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
      backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
    }} onClick={onFechar}>
      <div style={{
        background: 'white', borderRadius: '22px', padding: '32px',
        maxWidth: '540px', width: '100%',
        boxShadow: `0 28px 72px rgba(44,26,20,0.38)`,
        border: `1px solid ${DA.warmBeige}`,
        maxHeight: '90vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', gap: '18px', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img
              src={imgExibida || placeholder}
              alt={livro.titulo}
              style={{ width:'72px', height:'102px', objectFit:'cover', borderRadius:'10px', boxShadow:'0 4px 14px rgba(0,0,0,0.2)', display:'block' }}
            />
            {livro.fotoUsuario && (
              <div style={{
                position:'absolute', bottom:'-6px', right:'-6px',
                background: DA.copper, borderRadius:'50%', width:'22px', height:'22px',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px',
                border:`2px solid white`, boxShadow:'0 2px 6px rgba(0,0,0,0.2)',
              }}>📷</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontWeight:'900', fontSize:'18px', color: DA.espresso, marginBottom:'4px', lineHeight:1.3 }}>{livro.titulo}</h3>
            <p style={{ color: DA.warmBeige, fontSize:'13px', marginBottom:'14px' }}>{livro.autor}</p>
            <p style={{ fontSize:'12px', color: DA.walnut, marginBottom:'8px', fontWeight:'700' }}>Sua nota:</p>
            <StarRating rating={nota} setRating={setNota} interactive={true} DA={DA} />
          </div>
          <button onClick={onFechar} style={{
            background:'none', border:'none', cursor:'pointer', fontSize:'20px',
            color: DA.warmBeige, alignSelf:'flex-start', padding:'0 0 0 4px',
            lineHeight:1,
          }}>✕</button>
        </div>

        {/* Toggle seção de foto */}
        <button type="button" onClick={() => setAbaFoto(v => !v)} style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          background: abaFoto ? `${DA.copper}18` : DA.cream,
          border: `2px solid ${abaFoto ? DA.copper : DA.warmBeige}`,
          borderRadius: '12px', padding: '11px 14px', cursor: 'pointer',
          marginBottom: '18px', transition: 'all .2s',
        }}>
          <span style={{ fontSize:'18px' }}>📷</span>
          <div style={{ textAlign:'left', flex:1 }}>
            <p style={{ fontWeight:'800', fontSize:'13px', color: DA.espresso, marginBottom:'1px' }}>
              {fotoUsuario ? 'Minha foto do livro' : 'Adicionar minha foto'}
            </p>
            <p style={{ fontSize:'11px', color: DA.warmBeige }}>
              {fotoUsuario ? 'Foto salva · clique para alterar' : 'Registre o livro físico que você tem'}
            </p>
          </div>
          {fotoUsuario && (
            <img src={fotoUsuario} alt="thumb"
              style={{ width:'36px', height:'50px', objectFit:'cover', borderRadius:'5px', flexShrink:0 }} />
          )}
          <span style={{ color: DA.copper, fontSize:'16px', flexShrink:0 }}>{abaFoto ? '▲' : '▼'}</span>
        </button>

        {abaFoto && (
          <div style={{ marginBottom: '22px' }}>
            <PhotoUpload value={fotoUsuario} onChange={setFotoUsuario} DA={DA} label="Foto do seu exemplar" />
          </div>
        )}

        {/* Resenha */}
        <div style={{ marginBottom: '22px' }}>
          <label style={{ display:'block', fontWeight:'800', fontSize:'14px', color: DA.espresso, marginBottom:'8px' }}>
            ✏️ Sua resenha
          </label>
          <textarea
            value={resenha}
            onChange={e => setResenha(e.target.value)}
            rows={5}
            placeholder="O que você achou do livro? Conte sua experiência de leitura..."
            style={{
              width:'100%', padding:'14px', borderRadius:'12px',
              border: `2px solid ${DA.warmBeige}`, fontSize:'14px',
              resize:'vertical', outline:'none', fontFamily:'inherit',
              boxSizing:'border-box', color: DA.espresso, lineHeight:1.6,
              transition:'border-color .2s',
            }}
            onFocus={e => e.target.style.borderColor = DA.copper}
            onBlur={e => e.target.style.borderColor = DA.warmBeige}
          />
          <p style={{ fontSize:'11px', color: DA.warmBeige, marginTop:'4px', textAlign:'right', fontWeight:'600' }}>
            {resenha.length} caracteres
          </p>
        </div>

        {/* Botões */}
        <div style={{ display:'flex', gap:'12px' }}>
          <button onClick={onFechar} style={{
            flex:1, padding:'13px', borderRadius:'12px',
            border: `2px solid ${DA.warmBeige}`, background:'white',
            color: DA.walnut, fontWeight:'700', cursor:'pointer', fontSize:'14px',
            transition:'border-color .2s',
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = DA.walnut}
            onMouseLeave={e => e.currentTarget.style.borderColor = DA.warmBeige}>
            Cancelar
          </button>
          <button onClick={() => onSalvar(resenha, nota, fotoUsuario)} style={{
            flex:1, padding:'13px', borderRadius:'10px', border:'none',
            background: GRAD_BTN, color: DA.cream, fontWeight:'800', cursor:'pointer',
            fontSize:'14px', boxShadow:`0 4px 14px rgba(107,30,42,0.35)`,
            transition:'transform .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            💾 Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
