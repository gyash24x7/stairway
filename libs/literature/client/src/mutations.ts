import { CreateGameInput } from "@s2h/literature/dtos";
import { client } from "./client";

export async function createGameMutationFn( input: CreateGameInput ) {
	return client.createGame.mutate( input );
}