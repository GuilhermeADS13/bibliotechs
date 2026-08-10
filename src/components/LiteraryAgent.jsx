import React, { useState, useRef, useEffect } from 'react';
import { calcularEstatisticas, resumoMensalTexto, MESES_LONGOS } from '../estatisticas';
import { gerarRecomendacoes } from '../recomendacoes';
import { BiaAvatar } from './BiaAvatar';

export function LiteraryAgent({ livros, DA, GRAD_BTN, googleBooksKey }) {
  const [mensagens, setMensagens] = useState([
    {
      id: 1,
      tipo: 'bot',
      texto: 'Saudações. Sou B.IA, sua Agente Literária Analítica 🧐. Minha função não é apenas catalogar, mas dissecar sua estante com rigor. Analiso seu ritmo mensal, recomendo obras a partir do seu histórico e busco resumos na internet. O que vamos analisar hoje?',
      timestamp: new Date()
    }
  ]);
  const [entrada, setEntrada] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Buscar informações do livro na Google Books API
  const buscarLivroNaInternet = async (titulo, autor = '') => {
    try {
      const queryParts = [];
      if (titulo.trim().length >= 2) queryParts.push(`intitle:${titulo}`);
      if (autor.trim().length >= 2) queryParts.push(`inauthor:${autor}`);
      
      if (queryParts.length === 0) return null;

      const q = queryParts.join('+');
      const keyParam = googleBooksKey ? `&key=${googleBooksKey}` : '';
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1${keyParam}`;

      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      const item = data.items?.[0];
      
      if (!item) return null;

      return {
        titulo: item.volumeInfo.title || titulo,
        autor: item.volumeInfo.authors?.join(', ') || autor || 'Desconhecido',
        descricao: item.volumeInfo.description || 'Descrição não disponível',
        paginas: item.volumeInfo.pageCount || 'N/A',
        genero: item.volumeInfo.categories?.[0] || 'Não especificado',
        dataPublicacao: item.volumeInfo.publishedDate || 'N/A',
        editora: item.volumeInfo.publisher || 'N/A',
        capa: item.volumeInfo.imageLinks?.thumbnail || null,
        linguagem: item.volumeInfo.language || 'pt',
        ratingMedio: item.volumeInfo.averageRating || 'N/A'
      };
    } catch (e) {
      console.error('Erro ao buscar livro na API:', e);
      return null;
    }
  };

  // Preparar contexto da estante
  const prepararContextoEstante = () => {
    const stats = {
      totalLivros: livros.length,
      lidos: livros.filter(l => l.status === 'lido').length,
      lendo: livros.filter(l => l.status === 'lendo').length,
      queroLer: livros.filter(l => l.status === 'quero-ler').length,
      abandonei: livros.filter(l => l.status === 'abandonei').length,
      generos: [...new Set(livros.map(l => l.genero).filter(Boolean))],
      autores: [...new Set(livros.map(l => l.autor).filter(Boolean))],
      livrosRecentes: livros
        .filter(l => l.dataTermino)
        .sort((a, b) => new Date(b.dataTermino) - new Date(a.dataTermino))
        .slice(0, 5)
        .map(l => ({ titulo: l.titulo, autor: l.autor, nota: l.nota }))
    };
    return stats;
  };

  // Gerar resposta com tom crítico e analítico
  const gerarRespostaAgente = async (pergunta) => {
    const contexto = prepararContextoEstante();
    const perguntaLower = pergunta.toLowerCase();
    let resposta = '';

    // FUNCIONALIDADE: Resumo com dados da internet
    const isResumo = perguntaLower.includes('resumo') || perguntaLower.includes('resuma') || perguntaLower.includes('resumir') || perguntaLower.includes('análise');
    
    // Tom Crítico para Estatísticas (Prioridade sobre Resumo se contiver palavras-chave)
    const isStats = perguntaLower.includes('estatístic') || perguntaLower.includes('quantos');

    // Análise temporal — tem prioridade sobre estatísticas gerais, pois "quantos
    // livros li por mês" dispara as duas condições.
    const isMensal = perguntaLower.includes('por mês') || perguntaLower.includes('por mes')
      || perguntaLower.includes('mensal') || perguntaLower.includes('ritmo')
      || perguntaLower.includes('cada mês') || perguntaLower.includes('cada mes');

    if (isMensal) {
      const stats = calcularEstatisticas(livros, new Date().getFullYear());
      resposta = `### 📅 Análise Temporal de ${stats.ano}\n\n${resumoMensalTexto(stats)}`;

      if (stats.totalNoAno > 0) {
        const linhas = stats.porMes
          .filter(m => m.quantidade > 0)
          .map(m => `- **${m.nomeLongo}**: ${m.quantidade} ${m.quantidade === 1 ? 'livro' : 'livros'}${m.paginas > 0 ? ` (${m.paginas.toLocaleString('pt-BR')} pág.)` : ''}`);
        resposta += `\n\n**Distribuição mensal:**\n${linhas.join('\n')}`;

        if (stats.sequenciaAtual > 1) {
          resposta += `\n\nRegistro uma sequência de ${stats.sequenciaAtual} meses consecutivos com leitura — consistência é mais relevante que volume esporádico.`;
        } else if (stats.mesesAtivos > 1) {
          resposta += `\n\nSua distribuição é intermitente. Regularidade produziria resultados superiores ao acúmulo concentrado.`;
        }
      }
      resposta += `\n\nConsulte a aba **📊 Estatísticas** para o gráfico completo.`;
    }
    else if (isStats) {
      const stats = calcularEstatisticas(livros, new Date().getFullYear());
      resposta = `Seus dados quantitativos revelam um acervo de ${contexto.totalLivros} unidades. Analiticamente, sua taxa de conclusão é de ${stats.taxaConclusao}%. O fato de você ter ${contexto.abandonei} abandonos (${stats.taxaAbandono}%) sugere um filtro crítico rigoroso ou inconsistência na seleção. Qual dessas hipóteses você sustenta?`;

      if (stats.totalNoAno > 0) {
        resposta += `\n\nNo recorte de ${stats.ano}: ${stats.totalNoAno} ${stats.totalNoAno === 1 ? 'obra concluída' : 'obras concluídas'}, média de ${stats.mediaMensal} por mês ativo${stats.melhorMes ? `, com pico em ${stats.melhorMes.nomeLongo}` : ''}.`;
      }
      if (stats.notaMedia > 0) {
        resposta += ` Sua nota média é ${stats.notaMedia}/5 — ${stats.notaMedia >= 4.5 ? 'generosidade avaliativa que merece questionamento' : stats.notaMedia >= 3.5 ? 'um padrão equilibrado' : 'um rigor considerável'}.`;
      }
    }
    else if (isResumo) {
      // Tentar extrair título e autor da pergunta primeiro
      let tituloExtraido = '';
      let autorExtraido = '';
      
      // Regex melhorada para capturar o que vem depois das palavras-chave
      const match = pergunta.match(/(?:resumo|resuma|resumir|análise)\s+['""]?([^'""\n]+?)['""]?(?:\s+de\s+([^,\n]+))?$/i);
      if (match) {
        tituloExtraido = match[1].trim();
        autorExtraido = match[2]?.trim() || '';
      }

      // Tentar encontrar na estante local para complementar dados
      let livroParaResumir = livros.find(l => 
        (tituloExtraido && l.titulo.toLowerCase().includes(tituloExtraido.toLowerCase())) ||
        perguntaLower.includes(l.titulo.toLowerCase())
      );

      const titulo = tituloExtraido || livroParaResumir?.titulo;
      const autor = autorExtraido || livroParaResumir?.autor;

      if (!titulo) {
        resposta = `Você solicitou uma análise, mas não identifiquei uma obra específica. Por favor, especifique: "Resuma o livro [Título]" ou "Análise de [Título] de [Autor]".`;
      } else {
        // Buscar na internet
        const infoLivro = await buscarLivroNaInternet(titulo, autor);

        if (infoLivro) {
          resposta = `### 📖 Análise Crítica: "${infoLivro.titulo}"\n\n` +
            `**Metadados Técnicos:**\n` +
            `- Autor: ${infoLivro.autor}\n` +
            `- Gênero: ${infoLivro.genero}\n` +
            `- Páginas: ${infoLivro.paginas}\n` +
            `- Editora: ${infoLivro.editora}\n` +
            `- Publicação: ${infoLivro.dataPublicacao}\n` +
            `- Avaliação Média (Google Books): ${infoLivro.ratingMedio}/5\n\n` +
            `**Sinopse Oficial:**\n${infoLivro.descricao}\n\n` +
            `**Análise Crítica Personalizada:**\n` +
            `Esta obra insere-se no gênero ${infoLivro.genero}, apresentando uma estrutura narrativa que merece escrutínio rigoroso. `;
          
          // Adicionar análise personalizada se o livro está na estante
          if (livroParaResumir) {
            resposta += `Você atribuiu a nota ${livroParaResumir.nota}/5, sugerindo que a obra ${livroParaResumir.nota >= 4 ? 'alcançou uma excelência formal notável' : livroParaResumir.nota >= 3 ? 'apresenta méritos com ressalvas estruturais' : 'possui limitações significativas em sua execução'}.`;
          }
        } else {
          resposta = `A busca na Google Books API não retornou resultados para "${titulo}". Verifique o título ou tente com um autor diferente.`;
        }
      }
    } 
    // Recomendações personalizadas a partir do histórico real
    else if (perguntaLower.includes('recomend') || perguntaLower.includes('próximo')
      || perguntaLower.includes('proximo') || perguntaLower.includes('sugest')
      || perguntaLower.includes('o que ler') || perguntaLower.includes('que eu leio')) {

      const { recomendacoes, perfil, motivo } = await gerarRecomendacoes(livros, {
        googleBooksKey,
        limite: 4,
      });

      if (motivo === 'sem-historico') {
        resposta = `Não posso recomendar sem base empírica. Sua estante não registra obras concluídas. Marque ao menos um livro como "lido" e atribua uma nota — só então minhas sugestões terão fundamento.`;
      } else if (motivo === 'sem-generos') {
        resposta = `Seus livros lidos não têm gênero nem autor preenchidos. Sem esses metadados, qualquer recomendação seria arbitrária. Complete os campos na aba Adicionar.`;
      } else if (recomendacoes.length === 0) {
        resposta = `A busca não retornou títulos fora do seu acervo. Isso pode indicar cobertura limitada da API para os gêneros que você frequenta — ou que seu repertório já os esgotou.`;
      } else {
        const generos = perfil.generosFavoritos.slice(0, 2).map(g => g.nome).join(' e ');
        resposta = `### 📚 Recomendações Baseadas no Seu Histórico\n\n`
          + `Analisei suas ${perfil.totalLidos} ${perfil.totalLidos === 1 ? 'leitura concluída' : 'leituras concluídas'}. `
          + `Sua preferência recai sobre ${generos || 'gêneros variados'}`
          + `${perfil.notaMedia > 0 ? `, com nota média de ${perfil.notaMedia}/5` : ''}. Seleção:\n\n`
          + recomendacoes.map((r, i) =>
              `**${i + 1}. ${r.titulo}**\n`
              + `- Autor: ${r.autor}${r.ano ? ` (${r.ano})` : ''}\n`
              + `${r.ratingMedio > 0 ? `- Avaliação: ${r.ratingMedio}/5\n` : ''}`
              + `- Critério: ${r.motivo}`
            ).join('\n\n');
        resposta += `\n\nAdvertência analítica: recomendar pelo que você já aprova reforça seus vieses. A aba **📊 Estatísticas** mostra a lista completa — considere também romper com o padrão.`;
      }
    }

    // Resposta Padrão Analítica
    else {
      resposta = `Sua indagação sobre "${pergunta}" requer análise cuidadosa. Considerando sua estante de ${contexto.totalLivros} obras, percebo padrões de consumo que merecem escrutínio. Você deseja uma análise de tendências, um resumo técnico de uma obra específica ou uma crítica sobre suas metas?`;
    }

    return resposta;
  };

  const enviarMensagem = async () => {
    if (!entrada.trim()) return;

    const novaMensagemUsuario = {
      id: Date.now(),
      tipo: 'usuario',
      texto: entrada,
      timestamp: new Date()
    };

    setMensagens(prev => [...prev, novaMensagemUsuario]);
    setEntrada('');
    setCarregando(true);

    setTimeout(async () => {
      const respostaTexto = await gerarRespostaAgente(entrada);
      
      const novaMensagemBot = {
        id: Date.now() + 1,
        tipo: 'bot',
        texto: respostaTexto,
        timestamp: new Date()
      };

      setMensagens(prev => [...prev, novaMensagemBot]);
      setCarregando(false);
    }, 1200);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  if (!expandido) {
    return (
      <button
        onClick={() => setExpandido(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '66px',
          height: '66px',
          borderRadius: '50%',
          background: 'white',
          border: `3px solid ${DA.oxblood}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(107,30,42,0.35)',
          transition: 'transform .25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow .2s',
          zIndex: 999,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(107,30,42,0.45)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(107,30,42,0.35)';
        }}
        title="Abrir B.IA"
      >
        <img
          src="/assets/bia-icon.jpg"
          alt="B.IA"
          width="66"
          height="66"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '100%',
        maxWidth: '420px',
        height: '600px',
        background: 'rgba(245,240,224,0.98)',
        borderRadius: '16px',
        boxShadow: '0 12px 48px rgba(44,26,20,0.35)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid rgba(196,154,108,0.3)`,
      }}
    >
      <div
        style={{
          background: GRAD_BTN,
          color: DA.cream,
          padding: '12px 16px',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: '800',
          fontSize: '15px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BiaAvatar size={32} borda />
          <span>B.IA (Online)</span>
        </div>
        <button
          onClick={() => setExpandido(false)}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: DA.cream,
            borderRadius: '6px',
            width: '28px',
            height: '28px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
          }}
        >
          ✕
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: 'rgba(245,240,224,0.5)',
        }}
      >
        {mensagens.map(msg => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.tipo === 'usuario' ? 'flex-end' : 'flex-start',
              animation: 'fadeIn .3s ease forwards',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '12px 14px',
                borderRadius: msg.tipo === 'usuario' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.tipo === 'usuario' 
                  ? `linear-gradient(135deg, ${DA.oxblood}, ${DA.warmBurgundy})`
                  : 'rgba(212,197,169,0.3)',
                color: msg.tipo === 'usuario' ? DA.cream : DA.espresso,
                fontSize: '13px',
                lineHeight: '1.5',
                wordWrap: 'break-word',
                fontWeight: msg.tipo === 'usuario' ? '600' : '500',
                whiteSpace: 'pre-wrap'
              }}
            >
              {msg.texto}
            </div>
          </div>
        ))}

        {carregando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '12px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(212,197,169,0.3)', display: 'flex', gap: '4px' }}>
              <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: '12px',
          borderTop: `1px solid rgba(196,154,108,0.2)`,
          display: 'flex',
          gap: '8px',
          background: 'rgba(245,240,224,0.8)',
          borderRadius: '0 0 16px 16px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Ex: 'Resuma [Título]' ou 'Quantos livros li por mês?'..."
          value={entrada}
          onChange={e => setEntrada(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={carregando}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: `1px solid ${DA.warmBeige}`,
            borderRadius: '8px',
            fontSize: '13px',
            outline: 'none',
            background: 'white',
            color: DA.espresso,
          }}
        />
        <button
          onClick={enviarMensagem}
          disabled={carregando || !entrada.trim()}
          style={{
            background: GRAD_BTN,
            color: DA.cream,
            border: 'none',
            borderRadius: '8px',
            padding: '10px 14px',
            cursor: 'pointer',
            fontWeight: '700',
          }}
        >
          →
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .dot { animation: pulse 1.4s infinite; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
