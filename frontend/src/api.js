import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
})

export async function fetchCategories() {
  const { data } = await api.get('/categories')
  return data
}

export async function fetchProducts(categoryId) {
  const params = categoryId ? { category_id: categoryId } : {}
  const { data } = await api.get('/products', { params })
  return data
}

export async function fetchVendors() {
  const { data } = await api.get('/vendors')
  return data
}

export async function assembleOrder(locationId, items) {
  const { data } = await api.post('/orders/assemble', {
    location_id: locationId,
    items,
  })
  return data
}

export const saveOrder = (payload) => api.post('/orders/', payload)
export const getOrders = (period = 'all') => api.get('/orders/', { params: { period } })
export const getOrderSummary = (period = 'all') => api.get('/orders/summary', { params: { period } })
export const getOrderDetail = (id) => api.get(`/orders/${id}`)
export const exportOrdersCsv = (period = 'all') =>
  api.get('/orders/export/csv', { params: { period }, responseType: 'blob' })

export const getParSettings = () => api.get('/par-settings/')
export const upsertParSetting = (productId, parValue) =>
  api.put(`/par-settings/${productId}`, { par_value: parValue })
export const getPendingReviewOrders = () => api.get('/orders/pending-review')
export const approveOrder = (id) => api.post(`/orders/${id}/review`, { review_status: 'approved' })

export default api
