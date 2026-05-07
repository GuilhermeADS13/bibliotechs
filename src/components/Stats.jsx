const GLASS_PANEL = 'rgba(245,240,224,0.85)';
const PANEL_SHADOW = '0 18px 60px rgba(131,84,30,0.18)';

export function Stats({ lidos, lendo, queroLer, abandonei, DA, GRAD_BTN }) {
  const total = lidos + lendo + queroLer + abandonei;
  const cards = [
    { label: 'Lidos',     value: lidos,    emoji: '✅', bg: `${DA.teal}22`,        color: DA.teal },
    { label: 'Lendo',     value: lendo,    emoji: '📖', bg: `${DA.forestGreen}22`, color: DA.forestGreen },
    { label: 'Quero Ler', value: queroLer, emoji: '⏳', bg: `${DA.mustard}22`,     color: DA.copper },
    { label: 'Abandonei', value: abandonei,emoji: '❌', bg: `${DA.oxblood}22`,     color: DA.oxblood },
  ];
  return (
    <div style={{
      background: GLASS_PANEL,
      borderRadius: '18px',
      padding: '26px',
      boxShadow: PANEL_SHADOW,
      border: `1px solid rgba(196,154,108,0.4)`,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      <h3 style={{ fontWeight: '800', fontSize: '16px', color: DA.espresso, marginBottom: '18px' }}>📊 Minha Estante</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: c.bg,
            borderRadius: '12px',
            padding: '18px',
            textAlign: 'center',
            border: `1px solid ${c.color}44`,
          }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{c.emoji}</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: '11px', color: c.color, fontWeight: '700', opacity: 0.85 }}>{c.label}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <p style={{ textAlign: 'center', fontSize: '13px', color: DA.walnut, marginTop: '14px', fontWeight: '600' }}>
          {total} livro{total !== 1 ? 's' : ''} na estante
        </p>
      )}
    </div>
  );
}
