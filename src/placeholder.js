// Placeholder de capa de livro como SVG embutido (data URI).
// Substitui via.placeholder.com — não depende de rede nem renderiza emoji externo.
export const bookPlaceholder = (w = 160, h = 220) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="100%" height="100%" fill="#4A2E1E"/>` +
    `<text x="50%" y="50%" font-size="${Math.round(Math.min(w, h) * 0.42)}" ` +
    `text-anchor="middle" dominant-baseline="central">📚</text></svg>`
  );
