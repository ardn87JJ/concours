const ITERATIONS = 210_000
export const PASSWORD_VERSION = 2

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

const fromBase64 = (value: string) => {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function derive(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  )
  return new Uint8Array(bits)
}

export async function createPasswordCredential(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password.normalize('NFC'), salt)
  return { passwordHash: toBase64(hash), passwordSalt: toBase64(salt), passwordVersion: PASSWORD_VERSION }
}

export async function verifyPassword(password: string, passwordHash: string, passwordSalt: string) {
  const expected = fromBase64(passwordHash)
  const candidates = [...new Set([password, password.normalize('NFC'), password.normalize('NFD')])]
  for (const candidate of candidates) {
    const actual = await derive(candidate, fromBase64(passwordSalt))
    if (actual.length !== expected.length) continue
    let difference = 0
    actual.forEach((byte, index) => { difference |= byte ^ expected[index] })
    if (difference === 0) return true
  }
  return false
}
