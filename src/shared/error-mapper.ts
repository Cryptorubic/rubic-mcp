import axios, { AxiosError } from 'axios';

import { McpToolError } from './result-envelope.js';
import { McpValidationError } from './validation-error.js';
import { WalletNotConfiguredError } from './wallet-not-configured.error.js';

export class McpErrorMapper {
    public toToolError(error: unknown): McpToolError {
        if (error instanceof McpValidationError) {
            return {
                code: 'HTTP_400',
                details: error.details,
                message: error.message,
                statusCode: 400
            };
        }

        if (axios.isAxiosError(error)) {
            return this.mapAxiosError(error);
        }

        if (error instanceof WalletNotConfiguredError) {
            return {
                code: 'WALLET_NOT_CONFIGURED',
                details: { name: error.name },
                message: error.message
            };
        }

        if (error instanceof Error) {
            return {
                code: 'INTERNAL_ERROR',
                details: { name: error.name },
                message: error.message || 'Unexpected MCP error.'
            };
        }

        return {
            code: 'INTERNAL_ERROR',
            message: 'Unexpected MCP error.'
        };
    }

    private mapAxiosError(error: AxiosError): McpToolError {
        const statusCode = error.response?.status;
        const responseData = error.response?.data as unknown;

        if (!statusCode) {
            return {
                code: 'HTTP_NETWORK',
                details: { message: error.message },
                message: error.message || 'Network request failed.'
            };
        }

        if (typeof responseData === 'string') {
            return {
                code: `HTTP_${statusCode}`,
                message: responseData,
                statusCode
            };
        }

        if (responseData && typeof responseData === 'object') {
            const typed = responseData as Record<string, unknown>;
            const errorObj = typed.error && typeof typed.error === 'object' ? (typed.error as Record<string, unknown>) : undefined;
            const firstError = Array.isArray(typed.errors) ? typed.errors[0] : undefined;
            const firstErrorObj = firstError && typeof firstError === 'object' ? (firstError as Record<string, unknown>) : undefined;

            const businessCode =
                typeof errorObj?.code === 'number'
                    ? `RUBIC_${errorObj.code}`
                    : typeof firstErrorObj?.code === 'number'
                      ? `RUBIC_${firstErrorObj.code}`
                      : `HTTP_${statusCode}`;

            const message =
                this.extractMessage(errorObj) || this.extractMessage(firstErrorObj) || this.extractMessage(typed) || 'Request failed.';

            return {
                code: businessCode,
                details: responseData,
                message,
                statusCode
            };
        }

        return {
            code: `HTTP_${statusCode}`,
            message: error.message || 'Request failed.',
            statusCode
        };
    }

    private extractMessage(value?: Record<string, unknown>): string | undefined {
        if (!value) {
            return undefined;
        }

        if (typeof value.reason === 'string') {
            return value.reason;
        }

        if (typeof value.message === 'string') {
            return value.message;
        }

        return undefined;
    }
}
