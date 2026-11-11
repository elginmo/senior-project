const PROFILE_BADGES = [
    { icon: "01", name: "FIRST ADD", description: "YOUR ARCHIVE STARTS", unlockedWhen: (items) => items.some((item) => item.owned) },
    { icon: "◉", name: "MUSIC COLLECTOR", description: "BUILD A MUSIC SHELF", unlockedWhen: (items) => items.filter((item) => item.owned && item.type === "music").length >= 3, iconClass: "badge-icon-blue" },
    { icon: "25", name: "25 ITEMS", description: "BUILDING THE STACK", unlockedWhen: (items) => items.filter((item) => item.owned).length >= 25 },
    { icon: "▶", name: "MOVIE NIGHT", description: "ONE MORE SCREENING", unlockedWhen: (items) => items.some((item) => item.owned && (item.type === "movie" || item.type === "tv")), iconClass: "badge-icon-blue" },
    { icon: "★", name: "HOLY GRAIL", description: "THE ONE YOU HAD TO FIND", unlockedWhen: (items) => items.some((item) => item.wishlist) }
];
