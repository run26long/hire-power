import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { extractText } from 'unpdf'

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
    const { text, totalPages } = await extractText(arrayBuffer, { mergePages: true })
    
    return NextResponse.json({
      text: text,
      pages: totalPages
    })
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}