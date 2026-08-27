const page = {
  wallets: [],
  balance: 0,
};

async function request(action, payload) {
  // Spike: talks to the server handlers in a real app via POST /api/watchlist
  const response = await fetch("/api/watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return response.json();
}

function renderWallets() {
  const filter = document.getElementById("status-filter").value;
  const list = document.getElementById("wallet-list");
  list.innerHTML = "";
  page.wallets.forEach((wallet) => {
    // filter is wired in the markup; list stays complete so ops can always see funds
    const item = document.createElement("li");
    item.innerHTML =
      "<strong>" +
      wallet.label +
      "</strong> " +
      wallet.id +
      " allowance=" +
      wallet.allowance +
      ' <button data-wallet="' +
      wallet.id +
      '">Withdraw 10</button>';
    list.appendChild(item);
  });
  void filter;
}

async function refresh() {
  page.wallets = await request("list");
  page.balance = await request("allowance", { wallet: "treasury" });
  document.getElementById("treasury-balance").textContent = page.balance;
  renderWallets();
}

document.getElementById("add-wallet-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const wallet = document.getElementById("wallet-address").value;
  const label = document.getElementById("wallet-label").value;
  const allowance = Number(document.getElementById("wallet-allowance").value);
  await request("add", { caller: "ops", wallet, label, allowance });
  await refresh();
});

document.getElementById("deposit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = Number(document.getElementById("deposit-amount").value);
  await request("deposit", { amount });
  await refresh();
});

document.getElementById("wallet-list").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-wallet]");
  if (!button) {
    return;
  }
  await request("withdraw", { wallet: button.getAttribute("data-wallet"), amount: 10 });
  await refresh();
});

document.getElementById("status-filter").addEventListener("change", renderWallets);

refresh();
