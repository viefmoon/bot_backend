const moment = require('moment-timezone');
const axios = require('axios');

let mexicoCityTime = null;
let lastFetch = null;

async function getMexicoCityTime() {
    const now = Date.now();
    if (!mexicoCityTime || !lastFetch || now - lastFetch > 3600000) { // Actualizar cada hora
        try {
            const response = await axios.get('http://worldtimeapi.org/api/timezone/America/Mexico_City');
            mexicoCityTime = moment.tz(response.data.datetime, 'America/Mexico_City');
            lastFetch = now;
        } catch (error) {
            console.error('Error al obtener la hora de México:', error);
            // En caso de error, usar la hora local del servidor ajustada a la zona de México
            mexicoCityTime = moment().tz('America/Mexico_City');
        }
    } else {
        // Ajustar la hora guardada al tiempo actual
        mexicoCityTime = mexicoCityTime.add(now - lastFetch, 'milliseconds');
    }
    return mexicoCityTime;
}

async function verificarHorarioAtencion() {
    const ahora = await getMexicoCityTime();
    const diaSemana = ahora.day(); // 0 es domingo, 1 es lunes, etc.
    const tiempoActual = ahora.hours() * 60 + ahora.minutes();

    const horarioNormal = {
        apertura: 6 * 60, // 6:00 AM
        cierre: 23 * 60    // 11:00 PM
    };

    const horarioDomingo = {
        apertura: 6 * 60, // 6:00 AM
        cierre: 23 * 60    // 11:00 PM
    };

    switch (diaSemana) {
        case 0: // Domingo
            return tiempoActual >= horarioDomingo.apertura && tiempoActual < horarioDomingo.cierre;
        case 1: // Lunes
            return false; // Cerrado los lunes
        case 2: // Martes
        case 3: // Miércoles
        case 4: // Jueves
        case 5: // Viernes
        case 6: // Sábado
            return tiempoActual >= horarioNormal.apertura && tiempoActual < horarioNormal.cierre;
        default:
            return false;
    }
}

module.exports = { verificarHorarioAtencion };