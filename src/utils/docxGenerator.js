import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  AlignmentType, 
  Header, 
  PageNumber,
  PageBreak,
  TableOfContents,
  HeadingLevel
} from 'docx';

/**
 * Genera y descarga un archivo .docx con formato estricto APA 7.
 * @param {Object} documentData - Datos del documento a generar.
 * @param {string} documentData.titulo - Título del documento.
 * @param {Array} documentData.elementos - Array de elementos formateados (portada, títulos, párrafos, referencias).
 */
export async function exportarADocx(documentData) {
  const { titulo, elementos, showTOC } = documentData;
  const docElements = [];

  // 1. Estructurar los elementos según los tipos
  elementos.forEach((el, index) => {
    // Si es portada, aplicamos formato centrado y espaciado especial
    if (el.tipo === 'portada') {
      // Dejar espacio antes del título en la portada (3-4 líneas en blanco)
      if (index === 0) {
        for (let i = 0; i < 3; i++) {
          docElements.push(crearParrafoVacio());
        }
      }

      const esTitulo = el.rol === 'titulo';
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: esTitulo ? 240 : 0, line: 480, lineRule: 'auto' }, // Doble espacio (480 dxa)
          children: [
            new TextRun({
              text: el.texto,
              font: 'Times New Roman',
              size: 24, // 12 pt
              bold: esTitulo, // El título va en negrita en la portada APA 7
            }),
          ],
        })
      );

      // Si es el último elemento de la portada, agregar un salto de página y la TABLA DE CONTENIDOS si está activa
      if (el.esUltimoDePortada) {
        docElements.push(new Paragraph({ children: [new PageBreak()] }));

        // === INSERTAR TABLA DE CONTENIDOS AUTOMÁTICA (APA 7) ===
        if (showTOC) {
          // Título "Contenidos" centrado y negrita
          docElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 240, line: 480, lineRule: 'auto' },
              children: [
                new TextRun({
                  text: 'Contenidos',
                  font: 'Times New Roman',
                  size: 24,
                  bold: true,
                }),
              ],
            })
          );

          // Tabla de contenidos conectada a los estilos Heading 1, 2 y 3
          docElements.push(
            new TableOfContents('Contenidos', {
              hyperlink: true,
              headingStyleRange: '1-3',
              stylesWithLevels: {
                'Heading1': 1,
                'Heading2': 2,
                'Heading3': 3,
              },
            })
          );

          // Salto de página para iniciar el contenido del documento en la página 3
          docElements.push(new Paragraph({ children: [new PageBreak()] }));
        }
      }
    } 
    // Título de Nivel 1 (Centrado, Negrita, Estilo Heading 1 para TOC)
    else if (el.tipo === 'titulo1') {
      docElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120, line: 480, lineRule: 'auto' },
          keepWithNext: true,
          children: [
            new TextRun({
              text: el.texto,
              font: 'Times New Roman',
              size: 24,
              bold: true,
            }),
          ],
        })
      );
    } 
    // Título de Nivel 2 (Alineado Izquierda, Negrita, Estilo Heading 2 para TOC)
    else if (el.tipo === 'titulo2') {
      docElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.LEFT,
          spacing: { before: 240, after: 120, line: 480, lineRule: 'auto' },
          keepWithNext: true,
          children: [
            new TextRun({
              text: el.texto,
              font: 'Times New Roman',
              size: 24,
              bold: true,
            }),
          ],
        })
      );
    } 
    // Título de Nivel 3 (Alineado Izquierda, Negrita, Cursiva, Estilo Heading 3 para TOC)
    else if (el.tipo === 'titulo3') {
      docElements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          alignment: AlignmentType.LEFT,
          spacing: { before: 240, after: 120, line: 480, lineRule: 'auto' },
          keepWithNext: true,
          children: [
            new TextRun({
              text: el.texto,
              font: 'Times New Roman',
              size: 24,
              bold: true,
              italics: true,
            }),
          ],
        })
      );
    } 
    // Párrafo de texto (Sangría en primera línea de 1.27 cm = 720 dxa)
    else if (el.tipo === 'parrafo') {
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 0, line: 480, lineRule: 'auto' },
          indent: { firstLine: 720 }, // Sangría de primera línea 0.5 pulg
          children: [
            new TextRun({
              text: el.texto,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        })
      );
    } 
    // Referencia bibliográfica (Sangría francesa de 1.27 cm = 720 dxa)
    else if (el.tipo === 'referencia') {
      // Si es la primera referencia, agregamos el título "Referencias" centrado en negrita
      if (el.esPrimeraReferencia) {
        docElements.push(new Paragraph({ children: [new PageBreak()] })); // Salto de página para referencias
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 240, line: 480, lineRule: 'auto' },
            children: [
              new TextRun({
                text: 'Referencias',
                font: 'Times New Roman',
                size: 24,
                bold: true,
              }),
            ],
          })
        );
      }

      // Añadir la referencia con sangría francesa (hanging indent)
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 120, line: 480, lineRule: 'auto' },
          indent: { left: 720, hanging: 720 }, // Sangría francesa: margen izq de 0.5", y primera línea retrasada 0.5"
          children: [
            new TextRun({
              text: el.texto,
              font: 'Times New Roman',
              size: 24,
            }),
          ],
        })
      );
    }
  });

  // 2. Crear la configuración del Documento
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 pulgada (2.54 cm)
              bottom: 1440, // 1 pulgada (2.54 cm)
              left: 1440,   // 1 pulgada (2.54 cm)
              right: 1440,  // 1 pulgada (2.54 cm)
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Times New Roman',
                    size: 24, // 12 pt
                  }),
                ],
              }),
            ],
          }),
        },
        children: docElements,
      },
    ],
  });

  // 3. Empaquetar y generar la descarga en el navegador
  try {
    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_apa7.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Error al compilar y empaquetar el documento DOCX:', error);
    throw error;
  }
}

// Genera un párrafo vacío con doble espacio
function crearParrafoVacio() {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: 480, lineRule: 'auto' },
    children: [
      new TextRun({
        text: '',
        font: 'Times New Roman',
        size: 24,
      }),
    ],
  });
}
