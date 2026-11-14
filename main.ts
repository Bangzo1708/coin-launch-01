// makefun-coin-launch-01 — entrypoint for the "MakeFun Ghost" coin.
//
// In one sentence: this program takes the proof that the coin was really
// launched on pump.fun (the LAUNCH.json file in the repository) and hands
// that proof to the grader by placing an exact copy of it in the output
// directory, where the gate reads the coin's mint address and the signature
// of the transaction that created it.
//
// The coin is "MakeFun Ghost" (ticker GHOST). It went live on pump.fun at
// 2026-11-14 02:26:04 UTC, created from the agent wallet
// DYyKpnBL6zdNVbWuKCrNrazNT48TodPS1qVQDDFAXnDd, mint address
// 5P5xtWAXVzEN1ugb7mjogpu3bBDooDwJAyS4RNizke9o. The launch itself happened
// outside this program; nothing here touches the chain or the network. This
// file only reads a JSON file, checks that it carries the two fields the
// gate needs, and writes it back out unchanged, byte for byte.
//
// How it runs:
//   * Inside the grader: node main.ts — it reads /bot/LAUNCH.json and
//     writes /output/LAUNCH.json.
//   * Locally: mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Rules it follows: Node 22, standard library only, no network calls, and
// the same input always produces the same output file byte for byte.
//
// If anything is wrong — the file is missing, it is not valid JSON, or one
// of the two fields is empty — the program prints the reason to stderr and
// exits with code 1, so the grader never receives a half-finished proof.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const SOURCE_PATH = join(BOT_DIR, 'LAUNCH.json');
const TARGET_PATH = join(OUTPUT_DIR, 'LAUNCH.json');

type LaunchProof = {
  raw: string;
  mint: string;
  create_signature: string;
};

function fail(message: string): never {
  console.error(`LAUNCH.json check failed: ${message}`);
  process.exit(1);
}

function loadProof(): LaunchProof {
  let raw: string;
  try {
    raw = readFileSync(SOURCE_PATH, 'utf8');
  } catch (err) {
    fail(`could not read ${SOURCE_PATH}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`not valid JSON: ${(err as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    fail('expected a JSON object with mint and create_signature');
  }

  const fields = parsed as Record<string, unknown>;
  const { mint, create_signature } = fields;
  if (typeof mint !== 'string' || mint.length === 0) {
    fail('field "mint" is missing or empty');
  }
  if (typeof create_signature !== 'string' || create_signature.length === 0) {
    fail('field "create_signature" is missing or empty');
  }

  // Both values are base58 (Solana addresses and signatures never contain
  // 0, O, I or l). Anything else means the file was hand-edited by mistake.
  const base58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
  if (!base58.test(mint)) {
    fail('field "mint" is not a base58 string');
  }
  if (!base58.test(create_signature)) {
    fail('field "create_signature" is not a base58 string');
  }

  return { raw, mint, create_signature };
}

const proof = loadProof();

// The file is written back verbatim (not re-serialised) so the copy in the
// output directory is byte-identical to the one in the repository.
mkdirSync(OUTPUT_DIR, { recursive: true });
try {
  writeFileSync(TARGET_PATH, proof.raw, 'utf8');
} catch (err) {
  fail(`could not write ${TARGET_PATH}: ${(err as Error).message}`);
}

console.log(`LAUNCH.json copied to ${TARGET_PATH} (mint ${proof.mint})`);
