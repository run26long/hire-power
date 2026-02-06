import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request) {
  try {
    const { resumeText, conversation } = await request.json()
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: conversation
    })
    
    return NextResponse.json({
      response: message.content[0].text
    })
    
  } catch (error) {
    console.error('Claude API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}