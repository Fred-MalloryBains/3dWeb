function imageUrl(path, size = "w92") {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function createActorNode(actor) {
    const element = document.createElement("div");
    element.className = "actor-pill";

    const image = document.createElement("img");
    image.src = imageUrl(actor.profile || actor.profile_path);
    image.alt = actor.name;

    const name = document.createElement("div");
    name.className = "actor-name";
    name.textContent = actor.name;

    element.append(image, name);
    return element;
}

export function createMovieNode(movie) {
    const element = document.createElement("div");
    element.className = "movie-pill";

    const image = document.createElement("img");
    image.src = imageUrl(movie.poster || movie.poster_path);
    image.alt = movie.title || "Movie";

    image.onerror = function () {
        this.style.display = "none";
    };

    const title = document.createElement("div");
    title.className = "movie-title";
    title.textContent = movie.title || movie.movieTitle || "Unknown movie";

    element.append(image, title);
    return element;
}

export function appendStepCard(firstActor, nextActor, movie) {
    const output = document.getElementById("output");
    const card = document.createElement("div");

    card.className = "step-card";
    card.append(
        createActorNode(firstActor),
        createMovieNode(movie),
        createActorNode(nextActor)
    );

    output.append(card);
}

export function logOutput(message, options = null) {
    const output = document.getElementById("output");
    const element = document.createElement("div");
    const level = typeof options === "string" ? options : options?.level;

    element.className = "log-entry text-entry";
    if (level) element.classList.add(level);

    element.innerHTML = message;
    output.prepend(element);
}

export function renderActorPreview(containerId, actor) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.replaceChildren();
    if (!actor) return;

    const card = document.createElement("div");
    card.className = "actor-preview-card";

    const image = document.createElement("img");
    image.src = imageUrl(actor.profile || actor.profile_path, "w185");
    image.alt = actor.name;
    image.onerror = () => {
        image.style.display = "none";
    };

    const name = document.createElement("strong");
    name.textContent = actor.name;

    card.append(image, name);
    container.append(card);
}

export function renderTurnHeader(currentActor, goalActor) {
    document.getElementById("currentActorName").textContent = currentActor.name;
    document.getElementById("goalActorName").textContent = goalActor.name;
    renderActorPreview("currentActorPreview", currentActor);
    renderActorPreview("goalActorPreview", goalActor);
}
