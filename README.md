# 广东公考刷题 H5

一个纯静态的在线刷题页面，覆盖 **国考 · 广东省考 · 广东事业单位（编制）** 三个方向、**2023 / 2024 / 2025** 三个年度，共 **15 套卷**：

| 卷型 | 套数 | 题型 |
| --- | --- | --- |
| 行政职业能力测验 | 6 套（国考 3 + 广东省考 3） | 单选 + 多选 + 判断 |
| 公共基础知识 | 3 套（广东事业单位） | 单选 + 多选 + 判断 |
| 申论 | 6 套（国考 3 + 广东省考 3） | 主观题（写作，不自动判分） |

合计 **225 道客观题**（单选 201 / 多选 12 / 判断 12）+ **24 道申论题**。

- 无框架、无构建、无后端、无依赖，全部是 HTML + CSS + 原生 JS
- 手机 / 平板 / 电脑自适应
- 答题进度、上次成绩、错题本、申论草稿都存在浏览器 localStorage 里
- 可直接部署到 GitHub Pages

> ⚠️ **关于题目来源**：题库中的题目是**依据历年真题的题型结构、题量与难度编写的原创模拟题**，不是官方真题原文（官方真题有版权，逐字复制也容易出错）。所有题目、答案、解析都请以官方大纲和教材为准。
>
> ⚠️ **关于完整度**：这是**精简样卷**，不是全真模考卷。真实考卷的题量远大于此（国考行测 130~135 题、广东省考行测 90 题、广东事业单位 100 题），每套卷只放了 23~26 题用于练题型和找手感。另外**国考的副省级 / 地市级 / 行政执法类三套卷只做了副省级一套**，广东省考申论的分类卷（申论一 / 申论二 / 行政执法 / 公安）也只做了一套通用卷，**公安专业科目、审计专业科目等加试科目没有做**。

---

## 一、本地预览

直接**双击 `index.html`** 即可打开（数据用 `<script>` 内联加载，不依赖 fetch，所以 `file://` 协议下也能跑）。

如果想用 HTTP 方式预览（更接近线上环境）：

```bash
cd gk-exam
python3 -m http.server 8080
# 然后浏览器打开 http://127.0.0.1:8080
```

---

## 二、部署到 GitHub Pages

### 方式 A：复用当前仓库（推荐，一条命令）

当前仓库里有多个项目，把 `gk-exam` 目录单独推到 `gh-pages` 分支：

```bash
# 在仓库根目录执行
git subtree push --prefix gk-exam origin gh-pages
```

然后到 GitHub 仓库 **Settings → Pages**，Source 选择 `Deploy from a branch`，分支选 `gh-pages` / `/(root)`，保存。

访问地址：`https://<你的用户名>.github.io/<仓库名>/`

### 方式 B：单独建一个仓库

```bash
cd gk-exam
git init
git add .
git commit -m "init: 广东公考刷题 H5"
git branch -M main
git remote add origin git@github.com:<你的用户名>/<仓库名>.git
git push -u origin main
```

仓库里已经带好了 `.github/workflows/pages.yml`，推送后到 **Settings → Pages**，Source 选 `GitHub Actions` 即可，之后每次 push 自动发布。

> `.nojekyll` 已就位，避免 GitHub Pages 的 Jekyll 处理干扰静态资源。

---

## 三、目录结构

```
gk-exam/
├── index.html                页面骨架
├── styles.css                样式
├── app.js                    全部逻辑（无依赖）
├── data/
│   ├── gk-2023/2024/2025.json      国考行测
│   ├── gk-sl-2023/2024/2025.json   国考申论
│   ├── gd-2023/2024/2025.json      广东省考行测
│   ├── gd-sl-2023/2024/2025.json   广东省考申论
│   ├── sy-2023/2024/2025.json      广东事业单位公基
│   └── papers.js                   由上面 JSON 自动打包生成（页面实际加载的文件）
├── tools/build-data.js       校验 + 打包脚本
├── tools/smoke.html          自动跑一遍「开卷→作答→交卷→申论写作」的回归测试页
├── tools/shot.html           截图用页面（?s=home|help|answer|multi|judge|essay|ref|sheet|result）
├── .nojekyll
└── .github/workflows/pages.yml
```

---

## 四、功能

| 功能 | 说明 |
| --- | --- |
| 使用说明 | 右上角 `?` 一键打开；**首次访问会自动弹出一次**，讲清三种题型、答题卡、答案抽屉、申论怎么写、进度存哪 |
| 试卷列表 | 按考试类型分组，行测 / 公基在前、申论在后，显示题量、时长、上次得分或续答进度 |
| 三种客观题型 | **单选**、**多选**（选项框为方形，勾选多个，全对才得分）、**判断**（选项圈显示 √ / ×） |
| 在线作答 | 上下题切换、答题卡跳题、资料分析共用材料自动显示 |
| 查看答案与解析 | 题目下方按钮，做题过程中随时在**抽屉**里看正确答案、选项标记和解析 |
| 计时 | 答题页右上角正计时 |
| 交卷判分 | 百分制得分、答对 / 答错 / 未答统计、用时；有未答题会二次确认 |
| 解析回顾 | 交卷后逐题显示正确答案、你的选择、解析；可切换「只看错题」 |
| 进度保存 | 中途关页面，下次点进去自动续答 |
| 错题本 | 答错自动收录，答对自动移出，可单独重做 |
| 申论写作 | 给定资料（可滚动）+ 答题框 + **实时字数统计**（对照题目字数上限 / 下限）+ 草稿自动保存 |
| 申论参考答案 | 每题点「查看参考要点 / 参考范文」，在**抽屉**里展开参考要点、评分参考、范文与写作提示 |
| 申论回顾 | 完卷后汇总展示「我的作答 + 参考要点」，可随时回去修改 |

