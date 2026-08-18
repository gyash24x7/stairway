import { Link } from "@tanstack/react-router";

import { Button } from "@/shared/ui/primitives/button.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { errorMessage } from "@/shared/ui/utils/errors.ts";

export type ErrorStateProps = {
	title?: string;
	error?: unknown;
	message?: string;
	action?: { label: string; to: string };
	onRetry?: () => void;
};

export function ErrorState( { title, error, message, action, onRetry }: ErrorStateProps ) {
	const text = message ?? errorMessage( error );

	return (
		<div
			className={ cn(
				"mt-8 mx-auto max-w-md w-full rounded-md bg-background",
				"border-2 border-outline p-6 flex flex-col gap-4 items-center",
				"text-center shadow-sm md:shadow-md"
			) }
		>
			<h2 className={ "text-xl font-heading" }>{ title ?? "Something went wrong" }</h2>
			<p className={ "text-sm text-foreground" }>{ text }</p>
			<div className={ "flex gap-2 flex-wrap justify-center" }>
				{ !!onRetry && (
					<Button variant={ "neutral" } onClick={ onRetry }>TRY AGAIN</Button>
				) }
				{ !!action && (
					<Link to={ action.to }>
						<Button>{ action.label }</Button>
					</Link>
				) }
			</div>
		</div>
	);
}
