'use client';

import { ProjectQueryMessage } from '@/lib/queries-api';

export function QueryThread({ messages }: { messages: ProjectQueryMessage[] }) {
  if (!messages.length) {
    return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Sin mensajes todavía.</div>;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <div key={message.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold">{message.authorName} · {message.authorRole}</span>
            <span>{new Date(message.createdAt).toLocaleString('es-PE')}</span>
          </div>
          <p className="text-sm leading-6 text-slate-700">{message.body}</p>
        </div>
      ))}
    </div>
  );
}
