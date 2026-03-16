import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'

function authHeaders() {
  const token = localStorage.getItem('vc_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function RecoveryCodePanel() {
  const [maskedCode, setMaskedCode] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    api.get('/auth/recovery-code-hint', { headers: authHeaders() })
      .then(res => setMaskedCode(res.data.full_code))
      .catch(() => setLoadError('Could not load recovery code hint.'))
  }, [])

  const baseUrl = window.location.origin + window.location.pathname.replace(/\/$/, '')

  return (
    <div className="mt-8 pt-6 border-t border-gray-700">
      <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Recovery Code (Skeleton Key)</h3>
      {loadError ? (
        <p className="text-red-400 text-sm">{loadError}</p>
      ) : (
        <div className="bg-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-gray-300 text-sm font-mono tracking-widest">
              {maskedCode || '????????'}
            </span>
          </div>
          <p className="text-gray-500 text-xs mb-1">Write this down — needed if you're locked out.</p>
          <p className="text-gray-600 text-xs">To use: go to <span className="font-mono text-gray-400">{baseUrl}/#/recover</span></p>
        </div>
      )}
    </div>
  )
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Edit state
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  // Add form state
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [role, setRole] = useState('user')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [addSuccess, setAddSuccess] = useState(false)

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/employees/', { headers: authHeaders() })
      setEmployees(res.data)
    } catch (err) {
      setError('Failed to load employees.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError(null)
    setAddSuccess(false)

    if (!name.trim()) {
      setAddError('Name is required.')
      return
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setAddError('PIN must be 4–6 digits.')
      return
    }

    setAdding(true)
    try {
      await api.post('/employees/', { name: name.trim(), pin, role }, { headers: authHeaders() })
      setName('')
      setPin('')
      setRole('user')
      setAddSuccess(true)
      fetchEmployees()
      setTimeout(() => setAddSuccess(false), 3000)
    } catch (err) {
      if (err.response?.status === 409) {
        setAddError('PIN already in use. Choose a different PIN.')
      } else if (err.response?.data?.detail) {
        setAddError(err.response.data.detail)
      } else {
        setAddError('Failed to add employee.')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete employee "${emp.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/employees/${emp.id}`, { headers: authHeaders() })
      setEmployees((prev) => prev.filter((e) => e.id !== emp.id))
    } catch (err) {
      alert('Failed to delete employee.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Employee List */}
      <div>
        <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-widest mb-3">
          Employees
        </h2>

        {loading && (
          <p className="text-[#8A9099] text-sm">Loading…</p>
        )}
        {error && (
          <p className="text-[#C23B3B] text-sm">{error}</p>
        )}
        {!loading && !error && (
          <div className="rounded-2xl overflow-hidden border border-[#2A343C]">
            {employees.length === 0 ? (
              <p className="text-[#8A9099] text-sm px-4 py-3">No employees found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1A242C] text-[#8A9099] text-xs uppercase tracking-wider">
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">Role</th>
                    <th className="px-4 py-2 text-left font-medium">PIN</th>
                    <th className="px-4 py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, idx) => (
                    <tr
                      key={emp.id}
                      className={`border-t border-[#2A343C] ${idx % 2 === 0 ? 'bg-[#0E1214]' : 'bg-[#131C22]'}`}
                    >
                      <td className="px-4 py-3 text-[#F0EDE8] font-medium">{emp.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          emp.role === 'admin'
                            ? 'bg-[#D4A017]/15 text-[#D4A017]'
                            : 'bg-[#00C0C8]/15 text-[#00C0C8]'
                        }`}>
                          {emp.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#8A9099] font-mono text-xs tracking-widest">
                        ••••••
                      </td>
                      <td className="px-4 py-3 text-right">
                        {emp.id !== 1 ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingId(emp.id)
                                setEditForm({ name: emp.name, pin: '', role: emp.role })
                                setEditError(null)
                              }}
                              className="text-xs text-[#00C0C8] hover:text-[#F0EDE8] font-medium px-2 py-1 rounded transition-colors"
                            >
                              ✎ Edit
                            </button>
                            <button
                              onClick={() => handleDelete(emp)}
                              className="text-xs text-[#C23B3B] hover:text-red-400 font-medium px-2 py-1 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-[#8A9099]/50 italic">seeded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {editingId && (
              <div className="border-t border-[#2A343C] bg-[#1A2025] px-4 py-3 space-y-3">
                <p className="text-xs font-semibold text-[#00C0C8] uppercase tracking-widest">
                  Editing: {employees.find(e => e.id === editingId)?.name}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-[#8A9099] mb-1">Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm focus:outline-none focus:border-[#00C0C8]/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A9099] mb-1">New PIN (optional)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={editForm.pin}
                      onChange={e => setEditForm(f => ({ ...f, pin: e.target.value.replace(/\D/g,'').slice(0,6) }))}
                      placeholder="Leave blank to keep"
                      className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm font-mono tracking-widest focus:outline-none focus:border-[#00C0C8]/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A9099] mb-1">Role</label>
                    <select
                      value={editForm.role}
                      onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm focus:outline-none focus:border-[#00C0C8]/60"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                {editError && <p className="text-sm text-[#C23B3B]">{editError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingId(null); setEditError(null) }}
                    className="text-sm text-[#8A9099] px-3 py-1.5 border border-[#2A343C] rounded-lg"
                  >Cancel</button>
                  <button
                    onClick={async () => {
                      setEditSaving(true)
                      setEditError(null)
                      try {
                        const payload = {}
                        if (editForm.name?.trim()) payload.name = editForm.name.trim()
                        if (editForm.pin?.length >= 4) payload.pin = editForm.pin
                        payload.role = editForm.role
                        await api.patch(`/employees/${editingId}`, payload, { headers: authHeaders() })
                        setEditingId(null)
                        fetchEmployees()
                      } catch(err) {
                        if (err.response?.status === 409) setEditError('PIN already in use.')
                        else setEditError(err.response?.data?.detail || 'Save failed.')
                      } finally {
                        setEditSaving(false)
                      }
                    }}
                    disabled={editSaving}
                    className="text-sm bg-[#00C0C8] text-[#0E1214] font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Employee Form */}
      <div>
        <h2 className="text-sm font-semibold text-[#D4A017] uppercase tracking-widest mb-3">
          Add Employee
        </h2>
        <form onSubmit={handleAdd} className="rounded-2xl border border-[#2A343C] bg-[#131C22] p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Name */}
            <div className="sm:col-span-1">
              <label className="block text-xs text-[#8A9099] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John"
                className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm placeholder-[#8A9099]/50 focus:outline-none focus:border-[#D4A017]/60"
              />
            </div>

            {/* PIN */}
            <div>
              <label className="block text-xs text-[#8A9099] mb-1">PIN (4–6 digits)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="e.g. 1234"
                className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm placeholder-[#8A9099]/50 focus:outline-none focus:border-[#D4A017]/60 font-mono tracking-widest"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs text-[#8A9099] mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#0E1214] border border-[#2A343C] rounded-lg px-3 py-2 text-[#F0EDE8] text-sm focus:outline-none focus:border-[#D4A017]/60"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {addError && (
            <p className="text-sm text-[#C23B3B]">{addError}</p>
          )}
          {addSuccess && (
            <p className="text-sm text-[#00C0C8]">Employee added ✓</p>
          )}

          <button
            type="submit"
            disabled={adding}
            className="w-full sm:w-auto bg-[#D4A017] text-[#0E1214] font-semibold text-sm px-5 py-2 rounded-xl hover:bg-[#E6B51F] transition-colors disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add Employee'}
          </button>
        </form>
      </div>

      <RecoveryCodePanel />
    </div>
  )
}
