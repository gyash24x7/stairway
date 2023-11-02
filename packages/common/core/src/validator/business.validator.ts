import type { ICommand } from "@nestjs/cqrs";

export interface BusinessValidator<C extends ICommand, R> {
	validate( command: C ): Promise<R>;
}