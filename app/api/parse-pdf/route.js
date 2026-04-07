import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { extractText } from 'unpdf'
import mammoth from 'mammoth'

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    if (token !== process.env.INTERNAL_API_SECRET) {
      const { createClient: createAuthClient } = await import('@supabase/supabase-js')
      const authSupabase = createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: { user }, error: authError } = await authSupabase.auth.getUser(token)
      if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filePath } = await request.json()
    const supabase = await createClient()
    
    const { data, error } = await supabase.storage
      .from('resumes')
      .download(filePath)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    const arrayBuffer = await data.arrayBuffer()
    
    // Check file type
    const isDocx = filePath.toLowerCase().endsWith('.docx')
    
   if (isDocx) {
      // Parse DOCX - mammoth needs a Buffer
      const buffer = Buffer.from(arrayBuffer)
      
      // Extract main body text
      const textResult = await mammoth.extractRawText({ buffer })
      
      // Also convert to HTML to try capturing headers/footers
      const htmlResult = await mammoth.convertToHtml({ 
        buffer,
        includeDefaultStyleMap: false,
        includeEmbeddedStyleMap: false
      })
      
      // Strip HTML tags to get plain text (may include some header/footer content)
      const htmlText = htmlResult.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      
      // Use the longer/more complete text
      const finalText = htmlText.length > textResult.value.length ? htmlText : textResult.value
      
      return NextResponse.json({
        text: finalText,
        pages: 1
      })
    } else {
      // Parse PDF
      const { text, totalPages } = await extractText(arrayBuffer, { mergePages: true })
      return NextResponse.json({
        text: text,
        pages: totalPages
      })
    }
    
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}