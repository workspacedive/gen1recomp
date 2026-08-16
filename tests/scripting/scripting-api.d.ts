declare namespace JSX {
  type Element = unknown
  interface IntrinsicAttributes {
    tag?: number | string
    tabItem?: Element
    badge?: number | string
  }
}

declare module "scripting" {
  export type Node = JSX.Element | string | number | null | readonly Node[]
  export const Button: (props: any) => JSX.Element
  export const HStack: (props: any) => JSX.Element
  export const Image: (props: any) => JSX.Element
  export const Label: (props: any) => JSX.Element
  export const List: (props: any) => JSX.Element
  export const NavigationStack: (props: any) => JSX.Element
  export const ProgressView: (props: any) => JSX.Element
  export const Section: (props: any) => JSX.Element
  export const Spacer: (props: any) => JSX.Element
  export const TabView: (props: any) => JSX.Element
  export const Text: (props: any) => JSX.Element
  export const VStack: (props: any) => JSX.Element
  export function useState<T>(initial: T): [T, (value: T | ((current: T) => T)) => void]
  export function useEffect(effect: () => void | (() => void), dependencies: readonly unknown[]): void
  export function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T
  export const Navigation: {
    present(options: JSX.Element | { element: JSX.Element; modalPresentationStyle?: string }): Promise<void>
    useDismiss(): () => void
  }
  export const Script: { exit(value?: unknown): never }
}

declare const console: {
  log(...values: unknown[]): void
  warn(...values: unknown[]): void
  error(...values: unknown[]): void
}

declare const Device: { readonly systemLanguageCode: string }
declare const Dialog: {
  alert(options: { title: string; message: string; buttonLabel: string }): Promise<void>
}

declare class Data {
  readonly size: number
  toBase64String(): string
  toHexString(): string
}

declare const Crypto: {
  sha256(data: Data): Data
}

type ArchiveEntry = {
  readonly path: string
  readonly type: "file" | "directory" | "symlink"
  readonly compressedSize: number
  readonly uncompressedSize: number
}

declare class Archive {
  static openForMode(path: string, mode: "read" | "update", options?: { pathEncoding?: string }): Archive
  entries(pathEncoding?: string): ArchiveEntry[]
}

declare const FileManager: {
  readonly appGroupDocumentsDirectory: string
  readonly scriptsDirectory: string
  createDirectory(path: string, recursive?: boolean): Promise<void>
  exists(path: string): Promise<boolean>
  readAsString(path: string): Promise<string>
  readAsData(path: string): Promise<Data>
  writeAsString(path: string, value: string): Promise<void>
  writeAsData(path: string, value: Data): Promise<void>
  remove(path: string): Promise<void>
  copyFile(path: string, newPath: string): Promise<void>
  unzip(path: string, destination: string): Promise<void>
  isFile(path: string): Promise<boolean>
  isLink(path: string): Promise<boolean>
}

type NativeRedirectRequest = { readonly url: string }
type NativeFetchOptions = {
  readonly timeout?: number
  readonly debugLabel?: string
  readonly handleRedirect?: (request: NativeRedirectRequest) => Promise<NativeRedirectRequest | null>
}
type NativeResponse = {
  readonly ok: boolean
  readonly status: number
  readonly url: string
  readonly expectedContentLength?: number
  text(): Promise<string>
  data(): Promise<Data>
}
declare function fetch(url: string, options?: NativeFetchOptions): Promise<NativeResponse>

declare class WebViewController {
  constructor(options?: { ephemeral?: boolean })
  addScriptMessageHandler<P = unknown, R = unknown>(name: string, handler: (params?: P) => R): Promise<void>
  loadFile(path: string, allowingReadAccessTo?: string): Promise<boolean>
  waitForLoad(): Promise<boolean>
  present(options?: { fullscreen?: boolean; navigationTitle?: string }): Promise<void>
  dispose(): void
}
