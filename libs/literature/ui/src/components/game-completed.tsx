import React from "react";
import { useGame } from "../utils/game-context";
import { Flex } from "@s2h/ui";
import { CheckCircleIcon } from "@heroicons/react/solid";

export function GameCompleted() {
    const { myTeam, oppositeTeam } = useGame();

    return (
        <Flex
            direction = { "col" }
            justify = { "center" }
            align = { "center" }
            className = { "w-full h-full" }
        >
            <CheckCircleIcon className = { "text-success w-1/2 h-1/2" } />
            <h2 className = { "font-fjalla text-success text-4xl my-2" }>Game Completed</h2>
            { myTeam!.score > oppositeTeam!.score && (
                <h2 className = { "font-fjalla text-success text-4xl my-2" }>Team { myTeam?.name } Won!</h2>
            ) }
            { oppositeTeam!.score > myTeam!.score && (
                <h2 className = { "font-fjalla text-success text-4xl my-2" }>Team { oppositeTeam?.name } Won!</h2>
            ) }
            { oppositeTeam!.score === myTeam!.score && (
                <h2 className = { "font-fjalla text-success text-4xl my-2" }>Match Tied!</h2>
            ) }
        </Flex>
    );
}