import React, { useEffect, useMemo, useRef, useState } from 'react';
import { gerarRecomendacoes, chaveTitulo, lerVistas, registrarVistas } from '../recomendacoes';
import { sugerirAutoresParecidos, mensagemDeFalha } from '../bia';
import { CapaLivro } from './CapaLivro';

const GLASS_PANEL = 'rgba(245,240,224,0.85)';
const PANEL_SHADOW = '0 18px 60px rgba(131,84,30,0.18)';
const POR_PAGINA = 6;

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
  'sem-favoritos': {
    emoji: '⭐',
    titulo: 'Ainda não sei do que você gosta',
    texto: 'Suas leituras até aqui receberam notas baixas. Dê nota 4 ou 5 aos livros de que gostou e eu busco outros parecidos.',
  },
  'sem-resultados': {
    emoji: '🔍',
    titulo: 'Nada novo encontrado',
    texto: 'A busca não trouxe títulos fora da sua estante. Tente novamente mais tarde ou adicione livros de outros gêneros.',
  },
};

const ERRO_BUSCA = 'A busca de livros não respondeu agora — pode ser o limite diário da Google Books ou a conexão. Tente de novo daqui a pouco.';

// Cache da sessão, fora do componente: a aba desmonta a cada troca, e cada
// visita refazia quatro buscas na Google Books — cuja cota diária já estourou
// mais de uma vez. A chave é a assinatura do perfil, então avaliar um livro
// invalida o cache sozinho.
const cache = new Map();
const MAX_CACHE = 10;

function guardar(chave, valor) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(chave, { ...cache.get(chave), ...valor });
}

/** Só para os testes: cada um começa sem o que o anterior buscou. */
export function limparCacheRecomendacoes() {
  cache.clear();
}

