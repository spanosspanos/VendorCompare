import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom'
import { OrderProvider } from './context/OrderContext'
import { TourContext } from './context/TourContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ChatProvider } from './context/ChatContext'
import TourGuide from './components/TourGuide'
import PINGate from './components/PINGate'
import ToSGate, { isTosAccepted } from './components/ToSGate'
import Home from './pages/Home'
import ChatPage from './pages/ChatPage'
import ModelDownloadScreen from './pages/ModelDownloadScreen'
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

// Model gate: on first render (in Electron), check if model is present.
// If not, redirect to /setup. Once /setup completes it navigates to /.
function ModelGate({ children }) {
  const [modelReady, setModelReady] = useState(null) // null=checking, true=ready, false=needs download
  const location = useLocation()

  useEffect(() => {
    // Only gate in Electron (window.electronAPI present) and not already on /setup
    if (!window.electronAPI || location.pathname === '/setup') {
      setModelReady(true)
      return
    }
    window.electronAPI.checkModel('qwen2.5:7b').then((exists) => {
      setModelReady(exists)
    }).catch(() => {
      // On error, don't block — let the app start
      setModelReady(true)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (modelReady === null) {
    // Brief checking state — show blank bg while we wait for IPC
    return <div className="min-h-screen bg-[#0E1214]" />
  }

  if (modelReady === false) {
    return <Navigate to="/setup" replace />
  }

  return children
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
        <Route path="/setup" element={<ModelDownloadScreen />} />
        {import.meta.env.VITE_EDITION === "mcp" ? <Route path="/" element={<Home />} /> : <Route path="/" element={<ModelGate><ChatPage /></ModelGate>} />}
        <Route path="/manual" element={<Home />} />
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
      <ChatProvider>
        <Router {...routerProps}>
          <App />
        </Router>
      </ChatProvider>
    </AuthProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
