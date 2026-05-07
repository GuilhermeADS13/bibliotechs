# 📚 BIBLIOTECH

Gerenciador de leituras pessoal com integração com a API do Google Books.

## Funcionalidades

- 📖 Organize livros por status: *Lendo*, *Já li*, *Quero ler*
- 🔍 Busca automática de capa, autor e gênero via Google Books
- 🧠 Pesquise por título ou autor e selecione o resultado para preencher o formulário automaticamente
- ⭐ Sistema de avaliação por estrelas
- 💾 Dados salvos no localStorage (sem backend necessário)
- 🎨 Interface moderna com Tailwind CSS

## Como usar a busca Google Books

1. Abra a aba **Adicionar**.
2. Digite o título do livro (ou título + autor).
3. Clique em **Buscar**.
4. Selecione o livro desejado na lista de sugestões.
5. Complete os campos restantes e adicione à estante.

## Tecnologias

- React 18
- Vite
- Tailwind CSS
- Google Books API

## Configuração de API

Se você tiver uma chave da Google Books API, crie um arquivo `.env` com o valor abaixo:

```env
VITE_GOOGLE_BOOKS_API_KEY=SuaChaveAqui
```

O projeto também já usa as variáveis de ambiente do Firebase se estiver autenticando com Google.

## Como rodar

```bash
npm install
npm run dev
```
