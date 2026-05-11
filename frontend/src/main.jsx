import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter, Routes, Route, Outlet } from 'react-router-dom'
import { OrderProvider } from './context/OrderContext'
import { TourContext } from './context/TourContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import TourGuide from './components/TourGuide'
import PINGate from './components/PINGate'
import ToSGate, { isTosAccepted } from './components/ToSGate'
import Home from './pages/Home'
import QuickOrder from './pages/QuickOrder'
import OrderAssembly from './pages/OrderAssembly'
import OrderDetail from './pages/OrderDetail'
import JohnsGlasses from './pages/JohnsGlasses'
import InventoryCount from './pages/InventoryCount'
import RecoverPage from './pages/RecoverPage'
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
    return (
      <Routes>
        <Route path="/recover" element={<RecoverPage />} />
        <Route path="*" element={<PINGate />} />
      </Routes>
    )
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

const isElectron = import.meta.env.MODE === 'electron'
const Router = isElectron ? HashRouter : BrowserRouter
const routerProps = isElectron ? {} : { basename: import.meta.env.BASE_URL }

function Root() {
  const [tosAccepted, setTosAccepted] = useState(isTosAccepted())

  if (!tosAccepted) {
    return <ToSGate onAccept={() => setTosAccepted(true)} />
  }

  return (
    <AuthProvider>
      <Router {...routerProps}>
        <App />
      </Router>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
