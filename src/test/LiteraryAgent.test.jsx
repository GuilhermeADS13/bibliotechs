import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiteraryAgent } from '../components/LiteraryAgent';

// Estes testes exercitam o MOTOR DE REGRAS, não o modelo: em ambiente de teste
// /api/bia não existe, perguntarAoModelo falha e o componente cai no fallback.
// Continuam valendo — o fallback é o que segura o chat quando o modelo está
// fora do ar —, mas não medem a qualidade das respostas reais.
//
// O chat também persiste a conversa do dia. Sem limpar entre os testes, um `it`
// carregaria a conversa gravada pelo anterior e o mesmo texto apareceria duas
// vezes na tela, quebrando as buscas por texto único.
beforeEach(() => { localStorage.clear(); });

const mockDA = {
  espresso: '#2C1A14',
  cream: '#F5F0E0',
  warmBeige: '#D4C5A9',
  oxblood: '#6B1E2A',
  warmBurgundy: '#7B2D42'
};

const mockLivros = [
  { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', status: 'lido', nota: 5, genero: 'Clássico' }
];

const ANO = new Date().getFullYear();

// Estante com datas de término, necessária para a análise temporal
const mockLivrosComDatas = [
  { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', status: 'lido', nota: 5, genero: 'Clássico', paginas: 208, dataTermino: `${ANO}-01-15` },
  { id: 2, titulo: 'O Cortiço', autor: 'Aluísio Azevedo', status: 'lido', nota: 4, genero: 'Clássico', paginas: 300, dataTermino: `${ANO}-01-22` },
  { id: 3, titulo: 'Vidas Secas', autor: 'Graciliano Ramos', status: 'lido', nota: 5, genero: 'Clássico', dataTermino: `${ANO}-04-08` },
];

// Todo o texto visível. O formatador quebra as frases em <strong> e
// fragmentos, então casar um nó isolado ficou frágil — e asserir a tela
// inteira deixa o teste preso ao dado, não ao tom, que é o que se quer
// poder reescrever.
const tela = () => document.body.textContent || '';

// Envia uma pergunta no chat já aberto
function perguntar(texto) {
  const input = screen.getByPlaceholderText(/Pergunta o que quiser/);
  fireEvent.change(input, { target: { value: texto } });
  fireEvent.click(screen.getByText('→'));
}

describe('LiteraryAgent (B.IA) Integration', () => {
  it('deve renderizar o botão inicial da B.IA', () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    expect(screen.getByTitle('Abrir B.IA')).toBeInTheDocument();
  });

  it('deve abrir o chat e mostrar a mensagem de boas-vindas', () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    expect(screen.getByText(/Sou a B.IA/)).toBeInTheDocument();
  });

  it('deve buscar resumo de um livro via API simulada', async () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" googleBooksKey="test-key" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    const input = screen.getByPlaceholderText(/Pergunta o que quiser/);
    fireEvent.change(input, { target: { value: 'Resuma O Alquimista' } });
    fireEvent.click(screen.getByText('→'));

    // Aguarda a resposta da B.IA (simulada com MSW no setup.js)
    await waitFor(() => {
      expect(tela()).toMatch(/O Alquimista/);
      expect(tela()).toMatch(/Paulo Coelho/);
      expect(tela()).toMatch(/Um clássico sobre seguir seus sonhos/);
      expect(tela()).toMatch(/208 páginas/);
    }, { timeout: 3000 });
  });

  it('deve responder analiticamente sobre as estatísticas da estante', async () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    const input = screen.getByPlaceholderText(/Pergunta o que quiser/);
    fireEvent.change(input, { target: { value: 'Quais são minhas estatísticas?' } });
    fireEvent.click(screen.getByText('→'));

    await waitFor(() => {
      // O número é o que importa; a frase em volta pode ser reescrita.
      expect(tela()).toMatch(/1 livro na estante/);
    }, { timeout: 3000 });
  });

  it('deve analisar a quantidade de livros lidos por mês', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Quantos livros li por mês?');

    await waitFor(() => {
      expect(tela()).toMatch(new RegExp(`Seu ${ANO} até aqui`));
      expect(tela()).toMatch(/concluiu 3 obras/);
      expect(tela()).toMatch(/pico foi janeiro/);
    }, { timeout: 3000 });
  });

  it('deve detalhar a distribuição mensal com contagem por mês', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Qual meu ritmo de leitura?');

    await waitFor(() => {
      expect(tela()).toMatch(/janeiro.*2 livros/s);
      expect(tela()).toMatch(/abril.*1 livro/s);
    }, { timeout: 3000 });
  });

  it('deve avisar quando não há datas de término registradas', async () => {
    render(<LiteraryAgent livros={mockLivros} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Quantos livros li por mês?');

    await waitFor(() => {
      expect(screen.getByText(/Não há registros de conclusão/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('deve recomendar livros com base no histórico de leitura', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" googleBooksKey="test-key" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Me recomende um livro');

    await waitFor(() => {
      expect(tela()).toMatch(/Memórias Póstumas de Brás Cubas/);
    }, { timeout: 3000 });
  });

  it('não deve recomendar livros que já estão na estante', async () => {
    render(<LiteraryAgent livros={mockLivrosComDatas} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('O que ler agora?');

    await waitFor(() => {
      expect(tela()).toMatch(/Separei estas/);
    }, { timeout: 3000 });

    expect(tela()).not.toMatch(/1\. Dom Casmurro/);
  });

  it('deve pedir histórico antes de recomendar quando nada foi lido', async () => {
    render(<LiteraryAgent livros={[{ id: 1, titulo: 'X', status: 'quero-ler' }]} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));

    perguntar('Me recomende algo');

    await waitFor(() => {
      expect(tela()).toMatch(/nada marcado como lido/);
    }, { timeout: 3000 });
  });
});

// Ela perguntou "me recomende um livro de annie ernaux" e recebeu o template
// "### 📊 Recomendações Baseadas no Seu Histórico", que nem menciona a autora.
// Duas falhas de uma vez: a regra respondeu outra pergunta, e ao responder
// escondeu que o modelo nao tinha respondido — o texto parecia uma resposta.
//
// Nestes testes o modelo SEMPRE falha (nao existe /api/bia aqui), que e
// exatamente o cenario do print.
describe('fallback quando a pessoa cita um autor', () => {
  const estanteDeOutroAutor = [
    { id: 1, titulo: 'Duna', autor: 'Frank Herbert', status: 'lido', nota: 5, genero: 'Ficção' },
  ];

  it('não responde com o template de histórico quando o autor foi citado', async () => {
    render(<LiteraryAgent livros={estanteDeOutroAutor} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    perguntar('me recomende um livro de machado de assis');

    await waitFor(() => {
      expect(screen.queryByText(/Recomendações Baseadas no Seu Histórico/)).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('lista obras reais do autor citado em vez de ignorá-lo', async () => {
    render(<LiteraryAgent livros={estanteDeOutroAutor} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    perguntar('me recomende um livro de machado de assis');

    // Títulos vindos da Google Books — reais, não inventados pelo template.
    await waitFor(() => {
      expect(screen.getByText(/Quincas Borba/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('diz que o modelo falhou em vez de fingir resposta completa', async () => {
    render(<LiteraryAgent livros={estanteDeOutroAutor} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    perguntar('me recomende um livro de machado de assis');

    // Sem login o modelo nem e chamado. A pessoa precisa saber disso: e o
    // motivo da resposta vir pela metade, e tem conserto imediato.
    await waitFor(() => {
      expect(screen.getByText(/Entre com sua conta Google/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('autor não confirmado não vira template genérico', async () => {
    // O mock so conhece Machado de Assis; "annie ernaux" nao e confirmado.
    // Sem confirmacao nao ha o que dizer sem o modelo — melhor admitir.
    render(<LiteraryAgent livros={estanteDeOutroAutor} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    perguntar('me recomende um livro de annie ernaux');

    await waitFor(() => {
      expect(screen.getByText(/Entre com sua conta Google/)).toBeInTheDocument();
    }, { timeout: 5000 });
    expect(screen.queryByText(/Recomendações Baseadas no Seu Histórico/)).not.toBeInTheDocument();
  });
});

// A instrução da persona proíbe "vocabulário de laudo". O motor de regras
// nunca recebeu esse memorando: enquanto a chave do modelo esteve expirada,
// TODA resposta vinha dele — e era ele que a cliente chamou de "muito
// robótico". Corrigir a instrução do modelo não adiantava: o modelo não era
// chamado.
//
// Estes testes prendem os dois arquivos um ao outro. Se alguém reintroduzir o
// tom de relatório no fallback, quebra aqui.
describe('voz do motor de regras', () => {
  const LAUDO = [
    /dados quantitativos/i, /analiticamente/i, /base empírica/i,
    /metadados técnicos/i, /escrutínio/i, /advertência analítica/i,
    /generosidade avaliativa/i, /produziria resultados superiores/i,
    /unidades\b/i, /no recorte de/i,
  ];

  const estante = [
    { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', status: 'lido', nota: 5, genero: 'Clássico', paginas: 208, dataTermino: `${ANO}-02-10` },
    { id: 2, titulo: 'Ulysses', autor: 'James Joyce', status: 'abandonei', nota: 2, genero: 'Modernismo' },
  ];

  async function respostaPara(texto, livros = estante) {
    render(<LiteraryAgent livros={livros} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    perguntar(texto);
    // A resposta do fallback sempre termina com o aviso de falha do modelo.
    await waitFor(() => expect(tela()).toMatch(/Entre com sua conta Google/), { timeout: 5000 });
    return tela();
  }

  it('não usa vocabulário de laudo ao falar de estatísticas', async () => {
    const t = await respostaPara('quantos livros eu tenho?');
    for (const proibido of LAUDO) expect(t, String(proibido)).not.toMatch(proibido);
  });

  it('não usa vocabulário de laudo ao falar do ritmo mensal', async () => {
    const t = await respostaPara('qual meu ritmo de leitura?');
    for (const proibido of LAUDO) expect(t, String(proibido)).not.toMatch(proibido);
  });

  it('não usa vocabulário de laudo ao recomendar', async () => {
    const t = await respostaPara('me recomende algo');
    for (const proibido of LAUDO) expect(t, String(proibido)).not.toMatch(proibido);
  });

  // A regra de gênero da persona vale para o fallback também: ele não sabe
  // quem está do outro lado, e o nome não diz.
  it('não flexiona adjetivo sobre quem pergunta', async () => {
    const t = await respostaPara('quantos livros eu tenho?');
    expect(t).not.toMatch(/você (está|é|anda|parece) \w+(ada|ado|osa|oso)\b/i);
  });
});

// A lição da chave expirada: um fallback que responde bonito demais esconde
// justamente o que precisa ser visto.
describe('o fallback admite que é fallback', () => {
  const estante = [
    { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', status: 'lido', nota: 5, genero: 'Clássico', dataTermino: `${ANO}-02-10` },
  ];

  it('toda resposta das regras revela que o modelo falhou', async () => {
    render(<LiteraryAgent livros={estante} DA={mockDA} GRAD_BTN="" />);
    fireEvent.click(screen.getByTitle('Abrir B.IA'));
    perguntar('quantos livros eu tenho?');

    // Sem login o modelo nem é chamado; a pessoa precisa saber disso.
    await waitFor(() => {
      expect(screen.getByText(/Entre com sua conta Google/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
