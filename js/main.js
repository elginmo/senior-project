 /* api configuration */

const RAWG_API_KEY = "f9348139565246ab8474bc98e4b22f83";
const TMDB_API_KEY = "dfe9ca507016c94d33455c5a93128a2f";

const API = {
    rawg: "https://api.rawg.io/api",
    musicbrainz: "https://musicbrainz.org/ws/2",
    coverArt: "https://coverartarchive.org",
    tmdb: "https://api.themoviedb.org/3"
};


/* api functions */

async function searchGames(query) {
    const url = `${API.rawg}/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(query)}&page_size=10`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`RAWG request failed (${response.status})`);
    const data = await response.json();
    return (data.results || []).map((game) => ({
            id: game.id,
            title: game.name,
            type: "game",
            cover: game.background_image || null,
            releaseDate: game.released || null,
            creator: game.developers?.map((developer) => developer.name).join(", ") || null,
            publisher: game.publishers?.map((publisher) => publisher.name).join(", ") || null,
            description: game.description_raw || null,
            genres: game.genres?.map((genre) => genre.name) || [],
            platforms: game.platforms?.map((platform) => platform.platform.name) || [],
            rating: game.rating ?? null,
            source: "rawg"
    }));
}


async function searchMovies(query) {
    const url = `${API.tmdb}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TMDB movie search failed (${response.status})`);
    const data = await response.json();
    return (data.results || []).map((movie) => ({
            id: movie.id,
            title: movie.title,
            type: "movie",
            cover: movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : null,
            releaseDate: movie.release_date || null,
            creator: null,
            publisher: null,
            description: movie.overview || null,
            genres: [],
            platforms: [],
            rating: movie.vote_average ?? null,
            source: "tmdb"
    }));
}

async function searchTelevision(query) {
    const url = `${API.tmdb}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TMDB TV search failed (${response.status})`);
    const data = await response.json();
    return (data.results || []).map((show) => ({
        id: show.id,
        title: show.name,
        type: "tv",
        cover: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : null,
        releaseDate: show.first_air_date || null,
        creator: null,
        publisher: null,
        description: show.overview || null,
        genres: [],
        platforms: [],
        rating: show.vote_average ?? null,
        source: "tmdb"
    }));
}

