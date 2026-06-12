// 💝 EDITE ESTE ARQUIVO para trocar as fotos, legendas, nome dela e música.
//
// Como trocar as fotos:
//   1. Coloque as fotos reais na pasta  public/love/  (ex.: foto1.jpg, foto2.jpg...)
//   2. Atualize os caminhos `src` abaixo (ex.: '/love/foto1.jpg')

export const LOVE_SLIDES = [
  { src: '/love/foto1.jpg', caption: 'Onde tudo fica melhor: você, eu e um bom vinho 🍷' },
  { src: '/love/foto2.jpg', caption: 'Meu lado nerd te ama em todas as galáxias ⭐' },
  { src: '/love/foto3.jpg', caption: 'A gente se perde que nem o Zoro, porém se acha com o GPS KKKKK 🗺️🚗' },
  { src: '/love/foto4.jpg', caption: 'A leitora mais linda que eu conheço 📖✨' },
  { src: '/love/foto5.jpg', caption: 'Com esse olhar eu não consigo dizer não para você KKKKK 😍' },
  { src: '/love/foto6.jpg', caption: 'Seu sorriso cativante 🦊😄' },
];

export const LOVE_CONFIG = {
  nomeDela: 'Bia',                 // usado nas mensagens ("Para você, Bia ❤️")
  nomeInsta: 'bia.chagas',         // nome estilo Instagram no header dos stories
  perfilFoto: '/love/perfil.jpg',  // foto de perfil redonda (estilo Instagram)
  musica: '/love/musica.mp3',      // alternativa: mp3 local em public/love/musica.mp3 (usado só se youtubeId for vazio)
  youtubeId: 'YQjehm01HOA',        // música via player oficial do YouTube (id do vídeo)
  inicioSegundos: 150,             // música começa em 2:30
  duracaoSlide: 6000,              // duração de cada foto (ms)
};
