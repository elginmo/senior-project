const enterButton = document.getElementById("enter-button");
const enterScreen = document.getElementById("enter-screen");
const site = document.getElementById("site");

if (site) {
    site.style.display = "block";
}

if (enterButton && enterScreen && site) {
    enterButton.addEventListener("click", () => {
        enterScreen.style.display = "none";
        site.style.display = "block";
    });
}

async function loadAlbums() {
    const query = "artist:radiohead AND releasegroup:ok computer";
    const musicBrainzUrl = `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

    try {
        const response = await fetch(musicBrainzUrl, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error("MusicBrainz request failed");
        }

        const data = await response.json();
        const albums = data["release-groups"] || [];
        const mediaGrid = document.querySelector(".media-grid");

        if (!mediaGrid) return;

        mediaGrid.innerHTML = "";

        albums.forEach((album) => {
            const card = document.createElement("article");
            card.className = "media-card";

            const cover = document.createElement("div");
            cover.className = "cover-placeholder";

            const img = document.createElement("img");
            img.alt = album.title;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.style.display = "block";

            const coverUrl = `https://coverartarchive.org/release-group/${album.id}/front-250`;
            img.src = coverUrl;

            img.onerror = () => {
                cover.textContent = "NO COVER";
            };

            cover.appendChild(img);

            const title = document.createElement("p");
            title.textContent = album.title;

            const year = document.createElement("small");
            year.textContent = album["first-release-date"] ? album["first-release-date"].slice(0, 4) : "Unknown year";
            year.style.display = "block";
            year.style.marginTop = "6px";
            year.style.fontSize = "11px";
            year.style.letterSpacing = "0.08em";
            year.style.opacity = "0.8";

            card.appendChild(cover);
            card.appendChild(title);
            card.appendChild(year);
            mediaGrid.appendChild(card);
        });
    } catch (error) {
        console.error("Album fetch error:", error);
    }
}

loadAlbums();