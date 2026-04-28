'use client';

import { useState, useRef, useEffect } from 'react';

function downloadCSV(csvContent, filename = 'contacts.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderMessageContent(content) {
  // Split on CSV code blocks
  const parts = content.split(/(```csv\n[\s\S]*?\n```)/g);
  return parts.map((part, i) => {
    const csvMatch = part.match(/```csv\n([\s\S]*?)\n```/);
    if (csvMatch) {
      const csvData = csvMatch[1];
      const rows = csvData.trim().split('\n');
      const previewRows = rows.slice(0, 4);
      return (
        <div key={i} className="chat-csv-block">
          <div className="chat-csv-preview">
            {previewRows.map((r, j) => (
              <div key={j} className="chat-csv-row">{r}</div>
            ))}
            {rows.length > 4 && (
              <div className="chat-csv-row chat-csv-more">...and {rows.length - 4} more rows</div>
            )}
          </div>
          <button
            className="chat-csv-download"
            onClick={() => downloadCSV(csvData)}
          >
            Download CSV ({rows.length - 1} contacts)
          </button>
        </div>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ChatWidget() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/chat')) {
      setHidden(true);
    }
  }, []);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch (err) {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }]);
    }
    setLoading(false);
  }

  if (hidden) return null;

  return (
    <>
      {/* Floating button */}
      <button className="chat-fab" onClick={() => setOpen(!open)}>
        {open ? '×' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-header-title">Jumpsuit Assistant</span>
            <button className="chat-header-close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="chat-welcome">
                <p>Ask me anything about your contacts.</p>
                <div className="chat-suggestions">
                  {[
                    'How many contacts do I have?',
                    'Who are my investors?',
                    'Find people with design skills',
                    'Who hasn\'t been contacted in 6 months?',
                  ].map(s => (
                    <button
                      key={s}
                      className="chat-suggestion"
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg-${m.role}`}>
                <div className="chat-msg-content">
                  {renderMessageContent(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg-assistant">
                <div className="chat-msg-content chat-typing">Thinking...</div>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          <form className="chat-input-bar" onSubmit={handleSend}>
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder="Ask about your contacts..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button className="chat-send" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
