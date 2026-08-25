import React, { useState, useRef, useEffect } from 'react';
import { calcularEstatisticas, resumoMensalTexto, MESES_LONGOS } from '../estatisticas';
import { gerarRecomendacoes } from '../recomendacoes';
import {
  montarContexto, perguntarAoModelo, mensagemDeFalha,
  identificarLivroMencionado, contextoDoLivro, contextoDeRecomendacoes,
  pedeAutorParecido, autorDeReferencia, contextoDeAutores,
  resolverAutorCitado, contextoDoAutor, citaAlgumNome,
} from '../bia';
import { BiaAvatar } from './BiaAvatar';
import { TextoFormatado } from './TextoFormatado';
import { diaDeHoje, rotularDia } from '../hooks/useConversas';

// A saudação anterior abria com "Saudações" e recitava as próprias
// funcionalidades antes de dizer qualquer coisa — uma usuária resumiu como
// "muito robótico". Agora ela fala como gente e devolve a palavra.
const SAUDACAO = {
  id: 1,
  tipo: 'bot',
  // "Curiosa", não "Curioso": ela se trata no feminino ("Sou a B.IA"). A regra
  // de não flexionar vale para o gênero de QUEM PERGUNTA, não para o dela.
  texto: 'Oi! Sou a B.IA 📚 Curiosa pra saber o que você anda lendo — e tenho opinião sobre quase tudo, então já aviso. Me pergunta sobre um livro, sobre seu ritmo de leitura, ou pede uma indicação. O que rolou de bom ultimamente?',
  timestamp: new Date(),
};

