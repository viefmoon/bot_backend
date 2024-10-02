import React, { useState } from "react";
import { formatDateToMexicoTime } from "../utils/dateUtils";
import ChatHistoryModal from "./ChatHistoryModal";
import CustomerOrdersModal from "./CustomerOrdersModal";

const CustomerCard = ({ client, onToggleBan }) => {
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showCustomerOrders, setShowCustomerOrders] = useState(false);
  const [isBanned, setIsBanned] = useState(client.isBanned);

  const toggleChatHistoryModal = () => {
    setShowChatHistory(!showChatHistory);
  };

  const toggleCustomerOrdersModal = () => {
    setShowCustomerOrders(!showCustomerOrders);
  };

  const handleToggleBan = async () => {
    try {
      const action = isBanned ? "unban" : "ban";
      const response = await fetch("/api/toggle_customer_ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: client.clientId, action }),
      });

      if (!response.ok) {
        throw new Error("Error al cambiar el estado de ban del cliente");
      }

      setIsBanned(!isBanned);
      onToggleBan(client.clientId, !isBanned);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="col-md-6 col-lg-4 mb-3">
      <div className="card client-card">
        <div className="card-body">
          <h5 className="card-title">Cliente ID: {client.clientId}</h5>
          <p className="card-text">
            Información de entrega: {client.deliveryInfo || "N/A"}
          </p>
          <p className="card-text">
            Stripe Customer ID: {client.stripeCustomerId || "N/A"}
          </p>
          <p className="card-text">
            Última interacción: {formatDateToMexicoTime(client.lastInteraction)}
          </p>
          <p className="card-text">
            <small className="text-muted">
              Creado: {formatDateToMexicoTime(client.createdAt)}
            </small>
          </p>
          <p className="card-text">
            Estado:{" "}
            <span className={`badge bg-${isBanned ? "danger" : "success"}`}>
              {isBanned ? "Baneado" : "Activo"}
            </span>
          </p>
          <div className="mt-3">
            <button
              className="btn btn-primary btn-sm me-2"
              onClick={toggleChatHistoryModal}
            >
              Ver historial de chat
            </button>
            <button
              className="btn btn-info btn-sm me-2"
              onClick={toggleCustomerOrdersModal}
            >
              Ver pedidos
            </button>
            <button
              className={`btn btn-${isBanned ? "success" : "warning"} btn-sm`}
              onClick={handleToggleBan}
            >
              {isBanned ? "Desbanear" : "Banear"}
            </button>
          </div>
        </div>
      </div>
      {showChatHistory && (
        <ChatHistoryModal
          clientId={client.clientId}
          onClose={toggleChatHistoryModal}
        />
      )}
      {showCustomerOrders && (
        <CustomerOrdersModal
          clientId={client.clientId}
          onClose={toggleCustomerOrdersModal}
        />
      )}
    </div>
  );
};

export default CustomerCard;
