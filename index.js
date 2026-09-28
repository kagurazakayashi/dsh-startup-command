/**
 * dsh-startup-command — 在 dsh web 啟動成功（webServer 監聽啟動、Loader 樹穩定）後，
 * 依使用者設定執行自訂命令（例如開啟指定瀏覽器）。
 *
 * 這是掛在 web profile 的 host 插件：bundle 的 cordis.patch.yml 以套件名
 * （@kagurazakayashi/dsh-startup-command）與 id `dsh-startup-command` 插入本行，
 * Loader 由 profile 的 node_modules 解析並以 ESM 匯入。
 *
 * 觸發時機與內建 web-app 的 openBrowser 相同：等 Loader 樹全部 settle
 * 且 webServer 服務存在之後才執行，因此 URL 一定是「監聽啟動後」的
 * 實際位址（含 --port 0 由作業系統分配的情形）。
 *
 * 設定位置（dsh 0.2.0 起）：本外掛匯出的 Config 就是設定 schema，命名空間為
 * profile 入口 id `dsh-startup-command`，值持久化在 profile 的
 * cordis.patch.yml；設定頁卡片由 client.js 以 plugins.bundle.config 註冊。
 *
 *   - id: dsh-startup-command
 *     config:
 *       enabled: true
 *       command:
 *         - '"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="D:\dsh-chrome-profile" --app={url}'
 *       shell: false
 *
 * command 可寫單條字串，或寫成陣列表示多條命令；多條命令會依序執行，
 * 前一條退出後才啟動下一條。{url} 佔位符會在執行前替換為實際 GUI 位址。
 * 新版 dsh web（0.1.2-rc.1 起）對根路徑做瀏覽器認證：乾淨 URL
 * （http://127.0.0.1:<port>）會得到 401，必須攜帶 ?token= 才能交換成登入
 * session cookie。本插件優先透過 ctx.connection.authenticatedUrl() 取得帶
 * token 的 URL，舊版或無 connection 服務時才退回乾淨 URL。
 *
 * 另外支援兩個佔位符，方便產生跨主機可攜的命令範本：
 *   {home}    目前使用者的家目錄（os.homedir()，例如 C:\Users\you 或 /home/you）
 *   {browser} 自動偵測到的 Chromium 家族瀏覽器執行檔路徑；偵測優先序為
 *             Chromium > Chrome > Edge，但若系統預設瀏覽器正是其中一個，
 *             則改用預設瀏覽器（詳見 detectBrowserCommand()）。
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import z from "@deepseek-ai/schemastery";

/** 穩定插件名稱（顯示於 Loader 日誌與外掛清單）。 */
export const name = "dsh-startup-command";

/** 宣告 webServer 為硬依賴，確保觸發時服務已就緒。 */
export const inject = ["webServer"];

/** 唯讀的瀏覽器探測結果路由：設定卡片據此顯示 {browser} 是否可用。 */
const BROWSER_INFO_ROUTE = "/dsh-startup-command/browser";

/**
 * 本外掛的設定 schema。
 *
 * dsh 0.2.0 起不再有 settings.register / settings.get：schema 由外掛自己
 * 匯出的 Config 宣告，設定命名空間就是 profile 入口 id（本 bundle 的
 * cordis.patch.yml 宣告為 `dsh-startup-command`），有效值由「schema 預設 →
 * 組合層（bundle／profile patch 的 config）→ 使用者層」合成。
 *
 * 只有標記 .volatile() 的欄位會出現在設定界面且可寫；volatile 欄位在執行期
 * 是穩定參考（以 .get() 取值），Loader 熱更新時就地替換而不重掛外掛。
 *
 * command 接受單條字串或字串陣列（多條命令），預設為空陣列（什麼都不做）；
 * 因此完全未配置時插件仍能安全啟動（不執行任何命令，僅印出警告）。
 */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  command: z.union([z.string(), z.array(z.string())]).default([]).volatile(),
  shell: z.boolean().default(false).volatile()
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
 * 執行同步命令並回傳去除首尾空白的 stdout；找不到命令或執行失敗時回傳 null。
 * 只用於主機層查詢（登錄、plutil、xdg-settings、which），不應影響啟動流程。
 * @param {string} cmd - 可執行檔。
 * @param {string[]} args - 參數列表。
 * @returns {string | null} stdout 字串或 null。
 */
function tryExec(cmd, args) {
	try {
		return execFileSync(cmd, args, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			windowsHide: true
		}).trim();
	} catch {
		return null;
	}
}

