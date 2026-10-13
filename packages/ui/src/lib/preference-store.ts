/*
 * Copyright (c) 2026 Wing
 * Licensed under the MIT License.
 *
 * The recovery behaviour here (quarantine before any write, the envelope shape, the
 * legacy key that is read once and never deleted) is Adea's accepted port of Zeron's
 * preference store (https://github.com/zeronsh/zeron),
 * `packages/ui/src/components/appearance.ts`, moved here so the shared provider and
 * Adea run one implementation. See NOTICE.
 */

/**
 * A versioned preference store: read one JSON document, refuse to guess about what
 * it cannot read, and keep what it refused.
 *
 * Nothing here knows what a preference *is*. A host hands the engine a key, a
 * version and (through `createVersionedPersistence`) a codec; the engine owns only
 * the part every versioned store gets wrong the same way, which is what happens to
 * a document that is not the one the code expects:
 *
 *   - A document that is not JSON, or not a record, or carries a version the code
 *     does not know (usually a newer build's) is **quarantined, byte for byte, into a
 *     recovery key** before anything else happens. The store then answers as if
 *     nothing were stored. Because the quarantine runs at read time, ahead of any
 *     write, saving valid preferences later cannot destroy the unread original.
 *   - A legacy key is consulted only when the main key is *absent*, never when it is
 *     unreadable: a corrupt main document is not "no preference", and falling back to
 *     an older, staler key would quietly restore a choice the user has since changed.
 *     The legacy key is never deleted.
 *   - Blocked storage (a sandboxed iframe, a privacy mode) throws on the mere access
 *     of the `localStorage` global. Every path here treats that as "nothing stored".
 *
 * The reads and writes are against a {@link PreferenceStorage}, so the rules run in a
 * test without a DOM.
 */

/** The part of `Storage` the engine uses. */
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Why an unread document was quarantined. */
export type RecoveryReason = 'corrupt_json' | 'unsupported_record'

/**
 * What is written to the recovery key.
 *
 * The shape is a compatibility surface: Adea's stored envelopes already have it, and
 * a tool that inspects a user's storage reads it. Do not rename a field.
 */
export type RecoveryEnvelope = Readonly<{
  schemaVersion: 1
  reason: RecoveryReason
  /** An ISO-8601 timestamp of the capture; refreshed by each read of the same bytes. */
  capturedAt: string
  /** The document exactly as it was stored. */
  raw: string
}>

/**
 * The preference store, or nothing.
 *
 * The `typeof` guard sits inside the `try` for a reason: where storage is blocked,
 * merely *reading* the `localStorage` global throws, so a guard in front of the `try`
 * is itself the crash.
 */
export function defaultPreferenceStorage(): PreferenceStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** The envelope for a document, stamped with `now`. */
export function recoveryEnvelope(
  raw: string,
  reason: RecoveryReason,
  now: Date = new Date()
): RecoveryEnvelope {
  return { schemaVersion: 1, reason, capturedAt: now.toISOString(), raw }
}

/**
 * Quarantine an unread document into `recoveryKey`.
 *
 * Idempotent, so re-reading the same unread value refreshes the capture without
 * losing it. Best effort: a store that cannot be written leaves the caller to fail
 * closed on the defaults, which is the same outcome as not having a recovery key at
 * all. Never throws.
 *
 * Exported so a host quarantines its *other* documents (a theme library, say) with
 * the same envelope. Give each document its own `recoveryKey`: two documents that
 * share one overwrite each other's capture.
 */
export function quarantineRecord(
  storage: PreferenceStorage,
  recoveryKey: string,
  raw: string,
  reason: RecoveryReason,
  now: () => Date = () => new Date()
): void {
  try {
    storage.setItem(recoveryKey, JSON.stringify(recoveryEnvelope(raw, reason, now())))
  } catch {
    // Quarantine is best effort; the active preference still fails closed.
  }
}

/** Where a versioned document lives and which version the code understands. */
export type VersionedRecordSchema = {
  /** The storage key of the document. */
  key: string
  /**
   * The only `version` the code reads. Absent, the document is unversioned and any
   * JSON object is accepted; present, a record whose top-level `version` is not
   * exactly this number is unsupported (newer or older), not "close enough".
   */
  version?: number
  /** Where an unread document is kept. Default `${key}.recovery`. */
  recoveryKey?: string
}

/**
 * What reading the document found.
 *
 *   - `absent`: nothing is stored under the key.
 *   - `record`: a JSON object this code can read; `raw` is the stored text.
 *   - `quarantined`: something was stored and cannot be read. It has already been
 *     written to the recovery key.
 *   - `unavailable`: the store itself could not be read.
 */
export type VersionedRead =
  | { status: 'absent' }
  | { status: 'record'; record: Readonly<Record<string, unknown>>; raw: string }
  | { status: 'quarantined'; reason: RecoveryReason; raw: string }
  | { status: 'unavailable' }

/** The default recovery key for a document key. */
export function recoveryKeyFor(schema: VersionedRecordSchema): string {
  return schema.recoveryKey ?? `${schema.key}.recovery`
}

/**
 * Read the document under `schema.key`.
 *
 * The classification is the contract: a value that is not valid JSON, or is JSON but
 * not an object (`null`, a number, a string), is `corrupt_json`; an object (or array)
 * that is not a record of the supported version is `unsupported_record`. Both are
 * quarantined before this returns. An empty string is a stored value, so it is
 * corrupt rather than absent.
 */
export function readVersionedRecord(
  storage: PreferenceStorage,
  schema: VersionedRecordSchema,
  now?: () => Date
): VersionedRead {
  let raw: string | null
  try {
    raw = storage.getItem(schema.key)
  } catch {
    return { status: 'unavailable' }
  }
  if (raw === null) return { status: 'absent' }

  const recoveryKey = recoveryKeyFor(schema)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    quarantineRecord(storage, recoveryKey, raw, 'corrupt_json', now)
    return { status: 'quarantined', reason: 'corrupt_json', raw }
  }
  if (typeof parsed !== 'object' || parsed === null) {
    quarantineRecord(storage, recoveryKey, raw, 'corrupt_json', now)
    return { status: 'quarantined', reason: 'corrupt_json', raw }
  }
  if (
    Array.isArray(parsed) ||
    (schema.version !== undefined && (parsed as { version?: unknown }).version !== schema.version)
  ) {
    quarantineRecord(storage, recoveryKey, raw, 'unsupported_record', now)
    return { status: 'quarantined', reason: 'unsupported_record', raw }
  }
  return { status: 'record', record: parsed as Record<string, unknown>, raw }
}

/**
 * The legacy single-key value, or `null`.
 *
 * Only the caller decides whether to look: the engine's rule is to ask when the main
 * key is `absent`, not when it was quarantined.
 */
export function readLegacyValue(storage: PreferenceStorage, legacyKey: string): string | null {
  try {
    return storage.getItem(legacyKey)
  } catch {
    return null
  }
}

/**
 * Write `document` to `key` as JSON. Returns whether it was stored; a full or blocked
 * store returns `false` and never throws, because losing a preference must not break
 * the switch that tried to save it.
 */
export function writeVersionedRecord(
  storage: PreferenceStorage,
  key: string,
  document: unknown
): boolean {
  try {
    storage.setItem(key, JSON.stringify(document))
    return true
  } catch {
    return false
  }
}