async function searchMusic(query) {
    const url = `${API.musicbrainz}/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
    const response = await fetch(url, {
        headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`MusicBrainz request failed (${response.status})`);
    const data = await response.json();
    return (data["release-groups"] || []).map((album) => ({
            id: album.id,
            title: album.title,
            type: "music",
            cover: `${API.coverArt}/release-group/${album.id}/front-500`,
            releaseDate: album["first-release-date"] || null,
            creator: album["artist-credit"]?.[0]?.name || null,
            publisher: null,
            description: null,
            genres: album.genres?.map((genre) => genre.name) || [],
            platforms: [],
            rating: null,
            source: "musicbrainz"
    }));
}

async function searchMedia(query, category) {
    const requests = category === "games"
        ? [["RAWG", searchGames(query)]]
        : category === "music"
            ? [["MusicBrainz", searchMusic(query)]]
            : category === "movies-tv"
                ? [["TMDB movies", searchMovies(query)], ["TMDB TV", searchTelevision(query)]]
                : [
                    ["RAWG", searchGames(query)],
                    ["MusicBrainz", searchMusic(query)],
                    ["TMDB movies", searchMovies(query)],
                    ["TMDB TV", searchTelevision(query)]
                ];
    const settled = await Promise.allSettled(requests.map(([, request]) => request));
    const results = [];
    const errors = [];

    settled.forEach((result, index) => {
        if (result.status === "fulfilled") {
            results.push(...result.value);
        } else {
            console.error(`${requests[index][0]} search failed:`, result.reason);
            errors.push(requests[index][0]);
        }
    });
    return { results, errors };
}

function mediaDetailsUrl(media, query, category) {
    const params = new URLSearchParams({
        source: media.source,
        type: media.type,
        id: String(media.id)
    });
    if (query) {
        params.set("q", query);
        params.set("category", category);
    }
    return `media-details.html?${params}`;
}

const savedMediaKey = "rec:saved-media:v1";
const activityKey = "rec:activity:v1";
const foldersKey = "rec:folders:v1";

function readSavedMedia() {
    try {
        const saved = window.localStorage.getItem(savedMediaKey);
        const items = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(items)) throw new Error("Saved media data is not a list");
        return items;
    } catch (error) {
        console.error("Could not read saved media:", error);
        return [];
    }
}

function readActivity() {
    try {
        const activity = window.localStorage.getItem(activityKey);
        const entries = activity ? JSON.parse(activity) : [];
        if (!Array.isArray(entries)) throw new Error("Activity data is not a list");
        return entries;
    } catch (error) {
        console.error("Could not read recent activity:", error);
        return [];
    }
}

function readFolders() {
    try {
        const folders = window.localStorage.getItem(foldersKey);
        const entries = folders ? JSON.parse(folders) : [];
        if (!Array.isArray(entries)) throw new Error("Folder data is not a list");
        return entries.filter((folder) => typeof folder === "string");
    } catch (error) {
        console.error("Could not read folders:", error);
        return [];
    }
}

function dispatchSavedMediaChange() {
    window.dispatchEvent(new CustomEvent("rec:saved-media-change"));
}

function recordActivity(action, membership, media) {
    const activity = readActivity();
    activity.unshift({
        action,
        membership,
        title: media.title,
        type: media.type,
        at: new Date().toISOString()
    });
    try {
        window.localStorage.setItem(activityKey, JSON.stringify(activity.slice(0, 30)));
    } catch (error) {
        console.error("Could not save recent activity:", error);
    }
}

function saveMediaMembership(media, membership) {
    const savedItems = readSavedMedia();
    const itemKey = `${media.source}:${media.type}:${media.id}`;
    const existing = savedItems.find((item) => `${item.source}:${item.type}:${item.id}` === itemKey);
    const isNewMembership = !existing?.[membership];
    if (existing) {
        existing[membership] = true;
        Object.assign(existing, Object.fromEntries(
            Object.entries(media).filter(([, value]) => value != null)
        ));
    } else {
        savedItems.push({ ...media, addedAt: new Date().toISOString(), [membership]: true });
    }
    window.localStorage.setItem(savedMediaKey, JSON.stringify(savedItems));
    if (isNewMembership) recordActivity("added", membership, media);
    dispatchSavedMediaChange();
}

function removeMediaMembership(source, type, id, membership) {
    const savedItems = readSavedMedia();
    const index = savedItems.findIndex((item) => item.source === source
        && item.type === type && String(item.id) === String(id));
    if (index < 0 || !savedItems[index][membership]) return;

    const media = savedItems[index];
    media[membership] = false;
    if (!media.owned && !media.wishlist) savedItems.splice(index, 1);
    window.localStorage.setItem(savedMediaKey, JSON.stringify(savedItems));
    recordActivity("removed", membership, media);
    dispatchSavedMediaChange();
}

function renderRecentlyAdded() {
    const grid = document.querySelector(".recently-grid");
    const emptyState = document.querySelector("[data-recent-empty]");
    if (!grid || !emptyState) return;

    const items = readSavedMedia()
        .filter((media) => media && (media.owned || media.wishlist) && media.title && media.source && media.type && media.id != null)
        .sort((first, second) => (second.addedAt || "").localeCompare(first.addedAt || ""))
        .slice(0, 3);
    grid.replaceChildren();
    items.forEach((media) => {
        const link = document.createElement("a");
        link.className = "home-media-card";
        link.href = mediaDetailsUrl(media);
        link.setAttribute("aria-label", `View details for ${media.title}`);

        const artwork = document.createElement("div");
        artwork.className = "home-media-art";
        if (media.cover) {
            const image = document.createElement("img");
            image.src = media.cover;
            image.alt = `${media.title} artwork`;
            image.loading = "lazy";
            image.addEventListener("error", () => {
                image.remove();
                artwork.classList.add("artwork-unavailable");
            }, { once: true });
            artwork.append(image);
        } else {
            artwork.classList.add("artwork-unavailable");
        }

        const info = document.createElement("div");
        info.className = "home-media-info";
        const title = document.createElement("h3");
        title.textContent = media.title;
        const metadata = document.createElement("span");
        const category = { game: "GAME", music: "MUSIC", movie: "MOVIE", tv: "TELEVISION" }[media.type] || "MEDIA";
        const year = media.releaseDate ? ` / ${media.releaseDate.slice(0, 4)}` : "";
        metadata.textContent = `${category}${year}`;
        info.append(title, metadata);
        link.append(artwork, info);
        grid.append(link);
    });
    emptyState.hidden = items.length > 0;
}

function renderProfileData() {
    const profilePage = document.querySelector(".profile-page");
    if (!profilePage) return;

    const items = readSavedMedia();
    const owned = items.filter((item) => item.owned);
    const wishlist = items.filter((item) => item.wishlist);
    const counts = {
        owned: owned.length,
        game: owned.filter((item) => item.type === "game").length,
        music: owned.filter((item) => item.type === "music").length,
        movies: owned.filter((item) => item.type === "movie" || item.type === "tv").length,
        wishlist: wishlist.length
    };
    Object.entries(counts).forEach(([name, count]) => {
        const number = profilePage.querySelector(`[data-profile-stat="${name}"]`);
        if (number) number.textContent = String(count).padStart(2, "0");
    });

    const activityList = profilePage.querySelector(".activity-list");
    const recordedActivity = readActivity();
    const activity = (recordedActivity.length ? recordedActivity : items.flatMap((media) => {
        return ["owned", "wishlist"]
            .filter((membership) => media[membership])
            .map((membership) => ({
                action: "added",
                membership,
                title: media.title,
                type: media.type,
                at: media.addedAt
            }));
    }).sort((first, second) => (second.at || "").localeCompare(first.at || ""))).slice(0, 5);
    activityList.replaceChildren();
    if (!activity.length) {
        const emptyState = document.createElement("p");
        emptyState.className = "activity-empty-state";
        emptyState.textContent = "NO RECENT ACTIVITY. ADD MEDIA FROM SEARCH TO START YOUR LOG.";
        activityList.append(emptyState);
        return;
    }

    activity.forEach((entry, index) => {
        const item = document.createElement("article");
        item.className = "activity-item";
        const number = document.createElement("span");
        number.className = "activity-index";
        number.textContent = String(index + 1).padStart(2, "0");
        const description = document.createElement("p");
        const action = entry.action === "removed" ? "Removed" : "Added";
        const membership = entry.membership === "wishlist" ? "wishlist" : "collection";
        description.append(`${action} `);
        const title = document.createElement("strong");
        title.textContent = entry.title || "an item";
        description.append(title, ` ${entry.action === "removed" ? "from" : "to"} ${membership}`);
        const time = document.createElement("time");
        const timestamp = Date.parse(entry.at);
        if (Number.isFinite(timestamp)) {
            time.dateTime = new Date(timestamp).toISOString();
            const elapsed = Math.max(0, Date.now() - timestamp);
            const days = Math.floor(elapsed / 86400000);
            time.textContent = days === 0 ? "TODAY" : days === 1 ? "1 DAY AGO" : `${days} DAYS AGO`;
        } else {
            time.textContent = "";
        }
        item.append(number, description, time);
        activityList.append(item);
    });
}

function renderMediaSearchPage() {
    const form = document.querySelector("#media-search-form");
    const queryInput = form?.querySelector("[name=q]");
    const categoryInput = form?.querySelector("[name=category]");
    if (!form || !queryInput || !categoryInput) return;

    const params = new URLSearchParams(window.location.search);
    queryInput.value = params.get("q") || "";
    categoryInput.value = params.get("category") || "all";

    if (document.body.dataset.page === "search") return;

    const resultsHeading = document.querySelector("#search-results-heading");
    const resultsContainer = document.querySelector("#search-results");
    const status = document.querySelector("#search-status");
    if (!resultsHeading || !resultsContainer || !status) return;

    const query = queryInput.value.trim();
    if (!query) {
        status.textContent = "Enter a search term to find media.";
        return;
    }
    resultsHeading.textContent = `Results for “${query}”`;
    resultsHeading.focus();
    status.textContent = "Searching media catalogs…";
    resultsContainer.setAttribute("aria-busy", "true");

    searchMedia(query, categoryInput.value).then(({ results, errors }) => {
        resultsContainer.replaceChildren();
        results.forEach((media) => {
            const link = document.createElement("a");
            link.className = "search-result-card";
            link.href = mediaDetailsUrl(media, query, categoryInput.value);
            const image = document.createElement("img");
            image.className = "search-result-artwork";
            image.alt = "";
            image.loading = "lazy";
            image.src = media.cover || "";
            image.hidden = !media.cover;
            image.addEventListener("error", () => { image.hidden = true; }, { once: true });
            const info = document.createElement("span");
            info.className = "search-result-info";
            const title = document.createElement("strong");
            title.textContent = media.title;
            const type = document.createElement("span");
            type.textContent = `${media.type.toUpperCase()} · ${media.source.toUpperCase()}${media.releaseDate ? ` · ${media.releaseDate.slice(0, 4)}` : ""}`;
            info.append(title, type);
            link.append(image, info);
            resultsContainer.append(link);
        });
        if (errors.length && results.length) {
            status.textContent = `${results.length} result${results.length === 1 ? "" : "s"} found. Some catalogs could not be reached: ${errors.join(", ")}.`;
        } else if (errors.length) {
            status.textContent = `Could not search ${errors.join(", ")}. Please try again.`;
        } else if (results.length) {
            status.textContent = `${results.length} result${results.length === 1 ? "" : "s"} found.`;
        } else {
            status.textContent = "No results found.";
        }
    }).catch((error) => {
        console.error("Media search failed:", error);
        status.textContent = "Search could not be completed. Please try again.";
    }).finally(() => {
        resultsContainer.removeAttribute("aria-busy");
    });
}

function renderMediaDetailsPage() {
    const container = document.querySelector("#media-details");
    if (!container) return;
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const type = params.get("type");
    const id = params.get("id");
    const status = document.querySelector("#details-status");
    const heading = document.querySelector("#details-heading");
    const actions = document.querySelector("#media-actions");
    const backLink = document.querySelector("#details-back-link");
    const artworkWrap = document.querySelector("#details-artwork-wrap");
    const categoryLabel = document.querySelector("#details-category");
    const releaseLabel = document.querySelector("#details-release");
    const creatorLabel = document.querySelector("#details-creator");
    const publisherLabel = document.querySelector("#details-publisher");
    const genresList = document.querySelector("#details-genres");
    const aboutSection = document.querySelector("#details-about");
    const description = document.querySelector("#details-description");
    const catalogSection = document.querySelector("#details-catalog");
    const catalogGrid = document.querySelector("#details-catalog-grid");
    if (backLink && params.has("q")) {
        backLink.href = `search-results.html?${new URLSearchParams({
            q: params.get("q"),
            category: params.get("category") || "all"
        })}`;
        backLink.textContent = "← Back to results";
    }
    if (!source || !type || !id || !status || !heading || !actions || !artworkWrap
        || !categoryLabel || !releaseLabel || !creatorLabel || !publisherLabel || !genresList
        || !aboutSection || !description || !catalogSection || !catalogGrid) {
        status.textContent = "This media link is incomplete.";
        return;
    }

    const formatDate = (value) => {
        if (!value) return "";
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (!match) return value;
        return new Intl.DateTimeFormat(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "UTC"
        }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
    };

    const appendArtworkFallback = (title) => {
        const fallback = document.createElement("div");
        fallback.className = "details-artwork-missing";
        fallback.setAttribute("role", "img");
        fallback.setAttribute("aria-label", `${title} artwork unavailable`);
        fallback.textContent = "ARTWORK UNAVAILABLE";
        artworkWrap.replaceChildren(fallback);
    };

    const loadDetails = async () => {
        let media;
        if (source === "rawg" && type === "game") {
            const response = await fetch(`${API.rawg}/games/${encodeURIComponent(id)}?key=${RAWG_API_KEY}`);
            if (!response.ok) throw new Error(`RAWG details failed (${response.status})`);
            const game = await response.json();
            media = {
                id: game.id,
                source,
                type,
                title: game.name,
                cover: game.background_image || null,
                releaseDate: game.released || null,
                creator: game.developers?.map((item) => item.name).join(", ") || null,
                publisher: game.publishers?.map((item) => item.name).join(", ") || null,
                description: game.description_raw || null,
                genres: game.genres?.map((item) => item.name) || [],
                platforms: game.platforms?.map((item) => item.platform.name) || []
            };
        } else if (source === "tmdb" && (type === "movie" || type === "tv")) {
            const kind = type === "tv" ? "tv" : "movie";
            const response = await fetch(`${API.tmdb}/${kind}/${encodeURIComponent(id)}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
            if (!response.ok) throw new Error(`TMDB ${kind} details failed (${response.status})`);
            const item = await response.json();
            const director = item.credits?.crew?.find((person) => person.job === "Director")?.name;
            media = {
                id: item.id,
                source,
                type,
                title: item.title || item.name,
                cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                releaseDate: item.release_date || item.first_air_date || null,
                creator: director || item.created_by?.map((person) => person.name).join(", ") || null,
                publisher: item.production_companies?.map((company) => company.name).filter(Boolean).join(", ") || null,
                description: item.overview || null,
                genres: item.genres?.map((genre) => genre.name) || [],
                platforms: [],
                cast: item.credits?.cast?.slice(0, 8).map((person) => person.name) || [],
                runtime: item.runtime || item.episode_run_time?.[0] || null
            };
        } else if (source === "musicbrainz" && type === "music") {
            const response = await fetch(`${API.musicbrainz}/release-group/${encodeURIComponent(id)}?inc=artists+releases+genres&fmt=json`, {
                headers: { Accept: "application/json" }
            });
            if (!response.ok) throw new Error(`MusicBrainz details failed (${response.status})`);
            const album = await response.json();
            media = {
                id: album.id,
                source,
                type,
                title: album.title,
                cover: `${API.coverArt}/release-group/${album.id}/front-500`,
                releaseDate: album["first-release-date"] || null,
                creator: album["artist-credit"]?.map((artist) => artist.name).join(", ") || null,
                publisher: null,
                description: null,
                genres: album.genres?.map((genre) => genre.name) || [],
                platforms: [],
                releases: [...new Set((album.releases || []).slice(0, 8)
                    .map((release) => [release.title, release.date, release.country].filter(Boolean).join(" / "))
                    .filter(Boolean))]
            };
        } else {
            throw new Error("This media source and type are not supported.");
        }

        heading.textContent = media.title;
        document.title = `rec. | ${media.title}`;
        container.dataset.type = type;
        if (media.cover) {
            const image = document.createElement("img");
            image.className = "details-artwork";
            image.src = media.cover;
            image.alt = `${media.title} artwork`;
            image.addEventListener("error", () => appendArtworkFallback(media.title), { once: true });
            artworkWrap.replaceChildren(image);
        } else {
            appendArtworkFallback(media.title);
        }

        const categoryNames = {
            game: "VIDEO GAME",
            music: "ALBUM",
            movie: "FILM",
            tv: "TELEVISION"
        };
        const creatorNames = {
            game: "Developer",
            music: "Artist",
            movie: "Director",
            tv: "Creator"
        };
        categoryLabel.textContent = categoryNames[type];
        releaseLabel.textContent = media.releaseDate
            ? `${type === "music" ? "First released" : type === "tv" ? "First aired" : "Released"} / ${formatDate(media.releaseDate)}`
            : "";
        creatorLabel.textContent = media.creator ? `${creatorNames[type]} / ${media.creator}` : "";
        publisherLabel.textContent = media.publisher
            ? `${type === "game" ? "Publisher" : "Studio"} / ${media.publisher}`
            : "";

        genresList.replaceChildren();
        (media.genres || []).filter(Boolean).forEach((genre) => {
            const tag = document.createElement("li");
            tag.textContent = genre;
            genresList.append(tag);
        });
        genresList.hidden = genresList.childElementCount === 0;

        aboutSection.hidden = !media.description;
        description.textContent = media.description || "";

        const runtimeLabel = type === "tv" ? "Episode runtime" : "Runtime";
        const runtimeValue = media.runtime
            ? `${media.runtime} minutes${type === "tv" ? " per episode" : ""}`
            : null;
        const fields = type === "game"
            ? [
                ["Release date", formatDate(media.releaseDate)],
                ["Developer", media.creator],
                ["Publisher", media.publisher],
                ["Genres", media.genres?.join(", ")],
                ["Platforms", media.platforms?.join(", ")]
            ]
            : type === "music"
                ? [
                    ["Artist", media.creator],
                    ["First release date", formatDate(media.releaseDate)],
                    ["Genres", media.genres?.join(", ")],
                    ["Available releases", media.releases?.join(", ")]
                ]
                : [
                    [type === "tv" ? "First air date" : "Release date", formatDate(media.releaseDate)],
                    [creatorNames[type], media.creator],
                    [type === "tv" ? runtimeLabel : "Runtime", runtimeValue],
                    ["Genres", media.genres?.join(", ")],
                    ["Cast", media.cast?.join(", ")]
                ];
        catalogGrid.replaceChildren();
        fields.filter(([, value]) => value).forEach(([label, value]) => {
            const entry = document.createElement("div");
            entry.className = "details-catalog-entry";
            const term = document.createElement("dt");
            term.textContent = label;
            const detail = document.createElement("dd");
            detail.textContent = value;
            entry.append(term, detail);
            catalogGrid.append(entry);
        });
        catalogSection.hidden = catalogGrid.childElementCount === 0;

        actions.hidden = false;
        const saved = readSavedMedia().find((item) => item.source === source
            && item.type === type && String(item.id) === String(id));
        actions.querySelectorAll("[data-membership]").forEach((button) => {
            const membership = button.dataset.membership;
            const label = membership === "owned" ? "Collection" : "Wishlist";
            const isSaved = Boolean(saved?.[membership]);
            button.textContent = isSaved ? `Already in ${membership === "owned" ? "collection" : "wishlist"}` : `Add to ${label}`;
            button.disabled = isSaved;
            button.onclick = () => {
                try {
                    saveMediaMembership(media, membership);
                    button.textContent = `Already in ${membership === "owned" ? "collection" : "wishlist"}`;
                    button.disabled = true;
                    status.textContent = `Added ${media.title} to your ${membership === "owned" ? "collection" : "wishlist"}.`;
                } catch (error) {
                    console.error("Could not save media:", error);
                    status.textContent = "Could not save this item in this browser.";
                }
            };
        });
        status.textContent = "";
        heading.focus();
    };

    status.textContent = "Loading media details…";
    container.setAttribute("aria-busy", "true");
    loadDetails().catch((error) => {
        console.error("Could not load media details:", error);
        status.textContent = "Media details could not be loaded. Check the link or try again later.";
    }).finally(() => {
        container.removeAttribute("aria-busy");
    });
}

