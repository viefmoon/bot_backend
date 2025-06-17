import { Routes, Route } from 'react-router-dom';
import AddressRegistration from './AddressRegistration';

function Router() {
  return (
    <Routes>
      <Route path="/" element={<div>Welcome</div>} />
      <Route path="/address-registration/:customerId" element={<AddressRegistration />} />
    </Routes>
  );
}

export default Router;