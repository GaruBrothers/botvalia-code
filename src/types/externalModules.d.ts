declare namespace React {
  type ReactNode = unknown
  type ComponentProps<T> = any
  type Dispatch<T> = (value: T) => void
  type SetStateAction<T> = T | ((prev: T) => T)
  type FC<P = {}> = (props: P) => ReactNode
  interface RefObject<T> {
    current: T | null
  }
  interface MutableRefObject<T> {
    current: T
  }
}

declare module 'react/compiler-runtime' {
  export function c(size: number): unknown[]
}

declare module '*.md' {
  const content: string
  export default content
}

declare module 'sharp'
declare module 'image-processor-napi'
declare module 'cli-highlight'
declare module 'turndown'
declare module 'plist'
declare module 'cacache'
declare module 'audio-capture-napi'
declare module '@anthropic-ai/vertex-sdk'
declare module '@anthropic-ai/foundry-sdk'
declare module '@anthropic-ai/bedrock-sdk'
declare module '@aws-sdk/client-bedrock'
declare module '@aws-sdk/client-sts'
declare module '@aws-sdk/credential-providers'
declare module '@azure/identity'
declare module '@opentelemetry/exporter-trace-otlp-http'
declare module '@opentelemetry/exporter-trace-otlp-proto'
declare module '@opentelemetry/exporter-trace-otlp-grpc'
declare module '@opentelemetry/exporter-logs-otlp-http'
declare module '@opentelemetry/exporter-logs-otlp-proto'
declare module '@opentelemetry/exporter-logs-otlp-grpc'
declare module '@opentelemetry/exporter-metrics-otlp-http'
declare module '@opentelemetry/exporter-metrics-otlp-proto'
declare module '@opentelemetry/exporter-metrics-otlp-grpc'
declare module '@opentelemetry/exporter-prometheus'
