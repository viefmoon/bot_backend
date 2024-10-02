import axios from "axios";

export default async function handler(req, res) {
    const url = "https://pizzatototlan.store/api/get_customers";

    try {
        const response = await axios.get(url);
        const data = response.data;

        if (!Array.isArray(data)) {
            data = data ? [data] : [];
        }

        data.forEach((client) => {
            delete client.fullChatHistory;
        });

        res.status(200).json(data);
    } catch (error) {
        console.error("Error al obtener clientes:", error);
        res.status(500).json({
            error: "No se pudieron obtener los clientes de la API externa",
        });
    }
}
