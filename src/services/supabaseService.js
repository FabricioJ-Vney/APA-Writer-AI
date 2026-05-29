import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validar si las credenciales están configuradas o siguen siendo las por defecto
const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('reemplaza-con-tu-url') && 
  !supabaseAnonKey.includes('reemplaza-con-tu-clave');

if (!isConfigured) {
  console.warn(
    '⚠️ Supabase no está configurado. Por favor, edita tu archivo .env local con tus credenciales reales para activar la persistencia. La aplicación funcionará en modo de almacenamiento local temporal por el momento.'
  );
}

// Crear el cliente de Supabase (si está configurado)
export const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

/**
 * SERVICIOS PARA DRAFT/DOCUMENTOS (apa_documentos)
 */

// Obtener la lista de todos los borradores de documentos
export async function obtenerDocumentos() {
  if (!supabase) {
    return obtenerBorradoresLocales();
  }
  try {
    const { data, error } = await supabase
      .from('apa_documentos')
      .select('*')
      .order('fecha_actualizacion', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al obtener documentos de Supabase:', error);
    return obtenerBorradoresLocales();
  }
}

// Obtener un documento específico y sus referencias vinculadas
export async function obtenerDocumento(id) {
  if (!supabase) {
    const localDocs = obtenerBorradoresLocales();
    const doc = localDocs.find(d => d.id === id);
    if (doc) {
      const references = obtenerReferenciasLocales().filter(r => r.documento_id === id);
      return { ...doc, referencias: references };
    }
    return null;
  }
  try {
    const { data: documento, error: docError } = await supabase
      .from('apa_documentos')
      .select('*')
      .eq('id', id)
      .single();

    if (docError) throw docError;

    const { data: referencias, error: refError } = await supabase
      .from('apa_referencias')
      .select('*')
      .eq('documento_id', id);

    if (refError) throw refError;

    return { ...documento, referencias };
  } catch (error) {
    console.error(`Error al obtener el documento ${id} de Supabase:`, error);
    return null;
  }
}

// Guardar o actualizar un borrador de documento
export async function guardarDocumento(id, titulo, contenido) {
  const documentData = {
    titulo: titulo || 'Documento sin título',
    contenido: contenido || '',
    fecha_actualizacion: new Date().toISOString(),
  };

  if (!supabase) {
    return guardarBorradorLocal(id, documentData);
  }

  try {
    if (id && id.length > 10) { // Si ya tiene un UUID válido
      const { data, error } = await supabase
        .from('apa_documentos')
        .update(documentData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Crear uno nuevo
      const { data, error } = await supabase
        .from('apa_documentos')
        .insert([{ ...documentData, fecha_creacion: new Date().toISOString() }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Error al guardar documento en Supabase:', error);
    return guardarBorradorLocal(id, documentData);
  }
}

// Eliminar un documento de la base de datos
export async function eliminarDocumento(id) {
  if (!supabase) {
    eliminarBorradorLocal(id);
    return true;
  }
  try {
    const { error } = await supabase
      .from('apa_documentos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error al eliminar el documento ${id} de Supabase:`, error);
    return false;
  }
}


/**
 * SERVICIOS PARA CITAS Y REFERENCIAS (apa_referencias)
 */

// Obtener todas las referencias asociadas a un documento específico
export async function obtenerReferenciasPorDocumento(documentoId) {
  if (!supabase) {
    return obtenerReferenciasLocales().filter(r => r.documento_id === documentoId);
  }
  try {
    const { data, error } = await supabase
      .from('apa_referencias')
      .select('*')
      .eq('documento_id', documentoId)
      .order('autor', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al obtener referencias de Supabase:', error);
    return obtenerReferenciasLocales().filter(r => r.documento_id === documentoId);
  }
}

// Guardar una nueva referencia bibliográfica
export async function guardarReferencia(referenciaData) {
  if (!supabase) {
    return guardarReferenciaLocal(referenciaData);
  }
  try {
    const { data, error } = await supabase
      .from('apa_referencias')
      .insert([referenciaData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error al guardar referencia en Supabase:', error);
    return guardarReferenciaLocal(referenciaData);
  }
}

// Eliminar una referencia
export async function eliminarReferencia(id) {
  if (!supabase) {
    eliminarReferenciaLocal(id);
    return true;
  }
  try {
    const { error } = await supabase
      .from('apa_referencias')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error(`Error al eliminar referencia ${id} de Supabase:`, error);
    return false;
  }
}


/**
 * FALLBACKS EN LOCAL STORAGE (Para que la app funcione sin errores antes de configurar Supabase)
 */
function obtenerBorradoresLocales() {
  const docs = localStorage.getItem('apa_borradores');
  return docs ? JSON.parse(docs) : [];
}

function guardarBorradorLocal(id, docData) {
  const docs = obtenerBorradoresLocales();
  let updatedDoc;

  if (id && id.length > 10) {
    const index = docs.findIndex(d => d.id === id);
    if (index !== -1) {
      updatedDoc = { ...docs[index], ...docData };
      docs[index] = updatedDoc;
    } else {
      updatedDoc = { id, ...docData, fecha_creacion: new Date().toISOString() };
      docs.push(updatedDoc);
    }
  } else {
    // Generar un ID local simple
    const nuevoId = 'local_' + Math.random().toString(36).substr(2, 9);
    updatedDoc = { id: nuevoId, ...docData, fecha_creacion: new Date().toISOString() };
    docs.push(updatedDoc);
  }

  localStorage.setItem('apa_borradores', JSON.stringify(docs));
  return updatedDoc;
}

function eliminarBorradorLocal(id) {
  const docs = obtenerBorradoresLocales();
  const filtered = docs.filter(d => d.id !== id);
  localStorage.setItem('apa_borradores', JSON.stringify(filtered));

  // Eliminar referencias vinculadas
  const refs = obtenerReferenciasLocales();
  const filteredRefs = refs.filter(r => r.documento_id !== id);
  localStorage.setItem('apa_referencias', JSON.stringify(filteredRefs));
}

function obtenerReferenciasLocales() {
  const refs = localStorage.getItem('apa_referencias');
  return refs ? JSON.parse(refs) : [];
}

function guardarReferenciaLocal(refData) {
  const refs = obtenerReferenciasLocales();
  const nuevoId = 'ref_local_' + Math.random().toString(36).substr(2, 9);
  const newRef = { id: nuevoId, ...refData, fecha_creacion: new Date().toISOString() };
  refs.push(newRef);
  localStorage.setItem('apa_referencias', JSON.stringify(refs));
  return newRef;
}

function eliminarReferenciaLocal(id) {
  const refs = obtenerReferenciasLocales();
  const filtered = refs.filter(r => r.id !== id);
  localStorage.setItem('apa_referencias', JSON.stringify(filtered));
}
