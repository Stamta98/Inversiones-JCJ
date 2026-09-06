/**
 * La nacionalidad del cliente.
 *
 * Es una lista corta y no un catálogo: en la puerta se escoge de un tirón, y
 * los seis de aquí cubren a casi todo el que pide un préstamo en la costa —
 * el colombiano y el venezolano, sobre todo. Van por países y no por
 * gentilicios («Colombia», no «Colombiana») porque es como quedó escrito en
 * las fichas que ya existen y como lo dice la gente.
 *
 * Con «Otra» se escribe la que sea: un haitiano en Santa Marta o un
 * argentino de paso son clientes normales, y una lista cerrada que no sepa
 * escribir su país es una lista que no deja prestar.
 */

export const NATIONALITIES = [
  "Colombia",
  "Venezuela",
  "México",
  "Ecuador",
  "Perú",
  "Chile",
] as const;

/** La que trae la ficha en blanco: casi siempre acierta y ahorra un toque. */
export const DEFAULT_NATIONALITY = "Colombia";
