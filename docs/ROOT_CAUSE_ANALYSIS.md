# Root Cause Analysis: Silent HTTP Download Failures

## Overview
The STT service experienced issues where audio downloads from external URLs (e.g., Sipuni) would return an HTTP 200 OK status but result in incomplete or empty files without raising any exceptions.

## Potential Root Causes

### 1. Incomplete Stream Read
The `httpx` client or the server might terminate the connection before the entire content is transferred. If the client doesn't explicitly check if the number of bytes received matches the `Content-Length` header, it may assume the transfer completed successfully.

### 2. Connection Stalls without Timeout Triggers
Standard socket timeouts (connect/read) often only trigger if no data is received for a certain period. However, if a server sends data extremely slowly (e.g., 1 byte every 29 seconds) or the TCP connection hangs in a way that doesn't trigger the library's internal timeout, the download can "stall" indefinitely or terminate prematurely without an error.

### 3. Improper Async Stream Consumption
If the `async for chunk in response.aiter_bytes()` loop exits because the generator finishes, but the server actually closed the connection prematurely (e.g., via a TCP FIN/RST), some async libraries might not raise an exception if they interpreted the closure as a clean end-of-stream.

### 4. Chunked Transfer Encoding Issues
For responses using `Transfer-Encoding: chunked`, there is no `Content-Length` header. If the stream is interrupted before the "final zero-length chunk" is received, some clients might not detect the truncation as an error.

### 5. Proxy / CDN Behavior
Intermediaries like Nginx or Cloudflare might return a 200 OK header but then fail to fetch the full body from the upstream server, closing the downstream connection once the upstream buffer is exhausted.

### 6. Missing Content-Length Validation
Without a post-download check comparing the expected size (from headers) to the actual size on disk, the system remains blind to "successful" but partial downloads.

### 7. Buffered I/O Stalls
Synchronous file writes in an async loop can cause the event loop to lag. If the lag is severe enough, it might interfere with the network stack's ability to process keep-alive packets or window updates, leading to connection drops.
