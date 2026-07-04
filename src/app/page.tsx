"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  Ban,
  BarChart3,
  Bell,
  BookOpenCheck,
  CheckCircle2,
  Clock10,
  EyeOff,
  Flame,
  GraduationCap,
  LogIn,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Trash2,
  Trophy,
  UploadCloud,
  UserPlus,
  UsersRound,
} from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabaseClient";

const TOTAL_TIME = 10 * 60; // 10 minutes in seconds
const SESSION_STORAGE_KEY = "pulse-quiz-session-v1";
const TEACHER_PIN = "4310";
const softCap = 10;

type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
};

type Quiz = {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  publishedAt: string;
};

type StudentResult = {
  id: string;
  quizId: string;
  studentName: string;
  score: number;
  total: number;
  percentage: number;
  submittedAt: string;
  duration: number;
  answers: number[];
  reason: "manual" | "timeout";
};

type StudentUser = {
  name: string;
  password: string;
};

type Session = {
  role: "teacher" | "student";
  name: string;
};

const buildId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createEmptyQuestion = (): QuizQuestion => ({
  id: buildId(),
  prompt: "",
  options: ["", "", "", ""],
  answerIndex: 0,
});

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

// ---- anti-cheat ----
function useAntiCheat(
  enabled: boolean,
  containerRef: React.RefObject<HTMLElement | null>
) {
  const [violation, setViolation] = useState<"screenshot" | "copy" | null>(
    null
  );
  const [erasing, setErasing] = useState(false);
  const [focused, setFocused] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const focusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearViolation = useCallback(() => setViolation(null), []);

  const trigger = useCallback(
    (type: "screenshot" | "copy") => {
      if (!enabled) return;
      setViolation(type);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(clearViolation, 3200);
    },
    [enabled, clearViolation]
  );

  const triggerErase = useCallback(() => {
    if (!enabled) return;
    setErasing(true);
    trigger("copy");
    setTimeout(() => setErasing(false), 750);
  }, [enabled, trigger]);

  useEffect(() => {
    if (!enabled) {
      setFocused(true);
      return;
    }

    setFocused(document.hasFocus());

    focusIntervalRef.current = setInterval(() => {
      const nowFocused = document.hasFocus();
      setFocused((prev) => {
        if (prev && !nowFocused) trigger("screenshot");
        return nowFocused;
      });
    }, 300);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        e.preventDefault();
        trigger("screenshot");
      }
      if (
        e.metaKey &&
        e.shiftKey &&
        (e.key === "4" || e.key === "5")
      ) {
        e.preventDefault();
        trigger("screenshot");
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "c" || e.key === "C")
      ) {
        const sel = window.getSelection()?.toString() ?? "";
        if (sel.length > 0) {
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
          triggerErase();
        }
      }
    };

    const onVisibility = () => {
      if (document.hidden) trigger("screenshot");
    };

    const onBlur = () => trigger("screenshot");

    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);

    const el = containerRef.current;
    const onCopyCut = (e: Event) => {
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      triggerErase();
    };
    const onCtx = (e: Event) => {
      e.preventDefault();
      trigger("copy");
    };
    const onSelect = (e: Event) => {
      e.preventDefault();
      triggerErase();
    };

    if (el) {
      el.addEventListener("copy", onCopyCut);
      el.addEventListener("cut", onCopyCut);
      el.addEventListener("contextmenu", onCtx);
      el.addEventListener("selectstart", onSelect);
    }

    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      if (el) {
        el.removeEventListener("copy", onCopyCut);
        el.removeEventListener("cut", onCopyCut);
        el.removeEventListener("contextmenu", onCtx);
        el.removeEventListener("selectstart", onSelect);
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, trigger, triggerErase, containerRef]);

  return { violation, erasing, focused, clearViolation };
}

