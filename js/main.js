import { startGame, nextTurn } from "./game.js";
import {
    fetchActorSuggestions,
    getRandomActor
} from "./api.js";

document
    .getElementById("startGameButton")
    .addEventListener("click", startGame);

document
    .getElementById("submitActorButton")
    .addEventListener("click", nextTurn);

for (const [inputId, datalistId] of [
    ["startActor", "startSuggestions"],
    ["goalActor", "goalSuggestions"],
    ["nextActor", "nextSuggestions"]
]) {
    document.getElementById(inputId).addEventListener("input", event => {
        fetchActorSuggestions(event.target.value, datalistId);
    });
}

document
    .getElementById("randomStartBtn")
    .addEventListener("click", async () => {
        document.getElementById("startActor").value =
            await getRandomActor();
    });

document
    .getElementById("randomGoalBtn")
    .addEventListener("click", async () => {
        document.getElementById("goalActor").value =
            await getRandomActor();
    });