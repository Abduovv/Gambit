# Gambit — SplitRoulette

Social bill splitting on Solana.

## Overview

Gambit is a mobile app that turns bill splitting into a fair, transparent game. A group of friends join a roulette session, confirm the total bill, and a VRF-powered roulette wheel determines each person's share. The fairness spread ensures no one gets an extreme outcome.

## Game Flow

1. **Create** — Host sets the total bill amount, fairness spread, and max players
2. **Join** — Friends enter the roulette session
3. **Lock** — Host locks the session when enough players have joined
4. **Confirm** — Each player confirms they agree to the total bill
5. **Spin** — Host triggers the VRF roulette wheel
6. **Reveal** — Shares are revealed one by one with animation
7. **Pay** — Each player pays their exact share in USDT
8. **Settle** — Vault is drained to the recipient, session closes

## Session States

| State | Description |
|---|---|
| OPEN | Waiting for players to join |
| LOCKED | Session full, waiting for confirmations |
| CONFIRMING | All players confirmed, ready to spin |
| REVEALING | VRF randomness consumed, shares being revealed |
| PAYING | Players paying their individual shares |
| SETTLING | All paid, ready to distribute funds |
| SETTLED | Funds distributed, session closed |
| CANCELLED | Host cancelled, deposits refunded |

## Tech Stack

- **Mobile** — Expo 55, React Native 0.83, Expo Router
- **Wallet** — @wallet-ui/react-native-kit (Solana Mobile Wallet Adapter)
- **State** — React Context, TanStack Query
- **On-chain** — Anchor 1.0.0, Rust (Solana program)
- **VRF** — MagicBlock ephemeral rollups for verifiable randomness
- **Tokens** — USDT (SPL) with vault PDA per session

## Running the App

```bash
# Install dependencies
npm install

# Start dev server (use Expo Go on your phone)
npx expo start --host lan

# Or with tunnel for cross-network access
npx expo start --host tunnel
```

## Building the Program

```bash
# Requires Rust and Solana toolchain
anchor build
```

## Running Tests

```bash
anchor test
```
