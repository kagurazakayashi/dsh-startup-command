# dsh-startup-command

Language: [English (United States)](README.md) · [简体中文（中国大陆）](README.zh-CN.md) · [繁體中文（台灣）](README.zh-TW.md) · 日本語

**Web プロファイルの起動に成功した後に、ユーザー定義のコマンドを実行する DeepSeek Harness Web プラグイン。**

`dsh web` の起動が完了すると（Loader ツリーがすべて安定し、webServer がリッスンを開始した後）、本プラグインはプロファイルで設定したコマンドを実行します。たとえば、特定のブラウザを特定のフラグ付きで起動して Web GUI を開く、といった用途です。

コマンドは完全に設定によって決まります（プロファイルの `cordis.patch.yml` にある `dsh-startup-command` の `config` エントリ。ウェブの設定カードから編集できます）。プラグインのソースにハードコードされることはありません。`{url}` プレースホルダーは実際の GUI アドレス（`http://127.0.0.1:<port>/?token=…`）に置き換えられるため、`--port 0` で OS にポートを任せた場合でも正しく動作します。

## スクリーンショット

本プラグイン自身のページ（サイドバーの **Plugins** → 本プラグインを開く。設定セクションは説明と各行の間にあります）にある設定カード:

![Startup command settings card (English)](screenshot_en.png)

![启动命令设置卡片（简体中文）](screenshot_cn.png)

## 機能

- **起動成功後に発火**: 組み込みの `web-app` の `openBrowser` とまったく同じライフサイクルに従います。Loader ツリー全体が安定し、`webServer` サービスが準備完了になるまで待ってから実行するため、サーバーがリッスンを開始した後の実際のアドレスを必ず取得できます。
- **コマンドは完全に設定可能**: プラグイン自身が設定 schema を宣言し、名前空間はプロファイルエントリ id（`dsh-startup-command`）です。`command` は単一の文字列も、複数コマンドの配列も受け付け、配列の場合は順番に実行します（前のコマンドが終了してから次を開始します）。プラグインのソースを変更する必要はありません。
- **`{url}` / `{home}` / `{browser}` プレースホルダー**: `{url}` は実行前に `http://127.0.0.1:<実際のポート>/?token=…` に置き換えられます（新しい dsh web ではブラウザログイン用 cookie と引き換えるために token が必要です。`connection` サービスがない場合は token なしのクリーンな URL にフォールバックします）。OS が割り当てたポート（`--port 0`）でも動作します。`{home}` はユーザーフォルダーに置き換えられます。`{browser}` は Chromium 系ブラウザを自動検出します（優先順位は `Chromium > Chrome > Edge`。システム既定のブラウザがそのいずれかであれば既定のブラウザを採用します）。
- **dsh をブロックしない**: 子プロセスは `detached` で起動し標準入出力も無視するため、独立して動作し、dsh のシャットダウンを妨げることはありません。
- **トグルとモード**: `enabled: false` で一時的に無効化できます。`shell: true` でシステムシェル経由で実行します（既定はオフ。プレーンな引数配列で spawn するため、空白を含むパスでも安全です）。
- **未設定時はスキップ**: `command` が設定されていない場合は警告を出力してスキップします。暗黙の失敗も誤実行もありません。
- **ウェブ設定カード**: 本プラグイン自身のページ（サイドバーの **Plugins** → 本プラグインを開く）にある展開可能なカードで、`enabled`、`shell`、`command` をその場で編集できます。**Add example command** ボタンは説明ダイアログを開き、その後にブラウザ自動検出の既製コマンドを挿入します。`cordis.patch.yml` を手で編集する必要はありません。

## インストール

本プラグインは「デュアルフェイス」構成です。host 側（`index.js`、起動時にコマンドを実行）と、ブラウザ側（`client.js`、本プラグイン自身のページに設定カードを登録。サイドバーの **Plugins** → 本プラグインを開く）からなります。

### 1. Get the package

npm からインストール（推奨）:

```sh
npm install @kagurazakayashi/dsh-startup-command
# or, in a pnpm-based profile:
# pnpm add @kagurazakayashi/dsh-startup-command
```

またはソースから（ローカル開発）— プラグインディレクトリをプロファイル配下に置いてリンクします:

```
C:\Users\<you>\.dsh\profiles\web\plugins\dsh-startup-command\
```

```json
{
  "dependencies": {
    "@kagurazakayashi/dsh-startup-command": "link:plugins/dsh-startup-command"
  }
}
```

