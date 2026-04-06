import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()
    await redisPool.disconnect(key)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
