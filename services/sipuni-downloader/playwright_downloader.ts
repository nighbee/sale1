import { request, APIRequestContext, APIResponse } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Sipuni Reliable Downloader using Playwright APIRequestContext.
 * Handles 304 Not Modified, Cache, and Retries.
 */

const TEST_URL = 'https://sipuni.com/api/crm/record?id=1774934552.1246276&hash=bd7ab6fac60ac921a26a1f547bd26036&user=017910';
const COOKIES = '_ym_uid=1771592049362065890; _ym_d=1771592049; PHPSESSID=59qve8n1qhv3oe6ano0ccs1ri3; hcode=b08edc82ff0a1e9023b9147e31752709; _ym_isad=2; _ym_visorc=w; _ga=GA1.2.1942298808.1774942030; _gid=GA1.2.60345897.1774942030; _gat=1';
const OUTPUT_FILE = 'recording_playwright.mp3';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Downloads audio with forced cache bypass and retries.
 */
async function downloadAudio(url: string, output: string, maxRetries = 3) {
    const apiRequestContext: APIRequestContext = await request.newContext({
        extraHTTPHeaders: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'identity;q=1, *;q=0',
            'Cookie': COOKIES,
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'same-origin',
            // --- CACHE BYPASS HEADERS ---
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
            // We explicitly OMIT 'If-None-Match' and 'If-Modified-Since' to prevent 304
        }
    });

    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
        attempt++;
        // Add cache-busting timestamp (Optional: some APIs fail with unknown params)
        // const separator = url.includes('?') ? '&' : '?';
        // const bustedUrl = `${url}${separator}_t=${Date.now()}`;
        const bustedUrl = url;

        console.log(`[Attempt ${attempt}] Fetching: ${bustedUrl}`);

        try {
            const response: APIResponse = await apiRequestContext.get(bustedUrl);
            const status = response.status();
            const headers = response.headers();

            console.log(`HTTP Status: ${status}`);
            console.log('Response Headers:', JSON.stringify(headers, null, 2));

            // Why 304 occurs: The server thinks we have the file cached.
            // Our headers fix it by telling the server we don't want any cached version.
            if (status === 304) {
                console.warn('Received 304 Not Modified. Retrying with exponential backoff...');
                await delay(Math.pow(2, attempt) * 1000);
                continue;
            }

            if (status === 200 || status === 206) {
                const buffer = await response.body();
                fs.writeFileSync(output, buffer);
                console.log(`Successfully saved to ${output}. Size: ${buffer.length} bytes.`);
                success = true;
            } else {
                console.error(`Unexpected status code: ${status}`);
                await delay(Math.pow(2, attempt) * 1000);
            }
        } catch (error) {
            console.error(`Download error on attempt ${attempt}:`, error);
            await delay(Math.pow(2, attempt) * 1000);
        }
    }

    if (!success) {
        throw new Error(`Failed to download audio after ${maxRetries} attempts.`);
    }

    await apiRequestContext.dispose();
}

async function run() {
    try {
        await downloadAudio(TEST_URL, OUTPUT_FILE);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

run();
