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

// Negrito e italico numa passada so. O italico entrou depois: a B.IA escreve
// titulo de livro com um asterisco de cada lado, e no chat aparecia
// literalmente *"Angel's Inferno"* — com os asteriscos na tela.
//
// A ordem importa: o par duplo e testado primeiro, senao "**x**" seria lido
// como italico vazio seguido de texto.
const MARCAS = /\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g;

/** Quebra uma linha em texto, <strong> e <em>. */
function comMarcas(linha, chave) {
  const texto = String(linha);
  const saida = [];
  let ultimo = 0;
  let m;

  MARCAS.lastIndex = 0;
  while ((m = MARCAS.exec(texto)) !== null) {
    if (m.index > ultimo) saida.push(texto.slice(ultimo, m.index));
    const k = `${chave}-${m.index}`;
    if (m[1] !== undefined) saida.push(<strong key={k}>{m[1]}</strong>);
    else saida.push(<em key={k}>{m[2] !== undefined ? m[2] : m[3]}</em>);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) saida.push(texto.slice(ultimo));

  return saida.map((parte, i) =>
    typeof parte === 'string'
      ? <React.Fragment key={`t${chave}-${i}`}>{parte}</React.Fragment>
      : parte
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
              <strong>{comMarcas(linha.replace(TITULO, ''), i)}</strong>
              {fim}
            </React.Fragment>
          );
        }

        const item = linha.match(ITEM);
        if (item) {
          return (
            <React.Fragment key={i}>
              {item[1]}{'• '}{comMarcas(linha.replace(ITEM, ''), i)}
              {fim}
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={i}>
            {comMarcas(linha, i)}
            {fim}
          </React.Fragment>
        );
      })}
    </>
  );
}
