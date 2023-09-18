import { useMutation } from "@tanstack/react-query";
import { askCard, callSet, createGame, createTeams, joinGame, startGame, transferChance } from "./base";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	TransferChanceInput
} from "@literature/data";

type MutationOptions<T> = {
	onSuccess?: ( data: T ) => void
	onError?: ( e: any ) => void;
}

export const useCreateGameMutation = ( options?: MutationOptions<string> ) => useMutation( {
	mutationFn: ( data: CreateGameInput ) => createGame( data ),
	...options
} );

export const useJoinGameMutation = ( options?: MutationOptions<string> ) => useMutation( {
	mutationFn: ( data: JoinGameInput ) => joinGame( data ),
	...options
} );

export const useCreateTeamsMutation = ( id: string, options?: MutationOptions<string> ) => useMutation( {
	mutationFn: ( data: CreateTeamsInput ) => createTeams( id, data ),
	...options
} );

export const useStartGameMutation = ( id: string, options?: MutationOptions<string> ) => useMutation( {
	mutationFn: () => startGame( id ),
	...options
} );

export const useAskCardMutation = ( id: string, options?: MutationOptions<string> ) => useMutation( {
	mutationFn: ( data: AskCardInput ) => askCard( id, data ),
	...options
} );

export const useCallSetMutation = ( id: string, options?: MutationOptions<string> ) => useMutation( {
	mutationFn: ( data: CallSetInput ) => callSet( id, data ),
	...options
} );

export const useTransferChanceMutation = ( id: string, options?: MutationOptions<string> ) => useMutation( {
	mutationFn: ( data: TransferChanceInput ) => transferChance( id, data ),
	...options
} );