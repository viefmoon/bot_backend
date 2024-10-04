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
    <div className="bg-white shadow-md rounded-lg overflow-hidden mb-4">
      <div className="p-4">
        <h5 className="text-xl font-semibold mb-2">
          Cliente ID: {client.clientId}
        </h5>
        <p className="text-gray-600 mb-1">
          Información de entrega: {client.deliveryInfo || "N/A"}
        </p>
        <p className="text-gray-600 mb-1">
          Stripe Customer ID: {client.stripeCustomerId || "N/A"}
        </p>
        <p className="text-gray-600 mb-1">
          Última interacción: {formatDateToMexicoTime(client.lastInteraction)}
        </p>
        <p className="text-gray-600 mb-1">
          <small>Creado: {formatDateToMexicoTime(client.createdAt)}</small>
        </p>
        <p className="text-gray-600 mb-1">
          Estado:
          <span
            className={`ml-2 px-2 py-1 rounded-full text-xs ${
              isBanned
                ? "bg-red-100 text-red-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {isBanned ? "Baneado" : "Activo"}
          </span>
        </p>
        <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            className="w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={toggleChatHistoryModal}
          >
            Ver historial de chat
          </button>
          <button
            className="w-full sm:w-auto px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
            onClick={toggleCustomerOrdersModal}
          >
            Ver pedidos
          </button>
          <button
            className={`w-full sm:w-auto px-4 py-2 ${
              isBanned
                ? "bg-green-500 hover:bg-green-600"
                : "bg-yellow-500 hover:bg-yellow-600"
            } text-white rounded`}
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
