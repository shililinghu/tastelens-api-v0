require("dotenv").config();

const path = require("path");
const express = require("express");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MODEL_PROVIDER = (process.env.MODEL_PROVIDER || "mock").toLowerCase();
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen-vl-plus";
const ARK_MODEL = process.env.ARK_MODEL;
const ARK_API_KEY = process.env.ARK_API_KEY;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
      return;
    }
    cb(new Error("Only image/jpeg and image/png are allowed"));
  }
});

const fixedReferences = [
  { src: "./images/ref-1.jpg", note: "侧面定向光 · 明暗对照 · 留白干净" },
  { src: "./images/ref-2.jpg", note: "电影感冷调 · 哑光质感 · 纵深层次" },
  { src: "./images/ref-3.jpg", note: "三分法构图 · 暖光勾边 · 干净背景" }
];

const baseMockAnalysisResult = {
  intent:
    "你上传的人像有清晰的主体和明确的情绪倾向。\n这是一张展现「克制美感」的视觉作品,TasteLens 用相近主题的顶尖作品做对照。",
  tags: ["人像摄影", "审美对照", "情绪表达"],
  references: fixedReferences,
  dimensions: [
    {
      icon: "💡",
      name: "光影",
      user: "光源较平,缺少明确的方向感",
      ref: "侧面定向光,半边明半边暗,立体感强",
      tip: "把主光源移到侧面 45°,利用窗户自然光或暖色灯",
      level: "关键",
      score: 12
    },
    {
      icon: "🎯",
      name: "构图",
      user: "主体居中,信息略密集",
      ref: "三分法 + 大面积留白,主体偏置",
      tip: "把主体移到画面 1/3 处,留出 20-30% 的空白区域",
      level: "明显",
      score: 13
    },
    {
      icon: "🎨",
      name: "色彩",
      user: "饱和度偏高,色彩分散",
      ref: "电影感冷暖对比,低饱和统一色调",
      tip: "整体降低饱和度 15-20%,选定一个主色调统一全局",
      level: "明显",
      score: 14
    },
    {
      icon: "🪵",
      name: "质感",
      user: "反光面较多,材质单一",
      ref: "针织、雾面、水泥等哑光层次",
      tip: "引入木质/亚麻/陶瓷等哑光元素,避免大面积反光面",
      level: "关键",
      score: 11
    },
    {
      icon: "🌫️",
      name: "氛围",
      user: "信息平均,主体张力不足",
      ref: "前中后景拉开纵深,主体张力突出",
      tip: "弱化背景(模糊或简化),让主体在画面中占据 60% 视觉权重",
      level: "轻微",
      score: 15
    }
  ],
  overallScore: 65,
  overallRating: "人上人"
};

function getOverallRating(score) {
  if (score >= 90) return "夯爆了";
  if (score >= 75) return "顶级";
  if (score >= 60) return "人上人";
  if (score >= 40) return "NPC";
  return "拉完了";
}

function sanitizeDimensionScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 12;
  return Math.max(0, Math.min(20, Math.round(value)));
}

function buildMockAnalysis(file, includeDebug = false) {
  if (!includeDebug) return baseMockAnalysisResult;

  const { originalname, size, mimetype } = file;
  const currentTime = new Date().toISOString();
  const fileDebug = `本次 mock 收到文件：${originalname}`;

  // DEBUG MOCK ONLY: include upload metadata so the frontend can verify API-driven rendering.
  return {
    ...baseMockAnalysisResult,
    intent: `${baseMockAnalysisResult.intent}\n\nDEBUG MOCK ONLY\n上传文件名：${originalname}\n文件大小：${size} bytes\n文件类型：${mimetype}\n当前时间：${currentTime}`,
    dimensions: baseMockAnalysisResult.dimensions.map((dimension) => ({
      ...dimension,
      user: `${dimension.user}\n${fileDebug}`
    }))
  };
}

