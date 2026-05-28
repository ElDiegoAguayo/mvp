export const formatDate = (dateString: string) => {
  if (!dateString) return ""
  try {
    // Reemplaza el espacio por 'T' para que sea compatible con todos los navegadores
    const safeString = dateString.replace(' ', 'T')
    const date = new Date(safeString)

    // Validar que el objeto Date sea correcto
    if (isNaN(date.getTime())) return dateString

    // Formatear a DD/MM/YYYY (solo fecha, sin hora)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()

    return `${day}/${month}/${year}`
  } catch (e) {
    return dateString // Retorna el string original si algo falla
  }
}
