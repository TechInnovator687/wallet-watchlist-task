const { Ledger } = require("./ledger");

const ledger = new Ledger("ops");

function handleRequest(action, payload = {}) {
  try {
    if (action === "add") {
      return ledger.addWallet(payload.caller, payload.wallet, payload.allowance ?? 100, payload.label || "");
    }

    if (action === "deposit") {
      return ledger.deposit(payload.amount);
    }

    if (action === "withdraw") {
      return ledger.withdraw(payload.wallet, payload.amount);
    }

    if (action === "list") {
      return { ok: true, wallets: ledger.getWatchlist() };
    }

    if (action === "allowance") {
      const allowance = ledger.allowance(payload.wallet);
      if (allowance === null) {
        return { ok: false, error: `wallet "${payload.wallet}" is not on the watchlist` };
      }
      return { ok: true, allowance };
    }

    if (action === "balance") {
      return { ok: true, balance: ledger.getTreasuryBalance() };
    }

    return { ok: false, error: `unknown action "${action}"` };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

module.exports = { handleRequest, ledger };
