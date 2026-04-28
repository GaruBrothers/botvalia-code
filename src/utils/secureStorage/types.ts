export type SecureStorageMcpOAuthEntry = {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
  clientId?: string
  clientSecret?: string
  serverUrl?: string
  discoveryState?: Record<string, unknown>
  [key: string]: unknown
}

export type SecureStoragePluginSecret = Record<string, unknown>

export type SecureStorageData = {
  trustedDeviceToken?: string
  mcpOAuth?: Record<string, SecureStorageMcpOAuthEntry>
  mcpOAuthClientConfig?: Record<string, { clientSecret?: string }>
  pluginSecrets?: Record<string, SecureStoragePluginSecret>
  [key: string]: unknown
}

export interface SecureStorage {
  name: string
  read(): SecureStorageData | null
  readAsync(): Promise<SecureStorageData | null>
  update(data: SecureStorageData): { success: boolean; warning?: string }
  delete(): boolean
}
