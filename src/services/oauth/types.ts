export type SubscriptionType =
  | 'max'
  | 'pro'
  | 'enterprise'
  | 'team'
  | string

export type BillingType = string
export type RateLimitTier = string
export type ReferralCampaign = 'claude_code_guest_pass' | string

export type OAuthProfileAccount = {
  uuid: string
  email: string
  display_name?: string | null
  created_at?: string
}

export type OAuthProfileOrganization = {
  uuid: string
  organization_type?: string | null
  rate_limit_tier?: RateLimitTier | null
  has_extra_usage_enabled?: boolean | null
  billing_type?: BillingType | null
  subscription_created_at?: string | null
}

export type OAuthProfileResponse = {
  account: OAuthProfileAccount
  organization: OAuthProfileOrganization
}

export type OAuthTokenExchangeAccount = {
  uuid: string
  email_address: string
}

export type OAuthTokenExchangeOrganization = {
  uuid?: string
}

export type OAuthTokenExchangeResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  account?: OAuthTokenExchangeAccount
  organization?: OAuthTokenExchangeOrganization
}

export type OAuthTokens = {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  scopes?: string[]
  subscriptionType?: SubscriptionType | null
  rateLimitTier?: RateLimitTier | null
  profile?: OAuthProfileResponse
  tokenAccount?: {
    uuid: string
    emailAddress: string
    organizationUuid?: string
  }
  [key: string]: unknown
}

export type UserRolesResponse = {
  organization_role: string
  workspace_role: string
  organization_name: string
}

export type ReferrerRewardInfo = {
  currency: string
  amount_minor_units: number
}

export type ReferralEligibilityResponse = {
  eligible: boolean
  remaining_passes?: number | null
  referrer_reward?: ReferrerRewardInfo | null
  referral_code_details?: {
    referral_link?: string | null
    campaign?: ReferralCampaign | null
  } | null
  [key: string]: unknown
}

export type ReferralRedemptionsResponse = {
  redemptions?: Array<Record<string, unknown>>
  limit?: number | null
  [key: string]: unknown
}
