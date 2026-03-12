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

export const getOrders = (period = 'all', start = null, end = null) => {
  const params = { period }
  if (period === 'custom' && start && end) {
    params.start = start
    params.end = end
  }
  return api.get('/orders/', { params })
}

export const getOrderSummary = (period = 'all', start = null, end = null) => {
  const params = { period }
  if (period === 'custom' && start && end) {
    params.start = start
    params.end = end
  }
  return api.get('/orders/summary', { params })
}

export const getOrderDetail = (id) => api.get(`/orders/${id}`)

export const exportOrdersCsv = (period = 'all', start = null, end = null) => {
  const params = { period }
  if (period === 'custom' && start && end) {
    params.start = start
    params.end = end
  }
  return api.get('/orders/export/csv', { params, responseType: 'blob' })
}

export const getParSettings = () => api.get('/par-settings/')
export const upsertParSetting = (productId, parValue) =>
  api.put(`/par-settings/${productId}`, { par_value: parValue })

export const getParSettingsWithPrices = () => api.get('/par-settings/with-prices')
export const updateVendorLock = (productId, lockedVendorId) =>
  api.patch(`/par-settings/${productId}/vendor-lock`, { locked_vendor_id: lockedVendorId })
export const updatePrice = (productId, vendorId, price, unit) =>
  api.put(`/prices/product/${productId}/vendor/${vendorId}`, { price, unit })
export const getPendingReviewOrders = () => api.get('/orders/pending-review')
export const approveOrder = (id) => api.post(`/orders/${id}/review`, { review_status: 'approved' })
export const reviewOrder = (id, payload) => api.post(`/orders/${id}/review`, payload)
export const deleteOrder = (id) => api.delete(`/orders/${id}`)
export const patchOrder = (id, payload) => api.patch(`/orders/${id}`, payload)

export const getPendingReviewCount = () =>
  api.get('/orders/pending-review').then((response) => response.data.length)

export const importPrices = (file, vendorId) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/john/import-prices?vendor_id=${vendorId}`, form)
}
export const confirmPrices = (diffs, vendorId) =>
  api.post('/john/confirm-prices', { diffs, vendor_id: vendorId })
export const getPriceAuditLog = () => api.get('/john/price-audit-log')

export const fetchProductsManage = () => api.get('/products', { params: { manage: true } })
export const patchProduct = (id, payload) => api.patch(`/products/${id}`, payload)
export const createProduct = (payload) => api.post('/products/', payload)
export const deleteProductPermanent = (id) => api.delete(`/products/${id}`)

export default api
