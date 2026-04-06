import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { searchParams } = new URL(req.url)
    const keyName = searchParams.get('keyName')

    if (!keyName) {
      return NextResponse.json({ error: true, message: 'keyName required' }, { status: 400 })
    }

    const client = redisPool.getClient(key) as Redis
    await client.del(keyName)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
