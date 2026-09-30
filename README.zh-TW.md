# dsh-startup-command

繁體中文（台灣） · [English (United States)](README.md) · [简体中文（中国大陆）](README.zh-CN.md) · [日本語](README.ja.md)

**在 dsh web 啟動成功後執行使用者自訂命令的 DeepSeek Harness Web 外掛。**

當 `dsh web` 完成啟動（Loader 樹全部穩定、webServer 開始監聽）後，本外掛會執行你在 profile 中配置的自訂命令——例如用特定瀏覽器、帶特定參數開啟 Web GUI。

命令完全由配置（profile 的 `cordis.patch.yml` 中 `dsh-startup-command` 的 `config` 條目，可從網頁設定卡片編輯）決定，不硬編碼在外掛原始碼中。`{url}` 佔位符會被替換為實際 GUI 地址（`http://127.0.0.1:<port>/?token=…`），因此即使使用 `--port 0` 由作業系統分配埠也能正確工作。

## 截圖

本外掛自己的「插件」頁（側邊欄「外掛」→ 開啟本外掛，設定區位於外掛說明與各項之間）顯示的設定卡片：

![啟動命令設定卡片（簡體中文）](screenshot_cn.png)

![Startup command settings card (English)](screenshot_en.png)

## 功能特性

- **啟動成功後觸發**：與內建 `web-app` 的 `openBrowser` 走完全相同的生命週期——等整棵 Loader 樹 settle、`webServer` 服務就緒之後才執行，保證拿到的一定是「監聽啟動後」的實際地址。
- **命令完全可配置**：外掛自己宣告設定 schema，名稱空間即 profile 入口 id（`dsh-startup-command`），`command` 支援單條字串或多條陣列；多條命令按順序依次執行（前一條退出後才執行下一條）。改配置無需動外掛原始碼。
- **`{url}` / `{home}` / `{browser}` 佔位符**：`{url}` 執行前替換為 `http://127.0.0.1:<實際埠>/?token=…`（新版 dsh web 需要 token 換取瀏覽器登入 cookie；舊版或無 `connection` 服務時自動退回不帶 token 的乾淨 URL），埠自動分配（`--port 0`）時同樣生效；`{home}` 替換為使用者資料夾；`{browser}` 自動查詢 Chromium 家族瀏覽器（優先 `Chromium > Chrome > Edge`，若預設瀏覽器是其中之一則採用預設瀏覽器）。
- **不阻塞 dsh 行程**：以 `detached` 方式生成子行程並忽略其標準輸入輸出，命令獨立執行，dsh 退出時不會被拖住。
- **開關與模式**：`enabled: false` 可臨時關閉；`shell: true` 可走系統 shell 執行（預設關閉，直接以參數陣列 spawn，路徑含空格也安全）。
- **配置缺失即跳過**：未設定 `command` 時列印警告並跳過，不會靜默失敗或誤執行。
- **網頁設定卡片**：在本外掛自己的「插件」頁（側邊欄「外掛」→ 開啟本外掛）提供一張可展開卡片，就地編輯 `enabled` / `shell` / `command`，並提供「新增示例命令」按鈕——彈出說明框介紹示例命令後，一鍵插入自動查詢瀏覽器的現成命令，無需手改 cordis.patch.yml。

## 掛載方式

本外掛是「雙面」外掛：host 半側（`index.js`，啟動時執行命令）+ 瀏覽器半側（`client.js`，在側邊欄「外掛」頁中本外掛自己的頁面註冊設定卡片）。

### 1. 獲取包

從 npm 安裝（推薦）：

```sh
npm install @kagurazakayashi/dsh-startup-command
# pnpm 型 profile 可用：
# pnpm add @kagurazakayashi/dsh-startup-command
```

或從原始碼安裝（本地開發）——將外掛目錄放到 profile 下並軟鏈：

```
C:\Users\<你>\.dsh\profiles\web\plugins\dsh-startup-command\
```

```json
{
  "dependencies": {
    "@kagurazakayashi/dsh-startup-command": "link:plugins/dsh-startup-command"
  }
}
```

