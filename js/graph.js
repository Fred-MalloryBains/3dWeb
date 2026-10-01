import { getActorInfo } from "./api.js";

export async function findMinLinks(startId, goalId, maxDepth = 4) {
    const visited = new Set([startId]);
    const queue = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
        const { id, depth } = queue.shift();

        if (depth > maxDepth) {
            break;
        }

        // Move the existing credit and cast requests here.
        // Return depth + 1 when goalId is found.
    }

    return null;
}

export async function findMinLinksWithPath(startId, goalId, maxDepth = 4) {
    // existing findMinLinksWithPath body
}

