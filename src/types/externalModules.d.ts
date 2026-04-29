declare namespace React {
  type Key = string | number
  type ReactNode = unknown
  type ReactElement<P = any, T = any> = unknown
  type ComponentProps<T> = any
  type PropsWithChildren<P = unknown> = P & {
    children?: ReactNode
  }
  type Dispatch<T> = (value: T) => void
  type SetStateAction<T> = T | ((prev: T) => T)
  type FC<P = {}> = (props: P) => ReactNode
  type ComponentType<P = {}> = FC<P> | (new (props: P) => Component<P, any>)
  type Ref<T> =
    | ((instance: T | null) => void)
    | MutableRefObject<T | null>
    | null
  interface ErrorInfo {
    componentStack: string
  }
  interface SuspenseProps {
    children?: ReactNode
    fallback?: ReactNode
  }
  interface RefObject<T> {
    current: T | null
  }
  interface MutableRefObject<T> {
    current: T
  }
  interface Context<T> extends FC<{
    value: T
    children?: ReactNode
  }> {
    Provider: FC<{
      value: T
      children?: ReactNode
    }>
    Consumer: FC<{
      children: (value: T) => ReactNode
    }>
    displayName?: string
  }
  class Component<P = {}, S = {}, SS = unknown> {
    constructor(props: P)
    static getDerivedStateFromError?(error: Error): unknown
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
    componentDidCatch(error: Error, errorInfo?: ErrorInfo): void
    render(): ReactNode
  }
  class PureComponent<P = {}, S = {}, SS = unknown> extends Component<P, S, SS> {}
  const Fragment: FC<{
    children?: ReactNode
  }>
  const Suspense: FC<SuspenseProps>
  const Children: {
    map(children: ReactNode, fn: (...args: any[]) => any): any[]
    forEach(children: ReactNode, fn: (...args: any[]) => void): void
    count(children: ReactNode): number
    only<T>(children: T): T
    toArray(children: ReactNode): any[]
  }
  function createElement(...args: any[]): ReactElement
  function cloneElement<T>(element: T, props?: any, ...children: any[]): T
  function isValidElement<P = any>(value: any): value is {
    props: P
    key?: Key
  }
  function memo<T>(component: T): T
  function lazy<T extends ComponentType<any>>(
    factory: () => Promise<{
      default: T
    }>,
  ): T
  function createRef<T = any>(): RefObject<T>
  function forwardRef<T, P = {}>(
    render: (props: P, ref: Ref<T>) => ReactNode,
  ): ComponentType<P & { ref?: Ref<T> }>
  function createContext<T = any>(defaultValue?: T): Context<T>
  function useState<T = any>(
    initialState?: any,
  ): [T, Dispatch<SetStateAction<T>>]
  function useEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void
  function useLayoutEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void
  function useInsertionEffect(
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ): void
  function useMemo<T = any>(factory: () => T, deps?: readonly unknown[]): T
  function useCallback<T extends (...args: any[]) => any = (...args: any[]) => any>(
    callback: T,
    deps?: readonly unknown[],
  ): T
  function useRef<T = any>(initialValue?: any): MutableRefObject<T>
  function useContext<T = any>(context: Context<T>): T
  function useReducer(...args: any[]): [any, Dispatch<any>]
  function useImperativeHandle(...args: any[]): void
  function useId(): string
  function use<T>(resource: PromiseLike<T>): T
  function use<T>(resource: T): T
  function useDeferredValue<T = any>(value: T): T
  function useEffectEvent<T extends (...args: any[]) => any>(callback: T): T
  function useSyncExternalStore<T = any>(
    subscribe: (onStoreChange: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ): T
  function startTransition(scope: () => void): void
}

declare module 'react' {
  export type Key = React.Key
  export type ReactNode = React.ReactNode
  export type ReactElement<P = any, T = any> = React.ReactElement<P, T>
  export type ComponentProps<T> = React.ComponentProps<T>
  export type PropsWithChildren<P = unknown> = React.PropsWithChildren<P>
  export type Dispatch<T> = React.Dispatch<T>
  export type SetStateAction<T> = React.SetStateAction<T>
  export type FC<P = {}> = React.FC<P>
  export type ComponentType<P = {}> = React.ComponentType<P>
  export type Ref<T> = React.Ref<T>
  export type RefObject<T> = React.RefObject<T>
  export type MutableRefObject<T> = React.MutableRefObject<T>
  export type SuspenseProps = React.SuspenseProps
  export type ErrorInfo = React.ErrorInfo
  export const Component: typeof React.Component
  export const PureComponent: typeof React.PureComponent
  export const Fragment: typeof React.Fragment
  export const Suspense: typeof React.Suspense
  export const Children: typeof React.Children
  export const createElement: typeof React.createElement
  export const cloneElement: typeof React.cloneElement
  export const isValidElement: typeof React.isValidElement
  export const memo: typeof React.memo
  export const lazy: typeof React.lazy
  export const createRef: typeof React.createRef
  export const forwardRef: typeof React.forwardRef
  export const createContext: typeof React.createContext
  export const useState: typeof React.useState
  export const useEffect: typeof React.useEffect
  export const useLayoutEffect: typeof React.useLayoutEffect
  export const useInsertionEffect: typeof React.useInsertionEffect
  export const useMemo: typeof React.useMemo
  export const useCallback: typeof React.useCallback
  export const useRef: typeof React.useRef
  export const useContext: typeof React.useContext
  export const useReducer: typeof React.useReducer
  export const useImperativeHandle: typeof React.useImperativeHandle
  export const useId: typeof React.useId
  export const use: typeof React.use
  export const useDeferredValue: typeof React.useDeferredValue
  export const useEffectEvent: typeof React.useEffectEvent
  export const useSyncExternalStore: typeof React.useSyncExternalStore
  export const startTransition: typeof React.startTransition
  const ReactDefault: {
    Component: typeof React.Component
    PureComponent: typeof React.PureComponent
    Fragment: typeof React.Fragment
    Suspense: typeof React.Suspense
    Children: typeof React.Children
    createElement: typeof React.createElement
    cloneElement: typeof React.cloneElement
    isValidElement: typeof React.isValidElement
    memo: typeof React.memo
    lazy: typeof React.lazy
    createRef: typeof React.createRef
    forwardRef: typeof React.forwardRef
    createContext: typeof React.createContext
    useState: typeof React.useState
    useEffect: typeof React.useEffect
    useLayoutEffect: typeof React.useLayoutEffect
    useInsertionEffect: typeof React.useInsertionEffect
    useMemo: typeof React.useMemo
    useCallback: typeof React.useCallback
    useRef: typeof React.useRef
    useContext: typeof React.useContext
    useReducer: typeof React.useReducer
    useImperativeHandle: typeof React.useImperativeHandle
    useId: typeof React.useId
    use: typeof React.use
    useDeferredValue: typeof React.useDeferredValue
    useEffectEvent: typeof React.useEffectEvent
    useSyncExternalStore: typeof React.useSyncExternalStore
    startTransition: typeof React.startTransition
  }
  export default ReactDefault
}

declare module 'react/jsx-runtime' {
  export const Fragment: typeof React.Fragment
  export function jsx(type: any, props: any, key?: any): React.ReactElement
  export function jsxs(type: any, props: any, key?: any): React.ReactElement
  export function jsxDEV(
    type: any,
    props: any,
    key: any,
    isStaticChildren: boolean,
    source: any,
    self: any,
  ): React.ReactElement
}

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface ElementClass {
    render(): React.ReactNode
  }
  interface IntrinsicAttributes {
    key?: React.Key
  }
  interface IntrinsicElements {
    [elemName: string]: any
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
declare module 'cli-highlight' {
  export function highlight(code: string, options?: unknown): string
  export function supportsLanguage(language: string): boolean
}

declare module 'highlight.js' {
  export function getLanguage(
    language: string,
  ): { name?: string } | undefined
}

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

declare module '@ant/computer-use-mcp' {
  export type ComputerUseCoordinateMode = string

  export type AppGrant = {
    bundleId: string
    displayName: string
    grantedAt: number
  }

  export type CuGrantFlags = {
    clipboardRead: boolean
    clipboardWrite: boolean
    systemKeyCombos: boolean
  }

  export type ScreenshotDims = {
    width: number
    height: number
    displayWidth: number
    displayHeight: number
    displayId?: number
    originX?: number
    originY?: number
  }

  export type CuPermissionRequest = {
    tccState?: {
      accessibility: boolean
      screenRecording: boolean
    }
    apps: Array<{
      requestedName: string
      resolved?: {
        bundleId: string
        displayName: string
      }
      alreadyGranted?: boolean
    }>
    requestedFlags: Partial<Record<keyof CuGrantFlags, boolean>>
    reason?: string
    willHide?: unknown[]
  }

  export type CuPermissionResponse = {
    granted: AppGrant[]
    denied: Array<{
      bundleId: string
      reason: 'user_denied' | 'not_installed'
    }>
    flags: CuGrantFlags
  }

  export type CuMcpTextContent = {
    type: 'text'
    text: string
  }

  export type CuMcpImageContent = {
    type: 'image'
    data: string
    mimeType?: string
  }

  export type CuMcpContent =
    | CuMcpTextContent
    | CuMcpImageContent
    | { type: string; text?: string; data?: string; mimeType?: string }

  export type CuCallToolResult = {
    content: CuMcpContent[] | unknown
    telemetry?: {
      error_kind?: string
    }
  }

  export type ComputerUseSessionContext = {
    getAllowedApps(): readonly AppGrant[]
    getGrantFlags(): CuGrantFlags
    getUserDeniedBundleIds(): readonly string[]
    getSelectedDisplayId(): number | undefined
    getDisplayPinnedByModel(): boolean
    getDisplayResolvedForApps(): string | undefined
    getLastScreenshotDims(): ScreenshotDims | undefined
    onPermissionRequest(
      request: CuPermissionRequest,
      dialogSignal?: AbortSignal,
    ): Promise<CuPermissionResponse>
    onAllowedAppsChanged(apps: AppGrant[], flags: CuGrantFlags): void
    onAppsHidden(ids: string[]): void
    onResolvedDisplayUpdated(id: number | undefined): void
    onDisplayPinned(id: number | undefined): void
    onDisplayResolvedForApps(key: string | undefined): void
    onScreenshotCaptured(dims: ScreenshotDims): void
    checkCuLock(): Promise<{
      holder: string | undefined
      isSelf: boolean
    }>
    acquireCuLock(): Promise<void>
    formatLockHeldMessage(holder: string): string
  }

  export type DisplayGeometry = {
    width: number
    height: number
    scaleFactor: number
    displayId?: number
  }

  export type FrontmostApp = {
    bundleId: string
    displayName: string
  }

  export type InstalledApp = {
    bundleId: string
    displayName: string
    path: string
    iconDataUrl?: string
  }

  export type RunningApp = {
    bundleId: string
    displayName: string
  }

  export type ScreenshotResult = ScreenshotDims & {
    base64: string
  }

  export type ResolvePrepareCaptureResult = ScreenshotResult

  export type ComputerUseCapabilities = {
    screenshotFiltering: string
    platform: string
    hostBundleId?: string
  }

  export type ComputerExecutor = {
    capabilities: ComputerUseCapabilities
    prepareForAction(
      allowlistBundleIds: string[],
      displayId?: number,
    ): Promise<string[]>
    previewHideSet(
      allowlistBundleIds: string[],
      displayId?: number,
    ): Promise<Array<{ bundleId: string; displayName: string }>>
    getDisplaySize(displayId?: number): Promise<DisplayGeometry>
    listDisplays(): Promise<DisplayGeometry[]>
    findWindowDisplays(
      bundleIds: string[],
    ): Promise<Array<{ bundleId: string; displayIds: number[] }>>
    resolvePrepareCapture(opts: {
      allowedBundleIds: string[]
      preferredDisplayId?: number
      autoResolve: boolean
      doHide?: boolean
    }): Promise<ResolvePrepareCaptureResult>
    screenshot(opts: {
      allowedBundleIds: string[]
      displayId?: number
    }): Promise<ScreenshotResult>
    zoom(
      regionLogical: { x: number; y: number; w: number; h: number },
      allowedBundleIds: string[],
      displayId?: number,
    ): Promise<{ base64: string; width: number; height: number }>
    key(keySequence: string, repeat?: number): Promise<void>
    holdKey(keyNames: string[], durationMs: number): Promise<void>
    type(text: string, opts: { viaClipboard: boolean }): Promise<void>
    readClipboard(): Promise<string>
    writeClipboard(text: string): Promise<void>
    moveMouse(x: number, y: number): Promise<void>
    click(
      x: number,
      y: number,
      button: 'left' | 'right' | 'middle',
      count: 1 | 2 | 3,
      modifiers?: string[],
    ): Promise<void>
    mouseDown(): Promise<void>
    mouseUp(): Promise<void>
    getCursorPosition(): Promise<{ x: number; y: number }>
    drag(
      from: { x: number; y: number } | undefined,
      to: { x: number; y: number },
    ): Promise<void>
    scroll(x: number, y: number, dx: number, dy: number): Promise<void>
    getFrontmostApp(): Promise<FrontmostApp | null>
    appUnderPoint(
      x: number,
      y: number,
    ): Promise<{ bundleId: string; displayName: string } | null>
    listInstalledApps(): Promise<InstalledApp[]>
    getAppIcon(path: string): Promise<string | undefined>
    listRunningApps(): Promise<RunningApp[]>
    openApp(bundleId: string): Promise<void>
  }

  export type ComputerUseTool = {
    name: string
  }

  export type ComputerUseMcpServer = {
    setRequestHandler(schema: unknown, handler: (...args: unknown[]) => unknown): void
    connect(transport: unknown): Promise<void>
  }

  export const DEFAULT_GRANT_FLAGS: CuGrantFlags
  export const API_RESIZE_PARAMS: unknown

  export function targetImageSize(
    width: number,
    height: number,
    params: unknown,
  ): [number, number]

  export function bindSessionContext(
    adapter: import('@ant/computer-use-mcp/types').ComputerUseHostAdapter,
    coordinateMode: ComputerUseCoordinateMode,
    context: ComputerUseSessionContext,
  ): (name: string, args: unknown) => Promise<CuCallToolResult>

  export function createComputerUseMcpServer(
    adapter: import('@ant/computer-use-mcp/types').ComputerUseHostAdapter,
    coordinateMode: ComputerUseCoordinateMode,
  ): ComputerUseMcpServer

  export function buildComputerUseTools(
    capabilities: ComputerUseCapabilities,
    coordinateMode: ComputerUseCoordinateMode,
    installedAppNames?: string[],
  ): ComputerUseTool[]
}

declare module '@ant/computer-use-mcp/types' {
  import type {
    ComputerExecutor,
    CuPermissionRequest,
    CuPermissionResponse,
  } from '@ant/computer-use-mcp'
  import { DEFAULT_GRANT_FLAGS } from '@ant/computer-use-mcp'

  export interface Logger {
    silly(message: string, ...args: unknown[]): void
    debug(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    error(message: string, ...args: unknown[]): void
  }

  export type ComputerUseHostAdapter = {
    serverName: string
    logger: Logger
    executor: ComputerExecutor
    ensureOsPermissions(): Promise<
      | { granted: true }
      | {
          granted: false
          accessibility: boolean
          screenRecording: boolean
        }
    >
    isDisabled(): boolean
    getSubGates(): unknown
    getAutoUnhideEnabled(): boolean
    cropRawPatch(): unknown
  }

  export type { CuPermissionRequest, CuPermissionResponse }
  export { DEFAULT_GRANT_FLAGS }
}

declare module '@ant/computer-use-mcp/sentinelApps' {
  export type SentinelCategory = 'shell' | 'filesystem' | 'system_settings'

  export function getSentinelCategory(
    bundleId: string,
  ): SentinelCategory | undefined
}
