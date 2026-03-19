# How to Download All TrillionBears Images

This folder contains the full image set for the TrillionBears NFT collection. Here's how to regenerate it yourself using the two scripts in this guide.

**What you need:**
- Python 3 (already on most Macs — check with `python3 --version`)
- A free Helius API key

---

## Step 1: Get a Helius API Key

Helius is a Solana API provider. The free tier is more than enough for this.

1. Go to [dashboard.helius.dev](https://dashboard.helius.dev/api-keys)
2. Sign up (free)
3. Copy your API key

---

## Step 2: Get the Scripts

The two scripts live in this repo:
- `trillionbears_download.py` — bulk downloads the full collection
- `trillionbears_retry.py` — retries any images that failed or were skipped

Copy them to your local machine (or clone the repo).

---

## Step 3: Run the Main Download

Open your terminal, navigate to where the scripts are, and run:

```bash
python3 trillionbears_download.py YOUR_API_KEY_HERE
```

Or set the key as an environment variable:

```bash
HELIUS_API_KEY=your_key_here python3 trillionbears_download.py
```

**What it does:**
- Queries the Helius DAS API for all NFTs verified by the TrillionBears creator address
- Downloads them in parallel (20 threads) into a folder called `trillionbears_images/`
- Shows progress every 50 images

**How long it takes:** A few minutes depending on your connection. The collection is ~1000 NFTs.

---

## Step 4: Run the Retry Script (if needed)

Some images may fail on the first pass — slow CDN responses, timeouts, etc. The retry script handles this:

```bash
python3 trillionbears_retry.py YOUR_API_KEY_HERE
```

**What it does differently:**
- Skips any image already downloaded
- Retries each failed image up to 3 times with a longer timeout (60s)
- Tells you exactly which ones failed

Run it once after the main download. If everything downloaded cleanly, it'll just say "All images already downloaded!"

---

## What You Get

A folder called `trillionbears_images/` with every bear named by their NFT name (e.g., `ASTROBEAR.png`, `ANGELBEAR.png`). Same naming as what's in this repo.

---

## How This Works (the short version)

The scripts use the [Helius DAS API](https://docs.helius.dev/compression-and-das-api/digital-asset-standard-das-api) — specifically the `searchAssets` method — to find every NFT verified by the TrillionBears creator address on Solana mainnet. From each asset record, it extracts the image URL from the metadata, then downloads them all in parallel.

No external Python libraries required. Pure standard library.

---

## Troubleshooting

**`python3: command not found`**
Install Python from [python.org](https://python.org) or run `brew install python` on Mac.

**`401 Unauthorized` or API errors**
Double-check your API key. Make sure you're copying it correctly from the Helius dashboard.

**Images missing after download**
Run the retry script. If specific ones still fail, the image CDN URL may have changed — the metadata record may need to be refreshed via the API.

**Want to check how many images you have:**
```bash
ls trillionbears_images/ | wc -l
```
