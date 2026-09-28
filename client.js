window.__ModuleLoader__.load({
	id: "@kagurazakayashi/dsh-startup-command",
	factory: (require) => {
		"use strict";

		// =====================================================================
		// dsh-startup-command（瀏覽器端）
		//
		// 在「外掛」頁的該外掛頁面（plugins.bundle.config 席位，以 npm 包名為鍵）
		// 註冊一張可展開卡片，就地編輯本外掛的設定（enabled / shell / command）。
		// command 以多列清單編輯：可新增 / 刪除命令、上下移調整執行順序，
		// 並提供「添加示例命令」按鈕插入使用 {browser}/{home}/{url} 的現成命令；
		// 儲存時單條寫字串、多條寫陣列（與 host 端 Config 的兩種形式相容）。
		//
		// dsh 0.2.0 的機制（舊版的 settingsScope 服務與 settings.plugin.item
		// 席位都已移除）：
		//   1. 本 bundle 只 require("react")（平台 seed 字），slots / locale /
		//      configForms 三個服務透過 cordis 的 inject 宣告取得，不跨外掛
		//      做值匯入（遵守 bundle 純淨度門禁）。
		//   2. apply(ctx) 等 configForms 服務服務本外掛的設定命名空間
		//      （＝profile 入口 id：dsh-startup-command）後，以
		//      ctx.configForms.get(NS) 取得設定表單並注入卡片元件。
		//   3. 卡片以 React.useSyncExternalStore 讀取表單快照，暫存使用者的
		//      草稿，按下「儲存」才把草稿寫回 host（revision 設柵由表單負責）。
		//   4. 瀏覽器探測結果（{browser} 是否可用）改由 host 的唯讀路由
		//      /dsh-startup-command/browser 提供，卡片掛載時讀取。
		// =====================================================================

		var React = require("react");

		/** 穩定外掛名稱（字典命名空間與設定命名空間同名）。 */
		var NS = "dsh-startup-command";

		/** 本外掛的 npm 包名：plugins.bundle.config 以它為鍵。 */
		var PACKAGE = "@kagurazakayashi/dsh-startup-command";

		/** host 端唯讀的瀏覽器探測結果路由。 */
		var BROWSER_INFO_ROUTE = "/dsh-startup-command/browser";

		/** 本外掛需要的瀏覽器服務（slots：註冊卡片；locale：多語；configForms：設定表單）。 */
		var inject = ["slots", "locale", "configForms"];

		// ---------- 多語文案 ----------
		var zh = {
			title: "启动命令",
			description: "dsh web 启动成功后要执行的自定义命令。",
			enabledLabel: "启用",
			enabledHint: "关闭后，dsh web 启动成功时不会执行任何命令。",
			shellLabel: "经系统 shell 执行",
			shellHint: "开启后，命令会交给系统 shell 执行（默认关闭，直接以参数数组启动，路径含空格更安全）。",
			commandLabel: "命令",
			commandHint: "每条命令按顺序依次执行（前一条退出后才执行下一条）。{url} 会在执行前替换为实际 GUI 地址；{browser} 会自动查找 Chromium/Chrome/Edge 浏览器（优先 Chromium > Chrome > Edge，若默认浏览器是其中之一则采用默认浏览器）；{home} 会替换为用户文件夹；空白行保存时会自动移除。",
			commandAdd: "添加命令",
			commandAddExample: "添加示例命令",
			exampleDialogTitle: "示例命令说明",
			exampleDialogIntro: "下面这条命令会在启动时由 dsh 解析并执行；确认后追加到命令列表末尾，再点击「保存」生效。",
			exampleDialogPlaceholdersTitle: "占位符",
			exampleDialogFlagsTitle: "参数说明",
			exampleBrowserCode: "{browser}",
			exampleBrowserText: "自动查找 Chromium/Chrome/Edge：优先 Chromium > Chrome > Edge；若默认浏览器是其中之一，则改用默认浏览器。",
			exampleHomeCode: "{home}",
			exampleHomeText: "替换为用户文件夹（例如 C:\\Users\\you 或 /home/you）。",
			exampleUrlCode: "{url}",
			exampleUrlText: "替换为实际 GUI 地址（新版为带 ?token= 的认证地址）。",
			exampleUserDataDirCode: "--user-data-dir=\"…\"",
			exampleUserDataDirText: "浏览器配置目录：用户文件夹/.dsh/dsh-browser-data。",
			exampleDiskCacheDirCode: "--disk-cache-dir=\"…\"",
			exampleDiskCacheDirText: "磁盘缓存目录：用户文件夹/.dsh/dsh-browser-cache。",
			exampleAppCode: "--app={url}",
			exampleAppText: "以应用模式窗口打开（无地址栏/工具栏）。",
			exampleNoFirstRunCode: "--no-first-run",
			exampleNoFirstRunText: "不显示首次运行欢迎画面。",
			exampleDisableExtensionsCode: "--disable-extensions",
			exampleDisableExtensionsText: "不加载任何扩展。",
			exampleDialogCancel: "取消",
			exampleDialogAdd: "添加",
			exampleUnavailableTitle: "无法生成示例命令",
			exampleUnavailableIntro: "未能自动找到 Chromium/Chrome/Edge 浏览器，因此无法生成示例命令。",
			exampleReasonNotFound: "原因：在常见安装位置均未找到 Chromium、Chrome 或 Edge，且系统默认浏览器也不是这三者之一。",
			exampleReasonUnsupportedPlatform: "原因：当前系统不是 Windows、macOS 或 Linux，无法自动查找浏览器。",
			exampleClose: "关闭",
			commandRemove: "删除",
			commandMoveUp: "上移",
			commandMoveDown: "下移",
			commandPlaceholder: "输入命令…",
						overridden: "已覆盖",
			reset: "恢复默认",
			inherit: "继承",
			on: "开",
			off: "关",
			save: "保存",
			saving: "保存中…",
			discard: "放弃修改",
			unsaved: "未保存",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			readOnly: "本部署的设置为只读。",
			expand: "展开设置",
			collapse: "收起设置",
			notExposed: "本部署没有开放该插件的设置。"
		};

		var en = {
			title: "Startup command",
			description: "Commands to run after dsh web finishes booting.",
			enabledLabel: "Enabled",
			enabledHint: "When off, no command runs after dsh web boots.",
			shellLabel: "Run through system shell",
			shellHint: "When on, the command runs through the system shell (off by default; plain argv spawning is safer for paths with spaces).",
			commandLabel: "Command",
			commandHint: "Commands run in order (the next one starts only after the previous one exits). {url} is replaced with the actual GUI address; {browser} auto-detects Chromium/Chrome/Edge (priority Chromium > Chrome > Edge, or the default browser when it is one of them); {home} is replaced with the user folder; blank rows are dropped on save.",
			commandAdd: "Add command",
			commandAddExample: "Add example command",
			exampleDialogTitle: "Example command",
			exampleDialogIntro: "This command is resolved and run by dsh at startup; confirm to append it to the command list, then click Save to apply.",
			exampleDialogPlaceholdersTitle: "Placeholders",
			exampleDialogFlagsTitle: "Flags",
			exampleBrowserCode: "{browser}",
			exampleBrowserText: "Auto-detects Chromium/Chrome/Edge: priority Chromium > Chrome > Edge, or the default browser when it is one of them.",
			exampleHomeCode: "{home}",
			exampleHomeText: "Replaced with the user folder (e.g. C:\\Users\\you or /home/you).",
			exampleUrlCode: "{url}",
			exampleUrlText: "Replaced with the actual GUI address (the ?token= authenticated URL on newer dsh web).",
			exampleUserDataDirCode: "--user-data-dir=\"…\"",
			exampleUserDataDirText: "Browser profile directory: user folder/.dsh/dsh-browser-data.",
			exampleDiskCacheDirCode: "--disk-cache-dir=\"…\"",
			exampleDiskCacheDirText: "Disk cache directory: user folder/.dsh/dsh-browser-cache.",
			exampleAppCode: "--app={url}",
			exampleAppText: "Opens an app-mode window (no address bar / toolbar).",
			exampleNoFirstRunCode: "--no-first-run",
			exampleNoFirstRunText: "Skips the first-run welcome screen.",
			exampleDisableExtensionsCode: "--disable-extensions",
			exampleDisableExtensionsText: "Loads no extensions.",
			exampleDialogCancel: "Cancel",
			exampleDialogAdd: "Add",
			exampleUnavailableTitle: "Cannot generate example command",
			exampleUnavailableIntro: "No Chromium/Chrome/Edge browser was found, so the example command cannot be generated.",
			exampleReasonNotFound: "Reason: none of Chromium, Chrome, or Edge was found in the common install locations, and the system default browser is not one of them.",
			exampleReasonUnsupportedPlatform: "Reason: the current OS is not Windows, macOS, or Linux, so browser auto-detection is unavailable.",
			exampleClose: "Close",
			commandRemove: "Remove",
			commandMoveUp: "Move up",
			commandMoveDown: "Move down",
			commandPlaceholder: "Enter a command…",
						overridden: "Overridden",
			reset: "Reset to default",
			inherit: "Inherit",
			on: "On",
			off: "Off",
			save: "Save",
			saving: "Saving…",
			discard: "Discard",
			unsaved: "Unsaved",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			readOnly: "This deployment stores settings read-only.",
			expand: "Show settings",
			collapse: "Hide settings",
			notExposed: "This deployment does not expose this plugin's settings."
		};

		// ---------- 欄位規格 ----------
		// format：把 host 解析值轉成草稿文字；parse：把草稿文字轉成寫入（clear 或 set）。
		// boolean 欄位以 ""（繼承）/ "true" / "false" 三態編輯。
		function booleanSpec(field) {
			return {
				field: field,
				format: function (value) {
					return typeof value === "boolean" ? String(value) : "";
				},
				parse: function (text) {
					var trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					if (trimmed === "true") return { kind: "set", value: true };
					if (trimmed === "false") return { kind: "set", value: false };
					return undefined;
				}
			};
		}

		/** 把 command 的解析值（string | string[] | undefined）正規化成逐列編輯用的字串陣列。 */
		function commandItems(value) {
			if (Array.isArray(value)) return value.slice();
			if (typeof value === "string") return [value];
			return [];
		}

		/** 逐列去除首尾空白並丟棄空白列（空白列不構成命令）。 */
		function commandTrimmed(items) {
			var out = [];
			for (var i = 0; i < items.length; i++) {
				var trimmed = items[i].trim();
				if (trimmed !== "") out.push(trimmed);
			}
			return out;
		}

		/** 粗略判斷目前作業系統（僅用於決定範例命令的路徑分隔字元）。 */
		function detectPlatform() {
			var ua = "";
			var platform = "";
			if (typeof navigator !== "undefined") {
				ua = (navigator.userAgent || "").toLowerCase();
				platform = (navigator.platform || "").toLowerCase();
				if (navigator.userAgentData && typeof navigator.userAgentData.platform === "string") {
					platform = navigator.userAgentData.platform.toLowerCase();
				}
			}
			if (/windows|win32|win64/.test(platform) || /windows/.test(ua)) return "win32";
			if (/mac|darwin/.test(platform) || /macintosh/.test(ua)) return "darwin";
			return "linux";
		}

		/**
		 * 產生「添加示例命令」按鈕要插入的命令字串。
		 * {browser} 與 {home} 由 host 端在執行前解析，因此這裡只需依照目前
		 * 系統選擇路徑分隔字元（Windows 用反斜線、macOS/Linux 用正斜線）。
		 * @returns {string} 命令範本字串。
		 */
		function exampleCommand() {
			var sep = detectPlatform() === "win32" ? "\\" : "/";
			return '"{browser}" --user-data-dir="{home}' + sep + '.dsh' + sep + 'dsh-browser-data" --disk-cache-dir="{home}' + sep + '.dsh' + sep + 'dsh-browser-cache" --app={url} --no-first-run --disable-extensions';
		}

		/**
		 * 計算 command 草稿的寫入計畫：set（單條寫字串、多條寫陣列）、
		 * unset（全空白等同恢復繼承預設 []）或 null（與現值相同，不需寫入）。
		 * @param {{clear: boolean, items: string[]}} draft - command 欄位草稿（items 為逐列原始文字）。
		 * @param {unknown} current - 目前解析值（string | string[]）。
		 * @param {unknown} user - 使用者層原始值（判斷是否已覆蓋）。
		 * @returns {{op: "set", value: unknown} | {op: "unset"} | null}
		 */
		function commandDraftWrite(draft, current, user) {
			if (draft.clear) {
				return stored(user, "command") ? { op: "unset" } : null;
			}
			var trimmed = commandTrimmed(draft.items);
			var currentTrimmed = commandTrimmed(commandItems(current));
			if (trimmed.length === 0) {
				// 全空白列等同恢復預設（空陣列）：只有已覆蓋才需要 unset。
				return currentTrimmed.length === 0 ? null : (stored(user, "command") ? { op: "unset" } : null);
			}
			// 單條命令維持字串形式（與既有設定一致），多條才寫陣列。
			var target = trimmed.length === 1 ? trimmed[0] : trimmed;
			if (trimmed.length === currentTrimmed.length && trimmed.every(function (s, i) { return s === currentTrimmed[i]; })) {
				return null;
			}
			return { op: "set", value: target };
		}

		/** 判斷 command 欄位是否處於「已覆蓋」狀態（草稿優先；全空白草稿視為未覆蓋）。 */
		function commandOverridden(draft, user) {
			if (draft !== undefined) {
				if (draft.clear) return false;
				return commandTrimmed(draft.items).length > 0;
			}
			return stored(user, "command");
		}

		var SPECS = {
			enabled: booleanSpec("enabled"),
			shell: booleanSpec("shell")
		};

		// ---------- 樣式 ----------
		var CSS_TAG_ID = "@kagurazakayashi/dsh-startup-command/settings-card.css";
		var STYLE_SELECTOR = "style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]";
		var css = [
			".dshscc-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none;transition:border-color .16s,background .16s;}",
			".dshscc-card:hover{border-color:var(--dsw-alias-label-dimmed);}",
			".dshscc-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed);}",
			".dshscc-header{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex;}",
			".dshscc-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px;}",
			".dshscc-headText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex;}",
			".dshscc-name{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4;}",
			".dshscc-description{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5;}",
			".dshscc-chevron{color:var(--dsw-alias-label-tertiary);flex:none;transition:transform .16s;}",
			".dshscc-chevronOpen{transform:rotate(180deg);}",
			".dshscc-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px;}",
			".dshscc-readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5;}",
			".dshscc-notExposed{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5;}",
			".dshscc-pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;}",
			".dshscc-field{flex-direction:column;gap:6px;padding:12px 0;display:flex;}",
			".dshscc-field+.dshscc-field{border-top:1px solid var(--dsw-alias-border-l2);}",
			".dshscc-head{align-items:center;gap:8px;display:flex;}",
			".dshscc-label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5;}",
			".dshscc-badges{align-items:center;gap:8px;display:inline-flex;}",
			".dshscc-badge{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px;}",
			".dshscc-reset{font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;padding:0;font-size:12px;line-height:1.5;}",
			".dshscc-reset:hover:not(:disabled){color:var(--dsw-alias-label-primary);}",
			".dshscc-reset:disabled{cursor:default;}",
			".dshscc-input,.dshscc-select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;box-sizing:border-box;width:100%;}",
			".dshscc-input:focus-visible,.dshscc-select:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none;}",
			".dshscc-input:disabled,.dshscc-select:disabled{color:var(--dsw-alias-label-tertiary);cursor:default;}",
			".dshscc-inputInvalid{border-color:var(--dsw-alias-label-error);}",
			".dshscc-hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:1.5;}",
			".dshscc-commandList{flex-direction:column;gap:8px;display:flex;}",
			".dshscc-commandRow{align-items:center;gap:8px;display:flex;}",
			".dshscc-commandIndex{flex:none;min-width:16px;text-align:right;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5;font-variant-numeric:tabular-nums;}",
			".dshscc-commandInput{flex:1;min-width:0;}",
			".dshscc-commandBtn{flex:none;width:26px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1;cursor:pointer;}",
			".dshscc-commandBtn:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary);}",
			".dshscc-commandBtn:disabled{opacity:.4;cursor:default;}",
			".dshscc-commandBtn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px;}",
			".dshscc-commandAdd{width:100%;margin-top:2px;padding:5px 12px;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1.5;cursor:pointer;}",
			".dshscc-commandAdd:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary);}",
			".dshscc-commandAdd:disabled{opacity:.5;cursor:default;}",
			".dshscc-commandAdd:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px;}",
			".dshscc-commandExample{width:100%;margin-top:6px;padding:5px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1.5;cursor:pointer;}",
			".dshscc-commandExample:hover:not(:disabled){border-color:var(--dsw-alias-label-dimmed);color:var(--dsw-alias-label-primary);}",
			".dshscc-commandExample:disabled{opacity:.5;cursor:default;}",
			".dshscc-commandExample:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px;}",
			".dshscc-modal{position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;display:flex;}",
			".dshscc-modalBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.42);}",
			".dshscc-modalCard{position:relative;width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:16px;box-shadow:0 8px 32px rgba(0,0,0,.28);box-sizing:border-box;}",
			".dshscc-modalTitle{margin:0 0 8px;font-size:16px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary);}",
			".dshscc-modalIntro{margin:0 0 12px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);}",
			".dshscc-modalCode{margin:0;padding:10px 12px;background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;overflow:auto;}",
			".dshscc-modalSection{margin-top:12px;}",
			".dshscc-modalSectionTitle{margin:0 0 6px;font-size:13px;font-weight:600;line-height:1.5;color:var(--dsw-alias-label-secondary);}",
			".dshscc-modalItem{display:flex;gap:8px;margin-top:6px;align-items:flex-start;}",
			".dshscc-modalItemCode{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary);}",
			".dshscc-modalItemText{min-width:0;flex:1;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary);}",
			".dshscc-modalFooter{display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:16px;}",
			".dshscc-invalid{color:var(--dsw-alias-label-error);margin:0;font-size:12px;line-height:1.5;}",
			".dshscc-footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex;}",
			".dshscc-failed{min-width:0;color:var(--dsw-alias-label-error);flex:1;margin:0;font-size:12px;line-height:1.5;}",
			".dshscc-discard,.dshscc-save{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5;}",
			".dshscc-discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0;}",
			".dshscc-discard:disabled{cursor:default;opacity:.5;}",
			".dshscc-save{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-brand);}",
			".dshscc-save:disabled{cursor:default;opacity:.5;}"
		].join("\n");

		function mountStyle() {
			if (typeof document === "undefined") return;
			if (document.querySelector(STYLE_SELECTOR) !== null) return;
			var tag = document.createElement("style");
			tag.dataset.plugin = "@kagurazakayashi/dsh-startup-command";
			tag.dataset.pluginCss = CSS_TAG_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ---------- 欄位子元件 ----------

		/** 布林欄位：繼承 / 開 / 關 三態下拉。 */
		function BooleanField(props) {
			var spec = props.spec;
			var draft = props.draft; // undefined 表示未編輯
			var text = draft !== undefined ? draft.text : spec.format(props.value);
			var invalid = draft !== undefined && !draft.clear && spec.parse(draft.text) === undefined;
			return React.createElement("div", { className: "dshscc-field" },
				React.createElement("div", { className: "dshscc-head" },
					React.createElement("label", { className: "dshscc-label", htmlFor: props.id }, props.label),
					props.overridden ? React.createElement("span", { className: "dshscc-badges" },
						React.createElement("span", { className: "dshscc-badge" }, props.overriddenLabel),
						React.createElement("button", { type: "button", className: "dshscc-reset", disabled: props.disabled, onClick: props.onReset }, props.resetLabel)
					) : null
				),
				React.createElement("select", {
					id: props.id,
					className: invalid ? "dshscc-select dshscc-inputInvalid" : "dshscc-select",
					value: text,
					disabled: props.disabled,
					onChange: function (event) { props.onEdit(event.target.value); }
				},
					React.createElement("option", { value: "" }, props.inheritLabel),
					React.createElement("option", { value: "true" }, props.onLabel),
					React.createElement("option", { value: "false" }, props.offLabel)
				),
				React.createElement("p", { className: invalid ? "dshscc-invalid" : "dshscc-hint" }, invalid ? props.invalidLabel : props.hint)
			);
		}

		/** command 欄位：多列命令編輯器（可增刪列、上下移調整執行順序）。 */
		function CommandField(props) {
			// 用 Array.prototype.map 產生列：每個回呼的 index 參數獨立綁定，
			// 避免 for(var i) 的函式作用域使所有 onChange/onClick 都捕獲同一 i。
			var rows = props.items.map(function (text, i) {
				return React.createElement("div", { key: "row" + i, className: "dshscc-commandRow" },
					React.createElement("span", { className: "dshscc-commandIndex", "aria-hidden": true }, String(i + 1) + "."),
					React.createElement("input", {
						id: props.id + "-" + i,
						className: "dshscc-input dshscc-commandInput",
						type: "text",
						value: text,
						placeholder: props.placeholder,
						disabled: props.disabled,
						"aria-label": props.label + " " + (i + 1),
						onChange: function (event) { props.onEditRow(i, event.target.value); }
					}),
					React.createElement("button", {
						type: "button",
						className: "dshscc-commandBtn",
						disabled: props.disabled || i === 0,
						title: props.moveUpLabel,
						"aria-label": props.moveUpLabel,
						onClick: function () { props.onMoveRow(i, -1); }
					}, "\u2191"),
					React.createElement("button", {
						type: "button",
						className: "dshscc-commandBtn",
						disabled: props.disabled || i === props.items.length - 1,
						title: props.moveDownLabel,
						"aria-label": props.moveDownLabel,
						onClick: function () { props.onMoveRow(i, 1); }
					}, "\u2193"),
					React.createElement("button", {
						type: "button",
						className: "dshscc-commandBtn",
						disabled: props.disabled,
						title: props.removeLabel,
						"aria-label": props.removeLabel,
						onClick: function () { props.onRemoveRow(i); }
					}, "\u2715")
				);
			});
			return React.createElement("div", { className: "dshscc-field" },
				React.createElement("div", { className: "dshscc-head" },
					React.createElement("label", { className: "dshscc-label", htmlFor: props.id + "-0" }, props.label),
					props.overridden ? React.createElement("span", { className: "dshscc-badges" },
						React.createElement("span", { className: "dshscc-badge" }, props.overriddenLabel),
						React.createElement("button", { type: "button", className: "dshscc-reset", disabled: props.disabled, onClick: props.onReset }, props.resetLabel)
					) : null
				),
				rows.length > 0 ? React.createElement("div", { className: "dshscc-commandList" }, rows) : null,
				React.createElement("button", {
					type: "button",
					className: "dshscc-commandAdd",
					disabled: props.disabled,
					onClick: props.onAddRow
				}, "+ " + props.addLabel),
				React.createElement("button", {
					type: "button",
					className: "dshscc-commandExample",
					disabled: props.disabled,
					onClick: props.onAddExample
				}, props.exampleLabel),
				React.createElement("p", { className: "dshscc-hint" }, props.hint)
			);
		}

		/** 「添加示例命令」說明框：找到瀏覽器時展示範例命令，找不到時顯示原因並只允許關閉。 */
		function ExampleDialog(props) {
			var t = props.t;
			var available = props.available !== false;
			var reason = props.reason;
			var reasonText = reason === "unsupported-platform" ? t("exampleReasonUnsupportedPlatform") : t("exampleReasonNotFound");
			var title = available ? t("exampleDialogTitle") : t("exampleUnavailableTitle");

			var body = null;
			var footer = null;
			if (!available) {
				body = [
					React.createElement("p", { key: "intro", className: "dshscc-modalIntro" }, t("exampleUnavailableIntro")),
					React.createElement("p", { key: "reason", className: "dshscc-modalIntro" }, reasonText)
				];
				footer = React.createElement("div", { className: "dshscc-modalFooter" },
					React.createElement("button", { type: "button", className: "dshscc-save", onClick: props.onCancel }, t("exampleClose"))
				);
			} else {
				var placeholders = [
					{ code: t("exampleBrowserCode"), text: t("exampleBrowserText") },
					{ code: t("exampleHomeCode"), text: t("exampleHomeText") },
					{ code: t("exampleUrlCode"), text: t("exampleUrlText") }
				];
				var flags = [
					{ code: t("exampleUserDataDirCode"), text: t("exampleUserDataDirText") },
					{ code: t("exampleDiskCacheDirCode"), text: t("exampleDiskCacheDirText") },
					{ code: t("exampleAppCode"), text: t("exampleAppText") },
					{ code: t("exampleNoFirstRunCode"), text: t("exampleNoFirstRunText") },
					{ code: t("exampleDisableExtensionsCode"), text: t("exampleDisableExtensionsText") }
				];
				body = [
					React.createElement("p", { key: "intro", className: "dshscc-modalIntro" }, t("exampleDialogIntro")),
					React.createElement("pre", { key: "code", className: "dshscc-modalCode" }, props.command),
					React.createElement("div", { key: "placeholders", className: "dshscc-modalSection" },
						React.createElement("div", { className: "dshscc-modalSectionTitle" }, t("exampleDialogPlaceholdersTitle")),
						placeholders.map(function (item, i) {
							return React.createElement("div", { key: "ph" + i, className: "dshscc-modalItem" },
								React.createElement("code", { className: "dshscc-modalItemCode" }, item.code),
								React.createElement("span", { className: "dshscc-modalItemText" }, item.text)
							);
						})
					),
					React.createElement("div", { key: "flags", className: "dshscc-modalSection" },
						React.createElement("div", { className: "dshscc-modalSectionTitle" }, t("exampleDialogFlagsTitle")),
						flags.map(function (item, i) {
							return React.createElement("div", { key: "flag" + i, className: "dshscc-modalItem" },
								React.createElement("code", { className: "dshscc-modalItemCode" }, item.code),
								React.createElement("span", { className: "dshscc-modalItemText" }, item.text)
							);
						})
					)
				];
				footer = React.createElement("div", { className: "dshscc-modalFooter" },
					React.createElement("button", { type: "button", className: "dshscc-discard", onClick: props.onCancel }, t("exampleDialogCancel")),
					React.createElement("button", { type: "button", className: "dshscc-save", onClick: props.onConfirm }, t("exampleDialogAdd"))
				);
			}

			return React.createElement("div", { className: "dshscc-modal", role: "dialog", "aria-modal": "true", "aria-label": title },
				React.createElement("div", { className: "dshscc-modalBackdrop", onClick: props.onCancel }),
				React.createElement("div", { className: "dshscc-modalCard" },
					React.createElement("h3", { className: "dshscc-modalTitle" }, title),
					body,
					footer
				)
			);
		}

	// ---------- 瀏覽器探測結果（來自 host 唯讀路由） ----------
	// dsh 0.2.0 的設定 schema 只能宣告靜態預設值，主機端無法把執行期計算的
	// 探測結果注入 schema，因此改由 host 的 /dsh-startup-command/browser
	// 路由提供；卡片掛載時讀取一次，失敗時維持「未找到」。
	var browserInfo = { found: false, id: "", path: "", reason: "" };
	var browserListeners = new Set();

	/** 發布新的探測結果並通知訂閱者。 */
	function publishBrowser(next) {
		browserInfo = next;
		for (var listener of Array.from(browserListeners)) {
			try {
				listener();
			} catch {
				// 單一訂閱者失敗不影響其他訂閱者。
			}
		}
	}

	/** 訂閱探測結果（useSyncExternalStore 的 subscribe）。 */
	function subscribeBrowser(listener) {
		browserListeners.add(listener);
		return function () {
			browserListeners.delete(listener);
		};
	}

	/** 讀取目前的探測結果快照（穩定引用，僅在發布時替換）。 */
	function getBrowserInfo() {
		return browserInfo;
	}

	/**
	 * 向 host 讀取瀏覽器探測結果（盡力而為，失敗時維持現值）。
	 * @returns {Promise<void>} 讀取完成（或失敗）時 resolve。
	 */
	function loadBrowserInfo() {
		return fetch(BROWSER_INFO_ROUTE, { headers: { accept: "application/json" } })
			.then(function (response) {
				return response.ok ? response.json() : null;
			})
			.then(function (payload) {
				if (payload === null || typeof payload !== "object" || payload.ok !== true) return;
				publishBrowser({
					found: payload.found === true,
					id: typeof payload.id === "string" ? payload.id : "",
					path: typeof payload.path === "string" ? payload.path : "",
					reason: typeof payload.reason === "string" ? payload.reason : ""
				});
			})
			.catch(function () {
				// 路由不存在（host 外掛未掛載）時保持預設值。
			});
	}

	// ---------- 卡片元件 ----------

		/** 判斷某欄位是否落在使用者層（已覆蓋）。 */
		function stored(user, field) {
			return user !== undefined && Object.prototype.hasOwnProperty.call(user, field);
		}

		/** 計算某欄位目前的覆蓋狀態（草稿優先）。 */
		function fieldOverridden(spec, draft, user, field) {
			if (draft !== undefined) {
				if (draft.clear) return false;
				var write = spec.parse(draft.text);
				return write !== undefined && write.kind === "set";
			}
			return stored(user, field);
		}

		function StartupCommandCard(props) {
			var t = props.t;
			var scope = props.scope;

			var subscribe = React.useCallback(function (onChange) {
				return scope.subscribe(onChange);
			}, [scope]);
			var snapshot = React.useSyncExternalStore(subscribe, function () { return scope.getSnapshot(); });
			// 瀏覽器探測結果：掛載時向 host 讀取一次。
			var browser = React.useSyncExternalStore(props.subscribeBrowser, props.getBrowser);
			React.useEffect(function () {
				props.loadBrowser();
			}, []);

			// 預設收合：卡片預設不展開，使用者點擊表頭才展開設定區。
			var open = React.useState(false);
			var isOpen = open[0];
			var setOpen = open[1];

			var draftsState = React.useState({});
			var drafts = draftsState[0];
			var setDrafts = draftsState[1];

			var savingState = React.useState(false);
			var saving = savingState[0];
			var setSaving = savingState[1];

			var failedState = React.useState(false);
			var failed = failedState[0];
			var setFailed = failedState[1];

			var exampleOpenState = React.useState(false);
			var exampleOpen = exampleOpenState[0];
			var setExampleOpen = exampleOpenState[1];

			// 這個席位只提供 view 為 "page" 的完整表單。
			if (props.view !== undefined && props.view !== "page") return null;

			var status = snapshot.status;
			// 載入中時不渲染，避免閃爍。
			if (status === "loading") return null;

			var exposed = status === "ready";
			var writable = snapshot.writable === true;
			var value = snapshot.value || {};
			var base = snapshot.base || {};
			var user = snapshot.user;
			// host 端探測到的瀏覽器；false 時「添加示例命令」改為顯示原因。
			var exampleAvailable = browser.found === true;
			var exampleReason = typeof browser.reason === "string" ? browser.reason : "";

			var fields = ["enabled", "shell", "command"];
			var hasDraft = fields.some(function (field) { return drafts[field] !== undefined; });
			// command 為多列清單：空白列儲存時自動移除，不會構成「無效」。
			var hasInvalid = fields.some(function (field) {
				if (field === "command") return false;
				var draft = drafts[field];
				if (draft === undefined || draft.clear) return false;
				return SPECS[field].parse(draft.text) === undefined;
			});

			var title = t("title");
			var description = t("description");
			var blocked = !hasDraft || hasInvalid || saving;

			function edit(field, text) {
				setFailed(false);
				setDrafts(function (prev) {
					var next = {};
					for (var k in prev) next[k] = prev[k];
					next[field] = { text: text, clear: false };
					return next;
				});
			}

			/** 取 command 草稿的目前列內容：尚未編輯過時以解析值（value.command）為底。 */
			function commandDraftFrom(prev) {
				return prev.command !== undefined ? prev.command.items : commandItems(value.command);
			}

			/** 更新 command 第 index 列的原始文字。 */
			function editCommandRow(index, text) {
				setFailed(false);
				setDrafts(function (prev) {
					var nextItems = commandDraftFrom(prev).slice();
					nextItems[index] = text;
					var next = {};
					for (var k in prev) next[k] = prev[k];
					next.command = { clear: false, items: nextItems };
					return next;
				});
			}

			/** 在 command 清單末尾新增一列空白命令。 */
			function addCommandRow() {
				setFailed(false);
				setDrafts(function (prev) {
					var nextItems = commandDraftFrom(prev).slice();
					nextItems.push("");
					var next = {};
					for (var k in prev) next[k] = prev[k];
					next.command = { clear: false, items: nextItems };
					return next;
				});
			}

			/** 開啟「添加示例命令」說明框。 */
			function openExampleDialog() {
				setFailed(false);
				setExampleOpen(true);
			}

			/** 確認後才把範例命令追加到 command 清單末尾。 */
			function confirmExampleCommand() {
				setFailed(false);
				setDrafts(function (prev) {
					var nextItems = commandDraftFrom(prev).slice();
					nextItems.push(exampleCommand());
					var next = {};
					for (var k in prev) next[k] = prev[k];
					next.command = { clear: false, items: nextItems };
					return next;
				});
				setExampleOpen(false);
			}

			/** 取消並關閉「添加示例命令」說明框。 */
			function cancelExampleDialog() {
				setExampleOpen(false);
			}

			/** 刪除 command 第 index 列。 */
			function removeCommandRow(index) {
				setFailed(false);
				setDrafts(function (prev) {
					var nextItems = commandDraftFrom(prev).slice();
					nextItems.splice(index, 1);
					var next = {};
					for (var k in prev) next[k] = prev[k];
					next.command = { clear: false, items: nextItems };
					return next;
				});
			}

			/** 把 command 第 index 列向上（-1）或向下（+1）移動一格（執行順序隨之改變）。 */
			function moveCommandRow(index, delta) {
				setFailed(false);
				setDrafts(function (prev) {
					var nextItems = commandDraftFrom(prev).slice();
					var target = index + delta;
					if (target < 0 || target >= nextItems.length) return prev;
					var tmp = nextItems[index];
					nextItems[index] = nextItems[target];
					nextItems[target] = tmp;
					var next = {};
					for (var k in prev) next[k] = prev[k];
					next.command = { clear: false, items: nextItems };
					return next;
				});
			}

			function resetField(field) {
				setFailed(false);
				setDrafts(function (prev) {
					var next = {};
					for (var k in prev) next[k] = prev[k];
					if (field === "command") {
						// 恢復預設：顯示 base 的列內容，儲存時 unset（重新繼承）。
						next.command = { clear: true, items: commandItems(base.command) };
					} else {
						next[field] = { text: SPECS[field].format(base[field]), clear: true };
					}
					return next;
				});
			}

			function discard() {
				setDrafts({});
				setFailed(false);
			}

			function save() {
				if (blocked) return;
				// 依草稿建立寫入計畫；沒有實際寫入（例如僅對未覆蓋欄位做 reset）時直接清空草稿。
				var writes = [];
				for (var field of fields) {
					var draft = drafts[field];
					if (draft === undefined) continue;
					if (field === "command") {
						var commandWrite = commandDraftWrite(draft, value.command, user);
						if (commandWrite !== null) writes.push({ field: "command", op: commandWrite.op, value: commandWrite.value });
						continue;
					}
					var spec = SPECS[field];
					if (draft.clear) {
						if (stored(user, field)) writes.push({ field: field, op: "unset" });
						continue;
					}
					if (draft.text === spec.format(value[field])) continue;
					var write = spec.parse(draft.text);
					if (write === undefined) continue;
					if (write.kind === "clear") writes.push({ field: field, op: "unset" });
					else writes.push({ field: field, op: "set", value: write.value });
				}
				if (writes.length === 0) {
					setDrafts({});
					setFailed(false);
					return;
				}
				setSaving(true);
				setFailed(false);
				var landed = true;
				var chain = Promise.resolve();
				for (var i = 0; i < writes.length; i++) {
					(function (write) {
						chain = chain.then(function () {
							if (write.op === "set") return scope.set(write.field, write.value);
							return scope.unset(write.field);
						}).catch(function () { landed = false; });
					})(writes[i]);
				}
				chain.then(function () {
					setSaving(false);
					if (landed) {
						setDrafts({});
						setFailed(false);
					} else {
						setFailed(true);
					}
				});
			}

			var headerChildren = [
				React.createElement("span", { className: "dshscc-headText", key: "headText" },
					React.createElement("span", { className: "dshscc-name", title: title }, title),
					React.createElement("span", { className: "dshscc-description", title: description }, description)
				),
				hasDraft ? React.createElement("span", { className: "dshscc-pending", key: "pending" }, t("unsaved")) : null,
				React.createElement("svg", {
					key: "chevron",
					width: "14",
					height: "14",
					viewBox: "0 0 14 14",
					fill: "none",
					xmlns: "http://www.w3.org/2000/svg",
					className: isOpen ? "dshscc-chevron dshscc-chevronOpen" : "dshscc-chevron",
					"aria-hidden": true
				}, React.createElement("path", {
					d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
					fill: "currentColor"
				}))
			];

			var body = null;
			if (!exposed) {
				body = React.createElement("div", { className: "dshscc-body" },
					React.createElement("p", { className: "dshscc-notExposed", role: "status" }, t("notExposed"))
				);
			} else {
				var disabled = !writable;
				body = React.createElement("div", { className: "dshscc-body" },
					!writable ? React.createElement("p", { className: "dshscc-readOnly", role: "status" }, t("readOnly")) : null,
					React.createElement(BooleanField, {
						id: "dsh-startup-command-enabled",
						spec: SPECS.enabled,
						label: t("enabledLabel"),
						hint: t("enabledHint"),
						invalidLabel: "",
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						inheritLabel: t("inherit"),
						onLabel: t("on"),
						offLabel: t("off"),
						value: value.enabled,
						draft: drafts.enabled,
						overridden: fieldOverridden(SPECS.enabled, drafts.enabled, user, "enabled"),
						disabled: disabled,
						onEdit: function (text) { edit("enabled", text); },
						onReset: function () { resetField("enabled"); }
					}),
					React.createElement(BooleanField, {
						id: "dsh-startup-command-shell",
						spec: SPECS.shell,
						label: t("shellLabel"),
						hint: t("shellHint"),
						invalidLabel: "",
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						inheritLabel: t("inherit"),
						onLabel: t("on"),
						offLabel: t("off"),
						value: value.shell,
						draft: drafts.shell,
						overridden: fieldOverridden(SPECS.shell, drafts.shell, user, "shell"),
						disabled: disabled,
						onEdit: function (text) { edit("shell", text); },
						onReset: function () { resetField("shell"); }
					}),
					React.createElement(CommandField, {
						id: "dsh-startup-command-command",
						label: t("commandLabel"),
						hint: t("commandHint"),
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						placeholder: t("commandPlaceholder"),
						addLabel: t("commandAdd"),
						exampleLabel: t("commandAddExample"),
						removeLabel: t("commandRemove"),
						moveUpLabel: t("commandMoveUp"),
						moveDownLabel: t("commandMoveDown"),
						items: drafts.command !== undefined ? drafts.command.items : commandItems(value.command),
						overridden: commandOverridden(drafts.command, user),
						disabled: disabled,
						onEditRow: editCommandRow,
						onAddRow: addCommandRow,
						onAddExample: openExampleDialog,
						onRemoveRow: removeCommandRow,
						onMoveRow: moveCommandRow,
						onReset: function () { resetField("command"); }
					}),
					React.createElement("div", { className: "dshscc-footer" },
						failed ? React.createElement("p", { className: "dshscc-failed", role: "status" }, t("saveFailed")) : null,
						React.createElement("button", {
							type: "button",
							className: "dshscc-discard",
							disabled: !hasDraft || saving,
							onClick: discard
						}, t("discard")),
						React.createElement("button", {
							type: "button",
							className: "dshscc-save",
							disabled: blocked,
							onClick: save
						}, t(saving ? "saving" : "save"))
					)
				);
			}

			var dialog = exampleOpen ? React.createElement(ExampleDialog, {
				t: t,
				available: exampleAvailable,
				reason: exampleReason,
				command: exampleCommand(),
				onConfirm: confirmExampleCommand,
				onCancel: cancelExampleDialog
			}) : null;
			return React.createElement("div", { className: isOpen ? "dshscc-card dshscc-cardOpen" : "dshscc-card" },
				React.createElement("button", {
					type: "button",
					className: "dshscc-header",
					"aria-expanded": isOpen,
					"aria-label": (isOpen ? t("collapse") : t("expand")) + ": " + title,
					onClick: function () { setOpen(!isOpen); }
				}, headerChildren),
				isOpen ? body : null,
				dialog
			);
		}

		// ---------- Cordis apply ----------
		function apply(ctx) {
			mountStyle();

			// 註冊多語字典（回傳的 disposer 交由 ctx.effect 在卸載時清理）。
			ctx.effect(function () {
				return ctx.locale.register(NS, { zh: zh, en: en });
			}, "dsh-startup-command: dictionaries");

			// 卡片註冊：等 host 開始服務本外掛的設定命名空間（＝profile 入口 id）
			// 後，才把卡片註冊進 plugins.bundle.config（以 npm 包名為鍵）。
			// 舊版 configForms 沒有 whileServed 時，該部署沒有可編輯的欄位，
			// 因此直接不註冊。
			if (typeof ctx.configForms.whileServed !== "function") return;
			ctx.effect(function () {
				return ctx.configForms.whileServed([NS], function () {
					var form = ctx.configForms.get(NS);
					var face = {
						scope: form,
						subscribeBrowser: subscribeBrowser,
						getBrowser: getBrowserInfo,
						loadBrowser: loadBrowserInfo
					};
					return ctx.slots.inject("plugins.bundle.config", function () {
						return ctx.slots.register({
							name: "plugins.bundle.config",
							key: PACKAGE,
							locale: NS,
							inject: function () { return face; }
						}, StartupCommandCard);
					});
				});
			}, "dsh-startup-command: settings card");
		}

		return { apply: apply, inject: inject };
	}
});
