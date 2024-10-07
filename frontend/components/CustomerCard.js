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
    <div className="bg-white shadow-sm rounded-lg overflow-hidden mb-4">
      <div className="p-4">
        <h5 className="text-lg font-semibold mb-2">
          Cliente ID: {client.clientId}
        </h5>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Nombre: {client.customerDeliveryInfo?.pickupName || "N/A"}</p>
          <p>Dirección de entrega: {client.customerDeliveryInfo?.streetAddress || "N/A"}</p>
          <p>Stripe ID: {client.stripeCustomerId || "N/A"}</p>
          <p>
            Última interacción: {formatDateToMexicoTime(client.lastInteraction)}
          </p>
          <p>Creado: {formatDateToMexicoTime(client.createdAt)}</p>
        </div>
        <div className="mt-2 flex items-center">
          <span className="text-sm mr-2">Estado:</span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              isBanned
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {isBanned ? "Baneado" : "Activo"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            onClick={toggleChatHistoryModal}
          >
            Chat
          </button>
          <button
            className="px-3 py-1 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600"
            onClick={toggleCustomerOrdersModal}
          >
            Pedidos
          </button>
          <button
            className={`px-3 py-1 text-white text-sm rounded ${
              isBanned
                ? "bg-green-500 hover:bg-green-600"
                : "bg-yellow-500 hover:bg-yellow-600"
            }`}
            onClick={handleToggleBan}
          >
            {isBanned ? "Desbanear" : "Banear"}
          </button>
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
