import { ZodType } from 'zod';

import { McpValidationError } from './validation-error.js';

export class McpValidationService {
    public validate<T>(schema: ZodType<T>, payload: unknown): T {
        const parsed = schema.safeParse(payload);

        if (!parsed.success) {
            const messages = parsed.error.issues.map((issue) => {
                const path = issue.path.length > 0 ? issue.path.join('.') : 'input';
                return `${path}: ${issue.message}`;
            });

            throw new McpValidationError('Validation failed', { validationErrors: messages });
        }

        return parsed.data;
    }
}
