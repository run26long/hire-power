import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@supabase/supabase-js'
import ReviewPrepPDF from '../../templates/pdf/ReviewPrepPDF'
import { apiError } from '@/lib/apiError'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')

    const { createClient: createAuthClient } = await import('@supabase/supabase-js')
    const authSupabase = createAuthClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { documentText, fileName, userId } = await request.json()

    const element = React.createElement(ReviewPrepPDF, { documentText })
    const pdfBuffer = await renderToBuffer(element)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const uploadPath = `${userId}/review-prep/review_prep_${timestamp}.pdf`

    const { error: uploadError } = await supabase.storage
      .from('resume-pdfs')
      .upload(uploadPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('resume-pdfs')
      .getPublicUrl(uploadPath)

    if (!publicUrl) {
      return apiError(
        new Error(`getPublicUrl returned empty for ${uploadPath}`),
        "We couldn't save your review prep. Please try again."
      )
    }

    return Response.json({ success: true, pdfUrl: publicUrl })

  } catch (error) {
    return apiError(error, "We couldn't generate your review prep PDF. Please try again.")
  }
}