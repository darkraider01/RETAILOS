import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@/App.css';
import Dashboard from '@/pages/Dashboard.jsx';
import Inventory from '@/pages/Inventory.jsx';
import Forecast from '@/pages/Forecast.jsx';
import Delivery from '@/pages/Delivery.jsx';
import VirtualTryOn from '@/pages/VirtualTryOn.jsx';
import Blockchain from '@/pages/Blockchain.jsx';
import RoleSelection from '@/components/RoleSelection.jsx';
import Layout from '@/components/Layout.jsx';


function App() {
  const [user, setUser] = useState({ full_name: 'Guest', role: 'customer' }); // Default role

  const handleSelectRole = (selectedUser) => {
    setUser(selectedUser);
  };

  return (
    <div className="App">
      <BrowserRouter>
        <Layout user={user} onSelectRole={handleSelectRole}>
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/dashboard" element={<Dashboard user={user} />} />
            <Route path="/inventory" element={<Inventory user={user} />} />
            <Route path="/forecast" element={<Forecast user={user} />} />
            <Route path="/delivery" element={<Delivery user={user} />} />
            <Route path="/try-on" element={<VirtualTryOn user={user} />} />
            <Route path="/blockchain" element={<Blockchain user={user} />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </div>
  );
}

export default App;