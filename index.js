class Coinflip {
  constructor() {
    this.serverSeed = null;
    this.serverHash = null;
    this.stain = null;
  }
  setServerSeed(seed) {
    this.serverSeed = seed;
    this.serverHash = sha256(seed);
    return this.serverHash;
  }
  setStain(stain) {
    this.stain = stain;
    return this.stain;
  }
  determineOutcome() {
    const hmac = hmac_sha256(this.serverSeed, this.stain);
    const float = FairMethods.Float(hmac);
    return { coinSide: float < 0.5 ? "Heads" : "Tails", decimal: float, hmac };
  }
}

class Squares {
  constructor() {
    this.serverSeed = null;
    this.serverHash = null;
    this.stain = null;
    this.difficulty = null;
    this.squares = null;
    this.perTileProb = null;
  }
  setServerSeed(seed) {
    this.serverSeed = seed;
    this.serverHash = sha256(seed);
    return this.serverHash;
  }
  setStain(stain) {
    this.stain = stain;
    return this.stain;
  }
  setGameParams(difficulty, squares) {
    this.difficulty = difficulty;
    this.squares = squares;
    this.perTileProb = Math.pow(difficulty, 1 / squares);
  }
  determineOutcome(index) {
    const hmac = hmac_sha256(this.serverSeed, this.stain + index);
    const float = FairMethods.Float(hmac);
    return { success: float < this.perTileProb, decimal: float, hmac };
  }
}

