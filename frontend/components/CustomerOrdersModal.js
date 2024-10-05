import React, { useEffect, useState } from "react";
import axios from "axios";

const CustomerOrdersModal = ({ clientId, onClose }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClientOrders = async () => {
      try {
        const response = await axios.get(
          `/api/customer_orders?clientId=${clientId}`
        );
        setOrders(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error al obtener las órdenes del cliente:", error);
        setError("No se pudieron cargar las órdenes del cliente");
        setLoading(false);
      }
    };

    fetchClientOrders();
  }, [clientId]);

  const renderOrder = (order) => {
    return (
      <div key={order.id} className="order-item mb-3 p-3 border rounded">
        <h6>Pedido ID: {order.id}</h6>
        <p>Fecha: {new Date(order.createdAt).toLocaleString()}</p>
        <p>Total: ${order.total.toFixed(2)}</p>
        <p>Estado: {order.status}</p>
      </div>
    );
  };

  return (
    <div className="modal" style={{ display: "block" }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Pedidos del Cliente</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <p>Cargando órdenes...</p>
            ) : error ? (
              <p className="text-danger">{error}</p>
            ) : orders.length === 0 ? (
              <p>Este cliente no tiene órdenes.</p>
            ) : (
              <div className="client-orders">
                {orders.map((order) => renderOrder(order))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerOrdersModal;
