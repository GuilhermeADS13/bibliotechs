# 📚 Bibliotech

Gerenciador de leituras pessoal, com uma agente literária que conversa sobre a sua
estante — a **B.IA**.

Em produção: **[bibliotechs.vercel.app](https://bibliotechs.vercel.app)**

## Funcionalidades

### Estante

- 📖 Livros por status: *Lendo*, *Lido*, *Quero Ler*, *Abandonei*
- 🔍 Busca automática de capa, autor, gênero e páginas na Google Books
- ☁️ Sincronização via Firestore — a estante acompanha o login
- 🔐 Entrada com Google
- ⭐ Nota por estrelas e resenha pessoal
- 📷 Foto do seu exemplar físico, comprimida no navegador
- 🎯 Meta anual com gráfico mensal
- 📊 Estatísticas: ritmo, taxa de conclusão, taxa de abandono, gêneros, autores
- ✨ Recomendações a partir do que você leu e avaliou

### B.IA — a agente literária

- 💬 Conversa de verdade, com memória dos turnos anteriores
- 🗓️ Histórico guardado por dia
- 📚 Responde sobre um livro específico com dados buscados na hora
- ✍️ Lê suas resenhas e leva em conta o que **você** escreveu
- 🧭 Indica autores parecidos e explica por quê
- 🔎 Reconhece autor que você ainda não tem na estante, mesmo digitado em
  minúscula ou só pelo sobrenome

## Como ela sabe o que sabe

Há uma divisão de responsabilidades que atravessa o projeto inteiro:

> **Fato vem de fonte. Linguagem e juízo vêm do modelo.**

| Origem | Responde por |
| --- | --- |
| Código (`src/estatisticas.js`) | todo número da estante — total, médias, taxas, ritmo |
| Google Books | metadado de edição: autor, editora, ano, páginas, e a existência do título |
| Wikipédia | quem o autor é: nacionalidade, época, prêmios, filiação literária |
| Gemini | enredo, estilo, comparação, crítica, opinião — e a escrita |

Um LLM erra uma média ou inventa um livro com facilidade, então nada quantitativo
e nenhum título são deixados a cargo dele: chegam prontos no contexto. Em
contrapartida, semelhança entre autores é conhecimento literário estabelecido, e
ali o modelo é melhor que qualquer API — duas tentativas de fundamentar isso pela
Google Books deram resultado pior, e estão documentadas em `src/bia.js`.

**A B.IA não navega na web e não tem ferramenta de busca.** As fontes são as duas
APIs acima. A busca do Google via Gemini existe, mas tem cota zero no plano
gratuito.

## Tecnologias

- React 18 + Vite
- Firebase — Authentication e Firestore
- Google AI Studio — Gemini (`gemini-3.5-flash-lite`, trocável por variável)
- Vercel — hospedagem e função serverless
- Vitest + Testing Library + MSW — 260 testes

Os estilos são inline e CSS próprio (`src/index.css`); o Tailwind está no
pipeline mas praticamente não é usado pelos componentes.

## Arquitetura

```text
src/
  bia.js              ponte com o modelo: monta contexto, roteia, trata falha
  estatisticas.js     todo cálculo da estante (números exatos)
  recomendacoes.js    perfil de leitura + busca de candidatos na Google Books
  wikipedia.js        contexto biográfico do autor
  fotos.js            fotos em coleção separada (ver "Fotos" abaixo)
  hooks/
    useLivros.js      estante: Firestore com conta, localStorage sem
    useConversas.js   conversas da B.IA, um documento por usuário por dia
    useFotos.js       carrega foto só quando o card chega perto da tela
api/
  bia.js              função serverless: guarda a chave, fala com o Gemini
  _auth.js            verifica o token do Firebase (jose + JWKS)
```

### Por que existe uma função serverless

A chave do Gemini **não pode** ir para o bundle. Variáveis com prefixo `VITE_`
são embutidas no JavaScript público — qualquer pessoa abriria o DevTools e a
copiaria. `GEMINI_API_KEY` não tem esse prefixo e só existe no servidor.

O endpoint fica público assim que o site sobe, então exige token do Firebase: a
cota gratuita é do dono do app, não do mundo.

### Fotos

A foto do exemplar fica em **`fotos/{livroId}`**, não dentro do documento do
livro. A estante escuta a coleção inteira com `onSnapshot`; com as fotos
embutidas, cada carregamento baixava todas elas — e de novo a cada alteração em
qualquer livro.

O lugar natural seria o Firebase Storage, mas criar um bucket exige o plano Blaze
desde outubro de 2024, e este app é de custo zero por decisão.

Estantes criadas antes dessa mudança migram sozinhas, no navegador de cada
pessoa, no primeiro acesso. A cópia é gravada e **lida de volta** antes de o
original ser apagado — este banco não tem backup automático (o Point-in-Time
Recovery também exige plano pago), então a garantia precisa estar no código.

## Como rodar localmente

```bash
git clone https://github.com/GuilhermeADS13/bibliotechs.git
cd bibliotechs
npm install
```

Crie um `.env` na raiz, a partir do `.env.example`:

```env
# Cliente — vão para o bundle, restrinja por domínio no console
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GOOGLE_BOOKS_API_KEY=

# Servidor — SEM prefixo VITE_, nunca chegam ao navegador
GEMINI_API_KEY=
FIREBASE_PROJECT_ID=
BIA_MODEL=gemini-3.5-flash-lite
```

> Credenciais do Firebase: **Console → Configurações do projeto → Seus
> aplicativos → Web**.
> Chave do Gemini: **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**.

```bash
npm run dev     # servidor de desenvolvimento
npm test        # testes
npm run build   # build de produção
```

A B.IA precisa da função serverless, que só existe no ambiente da Vercel. Em
`npm run dev` o `/api/bia` não responde e o chat cai no motor de regras — que é o
mesmo caminho usado quando o modelo falha em produção.

## Firebase

### Regras do Firestore

Estão em [`firestore.rules`](firestore.rules), versionadas — três coleções:
`livros`, `fotos` e `conversas`. Publique com:

```bash
npx firebase-tools@latest deploy --only firestore:rules
```

> Elas não são reproduzidas aqui de propósito. Este README já carregou por meses
> uma cópia desatualizada das regras, e uma cópia divergente é pior que nenhuma.

### Authentication

Em **Authentication → Sign-in method**, ative o provedor **Google** e inclua o
domínio em **Domínios autorizados**.

Um detalhe que já quebrou o login: o `authDomain` precisa ser o mesmo domínio do
app. Desde que os navegadores passaram a bloquear armazenamento de terceiros, a
sessão gravada num domínio diferente não pode ser lida de volta — a pessoa voltava
do Google simplesmente sem estar logada, sem erro nenhum. O `vercel.json` serve
`/__/auth` pelo próprio domínio, e a URI correspondente precisa estar cadastrada
no **cliente OAuth**, que é uma lista diferente dos domínios autorizados do
Firebase.

## Deploy (Vercel)

Todas as variáveis do `.env` vão em **Settings → Environment Variables**, e
**variável nova só vale em deploy novo** — salvar sem redeployar não muda nada no
que está no ar.

## Sem login

Sem conta, os livros ficam no `localStorage` — só naquele dispositivo, e a B.IA
não conversa (o endpoint exige token). Ao entrar com o Google, o que estava local
é movido para a conta automaticamente.
