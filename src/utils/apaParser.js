/**
 * Parsea el texto crudo del borrador (con marcadores) en una estructura JSON de elementos con tipo y formato.
 * @param {string} text - Texto crudo ingresado por el usuario.
 * @returns {Array} Listado de objetos con { tipo, texto, rol, esUltimoDePortada, esPrimeraReferencia, ... }
 */
export function parsearTextoAPA(text) {
  if (!text || text.trim() === '') {
    return [];
  }

  // HEURÍSTICA INTELIGENTE: Si el usuario pega un texto plano crudo que no contiene corchetes '[',
  // autodetectar la estructura (título, subtítulos, párrafos, referencias) de forma automática.
  if (!text.includes('[')) {
    return parsearTextoHeuristico(text);
  }

  const lines = text.split('\n');
  const elements = [];
  let isInsidePortada = false;
  let isInsideReferencias = false;
  
  // Variables de control para el parseo de tablas multi-línea
  let isInsideTabla = false;
  let tablaElement = null;
  
  // Guardamos las líneas de portada temporales para marcar la última
  let portadaIndices = [];
  let firstReferenciaFound = false;

  for (let i = 0; i < lines.length; i++) {
    const lineRaw = lines[i];
    const line = lineRaw.trim();
    
    // Si estamos parseando una tabla y encontramos una línea vacía, la saltamos
    if (isInsideTabla && line === '') {
      continue;
    }
    
    // Si no estamos en tabla y no estamos en portada, saltar líneas vacías generales
    if (!isInsideTabla && !isInsidePortada && line === '') {
      continue;
    }

    // --- DETECTOR DE CIERRE DE TABLA POR NUEVAS ETIQUETAS ---
    // Si estamos dentro de una tabla y aparece una nueva etiqueta, cerramos la tabla antes de seguir
    const isNewUrlTag = line.startsWith('[') && (
      line.toLowerCase().includes('[portada]') ||
      line.toLowerCase().includes('[referencias]') ||
      line.toLowerCase().includes('[título]') ||
      line.toLowerCase().includes('[titulo]') ||
      line.toLowerCase().includes('[subtítulo]') ||
      line.toLowerCase().includes('[subtitulo]') ||
      line.toLowerCase().includes('[subsección]') ||
      line.toLowerCase().includes('[subseccion]') ||
      line.toLowerCase().includes('[párrafo]') ||
      line.toLowerCase().includes('[parrafo]') ||
      line.toLowerCase().includes('[figura]') ||
      line.toLowerCase().includes('[tabla]')
    );

    if (isInsideTabla && isNewUrlTag) {
      elements.push(tablaElement);
      isInsideTabla = false;
      tablaElement = null;
    }

    // --- PARSEAR CAMBIOS DE MODO POR MARCADORES EXPLÍCITOS ---
    if (line.toLowerCase().includes('[portada]') || line.toLowerCase().includes('[inicio portada]')) {
      isInsidePortada = true;
      isInsideReferencias = false;
      continue;
    }

    if (line.toLowerCase().includes('[fin portada]') || line.toLowerCase().includes('[/portada]')) {
      isInsidePortada = false;
      continue;
    }

    if (line.toLowerCase().includes('[referencias]')) {
      isInsideReferencias = true;
      isInsidePortada = false;
      continue;
    }

    if (line.toLowerCase().includes('[índice]') || line.toLowerCase().includes('[indice]')) {
      isInsidePortada = false;
      isInsideReferencias = false;
      elements.push({ tipo: 'indice', texto: '' });
      continue;
    }

    // --- INICIAR PARSEO DE TABLA ---
    if (line.toLowerCase().startsWith('[tabla]')) {
      isInsidePortada = false;
      isInsideTabla = true;
      tablaElement = {
        tipo: 'tabla',
        titulo: '',
        encabezados: [],
        filas: [],
        nota: ''
      };
      continue;
    }

    // --- PROCESAR LÍNEA DENTRO DE TABLA ---
    if (isInsideTabla) {
      if (!tablaElement.titulo) {
        // La primera línea de contenido dentro de la tabla es su título
        tablaElement.titulo = lineRaw.replace(/^\s+/, '');
      } 
      else if (line.toLowerCase().startsWith('nota.') || line.toLowerCase().startsWith('nota:')) {
        // La línea que comienza con "Nota." es la nota al pie de la tabla, y cierra el bloque de tabla
        tablaElement.nota = lineRaw.replace(/^\s+/, '');
        elements.push(tablaElement);
        isInsideTabla = false;
        tablaElement = null;
      } 
      else if (lineRaw.includes('|')) {
        // Es una fila de datos (cabecera o registros)
        const columnas = lineRaw.split('|').map(col => col.replace(/^\s+/, ''));
        if (tablaElement.encabezados.length === 0) {
          tablaElement.encabezados = columnas;
        } else {
          tablaElement.filas.push(columnas);
        }
      }
      continue;
    }

    // --- PARSEAR FIGURAS (IMÁGENES) ---
    if (line.startsWith('[Figura]') || line.startsWith('[figura]')) {
      isInsidePortada = false;
      const textofigura = lineRaw.replace(/\[Figura\]/gi, '').replace(/^\s+/, '');
      const partes = textofigura.split('|').map(p => p.replace(/^\s+/, ''));
      
      elements.push({
        tipo: 'figura',
        titulo: partes[0] || 'Figura sin título',
        nota: partes[1] || '',
        base64: partes[2] ? partes[2].trim() : ''
      });
      continue;
    }

    // --- PARSEAR TÍTULOS ---
    if (line.startsWith('[Título]') || line.startsWith('[Titulo]') || line.startsWith('[título]') || line.startsWith('[titulo]')) {
      isInsidePortada = false;
      const texto = lineRaw.replace(/\[T[ií]tulo\]/gi, '').replace(/^\s+/, '');
      elements.push({ tipo: 'titulo1', texto });
      continue;
    }

    if (line.startsWith('[Subtítulo]') || line.startsWith('[Subtitulo]') || line.startsWith('[subtítulo]') || line.startsWith('[subtitulo]')) {
      isInsidePortada = false;
      const texto = lineRaw.replace(/\[Subt[ií]tulo\]/gi, '').replace(/^\s+/, '');
      elements.push({ tipo: 'titulo2', texto });
      continue;
    }

    if (line.startsWith('[Subsección]') || line.startsWith('[Subseccion]') || line.startsWith('[subsección]') || line.startsWith('[subseccion]')) {
      isInsidePortada = false;
      const texto = lineRaw.replace(/\[Subsecci[oó]n\]/gi, '').replace(/^\s+/, '');
      elements.push({ tipo: 'titulo3', texto });
      continue;
    }

    // --- PROCESAR MODO PORTADA O REFERENCIAS ---
    if (isInsidePortada) {
      const index = elements.length;
      // Asignar el rol de 'titulo' al primer elemento no vacío que encontremos en la portada
      const yaHayTitulo = portadaIndices.some(idx => elements[idx].rol === 'titulo' && elements[idx].texto !== '');
      const esTitulo = !yaHayTitulo && line !== '';
      
      elements.push({
        tipo: 'portada',
        rol: esTitulo ? 'titulo' : 'detalle',
        texto: lineRaw.replace(/^\s+/, ''),
        esUltimoDePortada: false
      });
      portadaIndices.push(index);
    } 
    else if (isInsideReferencias) {
      elements.push({
        tipo: 'referencia',
        texto: lineRaw.replace(/^\s+/, ''),
        esPrimeraReferencia: !firstReferenciaFound
      });
      firstReferenciaFound = true;
    } 
    else {
      // Párrafo estándar
      let textoLimpio = lineRaw;
      if (line.startsWith('[Párrafo') || line.startsWith('[Parrafo') || line.startsWith('[párrafo') || line.startsWith('[parrafo')) {
        const finMarcador = lineRaw.indexOf(']');
        if (finMarcador !== -1) {
          textoLimpio = lineRaw.substring(finMarcador + 1).replace(/^\s+/, '');
        }
      } else {
        textoLimpio = lineRaw.replace(/^\s+/, '');
      }
      
      elements.push({
        tipo: 'parrafo',
        texto: textoLimpio
      });
    }
  }

  // Si el texto termina y quedamos con una tabla abierta, la guardamos
  if (isInsideTabla && tablaElement) {
    elements.push(tablaElement);
  }

  // Marcar el último elemento de la portada para salto de página
  if (portadaIndices.length > 0) {
    const ultimoIndex = portadaIndices[portadaIndices.length - 1];
    elements[ultimoIndex].esUltimoDePortada = true;
  }

  return elements;
}

