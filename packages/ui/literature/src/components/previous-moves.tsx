import {
	Box,
	Button,
	ButtonText,
	Heading,
	Icon,
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	Text,
	VStack
} from "@gluestack-ui/themed";
import { X } from "lucide-react-native";
import { Fragment, useRef, useState } from "react";
import { useMoves } from "../store";

export const PreviousMoves = () => {
	const [ showModal, setShowModal ] = useState( false );
	const ref = useRef( null );
	const moves = useMoves();

	const openModal = () => setShowModal( true );
	const closeModal = () => setShowModal( false );

	return (
		<Fragment>
			<Button flex={ 1 } onPress={ openModal }>
				<ButtonText size={ "sm" }>PREVIOUS MOVES</ButtonText>
			</Button>
			<Modal isOpen={ showModal } onClose={ closeModal } finalFocusRef={ ref }>
				<ModalBackdrop/>
				<ModalContent>
					<ModalHeader>
						<Heading size="lg">Previous Moves</Heading>
						<ModalCloseButton>
							<Icon as={ X }/>
						</ModalCloseButton>
					</ModalHeader>
					<ModalBody>
						<VStack gap={ "$3" }>
							{ moves.map( ( move ) => (
								<Box key={ move.id } borderWidth={ 2 } p={ "$3" } borderRadius={ "$md" }
									 borderColor={ "$borderDark100" }>
									<Text>{ move.description }</Text>
								</Box>
							) ) }
						</VStack>
					</ModalBody>
					<ModalFooter/>
				</ModalContent>
			</Modal>
		</Fragment>
	);
};