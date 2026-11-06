import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createRef } from 'react';
import { CapaLivro, corDaCapa } from '../components/CapaLivro';

describe('CapaLivro', () => {
  it('com imagem, mostra a imagem', () => {
    render(<CapaLivro src="https://x/capa.jpg" titulo="Duna" autor="Frank Herbert" />);
    expect(screen.getByRole('img', { name: 'Duna' }).tagName).toBe('IMG');
  });

  it('sem imagem, compõe título e autor na capa', () => {
    render(<CapaLivro titulo="O Hobbit" autor="J.R.R. Tolkien, Christopher Tolkien" largura={160} />);
    const capa = screen.getByRole('img', { name: 'O Hobbit' });
    expect(capa.tagName).toBe('DIV');
    expect(capa).toHaveTextContent('O Hobbit');
    // Só o primeiro autor: a capa não tem espaço para a lista inteira.
    expect(capa).toHaveTextContent('J.R.R. Tolkien');
    expect(capa).not.toHaveTextContent('Christopher');
  });

  it('em miniatura, mostra só a inicial', () => {
    render(<CapaLivro titulo="duna" autor="Frank Herbert" largura={40} />);
    const capa = screen.getByRole('img', { name: 'duna' });
    expect(capa.textContent).toBe('D');
  });

  it('repassa o ref também na capa tipográfica (a foto carrega sob demanda)', () => {
    const ref = createRef();
    render(<CapaLivro ref={ref} titulo="Duna" largura={100} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it('o mesmo título tem sempre a mesma cor, e títulos curtos não colidem todos', () => {
    expect(corDaCapa('Duna')).toBe(corDaCapa('Duna'));
    expect(corDaCapa('O Hobbit')).not.toBe(corDaCapa('Duna'));
  });
});
