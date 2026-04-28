import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { extractText } from 'unpdf'
import mammoth from 'mammoth'
import { apiError } from '@/lib/apiError'

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
      return apiError(error, "We couldn't open that file. Try uploading it again.", 400)
    }
    
    const arrayBuffer = await data.arrayBuffer()
    
    // Server-side file size limit (10MB) — protects against direct API calls that bypass client check
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "That file's too large. Please upload a file under 10MB." },
        { status: 413 }
      )
    }
    
    // Check file type
    const isDocx = filePath.toLowerCase().endsWith('.docx')
    
   if (isDocx) {
      // Parse DOCX - mammoth needs a Buffer
      const buffer = Buffer.from(arrayBuffer)
      
      let textResult, htmlResult
      try {
        // Extract main body text
        textResult = await mammoth.extractRawText({ buffer })
        
        // Also convert to HTML to try capturing headers/footers
        htmlResult = await mammoth.convertToHtml({ 
          buffer,
          includeDefaultStyleMap: false,
          includeEmbeddedStyleMap: false
        })
      } catch (parseErr) {
        console.error('DOCX parse error:', parseErr)
        return NextResponse.json(
          { error: "We couldn't read that Word doc. The file might be corrupted or password-protected. Try saving it again or upload a different copy." },
          { status: 422 }
        )
      }
      
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
      let text, totalPages
      try {
        const result = await extractText(arrayBuffer, { mergePages: true })
        text = result.text
        totalPages = result.totalPages
      } catch (parseErr) {
        console.error('PDF parse error:', parseErr)
        return NextResponse.json(
          { error: "We couldn't read that PDF. The file might be corrupted, scanned, or password-protected. Try saving it as a new PDF or upload a different version." },
          { status: 422 }
        )
      }
      return NextResponse.json({
        text: text,
        pages: totalPages
      })
    }
    
  } catch (error) {
    return apiError(error, "We couldn't read that file. Make sure it's a PDF or Word doc and try again.")
  }
}