# 📚 Bibliotech

Gerenciador de leituras pessoal com sincronização em nuvem via Firebase e busca automática via Google Books API.

## Funcionalidades

- 📖 Organize livros por status: *Lendo*, *Lido*, *Quero Ler*, *Abandonei*
- 🔍 Busca automática de capa, autor, gênero e páginas via Google Books
- ☁️ Sincronização em nuvem com Firebase — acesse de qualquer dispositivo
- 🔐 Login com Google para salvar e restaurar sua estante
- ⭐ Avaliação por estrelas e resenhas pessoais
- 📷 Foto do seu exemplar físico (upload com compressão automática)
- 🎯 Meta anual de leitura com gráfico mensal de progresso
- 📊 Estatísticas da estante (lidos, lendo, quero ler, abandonados)
- 📱 Interface responsiva — funciona no mobile e desktop

## Tecnologias

- React 18
- Vite
- Tailwind CSS
- Firebase (Authentication + Firestore)
- Google Books API

## Como rodar localmente

### 1. Clone o repositório

```bash
git clone https://github.com/GuilhermeADS13/bibliotechs.git
cd bibliotechs
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```env
VITE_FIREBASE_API_KEY=sua_chave
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
VITE_GOOGLE_BOOKS_API_KEY=sua_chave_google_books
```

> As credenciais do Firebase estão disponíveis em **Firebase Console → Configurações do projeto → Seus aplicativos → Web**.

### 4. Rode o projeto

```bash
npm run dev
```

## Configuração do Firebase

### Firestore — Regras de segurança

No **Firebase Console → Firestore Database → Regras**, configure:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /livros/{livroId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null;
    }
  }
}
```

Ou faça o deploy direto pelo CLI:

```bash
npx firebase-tools@latest deploy --only firestore:rules
```

### Authentication

No **Firebase Console → Authentication → Sign-in method**, ative o provedor **Google** e adicione seu domínio em **Domínios autorizados**.

## Deploy (Vercel)

Adicione todas as variáveis do `.env` em **Vercel → Settings → Environment Variables** e faça um redeploy.

## Modo offline

Sem login, os livros são salvos no `localStorage` do navegador — apenas no dispositivo atual. Faça login com Google para sincronizar em qualquer lugar.
