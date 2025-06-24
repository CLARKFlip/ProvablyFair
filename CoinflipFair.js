const readline = require("readline");
const crypto = require("crypto");

class Coinflip {
  constructor() {
    this.serverSeed = null;
    this.serverHash = null;
    this.stain = null;
  }

  /**
   * Sets the server seed of the game to the provided value
   * @param {string} seed - Server seed to set
   * @returns {string} - The hash of the server seed
   */
  setServerSeed(seed) {
    this.serverSeed = seed;
    this.serverHash = crypto.createHash("sha256").update(this.serverSeed).digest("hex");
    return this.serverHash;
  }

  /**
   * Sets the stain of the game to the provided value
   * @param {string} stain - Stain to set
   * @returns {string} - The set stain
   */
  setStain(stain) {
    this.stain = stain;
    return this.stain;
  }

  /**
   * Determines the coinflip outcome
   * @returns {{ coinSide: string, decimal: number, hmac: string }}
   */
  determineOutcome() {
    const outcomeHash = crypto.createHmac("sha256", this.serverSeed).update(this.stain).digest("hex");
    // Use first 16 hex chars for 64 bits
    const float = parseInt(outcomeHash.slice(0, 16), 16) / 0xffffffffffffffff;
    return {
      coinSide: float < 0.5 ? "Heads" : "Tails",
      decimal: float,
      hmac: outcomeHash,
    };
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
 * Main fairness proof function.
 */
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(
      `${COLORS.bold}${COLORS.gray}=== ${COLORS.green}CLARK${COLORS.cyan}Flip ${COLORS.gray}| Coinflip Fairness Proof ===${COLORS.reset}\n`
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

    const coinflip = new Coinflip();
    const serverHash = coinflip.setServerSeed(serverSeed);
    coinflip.setStain(stain);

    const outcome = coinflip.determineOutcome();

    console.log(
      `\n${COLORS.bold}${COLORS.gray}Server Hash:${COLORS.reset} ${COLORS.cyan}${serverHash}${COLORS.reset}\n`
    );
    console.log(
      `${COLORS.bold}${COLORS.gray}HMAC (SHA256):${COLORS.reset} ${COLORS.cyan}${outcome.hmac}${COLORS.reset}\n`
    );
    console.log(
      `${COLORS.bold}${COLORS.gray}Decimal:${COLORS.reset} ${COLORS.yellow}${outcome.decimal.toFixed(16)}${
        COLORS.reset
      }`
    );
    console.log(
      `${COLORS.bold}${COLORS.gray}Result:${COLORS.reset} ${outcome.coinSide === "Heads" ? COLORS.green : COLORS.cyan}${
        outcome.coinSide
      }${COLORS.reset}\n`
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