その後 `pnpm install` を実行してリンクを実体化します。あるいは
`node_modules/@kagurazakayashi/dsh-startup-command` から
`../../plugins/dsh-startup-command` を指す junction / symlink を手動で作成します。

### 2. Mount the plugin

`C:\Users\<you>\.dsh\profiles\web\cordis.patch.yml` に `insert` エントリを追加します（この行はプラグインをマウントするだけで、コマンド自体は次のセクションで `config` エントリとして追加します）:

```yaml
- insert:
    - id: dsh-startup-command
      name: '@kagurazakayashi/dsh-startup-command'
      inject: [webServer]
```

### 3. Configure and restart

`C:\Users\<you>\.dsh\profiles\web\cordis.patch.yml` に `dsh-startup-command` の `config` エントリを追加し（次のセクションを参照）、`dsh web` を再起動します。再起動後、本プラグイン自身のページ（サイドバーの **Plugins** → 本プラグインを開く）に設定カードが表示され、`enabled`、`shell`、`command` をその場で編集できます。

**カードの場所**（dsh 0.2.x 以降、プラグインの設定は「Settings」ダイアログではなくプラグイン自身のページにあります）:

1. サイドバー上部の **Plugins** ページを開きます（Workspaces の上にある四角が四つのアイコン。下部の **Settings** ではありません）。
2. **Installed** リストが埋まるまで待ちます。このページは host にプラグイン一覧を問い合わせるため、コールドなブラウザセッションでは十数秒かかることがあります。一覧が届くまでページはほぼ空に見えますが、内容がないわけではありません。
3. **Installed** の下で本プラグインのエントリをクリックして詳細ページを開きます。`1.1.1` 以降はローカライズされた名前 **Startup command** が表示され、それより古いバージョンではパッケージ名 `@kagurazakayashi/dsh-startup-command` が表示されます。右側のトグルや空白部分をクリックしても開きません。
4. 設定セクションはプラグインの **description** と **Included components** の間にあります。カードは既定で折りたたまれているので、タイトルをクリックして展開します。

> 背景画像付きのスキンを有効にしている場合、ページのテキストがその上に描画されて読みにくくなります（Plugins ページ自体は不透明な背景を描画しませんが、カードは自前の背景を保ちます）。スキンを一時的に切り替えるか無効にすると格段に読みやすくなります。

## 設定

設定はプロファイルの `cordis.patch.yml`（たとえば `$DSH_HOME/profiles/<profile>/cordis.patch.yml`）にある `dsh-startup-command` の `config` エントリに記述します。プラグイン自身が schema を宣言し、名前空間はこのバンドルの `cordis.patch.yml` が宣言するプロファイルエントリ id `dsh-startup-command` です。何も設定していない場合は schema の既定値が適用されます:

```yaml
- id: dsh-startup-command
  config:
    enabled: true
    shell: false
    command: '"C:\Program Files\Chromium\Application\chrome.exe" --user-data-dir="..." --app={url}'
```

対応するフィールド:

- `command` (string | string[]) — 単一のコマンドは文字列で、複数のコマンドは配列で記述し順番に実行します（前のコマンドが終了してから次を開始します）。各エントリは引用符を考慮して argv に分割されるため、空白を含むパスは二重引用符で囲んでください
- `enabled` (boolean, 既定 `true`) — `false` にすると一時的に無効化します
- `shell` (boolean, 既定 `false`) — `true` にするとシステムシェル経由で実行します

`command` は次のプレースホルダーに対応しており、いずれも実行前に置き換えられます:

- `{url}` — 実際の GUI アドレス（新しい dsh web では `?token=` 付きの認証 URL）
- `{home}` — 現在のユーザーフォルダー（`os.homedir()`）
- `{browser}` — 自動検出された Chromium 系ブラウザの実行ファイル。検出ルール: システム既定のブラウザが Chromium / Chrome / Edge であればそれを採用し、そうでなければ `Chromium > Chrome > Edge` の優先順位で最初に見つかったインストール済みブラウザを使います

ウェブ設定カードの **Add example command** ボタンは、例を説明するダイアログを開いた後、`{browser}`、`{home}`、`{url}` を使う既製のコマンドを追加します。検出結果は host 上の読み取り専用ルート `GET /dsh-startup-command/browser` から取得し、カードはマウント時にこれを 1 回取得します。Chromium / Chrome / Edge が見つからない場合は、理由とともに「サンプルコマンドを生成できません」というメッセージを表示します。

## 使用例

