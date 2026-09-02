# dsh-startup-command

简体中文 · [English](README.md)

**在 dsh web 启动成功后运行用户自定义命令的 DeepSeek Harness Web 插件。**

当 `dsh web` 完成启动（Loader 树全部稳定、webServer 开始监听）后，本插件会执行你在 `settings.yaml` 中配置的自定义命令——例如用特定浏览器、带特定参数打开 Web GUI。

命令完全由设置文件（`settings.yaml` 的 `dsh-startup-command` 命名空间）决定，不硬编码在插件源码中。`{url}` 占位符会被替换为实际 GUI 地址（`http://127.0.0.1:<port>/?token=…`），因此即使使用 `--port 0` 由操作系统分配端口也能正确工作。

## 截图

「设置 → 插件 → 插件配置」页显示的设置卡片：

![启动命令设置卡片（简体中文）](screenshot_cn.png)

![Startup command settings card (English)](screenshot_en.png)

## 功能特性

- **启动成功后触发**：与内置 `web-app` 的 `openBrowser` 走完全相同的生命周期——等整棵 Loader 树 settle、`webServer` 服务就绪之后才执行，保证拿到的一定是「监听启动后」的实际地址。
- **命令完全可配置**：通过 settings 服务注册 `dsh-startup-command` 命名空间，`command` 支持单条字符串或多条数组；多条命令按顺序依次执行（前一条退出后才执行下一条）。改配置无需动插件源码。
- **`{url}` / `{home}` / `{browser}` 占位符**：`{url}` 执行前替换为 `http://127.0.0.1:<实际端口>/?token=…`（新版 dsh web 需要 token 换取浏览器登录 cookie；旧版或无 `connection` 服务时自动退回不带 token 的干净 URL），端口自动分配（`--port 0`）时同样生效；`{home}` 替换为用户文件夹；`{browser}` 自动查找 Chromium 家族浏览器（优先 `Chromium > Chrome > Edge`，若默认浏览器是其中之一则采用默认浏览器）。
- **不阻塞 dsh 进程**：以 `detached` 方式生成子进程并 `unref()`，命令独立运行，dsh 退出时不会被拖住。
- **开关与模式**：`enabled: false` 可临时关闭；`shell: true` 可走系统 shell 执行（默认关闭，直接以参数数组 spawn，路径含空格也安全）。
- **配置缺失即跳过**：未设置 `command` 时打印警告并跳过，不会静默失败或误执行。
- **网页设置卡片**：在「设置 → 插件 → 插件配置」页提供一张可展开卡片，就地编辑 `enabled` / `shell` / `command`，并提供「添加示例命令」按钮——弹出说明框介绍示例命令后，一键插入自动查找浏览器的现成命令，无需手改 settings.yaml。

## 挂载方式

本插件是「双面」插件：host 半侧（`index.js`，启动时执行命令）+ 浏览器半侧（`client.js`，在「设置 → 插件 → 插件配置」页注册设置卡片）。

### 1. 获取包

从 npm 安装（推荐）：

```sh
npm install @kagurazakayashi/dsh-startup-command
# pnpm 型 profile 可用：
# pnpm add @kagurazakayashi/dsh-startup-command
```

或从源码安装（本地开发）——将插件目录放到 profile 下并软链：

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

然后运行 `pnpm install` 生成软链；或手动创建
`node_modules/@kagurazakayashi/dsh-startup-command` 指向
`../../plugins/dsh-startup-command` 的 junction/symlink。

### 2. 挂载插件

在 `C:\Users\<你>\.dsh\profiles\web\cordis.patch.yml` 中添加 `insert` 条目（只负责挂载，命令配置在 settings.yaml）：

```yaml
- insert:
    - id: dsh-startup-command
      name: '@kagurazakayashi/dsh-startup-command'
      inject: [webServer]
```

### 3. 配置并重启

在 `C:\Users\<你>\.dsh\settings.yaml` 中添加 `dsh-startup-command` 命名空间（见下节），然后重启 `dsh web` 生效。重启后，「设置 → 插件 → 插件配置」页会出现本插件的设置卡片，可就地编辑 `enabled` / `shell` / `command`。

## 配置详解

配置位于 `settings.yaml` 的 `dsh-startup-command` 命名空间。插件启动时通过 settings 服务注册该命名空间，`schema` 的默认值在未配置时生效：

```yaml
dsh-startup-command:
  enabled: true
  command: '"C:\Program Files\Google\Chrome\Application\chrome.exe" --app={url}'
  shell: false
```

支持以下字段：

- `command` (string | string[]) — 单条命令直接写字符串；多条命令写成数组，按顺序依次执行，前一条退出后才执行下一条；每条按引号分组成 argv，路径含空格必须用双引号包住
- `enabled` (boolean, 默认 `true`) — 设为 `false` 临时关闭
- `shell` (boolean, 默认 `false`) — 设为 `true` 时经系统 shell 执行

`command` 支持以下占位符，均在执行前替换：

