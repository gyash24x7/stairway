import { ApplicationCard } from "@stairway/components/main";

export default function HomePage() {
	return (
		<div className={ "flex gap-5 flex-col md:flex-row" }>
			<ApplicationCard name={ "literature" } path={ "/literature" }/>
			<ApplicationCard name={ "wordle" } path={ "/wordle" }/>
			<ApplicationCard name={ "callbreak" } path={ "/callbreak" }/>
		</div>
	);
}
