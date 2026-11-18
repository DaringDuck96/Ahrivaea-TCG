# Ahrivaea

A fantasy trading card game you play in the browser. Players sign up with a name and password, spend their starting 500 Sol on a Starter Deck, open packs, build decks, and play against a computer opponent.

Everything that matters is decided on the server: Sol, packs, card collections and game results. The rules engine and the computer opponent also run on the server, so nobody can edit their Sol, see the computer's hand or fake a win.

## Put the game online (one-time setup)

The game runs on Cloudflare Workers, which is free for a group of friends and needs no credit card.

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In the dashboard, go to **Workers & Pages**, click **Create**, then **Import a repository**.
3. Connect your GitHub account when asked, and pick the **Ahrivaea-TCG** repository.
4. On the settings screen:
   - **Project name:** `ahrivaea-tcg` (it must match the `name` in `wrangler.toml`).
   - **Build command:** leave empty.
   - **Deploy command:** `npx wrangler deploy` (the default).
5. Click **Deploy**. When it finishes, Cloudflare shows the game's link, which looks like `https://ahrivaea-tcg.<your-name>.workers.dev`.
6. **Open the link and create your own account first.** The first account ever created is the game's admin, and it's the only one that sees the **Admin** tab, where you can set any player's Sol.

From then on, every push to the `main` branch redeploys the game automatically. Player accounts are stored in the server's database, so updates never wipe them.

To make another player an admin, add their name to `ADMIN_USERS` in `wrangler.toml` (for example, `ADMIN_USERS = "Travis, Sam"`) and push.

## Game rules for the economy

| Rule | Value |
| --- | --- |
| Starting Sol | 500 |
| Starter Deck | 500 Sol (every new account buys one when signing up, so it starts with 0 Sol); more can be bought in the Shop |
| Sol for a win against the computer | 20 |
| Expansion Pack | 100 Sol for 5 cards from the current Release: 3 Common, 1 Uncommon and 1 Rare (Legendary 15% of the time) |
| Selling a card | 5 Sol (Common), 10 (Uncommon), 25 (Rare), 60 (Legendary); only cards opened in packs |
| Starter Deck cards | Can never be sold, so every player always has a playable deck |

These numbers live at the top of `src/worker.js` (`ECON`, `PACK_SLOTS`, `LEGENDARY_CHANCE`, `SELL`).

## Releases

Every card so far belongs to the first Release, **Intro to Ahrivaea**: the 120 Starter Deck cards plus 180 cards found only in Expansion Packs (30 per faction). Each faction's 50 cards are 20 Common, 17 Uncommon, 10 Rare and 3 Legendary.

To add a second Release later: add its cards in a new file in `game/` with `rel: 'yourid'`, add it to `RELEASES` in `game/expansion.js`, and set `CURRENT_RELEASE` to it. Packs then sell the new Release, and everyone's existing cards stay as they are.

## Security

- Passwords are at least 8 characters and are stored only as salted PBKDF2 hashes.
- After 8 wrong passwords, logins to that account are paused for 15 minutes.
- Players can change their password from the Home screen.

## Changing the game

The source code is in `game/`:

- `cards.js`: the Starter Deck cards, heroes and starter decks
- `expansion.js`: the Expansion Pack cards, rarities and Releases
- `engine.js`: the rules
- `ai.js`: the computer opponent
- `replay.js`: how the server stores and replays games
- `ui.js`, `client.js`, `style.css`: what players see

`src/worker.js` is the server: accounts, Sol, packs, decks, games and the admin tools.

After editing anything in `game/`, run `node build.mjs` to regenerate `src/core.js` and `public/index.html`, then commit and push.

If you remove or rename a card, players who owned it automatically get Sol back for it the next time they log in, and decks that used it are marked as needing a fix.

## Testing locally

You only need Node.js 18 or newer.

- `npm test` checks the server rules: accounts, packs, selling, deck checks, admin-only Sol, and full games against the computer.
- `npm run dev` runs the whole game at http://localhost:8787 with a temporary in-memory database.
- `node tests/ai-check.cjs aiai 72` plays the computer against itself across every deck matchup and reports the results.
