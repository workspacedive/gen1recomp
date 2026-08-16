import {
  Button,
  HStack,
  Image,
  List,
  Navigation,
  NavigationStack,
  ProgressView,
  Script,
  Section,
  Slider,
  Spacer,
  Text,
  VStack,
  useState,
} from "scripting"

type SelectedVideo = {
  path: string
  duration: number
  coverTime: number
  outputDuration: number
  preview: UIImage
}

type TextKey = keyof typeof zh

const zh = {
  title: "视频转实况照片",
  choose: "选择视频",
  replace: "更换视频",
  source: "视频",
  noVideo: "尚未选择视频",
  noVideoHint: "从相册选择一个本地视频，制作成可长按播放的实况照片。",
  cover: "封面时刻",
  duration: "实况时长",
  preview: "封面预览",
  settings: "实况设置",
  seconds: "秒",
  generate: "生成并保存到相册",
  generating: "正在生成实况照片…",
  savedTitle: "已保存到相册",
  savedMessage: "实况照片已经生成并保存。你可以在照片 App 中长按播放。",
  failedTitle: "生成失败",
  selectFailed: "无法读取这个视频，请换一个视频再试。",
  cancel: "取消",
  close: "关闭",
  instruction: "选择视频后，可拖动滑杆确定封面画面与实况照片时长。",
  selected: "已选择",
  format: "输出会保留视频方向，并生成 JPEG 封面和 MOV 配对视频。",
} as const

const en: Record<TextKey, string> = {
  title: "Video to Live Photo",
  choose: "Choose Video",
  replace: "Change Video",
  source: "Video",
  noVideo: "No Video Selected",
  noVideoHint: "Choose a local video from Photos and turn it into a Live Photo.",
  cover: "Cover Moment",
  duration: "Live Photo Length",
  preview: "Cover Preview",
  settings: "Live Photo Settings",
  seconds: "sec",
  generate: "Create & Save to Photos",
  generating: "Creating Live Photo…",
  savedTitle: "Saved to Photos",
  savedMessage: "Your Live Photo is ready. Long-press it in Photos to play.",
  failedTitle: "Couldn’t Create Live Photo",
  selectFailed: "This video couldn’t be read. Please choose another one.",
  cancel: "Cancel",
  close: "Close",
  instruction: "Choose a video, then set its cover moment and Live Photo length.",
  selected: "Selected",
  format: "The output preserves video orientation and creates a JPEG still plus paired MOV.",
}

const isChinese = Device.systemLanguageCode.toLowerCase().startsWith("zh")
const t = (key: TextKey) => (isChinese ? zh[key] : en[key])
const formatSeconds = (value: number) => `${value.toFixed(1)} ${t("seconds")}`
const rounded = (value: number) => Math.round(value * 10) / 10

async function readVideo(path: string): Promise<SelectedVideo> {
  const asset = new AVAsset(path)
  try {
    const [duration, playable, readable] = await Promise.all([
      asset.loadDuration(),
      asset.loadIsPlayable(),
      asset.loadIsReadable(),
    ])
    if (!playable || !readable || !duration.isNumeric || duration.seconds <= 0) {
      throw new Error(t("selectFailed"))
    }

    const seconds = rounded(duration.seconds)
    const coverTime = rounded(Math.min(seconds / 2, Math.max(0, seconds - 0.01)))
    const frame = await asset.generateImage(
      MediaTime.make({ seconds: coverTime, preferredTimescale: 600 }),
      { appliesPreferredTrackTransform: true },
    )

    return {
      path,
      duration: seconds,
      coverTime,
      outputDuration: seconds,
      preview: frame.image,
    }
  } finally {
    asset.dispose()
  }
}

