const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const BACKEND_URL = "http://127.0.0.1:5000";

export async function getActor(name) {

    const response = await fetch(
        `${BACKEND_URL}/api/actors/search?name=${encodeURIComponent(name)}`
    );

    if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
    }

    return await response.json();
}

export async function getActorInfo(id) {
    const response = await fetch(
        `${BACKEND_URL}/api/actors/${encodeURIComponent(id)}`
    );

    if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = await response.json();

    return {
        name: data.name,
        profile: data.profile_path
            ? `https://image.tmdb.org/t/p/w92${data.profile_path}`
            : null
    };
}

export async function getLinkingMovies(actorId1, actorId2) {
    const response = await fetch(
        `${BACKEND_URL}/api/get_linking_movies?actor1=${encodeURIComponent(actorId1)}&actor2=${encodeURIComponent(actorId2)}`
    );

    if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
    }

    const movies = await response.json();

    if (!Array.isArray(movies) || movies.length === 0) {
        return null;
    }

    const movie = [...movies].sort(
        (a, b) => (b.popularity || 0) - (a.popularity || 0)
    )[0];

    return {
        ...movie,
        title: movie.title,
        poster: movie.poster_path
            ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
            : null
    };
}

export async function fetchActorSuggestions(query, datalistId) {
    const datalist = document.getElementById(datalistId);
    
    if (!query) {
        document.getElementById(datalistId).innerHTML = "";
        return;
    }

    const response = await fetch(
        `${BACKEND_URL}/api/fetch_actor_suggestions?query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
        console.error(`Backend request failed: ${response.status}`);
        return;
    }

    const actors = await response.json();
    const seenNames = new Set();

    datalist.replaceChildren();

    for (const actor of Array.isArray(actors) ? actors : []) {
        const name = actor.name?.trim();
        const key = name?.toLowerCase();

        if (!name || seenNames.has(key)) {
            continue;
        }

        seenNames.add(key);

        const option = document.createElement("option");
        option.value = name;
        datalist.appendChild(option);
    }
}

export async function getRandomActor() {
    const response = await fetch(
        `${BACKEND_URL}/api/get_random_actor`
    );

    if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.name;
}