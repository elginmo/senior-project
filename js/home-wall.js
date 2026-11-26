const SAVED_MEDIA_KEY = "rec:saved-media:v1";
const LOGO_ARTWORK = "media/logo-clear.png";

const stage = document.querySelector("#media-grid-stage");
const columnsHost = document.querySelector("#media-grid-columns");
const emptyState = document.querySelector("#media-grid-empty");
const emptyTitle = document.querySelector("#media-grid-empty-title");
const emptyMessage = document.querySelector("#media-grid-empty-message");

function initializeMediaGrid() {
    if (!(stage && columnsHost && emptyState && emptyTitle && emptyMessage)) return;

    const listeners = new AbortController();
    let resizeObserver;
    let lastWidth = 0;
    let lastHeight = 0;
    let savedItems = [];

    const readSavedMedia = () => {
        try {
            const stored = window.localStorage.getItem(SAVED_MEDIA_KEY);
            const parsed = stored ? JSON.parse(stored) : [];
            if (!Array.isArray(parsed)) throw new Error("Saved media data is not a list");
            return {
                items: parsed.filter((media) => media
                    && (media.owned || media.wishlist)
                    && typeof media.title === "string"
                    && media.title.trim()
                    && typeof media.source === "string"
                    && typeof media.type === "string"
                    && media.id != null),
                error: false
            };
        } catch (error) {
            console.error("Could not read saved media for the Home gallery:", error);
            return { items: [], error: true };
        }
    };

    const createTile = (media, decorative = false) => {
        const tile = document.createElement("div");
        tile.className = "media-grid-tile";
        if (decorative) tile.setAttribute("aria-hidden", "true");

        const artwork = document.createElement("img");
        artwork.alt = "";
        artwork.loading = "lazy";
        artwork.decoding = "async";
        artwork.src = typeof media.cover === "string" && media.cover
            ? media.cover
            : LOGO_ARTWORK;
        if (artwork.src.endsWith(LOGO_ARTWORK)) artwork.dataset.logoFallback = "true";
        artwork.addEventListener("error", () => {
            if (artwork.dataset.logoFallback === "true") {
                artwork.hidden = true;
                console.error("Could not load the rec. logo artwork placeholder.");
                return;
            }
            artwork.dataset.logoFallback = "true";
            artwork.src = LOGO_ARTWORK;
        });
        tile.append(artwork);
        return tile;
    };

    const createCycle = (items, decorative) => {
        const cycle = document.createElement("div");
        cycle.className = "media-grid-cycle";
        items.forEach((media) => cycle.append(createTile(media, decorative)));
        return cycle;
    };

    const renderColumns = () => {
        columnsHost.replaceChildren();
        if (!savedItems.length || !stage.clientWidth || !stage.clientHeight) return;

        const mobile = window.matchMedia("(max-width: 700px)").matches;
        const minColumnWidth = mobile ? 92 : 132;
        const gap = mobile ? 7 : 12;
        const availableWidth = Math.max(1, stage.clientWidth - 24);
        const columnCount = Math.min(
            savedItems.length,
            8,
            Math.max(1, Math.floor((availableWidth + gap) / (minColumnWidth + gap)))
        );
        const buckets = Array.from({ length: columnCount }, () => []);
        savedItems.forEach((media, index) => buckets[index % columnCount].push(media));
        columnsHost.style.setProperty("--media-columns", String(columnCount));

        const columnData = buckets.map((items, index) => {
            const column = document.createElement("div");
            column.className = "media-grid-column";

            const track = document.createElement("div");
            track.className = "media-grid-track";
            track.dataset.reverse = String(index % 2 === 1);
            track.style.setProperty("--scroll-duration", `${34 + index * 2.6}s`);
            track.style.setProperty("--scroll-delay", `${-index * 1.3}s`);

            const cycle = createCycle(items, false);
            track.append(cycle);
            column.append(track);
            columnsHost.append(column);
            return { items, track, cycle };
        });

        columnData.forEach(({ items, track, cycle }) => {
            const cycleHeight = cycle.getBoundingClientRect().height;
            if (!cycleHeight) return;

            const cycleCount = Math.max(1, Math.ceil((stage.clientHeight + 1) / cycleHeight));
            for (let copy = 1; copy < cycleCount; copy += 1) {
                items.forEach((media) => cycle.append(createTile(media, true)));
            }
            track.append(createCycle(items, true));
        });
    };

    const refresh = () => {
        const result = readSavedMedia();
        savedItems = result.items;
        columnsHost.hidden = !savedItems.length;
        emptyState.hidden = savedItems.length > 0;
        emptyTitle.textContent = result.error
            ? "SAVED MEDIA UNAVAILABLE."
            : "YOUR ARCHIVE IS WAITING.";
        emptyMessage.textContent = result.error
            ? "Your saved media could not be read in this browser."
            : "Save something from the catalog to see it here.";
        renderColumns();
    };

    window.addEventListener("rec:saved-media-change", refresh, { signal: listeners.signal });
    window.addEventListener("storage", (event) => {
        if (event.key === SAVED_MEDIA_KEY) refresh();
    }, { signal: listeners.signal });

    resizeObserver = new ResizeObserver(() => {
        const { clientWidth, clientHeight } = stage;
        if (clientWidth === lastWidth && clientHeight === lastHeight) return;
        lastWidth = clientWidth;
        lastHeight = clientHeight;
        renderColumns();
    });
    resizeObserver.observe(stage);
    window.addEventListener("pagehide", () => {
        resizeObserver.disconnect();
        listeners.abort();
    }, { once: true });

    refresh();
}

const landingScreen = document.querySelector("#landing-screen");
if (landingScreen && !landingScreen.hidden && !landingScreen.classList.contains("is-dismissed")) {
    const landingObserver = new MutationObserver(() => {
        if (landingScreen.hidden || landingScreen.classList.contains("is-dismissed")) {
            landingObserver.disconnect();
            initializeMediaGrid();
        }
    });
    landingObserver.observe(landingScreen, {
        attributes: true,
        attributeFilter: ["class", "hidden"]
    });
    window.addEventListener("pagehide", () => landingObserver.disconnect(), { once: true });
} else {
    initializeMediaGrid();
}
