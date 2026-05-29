import React, { useRef } from 'react';
import { 
  FileText, 
  Trash2, 
  Sparkles, 
  Save, 
  BookOpen,
  HelpCircle,
  Plus
} from 'lucide-react';
import mammoth from 'mammoth';
import { obtenerTextoEjemploAPA } from '../utils/apaParser';

export default function DraftInput({ 
  draftText, 
  setDraftText, 
  onFormatWithAI, 
  onSaveToSupabase, 
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

  // Subir y procesar imagen para el bloque de Figura
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      // Insertar marcador estructurado para la figura
      const figuraTag = `\n[Figura] Título descriptivo de tu gráfica o imagen | Nota. Aquí se describe detalladamente lo que muestra la figura. | ${base64Data}\n`;
      insertMarker(figuraTag);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Resetear
  };

  // Insertar plantilla de tabla APA 7
  const handleInsertTable = () => {
    const plantillaTabla = `\n[Tabla]
Comparativa de Resultados de Muestra
Variable | Grupo de Control | Grupo de Intervención
Ansiedad Previa | 6.54 | 6.58
Ansiedad Posterior | 6.42 | 3.10
Nota. Datos simulados del estudio piloto (N = 50).\n`;
    insertMarker(plantillaTabla);
  };

  // Insertar plantilla de portada APA 7 delimitada
  const handleInsertPortada = () => {
    const plantillaPortada = `[Portada]
TÍTULO DE TU TRABAJO ACADÉMICO
Nombre Completo del Autor
Facultad y Universidad de Procedencia
Curso: Nombre de la Asignatura
Nombre del Profesor o Asesor
Fecha de Entrega
[Fin Portada]\n`;
    insertMarker(plantillaPortada);
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
          setDraftText(result.value);
        } catch (err) {
          console.error("Error al leer archivo Word con Mammoth:", err);
          alert("No se pudo extraer el texto de este archivo .docx. Por favor, asegúrate de que no esté dañado.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDraftText(event.target.result);
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
  };

  // Limpiar texto
  const handleClearText = () => {
    if (window.confirm('¿Estás seguro de que deseas borrar todo el texto?')) {
      setDraftText('');
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
        <div className="title-area">
          <span className="app-subtitle">Panel de Escritura</span>
          <h2 className="panel-title">Draft Input</h2>
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

      <div className="draft-container">
        <div className="draft-instructions">
          <div className="instructions-header">
            <HelpCircle size={14} className="icon-blue" />
            <span>Guía de Marcadores (Haz clic para insertar):</span>
          </div>
          <div className="markers-grid">
            <button type="button" className="marker-tag" onClick={handleInsertPortada} style={{ border: '1px solid rgba(43, 87, 154, 0.3)', background: 'rgba(43, 87, 154, 0.05)', color: 'var(--accent-blue)' }}>
              <Plus size={12} /> + Portada Block
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
              <Plus size={12} /> + Figura (Imagen)
            </button>
            <button type="button" className="marker-tag" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)', color: '#10b981' }} onClick={handleInsertTable}>
              <Plus size={12} /> + Tabla APA 7
            </button>
            <button type="button" className="marker-tag" onClick={() => insertMarker('\n[Referencias]\n')}>
              <Plus size={12} /> [Referencias]
            </button>
          </div>
        </div>

        {/* Toggle de Índice Automático */}
        <div className="toc-toggle-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fcfbfa', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '10px 14px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-text-main)' }}>Incluir Índice de Contenidos</span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Crea una Tabla de Contenidos en la página 2 basada en tus títulos.</span>
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

        {/* Historial de borradores guardados (si hay) */}
        {documentos && documentos.length > 0 && (
          <div className="documentos-guardados-bar">
            <label htmlFor="select-doc" className="doc-select-label">Borradores en Supabase:</label>
            <select
              id="select-doc"
              className="doc-select"
              value={selectedDocId || ''}
              onChange={(e) => onSelectDocument(e.target.value)}
            >
              <option value="">-- Documento Nuevo / Local --</option>
              {documentos.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.titulo} ({new Date(doc.fecha_actualizacion).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="draft-textarea"
            placeholder="[Portada]&#10;TÍTULO DE TU TRABAJO&#10;Tu Nombre&#10;Tu Institución&#10;&#10;[Título] Título Principal&#10;&#10;[Párrafo] Escribe o pega tu borrador aquí. Puedes marcar tu título, subtítulo o subsección con los botones superiores, o simplemente pegar un texto plano desorganizado y la app lo formateará automáticamente en tiempo real."
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            disabled={isAILoading}
          />
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
