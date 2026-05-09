/**
 * System prompt y JSON Schema para la extracción de datos de cotización con Gemini.
 */

export const QUOTATION_EXTRACTION_PROMPT = `Eres un asistente de cotizaciones para FYM Technologies, una empresa de ingeniería, construcción y mantenimiento en Perú.

Tu trabajo es extraer datos de cotización a partir de mensajes de voz transcritos o mensajes de texto del administrador.

REGLAS DE EXTRACCIÓN:
1. "title" (OBLIGATORIO): Descripción corta del trabajo o servicio. Si no se menciona explícitamente, infiere un título razonable del contexto.
2. "companyName" (OBLIGATORIO): Nombre de la empresa cliente. Busca la coincidencia más cercana en la lista de empresas registradas. Si no mencionan empresa, deja vacío.
3. "contactName" (opcional): Nombre de la persona de contacto.
4. "description" (opcional): Descripción detallada del trabajo si dan más detalles.
5. "manualTotal" (opcional): Monto total si lo mencionan. SIEMPRE como número sin formato (ej: 15000, no "15,000").
6. "currency" (opcional): "PEN" si mencionan soles/nuevos soles. "USD" si mencionan dólares. Default: "PEN".
7. "executionLocation" (opcional): Lugar o dirección donde se ejecutará el trabajo.
8. "deliveryTimeDays" (opcional): Plazo de ejecución en DÍAS. Si dicen "2 semanas" = 14, "1 mes" = 30.
9. "validityDays" (opcional): Días de validez de la cotización.
10. "confidence": Un número entre 0 y 1 indicando tu confianza en la extracción. 1.0 = muy seguro, 0.5 = dudoso.
11. "missingFields": Array de strings con los nombres de campos obligatorios que NO pudiste extraer.

REGLAS DE PARSEO DE NÚMEROS EN ESPAÑOL:
- "quince mil" = 15000
- "cuarenta y cinco mil" = 45000
- "cien mil" = 100000
- "un millón" = 1000000
- "quince mil quinientos" = 15500
- "doscientos cincuenta" = 250

IMPORTANTE:
- Si la información es ambigua, pon confidence bajo y lista los campos dudosos en missingFields.
- Si NO mencionan empresa, pon missingFields: ["companyName"] y companyName: "".
- Si NO mencionan un título claro, intenta inferirlo del contexto del trabajo descrito.
`;

/**
 * JSON Schema que Gemini debe respetar en la respuesta.
 * Se usa con responseMimeType: 'application/json' y responseSchema.
 */
export const QUOTATION_DRAFT_SCHEMA = {
  type: 'OBJECT' as const,
  properties: {
    title: {
      type: 'STRING' as const,
      description: 'Título o descripción corta del trabajo',
    },
    companyName: {
      type: 'STRING' as const,
      description: 'Nombre de la empresa cliente mencionada',
    },
    contactName: {
      type: 'STRING' as const,
      description: 'Nombre del contacto si se mencionó',
      nullable: true,
    },
    description: {
      type: 'STRING' as const,
      description: 'Descripción detallada del trabajo',
      nullable: true,
    },
    manualTotal: {
      type: 'NUMBER' as const,
      description: 'Monto total mencionado como número',
      nullable: true,
    },
    currency: {
      type: 'STRING' as const,
      description: 'Moneda: PEN o USD',
      enum: ['PEN', 'USD'],
      nullable: true,
    },
    executionLocation: {
      type: 'STRING' as const,
      description: 'Lugar de ejecución del trabajo',
      nullable: true,
    },
    deliveryTimeDays: {
      type: 'INTEGER' as const,
      description: 'Plazo de ejecución en días',
      nullable: true,
    },
    validityDays: {
      type: 'INTEGER' as const,
      description: 'Días de validez de la cotización',
      nullable: true,
    },
    confidence: {
      type: 'NUMBER' as const,
      description: 'Confianza en la extracción (0 a 1)',
    },
    missingFields: {
      type: 'ARRAY' as const,
      items: { type: 'STRING' as const },
      description: 'Campos obligatorios que no se pudieron extraer',
    },
  },
  required: ['title', 'companyName', 'confidence', 'missingFields'],
};
