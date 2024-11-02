export default function PaymentSuccess() {
  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md mx-auto">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-3xl font-bold text-green-600 mb-4">
          ¡Pago Exitoso!
        </h1>
        <p className="text-gray-600 mb-6">
          Tu pago ha sido procesado correctamente. Recibirás una confirmación
          por WhatsApp.
        </p>
        <button
          onClick={handleClose}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 shadow-sm"
        >
          Cerrar Ventana
        </button>
      </div>
    </div>
  );
}
