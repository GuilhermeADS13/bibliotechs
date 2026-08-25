import React, { useState } from 'react';
import { rotularDia, diaDeHoje } from '../hooks/useConversas';
import { BiaAvatar } from './BiaAvatar';
import { TextoFormatado } from './TextoFormatado';

// Histórico das conversas na aba da B.IA. O widget flutuante é estreito e serve
// para conversar; aqui há espaço para reler o que já foi dito.

export function HistoricoConversas({ conversas, carregando, onApagar, DA, user }) {
  const [aberto, setAberto] = useState(null);
  const hoje = diaDeHoje();
  const dias = Object.keys(conversas || {})
    .filter(d => (conversas[d] || []).length > 0)
    .sort()
    .reverse();

  const painel = {
    background: 'rgba(245,240,224,0.92)',
    borderRadius: '18px',
    padding: '26px',
    boxShadow: '0 18px 60px rgba(131,84,30,0.18)',
    border: '1px solid rgba(196,154,108,0.4)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  };

  if (carregando) {
    return (
      <div style={{ ...painel, textAlign: 'center' }}>
        <p style={{ color: DA.walnut, fontSize: '14px', fontWeight: '600' }}>
          Carregando conversas...
        </p>
      </div>
    );
  }

  if (dias.length === 0) {
    return (
      <div style={{ ...painel, textAlign: 'center' }}>
        <h3 style={{ fontWeight: '800', fontSize: '16px', color: DA.espresso, marginBottom: '10px' }}>
          🕘 Histórico de conversas
        </h3>
        <p style={{ color: DA.walnut, fontSize: '14px', lineHeight: 1.6, opacity: 0.9 }}>
          Ainda não há conversas guardadas. Tudo que você conversar com a B.IA fica
          salvo aqui, separado por dia.
        </p>
        {!user && (
          <p style={{ color: DA.walnut, fontSize: '12px', marginTop: '12px', opacity: 0.75 }}>
            Sem login, as conversas ficam só neste dispositivo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={painel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
        <h3 style={{ fontWeight: '800', fontSize: '16px', color: DA.espresso }}>
          🕘 Histórico de conversas
        </h3>
        <span style={{ fontSize: '12px', color: DA.walnut, opacity: 0.8 }}>
          {dias.length} {dias.length === 1 ? 'dia' : 'dias'} ·{' '}
          {user ? 'sincronizado na sua conta' : 'salvo neste dispositivo'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {dias.map(dia => {
          const msgs = conversas[dia] || [];
          const estaAberto = aberto === dia;
          // A primeira fala do usuário resume melhor o assunto do que a
          // saudação fixa da B.IA, que abre toda conversa igual.
          const previa = msgs.find(m => m.tipo === 'usuario')?.texto || msgs[0]?.texto || '';

          return (
            <div key={dia} style={{
              background: DA.cream,
              borderRadius: '12px',
              border: `1px solid ${estaAberto ? DA.copper : 'rgba(196,154,108,0.4)'}`,
              overflow: 'hidden',
              transition: 'border-color .2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => setAberto(estaAberto ? null : dia)}
                  style={{
                    flex: 1, minWidth: 0, textAlign: 'left', padding: '14px 16px',
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: DA.espresso }}>
                      {rotularDia(dia, hoje)}
                    </span>
                    <span style={{ fontSize: '11px', color: DA.walnut, opacity: 0.7 }}>
                      {msgs.length} mensagens
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: DA.copper }}>
                      {estaAberto ? '▲' : '▼'}
                    </span>
                  </div>
                  {!estaAberto && previa && (
                    <p style={{
                      fontSize: '12px', color: DA.walnut, opacity: 0.85, margin: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {previa}
                    </p>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Apagar a conversa de ${rotularDia(dia, hoje)}?`)) {
                      if (aberto === dia) setAberto(null);
                      onApagar(dia);
                    }
                  }}
                  title="Apagar esta conversa"
                  aria-label={`Apagar a conversa de ${rotularDia(dia, hoje)}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '14px 16px', fontSize: '14px', color: DA.oxblood,
                  }}
                >
                  🗑
                </button>
              </div>

              {estaAberto && (
                <div style={{
                  padding: '4px 16px 16px',
                  display: 'flex', flexDirection: 'column', gap: '10px',
                  borderTop: '1px solid rgba(196,154,108,0.3)',
                }}>
                  {msgs.map(msg => (
                    <div key={msg.id} style={{
                      display: 'flex',
                      justifyContent: msg.tipo === 'usuario' ? 'flex-end' : 'flex-start',
                      gap: '8px', alignItems: 'flex-start', marginTop: '10px',
                    }}>
                      {msg.tipo === 'bot' && <BiaAvatar size={24} style={{ marginTop: '2px', flexShrink: 0 }} />}
                      <div style={{
                        maxWidth: '78%',
                        padding: '10px 13px',
                        borderRadius: msg.tipo === 'usuario' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: msg.tipo === 'usuario' ? DA.oxblood : 'rgba(245,240,224,0.95)',
                        color: msg.tipo === 'usuario' ? DA.cream : DA.espresso,
                        border: msg.tipo === 'usuario' ? 'none' : '1px solid rgba(196,154,108,0.35)',
                        fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}>
                        <TextoFormatado texto={msg.texto} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
