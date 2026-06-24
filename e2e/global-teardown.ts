import { execSync } from 'node:child_process'

export default function globalTeardown() {
  try {
    execSync('rm -f ./e2e.db', { stdio: 'pipe' })
  } catch {
    // ignore
  }
}
