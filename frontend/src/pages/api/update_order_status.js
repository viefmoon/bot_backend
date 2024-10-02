import axios from "axios";

export default async function handler(req, res) {
    const { method, body } = req;
    const url = "https://pizzatototlan.store/api/update_order_status";

    try {
        const response = await axios.put(url, body);
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error al actualizar el estado del pedido:", error);
        res.status(500).json({
            error: "No se pudo actualizar el estado del pedido",
        });
    }
}