然後執行 `pnpm install` 生成軟鏈；或手動建立
`node_modules/@kagurazakayashi/dsh-startup-command` 指向
`../../plugins/dsh-startup-command` 的 junction/symlink。

### 2. 掛載外掛

在 `C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml` 中新增 `insert` 條目（該行只負責掛載；命令本身作為 `config` 條目在下一節新增）：

```yaml
- insert:
    - id: dsh-startup-command
      name: '@kagurazakayashi/dsh-startup-command'
      inject: [webServer]
```

### 3. 配置並重啟

在 `C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml` 中為 `dsh-startup-command` 新增 `config` 條目（見下節），然後重啟 `dsh web` 生效。重啟後，本外掛自己的「插件」頁（側邊欄「外掛」→ 開啟本外掛）會出現設定卡片，可就地編輯 `enabled` / `shell` / `command`。

**在哪裡找到這張卡片**（dsh 0.2.x 起外掛配置已不在「設定」對話方塊裡，而在外掛自己的頁面上）：

1. 在側欄頂部開啟「外掛」頁（四宮格圖示，位於「工作區」之上），不是底部的「設定」。
2. 等「已安裝」清單填充出來。該頁需要向 host 查詢外掛清單，冷啟動的瀏覽器會話裡可能要十幾秒；清單未出現時頁面幾乎是空的，並非沒有內容。
3. 在「已安裝」裡點本外掛的條目開啟詳情頁——`1.1.1` 起清單顯示本地化名稱「啟動命令」，舊版本顯示包名 `@kagurazakayashi/dsh-startup-command`；點右側開關或空白處不會進入詳情頁。
4. 配置區位於該外掛的**說明**與**包含的元件**之間；卡片預設收起，點卡片標題展開。

> 若啟用了帶背景圖案的皮膚，插件頁的文字會壓在畫面上、對比度偏低（該頁沒有不透明底色，卡片保留自己的底色），臨時切換或停用皮膚會更容易看清。

## 配置詳解

配置位於 profile 的 `cordis.patch.yml`（例如 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`）中 `dsh-startup-command` 的 `config` 條目。schema 由外掛自己宣告，名稱空間即本 bundle 的 `cordis.patch.yml` 宣告的 profile 入口 id `dsh-startup-command`；未配置時以下 schema 預設值生效：

```yaml
- id: dsh-startup-command
  config:
    enabled: true
    shell: false
    command: '"C:\Program Files\Chromium\Application\chrome.exe" --user-data-dir="..." --app={url}'
```

支援以下欄位：

- `command` (string | string[]) — 單條命令直接寫字串；多條命令寫成陣列，按順序依次執行，前一條退出後才執行下一條；每條按引號分組成 argv，路徑含空格必須用雙引號包住
- `enabled` (boolean, 預設 `true`) — 設為 `false` 臨時關閉
- `shell` (boolean, 預設 `false`) — 設為 `true` 時經系統 shell 執行

`command` 支援以下佔位符，均在執行前替換：

- `{url}` — 實際 GUI 地址（新版 dsh web 為帶 `?token=` 的認證 URL）
- `{home}` — 當前使用者資料夾（`os.homedir()`）
- `{browser}` — 自動查詢的 Chromium 家族瀏覽器可執行檔案路徑。查詢規則：系統預設瀏覽器若是 Chromium / Chrome / Edge 之一，則採用預設瀏覽器；否則按 `Chromium > Chrome > Edge` 的優先順序返回第一個已安裝者

網頁設定卡片上的「新增示例命令」按鈕會先彈出說明框介紹示例命令，確認後再追加一條使用 `{browser}`、`{home}`、`{url}` 的現成命令；查詢結果來自 host 上只讀路由 `GET /dsh-startup-command/browser`，卡片掛載時讀取一次；若未找到 Chromium / Chrome / Edge，則會提示「無法生成示例命令」並說明原因。

## 使用示例

用 Chrome 以獨立配置目錄、快取目錄、仿 APP 視窗開啟 GUI，不顯示歡迎畫面、不載入任何擴充套件：

```yaml
- id: dsh-startup-command
  config:
    command: '"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\dsh-chrome-profile" --disk-cache-dir="D:\dsh-chrome-cache" --app={url} --no-first-run --disable-extensions'
