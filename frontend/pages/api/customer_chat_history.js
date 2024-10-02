import axios from "axios";

export default async function handler(req, res) {
    const { query } = req;
    const { clientId } = query;

    if (!clientId) {
        return res
            .status(400)
            .json({ error: "Se requiere el parámetro clientId" });
    }

    const url = `https://pizzatototlan.store/api/get_customer_chat_history?clientId=${clientId}`;

    try {
        const response = await axios.get(url);
        res.status(200).json(response.data);
    } catch (error) {
        console.error(
            "Error al obtener el historial de chat del cliente:",
            error,
        );
        res.status(500).json({
            error: "No se pudo obtener el historial de chat del cliente",
        });
    }
}
