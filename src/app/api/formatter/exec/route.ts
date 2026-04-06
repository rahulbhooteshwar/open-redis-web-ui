import { NextRequest, NextResponse } from 'next/server'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

export async function POST(req: NextRequest) {
  try {
    const { command, content } = await req.json()

    if (!command) {
      return NextResponse.json({ error: true, message: 'command is required' }, { status: 400 })
    }

    const tmpFile = path.join(
      os.tmpdir(),
      `orwui_fmt_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`,
    )

    try {
      fs.writeFileSync(tmpFile, content || '')
    } catch (e: any) {
      return NextResponse.json({ error: true, message: `Failed to write temp file: ${e.message}` }, { status: 500 })
    }

    const cmd = command.includes('{file}')
      ? command.replace('{file}', tmpFile)
      : `${command} ${tmpFile}`

    return new Promise<NextResponse>((resolve) => {
      exec(cmd, { timeout: 10000 }, (err, stdout, stderr) => {
        fs.unlink(tmpFile, () => {})
        if (err) {
          resolve(NextResponse.json({ error: true, message: stderr || err.message }, { status: 500 }))
          return
        }
        resolve(NextResponse.json({ output: stdout }))
      })
    })
  } catch (e: any) {
    return NextResponse.json({ error: true, message: e.message }, { status: 500 })
  }
}
