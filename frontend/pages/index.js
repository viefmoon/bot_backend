import { useEffect, useState } from "react";
import axios from "axios";
import OrderCard from "../components/OrderCard";
import CustomerCard from "../components/CustomerCard";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format } from "date-fns";

export default function Home() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date()); // Por defecto a la fecha actual

  useEffect(() => {
    fetchOrders(selectedDate); // Llamar con la fecha seleccionada o la actual
    fetchClients();
    const interval = setInterval(() => {
      fetchOrders(selectedDate); // Asegurarse de usar siempre la fecha seleccionada
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDate]); // Actualiza el intervalo si la fecha seleccionada cambia

  const fetchOrders = async (date) => {
    try {
      let url = "/api/orders";
      if (date) {
        const formattedDate = format(date, "yyyy-MM-dd"); // Formato de la fecha
        url += `?date=${formattedDate}`;
      }
      const response = await axios.get(url);
      setOrders(response.data);
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
      setError(
        "No se pudieron obtener los pedidos. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get("/api/customers");
      setClients(response.data);
    } catch (error) {
      console.error("Error al obtener clientes:", error);
      setError(
        "No se pudieron obtener los clientes. Por favor, inténtelo de nuevo más tarde."
      );
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  return (
    <div className="container">
      <div className="controls">
        <button
          id="refreshOrdersButton"
          onClick={() => fetchOrders(selectedDate)}
        >
          Refrescar Pedidos
        </button>
        <button id="refreshClientsButton" onClick={fetchClients}>
          Refrescar Clientes
        </button>
        <div>
          <label>Selecciona una fecha: </label>
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="yyyy-MM-dd"
            placeholderText="Selecciona una fecha"
          />
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="content-wrapper">
        <div className="column orders-column">
          <h2>Pedidos</h2>
          <div id="order-list">
            {orders.length === 0 ? (
              <p className="text-center">No se encontraron pedidos.</p>
            ) : (
              orders.map((order) => <OrderCard key={order.id} order={order} />)
            )}
          </div>
        </div>

        <div className="column clients-column">
          <h2>Clientes</h2>
          <div id="client-list">
            {clients.length === 0 ? (
              <p className="text-center">No se encontraron clientes.</p>
            ) : (
              clients.map((client) => (
                <CustomerCard key={client.clientId} client={client} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
