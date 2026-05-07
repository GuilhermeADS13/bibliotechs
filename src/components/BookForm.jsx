import React, { useState } from 'react';
import { StarRating } from './StarRating';
import { PhotoUpload } from './PhotoUpload';

export function BookForm({ onSave, DA, GRAD_BTN }) {
  const [loading, setLoading]     = useState(false);
  const [nota, setNota]           = useState(0);
  const [sugestoes, setSugestoes] = useState([]);
  const [fotoUsuario, setFotoUsuario] = useState(null);
  const [formData, setFormData]   = useState({
    titulo: '', autor: '', genero: '', paginas: '',
    dataTermino: '', status: 'quero-ler', capa: '', resenha: ''
  });

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  const buscar = async () => {
    if (formData.titulo.length < 2) return;
    setLoading(true);
    try {
      const res  = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(formData.titulo)}&maxResults=5`);
      const data = await res.json();
      if (data.items?.length) {
        setSugestoes(data.items.map(item => ({
          titulo:  item.volumeInfo.title,
          autor:   item.volumeInfo.authors?.join(', ') || 'Desconhecido',
          genero:  item.volumeInfo.categories?.[0] || '',
          paginas: item.volumeInfo.pageCount || '',
          capa:    item.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || ''
        })));
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const selecionar = (s) => { setFormData(p => ({ ...p, ...s })); setSugestoes([]); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.titulo.trim()) return;
    onSave({ ...formData, nota, fotoUsuario, id: Date.now() });
    setFormData({ titulo: '', autor: '', genero: '', paginas: '', dataTermino: '', status: 'quero-ler', capa: '', resenha: '' });
    setNota(0);
    setSugestoes([]);
    setFotoUsuario(null);
  };

  const inp = {
    padding: '10px 14px', borderRadius: '10px',
    border: `2px solid ${DA?.warmBeige || '#D4C5A9'}`,
    outline: 'none', fontSize: '14px', width: '100%',
    boxSizing: 'border-box', fontFamily: 'inherit',
    color: DA?.espresso || '#2C1A14', transition: 'border-color .2s',
    background: 'white',
  };

  const Label = ({ children, sub }) => (
    <label style={{ display:'block', fontWeight:'800', fontSize:'13px', color: DA?.espresso, marginBottom:'7px' }}>
      {children}
      {sub && <span style={{ fontWeight:'500', color: DA?.warmBeige, fontSize:'11px', marginLeft:'6px' }}>{sub}</span>}
    </label>
  );

  const onFocus = e => e.target.style.borderColor = DA?.copper;
  const onBlur  = e => e.target.style.borderColor = DA?.warmBeige;

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Busca por título */}
      <div>
        <Label>Título do Livro *</Label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Digite o título para buscar na Google Books..."
            value={formData.titulo}
            style={{ ...inp, flex: 1 }}
            onChange={e => set('titulo', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), buscar())}
            onFocus={onFocus} onBlur={onBlur}
          />
          <button type="button" onClick={buscar} style={{
            background: GRAD_BTN, color: DA?.cream, border: 'none', borderRadius: '10px',
            padding: '10px 18px', fontWeight: '800', cursor: 'pointer', fontSize: '14px',
            boxShadow: `0 3px 10px rgba(107,30,42,0.3)`, whiteSpace: 'nowrap',
            transition: 'transform .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            {loading ? '⏳' : '🔍 Buscar'}
          </button>
        </div>

        {/* Sugestões */}
        {sugestoes.length > 0 && (
          <div style={{
            background: 'white', border: `2px solid ${DA?.copper}`,
            borderRadius: '12px', marginTop: '8px', overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(44,26,20,0.15)',
          }}>
            {sugestoes.map((s, i) => (
              <div key={i} onClick={() => selecionar(s)} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: i < sugestoes.length - 1 ? `1px solid ${DA?.warmBeige}` : 'none',
                transition: 'background .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = DA?.cream}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                {s.capa
                  ? <img src={s.capa} alt={s.titulo} style={{ width:'34px', height:'48px', objectFit:'cover', borderRadius:'4px', flexShrink:0 }} />
                  : <div style={{ width:'34px', height:'48px', borderRadius:'4px', background:`${DA?.warmBeige}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>📚</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight:'700', fontSize:'13px', color: DA?.espresso, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.titulo}</p>
                  <p style={{ fontSize:'11px', color: DA?.warmBeige }}>{s.autor}{s.paginas ? ` · ${s.paginas} pág.` : ''}{s.genero ? ` · ${s.genero}` : ''}</p>
                </div>
                <span style={{ fontSize:'11px', color: DA?.copper, fontWeight:'700', flexShrink:0 }}>Selecionar →</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview capa da API */}
      {formData.capa && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: DA?.cream, borderRadius: '12px', border: `1px solid ${DA?.warmBeige}` }}>
          <img src={formData.capa} alt="Capa" style={{ height:'80px', borderRadius:'6px', boxShadow:'0 4px 12px rgba(44,26,20,0.15)' }} />
          <div>
            <p style={{ fontSize:'12px', fontWeight:'700', color: DA?.walnut, marginBottom:'2px' }}>🖼️ Capa via Google Books</p>
            <p style={{ fontSize:'11px', color: DA?.warmBeige }}>Você também pode adicionar sua própria foto abaixo</p>
          </div>
        </div>
      )}

      {/* Upload foto do usuário */}
      <PhotoUpload
        value={fotoUsuario}
        onChange={setFotoUsuario}
        DA={DA}
        label="Sua foto do livro físico"
      />

      {/* Campos info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <Label>Autor</Label>
          <input type="text" placeholder="Nome do autor" value={formData.autor} style={inp}
            onChange={e => set('autor', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div>
          <Label>Status</Label>
          <select value={formData.status} style={{ ...inp, cursor: 'pointer' }}
            onChange={e => set('status', e.target.value)} onFocus={onFocus} onBlur={onBlur}>
            <option value="quero-ler">⏳ Quero Ler</option>
            <option value="lendo">📖 Lendo</option>
            <option value="lido">✅ Lido</option>
            <option value="abandonei">❌ Abandonei</option>
          </select>
        </div>
        <div>
          <Label>Gênero</Label>
          <input type="text" placeholder="Ex: Romance, Ficção..." value={formData.genero} style={inp}
            onChange={e => set('genero', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div>
          <Label>Data de término</Label>
          <input type="date" style={{ ...inp, cursor: 'pointer' }}
            onChange={e => set('dataTermino', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>
      </div>

      {/* Avaliação */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px', padding: '14px',
        borderRadius: '12px', background: DA?.cream, border: `2px solid ${DA?.warmBeige}`,
      }}>
        <span style={{ fontWeight: '800', fontSize: '13px', color: DA?.espresso, whiteSpace: 'nowrap' }}>Sua nota:</span>
        <StarRating rating={nota} setRating={setNota} interactive={true} DA={DA} />
        {nota > 0 && <span style={{ fontSize: '12px', color: DA?.warmBeige, fontWeight: '600' }}>{nota}/5</span>}
      </div>

      {/* Resenha */}
      <div>
        <Label sub="(opcional)">Resenha</Label>
        <textarea
          placeholder="Deixe uma resenha rápida..."
          value={formData.resenha}
          rows={3}
          style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }}
          onChange={e => set('resenha', e.target.value)}
          onFocus={onFocus} onBlur={onBlur}
        />
      </div>

      <button type="submit" style={{
        background: GRAD_BTN, color: DA?.cream, padding: '15px', borderRadius: '13px',
        border: 'none', fontWeight: '900', fontSize: '15px', cursor: 'pointer',
        letterSpacing: '0.5px', boxShadow: `0 6px 20px rgba(107,30,42,0.35)`,
        transition: 'transform .15s, box-shadow .15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = `0 8px 28px rgba(107,30,42,0.45)`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 6px 20px rgba(107,30,42,0.35)`; }}>
        📚 ADICIONAR À ESTANTE
      </button>
    </form>
  );
}
