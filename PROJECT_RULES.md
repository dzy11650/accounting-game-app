# 会计小当家 · 项目协作规则

> 适用对象：会计小当家教学软件（当前登记版本 V2.0.4，登记号待下证）
> 本文件为项目级常驻规则，**每次新对话/协作都应先读取并遵守**。
> 打包副本见 `softcopyright/项目协作规则.md`。

---

## 0. 总原则

本项目经历过"乱码 commit、curl 上传失败、README 漏写版本"等踩坑。
所有涉及**发版、提交、上传、文档**的操作，必须先看本规则，避免重复犯错。

---

## 1. 编码与乱码（最高优先级）

本仓库吃过乱码大亏（Gitee 提交信息乱码、PowerShell 中文乱码、curl 上传失败）。
**任何写文件 / 提交 / 上传操作都必须保证 UTF-8，且不在 Windows 下产生 GBK 损坏。**

### 1.1 提交信息（commit message）
- **优先用英文写 commit message**，避免任何编码往返损坏。
  例：`fix: correct ledger balancing on v2.0.5` 而非中文。
- 若必须写中文，确保 git 客户端 `i18n.commitEncoding=utf-8` 且终端为 UTF-8。
- 提交后**第一时间在 Gitee 网页核对 message 是否乱码**；一旦发现乱码，立即用
  `git commit --amend` / `git filter` 重写并 `push --force-with-lease` 修复（参考历史修复记录）。

### 1.2 文件与脚本
- 所有 `.md` / `.txt` / `.mjs` / `.js` 一律 UTF-8（无 BOM）。
- **不要**用 PowerShell 直接 `Get-Content`/`.ps1` 读写含中文的文件（易 GBK 损坏）。
  改用 **Node.js 脚本**处理中文内容（已验证可靠）。

### 1.3 上传产物到 Gitee Release
- **禁止使用 `curl -F file=@...`** 上传附件（Gitee attach_files 接口不接受，返回 200 但 assets 为空）。
- 使用 **Node.js https + multipart** 脚本上传（参考历史 `_upload_v204.mjs`）。
- **上传端点必须用 `attach_files`，不是 `assets`/`attachments`**：
  - ✅ 正确：`POST /api/v5/repos/{owner}/{repo}/releases/{release_id}/attach_files?access_token=...`
  - ❌ 错误：`.../releases/{id}/assets` → 返回 **404**（页面不存在）；
    `.../releases/assets` → 返回 **405**（method not allowed）。
  - 曾误用这两个路径，误以为 Gitee 下线了上传功能（实测 API 未变动，接口一直可用）。
- **上传前先清理旧附件**：同一 release 反复发版时，用
  `DELETE /api/v5/repos/{owner}/{repo}/releases/{release_id}/attach_files/{asset_id}` 删掉旧包，
  避免 Release 上残留非最新代码产物（曾因残留旧包造成版本不一致）。
- README 中的下载链接含中文文件名时，必须做 **URL 百分号转义**（如 `会计小当家` → `%E4%BC%9A...`），否则链接失效。

---

## 2. 版本迭代必须更新 README（硬性要求）

每次发版（无论大小版本），**发版动作未完成前不得结束**，且必须同步 README：

- [ ] 下载表新增/更新到当前版本号，链接经 URL 转义且可点开。
- [ ] 新增"更新内容"章节，写明本版本变更（修复/新增/优化）。
- [ ] **不得遗漏历史版本**：若之前版本（如 v2.0.2 / v2.0.3）的更新内容未写，必须补写。
- [ ] 软著登记号下证后，在 README 顶部/下载区标注登记号。

> 历史教训：曾漏写 v2.0.2/v2.0.3 更新内容，被指出后才补。

---

## 3. 发版标准流程（checklist）

1. 打包各端产物（Electron / NSIS / Tauri exe / Android APK）。
2. 用 Node 脚本上传到 Gitee Release（tag = 版本号，如 `v2.0.5`）。
3. 更新 README（下载表 + 更新内容 + 历史版本补全）。
4. `git commit`（英文 message）+ `git push`。
5. 在 Gitee 网页核对：commit message 无乱码、Release 附件齐全、README 链接有效。
6. 如需软著相关动作，见第 4 节。

---

## 4. 软件著作权（软著）迭代规则

软著保护的是"这一版软件的代码表达"，不是名字也不是未来版本。
是否重登取决于"改动多大"和"是否换主体"。

| 情况 | 例子 | 是否重登 | 动作 |
|------|------|----------|------|
| A. 小版本迭代 | 2.0.5 修 bug、加课程、UI/性能优化 | 不需要 | 原软著继续有效，保留 git 提交与发布记录 |
| B. 大版本/重大变更 | 3.0 重构、改名、核心玩法重写 | 建议新登 | 以新版本重新提交源码+手册申请新软著 |
| C. 换著作权主体 | 个人转公司、转让、主体变更 | 必须转让登记 | 签转让合同 + 向中国版权保护中心提交转让登记 |

- **小版本（A）**：仅修 bug、少量内容调整、UI/性能/兼容优化，未改核心架构。
- **大版本（B）**：主版本号变更、改名、核心架构重写、新增重大模块。
- **换主体（C）**：法律主体变化，合同 + 转让登记缺一不可。

软著材料（源码/手册/申请表/时间线/规则）在 `softcopyright/`，打包为 `softcopyright_v2.0.4.zip`。

---

## 5. 关键资产速查

- **Gitee 仓库**：`dzy11650/accounting-game-app`，Release 例：`v2.0.4`（id=794796）。
- **Token**：存放于桌面 `新建文本文档.txt`（未落盘项目），使用前读取，勿提交进仓库。
- **产物路径**：`release/`、`src-tauri/target/release/`、`android/app/build/outputs/apk/release/`。
- **常驻规则文件**：根目录 `PROJECT_RULES.md`（本文件）+ `softcopyright/` 内副本。

---

## 6. 踩坑历史（避免重演）

- ❌ 中文 commit message 经 Git/Gitee 编码往返变乱码 → ✅ 改用英文 message。
- ❌ PowerShell 读写中文文件 GBK 损坏 → ✅ 改用 Node 脚本。
- ❌ `curl -F` 上传 Gitee 附件返回 200 但无附件 → ✅ 改用 Node multipart。
- ❌ 误用 `.../releases/{id}/assets`（404）或 `.../releases/assets`（405）上传，误判 Gitee 下线 → ✅ 正确端点为 `.../releases/{id}/attach_files`，API 未变动。
- ❌ 同一 release 残留旧附件导致版本不一致 → ✅ 上传前先 `DELETE .../attach_files/{asset_id}` 清理旧包。
- ❌ 发版漏写/漏补历史版本 README → ✅ 发版必更新并补全。
