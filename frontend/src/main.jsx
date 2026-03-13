import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { OrderProvider } from './context/OrderContext'
import { TourContext } from './context/TourContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import TourGuide from './components/TourGuide'
import PINGate from './components/PINGate'
import Home from './pages/Home'
import QuickOrder from './pages/QuickOrder'
import OrderAssembly from './pages/OrderAssembly'
import OrderDetail from './pages/OrderDetail'
import JohnsGlasses from './pages/JohnsGlasses'
import InventoryCount from './pages/InventoryCount'
import './index.css'

function OrderLayout() {
  return (
    <OrderProvider>
      <Outlet />
    </OrderProvider>
  )
}

function App() {
  const [tourRunning, setTourRunning] = useState(false)
  const { token, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!token) {
    return <PINGate />
  }

  return (
    <TourContext.Provider value={{
      tourRunning,
      startTour: () => setTourRunning(true),
      stopTour: () => setTourRunning(false),
    }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<OrderLayout />}>
          <Route path="/quick-order" element={<QuickOrder />} />
          <Route path="/inventory-count" element={<InventoryCount />} />
          <Route path="/order-assembly" element={<OrderAssembly />} />
        </Route>
        <Route path="/history/:id" element={<OrderDetail />} />
        {role === 'admin' && <Route path="/glasses" element={<JohnsGlasses />} />}
      </Routes>
      <TourGuide run={tourRunning} onStop={() => setTourRunning(false)} />
    </TourContext.Provider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)
