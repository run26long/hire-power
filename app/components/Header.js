'use client'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/dashboard')
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/resume-coach', label: 'My Resumes' },
    { href: '/profile', label: 'Profile' }
  ]

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xl font-bold text-purple-600 hover:text-purple-700 transition-colors"
          >
            Hire Power
          </button>
          
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'text-purple-600'
                    : 'text-gray-600 hover:text-purple-600'
                }`}
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
