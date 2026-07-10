const CACHE_NAME = "answrit-v1";
const STATIC_ASSETS = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/manifest.json",
    "/images/answrit-logo.png",
    "/images/answrit-icon.png",
];

const EXAM_API_PATHS = ["/api/exams", "/api/load", "/api/test", "/api/exam-questions"];
const MASTERY_API_PATHS = ["/api/mastery", "/api/mastery/batch"];

function isStaticAsset(path) {
    return STATIC_ASSETS.includes(path) || path.startsWith("/images/");
}

function isExamApi(path) {
    return EXAM_API_PATHS.includes(path);
}

function isMasteryApi(path) {
    return MASTERY_API_PATHS.includes(path);
}

async function fetchAndCache(request, cache) {
    const response = await fetch(request);
    if (response.ok) {
        cache.put(request, response.clone());
    }
    return response;
}

async function networkWithCacheFallback(request, cache) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw err;
    }
}

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    const path = url.pathname;

    if (isStaticAsset(path)) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                const cached = await cache.match(request);
                return cached || fetchAndCache(request, cache);
            })
        );
        return;
    }

    if (isExamApi(path) || isMasteryApi(path)) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => networkWithCacheFallback(request, cache))
        );
        return;
    }

    // Everything else (auth, score, chat, flashcard reviews) is network-only.
});
