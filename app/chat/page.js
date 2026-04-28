'use client';

import { useState, useRef, useEffect } from 'react';

export default function PublicChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/public-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Something went wrong. Try again.' }]);
    }
    setLoading(false);
  }

  function handleSuggestion(text) {
    setInput(text);
  }

  const suggestions = [
    'What does Jumpsuit do?',
    'How is Jumpsuit different from other agencies?',
    'What is Business 3.0?',
    'I want to hire Jumpsuit',
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.logoText}>JUMPSUIT AI</div>
      </div>

      <div style={styles.messagesArea}>
        {messages.length === 0 && (
          <div style={styles.welcome}>
            <div style={styles.welcomeTitle}>Hey there.</div>
            <div style={styles.welcomeText}>
              I'm Jumpsuit AI — ask me anything about Jumpsuit, our services, how we work, or whether we're a fit for your project.
            </div>
            <div style={styles.suggestions}>
              {suggestions.map(s => (
                <button key={s} style={styles.suggestionBtn} onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? styles.userRow : styles.assistantRow}>
            <div style={m.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              {m.content.split('\n').map((line, j) => (
                <span key={j}>
                  {line.split(/(https?:\/\/[^\s]+)/g).map((part, k) =>
                    part.match(/^https?:\/\//) ? (
                      <a key={k} href={part} target="_blank" rel="noopener noreferrer" style={styles.link}>{part}</a>
                    ) : part
                  )}
                  {j < m.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div style={styles.assistantRow}>
            <div style={styles.assistantBubble}>
              <span style={styles.typing}>Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={styles.inputArea}>
        <input
          style={styles.input}
          type="text"
          placeholder="Ask Jumpsuit AI anything..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button style={styles.sendBtn} type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxHeight: '100vh',
    background: '#faf5ed',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    background: '#2c3c40',
    borderBottom: '3px solid #fa6729',
    flexShrink: 0,
  },
  logoText: {
    fontFamily: '"Cooper Black", "Cooper Blk BT", serif',
    fontSize: '1.1rem',
    color: '#deab39',
    letterSpacing: '0.05em',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  welcome: {
    textAlign: 'center',
    padding: '40px 20px',
  },
  welcomeTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#2c3c40',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: '0.95rem',
    color: '#555',
    lineHeight: 1.5,
    maxWidth: 400,
    margin: '0 auto 24px',
  },
  suggestions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  suggestionBtn: {
    padding: '8px 16px',
    borderRadius: 20,
    border: '1.5px solid #2c3c40',
    background: 'transparent',
    color: '#2c3c40',
    fontSize: '0.85rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  userBubble: {
    background: '#2c3c40',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '18px 18px 4px 18px',
    maxWidth: '80%',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  assistantBubble: {
    background: '#fff',
    color: '#2c3c40',
    padding: '10px 16px',
    borderRadius: '18px 18px 18px 4px',
    maxWidth: '80%',
    fontSize: '0.9rem',
    lineHeight: 1.5,
    border: '1px solid #e0d8cc',
  },
  link: {
    color: '#0c46d1',
    textDecoration: 'underline',
  },
  typing: {
    color: '#999',
    fontStyle: 'italic',
  },
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '12px 20px',
    borderTop: '1px solid #e0d8cc',
    background: '#fff',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 24,
    border: '1.5px solid #d0c9bc',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    background: '#faf5ed',
  },
  sendBtn: {
    padding: '10px 20px',
    borderRadius: 24,
    border: 'none',
    background: '#fa6729',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
