import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';

/**
 * Sipuni Reliable Downloader using Node.js Axios.
 * Handles 304 Not Modified, Cache, and Retries.
 *
 * Why 304 occurs: The server thinks the client already has the file based on
 * ETag or Last-Modified date, so it returns "304 Not Modified" instead of the
 * actual audio data.
 *
 * How our headers fix it: We send 'Cache-Control: no-cache' and 'Pragma: no-cache'
 * to tell the server and any intermediate caches that we want a fresh copy.
 * We also ensure 'If-None-Match' and 'If-Modified-Since' are NOT present in the
 * request to prevent the server from performing a cache check.
 *
 * How retries handle cached responses: If we still receive a 304, we catch it
 * (as we've allowed it through 'validateStatus'), log a warning, and retry
 * after a delay (exponential backoff) to increase the chance of a successful
 * fresh download.
 */

// Use environment variables for sensitive data and dynamic inputs
const SIPUNI_URL = process.env.SIPUNI_URL || 'https://sipuni.com/api/crm/record?id=1774934552.1246276&hash=bd7ab6fac60ac921a26a1f547bd26036&user=017910';
const SIPUNI_COOKIES = process.env.SIPUNI_COOKIES || ''; // Example: "PHPSESSID=...; hcode=...; user=..."
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'recording_node.mp3';

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Downloads audio with forced cache bypass and retries.
 */
async function downloadAudio(url: string, output: string, cookies: string, maxRetries = 3) {
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
        attempt++;
        console.log(`\n[Attempt ${attempt}] Fetching: ${url}`);

        try {
            const response: AxiosResponse = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Cookie': cookies,
                    'Range': 'bytes=0-', // Force download from the beginning
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                    // We explicitly OMIT 'If-None-Match' and 'If-Modified-Since'
                },
                // Allow 304 so we can manually handle it in our retry loop
                validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
                timeout: 30000
            });

            const status = response.status;
            const headers = response.headers;

            console.log(`HTTP Status: ${status}`);
            console.log('Response Headers:', JSON.stringify(headers, null, 2));

            if (status === 304) {
                console.warn('Received 304 Not Modified. Server is still attempting to serve from cache. Retrying with exponential backoff...');
                await delay(Math.pow(2, attempt) * 1000);
                continue;
            }

            if (status === 200 || status === 206) {
                const data = response.data;
                fs.writeFileSync(output, data);
                const fileSize = fs.statSync(output).size;
                console.log(`Successfully saved to ${output}. Final file size: ${fileSize} bytes.`);
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
}

async function run() {
    try {
        if (!SIPUNI_COOKIES) {
            console.warn('Warning: SIPUNI_COOKIES is not set. The download might fail if authentication is required.');
        }
        await downloadAudio(SIPUNI_URL, OUTPUT_FILE, SIPUNI_COOKIES);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

run();
