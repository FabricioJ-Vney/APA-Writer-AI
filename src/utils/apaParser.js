/**
 * Parsea el texto crudo del borrador (con marcadores) en una estructura JSON de elementos con tipo y formato.
 * @param {string} text - Texto crudo ingresado por el usuario.
 * @returns {Array} Listado de objetos con { tipo, texto, rol, esUltimoDePortada, esPrimeraReferencia }
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
  
  // Guardamos las líneas de portada temporales para marcar la última
  let portadaIndices = [];
  let firstReferenciaFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Ignorar líneas vacías a menos que estemos en un párrafo acumulativo
    if (line === '') {
      continue;
    }

    // Identificar cambios de modo por marcadores explícitos
    if (line.toLowerCase().includes('[portada]')) {
      isInsidePortada = true;
      isInsideReferencias = false;
      continue;
    }

    if (line.toLowerCase().includes('[referencias]')) {
      isInsideReferencias = true;
      isInsidePortada = false;
      continue;
    }

    // Identificar marcadores de títulos amigables
    if (line.startsWith('[Título]') || line.startsWith('[Titulo]') || line.startsWith('[título]') || line.startsWith('[titulo]')) {
      isInsidePortada = false;
      const texto = line.replace(/\[T[ií]tulo\]/gi, '').trim();
      elements.push({ tipo: 'titulo1', texto });
      continue;
    }

    if (line.startsWith('[Subtítulo]') || line.startsWith('[Subtitulo]') || line.startsWith('[subtítulo]') || line.startsWith('[subtitulo]')) {
      isInsidePortada = false;
      const texto = line.replace(/\[Subt[ií]tulo\]/gi, '').trim();
      elements.push({ tipo: 'titulo2', texto });
      continue;
    }

    if (line.startsWith('[Subsección]') || line.startsWith('[Subseccion]') || line.startsWith('[subsección]') || line.startsWith('[subseccion]')) {
      isInsidePortada = false;
      const texto = line.replace(/\[Subsecci[oó]n\]/gi, '').trim();
      elements.push({ tipo: 'titulo3', texto });
      continue;
    }

    // Procesar según el modo activo
    if (isInsidePortada) {
      const index = elements.length;
      // El primer elemento de la portada suele tratarse como el título en negrita
      const esPrimerElemento = portadaIndices.length === 0;
      elements.push({
        tipo: 'portada',
        rol: esPrimerElemento ? 'titulo' : 'detalle',
        texto: line,
        esUltimoDePortada: false
      });
      portadaIndices.push(index);
    } 
    else if (isInsideReferencias) {
      elements.push({
        tipo: 'referencia',
        texto: line,
        esPrimeraReferencia: !firstReferenciaFound
      });
      firstReferenciaFound = true;
    } 
    else {
      // Párrafo estándar
      // Limpiar marcadores opcionales si el usuario los escribió
      let textoLimpio = line;
      if (line.startsWith('[Párrafo') || line.startsWith('[Parrafo') || line.startsWith('[párrafo') || line.startsWith('[parrafo')) {
        const finMarcador = line.indexOf(']');
        if (finMarcador !== -1) {
          textoLimpio = line.substring(finMarcador + 1).trim();
        }
      }
      
      elements.push({
        tipo: 'parrafo',
        texto: textoLimpio
      });
    }
  }

  // Marcar el último elemento de la portada para que el generador e interfaz apliquen salto de página
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
  // Dividir el texto por líneas en blanco (bloques de párrafos)
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);
  const elements = [];
  let titleFound = false;
  let firstReferenciaFound = false;
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    
    // 1. El primer párrafo o bloque es asumido como el Título Principal del documento
    if (!titleFound) {
      elements.push({ tipo: 'titulo1', texto: block });
      titleFound = true;
      continue;
    }
    
    // 2. Analizar si el bloque parece un subtítulo:
    // - Es corto (menos de 75 caracteres)
    // - Es de una sola línea
    // - No termina en signos de puntuación de cierre de frase (. ? !)
    const lines = block.split('\n');
    const isShort = block.length < 75;
    const isSingleLine = lines.length === 1;
    const endsWithPunctuation = /[.?!]$/.test(block);
    
    // 3. Analizar si parece una referencia bibliográfica:
    // - Está ubicado al final del documento (últimos bloques)
    // - Contiene un año entre paréntesis: "(2020)" o "(s.f.)" o enlaces "http" / "doi.org"
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
      // Es un subtítulo (Nivel 2)
      elements.push({
        tipo: 'titulo2',
        texto: block
      });
    } 
    else {
      // Párrafo de texto regular
      // Remover saltos de línea internos para formar un párrafo fluido
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

[Título] Formato APA Automático para Documentos

[Subtítulo] Introducción y Generalidades

[Párrafo] El presente documento sirve como ejemplo interactivo para ilustrar el funcionamiento de APA Writer AI. La interfaz de doble panel permite la traducción instantánea de borradores simples en texto académico con riguroso apejo a la séptima edición de las normas APA. Este software integra corrección gramatical inteligente y descarga directa a Microsoft Word.

[Párrafo] De acuerdo con las pautas de APA 7, cada párrafo del cuerpo del texto debe poseer una sangría de media pulgada (equivalente a 1.27 centímetros o 0.5 pulgadas) en su primera línea. Asimismo, el interlineado debe ser exactamente doble, y el documento debe usar fuentes altamente legibles como Times New Roman de 12 puntos o Arial de 11 puntos, garantizando la consistencia formal necesaria en publicaciones de carácter científico.

[Subtítulo] Niveles de Títulos

[Párrafo] Los títulos organizan el documento de forma jerárquica. APA 7 admite hasta cinco niveles de encabezados. En este borrador ilustramos los tres niveles más recurrentes: el nivel 1 se presenta centrado y en negrita; el nivel 2 se alinea a la izquierda en negrita; y el nivel 3 se escribe a la izquierda en negrita y cursiva.

[Subsección] Subtítulos en Detalle y Cursivas

[Párrafo] Es vital recordar que los títulos de cualquier nivel nunca deben finalizar con punto. Además, no se debe agregar espacio adicional antes o después de un título a menos que sea el inicio de una sección específica que requiera un salto de página, conservando la simetría del doble espaciado uniforme.

[Referencias]
American Psychological Association. (2020). Publication manual of the American Psychological Association (7th ed.). https://doi.org/10.1037/0000165-000
Pérez, J., & Rodríguez, A. (2024). Innovación en la automatización de la escritura académica. Editorial Universitaria.
Smith, J. A. (2023). Deep learning for academic text parsing. Journal of Software Engineering, 15(3), 112-125. https://doi.org/10.1016/j.jse.2023.04.002`;
}
