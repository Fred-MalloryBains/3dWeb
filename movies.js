export function load_animation_data() {
    return;
}

const API_KEY = "1e63f63886eeec27cacf04aa4928da5a";


// Example function to fetch popular movies
const BASE_URL = "https://api.themoviedb.org/3";

let firstActor = null;
let goalActor = null;
let playerPath = []; // [{id, name, movieTitle, poster}]
let shortestPath = []; // [{id, name, movieTitle, poster}]
let minLinks = null;

// NEW: background calculation state
let calculatingMinLinks = false;
let minLinksPromise = null;
let gameFinished = false;
let finalPlayerLinks = null;

// NEW: track comparison card node so we can replace the placeholder when result arrives
let comparisonCardNode = null;

// Helper to get actor name and profile image by ID
async function getActorInfo(id) {
    const res = await fetch(`${BASE_URL}/person/${id}?api_key=${API_KEY}`);
    const data = await res.json();
    return {
        name: data.name,
        profile: data.profile_path
            ? `https://image.tmdb.org/t/p/w92${data.profile_path}`
            : null
    };
}

// small helper to build a path summary string (used for both player & shortest)
// (kept as a lightweight fallback, UI now renders path cards)
function buildPathSummary(path) {
    if (!path || path.length === 0) return "";
    let summary = "";
    for (let i = 0; i < path.length - 1; i++) {
        summary += `${path[i].name} -> ${path[i + 1].name} (${path[i + 1].movieTitle || "?"})\n`;
    }
    summary += `${path[path.length - 1].name}`;
    return summary;
}

// --- new UI helpers for nicer log cards ---
function normalizeProfile(obj) {
    // Accepts objects with .profile, .profile_path, or .poster
    if (!obj) return null;
    if (obj.profile) return obj.profile;
    if (obj.profile_path) return `https://image.tmdb.org/t/p/w92${obj.profile_path}`;
    return null;
}

function createActorNode(name, profileUrl) {
    const wrap = document.createElement("div");
    wrap.className = "actor-pill";
    const img = document.createElement("img");
    img.src = profileUrl || "";
    img.alt = name;
    img.onerror = function () { this.style.display = "none"; };
    const span = document.createElement("div");
    span.className = "actor-name";
    span.textContent = name;
    wrap.appendChild(img);
    wrap.appendChild(span);
    return wrap;
}

function createMovieNode(title, posterUrl) {
    const wrap = document.createElement("div");
    wrap.className = "movie-pill";
    const img = document.createElement("img");
    img.src = posterUrl || "";
    img.alt = title;
    img.onerror = function () { this.style.display = "none"; };
    const span = document.createElement("div");
    span.className = "movie-title";
    span.textContent = title;
    wrap.appendChild(img);
    wrap.appendChild(span);
    return wrap;
}

function prependToOutput(node) {
    const output = document.getElementById("output");
    output.insertBefore(node, output.firstChild);
}

function appendStepCard(fromActor, toActor, movie) {
    // fromActor and toActor are objects with .name and either .profile or .profile_path
    const card = document.createElement("div");
    card.className = "log-entry step-card";

    const left = createActorNode(fromActor.name, normalizeProfile(fromActor));
    const arrow1 = document.createElement("div");
    arrow1.className = "arrow";
    arrow1.innerHTML = "➡️";

    const movieNode = createMovieNode(movie.title || movie.movieTitle || "?", movie.poster || movie.poster_path);

    const arrow2 = document.createElement("div");
    arrow2.className = "arrow";
    arrow2.innerHTML = "➡️";

    const right = createActorNode(toActor.name, normalizeProfile(toActor));

    card.appendChild(left);
    card.appendChild(arrow1);
    card.appendChild(movieNode);
    card.appendChild(arrow2);
    card.appendChild(right);

    prependToOutput(card);
}

