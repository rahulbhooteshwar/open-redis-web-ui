import { NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'

export async function POST() {
  try {
    await redisPool.disconnectAll()
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
