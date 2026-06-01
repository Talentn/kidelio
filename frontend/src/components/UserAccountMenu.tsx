import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Package,
  User,
  UserCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type UserAccountMenuProps = {
  variant?: 'header' | 'mobile'
  align?: 'left' | 'right'
  onNavigate?: () => void
}

export function UserAccountMenu({ variant = 'header', align = 'right', onNavigate }: UserAccountMenuProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const isStaff = user?.role === 'admin' || user?.role === 'employee'

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const close = () => {
    setOpen(false)
    onNavigate?.()
  }

  const handleLogout = () => {
    logout()
    close()
    navigate('/')
  }

  if (!user) {
    return (
      <Link
        to="/connexion"
        onClick={onNavigate}
        className={`inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-brand-600 transition-colors ${
          variant === 'header' ? 'px-3 py-2 rounded-full hover:bg-gray-100 text-sm' : 'px-4 py-3 rounded-xl hover:bg-brand-50 w-full'
        }`}
      >
        <User size={variant === 'header' ? 16 : 18} />
        Connexion
      </Link>
    )
  }

  return (
    <div ref={ref} className={variant === 'mobile' ? 'w-full' : 'relative'}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
          variant === 'header'
            ? `px-3 py-2 rounded-full text-sm max-w-[10rem] ${
                open ? 'bg-brand-100 text-brand-700' : 'text-gray-700 hover:bg-gray-100'
              }`
            : `w-full justify-between px-4 py-3 rounded-xl text-gray-700 hover:bg-brand-50 ${
                open ? 'bg-brand-50 text-brand-700' : ''
              }`
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <UserCircle size={variant === 'header' ? 18 : 20} className="text-brand-500 flex-shrink-0" />
        <span className="truncate">{user.name}</span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 transition-transform text-gray-400 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className={
            variant === 'header'
              ? `absolute top-full mt-2 w-56 rounded-2xl border border-gray-100 bg-white shadow-xl z-[100] py-2 animate-fade-in ${
                  align === 'right' ? 'right-0 left-auto' : 'left-0'
                }`
              : 'mt-1 mx-2 rounded-xl border border-gray-100 bg-white shadow-lg py-2 animate-fade-in'
          }
        >
          <Link
            to="/compte"
            onClick={close}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700"
          >
            <User size={16} />
            Mon compte
          </Link>
          <Link
            to="/suivi"
            onClick={close}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700"
          >
            <Package size={16} />
            Suivre ma commande
          </Link>

          {isStaff && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <Link
                to="/admin"
                onClick={close}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                <LayoutDashboard size={16} />
                Tableau de bord
              </Link>
              <Link
                to="/admin/commandes"
                onClick={close}
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-brand-50 hover:text-brand-700"
              >
                <Package size={16} />
                Commandes
              </Link>
            </>
          )}

          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  )
}
