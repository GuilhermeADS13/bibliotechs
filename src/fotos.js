import { carregarFirestore } from './firebase';

// As fotos que o usuário tira do livro físico ficavam em base64 DENTRO do
// documento do livro. Como a estante escuta a coleção inteira com `onSnapshot`,
// cada carregamento baixava todas as fotos — 1,27 MB para 25 livros — inclusive
// as de livros fora da tela, e de novo a cada alteração em qualquer livro.
//
// Aqui elas moram em `fotos/{livroId}`, com o mesmo id do livro. A estante volta
// a pesar poucos KB e cada foto é buscada só quando aparece na tela.
//
// Por que não o Firebase Storage, que seria o lugar natural: criar um bucket
// exige o plano Blaze desde outubro de 2024, e este app é de custo zero por
// decisão. O Firestore gratuito guarda 1 GiB — as 25 fotos ocupam 0,1% disso.

/** Uma foto recém-escolhida chega como data URI; uma já salva, não. */
export const ehDataUri = (valor) =>
  typeof valor === 'string' && valor.startsWith('data:');

/**
 * Grava a foto do livro. Sem foto nova, apaga a que existia.
 *
 * O `uid` vai no documento porque o id sozinho não autoriza nada: as regras
 * conferem o dono pelo campo, igual a /livros.
 */
export async function salvarFoto(livroId, dados, uid) {
  const mod = await carregarFirestore();
  if (!mod) return;
  const { fs, db } = mod;
  const ref = fs.doc(db, 'fotos', String(livroId));

  if (!ehDataUri(dados)) {
    // Trocar por "sem foto" é apagar de verdade: um documento com string vazia
    // continuaria sendo lido e contado.
    await fs.deleteDoc(ref).catch(() => {});
    return;
  }
  await fs.setDoc(ref, { dados, uid });
}

/** Busca uma foto. Devolve null quando não existe — inclusive por erro. */
export async function lerFoto(livroId) {
  try {
    const mod = await carregarFirestore();
    if (!mod) return null;
    const { fs, db } = mod;
    const snap = await fs.getDoc(fs.doc(db, 'fotos', String(livroId)));
    return snap.exists() ? (snap.data().dados || null) : null;
  } catch (e) {
    // Uma foto que não carrega não pode derrubar a estante: o card cai na capa
    // da API, que é o que ele já fazia antes de existir foto do usuário.
    console.error('Falha ao carregar a foto do livro:', livroId, e);
    return null;
  }
}

/**
 * Apaga a foto de um livro removido.
 *
 * Silencioso de propósito: o livro já foi apagado quando isto roda, e falhar
 * aqui deixaria um documento órfão — ruim, mas não é motivo para dizer ao
 * usuário que a remoção não funcionou.
 */
export async function apagarFoto(livroId) {
  try {
    const mod = await carregarFirestore();
    if (!mod) return;
    const { fs, db } = mod;
    await fs.deleteDoc(fs.doc(db, 'fotos', String(livroId)));
  } catch (e) {
    console.error('Falha ao apagar a foto do livro:', livroId, e);
  }
}

/**
 * Separa a foto do resto dos dados do livro.
 *
 * Devolve { dados, foto }: `dados` é o que vai para /livros, `foto` é o que vai
 * para /fotos. `temFoto` fica no livro para a estante saber que existe foto a
 * buscar sem precisar consultar a outra coleção.
 *
 * `foto` só vem definida quando o campo estava presente na entrada — assim
 * `atualizar` distingue "não mexeu na foto" de "removeu a foto", que são coisas
 * diferentes e antes se pareciam.
 */
export function separarFoto(livro) {
  const { fotoUsuario, ...dados } = livro || {};
  if (!('fotoUsuario' in (livro || {}))) return { dados, foto: undefined };
  return {
    dados: { ...dados, temFoto: ehDataUri(fotoUsuario) },
    foto: ehDataUri(fotoUsuario) ? fotoUsuario : null,
  };
}

/**
 * Move para /fotos uma foto que ainda está embutida no documento do livro.
 *
 * Roda no navegador de quem já tem a estante, com a autenticação da própria
 * pessoa — não há script de administrador porque não há credencial de serviço
 * neste projeto, e não faria falta: cada um migra o que é seu, na primeira vez
 * que abre o app.
 *
 * A ORDEM IMPORTA. A foto é gravada no lugar novo ANTES de sair do livro. Se
 * falhar no meio, ela existe nos dois lugares — a estante mostra a embutida e a
 * próxima tentativa conserta. Na ordem inversa, uma falha perderia a foto.
 */
export async function migrarFotoEmbutida(livroId, dados, uid) {
  if (!ehDataUri(dados)) return false;
  try {
    const mod = await carregarFirestore();
    if (!mod) return false;
    const { fs, db } = mod;

    await fs.setDoc(fs.doc(db, 'fotos', String(livroId)), { dados, uid });
    await fs.updateDoc(fs.doc(db, 'livros', String(livroId)), {
      fotoUsuario: fs.deleteField(),
      temFoto: true,
    });
    return true;
  } catch (e) {
    console.error('Falha ao migrar a foto do livro:', livroId, e);
    return false;
  }
}
