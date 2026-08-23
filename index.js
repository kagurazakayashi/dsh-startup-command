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
 * 插件主體：目前僅註冊 settings 命名空間，命令執行邏輯留待後續補上。
 * @param {object} ctx - cordis 插件上下文。
 */
export function apply(ctx) {
	ctx.inject(["settings"], (sctx) => {
		sctx.settings.register(SETTINGS_NS, SettingsSchema);
	});
}
