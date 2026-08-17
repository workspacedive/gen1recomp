import {
  Button,
  HStack,
  Image,
  Label,
  List,
  Navigation,
  NavigationStack,
  ProgressView,
  Section,
  Spacer,
  Tab,
  TabView,
  Text,
  useEffect,
  useMemo,
  useObservable,
  useState,
  VStack,
} from "scripting"

import { COMPONENTS, PRODUCT, type ProductComponentId } from "../config/product"
import {
  GameLibraryError,
  GameLibraryService,
  type GameLibrarySnapshot,
  type RomImportStage,
} from "../data/game-library-service"
import { ModService, ModServiceError } from "../data/mod-service"
import { SystemUpdateService, UpdateServiceError } from "../data/system-update-service"
import type { InstalledGame, SaveSlotSummary } from "../domain/games"
import type { InstalledMod, ModOperationStage, ModSnapshot, ModViewState } from "../domain/mods"
import {
  PRODUCT_TABS,
  type ProductTabDefinition,
  type ProductTabId,
  type UpdateMutationStage,
  type UpdateSnapshot,
  type UpdateViewState,
} from "../domain/models"
import { formatDate, t } from "../i18n/strings"
import { GameRuntimeService, SaveManagementError } from "../platform/game-runtime"
import { runRuntimeDiagnostic } from "../platform/runtime-diagnostic"

function tabDefinition(id: ProductTabId): ProductTabDefinition {
  const tab = PRODUCT_TABS.find((candidate) => candidate.id === id && candidate.enabled)
  if (tab == null) throw new Error(`Required product tab is unavailable: ${id}`)
  return tab
}

const homeTab = tabDefinition("home")
const gamesTab = tabDefinition("games")
const updatesTab = tabDefinition("updates")
const modsTab = tabDefinition("mods")
const settingsTab = tabDefinition("settings")