class Blackjack {
  constructor() {
    this.serverSeed = null;
    this.serverHash = null;
    this.stain = null;
    this.deck = null;
    this.hands = null;
  }
  setServerSeed(seed) {
    this.serverSeed = seed;
    this.serverHash = sha256(seed);
    return this.serverHash;
  }
  setStain(stain) {
    this.stain = stain;
    return this.stain;
  }
  generateDeck() {
    const suits = ["S", "H", "D", "C"];
    const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
    let deck = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
    // Use HMAC_SHA256(serverSeed, stain) as base, extend as needed
    let hash = CryptoJS.HmacSHA256(this.stain, this.serverSeed);
    let hashBytes = CryptoJS.enc.Hex.parse(hash.toString());
    let pointer = 0;
    let hashArr = [];
    for (let i = 0; i < hashBytes.sigBytes; i++) {
      hashArr.push((hashBytes.words[Math.floor(i / 4)] >>> (24 - 8 * (i % 4))) & 0xff);
    }
    // Helper to extend hash
    function extendHash(idx) {
      const extra = CryptoJS.HmacSHA256(this.stain + idx, this.serverSeed);
      let extraBytes = CryptoJS.enc.Hex.parse(extra.toString());
      for (let i = 0; i < extraBytes.sigBytes; i++) {
        hashArr.push((extraBytes.words[Math.floor(i / 4)] >>> (24 - 8 * (i % 4))) & 0xff);
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      if (pointer + 8 > hashArr.length) {
        extendHash.call(this, i);
      }
      // Read 8 bytes as big-endian uint64
      let val = 0n;
      for (let j = 0; j < 8; j++) {
        val = (val << 8n) | BigInt(hashArr[pointer + j]);
      }
      const rand = Number(val % BigInt(i + 1));
      [deck[i], deck[rand]] = [deck[rand], deck[i]];
      pointer += 8;
    }
    this.deck = deck;
    return deck;
  }
  dealHands() {
    if (!this.deck) this.generateDeck();
    this.hands = {
      player: [this.deck[0], this.deck[2]],
      dealer: [this.deck[1], this.deck[3]],
    };
    return this.hands;
  }
  getDeck() {
    if (!this.deck) this.generateDeck();
    return this.deck;
  }
}

class FairMethods {
  /**
   * Converts a hex string to a floating-point number within the range of 0 to 1
   * @param {String} string - The hex string to convert to a float
   * @param {BigInt} maxValue - The maximum value for scaling the result (for example, 2^256-1 for a full SHA-256 hash)
   * @returns {Number} - The floating-point number between 0 and 1
   */
  static Float(string) {
    const trimmed = string.slice(0, 13); // 13 hex chars = 52 bits
    const intVal = parseInt(trimmed, 16);
    return intVal / Math.pow(2, 52);
  }
}

// SHA256 and HMAC-SHA256 for browser
function sha256(str) {
  return CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
}
function hmac_sha256(key, msg) {
  return CryptoJS.HmacSHA256(msg, key).toString(CryptoJS.enc.Hex);
}

const SQUARES_DIFFICULTY_MAP = {
  easy: 0.5,
  medium: 1 / 3.6,
  hard: 1 / 7.0,
  expert: 1 / 11.5,
};

function updateFormVisibility() {
  const mode = document.getElementById("mode").value;
  document.getElementById("uncovered-field").style.display = mode === "squares" ? "" : "none";
  document.getElementById("difficulty-field").style.display = mode === "squares" ? "" : "none";
}

function updateGameDisplay() {
  const mode = document.getElementById("mode").value;
  if (mode === "squares") {
    updateSquaresGemstones();
  } else if (mode === "coinflip") {
    updateCoinflipResult();
  } else if (mode === "blackjack") {
    updateBlackjackResult();
  }
}

function cardToImage(card) {
  // e.g. "AS" -> ace_of_spades.png, "4H" -> 4_of_hearts.png
  const rankMap = {
    A: "ace",
    J: "jack",
    Q: "queen",
    K: "king",
  };
  const suitMap = {
    S: "spades",
    H: "hearts",
    D: "diamonds",
    C: "clubs",
  };
  let rank = card.slice(0, -1);
  let suit = card.slice(-1);
  let rankName = rankMap[rank] || rank;
  let suitName = suitMap[suit];
  return `cards/${rankName}_of_${suitName}.png`;
}

function updateSquaresGemstones() {
  const serverSeed = document.getElementById("serverSeed").value.trim();
  const stain = document.getElementById("stain").value.trim();
  const difficultyKey = document.getElementById("difficulty").value;
  const uncoveredInput = Math.min(5, parseInt(document.getElementById("uncovered").value, 10));

  const squares = 5; // Always 5 squares
  const difficulty = SQUARES_DIFFICULTY_MAP[difficultyKey];
  if (!serverSeed || !stain || !difficulty || isNaN(uncoveredInput) || uncoveredInput < 1 || uncoveredInput > 5) {
    const spinnerHTML = `
          <div class="squares-spinner">
            <svg class="squares-spinner-svg" viewBox="0 0 48 48">
              <circle class="squares-spinner-circle" cx="24" cy="24" r="18"/>
              <circle class="squares-spinner-ball" cx="24" cy="6" r="4"/>
            </svg>
          </div>
        `;
    const container = document.getElementById("squares-gemstones");
    if (!container.querySelector(".squares-spinner")) {
      container.innerHTML = spinnerHTML;
    }
    return;
  }

  const squaresFair = new Squares();
  const serverHash = squaresFair.setServerSeed(serverSeed);
  squaresFair.setStain(stain);
  squaresFair.setGameParams(difficulty, squares);

  let failedAt = null;
  let gemstoneArr = [];
  // Determine outcomes for all 5 squares
  for (let i = 0; i < squares; i++) {
    const outcome = squaresFair.determineOutcome(i);
    if (!failedAt && !outcome.success) {
      failedAt = i + 1;
    }
    gemstoneArr.push({
      success: outcome.success,
      cracked: !outcome.success,
      img: failedAt ? "square_gemstone_cracked.png" : "square_gemstone.png",
      label: i + 1,
    });
  }

  // Determine what to display based on uncoveredInput and failedAt
  let displayArr = [];
  let crackedDone = false;
  for (let i = 0; i < squares; i++) {
    if (i < uncoveredInput) {
      if (!crackedDone) {
        if (gemstoneArr[i].cracked) {
          crackedDone = true;
          displayArr.push({
            cls: "cracked",
            img: "square_gemstone_cracked.png",
            label: i + 1,
          });
        } else {
          if (failedAt !== null && failedAt <= uncoveredInput) {
            displayArr.push({
              cls: "cracked",
              img: "square_gemstone_cracked.png",
              label: i + 1,
            });
          } else {
            displayArr.push({
              cls: "success",
              img: "square_gemstone.png",
              label: i + 1,
            });
          }
        }
      } else {
        // After first cracked, show flipside
        displayArr.push({
          cls: "uncovered",
          img: "square_gemstone_flipside.png",
          label: failedAt,
        });
      }
    } else {
      displayArr.push({
        cls: "uncovered",
        img: "square_gemstone_flipside.png",
        label: failedAt,
      });
    }
  }

  let gemstones = `<div class="gemstone-row">`;
  displayArr.forEach(
    (gem, idx) =>
      (gemstones += `<span class="gemstone-btn ${gem.cls}" style="animation-delay:${idx * 0.07}s"><img src="${
        gem.img
      }" alt="" draggable="false"></span>`)
  );
  gemstones += `</div>`;

  let summary = `
        <div class="gemstone-info">
          <div class="server-hash-row">
            <input class="server-hash-input" id="serverHashInput" value="${serverHash}" readonly tabindex="0" />
            <button class="copy-btn" id="copyServerHashBtn" type="button">
              <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="512.000000pt" height="512.000000pt" viewBox="0 0 512.000000 512.000000"
 preserveAspectRatio="xMidYMid meet">

<g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
fill="currentColor" stroke="none">
<path d="M764 4895 c-82 -18 -137 -47 -201 -107 -62 -59 -95 -112 -117 -189
-15 -49 -16 -198 -14 -1511 l3 -1456 30 -44 c87 -123 263 -123 350 0 l30 44 5
1347 5 1348 30 48 c22 36 45 57 84 77 l53 28 1112 0 c1053 0 1113 1 1151 19
158 72 167 295 15 381 l-45 25 -1215 2 c-982 1 -1227 -1 -1276 -12z"/>
<path d="M1570 4030 c-117 -43 -216 -137 -263 -252 l-22 -53 -3 -1564 c-2
-1387 -1 -1571 13 -1625 41 -161 174 -285 339 -315 83 -15 2409 -15 2492 0
121 22 229 96 291 200 67 112 63 13 63 1714 0 1002 -4 1555 -11 1584 -28 124
-117 234 -235 292 l-69 34 -1270 2 c-1244 2 -1271 2 -1325 -17z m2370 -430
c24 -14 58 -45 75 -68 l30 -44 3 -1331 c2 -940 0 -1343 -8 -1370 -14 -49 -65
-106 -115 -128 -38 -18 -94 -19 -1043 -19 -884 0 -1007 2 -1040 16 -47 19 -88
58 -113 106 -19 37 -19 73 -17 1381 l3 1343 27 42 c16 23 39 49 53 58 68 44
47 43 1100 41 l1000 -2 45 -25z"/>
</g>
</svg>
            </button>
          </div>
          <div style="margin-bottom:0.5em;">
            <b>Uncover probability</b>
            <span style="color:#ffe066;">${(squaresFair.perTileProb * 100).toFixed(2)}%</span>
          </div>
        </div>
      `;

  if (failedAt && uncoveredInput >= failedAt) {
    summary += `<div class="gemstone-summary" style="color:#D22D39;">Game failed at tile #${failedAt}.</div>`;
  } else if (uncoveredInput === squares && !failedAt) {
    summary += `<div class="gemstone-summary" style="color:#00863A;">All tiles uncovered successfully!</div>`;
  } else {
    summary += `<div class="gemstone-summary" style="color:#ffe066;">Game in progress...</div>`;
  }

  let insight = "";
  for (let i = 0; i < uncoveredInput; i++) {
    const outcome = squaresFair.determineOutcome(i);
    const hmac = outcome.hmac;
    const hex = hmac.slice(0, 16);
    const integer = parseInt(hex, 16);
    const denominator = 0xffffffffffffffff;
    const decimal = outcome.decimal;
    insight +=
      `Tile #${i + 1}:\n` +
      `  HMAC (SHA256): ${hmac}\n` +
      `  First 16 hex chars: ${hex}\n` +
      `  Integer: ${integer}\n` +
      `  Integer / 2^64: ${integer} / ${denominator} = ${decimal}\n` +
      `  Success: ${outcome.success ? "Yes" : "No"}\n\n`;
  }
  if (insight) {
    summary += `
    <pre style="background:#23273a;color:var(--text-muted);padding:1em;border-radius:7px;overflow-x:auto;">
${insight.trim()}
    </pre>
  `;
  }

  document.getElementById("squares-gemstones").innerHTML = gemstones + summary;

  const copyBtn = document.getElementById("copyServerHashBtn");
  if (copyBtn) {
    copyBtn.onclick = function () {
      const input = document.getElementById("serverHashInput");
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value);
        copyBtn.classList.add("copied");
        setTimeout(() => copyBtn.classList.remove("copied"), 1200);
      }
    };
  }
}

