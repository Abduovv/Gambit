import { Address } from '@solana/kit'

// ── Session state machine (matches program constants.rs) ──────────────
export const SESSION_STATES = {
  OPEN: 0,
  LOCKED: 1,
  CONFIRMING: 2,
  REVEALING: 3,
  PAYING: 4,
  SETTLING: 5,
  SETTLED: 6,
  CANCELLED: 7,
} as const

export type SessionState = (typeof SESSION_STATES)[keyof typeof SESSION_STATES]

export const SESSION_STATE_LABELS: Record<SessionState, string> = {
  [SESSION_STATES.OPEN]: 'Open',
  [SESSION_STATES.LOCKED]: 'Locked',
  [SESSION_STATES.CONFIRMING]: 'Confirming',
  [SESSION_STATES.REVEALING]: 'Revealing',
  [SESSION_STATES.PAYING]: 'Paying',
  [SESSION_STATES.SETTLING]: 'Settling',
  [SESSION_STATES.SETTLED]: 'Settled',
  [SESSION_STATES.CANCELLED]: 'Cancelled',
}

export const SESSION_STATE_COLORS: Record<SessionState, string> = {
  [SESSION_STATES.OPEN]: '#22c55e',
  [SESSION_STATES.LOCKED]: '#f59e0b',
  [SESSION_STATES.CONFIRMING]: '#3b82f6',
  [SESSION_STATES.REVEALING]: '#8b5cf6',
  [SESSION_STATES.PAYING]: '#06b6d4',
  [SESSION_STATES.SETTLING]: '#f97316',
  [SESSION_STATES.SETTLED]: '#10b981',
  [SESSION_STATES.CANCELLED]: '#ef4444',
}

// ── Program constants (matches program constants.rs) ──────────────────
export const MAX_PARTICIPANTS = 20
export const MIN_PARTICIPANTS = 2
export const MIN_FAIRNESS_ALPHA = 1
export const MAX_FAIRNESS_ALPHA = 10
export const FAIRNESS_ALPHA_LABELS: Record<number, string> = {
  1: '±10%',
  2: '±20%',
  3: '±30%',
  4: '±40%',
  5: '±50%',
  6: '±60%',
  7: '±70%',
  8: '±80%',
  9: '±90%',
  10: '±100%',
}

// ── Program ID ────────────────────────────────────────────────────────
export const GAMBIT_PROGRAM_ID = 'FQ5kXdKmsqRhvjR6txthtN7NHHhZ9bLGy7QhjRHJh3xq' as string

// ── PDA seeds ─────────────────────────────────────────────────────────
export const SESSION_SEED = 'session'
export const PARTICIPANT_SEED = 'participant'
export const RECEIPT_SEED = 'receipt'

// ── Session account (matches program state/mod.rs Session struct) ─────
export interface Session {
  sessionId: number[]            // [u8; 6]
  host: Address                  // Pubkey
  totalUsdt: bigint              // u64 - total bill in USDT (6 decimals)
  maxParticipants: number        // u8
  participantCount: number       // u8
  confirmedCount: number         // u8
  paidCount: number              // u8
  totalCollected: bigint         // u64
  state: SessionState            // u8
  fairnessAlpha: number          // u8 (1-10)
  deadlineTs: bigint             // i64
  createdTs: bigint              // i64
  vrfSeed: number[]              // [u8; 32]
  recipientTokenAccount: Address // Pubkey
  usdtVault: Address             // Pubkey
  bump: number                   // u8
  // Client-side metadata
  publicKey?: Address
}

// ── Participant account (matches program state/mod.rs Participant) ────
export interface Participant {
  session: Address        // Pubkey
  wallet: Address         // Pubkey
  displayName: string     // String (max 20 chars)
  amountDue: bigint       // u64 - written by VRF callback
  amountPaid: bigint      // u64 - written by deposit_share
  confirmedBill: boolean  // bool
  joinIndex: number       // u8
  bump: number            // u8
  // Client-side metadata
  publicKey?: Address
}

// ── Receipt account (matches program state/mod.rs Receipt) ────────────
export interface Receipt {
  sessionId: number[]      // [u8; 6]
  host: Address            // Pubkey
  totalUsdt: bigint        // u64
  participantCount: number // u8
  settledAt: bigint        // i64
  fairnessAlpha: number    // u8
  vrfSeed: number[]        // [u8; 32]
  bump: number             // u8
  publicKey?: Address
}

// ── Session creation input ────────────────────────────────────────────
export interface CreateSessionInput {
  sessionId: number[]
  totalUsdt: bigint
  fairnessAlpha: number
  maxParticipants: number
  recipientTokenAccount: Address
}

// ── Display helpers ───────────────────────────────────────────────────

/** Format USDT with 6 decimals to human-readable string */
export function formatUsdt(usdt: bigint): string {
  const whole = usdt / 1_000_000n
  const fraction = usdt % 1_000_000n
  const fracStr = fraction.toString().padStart(6, '0').replace(/0+$/, '')
  return fracStr ? `${whole}.${fracStr}` : `${whole}`
}

/** Format USDT amount with $ prefix */
export function formatUsd(usdt: bigint): string {
  return `$${formatUsdt(usdt)}`
}

/** Convert session ID byte array to short display code */
export function formatSessionId(sessionId: number[]): string {
  return sessionId.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}

/** Get remaining time from timestamp */
export function formatTimeRemaining(timestamp: bigint): string {
  const now = Math.floor(Date.now() / 1000)
  const remaining = Number(timestamp) - now
  if (remaining <= 0) return 'Expired'
  const mins = Math.floor(remaining / 60)
  const hours = Math.floor(mins / 60)
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}
