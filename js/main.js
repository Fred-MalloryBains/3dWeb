import { 
    startGame,
    nextTurn, 
    finishGame
} from "./game.js";
import {
    fetchActorSuggestions,
    getActor,
    getRandomActor
} from "./api.js";
import { renderActorPreview } from "./dom.js";

document
    .getElementById("startGameButton")
    .addEventListener("click", startGame);

document
    .getElementById("submitActorButton")
    .addEventListener("click", nextTurn);

document
    .getElementById("restartGameButton")
    .addEventListener("click", finishGame);



for (const [inputId, datalistId] of [
    ["startActor", "startSuggestions"],
    ["goalActor", "goalSuggestions"],
    ["nextActor", "nextSuggestions"]
]) {
    const input = document.getElementById(inputId);

    input.addEventListener("input", event => {
        const query = event.target.value.trim();
        if (query.length < 2) {
            document.getElementById(datalistId).replaceChildren();
            return;
        }
        fetchActorSuggestions(query, datalistId);
    });

    input.addEventListener("change", () => {
        // Clear suggestions so the popup closes upon selection
        document.getElementById(datalistId).replaceChildren();
    });
}


async function updateActorPreview(inputId, previewId) {
    const name = document.getElementById(inputId).value.trim();
    if (!name) {
        renderActorPreview(previewId, null);
        return;
    }

    try {
        const actor = await getActor(name);
        renderActorPreview(previewId, actor);
    } catch (error) {
        renderActorPreview(previewId, null);
        console.error(error);
    }
}

document.getElementById("startActor").addEventListener("change", () => {
    updateActorPreview("startActor", "startPreview");
});

document.getElementById("goalActor").addEventListener("change", () => {
    updateActorPreview("goalActor", "goalPreview");
});

document
    .getElementById("randomStartBtn")
    .addEventListener("click", async () => {
        document.getElementById("startActor").value = await getRandomActor();
        updateActorPreview("startActor", "startPreview");
    });

document
    .getElementById("randomGoalBtn")
    .addEventListener("click", async () => {
        document.getElementById("goalActor").value = await getRandomActor();
        updateActorPreview("goalActor", "goalPreview");
    });

document
    .getElementById("finishGameButton")
    .addEventListener("click", () => {
        const goalName = document
            .getElementById("goalActorName")
            .textContent
            .trim();

        nextTurn(goalName);
    });