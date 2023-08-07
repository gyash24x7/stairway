import { useMutation } from "@tanstack/react-query";
import { askCard, callSet, createGame, createTeams, joinGame, startGame, transferChance } from "./base.js";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	TransferChanceInput
} from "./dtos.js";

export const useCreateGameMutation = () => useMutation( {
	mutationFn: ( data: CreateGameInput ) => createGame( data )
} );

export const useJoinGameMutation = () => useMutation( {
	mutationFn: ( data: JoinGameInput ) => joinGame( data )
} );

export const useCreateTeamsMutation = ( id: string ) => useMutation( {
	mutationFn: ( data: CreateTeamsInput ) => createTeams( id, data )
} );

export const useStartGameMutation = ( id: string ) => useMutation( {
	mutationFn: () => startGame( id )
} );

export const useAskCardMutation = ( id: string ) => useMutation( {
	mutationFn: ( data: AskCardInput ) => askCard( id, data )
} );

export const useCallSetMutation = ( id: string ) => useMutation( {
	mutationFn: ( data: CallSetInput ) => callSet( id, data )
} );

export const useTransferChanceMutation = ( id: string ) => useMutation( {
	mutationFn: ( data: TransferChanceInput ) => transferChance( id, data )
} );