/**
 * Parsea un texto desorganizado/plano detectando automáticamente títulos, párrafos y referencias.
 */
function parsearTextoHeuristico(text) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);
  const elements = [];
  let titleFound = false;
  let firstReferenciaFound = false;
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    // 1. El primer bloque es el Título Principal
    if (!titleFound) {
      elements.push({ tipo: 'titulo1', texto: block });
      titleFound = true;
      continue;
    }
    
    // 2. Detectar si el bloque parece un subtítulo
    const lines = block.split('\n');
    const isShort = block.length < 75;
    const isSingleLine = lines.length === 1;
    const endsWithPunctuation = /[.?!]$/.test(block);
    
    // 3. Detectar si parece una referencia
    const isAtEnd = i >= blocks.length - 3;
    const containsYear = /\((19|20)\d{2}\)/.test(block) || /\(s\.f\.\)/.test(block);
    const looksLikeReference = isAtEnd && (containsYear || block.toLowerCase().includes('http') || block.toLowerCase().includes('doi.org'));

    if (looksLikeReference) {
      elements.push({
        tipo: 'referencia',
        texto: block.replace(/\n/g, ' '),
        esPrimeraReferencia: !firstReferenciaFound
      });
      firstReferenciaFound = true;
    } 
    else if (isShort && isSingleLine && !endsWithPunctuation) {
      elements.push({
        tipo: 'titulo2',
        texto: block
      });
    } 
    else {
      elements.push({
        tipo: 'parrafo',
        texto: block.replace(/\s+/g, ' ')
      });
    }
  }
  
  return elements;
}