```

各參數含義：

- `--app={url}` — 仿 APP 視窗（應用模式，無位址列/工具欄）
- `--no-first-run` — 不顯示首次執行歡迎畫面
- `--disable-extensions` — 不載入任何擴充套件
- `--user-data-dir=<路徑>` — 指定配置（profile）目錄
- `--disk-cache-dir=<路徑>` — 指定快取目錄

注：使用獨立 `--user-data-dir` 可避免與已執行的 Chrome 例項衝突（否則 `--app` 會被已有例項接管、開關不生效）。

自動查詢 Chromium / Chrome / Edge 並帶上上述參數（等效於網頁卡片上的「新增示例命令」按鈕）：

```yaml
- id: dsh-startup-command
  config:
    command: '"{browser}" --user-data-dir="{home}/.dsh/dsh-browser-data" --disk-cache-dir="{home}/.dsh/dsh-browser-cache" --app={url} --no-first-run --disable-extensions'
```

多條命令按順序依次執行（前一條退出後才執行下一條）：

```yaml
- id: dsh-startup-command
  config:
    command:
      - 'cmd /c ping -n 3 127.0.0.1' # 先做點準備工作（此例約 2 秒後退出）
      - '"C:\Program Files\Google\Chrome\Application\chrome.exe" --app={url}'
```

開啟任意程式（例如記事本）：

```yaml
- id: dsh-startup-command
  config:
    command: 'C:\Windows\System32\notepad.exe'
```

## 與內建「開啟預設瀏覽器」的關係

`dsh web` 內建會在啟動成功後用 `open` 包開啟**系統預設瀏覽器**（`web-runtime` 行的 `openBrowser`）。如果你用本外掛指定瀏覽器開啟，通常會希望關掉內建行為，避免雙重開啟。在 `cordis.patch.yml` 中覆蓋該行（patch 會整行替換 config，必須重述所有鍵）：

```yaml
- id: web-runtime
  config:
    openBrowser: false
    printUrl: true
    surfaceContext: true
    trustedHosts: !!js ctx.webStartup.trustedHosts
```

如果不需要禁用內建行為（例如想讓預設瀏覽器與自訂命令共存），去掉這段即可。

## 觸發時序

```
dsh web 啟動
    │
    ▼
Loader 樹全部 settle（webServer 開始監聽）
    │
    ▼
dsh-startup-command 執行：{url} 替換 → spawn(命令)
    │
    ▼
