/**
 * startup-command — 在 dsh web 啟動成功（webServer 監聽啟動、Loader 樹穩定）後，
 * 依使用者在 settings.yaml 設定的自訂命令執行指定動作（例如開啟指定瀏覽器）。
 *
 * 這是掛在 web profile 使用者層的本地 host 插件：cordis.patch.yml 以
 * 相對路徑 name（./plugins/startup-command/index.js）引用本目錄，Loader 依
 * baseUrl（profile 目錄）解析並以 ESM 匯入。
 *
 * 觸發時機與內建 web-app 的 openBrowser 相同：等 Loader 樹全部 settle
 * 且 webServer 服務存在之後才執行，因此 URL 一定是「監聽啟動後」的
 * 實際位址（含 --port 0 由作業系統分配的情形）。
 *
 * 設定位置：settings.yaml 的 startup-command 命名空間（本插件透過
 * @deepseek-ai/dsh-settings 註冊 schema，schema 預設值在未配置時生效）：
 *
 *   startup-command:
 *     enabled: true
 *     command: '"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\dsh-chrome-profile" --app={url}'
 *     shell: false
 *     # argv:            （陣列形式，優先於 command）
 *     #   - C:\Program Files\Google\Chrome\Application\chrome.exe
 *     #   - --user-data-dir=D:\dsh-chrome-profile
 *     #   - --app={url}
 *
 * {url} 佔位符會在執行前替換為實際 GUI 位址（http://127.0.0.1:<port>）。
 */
import { spawn } from "node:child_process";
import z from "@deepseek-ai/schemastery";

/** 穩定插件名稱（顯示於 Loader 日誌與外掛清單）。 */
export const name = "startup-command";

/** 宣告 webServer 為硬依賴，確保觸發時服務已就緒。 */
export const inject = ["webServer"];

/** settings.yaml 中的設定命名空間（kebab-case，與插件名一致）。 */
const SETTINGS_NS = "startup-command";

/**
 * 設定命名空間的 schema：所有欄位皆有預設值，因此 settings.yaml 完全
 * 未配置時插件仍能安全啟動（不執行任何命令，僅印出警告）。
 */
const SettingsSchema = z.object({
	enabled: z.boolean().default(true),
	command: z.string().default(""),
	argv: z.array(z.string()).default([]),
	shell: z.boolean().default(false)
});

/**
 * 把使用者提供的命令列字串拆成 argv token（支援雙引號 / 單引號分組，
 * 路徑含空格時必須用引號包住）。
 * @param {string} input - 原始命令列字串。
 * @returns {string[]} 拆解後的 token 列表。
 */
function splitCommandLine(input) {
	const tokens = [];
	const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
	let match = null;
	while ((match = pattern.exec(input)) !== null) {
		tokens.push(match[1] ?? match[2] ?? match[3]);
	}
	return tokens;
}

/**
 * 從設定值解析出要執行的 argv，並以實際 URL 替換 {url} 佔位符。
 * @param {{command?: string, argv?: string[]}} settings - 設定命名空間的解析值。
 * @param {string} url - 本機 Web GUI 的實際 URL。
 * @returns {string[] | null} 兩者皆未設定時回傳 null（呼叫端跳過）。
 */
function resolveArgv(settings, url) {
	let argv = [];
	if (Array.isArray(settings.argv) && settings.argv.length > 0) {
		argv = settings.argv.map((item) => item.replaceAll("{url}", url));
	} else if (typeof settings.command === "string" && settings.command.trim() !== "") {
		argv = splitCommandLine(settings.command.replaceAll("{url}", url));
	} else {
		return null;
	}
	return argv.length > 0 ? argv : null;
}

/**
 * 插件主體：註冊 settings 命名空間，並在啟動成功後執行使用者指定的命令。
 * @param {object} ctx - cordis 插件上下文。
 */
export function apply(ctx) {
	// 註冊設定命名空間：settings.yaml 的 startup-command 頂層鍵由此 schema
	// 驗證與解析（schema 預設值 + 使用者層覆蓋）。
	ctx.inject(["settings"], (sctx) => {
		sctx.settings.register(SETTINGS_NS, SettingsSchema);
	});

	/** 在 Loader settle 且 webServer 就緒時執行使用者命令。 */
	const launch = () => {
		const server = /** @type {{port?: number} | undefined} */ (ctx.get("webServer"));
		if (server === undefined || server.port === undefined) return;
		const url = `http://127.0.0.1:${String(server.port)}`;
		const settings = /** @type {{enabled: boolean, command: string, argv: string[], shell: boolean} | undefined} */ (ctx.get("settings")?.get(SETTINGS_NS));
		// Loader settle 後註冊必然已完成，此處理論上不會是 undefined。
		if (settings === undefined) return;
		if (settings.enabled === false) return;
		const argv = resolveArgv(settings, url);
		if (argv === null) {
			console.warn("startup-command: 未設定 command 或 argv，略過");
			return;
		}
		const child = spawn(argv[0], argv.slice(1), {
			detached: true,
			stdio: "ignore",
			shell: settings.shell === true,
			windowsHide: true
		});
		// 不等待子程序：命令獨立於 dsh 程序執行，dsh 退出時不會拖住。
		child.unref();
		console.log(`startup-command: ${argv[0]} ${argv.slice(1).join(" ")} (${url})`);
	};

	// 與內建 web-app 相同的生命週期鉤子：等整棵 Loader 樹穩定後再取 port。
	const settled = /** @type {{await(): Promise<unknown>} | undefined} */ (ctx.get("loader"))?.await();
	if (settled === undefined) {
		launch();
		return;
	}
	settled.then(() => {
		if (ctx.get("webServer") !== undefined) launch();
	}, () => {});
}