document.querySelector("#media-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const query = form.querySelector("[name=q]").value.trim();
    const category = form.querySelector("[name=category]").value;
    if (!query) {
        form.querySelector("[name=q]").focus();
        return;
    }
    const destination = new URL(`search-results.html?${new URLSearchParams({ q: query, category })}`, window.location.href);
    try {
        window.sessionStorage.setItem("rec:internal-navigation", `${destination.pathname}${destination.search}`);
    } catch (error) {
        console.error("Could not save the search navigation handoff:", error);
    }
    window.location.href = destination.href;
});

renderMediaSearchPage();
renderMediaDetailsPage();


/* media of the day */

const featuredCategoryButtons = Array.from(document.querySelectorAll("[data-category]"));
const featuredCard = document.getElementById("featured-media-card");

if (featuredCard && featuredCategoryButtons.length) {
    const featuredArt = document.getElementById("featured-media-art");
    const featuredArtLabel = document.getElementById("featured-media-art-label");
    const featuredCategory = document.getElementById("featured-media-category");
    const featuredTitle = document.getElementById("featured-media-title");
    const featuredDescription = document.getElementById("featured-media-description");
    const preferenceKey = "rec:preferences:v1";
    const dailyCachePrefix = "rec:media-of-day:v1:";
    const categories = new Set(["games", "music", "films"]);
    const dailyRequests = new Map();
    const currentDate = new Date();
    const dateKey = [
        currentDate.getFullYear(),
        String(currentDate.getMonth() + 1).padStart(2, "0"),
        String(currentDate.getDate()).padStart(2, "0")
    ].join("-");

    const readStorage = (key) => {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            console.error("Could not read the media-of-the-day preference:", error);
            return null;
        }
    };

    const writeStorage = (key, value) => {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            console.error("Could not save the media-of-the-day preference:", error);
        }
    };

    const readPreference = () => {
        const stored = readStorage(preferenceKey);
        if (!stored) return "games";

        try {
            const preference = JSON.parse(stored);
            return categories.has(preference.mediaOfDayCategory)
                ? preference.mediaOfDayCategory
                : "games";
        } catch (error) {
            console.error("Could not parse the media-of-the-day preference:", error);
            return "games";
        }
    };

    const savePreference = (category) => {
        const stored = readStorage(preferenceKey);
        let preferences = {};
        if (stored) {
            try {
                preferences = JSON.parse(stored);
            } catch (error) {
                console.error("Could not parse saved preferences before updating:", error);
            }
        }

        writeStorage(preferenceKey, JSON.stringify({
            ...preferences,
            mediaOfDayCategory: category
        }));
    };

    const dailySeed = (category) => {
        let hash = 2166136261;
        for (const character of `${dateKey}:${category}`) {
            hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
        }
        return hash >>> 0;
    };

    const requestJson = async (url, label, options = {}) => {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`${label} request failed with status ${response.status}`);
        return response.json();
    };

    const mapReleaseGroup = (album) => ({
        id: album.id,
        title: album.title,
        type: "music",
        cover: `${API.coverArt}/release-group/${album.id}/front-500`,
        releaseDate: album["first-release-date"] || null,
        creator: album["artist-credit"]?.[0]?.name || null,
        rating: null,
        source: "musicbrainz"
    });

    const fetchDailyCandidates = async (category) => {
        const seed = dailySeed(category);
        if (category === "games") {
            const data = await requestJson(
                `${API.rawg}/games?key=${RAWG_API_KEY}&page_size=40&page=1`,
                "RAWG"
            );
            return (data.results || []).map((game) => ({
                id: game.id,
                title: game.name,
                type: "game",
                cover: game.background_image || null,
                releaseDate: game.released || null,
                rating: game.rating ?? null,
                creator: null,
                source: "rawg"
            }));
        }
        if (category === "music") {
            const data = await requestJson(
                `${API.musicbrainz}/release-group?query=${encodeURIComponent("primarytype:album")}&fmt=json&limit=100`,
                "MusicBrainz",
                { headers: { Accept: "application/json" } }
            );
            return (data["release-groups"] || []).map(mapReleaseGroup);
        }

        const page = (seed % 20) + 1;
        const data = await requestJson(
            `${API.tmdb}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&page=${page}`,
            "TMDB"
        );
        return (data.results || []).map((movie) => ({
            id: movie.id,
            title: movie.title,
            type: "movie",
            cover: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
            releaseDate: movie.release_date || null,
            rating: movie.vote_average ?? null,
            creator: null,
            source: "tmdb"
        }));
    };

    const updateCategoryButtons = (selectedCategory) => {
        featuredCategoryButtons.forEach((button) => {
            const selected = button.dataset.category === selectedCategory;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
    };

    const isCategorySelected = (category) => featuredCategoryButtons.some((button) => {
        return button.dataset.category === category && button.getAttribute("aria-pressed") === "true";
    });

    const setFeaturedStatus = (category, title, description) => {
        featuredCard.href = "#";
        featuredCard.setAttribute("aria-disabled", "true");
        featuredCard.setAttribute("aria-label", title);
        featuredCard.dataset.mediaId = "";
        featuredCard.dataset.mediaSource = "";
        featuredCard.dataset.mediaType = "";
        featuredTitle.textContent = title;
        featuredDescription.textContent = description;
        featuredCategory.textContent = category.toUpperCase();
        featuredArt.replaceChildren();
        featuredArtLabel.textContent = `${category.toUpperCase()} / FEATURED`;
        featuredArt.append(featuredArtLabel);
        featuredArt.classList.remove("game-art", "music-art", "film-art");
        featuredArt.classList.add(category === "games" ? "game-art" : category === "music" ? "music-art" : "film-art");
    };

    const formatFeaturedMetadata = (category, media) => {
        const metadata = [];
        if (media.creator) metadata.push(media.creator);
        if (media.releaseDate) metadata.push(media.releaseDate.slice(0, 4));
        if (Number.isFinite(media.rating) && media.rating > 0) {
            const scale = category === "games" ? 5 : 10;
            metadata.push(`${category === "games" ? "RAWG" : "TMDB"} ${media.rating}/${scale}`);
        }
        return metadata.length ? metadata.join(" · ") : `Featured ${category}`;
    };

    const renderFeaturedMedia = (category, media) => {
        const categoryLabel = category === "games" ? "GAME" : category === "music" ? "MUSIC" : "FILM";
        const artClass = category === "games" ? "game-art" : category === "music" ? "music-art" : "film-art";

        featuredCard.setAttribute("aria-disabled", "false");
        featuredCard.href = mediaDetailsUrl(media);
        featuredCard.setAttribute("aria-label", `View details for ${media.title}`);
        featuredCard.dataset.mediaId = String(media.id);
        featuredCard.dataset.mediaSource = media.source;
        featuredCard.dataset.mediaType = media.type;
        featuredTitle.textContent = media.title;
        featuredCategory.textContent = `${categoryLabel} / ${media.source.toUpperCase()}`;
        featuredDescription.textContent = formatFeaturedMetadata(category, media);
        featuredArt.replaceChildren();
        featuredArt.classList.remove("game-art", "music-art", "film-art");
        featuredArt.classList.add(artClass);

        if (media.cover) {
            const cover = document.createElement("img");
            cover.src = media.cover;
            cover.alt = "";
            cover.loading = "lazy";
            cover.addEventListener("error", () => {
                cover.remove();
                featuredArtLabel.hidden = false;
            }, { once: true });
            featuredArt.append(cover);
        }

        featuredArtLabel.textContent = `${categoryLabel} / FEATURED`;
        featuredArtLabel.hidden = Boolean(media.cover);
        featuredArt.append(featuredArtLabel);
    };

    const loadFeaturedMedia = async (category) => {
        const cacheKey = `${dailyCachePrefix}${dateKey}:${category}`;
        const cached = readStorage(cacheKey);
        if (cached) {
            try {
                const media = JSON.parse(cached);
                if (media && media.id != null && media.title && media.source) {
                    renderFeaturedMedia(category, media);
                    return;
                }
            } catch (error) {
                console.error("Could not parse the cached media-of-the-day item:", error);
            }
        }

        if (dailyRequests.has(category)) {
            featuredCard.setAttribute("aria-busy", "true");
            try {
                const media = await dailyRequests.get(category);
                if (isCategorySelected(category)) {
                    if (media) {
                        renderFeaturedMedia(category, media);
                    } else {
                        setFeaturedStatus(category, "No items found", `The ${category} catalog did not return a featured item today.`);
                    }
                }
            } catch (error) {
                console.error(`Could not load the ${category} media-of-the-day item:`, error);
                if (isCategorySelected(category)) {
                    setFeaturedStatus(category, "Today's pick is unavailable", "The external catalog could not be reached. Please try again later.");
                }
            } finally {
                if (isCategorySelected(category)) featuredCard.removeAttribute("aria-busy");
            }
            return;
        }

        setFeaturedStatus(category, "Finding today's pick...", `Loading a ${category} pick from its external catalog.`);
        featuredCard.setAttribute("aria-busy", "true");

        const request = fetchDailyCandidates(category)
            .then((candidates) => {
                if (!candidates.length) return null;
                const media = candidates[dailySeed(category) % candidates.length];
                writeStorage(cacheKey, JSON.stringify(media));
                return media;
            })
            .finally(() => {
                dailyRequests.delete(category);
            });
        dailyRequests.set(category, request);

        try {
            const media = await request;
            if (isCategorySelected(category)) {
                if (media) {
                    renderFeaturedMedia(category, media);
                } else {
                    setFeaturedStatus(category, "No items found", `The ${category} catalog did not return a featured item today.`);
                }
            }
        } catch (error) {
            console.error(`Could not load the ${category} media-of-the-day item:`, error);
            if (isCategorySelected(category)) {
                setFeaturedStatus(category, "Today's pick is unavailable", "The external catalog could not be reached. Please try again later.");
            }
        } finally {
            if (isCategorySelected(category)) {
                featuredCard.removeAttribute("aria-busy");
            }
        }
    };

    let selectedCategory = readPreference();
    updateCategoryButtons(selectedCategory);

    featuredCategoryButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const category = button.dataset.category;
            if (!categories.has(category) || category === selectedCategory) return;
            selectedCategory = category;
            updateCategoryButtons(category);
            savePreference(category);
            loadFeaturedMedia(category);
        });
    });

    featuredCard.addEventListener("click", (event) => {
        if (featuredCard.getAttribute("aria-disabled") === "true") event.preventDefault();
    });

    loadFeaturedMedia(selectedCategory);
}



