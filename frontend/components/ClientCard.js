import React from "react";

const ClientCard = ({ client }) => {
    // Implementa la lógica de renderizado del cliente aquí
    return (
        <div className="col-md-6 col-lg-4 mb-3">
            <div className="card client-card">
                <div className="card-body">
                    <h5 className="card-title">
                        Cliente ID: {client.clientId}
                    </h5>
                    <p className="card-text">
                        Información de entrega: {client.deliveryInfo || "N/A"}
                    </p>
                    <p className="card-text">
                        Stripe Customer ID: {client.stripeCustomerId || "N/A"}
                    </p>
                    <p className="card-text">
                        Última interacción:{" "}
                        {formatDateToMexicoTime(client.lastInteraction)}
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
                    {/* Implementa la lógica de los botones aquí */}
                </div>
            </div>
        </div>
    );
};

export default ClientCard;
