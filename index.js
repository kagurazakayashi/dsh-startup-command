/**
 * dsh-startup-command — 在 dsh web 啟動成功後執行使用者自訂命令的本地插件。
 *
 * 掛在 web profile 使用者層：cordis.patch.yml 以相對路徑 name
 * （./plugins/dsh-startup-command/index.js）引用本目錄，Loader 依
 * baseUrl（profile 目錄）解析並以 ESM 匯入。
 *
 * 設定位置：settings.yaml 的 dsh-startup-command 命名空間（本插件透過
 * @deepseek-ai/dsh-settings 註冊 schema，schema 預設值在未配置時生效）。
 */
import z from "@deepseek-ai/schemastery";

/** 穩定插件名稱（顯示於 Loader 日誌與外掛清單）。 */
export const name = "dsh-startup-command";

/** 宣告 webServer 為硬依賴，確保觸發時服務已就緒。 */
export const inject = ["webServer"];

/** settings.yaml 中的設定命名空間（kebab-case，與插件名一致）。 */
const SETTINGS_NS = "dsh-startup-command";

/**
 * 設定命名空間的 schema：command 接受單條字串或字串陣列（多條命令），
 * 預設值為空陣列（什麼都不做）；因此 settings.yaml 完全未配置時插件
 * 仍能安全啟動。
 */
const SettingsSchema = z.object({
	enabled: z.boolean().default(true),
	command: z.union([z.string(), z.array(z.string())]).default([]),
	shell: z.boolean().default(false)
});

/**
 * 把使用者提供的命令列字串拆成 argv token（逐字元掃描，支援雙引號 /
 * 單引號分組）：引號只做分組與剝離，不會留在 token 內。
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
 * 插件主體：目前僅註冊 settings 命名空間，命令執行邏輯留待後續補上。
 * @param {object} ctx - cordis 插件上下文。
 */
export function apply(ctx) {
	ctx.inject(["settings"], (sctx) => {
		sctx.settings.register(SETTINGS_NS, SettingsSchema);
	});
}