/* navigation */

const site = document.getElementById("site");

if (site) {
    site.style.display = "block";
}

/* collection controls */

const collectionPage = document.querySelector(".collection-page");

if (collectionPage) {
    const ownedGrid = collectionPage.querySelector(".collection-grid");
    const wishlistGrid = collectionPage.querySelector(".wishlist-grid");
    const searchField = collectionPage.querySelector("#collection-search");
    const filterToggle = collectionPage.querySelector(".filter-toggle");
    const filterPanel = collectionPage.querySelector("#collection-filters");
    const filterFields = Array.from(collectionPage.querySelectorAll("[data-filter]"));
    const resultCount = collectionPage.querySelector(".results-count");
    const sortControl = collectionPage.querySelector("#collection-sort");
    const viewButtons = Array.from(collectionPage.querySelectorAll("[data-view]"));
    const categoryButtons = Array.from(collectionPage.querySelectorAll("[data-category]"));
    const allMediaSection = collectionPage.querySelector(".all-media-section");
    const wishlistSection = collectionPage.querySelector(".wishlist-section");
    const foldersSection = collectionPage.querySelector(".folders-section");
    const folderGrid = collectionPage.querySelector(".folder-grid");
    const viewFoldersButton = collectionPage.querySelector(".view-folders");
    let ownedCards = [];
    let wishlistCards = [];
    let activeCategory = "all";

    const categoryLabels = {
        game: "GAME",
        music: "MUSIC",
        movie: "MOVIE",
        tv: "TELEVISION"
    };

    const createSavedCard = (media, membership) => {
        const card = document.createElement("article");
        card.className = "media-card";
        card.dataset.status = membership;
        card.dataset.type = media.type;
        card.dataset.format = media.format || "";
        card.dataset.genre = (media.genres || []).join(" ").toLowerCase();
        card.dataset.releaseDate = media.releaseDate || "";
        card.dataset.rating = media.rating ?? "";
        card.dataset.added = media.addedAt || "";
        card.dataset.source = media.source;
        card.dataset.mediaId = String(media.id);

        const link = document.createElement("a");
        link.className = "media-card-link";
        link.href = mediaDetailsUrl(media);
        link.setAttribute("aria-label", `View details for ${media.title}`);

        const cover = document.createElement("div");
        cover.className = "cover-placeholder";
        if (media.cover) {
            const image = document.createElement("img");
            image.src = media.cover;
            image.alt = `${media.title} artwork`;
            image.loading = "lazy";
            image.addEventListener("error", () => {
                image.remove();
                cover.textContent = "ARTWORK UNAVAILABLE";
            }, { once: true });
            cover.append(image);
        } else {
            cover.textContent = "ARTWORK UNAVAILABLE";
        }

        const info = document.createElement("div");
        info.className = "media-card-info";
        const title = document.createElement("p");
        title.textContent = media.title;
        const subtitle = document.createElement("span");
        subtitle.textContent = `${categoryLabels[media.type] || "MEDIA"} / ${media.source.toUpperCase()}`;
        info.append(title, subtitle);

        const details = document.createElement("div");
        details.className = "media-card-details";
        const metadata = [
            media.creator,
            media.releaseDate?.slice(0, 4),
            Number.isFinite(Number(media.rating)) && media.rating !== null ? `★ ${media.rating}` : null
        ];
        metadata.filter(Boolean).forEach((value) => {
            const detail = document.createElement("span");
            detail.textContent = value;
            details.append(detail);
        });
        link.append(cover, info, details);

        const removeButton = document.createElement("button");
        removeButton.className = "remove-media";
        removeButton.type = "button";
        removeButton.textContent = membership === "owned" ? "REMOVE FROM COLLECTION" : "REMOVE FROM WISHLIST";
        removeButton.setAttribute("aria-label", `Remove ${media.title} from ${membership === "owned" ? "collection" : "wishlist"}`);
        removeButton.addEventListener("click", () => {
            try {
                removeMediaMembership(media.source, media.type, media.id, membership);
            } catch (error) {
                console.error("Could not remove saved media:", error);
            }
        });

        card.append(link, removeButton);
        return card;
    };

    const updateStatistics = (items) => {
        const owned = items.filter((item) => item.owned);
        const wishlist = items.filter((item) => item.wishlist);
        const counts = {
            owned: owned.length,
            game: owned.filter((item) => item.type === "game").length,
            music: owned.filter((item) => item.type === "music").length,
            movies: owned.filter((item) => item.type === "movie" || item.type === "tv").length,
            wishlist: wishlist.length
        };
        Object.entries(counts).forEach(([name, count]) => {
            const number = collectionPage.querySelector(`[data-collection-stat="${name}"]`);
            if (number) number.textContent = String(count).padStart(2, "0");
        });
        const countLabel = collectionPage.querySelector(".wishlist-section .section-count");
        if (countLabel) countLabel.textContent = `${String(counts.wishlist).padStart(2, "0")} ITEMS`;
    };

    const sortCollection = () => {
        const sortBy = sortControl.value;
        const compareCards = (first, second) => {
            const firstTitle = first.querySelector(".media-card-info p").textContent.trim();
            const secondTitle = second.querySelector(".media-card-info p").textContent.trim();
            if (sortBy === "title-asc") return firstTitle.localeCompare(secondTitle);
            if (sortBy === "title-desc") return secondTitle.localeCompare(firstTitle);
            if (sortBy === "release") return (second.dataset.releaseDate || "").localeCompare(first.dataset.releaseDate || "");
            if (sortBy === "rating") return Number(second.dataset.rating || 0) - Number(first.dataset.rating || 0);
            return (second.dataset.added || "").localeCompare(first.dataset.added || "");
        };
        [...ownedCards].sort(compareCards).forEach((card) => ownedGrid.append(card));
        [...wishlistCards].sort(compareCards).forEach((card) => wishlistGrid.append(card));
    };

    const updateCollection = () => {
        const query = searchField.value.trim().toLowerCase();
        const activeFilters = Object.fromEntries(filterFields.map((field) => [field.dataset.filter, field.value]));
        const allCards = [...ownedCards, ...wishlistCards];

        allCards.forEach((card) => {
            const searchableText = [
                card.querySelector(".media-card-info p")?.textContent,
                card.dataset.type,
                card.dataset.format,
                card.dataset.genre,
                card.querySelector(".media-card-details")?.textContent
            ].join(" ").toLowerCase();
            const matchesQuery = !query || searchableText.includes(query);
            const matchesFilters = Object.entries(activeFilters).every(([key, value]) => {
                if (!value) return true;
                if (key === "genre") return card.dataset.genre.split(" ").includes(value);
                return card.dataset[key] === value;
            });
            const matchesCategory = activeCategory === "all"
                || activeCategory === "wishlist" && card.dataset.status === "wishlist"
                || activeCategory === "games" && card.dataset.status === "owned" && card.dataset.type === "game"
                || activeCategory === "music" && card.dataset.status === "owned" && card.dataset.type === "music"
                || activeCategory === "films" && card.dataset.status === "owned" && (card.dataset.type === "movie" || card.dataset.type === "tv");
            card.hidden = !(matchesQuery && matchesFilters && matchesCategory);
        });

        const visibleOwned = ownedCards.filter((card) => !card.hidden).length;
        const visibleWishlist = wishlistCards.filter((card) => !card.hidden).length;
        resultCount.textContent = `${visibleOwned + visibleWishlist} ITEMS SHOWN / ${ownedCards.length} OWNED / ${wishlistCards.length} WISHLIST`;
        const ownedEmpty = collectionPage.querySelector('[data-empty="owned"]');
        const wishlistEmpty = collectionPage.querySelector('[data-empty="wishlist"]');
        ownedEmpty.hidden = visibleOwned > 0;
        wishlistEmpty.hidden = visibleWishlist > 0;
        const categoryTitles = { games: "GAMES", music: "MUSIC", films: "MOVIES / TV" };
        const categoryItems = activeCategory === "games"
            ? ownedCards.filter((card) => card.dataset.type === "game")
            : activeCategory === "music"
                ? ownedCards.filter((card) => card.dataset.type === "music")
                : activeCategory === "films"
                    ? ownedCards.filter((card) => card.dataset.type === "movie" || card.dataset.type === "tv")
                    : ownedCards;
        const setEmptyMessage = (element, message) => {
            const searchLink = document.createElement("a");
            searchLink.href = "search.html";
            searchLink.textContent = "SEARCH MEDIA";
            element.replaceChildren(document.createTextNode(`${message} `), searchLink);
            element.append(document.createTextNode(" TO GET STARTED."));
        };
        if (activeCategory !== "all" && activeCategory !== "wishlist" && activeCategory !== "folders" && !categoryItems.length) {
            setEmptyMessage(ownedEmpty, `NO ${categoryTitles[activeCategory]} SAVED YET.`);
        } else if (categoryItems.length && !visibleOwned && categoryTitles[activeCategory]) {
            setEmptyMessage(ownedEmpty, `NO ${categoryTitles[activeCategory]} ITEMS MATCH THESE FILTERS.`);
        } else if (ownedCards.length && !visibleOwned) {
            setEmptyMessage(ownedEmpty, "NO COLLECTION ITEMS MATCH THESE FILTERS.");
        } else {
            setEmptyMessage(ownedEmpty, "YOUR COLLECTION IS EMPTY.");
        }
        if (wishlistCards.length && !visibleWishlist) {
            setEmptyMessage(wishlistEmpty, "NO WISHLIST ITEMS MATCH THESE FILTERS.");
        } else {
            setEmptyMessage(wishlistEmpty, "YOUR WISHLIST IS EMPTY.");
        }

        const isWishlist = activeCategory === "wishlist";
        const isFolders = activeCategory === "folders";
        allMediaSection.hidden = isWishlist || isFolders;
        wishlistSection.hidden = isFolders || (activeCategory !== "all" && !isWishlist);
        foldersSection.hidden = !isFolders && activeCategory !== "all";
    };

    const renderFolders = () => {
        const folders = readFolders();
        folderGrid.replaceChildren();
        const emptyState = document.createElement("p");
        emptyState.className = "folder-empty-state";
        emptyState.textContent = "NO FOLDERS YET. CREATE A FOLDER TO ORGANIZE YOUR MEDIA.";
        emptyState.hidden = folders.length > 0;
        folderGrid.append(emptyState);
        folders.forEach((name, index) => {
            const folder = document.createElement("div");
            folder.className = "folder-placeholder";
            folder.textContent = name.toUpperCase();
            if (index >= 6) {
                folder.classList.add("extra-folder");
                folder.hidden = viewFoldersButton.getAttribute("aria-expanded") !== "true";
            }
            folderGrid.append(folder);
        });
        const folderCount = folders.length;
        viewFoldersButton.querySelector("span").textContent = String(folderCount).padStart(2, "0");
        viewFoldersButton.hidden = folderCount <= 6;
    };

    const renderCollection = () => {
        const items = readSavedMedia();
        ownedGrid.replaceChildren();
        wishlistGrid.replaceChildren();
        ownedCards = [];
        wishlistCards = [];
        items.filter((item) => item && item.title && item.source && item.type && item.id != null).forEach((media) => {
            if (media.owned) {
                const card = createSavedCard(media, "owned");
                ownedCards.push(card);
                ownedGrid.append(card);
            }
            if (media.wishlist) {
                const card = createSavedCard(media, "wishlist");
                wishlistCards.push(card);
                wishlistGrid.append(card);
            }
        });
        updateStatistics(items);
        sortCollection();
        updateCollection();
    };

    searchField.addEventListener("input", updateCollection);
    filterFields.forEach((field) => field.addEventListener("change", updateCollection));
    filterToggle.addEventListener("click", () => {
        const expanded = filterToggle.getAttribute("aria-expanded") === "true";
        filterToggle.setAttribute("aria-expanded", String(!expanded));
        filterPanel.hidden = expanded;
        filterToggle.querySelector("span").textContent = expanded ? "+" : "−";
    });
    collectionPage.querySelector(".clear-filters").addEventListener("click", () => {
        searchField.value = "";
        filterFields.forEach((field) => { field.value = ""; });
        updateCollection();
    });
    sortControl.addEventListener("change", sortCollection);
    viewButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const listView = button.dataset.view === "list";
            ownedGrid.classList.toggle("list-view", listView);
            wishlistGrid.classList.toggle("list-view", listView);
            viewButtons.forEach((viewButton) => {
                const isActive = viewButton === button;
                viewButton.classList.toggle("active", isActive);
                viewButton.setAttribute("aria-pressed", String(isActive));
            });
        });
    });
    categoryButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeCategory = button.dataset.category;
            categoryButtons.forEach((categoryButton) => {
                const selected = categoryButton === button;
                categoryButton.classList.toggle("active", selected);
                categoryButton.setAttribute("aria-pressed", String(selected));
            });
            updateCollection();
            if (activeCategory === "folders") foldersSection.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
    viewFoldersButton.addEventListener("click", () => {
        const expanded = viewFoldersButton.getAttribute("aria-expanded") === "true";
        viewFoldersButton.setAttribute("aria-expanded", String(!expanded));
        viewFoldersButton.firstChild.textContent = expanded ? "VIEW ALL FOLDERS " : "SHOW PINNED FOLDERS ";
        renderFolders();
    });
    collectionPage.querySelector(".new-folder").addEventListener("click", () => {
        const folderName = window.prompt("Name your new folder");
        if (!folderName || !folderName.trim()) return;
        const folders = readFolders();
        if (folders.some((name) => name.toLowerCase() === folderName.trim().toLowerCase())) return;
        folders.push(folderName.trim());
        try {
            window.localStorage.setItem(foldersKey, JSON.stringify(folders));
            renderFolders();
        } catch (error) {
            console.error("Could not save folder:", error);
        }
    });

    window.addEventListener("rec:saved-media-change", renderCollection);
    window.addEventListener("storage", (event) => {
        if (event.key === savedMediaKey) renderCollection();
        if (event.key === foldersKey) renderFolders();
    });
    renderFolders();
    renderCollection();
}

