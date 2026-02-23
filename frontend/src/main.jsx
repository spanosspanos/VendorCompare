import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { OrderProvider } from './context/OrderContext'
import Home from './pages/Home'
import OrderAssembly from './pages/OrderAssembly'
import OrderHistory from './pages/OrderHistory'
import OrderDetail from './pages/OrderDetail'
import JohnsGlasses from './pages/JohnsGlasses'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <OrderProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/order-assembly" element={<OrderAssembly />} />
          <Route path="/history" element={<OrderHistory />} />
          <Route path="/history/:id" element={<OrderDetail />} />
          <Route path="/glasses" element={<JohnsGlasses />} />
        </Routes>
      </OrderProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