function logArkApiKeyDiagnostics() {
  if (!ARK_API_KEY) {
    console.error("Missing ARK_API_KEY");
    return;
  }

  const prefix = ARK_API_KEY.slice(0, 4);
  const suffix = ARK_API_KEY.slice(-4);
  console.log(`ARK_API_KEY length: ${ARK_API_KEY.length}, prefix: ${prefix}, suffix: ${suffix}`);

  if (/^\s|\s$|["'\r\n]/.test(ARK_API_KEY)) {
    console.error("ARK_API_KEY may contain invalid whitespace or quotes.");
  }

  const looksLikeWrongCredential =
    /^AK[A-Z0-9]/i.test(ARK_API_KEY) ||
    /^SK[A-Z0-9]/i.test(ARK_API_KEY) ||
    /^sk-[a-z0-9]/i.test(ARK_API_KEY) ||
    /^deepseek/i.test(ARK_API_KEY) ||
    /^doubao/i.test(ARK_API_KEY) ||
    /^ep-[a-z0-9-]+$/i.test(ARK_API_KEY) ||
    /^endpoint/i.test(ARK_API_KEY) ||
    /^model/i.test(ARK_API_KEY);

  if (looksLikeWrongCredential) {
    console.error("Please use Ark Console API Key, not AK/SK, model id, endpoint id, or DeepSeek key.");
  }
}

function buildPrompt() {
  return `你是 TasteLens 的人像审美对照分析引擎。请直接分析用户上传的人像图片,只返回严格 JSON,不要 Markdown,不要代码块。

JSON 结构必须是:
{
  "intent": "string",
  "tags": ["string"],
  "overallScore": 0,
  "overallRating": "string",
  "dimensions": [
    {"icon":"💡","name":"光影","user":"string","ref":"string","tip":"string","level":"轻微|明显|关键","score":0},
    {"icon":"🎯","name":"构图","user":"string","ref":"string","tip":"string","level":"轻微|明显|关键","score":0},
    {"icon":"🎨","name":"色彩","user":"string","ref":"string","tip":"string","level":"轻微|明显|关键","score":0},
    {"icon":"🪵","name":"质感","user":"string","ref":"string","tip":"string","level":"轻微|明显|关键","score":0},
    {"icon":"🌫️","name":"氛围","user":"string","ref":"string","tip":"string","level":"轻微|明显|关键","score":0}
  ]
}

要求:
- intent 用 2-3 句中文描述画面主体、情绪和最值得优先调整的方向。
- tags 返回 3 个短标签,不要带 #。
- dimensions 必须且只能包含 光影、构图、色彩、质感、氛围 5 个维度。
- user 描述这张图当前的视觉选择。
- ref 描述顶尖人像参考通常会怎么处理。
- tip 必须是具体可执行建议。
- level 只能是 轻微、明显、关键。
- score 必须是整数,范围 0-20,每个维度满分 20。
- overallScore 和 overallRating 可以返回,但服务端会重新计算最终值。
- 不要使用“廉价”“差”“低级”“糟糕”等负面词。`;
}

function imageDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

function extractModelText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        return part?.text || "";
      })
      .join("");
  }
  return "";
}

function parseJsonText(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw err;
  }
}

function normalizeAnalysis(raw) {
  const dimensionsByName = new Map(
    Array.isArray(raw.dimensions) ? raw.dimensions.map((dimension) => [dimension.name, dimension]) : []
  );
  const allowedLevels = new Set(["轻微", "明显", "关键"]);

  const dimensions = baseMockAnalysisResult.dimensions.map((fallback) => {
    const dimension = dimensionsByName.get(fallback.name) || {};
    const level = allowedLevels.has(dimension.level) ? dimension.level : fallback.level;
    return {
      icon: fallback.icon,
      name: fallback.name,
      user: typeof dimension.user === "string" && dimension.user.trim() ? dimension.user : fallback.user,
      ref: typeof dimension.ref === "string" && dimension.ref.trim() ? dimension.ref : fallback.ref,
      tip: typeof dimension.tip === "string" && dimension.tip.trim() ? dimension.tip : fallback.tip,
      level,
      score: sanitizeDimensionScore(dimension.score ?? fallback.score)
    };
  });
  const overallScore = Math.max(0, Math.min(100, dimensions.reduce((sum, dimension) => sum + dimension.score, 0)));

  return {
    intent: typeof raw.intent === "string" && raw.intent.trim() ? raw.intent : baseMockAnalysisResult.intent,
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags.slice(0, 5).map(String) : baseMockAnalysisResult.tags,
    references: fixedReferences,
    dimensions,
    overallScore,
    overallRating: getOverallRating(overallScore)
  };
}

