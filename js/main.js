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

function saveMediaMembership(media, membership) {
    const savedItems = readSavedMedia();
    const itemKey = `${media.source}:${media.type}:${media.id}`;
    const existing = savedItems.find((item) => `${item.source}:${item.type}:${item.id}` === itemKey);
    if (existing) {
        existing[membership] = true;
        Object.assign(existing, Object.fromEntries(
            Object.entries(media).filter(([, value]) => value != null)
        ));
    } else {
        savedItems.push({ ...media, addedAt: new Date().toISOString(), [membership]: true });
    }
    window.localStorage.setItem(savedMediaKey, JSON.stringify(savedItems));
}

function renderMediaSearchPage() {
    const form = document.querySelector("#media-search-form");
    const queryInput = form?.querySelector("[name=query]");
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
    if (backLink && params.has("q")) {
        backLink.href = `search-results.html?${new URLSearchParams({
            q: params.get("q"),
            category: params.get("category") || "all"
        })}`;
        backLink.textContent = "← Back to results";
    }
    if (!source || !type || !id || !status || !heading || !actions) {
        status.textContent = "This media link is incomplete.";
        return;
    }

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
                publisher: null,
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
                releases: album.releases?.slice(0, 8).map((release) => release.title) || []
            };
        } else {
            throw new Error("This media source and type are not supported.");
        }

        heading.textContent = media.title;
        document.title = `rec. | ${media.title}`;
        container.replaceChildren();
        if (media.cover) {
            const image = document.createElement("img");
            image.className = "details-artwork";
            image.src = media.cover;
            image.alt = `${media.title} artwork`;
            image.addEventListener("error", () => { image.hidden = true; }, { once: true });
            container.append(image);
        }
        const metadata = document.createElement("dl");
        const fields = [
            ["Type", type === "tv" ? "TV" : type],
            ["Release date", media.releaseDate],
            ["Artist / developer / director", media.creator],
            ["Publisher", media.publisher],
            ["Genres", media.genres?.join(", ")],
            ["Platforms", media.platforms?.join(", ")],
            ["Runtime", media.runtime ? `${media.runtime} minutes` : null],
            ["Cast", media.cast?.join(", ")],
            ["Releases / editions", media.releases?.join(", ")]
        ];
        fields.filter(([, value]) => value).forEach(([label, value]) => {
            const term = document.createElement("dt");
            term.textContent = label;
            const description = document.createElement("dd");
            description.textContent = value;
            metadata.append(term, description);
        });
        container.append(metadata);
        if (media.description) {
            const description = document.createElement("p");
            description.className = "details-description";
            description.textContent = media.description;
            container.append(description);
        }
        actions.hidden = false;
        actions.querySelectorAll("[data-membership]").forEach((button) => {
            const membership = button.dataset.membership;
            const saved = readSavedMedia().find((item) => item.source === source && item.type === type && String(item.id) === String(id));
            button.textContent = saved?.[membership] ? `Already in ${membership === "owned" ? "collection" : "wishlist"}` : `Add to ${membership === "owned" ? "Collection" : "Wishlist"}`;
            button.disabled = Boolean(saved?.[membership]);
            button.onclick = () => {
                try {
                    saveMediaMembership(media, membership);
                    button.textContent = `Added to ${membership === "owned" ? "collection" : "wishlist"}`;
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
    const query = form.querySelector("[name=query]").value.trim();
    const category = form.querySelector("[name=category]").value;
    if (!query) {
        form.querySelector("[name=query]").focus();
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
    const savedItems = readSavedMedia();
    const createSavedCard = (media, membership) => {
        const card = document.createElement("article");
        card.className = "media-card";
        card.dataset.status = membership === "owned" ? "owned" : "wishlist";
        card.dataset.type = media.type;
        card.dataset.format = media.format || "";
        card.dataset.genre = media.genres?.[0]?.toLowerCase() || "";
        card.dataset.releaseDate = media.releaseDate || "";
        card.dataset.rating = media.rating ?? "";
        card.dataset.added = media.addedAt || "";
        card.dataset.source = media.source;
        card.dataset.mediaId = String(media.id);

        const cover = document.createElement("div");
        cover.className = "cover-placeholder";
        if (media.cover) {
            const image = document.createElement("img");
            image.src = media.cover;
            image.alt = "";
            image.loading = "lazy";
            image.addEventListener("error", () => {
                image.remove();
                cover.textContent = `${media.type.toUpperCase()} / SAVED`;
            }, { once: true });
            cover.append(image);
        } else {
            cover.textContent = `${media.type.toUpperCase()} / SAVED`;
        }

        const info = document.createElement("div");
        info.className = "media-card-info";
        const title = document.createElement("p");
        title.textContent = media.title;
        const subtitle = document.createElement("span");
        subtitle.textContent = `${media.type.toUpperCase()} / ${media.source.toUpperCase()}`;
        info.append(title, subtitle);

        const details = document.createElement("div");
        details.className = "media-card-details";
        [media.creator, media.releaseDate?.slice(0, 4), media.format].filter(Boolean).forEach((value) => {
            const detail = document.createElement("span");
            detail.textContent = value;
            details.append(detail);
        });
        card.append(cover, info, details);
        return card;
    };
    const wishlistGridForSaved = collectionPage.querySelector(".wishlist-grid");
    const ownedGridForSaved = collectionPage.querySelector(".collection-grid");
    savedItems.forEach((media) => {
        if (media.wishlist) wishlistGridForSaved.append(createSavedCard(media, "wishlist"));
        if (media.owned) ownedGridForSaved.append(createSavedCard(media, "owned"));
    });

    const collectionCards = Array.from(collectionPage.querySelectorAll(".media-card"));
    const ownedCards = Array.from(collectionPage.querySelectorAll(".collection-grid .media-card"));
    const wishlistCards = Array.from(collectionPage.querySelectorAll(".wishlist-grid .media-card"));
    const statisticNumbers = Array.from(collectionPage.querySelectorAll(".collection-stats .stat-number"));
    const ownedCounts = [
        ownedCards.length,
        ownedCards.filter((card) => card.dataset.type === "game").length,
        ownedCards.filter((card) => card.dataset.type === "music").length,
        ownedCards.filter((card) => card.dataset.type === "movie" || card.dataset.type === "tv").length
    ];
    statisticNumbers.forEach((number, index) => {
        if (ownedCounts[index] != null) number.textContent = String(ownedCounts[index]).padStart(2, "0");
    });
    const wishlistCount = collectionPage.querySelector(".wishlist-section .section-count");
    if (wishlistCount) wishlistCount.textContent = `${String(wishlistCards.length).padStart(2, "0")} ITEMS`;
    const searchField = collectionPage.querySelector("#collection-search");
    const filterToggle = collectionPage.querySelector(".filter-toggle");
    const filterPanel = collectionPage.querySelector("#collection-filters");
    const filterFields = Array.from(collectionPage.querySelectorAll("[data-filter]"));
    const resultCount = collectionPage.querySelector(".results-count");
    const sortControl = collectionPage.querySelector("#collection-sort");
    const collectionGrid = collectionPage.querySelector(".collection-grid");
    const viewButtons = Array.from(collectionPage.querySelectorAll("[data-view]"));

    const updateCollection = () => {
        const query = searchField.value.trim().toLowerCase();
        const activeFilters = Object.fromEntries(
            filterFields.map((field) => [field.dataset.filter, field.value])
        );

        collectionCards.forEach((card) => {
            const searchableText = [
                card.querySelector(".media-card-info p")?.textContent,
                card.dataset.type,
                card.dataset.format,
                card.dataset.genre
            ].join(" ").toLowerCase();
            const matchesQuery = !query || searchableText.includes(query);
            const matchesFilters = Object.entries(activeFilters).every(([key, value]) => {
                return !value || card.dataset[key] === value;
            });

            card.hidden = !(matchesQuery && matchesFilters);
        });

        const visibleOwned = ownedCards.filter((card) => !card.hidden).length;
        const visibleWishlist = wishlistCards.filter((card) => !card.hidden).length;
        resultCount.textContent = `${visibleOwned} OWNED / ${visibleWishlist} WISHLIST`;

        collectionPage.querySelector(".all-media-section .empty-results").hidden = visibleOwned > 0;
        collectionPage.querySelector(".wishlist-section .empty-results").hidden = visibleWishlist > 0;
    };

    const sortCollection = () => {
        const sortBy = sortControl.value;
        const sortedCards = [...ownedCards].sort((first, second) => {
            const firstTitle = first.querySelector(".media-card-info p").textContent.trim();
            const secondTitle = second.querySelector(".media-card-info p").textContent.trim();

            if (sortBy === "title-asc") return firstTitle.localeCompare(secondTitle);
            if (sortBy === "title-desc") return secondTitle.localeCompare(firstTitle);
            if (sortBy === "release") return (first.dataset.releaseDate || "").localeCompare(second.dataset.releaseDate || "");
            if (sortBy === "rating") return Number(second.dataset.rating) - Number(first.dataset.rating);
            return (second.dataset.added || "").localeCompare(first.dataset.added || "");
        });

        sortedCards.forEach((card) => collectionGrid.appendChild(card));
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
        filterFields.forEach((field) => {
            field.value = "";
        });
        updateCollection();
    });

    sortControl.addEventListener("change", sortCollection);
    sortCollection();

    viewButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const listView = button.dataset.view === "list";
            collectionGrid.classList.toggle("list-view", listView);
            viewButtons.forEach((viewButton) => {
                const isActive = viewButton === button;
                viewButton.classList.toggle("active", isActive);
                viewButton.setAttribute("aria-pressed", String(isActive));
            });
        });
    });

    const folderGrid = collectionPage.querySelector(".folder-grid");
    const viewFoldersButton = collectionPage.querySelector(".view-folders");

    viewFoldersButton.addEventListener("click", () => {
        const expanded = viewFoldersButton.getAttribute("aria-expanded") === "true";
        folderGrid.querySelectorAll(".extra-folder").forEach((folder) => {
            folder.hidden = expanded;
        });
        viewFoldersButton.setAttribute("aria-expanded", String(!expanded));
        viewFoldersButton.firstChild.textContent = expanded ? "VIEW ALL FOLDERS " : "SHOW PINNED FOLDERS ";
    });

    collectionPage.querySelector(".new-folder").addEventListener("click", () => {
        const folderName = window.prompt("Name your new folder");
        if (!folderName || !folderName.trim()) return;

        const folder = document.createElement("div");
        folder.className = "folder-placeholder";
        folder.textContent = folderName.trim().toUpperCase();
        folderGrid.appendChild(folder);

        const folderCount = folderGrid.querySelectorAll(".folder-placeholder").length;
        const foldersExpanded = viewFoldersButton.getAttribute("aria-expanded") === "true";
        viewFoldersButton.querySelector("span").textContent = String(folderCount).padStart(2, "0");
        viewFoldersButton.hidden = folderCount <= 6;
        if (folderCount > 6) {
            folder.classList.add("extra-folder");
            folder.hidden = !foldersExpanded;
        }
    });

    updateCollection();
}

