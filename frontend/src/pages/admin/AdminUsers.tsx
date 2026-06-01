import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Users, Shield, UserCircle, UserPlus, Search, Loader2 } from 'lucide-react'
import { apiAdmin } from '../../lib/api'
import { AdminPage, Card, Modal, useToast } from '../../components/admin/ui'

type AdminUser = {
  id: number
  name: string
  email: string
  phone?: string
  role: string
  provider?: string
  fidelity_points: number
  orders_count: number
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  employee: 'Employé',
  admin: 'Administrateur',
}

const STAFF_ROLES = ['admin', 'employee'] as const

function AddStaffModal({
  open,
  onClose,
  users,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  users: AdminUser[]
  onSaved: () => void
}) {
  const { notify } = useToast()
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [selectedUserId, setSelectedUserId] = useState('')
  const [promoteRole, setPromoteRole] = useState<'admin' | 'employee'>('admin')
  const [userSearch, setUserSearch] = useState('')

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin' as 'admin' | 'employee',
  })

  const promotableUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return users
      .filter((u) => u.role === 'client')
      .filter((u) => {
        if (!q) return true
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      })
  }, [users, userSearch])

  useEffect(() => {
    if (!open) return
    setMode('existing')
    setError('')
    setSelectedUserId('')
    setPromoteRole('admin')
    setUserSearch('')
    setForm({ name: '', email: '', phone: '', password: '', role: 'admin' })
  }, [open])

  const promoteExisting = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) {
      setError('Sélectionnez un utilisateur.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await apiAdmin(`/users/${selectedUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: promoteRole }),
      })
      notify(`${ROLE_LABELS[promoteRole]} ajouté avec succès`)
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const createNew = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiAdmin('/users', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      notify('Compte staff créé avec succès')
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un administrateur" size="lg">
      <div className="flex gap-2 mb-5 p-1 bg-slate-100 rounded-xl">
        {([
          { id: 'existing' as const, label: 'Utilisateur existant' },
          { id: 'new' as const, label: 'Nouveau compte' },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setMode(tab.id); setError('') }}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
              mode === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'existing' ? (
        <form onSubmit={promoteExisting} className="space-y-4">
          <p className="text-sm text-slate-500">
            Choisissez un client existant et promouvez-le en administrateur ou employé.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Rechercher
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Nom ou email..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Utilisateur *
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
            >
              <option value="">Choisir un client</option>
              {promotableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.email}
                </option>
              ))}
            </select>
            {promotableUsers.length === 0 && (
              <p className="text-xs text-slate-400 mt-1.5">Aucun client trouvé.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Rôle *
            </label>
            <select
              value={promoteRole}
              onChange={(e) => setPromoteRole(e.target.value as 'admin' | 'employee')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
            >
              <option value="admin">Administrateur</option>
              <option value="employee">Employé</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={saving || !selectedUserId}
            className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
            Promouvoir
          </button>
        </form>
      ) : (
        <form onSubmit={createNew} className="space-y-4">
          <p className="text-sm text-slate-500">
            Créez un nouveau compte avec accès au back-office (connexion email / mot de passe).
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Nom *
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Téléphone
              </label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Email *
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Mot de passe * <span className="normal-case font-normal">(min. 8 caractères)</span>
            </label>
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Rôle *
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'employee' }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
            >
              <option value="admin">Administrateur</option>
              <option value="employee">Employé</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            Créer le compte
          </button>
        </form>
      )}
    </Modal>
  )
}

export function AdminUsers() {
  const { notify } = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'staff' | 'client'>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    apiAdmin<{ users: AdminUser[] }>('/users')
      .then((d) => setUsers(d.users))
      .catch(() => notify('Impossible de charger les utilisateurs', 'error'))
      .finally(() => setLoading(false))
  }, [notify])

  useEffect(() => { load() }, [load])

  const staffCount = users.filter((u) => STAFF_ROLES.includes(u.role as typeof STAFF_ROLES[number])).length
  const adminCount = users.filter((u) => u.role === 'admin').length

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter === 'staff' && !STAFF_ROLES.includes(u.role as typeof STAFF_ROLES[number])) return false
      if (filter === 'client' && u.role !== 'client') return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [users, filter, search])

  const updateRole = async (user: AdminUser, role: string) => {
    if (user.role === role) return
    setSavingId(user.id)
    try {
      const data = await apiAdmin<{ user: AdminUser }>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)))
      notify(`Rôle de ${user.name} mis à jour`)
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <AdminPage
      title="Utilisateurs"
      subtitle="Gérez les comptes clients, employés et administrateurs"
      icon={<Users size={22} />}
      actions={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          <UserPlus size={16} />
          Ajouter un admin
        </button>
      }
    >
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total utilisateurs', value: users.length },
          { label: 'Administrateurs', value: adminCount },
          { label: 'Staff (admin + employé)', value: staffCount },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            {([
              { id: 'all' as const, label: 'Tous' },
              { id: 'staff' as const, label: 'Staff' },
              { id: 'client' as const, label: 'Clients' },
            ]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filter === tab.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-300 outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="p-8 text-center text-slate-500">Aucun utilisateur trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Utilisateur</th>
                  <th className="px-5 py-3 font-semibold">Connexion</th>
                  <th className="px-5 py-3 font-semibold">Commandes</th>
                  <th className="px-5 py-3 font-semibold">Points</th>
                  <th className="px-5 py-3 font-semibold">Rôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-brand-100 text-brand-600'
                        }`}>
                          <UserCircle size={20} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate">{user.name}</p>
                          <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {user.provider === 'google_oauth2' ? 'Google' : 'Email'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{user.orders_count}</td>
                    <td className="px-5 py-4 text-slate-600">{user.fidelity_points ?? 0}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-slate-400 flex-shrink-0" />
                        <select
                          value={user.role}
                          disabled={savingId === user.id}
                          onChange={(e) => updateRole(user, e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold bg-white focus:ring-2 focus:ring-brand-300 outline-none"
                        >
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddStaffModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        users={users}
        onSaved={load}
      />
    </AdminPage>
  )
}
