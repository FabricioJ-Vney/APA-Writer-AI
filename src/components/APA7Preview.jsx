import React, { useState } from 'react';
import { 
  Download, 
  Copy, 
  Check, 
  BookOpen, 
  Sparkles, 
  Link as LinkIcon, 
  FileCheck
} from 'lucide-react';
import { generateCitation } from '../services/geminiService';
import { guardarReferencia } from '../services/supabaseService';

export default function APA7Preview({ 
  elementos, 
  tituloDocumento, 
  onExportDocx, 
  documentoId,
  onAgregarReferenciaDirecta
}) {
  const [copied, setCopied] = useState(false);
  const [citationInput, setCitationInput] = useState('');
  const [isCitationLoading, setIsCitationLoading] = useState(false);
  const [generatedRef, setGeneratedRef] = useState(null);
  const [showCitationTool, setShowCitationTool] = useState(false);

  // Copiar el texto completo del documento
  const handleCopyText = () => {
    if (elementos.length === 0) return;
    
    const plainText = elementos.map(el => {
      if (el.tipo === 'portada') return el.texto;
      if (el.tipo === 'titulo1') return `\n${el.texto}\n`;
      if (el.tipo === 'titulo2') return `\n${el.texto}\n`;
      if (el.tipo === 'titulo3') return `\n${el.texto}\n`;
      if (el.tipo === 'referencia') return el.texto;
      return el.texto;
    }).join('\n');

    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generar cita mediante Gemini
  const handleGenerateCitation = async (e) => {
    e.preventDefault();
    if (!citationInput.trim()) return;

    setIsCitationLoading(true);
    setGeneratedRef(null);
    try {
      const result = await generateCitation(citationInput);
      if (result) {
        setGeneratedRef(result);
        
        // Si hay un documento activo, guardarla en Supabase vinculada a este documento
        if (documentoId) {
          const docIdLimpio = documentoId.startsWith('local_') ? null : documentoId;
          const refGuardada = await guardarReferencia({
            documento_id: docIdLimpio || '00000000-0000-0000-0000-000000000000', // ID temporal o de desarrollo
            autor: result.autor,
            anio: result.anio,
            titulo: result.titulo,
            fuente: result.fuente,
            doi_url: result.doi_url || '',
            cita_parentetica: result.cita_parentetica,
            cita_narrativa: result.cita_narrativa
          });
          console.log('Referencia guardada en DB:', refGuardada);
        }

        // Agregar la referencia al texto actual en la interfaz
        const refTextoAPA = `${result.autor} (${result.anio}). ${result.titulo}. ${result.fuente}.${result.doi_url ? ' ' + result.doi_url : ''}`;
        onAgregarReferenciaDirecta(refTextoAPA);
      }
    } catch (error) {
      console.error('Error al generar la cita:', error);
      alert('Ocurrió un error al generar la cita con la IA.');
    } finally {
      setIsCitationLoading(false);
    }
  };

  const handleCopyCitationParentetica = () => {
    if (!generatedRef) return;
    navigator.clipboard.writeText(generatedRef.cita_parentetica);
    alert(`Cita parentética copiada: ${generatedRef.cita_parentetica}`);
  };

  const handleCopyCitationNarrativa = () => {
    if (!generatedRef) return;
    navigator.clipboard.writeText(generatedRef.cita_narrativa);
    alert(`Cita narrativa copiada: ${generatedRef.cita_narrativa}`);
  };

  const hasReferencias = elementos.some(el => el.tipo === 'referencia');
  const indexPrimeraReferencia = elementos.findIndex(el => el.tipo === 'referencia');

  // Calcular números de página estimados y dinámicos para los títulos (Portada = pág 1, Contenidos = pág 2, Texto = pág 3+)
  const headingPages = {};
  let currentPage = 3;
  let currentParagraphCount = 0;
  
  elementos.forEach((el) => {
    if (['titulo1', 'titulo2', 'titulo3'].includes(el.tipo)) {
      headingPages[el.texto] = currentPage;
    } else if (el.tipo === 'parrafo') {
      currentParagraphCount++;
      if (currentParagraphCount > 0 && currentParagraphCount % 4 === 0) {
        currentPage++;
      }
    }
  });

  return (
    <div className="panel-derecho">
      <div className="panel-header">
        <div className="title-area">
          <span className="app-subtitle">Auto-formateado APA 7</span>
          <h2 className="panel-title">APA 7 Preview</h2>
        </div>
        <div className="toolbar-preview">
          <button 
            type="button" 
            className="btn btn-secondary btn-small font-accent"
            onClick={() => setShowCitationTool(!showCitationTool)}
          >
            <Sparkles size={14} className="icon-blue" />
            Citar con IA
          </button>
          <button 
            type="button" 
            className="btn btn-secondary btn-small font-accent" 
            onClick={handleCopyText}
            disabled={elementos.length === 0}
          >
            {copied ? <Check size={14} className="icon-success" /> : <Copy size={14} />}
            <span>{copied ? 'Copiado' : 'Copiar Texto'}</span>
          </button>
          <button 
            type="button" 
            className="btn btn-primary btn-small font-accent" 
            onClick={onExportDocx}
            disabled={elementos.length === 0}
          >
            <Download size={14} />
            <span>Guardar .docx</span>
          </button>
        </div>
      </div>

      <div className="preview-container">
        {/* Generador de citas inteligente */}
        {showCitationTool && (
          <div className="citation-tool-card glassmorphic">
            <div className="card-header-tool">
              <span className="card-title-tool">
                <Sparkles size={14} className="icon-blue" />
                Generador de Citas Bibliográficas APA 7
              </span>
              <button 
                type="button" 
                className="close-tool" 
                onClick={() => {
                  setShowCitationTool(false);
                  setGeneratedRef(null);
                  setCitationInput('');
                }}
              >
                ×
              </button>
            </div>
            <p className="card-desc-tool">
              Pega un DOI, una URL o describe la fuente (Libro, Revista, Sitio Web) y Gemini IA la convertirá a formato APA 7.
            </p>
            <form onSubmit={handleGenerateCitation} className="tool-form">
              <div className="input-group-tool">
                <LinkIcon size={16} className="icon-gray" />
                <input 
                  type="text" 
                  className="tool-input"
                  placeholder="Ej: https://doi.org/10.1037/0000165-000 o Libro 100 años de soledad..."
                  value={citationInput}
                  onChange={(e) => setCitationInput(e.target.value)}
                  disabled={isCitationLoading}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary btn-tool"
                  disabled={isCitationLoading || !citationInput.trim()}
                >
                  {isCitationLoading ? 'Procesando...' : 'Generar'}
                </button>
              </div>
            </form>

            {isCitationLoading && (
              <div className="tool-loading">
                <div className="mini-spinner"></div>
                <span>Extrayendo metadatos y construyendo la referencia...</span>
              </div>
            )}

            {generatedRef && (
              <div className="tool-results animated-fade-in">
                <div className="ref-result-box">
                  <div className="ref-label">Referencia Bibliográfica (Añadida al final de tu documento):</div>
                  <div className="ref-text font-serif">
                    {generatedRef.autor} ({generatedRef.anio}). <em>{generatedRef.titulo}</em>. {generatedRef.fuente}.{generatedRef.doi_url ? ' ' + generatedRef.doi_url : ''}
                  </div>
                </div>
                <div className="citations-copiers">
                  <div className="copy-cit-box">
                    <span className="cit-label">Cita Parentética:</span>
                    <button type="button" className="btn-copy-cit" onClick={handleCopyCitationParentetica}>
                      <code>{generatedRef.cita_parentetica}</code>
                      <Copy size={12} />
                    </button>
                  </div>
                  <div className="copy-cit-box">
                    <span className="cit-label">Cita Narrativa:</span>
                    <button type="button" className="btn-copy-cit" onClick={handleCopyCitationNarrativa}>
                      <code>{generatedRef.cita_narrativa}</code>
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div className="success-toast">
                  <FileCheck size={14} className="icon-success" />
                  <span>¡Referencia insertada con éxito en la sección final de Referencias!</span>
                </div>
              </div>
            )}
          </div>
        )}

        {elementos.length === 0 ? (
          <div className="preview-empty-state">
            <BookOpen size={48} className="icon-gray animate-bounce" />
            <h3 className="empty-title">Tu Vista Previa Académica</h3>
            <p className="empty-desc">
              Introduce texto en el panel izquierdo o presiona <strong>"Cargar Plantilla"</strong> para visualizar instantáneamente tu trabajo bajo las estrictas normas APA 7 de forma fidedigna.
            </p>
          </div>
        ) : (
          <div className="paper-workspace">
            {/* Simulación física de Hoja de Papel Bond */}
            <div className="paper-sheet font-serif">
              {/* Numeración superior derecha */}
              <div className="paper-page-number">1</div>

              {/* Contenido del papel */}
              {elementos.map((el, i) => {
                // Si el elemento es portada
                if (el.tipo === 'portada') {
                  const esTitulo = el.rol === 'titulo';
                  return (
                    <div 
                      key={i} 
                      className={`paper-portada-item ${esTitulo ? 'portada-titulo' : ''}`}
                    >
                      {el.texto}
                      {el.esUltimoDePortada && (
                        <>
                          <div className="paper-page-break-indicator">
                            <span>[Salto de Página Académico]</span>
                          </div>
                          
                          {/* --- VISTA PREVIA DEL ÍNDICE DE CONTENIDOS (APA 7) --- */}
                          <div className="paper-toc-section" style={{ textIndent: 0, paddingLeft: 0, marginBottom: '2em' }}>
                            <h1 className="paper-heading-1" style={{ marginTop: '0.5em', marginBottom: '1.2em' }}>
                              Contenidos
                            </h1>
                            {elementos.filter(item => ['titulo1', 'titulo2', 'titulo3'].includes(item.tipo)).length === 0 ? (
                              <div style={{ fontStyle: 'italic', fontSize: '10pt', color: 'var(--color-text-muted)', textAlign: 'center', margin: '20px 0' }}>
                                [Los títulos que agregues en el editor aparecerán automáticamente en este índice]
                              </div>
                            ) : (
                              elementos.filter(item => ['titulo1', 'titulo2', 'titulo3'].includes(item.tipo)).map((heading, hIdx) => {
                                let indent = '0cm';
                                let weight = 'normal';
                                let style = 'normal';
                                
                                if (heading.tipo === 'titulo1') {
                                  indent = '0cm';
                                  weight = 'bold';
                                } else if (heading.tipo === 'titulo2') {
                                  indent = '0.8cm';
                                  weight = 'normal';
                                } else if (heading.tipo === 'titulo3') {
                                  indent = '1.6cm';
                                  style = 'italic';
                                }

                                const pageNum = headingPages[heading.texto] || 3;

                                return (
                                  <div 
                                    key={hIdx} 
                                    className="paper-toc-row" 
                                    style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'flex-end', 
                                      paddingLeft: indent,
                                      fontWeight: weight,
                                      fontStyle: style,
                                      textIndent: 0,
                                      marginBottom: '6px',
                                      fontSize: '10.5pt'
                                    }}
                                  >
                                    <span className="toc-title" style={{ background: 'white', paddingRight: '4px', zIndex: 2 }}>
                                      {heading.texto}
                                    </span>
                                    <span className="toc-dots" style={{ 
                                      flex: 1, 
                                      borderBottom: '2px dotted #000000', 
                                      margin: '0 6px', 
                                      position: 'relative', 
                                      bottom: '4px', 
                                      zIndex: 1 
                                    }}></span>
                                    <span className="toc-page" style={{ background: 'white', paddingLeft: '4px', zIndex: 2 }}>
                                      {pageNum}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <div className="paper-page-break-indicator">
                            <span>[Salto de Página Académico]</span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                }

                // Títulos de Nivel 1 (Centrados, Negrita)
                if (el.tipo === 'titulo1') {
                  return (
                    <h1 key={i} className="paper-heading-1">
                      {el.texto}
                    </h1>
                  );
                }

                // Títulos de Nivel 2 (Izquierda, Negrita)
                if (el.tipo === 'titulo2') {
                  return (
                    <h2 key={i} className="paper-heading-2">
                      {el.texto}
                    </h2>
                  );
                }

                // Títulos de Nivel 3 (Izquierda, Negrita, Cursiva)
                if (el.tipo === 'titulo3') {
                  return (
                    <h3 key={i} className="paper-heading-3">
                      {el.texto}
                    </h3>
                  );
                }

                // Párrafos regulares (Sangría en primera línea)
                if (el.tipo === 'parrafo') {
                  return (
                    <p key={i} className="paper-paragraph">
                      {el.texto}
                    </p>
                  );
                }

                // Sección de Referencias
                if (el.tipo === 'referencia') {
                  const items = [];
                  // Agregar el título central si es el primer elemento de referencia
                  if (el.esPrimeraReferencia) {
                    items.push(
                      <div key={`ref-title-${i}`} className="paper-page-break-indicator">
                        <span>[Salto de Página Académico]</span>
                      </div>
                    );
                    items.push(
                      <h1 key={`ref-head-${i}`} className="paper-heading-1 references-title">
                        Referencias
                      </h1>
                    );
                  }

                  // Añadir la referencia propiamente con sangría francesa
                  items.push(
                    <p key={`ref-body-${i}`} className="paper-reference">
                      {el.texto}
                    </p>
                  );

                  return <React.Fragment key={i}>{items}</React.Fragment>;
                }

                return null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
