import { Routes, Route } from 'react-router-dom';
import AddressRegistration from './components/AddressRegistration';

function Router() {
  return (
    <Routes>
      <Route path="/" element={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Sistema de Registro de Direcciones</h1>
            <p className="text-gray-600">Para registrar tu dirección, accede a través del enlace proporcionado por WhatsApp.</p>
          </div>
        </div>
      } />
      <Route path="/address-registration/:customerId" element={<AddressRegistration />} />
    </Routes>
  );
}

export default Router;