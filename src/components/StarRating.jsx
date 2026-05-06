export function StarRating({ rating, setRating, interactive = false, DA }) {
  const activeColor = DA?.mustard || '#f59e0b';
  const inactiveColor = DA?.warmBeige || '#d4c5a9';
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button key={star} type="button" disabled={!interactive}
          onClick={() => interactive && setRating(star)}
          style={{
            background: 'none', border: 'none', cursor: interactive ? 'pointer' : 'default',
            fontSize: interactive ? '24px' : '16px', padding: '0', lineHeight: 1,
            color: star <= rating ? activeColor : inactiveColor,
            transition: 'transform 0.1s ease, color 0.1s ease'
          }}
          onMouseEnter={e => { if (interactive) { e.currentTarget.style.transform = 'scale(1.25)'; e.currentTarget.style.color = activeColor; }}}
          onMouseLeave={e => { if (interactive) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.color = star <= rating ? activeColor : inactiveColor; }}}>
          ★
        </button>
      ))}
    </div>
  );
}