const refreshCollectionDependentPages = () => {
    renderRecentlyAdded();
    renderProfileData();
};

refreshCollectionDependentPages();
window.addEventListener("rec:saved-media-change", refreshCollectionDependentPages);
window.addEventListener("storage", (event) => {
    if (event.key === savedMediaKey || event.key === activityKey) refreshCollectionDependentPages();
});

/* profile settings */

const badgeGrid = document.querySelector(".badge-grid");
const homeBadgeGrid = document.querySelector(".home-badge-grid");

if (typeof PROFILE_BADGES !== "undefined" && (badgeGrid || homeBadgeGrid)) {
    const renderBadges = (container, badges) => {
        const fragment = document.createDocumentFragment();
        badges.forEach((badge) => {
            const article = document.createElement("article");
            article.className = "profile-badge";
            const icon = document.createElement("div");
            icon.className = `badge-icon${badge.iconClass ? ` ${badge.iconClass}` : ""}`;
            icon.setAttribute("aria-hidden", "true");
            const iconText = document.createElement("span");
            iconText.textContent = badge.icon;
            icon.append(iconText);
            const heading = document.createElement("h3");
            heading.textContent = badge.name;
            const description = document.createElement("p");
            description.textContent = badge.description;
            article.append(icon, heading, description);

            fragment.append(article);
        });

        if (badges.length) {
            container.replaceChildren(fragment);
        } else {
            const emptyState = document.createElement("p");
            emptyState.className = "badge-empty-state";
            emptyState.textContent = "NO BADGES EARNED YET.";
            container.replaceChildren(emptyState);
        }
    };

    const updateBadges = () => {
        const savedItems = readSavedMedia();
        const earnedBadges = PROFILE_BADGES.filter((badge) => badge.unlockedWhen(savedItems));
        if (badgeGrid) {
            renderBadges(badgeGrid, earnedBadges);
            const badgeCount = document.querySelector("[data-badge-count]");
            if (badgeCount) badgeCount.textContent = `${String(earnedBadges.length).padStart(2, "0")} UNLOCKED`;
        }
        if (homeBadgeGrid) renderBadges(homeBadgeGrid, earnedBadges.slice(0, 3));
    };

    updateBadges();
    window.addEventListener("rec:saved-media-change", updateBadges);
    window.addEventListener("storage", (event) => {
        if (event.key === savedMediaKey) updateBadges();
    });
}

const profileSettings = document.querySelector(".profile-settings");

if (profileSettings) {
    const settingsToggle = profileSettings.querySelector(".profile-settings-toggle");
    const settingsMenu = profileSettings.querySelector(".profile-settings-menu");

    const closeSettings = (returnFocus = false) => {
        settingsToggle.setAttribute("aria-expanded", "false");
        settingsMenu.hidden = true;
        if (returnFocus) settingsToggle.focus();
    };

    settingsToggle.addEventListener("click", () => {
        const expanded = settingsToggle.getAttribute("aria-expanded") === "true";
        settingsToggle.setAttribute("aria-expanded", String(!expanded));
        settingsMenu.hidden = expanded;
    });

    settingsMenu.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("button")) {
            closeSettings();
        }
    });

    document.addEventListener("click", (event) => {
        if (!profileSettings.contains(event.target)) closeSettings();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !settingsMenu.hidden) closeSettings(true);
    });
}