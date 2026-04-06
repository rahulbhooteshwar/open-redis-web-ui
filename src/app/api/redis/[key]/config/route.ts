import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(req.url)
    const pattern = searchParams.get('pattern') || '*'
    const client = redisPool.getClient(key) as Redis
    const config = await (client as any).config('get', pattern)
    return NextResponse.json({ config })
  } catch (e: any) {
    if (e.message?.includes('unknown command')) {
      return NextResponse.json({ config: null, disabled: true })
    }
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
