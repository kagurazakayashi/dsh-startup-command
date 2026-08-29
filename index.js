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
 * @deepseek-ai/dsh-settings 註冊 schema，schema 預設值在未配置時生效）。
 * command 可寫單條字串，或寫成陣列表示多條命令；多條命令會依序執行，
 * 前一條退出後才啟動下一條：
 *
 *   startup-command:
 *     enabled: true
 *     command:
 *       - '"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\dsh-chrome-profile" --app={url}'
 *     shell: false
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
 * 設定命名空間的 schema：command 接受單條字串或字串陣列（多條命令），
 * 預設值為空陣列（什麼都不做）；因此 settings.yaml 完全未配置時插件
 * 仍能安全啟動（不執行任何命令，僅印出警告）。
 */
const SettingsSchema = z.object({
	enabled: z.boolean().default(true),
	command: z.union([z.string(), z.array(z.string())]).default([]),
	shell: z.boolean().default(false)
});

/**
 * 把使用者提供的命令列字串拆成 argv token（逐字元掃描，支援雙引號 /
 * 單引號分組）：引號只做分組與剝離，不會留在 token 內，因此
 * --user-data-dir="D:\dsh-chrome-profile" 會解析為單一 token
 * --user-data-dir=D:\dsh-chrome-profile；含空格的引號值（如可執行檔路徑）
 * 也能正確保留內部空格。
 * @param {string} input - 原始命令列字串。
 * @returns {string[]} 拆解後的 token 列表。
 */
function splitCommandLine(input) {
	const tokens = [];
	let current = "";
	let inDouble = false;
	let inSingle = false;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (inDouble) {
			if (ch === '"') inDouble = false;
			else current += ch;
		} else if (inSingle) {
			if (ch === "'") inSingle = false;
			else current += ch;
		} else if (ch === '"') {
			inDouble = true;
		} else if (ch === "'") {
			inSingle = true;
		} else if (/\s/.test(ch)) {
			if (current !== "") {
				tokens.push(current);
				current = "";
			}
		} else {
			current += ch;
		}
	}
	if (current !== "") tokens.push(current);
	return tokens;
}

/**
 * 把 command 設定值解析為 argv 序列（每條命令一個 argv 陣列），
 * 並以實際 URL 替換 {url} 佔位符。
 * @param {string | string[] | undefined} command - 設定中的 command 值。
 * @param {string} url - 本機 Web GUI 的實際 URL。
 * @returns {string[][] | null} 完全未設定（或皆為空白）時回傳 null。
 */
function resolveCommands(command, url) {
	const items = Array.isArray(command) ? command : [command];
	const commands = [];
	for (const item of items) {
		if (typeof item !== "string" || item.trim() === "") continue;
		const argv = splitCommandLine(item.replaceAll("{url}", url));
		if (argv.length > 0) commands.push(argv);
	}
	return commands.length > 0 ? commands : null;
}

/**
 * 啟動單條命令並等待其退出（detached：命令獨立於 dsh 程序，dsh 退出不受拖住）。
 * @param {string[]} argv - 已解析的命令參數（argv[0] 為可執行檔）。
 * @param {boolean} shell - 是否經系統 shell 執行。
 * @returns {Promise<void>} 命令退出（或啟動失敗）時 resolve。
 */
function runOne(argv, shell) {
	return new Promise((resolve) => {
		const child = spawn(argv[0], argv.slice(1), {
			detached: true,
			stdio: "ignore",
			shell,
			windowsHide: true
		});
		console.log(`startup-command: ${argv.join(" ")}`);
		// close（正常退出）與 error（啟動失敗）都結束等待；Promise 只 settle 一次。
		child.once("close", () => resolve());
		child.once("error", () => resolve());
	});
}

/**
 * 依序執行命令序列：前一條退出後才啟動下一條。
 * @param {string[][]} commands - argv 序列。
 * @param {boolean} shell - 是否經系統 shell 執行。
 */
async function runSequence(commands, shell) {
	for (const argv of commands) {
		await runOne(argv, shell);
	}
}

/**
 * 插件主體：註冊 settings 命名空間，並在啟動成功後依序執行使用者命令。
 * @param {object} ctx - cordis 插件上下文。
 */
export function apply(ctx) {
	// 註冊設定命名空間：settings.yaml 的 startup-command 頂層鍵由此 schema
	// 驗證與解析（schema 預設值 + 使用者層覆蓋）。
	ctx.inject(["settings"], (sctx) => {
		sctx.settings.register(SETTINGS_NS, SettingsSchema);
	});

	/** 在 Loader settle 且 webServer 就緒時執行使用者命令序列。 */
	const launch = () => {
		const server = /** @type {{port?: number} | undefined} */ (ctx.get("webServer"));
		if (server === undefined || server.port === undefined) return;
		const url = `http://127.0.0.1:${String(server.port)}`;
		const settings = /** @type {{enabled: boolean, command: string | string[], shell: boolean} | undefined} */ (ctx.get("settings")?.get(SETTINGS_NS));
		// Loader settle 後註冊必然已完成，此處理論上不會是 undefined。
		if (settings === undefined) return;
		if (settings.enabled === false) return;
		const commands = resolveCommands(settings.command, url);
		if (commands === null) {
			console.warn("startup-command: 未設定 command，略過");
			return;
		}
		runSequence(commands, settings.shell === true).catch(() => {});
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
