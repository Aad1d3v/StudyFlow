let token: string | null = null

/** Keep a module-level copy of the bearer token so non-React modules (AI client) can authenticate. */
export function setSessionToken(next: string | null): void {
  token = next
}

export function getSessionToken(): string | null {
  return token
}