function updateCoinflipResult() {
  const serverSeed = document.getElementById("serverSeed").value.trim();
  const stain = document.getElementById("stain").value.trim();

  if (!serverSeed || !stain) {
    const spinnerHTML = `
          <div class="squares-spinner">
            <svg class="squares-spinner-svg" viewBox="0 0 48 48">
              <circle class="squares-spinner-circle" cx="24" cy="24" r="18"/>
              <circle class="squares-spinner-ball" cx="24" cy="6" r="4"/>
            </svg>
          </div>
        `;
    const container = document.getElementById("squares-gemstones");
    if (!container.querySelector(".squares-spinner")) {
      container.innerHTML = spinnerHTML;
    }
    return;
  }

  const coinflip = new Coinflip();
  const serverHash = coinflip.setServerSeed(serverSeed);
  coinflip.setStain(stain);
  const outcome = coinflip.determineOutcome();

  let coinImg = outcome.coinSide === "Heads" ? "heads.png" : "tails.png";
  let coinLabel = outcome.coinSide;

  let html = `
        <div class="gemstone-row" style="justify-content:center;">
          <span class="coin-btn" style="animation-delay:0s;">
            <img src="${coinImg}" alt="${coinLabel}" draggable="false" style="width:110px;height:110px;box-shadow:0 2px 8px #0002;border-radius:50%;background:none;display:block;">
          </span>
        </div>
        <div class="gemstone-info">
          <div class="server-hash-row">
            <input class="server-hash-input" id="serverHashInput" value="${serverHash}" readonly tabindex="0" />
            <button class="copy-btn" id="copyServerHashBtn" type="button">
              <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="512.000000pt" height="512.000000pt" viewBox="0 0 512.000000 512.000000"
 preserveAspectRatio="xMidYMid meet">

<g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
fill="currentColor" stroke="none">
<path d="M764 4895 c-82 -18 -137 -47 -201 -107 -62 -59 -95 -112 -117 -189
-15 -49 -16 -198 -14 -1511 l3 -1456 30 -44 c87 -123 263 -123 350 0 l30 44 5
1347 5 1348 30 48 c22 36 45 57 84 77 l53 28 1112 0 c1053 0 1113 1 1151 19
158 72 167 295 15 381 l-45 25 -1215 2 c-982 1 -1227 -1 -1276 -12z"/>
<path d="M1570 4030 c-117 -43 -216 -137 -263 -252 l-22 -53 -3 -1564 c-2
-1387 -1 -1571 13 -1625 41 -161 174 -285 339 -315 83 -15 2409 -15 2492 0
121 22 229 96 291 200 67 112 63 13 63 1714 0 1002 -4 1555 -11 1584 -28 124
-117 234 -235 292 l-69 34 -1270 2 c-1244 2 -1271 2 -1325 -17z m2370 -430
c24 -14 58 -45 75 -68 l30 -44 3 -1331 c2 -940 0 -1343 -8 -1370 -14 -49 -65
-106 -115 -128 -38 -18 -94 -19 -1043 -19 -884 0 -1007 2 -1040 16 -47 19 -88
58 -113 106 -19 37 -19 73 -17 1381 l3 1343 27 42 c16 23 39 49 53 58 68 44
47 43 1100 41 l1000 -2 45 -25z"/>
</g>
</svg>
            </button>
          </div>
          <div style="margin-bottom:0.5em;">
            <b>Outcome:</b> <span style="color:#ffe066;">${coinLabel}</span><br>
            <b>Decimal:</b> <span style="color:#ffe066;">${outcome.decimal}</span>
          </div>
        </div>
        `;

  const hmac = outcome.hmac;
  const hex = hmac.slice(0, 16);
  const integer = parseInt(hex, 16);
  const denominator = 0xffffffffffffffff;
  const decimal = outcome.decimal;

  let insight = `
          <pre style="background:#23273a;color:var(--text-muted);padding:1em;border-radius:7px;overflow-x:auto;">
  HMAC (SHA256): ${hmac}
  First 16 hex chars: ${hex}
  Integer: ${integer}
  Integer / 2^64: ${integer} / ${denominator} = ${decimal}
  Outcome: ${outcome.coinSide}</pre>`;

  document.getElementById("squares-gemstones").innerHTML = html + insight;

  const copyBtn = document.getElementById("copyServerHashBtn");
  if (copyBtn) {
    copyBtn.onclick = function () {
      const input = document.getElementById("serverHashInput");
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value);
        copyBtn.classList.add("copied");
        setTimeout(() => copyBtn.classList.remove("copied"), 1200);
      }
    };
  }
}

