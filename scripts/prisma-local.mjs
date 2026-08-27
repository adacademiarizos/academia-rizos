import dotenv from 'dotenv'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const envPath = existsSync('.env.local') ? '.env.local' : '.env'
dotenv.config({ path: envPath })

const prismaCommand = process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
const result = spawnSync(prismaCommand, process.argv.slice(2), {
  env: process.env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
