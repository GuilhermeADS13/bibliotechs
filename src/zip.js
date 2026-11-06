// Leitor mínimo de .zip, só para achar o CSV que o Notion exporta.
//
// O Notion entrega o banco de dados como .zip (às vezes um zip dentro de
// outro). Pedir para a pessoa descompactar antes é um passo a mais em que ela
// desiste. A descompressão é a nativa do navegador (DecompressionStream), sem
// biblioteca: aqui só se lê o índice do arquivo e se extrai um CSV.

const ASSINATURA_FIM = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;

async function inflar(bytes) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/** Lista os arquivos do zip: [{ nome, ler() }]. Zip64 não é suportado. */
export function entradasDoZip(buffer) {
  const dv = new DataView(buffer);
  let fim = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === ASSINATURA_FIM) { fim = i; break; }
  }
  if (fim < 0) return [];

  const total = dv.getUint16(fim + 10, true);
  let p = dv.getUint32(fim + 16, true);
  const utf8 = new TextDecoder('utf-8');
  const entradas = [];

  for (let n = 0; n < total && dv.getUint32(p, true) === ASSINATURA_CENTRAL; n++) {
    const metodo = dv.getUint16(p + 10, true);
    const tamanho = dv.getUint32(p + 20, true);
    const tamNome = dv.getUint16(p + 28, true);
    const tamExtra = dv.getUint16(p + 30, true);
    const tamComentario = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = utf8.decode(new Uint8Array(buffer, p + 46, tamNome));
    p += 46 + tamNome + tamExtra + tamComentario;

    entradas.push({
      nome,
      async ler() {
        const inicio = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        const dados = new Uint8Array(buffer, inicio, tamanho);
        if (metodo === 0) return dados;
        if (metodo === 8) return inflar(dados);
        throw new Error(`compressão ${metodo} não suportada`);
      },
    });
  }
  return entradas;
}

/**
 * Texto do CSV mais completo do zip, ou null.
 *
 * O Notion põe dois CSVs por banco: "Livros abc.csv" (a visão) e
 * "Livros abc_all.csv" (todas as propriedades) — o segundo é o preferido.
 * Zip dentro de zip (export grande do Notion) é aberto também.
 */
export async function csvDoZip(buffer, profundidade = 0) {
  const entradas = entradasDoZip(buffer);
  const csvs = entradas.filter(e => /\.csv$/i.test(e.nome) && !/(^|\/)__MACOSX\//.test(e.nome));
  const escolhido = csvs.find(e => /_all\.csv$/i.test(e.nome)) || csvs[0];
  if (escolhido) return new TextDecoder('utf-8').decode(await escolhido.ler());

  if (profundidade < 2) {
    for (const interno of entradas.filter(e => /\.zip$/i.test(e.nome))) {
      const bytes = await interno.ler();
      const texto = await csvDoZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), profundidade + 1);
      if (texto) return texto;
    }
  }
  return null;
}
