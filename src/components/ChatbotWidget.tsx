// src/components/ChatbotWidget.tsx
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, X, Send, Loader, Bot, Zap, Maximize2, Minimize2, Copy, Check, Trash2, ChevronDown, Download } from 'lucide-react';
import { apiService } from '../services/api';

interface ChatbotWidgetProps {
  accountId: string;
  accountType?: 'standalone' | 'master';
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

const QUICK_QUERIES_BASE = [
  { label: '📅 Monthly Cost', prompt: 'Show me the monthly cost breakdown for this account.' },
  { label: '👤 User Based Costs', prompt: 'Break down costs by user for this account.' },
  { label: '🛠️ Service Costs', prompt: 'What are the top AWS services driving costs?' },
  { label: '📈 Cost Trend', prompt: 'Show me the cost trend over the last 3 months.' },
  { label: '⚠️ Cost Anomalies', prompt: 'Are there any unusual cost spikes or anomalies?' },
  { label: '💡 Savings Tips', prompt: 'What are the top recommendations to reduce costs?' },
];

const MASTER_EXTRA_QUERIES = [
  { label: '📊 Account Breakdown', prompt: 'Show cost breakdown by linked account in this organization.' },
  { label: '🏢 Top Linked Accounts', prompt: 'Which linked accounts have the highest costs this month?' },
];

/**
 * Clean up truncated markdown tables from Bedrock responses.
 * When the LLM response hits token limits, the last table row is often
 * cut off mid-text. This function detects and removes incomplete rows
 * so the table renders cleanly.
 */
const sanitizeMarkdownTable = (text: string): string => {
  // Split into lines
  const lines = text.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if this is a table row (starts with |)
    if (line.trimStart().startsWith('|')) {
      // Count pipe characters — a valid row should have at least 3 pipes for a 2-column table
      const pipeCount = (line.match(/\|/g) || []).length;
      const headerSeparator = /^\s*\|[\s\-:|]+\|\s*$/.test(line);

      if (headerSeparator) {
        // Header separator row like |---|---|--- — keep it
        result.push(line);
      } else if (pipeCount >= 3 && line.trimEnd().endsWith('|')) {
        // Complete table row — ends with | and has enough columns
        result.push(line);
      } else if (i === lines.length - 1 || (i === lines.length - 2 && lines[i + 1].trim() === '')) {
        // Last line and it's an incomplete table row — drop it
        // This is the truncated row from Bedrock token limit
        continue;
      } else {
        // Mid-table incomplete row (shouldn't happen often) — keep it
        result.push(line);
      }
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
};

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ accountId, accountType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickQueries, setShowQuickQueries] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(`session-${accountId}-${Date.now()}`);

  // Build welcome message based on account type
  const getWelcomeMessage = (accId: string, accType?: string): Message => ({
    id: 'welcome',
    text: accType === 'master'
      ? `Hello! I am your Cost Analysis AI. How can I help you with your organization account (${accId}) today?\n\nAs this is the master payer account, I can show you costs across all linked accounts.`
      : `Hello! I am your Cost Analysis AI. How can I help you with account ${accId} today?`,
    sender: 'bot',
  });

  // Reset messages and session when account changes
  useEffect(() => {
    setMessages([getWelcomeMessage(accountId, accountType)]);
    setShowQuickQueries(true);
    setCopiedMessageId(null);
    sessionIdRef.current = `session-${accountId}-${Date.now()}`;
  }, [accountId, accountType]);

