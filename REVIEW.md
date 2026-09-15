# Review

The starter had the basic data shape, but several of the rules were not enforced. Findings
below are grouped by file, roughly in order of impact.

## `src/server/ledger.js`

**`withdraw()` debits the treasury before it validates anything.** (line 55, previously)
`this.balance = this.balance - amount` ran before checking that the wallet existed, that
the amount was positive, or that it was within the allowance. A missing wallet therefore
could cause an exception after the balance had already changed. All checks now run first;
balance and allowance only change once a withdraw actually clears them.

**Allowance never actually decreased.** The comment said it outright: `// allowance is
"remaining" but we keep it as the original cap for now`. So a wallet with a 100 allowance
could withdraw 100, then withdraw 100 again, forever. "Remaining allowance" was a label
with no enforcement behind it. This is the core product invariant of the whole app and it
didn't exist. Fixed by mutating `entry.allowance -= amount` on a successful withdraw.

**No admin check on `addWallet` at all.** `// TODO auth` was the entire implementation.
Any caller, including the unauthenticated client, could grow the watchlist at will. It now
checks `caller === this.admin` and rejects with an explicit error otherwise.

**Missing wallets and zero-allowance wallets were indistinguishable.** `allowance()`
returned `0` for both, justified in a comment as a UI convenience. That's the wrong call: a
wallet that was never added and a wallet that has spent its allowance are different facts,
and a caller needs to be able to tell them apart. `allowance()` now returns `null` for "not
found"; the handler layer turns that into an explicit error rather than a number.

**No validation anywhere in this file.** Empty wallet ids, negative or zero amounts,
non-numeric allowances, duplicate wallet ids, all silently accepted. I added guards
(`isNonEmptyId`, `isPositiveAmount`) and a duplicate check on add. None of it is exotic. It's
the floor a ledger needs to clear before it can be trusted with a number.

**`debug = true` was a permanent, unconditional `console.log` of every wallet addition and
who added it.** Fine on a laptop, not something you want unconditionally on in anything
that logs to a shared place. Removed rather than gated behind a flag, since there was no logging
strategy here worth preserving, just a leftover.

## `src/server/request-handlers.js`

**No consistent response contract.** `add` returned a bare `true`. `deposit` returned a
bare number. `list` returned a bare array. `withdraw` was the only action wrapped in
try/catch and returned an object. A client calling this API had to know, per action, what
"success" even looks like, and had no reliable way to detect failure versus a legitimate
`0` or `null` result. I standardized every branch to `{ ok: true, ...data }` or
`{ ok: false, error }`, and moved the try/catch to wrap the whole dispatch so a thrown error
from *any* action degrades to an explicit error response instead of crashing the process.

**Unknown actions returned `null`.** A comment admitted this "used to crash the worker," so
`null` was a patch over a crash rather than a real fix; it still doesn't tell the caller
whether the action succeeded. It now returns `{ ok: false, error: 'unknown action "..."' }`.

**There was no way to read the treasury balance.** The client needed the actual balance,
not a wallet's allowance, but no handler exposed `ledger.balance`. I added a `balance`
action backed by a new `getTreasuryBalance()` method on the ledger, which is the fix that
matters most on the client side, covered below.

## `src/client/watchlist-app.js`

**Treasury balance was being read from `allowance("treasury")`.** There is no wallet
called "treasury," so this call always fell into the "wallet not found" branch and always
rendered `0`. The client now calls the new `balance` action directly.

**Wallet rows were built with `innerHTML` and string concatenation of `wallet.label` and
`wallet.id`.** Both fields are attacker-controlled: they come straight from the "Add
wallet" form with no server-side sanitization, so any wallet added with a label like
`<img src=x onerror=alert(document.cookie)>` would execute in every browser that loads the
watchlist afterward. This is a stored XSS with a broad blast radius: it fires for every
viewer of the page, not just the person who submitted the form. Rewritten to build DOM
nodes with `textContent`, so the values are rendered as text rather than parsed as markup.

**The status filter was decoration.** `renderWallets` read the filter value into a local
and then explicitly discarded it (`void filter;`), with a comment claiming the list "stays
complete so ops can always see funds." The select did nothing when changed. Filtering
is now applied against `wallet.status` before rendering.

**No failure path existed for any of the three mutating actions.** Add, deposit, and
withdraw all did `await request(...)` and moved straight to `await refresh()` regardless of
what came back. A rejected withdraw (bad amount, wallet not found, over allowance) looked
identical to a successful one because the response was ignored. I added per-form error
surfaces that render the server's actual error message, and `refresh()` now surfaces a
load failure instead of assuming `list`/`balance` succeeded.

**No empty state.** An empty watchlist, or a filter with no matches, just rendered an empty
`<ul>`, indistinguishable from a page that hasn't loaded yet, which is the one case the
assessment brief names explicitly. Added an empty-state message tied to the filtered
result set.

**Withdraw was hardcoded to exactly 10 with no amount input.** Not a security bug, but a
product one worth naming: you can't run a treasury off a button that only ever moves 10
units. Each wallet row now has its own amount field.

## A bug I introduced and caught on my own second pass

My first pass at the admin check in `request-handlers.js` defaulted a missing `caller` to
`"ops"` before calling `ledger.addWallet`: `payload.caller || "ops"`. Problem is, `"ops"` is
also the ledger's admin identity, so that default silently satisfied the
`caller === this.admin` check I'd just added in `ledger.js`. An empty string, `0`, `null`,
or an omitted `caller` field all passed as the admin. Same shape of bug as the original
`// TODO auth`, just one layer removed: trusting a default instead of demanding the real
value, this time in the handler instead of the ledger. I dropped the default entirely (the
handler now passes `payload.caller` through unchanged) and hardened the ledger's check to
require a non-empty string equal to the admin id, not just loose inequality. Noting this
because "the check exists somewhere" isn't good enough on a surface like this one. It has to
hold at every layer that touches it, and one layer defaulting past another's guard is
enough to defeat both.

## Two more, smaller blast radius

**Treasury balance could go negative.** `withdraw` checked the amount against the wallet's
*allowance* but never against the treasury's actual balance. A wallet with a 100 allowance
could withdraw 100 even if the treasury only held 10, which would take the shared balance
negative. Allowance caps what one wallet can draw; it doesn't guarantee the funds are
there. Added a check that rejects a withdraw exceeding `this.balance`, alongside the
existing allowance check.

**A stale treasury balance stayed on screen after a failed refresh.** If `list` failed but
`balance` succeeded (or the other way around), the client showed the error banner but left
whatever number was already rendered for the field that failed. For balance that meant a
number from before the failure, possibly no longer current. A failed balance fetch now
clears the displayed value to a dash instead of leaving a number the client can't vouch
for, and both failures get reported together rather than the first one silently winning.

## What I did not change, and why

`request-handlers.js` is still a plain function (`handleRequest(action, payload)`), not an
HTTP listener - the client's `fetch("/api/watchlist")` call was already written for a
server that doesn't exist in this codebase. Wiring a real one wasn't asked for and would
have pulled scope away from the ledger logic, which is where the actual bugs and actual
money live, so `ledger.js` and `request-handlers.js` have no server dependency either way.
I did add `dev-server.js` at the repo root, but only as a thin, separate script for
clicking through the UI manually; it has no bearing on the fix itself and isn't part of
the rules this review is about. I also didn't touch the double lookup by exact match then
lowercase match in `findWallet` beyond simplifying it to a single case-insensitive
comparison. The original wasn't wrong, just redundant, and I wanted the diff to stay
legible against what it's actually fixing.
