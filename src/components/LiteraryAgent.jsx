import React, { useState, useRef, useEffect } from 'react';

export function LiteraryAgent({ livros, DA, GRAD_BTN, googleBooksKey }) {
  const [mensagens, setMensagens] = useState([
    {
      id: 1,
      tipo: 'bot',
      texto: 'Saudações. Sou B.IA, sua Agente Literária Analítica 🧐. Minha função não é apenas catalogar, mas dissecar sua estante com rigor. Estou conectada à internet para buscar resumos e análises profundas. O que vamos analisar hoje?',
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

    if (isStats) {
      const taxaAbandono = (contexto.abandonei / contexto.totalLivros * 100).toFixed(1);
      resposta = `Seus dados quantitativos revelam um acervo de ${contexto.totalLivros} unidades. Analiticamente, sua taxa de conclusão é de ${(contexto.lidos / contexto.totalLivros * 100).toFixed(1)}%. O fato de você ter ${contexto.abandonei} abandonos (${taxaAbandono}%) sugere um filtro crítico rigoroso ou inconsistência na seleção. Qual dessas hipóteses você sustenta?`;
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
    // Tom Crítico para Recomendações
    else if (perguntaLower.includes('recomend') || perguntaLower.includes('próximo')) {
      const generosMaisLidos = contexto.generos.slice(0, 2).join(', ');
      resposta = `Observo uma saturação no gênero ${generosMaisLidos || 'ficção'} em sua estante. Para elevar seu repertório analiticamente, sugiro uma ruptura: procure obras que subvertam essas convenções. Dada a sua tendência a avaliar positivamente autores de ${contexto.generos[0] || 'estilos similares'}, um movimento em direção a clássicos contemporâneos seria uma escolha superior.`;
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
          src="/assets/bia-icon.png" 
          alt="B.IA" 
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
          <img 
            src="/assets/bia-icon.png" 
            alt="B.IA" 
            style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid white', objectFit: 'cover' }} 
          />
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
          placeholder="Ex: 'Resuma [Título]' ou 'Análise de [Título]'..."
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
