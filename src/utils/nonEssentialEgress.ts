import { isEnvDefinedFalsy, isEnvTruthy } from './envUtils.js'

type NonEssentialSurface =
  | 'feedback'
  | 'transcript-share'
  | 'telemetry'
  | 'updates'

function hasBroadNonEssentialEgressOptIn(): boolean {
  return (
    isEnvDefinedFalsy(process.env.OSS_SAFE_MODE) ||
    isEnvTruthy(process.env.BOTVALIA_ENABLE_NONESSENTIAL_EGRESS)
  )
}

function isSurfaceExplicitlyEnabled(surface: NonEssentialSurface): boolean {
  switch (surface) {
    case 'feedback':
      return isEnvTruthy(process.env.BOTVALIA_ENABLE_FEEDBACK_SUBMISSION)
    case 'transcript-share':
      return isEnvTruthy(process.env.BOTVALIA_ENABLE_TRANSCRIPT_SHARE)
    case 'telemetry':
      return (
        isEnvTruthy(process.env.CLAUDE_CODE_ENABLE_TELEMETRY) ||
        isEnvTruthy(process.env.BOTVALIA_ENABLE_NONESSENTIAL_TELEMETRY)
      )
    case 'updates':
      return isEnvTruthy(process.env.BOTVALIA_ENABLE_UPDATE_CHECKS)
    default:
      return false
  }
}

export function isNonEssentialSurfaceEnabled(
  surface: NonEssentialSurface,
): boolean {
  return (
    hasBroadNonEssentialEgressOptIn() || isSurfaceExplicitlyEnabled(surface)
  )
}

export function isFeedbackSubmissionEnabledByDefaultForOSS(): boolean {
  return isNonEssentialSurfaceEnabled('feedback')
}

export function isTranscriptSharingEnabledByDefaultForOSS(): boolean {
  return isNonEssentialSurfaceEnabled('transcript-share')
}

export function isNonEssentialTelemetryEnabledByDefaultForOSS(): boolean {
  return isNonEssentialSurfaceEnabled('telemetry')
}

export function isUpdateChecksEnabledByDefaultForOSS(): boolean {
  return isNonEssentialSurfaceEnabled('updates')
}

export function getOSSDefaultBlockReason(surface: NonEssentialSurface): string {
  switch (surface) {
    case 'feedback':
      return 'Feedback submission is disabled by default in this OSS build. Set BOTVALIA_ENABLE_FEEDBACK_SUBMISSION=1, BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1, or OSS_SAFE_MODE=0 to opt in.'
    case 'transcript-share':
      return 'Transcript sharing is disabled by default in this OSS build. Set BOTVALIA_ENABLE_TRANSCRIPT_SHARE=1, BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1, or OSS_SAFE_MODE=0 to opt in.'
    case 'telemetry':
      return 'Nonessential telemetry is disabled by default in this OSS build. Set CLAUDE_CODE_ENABLE_TELEMETRY=1, BOTVALIA_ENABLE_NONESSENTIAL_TELEMETRY=1, BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1, or OSS_SAFE_MODE=0 to opt in.'
    case 'updates':
      return 'Background update checks and release-note fetches are disabled by default in this OSS build. Set BOTVALIA_ENABLE_UPDATE_CHECKS=1, BOTVALIA_ENABLE_NONESSENTIAL_EGRESS=1, or OSS_SAFE_MODE=0 to opt in.'
    default:
      return 'This nonessential network feature is disabled by default in this OSS build.'
  }
}
