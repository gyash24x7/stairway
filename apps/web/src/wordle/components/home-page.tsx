import { useAuth } from "@/shared/hooks/use-auth";
import { Separator } from "@/shared/primitives/separator";
import { cn } from "@s2h/shared/utils/cn";
import { WordleCreateGame } from "@/wordle/components/create-game";

export function WordleHomePage() {
	const { authInfo } = useAuth();
	return (
		<div className={ "flex gap-5 flex-col mt-2 text-foreground w-full max-w-6xl" }>
			<h2 className={ cn( "text-4xl font-heading" ) }>WORDLE</h2>
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
			<Separator/>
			{ !!authInfo
				? (
					<div className={ "flex gap-5 justify-center w-full" }>
						<WordleCreateGame/>
					</div>
				)
				: (
					<div className={ "flex gap-5 w-full" }>
						<div className={ "text-lg text-center" }>Please log in to play.</div>
					</div>
				)
			}
			<Separator/>
			<h2 className={ "text-xl font-semibold" }>RULES</h2>
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
		</div>
	);
}