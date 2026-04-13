# Changelog

## [1.1.0] - 2026-04-13

### Features
- **Username conflict dialog**: When entering an existing username, a confirmation popup asks whether to login, with hint "我们是通过用户名来确认身份哦"
- **Username check API**: New `GET /api/users/check` endpoint to verify if a username exists
- **Leave room**: Players can voluntarily leave a room at any time (auto-folds if in a game, bets stay in pot)
- **Rejoin room**: Left rooms appear on the home page with "重新加入" button; rejoining assigns a new seat
- **Share link invite context**: When redirected from a share link, the login page shows "你正在被邀请加入房间 #XXX"
- **`is_new` field on user creation**: `POST /api/users` now returns `is_new: true/false` to distinguish new vs existing user login

### Bug Fixes
- Fix `is_invited` logic in `/me/rooms` (was incorrectly marking inactive players as invited)

### Tests
- 13 new backend tests (`test_leave_room.py`): leave in lobby, auto-fold during game, action advancement, showdown trigger, rejoin, observer leave, username check
- 12 new frontend tests: 3 `player_left` WS handler tests in gameStore, 9 WelcomePage tests (conflict dialog, invite context, form validation)
- Total: 91 backend + 77 frontend = 168 tests

## [1.0.0] - 2026-04-11

First stable release of 德扑记分 (Poker Scoring).

### Features
- **Complete poker game engine**: Full Texas Hold'em state machine with preflop, flop, turn, river, and showdown phases
- **User system**: Token-based authentication; login with existing username or create new account
- **Room management**: Create rooms with configurable initial chips, small/big blinds
- **Invite system**: All players can invite others by username; share link auto-joins new users
- **Game actions**: Fold, call/check, raise, all-in with proper pot management
- **Dealer rotation**: Automatic dealer button rotation with correct blind posting
- **Rebuy & transfers**: Players can rebuy chips or transfer chips to others
- **Dashboard**: Track buy-ins, rebuys, and current chip counts per player
- **Observer role**: Players can switch between player and observer roles
- **Seat management**: Drag-and-drop seat assignment (room creator)
- **Real-time updates**: WebSocket-based live state synchronization
- **Mobile-friendly UI**: Poker-themed dark UI with circle table layout
- **Docker deployment**: Single-container build with multi-stage Dockerfile

### Bug Fixes
- Fix dealer being skipped during post-flop betting rounds
- Fix SPA fallback for client-side routing on page refresh (mobile pull-to-refresh)
- Fix betting round completion logic (call/check edge cases)
- Fix dealer fold not advancing action correctly
- Fix Docker build: Node.js version, lockfile sync, pip timeout
- Fix all-in player with 0 chips blocking post-flop round_end_seat
- Add Tencent Cloud PyPI mirror for China server deployments
- Remove build-time proxy args from Dockerfile (local-only concern)

### Tests
- 72 pytest test cases covering:
  - Game engine: start hand, blinds, dealer rotation, UTG assignment
  - Player actions: fold, call, raise, all-in with edge cases
  - Betting completion: round-end detection, re-raise, closer updates
  - Phase progression: preflop → flop → turn → river → showdown
  - Settlement: pot distribution, multiple winners, state reset
  - Dealer post-flop regression: dealer gets turn on all streets
  - Chip operations: bet, transfer, rebuy, admin adjust
  - User/room creation, invite flow, multi-hand persistence

### CI/CD
- GitHub Actions workflow: runs pytest on push and PR to master/main
