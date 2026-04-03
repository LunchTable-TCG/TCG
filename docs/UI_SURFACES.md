# Lunchtable UI Surfaces

**Goal**: define every major user-facing surface, its audience, its responsibilities, and whether it is required for MVP.

## Route Map

| Surface | Route | Audience | MVP |
| --- | --- | --- | --- |
| Marketing landing | `/` | anonymous | yes |
| Auth | `/login`, `/signup`, `/callback` | anonymous | yes |
| App home | `/app` | authenticated | yes |
| Collection | `/app/collection` | authenticated | yes |
| Card detail | `/app/cards/:cardId` | authenticated | yes |
| Deck list | `/app/decks` | authenticated | yes |
| Deck editor | `/app/decks/:deckId` | authenticated | yes |
| Format browser | `/app/formats` | authenticated | yes |
| Queue and lobby | `/app/play` | authenticated | yes |
| Match | `/match/:matchId` | seat owner | yes |
| Spectate | `/match/:matchId/spectate` | spectator | phase 2 |
| Replay | `/replay/:replayId` | authenticated | phase 2 |
| Profile | `/app/profile/:profileId` | authenticated | phase 2 |
| Social inbox | `/app/social` | authenticated | phase 2 |
| Store and cosmetics | `/app/store` | authenticated | phase 3 |
| Agent lab | `/app/agents` | authenticated | phase 2 |
| Admin and ops | `/admin` | staff | phase 3 |

## Surface Specs

### 1. Marketing Landing

- Purpose: explain the game, highlight visuals, drive sign-up.
- Required blocks:
  - hero
  - gameplay preview
  - card art gallery
  - feature comparison
  - CTA to sign up or watch a replay
- Key states:
  - signed out
  - signed in redirect

### 2. Auth

- Purpose: authenticate humans through WorkOS.
- Required blocks:
  - sign in
  - sign up
  - passwordless/social handoff
  - callback error handling
- Key states:
  - loading
  - failed callback
  - missing session

### 3. App Home

- Purpose: primary hub after login.
- Required modules:
  - resume recent match
  - ranked and casual CTA
  - deck quick access
  - quests and progression
  - agent sparring CTA
  - recent replays
- Key states:
  - new player onboarding
  - active queue
  - suspended account

### 4. Collection

- Purpose: browse owned and unowned cards.
- Required capabilities:
  - filter by set, format, rarity, tribe, cost, color, keyword
  - sort by name, mana/resource cost, rarity, release date
  - toggle owned only
  - open card detail
  - add card to deck
- Key states:
  - empty collection
  - filtered empty state
  - offline cached view

### 5. Card Detail

- Purpose: canonical source of truth for a single card.
- Required modules:
  - rendered card
  - oracle text
  - keyword help
  - legality by format
  - ownership count
  - related rulings
- Key states:
  - rotated/banned
  - hidden unreleased card

### 6. Deck List

- Purpose: manage all decks.
- Required capabilities:
  - create
  - clone
  - rename
  - archive
  - validate against format
  - mark favorite
- Key states:
  - invalid deck
  - missing cards
  - outdated format rules

### 7. Deck Editor

- Purpose: primary constructed workflow.
- Required panels:
  - main deck
  - sideboard or reserve
  - mana/resource curve
  - card search
  - format warnings
  - statistics
  - import/export
- Required actions:
  - add card
  - remove card
  - set deck metadata
  - switch format
  - save version
- Key states:
  - unsaved changes
  - illegal deck
  - concurrent edit conflict

### 8. Format Browser

- Purpose: explain supported game styles.
- Required modules:
  - format summary
  - deck rules
  - banned/restricted list
  - turn model
  - timing model
  - queue availability

### 9. Queue and Lobby

- Purpose: get into matches.
- Required modules:
  - ranked queue
  - casual queue
  - private challenge
  - bot challenge
  - format selector
  - deck selector
  - ready state
- Key states:
  - waiting
  - opponent found
  - reconnect available
  - deck invalidated mid-queue

### 10. Match Surface

- Purpose: play a live game.
- Required regions:
  - board canvas
  - local hand tray
  - opponent hand count and hidden state indicators
  - stack or response lane
  - action bar
  - prompt modal rail
  - graveyard/discard inspectors
  - turn and timer HUD
  - combat or lane preview
  - event log panel
  - emotes and quick chat
- Required player actions:
  - select card or permanent
  - hover for zoom and rulings
  - play card
  - activate ability
  - attack
  - block or assign
  - choose targets
  - choose modes
  - choose payment and costs
  - pass priority
  - set auto-pass policy
  - concede
- Key states:
  - mulligan
  - reconnecting
  - action pending
  - response window open
  - stack resolving
  - game over

### 11. Spectate

- Purpose: watch a live match with public information only.
- Required differences from seat view:
  - no private hand contents
  - no private prompts
  - no seat actions
  - spectator latency tolerant mode

### 12. Replay

- Purpose: deterministic playback of completed matches.
- Required controls:
  - play/pause
  - step forward/back
  - jump to turn
  - event list scrubber
  - show hidden info if owner/admin

### 13. Profile

- Purpose: player identity and stats.
- Required modules:
  - rank
  - favorite decks
  - recent matches
  - preferred emblems/cosmetics
  - agent roster summary

### 14. Social Inbox

- Purpose: asynchronous player interactions.
- Required modules:
  - friend requests
  - private challenge invites
  - clan or team invites
  - moderation notices

### 15. Store and Cosmetics

- Purpose: monetization without rules advantage.
- Allowed categories:
  - board skins
  - sleeves
  - avatars
  - emotes
  - pack open animations
- Forbidden category:
  - gameplay power that bypasses format legality

### 16. Agent Lab

- Purpose: manage AI-facing play features.
- Required modules:
  - bot roster
  - bot configuration
  - self-play launch
  - prompt and model config for non-match-critical helpers
  - evaluation leaderboards
  - saved sparring scenarios

### 17. Admin and Ops

- Purpose: operational control.
- Required modules:
  - card release toggles
  - format publication
  - ban/restrict list changes
  - stuck match inspector
  - replay audit
  - abuse reports

## Match Surface Interaction Contract

Every click or key action in the live match must map to one of these semantic intents:

- `keepMulligan`
- `takeMulligan`
- `playCard`
- `activateAbility`
- `declareAttackers`
- `declareBlocks`
- `chooseTargets`
- `chooseModes`
- `chooseCosts`
- `resolvePromptChoice`
- `passPriority`
- `toggleAutoPass`
- `concede`
- `sendEmote`

No surface is allowed to mutate match state directly outside this intent contract.
