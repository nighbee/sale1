from prometheus_client import Counter, Histogram

# Matching FastAPI dashboard 16110 metrics
REQUEST_COUNT = Counter(
    'fastapi_requests_total', 'Total number of requests',
    ['app_name', 'method', 'path', 'status_code']
)

REQUEST_LATENCY = Histogram(
    'fastapi_requests_duration_seconds', 'Request latency in seconds',
    ['app_name', 'method', 'path']
)

# Keep these for background events
EVENTS_PROCESSED = Counter(
    'analytics_events_processed_total', 'Total number of analytics events processed',
    ['status']
)
