import { createContext, useContext, useState } from 'react'

const OrderContext = createContext()

export function OrderProvider({ children }) {
  const [selectedItems, setSelectedItems] = useState({})
  // shape: { [product_id]: { product_id, product_name, quantity } }

  const toggleItem = (product) => {
    setSelectedItems((prev) => {
      if (prev[product.id]) {
        const next = { ...prev }
        delete next[product.id]
        return next
      }
      return {
        ...prev,
        [product.id]: { product_id: product.id, product_name: product.name, quantity: 1 },
      }
    })
  }

  const updateQuantity = (productId, quantity) => {
    setSelectedItems((prev) => {
      if (!prev[productId]) return prev
      return {
        ...prev,
        [productId]: { ...prev[productId], quantity },
      }
    })
  }

  const upsertItem = (product) => {
    setSelectedItems((prev) => ({
      ...prev,
      [product.id]: { product_id: product.id, product_name: product.name, quantity: product.quantity },
    }))
  }

  const removeItem = (productId) => {
    setSelectedItems((prev) => {
      const next = { ...prev }
      delete next[productId]
      return next
    })
  }

  const clearAll = () => setSelectedItems({})

  const getItemsArray = () =>
    Object.values(selectedItems).map(({ product_id, quantity }) => ({
      product_id,
      quantity,
    }))

  return (
    <OrderContext.Provider
      value={{ selectedItems, toggleItem, updateQuantity, upsertItem, removeItem, clearAll, getItemsArray }}
    >
      {children}
    </OrderContext.Provider>
  )
}

export const useOrder = () => useContext(OrderContext)
