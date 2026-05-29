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
  onAgregarReferenciaDirecta,
  showTOC,
  setDraftText
}) {
  const [copied, setCopied] = useState(false);
  const [citationInput, setCitationInput] = useState('');
  const [isCitationLoading, setIsCitationLoading] = useState(false);
  const [generatedRef, setGeneratedRef] = useState(null);
  const [showCitationTool, setShowCitationTool] = useState(false);

  // Estados locales editables en caliente
  const [editRef, setEditRef] = useState('');
  const [editParentetica, setEditParentetica] = useState('');
  const [editNarrativa, setEditNarrativa] = useState('');
  const [ultimaCitaInsertada, setUltimaCitaInsertada] = useState('');
  const [seleccionActual, setSeleccionActual] = useState(''); // 'parentetica' | 'narrativa' | ''

  // Inserta texto dinámicamente en el cursor y reemplaza de forma atómica la selección previa
  const insertAtCursor = (textoAInsertar, reemplazoPrevio = '') => {
    const textarea = document.querySelector('.draft-textarea');
    if (!textarea) {
      setDraftText(prev => prev + ' ' + textoAInsertar);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    let newText;
    let newStart;

    if (reemplazoPrevio && text.includes(reemplazoPrevio)) {
      newText = text.replace(reemplazoPrevio, textoAInsertar);
      newStart = text.indexOf(reemplazoPrevio) + textoAInsertar.length;
    } else {
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      newText = before + textoAInsertar + after;
      newStart = start + textoAInsertar.length;
    }

    setDraftText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newStart;
    }, 0);
  };

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
    setUltimaCitaInsertada('');
    setSeleccionActual('');

    try {
      const result = await generateCitation(citationInput);
      if (result) {
        setGeneratedRef(result);
        
        // Inicializar campos de edición en caliente
        const fullRefStr = `${result.autor} (${result.anio}). ${result.titulo}. ${result.fuente}.${result.doi_url ? ' ' + result.doi_url : ''}`;
        setEditRef(fullRefStr);
        setEditParentetica(result.cita_parentetica);
        setEditNarrativa(result.cita_narrativa);
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
    } else if (el.tipo === 'figura' || el.tipo === 'tabla') {
      // Las figuras y tablas físicas ocupan un espacio sustancial, lo que incrementa el conteo de página estimado
      currentPage++;
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
              <div className="tool-results animated-fade-in" style={{ marginTop: '14px', background: '#fcfbfa', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px' }}>
                
                {/* Referencia Bibliográfica Editable */}
                <div className="ref-result-box" style={{ marginBottom: '14px' }}>
                  <div className="ref-label" style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--accent-blue)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Referencia Bibliográfica (Personalizable - Se agregará al final al confirmar):
                  </div>
                  <textarea
                    className="ref-textarea-edit font-serif"
                    value={editRef}
                    onChange={(e) => setEditRef(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '75px',
                      padding: '10px',
                      fontSize: '11.5px',
                      fontFamily: 'var(--font-paper)',
                      borderRadius: '6px',
                      border: '1px solid #d1c7bd',
                      background: 'white',
                      lineHeight: '1.6',
                      outline: 'none',
                      resize: 'vertical',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
                    }}
                  />
                </div>

                {/* Selección y Edición en Tiempo Real de Citas en Texto */}
                <div className="ref-label" style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--color-text-main)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Selecciona la Cita para Insertar e Intercambiar en tu Texto:
                </div>
                
                <div className="citations-copiers" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  
                  {/* Cita Parentética */}
                  <div 
                    className="copy-cit-box" 
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px',
                      border: seleccionActual === 'parentetica' ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      background: seleccionActual === 'parentetica' ? 'var(--accent-blue-light)' : 'white',
                      padding: '12px',
                      borderRadius: '8px',
                      transition: 'all 0.22s ease',
                      cursor: 'pointer',
                      boxShadow: seleccionActual === 'parentetica' ? '0 4px 12px rgba(43, 87, 154, 0.08)' : 'none'
                    }}
                    onClick={() => {
                      const prevVal = ultimaCitaInsertada;
                      insertAtCursor(editParentetica, prevVal);
                      setUltimaCitaInsertada(editParentetica);
                      setSeleccionActual('parentetica');
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="cit-label" style={{ fontSize: '10.5px', fontWeight: '700', color: seleccionActual === 'parentetica' ? 'var(--accent-blue)' : 'var(--color-text-muted)' }}>Cita Parentética</span>
                      <input 
                        type="radio" 
                        name="tipo_cita" 
                        checked={seleccionActual === 'parentetica'}
                        onChange={() => {}} // Manejado por onClick
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <input 
                      type="text"
                      className="tool-input-edit"
                      value={editParentetica}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        const oldVal = editParentetica;
                        setEditParentetica(newVal);
                        if (seleccionActual === 'parentetica') {
                          insertAtCursor(newVal, oldVal);
                          setUltimaCitaInsertada(newVal);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        fontFamily: 'monospace',
                        border: '1px solid #d1c7bd',
                        borderRadius: '4px',
                        outline: 'none',
                        background: 'white',
                        marginTop: '6px'
                      }}
                    />
                    <span style={{ fontSize: '9px', color: seleccionActual === 'parentetica' ? 'var(--accent-blue)' : 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      {seleccionActual === 'parentetica' ? '✓ Insertada y editándose en vivo' : 'Haz clic para insertar'}
                    </span>
                  </div>

                  {/* Cita Narrativa */}
                  <div 
                    className="copy-cit-box" 
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '4px',
                      border: seleccionActual === 'narrativa' ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      background: seleccionActual === 'narrativa' ? 'var(--accent-blue-light)' : 'white',
                      padding: '12px',
                      borderRadius: '8px',
                      transition: 'all 0.22s ease',
                      cursor: 'pointer',
                      boxShadow: seleccionActual === 'narrativa' ? '0 4px 12px rgba(43, 87, 154, 0.08)' : 'none'
                    }}
                    onClick={() => {
                      const prevVal = ultimaCitaInsertada;
                      insertAtCursor(editNarrativa, prevVal);
                      setUltimaCitaInsertada(editNarrativa);
                      setSeleccionActual('narrativa');
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="cit-label" style={{ fontSize: '10.5px', fontWeight: '700', color: seleccionActual === 'narrativa' ? 'var(--accent-blue)' : 'var(--color-text-muted)' }}>Cita Narrativa</span>
                      <input 
                        type="radio" 
                        name="tipo_cita" 
                        checked={seleccionActual === 'narrativa'}
                        onChange={() => {}} // Manejado por onClick
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <input 
                      type="text"
                      className="tool-input-edit"
                      value={editNarrativa}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        const oldVal = editNarrativa;
                        setEditNarrativa(newVal);
                        if (seleccionActual === 'narrativa') {
                          insertAtCursor(newVal, oldVal);
                          setUltimaCitaInsertada(newVal);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        fontFamily: 'monospace',
                        border: '1px solid #d1c7bd',
                        borderRadius: '4px',
                        outline: 'none',
                        background: 'white',
                        marginTop: '6px'
                      }}
                    />
                    <span style={{ fontSize: '9px', color: seleccionActual === 'narrativa' ? 'var(--accent-blue)' : 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      {seleccionActual === 'narrativa' ? '✓ Insertada y editándose en vivo' : 'Haz clic para insertar'}
                    </span>
                  </div>

                </div>

                {/* Botón de Confirmación Definitiva */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '12px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--color-success)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileCheck size={14} /> ¡Cita en texto sincronizada!
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      // 1. Guardar la referencia estructurada en la Base de Datos si hay documento activo
                      if (documentoId && generatedRef) {
                        try {
                          const docIdLimpio = documentoId.startsWith('local_') ? null : documentoId;
                          await guardarReferencia({
                            documento_id: docIdLimpio || '00000000-0000-0000-0000-000000000000',
                            autor: generatedRef.autor,
                            anio: generatedRef.anio,
                            titulo: generatedRef.titulo,
                            fuente: generatedRef.fuente,
                            doi_url: generatedRef.doi_url || '',
                            cita_parentetica: editParentetica,
                            cita_narrativa: editNarrativa
                          });
                        } catch (err) {
                          console.error("Error al guardar referencia al confirmar:", err);
                        }
                      }
                      
                      // 2. Anexar definitivamente la Referencia Bibliográfica al listado final de referencias
                      onAgregarReferenciaDirecta(editRef);
                      
                      // 3. Cerrar el panel y limpiar estados transitorios
                      setShowCitationTool(false);
                      setGeneratedRef(null);
                      setCitationInput('');
                      setUltimaCitaInsertada('');
                      setSeleccionActual('');
                      
                      alert("¡Cita y referencia añadidas con éxito al documento!");
                    }}
                    style={{
                      padding: '8px 18px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      background: 'var(--color-success)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(46, 125, 50, 0.15)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Check size={14} /> Confirmar y Listo
                  </button>
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
              {(() => {
                let figureCounter = 0;
                let tableCounter = 0;
                return elementos.map((el, i) => {
                // Si el elemento es portada
                if (el.tipo === 'portada') {
                  const esTitulo = el.rol === 'titulo';
                  return (
                    <div 
                      key={i} 
                      className={`paper-portada-item ${esTitulo ? 'portada-titulo' : ''}`}
                    >
                      {el.texto || '\u00A0'}
                      {el.esUltimoDePortada && (
                        <>
                          <div className="paper-page-break-indicator">
                            <span>[Salto de Página Académico]</span>
                          </div>
                          
                          {/* --- VISTA PREVIA DEL ÍNDICE DE CONTENIDOS (APA 7) --- */}
                          {showTOC && (
                            <>
                              <div className="paper-toc-section" style={{ textIndent: 0, paddingLeft: 0, marginBottom: '2em' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2em', position: 'relative' }}>
                                  <h1 className="paper-heading-1" style={{ margin: 0, width: '100%', textAlign: 'center' }}>
                                    Contenidos
                                  </h1>
                                  <button 
                                    type="button" 
                                    className="btn-text-action font-accent" 
                                    style={{ position: 'absolute', right: '0cm', fontSize: '9px', padding: '2px 6px', background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                    onClick={() => {
                                      alert('Índice recalculado e índices de páginas actualizados con las secciones vigentes.');
                                      window.dispatchEvent(new Event('resize')); // Disparar resize para forzar actualización de layout
                                    }}
                                    title="Actualizar y recalcular páginas"
                                  >
                                    Actualizar Índice
                                  </button>
                                </div>
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
                        </>
                      )}
                    </div>
                  );
                }

                // Figuras (Imágenes/Gráficos APA 7)
                if (el.tipo === 'figura') {
                  figureCounter++;
                  return (
                    <div key={i} className="paper-figure-container" style={{ textIndent: 0, paddingLeft: 0, marginTop: '1.5em', marginBottom: '1.5em', textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Figura {figureCounter}</div>
                      <div style={{ fontStyle: 'italic', marginBottom: '12px' }}>{el.titulo}</div>
                      {el.base64 ? (
                        <div style={{ textAlign: 'center', background: '#faf9f6', padding: '10px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.03)' }}>
                          <img 
                            src={el.base64} 
                            alt={el.titulo} 
                            style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', display: 'inline-block' }} 
                          />
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', border: '1px dashed #ccc', color: '#888', fontStyle: 'italic', fontSize: '10pt' }}>
                          [Imagen no cargada]
                        </div>
                      )}
                      {el.nota && (
                        <div style={{ fontSize: '10pt', marginTop: '8px', lineHeight: '1.5' }}>
                          <span style={{ fontStyle: 'italic' }}>Nota.</span> {el.nota.replace(/^nota\.\s*/i, '')}
                        </div>
                      )}
                    </div>
                  );
                }

                // Tablas (APA 7 - Sin líneas verticales, bordes horizontales selectivos)
                if (el.tipo === 'tabla') {
                  tableCounter++;
                  return (
                    <div key={i} className="paper-table-container" style={{ textIndent: 0, paddingLeft: 0, marginTop: '1.5em', marginBottom: '1.5em', textAlign: 'left' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Tabla {tableCounter}</div>
                      <div style={{ fontStyle: 'italic', marginBottom: '12px' }}>{el.titulo}</div>
                      
                      <table 
                        style={{ 
                          width: '100%', 
                          borderCollapse: 'collapse', 
                          fontFamily: 'var(--font-paper)', 
                          fontSize: '10pt', 
                          borderTop: '2px solid #000000', 
                          borderBottom: '2px solid #000000',
                          marginBottom: '8px',
                          textIndent: 0
                        }}
                      >
                        {el.encabezados && el.encabezados.length > 0 && (
                          <thead>
                            <tr style={{ borderBottom: '1px solid #000000' }}>
                              {el.encabezados.map((header, hIdx) => (
                                <th 
                                  key={hIdx} 
                                  style={{ 
                                    padding: '8px 12px', 
                                    textAlign: hIdx === 0 ? 'left' : 'right', 
                                    fontWeight: 'bold',
                                    borderBottom: '1px solid #000000'
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        {el.filas && el.filas.length > 0 && (
                          <tbody>
                            {el.filas.map((fila, rIdx) => (
                              <tr key={rIdx}>
                                {fila.map((cell, cIdx) => (
                                  <td 
                                    key={cIdx} 
                                    style={{ 
                                      padding: '8px 12px', 
                                      textAlign: cIdx === 0 ? 'left' : 'right'
                                    }}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        )}
                      </table>

                      {el.nota && (
                        <div style={{ fontSize: '10pt', marginTop: '8px', lineHeight: '1.5' }}>
                          <span style={{ fontStyle: 'italic' }}>Nota.</span> {el.nota.replace(/^nota\.\s*/i, '')}
                        </div>
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
                });
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
