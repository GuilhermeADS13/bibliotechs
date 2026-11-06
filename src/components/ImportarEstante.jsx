import React, { useState } from 'react';
import { livrosDoCsv } from '../importar';

const ROTULO_STATUS = { lido: 'lidos', lendo: 'lendo', 'quero-ler': 'quero ler', abandonei: 'abandonados' };

/**
 * Importa a estante de um CSV do Goodreads ou de uma planilha própria.
 *
 * Mostra o resumo ANTES de gravar: quantos entram, quantos já estavam na
 * estante. Importar é gravar dezenas de livros de uma vez — a pessoa precisa
 * ver o que vai acontecer antes de confirmar.
 */
export function ImportarEstante({ livros, DA, GRAD_BTN, onImportar, onConcluir }) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [erro, setErro] = useState('');
  const [progresso, setProgresso] = useState(null); // { feitos, total }
  const [concluido, setConcluido] = useState(null);

  const lerArquivo = async (arquivo) => {
    setErro(''); setPrevia(null); setConcluido(null);
    if (!arquivo) return;
    const texto = await arquivo.text();
    const r = livrosDoCsv(texto, livros);
    if (!r.formato) {
      setErro('Não reconheci este arquivo. Ele precisa ser um CSV com uma coluna de título ("Title" no Goodreads, "titulo" numa planilha).');
      return;
    }
    if (r.livros.length === 0) {
      setErro(r.repetidos > 0
        ? `Todos os ${r.repetidos} livros do arquivo já estão na sua estante.`
        : 'O arquivo não tem nenhum livro com título.');
      return;
    }
    setPrevia(r);
  };

  const importar = async () => {
    const lista = previa.livros;
    setProgresso({ feitos: 0, total: lista.length });
    let feitos = 0;
    // Um de cada vez: são poucas dezenas, e parar no primeiro erro evita uma
    // cascata de falhas (sem conexão, por exemplo) gravando metade às cegas.
    for (const livro of lista) {
      try {
        await onImportar(livro);
      } catch {
        setErro(`A importação parou no livro ${feitos + 1} de ${lista.length}. Os ${feitos} anteriores foram salvos; importar o arquivo de novo continua de onde parou.`);
        break;
      }
      feitos += 1;
      setProgresso({ feitos, total: lista.length });
    }
    setProgresso(null);
    setPrevia(null);
    if (feitos > 0) setConcluido(feitos);
  };

  const porStatus = previa
    ? Object.entries(previa.livros.reduce((m, l) => ({ ...m, [l.status]: (m[l.status] || 0) + 1 }), {}))
    : [];

  return (
    <section aria-label="Importar estante">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '16px', color: DA.espresso, marginBottom: '3px' }}>Trazer sua estante de outro lugar</h3>
          <p style={{ fontSize: '12px', color: DA.walnut }}>Arquivo CSV do Goodreads ou de uma planilha sua</p>
        </div>
        <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto} style={{
          fontSize: '12px', fontWeight: '700', color: DA.oxblood, background: 'none',
          border: `1px solid ${DA.oxblood}`, borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
        }}>
          {aberto ? 'Fechar' : 'Importar arquivo'}
        </button>
      </div>

      {aberto && (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: DA.espresso }}>
          <p style={{ lineHeight: 1.55, color: DA.walnut }}>
            <strong>Goodreads:</strong> My Books → Import and export → Export Library.<br />
            <strong>Planilha:</strong> salve como CSV com as colunas <em>titulo, autor, status, nota, paginas, genero, data de termino</em> (só <em>titulo</em> é obrigatória).
            Status aceita lido, lendo, quero ler ou abandonei.
          </p>

          {!progresso && (
            <input type="file" accept=".csv,text/csv" aria-label="Arquivo CSV"
              onChange={e => lerArquivo(e.target.files?.[0])}
              style={{ fontSize: '13px' }} />
          )}

          {erro && (
            <p role="alert" style={{ padding: '10px 12px', background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '10px', color: '#a93226', fontWeight: '600' }}>{erro}</p>
          )}

          {previa && !progresso && (
            <div style={{ padding: '14px', background: DA.cream, borderRadius: '12px', border: `1px solid ${DA.warmBeige}` }}>
              <p style={{ fontWeight: '800', marginBottom: '6px' }}>
                {previa.livros.length} livro{previa.livros.length > 1 ? 's' : ''} para importar
                {previa.formato === 'goodreads' ? ' do Goodreads' : ''}
              </p>
              <p style={{ color: DA.walnut, marginBottom: '6px' }}>
                {porStatus.map(([s, n]) => `${n} ${ROTULO_STATUS[s] || s}`).join(', ')}
                {previa.repetidos > 0 && `. ${previa.repetidos} já estava${previa.repetidos > 1 ? 'm' : ''} na estante e fica${previa.repetidos > 1 ? 'm' : ''} de fora`}.
              </p>
              <p style={{ color: DA.walnut, marginBottom: '12px', fontSize: '12px' }}>
                Livro lido sem data no arquivo entra sem data: não conta para a meta deste ano.
              </p>
              <button type="button" onClick={importar} style={{
                background: GRAD_BTN, color: DA.cream, border: 'none', borderRadius: '10px',
                padding: '10px 18px', fontWeight: '800', cursor: 'pointer', fontSize: '14px',
              }}>
                Importar {previa.livros.length} livro{previa.livros.length > 1 ? 's' : ''}
              </button>
            </div>
          )}

          {progresso && (
            <p role="status" style={{ fontWeight: '700' }}>
              Importando… {progresso.feitos} de {progresso.total}
            </p>
          )}

          {concluido && (
            <p role="status" style={{ fontWeight: '700', color: DA.forestGreen }}>
              {concluido} livro{concluido > 1 ? 's' : ''} importado{concluido > 1 ? 's' : ''}.{' '}
              <button type="button" onClick={onConcluir} style={{ background: 'none', border: 'none', color: DA.oxblood, fontWeight: '800', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}>
                Ver a estante
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
