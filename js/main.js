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

    try {

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("RAWG request failed");
        }

        const data = await response.json();

        return data.results.map((game) => ({
            id: game.id,
            title: game.name,
            type: "game",
            cover: game.background_image,
            releaseDate: game.released,
            creator: null,
            publisher: null,
            description: null,
            rating: game.rating,
            source: "rawg"
        }));

    } catch (error) {

        console.error("Game search error:", error);
        return [];

    }
}


async function searchMovies(query) {

    const url = `${API.tmdb}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=1`;

    try {

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();

        return data.results.map((movie) => ({
            id: movie.id,
            title: movie.title,
            type: "movie",
            cover: movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : null,
            releaseDate: movie.release_date,
            creator: null,
            publisher: null,
            description: movie.overview,
            rating: movie.vote_average,
            source: "tmdb"
        }));

    } catch (error) {

        console.error("Movie search error:", error);
        return [];

    }
}


async function searchMusic(query) {

    const url = `${API.musicbrainz}/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=10`;

    try {

        const response = await fetch(url, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("MusicBrainz request failed");
        }

        const data = await response.json();

        return data["release-groups"].map((album) => ({
            id: album.id,
            title: album.title,
            type: "music",
            cover: `${API.coverArt}/release-group/${album.id}/front-500`,
            releaseDate: album["first-release-date"],
            creator: album["artist-credit"]?.[0]?.name || null,
            publisher: null,
            description: null,
            rating: null,
            source: "musicbrainz"
        }));

    } catch (error) {

        console.error("Music search error:", error);
        return [];

    }
}


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
        featuredCard.setAttribute("aria-label", `View details for ${media.title}; details page coming soon`);
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
        event.preventDefault();
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
    const collectionCards = Array.from(collectionPage.querySelectorAll(".media-card"));
    const ownedCards = Array.from(collectionPage.querySelectorAll(".collection-grid .media-card"));
    const wishlistCards = Array.from(collectionPage.querySelectorAll(".wishlist-grid .media-card"));
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
            if (sortBy === "release") return first.dataset.releaseDate.localeCompare(second.dataset.releaseDate);
            if (sortBy === "rating") return Number(second.dataset.rating) - Number(first.dataset.rating);
            return second.dataset.added.localeCompare(first.dataset.added);
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