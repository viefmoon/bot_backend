import React from "react";

const OrderCard = ({ order }) => {
    // Implementa la lógica de renderizado del pedido aquí
    return (
        <div className="col-md-6 col-lg-4 mb-3">
            <div className="card order-card">
                <div className="card-body">
                    <h5 className="card-title">
                        Pedido #{order.dailyOrderNumber}
                    </h5>
                    <p className="card-text">
                        Tipo: {translateOrderType(order.orderType)}
                    </p>
                    <p className="card-text">
                        ID del Cliente: {order.clientId}
                    </p>
                    <p className="card-text">
                        Info de Entrega: {order.deliveryInfo || "N/A"}
                    </p>
                    <p className="card-text">
                        Tiempo Estimado de Entrega: {order.estimatedTime}{" "}
                        minutos
                    </p>
                    <p className="card-text">
                        Total: ${order.totalCost.toFixed(2)}
                    </p>
                    <p className="card-text">
                        Estado:{" "}
                        <span
                            className={`badge bg-${getStatusColor(order.status)}`}
                        >
                            {translateStatus(order.status)}
                        </span>
                    </p>
                    <p className="card-text">
                        Pago:{" "}
                        <span
                            className={`badge bg-${getPaymentStatusColor(order.paymentStatus)}`}
                        >
                            {translatePaymentStatus(order.paymentStatus)}
                        </span>
                    </p>
                    <p className="card-text">
                        <small className="text-muted">
                            Creado: {formatDateToMexicoTime(order.createdAt)}
                        </small>
                    </p>
                    <p className="card-text">
                        <small className="text-muted">
                            Actualizado:{" "}
                            {formatDateToMexicoTime(order.updatedAt)}
                        </small>
                    </p>
                    {/* Implementa la lógica de los items del pedido y botones aquí */}
                </div>
            </div>
        </div>
    );
};

export default OrderCard;
