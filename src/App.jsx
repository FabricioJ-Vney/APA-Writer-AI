import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  HelpCircle, 
  Database, 
  Sparkles,
  RefreshCw,
  Plus,
  Undo2,
  Redo2
} from 'lucide-react';
import './App.css';

// Componentes
import DraftInput from './components/DraftInput';
import APA7Preview from './components/APA7Preview';
import SettingsModal from './components/SettingsModal';

// Servicios y Utilidades
import { parsearTextoAPA, obtenerTextoEjemploAPA } from './utils/apaParser';
import { exportarADocx } from './utils/docxGenerator';
import { formatAcademicText } from './services/geminiService';
import { 
  obtenerDocumentos, 
  guardarDocumento, 
  obtenerDocumento,
  eliminarDocumento,
  supabase
} from './services/supabaseService';

function App() {
  const [draftText, setDraftText] = useState('');
  const [imagenes, setImagenes] = useState({});
  const [documentos, setDocumentos] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [nombreArchivo, setNombreArchivo] = useState('Mi Trabajo APA 7');
  
  // Loading States
  const [isAILoading, setIsAILoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTOC, setShowTOC] = useState(true);

  // --- HISTORY STATE SYSTEM (UNDO / REDO) ---
  const [history, setHistory] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const isUndoRedoRef = React.useRef(false);
  const debouncedHistoryTimeoutRef = React.useRef(null);

  const resetHistory = (text, imgs) => {
    setHistory([{ draftText: text, imagenes: imgs }]);
    setHistoryPointer(0);
    if (debouncedHistoryTimeoutRef.current) {
      clearTimeout(debouncedHistoryTimeoutRef.current);
    }
  };

  const handleUndo = () => {
    if (historyPointer > 0) {
      isUndoRedoRef.current = true;
      const targetPointer = historyPointer - 1;
      const targetEntry = history[targetPointer];
      setHistoryPointer(targetPointer);
      setDraftText(targetEntry.draftText);
      setImagenes(targetEntry.imagenes);
    }
  };

  const handleRedo = () => {
    if (historyPointer < history.length - 1) {
      isUndoRedoRef.current = true;
      const targetPointer = historyPointer + 1;
      const targetEntry = history[targetPointer];
      setHistoryPointer(targetPointer);
      setDraftText(targetEntry.draftText);
      setImagenes(targetEntry.imagenes);
    }
  };

  // Auto-record document modifications into the history stack (debounced)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }

    if (history.length === 0) {
      setHistory([{ draftText, imagenes }]);
      setHistoryPointer(0);
      return;
    }

    // Skip duplicate history pushes
    const currentEntry = history[historyPointer];
    if (currentEntry && currentEntry.draftText === draftText && JSON.stringify(currentEntry.imagenes) === JSON.stringify(imagenes)) {
      return;
    }

    if (debouncedHistoryTimeoutRef.current) {
      clearTimeout(debouncedHistoryTimeoutRef.current);
    }

    debouncedHistoryTimeoutRef.current = setTimeout(() => {
      setHistory(prev => {
        const sliced = prev.slice(0, historyPointer + 1);
        return [...sliced, { draftText, imagenes }];
      });
      setHistoryPointer(prev => prev + 1);
    }, 400);

    return () => {
      if (debouncedHistoryTimeoutRef.current) {
        clearTimeout(debouncedHistoryTimeoutRef.current);
      }
    };
  }, [draftText, imagenes]);

  // Global Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyPointer]);

  // Extrae de forma transparente los metadatos serializados de imágenes al cargar un borrador
  const procesarTextoEntrante = (textoRaw) => {
    if (!textoRaw) return { cleanText: '', imgs: {} };
    const regexMeta = /\n\n\[ImagenesMeta\]\s*(\{.*\})\s*$/s;
    const match = textoRaw.match(regexMeta);
    if (match) {
      try {
        const imgs = JSON.parse(match[1]);
        const cleanText = textoRaw.replace(regexMeta, '');
        return { cleanText, imgs };
      } catch (e) {
        console.error("Error al procesar ImagenesMeta entrante:", e);
      }
    }
    return { cleanText: textoRaw, imgs: {} };
  };

  // Anexa de forma transparente los metadatos serializados de imágenes al guardar/exportar un borrador
  const prepararTextoSalida = (textoClean, imgs) => {
    if (!textoClean) return '';
    if (!imgs || Object.keys(imgs).length === 0) return textoClean;
    return textoClean.trim() + "\n\n[ImagenesMeta] " + JSON.stringify(imgs);
  };

  // Parsea el texto en tiempo real para la vista previa
  const elementosFormateados = parsearTextoAPA(draftText);

  // Mapeamos los elementos para resolver en caliente los placeholders de imagen a base64 real
  const elementosConImagenes = elementosFormateados.map(el => {
    if (el.tipo === 'figura' && el.base64 && imagenes[el.base64]) {
      return {
        ...el,
        base64: imagenes[el.base64]
      };
    }
    return el;
  });

  // Cargar lista de documentos al montar
  useEffect(() => {
    cargarDocumentosSupabase();
    // Iniciar con la plantilla de ejemplo por defecto para ilustrar el formato de inmediato
    const { cleanText, imgs } = procesarTextoEntrante(obtenerTextoEjemploAPA());
    setDraftText(cleanText);
    setImagenes(imgs);
    resetHistory(cleanText, imgs);
    setNombreArchivo('Plantilla de Investigación APA 7');
  }, []);

  const cargarDocumentosSupabase = async () => {
    setIsListLoading(true);
    try {
      const docs = await obtenerDocumentos();
      setDocumentos(docs || []);
    } catch (error) {
      console.error('Error al cargar documentos:', error);
    } finally {
      setIsListLoading(false);
    }
  };

  // Guardar documento actual en Supabase
  const handleSaveToSupabase = async () => {
    if (!draftText.trim()) return;

    setIsSaveLoading(true);
    try {
      const textoSalida = prepararTextoSalida(draftText, imagenes);
      const res = await guardarDocumento(selectedDocId, nombreArchivo, textoSalida);
      if (res) {
        alert(`Documento "${res.titulo}" guardado exitosamente.`);
        setSelectedDocId(res.id);
        await cargarDocumentosSupabase();
      }
    } catch (error) {
      console.error('Error en handleSaveToSupabase:', error);
      alert('Error al guardar el borrador en la base de datos.');
    } finally {
      setIsSaveLoading(false);
    }
  };

  // Seleccionar y cargar un borrador existente
  const handleSelectDocument = async (id) => {
    setSelectedDocId(id);
    if (!id) {
      const { cleanText, imgs } = procesarTextoEntrante(obtenerTextoEjemploAPA());
      setDraftText(cleanText);
      setImagenes(imgs);
      resetHistory(cleanText, imgs);
      setNombreArchivo('Borrador Nuevo APA 7');
      return;
    }

    try {
      const doc = await obtenerDocumento(id);
      if (doc) {
        const { cleanText, imgs } = procesarTextoEntrante(doc.contenido || '');
        setDraftText(cleanText);
        setImagenes(imgs);
        resetHistory(cleanText, imgs);
        setNombreArchivo(doc.titulo || 'Borrador Sin Título');
      }
    } catch (error) {
      console.error('Error al cargar el documento seleccionado:', error);
    }
  };

  // Crear un documento nuevo en limpio
  const handleNewDocument = () => {
    if (draftText && window.confirm('¿Deseas iniciar un borrador nuevo en limpio? Se perderán los cambios locales no guardados.')) {
      setSelectedDocId('');
      setDraftText('');
      setImagenes({});
      resetHistory('', {});
      setNombreArchivo('Mi Trabajo APA 7');
    }
  };

  // Eliminar un borrador de Supabase/Local
  const handleDeleteDocument = async () => {
    if (!selectedDocId) return;

    if (window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el borrador "${nombreArchivo}"? Esta acción no se puede deshacer.`)) {
      setIsSaveLoading(true);
      try {
        const success = await eliminarDocumento(selectedDocId);
        if (success) {
          alert('Borrador eliminado con éxito.');
          setSelectedDocId('');
          setDraftText('');
          setImagenes({});
          resetHistory('', {});
          setNombreArchivo('Mi Trabajo APA 7');
          await cargarDocumentosSupabase();
        } else {
          alert('Hubo un error al intentar eliminar el borrador.');
        }
      } catch (error) {
        console.error('Error al eliminar documento:', error);
      } finally {
        setIsSaveLoading(false);
      }
    }
  };

  // Formatear gramática y tono con Gemini IA
  const handleFormatWithAI = async () => {
    if (!draftText.trim()) return;

    setIsAILoading(true);
    try {
      const correctedText = await formatAcademicText(draftText);
      if (correctedText) {
        setDraftText(correctedText);
      }
    } catch (error) {
      console.error('Error al optimizar con IA:', error);
      alert('Hubo un error en la conexión con el servidor de inteligencia artificial.');
    } finally {
      setIsAILoading(false);
    }
  };

  // Agregar una referencia generada dinámicamente al borrador
  const handleAgregarReferenciaDirecta = (referenciaTexto) => {
    const indexReferencias = draftText.toLowerCase().indexOf('[referencias]');
    if (indexReferencias !== -1) {
      setDraftText(prev => prev + '\n' + referenciaTexto);
    } else {
      setDraftText(prev => prev + '\n\n[Referencias]\n' + referenciaTexto);
    }
  };

  // Exportar a DOCX nativo Word
  const handleExportDocx = async () => {
    if (elementosConImagenes.length === 0) return;

    try {
      await exportarADocx({
        titulo: nombreArchivo,
        elementos: elementosConImagenes,
        showTOC: showTOC
      });
    } catch (error) {
      console.error('Error al exportar el archivo Word:', error);
      alert('Error al generar el archivo .docx.');
    }
  };

  // Abrir cuadro de diálogo de impresión y exportar como PDF con su nombre
  const handleExportPdf = () => {
    if (elementosConImagenes.length === 0) return;
    const originalTitle = document.title;
    document.title = nombreArchivo;
    window.print();
    document.title = originalTitle;
  };

  const isSupabaseOnline = !!supabase;

  return (
    <div className="desk-workspace">
      {/* Elementos decorativos de fondo (Cuaderno y Café en el escritorio) */}
      <div className="decor-coffee" title="Tu café de trabajo"></div>
      <div className="decor-notebook"></div>

      {/* Bisel/Marco físico de la Laptop */}
      <div className="laptop-bezel">
        <div className="laptop-camera"></div>

        {/* Pantalla de la Laptop (Ventana de la Aplicación) */}
        <div className="app-window-container">
          
          {/* Barra de Título de la Ventana (Natividad de Escritorio) */}
          <div className="app-titlebar">
            <div className="window-controls">
              <div className="control-dot dot-red"></div>
              <div className="control-dot dot-yellow"></div>
              <div className="control-dot dot-green"></div>
            </div>
            
            <div className="window-title">
              APA Formatter Pro v1.0
              <span className="window-title-badge font-accent">Desktop App</span>
            </div>

            <div className="app-menubar">
              <div 
                className="menu-item"
                onClick={handleNewDocument}
                title="Crear un borrador nuevo desde cero"
              >
                <Plus size={14} />
                Nuevo Documento
              </div>
              <div 
                className={`menu-item ${isListLoading ? 'animate-spin' : ''}`}
                onClick={cargarDocumentosSupabase}
                title="Recargar borradores de la base de datos"
              >
                <RefreshCw size={14} />
                Sincronizar
              </div>
              <div 
                className="menu-item"
                onClick={() => setIsSettingsOpen(true)}
                title="Configurar claves de API y base de datos"
              >
                <SettingsIcon size={14} />
                Credenciales API
              </div>
              <div 
                className="menu-item"
                onClick={handleUndo}
                style={{ 
                  opacity: historyPointer <= 0 ? 0.35 : 1, 
                  cursor: historyPointer <= 0 ? 'not-allowed' : 'pointer',
                  pointerEvents: historyPointer <= 0 ? 'none' : 'auto'
                }}
                title="Deshacer cambio (Ctrl+Z)"
              >
                <Undo2 size={14} />
                Deshacer
              </div>
              <div 
                className="menu-item"
                onClick={handleRedo}
                style={{ 
                  opacity: historyPointer >= history.length - 1 ? 0.35 : 1, 
                  cursor: historyPointer >= history.length - 1 ? 'not-allowed' : 'pointer',
                  pointerEvents: historyPointer >= history.length - 1 ? 'none' : 'auto'
                }}
                title="Rehacer cambio (Ctrl+Y o Ctrl+Shift+Z)"
              >
                <Redo2 size={14} />
                Rehacer
              </div>
            </div>
          </div>

          {/* Cuerpo Principal de Trabajo (Doble Panel) */}
          <div className="app-workspace-body">
            
            {/* Panel Izquierdo: Editor / Draft Input */}
            <DraftInput 
              draftText={draftText}
              setDraftText={setDraftText}
              imagenes={imagenes}
              setImagenes={setImagenes}
              nombreArchivo={nombreArchivo}
              setNombreArchivo={setNombreArchivo}
              elementosFormateados={elementosConImagenes}
              onFormatWithAI={handleFormatWithAI}
              onSaveToSupabase={handleSaveToSupabase}
              onDeleteDocument={handleDeleteDocument}
              isAILoading={isAILoading}
              isSaveLoading={isSaveLoading}
              documentos={documentos}
              onSelectDocument={handleSelectDocument}
              selectedDocId={selectedDocId}
              showTOC={showTOC}
              setShowTOC={setShowTOC}
            />

            {/* Panel Derecho: Visualizador / Vista Previa APA 7 */}
            <APA7Preview 
              elementos={elementosConImagenes}
              tituloDocumento={nombreArchivo}
              onExportDocx={handleExportDocx}
              onExportPdf={handleExportPdf}
              documentoId={selectedDocId}
              onAgregarReferenciaDirecta={handleAgregarReferenciaDirecta}
              showTOC={showTOC}
              setDraftText={setDraftText}
            />

          </div>

          {/* Barra de Estado inferior de la ventana */}
          <div className="app-statusbar" style={{ height: '25px', background: '#f3f0ec', borderTop: '1px solid var(--border-subtle)', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-muted)', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={10} className={isSupabaseOnline ? 'icon-success' : 'icon-gray'} />
              <span>
                Supabase: <strong>{isSupabaseOnline ? 'Conectado (En línea)' : 'Modo Local (Offline)'}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Palabras: <strong>{draftText ? draftText.split(/\s+/).filter(Boolean).length : 0}</strong></span>
              <span>•</span>
              <span>Elementos APA detectados: <strong>{elementosFormateados.length}</strong></span>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Configuración Visual de Llaves */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => {}}
      />
    </div>
  );
}

export default App;
