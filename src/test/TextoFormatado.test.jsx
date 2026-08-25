import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TextoFormatado } from '../components/TextoFormatado';

// O chat mostrava `{msg.texto}` cru. No print de uma leitora dava para ler
// "Vai em **Os anos**." com os asteriscos na tela — o modelo escreve em
// markdown e ninguém traduzia.

describe('TextoFormatado', () => {
  it('transforma **negrito** em negrito de verdade', () => {
    const { container } = render(<TextoFormatado texto="Vai em **Os anos**." />);
    expect(container.querySelector('strong')).toHaveTextContent('Os anos');
    expect(container.textContent).toBe('Vai em Os anos.');
  });

  it('não deixa asterisco sobrando na tela', () => {
    const { container } = render(<TextoFormatado texto="- **Getting Lost** (2022) · 4/5" />);
    expect(container.textContent).not.toMatch(/\*/);
  });

  it('troca o traço de lista por marcador', () => {
    const { container } = render(<TextoFormatado texto="- Os anos\n- Uma mulher" />);
    expect(container.textContent).toContain('• ');
  });

  it('tira as cerquilhas do título de seção e destaca a linha', () => {
    const { container } = render(<TextoFormatado texto="### 📚 Recomendações" />);
    expect(container.textContent).not.toMatch(/#/);
    expect(container.querySelector('strong')).toBeTruthy();
  });

  it('preserva as quebras de linha para o pre-wrap do balão', () => {
    const { container } = render(<TextoFormatado texto={'linha um\nlinha dois'} />);
    expect(container.textContent).toBe('linha um\nlinha dois');
  });

  it('texto sem marcação passa intacto', () => {
    const { container } = render(<TextoFormatado texto="Oi! Sou a B.IA 📚" />);
    expect(container.textContent).toBe('Oi! Sou a B.IA 📚');
  });

  // O texto vem de um modelo de linguagem: se algum dia ele escrever uma tag,
  // ela tem de aparecer como texto, nunca virar elemento. Montar nós React em
  // vez de HTML garante isso por construção — este teste trava a garantia.
  it('não interpreta HTML vindo do modelo', () => {
    const { container } = render(<TextoFormatado texto={'<img src=x onerror=alert(1)>'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img');
  });

  it('aguenta texto vazio e nulo', () => {
    expect(() => render(<TextoFormatado texto="" />)).not.toThrow();
    expect(() => render(<TextoFormatado texto={null} />)).not.toThrow();
  });
});

// A B.IA escreve título de livro com um asterisco de cada lado, e no print da
// leitora aparecia literalmente *"Angel's Inferno"* — asteriscos na tela.
describe('TextoFormatado: itálico', () => {
  it('converte *itálico* sem deixar asterisco', () => {
    const { container } = render(<TextoFormatado texto={`vale a pena *"Angel's Inferno"*, do mesmo autor`} />);
    expect(container.querySelector('em')).toHaveTextContent(`"Angel's Inferno"`);
    expect(container.textContent).not.toMatch(/\*/);
  });

  it('negrito e itálico convivem na mesma linha', () => {
    const { container } = render(<TextoFormatado texto="li **Duna** e depois *Messias*" />);
    expect(container.querySelector('strong')).toHaveTextContent('Duna');
    expect(container.querySelector('em')).toHaveTextContent('Messias');
    expect(container.textContent).toBe('li Duna e depois Messias');
  });

  it('não confunde ** com dois itálicos vazios', () => {
    const { container } = render(<TextoFormatado texto="**Os anos**" />);
    expect(container.querySelector('strong')).toHaveTextContent('Os anos');
    expect(container.querySelector('em')).toBeNull();
  });

  it('multiplicação não vira itálico', () => {
    // Sem par de fechamento, o asterisco solto fica como está.
    const { container } = render(<TextoFormatado texto="2 * 3 = 6" />);
    expect(container.textContent).toBe('2 * 3 = 6');
  });
});
