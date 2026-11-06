import React, { useEffect, useState } from 'react';
import { StarRating } from './StarRating';
import { PhotoUpload } from './PhotoUpload';
import { LeitorCodigo } from './LeitorCodigo';
import { buscarNaOpenLibrary } from '../openlibrary';
import { buscarPorIsbn, isbnValido } from '../isbn';

const VAZIO = {
  titulo: '', autor: '', genero: '', paginas: '',
  dataTermino: '', dataInicio: '', status: 'quero-ler', capa: '', resenha: '',
  serie: '', volume: '',
};

// `inicial`: chegada pré-preenchida, vinda de "Continue a série" nas
// recomendações — já com série, volume e autor, e a busca disparada.
export function BookForm({ onSave, DA, GRAD_BTN, inicial = null }) {
  const [loading, setLoading]         = useState(false);
  const [nota, setNota]               = useState(0);
  const [sugestoes, setSugestoes]     = useState([]);
  const [erro, setErro]               = useState('');
  const [fotoUsuario, setFotoUsuario] = useState(null);
  const [lendoCodigo, setLendoCodigo] = useState(false);
  const [formData, setFormData]       = useState(() => ({
    ...VAZIO,
    ...(inicial ? {
      titulo: inicial.titulo || '', autor: inicial.autor || '',
      serie: inicial.serie || '', volume: inicial.volume ? String(inicial.volume) : '',
    } : {}),
  }));

  const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';
  const GOOGLE_BOOKS_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || '';

  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  // Reserva: usada quando a Google Books não devolve nada ou falha. Se ela
  // também vier vazia, mostra a mensagem que a chamada original teria dado.
  const tentarReserva = async (titulo, autor, mensagemSeVazio) => {
    const reserva = await buscarNaOpenLibrary({ titulo, autor });
    if (reserva.length > 0) setSugestoes(reserva);
    else setErro(mensagemSeVazio);
  };

  // ISBN: pelo código de barras ou digitado no campo de título.
  const buscarIsbn = async (isbn) => {
    setLoading(true);
    setErro('');
    setSugestoes([]);
    try {
      const achados = await buscarPorIsbn(isbn, { googleBooksKey: GOOGLE_BOOKS_KEY });
      if (achados.length === 1) selecionar(achados[0]);
      else if (achados.length > 1) setSugestoes(achados);
      else setErro(`Não encontrei o ISBN ${isbn} na Google Books nem na Open Library. Busque pelo título.`);
    } finally {
      setLoading(false);
    }
  };

  const buscar = async () => {
    const titulo = formData.titulo.trim();
    const autor  = formData.autor.trim();
    if (isbnValido(titulo)) return buscarIsbn(titulo);

    const queryParts = [];
    if (titulo.length >= 2) queryParts.push(`intitle:${titulo}`);
    if (autor.length >= 2)  queryParts.push(`inauthor:${autor}`);
    if (!queryParts.length) return;

    setLoading(true);
    setErro('');
    setSugestoes([]);

    try {
      // Monta a URL manualmente — a Google Books API recebe q= com espaços como +
      const q = queryParts.join('+');
      const keyParam = GOOGLE_BOOKS_KEY ? `&key=${GOOGLE_BOOKS_KEY}` : '';
      const url = `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(q)}&maxResults=6&langRestrict=pt${keyParam}`;

      const res  = await fetch(url);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || `Erro ${res.status}`;
        throw new Error(msg);
      }

      const data  = await res.json();
      const items = data.items || [];

      if (items.length > 0) {
        setSugestoes(items.map(item => ({
          titulo:  item.volumeInfo.title || '',
          autor:   item.volumeInfo.authors?.join(', ') || 'Desconhecido',
          genero:  item.volumeInfo.categories?.[0] || '',
          paginas: item.volumeInfo.pageCount || '',
          capa:    item.volumeInfo.imageLinks?.thumbnail?.replace(/^http:/, 'https:') || '',
        })));
        return;
      }

      // Sem resultado na Google Books, tenta a Open Library. Ver
      // src/openlibrary.js: ela é reserva, não fonte de igual valor.
      await tentarReserva(titulo, autor, 'Nenhum livro encontrado. Tente outro título.');
    } catch (e) {
      // A cota diária da Google Books estourou duas vezes só nos testes de
      // hoje. Antes disso, a busca simplesmente morria aqui.
      console.error('Google Books search failed', e);
      await tentarReserva(titulo, autor, `Erro ao buscar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Copia SO os campos do cadastro. Espalhar a sugestao inteira gravaria no
  // livro o que e metadado da busca — `fonte` e `ano` da Open Library, por
  // exemplo, que nao existem no formulario e nao deveriam existir na estante.
  const selecionar = (s) => {
    setFormData(p => ({
      ...p,
      titulo: s.titulo ?? p.titulo,
      autor: s.autor === 'Desconhecido' ? '' : (s.autor ?? p.autor),
      genero: s.genero ?? p.genero,
      paginas: s.paginas ?? p.paginas,
      capa: s.capa ?? p.capa,
    }));
    setSugestoes([]);
    setErro('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Antes isto era um `return` mudo: clicar em salvar sem título não
    // fazia absolutamente nada, e não havia como adivinhar o porquê.
    if (!formData.titulo.trim()) {
      setErro('Escreva o título do livro antes de salvar.');
      return;
    }
    const { volume, serie, dataInicio, ...resto } = formData;
    onSave({
      ...resto,
      // Campos novos só entram quando preenchidos: o livro sem série continua
      // com o mesmo formato de antes.
      ...(serie.trim() ? { serie: serie.trim() } : {}),
      ...(Number.parseInt(volume, 10) > 0 ? { volume: Number.parseInt(volume, 10) } : {}),
      ...(dataInicio ? { dataInicio } : {}),
      nota, fotoUsuario,
    });
    setFormData(VAZIO);
    setNota(0);
    setSugestoes([]);
    setErro('');
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

  // Chegou pré-preenchido: busca já, para a pessoa só escolher o volume.
  useEffect(() => {
    if (inicial?.titulo) buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <button type="button" onClick={buscar} disabled={loading} style={{
            background: GRAD_BTN, color: DA?.cream, border: 'none', borderRadius: '10px',
            padding: '12px 20px', fontWeight: '800', cursor: loading ? 'wait' : 'pointer', fontSize: '14px',
            boxShadow: '0 4px 14px rgba(107,30,42,0.35)', whiteSpace: 'nowrap',
            transition: 'transform .15s', opacity: loading ? 0.7 : 1,
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
            {loading ? '⏳ Buscando...' : '🔍 Buscar'}
          </button>
          <button type="button" onClick={() => setLendoCodigo(true)} disabled={loading}
            title="Ler o código de barras do livro" aria-label="Ler o código de barras do livro"
            style={{
              background: 'white', color: DA?.oxblood, border: `2px solid ${DA?.oxblood}`, borderRadius: '10px',
              padding: '0 14px', fontWeight: '800', cursor: 'pointer', fontSize: '18px', flexShrink: 0,
            }}>
            📷
          </button>
        </div>
        <p style={{ fontSize: '11px', color: DA?.walnut, marginTop: '6px' }}>
          Também dá para digitar o ISBN (o número do código de barras) no lugar do título.
        </p>

        {/* Mensagem de erro */}
        {erro && (
          <div style={{ marginTop:'8px', padding:'10px 14px', background:'#fff0f0', border:'1px solid #ffcccc', borderRadius:'8px', fontSize:'13px', color:'#c0392b', fontWeight:'600' }}>
            ⚠️ {erro}
          </div>
        )}

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
      <PhotoUpload value={fotoUsuario} onChange={setFotoUsuario} DA={DA} label="Sua foto do livro físico" />

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
          {/* Sem `min`/`max` o campo aceitava ano 131313 — e a data alimenta
              as estatísticas anuais e o gráfico por mês. */}
          <input type="date" min="1900-01-01" max="2100-12-31"
            value={formData.dataTermino} style={{ ...inp, cursor: 'pointer' }}
            onChange={e => set('dataTermino', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>
        {formData.status !== 'quero-ler' && (
          <div>
            <Label sub="(opcional)">Data de início</Label>
            <input type="date" min="1900-01-01" max="2100-12-31"
              value={formData.dataInicio} style={{ ...inp, cursor: 'pointer' }}
              onChange={e => set('dataInicio', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
          </div>
        )}
        <div>
          <Label sub="(opcional)">Série</Label>
          <input type="text" placeholder="Ex.: Duna" value={formData.serie} style={inp}
            onChange={e => set('serie', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>
        <div>
          <Label sub="(opcional)">Volume da série</Label>
          <input type="number" min="1" placeholder="Ex.: 1" value={formData.volume} style={inp}
            onChange={e => set('volume', e.target.value)} onFocus={onFocus} onBlur={onBlur} />
        </div>
      </div>

      {/* Avaliação */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px', borderRadius: '12px', background: DA?.cream, border: `2px solid ${DA?.warmBeige}` }}>
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
        letterSpacing: '0.5px', boxShadow: '0 6px 20px rgba(107,30,42,0.35)',
        transition: 'transform .15s, box-shadow .15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(107,30,42,0.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(107,30,42,0.35)'; }}>
        💾 Salvar na Estante
      </button>

      {lendoCodigo && (
        <LeitorCodigo DA={DA}
          onLido={(isbn) => { setLendoCodigo(false); set('titulo', isbn); buscarIsbn(isbn); }}
          onFechar={() => setLendoCodigo(false)} />
      )}
    </form>
  );
}
