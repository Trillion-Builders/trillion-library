#!/usr/bin/env python3
"""
Bulk download all TRILLIONBEARS NFT images via Helius DAS API.
No external dependencies — uses only Python standard library.

Usage: python3 trillionbears_download.py <HELIUS_API_KEY>
   or: HELIUS_API_KEY=xxx python3 trillionbears_download.py
"""

import os, sys, json, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from concurrent.futures import ThreadPoolExecutor, as_completed

CREATOR = "FCkaSc9FqGrQTfP6NkiyempWZShcUZssutVhHUmf93cW"
OUT_DIR = Path("trillionbears_images")
MAX_WORKERS = 20


def get_api_key():
    if len(sys.argv) > 1:
        return sys.argv[1]
    key = os.environ.get("HELIUS_API_KEY")
    if key:
        return key
    print("Usage: python3 trillionbears_download.py <HELIUS_API_KEY>")
    print("   or: HELIUS_API_KEY=xxx python3 trillionbears_download.py")
    print("\nGet your key at https://dashboard.helius.dev/api-keys")
    sys.exit(1)


def rpc_post(rpc_url, payload):
    req = Request(rpc_url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_all_assets(rpc_url):
    assets = []
    page = 1
    while True:
        payload = {
            "jsonrpc": "2.0",
            "id": "tb",
            "method": "searchAssets",
            "params": {
                "creatorAddress": CREATOR,
                "creatorVerified": True,
                "page": page,
                "limit": 1000,
            },
        }
        data = rpc_post(rpc_url, payload)
        items = data.get("result", {}).get("items", [])
        if not items:
            break
        assets.extend(items)
        print(f"  Fetched page {page}: {len(items)} assets (total: {len(assets)})")
        if len(items) < 1000:
            break
        page += 1
    return assets


def extract_image_info(asset):
    content = asset.get("content", {})
    name = content.get("metadata", {}).get("name", asset.get("id", "unknown"))

    img = None
    links = content.get("links", {})
    if links.get("image"):
        img = links["image"]
    if not img:
        for f in content.get("files", []):
            mime = f.get("mime", f.get("type", ""))
            if "image" in mime:
                img = f.get("uri")
                break

    safe_name = "".join(c if c.isalnum() or c in "-_ " else "" for c in name).strip()
    return safe_name, img


def download_one(idx, name, url):
    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=30) as resp:
            ct = resp.headers.get("Content-Type", "")
            ext = ".png"
            if "jpeg" in ct or "jpg" in ct:
                ext = ".jpg"
            elif "gif" in ct:
                ext = ".gif"
            elif "webp" in ct:
                ext = ".webp"
            data = resp.read()
            (OUT_DIR / f"{name}{ext}").write_bytes(data)
            return idx, name, True, None
    except Exception as e:
        return idx, name, False, str(e)


def main():
    api_key = get_api_key()
    rpc_url = f"https://mainnet.helius-rpc.com/?api-key={api_key}"

    OUT_DIR.mkdir(exist_ok=True)

    print("Step 1/2: Fetching all TRILLIONBEARS assets from Helius DAS API...")
    assets = fetch_all_assets(rpc_url)
    print(f"\nFound {len(assets)} NFTs. Extracting image URLs...")

    download_list = []
    for asset in assets:
        name, img_url = extract_image_info(asset)
        if img_url:
            download_list.append((name, img_url))
        else:
            print(f"  No image URL for: {name}")

    print(f"\n{len(download_list)} images to download")
    print(f"Step 2/2: Downloading ({MAX_WORKERS} threads)...\n")

    t0 = time.time()
    ok = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(download_one, i + 1, name, url): name
            for i, (name, url) in enumerate(download_list)
        }
        for future in as_completed(futures):
            idx, name, success, err = future.result()
            if success:
                ok += 1
                if ok % 50 == 0:
                    print(f"  ... {ok}/{len(download_list)} downloaded")
            else:
                print(f"  FAILED: {name} — {err}")

    elapsed = time.time() - t0
    print(f"\nDone! {ok}/{len(download_list)} images saved to ./{OUT_DIR}/")
    print(f"Time: {elapsed:.1f}s")


if __name__ == "__main__":
    main()
