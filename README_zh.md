<div align="center">

[English](README.md) · **简体中文** · [日本語](README_ja.md) · [한국어](README_ko.md) · [العربية](README_ar.md)

# REA：逆向工程一切

### 一个覆盖二进制、应用与运行时行为的逆向工程 MCP。

**看到喜欢的功能。理解它的工作原理，深入到二进制层面。**

[![npm version](https://img.shields.io/npm/v/rea-agents?style=flat-square&color=cb3837)](https://www.npmjs.com/package/rea-agents)
[![CI](https://img.shields.io/github/actions/workflow/status/morluto/rea/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/morluto/rea/actions/workflows/ci.yml)
[![MCP tool catalog](https://img.shields.io/badge/MCP-tool_catalog-5c4ee5?style=flat-square)](docs/mcp-contracts.md#generated-catalog)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22.19%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MIT license](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![Discord](https://img.shields.io/discord/1556595354999332884?logo=discord&logoColor=white&label=Discord&color=5865F2)](https://discord.gg/GkcryMnJDM)

<a href="https://trendshift.io/repositories/82054?utm_source=repository-badge&amp;utm_medium=badge&amp;utm_campaign=badge-repository-82054" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/repositories/82054" alt="morluto%2Frea | Trendshift" width="250" height="55"/></a>

**[网站（英文）](https://morluto.github.io/rea/) · [使用指南](https://morluto.github.io/rea/guides/) · [案例展示](https://morluto.github.io/rea/showcase/)**

[快速开始](#快速开始) · [工作原理](#工作原理) · [可分析的目标](#可分析的目标) · [案例展示](#案例展示) · [常见问题](#常见问题) · [文档](#文档)

<code>npx rea-agents setup</code>

<br />

<img src="docs/assets/rea-hopper-analysis.png" alt="REA 在 Hopper 中启动分析桥并检查原生二进制文件" width="1200" />

<br />

<table aria-label="REA 社区">
<tr>
<td align="center" width="360">
  <a href="https://discord.gg/GkcryMnJDM">
    <img src="docs/assets/discord.svg" height="42" alt="Discord" /><br />
    <strong>加入逆向工程社区</strong>
  </a><br />
  <sub>Discord · 问答 · 成果分享</sub>
</td>
</tr>
</table>

<br />

</div>

---

看中了某个应用里的功能，想在自己的产品里实现？让智能体用 REA 去调查它。即使没有源代码，智能体也能检查这个应用、解释功能的工作方式、展示证据，并为你的项目构建同样的功能。

REA 为智能体提供原生二进制、JavaScript 与 Electron 应用、.NET 程序集以及网站的分析工具，你也可以直接在终端里使用它们。分析全部在本机运行，结果会附带每条结论背后的证据与限制。

Setup 会把 REA 注册到你的智能体，并安装配套的工作流说明。原生分析可以使用已有的 Hopper 或 Ghidra 安装；经你批准后，Setup 也可以安装 Hopper。静态 JavaScript 分析不需要任何原生分析引擎。

> **[访问 REA 网站](https://morluto.github.io/rea/)** 获取安装说明、图文指南和真实案例。

## 快速开始

### 设置智能体

安装 Node.js 和 npm 之后，运行：

```bash
npx rea-agents setup
```

选择你的智能体，检查并批准提议的修改。Setup 会加入 REA 的 MCP 服务器和配套工作流说明，并备份现有配置。完成后重启智能体。

Setup 支持 Claude Code、Claude Desktop、Codex、Cursor、Gemini CLI、Windsurf、Devin、OpenCode、Antigravity、GitHub Copilot CLI、Command Code 和 VS Code；已有 REA 注册默认选中，其他检测到的客户端需手动选择。提供商配置与[手动 MCP 注册](docs/installation.md#mcp-registry)见[安装与设置](docs/installation.md)。

### 询问智能体

```text
解释“备忘录”应用的搜索功能是如何工作的，展示证据，然后为我的项目实现类似功能。
```

把“备忘录”换成你的目标应用和想理解的功能即可。

### 使用终端

检查一个已解包的 JavaScript/Electron 应用目录或 ASAR：

```bash
npx -y rea-agents@latest analyze-javascript-application /absolute/path/to/app --json
```

结果包含模块、导入、Electron 边界及其证据。把路径换成你的目标，例如 Windows 上的 `"D:/apps/example"`。

要安装 `rea` 命令以便日常使用：

```bash
npm install --global rea-agents
rea --help
```

原生分析需要先配置分析提供商。原生命令、提供商选择、快照与脚本化用法见 [CLI 与证据指南](docs/cli.md)。

### 更新 REA

REA 迭代很快，新版本经常包含缺陷修复，请保持安装为最新。

npm 安装的 CLI：

```bash
rea update
```

更新完成后，按提示重新运行 Setup 命令，刷新智能体注册和技能。

如果你使用 `npx`，用下面的命令更新智能体配置：

```bash
npx rea-agents@latest setup
```

检查并批准 Setup 的修改，然后重启智能体。临时使用的 CLI 命令，请在命令前加 `npx rea-agents@latest`。

## 工作原理

智能体通过 MCP 调用 REA 检查目标并追踪相关代码，REA 返回带证据的结论。智能体据此追问、解释行为，或者编写并测试实现。CLI 命令使用相同的工作流。

![REA 调查流程：智能体针对本地目标提问，REA 使用分析工具检查并追踪目标，智能体利用返回的代码、引用和未知项进行解释、实现和测试。](website/public/assets/figures/rea-investigation-flow.svg)

[查看大图](website/public/assets/figures/rea-investigation-flow.svg)。

<a id="current-status"></a>

## 可分析的目标

REA 需要 Node.js 22.x（>=22.19）、24.x（>=24.11）或 26+，以及 npm。其他工具和主机支持取决于目标类型：

| 目标                  | REA 返回的结果                                       | 要求与指南                                                                                                             |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 原生二进制            | 伪代码、汇编、字符串、符号、调用与引用               | Hopper、Ghidra 或 IDA；[原生分析](https://morluto.github.io/rea/guides/native/)                                        |
| 离线 ELF 布局         | 节区、段、原始符号/重定位和静态缓解候选              | Linux x64 上由调用方提供 pwntools；[二进制诊断](docs/binary-diagnostics.md)                                            |
| EVM 字节码            | 分发选择器、字节偏移、推断的参数与可变性             | 本地 raw/hex 载体；[离线 EVM 指南](docs/evm-bytecode.md)                                                               |
| 记录的 Linux 崩溃     | 原始笔记、每个记录线程的寄存器/信号和可选映射候选    | 调用方提供 pwntools；可选 GDB/pwndbg；[崩溃记录](docs/recorded-crashes.md)                                             |
| JavaScript / Electron | 模块、导入、source map、路由、IPC 和原生扩展关系     | Node.js 和 npm；[应用分析](https://morluto.github.io/rea/guides/javascript/)                                           |
| 网站                  | 页面结构、脚本、网络观察和请求的截图                 | Chrome 系浏览器；[浏览器分析](https://morluto.github.io/rea/guides/browser/)                                           |
| 保存的网络抓包        | 请求、响应、暴露的载荷和来源位置                     | HAR；Linux 上原生 mitmproxy 抓包需 mitmdump；[抓包指南](docs/web-network-captures.md)                                  |
| .NET 程序集           | 元数据、CIL 指令、声明的原生依赖和构建对比           | 静态检查；[托管代码指南](docs/managed-code-analysis.md)                                                                |
| Android APK           | 清单声明、类、反编译方法和引用                       | Linux/macOS 上的无头 JADX 和完整 JDK；[Android 指南](docs/android-analysis.md)                                         |
| 固件                  | 区域、提取结果和原生分析交接                         | Linux 上的 Binwalk / Unblob；[固件指南](docs/firmware-analysis.md)                                                     |
| 安装包与资源          | 文件清单、摘要、plist、Apple bundle 结构和提取的资源 | [制品与 JavaScript 指南](docs/javascript-artifact-reconstruction.md)、[Apple 应用](docs/apple-application-analysis.md) |
| 进程行为              | 终端输出、交互、退出与文件系统观察，以及运行对比     | Linux/macOS 和原生 PTY；[进程捕获](docs/process-capture.md)                                                            |

静态 JavaScript 和 .NET 检查只读取提供的文件，不运行应用。运行时捕获会以你的用户权限运行或交互目标；各运行时指南描述了具体影响。

<a id="choosing-a-deep-analysis-provider"></a>

原生格式与主机支持因提供商而异。参见 [Hopper 与 Ghidra 设置](docs/installation.md#hopper)、[IDA 指南](docs/ida-provider.md)和[实验性 Windows Ghidra 支持](docs/windows-ghidra-p0.md)。Ghidra 还支持 [16 位 DOS 分析](docs/ghidra-dos.md)。提供商选择见 [CLI 指南](docs/cli.md#choose-a-provider)。最近 npm 发布之后加入的功能，请查看[发布可用性](docs/installation.md#released-package-and-main)。

## 案例展示

### DX-Ball：重建声音声道定位计算

跟随一次声音调用找到它的位置到声道辅助函数，检查指令，把不完整的伪代码还原成 C。重建结果通过了 3,205 个原始 x86 测试用例，并复现了全部 63 字节的编译函数。

[阅读案例](https://morluto.github.io/rea/showcase/dx-ball/) ·
[重建仓库](https://github.com/N0zoM1z0/dx-ball)

### Notion：追踪 Electron 剪贴板桥

找到渲染进程的剪贴板 API，沿着 preload 和 IPC 一路追进主进程，并检查富文本剪贴板格式。

[阅读案例](https://morluto.github.io/rea/showcase/notion/)

### TH04：恢复 DOS 弹幕环角度计算

检查这款 PC-98 原版游戏的 16 位指令，恢复固定角度与瞄准角度计算，并把重建的 C++ 与历史编译器输出对比。

[阅读案例](https://morluto.github.io/rea/showcase/th04/) ·
[重建仓库](https://github.com/N0zoM1z0/th04)

如果你用 REA 分析过有意思的东西，我们很想看到。欢迎在[议题](https://github.com/morluto/rea/issues)或[拉取请求](https://github.com/morluto/rea/pulls)里分享你的案例：目标是什么、你的问题、REA 如何帮到你、你发现了什么。

## 常见问题

<details>
<summary><strong>哪些智能体可以使用 REA？</strong></summary>

任何支持本地 MCP 服务器的智能体。Setup 会配置[受支持的智能体](docs/installation.md#supported-agents)；其他客户端可以使用[手动 MCP 注册](docs/installation.md#mcp-registry)。

</details>

<details>
<summary><strong>我需要 Hopper、Ghidra 或 IDA 吗？</strong></summary>

深度原生分析需要其中之一。静态 JavaScript 和 .NET 检查不需要原生分析引擎。Setup 经批准后可以安装 Hopper；Ghidra 和 IDA 使用你已有的安装。参见[提供商设置](docs/installation.md#hopper)。

</details>

<details>
<summary><strong>我需要先启动 Hopper 吗？</strong></summary>

不需要，REA 会在操作需要时启动 Hopper。在 macOS 上，首次运行可能弹出对话框，让你选择演示模式或激活许可证。参见 [Hopper 启动与故障排除](docs/installation.md#launcher-paths-and-troubleshooting)。

</details>

<details>
<summary><strong>从 skills.sh 安装技能有什么用？</strong></summary>

技能为你的智能体提供调查说明。运行 `rea setup` 注册 REA 的 MCP 服务器并安装配套说明，然后重启智能体。参见[仅技能安装](docs/installation.md#skill-only-installation)。

</details>

<details>
<summary><strong>REA 返回什么代码？</strong></summary>

原生分析返回伪代码和汇编。JavaScript/Electron 分析恢复模块及其关系。智能体利用这些结论编写并测试实现；[案例展示](#案例展示)里有完整的例子。

</details>

<details>
<summary><strong>REA 会上传我的应用吗？</strong></summary>

不会。REA 在本地分析目标。你的智能体会收到工具结果，其模型提供商有自己的数据政策。

</details>

<details>
<summary><strong>遇到缺陷怎么办？</strong></summary>

先更新；最近的版本可能已经修复。

npm 安装的 CLI：

```bash
rea update
```

通过 `npx` 配置的智能体环境：

```bash
npx rea-agents@latest setup
```

如果你在使用智能体，请完成[设置刷新](#更新-rea)并重启，然后重试同一任务。如果问题仍然存在，请[提交议题](https://github.com/morluto/rea/issues)，附上 REA 版本、目标类型、复现步骤和错误输出。

</details>

## 文档

从网站的[实战指南](https://morluto.github.io/rea/guides/)开始。需要确切的选项、前置条件和结果契约时：

- [安装与设置](docs/installation.md)：智能体注册、提供商配置、更新与卸载。
- [就绪检查与故障排除](docs/installation.md#check-readiness-for-your-task)：诊断单个智能体或分析引擎。
- [CLI 与证据](docs/cli.md)：命令、提供商选择、快照、导入导出和退出状态。
- [MCP 契约](docs/mcp-contracts.md)与[智能体提示](docs/mcp-prompts.md)：工具结果、会话和引导式调查。
- [工具目录](docs/mcp-contracts.md#generated-catalog)：构建生成的工具、提供商和 CLI 命令清单。
- [路线图](docs/roadmap.md)：计划中的工作与能力跟踪。

### 调查工具目录

按工具类别统计的当前工具清单（与构建生成的[工具目录](docs/mcp-contracts.md#generated-catalog)一致）：

| 工具类别          | 数量 | 用途                                                                                                                 |
| ----------------- | ---: | -------------------------------------------------------------------------------------------------------------------- |
| 原生检查          |   40 | 函数、伪代码、汇编、字符串、符号、调用、引用、注释、字节读取与文件偏移                                               |
| 调查工作流        |   14 | 应用概览、函数档案、原生 API 与分发、批量反编译、功能追踪、调用路径与调用图、Swift 与 Objective-C 发现               |
| 原生二进制工具    |   10 | macOS 的 Mach-O 元数据、签名、plist、架构、Swift 符号与 LLDB 调用观察；Linux 的 ELF 布局、静态保护证据与历史崩溃记录 |
| 产物图            |    7 | 目录与软件包清单、编译后的 Interface Builder 文件、Apple 资源目录、Mach-O dylib 加载解析、提取与离线 EVM 接口推断    |
| 托管 PE/CLI       |    7 | .NET 程序集身份、元数据、CIL 指令、原生依赖声明、重建导入与构建比较                                                  |
| 固件              |    2 | Linux 固件区域检查与显式提取                                                                                         |
| Android APK       |    5 | 包与 manifest 声明、类搜索、成员清单、方法反编译与静态引用                                                           |
| 浏览器观察        |   12 | 页面结构、网络元数据、脚本、来源映射、WebMCP 发现、截图与捕获比较                                                    |
| Electron 分析     |    5 | 渲染进程观察、静态应用映射、静态/运行时结果关联                                                                      |
| JavaScript 运行时 |    2 | Node/Electron Inspector 目标发现、脚本位置与执行上下文事件                                                           |
| 应用工作流        |   13 | 捕获的网站脚本导出、跨层功能追踪、构建比较、历史源码映射、静态返回结构比较与重建验证                                 |
| 工作区与观察      |   21 | 会话、证据包、导航上下文、进程/产物/函数比较与待解决问题跟踪                                                         |

漏洞请通过 [SECURITY.md](SECURITY.md) 报告。

## 参与贡献

欢迎参与 REA！[提交议题](https://github.com/morluto/rea/issues)报告缺陷或建议功能，或[发送拉取请求](https://github.com/morluto/rea/pulls)改进代码或文档。

开发环境与检查见 [CONTRIBUTING.md](CONTRIBUTING.md)，验证流程见[测试文档](docs/testing.md)，项目结构见[架构图](docs/architecture.mermaid)。

## 项目链接

[网站](https://morluto.github.io/rea/) · [npm](https://www.npmjs.com/package/rea-agents) · [skills.sh](https://skills.sh/morluto/rea/reverse-engineer-anything) · [议题](https://github.com/morluto/rea/issues) · [安全](SECURITY.md)

## Star 历史

🎉 **20,000 GitHub stars —— 谢谢大家！**

感谢每一位使用 REA、报告缺陷、测试构建和贡献修复的人。

<a href="https://www.star-history.com/?repos=morluto%2Frea&amp;type=date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=morluto/rea&amp;type=date&amp;theme=dark&amp;legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=morluto/rea&amp;type=date" />
    <img alt="REA GitHub star 历史" src="https://api.star-history.com/chart?repos=morluto/rea&amp;type=date" />
  </picture>
</a>

## 免责声明

REA 为合法的逆向工程研究、分析和重建提供工具。你有责任取得所需授权并遵守适用法律。本项目不支持任何非法或未经授权的使用。

## 许可证

[MIT](LICENSE)