function appendPathCard(path, headerText) {
    if (!path || path.length === 0) return;
    const card = document.createElement("div");
    card.className = "log-entry path-card";

    const header = document.createElement("div");
    header.className = "card-header";
    header.textContent = headerText || "Path";
    card.appendChild(header);

    const container = document.createElement("div");
    container.className = "path-steps";

    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        const actorNode = createActorNode(p.name, p.profile || p.profile_path);
        container.appendChild(actorNode);
        if (i < path.length - 1) {
            const arrow = document.createElement("div");
            arrow.className = "small-arrow";
            arrow.innerHTML = "➡";
            container.appendChild(arrow);

            const movieNode = createMovieNode(path[i + 1].movieTitle || "?", path[i + 1].poster || path[i + 1].poster_path);
            container.appendChild(movieNode);
        }
    }

    card.appendChild(container);
    prependToOutput(card);
}

function appendComparisonCard(playerPathLocal, shortestPathLocal, minLinksLocal, playerLinks, note) {
    const card = document.createElement("div");
    card.className = "log-entry compare-card";

    const header = document.createElement("div");
    header.className = "card-header";
    header.innerHTML = `Result ${note ? " (updated)" : ""}`;
    card.appendChild(header);

    const counts = document.createElement("div");
    counts.className = "counts-row";
    const playerBadge = document.createElement("div");
    playerBadge.className = "count-badge";
    playerBadge.innerHTML = `You: <b>${playerLinks}</b>`;

    const shortestBadge = document.createElement("div");
    shortestBadge.className = "count-badge";
    shortestBadge.innerHTML = `Par: <b>${minLinksLocal !== null ? minLinksLocal : "?"}</b>`;

    counts.appendChild(playerBadge);
    counts.appendChild(shortestBadge);
    card.appendChild(counts);

    const panels = document.createElement("div");
    panels.className = "compare-panels";

    const leftPanel = document.createElement("div");
    leftPanel.className = "panel";
    const leftHdr = document.createElement("div");
    leftHdr.className = "panel-title";
    leftHdr.textContent = "Your path";
    leftPanel.appendChild(leftHdr);
    if (playerPathLocal && playerPathLocal.length) {
        const p = document.createElement("div");
        p.className = "panel-body";
        p.innerHTML = ""; // will populate
        // reuse appendPathCard visuals but inline
        playerPathLocal.forEach((step, idx) => {
            const actor = createActorNode(step.name, step.profile || step.profile_path);
            p.appendChild(actor);
            if (idx < playerPathLocal.length - 1) {
                const movieNode = createMovieNode(playerPathLocal[idx + 1].movieTitle || "?", playerPathLocal[idx + 1].poster || playerPathLocal[idx + 1].poster_path);
                p.appendChild(movieNode);
            }
        });
        leftPanel.appendChild(p);
    } else {
        const pEmpty = document.createElement("div");
        pEmpty.className = "panel-body";
        pEmpty.textContent = "No path.";
        leftPanel.appendChild(pEmpty);
    }

    const rightPanel = document.createElement("div");
    rightPanel.className = "panel";
    const rightHdr = document.createElement("div");
    rightHdr.className = "panel-title";
    rightHdr.textContent = "Shortest path";
    rightPanel.appendChild(rightHdr);

    if (shortestPathLocal && shortestPathLocal.length) {
        const p2 = document.createElement("div");
        p2.className = "panel-body";
        shortestPathLocal.forEach((step, idx) => {
            const actor = createActorNode(step.name, step.profile || step.profile_path);
            p2.appendChild(actor);
            if (idx < shortestPathLocal.length - 1) {
                const movieNode = createMovieNode(shortestPathLocal[idx + 1].movieTitle || "?", shortestPathLocal[idx + 1].poster || shortestPathLocal[idx + 1].poster_path);
                p2.appendChild(movieNode);
            }
        });
        rightPanel.appendChild(p2);
    } else {
        const pEmpty2 = document.createElement("div");
        pEmpty2.className = "panel-body";
        pEmpty2.textContent = minLinksLocal === null ? "Still calculating..." : "No path found.";
        rightPanel.appendChild(pEmpty2);
    }

    panels.appendChild(leftPanel);
    panels.appendChild(rightPanel);
    card.appendChild(panels);

    // difference
    const diff = document.createElement("div");
    diff.className = "diff-row";
    const diffVal = (playerLinks - (minLinksLocal || 0));
    diff.innerHTML = `You were <b>+${diffVal}</b> from par.`;
    card.appendChild(diff);

    // If this is an update and we have a placeholder card, replace it.
    if (note && comparisonCardNode && comparisonCardNode.parentNode) {
        const output = document.getElementById("output");
        output.replaceChild(card, comparisonCardNode);
        comparisonCardNode = card;
    } else {
        prependToOutput(card);
        // store as the comparison card so future updates can replace it
        comparisonCardNode = card;
    }
}

