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
  TabView,
  Text,
  useEffect,
  useMemo,
  useState,
  VStack,
} from "scripting"

import { COMPONENTS, PRODUCT, type ProductComponentId } from "../config/product"
import { SystemUpdateService, UpdateServiceError } from "../data/system-update-service"
import { PRODUCT_TABS, type UpdateMutationStage, type UpdateSnapshot, type UpdateViewState } from "../domain/models"
import { formatDate, t } from "../i18n/strings"
import { runRuntimeDiagnostic } from "../platform/runtime-diagnostic"

const enabledTabs = PRODUCT_TABS.filter(({ enabled }) => enabled)
const tabIndex = (id: "home" | "games" | "updates" | "settings") => enabledTabs.findIndex((tab) => tab.id === id)

function ScreenToolbar() {
  const dismiss = Navigation.useDismiss()
  return <Button title={t("close")} action={dismiss} />
}

function HomeScreen({
  openGames,
  versions,
}: {
  openGames: () => void
  versions: Readonly<Record<ProductComponentId, string>>
}) {
  return (
    <NavigationStack>
      <List
        navigationTitle={t("homeTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <ScreenToolbar /> }}
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
            <Label title={t("continueUnavailable")} systemImage="square.dashed" />
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
    </NavigationStack>
  )
}

function GamesScreen() {
  const explainImport = async () => {
    await Dialog.alert({
      title: t("importPendingTitle"),
      message: t("importPendingMessage"),
      buttonLabel: t("okay"),
    })
  }
  return (
    <NavigationStack>
      <List
        navigationTitle={t("gamesTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <ScreenToolbar /> }}
      >
        <Section>
          <VStack alignment="center" spacing={12} frame={{ maxWidth: "infinity" }}>
            <Image systemName="square.stack.3d.up.slash" font={{ name: "system", size: 48 }} />
            <Text font="headline">{t("noGames")}</Text>
            <Text foregroundStyle="secondaryLabel">{t("noGamesHint")}</Text>
            <Button title={t("importGame")} systemImage="doc.badge.plus" action={explainImport} />
          </VStack>
        </Section>
      </List>
    </NavigationStack>
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
    <NavigationStack>
      <List
        navigationTitle={t("updatesTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <ScreenToolbar /> }}
      >
        <Section footer={<Text>{t("updateIntro")}</Text>}>
          <Button
            title={state.status === "checking" ? t("checking") : t("checkUpdates")}
            systemImage="arrow.clockwise"
            action={check}
            disabled={isBusy}
          />
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
    </NavigationStack>
  )
}

function SettingsScreen({ updates }: { updates: SystemUpdateService }) {
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
    <NavigationStack>
      <List
        navigationTitle={t("settingsTitle")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <ScreenToolbar /> }}
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
    </NavigationStack>
  )
}

export default function App() {
  const updates = useMemo(() => new SystemUpdateService(), [])
  const [selectedTab, setSelectedTab] = useState(tabIndex("home"))
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
  return (
    <TabView tabIndex={selectedTab} onTabIndexChanged={setSelectedTab}>
      <HomeScreen
        openGames={() => setSelectedTab(tabIndex("games"))}
        versions={versions}
        tag={tabIndex("home")}
        tabItem={<Label title={t("tabHome")} systemImage="house.fill" />}
      />
      <GamesScreen
        tag={tabIndex("games")}
        tabItem={<Label title={t("tabGames")} systemImage="square.grid.2x2.fill" />}
      />
      <UpdatesScreen
        updates={updates}
        onSnapshot={acceptSnapshot}
        tag={tabIndex("updates")}
        tabItem={<Label title={t("tabUpdates")} systemImage="arrow.down.circle.fill" />}
      />
      <SettingsScreen
        updates={updates}
        tag={tabIndex("settings")}
        tabItem={<Label title={t("tabSettings")} systemImage="gearshape.fill" />}
      />
    </TabView>
  )
}
