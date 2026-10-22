export type Check = { id: string; ok: boolean; label: string; fix?: string };
export type BulletResult = { text: string; checks: Check[]; score: number };

const STRONG_VERBS = new Set(
  `accelerated achieved analyzed architected automated benchmarked built captured championed coded cut debugged decreased
  delivered deployed designed developed diagnosed doubled drove eliminated engineered established expanded extended fixed
  grew halved implemented improved increased instrumented integrated introduced launched led migrated modeled modernized
  monitored optimized orchestrated organized overhauled pioneered profiled prototyped published rebuilt redesigned reduced
  refactored replaced resolved restructured revamped saved scaled secured shipped simplified slashed spearheaded standardized
  streamlined tested trained transformed tripled unified upgraded validated visualized wrote created coordinated mentored
  presented taught authored researched evaluated containerized parallelized cached indexed trained fine-tuned`
    .split(/\s+/)
    .filter(Boolean),
);

const WEAK_STARTS: Record<string, string> = {
  responsible: "Say what you did, not what you were responsible for.",
  helped: "Name your actual part. \"Built\", \"wrote\", \"designed\"?",
  assisted: "Name your actual part instead of assisting.",
  worked: "\"Worked on\" hides the work. What did you build or change?",
  participated: "What did you personally do in it?",
  involved: "What did you personally do?",
  used: "Lead with the outcome, then mention the tool.",
  utilized: "Lead with the outcome, then mention the tool.",
  did: "Use a specific verb.",
  made: "\"Made\" is vague. Built, designed, wrote?",
  handled: "\"Handled\" is vague. What changed because of you?",
  tasked: "Skip the assignment and say what you did.",
};

const FILLER = [
  "various", "several", "many", "successfully", "effectively", "efficiently", "dynamic", "passionate", "synergy",
  "leverage", "leveraged", "utilize", "in order to", "a number of", "etc", "hard-working", "team player", "detail-oriented",
  "cutting-edge", "state-of-the-art", "robust", "seamless", "seamlessly",
];

const TECH = new RegExp(
  "\\b(" +
    [
      "python", "java", "javascript", "typescript", "c\\+\\+", "c#", "go", "golang", "rust", "kotlin", "swift", "sql", "r",
      "react", "next\\.js", "node(\\.js)?", "express", "flask", "django", "fastapi", "spring( boot)?", "vue", "angular",
      "tailwind", "html", "css", "aws", "azure", "gcp", "lambda", "s3", "dynamodb", "ec2", "bedrock", "cdk", "docker",
      "kubernetes", "terraform", "postgres(ql)?", "mysql", "sqlite", "mongodb", "redis", "kafka", "graphql", "rest",
      "git", "github actions", "ci/cd", "linux", "pandas", "numpy", "pytorch", "tensorflow", "scikit-learn", "faiss",
      "llm", "openai", "claude", "selenium", "playwright", "jest", "pytest", "twilio", "firebase", "supabase", "godot",
      "unity", "tkinter", "react native", "expo", "netlify", "vercel", "sanity", "figma", "power bi", "tableau", "spark",
      "airflow", "cognito", "oauth", "websocket(s)?", "grpc", "opencv", "nfc",
    ].join("|") +
    ")\\b",
  "i",
);

const METRIC = /\d|%|\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|double|half|twice)\b/i;
const PASSIVE = /\b(was|were|been|being|is|are)\s+(\w+ed|built|made|written|done|given|chosen|run|led)\b/i;
const PRONOUN = /\b(i|me|my|we|our|us)\b/i;

export function splitBullets(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*([•●▪◦*\-–]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.split(/\s+/).length >= 5);
}

export function reviewBullet(text: string, firstWords: Map<string, number>): BulletResult {
  const words = text.split(/\s+/);
  const first = words[0].toLowerCase().replace(/[^a-z-]/g, "");
  const lower = text.toLowerCase();
  const checks: Check[] = [];

  const weak = WEAK_STARTS[first];
  const ing = first.endsWith("ing");
  checks.push({
    id: "verb",
    ok: !weak && !ing && (STRONG_VERBS.has(first) || /ed$/.test(first)),
    label: "Starts with a strong past-tense verb",
    fix: weak ?? (ing ? `"${words[0]}" reads like a duty. Use past tense, like "${words[0].replace(/ing$/i, "ed")}".` : `Open with what you did: Built, Cut, Designed, Automated…`),
  });

  checks.push({
    id: "metric",
    ok: METRIC.test(text),
    label: "Has a number",
    fix: "Quantify something: users, time saved, % faster, records processed, team size. A rough estimate beats nothing.",
  });

  checks.push({
    id: "tech",
    ok: TECH.test(text),
    label: "Names the stack",
    fix: "End with the tools you used, like \"using React, Flask and PostgreSQL\".",
  });

  const filler = FILLER.filter((f) => new RegExp(`\\b${f.replace(/[-]/g, "[- ]")}\\b`, "i").test(lower));
  checks.push({
    id: "filler",
    ok: filler.length === 0,
    label: "No filler words",
    fix: filler.length ? `Cut or replace: ${filler.map((f) => `"${f}"`).join(", ")}.` : undefined,
  });

  const dashes = /—|\s–\s|\s-\s/.test(text);
  const semis = text.includes(";");
  checks.push({
    id: "punct",
    ok: !dashes && !semis,
    label: "No em dashes or semicolons",
    fix: dashes && semis
      ? "Swap the dash for a comma or \"by\", and split the semicolon with \"and\" or a comma."
      : dashes
        ? "Swap the dash for a comma or \"by\"."
        : "Split the semicolon into two clauses with \"and\" or a comma.",
  });

  checks.push({
    id: "voice",
    ok: !PASSIVE.test(text) && !PRONOUN.test(text),
    label: "Active voice, no I or we",
    fix: PRONOUN.test(text) ? "Drop the pronoun. The résumé is already about you." : "Rewrite in active voice so you're the one doing it.",
  });

  const len = text.length;
  checks.push({
    id: "length",
    ok: words.length >= 10 && len <= 210,
    label: "One to two lines long",
    fix: words.length < 10 ? "Too thin. Add the problem it solved or the result." : `About ${Math.ceil(len / 105)} lines. Trim to two at most.`,
  });

  const repeats = (firstWords.get(first) ?? 0) > 1;
  checks.push({
    id: "repeat",
    ok: !repeats,
    label: "Opening verb isn't repeated",
    fix: `"${words[0]}" starts ${firstWords.get(first)} bullets. Vary them.`,
  });

  const score = checks.filter((c) => c.ok).length / checks.length;
  return { text, checks, score };
}

export function reviewAll(raw: string): BulletResult[] {
  const bullets = splitBullets(raw);
  const firsts = new Map<string, number>();
  for (const b of bullets) {
    const f = b.split(/\s+/)[0].toLowerCase().replace(/[^a-z-]/g, "");
    firsts.set(f, (firsts.get(f) ?? 0) + 1);
  }
  return bullets.map((b) => reviewBullet(b, firsts));
}
