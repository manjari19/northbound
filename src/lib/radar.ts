"use client";

/**
 * ResumeRadar client. northbound talks to the same API Gateway the ResumeRadar site uses,
 * so fit checks and mock interviews run on its Lambdas + Bedrock, with no extra keys.
 */
import { useStored } from "./store";

export const RADAR_URL = "https://tn2d1ewrfl.execute-api.us-west-2.amazonaws.com/prod";
/**
 * API Gateway kills any request at 29 seconds, and a fit check is ~25-30s of Bedrock output.
 * resumeradar/scripts/analyse-url.sh gives the analyse Lambda a Function URL (no 29s cap)
 * and writes it to .env.local as NEXT_PUBLIC_RADAR_ANALYSE_URL. Restart npm run dev after.
 */
export const ANALYSE_URL = process.env.NEXT_PUBLIC_RADAR_ANALYSE_URL || "";

/* ------------------------------------------------------------ types */

export type Analysis = {
  fit_score: number;
  match_level: "Excellent" | "Strong" | "Moderate" | "Weak" | "Poor";
  scoring_rationale?: string;
  summary: string;
  strengths: { category: string; evidence: string }[];
  weaknesses: { category: string; gap: string }[];
  suggestions: { priority: "High" | "Medium" | "Low"; recommendation: string; reason: string }[];
  keyword_analysis: { matched_keywords: string[]; missing_keywords: string[] };
  suggested_project?: { title: string; description: string; technologies: string[]; estimated_time: string };
};

export type FitRecord = {
  postingId?: string;
  key: string; // postingId or a hash of company+title
  company: string;
  title: string;
  url?: string;
  jd: string;
  analysis: Analysis;
  checkedAt: string;
};

export type Question = { id: string; type: "behavioral" | "technical"; question: string; focus: string };

export type MockTurn =
  | { who: "interviewer"; text: string; kind?: "greeting" | "icebreaker" | "question" | "transition" | "closing"; question?: Question }
  | { who: "me"; text: string }
  | { who: "feedback"; score: number; feedback: string; tip: string };

export type MockSession = {
  sessionId: string;
  key: string;
  company: string;
  role: string;
  jd: string;
  turns: MockTurn[];
  pending: { kind: "icebreaker" } | { kind: "question"; question: Question } | null;
  /** First real question, held until the icebreaker is answered */
  queued?: Question;
  overallScore: number | null;
  done: boolean;
  startedAt: string;
};

export type Resume = { name: string; base64: string; text: string; bullets: string[]; uploadedAt: string };

export type Rewrite = { rewrite: string; why: string };
export type Tailoring = {
  lead_with: { item: string; reason: string }[];
  add_keywords: { keyword: string; where: string }[];
  bullet_edits: { original: string; rewrite: string }[];
  cut_or_shrink: { item: string; reason: string }[];
};

/* ------------------------------------------------------------ hooks */

export const useResume = () => useStored<Resume | null>("resume", null);
export const useFits = () => useStored<Record<string, FitRecord>>("fits", {});
export const useMocks = () => useStored<Record<string, MockSession>>("mocks", {});
export const useRadarUser = () => useStored<string>("radar.user", "northbound");
export const useJDs = () => useStored<Record<string, string>>("jds", {});

export function fitKey(p: { id?: string; postingId?: string; company: string; title: string }): string {
  return p.postingId || p.id || `${p.company}|${p.title}`.toLowerCase();
}

/* ------------------------------------------------------------ requests */

export class RadarError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

function readUser(): string {
  try {
    const raw = localStorage.getItem("nb.radar.user");
    return raw ? JSON.parse(raw) : "northbound";
  } catch {
    return "northbound";
  }
}

async function post<T>(path: string, body: Record<string, unknown>, url = `${RADAR_URL}${path}`): Promise<T> {
  let res: Response;
  const started = Date.now();
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: readUser(), ...body }),
    });
  } catch {
    // A 504 from API Gateway has no CORS headers, so the browser reports it as a network error.
    // If we waited ~29s, it was the gateway timeout, not your wifi.
    if (Date.now() - started > 20000) throw new RadarError("ResumeRadar took longer than API Gateway's 29 second limit.", 504);
    throw new RadarError("Couldn't reach ResumeRadar. Check your internet connection and try again.");
  }
  if (res.status === 504 || res.status === 503) throw new RadarError("ResumeRadar took longer than API Gateway's 29 second limit.", 504);
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (res.status === 403 || res.status === 404) {
    throw new RadarError(
      path === "/coach"
        ? "The coach endpoint isn't deployed yet. Run resumeradar/scripts/deploy-coach.sh once, then try again."
        : `ResumeRadar doesn't have ${path} (HTTP ${res.status}).`,
      res.status,
    );
  }
  if (!res.ok) {
    const msg = (data.error as string) || (data.details as string) || `ResumeRadar returned HTTP ${res.status}.`;
    throw new RadarError(msg, res.status);
  }
  return data as T;
}