function updateBlackjackResult() {
  const serverSeed = document.getElementById("serverSeed").value.trim();
  const stain = document.getElementById("stain").value.trim();

  if (!serverSeed || !stain) {
    const spinnerHTML = `
          <div class="squares-spinner">
            <svg class="squares-spinner-svg" viewBox="0 0 48 48">
              <circle class="squares-spinner-circle" cx="24" cy="24" r="18"/>
              <circle class="squares-spinner-ball" cx="24" cy="6" r="4"/>
            </svg>
          </div>
        `;
    const container = document.getElementById("squares-gemstones");
    if (!container.querySelector(".squares-spinner")) {
      container.innerHTML = spinnerHTML;
    }
    return;
  }

  const blackjack = new Blackjack();
  const serverHash = blackjack.setServerSeed(serverSeed);
  blackjack.setStain(stain);
  blackjack.generateDeck();
  const hands = blackjack.dealHands();

  function randomRotation() {
    return (Math.random() * 10 - 5).toFixed(2);
  }

  // Show player and dealer hands
  let html = `
  <div style="display:flex;justify-content:center;gap:2.5em;">
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="font-weight:700;color:var(--primary);margin-bottom:0.4em;">Dealer</div>
      <div style="position:relative;width:74px;height:110px;">
        <img src="${cardToImage(hands.dealer[0])}" alt="${hands.dealer[0]}"
          class="bj-card"
          style="position:absolute;left:0;top:0;z-index:1;transform:rotate(${randomRotation()}deg);">
        <img src="${cardToImage(hands.dealer[1])}" alt="${hands.dealer[1]}"
          class="bj-card"
          style="position:absolute;left:22px;top:22px;z-index:2;transform:rotate(${randomRotation()}deg);">
      </div>
      <div style="
        background: var(--bg-panel-light);
        color: var(--text-muted);
        font-weight:700;
        font-size:1.01rem;
        border-radius: 999px;
        padding: 2px 14px 2px 14px;
        width: 74px;
        text-align:center;
        margin: 10px auto 0 auto;
        z-index: 3;
      ">
        ${blackjackHandValue(hands.dealer)}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;">
      <div style="font-weight:700;color:var(--primary);margin-bottom:0.4em;">Player</div>
      <div style="position:relative;width:74px;height:110px;">
        <img src="${cardToImage(hands.player[0])}" alt="${hands.player[0]}"
          class="bj-card"
          style="position:absolute;left:0;top:0;z-index:1;transform:rotate(${randomRotation()}deg);">
        <img src="${cardToImage(hands.player[1])}" alt="${hands.player[1]}"
          class="bj-card"
          style="position:absolute;left:22px;top:22px;z-index:2;transform:rotate(${randomRotation()}deg);">
      </div>
      <div style="
        background: var(--bg-panel-light);
        color: var(--text-muted);
        font-weight:700;
        font-size:1.01rem;
        border-radius: 999px;
        padding: 2px 14px 2px 14px;
        width: 74px;
        text-align:center;
        margin: 10px auto 0 auto;
        z-index: 3;
      ">
        ${blackjackHandValue(hands.player)}
      </div>
    </div>
  </div>

<div style="margin: 2.2em 0 0 0;">
  <div style="
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    background: #00000000;
    border-radius: 0px;
    padding: 12px 0 12px 0;
    max-width: 100%;
  ">
    ${blackjack
      .getDeck()
      .slice(4)
      .map(
        (card) => `
      <img src="${cardToImage(card)}" alt="${card}" class="bj-card" style="
        display: inline-block;
        margin: 0px 2px;
        border-radius: 5px;
        box-shadow: 0 1px 4px #0002;
        vertical-align: middle;
        background: #181c26;
      ">
    `
      )
      .join("")}
  </div>
</div>

<div class="server-hash-row">
            <input class="server-hash-input" id="serverHashInput" value="${serverHash}" readonly tabindex="0" />
            <button class="copy-btn" id="copyServerHashBtn" type="button">
              <svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="512.000000pt" height="512.000000pt" viewBox="0 0 512.000000 512.000000"
 preserveAspectRatio="xMidYMid meet">

<g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)"
fill="currentColor" stroke="none">
<path d="M764 4895 c-82 -18 -137 -47 -201 -107 -62 -59 -95 -112 -117 -189
-15 -49 -16 -198 -14 -1511 l3 -1456 30 -44 c87 -123 263 -123 350 0 l30 44 5
1347 5 1348 30 48 c22 36 45 57 84 77 l53 28 1112 0 c1053 0 1113 1 1151 19
158 72 167 295 15 381 l-45 25 -1215 2 c-982 1 -1227 -1 -1276 -12z"/>
<path d="M1570 4030 c-117 -43 -216 -137 -263 -252 l-22 -53 -3 -1564 c-2
-1387 -1 -1571 13 -1625 41 -161 174 -285 339 -315 83 -15 2409 -15 2492 0
121 22 229 96 291 200 67 112 63 13 63 1714 0 1002 -4 1555 -11 1584 -28 124
-117 234 -235 292 l-69 34 -1270 2 c-1244 2 -1271 2 -1325 -17z m2370 -430
c24 -14 58 -45 75 -68 l30 -44 3 -1331 c2 -940 0 -1343 -8 -1370 -14 -49 -65
-106 -115 -128 -38 -18 -94 -19 -1043 -19 -884 0 -1007 2 -1040 16 -47 19 -88
58 -113 106 -19 37 -19 73 -17 1381 l3 1343 27 42 c16 23 39 49 53 58 68 44
47 43 1100 41 l1000 -2 45 -25z"/>
</g>
</svg>
            </button>
          </div>
`;

  // Insight: show first 8 bytes of HMAC, deck order, and dealt cards
  let hmac = CryptoJS.HmacSHA256(stain, serverSeed).toString(CryptoJS.enc.Hex);
  let hex = hmac.slice(0, 16);
  let integer = parseInt(hex, 16);
  let denominator = 0xffffffffffffffff;
  let decimal = integer / denominator;
  let insight = `
<pre style="background:#23273a;color:var(--text-muted);padding:1em;border-radius:7px;overflow-x:auto;">
HMAC_SHA256(serverSeed, stain): ${hmac}
First 16 hex chars: ${hex}
Integer: ${integer}
Integer / 2^64: ${integer} / ${denominator} = ${decimal}
Shuffled deck: [${blackjack.getDeck().join(", ")}]
Player hand: [${hands.player.join(", ")}]
Dealer hand: [${hands.dealer.join(", ")}]
</pre>
        `;

  document.getElementById("squares-gemstones").innerHTML = html + insight;

  const copyBtn = document.getElementById("copyServerHashBtn");
  if (copyBtn) {
    copyBtn.onclick = function () {
      const input = document.getElementById("serverHashInput");
      if (input) {
        input.select();
        input.setSelectionRange(0, 99999);
        navigator.clipboard.writeText(input.value);
        copyBtn.classList.add("copied");
        setTimeout(() => copyBtn.classList.remove("copied"), 1200);
      }
    };
  }
}
// Remove submit button and auto-update on input change
document.querySelector(".verifier-form button")?.remove();
document.querySelectorAll("#squares-form input, #squares-form select").forEach((el) => {
  el.addEventListener("input", () => {
    updateFormVisibility();
    updateGameDisplay();
  });
  el.addEventListener("change", () => {
    updateFormVisibility();
    updateGameDisplay();
  });
});

