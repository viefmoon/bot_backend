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
      <div key={index} className={`message ${isUser ? "user" : "assistant"}`}>
        <strong>{isUser ? "Usuario" : "Asistente"}:</strong>
        <p>{message.content}</p>
      </div>
    );
  };

  return (
    <div className="modal" style={{ display: "block" }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Historial de Chat</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            {loading ? (
              <p>Cargando historial de chat...</p>
            ) : error ? (
              <p className="text-danger">{error}</p>
            ) : chatHistory.length === 0 ? (
              <p>No hay historial de chat disponible.</p>
            ) : (
              <div className="chat-history">
                {chatHistory.map((message, index) =>
                  renderMessage(message, index)
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHistoryModal;