Chrome で、専用のプロファイルディレクトリとキャッシュディレクトリを使い、アプリウィンドウとして GUI を開きます。初回起動のウェルカム画面も拡張機能も読み込みません:

```yaml
- id: dsh-startup-command
  config:
    command: '"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\dsh-chrome-profile" --disk-cache-dir="D:\dsh-chrome-cache" --app={url} --no-first-run --disable-extensions'
```

各フラグの意味:

- `--app={url}` — アプリモードのウィンドウ（アドレスバー / ツールバーなし）
- `--no-first-run` — 初回起動のウェルカム画面をスキップします
- `--disable-extensions` — 拡張機能を一切読み込みません
- `--user-data-dir=<path>` — 設定（プロファイル）ディレクトリを指定します
- `--disk-cache-dir=<path>` — ディスクキャッシュディレクトリを指定します

注: 専用の `--user-data-dir` を指定すると、すでに起動している Chrome インスタンスとの衝突を避けられます（そうでない場合、`--app` は既存のインスタンスに引き取られ、各スイッチは効果を持ちません）。

Chromium / Chrome / Edge を自動検出して上記のフラグを付けます（ウェブカードの **Add example command** ボタンと等価）:

```yaml
- id: dsh-startup-command
  config:
    command: '"{browser}" --user-data-dir="{home}/.dsh/dsh-browser-data" --disk-cache-dir="{home}/.dsh/dsh-browser-cache" --app={url} --no-first-run --disable-extensions'
```

複数のコマンドは順番に実行します（前のコマンドが終了してから次を開始します）:

```yaml
- id: dsh-startup-command
  config:
    command:
      - 'cmd /c ping -n 3 127.0.0.1' # do some preparation first (exits after ~2s in this example)
      - '"C:\Program Files\Google\Chrome\Application\chrome.exe" --app={url}'
```

任意のプログラムを起動します（例: メモ帳）:

```yaml
- id: dsh-startup-command
  config:
    command: 'C:\Windows\System32\notepad.exe'
```

## 組み込みの「既定のブラウザを開く」との関係

`dsh web` は起動後に `open` パッケージを通じて**システム既定のブラウザ**を開きます（`web-runtime` 行の `openBrowser` フラグ）。本プラグインで特定のブラウザを開く場合、二重起動を避けるために組み込みの動作を無効化したくなるのが通常です。`cordis.patch.yml` でその行を上書きします（パッチは行の `config` 全体を置き換えるため、すべてのキーを再記述する必要があります）:

```yaml
- id: web-runtime
  config:
    openBrowser: false
    printUrl: true
    surfaceContext: true
    trustedHosts: !!js ctx.webStartup.trustedHosts
```

組み込みの動作を無効化したくない場合（たとえば既定のブラウザと独自のコマンドを共存させたい場合）は、このブロックを省略するだけです。

## 実行タイミング

```
dsh web boots
    │
    ▼
Loader tree settles (web server starts listening)
    │
    ▼
dsh-startup-command runs: {url} replacement → spawn(command)
    │
    ▼
child runs detached; dsh keeps serving
```

## アンインストール

プロファイルの `cordis.patch.yml` から `dsh-startup-command` の `insert` エントリ（および不要になった `web-runtime` の上書き）と、同じファイルにある `id: dsh-startup-command` の `config:` エントリを削除し、プラグインディレクトリを削除して `dsh web` を再起動します。この `config:` エントリが本プラグイン唯一の永続的な痕跡なので、削除すれば何も残りません。

## 注意事項（安全性と制限）

- **再起動が必要**: 実行中のプロセスは新しいパッチ行を読み込みません。設定を変更したら `dsh web` を再起動してください。
- **ESM のディレクトリインポート制限**: `name` はディレクトリではなく `index.js` を指す必要があります。そうでない場合 Node は `ERR_UNSUPPORTED_DIR_IMPORT` をスローします。
- **コマンドの解析**: 各コマンド文字列は二重引用符のグループ単位で argv に分割されます。引用符で囲まれていない空白を含むパスは正しく分割されません。
- **複数コマンドの直列実行**: コマンドは順番に実行され、前のコマンドが**終了してから**次を開始します。途中に長時間稼働するプロセス（ブラウザなど）があると、それ以降のコマンドは無期限に待機します。長時間稼働するコマンドは最後に置いてください。
- **未設定時はスキップ**: `command` が設定されていない場合は警告を出力し、何も実行しません。
- **シーケンス全体は待ちません**: 各コマンドは `detached` で起動されます。dsh が途中で終了した場合、まだ起動していないコマンドは実行されず、起動済みのデタッチドプロセスは動作し続けます。実行されたか確認するには、dsh の起動ログにある `dsh-startup-command:` 行を見てください。