// Initial update
updateFormVisibility();
updateGameDisplay();

document.getElementById("squares-form").addEventListener("submit", function (e) {
  e.preventDefault();
  updateGameDisplay();
});

function blackjackHandValue(cards) {
  // Returns the blackjack value for a 2-card hand
  let values = cards.map((card) => {
    let rank = card.slice(0, -1);
    if (rank === "A") return 11;
    if (["K", "Q", "J"].includes(rank)) return 10;
    return parseInt(rank, 10);
  });
  let total = values.reduce((a, b) => a + b, 0);
  // Adjust for ace
  if (total > 21 && cards.some((card) => card[0] === "A")) total -= 10;
  return total;
}

// Autofill from URL parameters
function autofillFromURL() {
  const params = new URLSearchParams(window.location.search);

  const gamemode = params.get("gamemode");
  const serverSeed = params.get("serverSeed");
  const stain = params.get("stain");
  const uncovered = params.get("uncovered");
  const difficulty = params.get("difficulty");

  if (gamemode !== null) document.getElementById("mode").value = gamemode.toLowerCase();
  if (serverSeed !== null) document.getElementById("serverSeed").value = serverSeed;
  if (stain !== null) document.getElementById("stain").value = stain;
  if (uncovered !== null) document.getElementById("uncovered").value = uncovered;
  if (difficulty !== null) document.getElementById("difficulty").value = difficulty.toLowerCase();
}