function HomeScreen({
  openGames,
  versions,
  library,
}: {
  openGames: () => void
  versions: Readonly<Record<ProductComponentId, string>>
  library: GameLibrarySnapshot | null
}) {
  const dismiss = Navigation.useDismiss()
  const readyGames = library?.games.filter(({ status }) => status === "ready") ?? []
  return (
    <List
        navigationTitle={t("homeTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <Button title={t("close")} action={dismiss} /> }}
      >
        <Section>
          <VStack alignment="leading" spacing={10}>
            <HStack spacing={12}>
              <Image systemName="gamecontroller.fill" font={{ name: "system", size: 38 }} />
              <VStack alignment="leading" spacing={3}>
                <Text font="title2" fontWeight="bold">{t("product")}</Text>
                <Text foregroundStyle="secondaryLabel">{t("homeWelcome")}</Text>
              </VStack>
            </HStack>
          </VStack>
        </Section>
        <Section title={t("tabGames")} footer={<Text>{t("continueHint")}</Text>}>
          <VStack alignment="leading" spacing={8}>
            {readyGames.length === 0
              ? <Label title={t("continueUnavailable")} systemImage="square.dashed" />
              : <Label
                  title={`${readyGames.length} ${readyGames.length === 1 ? t("gameReady") : t("gamesReady")}`}
                  systemImage="checkmark.seal.fill"
                  foregroundStyle="systemGreen"
                />}
            <Button title={t("openGames")} systemImage="square.grid.2x2" action={openGames} />
          </VStack>
        </Section>
        <Section title={t("components")} footer={<Text>{t("componentsHint")}</Text>}>
          <HStack>
            <Label title="LÖVE / Lua" systemImage="shippingbox.fill" />
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{versions[COMPONENTS.runtime.id]}</Text>
          </HStack>
          <HStack>
            <Label title="Gen1Recomp" systemImage="cpu.fill" />
            <Spacer />
            <Text foregroundStyle="secondaryLabel">{versions[COMPONENTS.core.id]}</Text>
          </HStack>
        </Section>
    </List>
  )
}

type GameLibraryViewState =
  | { readonly status: "loading" }
  | { readonly status: "content"; readonly snapshot: GameLibrarySnapshot }
  | {
      readonly status: "working"
      readonly previous: GameLibrarySnapshot
      readonly stage: RomImportStage | "launching" | "deleting" | "refreshingSaves" | "exportingSave" | "restoringSave" | "deletingSave"
      readonly gameTitle: string | null
    }
  | { readonly status: "error"; readonly previous: GameLibrarySnapshot; readonly message: string }

function gameStatus(game: InstalledGame): { readonly title: string; readonly image: string; readonly color: string } {
  if (game.status === "ready") return { title: t("readyToPlay"), image: "checkmark.circle.fill", color: "systemGreen" }
  if (game.status === "pendingExtraction") return { title: t("finishImport"), image: "arrow.triangle.2.circlepath", color: "systemOrange" }
  return { title: t("reimportRequired"), image: "exclamationmark.triangle.fill", color: "systemOrange" }
}

function gameWorkText(stage: RomImportStage | "launching" | "deleting" | "refreshingSaves" | "exportingSave" | "restoringSave" | "deletingSave"): string {
  if (stage === "reading") return t("readingRom")
  if (stage === "identity") return t("verifyingRom")
  if (stage === "staging") return t("stagingRom")
  if (stage === "registry") return t("registeringGame")
  if (stage === "deleting") return t("deletingGame")
  if (stage === "refreshingSaves") return t("refreshingSaves")
  if (stage === "exportingSave") return t("exportingSave")
  if (stage === "restoringSave") return t("restoringSave")
  if (stage === "deletingSave") return t("deletingSave")
  return t("startingGame")
}

function saveTitle(save: SaveSlotSummary): string {
  return save.id === "legacy" ? t("legacySave") : `${t("numberedSave")} ${Number(save.id.slice(4))}`
}

function saveErrorMessage(error: unknown): string {
  if (!(error instanceof SaveManagementError)) return t("saveStorageError")
  if (error.code === "missing") return t("saveMissingError")
  if (error.code === "format") return t("saveFormatError")
  if (error.code === "identity") return t("saveIdentityError")
  if (error.code === "integrity") return t("saveIntegrityError")
  return t("saveStorageError")
}

function GameCard({
  game,
  disabled,
  play,
  playSave,
  exportSave,
  restoreSave,
  refreshSaves,
  deleteSave,
  remove,
}: {
  game: InstalledGame
  disabled: boolean
  play: () => void
  playSave: (save: SaveSlotSummary) => void
  exportSave: (save: SaveSlotSummary) => void
  restoreSave: () => void
  refreshSaves: () => void
  deleteSave: (save: SaveSlotSummary) => void
  remove: () => void
}) {
  const status = gameStatus(game)
  return (
    <VStack alignment="leading" spacing={10}>
      <HStack spacing={12}>
        <Image systemName={game.id === "yellow" ? "bolt.fill" : game.id === "red" ? "flame.fill" : game.id === "blue" ? "drop.fill" : "sparkles"} font={{ name: "system", size: 34 }} foregroundStyle={game.id === "yellow" ? "systemYellow" : game.id === "red" ? "systemRed" : game.id === "blue" ? "systemBlue" : "systemOrange"} />
        <VStack alignment="leading" spacing={3}>
          <Text font="title3" fontWeight="bold">{game.title}</Text>
          <Text foregroundStyle="secondaryLabel">{game.support === "beta" ? t("generationTwoBeta") : t("generationOne")}</Text>
        </VStack>
        <Spacer />
      </HStack>
      <Label title={status.title} systemImage={status.image} foregroundStyle={status.color} />
      <HStack>
        <Label
          title={game.saves.length === 0 ? t("noSaveSlots") : `${game.saves.length} ${game.saves.length === 1 ? t("saveSlot") : t("saveSlots")}`}
          systemImage="externaldrive.fill"
          foregroundStyle="secondaryLabel"
        />
        <Spacer />
        <Text foregroundStyle="secondaryLabel">{`SHA-1 ${game.romSha1.slice(0, 8)}…`}</Text>
      </HStack>
      {game.saves.map((save) => (
        <VStack alignment="leading" spacing={6}>
          <HStack>
            <Label title={saveTitle(save)} systemImage="doc.fill" />
            <Spacer />
            <Text foregroundStyle="secondaryLabel">
              {save.modifiedAt == null ? `${save.bytes} B` : formatDate(save.modifiedAt)}
            </Text>
          </HStack>
          <HStack spacing={10}>
            <Button title={t("playSave")} systemImage="play.fill" action={() => playSave(save)} disabled={disabled || game.status !== "ready"} />
            <Button title={t("exportSaveBackup")} systemImage="square.and.arrow.up" action={() => exportSave(save)} disabled={disabled} />
            <Button title={t("deleteSave")} systemImage="trash" action={() => deleteSave(save)} disabled={disabled} />
          </HStack>
        </VStack>
      ))}
      <HStack spacing={10}>
        <Button title={t("restoreSaveBackup")} systemImage="arrow.down.doc.fill" action={restoreSave} disabled={disabled} />
        <Button title={t("refreshSaves")} systemImage="arrow.clockwise" action={refreshSaves} disabled={disabled} />
      </HStack>
      <Text foregroundStyle="secondaryLabel">{t("saveBackupHint")}</Text>
      <HStack spacing={12}>
        <Button
          title={game.status === "ready" ? t("play") : game.status === "pendingExtraction" ? t("finishImport") : t("importAgain")}
          systemImage={game.status === "ready" ? "play.fill" : "arrow.down.doc.fill"}
          action={play}
          disabled={disabled}
        />
        <Spacer />
        <Button title={t("delete")} systemImage="trash" action={remove} disabled={disabled} />
      </HStack>
    </VStack>
  )
}

function GamesScreen({
  library,
  runtime,
  onSnapshot,
}: {
  library: GameLibraryService
  runtime: GameRuntimeService
  onSnapshot: (snapshot: GameLibrarySnapshot) => void
}) {
  const dismiss = Navigation.useDismiss()
  const empty: GameLibrarySnapshot = { games: [], updatedAt: new Date().toISOString() }
  const [state, setState] = useState<GameLibraryViewState>({ status: "loading" })
  const current = state.status === "content" ? state.snapshot : state.status === "loading" ? null : state.previous
  const busy = state.status === "loading" || state.status === "working"

  useEffect(() => {
    let active = true
    void library.initialize().then((snapshot) => {
      if (!active) return
      onSnapshot(snapshot)
      setState({ status: "content", snapshot })
    }).catch((error: unknown) => {
      if (!active) return
      setState({ status: "error", previous: empty, message: error instanceof Error ? error.message : t("libraryUnavailable") })
    })
    return () => { active = false }
  }, [])

  const launch = async (game: InstalledGame, previous: GameLibrarySnapshot, saveId?: string) => {
    // Keep the stable card tree mounted while WebViewController presents.
    // Rebuilding the conditional working tree immediately before modal
    // presentation triggered Scripting 3.2.0's intermittent t.__type__ error.
    try {
      const result = await runtime.launch(game, saveId)
      onSnapshot(result.snapshot)
      if (result.errors.length > 0) {
        setState({ status: "error", previous: result.snapshot, message: result.errors.join("\n") })
      } else {
        setState({ status: "content", snapshot: result.snapshot })
      }
    } catch (error) {
      setState({ status: "error", previous, message: error instanceof Error ? error.message : t("runtimeFailed") })
    }
  }

  const importRom = async () => {
    if (busy) return
    let paths: string[]
    try {
      paths = await DocumentPicker.pickFiles({
        allowsMultipleSelection: false,
        shouldShowFileExtensions: true,
        types: ["public.data"],
      })
    } catch (error) {
      setState({
        status: "error",
        previous: current ?? empty,
        message: error instanceof Error ? error.message : t("libraryUnavailable"),
      })
      return
    }
    const path = paths[0]
    if (path == null) return
    const previous = current ?? empty
    let imported: InstalledGame | null = null
    let importedSnapshot = previous
    try {
      setState({ status: "working", previous, stage: "reading", gameTitle: null })
      const result = await library.importRom(path, (stage) => {
        setState({ status: "working", previous, stage, gameTitle: imported?.title ?? null })
      })
      imported = result.game
      importedSnapshot = result.snapshot
      onSnapshot(result.snapshot)
    } catch (error) {
      const known = error instanceof GameLibraryError ? error : null
      setState({ status: "error", previous, message: known?.message ?? t("libraryUnavailable") })
    } finally {
      DocumentPicker.stopAcessingSecurityScopedResources()
    }
    if (imported != null) {
      setState({ status: "content", snapshot: importedSnapshot })
      await launch(imported, importedSnapshot)
    }
  }

  const refreshSaves = async (game: InstalledGame) => {
    if (busy || current == null) return
    const previous = current
    setState({ status: "working", previous, stage: "refreshingSaves", gameTitle: game.title })
    try {
      const next = await runtime.refreshSaves(game)
      onSnapshot(next)
      setState({ status: "content", snapshot: next })
    } catch (error) {
      setState({ status: "error", previous, message: saveErrorMessage(error) })
    }
  }

  const exportSave = async (game: InstalledGame, save: SaveSlotSummary) => {
    if (busy || current == null) return
    const previous = current
    setState({ status: "working", previous, stage: "exportingSave", gameTitle: `${game.title} · ${saveTitle(save)}` })
    try {
      const backup = await runtime.createSaveBackup(game, save)
      await DocumentPicker.exportFiles({ files: [{ data: backup.data, name: backup.name }] })
      setState({ status: "content", snapshot: previous })
    } catch (error) {
      setState({ status: "error", previous, message: saveErrorMessage(error) })
    }
  }

  const restoreSave = async (game: InstalledGame) => {
    if (busy || current == null) return
    const previous = current
    let path: string | null = null
    try {
      const paths = await DocumentPicker.pickFiles({
        allowsMultipleSelection: false,
        shouldShowFileExtensions: true,
        types: ["public.json", "public.data"],
      })
      path = paths[0] ?? null
      if (path == null) return
      setState({ status: "working", previous, stage: "restoringSave", gameTitle: game.title })
      const backup = await runtime.inspectSaveBackup(game, path)
      DocumentPicker.stopAcessingSecurityScopedResources()
      path = null
      const slot = backup.saveId === "legacy" ? t("legacySave") : `${t("numberedSave")} ${Number(backup.saveId.slice(4))}`
      const confirmed = await Dialog.confirm({
        title: t("restoreSaveTitle"),
        message: `${slot}\n\n${t("restoreSaveMessage")}`,
        cancelLabel: t("cancel"),
        confirmLabel: t("restoreSaveBackup"),
      })
      if (!confirmed) {
        setState({ status: "content", snapshot: previous })
        return
      }
      const next = await runtime.restoreSaveBackup(game, backup)
      onSnapshot(next)
      setState({ status: "content", snapshot: next })
    } catch (error) {
      setState({ status: "error", previous, message: saveErrorMessage(error) })
    } finally {
      if (path != null) DocumentPicker.stopAcessingSecurityScopedResources()
    }
  }

  const deleteSave = async (game: InstalledGame, save: SaveSlotSummary) => {
    if (busy || current == null) return
    const previous = current
    const confirmed = await Dialog.confirm({
      title: t("deleteSaveTitle"),
      message: `${saveTitle(save)}\n\n${t("deleteSaveMessage")}`,
      cancelLabel: t("cancel"),
      confirmLabel: t("delete"),
    })
    if (!confirmed) return
    setState({ status: "working", previous, stage: "deletingSave", gameTitle: `${game.title} · ${saveTitle(save)}` })
    try {
      const next = await runtime.deleteSave(game, save)
      onSnapshot(next)
      setState({ status: "content", snapshot: next })
    } catch (error) {
      setState({ status: "error", previous, message: saveErrorMessage(error) })
    }
  }

  const remove = async (game: InstalledGame) => {
    if (busy || current == null) return
    const confirmed = await Dialog.confirm({
      title: t("deleteGameTitle"),
      message: t("deleteGameMessage"),
      cancelLabel: t("cancel"),
      confirmLabel: t("delete"),
    })
    if (!confirmed) return
    setState({ status: "working", previous: current, stage: "deleting", gameTitle: game.title })
    try {
      const next = await runtime.removeGame(game)
      onSnapshot(next)
      setState({ status: "content", snapshot: next })
    } catch (error) {
      setState({ status: "error", previous: current, message: error instanceof Error ? error.message : t("libraryUnavailable") })
    }
  }

  return (
    <List
        navigationTitle={t("gamesTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <Button title={t("close")} action={dismiss} /> }}
      >
        <Section footer={<Text>{t("romPrivacy")}</Text>}>
          <Button title={t("importGame")} systemImage="doc.badge.plus" action={importRom} disabled={busy} />
        </Section>

        {state.status === "loading" ? <Section><ProgressView label={t("loadingLibrary")} /></Section> : null}
        {state.status === "working" ? (
          <Section>
            <VStack alignment="leading" spacing={8}>
              <ProgressView />
              <Text font="headline">{gameWorkText(state.stage)}</Text>
              {state.gameTitle == null ? null : <Text foregroundStyle="secondaryLabel">{state.gameTitle}</Text>}
            </VStack>
          </Section>
        ) : null}
        {state.status === "error" ? (
          <Section>
            <VStack alignment="leading" spacing={8}>
              <Label title={t("errorTitle")} systemImage="exclamationmark.triangle.fill" foregroundStyle="systemRed" />
              <Text>{state.message}</Text>
            </VStack>
          </Section>
        ) : null}

        {current != null && current.games.length === 0 ? (
          <Section>
            <VStack alignment="center" spacing={12} frame={{ maxWidth: "infinity" }}>
              <Image systemName="square.stack.3d.up.slash" font={{ name: "system", size: 48 }} />
              <Text font="headline">{t("noGames")}</Text>
              <Text foregroundStyle="secondaryLabel">{t("noGamesHint")}</Text>
            </VStack>
          </Section>
        ) : null}

        {current?.games.map((game) => (
          <Section footer={game.status === "needsReimport" ? <Text>{t("cacheMissingHint")}</Text> : null}>
            <GameCard
              game={game}
              disabled={busy}
              play={() => {
                if (game.status === "needsReimport") void importRom()
                else if (current != null) void launch(game, current)
              }}
              playSave={(save) => { if (current != null) void launch(game, current, save.id) }}
              exportSave={(save) => { void exportSave(game, save) }}
              restoreSave={() => { void restoreSave(game) }}
              refreshSaves={() => { void refreshSaves(game) }}
              deleteSave={(save) => { void deleteSave(game, save) }}
              remove={() => { void remove(game) }}
            />
          </Section>
        ))}
    </List>
  )
}

function stageText(stage: UpdateMutationStage): string {
  if (stage === "catalog") return t("checking")
  if (stage === "planning") return t("planning")
  if (stage === "download") return t("download")
  if (stage === "integrity") return t("integrity")
  if (stage === "archive") return t("archive")
  if (stage === "staging") return t("staging")
  if (stage === "activation") return t("activation")
  return t("health")
}

function UpdateRow({
  row,
  disabled,
  install,
}: {
  row: UpdateSnapshot["components"][number]
  disabled: boolean
  install: (id: ProductComponentId) => void
}) {
  return (
    <VStack alignment="leading" spacing={8}>
      <HStack>
        <VStack alignment="leading" spacing={3}>
          <Text font="headline">{row.label}</Text>
          <Text foregroundStyle="secondaryLabel">
            {`${t("installed")}: ${row.installedVersion} · ${t("available")}: ${row.availableVersion}`}
          </Text>
        </VStack>
        <Spacer />
        {row.updateAvailable ? (
          <Button title={t("update")} action={() => install(row.id)} disabled={disabled} />
        ) : (
          <Label title={t("current")} systemImage="checkmark.circle.fill" foregroundStyle="systemGreen" />
        )}
      </HStack>
      {row.updateAvailable ? (
        <Label title={t("updateAvailable")} systemImage="arrow.down.circle.fill" foregroundStyle="systemBlue" />
      ) : null}
    </VStack>
  )
}

function UpdatesScreen({
  updates,
  onSnapshot,
}: {
  updates: SystemUpdateService
  onSnapshot: (snapshot: UpdateSnapshot) => void
}) {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<UpdateViewState>({ status: "loading" })

  useEffect(() => {
    let active = true
    void updates.initialize().then(({ snapshot }) => {
      if (active) {
        onSnapshot(snapshot)
        setState({ status: "content", snapshot })
      }
    }).catch((error: unknown) => {
      if (!active) return
      const message = error instanceof Error ? error.message : t("notAvailable")
      const fallback: UpdateSnapshot = { components: [], checkedAt: null, catalogSequence: null }
      setState({ status: "error", previous: fallback, message, canRetry: true })
    })
    return () => { active = false }
  }, [])

  const currentSnapshot = state.status === "content" || state.status === "success"
    ? state.snapshot
    : state.status === "loading" ? null : state.previous
  const isBusy = state.status === "checking" || state.status === "installing" || state.status === "loading"
  const updatesAvailable = currentSnapshot?.components.filter(({ updateAvailable }) => updateAvailable) ?? []

  const check = async () => {
    if (isBusy) return
    const previous = currentSnapshot ?? { components: [], checkedAt: null, catalogSequence: null }
    setState({ status: "checking", previous })
    try {
      setState({ status: "installing", previous, stage: "catalog", componentLabel: null })
      const next = await updates.check()
      onSnapshot(next)
      setState({ status: "content", snapshot: next })
    } catch (error) {
      const known = error instanceof UpdateServiceError ? error : null
      setState({
        status: "error",
        previous,
        message: known?.message ?? t("notAvailable"),
        canRetry: known?.retryable ?? true,
      })
    }
  }

  const importComponent = async () => {
    if (isBusy || currentSnapshot == null) return
    const paths = await DocumentPicker.pickFiles({
      allowsMultipleSelection: false,
      shouldShowFileExtensions: true,
    })
    const path = paths[0]
    if (path == null) return
    setState({ status: "installing", previous: currentSnapshot, stage: "integrity", componentLabel: null })
    try {
      const next = await updates.importComponentPackage(path, (stage, componentLabel) => {
        setState({ status: "installing", previous: currentSnapshot, stage, componentLabel })
      })
      onSnapshot(next)
      setState({ status: "success", snapshot: next, message: t("updateSuccess") })
    } catch (error) {
      const known = error instanceof UpdateServiceError ? error : null
      setState({
        status: "error",
        previous: currentSnapshot,
        message: known?.message ?? t("notAvailable"),
        canRetry: known?.retryable ?? false,
      })
    } finally {
      DocumentPicker.stopAcessingSecurityScopedResources()
    }
  }

  const install = async (ids: readonly ProductComponentId[]) => {
    if (isBusy || currentSnapshot == null) return
    setState({ status: "installing", previous: currentSnapshot, stage: "planning", componentLabel: null })
    try {
      const next = await updates.install(ids, (stage, componentLabel) => {
        setState({ status: "installing", previous: currentSnapshot, stage, componentLabel })
      })
      onSnapshot(next)
      setState({ status: "success", snapshot: next, message: t("updateSuccess") })
    } catch (error) {
      const known = error instanceof UpdateServiceError ? error : null
      setState({
        status: "error",
        previous: currentSnapshot,
        message: known?.message ?? t("notAvailable"),
        canRetry: known?.retryable ?? true,
      })
    }
  }

  return (
    <List
        navigationTitle={t("updatesTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <Button title={t("close")} action={dismiss} /> }}
      >
        <Section footer={<Text>{t("updateIntro")}</Text>}>
          <Button
            title={state.status === "checking" ? t("checking") : t("checkUpdates")}
            systemImage="arrow.clockwise"
            action={check}
            disabled={isBusy}
          />
          <Button
            title={t("componentImport")}
            systemImage="shippingbox.and.arrow.backward.fill"
            action={importComponent}
            disabled={isBusy}
          />
          <Text foregroundStyle="secondaryLabel">{t("componentImportHint")}</Text>
        </Section>

        {state.status === "loading" ? (
          <Section><VStack spacing={8}><ProgressView /><Text>{t("installing")}</Text></VStack></Section>
        ) : null}

        {state.status === "installing" ? (
          <Section>
            <VStack alignment="leading" spacing={8}>
              <ProgressView />
              <Text font="headline">{stageText(state.stage)}</Text>
              {state.componentLabel == null ? null : <Text foregroundStyle="secondaryLabel">{state.componentLabel}</Text>}
            </VStack>
          </Section>
        ) : null}

        {state.status === "error" ? (
          <Section>
            <VStack alignment="leading" spacing={8}>
              <Label title={t("errorTitle")} systemImage="exclamationmark.triangle.fill" foregroundStyle="systemOrange" />
              <Text>{state.message}</Text>
              {state.canRetry ? <Button title={t("retry")} action={check} disabled={isBusy} /> : null}
            </VStack>
          </Section>
        ) : null}

        {state.status === "success" ? (
          <Section><Label title={state.message} systemImage="checkmark.circle.fill" foregroundStyle="systemGreen" /></Section>
        ) : null}

        {currentSnapshot == null ? null : (
          <Section
            title={t("systemUpdates")}
            footer={<Text>{t("updateSecurity")}</Text>}
          >
            {currentSnapshot.components.map((row) => (
              <UpdateRow row={row} disabled={isBusy} install={(id) => { void install([id]) }} />
            ))}
            {updatesAvailable.length > 1 ? (
              <Button
                title={t("updateAll")}
                systemImage="arrow.down.circle.fill"
                action={() => { void install(updatesAvailable.map(({ id }) => id)) }}
                disabled={isBusy}
              />
            ) : null}
          </Section>
        )}

        <Section title={t("catalog")}>
          <HStack>
            <Text>{currentSnapshot?.checkedAt == null ? t("neverChecked") : t("checkedAt")}</Text>
            <Spacer />
            <Text foregroundStyle="secondaryLabel">
              {currentSnapshot?.checkedAt == null ? "—" : formatDate(currentSnapshot.checkedAt)}
            </Text>
          </HStack>
        </Section>
    </List>
  )
}

function modStageText(stage: ModOperationStage): string {
  if (stage === "github") return t("checking")
  if (stage === "download") return t("download")
  if (stage === "integrity") return t("integrity")
  if (stage === "archive") return t("archive")
  if (stage === "manifest") return t("planning")
  if (stage === "installing") return t("staging")
  return t("activation")
}

function ModRow({
  mod,
  updateAvailable,
  disabled,
  update,
  remove,
}: {
  mod: InstalledMod
  updateAvailable: boolean
  disabled: boolean
  update: () => void
  remove: () => void
}) {
  return (
    <VStack alignment="leading" spacing={8}>
      <HStack>
        <VStack alignment="leading" spacing={3}>
          <Text font="headline">{mod.name}</Text>
          <Text foregroundStyle="secondaryLabel">{`${mod.version} · ${mod.category}`}</Text>
        </VStack>
        <Spacer />
        <Label title={t("inactive")} systemImage="pause.circle.fill" foregroundStyle="systemOrange" />
      </HStack>
      <Text foregroundStyle="secondaryLabel">
        {`${t("permissions")}: ${mod.permissions.length === 0 ? "—" : mod.permissions.join(", ")}`}
      </Text>
      {mod.conflicts.length === 0 ? null : (
        <Text foregroundStyle="secondaryLabel">{`${t("conflicts")}: ${mod.conflicts.join(", ")}`}</Text>
      )}
      <Text foregroundStyle="secondaryLabel">{`${t("source")}: ${mod.github ?? mod.source}`}</Text>
      <HStack>
        {updateAvailable ? <Button title={t("update")} action={update} disabled={disabled} /> : null}
        <Button title={t("delete")} action={remove} disabled={disabled} />
      </HStack>
    </VStack>
  )
}

function ModsScreen({ mods }: { mods: ModService }) {
  const dismiss = Navigation.useDismiss()
  const [state, setState] = useState<ModViewState>({ status: "loading" })

  useEffect(() => {
    let active = true
    void mods.initialize().then((snapshot) => {
      if (active) setState({ status: "content", snapshot })
    }).catch((error: unknown) => {
      if (!active) return
      setState({
        status: "error",
        previous: { mods: [], updates: {}, checkedAt: null },
        message: error instanceof Error ? error.message : t("notAvailable"),
        canRetry: true,
      })
    })
    return () => { active = false }
  }, [])

  const snapshot: ModSnapshot | null = state.status === "content" || state.status === "success"
    ? state.snapshot
    : state.status === "loading" ? null : state.previous
  const busy = state.status === "loading" || state.status === "working"
  const updateCount = snapshot == null ? 0 : Object.keys(snapshot.updates).length

  const fail = (error: unknown, previous: ModSnapshot) => {
    const known = error instanceof ModServiceError ? error : null
    setState({
      status: "error",
      previous,
      message: known?.message ?? t("notAvailable"),
      canRetry: known?.retryable ?? false,
    })
  }

  const importZip = async () => {
    if (busy || snapshot == null) return
    const paths = await DocumentPicker.pickFiles({ allowsMultipleSelection: false, shouldShowFileExtensions: true })
    const path = paths[0]
    if (path == null) return
    setState({ status: "working", previous: snapshot, stage: "archive", label: null })
    try {
      const next = await mods.installFromFile(path, (stage, label) => {
        setState({ status: "working", previous: snapshot, stage, label })
      })
      setState({ status: "success", snapshot: next, message: t("modInstalled") })
    } catch (error) {
      fail(error, snapshot)
    } finally {
      DocumentPicker.stopAcessingSecurityScopedResources()
    }
  }

  const installGitHub = async () => {
    if (busy || snapshot == null) return
    const repository = await Dialog.prompt({
      title: t("githubPromptTitle"),
      message: t("githubPromptMessage"),
      placeholder: t("githubPlaceholder"),
      confirmLabel: t("install"),
      cancelLabel: t("cancel"),
    })
    if (repository == null || repository.trim() === "") return
    setState({ status: "working", previous: snapshot, stage: "github", label: repository })
    try {
      const next = await mods.installFromGitHub(repository, (stage, label) => {
        setState({ status: "working", previous: snapshot, stage, label })
      })
      setState({ status: "success", snapshot: next, message: t("modInstalled") })
    } catch (error) {
      fail(error, snapshot)
    }
  }

  const checkUpdates = async () => {
    if (busy || snapshot == null) return
    setState({ status: "working", previous: snapshot, stage: "github", label: null })
    try {
      const next = await mods.checkForUpdates((stage, label) => {
        setState({ status: "working", previous: snapshot, stage, label })
      })
      setState({ status: "content", snapshot: next })
    } catch (error) {
      fail(error, snapshot)
    }
  }

  const updateOne = async (modId: string) => {
    if (busy || snapshot == null) return
    setState({ status: "working", previous: snapshot, stage: "download", label: modId })
    try {
      const next = await mods.update(modId, (stage, label) => {
        setState({ status: "working", previous: snapshot, stage, label })
      })
      setState({ status: "success", snapshot: next, message: t("modInstalled") })
    } catch (error) {
      fail(error, snapshot)
    }
  }

  const updateAll = async () => {
    if (busy || snapshot == null) return
    setState({ status: "working", previous: snapshot, stage: "download", label: null })
    try {
      const next = await mods.updateAll((stage, label) => {
        setState({ status: "working", previous: snapshot, stage, label })
      })
      setState({ status: "success", snapshot: next, message: t("modInstalled") })
    } catch (error) {
      fail(error, snapshot)
    }
  }

  const remove = async (mod: InstalledMod) => {
    if (busy || snapshot == null) return
    const confirmed = await Dialog.confirm({
      title: t("deleteModTitle"),
      message: t("deleteModMessage"),
      cancelLabel: t("cancel"),
      confirmLabel: t("delete"),
    })
    if (!confirmed) return
    setState({ status: "working", previous: snapshot, stage: "registry", label: mod.name })
    try {
      const next = await mods.remove(mod.id)
      setState({ status: "success", snapshot: next, message: t("modRemoved") })
    } catch (error) {
      fail(error, snapshot)
    }
  }

  return (
    <List
        navigationTitle={t("modsTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <Button title={t("close")} action={dismiss} /> }}
      >
        <Section footer={<Text>{t("modsIntro")}</Text>}>
          <Button title={t("importModZip")} systemImage="doc.zipper" action={importZip} disabled={busy} />
          <Button title={t("installFromGitHub")} systemImage="chevron.left.forwardslash.chevron.right" action={installGitHub} disabled={busy} />
          <Button title={t("checkModUpdates")} systemImage="arrow.clockwise" action={checkUpdates} disabled={busy} />
          {updateCount > 1 ? (
            <Button title={t("updateAllMods")} systemImage="arrow.down.circle.fill" action={updateAll} disabled={busy} />
          ) : null}
        </Section>

        {state.status === "loading" ? (
          <Section><VStack spacing={8}><ProgressView /><Text>{t("installing")}</Text></VStack></Section>
        ) : null}
        {state.status === "working" ? (
          <Section>
            <VStack alignment="leading" spacing={8}>
              <ProgressView />
              <Text font="headline">{modStageText(state.stage)}</Text>
              {state.label == null ? null : <Text foregroundStyle="secondaryLabel">{state.label}</Text>}
            </VStack>
          </Section>
        ) : null}
        {state.status === "error" ? (
          <Section>
            <Label title={t("errorTitle")} systemImage="exclamationmark.triangle.fill" foregroundStyle="systemOrange" />
            <Text>{state.message}</Text>
          </Section>
        ) : null}
        {state.status === "success" ? (
          <Section><Label title={state.message} systemImage="checkmark.circle.fill" foregroundStyle="systemGreen" /></Section>
        ) : null}

        {snapshot != null && snapshot.mods.length === 0 ? (
          <Section>
            <VStack alignment="center" spacing={10} frame={{ maxWidth: "infinity" }}>
              <Image systemName="puzzlepiece.extension" font={{ name: "system", size: 44 }} />
              <Text font="headline">{t("noMods")}</Text>
              <Text foregroundStyle="secondaryLabel">{t("noModsHint")}</Text>
            </VStack>
          </Section>
        ) : null}

        {snapshot == null || snapshot.mods.length === 0 ? null : (
          <Section title={t("installedMods")} footer={<Text>{t("modSecurity")}</Text>}>
            {snapshot.mods.map((mod) => (
              <ModRow
                mod={mod}
                updateAvailable={snapshot.updates[mod.id] != null}
                disabled={busy}
                update={() => { void updateOne(mod.id) }}
                remove={() => { void remove(mod) }}
              />
            ))}
          </Section>
        )}
    </List>
  )
}

function SettingsScreen({ updates }: { updates: SystemUpdateService }) {
  const dismiss = Navigation.useDismiss()
  const [running, setRunning] = useState(false)
  const runDiagnostic = async () => {
    if (running) return
    setRunning(true)
    try {
      const result = await runRuntimeDiagnostic(updates)
      await Dialog.alert({
        title: result.ready ? t("runtimeClosed") : t("runtimeFailed"),
        message: result.errors.length === 0 ? t("runtimeDiagnosticHint") : result.errors.join("\n"),
        buttonLabel: t("okay"),
      })
    } catch {
      await Dialog.alert({ title: t("runtimeFailed"), message: t("runtimeMissing"), buttonLabel: t("okay") })
    } finally {
      setRunning(false)
    }
  }
  return (
    <List
        navigationTitle={t("settingsTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <Button title={t("close")} action={dismiss} /> }}
      >
        <Section footer={<Text>{t("runtimeDiagnosticHint")}</Text>}>
          {running
            ? <VStack spacing={8}><ProgressView /><Text>{t("installing")}</Text></VStack>
            : <Button title={t("runtimeDiagnostic")} systemImage="waveform.path.ecg" action={runDiagnostic} />}
        </Section>
        <Section title={t("architecture")} footer={<Text>{t("architectureHint")}</Text>}>
          <Label title="Native control plane" systemImage="rectangle.3.group.fill" />
          <Label title="LÖVE / Lua game plane" systemImage="rectangle.inset.filled" />
        </Section>
        <Section title={t("modStore")} footer={<Text>{t("modStoreHint")}</Text>}>
          <Label title={t("tabMods")} systemImage="puzzlepiece.extension.fill" />
        </Section>
        <Section>
          <HStack><Text>{t("version")}</Text><Spacer /><Text foregroundStyle="secondaryLabel">{`${PRODUCT.version} (${PRODUCT.build})`}</Text></HStack>
        </Section>
    </List>
  )
}

export default function App() {
  const updates = useMemo(() => new SystemUpdateService(), [])
  const library = useMemo(() => new GameLibraryService(), [])
  const runtime = useMemo(() => new GameRuntimeService(updates, library), [])
  const mods = useMemo(() => new ModService(), [])
  const selectedTab = useObservable<ProductTabId>("home")
  const [gameSnapshot, setGameSnapshot] = useState<GameLibrarySnapshot | null>(null)
  const [versions, setVersions] = useState<Readonly<Record<ProductComponentId, string>>>({
    [COMPONENTS.runtime.id]: COMPONENTS.runtime.installedVersion,
    [COMPONENTS.core.id]: COMPONENTS.core.installedVersion,
  })
  const acceptSnapshot = (snapshot: UpdateSnapshot) => {
    setVersions((current) => {
      const next: Record<ProductComponentId, string> = { ...current }
      for (const row of snapshot.components) next[row.id] = row.installedVersion
      return next
    })
  }
  useEffect(() => {
    let active = true
    void runtime.recoverTransientSessions().then(() => library.initialize()).then((snapshot) => {
      if (active) setGameSnapshot(snapshot)
    }).catch(() => {
      // The Games tab presents actionable registry recovery details.
    })
    return () => { active = false }
  }, [])
  return (
    <TabView selection={selectedTab}>
      <Tab title={t(homeTab.titleKey)} systemImage={homeTab.systemImage} value={homeTab.id}>
        <NavigationStack>
          <HomeScreen
            openGames={() => selectedTab.setValue(gamesTab.id)}
            versions={versions}
            library={gameSnapshot}
          />
        </NavigationStack>
      </Tab>
      <Tab title={t(gamesTab.titleKey)} systemImage={gamesTab.systemImage} value={gamesTab.id}>
        <NavigationStack>
          <GamesScreen library={library} runtime={runtime} onSnapshot={setGameSnapshot} />
        </NavigationStack>
      </Tab>
      <Tab title={t(updatesTab.titleKey)} systemImage={updatesTab.systemImage} value={updatesTab.id}>
        <NavigationStack>
          <UpdatesScreen updates={updates} onSnapshot={acceptSnapshot} />
        </NavigationStack>
      </Tab>
      <Tab title={t(modsTab.titleKey)} systemImage={modsTab.systemImage} value={modsTab.id}>
        <NavigationStack>
          <ModsScreen mods={mods} />
        </NavigationStack>
      </Tab>
      <Tab title={t(settingsTab.titleKey)} systemImage={settingsTab.systemImage} value={settingsTab.id}>
        <NavigationStack>
          <SettingsScreen updates={updates} />
        </NavigationStack>
      </Tab>
    </TabView>
  )
}
