import crypto from 'node:crypto';

export function createDisputeClient(baseUrl) {
  return {
    async getDispute(id, accessToken) {
      const response = await fetch(`${baseUrl}/api/v1/disputes/${id}`, {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'x-correlation-id': crypto.randomUUID()
        },
        signal: AbortSignal.timeout(3000)
      });
      if (response.status === 404) return null;
      if (response.status === 403) {
        const error = new Error('Access to this dispute is denied');
        error.status = 403;
        throw error;
      }
      if (!response.ok) {
        const error = new Error('Dispute Service is temporarily unavailable');
        error.status = 503;
        throw error;
      }
      return response.json();
    }
  };
}
