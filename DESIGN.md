# Design note

For a small single-process app, what's here now works okay. If this had to become a real
maintained service, I'd keep the same three modules but move the state and the invariants
into an actual persistence layer with transactions, instead of an array sitting in memory.

## Module boundaries

Client side just handles rendering and user intent. It sends an action to the API, gets
back `{ ok, ... }`, and puts wallet fields into the DOM as text, never markup. It doesn't
get to decide if a withdrawal is valid or not, that decision lives in the domain layer, not
here.

The API layer is where HTTP requests turn into ledger calls, and where ledger failures turn
back into status codes, a missing wallet becomes a 404, an allowance or balance conflict
becomes a 409, bad input becomes a 422. This layer needs to stay thin, because if it starts
re-checking things the ledger already checks, you end up with two places deciding what
"valid" means, and eventually they won't agree.

Wallet uniqueness, positive amounts, allowance limits and the treasury balance all get
enforced in the ledger/domain layer, and that's the only place they should be enforced.
Handlers have no business touching state directly, everything should go through here, with
persistence underneath storing both the wallets and a record of what happened to them.

## Where this actually breaks

Right now withdraw is read the allowance, check it, write the new value, three separate
steps with nothing tying them together. In a single process that's not really a problem
since nothing else can run in between. Once there's more than one process, or the ledger
moves off an in-memory array and onto a database, that gap becomes a real race: two
withdrawals read the same allowance before either has written anything back, both pass the
check, both go through, and now the wallet's gone negative. The fix is making the check and
the write happen as one operation the database itself guarantees, not something the app
tries to coordinate across two steps. Something along these lines:

`UPDATE wallets SET allowance = allowance - ? WHERE id = ? AND allowance >= ?`

If that updates zero rows, the withdraw failed, and that's the only failure signal needed.
The balance update for the treasury has to be part of the same transaction too, otherwise
you can end up in a state where the wallet's allowance and the treasury balance don't agree
with each other anymore.

There's also nothing in here that records history. The ledger keeps the current numbers but
not how it got to them, which becomes a real problem the first time someone asks why a
balance looks off and there's nothing to point to. An append-only table of transactions
would fix that, one row per deposit or withdrawal with the wallet, amount, resulting
balance, a timestamp, and a request id. It has a second benefit too: attach an idempotency
key to each withdraw request, check for that key in the table before doing anything, and a
client that retries after a timeout just gets the same result back instead of withdrawing
twice by accident.

## What I'd leave alone

I wouldn't add a generic repository layer or stack a service layer on top of the domain
layer until the persistence and transaction work above actually forces it. At this size, a
thin API on top, one place owning the domain rules, and a persistence layer that does its
writes transactionally is enough. Adding more structure than that right now would just make
the two problems above harder to find, not easier to fix.
