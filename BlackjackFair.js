const readline = require("readline");
const crypto = require("crypto");

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
    this.serverHash = crypto.createHash("sha256").update(this.serverSeed).digest("hex");
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
    let hash = crypto.createHmac("sha256", this.serverSeed).update(this.stain).digest("hex");
    const hashBytes = Buffer.from(hash, "hex");
    let pointer = 0;
    let hashArr = Array.from(hashBytes);

    function extendHash(idx) {
      const extra = crypto
        .createHmac("sha256", this.serverSeed)
        .update(this.stain + idx)
        .digest("hex");
      const extraBytes = Buffer.from(extra, "hex");
      for (let i = 0; i < extraBytes.length; i++) {
        hashArr.push(extraBytes[i]);
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      if (pointer + 8 > hashArr.length) {
        extendHash.call(this, i);
      }
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
}

// ANSI color codes for pretty printing
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[38;2;52;255;124m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  magenta: "\x1b[35m",
};

/**
 * Prompt the user for input.
 * @param {readline.Interface} rl
 * @param {string} q
 * @returns {Promise<string>}
 */
function ask(rl, q) {
  return new Promise((res) => rl.question(q, res));
}

/**
 * Print a colored label and value.
 */
function printLabel(label, value, color = COLORS.cyan) {
  console.log(`${COLORS.bold}${color}${label}:${COLORS.reset} ${value}`);
}

/**
 * Convert a card string (e.g. "AS", "10H") to a pretty string with suit symbol and color.
 * Black cards (spades, clubs) are grey; red cards (hearts, diamonds) are red.
 * Falls back to letter if symbol is not supported.
 * @param {string} card
 * @param {boolean} useSymbols
 * @param {boolean} useColors
 * @returns {string}
 */
function prettyCard(card, useSymbols = true, useColors = true) {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  let symbol = card;
  if (useSymbols) {
    switch (suit) {
      case "S":
        symbol = `${rank}\u2660`; // ♠
        break;
      case "H":
        symbol = `${rank}\u2665`; // ♥
        break;
      case "D":
        symbol = `${rank}\u2666`; // ♦
        break;
      case "C":
        symbol = `${rank}\u2663`; // ♣
        break;
      default:
        symbol = card;
    }
  }
  // Colorize: black suits (S, C) = grey, red suits (H, D) = red
  if (useColors) {
    if (suit === "S" || suit === "C") {
      return `${COLORS.gray}${symbol}${COLORS.reset}`;
    } else if (suit === "H" || suit === "D") {
      return `${COLORS.red}${symbol}${COLORS.reset}`;
    }
  }
  return symbol;
}

/**
 * Try to detect if the terminal supports Unicode suit symbols.
 * Returns true if supported, false otherwise.
 */
function supportsUnicodeSuits() {
  // Most modern terminals support Unicode, but check env as a hint
  if (process.platform === "win32") {
    // Windows 10+ supports Unicode in most terminals
    return process.env.TERM_PROGRAM === "vscode" || process.env.ConEmuTask === "{cmd::Cmder}";
  }
  // Assume true for non-Windows or modern terminals
  return true;
}

/**
 * Main fairness proof function.
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(
      `${COLORS.bold}${COLORS.gray}=== ${COLORS.green}CLARK${COLORS.cyan}Flip ${COLORS.gray}| Blackjack Fairness Proof ===${COLORS.reset}\n`
    );

    const serverSeed = await ask(rl, `${COLORS.yellow}Server Seed${COLORS.reset}: `);
    const stain = await ask(rl, `${COLORS.yellow}Stain${COLORS.reset}: `);

    if (!serverSeed || !stain) {
      console.error(`\n${COLORS.red}Invalid input. Please check your entries.${COLORS.reset}`);
      rl.close();
      return;
    }

    console.log(`\n${COLORS.bold}${COLORS.gray}Inputs:${COLORS.reset}`);
    printLabel("  Server Seed", serverSeed, COLORS.green);
    printLabel("  Stain", stain, COLORS.green);

    const blackjack = new Blackjack();
    const serverHash = blackjack.setServerSeed(serverSeed);
    blackjack.setStain(stain);

    const deck = blackjack.generateDeck();
    const hands = blackjack.dealHands();

    console.log(
      `\n${COLORS.bold}${COLORS.gray}Server Hash:${COLORS.reset} ${COLORS.cyan}${serverHash}${COLORS.reset}\n`
    );

    const useSymbols = supportsUnicodeSuits();

    // Show deck
    console.log(`${COLORS.bold}${COLORS.gray}Shuffled Deck:${COLORS.reset}`);
    console.log(
      deck
        .map((card, i) => {
          let color = COLORS.cyan;
          if (i === 0 || i === 2) color = COLORS.green; // Player
          if (i === 1 || i === 3) color = COLORS.yellow; // Dealer
          return `${color}${prettyCard(card, useSymbols, i > 3)}${COLORS.reset}`;
        })
        .join(" ")
    );

    // Show hands
    console.log(`\n${COLORS.bold}${COLORS.gray}Initial Hands:${COLORS.reset}`);
    console.log(
      `${COLORS.bold}${COLORS.yellow}Dealer${COLORS.reset}: ${COLORS.cyan}${hands.dealer
        .map((c) => prettyCard(c, useSymbols))
        .join(", ")}${COLORS.reset}`
    );
    console.log(
      `${COLORS.bold}${COLORS.green}Player${COLORS.reset}: ${COLORS.cyan}${hands.player
        .map((c) => prettyCard(c, useSymbols))
        .join(", ")}${COLORS.reset}`
    );
  } catch (err) {
    console.error(`${COLORS.red}An error occurred:${COLORS.reset}`, err);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`${COLORS.red}An unexpected error occurred:${COLORS.reset}`, err);
  });
}