async function postOpenAICompatible({ url, apiKey, model, file }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl(file) } },
            { type: "text", text: buildPrompt() }
          ]
        }
      ],
      temperature: 0.2
    })
  });

  const text = await response.text();
  if (!response.ok) {
    if (text.includes("ModelNotOpen")) {
      throw new Error(`ModelNotOpen: 请前往 Ark Console 开通模型，或将 ARK_MODEL 更换为已开通的视觉模型 ID 或 Endpoint ID。${text}`);
    }
    throw new Error(`Provider request failed: ${response.status} ${text}`);
  }

  return JSON.parse(text);
}

async function analyzeWithQwen(file) {
  if (!process.env.DASHSCOPE_API_KEY) {
    throw new Error("DASHSCOPE_API_KEY is required when MODEL_PROVIDER=qwen");
  }

  const payload = await postOpenAICompatible({
    url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    apiKey: process.env.DASHSCOPE_API_KEY,
    model: QWEN_MODEL,
    file
  });
  return { rawText: extractModelText(payload), payload };
}

async function analyzeWithDoubao(file) {
  if (!ARK_API_KEY) {
    console.error("Missing ARK_API_KEY");
    throw new Error("ARK_API_KEY is required when MODEL_PROVIDER=doubao");
  }
  if (!ARK_MODEL) {
    console.error("Missing ARK_MODEL");
    throw new Error("ARK_MODEL is required when MODEL_PROVIDER=doubao");
  }

  console.log("Calling Doubao vision provider...");
  const payload = await postOpenAICompatible({
    url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    apiKey: ARK_API_KEY,
    model: ARK_MODEL,
    file
  });
  const rawText = extractModelText(payload);
  console.log("Doubao raw response received");
  console.log(rawText.slice(0, 300));
  return { rawText, payload };
}

async function analyzeImage(file) {
  console.log(`TasteLens provider: ${MODEL_PROVIDER}`);

  if (MODEL_PROVIDER === "mock") {
    return buildMockAnalysis(file, true);
  }

  const runner = MODEL_PROVIDER === "qwen" ? analyzeWithQwen : MODEL_PROVIDER === "doubao" ? analyzeWithDoubao : null;
  if (!runner) {
    throw new Error(`Unsupported MODEL_PROVIDER: ${MODEL_PROVIDER}`);
  }

  const { rawText } = await runner(file);
  try {
    const result = normalizeAnalysis(parseJsonText(rawText));
    if (MODEL_PROVIDER === "doubao") console.log("Doubao JSON parsed successfully");
    return result;
  } catch (err) {
    if (MODEL_PROVIDER === "doubao") {
      console.error("Doubao JSON parse failed, fallback to mock");
      console.error(err);
    } else {
      console.error("Model JSON parse failed, fallback to mock. Raw response:", rawText);
    }
    return buildMockAnalysis(file, false);
  }
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tastelens.html"));
});

app.post("/api/analyze", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "image file is required" });
      return;
    }

    console.log("Analyze request received", {
      provider: MODEL_PROVIDER,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    const result = await analyzeImage(req.file);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "image file is too large" : err.message;
    res.status(400).json({ error: message });
    return;
  }

  if (err) {
    res.status(400).json({ error: err.message || "request failed" });
    return;
  }

  next();
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TasteLens API V0 listening on http://127.0.0.1:${PORT}`);
  console.log("Render bind host: 0.0.0.0");
  console.log(`TasteLens provider: ${MODEL_PROVIDER}`);
  console.log(`Raw MODEL_PROVIDER: ${process.env.MODEL_PROVIDER}`);
  console.log(`ARK_API_KEY exists: ${Boolean(process.env.ARK_API_KEY)}`);
  console.log(`ARK_MODEL exists: ${Boolean(process.env.ARK_MODEL)}`);
  console.log(`PORT env: ${process.env.PORT}`);
  console.log(`cwd: ${process.cwd()}`);
  if (MODEL_PROVIDER === "doubao") {
    logArkApiKeyDiagnostics();
    if (!ARK_MODEL) console.error("Missing ARK_MODEL");
  }
});
