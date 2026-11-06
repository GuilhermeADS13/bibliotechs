import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { TourBia, PASSOS_TOUR, lerPreferenciaTour, gravarPreferenciaTour } from '../components/TourBia';
import { PortaRetrato } from '../components/PortaRetrato';
import { FOTOS } from '../fotosFundo';

const DA = { espresso: '#2C1A14', cream: '#F5F0E0', warmBeige: '#D4C5A9', oxblood: '#6B1E2A', walnut: '#6B4423' };

function TourControlado({ inicial = 0, onIrPara = () => {}, onFechar = () => {}, onSempre = () => {} }) {
  const [passo, setPasso] = useState(inicial);
  return <TourBia passo={passo} onPasso={setPasso} onFechar={onFechar} onIrPara={onIrPara} sempre={false} onSempre={onSempre} DA={DA} GRAD_BTN="" />;
}

describe('Tour com a B.IA', () => {
  it('cada passo abre a aba de que fala', () => {
    const onIrPara = vi.fn();
    render(<TourControlado onIrPara={onIrPara} />);
    expect(onIrPara).toHaveBeenLastCalledWith('inicio');
    fireEvent.click(screen.getByText('Mostrar'));
    fireEvent.click(screen.getByText('Próximo'));
    expect(onIrPara).toHaveBeenLastCalledWith(PASSOS_TOUR[2].aba);
    expect(screen.getByText(/código de barras/)).toBeInTheDocument();
  });

  it('volta, pula e responde ao teclado', () => {
    const onFechar = vi.fn();
    render(<TourControlado inicial={2} onFechar={onFechar} />);
    fireEvent.click(screen.getByText('Voltar'));
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/passo 2 de/);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/passo 3 de/);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalled();
  });

  it('só o último passo oferece "mostrar sempre"', () => {
    const onSempre = vi.fn();
    render(<TourControlado inicial={PASSOS_TOUR.length - 1} onSempre={onSempre} />);
    fireEvent.click(screen.getByLabelText(/Mostrar este tour sempre/));
    expect(onSempre).toHaveBeenCalledWith(true);
    expect(screen.getByText('Começar a usar')).toBeInTheDocument();
    expect(screen.queryByText('Pular tour')).toBeNull();
  });

  it('a B.IA não flexiona gênero para quem usa o app', () => {
    // Regra da persona (api/bia.js): "sozinha/sozinho", "pronta/pronto"
    // referidos à pessoa estão proibidos.
    const tudo = PASSOS_TOUR.map(p => p.texto).join(' ');
    expect(tudo).not.toMatch(/\b(sozinh[ao]|prepara[dt][ao]|curios[ao])\b/i);
  });

  describe('preferência', () => {
    beforeEach(() => localStorage.clear());

    it('começa como "nunca viu"', () => {
      expect(lerPreferenciaTour()).toEqual({ visto: false, sempre: false });
    });

    it('guarda visto e sempre, e tolera lixo', () => {
      gravarPreferenciaTour({ visto: true, sempre: true });
      expect(lerPreferenciaTour()).toEqual({ visto: true, sempre: true });
      localStorage.setItem('da-tour', '{quebrado');
      expect(lerPreferenciaTour()).toEqual({ visto: false, sempre: false });
    });
  });
});

describe('Porta-retrato', () => {
  it('mostra uma foto por vez e troca pelos pontos', () => {
    render(<PortaRetrato />);
    const visivel = () => FOTOS.findIndex((_, i) => document.querySelectorAll('.porta-retrato img')[i].style.opacity === '1');
    expect(visivel()).toBe(0);
    fireEvent.click(screen.getByLabelText('Foto 3 de 3'));
    expect(visivel()).toBe(2);
    expect(screen.getByLabelText('Foto 3 de 3')).toHaveAttribute('aria-pressed', 'true');
  });

  it('abre a foto atual em tela cheia, com a proporção sem a faixa do topo', () => {
    const onAbrir = vi.fn();
    render(<PortaRetrato onAbrir={onAbrir} />);
    fireEvent.click(screen.getByLabelText('Foto 2 de 3'));
    fireEvent.click(screen.getByLabelText('Ver a foto em tela cheia'));
    expect(onAbrir).toHaveBeenCalledWith(FOTOS[1]);
    expect(FOTOS[1].proporcao).toBeGreaterThan(1320 / 1327); // mais "larga" = topo aparado
  });
});
