import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { GetSwapUrlValidatedInput, getSwapUrlValidationSchema } from '../tool-contracts.js';

export class GetSwapUrlTool {
    public static readonly name = 'rubic_get_swap_url';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly validationService: McpValidationService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<string>> {
        try {
            const { srcTokenBlockchain, srcTokenSymbol, srcTokenAmount, dstTokenBlockchain, dstTokenSymbol } =
                this.validationService.validate<GetSwapUrlValidatedInput>(getSwapUrlValidationSchema, input);
            const url = `https://app.rubic.exchange/?fromChain=${srcTokenBlockchain}&from=${srcTokenSymbol}&to=${dstTokenSymbol}&toChain=${dstTokenBlockchain}&amount=${srcTokenAmount}`;

            return {
                data: url,
                ok: true,
                traceId
            };
        } catch (error) {
            return {
                error: this.errorMapper.toToolError(error),
                ok: false,
                traceId
            };
        }
    }
}
