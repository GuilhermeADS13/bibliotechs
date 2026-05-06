import React, { useState } from 'react';
import { StarRating } from './StarRating';

export function BookForm({ onSave, DA, GRAD_BTN }) {
  const [loading, setLoading]     = useState(false);
  const [nota, setNota]           = useState(0);
  const [sugestoes, setSugestoes] = useState([]);
  const [formData, setFormData]   = useState({
    titulo: '', autor: '', genero: '', paginas: '',
    dataTermino: '', status: 'quero-ler', capa: '', resenha: ''
  });

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
    onSave({ ...formData, nota, id: Date.now() });
    setFormData({ titulo: '', autor: '', genero: '', paginas: '', dataTermino: '', status: 'quero-ler', capa: '', resenha: '' });
    setNota(0); setSugestoes([]);
  };

  const inp = {
    padding: '10px 14px', borderRadius: '10px', border: `2px solid ${DA?.warmBeige || '#D4C5A9'}`,
    outline: 'none', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
    color: DA?.espresso || '#2C1A14', transition: 'border-color .2s'
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Busca */}
      <div>
        <label style={{ display: 'block', fontWeight: '800', fontSize: '13px', color: DA?.espresso, marginBottom: '7px' }}>Título do Livro *</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" placeholder="Digite o título para buscar..." value={formData.titulo} style={{ ...inp, flex: 1 }}
            onChange={e => setFormData({ ...formData, titulo: e.target.value })}
            onFocus={e => e.target.style.borderColor = DA?.copper}
            onBlur={e => e.target.style.borderColor = DA?.warmBeige} />
          <button type="button" onClick={buscar} style={{
            background: GRAD_BTN, color: DA?.cream, border: 'none', borderRadius: '10px',
            padding: '10px 18px', fontWeight: '800', cursor: 'pointer', fontSize: '14px',
            boxShadow: `0 3px 10px rgba(107,30,42,0.3)`
          }}>{loading ? '⏳' : '🔍 Buscar'}</button>
        </div>
        {sugestoes.length > 0 && (
          <div style={{ background: 'white', border: `2px solid ${DA?.copper}`, borderRadius: '12px', marginTop: '8px', overflow: 'hidden', boxShadow: '0 6px 20px rgba(44,26,20,0.15)' }}>
            {sugestoes.map((s, i) => (
              <div key={i} onClick={() => selecionar(s)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer', borderBottom: i < sugestoes.length - 1 ? `1px solid ${DA?.warmBeige}` : 'none' }}
                onMouseEnter={e => e.currentTarget.style.background = `${DA?.cream}`}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                {s.capa && <img src={s.capa} alt={s.titulo} style={{ width: '34px', height: '48px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />}
                <div>
                  <p style={{ fontWeight: '700', fontSize: '13px', color: DA?.espresso }}>{s.titulo}</p>
                  <p style={{ fontSize: '11px', color: DA?.warmBeige }}>{s.autor}{s.paginas ? ` · ${s.paginas} pág.` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formData.capa && (
        <div style={{ textAlign: 'center' }}>
          <img src={formData.capa} alt="Capa" style={{ height: '150px', borderRadius: '10px', boxShadow: '0 6px 18px rgba(44,26,20,0.2)' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: DA?.espresso, marginBottom: '6px' }}>Autor</label>
          <input type="text" placeholder="Nome do autor" value={formData.autor} style={inp}
            onChange={e => setFormData({ ...formData, autor: e.target.value })}
            onFocus={e => e.target.style.borderColor = DA?.copper}
            onBlur={e => e.target.style.borderColor = DA?.warmBeige} />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: DA?.espresso, marginBottom: '6px' }}>Status</label>
          <select value={formData.status} style={{ ...inp, background: 'white', cursor: 'pointer' }}
            onChange={e => setFormData({ ...formData, status: e.target.value })}
            onFocus={e => e.target.style.borderColor = DA?.copper}
            onBlur={e => e.target.style.borderColor = DA?.warmBeige}>
            <option value="quero-ler">⏳ Quero Ler</option>
            <option value="lendo">📖 Lendo</option>
            <option value="lido">✅ Lido</option>
            <option value="abandonei">❌ Abandonei</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: DA?.espresso, marginBottom: '6px' }}>Gênero</label>
          <input type="text" placeholder="Ex: Romance, Ficção..." value={formData.genero} style={inp}
            onChange={e => setFormData({ ...formData, genero: e.target.value })}
            onFocus={e => e.target.style.borderColor = DA?.copper}
            onBlur={e => e.target.style.borderColor = DA?.warmBeige} />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: DA?.espresso, marginBottom: '6px' }}>Data de término</label>
          <input type="date" style={{ ...inp, background: 'white', cursor: 'pointer' }}
            onChange={e => setFormData({ ...formData, dataTermino: e.target.value })}
            onFocus={e => e.target.style.borderColor = DA?.copper}
            onBlur={e => e.target.style.borderColor = DA?.warmBeige} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px', borderRadius: '12px', background: `${DA?.cream}`, border: `2px solid ${DA?.warmBeige}` }}>
        <span style={{ fontWeight: '800', fontSize: '13px', color: DA?.espresso }}>Sua nota:</span>
        <StarRating rating={nota} setRating={setNota} interactive={true} DA={DA} />
        {nota > 0 && <span style={{ fontSize: '12px', color: DA?.warmBeige, fontWeight: '600' }}>{nota}/5</span>}
      </div>

      <div>
        <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: DA?.espresso, marginBottom: '6px' }}>Resenha (opcional)</label>
        <textarea placeholder="Deixe uma resenha rápida..." value={formData.resenha} rows={3}
          style={{ ...inp, resize: 'vertical' }}
          onChange={e => setFormData({ ...formData, resenha: e.target.value })}
          onFocus={e => e.target.style.borderColor = DA?.copper}
          onBlur={e => e.target.style.borderColor = DA?.warmBeige} />
      </div>

      <button type="submit" style={{
        background: GRAD_BTN, color: DA?.cream, padding: '15px', borderRadius: '13px',
        border: 'none', fontWeight: '900', fontSize: '15px', cursor: 'pointer', letterSpacing: '0.5px',
        boxShadow: `0 6px 20px rgba(107,30,42,0.35)`, transition: 'transform .15s'
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
        ADICIONAR À ESTANTE
      </button>
    </form>
  );
}
