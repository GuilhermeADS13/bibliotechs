import React, { useState } from 'react';
import { StarRating } from './StarRating';
import { PhotoUpload } from './PhotoUpload';
import { CapaLivro } from './CapaLivro';

// O documento do livro tem limite de 1 MiB no Firestore; 50 trechos de até
// 1000 caracteres ficam bem longe disso.
const MAX_TRECHOS = 50;
const MAX_CHARS_TRECHO = 1000;

export function ResenhaModal({ livro, DA, GRAD_BTN, onSalvar, onFechar }) {
  const [resenha, setResenha]         = useState(livro.resenha || '');
  const [nota, setNota]               = useState(livro.nota || 0);
  const [fotoUsuario, setFotoUsuario] = useState(livro.fotoUsuario || null);
  const [abaFoto, setAbaFoto]         = useState(false); // toggle seção de foto
  // `fotoUsuario` nulo NÃO significa "este livro não tem foto": desde que as
  // fotos passaram a carregar sob demanda, ela pode ainda não ter chegado
  // quando o modal abre — e o modal congela o livro no clique, então nem uma
  // que chegue depois aparece aqui.
  //
  // Sem esta marca, salvar a resenha de um livro cuja foto ainda não tinha
  // carregado mandava `fotoUsuario: null` e APAGAVA a foto do banco. Só quem
  // mexeu na foto tem direito de alterá-la.
  const [fotoTrocada, setFotoTrocada] = useState(false);

  // Detalhes que não cabiam no cadastro original — sem eles, livro antigo da
  // estante nunca teria progresso, ritmo ou série.
  const [dataInicio, setDataInicio] = useState(livro.dataInicio || '');
  const [paginas, setPaginas]       = useState(livro.paginas ? String(livro.paginas) : '');
  const [serie, setSerie]           = useState(livro.serie || '');
  const [volume, setVolume]         = useState(livro.volume ? String(livro.volume) : '');
  const [trechos, setTrechos]       = useState(Array.isArray(livro.trechos) ? livro.trechos : []);
  const [novoTrecho, setNovoTrecho] = useState('');
  const [paginaTrecho, setPaginaTrecho] = useState('');

  const adicionarTrecho = () => {
    const texto = novoTrecho.trim().slice(0, MAX_CHARS_TRECHO);
    if (!texto || trechos.length >= MAX_TRECHOS) return;
    const pagina = Number.parseInt(paginaTrecho, 10);
    setTrechos(t => [...t, pagina > 0 ? { texto, pagina } : { texto }]);
    setNovoTrecho('');
    setPaginaTrecho('');
  };

  const salvar = () => {
    const vol = Number.parseInt(volume, 10);
    onSalvar(resenha, nota, fotoTrocada ? fotoUsuario : undefined, {
      dataInicio,
      paginas: Number.parseInt(paginas, 10) > 0 ? String(Number.parseInt(paginas, 10)) : '',
      serie: serie.trim(),
      volume: vol > 0 ? vol : '',
      trechos,
    });
  };

  const campo = {
    width: '100%', padding: '9px 11px', borderRadius: '10px', boxSizing: 'border-box',
    border: `2px solid ${DA.warmBeige}`, fontSize: '13px', fontFamily: 'inherit', color: DA.espresso,
  };
  const rotulo = { display: 'block', fontSize: '12px', fontWeight: '700', color: DA.walnut, marginBottom: '5px' };

  const trocarFoto = (nova) => { setFotoUsuario(nova); setFotoTrocada(true); };
  // `temFoto` vem do documento do livro e responde antes de a imagem chegar.
  const temFoto = !!fotoUsuario || (!fotoTrocada && !!livro.temFoto);

  const imgExibida = livro.fotoUsuario || livro.capa;

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
            <CapaLivro
              src={imgExibida}
              titulo={livro.titulo}
              autor={livro.autor}
              largura={72}
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
              {temFoto ? 'Minha foto do livro' : 'Adicionar minha foto'}
            </p>
            <p style={{ fontSize:'11px', color: DA.warmBeige }}>
              {temFoto ? 'Foto salva · clique para alterar' : 'Registre o livro físico que você tem'}
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
            <PhotoUpload value={fotoUsuario} onChange={trocarFoto} DA={DA} label="Foto do seu exemplar" />
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

        {/* Trechos favoritos */}
        <div style={{ marginBottom: '22px' }}>
          <h4 style={{ fontSize: '14px', color: DA.espresso, marginBottom: '8px' }}>❝ Trechos favoritos</h4>
          {trechos.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {trechos.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '10px 12px', background: DA.cream, borderRadius: '10px', borderLeft: `3px solid ${DA.copper}` }}>
                  <p style={{ flex: 1, fontFamily: 'var(--fonte-livro)', fontSize: '13px', fontWeight: 400, fontStyle: 'italic', color: DA.espresso, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    “{t.texto}”{t.pagina ? <span style={{ fontStyle: 'normal', color: DA.walnut, fontSize: '11px' }}> — p. {t.pagina}</span> : null}
                  </p>
                  <button type="button" onClick={() => setTrechos(lista => lista.filter((_, j) => j !== i))}
                    aria-label="Remover trecho"
                    style={{ background: 'none', border: 'none', color: DA.walnut, cursor: 'pointer', fontSize: '14px', padding: '0 2px' }}>✕</button>
                </li>
              ))}
            </ul>
          )}
          {trechos.length < MAX_TRECHOS ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <textarea value={novoTrecho} onChange={e => setNovoTrecho(e.target.value)} rows={2}
                maxLength={MAX_CHARS_TRECHO}
                placeholder="Copie aqui uma frase que marcou você…"
                aria-label="Novo trecho"
                style={{ ...campo, resize: 'vertical', lineHeight: 1.5 }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" min="1" value={paginaTrecho} onChange={e => setPaginaTrecho(e.target.value)}
                  placeholder="Página" aria-label="Página do trecho" style={{ ...campo, width: '100px' }} />
                <button type="button" onClick={adicionarTrecho} disabled={!novoTrecho.trim()} style={{
                  padding: '8px 14px', borderRadius: '10px', border: `1px solid ${DA.copper}`,
                  background: 'white', color: DA.copper, fontWeight: '800', fontSize: '13px',
                  cursor: novoTrecho.trim() ? 'pointer' : 'default', opacity: novoTrecho.trim() ? 1 : 0.5,
                }}>
                  Guardar trecho
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '12px', color: DA.walnut }}>Limite de {MAX_TRECHOS} trechos por livro.</p>
          )}
        </div>

        {/* Detalhes da leitura */}
        <div style={{ marginBottom: '22px' }}>
          <h4 style={{ fontSize: '14px', color: DA.espresso, marginBottom: '10px' }}>Detalhes da leitura</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            <label style={rotulo}>Comecei em
              <input type="date" min="1900-01-01" max="2100-12-31" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ ...campo, marginTop: '5px' }} />
            </label>
            <label style={rotulo}>Total de páginas
              <input type="number" min="1" value={paginas} onChange={e => setPaginas(e.target.value)} style={{ ...campo, marginTop: '5px' }} />
            </label>
            <label style={rotulo}>Série
              <input type="text" value={serie} onChange={e => setSerie(e.target.value)} placeholder="Ex.: Duna" style={{ ...campo, marginTop: '5px' }} />
            </label>
            <label style={rotulo}>Volume
              <input type="number" min="1" value={volume} onChange={e => setVolume(e.target.value)} style={{ ...campo, marginTop: '5px' }} />
            </label>
          </div>
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
          {/* `undefined` quando ninguém mexeu na foto: é o que diz a
              `separarFoto` para não tocar nela. */}
          <button onClick={salvar} style={{
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
