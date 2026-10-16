export const UNIDENTIFIED: 'unidentified'
export type Binary = { version: string; sha256: string }
export type Identity = { platform: string; libc: string; node: Binary; bun: Binary }
export function identity(options?: { root?: string; searchPath?: string }): Identity
export function idOf(found: Identity): string
export function expectedId(root?: string): string
