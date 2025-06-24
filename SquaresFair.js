const readline = require("readline");
const crypto = require("crypto");

class Squares {
  constructor() {
    this.serverSeed = null;
    this.serverHash = null;
    this.stain = null;
    this.difficulty = null;
    this.squares = null;
    this.perTileProb = null;
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
   * Sets the difficulty and number of squares for the game
   * @param {number} difficulty - Probability of reaching the end (e.g., 0.5)
   * @param {number} squares - Number of tiles
   */
  setGameParams(difficulty, squares) {
    this.difficulty = difficulty;
    this.squares = squares;
    this.perTileProb = Math.pow(difficulty, 1 / squares);
  }

  /**
   * Determines the outcome for a given tile index
   * @param {number} index - Tile index (0-based)
   * @returns {{ success: boolean, decimal: number, hmac: string }}
   */
  determineOutcome(index) {
    const outcomeHash = crypto
      .createHmac("sha256", this.serverSeed)
      .update(this.stain + index)
      .digest("hex");
    const float = parseInt(outcomeHash.slice(0, 16), 16) / 0xffffffffffffffff;
    return { success: float < this.perTileProb, decimal: float, hmac: outcomeHash };
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

const SQUARES_DIFFICULTY_MAP = {
  easy: 0.5,
  medium: 1 / 3.6,
  hard: 1 / 7.0,
  expert: 1 / 11.5,
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
      `${COLORS.bold}${COLORS.gray}=== ${COLORS.green}CLARK${COLORS.cyan}Flip ${COLORS.gray}| Squares Fairness Proof ===${COLORS.reset}\n`
    );

    const serverSeed = await ask(rl, `${COLORS.yellow}Server Seed${COLORS.reset}: `);
    const stain = await ask(rl, `${COLORS.yellow}Stain${COLORS.reset}: `);
    const difficultyInput = (
      await ask(rl, `${COLORS.yellow}Difficulty (easy/medium/hard/expert)${COLORS.reset}: `)
    ).toLowerCase();
    const squaresStr = await ask(rl, `${COLORS.yellow}Number of squares (tiles)${COLORS.reset}: `);

    const difficulty = SQUARES_DIFFICULTY_MAP[difficultyInput];
    const squares = parseInt(squaresStr);

    if (!serverSeed || !stain || !difficulty || isNaN(squares) || squares < 1) {
      console.error(`\n${COLORS.red}Invalid input. Please check your entries.${COLORS.reset}`);
      rl.close();
      return;
    }

    console.log(`\n${COLORS.bold}${COLORS.gray}Inputs:${COLORS.reset}`);
    printLabel("  Server Seed", serverSeed, COLORS.green);
    printLabel("  Stain", stain, COLORS.green);
    printLabel("  Difficulty", `${difficulty} (${difficultyInput})`, COLORS.green);
    printLabel("  Squares", squares, COLORS.green);

    const squaresFair = new Squares();
    const serverHash = squaresFair.setServerSeed(serverSeed);
    squaresFair.setStain(stain);
    squaresFair.setGameParams(difficulty, squares);

    console.log(
      `\n${COLORS.bold}${COLORS.gray}Per-tile probability:${COLORS.reset} ${COLORS.yellow}${(
        squaresFair.perTileProb * 100
      ).toFixed(4)}%${COLORS.reset}\n`
    );
    console.log(`${COLORS.bold}${COLORS.gray}Server Hash:${COLORS.reset} ${COLORS.cyan}${serverHash}${COLORS.reset}\n`);

    let failedAt = null;
    let uncovered = 0;

    // Table header
    const colWidths = {
      tile: 4,
      hmac: 20,
      decimal: 21,
      result: 18,
    };
    function pad(str, len, align = "left") {
      str = String(str);
      if (str.length >= len) return str;
      const padLen = len - str.length;
      if (align === "right") return " ".repeat(padLen) + str;
      if (align === "center") {
        const left = Math.floor(padLen / 2);
        const right = padLen - left;
        return " ".repeat(left) + str + " ".repeat(right);
      }
      return str + " ".repeat(padLen);
    }

    console.log(
      `${COLORS.gray}${pad("Tile", colWidths.tile, "center")} | ${COLORS.bold}${pad(
        "HMAC (first 16)",
        colWidths.hmac,
        "center"
      )}${COLORS.reset} ${COLORS.gray}| ${COLORS.bold}${pad("Decimal", colWidths.decimal, "center")}${COLORS.reset} ${
        COLORS.gray
      }| ${COLORS.bold}${pad("Result", colWidths.result, "center")}${COLORS.reset}`
    );
    console.log(
      `${COLORS.gray}${"-".repeat(colWidths.tile)}-|-${"-".repeat(colWidths.hmac)}-|-${"-".repeat(
        colWidths.decimal
      )}-|-${"-".repeat(colWidths.result)}${COLORS.reset}`
    );

    for (let i = 0; i < squares; i++) {
      const outcome = squaresFair.determineOutcome(i);

      const hmacShort = outcome.hmac.slice(0, 16);
      const decimalStr = outcome.decimal.toFixed(16);
      let resultStr, color;
      if (outcome.success) {
        resultStr = "SUCCESS ✅";
        color = COLORS.green;
        uncovered++;
      } else {
        resultStr = "FAIL ❌";
        color = COLORS.red;
        if (!failedAt) failedAt = i + 1;
      }

      console.log(
        `${COLORS.gray}${pad(i + 1, colWidths.tile, "right")} |${COLORS.reset} ${COLORS.cyan}${pad(
          hmacShort,
          colWidths.hmac
        )}${COLORS.reset} ${COLORS.gray}| ${COLORS.yellow}${pad(decimalStr, colWidths.decimal, "right")}${
          COLORS.reset
        } ${COLORS.gray}| ${color}${pad(resultStr, colWidths.result)}${COLORS.reset}`
      );

      if (failedAt) break;
    }

    if (failedAt) {
      console.log(`\n${COLORS.red}Game failed at tile #${failedAt}.${COLORS.reset}`);
    } else {
      console.log(`\n${COLORS.green}All tiles uncovered successfully!${COLORS.reset}`);
    }
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