  // Get quick queries based on account type
  const quickQueries = accountType === 'master'
    ? [...MASTER_EXTRA_QUERIES, ...QUICK_QUERIES_BASE]
    : QUICK_QUERIES_BASE;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCopy = (messageId: string, text: string) => {
    // Try modern clipboard API first, fall back to execCommand
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedMessageId(messageId);
        setTimeout(() => setCopiedMessageId(null), 2000);
      }).catch(() => {
        fallbackCopy(text, messageId);
      });
    } else {
      fallbackCopy(text, messageId);
    }
  };

  const fallbackCopy = (text: string, messageId: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
    document.body.removeChild(textarea);
  };

  const handleClearChat = () => {
    setMessages([getWelcomeMessage(accountId, accountType)]);
    setShowQuickQueries(true);
    setCopiedMessageId(null);
    sessionIdRef.current = `session-${accountId}-${Date.now()}`;
  };

  const handleDownloadTranscript = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const header = `AWS Cost AI Assistant - Chat Transcript\nAccount: ${accountId} (${accountType === 'master' ? 'Organization' : 'Linked'})\nExported: ${new Date().toLocaleString()}\n${'='.repeat(60)}\n\n`;
    const body = messages
      .map((msg) => {
        const role = msg.sender === 'user' ? 'You' : 'AI Assistant';
        return `[${role}]\n${msg.text}\n`;
      })
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-transcript-${accountId}-${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Hide quick queries once user starts chatting
    setShowQuickQueries(false);

    const userMessage: Message = { id: Date.now().toString(), text, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const data = await apiService.sendChatMessage({
        accountId: accountId,
        prompt: text,
        sessionId: sessionIdRef.current,
        accountType,
      });

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.reply || 'Sorry, I could not process that request.',
        sender: 'bot',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat API Error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Error connecting to the AI agent. Please check your backend.',
        sender: 'bot',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage(input);
  };

  const handleQuickQuery = (prompt: string) => {
    sendMessage(prompt);
  };

  // Dynamic size classes based on maximized state — full screen on mobile
  const windowSizeClasses = isMaximized
    ? 'w-full h-full sm:w-[700px] sm:h-[85vh] sm:rounded-2xl'
    : 'w-full h-[100dvh] sm:w-96 sm:h-[560px] sm:rounded-2xl';

  return (
    <div className={`fixed ${isOpen ? 'inset-0 sm:inset-auto sm:bottom-6 sm:right-6' : 'bottom-6 right-6'}`} style={{ zIndex: 9999 }}>
      {/* Chat Window */}
      {isOpen && (
        <div className={`bg-white dark:bg-gray-800 border-0 sm:border border-gray-200 dark:border-gray-700 shadow-2xl ${windowSizeClasses} flex flex-col sm:mb-4 overflow-hidden transition-all duration-300 transform origin-bottom-right`}>

          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6" />
              <div>
                <h3 className="font-semibold text-lg leading-tight">Cost AI Assistant</h3>
                <p className="text-xs text-blue-100 opacity-80">
                  {accountType === 'master' ? 'Organization' : 'Account'}: {accountId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Toggle quick queries */}
              <button
                onClick={() => setShowQuickQueries((v) => !v)}
                title="Quick queries"
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
              >
                <Zap className="w-4 h-4" />
              </button>
              {/* Download Transcript */}
              <button
                onClick={handleDownloadTranscript}
                title="Download transcript"
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              {/* Clear Chat */}
              <button
                onClick={handleClearChat}
                title="Clear chat"
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {/* Maximize / Minimize */}
              <button
                onClick={() => setIsMaximized((v) => !v)}
                title={isMaximized ? 'Minimize' : 'Maximize'}
                className="hover:bg-white/20 p-1.5 rounded-full transition-colors"
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Query Chips */}
          {showQuickQueries && (
            <div className="px-3 pt-3 pb-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3 text-blue-500" />
                Quick Queries
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickQueries.map((q) => (
                  <button
                    key={q.label}
                    onClick={() => handleQuickQuery(q.prompt)}
                    disabled={isLoading}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 hover:border-blue-400 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap font-medium"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-gray-900 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%]`}>
                  <div className={`p-3 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm dark:shadow-gray-900/20'
                  }`}>
                    {msg.sender === 'bot' ? (
                      <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none
                        prose-table:border-collapse prose-table:w-full prose-table:text-xs
                        prose-th:bg-gray-100 dark:prose-th:bg-gray-700 prose-th:px-2 prose-th:py-1.5 prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:text-left prose-th:font-semibold
                        prose-td:px-2 prose-td:py-1.5 prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600
                        prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                        prose-strong:text-inherit prose-code:text-xs prose-code:bg-gray-100 dark:prose-code:bg-gray-700 prose-code:px-1 prose-code:rounded">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            table: ({ children, ...props }) => (
                              <div className="overflow-x-auto -mx-1 my-2">
                                <table {...props}>{children}</table>
                              </div>
                            ),
                            tbody: ({ children, ...props }) => {
                              // Merge consecutive rows that share the same first-column value
                              const rows = React.Children.toArray(children).filter(React.isValidElement);
                              if (rows.length === 0) return <tbody {...props}>{children}</tbody>;

                              // Extract text from first <td> of each row
                              const getFirstCellText = (row: React.ReactElement): string => {
                                const cells = React.Children.toArray(row.props.children).filter(React.isValidElement);
                                if (cells.length === 0) return '';
                                const td = cells[0];
                                const extractText = (node: React.ReactNode): string => {
                                  if (typeof node === 'string') return node;
                                  if (typeof node === 'number') return String(node);
                                  if (React.isValidElement(node) && node.props.children) return extractText(node.props.children);
                                  if (Array.isArray(node)) return node.map(extractText).join('');
                                  return '';
                                };
                                return extractText(td.props.children).trim();
                              };

                              // Calculate rowSpan groups
                              const spans: number[] = new Array(rows.length).fill(1);
                              const hidden: boolean[] = new Array(rows.length).fill(false);
                              for (let i = 0; i < rows.length; i++) {
                                if (hidden[i]) continue;
                                const text = getFirstCellText(rows[i] as React.ReactElement);
                                if (!text) continue;
                                let span = 1;
                                for (let j = i + 1; j < rows.length; j++) {
                                  if (getFirstCellText(rows[j] as React.ReactElement) === text) {
                                    span++;
                                    hidden[j] = true;
                                  } else break;
                                }
                                spans[i] = span;
                              }

                              // Only apply merging if at least one group exists
                              const hasGroups = spans.some(s => s > 1);
                              if (!hasGroups) return <tbody {...props}>{children}</tbody>;

                              const mergedRows = rows.map((row, idx) => {
                                const r = row as React.ReactElement;
                                const cells = React.Children.toArray(r.props.children).filter(React.isValidElement);
                                if (hidden[idx]) {
                                  // Remove first cell, keep the rest
                                  const remainingCells = cells.slice(1);
                                  return React.cloneElement(r, { key: idx }, ...remainingCells);
                                }
                                if (spans[idx] > 1) {
                                  // Add rowSpan to first cell, apply vertical-align and font-weight
                                  const firstCell = cells[0] as React.ReactElement;
                                  const mergedFirstCell = React.cloneElement(firstCell, {
                                    rowSpan: spans[idx],
                                    key: 'merged-0',
                                    style: { verticalAlign: 'middle', fontWeight: 600 },
                                  });
                                  const restCells = cells.slice(1);
                                  return React.cloneElement(r, { key: idx }, mergedFirstCell, ...restCells);
                                }
                                return React.cloneElement(r, { key: idx });
                              });

                              return <tbody {...props}>{mergedRows}</tbody>;
                            },
                          }}
                        >
                          {sanitizeMarkdownTable(msg.text)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    )}
                  </div>
                  {/* Action buttons for bot messages */}
                  {msg.sender === 'bot' && msg.id !== 'welcome' && (
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Copy response"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-green-500" />
                            <span className="text-green-500">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      {/truncat|more rows|showing \d+ of|next page|remaining.*brevity|\|\s*\.\.\.\s*\||ask for.*(next|more)|rows? \d+ to \d+/i.test(msg.text) && (
                        <button
                          onClick={() => sendMessage('Show me the next page of results')}
                          disabled={isLoading}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-40"
                        >
                          <ChevronDown className="w-3 h-3" />
                          <span>Show more results</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-2xl rounded-tl-none shadow-sm dark:shadow-gray-900/20 flex items-center gap-2">
                  <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Analyzing data...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 flex gap-2 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your AWS costs..."
              className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex items-center justify-center"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default ChatbotWidget;
