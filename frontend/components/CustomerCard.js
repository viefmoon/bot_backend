import React, { useState } from "react";
import { formatDateToMexicoTime } from "../utils/dateUtils"; // Asegúrate de crear este archivo de utilidades
import ChatHistoryModal from "./ChatHistoryModal";
import CustomerOrdersModal from "./CustomerOrdersModal";

const CustomerCard = ({ client, onToggleBan }) => {
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showCustomerOrders, setShowCustomerOrders] = useState(false);

  const toggleChatHistoryModal = () => {
    setShowChatHistory(!showChatHistory);
  };

  const toggleCustomerOrdersModal = () => {
    setShowCustomerOrders(!showCustomerOrders);
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
            <span
              className={`badge bg-${client.isBanned ? "danger" : "success"}`}
            >
              {client.isBanned ? "Baneado" : "Activo"}
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
              className={`btn btn-${
                client.isBanned ? "success" : "warning"
              } btn-sm`}
              onClick={() => onToggleBan(client.clientId, client.isBanned)}
            >
              {client.isBanned ? "Desbanear" : "Banear"}
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
