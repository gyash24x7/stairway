import { wordleApi } from "@/games/wordle/client/client.ts";
import { WordleCreateGame } from "@/games/wordle/client/create-game.tsx";
import { GameHomePage } from "@/swish/client/game-home-page.tsx";

export function WordleHomePage( props: { isLoggedIn?: boolean } ) {
	return (
		<GameHomePage
			game={ "wordle" }
			isLoggedIn={ props.isLoggedIn }
			createGame={ <WordleCreateGame/> }
			joinGame={ wordleApi.join }
			blurb={
				<>
					<p>
						Wordle is a word-guessing game in which a player has a limited number
						of attempts to identify a hidden target word. After each guess, every
						letter of the guess is colored to give feedback on how close the
						attempt is to the answer, helping the player narrow down possible
						words on subsequent turns.
					</p>
					<p>
						The classic version uses a single five-letter word with six allowed
						guesses. This implementation extends that idea: you can configure
						both the length of the words and the number of words to be guessed
						within a single game, raising the challenge for experienced players.
					</p>
					<p>
						It also plays as a duel. Open more than one seat and every player
						races the same hidden words on a board of their own — you see how far
						the others have got and what they are scoring, but never their rows,
						since a rival's grid against words you share would give the words
						away. The boards are revealed to everyone once the last one is done.
					</p>
				</>
			}
			rules={
				<>
					<p className={ "mb-5" }>
						At the start of a game, one or more secret target words of a fixed
						length are chosen at random from a dictionary. The player is not
						shown the words and must deduce them through a series of guesses.
					</p>
					<p className={ "mb-5" }>
						On each turn, the player submits a guess. A guess must:
					</p>
					<div className={ "pl-2 mb-3" }>
						<p className={ "mb-2" }>
							Be exactly the configured word length (e.g. five letters)
						</p>
						<p className={ "mb-2" }>
							Be a real word recognised by the dictionary used by the game
						</p>
						<p className={ "mb-2" }>
							Use only letters of the alphabet — no digits or punctuation
						</p>
					</div>
					<p className={ "mb-5" }>
						After a valid guess is submitted, each letter is highlighted with one
						of three colours to describe its relationship to the target word:
					</p>
					<div className={ "pl-2 mb-3" }>
						<p className={ "mb-2" }>
							Green: the letter is correct and is in the right position
						</p>
						<p className={ "mb-2" }>
							Yellow: the letter appears in the word, but in a different
							position
						</p>
						<p className={ "mb-2" }>
							Grey: the letter does not appear in the word at all
						</p>
					</div>
					<p className={ "mb-5" }>
						When a word includes the same letter more than once, the colouring
						reflects how many copies are actually present. For example, if the
						target contains a single E, only one E in the guess will be marked
						yellow or green; any additional E in the guess will appear grey.
					</p>
					<p className={ "mb-5" }>
						The player wins by correctly guessing every target word in the game
						before running out of attempts. Each game allows a fixed number of
						guesses; once they are exhausted, the remaining target words are
						revealed and the game ends in a loss.
					</p>
					<p className={ "mb-5" }>
						A common strategy is to use the first guess to test a wide variety of
						common letters and vowels, then use the colour feedback to constrain
						later guesses. With multiple words in play, balancing information
						gain across all the targets becomes the key skill.
					</p>
					<h2 className={ "text-xl font-semibold" }>DUEL MODE</h2>
					<p className={ "mb-5" }>
						Opening more than one seat turns the puzzle into a race. Every player
						gets the same hidden words and their own board, plays their own
						guesses, and is scored independently — nobody takes turns and nobody
						waits.
					</p>
					<p className={ "mb-5" }>
						While the game runs you can see how many guesses each player has
						spent, how many words they have solved and what they would score, but
						not their actual rows. That is not coyness: everyone is chasing the
						same words, so a rival's coloured row would be a free scored probe of
						a word you have left. Every board is revealed to everyone once the
						last one is finished.
					</p>
					<p className={ "mb-5" }>
						Scoring rewards solving words above all else, then efficiency. Each
						solved word is worth more than any penalty available, so more words
						always beats a tidier board; against that you are charged for every
						guess of your allowance and for every distinct letter you spent.
						Giving up hands over the rest of your allowance rather than banking
						it, so it costs you the full amount — which is exactly why it is
						never the cheap way out of a hard board.
					</p>
				</>
			}
		/>
	);
}
