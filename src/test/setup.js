import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock da Google Books API
export const handlers = [
  http.get('https://www.googleapis.com/books/v1/volumes', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');

    if (q.includes('O Alquimista')) {
      return HttpResponse.json({
        items: [
          {
            volumeInfo: {
              title: 'O Alquimista',
              authors: ['Paulo Coelho'],
              description: 'Um clássico sobre seguir seus sonhos.',
              pageCount: 208,
              categories: ['Ficção'],
              publishedDate: '1988',
              publisher: 'Rocco',
              averageRating: 4.5
            }
          }
        ]
      });
    }
    // Buscas por gênero/autor usadas pelo motor de recomendações
    if (q.startsWith('subject:') || q.startsWith('inauthor:')) {
      return HttpResponse.json({
        items: [
          {
            id: 'rec-1',
            volumeInfo: {
              title: 'Memórias Póstumas de Brás Cubas',
              authors: ['Machado de Assis'],
              categories: ['Clássico'],
              pageCount: 208,
              publishedDate: '1881',
              averageRating: 4.8,
              imageLinks: { thumbnail: 'http://books.google.com/capa1.jpg' },
            },
          },
          {
            id: 'rec-2',
            volumeInfo: {
              title: 'Quincas Borba',
              authors: ['Machado de Assis'],
              categories: ['Clássico'],
              publishedDate: '1891',
              averageRating: 4.2,
            },
          },
          {
            // Já está na estante de teste — deve ser filtrado das recomendações
            id: 'rec-3',
            volumeInfo: {
              title: 'Dom Casmurro',
              authors: ['Machado de Assis'],
              categories: ['Clássico'],
              averageRating: 5,
            },
          },
        ],
      });
    }

    return HttpResponse.json({ items: [] });
  })
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
