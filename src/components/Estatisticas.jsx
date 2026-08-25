import React, { useMemo, useState } from 'react';
import { calcularEstatisticas, anosDisponiveis } from '../estatisticas';
import { Recomendacoes } from './Recomendacoes';

const GLASS_PANEL = 'rgba(245,240,224,0.85)';
const GLASS_PANEL_STRONG = 'rgba(245,240,224,0.94)';
const PANEL_SHADOW = '0 18px 60px rgba(131,84,30,0.18)';

function Painel({ titulo, children, DA, forte = false }) {
  return (
    <div style={{
      background: forte ? GLASS_PANEL_STRONG : GLASS_PANEL,
      borderRadius: '18px',
      padding: '26px',
      boxShadow: PANEL_SHADOW,
      border: '1px solid rgba(196,154,108,0.4)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      <h3 style={{ fontWeight: '800', fontSize: '16px', color: DA.espresso, marginBottom: '18px' }}>{titulo}</h3>
      {children}
    </div>
  );
}

function Destaque({ valor, rotulo, sub, cor, DA }) {
  return (
    <div style={{
      background: `${cor}18`,
      border: `1px solid ${cor}44`,
      borderRadius: '12px',
      padding: '16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '26px', fontWeight: '900', color: cor, lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: '11px', color: cor, fontWeight: '700', marginTop: '4px' }}>{rotulo}</div>
      {sub && <div style={{ fontSize: '10px', color: DA.walnut, opacity: 0.7, marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

export function Estatisticas({ livros, DA, GRAD_BTN, googleBooksKey, onIrParaAdicionar, onIrParaMetas, onAdicionarLivro }) {
  const anos = useMemo(() => anosDisponiveis(livros), [livros]);
  const [ano, setAno] = useState(anos[0]);

  // Se o ano selecionado sumir da lista (ex.: livro removido), volta para o mais recente.
  const anoAtivo = anos.includes(ano) ? ano : anos[0];
  const stats = useMemo(() => calcularEstatisticas(livros, anoAtivo), [livros, anoAtivo]);

  const alturaBarra = (quantidade) => {
    if (!quantidade) return 5;
    return Math.max(16, (quantidade / Math.max(1, stats.maxMes)) * 130);
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Cabeçalho + seletor de ano */}
      <div style={{
        background: GLASS_PANEL_STRONG, borderRadius: '18px', padding: '22px 26px',
        boxShadow: PANEL_SHADOW, border: '1px solid rgba(196,154,108,0.4)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ fontWeight: '900', fontSize: '20px', color: DA.espresso }}>📊 Estatísticas de Leitura</h2>
          <p style={{ fontSize: '13px', color: DA.walnut, opacity: 0.8, marginTop: '4px' }}>
            Seu ritmo mês a mês — os mesmos dados que a B.IA analisa.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {anos.map(a => (
            <button key={a} onClick={() => setAno(a)} style={{
              padding: '8px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontWeight: '800', fontSize: '13px', transition: 'all .2s',
              background: a === anoAtivo ? GRAD_BTN : 'rgba(255,255,255,0.6)',
              color: a === anoAtivo ? DA.cream : DA.espresso,
              boxShadow: a === anoAtivo ? '0 2px 10px rgba(107,30,42,0.3)' : 'none',
            }}>{a}</button>
          ))}
        </div>
      </div>

      {/* Números do ano */}
      <Painel titulo={`📈 Resumo de ${anoAtivo}`} DA={DA} forte>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          <Destaque valor={stats.totalNoAno} rotulo="Livros lidos" sub={`em ${anoAtivo}`} cor={DA.oxblood} DA={DA} />
          <Destaque valor={stats.mediaMensal} rotulo="Média mensal" sub="por mês ativo" cor={DA.teal} DA={DA} />
          <Destaque
            valor={stats.melhorMes ? stats.melhorMes.nome : '—'}
            rotulo="Melhor mês"
            sub={stats.melhorMes ? `${stats.melhorMes.quantidade} livro${stats.melhorMes.quantidade !== 1 ? 's' : ''}` : 'sem registros'}
            cor={DA.burntOrange} DA={DA}
          />
          <Destaque
            valor={stats.paginasAno.toLocaleString('pt-BR')}
            rotulo="Páginas"
            sub={stats.mediaPaginas ? `~${stats.mediaPaginas}/livro` : 'sem dados'}
            cor={DA.forestGreen} DA={DA}
          />
        </div>
      </Painel>

      {/* Gráfico mensal */}
      <Painel titulo={`📅 Livros lidos por mês (${anoAtivo})`} DA={DA}>
        {stats.totalNoAno === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px' }}>
            <div style={{ fontSize: '38px', marginBottom: '10px' }}>📭</div>
            <p style={{ color: DA.espresso, fontWeight: '700', fontSize: '14px', marginBottom: '6px' }}>
              Nenhuma leitura concluída em {anoAtivo}
            </p>
            <p style={{ color: DA.walnut, fontSize: '13px', opacity: 0.8 }}>
              Marque um livro como “lido” e preencha a data de término para ele aparecer aqui.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '160px' }}>
              {stats.porMes.map(m => (
                <div key={m.indice} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                  title={`${m.nomeLongo}: ${m.quantidade} livro${m.quantidade !== 1 ? 's' : ''}`}>
                  <span style={{ fontSize: '11px', color: DA.oxblood, fontWeight: '800', height: '14px' }}>
                    {m.quantidade || ''}
                  </span>
                  <div style={{
                    width: '100%',
                    height: `${alturaBarra(m.quantidade)}px`,
                    borderRadius: '5px 5px 0 0',
                    background: m.quantidade
                      ? `linear-gradient(180deg, ${DA.mustard}, ${DA.burntOrange}, ${DA.oxblood})`
                      : `${DA.warmBeige}55`,
                    transition: 'height .4s ease',
                  }} />
                  <span style={{ fontSize: '10px', color: DA.walnut, fontWeight: '700', opacity: 0.8 }}>{m.nome}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '12px', color: DA.walnut, marginTop: '14px', textAlign: 'center', opacity: 0.85, fontWeight: '600' }}>
              {stats.mesesAtivos} de 12 meses com leitura registrada
              {stats.sequenciaAtual > 1 && ` · 🔥 sequência de ${stats.sequenciaAtual} meses`}
            </p>
          </>
        )}
      </Painel>

      {/* Detalhe por mês */}
      {stats.totalNoAno > 0 && (
        <Painel titulo="🗓️ Detalhe por mês" DA={DA}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {stats.porMes.filter(m => m.quantidade > 0).map(m => (
              <div key={m.indice} style={{ background: DA.cream, borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '14px', color: DA.espresso, textTransform: 'capitalize' }}>{m.nomeLongo}</strong>
                  <span style={{ fontSize: '12px', color: DA.copper, fontWeight: '800' }}>
                    {m.quantidade} livro{m.quantidade !== 1 ? 's' : ''}{m.paginas > 0 && ` · ${m.paginas.toLocaleString('pt-BR')} pág.`}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {m.livros.map(l => (
                    <span key={l.id} style={{
                      fontSize: '11px', fontWeight: '700', color: DA.walnut,
                      background: 'rgba(255,255,255,0.8)', border: `1px solid ${DA.warmBeige}`,
                      borderRadius: '999px', padding: '4px 10px',
                    }}>
                      {l.titulo}{Number(l.nota) > 0 ? ` ${'⭐'.repeat(Math.min(5, Number(l.nota)))}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Painel>
      )}

      {/* Gêneros e autores */}
      {(stats.generos.length > 0 || stats.autores.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {stats.generos.length > 0 && (
            <Painel titulo="🏷️ Gêneros mais lidos" DA={DA}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats.generos.slice(0, 5).map(g => {
                  const pct = Math.round((g.quantidade / stats.generos[0].quantidade) * 100);
                  return (
                    <div key={g.nome}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', color: DA.espresso }}>{g.nome}</span>
                        <span style={{ color: DA.walnut, fontWeight: '600' }}>
                          {g.quantidade}{g.notaMedia > 0 && ` · ${g.notaMedia}★`}
                        </span>
                      </div>
                      <div style={{ background: `${DA.warmBeige}55`, borderRadius: '999px', height: '9px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${DA.oxblood}, ${DA.burntOrange})`, transition: 'width .5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Painel>
          )}

          {stats.autores.length > 0 && (
            <Painel titulo="✍️ Autores mais lidos" DA={DA}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.autores.slice(0, 5).map((a, i) => (
                  <div key={a.nome} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '9px 12px', borderRadius: '10px', background: DA.cream,
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: DA.copper, width: '20px' }}>{i + 1}º</span>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: DA.espresso, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
                    <span style={{ fontSize: '12px', color: DA.walnut, fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {a.quantidade}{a.notaMedia > 0 && ` · ${a.notaMedia}★`}
                    </span>
                  </div>
                ))}
              </div>
            </Painel>
          )}
        </div>
      )}

      {/* Hábitos gerais (toda a estante, não só o ano) */}
      <Painel titulo="🔍 Panorama da estante" DA={DA}>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
          <Destaque valor={`${stats.taxaConclusao}%`} rotulo="Taxa de conclusão" sub={`${stats.lidos} de ${stats.total}`} cor={DA.teal} DA={DA} />
          <Destaque valor={`${stats.taxaAbandono}%`} rotulo="Taxa de abandono" sub={`${stats.abandonei} abandonados`} cor={DA.oxblood} DA={DA} />
          <Destaque valor={stats.notaMedia || '—'} rotulo="Nota média" sub="dos livros lidos" cor={DA.mustard} DA={DA} />
          <Destaque valor={stats.lendo} rotulo="Lendo agora" sub={`${stats.queroLer} na fila`} cor={DA.forestGreen} DA={DA} />
        </div>
      </Painel>

      {/* Ponte para a meta anual, que vive na aba Metas */}
      {onIrParaMetas && (
        <button onClick={onIrParaMetas} style={{
          background: 'rgba(245,240,224,0.85)', border: '1px dashed rgba(196,154,108,0.6)',
          borderRadius: '14px', padding: '14px', cursor: 'pointer', fontWeight: '700',
          fontSize: '13px', color: DA.oxblood, fontFamily: 'inherit', width: '100%',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}>
          🎯 Definir e acompanhar sua meta anual em Metas →
        </button>
      )}

      {/* Recomendações personalizadas */}
      <Recomendacoes
        livros={livros}
        DA={DA}
        GRAD_BTN={GRAD_BTN}
        googleBooksKey={googleBooksKey}
        onIrParaAdicionar={onIrParaAdicionar}
        onAdicionarLivro={onAdicionarLivro}
      />
    </div>
  );
}