抽屉（底部弹层）一共三种内容，共用一套组件：

- **答题卡 / 题目列表**——题号网格总览，点题号跳题，底部就是交卷 / 完成按钮
- **答案与解析 / 参考要点**——正确答案（或参考范文）、选项标记、解析，随时可看
- **使用说明**——新手指引

> 申论是主观题，页面**不自动判分**。请对照参考要点，从「要点是否齐全、结构是否清晰、字数是否达标」三个角度自评。

---

## 五、增删题目

1. 修改 / 新增 `data/*.json`，格式见下。
2. 运行打包脚本（会顺带做合法性校验）：

```bash
node tools/build-data.js
```

如果要新增一套卷子，除了放 JSON 文件，还需要在 `tools/build-data.js` 顶部的 `ORDER` 数组里加上它的 id。

### 5.1 客观题卷（行测 / 公基）

```json
{
  "id": "gd-2025",
  "title": "2025年广东省公务员录用考试《行政职业能力测验》（模拟卷）",
  "region": "广东省",
  "examType": "广东省考",
  "subject": "行测",
  "year": 2025,
  "duration": 90,
  "totalScore": 100,
  "note": "本卷为依据历年真题题型结构编写的原创模拟题，非官方真题原文，仅供练习。",
  "sections": [
    {
      "name": "政治理论",
      "material": null,
      "questions": [
        { "id": "gd-2025-24", "stem": "单选题干……", "options": ["A正文","B正文","C正文","D正文"], "answer": 0, "explain": "解析……" },
        { "id": "gd-2025-25", "type": "multi", "stem": "多选题干……", "options": ["A正文","B正文","C正文","D正文"], "answer": [0,2,3], "explain": "解析……" },
        { "id": "gd-2025-26", "type": "judge", "stem": "判断：……", "options": ["正确","错误"], "answer": 0, "explain": "解析……" }
      ]
    }
  ]
}
```

字段说明：

- `type`：`"single"`（默认，可省略）/ `"multi"` / `"judge"`
- `answer`：
  - 单选：**下标整数**，`0=A`、`1=B`、`2=C`、`3=D`
  - 多选：**升序下标数组**，如 `[0,2,3]`，至少 2 个正确项；**漏选、错选都不得分**
  - 判断：`0`=正确、`1`=错误（`options` 固定写 `["正确","错误"]`）
- `material`：该 section 共用的材料（资料分析用），没有就写 `null`；有材料时会在该 section 每道题上方显示
- `options`：只写选项正文，不要带 `A.` `B.` 前缀，前缀由页面渲染
- `duration`：建议答题时长（分钟），仅用于显示

### 5.2 申论卷

```json
{
  "id": "gd-sl-2025",
  "title": "2025年广东省公务员录用考试《申论》（模拟卷）",
  "region": "广东省",
  "examType": "广东省考",
  "subject": "申论",
  "year": 2025,
  "duration": 150,
  "totalScore": 100,
  "kind": "essay",
  "note": "本卷为依据历年真题题型结构编写的原创模拟题，非官方真题原文，仅供练习。",
  "materialTitle": "给定资料",
  "material": "给定资料1\n……\n\n给定资料2\n……",
  "questions": [
    {
      "id": "gd-sl-2025-1",
      "stem": "根据给定资料1，请概括……。\n要求：全面、准确、条理清晰；不超过300字。（20分）",
      "limit": 300,
      "score": 20,
      "answer": "【参考要点】\n1. ……\n\n【评分参考】\n……"
    },
    {
      "id": "gd-sl-2025-3",
      "stem": "……自选角度，自拟标题，写一篇文章。\n要求：……1000～1200字。（50分）",
      "limit": 1200,
      "min": 1000,
      "score": 50,
      "answer": "【参考范文】\n标题：……\n\n正文……"
    }
  ]
}
```

字段说明：

- `kind: "essay"` 标记这是申论卷
- `material`：整卷共用的给定资料，用 `\n` 分行
- `limit`：该题字数上限；`min`（可选）：字数下限，只给大作文用
- `score`：该题分值，**全卷各题分值合计必须为 100**（打包脚本会校验）
- `answer`：参考要点 / 参考范文 / 写作提示，写完展开对照自评

---

## 六、回归测试

改完题库后建议跑一次（需要本机装了 Chrome）：

```bash
cd gk-exam
node tools/build-data.js

# 端到端：开卷 → 答完（含多选、判断）→ 交卷 → 错题本 → 申论写作 → 草稿持久化
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --virtual-time-budget=12000 --dump-dom "file://$PWD/tools/smoke.html" \
  | grep -o 'SMOKE_RESULT \[.*\]'
```

输出是一串 JSON 数组，正常情况下应包含：

```
"firstVisitHelp=true","helpSections=6","helpReopen=true",
"papers=15","steps=26","multiSeen=1/1judge","score=...","reviewItems=26",
"ansDrawer=答案与解析","cardCells=26","jumpPos=...",
"homeHasEssay=true","hasMaterial=true","counter=...",
"refDrawer=参考要点与评分参考","refInDrawer=true","refNotInline=true",
"reviewMine=3","essayDone=已完卷","savedDone=true","helpFlagSaved=true"
```

---

## 七、说明

- 页面本身不发起任何联网请求（题库随 `<script>` 一起下发），因此没有后端、没有接口、没有第三方依赖。
- **不使用 Service Worker / PWA / manifest**，也不做离线缓存：从 GitHub Pages 打开时刷新页面需要联网；直接双击本地 `index.html` 则完全离线可用。这是有意为之，为的是保持结构简单、避免缓存导致改题后不生效。
- 数据全部保存在本机浏览器，换设备 / 清缓存会丢失进度（包括申论草稿）。
