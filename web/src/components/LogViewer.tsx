import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Check, ExternalLink } from 'lucide-react';
import type { ExecutionLog, LogKind } from '../types';
import { subscribeExecutionLogs } from '../api/client';

interface LogViewerProps {
  executionId: string;
  initialLogs: ExecutionLog[];
  showOpenButton?: boolean;
}

const kindStyles: Record<LogKind, string> = {
  message: 'text-zinc-300',
  error: 'text-red-400',
  tool_call: 'text-amber-400',
  plan: 'text-blue-400',
  thought: 'text-zinc-500 italic',
  system: 'text-zinc-500',
  permission: 'text-purple-400',
};

// Strip ANSI escape sequences (colors, cursor moves, etc.)
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

// Render a log payload as a single inline line (no pretty-printed objects).
function formatPayload(payload: unknown): string {
  if (payload == null) return '';
  if (typeof payload === 'string') return stripAnsi(payload);
  // System stream logs: { stream, line } → show the raw line inline.
  if (
    typeof payload === 'object' &&
    'line' in (payload as Record<string, unknown>) &&
    'stream' in (payload as Record<string, unknown>)
  ) {
    return stripAnsi(String((payload as Record<string, unknown>).line));
  }
  try {
    return stripAnsi(JSON.stringify(payload));
  } catch {
    return stripAnsi(String(payload));
  }
}

export function LogViewer({ executionId, initialLogs, showOpenButton = true }: LogViewerProps) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ExecutionLog[]>(initialLogs);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const [conn, setConn] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const appliedFor = useRef<string | null>(null);

  useEffect(() => {
    if (appliedFor.current !== executionId) {
      appliedFor.current = executionId;
      setLogs(initialLogs);
    }
  }, [executionId, initialLogs]);

  // Live subscription
  useEffect(() => {
    if (!executionId) return;
    const unsub = subscribeExecutionLogs(executionId, (log) => {
      setLogs((prev) => [...prev, log]);
    }, setConn);
    return unsub;
  }, [executionId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  };

  const copyLogs = async () => {
    const text = logs
      .map(
        (log) =>
          `${new Date(log.ts).toLocaleTimeString()} [${log.kind}] ${formatPayload(log.payload)}`,
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="relative flex flex-col rounded-xl border border-zinc-800 bg-zinc-950 dark:border-zinc-700">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 dark:border-zinc-700">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          {logs.length} {logs.length === 1 ? 'line' : 'lines'}
        </span>
        <div className="flex items-center gap-1">
          {showOpenButton && executionId && (
            <button
              onClick={() => navigate(`/executions/${executionId}/logs`)}
              title="Open in page"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <ExternalLink size={13} />
              <span className="text-[11px]">Open in page</span>
            </button>
          )}
          <button
            onClick={copyLogs}
            title="Copy logs"
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      {conn === 'closed' || conn === 'error' ? (
        <div className="border-b border-amber-800 bg-amber-950/40 px-3 py-1.5 text-[11px] text-amber-300">
          {conn === 'error' ? 'Live log connection error.' : 'Live log connection closed.'}
        </div>
      ) : null}
      {logs.length === 0 && (
        <div className="px-4 py-8 text-center text-xs text-zinc-500">No logs yet.</div>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-96 overflow-auto p-4 font-mono text-xs leading-relaxed"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 py-0.5">
            <span className="shrink-0 text-zinc-600">{new Date(log.ts).toLocaleTimeString()}</span>
            <span className="shrink-0 w-16 text-right text-zinc-600">[{log.kind}]</span>
            <span className={`whitespace-pre-wrap break-all ${kindStyles[log.kind] ?? 'text-zinc-300'}`}>
              {formatPayload(log.payload)}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {!autoScroll && logs.length > 0 && (
        <button
          onClick={() => {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
            setAutoScroll(true);
          }}
          className="absolute bottom-2 right-2 rounded-md bg-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