// Replaces plain-text logOutput to keep small messages but still styled
function logOutput(msg, opts = {}) {
    const output = document.getElementById("output");
    const node = document.createElement("div");
    node.className = "log-entry text-entry";
    if (opts.level === "error") node.classList.add("error");
    node.innerHTML = msg;
    prependToOutput(node);
}

// Helper to get movie linking two actors
async function getLinkingMovie(actorId1, actorId2) {
    const res = await fetch(`${BASE_URL}/person/${actorId1}/movie_credits?api_key=${API_KEY}`);
    const credits = await res.json();
    for (const movie of credits.cast) {
        const creditRes = await fetch(`${BASE_URL}/movie/${movie.id}/credits?api_key=${API_KEY}`);
        const creditData = await creditRes.json();
        if (creditData.cast.some(c => c.id === actorId2)) {
            return {
                title: movie.title,
                poster: movie.poster_path
                    ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
                    : null
            };
        }
    }
    return { title: "?", poster: null };
}

// Modified BFS to also return the shortest path with movies and actor images
async function findMinLinksWithPath(startId, goalId, maxDepth = 4) {
    const visited = new Set();
    const startInfo = await getActorInfo(startId);
    const queue = [{
        id: startId,
        depth: 0,
        path: [{
            id: startId,
            name: startInfo.name,
            profile: startInfo.profile
        }]
    }];
    visited.add(startId);

    while (queue.length > 0) {
        const { id, depth, path } = queue.shift();
        if (depth > maxDepth) break;

        const res = await fetch(`${BASE_URL}/person/${id}/movie_credits?api_key=${API_KEY}`);
        const credits = await res.json();
        for (const movie of credits.cast) {
            const creditRes = await fetch(`${BASE_URL}/movie/${movie.id}/credits?api_key=${API_KEY}`);
            const creditData = await creditRes.json();
            for (const actor of creditData.cast) {
                if (actor.id === goalId) {
                    const goalInfo = await getActorInfo(actor.id);
                    const newPath = [...path, {
                        id: actor.id,
                        name: actor.name,
                        profile: goalInfo.profile,
                        movieTitle: movie.title,
                        poster: movie.poster_path
                            ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
                            : null
                    }];
                    return { minLinks: depth + 1, path: newPath };
                }
                if (!visited.has(actor.id)) {
                    visited.add(actor.id);
                    const actorInfo = await getActorInfo(actor.id);
                    queue.push({
                        id: actor.id,
                        depth: depth + 1,
                        path: [...path, {
                            id: actor.id,
                            name: actor.name,
                            profile: actorInfo.profile,
                            movieTitle: movie.title,
                            poster: movie.poster_path
                                ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
                                : null
                        }]
                    });
                }
            }
        }
    }
    return null;
}

async function getActor(name) {
    const res = await fetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(name)}`);
    const data = await res.json();
    return data.results && data.results.length > 0 ? data.results[0] : null;
}

async function getMovies(actorId) {
    const res = await fetch(`${BASE_URL}/person/${actorId}/movie_credits?api_key=${API_KEY}`);
    const credits = await res.json();
    const movies = {};
    for (const movie of credits.cast) {
        const creditRes = await fetch(`${BASE_URL}/movie/${movie.id}/credits?api_key=${API_KEY}`);
        const creditData = await creditRes.json();
        movies[movie.title] = { cast: creditData.cast.map(c => c.name), poster_path: movie.poster_path };
    }
    return movies;
}

function searchMovie(movies, actorName) {
    for (const [title, info] of Object.entries(movies)) {
        if (info.cast.includes(actorName)) {
            console.log (`found: ${info.poster_path}`);
            return {
            title,
            poster: info.poster_path
                ? `https://image.tmdb.org/t/p/w342${info.poster_path}`
                : null
            };
        }
        }
        return null;
}

