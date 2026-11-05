const API_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

let ws;
let symbols = [];
let selectedSymbol = "";
let ticks = [];
let digitCounts = Array(10).fill(0);
let totalTicks = 0;

const $ = id => document.getElementById(id);

function status(message) {
  $("connection").textContent = message;
}

function connect() {
  if (ws) ws.close();

  status("Connecting to Deriv...");

  ws = new WebSocket(API_URL);

  ws.onopen = () => {
    status("Connected");
    ws.send(JSON.stringify({
      active_symbols: "brief",
      product_type: "basic"
    }));
  };

  ws.onmessage = event => {
    const data = JSON.parse(event.data);

    if (data.error) {
      status("Error: " + data.error.message);
      return;
    }

    if (data.msg_type === "active_symbols") {
      symbols = data.active_symbols.filter(s =>
        /volatility/i.test(s.display_name)
      );

      const select = $("market");
      select.innerHTML = "";

      symbols.forEach(s => {
        const option = document.createElement("option");
        option.value = s.symbol;
        option.textContent = s.display_name;
        select.appendChild(option);
      });

      if (symbols.length) {
        select.value = symbols[0].symbol;
        subscribe(select.value);
      } else {
        status("No volatility markets found");
      }
    }

    if (data.msg_type === "tick") {
      processTick(data.tick);
    }
  };

  ws.onclose = () => status("Disconnected");
  ws.onerror = () => status("Connection error");
}

function subscribe(symbol) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  selectedSymbol = symbol;
  ticks = [];
  digitCounts = Array(10).fill(0);
  totalTicks = 0;

  updateDisplay();

  ws.send(JSON.stringify({
    forget_all: "ticks"
  }));

  ws.send(JSON.stringify({
    ticks: symbol,
    subscribe: 1
  }));

  status("Watching " + symbol);
}

function processTick(tick) {
  if (!tick || tick.symbol !== selectedSymbol) return;

  const precision = Number(tick.pip_size ?? 2);
  const quote = Number(tick.quote);

  const formatted = quote.toFixed(precision);
  const digit = Number(formatted.slice(-1));

  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return;

  ticks.unshift({
    digit,
    quote: formatted,
    time: new Date().toLocaleTimeString()
  });

  if (ticks.length > 100) ticks.pop();

  digitCounts[digit]++;
  totalTicks++;

  $("lastDigit").textContent = digit;
  $("totalTicks").textContent = totalTicks;

  updateDisplay();
}

function updateDisplay() {
  const container = $("digitStats");
  container.innerHTML = "";

  let highest = 0;
  let matchDigit = "-";

  digitCounts.forEach((count, digit) => {
    const percentage = totalTicks
      ? ((count / totalTicks) * 100).toFixed(1)
      : "0.0";

    if (count > highest) {
      highest = count;
      matchDigit = digit;
    }

    const item = document.createElement("div");
    item.innerHTML = `
      <strong>${digit}</strong><br>
      ${count} ticks<br>
      ${percentage}%
    `;

    container.appendChild(item);
  });

  $("matchDigit").textContent = matchDigit;

  $("history").innerHTML = ticks.slice(0, 30).map(t => `
    <div>
      ${t.time} — ${t.quote}
      <strong>Digit: ${t.digit}</strong>
    </div>
  `).join("") || "Waiting for ticks...";
}

$("market").addEventListener("change", event => {
  subscribe(event.target.value);
});

$("connect").addEventListener("click", connect);

$("tradeButton").addEventListener("click", () => {
  const digit = Number($("tradeDigit").value);
  const stake = Number($("stake").value);
  const mode = $("accountMode").value;

  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    $("tradeStatus").textContent = "Choose a digit from 0 to 9.";
    return;
  }

  if (!Number.isFinite(stake) || stake <= 0) {
    $("tradeStatus").textContent = "Enter a valid stake.";
    return;
  }

  $("tradeStatus").textContent =
    `Analysis only: Digit ${digit}, Stake ${stake}, Mode ${mode}. No trade was placed.`;
});

connect();