autofillFromURL();
updateFormVisibility();
updateGameDisplay();

fetch("https://raw.githubusercontent.com/CLARKFlip/ProvablyFair/refs/heads/main/SquaresFair.js")
  .then((r) => r.text())
  .then((code) => {
    const codeElem = document.querySelector("#source-code-squares code");
    codeElem.textContent = code;
    if (window.Prism) Prism.highlightElement(codeElem);
  });

fetch("https://raw.githubusercontent.com/CLARKFlip/ProvablyFair/refs/heads/main/CoinflipFair.js")
  .then((r) => r.text())
  .then((code) => {
    const codeElem = document.querySelector("#source-code-coinflip code");
    codeElem.textContent = code;
    if (window.Prism) Prism.highlightElement(codeElem);
  });

fetch("https://raw.githubusercontent.com/CLARKFlip/ProvablyFair/refs/heads/main/BlackjackFair.js")
  .then((r) => r.text())
  .then((code) => {
    const codeElem = document.querySelector("#source-code-blackjack code");
    codeElem.textContent = code;
    if (window.Prism) Prism.highlightElement(codeElem);
  });

window.addEventListener("DOMContentLoaded", () => {
  const splash = document.getElementById("splash-init");
  const maskRect = document.getElementById("splash-mask-rect");
  const center = 560.5;
  const maxSize = 2.2 * 1121; // Diagonal length to fully cover at 45°
  let start = null;
  const duration = 500; // ms
  const fps = 60;
  const frameDuration = 1000 / fps;
  let lastFrameTime = 0;

  function animateMask(ts) {
    if (!start) start = ts;
    if (ts - lastFrameTime < frameDuration) {
      requestAnimationFrame(animateMask);
      return;
    }
    lastFrameTime = ts;
    const progress = Math.min((ts - start) / duration, 1);
    const size = progress * maxSize;
    const half = size / 2;
    maskRect.setAttribute("x", center - half);
    maskRect.setAttribute("y", center - half);
    maskRect.setAttribute("width", size);
    maskRect.setAttribute("height", size);
    if (progress < 1) {
      requestAnimationFrame(animateMask);
    } else {
      splash.style.opacity = "0";
      setTimeout(() => (splash.style.display = "none"), 180);
    }
  }
  maskRect.setAttribute("x", center);
  maskRect.setAttribute("y", center);
  maskRect.setAttribute("width", 0);
  maskRect.setAttribute("height", 0);
  requestAnimationFrame(animateMask);
});

