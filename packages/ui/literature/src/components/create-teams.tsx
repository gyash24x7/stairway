import { chunk, shuffle } from "@common/cards";
import {
	Button,
	ButtonSpinner,
	ButtonText,
	Heading,
	HStack,
	Icon,
	Input,
	InputField,
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
import { Fragment, useCallback, useRef, useState } from "react";
import { useCreateTeamsMutation, useGameId, usePlayerCount, usePlayers } from "../store";
import { DisplayPlayer } from "./display-player";

export const CreateTeams = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const playerCount = usePlayerCount();

	const [ teamAName, setTeamAName ] = useState( "" );
	const [ teamBName, setTeamBName ] = useState( "" );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );

	const groupPlayers = useCallback( () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / 2 );
		setTeamMemberData( {
			[ teamAName ]: teamMembers[ 0 ],
			[ teamBName ]: teamMembers[ 1 ]
		} );
	}, [ teamAName, teamBName, players, playerCount ] );

	const { mutateAsync, isPending } = useCreateTeamsMutation();

	const handleSubmit = useCallback(
		() => mutateAsync( { data: teamMemberData, gameId } ),
		[ teamMemberData, gameId ]
	);

	const [ showModal, setShowModal ] = useState( false );
	const ref = useRef( null );

	const openModal = () => setShowModal( true );
	const closeModal = () => setShowModal( false );

	return (
		<Fragment>
			<Button onPress={ openModal }>
				<ButtonText>CREATE TEAMS</ButtonText>
			</Button>
			<Modal isOpen={ showModal } onClose={ closeModal } finalFocusRef={ ref }>
				<ModalBackdrop/>
				<ModalContent>
					<ModalHeader>
						<Heading size="lg">Create Teams</Heading>
						<ModalCloseButton>
							<Icon as={ X }/>
						</ModalCloseButton>
					</ModalHeader>
					<ModalBody>
						<VStack gap={ "$5" }>
							<Input>
								<InputField
									type="text"
									placeholder="Enter Team Name"
									value={ teamAName }
									onChangeText={ setTeamAName }
								/>
							</Input>
							<Input>
								<InputField
									type="text"
									placeholder="Enter Team Name"
									value={ teamBName }
									onChangeText={ setTeamBName }
								/>
							</Input>
							<Button onPress={ groupPlayers }>
								<ButtonText>GROUP PLAYERS</ButtonText>
							</Button>
							{ Object.keys( teamMemberData ).map( ( team ) => (
								<VStack key={ team }>
									<Text>Team { team }</Text>
									<HStack flexWrap={ "wrap" }>
										{ teamMemberData[ team ]?.map( member => (
											<DisplayPlayer player={ players[ member ] } key={ players[ member ].id }/>
										) ) }
									</HStack>
								</VStack>
							) ) }
						</VStack>
					</ModalBody>
					<ModalFooter>
						<Button onPress={ handleSubmit } flex={ 1 }>
							{ isPending ? <ButtonSpinner px={ "$5" }/> : <ButtonText>CREATE TEAMS</ButtonText> }
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Fragment>
	);
};