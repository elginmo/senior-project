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


/* popular picks */

async function loadPopularPicks() {

    const [
        badPieces,
        kingdomHearts,
        theBatman,
        theFallOff,
        bombRush,
        perfectBlue,
        dawnFM,
        marioStrikers,
        blairWitch
    ] = await Promise.all([

        searchMusic('artist:"wave to earth" AND releasegroup:"bad pieces"'),

        searchGames("Kingdom Hearts II"),

        searchMovies("The Batman"),

        searchMusic('artist:"J. Cole" AND releasegroup:"The Fall Off"'),

        searchGames("Bomb Rush Cyberfunk"),

        searchMovies("Perfect Blue"),

        searchMusic('artist:"The Weeknd" AND releasegroup:"Dawn FM"'),

        searchGames("Dragon Ball FighterZ"),

        searchMovies("The Blair Witch Project")

    ]);

    const popular = [

        badPieces[0],
        kingdomHearts[0],
        theBatman[0],

        theFallOff[0],
        bombRush[0],
        perfectBlue[0],

        dawnFM[0],
        marioStrikers[0],
        blairWitch[0]

    ].filter(Boolean);

    renderPopularPicks(popular);
}


function renderPopularPicks(results) {

    const popularGrid = document.querySelector(".popular-grid");

    if (!popularGrid) {
        return;
    }

    popularGrid.innerHTML = "";

    results.forEach((media) => {

        const card = document.createElement("article");
        card.className = "media-card";

        const cover = document.createElement("div");
        cover.className = "cover-placeholder";

        if (media.cover) {

            const img = document.createElement("img");

            img.src = media.cover;
            img.alt = media.title;

            img.onerror = () => {
                cover.textContent = "NO COVER";
            };

            cover.appendChild(img);

        } else {

            cover.textContent = "NO COVER";

        }

        const title = document.createElement("p");
        title.textContent = media.title;

        const info = document.createElement("div");
        info.className = "media-card-info";

        const type = document.createElement("span");
        type.textContent = media.type.toUpperCase();

        card.appendChild(cover);
        info.appendChild(title);
        info.appendChild(type);
        card.appendChild(info);

        popularGrid.appendChild(card);

    });
}


loadPopularPicks();

/* popular picks controls */

const popularGrid = document.querySelector(".popular-grid");
const popularPrev = document.getElementById("popular-prev");
const popularNext = document.getElementById("popular-next");

if (popularGrid && popularPrev && popularNext) {

    const scrollPopularPicks = (direction) => {
        const card = popularGrid.querySelector(".media-card");
        const gap = parseFloat(getComputedStyle(popularGrid).columnGap) || 0;
        const distance = (card?.getBoundingClientRect().width || 190) + gap;

        popularGrid.scrollBy({
            left: direction * distance,
            behavior: "smooth"
        });
    };

    popularNext.addEventListener("click", () => scrollPopularPicks(1));
    popularPrev.addEventListener("click", () => scrollPopularPicks(-1));
}


/* search */

const searchInput = document.getElementById("media-search");
const searchButton = document.getElementById("search-button");
const searchFilters = document.querySelectorAll(".search-filter");

let activeSearchType = "all";


if (searchFilters.length) {

    searchFilters.forEach((filter) => {

        filter.addEventListener("click", () => {

            searchFilters.forEach((button) => {
                button.classList.remove("active");
            });

            filter.classList.add("active");

            activeSearchType = filter.textContent.trim().toLowerCase();

        });

    });

}


if (searchButton && searchInput) {

    searchButton.addEventListener("click", async () => {

        const query = searchInput.value.trim();

        if (!query) {
            return;
        }

        let results = [];

        if (activeSearchType === "games") {

            results = await searchGames(query);

        } else if (activeSearchType === "music") {

            results = await searchMusic(query);

        } else if (activeSearchType === "movies") {

            results = await searchMovies(query);

        } else {

            const [games, music, movies] = await Promise.all([
                searchGames(query),
                searchMusic(query),
                searchMovies(query)
            ]);

            results = [
                ...games,
                ...music,
                ...movies
            ];

        }

        console.log("Search results:", results);

        renderSearchResults(results);

    });

}


/* render */

function renderSearchResults(results) {

    const mediaGrid = document.querySelector(".media-grid");

    if (!mediaGrid) {
        return;
    }

    mediaGrid.innerHTML = "";

    if (results.length === 0) {

        mediaGrid.innerHTML = "<p>NO RESULTS FOUND.</p>";

        return;

    }

    results.forEach((media) => {

        const card = document.createElement("article");
        card.className = "media-card";

        const cover = document.createElement("div");
        cover.className = "cover-placeholder";

        if (media.cover) {

            const img = document.createElement("img");

            img.src = media.cover;
            img.alt = media.title;

            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.style.display = "block";

            img.onerror = () => {
                cover.textContent = "NO COVER";
            };

            cover.appendChild(img);

        } else {

            cover.textContent = "NO COVER";

        }

        const title = document.createElement("p");
        title.textContent = media.title;

        const type = document.createElement("small");
        type.textContent = media.type.toUpperCase();

        type.style.display = "block";
        type.style.marginTop = "6px";
        type.style.fontSize = "10px";
        type.style.letterSpacing = "0.08em";
        type.style.opacity = "0.7";

        card.appendChild(cover);
        card.appendChild(title);
        card.appendChild(type);

        mediaGrid.appendChild(card);

    });

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