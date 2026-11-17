// Identifiants Strava (activités, athlètes) : 64 bits à partir du 1er juin 2027, au-delà de ce qu'un nombre JS
// garde exact (2^53). On les manipule toujours en texte : id_str quand Strava le fournit, sinon l'entier converti.
export const sid = (o: { id?: unknown; id_str?: unknown } | null | undefined): string =>
  o?.id_str != null ? String(o.id_str) : String(o?.id);
// Extrait un champ entier d'un JSON brut sans passer par un nombre JS (webhook : object_id, owner_id)
export const rawInt = (raw: string, key: string): string | null =>
  raw.match(new RegExp(`"${key}"\\s*:\\s*"?(\\d+)`))?.[1] ?? null;
