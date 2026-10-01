import { getActor, getLinkingMovies } from "./api.js";
import { gameState, resetGameState } from "./gameState.js";
import { appendStepCard, 
         logOutput
        } from "./dom.js";
import { findMinLinksWithPath } from "./graph.js";

export async function startGame() {
    resetGameState();

    const startName = document
        .getElementById("startActor")
        .value
        .trim();

    const goalName = document
        .getElementById("goalActor")
        .value
        .trim();

    gameState.firstActor = await getActor(startName);
    gameState.goalActor = await getActor(goalName);

    if (!gameState.firstActor || !gameState.goalActor) {
        logOutput("Actor not found.", "error");
        return;
    }

    gameState.playerPath = [
        {
            id: gameState.firstActor.id,
            name: gameState.firstActor.name
        }
    ];

    document.getElementById("game").style.display = "block";
    document.getElementById("goalName").textContent = gameState.goalActor.name;
    document.getElementById("setup").style.display = "none";
}

export async function nextTurn() {
    const nextName = document.getElementById("nextActor").value.trim();
    if (!nextName) return;

    const loadingBar = document.getElementById("loadingBar");
    loadingBar.style.display = "block"; // Show loading bar

    try {
        const nextActor = await getActor(nextName);
        if (!nextActor) {
            logOutput("❌ Actor not found!", "error");
            return;
        }

        const match = await getLinkingMovies(
            gameState.firstActor.id, 
            nextActor.id);
        
        if (match) {
            // append structured step card connecting actors and movie
            appendStepCard(gameState.firstActor, nextActor, match);

            gameState.firstActor = nextActor;
            gameState.playerPath.push({
                id: nextActor.id,
                name: nextActor.name,
                profile: nextActor.profile_path
                    ? `https://image.tmdb.org/t/p/w92${nextActor.profile_path}`
                    : null,
                movieTitle: match.title,
                poster: match.poster
            });

            if (nextActor.name === gameState.goalActor.name) {
                // Game won, show summary (shortest path may still be calculating)
                document.getElementById("game").style.display = "none";
                gameState.gameFinished = true;
                gameState.finalPlayerLinks = gameState.playerPath.length - 1;
                 
                logOutput(`🎉 Congratulations! You reached <b>${gameState.goalActor.name}</b> in ${gameState.finalPlayerLinks} links!`, { level: "success" });
                    
                
            }
        } else {
            logOutput(`❌ No link found between <b>${gameState.firstActor.name}</b> and <b>${nextActor.name}</b>. You lost!`, { level: "error" });
            document.getElementById("game").style.display = "none";
            // stop background update if it completes later (we won't post it in this case)
            gameState.gameFinished = false;
        }

        document.getElementById("nextActor").value = "";
    } catch (error) {
        logOutput("❌ An error occurred. Please try again.", { level: "error" });
        console.error(error);
    } finally {
        loadingBar.style.display = "none"; // Hide loading bar
    }
}



