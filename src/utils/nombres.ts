// Utilidades de presentación del nombre de una persona (CU 05 y CU 06).

const PREFIJOS_TRATAMIENTO = ['dr.', 'dra.', 'doctor', 'doctora', 'sr.', 'sra.', 'ab.', 'abg.']

/** Iniciales para el avatar cuando el perfil no autoriza publicar fotografía. */
export function inicialesDeNombre(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0 && !PREFIJOS_TRATAMIENTO.includes(palabra.toLowerCase()))
  const utiles = palabras.length > 0 ? palabras : nombre.trim().split(/\s+/)
  return utiles
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('')
}
