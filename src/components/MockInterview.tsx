"use client";

import { useEffect, useRef, useState } from "react";
import { confetti, toast } from "@/components/fx";
import { ScoreRing } from "@/components/FitResult";
import { practiceGenerate, practiceIcebreaker, practiceSubmit, RadarError, useMocks, useResume, type MockSession, type MockTurn } from "@/lib/radar";
import AnswerBox from "./AnswerBox";
import styles from "./prep-kit.module.css";

/** A text mock interview run by ResumeRadar's interviewer, grounded in your résumé and this job. */
export default function MockInterview({ mkey, company, role, jd }: { mkey: string; company: string; role: string; jd: string }) {
  const [resume] = useResume();
  const [mocks, setMocks] = useMocks();
  const session = mocks[mkey];
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [session?.turns.length]);

  const save = (s: MockSession) => setMocks((prev) => ({ ...prev, [mkey]: s }));

  async function start() {
    if (!resume) return;
    setBusy(true);
    setErr("");
    try {
      const r = await practiceGenerate(resume.base64, jd, company, role);
      save({
        sessionId: r.sessionId,
        key: mkey,
        company,
        role,
        jd,
        turns: [
          { who: "interviewer", kind: "greeting", text: r.greeting },
          { who: "interviewer", kind: "icebreaker", text: r.icebreaker },
        ],
        pending: { kind: "icebreaker" },
        queued: r.first_question,
        overallScore: null,
        done: false,
        startedAt: new Date().toISOString(),
      });
    } catch (e) {
      setErr(e instanceof RadarError ? e.message : "Couldn't start the interview. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!session || !session.pending || !answer.trim()) return;
    const text = answer.trim();
    setBusy(true);
    setErr("");
    const turns: MockTurn[] = [...session.turns, { who: "me", text }];
    save({ ...session, turns });
    setAnswer("");
    try {
      if (session.pending.kind === "icebreaker") {
        const r = await practiceIcebreaker(session.sessionId, text);
        const first = session.queued ?? { id: "q1", type: "behavioral" as const, question: "Tell me about a project you're proud of.", focus: "Ownership" };
        save({
          ...session,
          turns: [...turns, { who: "interviewer", kind: "transition", text: r.resume_transition }, { who: "interviewer", kind: "question", text: first.question, question: first }],
          pending: { kind: "question", question: first },
        });
      } else {
        const q = session.pending.question;
        const r = await practiceSubmit(session.sessionId, q, text, session.jd);
        const next: MockTurn[] = [...turns, { who: "feedback", score: r.score, feedback: r.feedback, tip: r.tip }];
        if (r.action === "close" || !r.nextQuestion) {
          next.push({ who: "interviewer", kind: "closing", text: r.closingMessage || "That's all I had. Thanks for your time today." });
          save({ ...session, turns: next, pending: null, overallScore: r.overallScore, done: true });
          if (r.overallScore >= 80) confetti(innerWidth / 2, innerHeight / 3, 90);
          toast(`Interview done. Overall ${r.overallScore}/100.`);
        } else {
          next.push({ who: "interviewer", kind: "question", text: r.nextQuestion.question, question: r.nextQuestion });
          save({ ...session, turns: next, pending: { kind: "question", question: r.nextQuestion }, overallScore: r.overallScore });
        }
      }
    } catch (e) {
      // put the answer back so nothing is lost
      save(session);
      setAnswer(text);
      setErr(e instanceof RadarError ? e.message : "That answer didn't go through. Try sending it again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setMocks((prev) => {
      const next = { ...prev };
      delete next[mkey];
      return next;
    });
    setAnswer("");
  }

  if (!session) {
    return (
      <div className={styles.mockStart}>
        <div>
          <strong>Mock interview for this role</strong>
          <p className="muted small">
            ResumeRadar&apos;s interviewer reads your résumé and this posting, then asks follow-ups based on what you say.
            Each answer gets a score and one tip.
          </p>
        </div>
        <button className="btn white" onClick={start} disabled={busy || !resume || jd.trim().length < 100}>
          {busy ? "Setting up…" : "Start mock interview"}
        </button>
        {!resume ? <p className={styles.err}>Upload your résumé on the Résumé page first.</p> : null}
        {resume && jd.trim().length < 100 ? <p className="muted small">Add the job description above to start.</p> : null}
        {err ? <p className={styles.err}>{err}</p> : null}
      </div>
    );
  }

  const answered = session.turns.filter((t) => t.who === "feedback").length;

  return (
    <div className={styles.mock}>
      <div className={styles.mockHead}>
        <span>
          <strong>Mock interview</strong>{" "}
          <span className="muted small">
            {answered} answer{answered === 1 ? "" : "s"} scored
          </span>
        </span>
        {session.overallScore != null ? <ScoreRing score={session.overallScore} size={44} /> : null}
        <button className="btn ghost" onClick={reset}>
          {session.done ? "New interview" : "Restart"}
        </button>
      </div>
      <div className={styles.chat} aria-live="polite">
        {session.turns.map((t, i) =>
          t.who === "interviewer" ? (
            <div key={i} className={styles.them}>
              {t.kind === "question" && t.question ? <span className={styles.focus}>{t.question.focus}</span> : null}
              <p>{t.text}</p>
            </div>
          ) : t.who === "me" ? (
            <div key={i} className={styles.me}>
              <p>{t.text}</p>
            </div>
          ) : (
            <div key={i} className={styles.feedback}>
              <ScoreRing score={t.score} size={46} />
              <div>
                <p>{t.feedback}</p>
                <p className={styles.tip}>
                  <strong>Try next time:</strong> {t.tip}
                </p>
              </div>
            </div>
          ),
        )}
        {busy ? <div className={styles.typing} aria-label="Interviewer is thinking"><i /><i /><i /></div> : null}
        <div ref={end} />
      </div>
      {session.pending ? (
        <AnswerBox value={answer} onChange={setAnswer} onSubmit={send} busy={busy} timer={session.pending.kind === "question"} />
      ) : null}
      {err ? <p className={styles.err}>{err}</p> : null}
    </div>
  );
}
