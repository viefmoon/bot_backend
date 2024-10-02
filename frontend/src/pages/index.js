import { useEffect, useState } from "react";
import axios from "axios";
import OrderCard from "../components/OrderCard";
import ClientCard from "../components/ClientCard";

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchOrders();
    fetchClients();
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async (date = null) => {
    try {
      let url = "/api/orders";
      if (date) {
        url += `?date=${date}`;
      }
      const response = await axios.get(url);
      setOrders(response.data);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      setError(
        "No se pudieron obtener los pedidos. Por favor, inténtelo de nuevo más tarde.",
      );
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get("/api/clients");
      setClients(response.data);
    } catch (error) {
      console.error("Error al obtener clientes:", error);
      setError(
        "No se pudieron obtener los clientes. Por favor, inténtelo de nuevo más tarde.",
      );
    }
  };

  return (
    <div>
      <button id="refreshOrdersButton" onClick={fetchOrders}>
        Refrescar Pedidos
      </button>
      <button id="refreshClientsButton" onClick={fetchClients}>
        Refrescar Clientes
      </button>
      {error && <div className="alert alert-danger">{error}</div>}
      <div id="order-list">
        {orders.length === 0 ? (
          <p className="text-center">No se encontraron pedidos.</p>
        ) : (
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </div>
      <div id="client-list">
        {clients.length === 0 ? (
          <p className="text-center">No se encontraron clientes.</p>
        ) : (
          clients.map((client) => (
            <ClientCard key={client.clientId} client={client} />
          ))
        )}
      </div>
    </div>
  );
}
