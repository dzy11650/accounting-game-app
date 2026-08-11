# 会计小当家

> 零基础会计入门教学 App —— 用趣味闯关的方式，帮你从 0 开始学会计。

[![Gitee](https://gitee.com/dzy11650/accounting-game-app/badge/star.svg)](https://gitee.com/dzy11650/accounting-game-app)

一个面向初学者的会计教学应用，通过情景化关卡（记账、凭证、报表、成本等）把枯燥的会计知识变成可互动的小游戏。

## 特性

- 🎮 **闯关式学习**：把会计知识点拆成有趣的小关卡，边玩边学
- 📱 **移动端优先**：针对手机屏幕优化，支持安全区（刘海屏 / 手势条）适配
- 💡 **零基础友好**：无需任何会计背景，从最基础的概念讲起
- 🧩 **模块化内容**：会计基础、记账、凭证、报表等模块逐步解锁

## 技术栈

- **前端**：React 18 + Vite + React Router（HashRouter）
- **状态管理**：Zustand
- **样式**：纯 CSS（`src/styles`）
- **桌面端**：Electron / Tauri（窗口 420×780 竖屏）
- **安卓端**：Capacitor 6 包装为原生 App（`com.accounting.game`）

## 目录结构

```
src/               React 前端源码（页面、组件、状态、样式）
electron/          Electron 桌面版封装
src-tauri/         Tauri 桌面版工程
android/           Capacitor 安卓原生工程（由 cap sync 生成）
dist/              vite build 产物（Capacitor 会拷贝进 android 资源）
capacitor.config.ts  Capacitor 配置
```

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发（Web）
npm run dev
```

## 构建各平台

### Web

```bash
npm run build      # 产物输出到 dist/
npm run preview    # 本地预览构建结果
```

### 桌面端（Electron）

```bash
npm run electron:dev     # 开发模式启动桌面窗口
npm run electron:build   # 打包桌面安装包
```

### 桌面端（Tauri）

```bash
npm run tauri dev        # 开发模式
npm run tauri build      # 打包原生安装包（需要 Rust 工具链）
```

### 安卓端（Capacitor）

安卓工程已生成在 `android/`，并已完成本机环境配置（JDK 17 + Android SDK + 签名 keystore）。

```bash
# 1. 更新 Web 内容并同步到安卓工程
npm run android:build        # = vite build + cap sync android

# 2. 构建签名 APK
cd android
.\gradlew.bat assembleRelease
```

产物：`android/app/build/outputs/apk/release/app-release.apk`（已签名，可直接安装到设备）。

> 完整安卓环境配置与签名说明见 [ANDROID.md](./ANDROID.md)。
> Gradle 分发已替换为腾讯云镜像以避免下载超时。

## 环境变量（安卓构建）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `JAVA_HOME` | JDK 17 路径 | `C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot` |
| `ANDROID_HOME` | Android SDK 路径 | `C:\Users\jacking\Android\Sdk` |
| `ANDROID_KEYSTORE_PATH` | 签名 keystore 路径 | `C:\Users\jacking\Android\keystore\accounting-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 | `android123` |
| `ANDROID_KEY_ALIAS` | 密钥别名 | `accounting` |
| `ANDROID_KEY_PASSWORD` | 密钥密码 | `android123` |

## 许可证

本项目仅供学习交流使用。