// Find minimum links using BFS (limited depth for performance)
async function findMinLinks(startId, goalId, maxDepth = 4) {
    const visited = new Set();
    const queue = [{ id: startId, depth: 0 }];
    visited.add(startId);

    while (queue.length > 0) {
        const { id, depth } = queue.shift();
        if (depth > maxDepth) break;

        // Get movies for this actor
        const res = await fetch(`${BASE_URL}/person/${id}/movie_credits?api_key=${API_KEY}`);
        const credits = await res.json();
        for (const movie of credits.cast) {
            // Get cast for this movie
            const creditRes = await fetch(`${BASE_URL}/movie/${movie.id}/credits?api_key=${API_KEY}`);
            const creditData = await creditRes.json();
            for (const actor of creditData.cast) {
                if (actor.id === goalId) {
                    return depth + 1; // Found goal actor
                }
                if (!visited.has(actor.id)) {
                    visited.add(actor.id);
                    queue.push({ id: actor.id, depth: depth + 1 });
                }
            }
        }
    }
    return null; // Not found within maxDepth
}

async function startGame() {
    const startName = document.getElementById("startActor").value.trim();
    const goalName = document.getElementById("goalActor").value.trim();
    if (!startName || !goalName) {
        alert("Please enter both actor names!");
        return;
    }

    // reset comparison card tracking for a new game
    comparisonCardNode = null;

    firstActor = await getActor(startName);
    goalActor = await getActor(goalName);

    if (!firstActor || !goalActor) {
        alert("Could not find one of the actors. Try again!");
        return;
    }

    // Show actor images next to goal name
    document.getElementById("goalName").innerHTML = `${goalActor.name} ${goalActor.profile_path ? `<img src="https://image.tmdb.org/t/p/w45${goalActor.profile_path}" style="height:40px;vertical-align:middle;">` : ""}`;
    document.getElementById("setup").style.display = "none";
    document.getElementById("game").style.display = "block";

    logOutput(`Game started!<br>
        <img src="${firstActor.profile_path ? `https://image.tmdb.org/t/p/w45${firstActor.profile_path}` : ""}" style="height:40px;vertical-align:middle;"> 
        <b>${firstActor.name}</b> ➡️ 
        <img src="${goalActor.profile_path ? `https://image.tmdb.org/t/p/w45${goalActor.profile_path}` : ""}" style="height:40px;vertical-align:middle;"> 
        <b>${goalActor.name}</b>`);

    // Start minimum-links calculation in the background so player can play immediately
    calculatingMinLinks = true;
    minLinksPromise = findMinLinksWithPath(firstActor.id, goalActor.id, 3)
        .then(result => {
            calculatingMinLinks = false;
            if (result) {
                minLinks = result.minLinks;
                shortestPath = result.path;
            } else {
                minLinks = null;
                shortestPath = [];
                logOutput("🔎 No connection found within 3 links.");
            }

            // If player already finished the game, append the shortest-path summary now
            if (gameFinished) {
                // use the nicer comparison card UI
                appendComparisonCard(playerPath, shortestPath, minLinks, finalPlayerLinks, /*note=*/true);
            }
            return result;
        })
        .catch(err => {
            calculatingMinLinks = false;
            console.error("Error calculating min links:", err);
            if (gameFinished) {
                logOutput("(Updated) Shortest path calculation failed.");
            }
        });

    playerPath = [{
        id: firstActor.id,
        name: firstActor.name,
        profile: firstActor.profile_path
            ? `https://image.tmdb.org/t/p/w92${firstActor.profile_path}`
            : null,
        movieTitle: null,
        poster: null
    }]; // Start tracking player's path
}

