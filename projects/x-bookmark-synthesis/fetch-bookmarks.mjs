#!/usr/bin/env node
/**
 * X Bookmark Fetcher
 * OAuth 2.0 PKCE flow → fetch bookmarks → dump to JSON
 * Supports incremental mode: only fetches bookmarks newer than last pull
 * Zero dependencies — Node built-ins only
 */

import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { URL, URLSearchParams } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Config ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ENV_PATH = join(__dirname, '.env');
const TOKEN_PATH = join(__dirname, 'tokens.json');
const STATE_PATH = join(__dirname, 'fetch-state.json');

function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    console.error('Missing .env file — copy .env.example to .env and add your Client ID');
    process.exit(1);
  }
  const lines = readFileSync(ENV_PATH, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    process.env[key] = val;
  }
}

loadEnv();

const CLIENT_ID = process.env.X_CLIENT_ID;
const REDIRECT_URI = process.env.X_REDIRECT_URI || 'http://localhost:8080/callback';
const SCOPES = process.env.X_SCOPES || 'tweet.read users.read bookmark.read offline.access';
const FETCH_LIMIT = parseInt(process.env.FETCH_LIMIT || '200', 10);
const FULL_MODE = process.argv.includes('--full');

if (!CLIENT_ID || CLIENT_ID === 'your-client-id-here') {
  console.error('X_CLIENT_ID not set in .env — see README for setup instructions');
  process.exit(1);
}

// --- State Management (incremental fetch tracking) ---
function loadState() {
  if (!existsSync(STATE_PATH)) return { last_bookmark_id: null, last_fetch_at: null, total_fetched: 0 };
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { last_bookmark_id: null, last_fetch_at: null, total_fetched: 0 };
  }
}

function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

// --- PKCE Helpers ---
function generateCodeVerifier() {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

// --- Token Management ---
function loadTokens() {
  if (!existsSync(TOKEN_PATH)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveTokens(tokens) {
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('Tokens saved to tokens.json');
}

async function exchangeCode(code, codeVerifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 7200) * 1000,
  };
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + (data.expires_in || 7200) * 1000,
  };
}

// --- OAuth Flow ---
async function doOAuthFlow() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString('hex');

  const authUrl = new URL('https://x.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:8080`);

      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400);
        res.end(`OAuth error: ${error}`);
        server.close();
        reject(new Error(`OAuth denied: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400);
        res.end('State mismatch');
        server.close();
        reject(new Error('OAuth state mismatch'));
        return;
      }

      try {
        const tokens = await exchangeCode(code, codeVerifier);
        saveTokens(tokens);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authorized! You can close this tab.</h1></body></html>');
        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500);
        res.end(`Token exchange error: ${err.message}`);
        server.close();
        reject(err);
      }
    });

    server.listen(8080, () => {
      console.log('\n=== OAuth Authorization Required ===');
      console.log('Opening browser...\n');

      try {
        execSync(`open "${authUrl.toString()}"`);
      } catch {
        console.log('Could not open browser automatically.');
        console.log(`Open this URL manually:\n\n${authUrl.toString()}\n`);
      }

      console.log('Waiting for callback on http://localhost:8080/callback ...');
    });

    setTimeout(() => {
      server.close();
      reject(new Error('OAuth flow timed out (2 minutes)'));
    }, 120_000);
  });
}

// --- Get valid access token ---
async function getAccessToken() {
  let tokens = loadTokens();

  if (tokens?.access_token && tokens.expires_at > Date.now() + 60_000) {
    console.log('Using cached access token');
    return tokens.access_token;
  }

  if (tokens?.refresh_token) {
    console.log('Refreshing access token...');
    try {
      tokens = await refreshAccessToken(tokens.refresh_token);
      saveTokens(tokens);
      return tokens.access_token;
    } catch (err) {
      console.warn(`Refresh failed: ${err.message}. Starting new OAuth flow.`);
    }
  }

  console.log('No valid tokens. Starting OAuth flow...');
  tokens = await doOAuthFlow();
  return tokens.access_token;
}

// --- Fetch User ID ---
async function fetchUserId(accessToken) {
  const res = await fetch('https://api.x.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`/users/me failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log(`Authenticated as: @${data.data.username} (ID: ${data.data.id})`);
  return data.data.id;
}

// --- Fetch Bookmarks (with incremental early-stop) ---
async function fetchBookmarks(accessToken, userId, limit, stopAtId) {
  const allBookmarks = [];
  let paginationToken = null;
  const maxPerPage = 100;
  let page = 0;
  let hitKnownBookmark = false;

  const fields = [
    'tweet.fields=created_at,author_id,public_metrics,entities,attachments',
    'expansions=author_id,attachments.media_keys',
    'user.fields=username,name,profile_image_url',
    'media.fields=url,preview_image_url,type',
  ].join('&');

  while (allBookmarks.length < limit) {
    page++;
    const remaining = limit - allBookmarks.length;
    const pageSize = Math.min(maxPerPage, remaining);

    let url = `https://api.x.com/2/users/${userId}/bookmarks?max_results=${pageSize}&${fields}`;
    if (paginationToken) {
      url += `&pagination_token=${paginationToken}`;
    }

    console.log(`Fetching page ${page} (${allBookmarks.length}/${limit} so far)...`);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 402) {
        console.error('X API credits depleted. Check your balance at console.x.com');
      }
      throw new Error(`Bookmarks fetch failed (${res.status}): ${text}`);
    }

    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      console.log('No more bookmarks to fetch.');
      break;
    }

    // Build lookup maps
    const userMap = {};
    if (data.includes?.users) {
      for (const u of data.includes.users) {
        userMap[u.id] = { username: u.username, name: u.name, profile_image_url: u.profile_image_url };
      }
    }

    const mediaMap = {};
    if (data.includes?.media) {
      for (const m of data.includes.media) {
        mediaMap[m.media_key] = { type: m.type, url: m.url || m.preview_image_url };
      }
    }

    // Enrich bookmarks, stop at known ID
    for (const tweet of data.data) {
      // Incremental: stop when we hit a bookmark we've already seen
      if (stopAtId && tweet.id === stopAtId) {
        console.log(`  Hit known bookmark ${stopAtId} — stopping (incremental mode)`);
        hitKnownBookmark = true;
        break;
      }

      const author = userMap[tweet.author_id] || {};
      const mediaKeys = tweet.attachments?.media_keys || [];
      const media = mediaKeys.map(k => mediaMap[k]).filter(Boolean);

      const urls = (tweet.entities?.urls || []).map(u => ({
        url: u.url,
        expanded_url: u.expanded_url,
        title: u.title,
        description: u.description,
      }));

      allBookmarks.push({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        author: {
          id: tweet.author_id,
          username: author.username,
          name: author.name,
        },
        tweet_url: `https://x.com/${author.username || 'i'}/status/${tweet.id}`,
        metrics: tweet.public_metrics,
        urls,
        media,
      });
    }

    if (hitKnownBookmark) break;

    console.log(`  Got ${data.data.length} tweets (${allBookmarks.length} total)`);

    paginationToken = data.meta?.next_token;
    if (!paginationToken) {
      console.log('Reached end of bookmarks.');
      break;
    }
  }

  return allBookmarks;
}

