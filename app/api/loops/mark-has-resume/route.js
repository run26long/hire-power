import { NextResponse } from 'next/server'
import { markUserHasResume } from '@/lib/loops/markUserHasResume'

export async function POST(request) {
  try {
    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
    await markUserHasResume(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('mark-has-resume error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}