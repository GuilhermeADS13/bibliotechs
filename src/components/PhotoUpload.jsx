import React, { useState, useRef, useCallback } from 'react';

const compressImage = (file, maxDim = 600, quality = 0.82) =>
  new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

export function PhotoUpload({ value, onChange, DA, label = 'Sua foto do livro' }) {
  const [drag, setDrag]     = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef            = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setLoading(true);
    try {
      const b64 = await compressImage(file);
      onChange(b64);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e) => { e.preventDefault(); setDrag(true); };
  const onDragLeave = () => setDrag(false);
  const onInputChange = (e) => handleFile(e.target.files?.[0]);

  const zone = {
    border: `2px dashed ${drag ? DA.copper : DA.warmBeige}`,
    borderRadius: '14px',
    background: drag ? `${DA.copper}0f` : `${DA.cream}`,
    transition: 'all .2s',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '22px 16px',
    textAlign: 'center',
  };

  return (
    <div>
      <label style={{ display:'block', fontWeight:'800', fontSize:'13px', color: DA.espresso, marginBottom:'8px' }}>
        📷 {label}
        <span style={{ fontWeight:'500', color: DA.warmBeige, fontSize:'11px', marginLeft:'6px' }}>(opcional)</span>
      </label>

      {value ? (
        <div style={{ position:'relative', display:'inline-block' }}>
          <img src={value} alt="Sua foto do livro"
            style={{ height:'160px', maxWidth:'100%', borderRadius:'12px', objectFit:'cover',
              boxShadow:`0 6px 20px rgba(44,26,20,0.2)`, display:'block' }} />
          <div style={{ position:'absolute', inset:0, borderRadius:'12px', background:'rgba(44,26,20,0)', transition:'background .2s' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(44,26,20,0.35)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(44,26,20,0)'}>
          </div>
          <div style={{ position:'absolute', top:'8px', right:'8px', display:'flex', gap:'6px' }}>
            <button type="button" onClick={() => inputRef.current?.click()}
              title="Trocar foto"
              style={{ background:'rgba(245,240,224,0.92)', border:'none', borderRadius:'8px',
                padding:'5px 8px', cursor:'pointer', fontSize:'14px', fontWeight:'700',
                color: DA.walnut, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
              🔄
            </button>
            <button type="button" onClick={() => onChange(null)}
              title="Remover foto"
              style={{ background:'rgba(245,240,224,0.92)', border:'none', borderRadius:'8px',
                padding:'5px 8px', cursor:'pointer', fontSize:'14px',
                color: DA.oxblood, boxShadow:'0 2px 8px rgba(0,0,0,0.2)' }}>
              ✕
            </button>
          </div>
          <div style={{ position:'absolute', bottom:'8px', left:'8px',
            background:'rgba(44,26,20,0.75)', borderRadius:'6px', padding:'3px 8px',
            fontSize:'10px', fontWeight:'800', color: DA.cream, letterSpacing:'0.5px' }}>
            📷 SUA FOTO
          </div>
        </div>
      ) : (
        <div style={zone}
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}>
          {loading ? (
            <>
              <div style={{ fontSize:'28px', animation:'spin 1s linear infinite' }}>⏳</div>
              <p style={{ fontSize:'13px', color: DA.walnut, fontWeight:'600' }}>Processando imagem...</p>
            </>
          ) : (
            <>
              <div style={{ fontSize:'32px', opacity: drag ? 1 : 0.7, transition:'all .2s',
                transform: drag ? 'scale(1.15)' : 'scale(1)' }}>📷</div>
              <p style={{ fontSize:'13px', fontWeight:'700', color: DA.walnut }}>
                {drag ? 'Solte aqui!' : 'Arraste ou clique para adicionar'}
              </p>
              <p style={{ fontSize:'11px', color: DA.warmBeige }}>JPG, PNG ou WEBP · A imagem será comprimida</p>
            </>
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }}
        onChange={onInputChange} />
    </div>
  );
}
