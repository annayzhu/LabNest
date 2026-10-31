import { SAMPLE_BANK_CONTRACT, sampleBankSearchAckSchema, type SampleBankSearchAck } from "./contract";
import type { SampleBankConnector } from "./connector";

/**
 * The connector for a bank that follows the contract: POST {baseUrl}/searches with the bank's token. Whatever goes
 * wrong on the way (no answer, an error status, an answer outside the contract) comes back as a refused search, so
 * the caller always has an acknowledgement to record.
 */
export function httpSampleBankConnector(connection: { source: string; baseUrl: string; token: string | null }, timeoutMs = 15_000): SampleBankConnector {
  return {
    source: connection.source,
    async requestSearch(request) {
      const refused = (code: "unauthorized" | "bank_unavailable" | "internal_error", message: string): SampleBankSearchAck =>
        ({ contract: SAMPLE_BANK_CONTRACT, requestId: request.requestId, accepted: false, error: { code, message } });
      let response: Response;
      try {
        response = await fetch(`${connection.baseUrl.replace(/\/+$/, "")}/searches`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(connection.token ? { Authorization: `Bearer ${connection.token}` } : {}) },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (error) {
        return refused("bank_unavailable", `The sample bank did not answer: ${error instanceof Error ? error.message : String(error)}`);
      }
      const body: unknown = await response.json().catch(() => undefined);
      const ack = sampleBankSearchAckSchema.safeParse(body);
      if (ack.success && ack.data.requestId === request.requestId) return ack.data;
      if (response.status === 401 || response.status === 403) return refused("unauthorized", "The sample bank did not accept LabNest's token.");
      return refused("internal_error", `The sample bank answered ${response.status} without an acknowledgement this contract knows.`);
    },
  };
}
