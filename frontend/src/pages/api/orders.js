import axios from "axios";

export default async function handler(req, res) {
    const { method, query } = req;
    const { date } = query;
    let url = "https://pizzatototlan.store/api/get_orders";
    if (date) {
        url += `?date=${date}`;
    }

    try {
        const response = await axios.get(url);
        const data = response.data;

        if (!Array.isArray(data)) {
            data = data ? [data] : [];
        }

        data.forEach((order) => {
            const createdAt = order.createdAt;
            if (createdAt) {
                order.updatedAt = order.updatedAt || createdAt;
            }
        });

        res.status(200).json(data);
    } catch (error) {
        console.error("Error al obtener pedidos:", error);
        res.status(500).json({
            error: "No se pudieron obtener los pedidos de la API externa",
        });
    }
}