- `{url}` — 实际 GUI 地址（新版 dsh web 为带 `?token=` 的认证 URL）
- `{home}` — 当前用户文件夹（`os.homedir()`）
- `{browser}` — 自动查找的 Chromium 家族浏览器可执行文件路径。查找规则：系统默认浏览器若是 Chromium / Chrome / Edge 之一，则采用默认浏览器；否则按 `Chromium > Chrome > Edge` 的优先级返回第一个已安装者

网页设置卡片上的「添加示例命令」按钮会先弹出说明框介绍示例命令，确认后再追加一条使用 `{browser}`、`{home}`、`{url}` 的现成命令；若 dsh 启动时未找到 Chromium / Chrome / Edge，则会提示「无法生成示例命令」并说明原因。

## 使用示例

用 Chrome 以独立配置目录、缓存目录、仿 APP 窗口打开 GUI，不显示欢迎画面、不加载任何扩展：

```yaml
dsh-startup-command:
  command: '"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\dsh-chrome-profile" --disk-cache-dir="D:\dsh-chrome-cache" --app={url} --no-first-run --disable-extensions'
```

各参数含义：

- `--app={url}` — 仿 APP 窗口（应用模式，无地址栏/工具栏）
- `--no-first-run` — 不显示首次运行欢迎画面
- `--disable-extensions` — 不加载任何扩展
- `--user-data-dir=<路径>` — 指定配置（profile）目录
- `--disk-cache-dir=<路径>` — 指定缓存目录

注：使用独立 `--user-data-dir` 可避免与已运行的 Chrome 实例冲突（否则 `--app` 会被已有实例接管、开关不生效）。

自动查找 Chromium / Chrome / Edge 并带上上述参数（等效于网页卡片上的「添加示例命令」按钮）：

```yaml
dsh-startup-command:
  command: '"{browser}" --user-data-dir="{home}/.dsh/dsh-browser-data" --disk-cache-dir="{home}/.dsh/dsh-browser-cache" --app={url} --no-first-run --disable-extensions'
```

多条命令按顺序依次执行（前一条退出后才执行下一条）：

```yaml
dsh-startup-command:
  command:
    - 'cmd /c ping -n 3 127.0.0.1' # 先做点准备工作（此例约 2 秒后退出）
    - '"C:\Program Files\Google\Chrome\Application\chrome.exe" --app={url}'
```

打开任意程序（例如记事本）：

```yaml
dsh-startup-command:
  command: 'C:\Windows\System32\notepad.exe'
```

## 与内置「打开默认浏览器」的关系

`dsh web` 内置会在启动成功后用 `open` 包打开**系统默认浏览器**（`web-runtime` 行的 `openBrowser`）。如果你用本插件指定浏览器打开，通常会希望关掉内置行为，避免双重打开。在 `cordis.patch.yml` 中覆盖该行（patch 会整行替换 config，必须重述所有键）：

```yaml
- id: web-runtime
  config:
    openBrowser: false
    printUrl: true
    surfaceContext: true
    trustedHosts: !!js ctx.webStartup.trustedHosts
```

如果不需要禁用内置行为（例如想让默认浏览器与自定义命令共存），去掉这段即可。

## 触发时序

```
dsh web 启动
    │
    ▼
Loader 树全部 settle（webServer 开始监听）
    │
    ▼
dsh-startup-command 执行：{url} 替换 → spawn(命令)
    │
    ▼
子进程 detached 运行，dsh 继续服务
```

## 卸载

从 `cordis.patch.yml` 中删除 `dsh-startup-command` 的 `insert` 条目（以及不再需要的 `web-runtime` 覆盖），从 `settings.yaml` 中删除 `dsh-startup-command` 命名空间，删除插件目录，重启 `dsh web`。插件不产生任何持久状态，无需其他清理。

## 注意事项

- **需重启生效**：运行中的进程不会加载新的 patch 行，修改配置后必须重启 `dsh web`。
- **ESM 目录导入限制**：`name` 必须指向 `index.js` 文件而非目录，否则 Node 报 `ERR_UNSUPPORTED_DIR_IMPORT`。
- **命令解析**：每条命令字符串按「双引号分组」拆成 argv；路径含空格但未加引号时会被错误拆分。
- **多命令串行**：多条命令按顺序执行，前一条**退出后**才启动下一条；如果某条是长驻进程（如浏览器），排在它后面的命令会一直等待——请把长驻命令放在最后。
- **未配置即跳过**：`command` 未设置时打印警告并跳过，不会执行任何东西。
- **不会等待整个序列完成**：插件以 `detached + unref` 启动每条命令，dsh 退出时未启动的后续命令不再执行，已启动的独立进程继续运行；如需确认命令已执行，请查看 dsh 启动日志中的 `dsh-startup-command:` 行。

## License

MIT — 见 [LICENSE](LICENSE)，版权归 KagurazakaYashi(KagurazakaMiyabi) 所有。

## 语言

- [English](README.md)
