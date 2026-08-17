# 视频转实况照片 — Micro Spec

**状态：Approved / In progress**  
**日期：2026-07-28**

## Goal

提供一个 iOS 原生风格的 Scripting 脚本：用户从照片库选择一个视频，调整 Live Photo 的封面时刻与输出时长，预览所选封面帧，再生成并直接保存至照片图库。

## Constraints / Facts

- 使用 `Photos.pick({ filter: PHPickerFilter.videos(), limit: 1 })` 选择视频并通过 `videoPath()` 取得本地副本。
- 使用 `AVAsset.loadDuration()` 与 `generateImage()` 提供时长和预览帧。
- 使用 `LivePhoto.createFromVideo()` + `Photos.saveLivePhoto()` 生成并保存。
- 运行时按 `Device.systemLanguageCode` 显示中文或英文；不另建本地化文件。
- `maxDuration` 直接传用户选择值（最大为源视频时长），以兼容正在扩展的原生 API；当前安装版本若仍保留旧上限，会由原生 API 返回错误。
- 规格位于此脚本项目根的 `specs/`，符合 SDD RIPER。

## UI / Interaction

- `NavigationStack` + `List` + `Section`：遵循 iOS 26 系统设置式分组与层级。
- 选择视频后显示封面预览、封面时刻滑杆、时长滑杆及清晰的摘要。
- 生成期间禁用主要操作、显示进度文字；成功/失败均用原生 `Dialog.alert`。
- 输出文件交由 LivePhoto API 写入临时目录，保存时 `shouldMoveFile: true`。

## Done Contract

- 项目包含 `script.json`、`index.tsx`，可从 Scripts 启动。
- TypeScript 诊断无错误；用现有本地视频完成一次选择/预览/生成流程的运行验证。
- 文案中英文均覆盖主要状态与错误反馈。

## Validation / Handoff

- 自动：`get_typescript_diagnostics` 无错误；`scripting-ts preview_ui index.tsx` 成功渲染（2026-07-28）。
- 人工：从 UI 选择相册视频，调整两个滑杆，点击生成，确认照片 App 中出现可长按播放的 Live Photo。

## Change Log

- 2026-07-28：创建独立脚本项目、双语文案、视频选择/时长读取/封面抽帧预览/封面与时长滑杆，以及 `createFromVideo → saveLivePhoto` 直接保存链路。
- 时长滑杆上限绑定源视频时长；脚本不再人为限制为 10 秒。实际可用最长时长由安装的原生 `LivePhoto.createFromVideo` 版本决定，待原生 API 解除上限的改动随 App 打包进入设备后即可使用全时长。
