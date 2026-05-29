import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Validar si la API Key está configurada o sigue siendo el valor por defecto
const isConfigured = 
  apiKey && 
  apiKey.trim() !== '' && 
  !apiKey.includes('reemplaza-con-tu-api-key');

if (!isConfigured) {
  console.warn(
    '⚠️ La API Key de Google Gemini no está configurada. Por favor, edita tu archivo .env local para activar las funciones de IA. Por ahora, se simularán las respuestas de IA para que puedas probar la aplicación.'
  );
}

// Inicializar el cliente de Google Gen AI si está disponible
const genAI = isConfigured ? new GoogleGenerativeAI(apiKey) : null;

/**
 * 1. Formatear y corregir texto de borrador a un estilo académico formal APA 7.
 * Correcciones: Eliminar primera persona, corregir gramática, asegurar lenguaje científico, mantener los marcadores.
 * @param {string} text - Borrador en texto plano con marcadores.
 * @returns {Promise<string>} Texto refinado por IA conservando los marcadores.
 */
export async function formatAcademicText(text) {
  if (!text || text.trim() === '') return '';

  if (!genAI) {
    // Retornar una simulación de IA si no está configurado
    return simularCorreccionIA(text);
  }

  try {
    // Usamos el modelo gemini-1.5-flash para correcciones rápidas y económicas
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `
Actúas como un editor académico senior y corrector de estilo especializado en normas APA 7 de la Universidad. 
Tu tarea es corregir y perfeccionar el texto que el usuario te proporciona, asegurando que:
1. Elimines por completo la primera persona ("yo", "nosotros", "hicimos", "creo") y lo redactes en tercera persona impersonal ("se realizó", "se determinó", "los autores sostienen").
2. Utilices un vocabulario formal, técnico y de nivel de posgrado científico.
3. Corrijas errores ortográficos, de puntuación, concordancia y sintaxis.
4. MANTENGAS estrictamente todos los marcadores estructurantes entre corchetes como [Portada], [Nivel 1], [Nivel 2], [Nivel 3], [Párrafo X], [Referencias] en el mismo lugar de origen si ya están presentes. No cambies su sintaxis ni los elimines.
5. SI EL TEXTO PEGO POR EL USUARIO NO CONTIENE NINGÚN MARCADOR (como [Nivel 1], [Nivel 2], [Párrafo], etc.), debes ESTRUCTURARLO AUTOMÁTICAMENTE de manera inteligente:
   - Si las primeras líneas del texto parecen datos de autor o título de trabajo, agrúpalos al inicio antecedidos por la etiqueta [Portada].
   - Identifica los títulos principales de capítulos/secciones y colócales [Nivel 1] al inicio de esa línea.
   - Identifica subtítulos secundarios y colócales [Nivel 2] o [Nivel 3] según su jerarquía.
   - Envuelve cada párrafo ordinario comenzando la línea con [Párrafo].
   - Si hay una sección de fuentes bibliográficas al final, agrúpala debajo de la etiqueta [Referencias].
6. Devuelvas ÚNICAMENTE el texto editado resultante estructurado, sin notas explicativas, ni introducciones antes o después.
    `;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Aquí está el texto del borrador a corregir:\n\n${text}` }
    ]);

    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Error al invocar la API de Gemini:', error);
    return simularCorreccionIA(text);
  }
}

/**
 * 2. Generar una referencia bibliográfica estructurada a partir de una descripción, URL o DOI.
 * @param {string} query - Entrada corta (ej: "https://doi.org/10.1017/CBO9780511814563" o "Libro de Gabriel García Márquez 100 años de soledad de editorial sudamericana")
 * @returns {Promise<Object>} Objeto de referencia mapeable a la tabla `apa_referencias` de Supabase.
 */
export async function generateCitation(query) {
  if (!query || query.trim() === '') return null;

  if (!genAI) {
    // Simular referencia si no hay API key
    return simularReferenciaIA(query);
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      // Forzar salida en formato JSON
      generationConfig: { responseMimeType: 'application/json' }
    });

    const systemPrompt = `
Actúas como un experto bibliotecólogo especializado en Normas APA 7.
Analiza la entrada del usuario (que puede ser un DOI, una URL, una cita incompleta o la descripción de un libro/artículo) y genera la referencia bibliográfica formal correspondiente.
Devuelve EXACTAMENTE un objeto JSON con la siguiente estructura y campos:
{
  "autor": "Apellidos, Iniciales de Nombres de los autores (ej: Pérez, J. R., & Gómez, A.)",
  "anio": "Año de publicación entre paréntesis o 's.f.' si no se conoce (ej: 2024)",
  "titulo": "Título de la obra (en minúsculas la mayoría excepto la primera palabra o nombres propios, ej: El análisis de datos en la nube)",
  "fuente": "Nombre de la revista, editorial, sitio web o universidad de procedencia (ej: Editorial Médica Panamericana)",
  "doi_url": "URL completa o DOI en formato de enlace (ej: https://doi.org/10.1037/0000165-000) o dejar en blanco si no aplica",
  "cita_parentetica": "Cita que se coloca al final de un párrafo entre paréntesis (ej: Pérez & Gómez, 2024)",
  "cita_narrativa": "Cita que se usa de forma fluida en el discurso (ej: Pérez y Gómez (2024))"
}

No incluyas textos externos, marcas de markdown de código (como \`\`\`json), solo el objeto JSON plano para ser parseado directamente.
    `;

    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Entrada del usuario para procesar:\n\n${query}` }
    ]);

    const response = await result.response;
    const jsonText = response.text().trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error al generar la referencia con Gemini:', error);
    return simularReferenciaIA(query);
  }
}

/**
 * SIMULACIÓN LOCAL PARA PRUEBAS (FALLBACKS)
 */
function simularCorreccionIA(text) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simular pequeñas mejoras de tono y corrección en el texto del ejemplo o borrador
      let result = text;
      
      // Reemplazos comunes de primera persona a tercera persona
      result = result.replace(/yo creo que/gi, 'se considera que');
      result = result.replace(/mi investigación/gi, 'la presente investigación');
      result = result.replace(/hicimos un análisis/gi, 'se llevó a cabo un análisis');
      result = result.replace(/queremos demostrar/gi, 'se pretende demostrar');
      result = result.replace(/nosotros concluimos/gi, 'se concluye');
      
      // Agregar un pequeño aviso amistoso al final del primer párrafo
      if (result.includes('[Párrafo 1]')) {
        result = result.replace(
          'corrección gramatical inteligente',
          'corrección gramatical inteligente (Procesado localmente: Configura tu VITE_GEMINI_API_KEY para activar Gemini completo)'
        );
      }

      resolve(result);
    }, 1500);
  });
}

function simularReferenciaIA(query) {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Intentar extraer algún dato inteligente de la query para crear un mockup coherente
      let autor = 'Autor Desconocido';
      let anio = new Date().getFullYear().toString();
      let titulo = 'Título del Recurso Encontrado';
      let fuente = 'Repositorio Web';
      let doi_url = query.startsWith('http') ? query : 'https://doi.org/10.1016/j.jse.2026.05.001';

      if (query.toLowerCase().includes('garcia marquez') || query.toLowerCase().includes('cien años')) {
        autor = 'García Márquez, G.';
        anio = '1967';
        titulo = 'Cien años de soledad';
        fuente = 'Editorial Sudamericana';
      } else if (query.toLowerCase().includes('apa') || query.toLowerCase().includes('manual')) {
        autor = 'American Psychological Association';
        anio = '2020';
        titulo = 'Publication manual of the American Psychological Association (7th ed.)';
        fuente = 'American Psychological Association';
      } else if (query.startsWith('http')) {
        autor = 'Redacción Web';
        fuente = new URL(query).hostname.replace('www.', '');
        titulo = `Artículo de ${fuente}`;
      }

      resolve({
        autor,
        anio,
        titulo,
        fuente,
        doi_url,
        cita_parentetica: `(${autor.split(',')[0]}, ${anio})`,
        cita_narrativa: `${autor.split(',')[0]} (${anio})`
      });
    }, 1200);
  });
}
