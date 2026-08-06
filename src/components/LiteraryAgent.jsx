import React, { useState, useRef, useEffect } from 'react';

export function LiteraryAgent({ livros, DA, GRAD_BTN }) {
  const [mensagens, setMensagens] = useState([
    {
      id: 1,
      tipo: 'bot',
      texto: 'Olá! Sou seu Agente Literário 📚✨ Estou aqui para explorar sua estante, dar recomendações inteligentes e ajudar você a descobrir conexões entre seus livros. O que gostaria de saber sobre sua leitura?',
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

  // Simular resposta do agente (em produção, seria uma chamada à API do Gemma 4)
  const gerarRespostaAgente = async (pergunta) => {
    const contexto = prepararContextoEstante();
    
    // Exemplos de padrões de resposta baseados na pergunta
    const perguntaLower = pergunta.toLowerCase();
    
    let resposta = '';

    if (perguntaLower.includes('recomend') || perguntaLower.includes('próximo')) {
      const generosMaisLidos = contexto.generos.slice(0, 2).join(', ');
      resposta = `Com base na sua estante, você tem uma forte preferência por ${generosMaisLidos || 'ficção'}. Considerando seus últimos livros lidos e suas notas, recomendo explorar autores que combinam esses gêneros com narrativas envolventes. Você já leu algo de autores que exploram temas similares aos seus favoritos?`;
    } else if (perguntaLower.includes('estatístic') || perguntaLower.includes('quantos')) {
      resposta = `Sua estante tem ${contexto.totalLivros} livros no total! 📊 Você já leu ${contexto.lidos} livros, está lendo ${contexto.lendo} no momento, tem ${contexto.queroLer} na fila e abandonou ${contexto.abandonei}. Que ritmo de leitura impressionante!`;
    } else if (perguntaLower.includes('gênero') || perguntaLower.includes('tipo')) {
      const generos = contexto.generos.slice(0, 5).join(', ');
      resposta = `Você tem uma diversidade interessante! Seus principais gêneros incluem: ${generos || 'variados'}. Isso mostra um leitor eclético com curiosidade por diferentes perspectivas e narrativas.`;
    } else if (perguntaLower.includes('favorit') || perguntaLower.includes('melhor')) {
      const livrosMelhoresNotas = livros
        .filter(l => l.nota >= 4)
        .sort((a, b) => b.nota - a.nota)
        .slice(0, 3);
      if (livrosMelhoresNotas.length > 0) {
        const titulos = livrosMelhoresNotas.map(l => `"${l.titulo}" (${l.nota}/5)`).join(', ');
        resposta = `Seus favoritos parecem ser: ${titulos}. Esses livros receberam as melhores notas! Há padrões interessantes neles que poderiam guiar futuras recomendações.`;
      } else {
        resposta = `Ainda não há livros com notas altas na sua estante. Continue lendo e avaliando — suas preferências se tornarão mais claras!`;
      }
    } else if (perguntaLower.includes('conexão') || perguntaLower.includes('relação')) {
      const autoresComMuitosLivros = contexto.autores.filter(a => 
        livros.filter(l => l.autor === a).length > 1
      );
      if (autoresComMuitosLivros.length > 0) {
        resposta = `Você é fã de ${autoresComMuitosLivros.join(', ')}! Esses autores aparecem múltiplas vezes na sua estante, o que sugere uma conexão temática ou estilística que você aprecia.`;
      } else {
        resposta = `Você tem uma estante muito diversa com autores únicos. Isso é ótimo para explorar diferentes perspectivas! Gostaria de descobrir autores que combinam estilos que você já apreciou?`;
      }
    } else if (perguntaLower.includes('próxim') || perguntaLower.includes('lendo agora')) {
      const lendoAgora = livros.filter(l => l.status === 'lendo');
      if (lendoAgora.length > 0) {
        const titulos = lendoAgora.map(l => `"${l.titulo}" de ${l.autor}`).join(' e ');
        resposta = `Você está lendo ${titulos}. Que emocionante! Como está sendo a experiência? Gostaria de explorar temas similares para depois?`;
      } else {
        resposta = `Você não está lendo nada no momento. Que tal começar algo novo? Posso ajudar a escolher baseado em seus favoritos anteriores!`;
      }
    } else {
      resposta = `Que pergunta interessante! 🤔 Com base na sua estante de ${contexto.totalLivros} livros, posso dizer que você é um leitor apaixonado. Você está buscando recomendações, análises, conexões entre livros ou algo mais específico? Conte-me mais!`;
    }

    return resposta;
  };

  const enviarMensagem = async () => {
    if (!entrada.trim()) return;

    // Adicionar mensagem do usuário
    const novaMensagemUsuario = {
      id: Date.now(),
      tipo: 'usuario',
      texto: entrada,
      timestamp: new Date()
    };

    setMensagens(prev => [...prev, novaMensagemUsuario]);
    setEntrada('');
    setCarregando(true);

    // Simular delay de processamento
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

  // Se não expandido, mostrar apenas o botão flutuante
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
        title="Abrir Agente Literário"
      >
        📚
      </button>
    );
  }

  // Janela expandida do chat
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
      {/* Header */}
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
        <span>📚 Agente Literário</span>
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
            transition: 'background .2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
        >
          ✕
        </button>
      </div>

      {/* Mensagens */}
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
              }}
            >
              {msg.texto}
            </div>
          </div>
        ))}

        {carregando && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: 'rgba(212,197,169,0.3)',
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '12px', color: DA.espresso, animation: 'pulse 1.4s infinite' }}>●</span>
              <span style={{ fontSize: '12px', color: DA.espresso, animation: 'pulse 1.4s infinite 0.2s' }}>●</span>
              <span style={{ fontSize: '12px', color: DA.espresso, animation: 'pulse 1.4s infinite 0.4s' }}>●</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
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
          placeholder="Faça uma pergunta..."
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
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color .2s',
            background: 'white',
            color: DA.espresso,
          }}
          onFocus={e => e.target.style.borderColor = DA.copper}
          onBlur={e => e.target.style.borderColor = DA.warmBeige}
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
            cursor: carregando || !entrada.trim() ? 'not-allowed' : 'pointer',
            fontWeight: '700',
            fontSize: '13px',
            opacity: carregando || !entrada.trim() ? 0.6 : 1,
            transition: 'opacity .2s, transform .2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={e => {
            if (!carregando && entrada.trim()) {
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          →
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