/** ResumeRadar's analyser: résumé PDF + job description -> fit score, strengths, gaps, keywords, project idea. */
/** Drop the legal/benefits boilerplate (it never changes the score) and cap the length. */
export function trimJD(jd: string, max = 4500): string {
  const junk = /equal (employment )?opportunit|affirmative action|accommodat|disabilit|veteran|pay (range|transparency)|base pay|salary range|compensation|(our|the) benefits|benefits (include|package)|401\(k\)|medical, dental|e-verify|privacy (notice|policy)|#li-|background check|we are committed to (diversity|inclusion|building a diverse)/i;
  const kept = jd
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((para) => para.replace(/[ \t]+/g, " ").trim())
    .filter((para) => para && !junk.test(para));
  const out = kept.join("\n\n");
  return out.length > max ? out.slice(0, max) : out || jd.slice(0, max);
}

export async function analyse(resumeBase64: string, jobDescription: string): Promise<Analysis> {
  let data: Record<string, unknown>;
  if (ANALYSE_URL) {
    data = await post<Record<string, unknown>>("/analyse", { resumeBase64, jobDescription: trimJD(jobDescription, 8000) }, ANALYSE_URL);
  } else {
    try {
      data = await post<Record<string, unknown>>("/analyse", { resumeBase64, jobDescription: trimJD(jobDescription) });
    } catch (e) {
      if (!(e instanceof RadarError) || e.status !== 504) throw e;
      try {
        // One more go with a shorter description, which shaves a few seconds off
        data = await post<Record<string, unknown>>("/analyse", { resumeBase64, jobDescription: trimJD(jobDescription, 2200) });
      } catch (e2) {
        if (e2 instanceof RadarError && e2.status === 504)
          throw new RadarError(
            "ResumeRadar ran past API Gateway's 29 second limit twice. Run resumeradar/scripts/analyse-url.sh once to remove the limit, then restart npm run dev.",
            504,
          );
        throw e2;
      }
    }
  }
  // The Lambda returns the model's JSON, sometimes wrapped as { analysis } or { result }
  const a = (data.analysis || data.result || data) as Analysis;
  if (typeof a.fit_score !== "number") throw new RadarError("ResumeRadar answered, but not with a fit analysis. Try again.");
  return {
    ...a,
    strengths: a.strengths ?? [],
    weaknesses: a.weaknesses ?? [],
    suggestions: a.suggestions ?? [],
    keyword_analysis: a.keyword_analysis ?? { matched_keywords: [], missing_keywords: [] },
  };
}

export function practiceGenerate(resumeBase64: string, jobDescription: string, company: string, role: string) {
  return post<{ sessionId: string; greeting: string; icebreaker: string; first_question: Question }>("/practice-generate", {
    resumeBase64,
    jobDescription,
    company,
    role,
  });
}

export function practiceIcebreaker(sessionId: string, transcript: string) {
  return post<{ resume_transition: string }>("/practice-submit", { sessionId, kind: "icebreaker", transcript });
}

export type SubmitResult = {
  score: number;
  feedback: string;
  tip: string;
  overallScore: number;
  action: "follow_up" | "new_topic" | "close";
  nextQuestion?: Question;
  closingMessage?: string;
};

export function practiceSubmit(sessionId: string, question: Question, transcript: string, jobDescription: string) {
  return post<SubmitResult>("/practice-submit", {
    sessionId,
    questionId: question.id,
    question: question.question,
    transcript,
    jobDescription,
  });
}

/** northbound's coach Lambda (resumeradar/backend/lambdas/coach): bullet rewrites and per-job tailoring. */
export function coachRewrite(bullets: string[], role?: string) {
  return post<{ suggestions: Rewrite[] }>("/coach", { mode: "rewrite", bullets, role });
}

export function coachTailor(resumeText: string, jobDescription: string, company: string, role: string) {
  return post<{ tailoring: Tailoring }>("/coach", { mode: "tailor", resumeText, jobDescription, company, role });
}

