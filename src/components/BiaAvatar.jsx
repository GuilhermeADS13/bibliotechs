// Avatar da B.IA. Centraliza o caminho da imagem para não repetir em cada uso.
export const BIA_ICON = '/assets/bia-icon.jpg';

export function BiaAvatar({ size = 32, borda = false, style = {} }) {
  return (
    <img
      src={BIA_ICON}
      alt="B.IA"
      width={size}
      height={size}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        border: borda ? '2px solid white' : 'none',
        ...style,
      }}
    />
  );
}
