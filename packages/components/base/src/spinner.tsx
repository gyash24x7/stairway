"use client";

import { cn } from "./cn.ts";



export const Spinner = () => {
	return (
		<div
			className={ cn(
				"animate-spin inline-block size-6 border-4 border-muted",
				"border-t-transparent text-blue-600 rounded-full dark:text-blue-500"
			) }
			role="status"
			aria-label="loading"
		>
			<span className="sr-only">Loading...</span>
		</div>
	);
};