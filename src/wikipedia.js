// Contexto sobre o AUTOR, que é o buraco da Google Books.
//
// A Google Books tem metadado de edição: editora, ano, páginas, um gênero
// grosseiro. Ela não diz quem a pessoa é. Para "Torto Arado" devolve
// `Fiction`; a Wikipedia devolve "autor do romance Torto Arado, ganhador dos
// prêmios LeYa de 2018, Jabuti de 2020, Oceanos de 2020".
//
// Por que a Wikipedia e não uma busca de verdade: a ferramenta `google_search`
// do Gemini resolveria isso em uma linha, mas tem cota ZERO no plano gratuito —
// medido com a chave do app, mesmo modelo: sem a ferramenta HTTP 200, com ela
// HTTP 429. A Wikipedia é gratuita, dispensa chave e manda
// `access-control-allow-origin: *`, então é chamada direto do navegador, igual
// à Google Books.
//
// Descartadas: Open Library (o `top_work` de Annie Ernaux volta "Principles of
// internal medicine") e Wikidata (não manda cabeçalho de CORS).

const BUSCA = 'https://pt.wikipedia.org/w/rest.php/v1/search/title';
const RESUMO = 'https://pt.wikipedia.org/api/rest_v1/page/summary/';

// Um resumo de autor cabe em poucas linhas, e o contexto do modelo tem teto.
const MAX_RESUMO = 600;

// A busca por nome acerta o alvo errado com facilidade: "Torto Arado" devolve a
// OBRA, "Coração satânico" devolve o FILME, "Machado" devolve a FERRAMENTA DE
// CORTE. Só passa quem a própria Wikipedia descreve como alguém que escreve.
const ESCREVE = /escritor|romancista|poet|autor|dramaturg|ensaista|contista|novelista|ficcionista|literat|jornalista|filosof|historiador|cronista|quadrinista/;

const normalizar = (t) => String(t || '')
  .normalize('NFD')
  .replace(/\p{Mn}/gu, '')
  .toLowerCase()
  .trim();

// A politica da Wikimedia recusa (429) cliente que nao se identifica, e o
// User-Agent padrao do Node cai nessa regra — apareceu ao testar fora do
// navegador. `User-Agent` e cabecalho proibido no navegador e simplesmente
// ignorado la; `Api-User-Agent` e a alternativa que eles aceitam justamente
// para clientes de navegador. Os dois juntos cobrem os dois ambientes.
const IDENTIFICACAO = {
  'Api-User-Agent': 'bibliotech/1.0 (https://bibliotechs.vercel.app)',
  'User-Agent': 'bibliotech/1.0 (https://bibliotechs.vercel.app)',
};

async function json(url, sinal) {
  const res = await fetch(url, { signal: sinal, headers: IDENTIFICACAO });
  if (!res.ok) throw new Error(`Wikipedia respondeu ${res.status}`);
  return res.json();
}

/**
 * Contexto biográfico de um autor, ou null.
 *
 * Recebe o nome CANÔNICO — o que a Google Books devolveu ao confirmar o autor.
 * A diferença é decisiva: "Machado" cai na ferramenta de corte, "Machado de
 * Assis" cai no escritor.
 */
export async function contextoWikipedia(nome, { sinal } = {}) {
  const alvo = String(nome || '').trim();
  if (alvo.length < 3) return null;

  try {
    const busca = await json(`${BUSCA}?q=${encodeURIComponent(alvo)}&limit=1`, sinal);
    const pagina = busca?.pages?.[0];
    if (!pagina?.title) return null;

    // Trava 1: o título tem de ser o nome procurado. Sem isto, "C. J. Tudor"
    // casa com "Catador de material reciclável" — aconteceu no teste.
    const tituloNormal = normalizar(pagina.title);
    const partes = normalizar(alvo).split(/\s+/).filter(p => p.replace(/\W/g, '').length >= 3);
    if (partes.length === 0 || !partes.every(p => tituloNormal.includes(p.replace(/\W/g, '')))) {
      return null;
    }

    // Trava 2: tem de ser gente que escreve, não a obra nem o filme homônimo.
    if (!ESCREVE.test(normalizar(pagina.description))) return null;

    const resumo = await json(`${RESUMO}${encodeURIComponent(pagina.title)}`, sinal);
    // Página de desambiguação não descreve ninguém — é uma lista de opções.
    if (resumo?.type === 'disambiguation') return null;

    const extrato = String(resumo?.extract || '').trim();
    if (!extrato) return null;

    return {
      titulo: pagina.title,
      descricao: pagina.description || '',
      resumo: extrato.length > MAX_RESUMO
        ? `${extrato.slice(0, MAX_RESUMO).trimEnd()}…`
        : extrato,
    };
  } catch (e) {
    // Contexto extra que falha não pode derrubar a resposta: sem ele a B.IA
    // segue com a Google Books e a própria bagagem, como fazia antes.
    if (e?.name !== 'AbortError') console.error('Wikipedia falhou para', alvo, e);
    return null;
  }
}
