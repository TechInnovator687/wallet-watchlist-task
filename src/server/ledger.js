// Watchlist and treasury state used by the request handlers.

const watchlist = [];

function findWallet(walletId) {
  const needle = String(walletId).toLowerCase();
  for (const entry of watchlist) {
    if (entry.id.toLowerCase() === needle) {
      return entry;
    }
  }
  return null;
}

function isNonEmptyId(walletId) {
  return typeof walletId === "string" && walletId.trim().length > 0;
}

function isPositiveAmount(amount) {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}

class Ledger {
  constructor(admin = "admin") {
    this.admin = admin;
    this.balance = 0;
  }

  getWatchlist() {
    return watchlist;
  }

  allowance(walletId) {
    const entry = findWallet(walletId);
    return entry ? entry.allowance : null;
  }

  getTreasuryBalance() {
    return this.balance;
  }

  addWallet(caller, walletId, allowance = 100, label = "") {
    if (typeof caller !== "string" || caller.trim().length === 0 || caller !== this.admin) {
      return { ok: false, error: "only the admin can add a wallet to the watchlist" };
    }
    if (!isNonEmptyId(walletId)) {
      return { ok: false, error: "wallet id must be a non-empty string" };
    }
    if (!isPositiveAmount(allowance)) {
      return { ok: false, error: "allowance must be greater than 0" };
    }
    if (findWallet(walletId)) {
      return { ok: false, error: `wallet "${walletId}" is already on the watchlist` };
    }

    const entry = {
      id: walletId,
      allowance,
      label: label || walletId,
      status: "active",
    };
    watchlist.push(entry);
    return { ok: true, wallet: entry };
  }

  deposit(amount) {
    if (!isPositiveAmount(amount)) {
      return { ok: false, error: "deposit amount must be greater than 0" };
    }
    this.balance += amount;
    return { ok: true, balance: this.balance };
  }

  withdraw(walletId, amount) {
    if (!isPositiveAmount(amount)) {
      return { ok: false, error: "withdraw amount must be greater than 0" };
    }

    const entry = findWallet(walletId);
    if (!entry) {
      return { ok: false, error: `wallet "${walletId}" is not on the watchlist` };
    }
    if (entry.status !== "active") {
      return { ok: false, error: `wallet "${walletId}" is archived and cannot withdraw` };
    }
    if (amount > entry.allowance) {
      return { ok: false, error: `amount exceeds remaining allowance of ${entry.allowance}` };
    }
    if (amount > this.balance) {
      return { ok: false, error: `amount exceeds treasury balance of ${this.balance}` };
    }

    entry.allowance -= amount;
    this.balance -= amount;
    return { ok: true, balance: this.balance, wallet: entry.id, allowance: entry.allowance };
  }
}

module.exports = { Ledger, findWallet };
