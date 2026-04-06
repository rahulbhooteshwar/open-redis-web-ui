import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'

export async function POST(req: NextRequest) {
  try {
    const config = await req.json()
    const key = await redisPool.connect(config)
    return NextResponse.json({ key })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
