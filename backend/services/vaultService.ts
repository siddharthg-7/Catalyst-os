import dotenv from 'dotenv';
dotenv.config();

export interface VaultSecretData {
  GEMINI_API_KEY?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  [key: string]: any;
}

export class VaultService {
  private vaultAddr: string;
  private vaultToken: string;

  constructor() {
    this.vaultAddr = process.env.VAULT_ADDR || 'http://localhost:8200';
    this.vaultToken = process.env.VAULT_TOKEN || 'root';
  }

  /**
   * Retrieves secret payload from HashiCorp Vault KV-v2 engine.
   * Falls back to local environment variables if Vault is unreachable.
   */
  public async getSecret(path = 'secret/data/catalyst-os/config'): Promise<VaultSecretData> {
    try {
      const response = await fetch(`${this.vaultAddr}/v1/${path}`, {
        headers: {
          'X-Vault-Token': this.vaultToken,
        },
      });

      if (response.ok) {
        const json = (await response.json()) as any;
        console.log(`[Vault Service] Successfully loaded secrets from Vault at path: ${path}`);
        return json?.data?.data || {};
      }
    } catch (err: any) {
      console.warn(`[Vault Service] Connection to Vault failed (${err.message}). Using local .env fallback.`);
    }

    return {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      DATABASE_URL: process.env.DATABASE_URL || '',
      JWT_SECRET: process.env.JWT_SECRET || 'catalyst_os_neon_jwt_secret_2026',
    };
  }

  public async getStatus(): Promise<{ connected: boolean; vaultAddr: string }> {
    try {
      const response = await fetch(`${this.vaultAddr}/v1/sys/health`, { method: 'GET' });
      return {
        connected: response.ok,
        vaultAddr: this.vaultAddr,
      };
    } catch {
      return {
        connected: false,
        vaultAddr: this.vaultAddr,
      };
    }
  }
}

export const vaultService = new VaultService();
export default vaultService;
