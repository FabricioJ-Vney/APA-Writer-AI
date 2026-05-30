import React, { useRef, useState } from 'react';
import { 
  FileText, 
  Trash2, 
  Sparkles, 
  Save, 
  BookOpen,
  HelpCircle,
  Plus,
  LayoutGrid,
  AlignLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import mammoth from 'mammoth';
import { obtenerTextoEjemploAPA } from '../utils/apaParser';
import { parsearTextoAPA } from '../utils/apaParser'; // Need to import this for tagging on file load!

export default function DraftInput({ 
  draftText, 
  setDraftText, 
  imagenes = {},
  setImagenes,
  nombreArchivo,
  setNombreArchivo,
  elementosFormateados = [],
  onFormatWithAI, 
  onSaveToSupabase, 
  onDeleteDocument,
  isAILoading, 
  isSaveLoading,
  documentos,
  onSelectDocument,
  selectedDocId,
  showTOC,
  setShowTOC
}) {
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);

  const [isSettingsCollapsed, setIsSettingsCollapsed] = useState(false);

  // --- SERIALIZADOR DE ELEMENTOS A TEXTO CRUDO ---
  const serializarElementosATexto = (elementos) => {
    let isInsidePortada = false;
    let textLines = [];

    elementos.forEach((el) => {
      if (el.tipo === 'portada') {
        if (!isInsidePortada) {
          textLines.push('[Portada]');
          isInsidePortada = true;
        }
        textLines.push(el.texto);
      } else {
        if (isInsidePortada) {
          textLines.push('[Fin Portada]');
          isInsidePortada = false;
        }

        if (el.tipo === 'titulo1') {
          textLines.push(`[Título] ${el.texto}`);
        } else if (el.tipo === 'titulo2') {
          textLines.push(`[Subtítulo] ${el.texto}`);
        } else if (el.tipo === 'titulo3') {
          textLines.push(`[Subsección] ${el.texto}`);
        } else if (el.tipo === 'parrafo') {
          textLines.push(`[Párrafo] ${el.texto}`);
        } else if (el.tipo === 'figura') {
          textLines.push(`[Figura] ${el.titulo} | ${el.nota} | ${el.base64}`);
        } else if (el.tipo === 'tabla') {
          let tablaStr = `[Tabla]\n${el.titulo}\n`;
          if (el.encabezados && el.encabezados.length > 0) {
            tablaStr += el.encabezados.join(' | ') + '\n';
          }
          if (el.filas && el.filas.length > 0) {
            el.filas.forEach(row => {
              tablaStr += row.join(' | ') + '\n';
            });
          }
          if (el.nota) {
            tablaStr += el.nota;
          }
          tablaStr = tablaStr.trim();
          textLines.push(tablaStr);
        } else if (el.tipo === 'referencia') {
          if (el.esPrimeraReferencia) {
            textLines.push('[Referencias]');
          }
          textLines.push(el.texto);
        }
      }
    });

    if (isInsidePortada) {
      textLines.push('[Fin Portada]');
    }

    return textLines.join('\n\n');
  };

  // --- AGRUPADOR DE ELEMENTOS PARA LA VISTA DE BLOQUES VISUAL ---
  const obtenerBloquesVisuales = () => {
    const bloques = [];
    let portadaAgrupada = null;

    elementosFormateados.forEach((el, idx) => {
      if (el.tipo === 'portada') {
        if (!portadaAgrupada) {
          portadaAgrupada = {
            tipo: 'portada',
            lineas: [el.texto],
            indicesOriginales: [idx]
          };
        } else {
          portadaAgrupada.lineas.push(el.texto);
          portadaAgrupada.indicesOriginales.push(idx);
        }
      } else {
        if (portadaAgrupada) {
          bloques.push(portadaAgrupada);
          portadaAgrupada = null;
        }
        bloques.push({
          ...el,
          indiceOriginal: idx
        });
      }
    });

    if (portadaAgrupada) {
      bloques.push(portadaAgrupada);
    }

    return bloques;
  };

  // --- ACCIONES EDITABLES PARA LA VISTA DE BLOQUES ---
  const handleElementTextChange = (idx, nuevoTexto) => {
    const nuevosElementos = [...elementosFormateados];
    nuevosElementos[idx] = { ...nuevosElementos[idx], texto: nuevoTexto };
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  const handleElementDelete = (idx) => {
    const nuevosElementos = elementosFormateados.filter((_, index) => index !== idx);
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  const handleElementTypeChange = (idx, nuevoTipo) => {
    const nuevosElementos = [...elementosFormateados];
    nuevosElementos[idx] = { ...nuevosElementos[idx], tipo: nuevoTipo };
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  const handlePortadaChange = (nuevasLineasStr) => {
    const lineas = nuevasLineasStr.split('\n');
    const nuevosElementos = elementosFormateados.filter(el => el.tipo !== 'portada');
    const portadaElementos = lineas.map((line, lIdx) => ({
      tipo: 'portada',
      rol: lIdx === 0 ? 'titulo' : 'detalle',
      texto: line,
      esUltimoDePortada: lIdx === lineas.length - 1
    }));
    setDraftText(serializarElementosATexto([...portadaElementos, ...nuevosElementos]));
  };

  const handleFigureChange = (idx, field, val) => {
    const nuevosElementos = [...elementosFormateados];
    nuevosElementos[idx] = { ...nuevosElementos[idx], [field]: val };
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  const handleTableTitleChange = (idx, val) => {
    const nuevosElementos = [...elementosFormateados];
    nuevosElementos[idx] = { ...nuevosElementos[idx], titulo: val };
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  const handleTableNotaChange = (idx, val) => {
    const nuevosElementos = [...elementosFormateados];
    nuevosElementos[idx] = { ...nuevosElementos[idx], nota: val };
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  const handleTableGridChange = (idx, val) => {
    const nuevosElementos = [...elementosFormateados];
    const lines = val.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let encabezados = [];
    let filas = [];
    if (lines.length > 0) {
      encabezados = lines[0].split('|').map(c => c.trim());
      for (let i = 1; i < lines.length; i++) {
        filas.push(lines[i].split('|').map(c => c.trim()));
      }
    }
    nuevosElementos[idx] = { ...nuevosElementos[idx], encabezados, filas };
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  const serializarTablaACrud = (block) => {
    let lines = [];
    if (block.encabezados && block.encabezados.length > 0) {
      lines.push(block.encabezados.join(' | '));
    }
    if (block.filas && block.filas.length > 0) {
      block.filas.forEach(row => {
        lines.push(row.join(' | '));
      });
    }
    return lines.join('\n');
  };

  // Añadir un nuevo tipo de bloque (Usado en el marcador de la Vista de Bloques)
  const handleAddBlockType = (tipo) => {
    let nuevoEl;
    if (tipo === 'portada') {
      nuevoEl = { tipo: 'portada', rol: 'titulo', texto: 'TÍTULO DE TU TRABAJO', esUltimoDePortada: true };
    } else if (tipo === 'titulo1') {
      nuevoEl = { tipo: 'titulo1', texto: 'Nuevo Título Principal' };
    } else if (tipo === 'titulo2') {
      nuevoEl = { tipo: 'titulo2', texto: 'Nuevo Subtítulo' };
    } else if (tipo === 'titulo3') {
      nuevoEl = { tipo: 'titulo3', texto: 'Nueva Subsección' };
    } else if (tipo === 'parrafo') {
      nuevoEl = { tipo: 'parrafo', texto: 'Nuevo párrafo de texto académico...' };
    } else if (tipo === 'figura') {
      imageInputRef.current.click();
      return;
    } else if (tipo === 'tabla') {
      nuevoEl = { 
        tipo: 'tabla', 
        titulo: 'Comparativa de Muestra', 
        encabezados: ['Variable', 'Grupo de Control', 'Grupo de Intervención'], 
        filas: [['Ansiedad', '6.54', '3.10']], 
        nota: 'Nota. Datos de muestra.' 
      };
    } else if (tipo === 'referencia') {
      nuevoEl = { tipo: 'referencia', texto: 'Autor, A. A. (Año). Título del libro. Editorial.' };
    }

    const nuevosElementos = [...elementosFormateados, nuevoEl];
    setDraftText(serializarElementosATexto(nuevosElementos));
  };

  // Subir y procesar imagen para el bloque de Figura
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      const imgId = `figura_${Date.now()}`;
      
      setImagenes(prev => ({
        ...prev,
        [imgId]: base64Data
      }));

      const nuevoEl = { tipo: 'figura', titulo: 'Título de la figura', nota: 'Nota. Descripción.', base64: imgId };
      const nuevosElementos = [...elementosFormateados, nuevoEl];
      setDraftText(serializarElementosATexto(nuevosElementos));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Insertar plantilla de tabla APA 7
  const handleInsertTable = () => {
    handleAddBlockType('tabla');
  };

  // Insertar plantilla de portada APA 7 delimitada
  const handleInsertPortada = () => {
    handleAddBlockType('portada');
  };

  // Importar archivo de texto (.txt) o documento Word (.docx)
  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
          const parsed = parsearTextoAPA(result.value);
          const serialized = serializarElementosATexto(parsed);
          setDraftText(serialized);
        } catch (err) {
          console.error("Error al leer archivo Word con Mammoth:", err);
          alert("No se pudo extraer el texto de este archivo .docx. Por favor, asegúrate de que no esté dañado.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const parsed = parsearTextoAPA(event.target.result);
        const serialized = serializarElementosATexto(parsed);
        setDraftText(serialized);
      };
      reader.readAsText(file);
    }
    
    // Resetear input file para poder re-importar el mismo archivo
    e.target.value = '';
  };

  // Cargar plantilla de ejemplo
  const handleLoadExample = () => {
    if (draftText && !window.confirm('¿Deseas reemplazar el borrador actual con el documento de ejemplo? Se perderán tus cambios no guardados.')) {
      return;
    }
    setDraftText(obtenerTextoEjemploAPA());
    setImagenes({}); // Resetear imágenes
  };

  // Limpiar texto
  const handleClearText = () => {
    if (window.confirm('¿Estás seguro de que deseas borrar todo el texto?')) {
      setDraftText('');
      setImagenes({});
    }
  };

  // Insertar marcador en la posición del cursor
  const insertMarker = (marker) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newText = before + marker + after;
    setDraftText(newText);

    // Reposicionar el cursor después de la inserción
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + marker.length;
    }, 0);
  };

  return (
    <div className="panel-izquierdo">
      <div className="panel-header">
        <div className="title-area" style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '65%' }}>
          <span className="app-subtitle">Nombre del Archivo / Documento</span>
          <input 
            type="text" 
            className="document-title-input font-accent"
            value={nombreArchivo} 
            onChange={(e) => setNombreArchivo(e.target.value)}
            placeholder="Escribe el nombre de tu archivo..."
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid transparent',
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--color-text-main)',
              outline: 'none',
              padding: '2px 0',
              width: '100%',
              transition: 'all 0.2s'
            }}
            onFocus={(e) => e.target.style.borderBottom = '1px solid var(--accent-blue)'}
            onBlur={(e) => e.target.style.borderBottom = '1px solid transparent'}
            title="Haz clic para renombrar tu archivo"
          />
        </div>
        <div className="panel-actions-header">
          <button 
            type="button" 
            className="btn-text-action font-accent" 
            onClick={handleLoadExample}
            title="Cargar texto de ejemplo listo para APA 7"
          >
            <BookOpen size={16} />
            Cargar Plantilla
          </button>
        </div>
      </div>

      <div className="draft-container" style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '12px' }}>
        {/* Panel de Configuración y Herramientas Colapsable */}
        <div className="collapsible-settings-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#fcfbfa', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px', transition: 'all 0.25s' }}>
          <div 
            onClick={() => setIsSettingsCollapsed(!isSettingsCollapsed)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
            title="Haz clic para mostrar u ocultar herramientas de marcadores y configuración"
          >
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={14} />
              Configuración de Formato y Marcadores
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--color-text-muted)' }}>
              <span>{isSettingsCollapsed ? 'Mostrar' : 'Ocultar'}</span>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                {isSettingsCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </span>
            </div>
          </div>
          
          {!isSettingsCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', animation: 'slideDown 0.2s ease-out' }}>
              {/* Guía de Marcadores (Haz clic para insertar) */}
              <div className="draft-instructions">
                <div className="instructions-header">
                  <HelpCircle size={14} className="icon-blue" />
                  <span>Guía de Marcadores (Haz clic para insertar):</span>
                </div>
                <div className="markers-grid">
                  <button type="button" className="marker-tag" onClick={handleInsertPortada} style={{ border: '1px solid rgba(43, 87, 154, 0.3)', background: 'rgba(43, 87, 154, 0.05)', color: 'var(--accent-blue)' }}>
                    <Plus size={12} /> + Portada
                  </button>
                  <button type="button" className="marker-tag" onClick={() => insertMarker('[Título] ')}>
                    <Plus size={12} /> [Título]
                  </button>
                  <button type="button" className="marker-tag" onClick={() => insertMarker('[Subtítulo] ')}>
                    <Plus size={12} /> [Subtítulo]
                  </button>
                  <button type="button" className="marker-tag" onClick={() => insertMarker('[Subsección] ')}>
                    <Plus size={12} /> [Subsección]
                  </button>
                  <button type="button" className="marker-tag" onClick={() => insertMarker('\n[Párrafo] ')}>
                    <Plus size={12} /> [Párrafo]
                  </button>
                  <button type="button" className="marker-tag" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981' }} onClick={() => imageInputRef.current.click()}>
                    <Plus size={12} /> + Figura
                  </button>
                  <button type="button" className="marker-tag" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981' }} onClick={handleInsertTable}>
                    <Plus size={12} /> + Tabla
                  </button>
                  <button type="button" className="marker-tag" onClick={() => insertMarker('\n[Referencias]\n')}>
                    <Plus size={12} /> [Referencias]
                  </button>
                </div>
              </div>

              {/* Toggle de Índice Automático */}
              <div className="toc-toggle-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fcfbfa', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-main)' }}>Incluir Índice de Contenidos</span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Crea una Tabla de Contenidos basada en tus títulos.</span>
                </div>
                <label className="switch-premium" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                  <input 
                    type="checkbox" 
                    checked={showTOC} 
                    onChange={(e) => setShowTOC(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span className="slider-premium" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: showTOC ? 'var(--accent-blue)' : '#ccc', transition: '0.4s', borderRadius: '20px' }}>
                    <span style={{ position: 'absolute', content: '""', height: '14px', width: '14px', left: showTOC ? '22px' : '4px', bottom: '3px', backgroundColor: 'white', transition: '0.4s', borderRadius: '50%' }}></span>
                  </span>
                </label>
              </div>

              {/* Historial de borradores guardados (si hay) con botón Eliminar */}
              {documentos && documentos.length > 0 && (
                <div className="documentos-guardados-bar" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label htmlFor="select-doc" className="doc-select-label">Borradores en Supabase:</label>
                  <select
                    id="select-doc"
                    className="doc-select"
                    value={selectedDocId || ''}
                    onChange={(e) => onSelectDocument(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">-- Documento Nuevo / Local --</option>
                    {documentos.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.titulo} ({new Date(doc.fecha_actualizacion).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                  {selectedDocId && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-icon icon-danger"
                      onClick={onDeleteDocument}
                      style={{ padding: '6px 10px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Eliminar borrador de Supabase"
                    >
                      <Trash2 size={14} />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Galería Premium de Figuras / Imágenes Cargadas en Miniatura */}
        {imagenes && Object.keys(imagenes).length > 0 && (
          <div className="loaded-images-gallery" style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#fcfbfa', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', animation: 'slideDown 0.25s ease-out' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={10} style={{ color: '#10b981' }} />
              Figuras Cargadas en este Documento:
            </span>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {Object.entries(imagenes).map(([id, base64]) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, position: 'relative' }}>
                  <img 
                    src={base64} 
                    alt={id} 
                    style={{ width: '40px', height: '30px', objectFit: 'cover', borderRadius: '3px', border: '1px solid rgba(0,0,0,0.08)' }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--accent-blue)' }}>{id}</span>
                    <button 
                      type="button" 
                      onClick={() => insertMarker(`\n[Figura] Título descriptivo de tu gráfica o imagen | Nota descriptiva de la figura. | ${id}\n`)}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#10b981', fontSize: '9px', fontWeight: '600', cursor: 'pointer', textAlign: 'left' }}
                    >
                      + Insertar Etiqueta
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('¿Deseas quitar esta imagen de tu biblioteca? Al hacerlo, se eliminará automáticamente su etiqueta [Figura] y texto descriptivo del documento.')) {
                        const copia = { ...imagenes };
                        delete copia[id];
                        setImagenes(copia);
                        
                        if (draftText) {
                          const lineas = draftText.split('\n');
                          const nuevasLineas = lineas.filter(line => !line.includes(id));
                          setDraftText(nuevasLineas.join('\n'));
                        }
                      }
                    }}
                    style={{ border: 'none', background: 'none', color: 'var(--color-danger)', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                    title="Eliminar de la biblioteca"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="textarea-wrapper" style={{ overflowY: editorMode === 'bloques' ? 'visible' : 'hidden' }}>
          {editorMode === 'bloques' ? (
            <div className="block-editor-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '20px' }}>
              {obtenerBloquesVisuales().map((block, bIdx) => {
                const selectClassMap = {
                  titulo1: 'block-select-titulo1',
                  titulo2: 'block-select-titulo2',
                  titulo3: 'block-select-titulo3',
                  parrafo: 'block-select-parrafo',
                  figura: 'block-select-figura',
                  tabla: 'block-select-tabla',
                  referencia: 'block-select-referencia'
                };

                const blockTypeLabels = {
                  titulo1: 'Título Principal (H1)',
                  titulo2: 'Subtítulo (H2)',
                  titulo3: 'Subsección (H3)',
                  parrafo: 'Párrafo',
                  figura: 'Figura (Imagen)',
                  tabla: 'Tabla APA 7',
                  referencia: 'Referencia Bibliográfica'
                };

                // --- PORTADA CARD ---
                if (block.tipo === 'portada') {
                  return (
                    <div key={`portada-${bIdx}`} className="block-card" style={{ borderLeft: '4px solid var(--accent-blue)' }}>
                      <div className="block-card-header">
                        <div className="block-badge-container">
                          <span className="block-type-select block-select-portada" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                            Portada Principal (Página 1)
                          </span>
                        </div>
                        <button
                          type="button"
                          className="block-delete-btn"
                          onClick={() => {
                            if (window.confirm('¿Deseas eliminar la portada completa del documento?')) {
                              const nuevosElementos = elementosFormateados.filter(el => el.tipo !== 'portada');
                              setDraftText(serializarElementosATexto(nuevosElementos));
                            }
                          }}
                          title="Eliminar Portada"
                        >
                          ×
                        </button>
                      </div>
                      <div className="block-field-group">
                        <label className="block-field-label">Contenido de la Portada (Línea por línea):</label>
                        <textarea
                          className="block-textarea"
                          rows={6}
                          placeholder="Línea 1: TÍTULO DEL TRABAJO&#10;Línea 2: Nombre Completo&#10;Línea 3: Universidad... etc."
                          value={block.lineas.join('\n')}
                          onChange={(e) => handlePortadaChange(e.target.value)}
                        />
                      </div>
                    </div>
                  );
                }

                // --- FIGURA (IMAGEN) CARD ---
                if (block.tipo === 'figura') {
                  const realImgSrc = imagenes[block.base64] || block.base64;
                  return (
                    <div key={`block-${bIdx}`} className="block-card" style={{ borderLeft: '4px solid #10b981' }}>
                      <div className="block-card-header">
                        <div className="block-badge-container">
                          <select
                            className="block-type-select block-select-figura"
                            value={block.tipo}
                            onChange={(e) => handleElementTypeChange(block.indiceOriginal, e.target.value)}
                          >
                            {Object.entries(blockTypeLabels).map(([tipoVal, label]) => (
                              <option key={tipoVal} value={tipoVal}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="block-delete-btn"
                          onClick={() => handleElementDelete(block.indiceOriginal)}
                          title="Eliminar Figura"
                        >
                          ×
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        {realImgSrc ? (
                          <div style={{ width: '70px', height: '55px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                            <img src={realImgSrc} alt="Miniatura" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: '70px', height: '55px', borderRadius: '6px', background: '#f5f4f2', border: '1px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '9px', color: 'var(--color-text-muted)', fontWeight: '600' }}>
                            Sin Imagen
                          </div>
                        )}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div className="block-field-group">
                            <label className="block-field-label">Título de la Figura:</label>
                            <input
                              type="text"
                              className="block-input"
                              value={block.titulo || ''}
                              onChange={(e) => handleFigureChange(block.indiceOriginal, 'titulo', e.target.value)}
                              placeholder="Ej: Gráfico de dispersión de ansiedad..."
                            />
                          </div>
                          <div className="block-field-group">
                            <label className="block-field-label">Nota de la Figura:</label>
                            <input
                              type="text"
                              className="block-input"
                              value={block.nota || ''}
                              onChange={(e) => handleFigureChange(block.indiceOriginal, 'nota', e.target.value)}
                              placeholder="Ej: Nota. Adaptado de Smith (2023)."
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // --- TABLA APA 7 CARD ---
                if (block.tipo === 'tabla') {
                  return (
                    <div key={`block-${bIdx}`} className="block-card" style={{ borderLeft: '4px solid #0d9488' }}>
                      <div className="block-card-header">
                        <div className="block-badge-container">
                          <select
                            className="block-type-select block-select-tabla"
                            value={block.tipo}
                            onChange={(e) => handleElementTypeChange(block.indiceOriginal, e.target.value)}
                          >
                            {Object.entries(blockTypeLabels).map(([tipoVal, label]) => (
                              <option key={tipoVal} value={tipoVal}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <button
                          type="button"
                          className="block-delete-btn"
                          onClick={() => handleElementDelete(block.indiceOriginal)}
                          title="Eliminar Tabla"
                        >
                          ×
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="block-field-group">
                          <label className="block-field-label">Título de la Tabla:</label>
                          <input
                            type="text"
                            className="block-input"
                            value={block.titulo || ''}
                            onChange={(e) => handleTableTitleChange(block.indiceOriginal, e.target.value)}
                            placeholder="Ej: Comparativa de Muestra..."
                          />
                        </div>
                        
                        <div className="block-field-group">
                          <label className="block-field-label">Celdas de la Tabla (Separadas por |):</label>
                          <textarea
                            className="block-textarea font-serif"
                            rows={3}
                            value={serializarTablaACrud(block)}
                            onChange={(e) => handleTableGridChange(block.indiceOriginal, e.target.value)}
                            placeholder="Encabezado 1 | Encabezado 2&#10;Dato Col 1 | Dato Col 2"
                          />
                        </div>

                        <div className="block-field-group">
                          <label className="block-field-label">Nota de la Tabla:</label>
                          <input
                            type="text"
                            className="block-input"
                            value={block.nota || ''}
                            onChange={(e) => handleTableNotaChange(block.indiceOriginal, e.target.value)}
                            placeholder="Ej: Nota. Datos del estudio preliminar."
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                // --- ESTÁNDAR TEXT CARD (Párrafo, Títulos, Referencias) ---
                const borderColors = {
                  titulo1: 'var(--accent-blue)',
                  titulo2: '#9333ea',
                  titulo3: '#0891b2',
                  parrafo: '#cbd5e1',
                  referencia: '#d97706'
                };

                return (
                  <div 
                    key={`block-${bIdx}`} 
                    className="block-card" 
                    style={{ borderLeft: `4px solid ${borderColors[block.tipo] || '#cbd5e1'}` }}
                  >
                    <div className="block-card-header">
                      <div className="block-badge-container">
                        <select
                          className={`block-type-select ${selectClassMap[block.tipo] || 'block-select-parrafo'}`}
                          value={block.tipo}
                          onChange={(e) => handleElementTypeChange(block.indiceOriginal, e.target.value)}
                        >
                          {Object.entries(blockTypeLabels).map(([tipoVal, label]) => (
                            <option key={tipoVal} value={tipoVal}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="block-delete-btn"
                        onClick={() => handleElementDelete(block.indiceOriginal)}
                        title="Eliminar bloque"
                      >
                        ×
                      </button>
                    </div>

                    <textarea
                      className={`block-textarea ${block.tipo.startsWith('titulo') ? 'font-accent' : block.tipo === 'referencia' ? 'font-serif' : ''}`}
                      rows={block.tipo.startsWith('titulo') ? 1 : 3}
                      style={{
                        fontWeight: block.tipo.startsWith('titulo') ? 'bold' : 'normal',
                        fontSize: block.tipo === 'titulo1' ? '15px' : block.tipo === 'titulo2' ? '14px' : block.tipo === 'titulo3' ? '13px' : '13.5px'
                      }}
                      value={block.texto || ''}
                      onChange={(e) => handleElementTextChange(block.indiceOriginal, e.target.value)}
                      placeholder={`Escribe el contenido del ${blockTypeLabels[block.tipo].toLowerCase()}...`}
                    />
                  </div>
                );
              })}
              
              {/* Selector de Nuevo Bloque al final */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', margin: '12px 0', padding: '12px', background: 'rgba(0,0,0,0.02)', borderRadius: '10px', border: '1px dashed var(--border-subtle)' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--color-text-muted)', width: '100%', textAlign: 'center', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  + Añadir Nuevo Bloque al Final:
                </span>
                <button type="button" className="marker-tag" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => handleAddBlockType('titulo1')}>
                  + Título (H1)
                </button>
                <button type="button" className="marker-tag" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => handleAddBlockType('titulo2')}>
                  + Subtítulo (H2)
                </button>
                <button type="button" className="marker-tag" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => handleAddBlockType('titulo3')}>
                  + Subsección (H3)
                </button>
                <button type="button" className="marker-tag" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => handleAddBlockType('parrafo')}>
                  + Párrafo
                </button>
                <button type="button" className="marker-tag" style={{ color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', fontSize: '10px', padding: '4px 8px' }} onClick={() => imageInputRef.current.click()}>
                  + Figura
                </button>
                <button type="button" className="marker-tag" style={{ color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', fontSize: '10px', padding: '4px 8px' }} onClick={() => handleAddBlockType('tabla')}>
                  + Tabla
                </button>
                <button type="button" className="marker-tag" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => handleAddBlockType('referencia')}>
                  + Referencia
                </button>
              </div>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              className="draft-textarea"
              placeholder="[Portada]&#10;TÍTULO DE TU TRABAJO&#10;Tu Nombre&#10;Tu Institución&#10;&#10;[Título] Título Principal&#10;&#10;[Párrafo] Escribe o pega tu borrador aquí. Puedes marcar tu título, subtítulo o subsección con los botones superiores, o simplemente pegar un texto plano desorganizado y la app lo formateará automáticamente en tiempo real."
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              disabled={isAILoading}
            />
          )}
          
          {isAILoading && (
            <div className="glass-loader">
              <div className="spinner"></div>
              <p className="loader-text font-accent">Gemini IA está puliendo y corrigiendo tu texto al formato formal APA 7...</p>
            </div>
          )}
        </div>

        <div className="draft-footer-actions">
          <div className="footer-left-buttons">
            <input
              type="file"
              accept=".txt,.docx"
              ref={fileInputRef}
              onChange={handleImportFile}
              style={{ display: 'none' }}
            />
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            <button 
              type="button" 
              className="btn btn-secondary btn-icon"
              onClick={() => fileInputRef.current.click()}
              disabled={isAILoading}
            >
              <FileText size={16} />
              <span>Importar (.txt, .docx)</span>
            </button>
            <button 
              type="button" 
              className="btn btn-secondary btn-icon icon-danger"
              onClick={handleClearText}
              disabled={isAILoading || !draftText}
              title="Borrar todo el texto"
            >
              <Trash2 size={16} />
              <span>Borrar</span>
            </button>
          </div>

          <div className="footer-right-buttons">
            <button 
              type="button" 
              className="btn btn-supabase btn-icon"
              onClick={onSaveToSupabase}
              disabled={isAILoading || isSaveLoading || !draftText}
            >
              <Save size={16} />
              <span>{isSaveLoading ? 'Guardando...' : 'Guardar en Supabase'}</span>
            </button>
            <button 
              type="button" 
              className="btn btn-primary btn-icon btn-pulse"
              onClick={onFormatWithAI}
              disabled={isAILoading || !draftText}
            >
              <Sparkles size={16} />
              <span>Optimizar con Gemini IA</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
