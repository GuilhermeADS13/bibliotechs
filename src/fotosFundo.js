// As fotos do fundo e do porta-retrato do Início.
//
// São retratos em pé (selfies, ~3:4). `foco` é onde fica o rosto, para o
// recorte nunca cortá-lo. `aparar` tira a faixa escura que as duas últimas
// trazem no topo (sobra de captura de tela do Instagram); `proporcao` é a
// largura/altura da foto já sem essa faixa, usada na tela cheia. Os arquivos
// originais ficam intactos — o corte é só na exibição.
export const FOTOS = [
  { src: '/carousel/img1.jpg', foco: '50% 55%', aparar: false, proporcao: 1168 / 1600 },
  { src: '/carousel/img2.jpg', foco: '50% 45%', aparar: true, proporcao: 1320 / (1327 - 14) },
  { src: '/carousel/img3.jpg', foco: '40% 45%', aparar: true, proporcao: 1166 / (1600 - 56) },
];