/* profile settings */

const badgeGrid = document.querySelector(".badge-grid");
const homeBadgeGrid = document.querySelector(".home-badge-grid");

if (typeof PROFILE_BADGES !== "undefined" && (badgeGrid || homeBadgeGrid)) {
    const earnedBadges = PROFILE_BADGES
        .filter((badge) => badge.unlocked)
        .map((badge, index) => ({ ...badge, originalIndex: index }))
        .sort((first, second) => {
            const firstUnlockTime = Date.parse(first.unlockedAt);
            const secondUnlockTime = Date.parse(second.unlockedAt);
            const firstHasUnlockTime = Number.isFinite(firstUnlockTime);
            const secondHasUnlockTime = Number.isFinite(secondUnlockTime);
            if (firstHasUnlockTime && secondHasUnlockTime) return secondUnlockTime - firstUnlockTime;
            if (firstHasUnlockTime) return -1;
            if (secondHasUnlockTime) return 1;
            return first.originalIndex - second.originalIndex;
        });

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

            if (Number.isFinite(Date.parse(badge.unlockedAt))) {
                const unlocked = document.createElement("time");
                unlocked.className = "badge-unlocked-date";
                unlocked.dateTime = badge.unlockedAt;
                unlocked.textContent = new Date(badge.unlockedAt).toLocaleDateString();
                article.append(unlocked);
            }

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

    if (badgeGrid) {
        renderBadges(badgeGrid, earnedBadges);
        const badgeCount = document.querySelector("[data-badge-count]");
        if (badgeCount) badgeCount.textContent = `${String(earnedBadges.length).padStart(2, "0")} UNLOCKED`;
    }

    if (homeBadgeGrid) {
        renderBadges(homeBadgeGrid, earnedBadges.slice(0, 3));
    }
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