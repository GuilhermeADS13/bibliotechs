import React, { useEffect, useRef, useState } from 'react';
import { gerarRecomendacoes } from '../recomendacoes';
import { bookPlaceholder } from '../placeholder';

const GLASS_PANEL = 'rgba(245,240,224,0.85)';
const PANEL_SHADOW = '0 18px 60px rgba(131,84,30,0.18)';

const MENSAGENS_VAZIO = {
  'sem-historico': {
    emoji: '🌱',
    titulo: 'Ainda não há histórico suficiente',
    texto: 'Marque alguns livros como “lido” e dê notas a eles. As recomendações são calculadas a partir do que você mais gostou.',
  },
  'sem-generos': {
    emoji: '🏷️',
    titulo: 'Faltam gêneros e autores',
    texto: 'Preencha o gênero e o autor dos seus livros lidos para eu identificar seu perfil de leitura.',
  },
  'sem-resultados': {
    emoji: '🔍',
    titulo: 'Nada novo encontrado',
    texto: 'A busca não trouxe títulos fora da sua estante. Tente novamente mais tarde ou adicione livros de outros gêneros.',
  },
};

export function Recomendacoes({ livros, DA, GRAD_BTN, googleBooksKey, onIrParaAdicionar }) {
  const [itens, setItens]         = useState([]);
  const [perfil, setPerfil]       = useState(null);
  const [motivo, setMotivo]       = useState('sem-historico');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]           = useState('');
  const [recarregar, setRecarregar] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    // Cancela a busca anterior se a estante mudar antes de a resposta chegar.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let ativo = true;
    setCarregando(true);
    setErro('');

    gerarRecomendacoes(livros, { googleBooksKey, limite: 6, sinal: controller.signal })
      .then(r => {
        if (!ativo) return;
        setItens(r.recomendacoes);
        setPerfil(r.perfil);
        setMotivo(r.motivo);
      })
      .catch(e => {
        if (!ativo || e.name === 'AbortError') return;
        console.error('Falha ao gerar recomendações:', e);
        setErro('Não foi possível buscar recomendações agora. Verifique sua conexão.');
      })
      .finally(() => { if (ativo) setCarregando(false); });

    return () => { ativo = false; controller.abort(); };
  }, [livros, googleBooksKey, recarregar]);

  const vazio = MENSAGENS_VAZIO[motivo] || MENSAGENS_VAZIO['sem-resultados'];

  return (
    <div style={{
      background: GLASS_PANEL, borderRadius: '18px', padding: '26px',
      boxShadow: PANEL_SHADOW, border: '1px solid rgba(196,154,108,0.4)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <h3 style={{ fontWeight: '800', fontSize: '16px', color: DA.espresso }}>✨ Recomendado para você</h3>
        <button
          onClick={() => setRecarregar(v => v + 1)}
          disabled={carregando}
          style={{
            fontSize: '12px', color: DA.oxblood, background: 'none',
            border: `1px solid ${DA.oxblood}`, borderRadius: '8px', padding: '5px 12px',
            cursor: carregando ? 'wait' : 'pointer', fontWeight: '700', opacity: carregando ? 0.6 : 1,
          }}
        >
          {carregando ? '⏳ Buscando...' : '🔄 Atualizar'}
        </button>
      </div>

      {perfil?.generosFavoritos?.length > 0 && (
        <p style={{ fontSize: '12px', color: DA.walnut, opacity: 0.85, marginBottom: '18px' }}>
          Baseado em {perfil.totalLidos} livro{perfil.totalLidos !== 1 ? 's' : ''} lido{perfil.totalLidos !== 1 ? 's' : ''}
          {' · '}você gosta de{' '}
          <strong style={{ color: DA.copper }}>
            {perfil.generosFavoritos.slice(0, 2).map(g => g.nome).join(' e ')}
          </strong>
        </p>
      )}

      {erro && (
        <div style={{ padding: '12px 14px', background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '10px', fontSize: '13px', color: '#c0392b', fontWeight: '600' }}>
          ⚠️ {erro}
        </div>
      )}

      {!erro && carregando && (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: DA.walnut }}>
          <div style={{ fontSize: '30px', marginBottom: '10px', display: 'inline-block', animation: 'spin 1s linear infinite' }}>⚙️</div>
          <p style={{ fontSize: '13px', fontWeight: '600' }}>Analisando seu histórico de leitura...</p>
        </div>
      )}

      {!erro && !carregando && itens.length === 0 && (
        <div style={{ textAlign: 'center', padding: '28px 16px' }}>
          <div style={{ fontSize: '38px', marginBottom: '10px' }}>{vazio.emoji}</div>
          <p style={{ color: DA.espresso, fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>{vazio.titulo}</p>
          <p style={{ color: DA.walnut, fontSize: '13px', opacity: 0.85, maxWidth: '420px', margin: '0 auto' }}>{vazio.texto}</p>
        </div>
      )}

      {!erro && !carregando && itens.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {itens.map(livro => (
            <div key={livro.id || livro.titulo} style={{
              display: 'flex', gap: '12px', padding: '14px',
              background: DA.cream, borderRadius: '12px',
              border: `1px solid ${DA.warmBeige}`,
            }}>
              <img
                src={livro.capa || bookPlaceholder(54, 78)}
                alt={livro.titulo}
                width="54" height="78"
                style={{ width: '54px', height: '78px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, boxShadow: '0 4px 12px rgba(44,26,20,0.15)' }}
              />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontWeight: '800', fontSize: '13px', color: DA.espresso, lineHeight: 1.3, marginBottom: '3px' }}>
                  {livro.titulo}
                </p>
                <p style={{ fontSize: '11px', color: DA.walnut, opacity: 0.85, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {livro.autor}{livro.ano && ` · ${livro.ano}`}
                </p>
                {livro.ratingMedio > 0 && (
                  <p style={{ fontSize: '11px', color: DA.mustard, fontWeight: '800', marginBottom: '6px' }}>
                    {'⭐'.repeat(Math.round(livro.ratingMedio))} {livro.ratingMedio}/5
                  </p>
                )}
                <p style={{
                  fontSize: '10px', color: DA.copper, fontWeight: '700',
                  background: `${DA.copper}15`, borderRadius: '999px',
                  padding: '3px 8px', display: 'inline-block', alignSelf: 'flex-start', marginTop: 'auto',
                }}>
                  {livro.motivo}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!erro && !carregando && itens.length > 0 && onIrParaAdicionar && (
        <p style={{ fontSize: '12px', color: DA.walnut, opacity: 0.8, marginTop: '16px', textAlign: 'center' }}>
          Gostou de algum?{' '}
          <button onClick={onIrParaAdicionar} style={{ background: 'none', border: 'none', color: DA.oxblood, fontWeight: '800', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px', fontSize: '12px' }}>
            Adicione à sua estante
          </button>
        </p>
      )}
    </div>
  );
}