/* ------------------------------------------------------------ job descriptions */

const strip = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("br,p,li,div,h1,h2,h3,h4").forEach((el) => el.append("\n"));
  return (doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
};

/** Tries to pull the job description straight from the company's job board. Returns null when the board doesn't allow it. */
export async function fetchJobDescription(url: string): Promise<string | null> {
  try {
    let m = url.match(/greenhouse\.io\/(?:embed\/job_app\?for=)?([\w-]+)\/jobs\/(\d+)/) || url.match(/greenhouse\.io\/.*?for=([\w-]+).*?token=(\d+)/);
    if (m) {
      const r = await fetch(`https://boards-api.greenhouse.io/v1/boards/${m[1]}/jobs/${m[2]}`);
      if (r.ok) {
        const j = await r.json();
        const html = new DOMParser().parseFromString(j.content || "", "text/html").documentElement.textContent || "";
        return strip(html);
      }
    }
    m = url.match(/jobs\.lever\.co\/([\w-]+)\/([\w-]{36})/);
    if (m) {
      const r = await fetch(`https://api.lever.co/v0/postings/${m[1]}/${m[2]}`);
      if (r.ok) {
        const j = await r.json();
        const lists = (j.lists || []).map((l: { text: string; content: string }) => `${l.text}\n${strip(l.content)}`).join("\n\n");
        return [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n\n").trim();
      }
    }
    m = url.match(/jobs\.ashbyhq\.com\/([\w.-]+)\/([\w-]{36})/);
    if (m) {
      const r = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${m[1]}`);
      if (r.ok) {
        const j = await r.json();
        const job = (j.jobs || []).find((x: { id: string }) => x.id === m![2]);
        if (job) return job.descriptionPlain || strip(job.descriptionHtml || "");
      }
    }
  } catch {
    /* blocked by the board, fall back to pasting */
  }
  return null;
}

/* ------------------------------------------------------------ résumé PDFs */

export async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

type Line = { y: number; x: number; text: string; page: number };

/** Reads the PDF in the browser with pdf.js and returns its text plus the bullet points it finds. */
export async function readResumePdf(base64: string): Promise<{ text: string; bullets: string[] }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const doc = await pdfjs.getDocument({ data: bytes }).promise;
  const lines: Line[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const key = [...rows.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
      rows.set(key, [...(rows.get(key) ?? []), { x: item.transform[4], text: item.str }]);
    }
    [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([y, parts]) => {
        parts.sort((a, b) => a.x - b.x);
        lines.push({ y, x: parts[0].x, page: n, text: parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim() });
      });
  }
  const text = lines.map((l) => l.text).join("\n");
  return { text, bullets: extractBullets(lines) };
}

const BULLET_START = /^\s*[•●▪◦‣∙·*–-]\s*/;

function extractBullets(lines: Line[]): string[] {
  const out: string[] = [];
  let cur: { text: string; x: number } | null = null;
  const flush = () => {
    if (cur && cur.text.split(/\s+/).length >= 6) out.push(cur.text.trim());
    cur = null;
  };
  for (const l of lines) {
    if (BULLET_START.test(l.text)) {
      flush();
      cur = { text: l.text.replace(BULLET_START, ""), x: l.x };
    } else if (cur && l.x >= cur.x - 2 && !/^[A-Z][A-Z &]{3,}$/.test(l.text) && !/\b(19|20)\d\d\b.*$/.test(l.text.slice(-12))) {
      // wrapped continuation of the current bullet
      cur.text += " " + l.text;
    } else {
      flush();
    }
  }
  flush();
  return out;
}

/* ------------------------------------------------------------ local tailoring (instant, no AI) */

const STOP = new Set(
  "a an and are as at be by for from has have in into is it its of on or that the to was were will with you your we our this their they experience ability skills work team using use strong knowledge plus including such other".split(
    " ",
  ),
);

/** Which résumé bullets already speak to this job's missing/matched keywords, best first. */
export function rankBulletsForJob(bullets: string[], keywords: string[]): { bullet: string; hits: string[] }[] {
  const kws = keywords.map((k) => k.toLowerCase()).filter((k) => k && !STOP.has(k));
  return bullets
    .map((b) => {
      const low = b.toLowerCase();
      return { bullet: b, hits: kws.filter((k) => low.includes(k)) };
    })
    .sort((a, b) => b.hits.length - a.hits.length);
}
