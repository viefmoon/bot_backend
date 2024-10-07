import React, { useEffect, useState } from "react";
import axios from "axios";

const ChatHistoryModal = ({ clientId, onClose }) => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        const response = await axios.get(
          `/api/customer_chat_history?clientId=${clientId}`
        );
        setChatHistory(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error al obtener el historial de chat:", error);
        setError("No se pudo cargar el historial de chat");
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [clientId]);

  const renderMessage = (message, index) => {
    const isUser = message.role === "user";
    return (
      <div
        key={index}
        className={`message ${
          isUser ? "bg-blue-100" : "bg-gray-100"
        } p-3 rounded-lg mb-2`}
      >
        <div className="flex justify-between items-center mb-2">
          <strong className={`${isUser ? "text-blue-600" : "text-gray-600"}`}>
            {isUser ? "Usuario" : "Asistente"}
          </strong>
          <span className="text-xs text-gray-500">
            {new Date(message.timestamp).toLocaleString()}
          </span>
        </div>
        <p>{message.content}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b">
          <h5 className="text-xl font-semibold">Historial de Chat</h5>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {loading ? (
            <p className="text-center">Cargando historial de chat...</p>
          ) : error ? (
            <p className="text-center text-red-500">{error}</p>
          ) : chatHistory.length === 0 ? (
            <p className="text-center">No hay historial de chat disponible.</p>
          ) : (
            <div className="space-y-2">
              {chatHistory.map((message, index) =>
                renderMessage(message, index)
              )}
            </div>
          )}
        </div>
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-300"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHistoryModal;
