export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

type TaggedError = { _tag: string } & Record<string, unknown>;

const isTagged = ( error: unknown ): error is TaggedError =>
	typeof error === "object"
	&& error !== null
	&& "_tag" in error
	&& typeof ( error as { _tag: unknown } )._tag === "string";

const str = ( error: TaggedError, key: string ) => {
	const value = error[ key ];
	return typeof value === "string" && value.length > 0 ? value : undefined;
};

export function errorMessage( error: unknown ) {
	if ( !isTagged( error ) ) {
		return error instanceof Error && error.message ? error.message : GENERIC_ERROR_MESSAGE;
	}

	switch ( error._tag ) {
		case "swish/InvalidMove":
			return str( error, "reason" ) ?? "That move isn't allowed.";
		case "swish/NotYourTurn":
			return "It's not your turn yet.";
		case "swish/MoveNotAllowed":
			return "That move isn't available right now.";
		case "swish/GameNotInProgress":
			return "This game isn't in progress.";
		case "swish/CannotStart":
			return "This game can't start yet.";
		case "swish/GameFull":
			return "This game is already full.";
		case "swish/AlreadyJoined":
			return "You've already joined this game.";
		case "swish/NotAMember":
			return "You're not a player in this game.";
		case "swish/NotOnTeam":
			return "You're not on that side.";
		case "swish/TeamFull":
			return "That side is already full.";
		case "swish/RematchUnavailable":
			return "This game isn't finished yet.";
		case "swish/GameNotFound":
			return "Game not found. Check the code and try again.";
		case "swish/NothingToUndo":
			return "There's nothing left to undo.";
		case "swish/NothingToRedo":
			return "There's nothing to redo.";
		case "swish/UndoNotAllowed":
			return "You can only take back your own last move.";
		case "swish/RedoNotAllowed":
			return "You can only replay a move you took back.";
		case "swish/CorruptState":
		case "swish/PhaseNotFound":
			return "This game's state couldn't be read. Please refresh.";

		case "auth/Unauthorized":
			return "Please log in to continue.";
		case "auth/EmailTaken": {
			const email = str( error, "email" );
			return email
				? `An account already exists for ${ email }.`
				: "An account already exists for that email.";
		}
		case "auth/RegistrationFailed":
			return str( error, "reason" ) ?? "Registration failed. Please try again.";
		case "auth/AuthenticationFailed":
			return str( error, "reason" ) ?? "Login failed. Please try again.";

		case "TransportError":
		case "InvalidUrlError":
			return "Couldn't reach the server. Check your connection and try again.";
		case "RequestTimeout":
			return "The server took too long to respond. Please try again.";
		case "DecodeError":
		case "EncodeError":
		case "EmptyBodyError":
		case "HttpApiSchemaError":
			return "The server sent something unexpected. Please refresh.";
		case "Unauthorized":
			return "Please log in to continue.";
		case "Forbidden":
			return "You don't have access to that.";
		case "NotFound":
			return "That couldn't be found.";
		case "ServiceUnavailable":
		case "InternalServerError":
		case "StatusCodeError":
		case "HttpError":
			return "The server had a problem. Please try again.";

		default:
			return GENERIC_ERROR_MESSAGE;
	}
}
