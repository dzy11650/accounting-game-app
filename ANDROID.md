# 会计小当家 · 安卓版（Capacitor）

本项目是一个 React + Vite 的会计教学 App。安卓版通过 **Capacitor** 把现有的 Web 应用
包装成原生安卓 App，**核心代码零改动复用**，安卓工程已生成在 `android/` 目录。

## 本机环境（已配置）

| 组件 | 路径 / 版本 |
| --- | --- |
| JDK 17 | `C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot`（已设 `JAVA_HOME` 用户变量） |
| Android SDK | `C:\Users\jacking\Android\Sdk`（已设 `ANDROID_HOME` / `ANDROID_SDK_ROOT`） |
| cmdline-tools | `...\Sdk\cmdline-tools\latest` |
| platform-tools | `...\Sdk\platform-tools`（adb 已加入 PATH） |
| 已装包 | `platform-tools`、`platforms;android-34`、`build-tools;34.0.0` |
| 签名 keystore | `C:\Users\jacking\Android\keystore\accounting-release.keystore`（alias: `accounting`） |

> 构建用 Gradle 8.2.1 已替换为**腾讯云镜像**（`gradle-wrapper.properties` 中
> `distributionUrl=https://mirrors.cloud.tencent.com/gradle/gradle-8.2.1-all.zip`），
> 避免直连 services.gradle.org 超时。

## 环境安装步骤（供在其他机器复现）

1. 安装 JDK 17（如 `choco install microsoft-openjdk17 -y`，需管理员）
2. 设置 `JAVA_HOME` 指向 JDK 根目录，并把 `%JAVA_HOME%\bin` 加入 PATH
3. 下载 Android command-line tools 解压到 `<Sdk>\cmdline-tools\latest`
4. 用 `sdkmanager` 安装：`platform-tools`、`platforms;android-34`、`build-tools;34.0.0`
5. 生成签名 keystore：`keytool -genkeypair -v -keystore <keystore> -keyalg RSA -keysize 2048 -validity 10000 -alias accounting`

## 构建签名 APK

```bash
# 设置环境变量（签名信息，默认已写在 build.gradle 的回退值里）
$env:JAVA_HOME="C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
$env:ANDROID_HOME="C:\Users\jacking\Android\Sdk"
$env:ANDROID_KEYSTORE_PATH="C:\Users\jacking\Android\keystore\accounting-release.keystore"
$env:ANDROID_KEYSTORE_PASSWORD="android123"
$env:ANDROID_KEY_ALIAS="accounting"
$env:ANDROID_KEY_PASSWORD="android123"

cd android
.\gradlew.bat assembleRelease
```

产物：`android\app\build\outputs\apk\release\app-release.apk`（已签名，可直接安装到设备）。

## 开发流程（更新 Web 内容后）

```bash
npm run android:build     # = vite build + cap sync android
cd android
.\gradlew.bat assembleRelease
```

## 用 Android Studio 打开

```bash
npm run android:open      # 用 Android Studio 打开 android/ 工程
```

## 目录说明

```
android/                 Capacitor 生成的安卓原生工程（用 Android Studio 打开）
capacitor.config.ts      Capacitor 配置
dist/                    vite build 产物，已被拷贝进 android 工程的 assets
```
