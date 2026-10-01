export const gameState = {
    firstActor: null,
    goalActor: null,
    playerPath: [],
    shortestPath: [],
    minLinks: null,
    calculatingMinLinks: false,
    gameFinished: false,
    finalPlayerLinks: null,
    comparisonCardNode: null
};

export function resetGameState() {
    gameState.firstActor = null;
    gameState.goalActor = null;
    gameState.playerPath = [];
    gameState.shortestPath = [];
    gameState.minLinks = null;
    gameState.calculatingMinLinks = false;
    gameState.gameFinished = false;
    gameState.finalPlayerLinks = null;
    gameState.comparisonCardNode = null;
}