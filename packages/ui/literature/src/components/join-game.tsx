import {
	Button,
	ButtonSpinner,
	ButtonText,
	Heading,
	Icon,
	Input,
	InputField,
	Modal,
	ModalBackdrop,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader
} from "@gluestack-ui/themed";
import { router } from "expo-router";
import { X } from "lucide-react-native";
import { Fragment, useRef, useState } from "react";
import { useJoinGameMutation } from "../store";

export const JoinGame = () => {
	const [ code, setCode ] = useState( "" );
	const [ showModal, setShowModal ] = useState( false );
	const ref = useRef( null );

	const openModal = () => setShowModal( true );
	const closeModal = () => setShowModal( false );

	const { mutateAsync, isPending } = useJoinGameMutation();
	const handleSubmit = async () => mutateAsync( { code: code.toUpperCase() } )
		.then( ( data ) => {
			router.replace( `/literature/${ data.id }` );
		} )
		.catch( e => {
			console.log( e );
		} );

	return (
		<Fragment>
			<Button flex={ 1 } onPress={ openModal }>
				<ButtonText>JOIN GAME</ButtonText>
			</Button>
			<Modal isOpen={ showModal } onClose={ closeModal } finalFocusRef={ ref }>
				<ModalBackdrop/>
				<ModalContent>
					<ModalHeader>
						<Heading size="lg">Join Game</Heading>
						<ModalCloseButton>
							<Icon as={ X }/>
						</ModalCloseButton>
					</ModalHeader>
					<ModalBody>
						<Input>
							<InputField
								type="text"
								placeholder="Enter Game Code"
								value={ code }
								onChangeText={ setCode }
							/>
						</Input>
					</ModalBody>
					<ModalFooter>
						<Button flex={ 1 } onPress={ handleSubmit }>
							{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>JOIN GAME</ButtonText> }
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Fragment>
	);
};