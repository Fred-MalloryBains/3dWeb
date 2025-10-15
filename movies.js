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

// Update getActorName to use getActorInfo for backward compatibility
async function getActorName(id) {
    const info = await getActorInfo(id);
    return info.name;
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

    // Show minimum links needed and store shortest path
    logOutput("🔎 Calculating minimum links...");
    const result = await findMinLinksWithPath(firstActor.id, goalActor.id, 3); // Limit depth for speed
    if (result) {
        minLinks = result.minLinks;
        shortestPath = result.path;
        logOutput(`Minimum links needed: <b>${minLinks}</b>`);
    } else {
        logOutput("No connection found within 3 links.");
    }

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
            logOutput("❌ Actor not found!");
            return;
        }

        const movies = await getMovies(firstActor.id);
        const match = searchMovie(movies, nextActor.name);

        if (match) {
            logOutput(`✅ <img src="${firstActor.profile_path ? `https://image.tmdb.org/t/p/w45${firstActor.profile_path}` : ""}" style="height:40px;vertical-align:middle;"> <b>${firstActor.name}</b> and <img src="${nextActor.profile_path ? `https://image.tmdb.org/t/p/w45${nextActor.profile_path}` : ""}" style="height:40px;vertical-align:middle;"> <b>${nextActor.name}</b> were in "<b>${match.title}</b>" together.`);
            logOutput(`<img src="${match.poster}" alt="Movie Poster" style="max-height: 200px;">`);
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
                // Game won, show summary
                document.getElementById("game").style.display = "none";

                // Format player's path
                let playerSummary = "";
                for (let i = 0; i < playerPath.length - 1; i++) {
                    playerSummary += `<img src="${playerPath[i].profile ? playerPath[i].profile : ""}" style="height:40px;vertical-align:middle;"> ${playerPath[i].name} <br>`;
                    playerSummary += `&nbsp;&nbsp;🎬 <b>${playerPath[i + 1].movieTitle}</b>`;
                    if (playerPath[i + 1].poster)
                        playerSummary += ` <img src="${playerPath[i + 1].poster}" style="height:40px;vertical-align:middle;">`;
                    playerSummary += `<br>`;
                }
                playerSummary += `<img src="${playerPath[playerPath.length - 1].profile ? playerPath[playerPath.length - 1].profile : ""}" style="height:40px;vertical-align:middle;"> ${playerPath[playerPath.length - 1].name}`;

                // Format shortest path
                let shortestSummary = "";
                for (let i = 0; i < shortestPath.length - 1; i++) {
                    shortestSummary += `<img src="${shortestPath[i].profile ? shortestPath[i].profile : ""}" style="height:40px;vertical-align:middle;"> ${shortestPath[i].name} <br>`;
                    shortestSummary += `&nbsp;&nbsp;🎬 <b>${shortestPath[i + 1].movieTitle}</b>`;
                    if (shortestPath[i + 1].poster)
                        shortestSummary += ` <img src="${shortestPath[i + 1].poster}" style="height:40px;vertical-align:middle;">`;
                    shortestSummary += `<br>`;
                }
                shortestSummary += `<img src="${shortestPath[shortestPath.length - 1].profile ? shortestPath[shortestPath.length - 1].profile : ""}" style="height:40px;vertical-align:middle;"> ${shortestPath[shortestPath.length - 1].name}`;

                logOutput("🎉 You won!!<br>" +
                    `Your path (${playerPath.length - 1} links):<br>${playerSummary}<br>` +
                    `Shortest path (${minLinks} links):<br>${shortestSummary}<br>` +
                    `You were <b>+${(playerPath.length - 1) - minLinks}</b> from par!`);
            }
        } else {
            logOutput(`❌ No link found between <img src="${firstActor.profile_path ? `https://image.tmdb.org/t/p/w45${firstActor.profile_path}` : ""}" style="height:40px;vertical-align:middle;"> <b>${firstActor.name}</b> and <img src="${nextActor.profile_path ? `https://image.tmdb.org/t/p/w45${nextActor.profile_path}` : ""}" style="height:40px;vertical-align:middle;"> <b>${nextActor.name}</b>. You lost!`);
            document.getElementById("game").style.display = "none";
        }

        document.getElementById("nextActor").value = "";
    } catch (error) {
        logOutput("❌ An error occurred. Please try again.");
        console.error(error);
    } finally {
        loadingBar.style.display = "none"; // Hide loading bar
    }
}

function logOutput(msg) {
    const output = document.getElementById("output");
    output.innerHTML = msg + "<br>" + output.innerHTML;
}

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
      datalist.appendChild(opt=ion);

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