async function nextTurn() {
    const nextName = document.getElementById("nextActor").value.trim();
    if (!nextName) return;

    const loadingBar = document.getElementById("loadingBar");
    loadingBar.style.display = "block"; // Show loading bar

    try {
        const nextActor = await getActor(nextName);
        if (!nextActor) {
            logOutput("❌ Actor not found!", { level: "error" });
            return;
        }

        const movies = await getMovies(firstActor.id);
        const match = searchMovie(movies, nextActor.name);

        if (match) {
            // append structured step card connecting actors and movie
            appendStepCard(firstActor, nextActor, match);

            firstActor = nextActor;
            playerPath.push({
                id: nextActor.id,
                name: nextActor.name,
                profile: nextActor.profile_path
                    ? `https://image.tmdb.org/t/p/w92${nextActor.profile_path}`
                    : null,
                movieTitle: match.title,
                poster: match.poster
            });

            if (nextActor.name === goalActor.name) {
                // Game won, show summary (shortest path may still be calculating)
                document.getElementById("game").style.display = "none";
                gameFinished = true;
                finalPlayerLinks = playerPath.length - 1;

                // If shortest already available, show comparison card now; otherwise show player path and a placeholder
                if (!calculatingMinLinks && shortestPath && shortestPath.length > 0 && minLinks != null) {
                    appendComparisonCard(playerPath, shortestPath, minLinks, finalPlayerLinks);
                } else {
                    appendComparisonCard(playerPath, [], minLinks, finalPlayerLinks);
                    // when minLinksPromise resolves it will update with (note) because of earlier .then logic
                }
            }
        } else {
            logOutput(`❌ No link found between <b>${firstActor.name}</b> and <b>${nextActor.name}</b>. You lost!`, { level: "error" });
            document.getElementById("game").style.display = "none";
            // stop background update if it completes later (we won't post it in this case)
            gameFinished = false;
        }

        document.getElementById("nextActor").value = "";
    } catch (error) {
        logOutput("❌ An error occurred. Please try again.", { level: "error" });
        console.error(error);
    } finally {
        loadingBar.style.display = "none"; // Hide loading bar
    }
}

// Removed duplicate plain-text logOutput that caused script errors.
// (There is already a `function logOutput(msg, opts = {}) { ... }` earlier.)
async function fetchActorSuggestions(query, datalistId) {
  if (query.length < 2) return; // avoid spamming API for short input
  const res = await fetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
  const data = await res.json();
  const datalist = document.getElementById(datalistId);
  datalist.innerHTML = ""; // clear old results

  if (data.results) {
    data.results.slice(0, 8).forEach(actor => {
      const option = document.createElement("option");
      option.value = actor.name;
      datalist.appendChild(option); // fixed typo
    });
  }
}

// Utility to get a random actor from TMDB top 250 popular people
async function getRandomActor() {
    // TMDB popular people endpoint has 20 results per page
    // To cover top 250, use pages 1-13 (13*20=260)
    const page = Math.floor(Math.random() * 13) + 1;
    const res = await fetch(`${BASE_URL}/person/popular?api_key=${API_KEY}&page=${page}`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
        const idx = Math.floor(Math.random() * data.results.length);
        return data.results[idx].name;
    }
    return "";
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("startActor").addEventListener("input", (e) => {
        fetchActorSuggestions(e.target.value, "startSuggestions");
    });

    document.getElementById("goalActor").addEventListener("input", (e) => {
        fetchActorSuggestions(e.target.value, "goalSuggestions");
    });

    document.getElementById("nextActor").addEventListener("input", (e) => {
        fetchActorSuggestions(e.target.value, "nextSuggestions");
    });

    // Add random button functionality
    document.getElementById("randomStartBtn").addEventListener("click", async () => {
        document.getElementById("startActor").value = await getRandomActor();
    });
    document.getElementById("randomGoalBtn").addEventListener("click", async () => {
        document.getElementById("goalActor").value = await getRandomActor();
    });
});

window.startGame = startGame;
window.nextTurn = nextTurn;