import axios from "axios";

export default async function handler(req, res) {
    const { method, body } = req;
    const url = "https://pizzatototlan.store/api/ban_customer";

    try {
        const response = await axios.post(url, body);
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error al procesar la acción del cliente:", error);
        res.status(500).json({
            error: "No se pudo procesar la acción del cliente",
        });
    }
}
