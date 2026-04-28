export type FrustrationDetectionState = {
  state: 'closed'
  handleTranscriptSelect: () => void
}

export function useFrustrationDetection(
  _messages?: unknown,
  _isLoading?: boolean,
  _hasActivePrompt?: boolean,
  _hasBlockingSurvey?: boolean,
): FrustrationDetectionState {
  return {
    state: 'closed',
    handleTranscriptSelect: () => {},
  }
}
