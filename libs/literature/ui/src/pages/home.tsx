import React from "react";
import { Button, Flex, VStack } from "@s2h/ui";
import { CreateGame } from "../components/create-game";
import { JoinGame } from "../components/join-game";
import { LoginIcon, LogoutIcon } from "@heroicons/react/solid";
import { UserCard } from "../components/user-card";
import { useAuth } from "../utils/auth";

export default function () {
    const { user, login, logout } = useAuth();

    return (
        <Flex
            justify = { "center" }
            align = { "center" }
            className = { "w-screen min-h-screen p-10 bg-dark-700/60" }
        >
            <div className = { "absolute w-screen h-screen literature-bg top-0 -z-10" } />
            <VStack className = { "w-80" } spacing = { "2xl" } centered>
                <img
                    alt = ""
                    src = { "https://res.cloudinary.com/gyuapstha/image/upload/v1659599981/suits/literature-icon.png" }
                    width = { 200 }
                    height = { 200 }
                    className = { "self-center" }
                />
                { !!user && <CreateGame /> }
                { !!user && <JoinGame /> }
                <Button buttonText = { "Instructions" } fullWidth appearance = { "success" } />
                { !!user && <UserCard /> }
                { !!user && (
                    <Button
                        iconBefore = { LogoutIcon }
                        buttonText = { "Logout" }
                        appearance = { "danger" }
                        onClick = { logout }
                    />
                ) }
                { !user && (
                    <Button
                        fullWidth
                        iconBefore = { LoginIcon }
                        buttonText = { "Login with Google" }
                        appearance = { "default" }
                        onClick = { login }
                    />
                )
                }
            </VStack>
        </Flex>
    );
};