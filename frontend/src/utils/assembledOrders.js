const ASSEMBLED_ORDERS_KEY = 'vc_assembled_orders'

export const getAssembledOrders = () => {
  try {
    return JSON.parse(localStorage.getItem(ASSEMBLED_ORDERS_KEY) || '[]')
  } catch { return [] }
}

export const saveAssembledOrder = (order) => {
  const orders = getAssembledOrders()
  orders.push(order)
  localStorage.setItem(ASSEMBLED_ORDERS_KEY, JSON.stringify(orders))
}

export const removeAssembledOrder = (id) => {
  const orders = getAssembledOrders().filter((o) => o.id !== id)
  localStorage.setItem(ASSEMBLED_ORDERS_KEY, JSON.stringify(orders))
}

export const countAssembledOrders = () => getAssembledOrders().length