/**
 * 從一段查詢結果文字（reg / plist bundle id / xdg-settings 輸出）判斷
 * 是否對應到 Chromium / Chrome / Edge。
 * @param {string} text - 查詢結果原文。
 * @returns {"chromium" | "chrome" | "edge" | null}
 */
function browserIdFromText(text) {
	const lower = String(text).toLowerCase();
	if (lower.includes("chromium")) return "chromium";
	if (lower.includes("msedge") || lower.includes("edge")) return "edge";
	if (lower.includes("chrome")) return "chrome";
	return null;
}

/**
 * 建立「id → 可執行檔路徑」的候選清單，順序即為優先序（Chromium > Chrome > Edge）。
 * 候選路徑不保證存在，之後由 detectBrowserCommand() 以 existsSync 篩選。
 * @returns {{id: "chromium" | "chrome" | "edge", path: string}[]}
 */
function browserCandidates() {
	const platform = process.platform;
	if (platform === "win32") {
		const local = process.env.LOCALAPPDATA ?? null;
		const pf = process.env.PROGRAMFILES ?? null;
		const pf86 = process.env["PROGRAMFILES(X86)"] ?? null;
		const out = [];
		const add = (id, base, ...rest) => {
			if (base == null || base === "") return;
			out.push({ id, path: path.join(base, ...rest) });
		};
		add("chromium", local, "Chromium", "Application", "chrome.exe");
		add("chromium", pf, "Chromium", "Application", "chrome.exe");
		add("chromium", pf86, "Chromium", "Application", "chrome.exe");
		add("chrome", pf, "Google", "Chrome", "Application", "chrome.exe");
		add("chrome", pf86, "Google", "Chrome", "Application", "chrome.exe");
		add("chrome", local, "Google", "Chrome", "Application", "chrome.exe");
		add("edge", pf86, "Microsoft", "Edge", "Application", "msedge.exe");
		add("edge", pf, "Microsoft", "Edge", "Application", "msedge.exe");
		add("edge", local, "Microsoft", "Edge", "Application", "msedge.exe");
		return out;
	}
	if (platform === "darwin") {
		const home = os.homedir();
		return [
			{ id: "chromium", path: "/Applications/Chromium.app/Contents/MacOS/Chromium" },
			{ id: "chromium", path: path.join(home, "Applications", "Chromium.app", "Contents", "MacOS", "Chromium") },
			{ id: "chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
			{ id: "chrome", path: path.join(home, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome") },
			{ id: "edge", path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" },
			{ id: "edge", path: path.join(home, "Applications", "Microsoft Edge.app", "Contents", "MacOS", "Microsoft Edge") }
		];
	}
	if (platform === "linux") {
		const groups = [
			{
				id: "chromium",
				known: ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/lib/chromium/chromium"],
				names: ["chromium", "chromium-browser"]
			},
			{
				id: "chrome",
				known: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome"],
				names: ["google-chrome", "google-chrome-stable"]
			},
			{
				id: "edge",
				known: ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable", "/opt/microsoft/msedge/msedge"],
				names: ["microsoft-edge", "microsoft-edge-stable", "msedge"]
			}
		];
		const out = [];
		const seen = new Set();
		const push = (id, p) => {
			if (p == null || p === "" || seen.has(p)) return;
			seen.add(p);
			out.push({ id, path: p });
		};
		for (const group of groups) {
			for (const p of group.known) push(group.id, p);
			for (const name of group.names) push(group.id, tryExec("which", [name]));
		}
		return out;
	}
	return [];
}

/** 在 Windows 上查詢系統預設瀏覽器（登錄），回傳對應的瀏覽器 id 或 null。 */
function detectDefaultBrowserWindows() {
	const queries = [
		["query", "HKCU\\Software\\Clients\\StartMenuInternet", "/ve"],
		["query", "HKLM\\Software\\Clients\\StartMenuInternet", "/ve"],
		["query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice", "/v", "ProgId"],
		["query", "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice", "/v", "ProgId"]
	];
	for (const args of queries) {
		const out = tryExec("reg", args);
		if (out === null) continue;
		const id = browserIdFromText(out);
		if (id !== null) return id;
	}
	return null;
}

/** 在 macOS 上查詢系統預設瀏覽器（LaunchServices），回傳對應的瀏覽器 id 或 null。 */
function detectDefaultBrowserMac() {
	const home = os.homedir();
	const plists = [
		path.join(home, "Library", "Preferences", "com.apple.LaunchServices", "com.apple.launchservices.secure.plist"),
		path.join(home, "Library", "Preferences", "com.apple.LaunchServices.plist")
	];
	for (const p of plists) {
		if (!fs.existsSync(p)) continue;
		const jsonText = tryExec("plutil", ["-convert", "json", "-o", "-", p]);
		if (jsonText === null) continue;
		let data;
		try {
			data = JSON.parse(jsonText);
		} catch {
			continue;
		}
		const handlers = data?.LSHandlers;
		if (!Array.isArray(handlers)) continue;
		for (const handler of handlers) {
			if (handler == null || typeof handler !== "object") continue;
			const scheme = handler.LSHandlerURLScheme;
			if (scheme !== "https" && scheme !== "http") continue;
			const role = handler.LSHandlerRoleAll ?? handler.LSHandlerRoleViewer ?? "";
			const id = browserIdFromText(String(role));
			if (id !== null) return id;
		}
	}
	return null;
}

/** 在 Linux 上查詢系統預設瀏覽器（xdg-settings），回傳對應的瀏覽器 id 或 null。 */
function detectDefaultBrowserLinux() {
	const out = tryExec("xdg-settings", ["get", "default-web-browser"]);
	return out === null ? null : browserIdFromText(out);
}

/**
 * 查詢目前系統預設瀏覽器是否為 Chromium / Chrome / Edge 其中之一。
 * @returns {"chromium" | "chrome" | "edge" | null}
 */
function detectDefaultBrowser() {
	const platform = process.platform;
	if (platform === "win32") return detectDefaultBrowserWindows();
	if (platform === "darwin") return detectDefaultBrowserMac();
	if (platform === "linux") return detectDefaultBrowserLinux();
	return null;
}

/**
 * 自動尋找 Chromium 家族瀏覽器，回傳結構化結果（含是否找到、瀏覽器 id、
 * 執行檔路徑與失敗原因代碼）。
 * 規則：系統預設瀏覽器若是 Chromium / Chrome / Edge，則採用預設瀏覽器；
 * 否則依 Chromium > Chrome > Edge 的優先序回傳第一個已安裝者。
 * @returns {{found: boolean, id: "chromium" | "chrome" | "edge" | "", path: string, reason: "ok" | "not-found" | "unsupported-platform"}}
 */
function detectBrowserInfo() {
	const platform = process.platform;
	if (platform !== "win32" && platform !== "darwin" && platform !== "linux") {
		return { found: false, id: "", path: "", reason: "unsupported-platform" };
	}
	const candidates = browserCandidates();
	const defaultId = detectDefaultBrowser();
	if (defaultId !== null) {
		for (const candidate of candidates) {
			if (candidate.id === defaultId && fs.existsSync(candidate.path)) {
				return { found: true, id: candidate.id, path: candidate.path, reason: "ok" };
			}
		}
	}
	for (const candidate of candidates) {
		if (fs.existsSync(candidate.path)) {
			return { found: true, id: candidate.id, path: candidate.path, reason: "ok" };
		}
	}
	return { found: false, id: "", path: "", reason: "not-found" };
}

/**
 * 自動尋找 Chromium 家族瀏覽器執行檔路徑（供 {browser} 佔位符使用）。
 * @returns {string | null} 可執行檔路徑；完全找不到時回傳 null。
 */
function detectBrowserCommand() {
	const info = detectBrowserInfo();
	return info.found ? info.path : null;
}

/**
 * 把 command 設定值解析為 argv 序列（每條命令一個 argv 陣列），
 * 並替換 {url} / {home} / {browser} 佔位符。
 * @param {string | string[] | undefined} command - 設定中的 command 值。
 * @param {string} url - 本機 Web GUI 的實際 URL。
 * @returns {string[][] | null} 完全未設定（或皆為空白）時回傳 null。
 */
function resolveCommands(command, url) {
	const items = Array.isArray(command) ? command : [command];
	const home = os.homedir();
	let browser = null;
	let browserResolved = false;
	const commands = [];
	for (const item of items) {
		if (typeof item !== "string" || item.trim() === "") continue;
		if (item.includes("{browser}")) {
			if (!browserResolved) {
				browser = detectBrowserCommand();
				browserResolved = true;
			}
			if (browser === null) {
				console.warn("dsh-startup-command: 找不到 Chromium/Chrome/Edge 瀏覽器，略過含 {browser} 的命令");
				continue;
			}
		}
		const expanded = item
			.replaceAll("{browser}", browser ?? "")
			.replaceAll("{home}", home)
			.replaceAll("{url}", url);
		const argv = splitCommandLine(expanded);
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
		console.log(`dsh-startup-command: ${argv.join(" ")}`);
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
 * 處理 GET /dsh-startup-command/browser：回報瀏覽器探測結果。
 *
 * 設定卡片需要知道 {browser} 佔位符是否解析得到；dsh 0.2.0 的設定 schema
 * 只能宣告靜態預設值，主機端無法把執行期計算值注入 schema，因此改由這個
 * 唯讀路由提供。回應不洩漏任何使用者資料，只有探測結果。
 *
 * @param {object} req Node.js 的 HTTP 請求物件。
 * @param {object} res Node.js 的 HTTP 回應物件。
 * @returns {void}
 */
function handleBrowserInfo(req, res) {
	if (req.method !== "GET") {
		const body = JSON.stringify({ ok: false, code: "METHOD_NOT_ALLOWED" });
		res.writeHead(405, {
			"content-type": "application/json; charset=utf-8",
			"content-length": Buffer.byteLength(body),
			allow: "GET"
		});
		res.end(body);
		return;
	}
	const info = detectBrowserInfo();
	const body = JSON.stringify({
		ok: true,
		found: info.found,
		id: info.id,
		path: info.path,
		reason: info.reason
	});
	res.writeHead(200, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(body)
	});
	res.end(body);
}

/**
 * 從 Config 的 volatile 參考讀取目前設定值。
 *
 * volatile 欄位在執行期是穩定參考（以 .get() 取值），Loader 就地熱更新時
 * 值會被替換，因此每次讀取都取得最新值。缺少 Config（不經 Loader 直接掛載）
 * 時退回 schema 預設值。
 *
 * @param {object} raw 由本外掛 Config 驗證後的設定物件。
 * @param {string} field 欄位名稱。
 * @param {unknown} fallback 取不到值時的回退值。
 * @returns {unknown} 目前的欄位值。
 */
function readConfigField(raw, field, fallback) {
	const ref = raw !== null && typeof raw === "object" ? raw[field] : undefined;
	if (ref === null || ref === undefined) return fallback;
	const value = typeof ref === "object" && typeof ref.get === "function" ? ref.get() : ref;
	return value === undefined ? fallback : value;
}

/**
 * 插件主體：註冊瀏覽器探測路由與設定頁政策，並在啟動成功後依序執行使用者命令。
 * @param {object} ctx - cordis 插件上下文。
 * @param {object} config - 由本外掛 Config 驗證後的設定（volatile 欄位為穩定參考）。
 */
export function apply(ctx, config) {
	// 瀏覽器探測結果的唯讀路由（設定卡片據此顯示 {browser} 是否可用）。
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: BROWSER_INFO_ROUTE,
		handler: handleBrowserInfo
	}), "dsh-startup-command: browser info route");

	// 設定頁政策：本外掛自帶設定卡片（client.js 註冊 plugins.bundle.config），
	// 因此宣告不從 schema 自動生成頁面。0.2.0 的這個政策只是一個描述位，
	// 不會移除配置的讀寫能力。
	ctx.inject(["settings"], (settingsCtx) => {
		try {
			settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber), "dsh-startup-command: settings presentation");
		} catch (error) {
			// 政策註冊失敗只影響設定頁的自動生成提示，不影響啟動命令。
			console.warn("dsh-startup-command: failed to register the settings presentation:", error);
		}
	});

	/** 在 Loader settle 且 webServer 就緒時執行使用者命令序列。 */
	const launch = () => {
		const server = /** @type {{port?: number} | undefined} */ (ctx.get("webServer"));
		if (server === undefined || server.port === undefined) return;
		const cleanUrl = `http://127.0.0.1:${String(server.port)}`;
		// 新版 dsh web 對根路徑做瀏覽器認證（token → 簽名 cookie），乾淨 URL 會
		// 拿到 401。內建 web-app 的 openBrowser 正是呼叫
		// ctx.connection.authenticatedUrl(cleanUrl) 來產生帶 ?token= 的 URL；此處
		// 如法炮製，並在無 connection 服務（舊版 / 非 web profile）時退回乾淨 URL。
		const connection = /** @type {{authenticatedUrl?: (baseUrl: string) => string} | undefined} */ (ctx.get("connection"));
		const url = connection !== undefined && typeof connection.authenticatedUrl === "function"
			? connection.authenticatedUrl(cleanUrl)
			: cleanUrl;
		// 設定由本外掛的 Config 提供（命名空間即 profile 入口 id）。
		if (readConfigField(config, "enabled", true) === false) return;
		const command = /** @type {string | string[]} */ (readConfigField(config, "command", []));
		const commands = resolveCommands(command, url);
		if (commands === null) {
			console.warn("dsh-startup-command: 未設定 command，略過");
			return;
		}
		runSequence(commands, readConfigField(config, "shell", false) === true).catch(() => {});
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
