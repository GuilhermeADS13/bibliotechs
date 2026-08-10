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
    return HttpResponse.json({ items: [] });
  })
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
