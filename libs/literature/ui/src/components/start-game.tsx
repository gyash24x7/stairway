import React from "react";
import { trpc } from "../utils/trpc";
import { useNavigate } from "react-router-dom";
import { Button, Flex } from "@s2h/ui";
import { useGame } from "../utils/game-context";

export const StartGame = function () {
    const { id: gameId } = useGame();
    const navigate = useNavigate();

    const { mutateAsync, isLoading } = trpc.useMutation( "start-game", {
        async onSuccess( { id } ) {
            navigate( `/play/${ id }` );
        },
        onError( error ) {
            console.log( error );
            alert( error.message );
        }
    } );

    const startGame = () => mutateAsync( { gameId } );

    return (
        <Flex justify = { "center" } className = { "mt-4" }>
            <Button
                fullWidth
                buttonText = { "Start Game" }
                appearance = { "primary" }
                isLoading = { isLoading }
                onClick = { startGame }
            />
        </Flex>
    );
};