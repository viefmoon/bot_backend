import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

export default async function handler(req, res) {
    const { method, body } = req;
    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/order-status`;

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
