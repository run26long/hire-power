'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
  }, [])

const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      // Check if they've selected a tier
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier_selected')
        .eq('id', user.id)
        .single()

      if (profile?.tier_selected) {
        router.push('/dashboard')
      } else {
        router.push('/choose-plan')
      }
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-purple-600 mb-2">Hire Power</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}