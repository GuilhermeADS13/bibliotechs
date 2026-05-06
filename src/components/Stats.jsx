export function Stats({ lidos, lendo, queroLer, abandonei, DA, GRAD_BTN }) {
  const total = lidos + lendo + queroLer + abandonei;
  const cards = [
    { label: 'Lidos',     value: lidos,     emoji: '✅', bg: `${DA.teal}18`,        color: DA.teal },
    { label: 'Lendo',     value: lendo,     emoji: '📖', bg: `${DA.forestGreen}18`, color: DA.forestGreen },
    { label: 'Quero Ler', value: queroLer,  emoji: '⏳', bg: `${DA.mustard}18`,     color: DA.copper },
    { label: 'Abandonei', value: abandonei, emoji: '❌', bg: `${DA.oxblood}18`,     color: DA.oxblood },
  ];
  return (
    <div style={{ background: 'white', borderRadius: '18px', padding: '26px', boxShadow: '0 2px 12px rgba(44,26,20,0.08)', border: `1px solid ${DA.warmBeige}` }}>
      <h3 style={{ fontWeight: '800', fontSize: '16px', color: DA.espresso, marginBottom: '18px' }}>📊 Minha Estante</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px' }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: '12px', padding: '18px', textAlign: 'center', border: `1px solid ${c.color}33` }}>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{c.emoji}</div>
            <div style={{ fontSize: '28px', fontWeight: '900', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: '11px', color: c.color, fontWeight: '700', opacity: 0.85 }}>{c.label}</div>
          </div>
        ))}
      </div>
      {total > 0 && (
        <p style={{ textAlign: 'center', fontSize: '13px', color: DA.warmBeige, marginTop: '14px', fontWeight: '600' }}>
          {total} livro{total !== 1 ? 's' : ''} na estante
        </p>
      )}
    </div>
  );
}
