import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { extractText } from 'unpdf'
import mammoth from 'mammoth'

export async function POST(request) {
  try {
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
      const result = await mammoth.extractRawText({ buffer })
      return NextResponse.json({
        text: result.value,
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