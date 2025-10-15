export function load_animation_data() {
    return;
}

const API_KEY = "1e63f63886eeec27cacf04aa4928da5a";


// Example function to fetch popular movies
const BASE_URL = "https://api.themoviedb.org/3";

let firstActor = null;
let goalActor = null;

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

    document.getElementById("goalName").textContent = goalActor.name;
    document.getElementById("setup").style.display = "none";
    document.getElementById("game").style.display = "block";
    logOutput(`Game started!\nYou need to connect ${firstActor.name} ➡️ ${goalActor.name}`);
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
            logOutput(`✅ ${firstActor.name} and ${nextActor.name} were in "${match.title}" together.`);
            logOutput(`<img src="${match.poster}" alt="Movie Poster" style="max-height: 200px;">`);
            firstActor = nextActor;
            if (nextActor.name === goalActor.name) {
                logOutput("🎉 You won!!");
                document.getElementById("game").style.display = "none";
            }
        } else {
            logOutput(`❌ No link found between ${firstActor.name} and ${nextActor.name}. You lost!`);
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
});

window.startGame = startGame;
window.nextTurn = nextTurn;