// A descrição da Google Books às vezes vem com HTML (<p>, <b>, <br>).
const textoPuro = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function Recomendacoes({ livros, DA, GRAD_BTN, googleBooksKey, onIrParaAdicionar, onAdicionarLivro }) {
  const [fila, setFila]           = useState([]);
  const [perfil, setPerfil]       = useState(null);
  const [motivo, setMotivo]       = useState('sem-historico');
  const [fonte, setFonte]         = useState('');
  const [pagina, setPagina]       = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]           = useState('');
  const [recarregar, setRecarregar] = useState(0);
  const [autores, setAutores]     = useState({ estado: 'inicial', lista: [], mensagem: '' });
  // Títulos que a pessoa acabou de mandar para a estante nesta visita.
  const [adicionados, setAdicionados] = useState({});
  const abortRef = useRef(null);
  const abortAutoresRef = useRef(null);
  const forcarBusca = useRef(false);
  // O efeito não depende de `livros` direto (ver `assinatura` abaixo), mas a
  // busca precisa da lista atual para não recomendar o que já está lá.
  const livrosRef = useRef(livros);
  livrosRef.current = livros;

  // Só o que muda a RECOMENDAÇÃO entra aqui. Adicionar um livro em "quero
  // ler" não altera o perfil de leitura (peso 0 no cálculo), então não deve
  // refazer a busca — senão a lista se reorganizava embaixo do dedo de quem
  // acabou de clicar em adicionar, e ainda gastava chamadas na Google Books.
  const assinatura = useMemo(
    () => (Array.isArray(livros) ? livros : [])
      .filter(l => l?.status === 'lido' || l?.status === 'abandonei')
      .map(l => `${l.titulo}|${l.status}|${l.nota}|${l.genero}|${l.autor}`)
      .sort()
      .join(';'),
    [livros]
  );
  const chaveCache = `${assinatura}|${googleBooksKey || ''}`;

  // O que já está na estante sai da fila — inclusive o que foi adicionado em
  // outra visita, já que a fila pode ter vindo do cache. O que foi adicionado
  // AGORA fica, mostrando "✓ Na estante", para a página não pular sob o clique.
  const naEstante = useMemo(
    () => new Set((Array.isArray(livros) ? livros : []).map(l => chaveTitulo(l?.titulo)).filter(Boolean)),
    [livros]
  );
  const visiveis = useMemo(
    () => fila.filter(l => adicionados[l.titulo] || !naEstante.has(chaveTitulo(l.titulo))),
    [fila, naEstante, adicionados]
  );
  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  const paginaAtual = pagina % totalPaginas;
  const itens = visiveis.slice(paginaAtual * POR_PAGINA, (paginaAtual + 1) * POR_PAGINA);

  const adicionar = async (livro) => {
    if (!onAdicionarLivro || adicionados[livro.titulo]) return;
    // Marca antes de gravar: o clique tem de responder na hora. Se falhar,
    // desmarca — o alerta do erro vem de quem grava.
    setAdicionados(a => ({ ...a, [livro.titulo]: true }));
    try {
      await onAdicionarLivro({
        titulo: livro.titulo,
        autor: livro.autor === 'Desconhecido' ? '' : livro.autor,
        genero: livro.genero || '',
        paginas: livro.paginas || '',
        capa: livro.capa || '',
        status: 'quero-ler',
        dataTermino: '',
        nota: 0,
      });
    } catch {
      setAdicionados(a => ({ ...a, [livro.titulo]: false }));
    }
  };

  const outrasSugestoes = () => {
    const proxima = (paginaAtual + 1) % totalPaginas;
    setPagina(proxima);
    guardar(chaveCache, { pagina: proxima });
  };

  const tentarDeNovo = () => {
    forcarBusca.current = true;
    setRecarregar(v => v + 1);
  };

  useEffect(() => {
    const salvo = forcarBusca.current ? null : cache.get(chaveCache);
    forcarBusca.current = false;

    const aplicar = (r, paginaSalva = 0) => {
      setFila(r.fila || r.recomendacoes || []);
      setPerfil(r.perfil);
      setMotivo(r.motivo);
      setFonte(r.fonte || '');
      setPagina(paginaSalva);
      setErro(r.motivo === 'falha-busca' ? ERRO_BUSCA : '');
    };

    if (salvo?.resultado) {
      aplicar(salvo.resultado, salvo.pagina || 0);
      setAutores(salvo.autores ? { estado: 'ok', lista: salvo.autores, mensagem: '' } : { estado: 'inicial', lista: [], mensagem: '' });
      setCarregando(false);
      return undefined;
    }

    // Cancela a busca anterior se a estante mudar antes de a resposta chegar.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let ativo = true;
    setCarregando(true);
    setErro('');
    setAutores({ estado: 'inicial', lista: [], mensagem: '' });

    gerarRecomendacoes(livrosRef.current, { googleBooksKey, limite: POR_PAGINA, sinal: controller.signal, vistas: lerVistas() })
      .then(r => {
        if (!ativo) return;
        aplicar(r);
        // Falha não vai para o cache: a próxima visita deve tentar de novo.
        if (r.motivo !== 'falha-busca') guardar(chaveCache, { resultado: r, pagina: 0, autores: null });
      })
      .catch(e => {
        if (!ativo || e.name === 'AbortError') return;
        console.error('Falha ao gerar recomendações:', e);
        setErro(ERRO_BUSCA);
      })
      .finally(() => { if (ativo) setCarregando(false); });

    return () => { ativo = false; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveCache, recarregar]);

  useEffect(() => () => abortAutoresRef.current?.abort(), []);

  // O que apareceu na tela vai para o fim da fila na próxima visita — é o que
  // impede a aba de abrir sempre com os mesmos seis livros.
  const titulosNaTela = itens.map(l => l.titulo).join('|');
  useEffect(() => {
    if (!carregando && titulosNaTela) registrarVistas(titulosNaTela.split('|'));
  }, [carregando, titulosNaTela]);

  const pedirAutores = async () => {
    abortAutoresRef.current?.abort();
    const controller = new AbortController();
    abortAutoresRef.current = controller;
    setAutores({ estado: 'carregando', lista: [], mensagem: '' });

    const r = await sugerirAutoresParecidos(livrosRef.current, { googleBooksKey, sinal: controller.signal });
    if (controller.signal.aborted) return;

    if (r.autores.length > 0) {
      setAutores({ estado: 'ok', lista: r.autores, mensagem: '' });
      guardar(chaveCache, { autores: r.autores });
    } else {
      const mensagem = r.erro === 'nada-confirmado'
        ? 'A B.IA sugeriu alguns nomes, mas não consegui confirmar nenhum na Google Books. Tente de novo.'
        : r.erro === 'precisa-login'
          ? 'Entre com sua conta Google para pedir sugestões à B.IA — as recomendações acima continuam funcionando sem login.'
          : mensagemDeFalha(r.erro);
      setAutores({ estado: 'erro', lista: [], mensagem });
    }
  };

  const vazio = MENSAGENS_VAZIO[motivo] || MENSAGENS_VAZIO['sem-resultados'];
  // Sem gênero útil (ex.: tudo "Fiction"), o perfil se apoia nos autores — e o
  // cabeçalho sumia, como se a recomendação não tivesse base nenhuma.
  const baseDoPerfil = perfil?.generosFavoritos?.length ? perfil.generosFavoritos : (perfil?.autoresFavoritos || []);
  const mostrarAutores = !carregando && perfil?.autoresFavoritos?.length > 0;

  const botaoContorno = (cor, ocupado = false) => ({
    fontSize: '12px', color: cor, background: 'none',
    border: `1px solid ${cor}`, borderRadius: '8px', padding: '5px 12px',
    cursor: ocupado ? 'wait' : 'pointer', fontWeight: '700', opacity: ocupado ? 0.6 : 1,
    fontFamily: 'inherit',
  });

  const botaoQueroLer = (titulo) => ({
    marginTop: '8px', alignSelf: 'flex-start',
    fontSize: '11px', fontWeight: '800',
    padding: '5px 10px', borderRadius: '8px', fontFamily: 'inherit',
    cursor: adicionados[titulo] ? 'default' : 'pointer',
    border: `1px solid ${adicionados[titulo] ? DA.teal : DA.oxblood}`,
    background: adicionados[titulo] ? `${DA.teal}18` : 'transparent',
    color: adicionados[titulo] ? DA.teal : DA.oxblood,
  });

  return (
    <div style={{
      background: GLASS_PANEL, borderRadius: '18px', padding: '26px',
      boxShadow: PANEL_SHADOW, border: '1px solid rgba(196,154,108,0.4)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <h3 style={{ fontWeight: '800', fontSize: '16px', color: DA.espresso }}>✨ Recomendado para você</h3>
        {(carregando || totalPaginas > 1) && (
          <button onClick={outrasSugestoes} disabled={carregando} style={botaoContorno(DA.oxblood, carregando)}>
            {carregando ? '⏳ Buscando...' : `🔄 Outras sugestões (${paginaAtual + 1}/${totalPaginas})`}
          </button>
        )}
      </div>

      {baseDoPerfil.length > 0 && (
        <p style={{ fontSize: '12px', color: DA.walnut, opacity: 0.85, marginBottom: '18px' }}>
          Baseado em {perfil.totalLidos} livro{perfil.totalLidos !== 1 ? 's' : ''} lido{perfil.totalLidos !== 1 ? 's' : ''}
          {' · '}você gosta de{' '}
          <strong style={{ color: DA.copper }}>
            {baseDoPerfil.slice(0, 2).map(g => g.nome).join(' e ')}
          </strong>
        </p>
      )}

      {erro && !carregando && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 14px', background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '10px', fontSize: '13px', color: '#c0392b', fontWeight: '600' }}>
          <span>⚠️ {erro}</span>
          <button onClick={tentarDeNovo} style={botaoContorno('#c0392b')}>Tentar de novo</button>
        </div>
      )}

      {carregando && (
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

      {!erro && !carregando && fonte && itens.length > 0 && (
        <p style={{ fontSize: '11px', color: DA.walnut, opacity: 0.8, marginBottom: '12px' }}>
          A Google Books não respondeu agora — estas sugestões vieram da {fonte}, que tem menos edições em português.
        </p>
      )}

      {!erro && !carregando && itens.length > 0 && (
        // Até 3 colunas: a página tem 6 livros, e com 4 colunas a segunda
        // linha ficava com dois buracos. O `min(100%, ...)` evita estourar a
        // largura no celular.
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '14px' }}>
          {itens.map(livro => {
            const sinopse = textoPuro(livro.descricao);
            return (
              <div key={livro.id || livro.titulo} style={{
                display: 'flex', gap: '12px', padding: '14px',
                background: DA.cream, borderRadius: '12px',
                border: `1px solid ${DA.warmBeige}`,
              }}>
                <CapaLivro
                  src={livro.capa}
                  titulo={livro.titulo}
                  autor={livro.autor}
                  largura={64}
                  style={{ width: '64px', height: '94px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0, boxShadow: '0 4px 12px rgba(44,26,20,0.15)' }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <p className="titulo-livro" style={{ fontWeight: '800', fontSize: '15px', color: DA.espresso, lineHeight: 1.25, marginBottom: '3px' }}>
                    {livro.titulo}
                  </p>
                  <p style={{ fontSize: '11px', color: DA.walnut, opacity: 0.85, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {livro.autor}{livro.ano && ` · ${livro.ano}`}
                  </p>
                  {livro.ratingMedio > 0 && (
                    <p style={{ fontSize: '11px', color: DA.mustard, fontWeight: '800', marginBottom: '6px' }}>
                      {'⭐'.repeat(Math.round(livro.ratingMedio))} {livro.ratingMedio}/5
                      {livro.totalAvaliacoes > 0 && (
                        <span style={{ color: DA.walnut, fontWeight: '600', opacity: 0.75 }}> ({livro.totalAvaliacoes})</span>
                      )}
                    </p>
                  )}
                  {sinopse && (
                    <p title={sinopse} style={{
                      fontSize: '11px', color: DA.walnut, lineHeight: 1.45, marginBottom: '8px',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {sinopse}
                    </p>
                  )}
                  <p style={{
                    fontSize: '10px', color: DA.copper, fontWeight: '700',
                    background: `${DA.copper}15`, borderRadius: '999px',
                    padding: '3px 8px', display: 'inline-block', alignSelf: 'flex-start', marginTop: 'auto',
                  }}>
                    {livro.motivo}
                  </p>

                  {/* Antes só havia um link para a aba Adicionar, onde a pessoa
                      redigitava tudo o que já estava na tela. */}
                  {onAdicionarLivro && (
                    <button onClick={() => adicionar(livro)} disabled={!!adicionados[livro.titulo]} style={botaoQueroLer(livro.titulo)}>
                      {adicionados[livro.titulo] ? '✓ Na estante' : '+ Quero ler'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* No celular a página vira uma coluna de seis cards, e o botão do topo
          ficava longe de quem chegou ao fim da lista. */}
      {!erro && !carregando && totalPaginas > 1 && (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={outrasSugestoes} style={botaoContorno(DA.oxblood)}>
            Ver outras sugestões →
          </button>
        </div>
      )}

      {/* Com o botão em cada card, o link para a aba Adicionar só faz sentido
          quando o card não pode adicionar sozinho. */}
      {!erro && !carregando && itens.length > 0 && !onAdicionarLivro && onIrParaAdicionar && (
        <p style={{ fontSize: '12px', color: DA.walnut, opacity: 0.8, marginTop: '16px', textAlign: 'center' }}>
          Gostou de algum?{' '}
          <button onClick={onIrParaAdicionar} style={{ background: 'none', border: 'none', color: DA.oxblood, fontWeight: '800', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px', fontSize: '12px' }}>
            Adicione à sua estante
          </button>
        </p>
      )}

      {mostrarAutores && (
        <section aria-label="Autores parecidos" style={{ marginTop: '24px', paddingTop: '20px', borderTop: `1px dashed ${DA.warmBeige}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <h4 style={{ fontWeight: '800', fontSize: '14px', color: DA.espresso, marginBottom: '3px' }}>🤖 Autores parecidos, pela B.IA</h4>
              <p style={{ fontSize: '11px', color: DA.walnut, opacity: 0.8 }}>
                A B.IA sugere a partir dos seus favoritos; cada nome é conferido na Google Books antes de aparecer.
              </p>
            </div>
            <button
              onClick={pedirAutores}
              disabled={autores.estado === 'carregando'}
              style={botaoContorno(DA.copper, autores.estado === 'carregando')}
            >
              {autores.estado === 'carregando' ? '⏳ Pensando...' : autores.estado === 'ok' ? '🔄 Outros autores' : '✨ Pedir à B.IA'}
            </button>
          </div>

          {autores.estado === 'erro' && (
            <p role="status" style={{ fontSize: '12px', color: DA.oxblood, fontWeight: '600' }}>{autores.mensagem}</p>
          )}

          {autores.estado === 'ok' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {autores.lista.map(a => (
                <div key={a.nome} style={{ padding: '14px', background: DA.cream, borderRadius: '12px', border: `1px solid ${DA.warmBeige}` }}>
                  <p style={{ fontWeight: '800', fontSize: '13px', color: DA.espresso, marginBottom: '4px' }}>{a.nome}</p>
                  <p style={{ fontSize: '12px', color: DA.walnut, fontStyle: 'italic', lineHeight: 1.45, marginBottom: '10px' }}>“{a.motivo}”</p>
                  <p style={{ fontSize: '10px', fontWeight: '800', color: DA.copper, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Por onde começar
                  </p>
                  {a.obras.map(o => (
                    <div key={o.titulo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '4px 0' }}>
                      <span style={{ fontSize: '12px', color: DA.espresso, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.titulo}{o.ano ? ` (${o.ano})` : ''}
                      </span>
                      {onAdicionarLivro && (
                        <button
                          onClick={() => adicionar({ titulo: o.titulo, autor: a.nome, genero: o.genero })}
                          disabled={!!adicionados[o.titulo]}
                          aria-label={`Quero ler ${o.titulo}`}
                          style={{ ...botaoQueroLer(o.titulo), marginTop: 0, flexShrink: 0 }}
                        >
                          {adicionados[o.titulo] ? '✓' : '+'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
