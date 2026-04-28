declare namespace React {
  type ReactNode = unknown
  type ComponentProps<T> = any
  type Dispatch<T> = (value: T) => void
  type SetStateAction<T> = T | ((prev: T) => T)
  type FC<P = {}> = (props: P) => ReactNode
  interface ErrorInfo {
    componentStack: string
  }
  interface RefObject<T> {
    current: T | null
  }
  interface MutableRefObject<T> {
    current: T
  }
  class Component<P = {}, S = {}, SS = unknown> {
    constructor(props: P)
    props: Readonly<P>
    state: Readonly<S>
    context: unknown
    setState(
      state:
        | Partial<S>
        | null
        | ((prevState: Readonly<S>, props: Readonly<P>) => Partial<S> | null),
      callback?: () => void,
    ): void
    forceUpdate(callback?: () => void): void
    render(): ReactNode
  }
  class PureComponent<P = {}, S = {}, SS = unknown> extends Component<P, S, SS> {}
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