## バージョン互換性

本プラグインが対象とする DSH のバージョンと実行環境:

| Item               | Version / notes                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Targeted DSH core  | minimum `0.2.0-rc.1` (`engines.dsh`; the `@deepseek-ai/dsh-settings` and `@deepseek-ai/dsh-host-webserver` peers are `>=0.2.0-rc.1 <0.3.0-0`); runtime-verified on `0.2.0-rc.2`                                                                                                        |
| Plugin version     | `1.1.1`                                                                                                                                                                                                                                                                                |
| Settings schema    | the plugin's own schemastery `Config` with the `.volatile()` fields `enabled`, `command` (string or string[]), `shell`; there is no `settings.register` / `settings.get`                                                                                                               |
| Settings namespace | the profile entry id `dsh-startup-command`, declared by this bundle's `cordis.patch.yml`; values persist in the profile's `cordis.patch.yml` (e.g. `$DSH_HOME/profiles/<profile>/cordis.patch.yml`), not in `$DSH_HOME/settings.yaml`                                                           |
| Settings card slot | `plugins.bundle.config`, keyed by the npm package name `@kagurazakayashi/dsh-startup-command`, provided by `@deepseek-ai/dsh-client-ui-plugin-manager`; the card reads and writes through `ctx.configForms.get("dsh-startup-command")` (`getSnapshot` / `subscribe` / `set` / `unset`) |
| Client inject deps | `@deepseek-ai/dsh-client-locale`, `@deepseek-ai/dsh-client-ui-plugin-manager`, `@deepseek-ai/dsh-client-ui-settings`                                                                                                                                                                   |
| Browser info route | read-only `GET /dsh-startup-command/browser` on the host; non-GET returns `405` `METHOD_NOT_ALLOWED`, and the card falls back to "not found" when the route is absent                                                                                                                  |

| Plugin version | Usable core versions      | Basis                                                                                                                                                                                                                                                           |
| -------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.1.1`        | `>= 0.2.0-rc.1 < 0.3.0-0` | Adds plugin display metadata: `locale/{en,zh}.json` supplies the localized plugin name and summary, and `icon.svg` supplies the Plugins-page artwork; behaviour and the settings mechanism are unchanged from `1.1.0`                                           |
| `1.1.0`        | `>= 0.2.0-rc.1 < 0.3.0-0` | Adapts the plugin to dsh 0.2.x: declarative `Config`, `configForms` (replacing the removed `settingsScope`), the `plugins.bundle.config` card on the plugin's own **Plugins** page, and the browser-info route instead of host-computed schema fields           |
| `1.0.1`        | `0.1.x` only              | Registers the schema with `settings.register` and reads it with `settings.get`; the `dsh-startup-command:` section of `$DSH_HOME/settings.yaml` is the storage; the card is registered into the `settings.plugin.item` slot through the `settingsScope` service |
| `1.0.0`        | `0.1.x` only              | Adds the ready-made example command dialog and the multi-command editing card; same 0.1.x settings API                                                                                                                                                          |
| `0.1.0`        | `0.1.x` only              | First release: the `dsh-startup-command` settings schema in `settings.yaml` and the web settings card                                                                                                                                                           |

バージョン範囲は重複していません。dsh 0.2.0 で 0.1.x の settings API が削除されたため、`1.1.0` は 0.2.x を必要とし、`1.0.1` 以前は 0.2.x では動作しません。

`1.0.1`（dsh 0.1.x）からの移行: dsh 0.2.0 は、その（すでに実行済みの一回限りの）インポートが走った時点でコンポジションに存在するプロファイルエントリ id についてのみ、古い `$DSH_HOME/settings.yaml` のセクションをインポートします。したがって `settings.yaml.imported` に `dsh-startup-command:` セクションが残っている場合は、上記 Configuration セクションの YAML スニペットを使って手動でプロファイルの `cordis.patch.yml` に移す必要があります。

## License

MIT — 詳細は [LICENSE](LICENSE) を参照。著作権は KagurazakaYashi(KagurazakaMiyabi) に帰属します。

## Languages

- [English (United States)](README.md)
- [简体中文（中国大陆）](README.zh-CN.md)
- [繁體中文（台灣）](README.zh-TW.md)
- 日本語