/**
 * Genera un borrador de ejemplo inicial formateado bajo APA 7 para que el usuario empiece con una guía clara.
 */
export function obtenerTextoEjemploAPA() {
  return `[Portada]
FORMATO APA AUTOMÁTICO CON APA WRITER AI
Juan Pérez Meléndez
Facultad de Ingeniería y Ciencias Aplicadas, Universidad Nacional
Curso: Metodología de la Investigación (Sección A)
Dr. Alejandro Rodríguez
28 de mayo de 2026
[Fin Portada]

[Título] Formato APA Automático para Documentos

[Subtítulo] Introducción y Generalidades

[Párrafo] El presente documento sirve como ejemplo interactivo para ilustrar el funcionamiento de APA Writer AI. La interfaz de doble panel permite la traducción instantánea de borradores simples en texto académico con riguroso apejo a la séptima edición de las normas APA. Este software integra corrección gramatical inteligente y descarga directa a Microsoft Word.

[Subtítulo] Ejemplo de Tabla APA 7

[Párrafo] A continuación, se presenta una tabla de ejemplo estructurada de acuerdo a las pautas de APA 7. Notará que carece de líneas verticales y posee bordes horizontales limpios solo arriba y abajo.

[Tabla]
Comparativa de Resultados de Ansiedad
Variable | Grupo de Control | Grupo de Intervención
Ansiedad Previa | 6.54 | 6.58
Ansiedad Posterior | 6.42 | 3.10
Reducción Porcentual | 1.83% | 52.88%
Nota. Datos simulados del estudio piloto (N = 50).

[Subtítulo] Niveles de Títulos

[Párrafo] Los títulos organizan el documento de forma jerárquica. APA 7 admite hasta cinco niveles de encabezados. En este borrador ilustramos los tres niveles más recurrentes: el nivel 1 se presenta centrado y en negrita; el nivel 2 se alinea a la izquierda en negrita; y el nivel 3 se escribe a la izquierda en negrita y cursiva.

[Subsección] Subtítulos en Detalle y Cursivas

[Párrafo] Es vital recordar que los títulos de cualquier nivel nunca deben finalizar con punto. Además, no se debe agregar espacio adicional antes o después de un título a menos que sea el inicio de una sección específica que requiera un salto de página, conservando la simetría del doble espaciado uniforme.

[Referencias]
American Psychological Association. (2020). Publication manual of the American Psychological Association (7th ed.). https://doi.org/10.1037/0000165-000
Pérez, J., & Rodríguez, A. (2024). Innovación en la automatización de la escritura académica. Editorial Universitaria.
Smith, J. A. (2023). Deep learning for academic text parsing. Journal of Software Engineering, 15(3), 112-125. https://doi.org/10.1016/j.jse.2023.04.002`;
}
