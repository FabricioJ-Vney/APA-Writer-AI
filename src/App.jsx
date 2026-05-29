import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  HelpCircle, 
  Database, 
  Sparkles,
  RefreshCw,
  Plus
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
  supabase
} from './services/supabaseService';

function App() {
  const [draftText, setDraftText] = useState('');
  const [documentos, setDocumentos] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  
  // Loading States
  const [isAILoading, setIsAILoading] = useState(false);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Parsea el texto en tiempo real para la vista previa
  const elementosFormateados = parsearTextoAPA(draftText);

  // Cargar lista de documentos al montar
  useEffect(() => {
    cargarDocumentosSupabase();
    // Iniciar con la plantilla de ejemplo por defecto para ilustrar el formato de inmediato
    setDraftText(obtenerTextoEjemploAPA());
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
      // Extraer un título del documento
      // Intentar buscar el primer elemento tipo 'titulo1' o la primera línea de la portada
      let titulo = 'Borrador Sin Título';
      const primerTitulo = elementosFormateados.find(el => el.tipo === 'titulo1' || (el.tipo === 'portada' && el.rol === 'titulo'));
      if (primerTitulo && primerTitulo.texto) {
        titulo = primerTitulo.texto.substring(0, 50);
      } else {
        // Fallback: Tomar la primera línea no vacía
        const lineas = draftText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lineas.length > 0) {
          titulo = lineas[0].replace(/\[.*?\]/g, '').trim().substring(0, 50) || 'Borrador Sin Título';
        }
      }

      const res = await guardarDocumento(selectedDocId, titulo, draftText);
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
      // Si selecciona crear uno nuevo
      setDraftText(obtenerTextoEjemploAPA());
      return;
    }

    try {
      const doc = await obtenerDocumento(id);
      if (doc) {
        setDraftText(doc.contenido || '');
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
    // Buscar si ya existe la etiqueta [Referencias] en el texto del borrador
    const indexReferencias = draftText.toLowerCase().indexOf('[referencias]');
    
    if (indexReferencias !== -1) {
      // Agregar la referencia al final de la sección actual
      setDraftText(prev => prev + '\n' + referenciaTexto);
    } else {
      // Si no existe, crear la etiqueta [Referencias] y anexar
      setDraftText(prev => prev + '\n\n[Referencias]\n' + referenciaTexto);
    }
  };

  // Exportar a DOCX nativo Word
  const handleExportDocx = async () => {
    if (elementosFormateados.length === 0) return;

    try {
      let titulo = 'Documento APA 7';
      const primerTitulo = elementosFormateados.find(el => el.tipo === 'titulo1' || (el.tipo === 'portada' && el.rol === 'titulo'));
      if (primerTitulo && primerTitulo.texto) {
        titulo = primerTitulo.texto;
      }

      await exportarADocx({
        titulo: titulo,
        elementos: elementosFormateados
      });
    } catch (error) {
      console.error('Error al exportar el archivo Word:', error);
      alert('Error al generar el archivo .docx.');
    }
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
            </div>
          </div>

          {/* Cuerpo Principal de Trabajo (Doble Panel) */}
          <div className="app-workspace-body">
            
            {/* Panel Izquierdo: Editor / Draft Input */}
            <DraftInput 
              draftText={draftText}
              setDraftText={setDraftText}
              onFormatWithAI={handleFormatWithAI}
              onSaveToSupabase={handleSaveToSupabase}
              isAILoading={isAILoading}
              isSaveLoading={isSaveLoading}
              documentos={documentos}
              onSelectDocument={handleSelectDocument}
              selectedDocId={selectedDocId}
            />

            {/* Panel Derecho: Visualizador / Vista Previa APA 7 */}
            <APA7Preview 
              elementos={elementosFormateados}
              tituloDocumento={selectedDocId ? (documentos.find(d => d.id === selectedDocId)?.titulo || 'Documento APA 7') : 'Borrador Local'}
              onExportDocx={handleExportDocx}
              documentoId={selectedDocId}
              onAgregarReferenciaDirecta={handleAgregarReferenciaDirecta}
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
