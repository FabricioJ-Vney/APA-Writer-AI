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
  ChevronUp,
  GripVertical
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
  const [selectedVisualBlockIdx, setSelectedVisualBlockIdx] = useState(null);
  const [draggableIdx, setDraggableIdx] = useState(null);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Drag and drop styles helper
  const getDragDropStyle = (bIdx, isSelected, baseBorderLeft) => {
    return {
      borderLeft: baseBorderLeft,
      boxShadow: isSelected ? '0 0 0 2px var(--accent-blue), 0 8px 24px rgba(43, 87, 154, 0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
      transform: isSelected ? 'scale(1.002)' : 'none',
      transition: 'all 0.2s ease',
      outline: 'none',
      borderTop: dragOverIdx === bIdx && draggedIdx > bIdx ? '3px solid var(--accent-blue)' : undefined,
      borderBottom: dragOverIdx === bIdx && draggedIdx < bIdx ? '3px solid var(--accent-blue)' : undefined,
      opacity: draggedIdx === bIdx ? 0.5 : 1
    };
  };

  // Helper to dynamically calculate rows based on paragraph contents to keep text fully visible
  const calculateRows = (text, type) => {
    if (type.startsWith('titulo')) return 1;
    if (!text) return 3;
    const lines = text.split('\n');
    let rowCount = 0;
    lines.forEach(line => {
      rowCount += Math.max(1, Math.ceil(line.length / 75));
    });
    return Math.max(3, rowCount);
  };

  // --- SERIALIZADOR DE ELEMENTOS A TEXTO CRUDO ---
  const serializarElementosATexto = (elementos) => {
    let textLines = [];
    let lineasPortada = [];

    elementos.forEach((el) => {
      if (el.tipo === 'portada') {
        lineasPortada.push(el.texto);
      } else {
        if (lineasPortada.length > 0) {
          textLines.push(`[Portada]\n${lineasPortada.join('\n')}\n[Fin Portada]`);
          lineasPortada = [];
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
        } else if (el.tipo === 'indice') {
          textLines.push('[Índice]');
        }
      }
    });

    if (lineasPortada.length > 0) {
      textLines.push(`[Portada]\n${lineasPortada.join('\n')}\n[Fin Portada]`);
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
    const lines = val.split('\n').map(l => l.replace(/^\s+/, '')).filter(l => l.replace(/^\s+/, '').length > 0);
    let encabezados = [];
    let filas = [];
    if (lines.length > 0) {
      encabezados = lines[0].split('|').map(c => c.replace(/^\s+/, ''));
      for (let i = 1; i < lines.length; i++) {
        filas.push(lines[i].split('|').map(c => c.replace(/^\s+/, '')));
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

  // Helper to reorder/move visual blocks up or down in the document structure
  const handleMoveVisualBlock = (bIdx, direction) => {
    const visualBlocks = obtenerBloquesVisuales();
    if (direction === 'up' && bIdx === 0) return;
    if (direction === 'down' && bIdx === visualBlocks.length - 1) return;

    const swapIdx = direction === 'up' ? bIdx - 1 : bIdx + 1;
    const temp = visualBlocks[bIdx];
    visualBlocks[bIdx] = visualBlocks[swapIdx];
    visualBlocks[swapIdx] = temp;

    // Reconstruct the flat list of elements from visualBlocks
    const nuevosElementos = [];
    visualBlocks.forEach(block => {
      if (block.tipo === 'portada') {
        block.lineas.forEach((line, lIdx) => {
          nuevosElementos.push({
            tipo: 'portada',
            rol: lIdx === 0 ? 'titulo' : 'detalle',
            texto: line,
            esUltimoDePortada: lIdx === block.lineas.length - 1
          });
        });
      } else {
        const { indiceOriginal, indicesOriginales, ...rest } = block;
        nuevosElementos.push(rest);
      }
    });

    setDraftText(serializarElementosATexto(nuevosElementos));
    setSelectedVisualBlockIdx(swapIdx);
  };

  // Helper to reorder/move visual blocks to an arbitrary target index on drop
  const handleMoveVisualBlockToPosition = (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    const visualBlocks = obtenerBloquesVisuales();
    const draggedBlock = visualBlocks[fromIdx];
    
    // Remove the dragged block from its old position
    visualBlocks.splice(fromIdx, 1);
    // Insert it into the new position
    visualBlocks.splice(toIdx, 0, draggedBlock);

    // Reconstruct the flat list of elements from visualBlocks
    const nuevosElementos = [];
    visualBlocks.forEach(block => {
      if (block.tipo === 'portada') {
        block.lineas.forEach((line, lIdx) => {
          nuevosElementos.push({
            tipo: 'portada',
            rol: lIdx === 0 ? 'titulo' : 'detalle',
            texto: line,
            esUltimoDePortada: lIdx === block.lineas.length - 1
          });
        });
      } else {
        const { indiceOriginal, indicesOriginales, ...rest } = block;
        nuevosElementos.push(rest);
      }
    });

    setDraftText(serializarElementosATexto(nuevosElementos));
    setSelectedVisualBlockIdx(toIdx);
  };

  // Añadir un nuevo tipo de bloque (con opción de insertar arriba o abajo si hay selección activa)
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
    } else if (tipo === 'indice') {
      nuevoEl = { tipo: 'indice', texto: '' };
    }

    let nuevosElementos = [...elementosFormateados];

    if (selectedVisualBlockIdx !== null) {
      const visualBlocks = obtenerBloquesVisuales();
      const targetVisualBlock = visualBlocks[selectedVisualBlockIdx];
      
      const insertAtAbove = window.confirm("¿Deseas insertar el nuevo bloque ARRIBA del bloque seleccionado? \n\n(Aceptar = ARRIBA, Cancelar = ABAJO)");
      
      let flatInsertIdx;
      if (targetVisualBlock.tipo === 'portada') {
        const firstIdx = targetVisualBlock.indicesOriginales[0];
        const lastIdx = targetVisualBlock.indicesOriginales[targetVisualBlock.indicesOriginales.length - 1];
        flatInsertIdx = insertAtAbove ? firstIdx : lastIdx + 1;
      } else {
        flatInsertIdx = insertAtAbove ? targetVisualBlock.indiceOriginal : targetVisualBlock.indiceOriginal + 1;
      }

      nuevosElementos.splice(flatInsertIdx, 0, nuevoEl);
    } else {
      if (tipo === 'indice') {
        const firstNonPortadaIdx = nuevosElementos.findIndex(el => el.tipo !== 'portada');
        if (firstNonPortadaIdx !== -1) {
          nuevosElementos.splice(firstNonPortadaIdx, 0, nuevoEl);
        } else {
          nuevosElementos.unshift(nuevoEl);
        }
      } else {
        nuevosElementos.push(nuevoEl);
      }
    }

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
                  <button type="button" className="marker-tag" onClick={() => handleAddBlockType('titulo1')}>
                    <Plus size={12} /> [Título]
                  </button>
                  <button type="button" className="marker-tag" onClick={() => handleAddBlockType('titulo2')}>
                    <Plus size={12} /> [Subtítulo]
                  </button>
                  <button type="button" className="marker-tag" onClick={() => handleAddBlockType('titulo3')}>
                    <Plus size={12} /> [Subsección]
                  </button>
                  <button type="button" className="marker-tag" onClick={() => handleAddBlockType('parrafo')}>
                    <Plus size={12} /> [Párrafo]
                  </button>
                  <button type="button" className="marker-tag" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981' }} onClick={() => imageInputRef.current.click()}>
                    <Plus size={12} /> + Figura
                  </button>
                  <button type="button" className="marker-tag" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981' }} onClick={handleInsertTable}>
                    <Plus size={12} /> + Tabla
                  </button>
                  <button type="button" className="marker-tag" onClick={() => handleAddBlockType('referencia')}>
                    <Plus size={12} /> [Referencias]
                  </button>
                </div>
              </div>

              {/* Índice de Contenidos: Toggle o Añadir Botón */}
              {elementosFormateados.some(el => el.tipo === 'indice') ? (
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
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary font-accent"
                  onClick={() => {
                    handleAddBlockType('indice');
                    setShowTOC(true);
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    padding: '8px 12px',
                    background: '#fffbeb',
                    border: '1px dashed #fcd34d',
                    color: '#b45309',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: '600',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fef3c7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fffbeb'}
                >
                  <Plus size={13} style={{ color: '#d97706' }} />
                  + Añadir Índice de Contenidos
                </button>
              )}

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

        <div className="textarea-wrapper">
          <div className="block-editor-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '20px' }}>
              {obtenerBloquesVisuales().map((block, bIdx) => {
                const isSelected = selectedVisualBlockIdx === bIdx;

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

                const borderColors = {
                  portada: 'var(--accent-blue)',
                  figura: '#10b981',
                  tabla: '#0d9488',
                  titulo1: 'var(--accent-blue)',
                  titulo2: '#9333ea',
                  titulo3: '#0891b2',
                  parrafo: '#cbd5e1',
                  referencia: '#d97706',
                  indice: '#f59e0b'
                };

                // --- PORTADA CARD ---
                if (block.tipo === 'portada') {
                  return (
                    <div 
                      key={`portada-${bIdx}`} 
                      className="block-card" 
                      style={getDragDropStyle(bIdx, isSelected, '4px solid var(--accent-blue)')}
                      onClick={() => setSelectedVisualBlockIdx(bIdx)}
                      draggable={draggableIdx === bIdx}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", bIdx);
                        setDraggedIdx(bIdx);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                        setDraggableIdx(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedIdx !== null && draggedIdx !== bIdx) {
                          setDragOverIdx(bIdx);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        if (!isNaN(fromIdx) && fromIdx !== bIdx) {
                          handleMoveVisualBlockToPosition(fromIdx, bIdx);
                        }
                        setDragOverIdx(null);
                        setDraggedIdx(null);
                        setDraggableIdx(null);
                      }}
                    >
                      <div className="block-card-header">
                        <div className="block-badge-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div 
                            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#9ca3af', paddingRight: '2px' }}
                            onMouseDown={() => setDraggableIdx(bIdx)}
                            onMouseUp={() => setDraggableIdx(null)}
                            title="Arrastra desde aquí para reordenar"
                          >
                            <GripVertical size={14} />
                          </div>
                          <span className="block-type-select block-select-portada" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                            Portada Principal (Página 1)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'up'); }}
                            disabled={bIdx === 0}
                            title="Mover Portada Arriba"
                            className="block-delete-btn"
                            style={{ color: bIdx === 0 ? '#d1d5db' : '#4b5563', cursor: bIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'down'); }}
                            disabled={bIdx === obtenerBloquesVisuales().length - 1}
                            title="Mover Portada Abajo"
                            className="block-delete-btn"
                            style={{ color: bIdx === obtenerBloquesVisuales().length - 1 ? '#d1d5db' : '#4b5563', cursor: bIdx === obtenerBloquesVisuales().length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="block-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
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
                      </div>
                      <div className="block-field-group">
                        <label className="block-field-label">Contenido de la Portada (Línea por línea):</label>
                        <textarea
                          className="block-textarea"
                          rows={calculateRows(block.lineas.join('\n'), 'portada')}
                          placeholder="Línea 1: TÍTULO DEL TRABAJO&#10;Línea 2: Nombre Completo&#10;Línea 3: Universidad... etc."
                          value={block.lineas.join('\n')}
                          onFocus={() => setSelectedVisualBlockIdx(bIdx)}
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
                    <div 
                      key={`block-${bIdx}`} 
                      className="block-card" 
                      style={getDragDropStyle(bIdx, isSelected, '4px solid #10b981')}
                      onClick={() => setSelectedVisualBlockIdx(bIdx)}
                      draggable={draggableIdx === bIdx}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", bIdx);
                        setDraggedIdx(bIdx);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                        setDraggableIdx(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedIdx !== null && draggedIdx !== bIdx) {
                          setDragOverIdx(bIdx);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        if (!isNaN(fromIdx) && fromIdx !== bIdx) {
                          handleMoveVisualBlockToPosition(fromIdx, bIdx);
                        }
                        setDragOverIdx(null);
                        setDraggedIdx(null);
                        setDraggableIdx(null);
                      }}
                    >
                      <div className="block-card-header">
                        <div className="block-badge-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div 
                            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#9ca3af', paddingRight: '2px' }}
                            onMouseDown={() => setDraggableIdx(bIdx)}
                            onMouseUp={() => setDraggableIdx(null)}
                            title="Arrastra desde aquí para reordenar"
                          >
                            <GripVertical size={14} />
                          </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'up'); }}
                            disabled={bIdx === 0}
                            title="Mover Figura Arriba"
                            className="block-delete-btn"
                            style={{ color: bIdx === 0 ? '#d1d5db' : '#4b5563', cursor: bIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'down'); }}
                            disabled={bIdx === obtenerBloquesVisuales().length - 1}
                            title="Mover Figura Abajo"
                            className="block-delete-btn"
                            style={{ color: bIdx === obtenerBloquesVisuales().length - 1 ? '#d1d5db' : '#4b5563', cursor: bIdx === obtenerBloquesVisuales().length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="block-delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleElementDelete(block.indiceOriginal); }}
                            title="Eliminar Figura"
                          >
                            ×
                          </button>
                        </div>
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
                              onFocus={() => setSelectedVisualBlockIdx(bIdx)}
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
                              onFocus={() => setSelectedVisualBlockIdx(bIdx)}
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
                    <div 
                      key={`block-${bIdx}`} 
                      className="block-card" 
                      style={getDragDropStyle(bIdx, isSelected, '4px solid #0d9488')}
                      onClick={() => setSelectedVisualBlockIdx(bIdx)}
                      draggable={draggableIdx === bIdx}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", bIdx);
                        setDraggedIdx(bIdx);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                        setDraggableIdx(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedIdx !== null && draggedIdx !== bIdx) {
                          setDragOverIdx(bIdx);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        if (!isNaN(fromIdx) && fromIdx !== bIdx) {
                          handleMoveVisualBlockToPosition(fromIdx, bIdx);
                        }
                        setDragOverIdx(null);
                        setDraggedIdx(null);
                        setDraggableIdx(null);
                      }}
                    >
                      <div className="block-card-header">
                        <div className="block-badge-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div 
                            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#9ca3af', paddingRight: '2px' }}
                            onMouseDown={() => setDraggableIdx(bIdx)}
                            onMouseUp={() => setDraggableIdx(null)}
                            title="Arrastra desde aquí para reordenar"
                          >
                            <GripVertical size={14} />
                          </div>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'up'); }}
                            disabled={bIdx === 0}
                            title="Mover Tabla Arriba"
                            className="block-delete-btn"
                            style={{ color: bIdx === 0 ? '#d1d5db' : '#4b5563', cursor: bIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'down'); }}
                            disabled={bIdx === obtenerBloquesVisuales().length - 1}
                            title="Mover Tabla Abajo"
                            className="block-delete-btn"
                            style={{ color: bIdx === obtenerBloquesVisuales().length - 1 ? '#d1d5db' : '#4b5563', cursor: bIdx === obtenerBloquesVisuales().length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="block-delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleElementDelete(block.indiceOriginal); }}
                            title="Eliminar Tabla"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="block-field-group">
                          <label className="block-field-label">Título de la Tabla:</label>
                          <input
                            type="text"
                            className="block-input"
                            value={block.titulo || ''}
                            onChange={(e) => handleTableTitleChange(block.indiceOriginal, e.target.value)}
                            onFocus={() => setSelectedVisualBlockIdx(bIdx)}
                            placeholder="Ej: Comparativa de Muestra..."
                          />
                        </div>
                        
                        <div className="block-field-group">
                          <label className="block-field-label">Celdas de la Tabla (Separadas por |):</label>
                          <textarea
                            className="block-textarea font-serif"
                            rows={calculateRows(serializarTablaACrud(block), 'tabla')}
                            value={serializarTablaACrud(block)}
                            onChange={(e) => handleTableGridChange(block.indiceOriginal, e.target.value)}
                            onFocus={() => setSelectedVisualBlockIdx(bIdx)}
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
                            onFocus={() => setSelectedVisualBlockIdx(bIdx)}
                            placeholder="Ej: Nota. Datos del estudio preliminar."
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                // --- ÍNDICE (TOC) CARD ---
                if (block.tipo === 'indice') {
                  const titulos = elementosFormateados.filter(el => ['titulo1', 'titulo2', 'titulo3'].includes(el.tipo));
                  return (
                    <div 
                      key={`block-${bIdx}`} 
                      className="block-card" 
                      style={{
                        ...getDragDropStyle(bIdx, isSelected, '4px solid #f59e0b'),
                        background: '#fffbeb'
                      }}
                      onClick={() => setSelectedVisualBlockIdx(bIdx)}
                      draggable={draggableIdx === bIdx}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", bIdx);
                        setDraggedIdx(bIdx);
                      }}
                      onDragEnd={() => {
                        setDraggedIdx(null);
                        setDragOverIdx(null);
                        setDraggableIdx(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedIdx !== null && draggedIdx !== bIdx) {
                          setDragOverIdx(bIdx);
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverIdx(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                        if (!isNaN(fromIdx) && fromIdx !== bIdx) {
                          handleMoveVisualBlockToPosition(fromIdx, bIdx);
                        }
                        setDragOverIdx(null);
                        setDraggedIdx(null);
                        setDraggableIdx(null);
                      }}
                    >
                      <div className="block-card-header">
                        <div className="block-badge-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div 
                            style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#9ca3af', paddingRight: '2px' }}
                            onMouseDown={() => setDraggableIdx(bIdx)}
                            onMouseUp={() => setDraggableIdx(null)}
                            title="Arrastra desde aquí para reordenar"
                          >
                            <GripVertical size={14} style={{ color: '#d97706' }} />
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', background: '#f59e0b', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
                            Índice de Contenidos (Auto)
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDraftText(serializarElementosATexto([...elementosFormateados]));
                              alert('Índice sincronizado con los títulos del documento.');
                            }}
                            style={{ padding: '2px 6px', fontSize: '9px', height: '22px', border: '1px solid #d97706', color: '#d97706', background: 'white' }}
                            title="Actualizar tabla de contenidos"
                          >
                            Actualizar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'up'); }}
                            disabled={bIdx === 0}
                            title="Mover Índice Arriba"
                            className="block-delete-btn"
                            style={{ color: bIdx === 0 ? '#d1d5db' : '#4b5563', cursor: bIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'down'); }}
                            disabled={bIdx === obtenerBloquesVisuales().length - 1}
                            title="Mover Índice Abajo"
                            className="block-delete-btn"
                            style={{ color: bIdx === obtenerBloquesVisuales().length - 1 ? '#d1d5db' : '#4b5563', cursor: bIdx === obtenerBloquesVisuales().length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="block-delete-btn"
                            onClick={(e) => { e.stopPropagation(); handleElementDelete(block.indiceOriginal); }}
                            title="Eliminar Índice"
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.7)', borderRadius: '6px', border: '1px dashed #fcd34d' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#b45309' }}>Esquema de Títulos en tu documento:</span>
                        {titulos.length === 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            Aún no has agregado títulos. Agrega títulos (H1, H2, H3) para verlos reflejados aquí.
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                            {titulos.map((t, tIdx) => {
                              const indent = t.tipo === 'titulo1' ? '0px' : t.tipo === 'titulo2' ? '15px' : '30px';
                              const prefix = t.tipo === 'titulo1' ? '■' : t.tipo === 'titulo2' ? '○' : '•';
                              const color = t.tipo === 'titulo1' ? 'var(--accent-blue)' : t.tipo === 'titulo2' ? '#9333ea' : '#0891b2';
                              return (
                                <div key={tIdx} style={{ fontSize: '11.5px', paddingLeft: indent, display: 'flex', alignItems: 'center', gap: '6px', color: color, fontWeight: '500' }}>
                                  <span>{prefix}</span>
                                  <span>{t.texto || '(Título vacío)'}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // --- ESTÁNDAR TEXT CARD (Párrafo, Títulos, Referencias) ---
                return (
                  <div 
                    key={`block-${bIdx}`} 
                    className="block-card" 
                    style={getDragDropStyle(bIdx, isSelected, `4px solid ${borderColors[block.tipo] || '#cbd5e1'}`)}
                    onClick={() => setSelectedVisualBlockIdx(bIdx)}
                    draggable={draggableIdx === bIdx}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", bIdx);
                      setDraggedIdx(bIdx);
                    }}
                    onDragEnd={() => {
                      setDraggedIdx(null);
                      setDragOverIdx(null);
                      setDraggableIdx(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedIdx !== null && draggedIdx !== bIdx) {
                        setDragOverIdx(bIdx);
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverIdx(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                      if (!isNaN(fromIdx) && fromIdx !== bIdx) {
                        handleMoveVisualBlockToPosition(fromIdx, bIdx);
                      }
                      setDragOverIdx(null);
                      setDraggedIdx(null);
                      setDraggableIdx(null);
                    }}
                  >
                    <div className="block-card-header">
                      <div className="block-badge-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div 
                          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#9ca3af', paddingRight: '2px' }}
                          onMouseDown={() => setDraggableIdx(bIdx)}
                          onMouseUp={() => setDraggableIdx(null)}
                          title="Arrastra desde aquí para reordenar"
                        >
                          <GripVertical size={14} />
                        </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'up'); }}
                          disabled={bIdx === 0}
                          title="Mover Bloque Arriba"
                          className="block-delete-btn"
                          style={{ color: bIdx === 0 ? '#d1d5db' : '#4b5563', cursor: bIdx === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleMoveVisualBlock(bIdx, 'down'); }}
                          disabled={bIdx === obtenerBloquesVisuales().length - 1}
                          title="Mover Bloque Abajo"
                          className="block-delete-btn"
                          style={{ color: bIdx === obtenerBloquesVisuales().length - 1 ? '#d1d5db' : '#4b5563', cursor: bIdx === obtenerBloquesVisuales().length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          type="button"
                          className="block-delete-btn"
                          onClick={(e) => { e.stopPropagation(); handleElementDelete(block.indiceOriginal); }}
                          title="Eliminar bloque"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    <textarea
                      className={`block-textarea ${block.tipo.startsWith('titulo') ? 'font-accent' : block.tipo === 'referencia' ? 'font-serif' : ''}`}
                      rows={calculateRows(block.texto, block.tipo)}
                      style={{
                        fontWeight: block.tipo.startsWith('titulo') ? 'bold' : 'normal',
                        fontSize: block.tipo === 'titulo1' ? '15px' : block.tipo === 'titulo2' ? '14px' : block.tipo === 'titulo3' ? '13px' : '13.5px'
                      }}
                      value={block.texto || ''}
                      onFocus={() => setSelectedVisualBlockIdx(bIdx)}
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