子行程 detached 執行，dsh 持續服務
```

## 解除安裝

從 profile 的 `cordis.patch.yml` 中刪除 `dsh-startup-command` 的 `insert` 條目（以及不再需要的 `web-runtime` 覆蓋）與該檔案中 `id: dsh-startup-command` 的 `config:` 條目，刪除外掛目錄，重啟 `dsh web`。該 `config:` 條目是本外掛唯一的持久痕跡，刪掉它即無殘留。

## 注意事項

- **需重啟生效**：執行中的行程不會載入新的 patch 行，修改配置後必須重啟 `dsh web`。
- **ESM 目錄匯入限制**：`name` 必須指向 `index.js` 檔案而非目錄，否則 Node 報 `ERR_UNSUPPORTED_DIR_IMPORT`。
- **命令解析**：每條命令字串按「雙引號分組」拆成 argv；路徑含空格但未加引號時會被錯誤拆分。
- **多命令序列**：多條命令按順序執行，前一條**退出後**才啟動下一條；如果某條是長駐行程（如瀏覽器），排在它後面的命令會一直等待——請把長駐命令放在最後。
- **未配置即跳過**：`command` 未設定時列印警告並跳過，不會執行任何東西。
- **不會等待整個序列完成**：外掛以 `detached` 方式啟動每條命令，dsh 退出時未啟動的後續命令不再執行，已啟動的獨立行程繼續執行；如需確認命令已執行，請檢視 dsh 啟動紀錄中的 `dsh-startup-command:` 行。

## 版本相容性

本外掛適配的 DSH 版本與執行環境：

| 專案            | 版本 / 說明                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 適配的 DSH core | 最低 `0.2.0-rc.1`（`engines.dsh`；`@deepseek-ai/dsh-settings` 與 `@deepseek-ai/dsh-host-webserver` 兩個 peer 為 `>=0.2.0-rc.1 <0.3.0-0`）；執行實測於 `0.2.0-rc.2`                                                                                |
| 外掛版本        | `1.1.1`                                                                                                                                                                                                                                           |
| 設定 schema     | 外掛自己的 schemastery `Config`，`.volatile()` 欄位為 `enabled`、`command`（字串或字串陣列）、`shell`；不再有 `settings.register` / `settings.get`                                                                                                |
| 設定名稱空間    | 本 bundle 的 `cordis.patch.yml` 宣告的 profile 入口 id `dsh-startup-command`；值持久化在 profile 的 `cordis.patch.yml`（例如 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`），不在 `$DSH_HOME/settings.yaml`                                             |
| 設定卡片席位    | `plugins.bundle.config`，以 npm 包名 `@kagurazakayashi/dsh-startup-command` 為鍵，由 `@deepseek-ai/dsh-client-ui-plugin-manager` 提供；卡片透過 `ctx.configForms.get("dsh-startup-command")`（`getSnapshot` / `subscribe` / `set` / `unset`）讀寫 |
| 客戶端注入依賴  | `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-plugin-manager`、`@deepseek-ai/dsh-client-ui-settings`                                                                                                                              |
| 瀏覽器資訊路由  | host 上只讀的 `GET /dsh-startup-command/browser`；非 GET 傳回 `405` `METHOD_NOT_ALLOWED`；路由不存在時卡片退回「未找到」                                                                                                                          |

| 外掛版本 | 可用 core 版本            | 依據                                                                                                                                                                                           |
| -------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.1.1`  | `>= 0.2.0-rc.1 < 0.3.0-0` | 新增外掛展示元資訊：`locale/{en,zh}.json` 提供本地化的外掛名與簡介，`icon.svg` 提供外掛頁圖示；功能與設定機制與 `1.1.0` 相同                                                                   |
| `1.1.0`  | `>= 0.2.0-rc.1 < 0.3.0-0` | 適配 dsh 0.2.x：宣告式 `Config`、`configForms`（取代已被移除的 `settingsScope`）、本外掛自己「外掛」頁上的 `plugins.bundle.config` 卡片，以及取代主機注入 schema 欄位的瀏覽器資訊路由          |
| `1.0.1`  | 僅 `0.1.x`                | 透過 `settings.register` 註冊 schema、以 `settings.get` 讀取；配置存放於 `$DSH_HOME/settings.yaml` 的 `dsh-startup-command:` 段；卡片經 `settingsScope` 服務註冊進 `settings.plugin.item` 席位 |
| `1.0.0`  | 僅 `0.1.x`                | 新增示例命令說明框與多條命令編輯卡片；設定機制同 0.1.x                                                                                                                                         |
| `0.1.0`  | 僅 `0.1.x`                | 首個版本：`settings.yaml` 中的 `dsh-startup-command` 設定 schema 與網頁設定卡片                                                                                                                |

兩個區間沒有重疊：dsh 0.2.0 移除了 0.1.x 的 settings API，因此 `1.1.0` 需要 0.2.x，而 `1.0.1` 及更早版本無法在 0.2.x 上執行。

從 `1.0.1`（dsh 0.1.x）遷移：dsh 0.2.0 只會為「匯入時已存在於組合中的 profile 入口 id」匯入舊的 `$DSH_HOME/settings.yaml` 段（該匯入是一次性且已執行完畢）。因此若 `settings.yaml.imported` 中還留著 `dsh-startup-command:` 段，必須按上文「配置詳解」中的 YAML 片段手工搬進 profile 的 `cordis.patch.yml`。

## License

MIT — 見 [LICENSE](LICENSE)，版權歸 KagurazakaYashi(KagurazakaMiyabi) 所有。

## 語言

- [English (United States)](README.md)
- [简体中文（中国大陆）](README.zh-CN.md)
- 繁體中文（台灣）
- [日本語](README.ja.md)
