# AI Language Lab（它怎么学会接话？） — 项目说明（供 AI 编程代理阅读）

## 项目概览

AI Language Lab（页面标题「它怎么学会接话？」）是一个**字符级语言模型教学演示**的纯静态三文件网页。用户输入几句中文语料（或选择内置预设），页面用一个最简单的"看一个字、猜下一个字"的 softmax 模型，从随机权重开始逐步训练，实时展示转移矩阵、概率分布与损失曲线的变化，让观众直观理解语言模型"猜下一个 token、按误差调整"的训练原理。

## 技术栈与运行架构

- **三文件、零依赖**：`index.html`（结构）+ `styles.css`（样式）+ `app.js`（逻辑），无框架、无打包器、无 npm、无网络请求。
- **模型**（JavaScript 实现，纯浏览器端训练）：
  - 词表：`[始, 止, ...语料去重字符]`，`始`/`止` 为句首/句尾哨兵 token。
  - 权重：`vocab × vocab` 矩阵，mulberry32 风格 PRNG（种子 `20260813 + 字符数 × 31`）随机初始化于 `[-0.08, 0.08]`。
  - 训练对：每行语料 `[始, ...字符, 止]` 的相邻字符对；`trainOne()` 逐对执行 softmax 前向、交叉熵损失、SGD 更新（学习率 `0.72`），游标在全部训练对上循环。
  - 损失：`meanLoss()` 为全部训练对的平均交叉熵。
  - 生成：`generate(seed)` 从 `始` 出发按 temperature 缩放后的 softmax 采样，最长 18 个字符，遇 `止` 停止。
  - 温度：滑杆 `0.3–1.4`，默认 `0.7`。
- **可视化**：转移矩阵（单元格颜色深浅 = 条件概率）、当前 token 的 Top-5 概率条、损失曲线（内联 SVG）、词表 token 条。

## 仓库结构

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构（HTML），引用 `styles.css` 与 `app.js` |
| `styles.css` | 全部样式（原单文件内 `<style>` 抽取，76 行） |
| `app.js` | 全部模型与交互逻辑（原单文件内 `<script>` 抽取，231 行） |
| `tests/static-smoke.test.mjs` | 零依赖静态验收：资源、脚本、关键控件、响应式样式与固定 ID |
| `.gitignore` | 忽略 `.gh-config/`（GitHub CLI 本地配置，含认证 token，不得提交） |

> 注：原仓库只有一个 ChatGPT 导出的单文件 `ai-language-lab-standalone.html`，内含约 280 行追踪拦截/哨兵守卫残留脚本及一批 `/Static/`、`/Web/`、`/_ooa/` 外部引用（静态托管上会 404）。2026-08-14 拆分时已全部清除，业务逻辑无损迁移至三文件结构。

## 运行与构建

无构建步骤，直接用浏览器打开 `index.html` 即可。如需本地静态预览：

```bash
python -m http.server 8000
```

浏览器打开 `http://localhost:8000`。

## 测试

可运行 `node --test tests/static-smoke.test.mjs` 做零依赖静态验收。模型逻辑为确定性实现（固定随机种子），仍需通过以下方式手动回归：

- 加载预设语料后点击「练 200 次」，损失曲线应明显下降，生成句子应逐渐贴近语料风格。
- 权重初始化与 `trainOne()` 更新规则均确定，同种子下结果可复现。
- 交互（预设切换、矩阵点击、温度滑杆、生成）需在浏览器中人工验证。

## 代码组织与风格约定

- **职责分离**：HTML 在 `index.html`，样式在 `styles.css`，逻辑与数据在 `app.js`。
- CSS 变量定义在 `:root`，统一视觉令牌（颜色、字体、间距）；含 `Readability pass` 可读性增强节与多档媒体查询。实验区宽屏为三栏等高卡片加全宽生成结果，中等宽度折为两栏、手机折为单栏。
- 视觉令牌沿用 `ydchen-portfolio`：`#f3eee5` 暖米白、`#24221f` 深色文字、`#6f6a62` 次级文字、`#c15f3c` 陶土橙强调色；实验面板、图表和控件的业务语义保持不变。
- 视觉验收以正文 16px、实验控件与图表标签不小于 12px 为基线，并在 1440px 桌面与 390px 手机视口检查整体横向溢出。
- 模型常量与关键函数：`START`/`END` 哨兵、`makeModel()`、`trainOne()`、`meanLoss()`、`generate()`、`softmax()`、`randomGenerator()`、`frequencyTokens()` 等，命名自解释，注释为中文。
- 界面文案与注释为简体中文，标识符用英文。
- 保持零依赖、零构建原则，未经明确批准不得引入外部库或打包工具。
- 所有交互元素依赖 `index.html` 中的固定 id（`corpusInput`、`matrix`、`trainToggle` 等），改名需同步更新 `app.js` 的 `ui` 映射。

## 部署

纯静态页面，可托管到任意静态站点。如需接入 Cloudflare Pages（GitHub 集成）：

```text
Production branch: main
Build command: （留空，无需构建）
Build output directory: /
```

## 安全与数据注意事项

- 全部计算在浏览器本地完成，无后端、无网络请求、无数据上传。
- 无 `localStorage`、无 Cookie、无任何用户数据采集。
- `.gh-config/` 若出现于本地（GitHub CLI 认证产物）已被 `.gitignore` 排除，不得提交。

---

## AI 维护提醒

> **⚠️ 任何修改此项目的 AI 代理（包括未来的你自己）都必须遵守：**
>
> - **修改代码后必须同步更新本 AGENTS.md 与 README.md** — 功能增删、架构变更、部署方式变更都需要在两份文档中体现
> - README.md 面向**人类用户**（功能介绍、运行方法、部署步骤），AGENTS.md 面向 **AI 代理**（架构、代码组织、开发约定），两份文件**不可互相替代**
> - 保持三文件结构（`index.html` + `styles.css` + `app.js`）；新增/拆分文件时务必同步更新文件清单


## 标志维护约定

项目标志采用统一的深灰方章、米白线条与赤陶色识别点，页面标志与 favicon 共用同一 `project-mark.svg`。后续替换必须保持原标志容器宽高，不得借机改变页眉、网格或页面布局。
