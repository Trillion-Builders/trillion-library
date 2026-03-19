#!/usr/bin/env python3
"""Retry download for missing TRILLIONBEARS images. Skips already-downloaded."""

import os, sys, json, time
from pathlib import Path
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed

CREATOR = "FCkaSc9FqGrQTfP6NkiyempWZShcUZssutVhHUmf93cW"
OUT_DIR = Path("trillionbears_images")
MAX_WORKERS = 10
API_KEY = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("HELIUS_API_KEY", "")


def rpc_post(rpc_url, payload):
    req = Request(rpc_url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def fetch_all_assets(rpc_url):
    assets, page = [], 1
    while True:
        data = rpc_post(rpc_url, {
            "jsonrpc": "2.0", "id": "tb", "method": "searchAssets",
            "params": {"creatorAddress": CREATOR, "creatorVerified": True, "page": page, "limit": 1000},
        })
        items = data.get("result", {}).get("items", [])
        if not items:
            break
        assets.extend(items)
        print(f"  Fetched page {page}: {len(items)} assets")
        if len(items) < 1000:
            break
        page += 1
    return assets


def extract_image_info(asset):
    content = asset.get("content", {})
    name = content.get("metadata", {}).get("name", "").strip()
    mint = asset.get("id", "unknown")
    if not name:
        name = mint

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
    return safe_name, img, mint


def already_downloaded(name):
    for ext in (".png", ".jpg", ".gif", ".webp"):
        if (OUT_DIR / f"{name}{ext}").exists():
            return True
    return False


def download_one(name, url, mint):
    for attempt in range(3):
        try:
            req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urlopen(req, timeout=60) as resp:
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
                return name, True, None
        except Exception as e:
            if attempt == 2:
                return name, False, str(e)
            time.sleep(2)
    return name, False, "max retries"


def main():
    rpc_url = f"https://mainnet.helius-rpc.com/?api-key={API_KEY}"
    OUT_DIR.mkdir(exist_ok=True)

    print("Fetching asset list...")
    assets = fetch_all_assets(rpc_url)
    print(f"Total: {len(assets)} NFTs\n")

    missing = []
    for asset in assets:
        name, img_url, mint = extract_image_info(asset)
        if not img_url:
            print(f"  No image URL: {name} ({mint})")
            continue
        if already_downloaded(name):
            continue
        missing.append((name, img_url, mint))

    if not missing:
        print("All images already downloaded!")
        return

    print(f"{len(missing)} missing images to download (3 retries each, 60s timeout)...\n")
    t0 = time.time()
    ok = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(download_one, n, u, m): n for n, u, m in missing}
        for f in as_completed(futures):
            name, success, err = f.result()
            if success:
                ok += 1
                print(f"  OK: {name}")
            else:
                print(f"  FAILED: {name} — {err}")

    print(f"\nDone! {ok}/{len(missing)} recovered in {time.time() - t0:.1f}s")
    total = len(list(OUT_DIR.glob("*.*")))
    print(f"Total images in folder: {total}")


if __name__ == "__main__":
    main()
