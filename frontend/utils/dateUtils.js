export function formatDateToMexicoTime(dateString, dateOnly = false) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Fecha inválida";
    const options = {
        timeZone: "America/Mexico_City",
        year: "numeric",
        month: "short",
        day: "numeric",
    };
    if (!dateOnly) {
        options.hour = "2-digit";
        options.minute = "2-digit";
        options.hour12 = true;
    }
    return date.toLocaleString("es-MX", options);
}