export default function App() {
  const dismiss = Navigation.useDismiss()
  const [video, setVideo] = useState<SelectedVideo | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [status, setStatus] = useState("")

  const updateCover = async (nextTime: number) => {
    if (video == null) return
    const coverTime = rounded(nextTime)
    setVideo({ ...video, coverTime })

    const asset = new AVAsset(video.path)
    try {
      const frame = await asset.generateImage(
        MediaTime.make({ seconds: coverTime, preferredTimescale: 600 }),
        { appliesPreferredTrackTransform: true },
      )
      setVideo(current => current == null ? null : { ...current, preview: frame.image })
    } catch {
      // Slider updates must stay responsive. The final composition still validates the source.
    } finally {
      asset.dispose()
    }
  }

  const chooseVideo = async () => {
    if (isWorking) return
    try {
      const result = await Photos.pick({ filter: PHPickerFilter.videos(), limit: 1 })
      const path = await result[0]?.videoPath()
      if (path == null) return
      setStatus(t("selected"))
      setVideo(await readVideo(path))
    } catch (error) {
      await Dialog.alert({ title: t("failedTitle"), message: String(error), buttonLabel: t("close") })
    }
  }

  const createLivePhoto = async () => {
    if (video == null || isWorking) return
    setIsWorking(true)
    setStatus(t("generating"))
    try {
      const pair = await LivePhoto.createFromVideo({
        videoPath: video.path,
        stillTime: video.coverTime,
        // This intentionally follows the source duration. The native API enforces its own limits.
        maxDuration: video.outputDuration,
        imageFormat: "jpeg",
        includeAudio: true,
      })
      await Photos.saveLivePhoto({
        imagePath: pair.imagePath,
        videoPath: pair.videoPath,
        shouldMoveFile: true,
      })
      setStatus(t("savedTitle"))
      await Dialog.alert({ title: t("savedTitle"), message: t("savedMessage"), buttonLabel: t("close") })
    } catch (error) {
      setStatus("")
      await Dialog.alert({ title: t("failedTitle"), message: String(error), buttonLabel: t("close") })
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle={t("title")}
        navigationBarTitleDisplayMode="large"
        toolbar={{ cancellationAction: <Button title={t("close")} action={dismiss} /> }}
      >
        <Section footer={<Text>{t("instruction")}</Text>}>
          <Button
            title={video == null ? t("choose") : t("replace")}
            systemImage="video.badge.plus"
            action={chooseVideo}
          />
        </Section>

        {video == null ? (
          <Section>
            <VStack alignment="center" spacing={12}>
              <Image systemName="livephoto" font={{ name: "system", size: 52 }} frame={{ width: 56, height: 56 }} />
              <Text font="headline">{t("noVideo")}</Text>
              <Text>{t("noVideoHint")}</Text>
            </VStack>
          </Section>
        ) : (
          <>
            <Section header={<Text>{t("preview")}</Text>} footer={<Text>{t("format")}</Text>}>
              <VStack spacing={10}>
                <Image image={video.preview} resizable aspectRatio={{ contentMode: "fit" }} frame={{ maxWidth: "infinity", height: 210 }} />
                <HStack>
                  <Text>{t("source")}</Text>
                  <Spacer />
                  <Text>{formatSeconds(video.duration)}</Text>
                </HStack>
              </VStack>
            </Section>

            <Section title={t("settings")}>
              <VStack spacing={8}>
                <HStack>
                  <Text>{t("cover")}</Text>
                  <Spacer />
                  <Text>{formatSeconds(video.coverTime)}</Text>
                </HStack>
                <Slider
                  value={video.coverTime}
                  min={0}
                  max={Math.max(0.1, video.duration)}
                  step={0.1}
                  onChanged={updateCover}
                  label={<Text>{t("cover")}</Text>}
                />
              </VStack>

              <VStack spacing={8}>
                <HStack>
                  <Text>{t("duration")}</Text>
                  <Spacer />
                  <Text>{formatSeconds(video.outputDuration)}</Text>
                </HStack>
                <Slider
                  value={video.outputDuration}
                  min={Math.min(0.5, video.duration)}
                  max={video.duration}
                  step={0.1}
                  onChanged={value => setVideo(current => current == null ? null : { ...current, outputDuration: rounded(value) })}
                  label={<Text>{t("duration")}</Text>}
                />
              </VStack>
            </Section>

            <Section>
              {isWorking ? (
                <VStack spacing={10}>
                  <ProgressView />
                  <Text>{status}</Text>
                </VStack>
              ) : (
                <Button title={t("generate")} systemImage="livephoto" action={createLivePhoto} />
              )}
            </Section>
          </>
        )}
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present({ element: <App /> })
  Script.exit()
}

run()
