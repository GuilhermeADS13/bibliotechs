import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResenhaModal } from '../components/ResenhaModal';

// Regressao de perda de dados. Desde que as fotos passaram a carregar sob
// demanda, `livro.fotoUsuario` pode estar indefinido quando o modal abre — e o
// modal congela o livro no clique, entao nem uma foto que chegue depois aparece.
//
// O modal mandava esse `null` para o `salvar`, que o interpretava como "remova
// a foto". Salvar a resenha APAGAVA a foto do banco.

const DA = {
  espresso: '#2C1A14', cream: '#F5F0E0', warmBeige: '#D4C5A9',
  oxblood: '#6B1E2A', copper: '#B87333', mustard: '#D4A017', walnut: '#6B4423',
};

const salvar = (livro) => {
  const onSalvar = vi.fn();
  render(<ResenhaModal livro={livro} DA={DA} GRAD_BTN="" onSalvar={onSalvar} onFechar={() => {}} />);
  fireEvent.click(screen.getByText(/Salvar/i));
  return onSalvar;
};

describe('ResenhaModal e a foto do livro', () => {
  it('não mexe na foto quando ninguém mexeu nela', () => {
    // temFoto true, fotoUsuario ausente: o caso exato da foto que ainda não chegou.
    const onSalvar = salvar({ id: 1, titulo: 'Duna', temFoto: true, resenha: '', nota: 0 });
    expect(onSalvar).toHaveBeenCalledWith('', 0, undefined);
  });

  it('não mexe na foto nem quando o livro já a trouxe carregada', () => {
    const onSalvar = salvar({ id: 1, titulo: 'Duna', temFoto: true, fotoUsuario: 'data:image/jpeg;base64,AAA' });
    expect(onSalvar.mock.calls[0][2]).toBeUndefined();
  });

  it('diz que há foto mesmo antes de a imagem chegar', () => {
    render(<ResenhaModal livro={{ id: 1, titulo: 'Duna', temFoto: true }} DA={DA} GRAD_BTN="" onSalvar={() => {}} onFechar={() => {}} />);
    expect(screen.getByText('Minha foto do livro')).toBeInTheDocument();
  });

  it('livro sem foto continua oferecendo adicionar', () => {
    render(<ResenhaModal livro={{ id: 1, titulo: 'Duna' }} DA={DA} GRAD_BTN="" onSalvar={() => {}} onFechar={() => {}} />);
    expect(screen.getByText('Adicionar minha foto')).toBeInTheDocument();
  });

  it('salva resenha e nota normalmente', () => {
    const onSalvar = vi.fn();
    render(<ResenhaModal livro={{ id: 1, titulo: 'Duna', resenha: 'boa', nota: 4 }} DA={DA} GRAD_BTN="" onSalvar={onSalvar} onFechar={() => {}} />);
    fireEvent.click(screen.getByText(/Salvar/i));
    expect(onSalvar).toHaveBeenCalledWith('boa', 4, undefined);
  });
});
