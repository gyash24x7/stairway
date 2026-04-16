import handler from "@tanstack/react-start/server-entry";

export { TicTacToeEngine } from "@/tictactoe/core/engine";
export { CallbreakEngine } from "@/callbreak/core/engine";
export { SplendorEngine } from "@/splendor/core/engine";
export { FishEngine } from "@/fish/core/engine";
export { KingdominoEngine } from "@/kingdomino/core/engine";
export { WordleEngine } from "@/wordle/core/engine";

export default { fetch: handler.fetch };
