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

## 下载安装包

已打包好的各平台安装包可在 Gitee Releases 下载（无需自行构建）：

| 平台 | 文件 | 大小 | 说明 |
| --- | --- | --- | --- |
| 🤖 安卓 | [app-release-1.0.2.apk](https://gitee.com/dzy11650/accounting-game-app/releases/download/v1.0.2/app-release-1.0.2.apk) | 3.2 MB | 已签名，可直接安装到安卓手机 |
| 🪟 Windows（Electron 便携版） | [kjxdj-electron-1.0.2-portable.exe](https://gitee.com/dzy11650/accounting-game-app/releases/download/v1.0.2/kjxdj-electron-1.0.2-portable.exe) | 81 MB | 双击即用，免安装 |
| 🪟 Windows（Tauri 版） | [kjxdj-tauri-1.0.2.exe](https://gitee.com/dzy11650/accounting-game-app/releases/download/v1.0.2/kjxdj-tauri-1.0.2.exe) | 3.9 MB | 体积更小、启动更快，双击即用（已修复旧版双击报 localhost 拒绝连接的问题） |
| 🪟 Windows（Tauri 安装版） | [kjxdj-tauri-1.0.2-setup.exe](https://gitee.com/dzy11650/accounting-game-app/releases/download/v1.0.2/kjxdj-tauri-1.0.2-setup.exe) | 1.2 MB | NSIS 安装包，安装后从开始菜单/桌面快捷方式启动 |

> 所有安装包发布于 Release **[v1.0.2](https://gitee.com/dzy11650/accounting-game-app/releases/tag/v1.0.2)**。
> 文件名为英文，以避免中文文件名在部分系统下显示异常。
>
> ⚠️ Windows 安装包暂未做代码签名，首次运行若遇 SmartScreen 提示「请在打开前确保信任」，请点击「更多信息」→「仍要运行」即可正常启动（并非病毒，详见 Release 说明）。

### v1.0.2 更新内容
- 新增「股东分红」玩法：股东会可决议分红 30% / 50% / 暂不分红，自动代扣 20% 股息红利个税。
- 新增「合法税务筹划」：第七章提供小型微利优惠、研发加计扣除、小规模纳税人免税三种合规方案（与偷逃税严格区分）。
- 简单模式会计分录演示**默认自动展开**，无需手动点击播放。
- 修复：选择业务时 `moodFactor is not defined` 报错导致交互中断的问题。

## 赞助

如果这个项目对你有帮助，欢迎请作者喝杯奶茶 ☕：

<div align="center">
  <img src="public/wechat-pay.jpg" width="220" alt="微信收款码" />
  <img src="public/alipay-pay.jpg" width="220" alt="支付宝收款码" />
  <p><sub>扫码即可赞助，支持微信 / 支付宝（信用卡、花呗可用）。</sub></p>
</div>

## 许可证

本项目仅供学习交流使用。
