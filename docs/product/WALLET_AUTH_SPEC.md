# Wallet Auth Spec

**Last updated**: 2026-04-03
**Scope**: self-custodied BSC wallet signup and login for Lunch-Table.

## Non-Negotiable Rule

The private key is never sent to Convex, any HTTP endpoint, or any third-party service.

If we keep that rule, the only safe design is:

- generate the wallet locally in the browser
- show the private key once to the user
- require the user to save it
- use challenge-signature login after that

Convex only stores public identity and authentication proofs:

- address
- chain id
- email
- username
- challenge nonce
- challenge signature
- issued JWT claims

## Important Terminology

This is not a custodial embedded wallet.

It is a local, self-custodied wallet generated inside the Lunch-Table client. The app can optionally help the user store it encrypted on-device, but the platform never possesses the raw private key.

## Signup Requirements

Signup collects exactly:

- email
- username

Then the client generates:

- private key
- public address
- chain id `56` for BSC mainnet

## Signup Flow

1. User enters email and username.
2. Client validates both locally.
3. Client generates a BSC-compatible EVM private key locally.
4. Client derives the wallet address locally.
5. Client displays the private key once with a strong save warning.
6. User confirms they have saved the key.
7. Client requests a signup challenge from Convex using:
   - email
   - username
   - address
   - chain id
8. Convex returns:
   - nonce
   - issuedAt
   - expiresAt
   - canonical challenge text
9. Client signs the challenge locally with the private key.
10. Client submits:
   - email
   - username
   - address
   - challenge nonce
   - signed message
   - signature
11. Convex verifies the recovered address matches the submitted address.
12. Convex creates canonical user and wallet records.
13. Convex returns an auth token or a token exchange response for the custom JWT auth flow.

## Login Flow

1. User pastes the private key or unlocks an encrypted local copy.
2. Client derives the wallet address locally.
3. Client requests a login challenge for that address.
4. Convex returns a nonce-bound challenge.
5. Client signs the challenge locally.
6. Client submits challenge + signature.
7. Convex verifies signature ownership and returns auth token material.

## Recovery Reality

Because the platform never holds the private key:

- there is no server-side account recovery by password
- losing the key means losing wallet-based access

That is acceptable only if the product communicates this clearly during signup and import.

If softer recovery is desired later, we can add optional:

- encrypted device backup with a user passphrase
- secondary recovery wallet
- social recovery

None of those should weaken the core rule that the raw private key never reaches our backend.

## Canonical Tables

### `users`

- `id`
- `email`
- `emailNormalized`
- `username`
- `usernameNormalized`
- `primaryWalletId`
- `status`
- `createdAt`
- `updatedAt`

Constraints:

- `emailNormalized` unique
- `usernameNormalized` unique

### `wallets`

- `id`
- `userId`
- `address`
- `addressNormalized`
- `chainId`
- `walletType`
- `custodyModel`
- `createdAt`
- `lastAuthenticatedAt`

Constraints:

- `addressNormalized` unique
- `chainId` required
- `walletType = "evm-local"`
- `custodyModel = "self-custodied"`

### `wallet_challenges`

- `id`
- `addressNormalized`
- `purpose`
- `nonce`
- `message`
- `expiresAt`
- `consumedAt`
- `emailSnapshot`
- `usernameSnapshot`
- `createdAt`

Constraints:

- `purpose in ("signup", "login", "link-wallet")`
- short expiration window
- one-time use only

### `auth_audits`

- `id`
- `userId`
- `walletId`
- `purpose`
- `success`
- `failureCode`
- `ipHash`
- `userAgent`
- `createdAt`

## Convex Responsibilities

Convex should do all of the following:

- validate username and email policy
- issue challenges
- verify signatures
- create or reject canonical users
- mint or broker auth token issuance
- enforce session expiry
- store auth audit data

Convex should not do any of the following:

- receive the private key
- store the private key
- return the private key after signup
- log the private key in diagnostics

## JWT Identity Model

Convex auth should use a custom JWT provider for wallet sessions.

Stable JWT claims:

- `sub = user:{userId}`
- `wallet_address = 0x...`
- `chain_id = 56`
- `username = ...`
- `email = ...`

Recommended session behavior:

- short-lived access tokens
- renewable through repeat wallet challenge or optional local session refresh
- rotation on sensitive account changes

## Security Requirements

- challenge nonces must be random, unique, and single-use
- challenge messages must include domain, uri, chain id, nonce, and issued time
- all auth endpoints require rate limiting
- all addresses are normalized to lowercase for indexing
- all email and username comparisons use canonical normalized form
- all signature verification is performed server-side before user creation or login

## UI Requirements

Signup UI must:

- show the private key only once
- force an explicit confirmation that the user saved it
- explain that loss of the key means loss of wallet-based access
- never auto-copy the key to the clipboard without explicit user action

Login UI must:

- support paste-import of a private key
- optionally support locally encrypted device storage later
- never echo the raw private key after import

## Recommended Message Format

Use an EIP-4361-style challenge message adapted for BSC:

- statement includes Lunch-Table account creation or login
- chain id is `56`
- address is the signer address
- message includes nonce and issued timestamp

This keeps the auth model standard for EVM signatures even though the target chain is BSC.