// --- Date string for folder naming ---
function getDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// --- Main ---
async function main() {
  const state = loadState();
  const isIncremental = !FULL_MODE && state.last_bookmark_id;
  const dateStr = getDateString();

  console.log('=== X Bookmark Fetcher ===\n');

  if (isIncremental) {
    console.log(`Mode: INCREMENTAL (fetching new bookmarks since ${state.last_fetch_at})`);
    console.log(`Stop-at ID: ${state.last_bookmark_id}\n`);
  } else {
    console.log(`Mode: FULL (fetching up to ${FETCH_LIMIT} bookmarks)\n`);
  }

  const accessToken = await getAccessToken();
  const userId = await fetchUserId(accessToken);

  const stopAtId = isIncremental ? state.last_bookmark_id : null;
  const bookmarks = await fetchBookmarks(accessToken, userId, FETCH_LIMIT, stopAtId);

  if (bookmarks.length === 0) {
    console.log('\nNo new bookmarks since last fetch.');
    return;
  }

  // Create dated output folder
  const pullDir = join(__dirname, 'pulls', dateStr);
  mkdirSync(pullDir, { recursive: true });

  // Save raw data to dated folder
  const output = {
    fetched_at: new Date().toISOString(),
    mode: isIncremental ? 'incremental' : 'full',
    count: bookmarks.length,
    user_id: userId,
    previous_newest_id: state.last_bookmark_id,
    bookmarks,
  };

  const outputPath = join(pullDir, 'raw-bookmarks.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  // Update state with newest bookmark ID
  const newState = {
    last_bookmark_id: bookmarks[0].id,
    last_fetch_at: new Date().toISOString(),
    total_fetched: state.total_fetched + bookmarks.length,
  };
  saveState(newState);

  // Stats
  const authors = new Set(bookmarks.map(b => b.author.username));
  const withMedia = bookmarks.filter(b => b.media.length > 0).length;
  const withUrls = bookmarks.filter(b => b.urls.length > 0).length;
  const estCost = (Math.ceil(bookmarks.length / 100) * 0.05 + 0.01).toFixed(2);

  console.log(`\nSaved ${bookmarks.length} bookmarks to ${outputPath}`);
  console.log(`\n--- Stats ---`);
  console.log(`Unique authors: ${authors.size}`);
  console.log(`With media: ${withMedia}`);
  console.log(`With URLs: ${withUrls}`);
  console.log(`Estimated API cost: $${estCost}`);
  console.log(`\nOutput: pulls/${dateStr}/`);
  console.log(`Digests folder ready: pulls/${dateStr}/digests/ (Claude will synthesize here)`);
}

main().catch(err => {
  console.error(`\nFatal: ${err.message}`);
  process.exit(1);
});
