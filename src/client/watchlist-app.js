const page = {
  wallets: [],
  balance: 0,
};

const pageError = document.getElementById("page-error");
const addWalletError = document.getElementById("add-wallet-error");
const depositError = document.getElementById("deposit-error");

function showError(el, message) {
  el.textContent = message;
  el.hidden = false;
}

function clearError(el) {
  el.hidden = true;
  el.textContent = "";
}

async function request(action, payload) {
  try {
    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json();
    if (!response.ok && result.ok === undefined) {
      return { ok: false, error: `request failed (${response.status})` };
    }
    return result;
  } catch (error) {
    return { ok: false, error: "could not reach the server" };
  }
}

function renderWallets() {
  const filter = document.getElementById("status-filter").value;
  const list = document.getElementById("wallet-list");
  const emptyState = document.getElementById("wallet-list-empty");

  const visible =
    filter === "all" ? page.wallets : page.wallets.filter((wallet) => wallet.status === filter);

  list.innerHTML = "";

  if (visible.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  visible.forEach((wallet) => {
    const item = document.createElement("li");

    const label = document.createElement("strong");
    label.textContent = wallet.label;

    const idText = document.createTextNode(` ${wallet.id} `);
    const statusText = document.createTextNode(` [${wallet.status}] `);
    const allowanceText = document.createTextNode(`allowance=${wallet.allowance} `);

    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.min = "1";
    amountInput.value = "10";
    amountInput.className = "withdraw-amount";
    amountInput.setAttribute("aria-label", `Withdraw amount for ${wallet.id}`);

    const withdrawButton = document.createElement("button");
    withdrawButton.type = "button";
    withdrawButton.textContent = "Withdraw";
    withdrawButton.disabled = wallet.status !== "active";
    withdrawButton.addEventListener("click", () => withdraw(wallet.id, amountInput));

    item.append(label, idText, statusText, allowanceText, amountInput, withdrawButton);
    list.appendChild(item);
  });
}

async function withdraw(walletId, amountInput) {
  const amount = Number(amountInput.value);
  clearError(pageError);
  const result = await request("withdraw", { wallet: walletId, amount });
  if (!result.ok) {
    showError(pageError, result.error || "withdraw failed");
    return;
  }
  await refresh();
}

async function refresh() {
  const [listResult, balanceResult] = await Promise.all([
    request("list"),
    request("balance"),
  ]);

  const failures = [];
  if (!listResult.ok) {
    failures.push(listResult.error || "could not load the watchlist");
    page.wallets = [];
  } else {
    page.wallets = listResult.wallets;
  }

  if (!balanceResult.ok) {
    failures.push(balanceResult.error || "could not load the treasury balance");
    document.getElementById("treasury-balance").textContent = "—";
  } else {
    page.balance = balanceResult.balance;
    document.getElementById("treasury-balance").textContent = page.balance;
  }

  if (failures.length > 0) {
    showError(pageError, failures.join(" / "));
  } else {
    clearError(pageError);
  }

  renderWallets();
}

document.getElementById("add-wallet-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError(addWalletError);

  const wallet = document.getElementById("wallet-address").value.trim();
  const label = document.getElementById("wallet-label").value.trim();
  const allowance = Number(document.getElementById("wallet-allowance").value);

  const result = await request("add", { caller: "ops", wallet, label, allowance });
  if (!result.ok) {
    showError(addWalletError, result.error || "could not add wallet");
    return;
  }

  event.target.reset();
  document.getElementById("wallet-allowance").value = "100";
  await refresh();
});

document.getElementById("deposit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError(depositError);

  const amount = Number(document.getElementById("deposit-amount").value);
  const result = await request("deposit", { amount });
  if (!result.ok) {
    showError(depositError, result.error || "deposit failed");
    return;
  }

  event.target.reset();
  await refresh();
});

document.getElementById("status-filter").addEventListener("change", renderWallets);

refresh();
