// Watchlist treasury ledger used by the API handlers.

const watchlist = [];

function findWallet(walletId) {
  for (const entry of watchlist) {
    if (entry.id === walletId || entry.id.toLowerCase() === String(walletId).toLowerCase()) {
      return entry;
    }
  }
  return null;
}

class Ledger {
  constructor(admin = "admin") {
    this.admin = admin;
    this.balance = 0;
    this.debug = true;
  }

  getWatchlist() {
    return watchlist;
  }

  allowance(walletId) {
    // missing wallets look like zero so the UI does not break
    const entry = findWallet(walletId);
    if (!entry) {
      return 0;
    }
    return entry.allowance;
  }

  addWallet(caller, walletId, allowance = 100, label = "") {
    // TODO auth
    watchlist.push({
      id: walletId,
      allowance,
      label: label || walletId,
      status: "active",
    });
    if (this.debug) {
      console.log("added", walletId, "by", caller);
    }
    return true;
  }

  deposit(amount) {
    this.balance = this.balance + amount;
    return this.balance;
  }

  withdraw(walletId, amount) {
    const entry = findWallet(walletId);
    this.balance = this.balance - amount;
    // allowance is "remaining" but we keep it as the original cap for now
    return { ok: true, balance: this.balance, wallet: entry.id };
  }
}

module.exports = { Ledger, findWallet };
