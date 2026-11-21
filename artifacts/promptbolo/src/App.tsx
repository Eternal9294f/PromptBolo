import { useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRefinePrompt } from '@workspace/api-client-react';
import { ArrowLeft, ArrowRight, AudioLines, Check, CheckCircle2, ChevronRight, Clipboard, Clock3, Mic, Pause, Play, RotateCcw, Sparkles, Square, Type, Volume2 } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

type Mode = 'saas' | 'creator' | 'weekend' | 'general';
type Stage = 'compose' | 'permission' | 'live' | 'review' | 'result';
type Draft = { id: string; sourceText: string; refinedPrompt?: string; mode: string; createdAt: string };
type RecognitionResult = { isFinal: boolean; [index: number]: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void;
};
const LOCAL_DRAFTS_KEY = 'promptbolo-recent-drafts';
const modes: { id: Mode; label: string; note: string; sample: string }[] = [
  { id: 'saas', label: 'SaaS', note: 'Product thinking, made precise', sample: 'Yaar, ek simple habit tracker app banana hai jo log actually daily use karein.' },
  { id: 'creator', label: 'Creator', note: 'For ideas worth sharing', sample: 'Mujhe ek newsletter likhna hai about building in public, thoda personal but useful.' },
  { id: 'weekend', label: 'Weekend build', note: 'Small idea, real momentum', sample: 'Weekend pe ek chota sa tool banana hai jo messy bookmarks ko organize kare.' },
  { id: 'general', label: 'Anything else', note: 'Your idea, your way', sample: 'I have a rough idea. Help me turn it into a clear prompt.' },
];
const hinglishHints = [
  { pattern: /\bmujhe\b/i, phrase: 'mujhe', meaning: 'I need / I want' },
  { pattern: /\bchahiye\b/i, phrase: 'chahiye', meaning: 'need / would like' },
  { pattern: /\bkaise\b/i, phrase: 'kaise', meaning: 'how' },
  { pattern: /\b(?:banana|banani|banayein|banao)\b/i, phrase: 'banana / banao', meaning: 'build / create' },
  { pattern: /\bkarna padega\b/i, phrase: 'karna padega', meaning: 'will need to' },
  { pattern: /\bpehle\b/i, phrase: 'pehle', meaning: 'first' },
];
function readDrafts(): Draft[] {
  try { const saved = localStorage.getItem(LOCAL_DRAFTS_KEY); return saved ? JSON.parse(saved) as Draft[] : []; } catch { return []; }
}
function Home() {
  const [stage, setStage] = useState<Stage>('compose');
  const [mode, setMode] = useState<Mode>('saas');
  const [sourceText, setSourceText] = useState('');
  const [liveText, setLiveText] = useState('');
  const [interim, setInterim] = useState('');
  const [refinedPrompt, setRefinedPrompt] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>(readDrafts);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'paused' | 'stopped' | 'error'>('idle');
  const [micError, setMicError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingStatusRef = useRef(recordingStatus);
  const mutation = useRefinePrompt();
  const selectedMode = modes.find((item) => item.id === mode) ?? modes[0];
  const wordCount = sourceText.trim() ? sourceText.trim().split(/\s+/).length : 0;
  const detectedHinglish = hinglishHints.filter((hint) => hint.pattern.test(sourceText));
  const updateRecordingStatus = (status: typeof recordingStatus) => {
    recordingStatusRef.current = status;
    setRecordingStatus(status);
  };

  useEffect(() => { localStorage.setItem(LOCAL_DRAFTS_KEY, JSON.stringify(drafts.slice(0, 8))); }, [drafts]);
  useEffect(() => {
    if (recordingStatus !== 'recording') return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recordingStatus]);
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const saveDraft = (text: string, result?: string) => {
    if (!text.trim()) return;
    setDrafts((current) => {
      const previous = current.find((draft) => draft.sourceText === text.trim());
      const draft: Draft = { id: previous?.id ?? `${Date.now()}`, sourceText: text.trim(), refinedPrompt: result ?? previous?.refinedPrompt, mode, createdAt: new Date().toISOString() };
      return [draft, ...current.filter((entry) => entry.id !== draft.id)].slice(0, 8);
    });
  };
  const beginVoice = () => {
    setMicError('');
    setLiveText(sourceText);
    setSeconds(0);
    updateRecordingStatus('idle');
    setStage('permission');
  };
  const requestMic = async () => {
    setMicError('');
    const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setMicError('Voice input is not supported in this browser. You can keep typing instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const recognition = new Recognition();
      recognition.lang = 'hi-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        if (finalText) setLiveText((previous) => `${previous}${previous && !previous.endsWith(' ') ? ' ' : ''}${finalText}`.trimStart());
        setInterim(interimText);
      };
      recognition.onerror = (event) => {
        const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone permission was blocked. Allow microphone access in your browser settings, or continue by typing.'
          : event.error === 'no-speech' ? 'We did not catch that. Try speaking a little closer to your mic.' : 'Voice recognition ran into a problem. Your captured words are still here.';
        setMicError(message);
        updateRecordingStatus('error');
      };
      recognition.onend = () => {
        if (recordingStatusRef.current === 'recording') updateRecordingStatus('stopped');
      };
      recognitionRef.current = recognition;
      setStage('live');
      updateRecordingStatus('recording');
      recognition.start();
    } catch {
      setMicError('Microphone access was denied or unavailable. Your work is safe—continue by typing, or check browser permissions.');
      updateRecordingStatus('error');
    }
  };
  const pauseVoice = () => { recognitionRef.current?.stop(); updateRecordingStatus('paused'); };
  const resumeVoice = () => {
    try { recognitionRef.current?.start(); updateRecordingStatus('recording'); setMicError(''); }
    catch { setMicError('Could not resume the microphone. Stop recording and try again.'); }
  };
  const stopVoice = () => { recognitionRef.current?.stop(); updateRecordingStatus('stopped'); setInterim(''); };
  const resetVoice = () => {
    recognitionRef.current?.abort(); recognitionRef.current = null;
    setLiveText(sourceText); setInterim(''); updateRecordingStatus('idle'); setSeconds(0); setMicError('');
    setStage('permission');
  };
  const reviewVoice = () => {
    recognitionRef.current?.stop();
    setInterim('');
    setSourceText(liveText.trim());
    saveDraft(liveText);
    setStage('review');
  };
  const refine = () => {
    const text = stage === 'review' ? sourceText.trim() : sourceText.trim();
    if (!text) return;
    saveDraft(text);
    mutation.mutate({ data: { sourceText: text, mode } }, {
      onSuccess: (result) => { setRefinedPrompt(result.refinedPrompt); saveDraft(text, result.refinedPrompt); setStage('result'); },
    });
  };
  const restart = () => {
    recognitionRef.current?.abort(); recognitionRef.current = null;
    setSourceText(''); setLiveText(''); setInterim(''); setRefinedPrompt(''); setSeconds(0);
    updateRecordingStatus('idle'); setMicError(''); setStage('compose');
  };
  const loadDraft = (draft: Draft) => {
    setMode(modes.some((item) => item.id === draft.mode) ? draft.mode as Mode : 'general');
    setSourceText(draft.sourceText); setLiveText(draft.sourceText);
    setRefinedPrompt(draft.refinedPrompt ?? '');
    setStage(draft.refinedPrompt ? 'result' : 'compose');
  };
  const copyPrompt = async () => {
    setCopyError('');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(refinedPrompt);
      } else {
        const fallback = document.createElement('textarea');
        fallback.value = refinedPrompt;
        fallback.setAttribute('readonly', '');
        fallback.style.position = 'fixed';
        fallback.style.opacity = '0';
        document.body.appendChild(fallback);
        fallback.select();
        const copiedSuccessfully = document.execCommand('copy');
        fallback.remove();
        if (!copiedSuccessfully) throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError('Copy is unavailable here. Select the prompt above and copy it manually.');
    }
  };
  const backToComposer = () => { if (stage === 'live') stopVoice(); setStage('compose'); };

  return (
    <main className="app-shell relative min-h-[100dvh] overflow-hidden text-[#25272b]">
      <div className="grain" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1080px] flex-col px-5 pb-12 sm:px-8">
        <header className="relative flex h-[76px] items-center justify-center border-b border-[#e9e5de]">
          <button data-testid="button-home-brand" onClick={restart} className="group flex items-center gap-2 text-left" aria-label="PromptBolo home">
            <span className="grid h-9 w-9 place-items-center rounded-[13px] bg-[#a91f35] text-white shadow-[0_5px_14px_rgba(169,31,53,.18)]"><AudioLines size={19} strokeWidth={2.5} /></span>
            <span className="flex flex-col items-start">
              <span className="font-[Manrope] text-[19px] font-extrabold leading-tight tracking-[-.7px]">Prompt<span className="text-[#a91f35]">Bolo</span></span>
              <span className="mt-0.5 text-[9px] font-medium uppercase leading-tight tracking-[.12em] text-[#96938b]">A writing companion for builders</span>
            </span>
          </button>
          {stage !== 'compose' && <button data-testid="button-back-composer" aria-label="Back to idea" onClick={backToComposer} className="absolute right-0 flex items-center gap-2 rounded-full px-2 py-2 text-sm text-[#77766f] transition hover:bg-white hover:text-[#282a2d] sm:px-3"><ArrowLeft size={16} /><span className="hidden sm:inline">Back to idea</span></button>}
        </header>

        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col">
          {stage === 'compose' && <section key="compose" className="page-in w-full pt-12 sm:pt-[72px]">
            <div className="mb-8 max-w-[610px]">
              <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.17em] text-[#9a293c]"><span className="h-px w-7 bg-[#ae273d]" /> Your thoughts, in your language</p>
              <h1 className="font-[Manrope] text-[38px] font-semibold leading-[1.12] tracking-[-1.8px] sm:text-[52px]">Bolo freely.<br /><span className="text-[#a91f35]">Build clearly.</span></h1>
              <p className="mt-4 max-w-[480px] text-[15px] leading-7 text-[#77766f]">Type the rough version or say it in Hinglish. We’ll help shape it into a prompt you can put to work.</p>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Choose a prompt context">
              {modes.map((item) => <button key={item.id} data-testid={`button-mode-${item.id}`} onClick={() => setMode(item.id)} className={`rounded-full border px-4 py-2 text-[13px] transition-all ${mode === item.id ? 'border-[#24262b] bg-[#24262b] text-white shadow-sm' : 'border-[#e7e2d9] bg-white/75 text-[#62615d] hover:border-[#c9bfb2]'}`}>{item.label}</button>)}
            </div>
            <div className="overflow-hidden rounded-[22px] border border-[#e6e0d7] bg-white shadow-[0_14px_40px_rgba(49,43,33,.055)]">
              <div className="flex items-center justify-between border-b border-[#f0ede8] px-5 py-4 sm:px-7">
                <div><p className="text-[11px] font-semibold uppercase tracking-[.13em] text-[#a3263b]">Prompt room <span className="px-1 text-[#c3bfb7]">/</span> {selectedMode.label}</p><p className="mt-1 text-xs text-[#99958d]">{selectedMode.note}</p></div>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f8f4f0] text-[#a3263b]"><Type size={16} /></span>
              </div>
              <textarea data-testid="input-source-prompt" aria-label="Your rough idea" maxLength={12000} value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="Bolo ya type karo… What are you building today?" className="min-h-[210px] w-full resize-y border-0 bg-transparent px-5 py-5 text-[16px] leading-7 text-[#292a2e] outline-none placeholder:text-[#b8b4ac] focus:ring-0 sm:min-h-[250px] sm:px-7" />
              <div className="flex flex-col gap-4 border-t border-[#f0ede8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#99958d]">Try a starting point</span>
                  <button data-testid="button-example-idea" onClick={() => setSourceText(selectedMode.sample)} className="rounded-full bg-[#f7f3ed] px-3 py-1.5 text-xs text-[#6c645b] transition hover:bg-[#f0e8df]">“{selectedMode.sample.slice(0, 34)}…”</button>
                  <button data-testid="button-clear-idea" onClick={() => setSourceText('')} className="rounded-full px-2 py-1.5 text-xs text-[#9b958b] hover:text-[#a91f35]">Clear</button>
                </div>
                <span data-testid="text-word-count" className="font-mono text-[11px] text-[#96938b]">{wordCount} words <span className="px-1 text-[#d1ccc3]">·</span> {sourceText.length}/12000</span>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button data-testid="button-start-voice" onClick={beginVoice} className="flex items-center justify-center gap-2 rounded-full border border-[#ded8ce] bg-white/70 px-5 py-3 text-sm font-medium text-[#494943] transition hover:border-[#a91f35] hover:text-[#a91f35]"><Mic size={16} /> Speak in Hinglish</button>
              <button data-testid="button-refine-prompt" disabled={!sourceText.trim() || mutation.isPending} onClick={refine} className="flex items-center justify-center gap-2 rounded-full bg-[#a91f35] px-6 py-3 text-sm font-semibold text-white shadow-[0_7px_18px_rgba(169,31,53,.2)] transition hover:bg-[#94182d] disabled:cursor-not-allowed disabled:opacity-45">{mutation.isPending ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> Finding the shape…</> : <><Sparkles size={16} /> Shape this into a prompt <ArrowRight size={15} /></>}</button>
            </div>
            {mutation.isError && <p data-testid="status-refine-error" role="alert" className="mt-3 rounded-xl border border-[#edc8c8] bg-[#fff4f2] px-4 py-3 text-sm text-[#9e2637]">We couldn’t refine that just now. Your idea is saved here—please try again.</p>}
            {drafts.length > 0 && <div className="mt-12 border-t border-[#e9e5de] pt-6">
              <div className="mb-4 flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-[#a3263b]">Keep the thread</p><h2 className="mt-1 font-[Manrope] text-[18px] font-bold tracking-[-.4px]">Recent ideas</h2></div><span className="text-xs text-[#99958d]">Saved in this browser</span></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {drafts.slice(0, 4).map((draft) => <button key={draft.id} data-testid={`button-load-draft-${draft.id}`} onClick={() => loadDraft(draft)} className="group flex min-w-0 items-center justify-between rounded-[15px] border border-[#e8e3db] bg-white/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#d5c7bb] hover:shadow-[0_8px_20px_rgba(40,35,29,.06)]"><span className="min-w-0"><span className="mb-1 block font-mono text-[9px] uppercase tracking-[.13em] text-[#a3263b]">{draft.mode} <span className="px-1 text-[#ccc5bb]">/</span> {new Date(draft.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span data-testid={`text-draft-preview-${draft.id}`} className="block truncate text-[13px] text-[#514f4a]">{draft.sourceText}</span></span><ChevronRight size={16} className="ml-3 shrink-0 text-[#aaa49a] transition group-hover:translate-x-0.5 group-hover:text-[#a91f35]" /></button>)}
              </div>
            </div>}
            <p className="mt-8 text-center text-[11px] text-[#aaa59b]">Your browser handles voice recognition. Transcript text goes to OpenAI only when you choose to refine.</p>
          </section>}

          {stage === 'permission' && <section key="permission" className="page-in mx-auto w-full max-w-[590px] pt-12 sm:pt-[78px]">
            <div className="mb-7 text-center"><span className="mx-auto mb-5 grid h-[62px] w-[62px] place-items-center rounded-[22px] bg-[#f8e9eb] text-[#a91f35]"><Mic size={26} /></span><p className="mb-3 font-mono text-[10px] uppercase tracking-[.17em] text-[#a3263b]">A quick heads-up</p><h1 className="font-[Manrope] text-[34px] font-semibold tracking-[-1.2px] sm:text-[42px]">Make space for your voice.</h1><p className="mx-auto mt-4 max-w-[420px] text-[15px] leading-7 text-[#77766f]">PromptBolo will ask your browser for microphone access only after you choose to speak. Say it naturally—Hindi, English, or both.</p></div>
            <div className="rounded-[20px] border border-[#e6e0d7] bg-white p-5 shadow-[0_10px_28px_rgba(49,43,33,.05)] sm:p-6">
              <div className="flex gap-4 rounded-[14px] bg-[#f8f5f0] p-4"><span className="mt-0.5 text-[#a3263b]"><CheckCircle2 size={19} /></span><div><p className="text-sm font-semibold">Your voice stays yours</p><p className="mt-1 text-[13px] leading-5 text-[#77766f]">Your browser may use its speech service to transcribe audio. PromptBolo doesn’t record or store it. Transcript text goes to OpenAI only when you choose to polish.</p></div></div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row"><button data-testid="button-grant-microphone" onClick={requestMic} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#a91f35] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#94182d]"><Mic size={16} /> Allow microphone & speak</button><button data-testid="button-type-instead" onClick={() => setStage('compose')} className="rounded-full border border-[#e3ddd4] px-5 py-3.5 text-sm font-medium text-[#5f5c56] transition hover:bg-[#f8f5f0]">I’ll type instead</button></div>
              {micError && <p data-testid="status-microphone-error" role="alert" className="mt-4 rounded-xl border border-[#edc8c8] bg-[#fff4f2] p-3 text-[13px] leading-5 text-[#9e2637]">{micError}</p>}
              {!micError && <p className="mt-4 text-center text-[11px] text-[#a39e95]">You can revoke access anytime in your browser settings.</p>}
            </div>
          </section>}

          {stage === 'live' && <section key="live" className="page-in w-full pt-10 sm:pt-14">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#a3263b]"><span className={`h-2 w-2 rounded-full ${recordingStatus === 'recording' ? 'bg-[#a91f35]' : 'bg-[#bcb6ab]'}`} /> {recordingStatus === 'recording' ? 'Listening, at your pace' : recordingStatus === 'paused' ? 'Paused' : 'Capture stopped'}</p><h1 className="font-[Manrope] text-[34px] font-semibold tracking-[-1.2px] sm:text-[42px]">Just say the rough part.</h1></div><span className="font-mono text-xs text-[#88847d]">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span></div>
            <div className="rounded-[22px] border border-[#e6e0d7] bg-white p-5 shadow-[0_14px_36px_rgba(49,43,33,.055)] sm:p-7">
              <div className="mb-5 flex items-center justify-between border-b border-[#f0ede8] pb-4"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.1em] text-[#5c5a55]"><Volume2 size={15} className="text-[#a3263b]" /> Hinglish live capture</span><div className="meter flex h-7 items-center gap-[3px]">{Array.from({ length: 15 }, (_, index) => <span key={index} className={`h-5 w-[3px] origin-center rounded-full ${recordingStatus === 'recording' ? 'bg-[#a91f35]' : 'bg-[#d8d1c6]'}`} />)}</div></div>
              <div className="min-h-[175px] text-[18px] leading-[1.8] text-[#343438] sm:min-h-[205px] sm:text-[20px]"><span data-testid="text-live-transcript">{liveText || <span className="text-[#aaa69f]">Your words will appear here. Start anywhere—no need to translate first.</span>}</span>{interim && <span data-testid="text-live-interim" className="text-[#a91f35]"> {interim}</span>}{recordingStatus === 'recording' && <span className="ml-1 inline-block h-5 w-[2px] translate-y-1 animate-pulse bg-[#a91f35]" />}</div>
              {micError && <p data-testid="status-live-error" role="alert" className="mt-4 rounded-xl border border-[#edc8c8] bg-[#fff4f2] p-3 text-[13px] text-[#9e2637]">{micError}</p>}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0ede8] pt-5">
                <button data-testid="button-reset-recording" onClick={resetVoice} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[#706e68] hover:bg-[#f7f3ed]"><RotateCcw size={15} /> Reset</button>
                <div className="flex flex-wrap gap-2">
                  {recordingStatus === 'recording' && <button data-testid="button-pause-recording" onClick={pauseVoice} className="flex items-center gap-2 rounded-full border border-[#e5dfd6] px-4 py-2.5 text-sm text-[#514f4a]"><Pause size={15} /> Pause</button>}
                  {recordingStatus === 'paused' && <button data-testid="button-resume-recording" onClick={resumeVoice} className="flex items-center gap-2 rounded-full border border-[#e5dfd6] px-4 py-2.5 text-sm text-[#514f4a]"><Play size={15} /> Resume</button>}
                  {recordingStatus === 'recording' && <button data-testid="button-stop-recording" onClick={stopVoice} className="flex items-center gap-2 rounded-full bg-[#292b30] px-4 py-2.5 text-sm font-medium text-white"><Square size={13} /> Stop</button>}
                  {recordingStatus === 'stopped' && <button data-testid="button-record-again" onClick={resumeVoice} className="flex items-center gap-2 rounded-full border border-[#e5dfd6] px-4 py-2.5 text-sm text-[#514f4a]"><Mic size={15} /> Record more</button>}
                  <button data-testid="button-review-transcript" onClick={reviewVoice} disabled={!liveText.trim()} className="flex items-center gap-2 rounded-full bg-[#a91f35] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#94182d] disabled:opacity-40">Review words <ArrowRight size={15} /></button>
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-[#9a968d]">No perfect sentences required. Keep the product words exactly as you use them.</p>
          </section>}

          {stage === 'review' && <section key="review" className="page-in w-full pt-10 sm:pt-14">
            <div className="mb-7"><p className="mb-2 font-mono text-[10px] uppercase tracking-[.16em] text-[#a3263b]">Your words / ready for a pass</p><h1 className="font-[Manrope] text-[34px] font-semibold tracking-[-1.2px] sm:text-[42px]">Make it sound like you.</h1><p className="mt-3 text-sm leading-6 text-[#77766f]">Clean up anything the transcript missed. Keep the Hinglish, edit a term, or add the context you meant.</p></div>
            {detectedHinglish.length > 0 && <div data-testid="panel-hinglish-corrections" className="mb-4 rounded-[16px] border border-[#e7dfd4] bg-[#fbf8f3] p-4">
              <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#514a43]"><Sparkles size={14} className="text-[#a3263b]" /> Possible Hinglish meanings</p>
              <p className="mb-3 text-xs leading-5 text-[#888178]">These are context-dependent cues, not automatic replacements. Edit your words below; polishing will translate the full thought.</p>
              <div className="flex flex-wrap gap-2">{detectedHinglish.map((hint) => <span key={hint.phrase} data-testid={`hint-hinglish-${hint.phrase}`} className="rounded-full border border-[#e8ded3] bg-white px-3 py-1.5 text-[11px] text-[#655e55]"><strong className="font-semibold text-[#a3263b]">{hint.phrase}</strong><span className="px-1.5 text-[#c9c0b5]">→</span>{hint.meaning}</span>)}</div>
            </div>}
            <div className="overflow-hidden rounded-[22px] border border-[#e6e0d7] bg-white shadow-[0_14px_36px_rgba(49,43,33,.055)]">
              <div className="flex items-center justify-between border-b border-[#f0ede8] px-5 py-4 sm:px-7"><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.1em] text-[#5c5a55]"><AudioLines size={15} className="text-[#a3263b]" /> Rough idea, editable</span><span data-testid="status-editable-transcript" className="rounded-full bg-[#f8f5f0] px-3 py-1 text-[11px] text-[#827d74]">Tap to edit</span></div>
              <textarea data-testid="input-edit-transcript" aria-label="Edit your captured transcript" maxLength={12000} value={sourceText} onChange={(event) => { setSourceText(event.target.value); setLiveText(event.target.value); }} className="min-h-[220px] w-full resize-y border-0 bg-transparent px-5 py-5 text-[17px] leading-[1.8] outline-none focus:ring-0 sm:min-h-[250px] sm:px-7" />
              <div className="flex flex-col-reverse gap-3 border-t border-[#f0ede8] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7"><button data-testid="button-record-more" onClick={beginVoice} className="flex items-center justify-center gap-2 rounded-full border border-[#ded8ce] px-5 py-3 text-sm text-[#55534e] hover:border-[#a91f35] hover:text-[#a91f35]"><Mic size={15} /> Add more by voice</button><button data-testid="button-refine-from-review" disabled={!sourceText.trim() || mutation.isPending} onClick={refine} className="flex items-center justify-center gap-2 rounded-full bg-[#a91f35] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#94182d] disabled:opacity-45">{mutation.isPending ? 'Shaping your prompt…' : <><Sparkles size={15} /> Polish this prompt <ArrowRight size={15} /></>}</button></div>
            </div>
            {mutation.isError && <p data-testid="status-review-error" role="alert" className="mt-3 rounded-xl border border-[#edc8c8] bg-[#fff4f2] px-4 py-3 text-sm text-[#9e2637]">Refinement didn’t go through. Your edited transcript is safe—try once more.</p>}
            <div className="mt-5 flex flex-wrap gap-2">{['Keep my intent', 'Use product language', 'Make the ask specific'].map((tag) => <span key={tag} className="rounded-full border border-[#e8e3db] bg-white/60 px-3 py-1.5 text-[11px] text-[#817c72]">{tag}</span>)}</div>
          </section>}

          {stage === 'result' && <section key="result" className="page-in w-full pt-9 sm:pt-12">
            <div className="mb-6 flex items-center gap-4 rounded-[18px] border border-[#e2ded4] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(49,43,33,.04)]"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#eaf1e9] text-[#4b7658]"><CheckCircle2 size={21} /></span><div><p data-testid="status-prompt-ready" className="font-[Manrope] text-[15px] font-bold">Your thought, now ready to build on.</p><p className="mt-0.5 text-xs text-[#89857c]">Refined from your original idea <span className="px-1 text-[#d0c9bf]">·</span> {selectedMode.label} context</p></div><span className="ml-auto hidden items-center gap-1 text-[11px] text-[#817d74] sm:flex"><Check size={13} className="text-[#4b7658]" /> Ready</span></div>
            <div className="rounded-[22px] border border-[#e6e0d7] bg-white p-5 shadow-[0_14px_36px_rgba(49,43,33,.055)] sm:p-7">
              <div className="mb-5 flex items-center justify-between"><span className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[.15em] text-[#a3263b]"><Sparkles size={14} /> Refined prompt</span><span data-testid="text-result-word-count" className="font-mono text-[10px] text-[#99958d]">{refinedPrompt.trim() ? refinedPrompt.trim().split(/\s+/).length : 0} words</span></div>
              <div data-testid="text-refined-prompt" className="whitespace-pre-wrap rounded-[16px] bg-[#f8f5f0] p-5 text-[16px] leading-[1.8] text-[#343438] sm:p-6 sm:text-[17px]">{refinedPrompt}</div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[15px] border border-[#eeeae3] p-4"><p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.13em] text-[#9b958b]"><AudioLines size={13} className="text-[#a3263b]" /> Your original</p><p data-testid="text-original-context" className="line-clamp-4 text-[13px] leading-6 text-[#6f6b64]">{sourceText}</p></div>
                <div className="rounded-[15px] border border-[#eeeae3] p-4"><p className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.13em] text-[#9b958b]"><Sparkles size={13} className="text-[#a3263b]" /> What got clearer</p><p data-testid="text-refinement-context" className="text-[13px] leading-6 text-[#6f6b64]">The polished version makes the ask clearer. Check it against your original before using it.</p></div>
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button data-testid="button-copy-prompt" onClick={copyPrompt} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#a91f35] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#94182d]">{copied ? <><Check size={16} /> Copied to clipboard</> : <><Clipboard size={16} /> Copy prompt</>}</button>
                <button data-testid="button-edit-original" onClick={() => setStage('review')} className="flex items-center justify-center gap-2 rounded-full border border-[#e1dbd1] px-5 py-3.5 text-sm text-[#55534e] transition hover:bg-[#f8f5f0]"><Type size={15} /> Edit original</button>
              </div>
              {copyError && <p data-testid="status-copy-error" role="status" className="mt-3 text-center text-xs text-[#9e2637]">{copyError}</p>}
              <div className="mt-6 border-t border-[#f0ede8] pt-5 text-center"><button data-testid="button-restart" onClick={restart} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[#77736b] transition hover:bg-[#f8f5f0] hover:text-[#a91f35]"><RotateCcw size={14} /> Start a new thought</button></div>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-[#9a968d]"><Clock3 size={13} /> This idea is saved in your recent drafts on this device.</div>
          </section>}
        </div>
        <footer className="mt-10 flex items-center justify-between border-t border-[#e9e5de] py-5 text-[10px] uppercase tracking-[.13em] text-[#a39e95]"><span>PromptBolo <span className="px-1 text-[#c9c2b8]">/</span> Think in your own words</span><span className="hidden sm:inline">Less translating. More building.</span></footer>
      </div>
    </main>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
