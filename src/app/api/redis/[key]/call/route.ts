import { NextRequest, NextResponse } from 'next/server'
import { redisPool } from '@/lib/server/redis-pool'
import type Redis from 'ioredis'

function decodeArgs(args: unknown[]): unknown[] {
  return args.map((a) => {
    if (a && typeof a === 'object' && '__buf' in (a as object)) {
      return Buffer.from((a as { __buf: string }).__buf, 'base64')
    }
    return a
  })
}

function encodeVal(v: unknown): unknown {
  if (Buffer.isBuffer(v)) return v.toString('base64')
  return v
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params
    const { command, args = [], buffer = false } = await req.json()

    if (!command) {
      return NextResponse.json({ error: true, message: 'command required' }, { status: 400 })
    }

    const client = redisPool.getClient(key) as Redis
    const cmdArgs = decodeArgs(args)

    if (buffer) {
      const result = await (client as any).callBuffer(command, ...cmdArgs)
      const encoded = Array.isArray(result) ? result.map(encodeVal) : encodeVal(result)
      return NextResponse.json({ result: encoded, encoding: 'base64' })
    }

    const result = await (client as any).call(command, ...cmdArgs)
    return NextResponse.json({ result })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