document.getElementById("nav-calc").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("main-calc").style.display = "";
  document.getElementById("main-how").style.display = "none";
  this.classList.add("active");
  document.getElementById("nav-how").classList.remove("active");
});
document.getElementById("nav-how").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("main-calc").style.display = "none";
  document.getElementById("main-how").style.display = "";
  this.classList.add("active");
  document.getElementById("nav-calc").classList.remove("active");
});

function moveSidebarCursor() {
  // Wait for layout to settle before measuring
  setTimeout(() => {
    const sidebar = document.querySelector(".sidebar");
    const cursor = sidebar.querySelector(".sidebar-cursor");
    const active = sidebar.querySelector("a.active");
    if (!active) return;

    // Get position relative to sidebar
    const sidebarRect = sidebar.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    // Use scrollTop to account for scrolling in sidebar
    const offsetTop = activeRect.top - sidebarRect.top + sidebar.scrollTop;

    cursor.style.top = offsetTop + "px";
    cursor.style.height = active.offsetHeight + "px";
  }, 0);
}

// Call on load and after switching
moveSidebarCursor();

document.getElementById("nav-calc").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("main-calc").style.display = "";
  document.getElementById("main-how").style.display = "none";
  this.classList.add("active");
  document.getElementById("nav-how").classList.remove("active");
  moveSidebarCursor();
});
document.getElementById("nav-how").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("main-calc").style.display = "none";
  document.getElementById("main-how").style.display = "";
  this.classList.add("active");
  document.getElementById("nav-calc").classList.remove("active");
  moveSidebarCursor();
});

// Also call on window resize to keep it in place
window.addEventListener("resize", moveSidebarCursor);
