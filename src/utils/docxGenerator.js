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
  HeadingLevel,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from 'docx';

/**
 * Genera y descarga un archivo .docx con formato estricto APA 7.
 * @param {Object} documentData - Datos del documento a generar.
 * @param {string} documentData.titulo - Título del documento.
 * @param {Array} documentData.elementos - Array de elementos formateados (portada, títulos, párrafos, referencias).
 * @param {boolean} documentData.showTOC - Indica si se incluye la Tabla de Contenidos.
 */
export async function exportarADocx(documentData) {
  const { titulo, elementos, showTOC } = documentData;
  const docElements = [];

  let figureCounter = 0;
  let tableCounter = 0;

  // Bordes para tablas APA 7 (Líneas horizontales sólidas, sin líneas verticales)
  const borderAPAHeadTop = { style: BorderStyle.SINGLE, size: 12, color: '000000' };    // 1.5 pt
  const borderAPAHeadBottom = { style: BorderStyle.SINGLE, size: 8, color: '000000' }; // 1 pt
  const borderAPANil = { style: BorderStyle.NONE, size: 0, color: 'auto' };

  // 1. Estructurar los elementos según los tipos
  elementos.forEach((el, index) => {
    // Si es portada, aplicamos formato centrado y espaciado especial
    if (el.tipo === 'portada') {
      if (index === 0) {
        for (let i = 0; i < 3; i++) {
          docElements.push(crearParrafoVacio());
        }
      }

      const esTitulo = el.rol === 'titulo';
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: esTitulo ? 240 : 0, line: 480, lineRule: 'auto' }, // Doble espacio
          children: [
            new TextRun({
              text: el.texto,
              font: 'Times New Roman',
              size: 24, // 12 pt
              bold: esTitulo,
            }),
          ],
        })
      );

      // Si es el último elemento de la portada, agregar un salto de página y la TABLA DE CONTENIDOS si está activa
      if (el.esUltimoDePortada) {
        docElements.push(new Paragraph({ children: [new PageBreak()] }));

        // === TABLA DE CONTENIDOS EN WORD ===
        if (showTOC) {
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

          docElements.push(new Paragraph({ children: [new PageBreak()] }));
        }
      }
    } 
    // Título de Nivel 1 (Centrado, Negrita)
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
    // Título de Nivel 2 (Alineado Izquierda, Negrita)
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
    // Título de Nivel 3 (Alineado Izquierda, Negrita, Cursiva)
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
          indent: { firstLine: 720 }, // Sangría primera línea
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
    // Figuras (Imágenes incrustadas dinámicamente)
    else if (el.tipo === 'figura') {
      figureCounter++;
      
      // 1. Etiqueta bold "Figura X"
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 240, after: 60, line: 480, lineRule: 'auto' },
          keepWithNext: true,
          children: [
            new TextRun({
              text: `Figura ${figureCounter}`,
              font: 'Times New Roman',
              size: 24,
              bold: true,
            }),
          ],
        })
      );

      // 2. Título en cursiva
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 120, line: 480, lineRule: 'auto' },
          keepWithNext: true,
          children: [
            new TextRun({
              text: el.titulo,
              font: 'Times New Roman',
              size: 24,
              italics: true,
            }),
          ],
        })
      );

      // 3. Imagen Centrada (Incrustada desde el Base64)
      if (el.base64) {
        try {
          // Limpiar prefijo data:image/...;base64,
          const cleanBase64 = el.base64.split(';base64,').pop();
          
          // Decodificar Base64 a array de bytes (Uint8Array) compatible con el navegador
          const binaryString = window.atob(cleanBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let j = 0; j < len; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }

          docElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new ImageRun({
                  data: bytes,
                  transformation: {
                    width: 450, // Ancho proporcional
                    height: 300,
                  },
                }),
              ],
            })
          );
        } catch (imageError) {
          console.error('Error al incrustar imagen en docx:', imageError);
          docElements.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: '[Error al procesar la imagen para Word]',
                  font: 'Times New Roman',
                  size: 20,
                  italics: true,
                }),
              ],
            })
          );
        }
      }

      // 4. Nota de la figura
      if (el.nota) {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 60, after: 240, line: 240, lineRule: 'auto' }, // Espaciado simple para notas al pie
            children: [
              new TextRun({
                text: 'Nota. ',
                font: 'Times New Roman',
                size: 20, // 10 pt
                italics: true,
              }),
              new TextRun({
                text: el.nota.replace(/^nota\.\s*/i, ''),
                font: 'Times New Roman',
                size: 20,
              }),
            ],
          })
        );
      }
    }
    // Tablas (Tablas nativas con bordes APA 7 horizontales)
    else if (el.tipo === 'tabla') {
      tableCounter++;

      // 1. Etiqueta "Tabla X" en negrita
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 240, after: 60, line: 480, lineRule: 'auto' },
          keepWithNext: true,
          children: [
            new TextRun({
              text: `Tabla ${tableCounter}`,
              font: 'Times New Roman',
              size: 24,
              bold: true,
            }),
          ],
        })
      );

      // 2. Título en cursiva
      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 120, line: 480, lineRule: 'auto' },
          keepWithNext: true,
          children: [
            new TextRun({
              text: el.titulo,
              font: 'Times New Roman',
              size: 24,
              italics: true,
            }),
          ],
        })
      );

      // 3. Crear celdas y filas nativas de Word con bordes APA 7 selectivos
      const tableRows = [];

      // Añadir fila de Cabeceras
      if (el.encabezados && el.encabezados.length > 0) {
        tableRows.push(
          new TableRow({
            children: el.encabezados.map((headerText, colIdx) => (
              new TableCell({
                width: { size: 100 / el.encabezados.length, type: WidthType.PERCENTAGE },
                borders: {
                  top: borderAPAHeadTop,
                  bottom: borderAPAHeadBottom,
                  left: borderAPANil,
                  right: borderAPANil,
                },
                children: [
                  new Paragraph({
                    alignment: colIdx === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                    spacing: { before: 120, after: 120 },
                    children: [
                      new TextRun({
                        text: headerText,
                        font: 'Times New Roman',
                        size: 20, // 10 pt
                        bold: true,
                      }),
                    ],
                  }),
                ],
              })
            )),
          })
        );
      }

      // Añadir filas de Datos
      if (el.filas && el.filas.length > 0) {
        el.filas.forEach((fila, rowIdx) => {
          const isLastRow = rowIdx === el.filas.length - 1;
          
          tableRows.push(
            new TableRow({
              children: fila.map((cellText, colIdx) => (
                new TableCell({
                  width: { size: 100 / fila.length, type: WidthType.PERCENTAGE },
                  borders: {
                    top: borderAPANil,
                    bottom: isLastRow ? borderAPAHeadTop : borderAPANil, // La última celda lleva borde inferior de tabla
                    left: borderAPANil,
                    right: borderAPANil,
                  },
                  children: [
                    new Paragraph({
                      alignment: colIdx === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT,
                      spacing: { before: 120, after: 120 },
                      children: [
                        new TextRun({
                          text: cellText,
                          font: 'Times New Roman',
                          size: 20,
                        }),
                      ],
                    }),
                  ],
                })
              )),
            })
          );
        });
      }

      // Añadir la Tabla nativa al documento
      docElements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        })
      );

      // 4. Nota de la tabla
      if (el.nota) {
        docElements.push(
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 120, after: 240, line: 240, lineRule: 'auto' }, // Espaciado simple
            children: [
              new TextRun({
                text: 'Nota. ',
                font: 'Times New Roman',
                size: 20,
                italics: true,
              }),
              new TextRun({
                text: el.nota.replace(/^nota\.\s*/i, ''),
                font: 'Times New Roman',
                size: 20,
              }),
            ],
          })
        );
      }
    }
    // Referencias bibliográficas
    else if (el.tipo === 'referencia') {
      if (el.esPrimeraReferencia) {
        docElements.push(new Paragraph({ children: [new PageBreak()] }));
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

      docElements.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 120, line: 480, lineRule: 'auto' },
          indent: { left: 720, hanging: 720 },
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
              top: 1440,    // 1 pulgada
              bottom: 1440,
              left: 1440,
              right: 1440,
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
                    size: 24,
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

  // 3. Empaquetar y generar la descarga
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
