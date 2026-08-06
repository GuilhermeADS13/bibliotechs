import React, { useState, useRef, useEffect } from 'react';

export function LiteraryAgent({ livros, DA, GRAD_BTN }) {
  const [mensagens, setMensagens] = useState([
    {
      id: 1,
      tipo: 'bot',
      texto: 'Saudações. Sou seu Crítico Literário Analítico 🧐. Minha função não é apenas catalogar, mas dissecar sua estante com rigor. Estou pronto para fornecer resumos estruturados e análises profundas sobre suas leituras. O que vamos analisar hoje?',
      timestamp: new Date()
    }
  ]);
  const [entrada, setEntrada] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Preparar contexto da estante para o agente
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

  // Simular resposta do agente com tom CRÍTICO e ANALÍTICO
  const gerarRespostaAgente = async (pergunta) => {
    const contexto = prepararContextoEstante();
    const perguntaLower = pergunta.toLowerCase();
    let resposta = '';

    // FUNCIONALIDADE: Resumo Automático
    if (perguntaLower.includes('resumo') || perguntaLower.includes('resumir')) {
      const livroParaResumir = livros.find(l => 
        perguntaLower.includes(l.titulo.toLowerCase()) || 
        (l.autor && perguntaLower.includes(l.autor.toLowerCase()))
      );

      if (livroParaResumir) {
        resposta = `### Análise Sintética: "${livroParaResumir.titulo}"\n\n` +
          `**Visão Geral:** Esta obra de ${livroParaResumir.autor || 'autor desconhecido'} insere-se no gênero ${livroParaResumir.genero || 'não especificado'}. \n\n` +
          `**Resumo Analítico:** O texto explora a dialética entre seus temas centrais, apresentando uma narrativa que desafia a percepção do leitor sobre o gênero. Sob uma lente crítica, a estrutura da obra sugere uma tentativa de romper com tropos convencionais, embora sua eficácia dependa da profundidade da sua resenha pessoal.\n\n` +
          `**Veredito do Crítico:** Você atribuiu uma nota ${livroParaResumir.nota}/5. Do ponto de vista técnico, essa avaliação indica que a obra ${livroParaResumir.nota >= 4 ? 'alcançou uma excelência formal notável' : 'apresenta falhas estruturais ou narrativas que limitaram seu impacto'}.`;
      } else {
        resposta = `Você solicitou um resumo, mas não identifiquei uma obra específica da sua estante na sua mensagem. Por favor, especifique o título do livro que deseja que eu disseque.`;
      }
    } 
    // Tom Crítico para Recomendações
    else if (perguntaLower.includes('recomend') || perguntaLower.includes('próximo')) {
      const generosMaisLidos = contexto.generos.slice(0, 2).join(', ');
      resposta = `Observo uma saturação no gênero ${generosMaisLidos || 'ficção'} em sua estante. Para elevar seu repertório, eu sugeriria uma ruptura: procure obras que subvertam essas convenções. Dada a sua tendência a avaliar positivamente autores de ${contexto.generos[0] || 'estilos similares'}, um movimento em direção a clássicos contemporâneos seria uma escolha analiticamente superior.`;
    } 
    // Tom Crítico para Estatísticas
    else if (perguntaLower.includes('estatístic') || perguntaLower.includes('quantos')) {
      const taxaAbandono = (contexto.abandonei / contexto.totalLivros * 100).toFixed(1);
      resposta = `Seus dados quantitativos revelam um acervo de ${contexto.totalLivros} unidades. Analiticamente, sua taxa de conclusão é de ${(contexto.lidos / contexto.totalLivros * 100).toFixed(1)}%. O fato de você ter ${contexto.abandonei} abandonos (${taxaAbandono}%) sugere um filtro crítico rigoroso ou uma inconsistência na seleção de obras. Qual dessas hipóteses você sustenta?`;
    }
    // Resposta Padrão Analítica
    else {
      resposta = `Sua indagação sobre "${pergunta}" requer uma análise cuidadosa. Considerando sua estante de ${contexto.totalLivros} obras, percebo padrões de consumo literário que merecem escrutínio. Você deseja uma análise de tendências, um resumo técnico de uma obra específica ou uma crítica sobre suas metas de leitura?`;
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
    }, 800);
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
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: GRAD_BTN,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 4px 20px rgba(107,30,42,0.4)',
          transition: 'transform .2s, box-shadow .2s',
          zIndex: 999,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(107,30,42,0.5)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(107,30,42,0.4)';
        }}
        title="Abrir Crítico Literário"
      >
        🧐
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
          padding: '16px',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: '800',
          fontSize: '15px',
        }}
      >
        <span>🧐 Crítico Literário Analítico</span>
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
          placeholder="Ex: 'Resuma o livro X' ou 'Análise minha estante'..."
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
