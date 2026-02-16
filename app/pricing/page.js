'use client'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
<div className="max-w-4xl mx-auto px-4 py-16">
        
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Upgrade to Full Access</h1>
          <p className="text-xl text-gray-600">
            Unlock professional coaching and job customization
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-purple-600 mb-2">$29.99</div>
            <div className="text-gray-600">per month</div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <div className="font-semibold">Professional Resume Coaching</div>
                <div className="text-sm text-gray-600">Extract achievements you didn't know you had</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <div className="font-semibold">One-Click Job Customization</div>
                <div className="text-sm text-gray-600">Tailor your resume in 3 minutes (83% higher success rate)</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <div className="font-semibold">Unlimited Downloads & Templates</div>
                <div className="text-sm text-gray-600">No limits on PDFs or template access</div>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl">✓</span>
              <div>
                <div className="font-semibold">ATS Match Scoring</div>
                <div className="text-sm text-gray-600">See exactly how your resume matches each job</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => alert('Payment integration coming in Phase 5!')}
            className="w-full bg-purple-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-purple-700 transition-colors mb-4"
          >
            Upgrade Now
          </button>

         <button
            onClick={() => router.back()}
            className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  )
}