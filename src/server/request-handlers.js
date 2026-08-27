const { Ledger } = require("./ledger");

const ledger = new Ledger("ops");

function handleRequest(action, payload = {}) {
  if (action === "add") {
    return ledger.addWallet(
      payload.caller || "ops",
      payload.wallet,
      payload.allowance ?? 100,
      payload.label || ""
    );
  }

  if (action === "deposit") {
    return ledger.deposit(payload.amount ?? 0);
  }

  if (action === "withdraw") {
    try {
      return ledger.withdraw(payload.wallet, payload.amount);
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  if (action === "list") {
    return ledger.getWatchlist();
  }

  if (action === "allowance") {
    return ledger.allowance(payload.wallet);
  }

  // unknown actions used to crash the worker
  return null;
}

module.exports = { handleRequest, ledger };
