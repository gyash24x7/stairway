import React, { Fragment, useState } from "react";
import { Banner, Button, Flex, Modal, VStack } from "@s2h/ui";
import { useGame } from "../utils/game-context";

export function PreviousMoves() {
    const { moves } = useGame();

    const [ isModalOpen, setIsModalOpen ] = useState( false );

    const openModal = () => setIsModalOpen( true );

    const closeModal = () => {
        setIsModalOpen( false );
    };

    return (
        <Fragment>
            <Flex justify = { "center" }>
                <Button
                    buttonText = { "Previous Moves" }
                    appearance = { "default" }
                    onClick = { openModal }
                />
            </Flex>
            <Modal isOpen = { isModalOpen } onClose = { closeModal } title = { "Previous Moves" }>
                <VStack>
                    { moves.slice( 0, 4 ).map( move => (
                        <Banner message = { move.description } key = { move.id } />
                    ) ) }
                </VStack>
            </Modal>
        </Fragment>
    );
}