export function LiteraryAgent({
  livros, conversas = {}, onSalvarConversa, onApagarDia, DA, GRAD_BTN, googleBooksKey,
}) {
  const salvar = onSalvarConversa || (() => {});
  const apagarDia = onApagarDia || (() => {});
  const [mensagens, setMensagens] = useState([SAUDACAO]);
  const [entrada, setEntrada] = useState('');
  const [carregando, setCarregando] = useState(false);
  // Texto chegando em tempo real, ainda não gravado no histórico.
  const [parcial, setParcial] = useState('');
  const [expandido, setExpandido] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);
  // null = conversa de hoje (editável). Uma data = dia anterior, só leitura.
  const [diaVisto, setDiaVisto] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const hoje = diaDeHoje();
  const diasSalvos = Object.keys(conversas).filter(d => d !== hoje).sort().reverse();
  const soLeitura = diaVisto !== null;
  const exibidas = soLeitura ? (conversas[diaVisto] || []) : mensagens;

  // Traz a conversa de hoje quando ela chega do Firestore/localStorage. O
  // guard de tamanho evita sobrescrever mensagens novas com a versão antiga
  // que o onSnapshot devolve logo após um salvamento.
  useEffect(() => {
    const salvas = conversas[hoje];
    if (Array.isArray(salvas) && salvas.length > mensagens.length) {
      setMensagens(salvas);
    }
  }, [conversas, hoje]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [exibidas, parcial]);

  // Consulta a Google Books por um livro específico.
  //
  // O nome anterior era `buscarLivroNaInternet`, e prometia mais do que faz:
  // a B.IA não navega na web, não tem ferramenta de busca e nunca teve. As
  // únicas fontes são esta API — fatos verificáveis: autor, editora, ano,
  // páginas — e o conhecimento do próprio modelo, para o resto.
  const buscarLivroNoGoogleBooks = async (titulo, autor = '') => {
    try {
      const queryParts = [];
      if (titulo.trim().length >= 2) queryParts.push(`intitle:${titulo}`);
      if (autor.trim().length >= 2) queryParts.push(`inauthor:${autor}`);
      
      if (queryParts.length === 0) return null;

      const q = queryParts.join('+');
      const keyParam = googleBooksKey ? `&key=${googleBooksKey}` : '';
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1${keyParam}`;

      const res = await fetch(url);
      if (!res.ok) {
        // Antes isto era um `return null` mudo, e a chave expirada passou
        // despercebida: a B.IA seguia respondendo de memória como se nada
        // tivesse falhado. O motivo agora fica no console.
        const detalhe = await res.json().catch(() => null);
        console.error(
          'Google Books falhou:', res.status,
          detalhe?.error?.message || '(sem detalhe)'
        );
        return null;
      }

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
      console.error('Erro ao consultar a Google Books:', e);
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

  /**
   * Roteia a pergunta.
   *
   * TODA pergunta vai ao modelo; o que muda é o que se junta ao contexto antes.
   * Antes, "resuma X" e "recomende" desviavam para templates fixos e nunca
   * chegavam ao modelo — a mesma dúvida recebia qualidade diferente conforme a
   * palavra usada, e os templates não sustentavam pergunta de seguimento. Agora
   * os dados externos (Google Books, motor de recomendação) entram como contexto
   * e o modelo escreve. As regras ficam só de fallback, para quando ele falha.
   */
  const gerarRespostaAgente = async (pergunta, aoReceberParcial) => {
    const p = pergunta.toLowerCase();
    const querRecomendacao =
      p.includes('recomend') || p.includes('sugest') || p.includes('indica')
      || p.includes('o que ler') || p.includes('que eu leio') || p.includes('próximo livro')
      || p.includes('proximo livro');

    let contexto = montarContexto(livros);

    // Dados reais do livro citado: sem isso o modelo responderia de memória e
    // poderia errar editora, ano ou número de páginas.
    //
    // A busca do autor citado corre JUNTO, não depois: são duas idas à Google
    // Books e a pessoa está esperando a resposta — em série, a espera dobrava.
    const livroCitado = identificarLivroMencionado(pergunta, livros, mensagens);
    const [info, autorCitado] = await Promise.all([
      livroCitado ? buscarLivroNoGoogleBooks(livroCitado.titulo, livroCitado.autor || '') : null,
      // A pessoa pode citar uma autora que ela ainda NÃO tem na estante — foi
      // exatamente o que quebrou: o código só reconhecia autores cadastrados,
      // ignorava o nome perguntado e respondia sobre outro.
      resolverAutorCitado(pergunta, livros, { googleBooksKey }),
    ]);

    if (info) contexto += contextoDoLivro(info, livroCitado);
    if (autorCitado) contexto += contextoDoAutor(autorCitado, livros);

    // "Me indica um autor parecido com o X". Sem consultar a Google Books: a
    // API não sabe responder isso (detalhes em contextoDeAutores). O que o
    // código faz é descobrir de qual autor partir — o citado na pergunta tem
    // precedência sobre qualquer palpite tirado da estante.
    if (pedeAutorParecido(pergunta)) {
      const referencia = autorCitado?.nome || autorDeReferencia(pergunta, livros, mensagens);
      contexto += contextoDeAutores(referencia, livros);
    }
    // Candidatos vindos da Google Books, filtrados pelo perfil de leitura. O
    // modelo escolhe e justifica; a busca continua sendo feita em código.
    //
    // Não entra quando a pessoa já disse de QUEM quer ler: "me recomenda livros
    // da annie ernaux" não é um pedido de sugestão pelo perfil dela, e juntar as
    // duas listas só dá ao modelo material para responder outra coisa.
    else if (querRecomendacao && !autorCitado?.confirmado) {
      const { recomendacoes, perfil } = await gerarRecomendacoes(livros, {
        googleBooksKey,
        limite: 6,
      });
      contexto += contextoDeRecomendacoes(recomendacoes, perfil);
    }

    // `mensagens` ainda não inclui a pergunta atual (o React só aplica o estado
    // no próximo render), então é exatamente o histórico anterior.
    const { texto, erro } = await perguntarAoModelo(pergunta, contexto, {
      historico: mensagens,
      aoReceber: aoReceberParcial,
    });
    if (texto) return texto;

    // O modelo falhou. As regras só assumem se souberem responder de fato; do
    // contrário o usuário via um texto genérico que parecia resposta e se
    // repetia igual, escondendo que algo tinha quebrado.
    //
    // E, quando assumem, DIZEM que assumiram. Uma chave expirada deixou a
    // B.IA sem modelo por dias sem ninguém perceber: as regras respondiam
    // com cara de resposta, e as queixas viravam "ela não entendeu" em vez
    // de "ela está fora do ar". O aviso vale para todo ramo, presente e
    // futuro — por isso fica aqui, e não dentro de cada um.
    const daRegra = await responderComRegras(pergunta, autorCitado);
    if (daRegra) return `${daRegra}\n\n— ${mensagemDeFalha(erro)}`;
    return mensagemDeFalha(erro);
  };

  // Motor de regras original — agora o fallback, não o caminho principal.
  const responderComRegras = async (pergunta, autorCitado = null) => {
    const contexto = prepararContextoEstante();
    const perguntaLower = pergunta.toLowerCase();
    let resposta = '';

    // Resumo com dados da Google Books.
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
      resposta = `**Seu ${stats.ano} até aqui**\n\n${resumoMensalTexto(stats)}`;

      if (stats.totalNoAno > 0) {
        const linhas = stats.porMes
          .filter(m => m.quantidade > 0)
          .map(m => `- **${m.nomeLongo}**: ${m.quantidade} ${m.quantidade === 1 ? 'livro' : 'livros'}${m.paginas > 0 ? ` (${m.paginas.toLocaleString('pt-BR')} pág.)` : ''}`);
        resposta += `\n\nMês a mês ficou assim:\n${linhas.join('\n')}`;

        if (stats.sequenciaAtual > 1) {
          resposta += `\n\nSão ${stats.sequenciaAtual} meses seguidos com leitura. Isso vale mais que um mês de pico e três parados.`;
        } else if (stats.mesesAtivos > 1) {
          resposta += `\n\nSua leitura vem em ondas: alguns meses cheios, outros vazios. Não tem nada de errado nisso, mas um ritmo mais espalhado rende mais no fim do ano.`;
        }
      }
      resposta += `\n\nO gráfico inteiro tá na aba **📊 Estatísticas**, se quiser ver.`;
    }
    else if (isStats) {
      const stats = calcularEstatisticas(livros, new Date().getFullYear());
      resposta = `Você tem ${contexto.totalLivros} ${contexto.totalLivros === 1 ? 'livro' : 'livros'} na estante e termina ${stats.taxaConclusao}% do que começa.`
        + (contexto.abandonei > 0
          ? ` Os ${contexto.abandonei} ${contexto.abandonei === 1 ? 'abandono' : 'abandonos'} (${stats.taxaAbandono}%) podem ser duas coisas bem diferentes: ou você larga rápido o que não te serve, ou a escolha na hora de começar anda falhando. Qual das duas?`
          : ` Nenhum abandono até agora — ou a escolha é boa, ou você termina o que começa por teimosia.`);

      if (stats.totalNoAno > 0) {
        resposta += `\n\nEm ${stats.ano} ${stats.totalNoAno === 1 ? 'foi 1 livro' : `foram ${stats.totalNoAno} livros`}, uma média de ${stats.mediaMensal} por mês com leitura${stats.melhorMes ? `, e ${stats.melhorMes.nomeLongo} foi o mês mais forte` : ''}.`;
      }
      if (stats.notaMedia > 0) {
        resposta += ` Sua média é ${stats.notaMedia}/5 — ${stats.notaMedia >= 4.5 ? 'alta demais pra ser só sorte: ou a escolha é ótima, ou as estrelas andam saindo fáceis' : stats.notaMedia >= 3.5 ? 'um equilíbrio saudável' : 'nota difícil de arrancar de você'}.`;
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
        resposta = `Qual livro? Me diz o título que eu falo dele — pode ser só o nome mesmo, tipo "resuma Torto Arado". Se souber o autor, melhor ainda.`;
      } else {
        // Uma consulta a UMA API, não busca livre na web: a B.IA não navega
        // e não tem ferramenta de busca. Daqui vem fato verificável — autor,
        // editora, ano, páginas. O resto é conhecimento do modelo.
        const infoLivro = await buscarLivroNoGoogleBooks(titulo, autor);

        if (infoLivro) {
          // Só o que a Google Books devolveu, sem fingir leitura. A versão
          // anterior emendava "uma estrutura narrativa que merece escrutínio
          // rigoroso" em qualquer livro — frase que serve para todos e não
          // diz nada sobre nenhum. Comentário de verdade depende do modelo.
          const ficha = [
            infoLivro.genero !== 'Não especificado' && infoLivro.genero,
            infoLivro.paginas !== 'N/A' && `${infoLivro.paginas} páginas`,
            infoLivro.editora !== 'N/A' && infoLivro.editora,
            infoLivro.dataPublicacao !== 'N/A' && infoLivro.dataPublicacao,
          ].filter(Boolean).join(' · ');

          resposta = `**${infoLivro.titulo}**, de ${infoLivro.autor}.`
            + (ficha ? `\n${ficha}` : '')
            + (infoLivro.ratingMedio !== 'N/A' ? `\nNo Google Books: ${infoLivro.ratingMedio}/5` : '');

          if (infoLivro.descricao !== 'Descrição não disponível') {
            resposta += `\n\n${infoLivro.descricao}`;
          }

          if (livroParaResumir && Number(livroParaResumir.nota) > 0) {
            resposta += `\n\nEsse tá na sua estante, com ${livroParaResumir.nota}/5.`;
          } else if (livroParaResumir) {
            resposta += `\n\nEsse tá na sua estante, ainda sem nota.`;
          }
        } else {
          resposta = `Não achei nada com "${titulo}". Confere a grafia, ou me diz o autor junto que eu tento de novo.`;
        }
      }
    } 
    // A pessoa disse de QUEM quer ler. A recomendação pelo perfil da estante
    // não responde isso — e foi o que ela viu: perguntou por Annie Ernaux e
    // recebeu "Recomendações Baseadas no Seu Histórico", texto que nem menciona
    // a autora. Pior: escondeu que o modelo tinha falhado, porque parecia uma
    // resposta. Aqui os títulos vieram da Google Books e são reais, então dá
    // para responder de verdade mesmo sem o modelo — dizendo que é o mínimo.
    else if (autorCitado?.confirmado && autorCitado.obras?.length > 0) {
      const lista = autorCitado.obras
        .map(o => `- **${o.titulo}**${o.ano ? ` (${o.ano})` : ''}${o.ratingMedio > 0 ? ` · ${o.ratingMedio}/5` : ''}`)
        .join('\n');
      resposta = `De **${autorCitado.nome}**, estes são títulos que encontrei agora:\n\n${lista}\n\n`
        + `Não consegui comentar cada um nem dizer por onde começar.`;
    }
    // Nome citado que não deu para confirmar: sem o modelo não há o que dizer.
    // A checagem é pela pergunta, não pelo que a Google Books confirmou — o
    // template abaixo dispara com a palavra "recomende" e ignoraria o nome de
    // qualquer jeito, confirmado ou não.
    else if (autorCitado || citaAlgumNome(pergunta)) {
      return null;
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
        resposta = `Pra indicar direito eu preciso saber do que você gosta, e ainda não tem nada marcado como lido aí. Marca um livro que você já terminou e dá uma nota — a partir daí eu acerto bem mais.`;
      } else if (motivo === 'sem-generos') {
        resposta = `Seus livros lidos estão sem gênero e sem autor preenchidos. Com esses campos vazios eu só chutaria. Completa na aba Adicionar que eu volto a indicar.`;
      } else if (recomendacoes.length === 0) {
        resposta = `Não achei nada fora do que você já tem. Pode ser limite da busca nos gêneros que você lê — ou você já passou por eles.`;
      } else {
        const generos = perfil.generosFavoritos.slice(0, 2).map(g => g.nome).join(' e ');
        resposta = `Pelas suas ${perfil.totalLidos} ${perfil.totalLidos === 1 ? 'leitura' : 'leituras'}, você puxa pra ${generos || 'gêneros variados'}`
          + `${perfil.notaMedia > 0 ? ` e sua média é ${perfil.notaMedia}/5` : ''}. Separei estas:\n\n`
          + recomendacoes.map((r, i) =>
              `**${i + 1}. ${r.titulo}**\n`
              + `- Autor: ${r.autor}${r.ano ? ` (${r.ano})` : ''}\n`
              + `${r.ratingMedio > 0 ? `- Avaliação: ${r.ratingMedio}/5\n` : ''}`
              + `- Critério: ${r.motivo}`
            ).join('\n\n');
        resposta += `\n\nUm aviso: indicar só pelo que você já aprova reforça o seu próprio gosto. Se quiser sair do padrão, a lista inteira tá na aba **📊 Estatísticas**.`;
      }
    }

    // Nenhuma regra reconheceu a pergunta. Devolve null em vez de um texto
    // genérico: quem chama decide o que dizer, sabendo se houve falha do modelo
    // ou se foi só uma pergunta fora do alcance das regras.
    else {
      return null;
    }

    return resposta;
  };

  const enviarMensagem = async () => {
    if (!entrada.trim() || soLeitura) return;

    const novaMensagemUsuario = {
      id: Date.now(),
      tipo: 'usuario',
      texto: entrada,
      timestamp: new Date()
    };

    const comPergunta = [...mensagens, novaMensagemUsuario];
    setMensagens(comPergunta);
    setEntrada('');
    setCarregando(true);

    // Antes havia um setTimeout de 1,2s simulando "pensamento". Agora a espera
    // é real (rede + modelo), então o atraso artificial só somaria latência.
    //
    // O texto parcial fica num estado separado em vez de virar mensagem: só
    // entra no histórico depois de completo, senão um corte de conexão gravaria
    // meia frase na conversa.
    let respostaTexto;
    try {
      respostaTexto = await gerarRespostaAgente(entrada, setParcial);
    } catch (e) {
      console.error('Falha ao gerar resposta da B.IA:', e);
      respostaTexto = 'Houve uma falha ao processar sua pergunta. Tente novamente.';
    }

    const completa = [...comPergunta, {
      id: Date.now() + 1,
      tipo: 'bot',
      texto: respostaTexto,
      timestamp: new Date(),
    }];
    setMensagens(completa);
    setParcial('');
    setCarregando(false);

    // Persiste só depois da resposta: gravar a cada mensagem dobraria as
    // escritas sem ganho, já que a pergunta sozinha não tem valor de histórico.
    salvar(hoje, completa);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  if (!expandido) {
    return (
      /* O ícone sozinho não dizia o que era: uma foto de rosto no canto da tela
         não se explica. O rótulo fica acima dele, com nome e função. */
      <button
        onClick={() => setExpandido(true)}
        title="Abrir B.IA"
        aria-label="Abrir conversa com a B.IA, sua agente literária"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '7px',
          zIndex: 999,
          transition: 'transform .25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span style={{
          background: GRAD_BTN,
          color: DA.cream,
          borderRadius: '999px',
          padding: '5px 12px',
          fontSize: '11px',
          fontWeight: '800',
          lineHeight: 1.35,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(107,30,42,0.35)',
          border: '1px solid rgba(255,255,255,0.25)',
        }}>
          B.IA
          <span style={{ display: 'block', fontSize: '9px', fontWeight: '600', opacity: 0.9 }}>
            Agente Literária
          </span>
        </span>

        <span style={{
          width: '66px',
          height: '66px',
          borderRadius: '50%',
          background: 'white',
          border: `3px solid ${DA.oxblood}`,
          overflow: 'hidden',
          display: 'block',
          boxShadow: '0 8px 24px rgba(107,30,42,0.35)',
        }}>
          <img
            src="/assets/bia-icon.jpg"
            alt=""
            width="66"
            height="66"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </span>
      </button>
    );
  }

  return (
    <div
      className="bia-chat"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '100%',
        maxWidth: '420px',
        // 600px fixos + 24px de margem exigiam 624px de altura útil. Num celular
        // pequeno, descontada a barra do navegador, o topo do chat ficava fora
        // da tela. A media query abaixo assume a tela inteira nesse caso.
        height: 'min(600px, calc(100vh - 48px))',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <BiaAvatar size={32} borda />
          <div style={{ minWidth: 0 }}>
            <div>B.IA</div>
            <div style={{ fontSize: '11px', fontWeight: '600', opacity: 0.85 }}>
              {/* "Online" não dizia o que ela faz; quem abre pela primeira vez
                  precisa saber com o que está falando. */}
              {soLeitura ? `Conversa de ${rotularDia(diaVisto, hoje)}` : 'Agente Literária'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {(diasSalvos.length > 0 || soLeitura) && (
            <button
              onClick={() => setVerHistorico(v => !v)}
              title="Conversas anteriores"
              aria-label="Conversas anteriores"
              aria-expanded={verHistorico}
              style={{
                background: verHistorico ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)',
                border: 'none', color: DA.cream, borderRadius: '6px',
                height: '28px', padding: '0 10px', cursor: 'pointer',
                fontWeight: '800', fontSize: '13px', fontFamily: 'inherit',
              }}
            >
              🕘
            </button>
          )}
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
      </div>

      {/* Lista de dias anteriores. A conversa é cortada por dia automaticamente,
          então não existe momento em que o usuário precise "limpar" nada. */}
      {verHistorico && (
        <div style={{
          maxHeight: '190px', overflowY: 'auto',
          background: 'rgba(44,26,20,0.06)',
          borderBottom: '1px solid rgba(196,154,108,0.35)',
        }}>
          <button
            onClick={() => { setDiaVisto(null); setVerHistorico(false); }}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 16px',
              background: soLeitura ? 'transparent' : 'rgba(196,154,108,0.25)',
              border: 'none', borderBottom: '1px solid rgba(196,154,108,0.2)',
              cursor: 'pointer', fontWeight: '800', fontSize: '13px',
              color: DA.espresso, fontFamily: 'inherit',
            }}
          >
            💬 Hoje {!soLeitura && '· em andamento'}
          </button>

          {diasSalvos.length === 0 ? (
            <p style={{ padding: '12px 16px', fontSize: '12px', color: DA.walnut, opacity: 0.75 }}>
              Ainda não há conversas de outros dias.
            </p>
          ) : diasSalvos.map(dia => (
            <div key={dia} style={{
              display: 'flex', alignItems: 'center',
              borderBottom: '1px solid rgba(196,154,108,0.2)',
            }}>
              <button
                onClick={() => { setDiaVisto(dia); setVerHistorico(false); }}
                style={{
                  flex: 1, textAlign: 'left', padding: '10px 16px',
                  background: diaVisto === dia ? 'rgba(196,154,108,0.25)' : 'transparent',
                  border: 'none', cursor: 'pointer', fontWeight: '700',
                  fontSize: '13px', color: DA.espresso, fontFamily: 'inherit',
                }}
              >
                {rotularDia(dia, hoje)}
                <span style={{ fontWeight: '500', opacity: 0.65, marginLeft: '8px', fontSize: '11px' }}>
                  {conversas[dia]?.length || 0} mensagens
                </span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Apagar a conversa de ${rotularDia(dia, hoje)}?`)) {
                    if (diaVisto === dia) setDiaVisto(null);
                    apagarDia(dia);
                  }
                }}
                title="Apagar esta conversa"
                aria-label={`Apagar a conversa de ${rotularDia(dia, hoje)}`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 14px', fontSize: '13px', color: DA.oxblood,
                }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Aviso de leitura: sem ele o input desabilitado pareceria bug. */}
      {soLeitura && (
        <div style={{
          padding: '9px 16px', fontSize: '12px', fontWeight: '600',
          color: DA.walnut, background: 'rgba(196,154,108,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        }}>
          <span>Conversa encerrada — somente leitura.</span>
          <button
            onClick={() => setDiaVisto(null)}
            style={{
              background: 'none', border: `1px solid ${DA.oxblood}`, borderRadius: '6px',
              padding: '4px 10px', cursor: 'pointer', fontWeight: '700',
              fontSize: '11px', color: DA.oxblood, fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            Voltar para hoje
          </button>
        </div>
      )}

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
        {exibidas.map(msg => (
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
              <TextoFormatado texto={msg.texto} />
            </div>
          </div>
        ))}

        {/* Enquanto o texto chega, mostra o que já veio; os pontinhos só
            aparecem antes da primeira palavra. */}
        {carregando && !soLeitura && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            {parcial ? (
              <div style={{
                maxWidth: '85%', padding: '12px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: 'rgba(245,240,224,0.95)',
                border: '1px solid rgba(196,154,108,0.35)',
                color: DA.espresso, fontSize: '13px', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                <TextoFormatado texto={parcial} />
                <span className="cursor-bia" aria-hidden="true">▌</span>
              </div>
            ) : (
              <div style={{ padding: '12px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(212,197,169,0.3)', display: 'flex', gap: '4px' }}>
                <span className="dot">.</span><span className="dot">.</span><span className="dot">.</span>
              </div>
            )}
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
          placeholder={soLeitura
            ? 'Volte para hoje para conversar'
            : 'Pergunta o que quiser sobre livros...'}
          value={entrada}
          onChange={e => setEntrada(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={carregando || soLeitura}
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
          disabled={carregando || soLeitura || !entrada.trim()}
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