function AntiCheatOverlay({
  type,
  onDismiss,
}: {
  type: "screenshot" | "copy";
  onDismiss: () => void;
}) {
  return (
    <motion.div
      className="anti-cheat-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      <motion.div
        className="glass-panel relative flex max-w-md flex-col items-center gap-5 p-10 text-center"
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
          transition={{ duration: 0.55, repeat: 2 }}
        >
          {type === "screenshot" ? (
            <EyeOff className="h-14 w-14 text-rose-400" />
          ) : (
            <Ban className="h-14 w-14 text-amber-400" />
          )}
        </motion.div>
        <div>
          <motion.h3
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {type === "screenshot"
              ? "Screenshots not allowed"
              : "Copying not allowed"}
          </motion.h3>
          <motion.p
            className="mt-2 text-sm text-white/70"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            {type === "screenshot"
              ? "Screen capture attempts are blocked during the quiz. Stay focused."
              : "Text selection and copying are disabled. Characters erase on attempt."}
          </motion.p>
        </div>
        <motion.div
          className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: 3.2, ease: "linear" }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);

  // ---- auth ----
  const [session, setSession] = useState<Session | null>(null);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [authMode, setAuthMode] = useState<
    "student-login" | "student-register" | "teacher"
  >("student-login");
  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [teacherPinInput, setTeacherPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // ---- quiz data ----
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);

  // ---- teacher builder ----
  const [title, setTitle] = useState("Pulse Quiz");
  const [description, setDescription] = useState(
    "A 10-minute sprint of multiple-choice mastery."
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    createEmptyQuestion(),
  ]);
  const [builderMessage, setBuilderMessage] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  // ---- student attempt ----
  const [quizPhase, setQuizPhase] = useState<"intro" | "taking" | "results">(
    "intro"
  );
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [latestAttempt, setLatestAttempt] = useState<StudentResult | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef<number[]>([]);
  const quizContainerRef = useRef<HTMLDivElement>(null);
  const { violation, erasing, focused, clearViolation } = useAntiCheat(
    quizPhase === "taking",
    quizContainerRef
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // hydrate session from localStorage (device-specific)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    startTransition(() => {
      if (storedSession) setSession(JSON.parse(storedSession));
      setHydrated(true);
    });
  }, []);

  // sync shared data (quiz, results, roster) from Supabase and poll for updates
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    let active = true;
    const syncFromSupabase = async () => {
      const [quizRes, resultRes, studentRes] = await Promise.all([
        client
          .from("quizzes")
          .select("payload, published_at")
          .order("published_at", { ascending: false })
          .limit(1),
        client
          .from("results")
          .select("*")
          .order("submitted_at", { ascending: false })
          .limit(200),
        client
          .from("students")
          .select("name, password")
          .order("name", { ascending: true }),
      ]);

      if (!active) return;

      if (!quizRes.error) {
        const row = quizRes.data?.[0];
        setQuiz(row ? (row.payload as Quiz) : null);
      }

      if (!resultRes.error && resultRes.data) {
        setResults(
          resultRes.data.map((record) => ({
            id: record.id,
            quizId: record.quiz_id,
            studentName: record.student_name,
            score: record.score,
            total: record.total,
            percentage: record.percentage,
            submittedAt: record.submitted_at,
            duration: record.duration,
            answers: record.answers ?? [],
            reason: record.reason,
          }))
        );
      }

      if (!studentRes.error && studentRes.data) {
        setStudents(
          studentRes.data.map((record) => ({
            name: record.name,
            password: record.password,
          }))
        );
      }
    };

    syncFromSupabase();
    const interval = setInterval(syncFromSupabase, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [session, hydrated]);

  useEffect(() => {
    if (!builderMessage) return;
    const timeout = setTimeout(() => setBuilderMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [builderMessage]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSubmit = async (reason: "manual" | "timeout" = "manual") => {
    if (!quiz || !session) return;
    const current = answersRef.current.length
      ? answersRef.current
      : Array(quiz.questions.length).fill(-1);

    const correctCount = quiz.questions.reduce((count, question, index) => {
      if (current[index] === question.answerIndex) return count + 1;
      return count;
    }, 0);

    const percentage = Math.round((correctCount / quiz.questions.length) * 100);

    const attempt: StudentResult = {
      id: buildId(),
      quizId: quiz.id,
      studentName: session.name,
      score: correctCount,
      total: quiz.questions.length,
      percentage,
      submittedAt: new Date().toISOString(),
      duration: TOTAL_TIME - timeLeft,
      answers: current,
      reason,
    };

    setResults((prev) => [attempt, ...prev].slice(0, 100));
    setLatestAttempt(attempt);
    setQuizPhase("results");
    stopTimer();

    if (supabase) {
      const { error } = await supabase.from("results").insert({
        id: attempt.id,
        quiz_id: attempt.quizId,
        student_name: attempt.studentName,
        score: attempt.score,
        total: attempt.total,
        percentage: attempt.percentage,
        submitted_at: attempt.submittedAt,
        duration: attempt.duration,
        answers: attempt.answers,
        reason: attempt.reason,
      });
      if (error) console.error("Failed to save result", error);
    }
  };

  useEffect(() => {
    if (quizPhase !== "taking") {
      stopTimer();
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          handleSubmit("timeout");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return stopTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizPhase]);

  // ---- derived ----
  const answeredCount = useMemo(
    () => answers.filter((answer) => answer >= 0).length,
    [answers]
  );

  const averageScore = useMemo(() => {
    if (!results.length) return 0;
    const totalPercent = results.reduce((sum, e) => sum + e.percentage, 0);
    return Math.round(totalPercent / results.length);
  }, [results]);

  const bestScore = useMemo(() => {
    if (!results.length) return 0;
    return Math.max(...results.map((e) => e.percentage));
  }, [results]);

  const fastestTime = useMemo(() => {
    if (!results.length) return null;
    return Math.min(...results.map((e) => e.duration));
  }, [results]);

  const studentAttempt = useMemo(() => {
    if (!session || session.role !== "student" || !quiz) return null;
    return (
      results.find(
        (r) => r.quizId === quiz.id && r.studentName === session.name
      ) ?? null
    );
  }, [results, session, quiz]);

  const hasAttempted = Boolean(studentAttempt);
  const allAnswered = quiz ? answers.every((entry) => entry >= 0) : false;
  const timerProgress = ((TOTAL_TIME - timeLeft) / TOTAL_TIME) * 360;

  // ---- auth handlers ----
  const resetAuthFields = () => {
    setFormName("");
    setFormPassword("");
    setTeacherPinInput("");
    setAuthError(null);
  };

  const registerStudent = async () => {
    if (!supabase) {
      setAuthError("Supabase client missing. Configure env first.");
      return;
    }
    const name = formName.trim();
    const password = formPassword.trim();
    if (!name || !password) {
      setAuthError("Enter a name and password to register.");
      return;
    }
    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters.");
      return;
    }
    if (
      students.some((student) => student.name.toLowerCase() === name.toLowerCase())
    ) {
      setAuthError("That name is already registered. Try logging in.");
      return;
    }
    try {
      setAuthLoading(true);
      const { error } = await supabase
        .from("students")
        .insert({ name, password });
      if (error) {
        setAuthError(error.message || "Failed to register.");
        return;
      }
      setStudents((prev) => [...prev, { name, password }]);
      setSession({ role: "student", name });
      resetAuthFields();
    } catch (error) {
      console.error("Registration failed", error);
      setAuthError("Unexpected error while registering.");
    } finally {
      setAuthLoading(false);
    }
  };

  const loginStudent = async () => {
    if (!supabase) {
      setAuthError("Supabase client missing. Configure env first.");
      return;
    }
    const name = formName.trim();
    const password = formPassword.trim();
    if (!name || !password) {
      setAuthError("Enter both name and password.");
      return;
    }
    try {
      setAuthLoading(true);
      const match = students.find(
        (student) => student.name.toLowerCase() === name.toLowerCase()
      );
      if (!match) {
        setAuthError("No registration found. Create an account first.");
        return;
      }
      if (match.password !== password) {
        setAuthError("Invalid credentials. Try again.");
        return;
      }
      setSession({ role: "student", name: match.name });
      resetAuthFields();
    } catch (error) {
      console.error("Login failed", error);
      setAuthError("Unexpected error during login.");
    } finally {
      setAuthLoading(false);
    }
  };

  const loginTeacher = () => {
    if (teacherPinInput.trim() !== TEACHER_PIN) {
      setAuthError("Incorrect teacher PIN.");
      return;
    }
    setSession({ role: "teacher", name: "Teacher" });
    resetAuthFields();
  };

  const logout = () => {
    setSession(null);
    setQuizPhase("intro");
    setAnswers([]);
    setTimeLeft(TOTAL_TIME);
    setLatestAttempt(null);
    stopTimer();
    setAuthMode("student-login");
    resetAuthFields();
  };

  // ---- builder handlers ----
  const updateQuestionPrompt = (id: string, prompt: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, prompt } : q)));
  };

  const updateOption = (id: string, index: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              options: q.options.map((o, i) => (i === index ? value : o)),
            }
          : q
      )
    );
  };

  const setCorrectOption = (id: string, answerIndex: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, answerIndex } : q))
    );
  };

  const addQuestion = () => {
    if (questions.length >= softCap) {
      setBuilderMessage("Soft cap reached (10 questions).");
      return;
    }
    setQuestions((prev) => [...prev, createEmptyQuestion()]);
  };

  const removeQuestion = (id: string) => {
    setQuestions((prev) =>
      prev.length === 1 ? prev : prev.filter((q) => q.id !== id)
    );
  };

  const validateQuiz = (): Quiz | null => {
    const sanitized = questions
      .map((q) => {
        const trimmedOptions = q.options.map((o) => o.trim());
        const filledOptions = trimmedOptions.filter(Boolean);
        const correctText = trimmedOptions[q.answerIndex];
        const remappedIndex = filledOptions.findIndex((o) => o === correctText);
        return {
          ...q,
          prompt: q.prompt.trim(),
          options: filledOptions,
          answerIndex: remappedIndex >= 0 ? remappedIndex : 0,
        };
      })
      .filter((q) => q.prompt && q.options.length >= 2);

    if (!title.trim()) {
      setBuilderMessage("Add a quiz title before publishing.");
      return null;
    }
    if (!sanitized.length) {
      setBuilderMessage(
        "Add at least one question with a prompt and 2+ answer choices."
      );
      return null;
    }
    return {
      id: buildId(),
      title: title.trim(),
      description: description.trim() || "Multiple-choice lightning round.",
      publishedAt: new Date().toISOString(),
      questions: sanitized.map((q) => ({
        ...q,
        answerIndex: Math.min(Math.max(q.answerIndex, 0), q.options.length - 1),
      })),
    };
  };

  const publishQuiz = async () => {
    const next = validateQuiz();
    if (!next) return;
    try {
      if (supabase) {
        const deleteRes = await supabase.from("quizzes").delete().neq("id", "");
        if (deleteRes.error) {
          console.error("Failed to clear previous quiz", deleteRes.error);
          setBuilderMessage(
            `Publish failed while clearing old quiz: ${deleteRes.error.message}`
          );
          return;
        }
        const { error } = await supabase.from("quizzes").insert({
          id: next.id,
          payload: next,
          published_at: next.publishedAt,
        });
        if (error) {
          console.error("Failed to publish quiz", error);
          setBuilderMessage(`Publish failed: ${error.message}`);
          return;
        }
      }
      setQuiz(next);
      setBuilderMessage("Quiz published. Students see it within seconds.");
    } catch (err) {
      console.error("Unexpected error while publishing quiz", err);
      setBuilderMessage(
        `Unexpected error while publishing: ${
          err instanceof Error ? err.message : "check console for details"
        }`
      );
    }
  };

  const clearBuilder = () => {
    setTitle("Pulse Quiz");
    setDescription("A 10-minute sprint of multiple-choice mastery.");
    setQuestions([createEmptyQuestion()]);
    setBuilderMessage("Builder reset.");
  };

  const importQuizFromJson = (raw: string) => {
    const text = raw.trim();
    if (!text) {
      setBuilderMessage("Paste JSON or choose a file first.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setBuilderMessage("Invalid JSON. Check the format and try again.");
      return;
    }
    const data = parsed as {
      title?: unknown;
      description?: unknown;
      questions?: unknown;
    };
    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      setBuilderMessage('JSON must include a non-empty "questions" array.');
      return;
    }
    const mapped: QuizQuestion[] = [];
    for (const [i, entry] of data.questions.entries()) {
      const item = entry as {
        prompt?: unknown;
        options?: unknown;
        answerIndex?: unknown;
        answer?: unknown;
      };
      const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
      const options = Array.isArray(item.options)
        ? item.options.map((o) => String(o).trim())
        : [];
      if (!prompt || options.length < 2 || options.some((o) => !o)) {
        setBuilderMessage(
          `Question ${i + 1} is incomplete: needs a prompt and at least 2 non-empty options.`
        );
        return;
      }
      const rawIndex =
        typeof item.answerIndex === "number"
          ? item.answerIndex
          : typeof item.answer === "number"
          ? item.answer
          : 0;
      const answerIndex = Math.min(
        Math.max(Math.trunc(rawIndex), 0),
        options.length - 1
      );
      mapped.push({ id: buildId(), prompt, options, answerIndex });
    }
    if (typeof data.title === "string" && data.title.trim()) {
      setTitle(data.title.trim());
    }
    if (typeof data.description === "string" && data.description.trim()) {
      setDescription(data.description.trim());
    }
    setQuestions(mapped);
    setImportText("");
    setBuilderMessage(
      `Imported ${mapped.length} question${
        mapped.length > 1 ? "s" : ""
      }. Review, then publish.`
    );
  };

  const handleJsonFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importQuizFromJson(text);
    } catch {
      setBuilderMessage("Could not read that file. Try again.");
    } finally {
      event.target.value = "";
    }
  };

  const unpublishQuiz = async () => {
    if (supabase) await supabase.from("quizzes").delete().neq("id", "");
    setQuiz(null);
    setBuilderMessage("Quiz taken offline.");
  };

  const clearResults = async () => {
    if (supabase) await supabase.from("results").delete().neq("id", "");
    setResults([]);
    setLatestAttempt(null);
  };

  // ---- student attempt handlers ----
  const startQuiz = () => {
    if (!quiz || hasAttempted) return;
    setAnswers(Array(quiz.questions.length).fill(-1));
    setQuizPhase("taking");
    setTimeLeft(TOTAL_TIME);
    setLatestAttempt(null);
  };

  const handleSelectAnswer = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  // ===========================================================
  // RENDER
  // ===========================================================
  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/70">
        Loading…
      </div>
    );
  }

  const bubbles = (
    <>
      <motion.div
        className="floating-bubble"
        animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "10%", left: "10%" }}
      />
      <motion.div
        className="floating-bubble floating-bubble--cyan"
        animate={{ y: [0, 30, 0], x: [0, -25, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ bottom: "20%", right: "5%" }}
      />
    </>
  );

  // ---------- AUTH SCREEN ----------
  if (!session) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-12">
        {bubbles}
        <motion.div
          className="glass-panel pulse-border relative w-full max-w-md p-8"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm font-medium text-cyan-200">
              <Sparkles className="h-4 w-4" /> Pulse Quiz
            </span>
            <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
            <p className="text-sm text-slate-300">
              Sign in to take quizzes or manage them as a teacher.
            </p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-1 rounded-full bg-white/5 p-1 text-xs font-semibold uppercase tracking-[0.15em]">
            {([
              { key: "student-login", label: "Login" },
              { key: "student-register", label: "Register" },
              { key: "teacher", label: "Teacher" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setAuthMode(tab.key);
                  setAuthError(null);
                }}
                className={clsx(
                  "rounded-full px-3 py-2 transition",
                  authMode === tab.key
                    ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-white shadow-lg shadow-purple-500/30"
                    : "text-white/60 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={authMode}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {authMode === "teacher" ? (
                <label className="flex flex-col gap-2 text-sm text-white/70">
                  Teacher PIN
                  <input
                    type="password"
                    value={teacherPinInput}
                    onChange={(e) => {
                      setTeacherPinInput(e.target.value);
                      setAuthError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && loginTeacher()}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-cyan-400/40"
                    placeholder="Enter 4-digit PIN"
                  />
                </label>
              ) : (
                <>
                  <label className="flex flex-col gap-2 text-sm text-white/70">
                    Student name
                    <input
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        setAuthError(null);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-cyan-400/40"
                      placeholder="e.g. Aurora N."
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-white/70">
                    Password
                    <input
                      type="password"
                      value={formPassword}
                      onChange={(e) => {
                        setFormPassword(e.target.value);
                        setAuthError(null);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (authMode === "student-register"
                          ? registerStudent()
                          : loginStudent())
                      }
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-cyan-400/40"
                      placeholder="At least 8 characters"
                    />
                  </label>
                </>
              )}

              {authError && (
                <p className="flex items-center gap-2 text-sm text-rose-300">
                  <AlertCircle className="h-4 w-4" /> {authError}
                </p>
              )}

              {authMode === "teacher" && (
                <button
                  onClick={loginTeacher}
                  disabled={authLoading}
                  aria-busy={authLoading}
                  className={clsx(
                    "inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30",
                    authLoading && "cursor-not-allowed opacity-60"
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {authLoading ? "Checking…" : "Enter teacher cockpit"}
                </button>
              )}
              {authMode === "student-login" && (
                <button
                  onClick={loginStudent}
                  disabled={authLoading}
                  aria-busy={authLoading}
                  className={clsx(
                    "inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30",
                    authLoading && "cursor-not-allowed opacity-60"
                  )}
                >
                  <LogIn className="h-4 w-4" />
                  {authLoading ? "Signing in…" : "Login as student"}
                </button>
              )}
              {authMode === "student-register" && (
                <button
                  onClick={registerStudent}
                  disabled={authLoading}
                  aria-busy={authLoading}
                  className={clsx(
                    "inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30",
                    authLoading && "cursor-not-allowed opacity-60"
                  )}
                >
                  <UserPlus className="h-4 w-4" />
                  {authLoading ? "Creating…" : "Create student account"}
                </button>
              )}
            </motion.div>
          </AnimatePresence>

        </motion.div>
      </div>
    );
  }

  // ---------- APP SHELL ----------
  const header = (
    <header className="glass-panel flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-400 text-white">
          {session.role === "teacher" ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <GraduationCap className="h-5 w-5" />
          )}
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            {session.role === "teacher" ? "Teacher cockpit" : "Student lane"}
          </p>
          <p className="text-lg font-semibold text-white">{session.name}</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </header>
  );

  // ---------- TEACHER VIEW ----------
  if (session.role === "teacher") {
    return (
      <div className="relative min-h-screen w-full overflow-hidden pb-24">
        {bubbles}
        <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-10">
          {header}

          <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <motion.div
              className="glass-panel p-7"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <header className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                    Build &amp; publish
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    Design the quiz
                  </h2>
                </div>
                <button
                  onClick={clearBuilder}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.25em] text-white/70 transition hover:border-white/40"
                >
                  <RefreshCcw className="h-4 w-4" /> Reset form
                </button>
              </header>

              <div className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <UploadCloud className="h-5 w-5 text-cyan-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Import from JSON
                      </p>
                      <p className="text-xs text-white/50">
                        Paste JSON or upload a .json file to fill the builder
                        instantly, then review and publish.
                      </p>
                    </div>
                  </div>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 font-mono text-xs text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-cyan-400/40"
                    placeholder={
                      '{\n  "title": "Photosynthesis Sprint",\n  "description": "Quick check",\n  "questions": [\n    { "prompt": "2 + 2?", "options": ["3", "4", "5", "6"], "answerIndex": 1 }\n  ]\n}'
                    }
                  />
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => importQuizFromJson(importText)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      <BookOpenCheck className="h-4 w-4" /> Load into builder
                    </button>
                    <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/70 transition hover:border-white/40 hover:text-white">
                      <UploadCloud className="h-4 w-4" /> Upload .json file
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={handleJsonFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm text-white/70">
                    Quiz title
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-purple-500/40"
                      placeholder="e.g. Photosynthesis Sprint"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-white/70">
                    Subtitle / vibe
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-purple-500/40"
                      placeholder="Pitch the challenge in one sentence"
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <motion.div
                      key={question.id}
                      className="rounded-3xl border border-white/10 bg-slate-900/40 p-5"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.4 }}
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-white/40">
                            Question {index + 1}
                          </p>
                          <h3 className="text-lg font-semibold text-white">
                            Prompt + answers
                          </h3>
                        </div>
                        <button
                          onClick={() => removeQuestion(question.id)}
                          className="rounded-full border border-white/10 p-2 text-white/70 transition hover:border-white/40"
                          aria-label="Remove question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <textarea
                        value={question.prompt}
                        onChange={(e) =>
                          updateQuestionPrompt(question.id, e.target.value)
                        }
                        className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-cyan-400/40"
                        placeholder="Type the question stem"
                      />

                      <div className="mt-4 grid gap-3">
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={`${question.id}-${optionIndex}`}
                            className={clsx(
                              "flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3",
                              question.answerIndex === optionIndex
                                ? "border-cyan-400/70 bg-cyan-400/10"
                                : "border-white/10 bg-white/5"
                            )}
                          >
                            <span className="text-sm uppercase tracking-[0.3em] text-white/50">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                            <input
                              value={option}
                              onChange={(e) =>
                                updateOption(
                                  question.id,
                                  optionIndex,
                                  e.target.value
                                )
                              }
                              className="flex-1 bg-transparent text-white outline-none"
                              placeholder="Answer choice"
                            />
                            <button
                              onClick={() =>
                                setCorrectOption(question.id, optionIndex)
                              }
                              className={clsx(
                                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]",
                                question.answerIndex === optionIndex
                                  ? "bg-cyan-400 text-slate-900"
                                  : "bg-white/10 text-white/70"
                              )}
                            >
                              {question.answerIndex === optionIndex
                                ? "Correct"
                                : "Mark"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}

                  <button
                    onClick={addQuestion}
                    className="group flex w-full items-center justify-center gap-3 rounded-3xl border border-dashed border-white/20 bg-white/5 px-4 py-4 text-white/70 transition hover:border-white/50 hover:text-white"
                  >
                    <Plus className="h-5 w-5" /> Add another question
                  </button>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/5 pt-5 sm:flex-row">
                  <button
                    onClick={publishQuiz}
                    className="inline-flex flex-1 items-center justify-center gap-3 rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/40"
                  >
                    <UploadCloud className="h-5 w-5" /> Publish quiz for students
                  </button>
                  <button
                    onClick={() => setQuestions([createEmptyQuestion()])}
                    className="inline-flex flex-1 items-center justify-center gap-3 rounded-full border border-white/20 px-6 py-4 text-white/70 transition hover:border-white/60 hover:text-white"
                  >
                    <BookOpenCheck className="h-5 w-5" /> New blank question
                  </button>
                </div>

                {builderMessage && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                    {builderMessage}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div
              className="glass-panel flex flex-col gap-6 p-7"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/50">
                    Teacher radar
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    Live overview
                  </h3>
                </div>
                <BarChart3 className="h-6 w-6 text-cyan-300" />
              </div>

              {quiz ? (
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-white/80">
                  <p className="font-semibold text-white">{quiz.title}</p>
                  <p className="text-white/60">
                    {quiz.questions.length} questions · live for students
                  </p>
                  <button
                    onClick={unpublishQuiz}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Take offline
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  No quiz is live. Publish one to alert students.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs text-white/60">Questions live</p>
                  <p className="text-3xl font-semibold text-white">
                    {quiz?.questions.length ?? questions.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs text-white/60">Attempts logged</p>
                  <p className="text-3xl font-semibold text-white">
                    {results.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs text-white/60">Avg score</p>
                  <p className="text-3xl font-semibold text-white">
                    {averageScore}%
                  </p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/5 bg-slate-950/40 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-amber-300" />
                  <div>
                    <p className="text-sm text-white/60">Top performer</p>
                    <p className="text-lg font-semibold text-white">
                      {results[0]?.studentName ?? "Awaiting attempts"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-white/70 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-300" /> Best score
                    <span className="text-white">{bestScore}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TimerReset className="h-4 w-4 text-purple-300" /> Fastest
                    <span className="text-white">
                      {fastestTime !== null ? formatTime(fastestTime) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                  Leaderboard
                </p>
                {results.length > 0 && (
                  <button
                    onClick={clearResults}
                    className="inline-flex items-center gap-2 rounded-full border border-red-400/50 px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-red-200 transition hover:border-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {results.slice(0, 6).map((entry) => (
                  <motion.div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <div className="flex items-center justify-between text-sm text-white/70">
                      <span className="font-semibold text-white">
                        {entry.studentName}
                      </span>
                      <span>{formatTime(entry.duration)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                        {new Date(entry.submittedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="text-lg font-semibold text-cyan-200">
                        {entry.percentage}%
                      </span>
                    </div>
                  </motion.div>
                ))}
                {!results.length && (
                  <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                    Results stream in here once students submit.
                  </p>
                )}
              </div>
            </motion.div>
          </section>
        </main>
      </div>
    );
  }

  // ---------- STUDENT VIEW ----------
  return (
    <div className="relative min-h-screen w-full overflow-hidden pb-24">
      {bubbles}
      <main className="relative mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-10 lg:px-10">
        {header}

        {/* No quiz available */}
        {!quiz && (
          <motion.section
            className="glass-panel flex flex-col items-center gap-4 p-10 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Bell className="h-12 w-12 text-white/40" />
            <h2 className="text-2xl font-semibold text-white">
              No quiz yet
            </h2>
            <p className="max-w-md text-slate-300">
              When your teacher publishes a quiz, an alert will appear here.
              Keep this page open!
            </p>
          </motion.section>
        )}

        {/* Quiz alert / intro */}
        {quiz && quizPhase === "intro" && (
          <AnimatePresence mode="wait">
            {hasAttempted && studentAttempt ? (
              <motion.section
                key="attempted"
                className="glass-panel p-8"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                      Attempt complete
                    </p>
                    <h3 className="text-3xl font-semibold text-white">
                      {studentAttempt.percentage}% score
                    </h3>
                    <p className="text-white/70">
                      {studentAttempt.score} / {studentAttempt.total} correct ·{" "}
                      {formatTime(studentAttempt.duration)} elapsed
                    </p>
                  </div>
                  <Trophy className="h-12 w-12 text-amber-300" />
                </div>
                <p className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-amber-200/80">
                  You have one attempt per quiz, and it&apos;s been recorded.
                  Wait for your teacher to publish a new quiz.
                </p>
              </motion.section>
            ) : (
              <motion.section
                key="alert"
                className="glass-panel pulse-border p-8"
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
              >
                <motion.div
                  className="mb-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-4 py-1.5 text-sm font-semibold text-white"
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  <Bell className="h-4 w-4" /> New quiz available!
                </motion.div>
                <h2 className="text-3xl font-semibold text-white">
                  {quiz.title}
                </h2>
                <p className="mt-2 text-slate-300">{quiz.description}</p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      Questions
                    </p>
                    <p className="text-2xl font-semibold text-white">
                      {quiz.questions.length}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      Time limit
                    </p>
                    <p className="text-2xl font-semibold text-white">10:00</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                      Attempts
                    </p>
                    <p className="text-2xl font-semibold text-white">1 only</p>
                  </div>
                </div>

                <p className="mt-4 flex items-center gap-2 text-sm text-amber-200/80">
                  <AlertCircle className="h-4 w-4" /> You get a single attempt.
                  The 10-minute timer starts the moment you begin.
                </p>

                <button
                  onClick={startQuiz}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-5 py-4 text-lg font-semibold text-white shadow-lg shadow-purple-500/40"
                >
                  <Flame className="h-5 w-5" /> Start the 10-minute quiz
                </button>
              </motion.section>
            )}
          </AnimatePresence>
        )}

        {/* Taking the quiz */}
        {quiz && quizPhase === "taking" && (
          <div
            ref={quizContainerRef}
            className={clsx(
              "quiz-protected relative",
              erasing && "text-erase",
              !focused && "quiz-blurred"
            )}
          >
            <AnimatePresence>
              {violation && (
                <AntiCheatOverlay
                  type={violation}
                  onDismiss={clearViolation}
                />
              )}
            </AnimatePresence>
            {/* Student watermark overlay */}
            {session && (
              <div className="watermark" aria-hidden="true">
                <span>{session.name}</span>
                <span>{session.name}</span>
                <span>{session.name}</span>
                <span>{session.name}</span>
                <span>{session.name}</span>
                <span>{session.name}</span>
                <span>{session.name}</span>
                <span>{session.name}</span>
              </div>
            )}
            <section className="space-y-6">
            <div className="glass-panel sticky top-4 z-10 flex items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-4">
                <div
                  className="timer-ring"
                  style={{
                    background: `conic-gradient(#22d3ee ${timerProgress}deg, rgba(255,255,255,0.08) ${timerProgress}deg)`,
                  }}
                >
                  <div className="timer-ring-value">{formatTime(timeLeft)}</div>
                </div>
                <div className="text-sm text-white/70">
                  <p className="flex items-center gap-2">
                    <Clock10 className="h-4 w-4" /> Auto-submits at 00:00
                  </p>
                  <p>
                    Answered {answeredCount}/{quiz.questions.length}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleSubmit("manual")}
                disabled={!allAnswered}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold",
                  allAnswered
                    ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-white"
                    : "cursor-not-allowed border border-white/10 text-white/40"
                )}
              >
                <CheckCircle2 className="h-5 w-5" /> Submit
              </button>
            </div>

            {quiz.questions.map((question, index) => (
              <motion.div
                key={question.id}
                className="glass-panel p-6"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
              >
                <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.35em] text-white/40">
                  <span>Question {index + 1}</span>
                  <span>
                    {answers[index] >= 0 ? "Answered" : "Pending"}
                  </span>
                </div>
                <h4 className="text-lg font-semibold text-white">
                  {question.prompt || `Untitled question ${index + 1}`}
                </h4>
                <div className="mt-4 grid gap-3">
                  {question.options.map((option, optionIndex) => (
                    <button
                      type="button"
                      key={`${question.id}-option-${optionIndex}`}
                      onClick={() => handleSelectAnswer(index, optionIndex)}
                      className={clsx(
                        "option-tile text-left text-white/90",
                        answers[index] === optionIndex && "is-selected"
                      )}
                    >
                      <span className="text-sm font-semibold text-white/70">
                        {String.fromCharCode(65 + optionIndex)}.
                      </span>
                      <span>{option}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}

            <button
              onClick={() => handleSubmit("manual")}
              disabled={!allAnswered}
              className={clsx(
                "inline-flex w-full items-center justify-center gap-3 rounded-full px-5 py-4 text-lg font-semibold",
                allAnswered
                  ? "bg-gradient-to-r from-purple-500 to-cyan-400 text-white"
                  : "cursor-not-allowed border border-white/10 text-white/40"
              )}
            >
              <CheckCircle2 className="h-5 w-5" /> Submit answers
            </button>
          </section>
          </div>
        )}

        {/* Results */}
        {quiz && quizPhase === "results" && latestAttempt && (
          <motion.section
            className="glass-panel bg-gradient-to-br from-purple-500/10 to-cyan-400/10 p-8"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                  Attempt saved
                </p>
                <h3 className="text-4xl font-semibold text-white">
                  {latestAttempt.percentage}%
                </h3>
                <p className="text-white/70">
                  {latestAttempt.score} / {latestAttempt.total} correct ·{" "}
                  {formatTime(latestAttempt.duration)} elapsed
                </p>
              </div>
              <Trophy className="h-14 w-14 text-amber-300" />
            </div>
            <div className="mt-4 grid gap-3 text-sm text-white/80 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Submitted at
                </p>
                <p className="text-base text-white">
                  {new Date(latestAttempt.submittedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Timer exit
                </p>
                <p className="text-base text-white">
                  {latestAttempt.reason === "manual"
                    ? "Submitted with time to spare"
                    : "Auto-locked at 00:00"}
                </p>
              </div>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-amber-200/80">
              <UsersRound className="h-4 w-4" /> This was your one attempt. Your
              score is on the teacher leaderboard.
            </p>
          </motion.section>
        )}
      </main>
    </div>
  );
}
