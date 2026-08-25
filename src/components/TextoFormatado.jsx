import React from 'react';

// O chat renderizava `{msg.texto}` cru. O modelo escreve em markdown e os
// textos do app também, então a pessoa via "**Os anos**" com os asteriscos na
// tela — apareceu no print de uma leitora, e "### 📚 Recomendações" saía com as
// cerquilhas junto.
//
// Cobre só o subconjunto que aparece de verdade: negrito, título de seção e
// lista com traço. Não usa biblioteca nem `dangerouslySetInnerHTML`: o texto
// vem de um modelo de linguagem, e montar elementos React em vez de HTML
// elimina injeção por construção — além de não somar nada ao bundle.
//
// A quebra de linha continua sendo do CSS (`white-space: pre-wrap` no
// contêiner), por isso aqui só saem nós inline: trocar por <div> por linha
// mudaria o espaçamento de todas as mensagens já salvas.

const TITULO = /^\s{0,3}#{1,6}\s+/;
const ITEM = /^(\s*)[-*]\s+/;

/** Quebra uma linha em pedaços de texto e <strong>, pelo par de asteriscos. */
function comNegrito(linha, chave) {
  const partes = String(linha).split(/\*\*(.+?)\*\*/g);
  // split com grupo de captura alterna: texto, capturado, texto, capturado...
  return partes.map((parte, i) =>
    i % 2 === 1
      ? <strong key={`${chave}-${i}`}>{parte}</strong>
      : <React.Fragment key={`${chave}-${i}`}>{parte}</React.Fragment>
  );
}

export function TextoFormatado({ texto }) {
  const linhas = String(texto || '').split('\n');

  return (
    <>
      {linhas.map((linha, i) => {
        const fim = i < linhas.length - 1
          ? <React.Fragment key={`n${i}`}>{'\n'}</React.Fragment>
          : null;

        // Título de seção: o app usa "### 📚 ..." em alguns textos. Vira uma
        // linha em negrito — cabeçalho de verdade destoaria do balão de chat.
        if (TITULO.test(linha)) {
          return (
            <React.Fragment key={i}>
              <strong>{comNegrito(linha.replace(TITULO, ''), i)}</strong>
              {fim}
            </React.Fragment>
          );
        }

        const item = linha.match(ITEM);
        if (item) {
          return (
            <React.Fragment key={i}>
              {item[1]}{'• '}{comNegrito(linha.replace(ITEM, ''), i)}
              {fim}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={i}>
            {comNegrito(linha, i)}
            {fim}
          </React.Fragment>
        );
      })}
    </>
  );
}
