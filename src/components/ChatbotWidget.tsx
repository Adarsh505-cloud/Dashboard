// src/components/ChatbotWidget.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader, Bot, Zap } from 'lucide-react';
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

const QUICK_QUERIES = [
  { label: '📅 Monthly Cost', prompt: 'Show me the monthly cost breakdown for this account.' },
  { label: '👤 User Based Costs', prompt: 'Break down costs by user for this account.' },
  { label: '🛠️ Service Costs', prompt: 'What are the top AWS services driving costs?' },
  { label: '📈 Cost Trend', prompt: 'Show me the cost trend over the last 3 months.' },
  { label: '⚠️ Cost Anomalies', prompt: 'Are there any unusual cost spikes or anomalies?' },
  { label: '💡 Savings Tips', prompt: 'What are the top recommendations to reduce costs?' },
];

const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({ accountId, accountType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: `Hello! I am your Cost Analysis AI. How can I help you with account ${accountId} today?`,
      sender: 'bot',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickQueries, setShowQuickQueries] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        sessionId: `session-${accountId}-${Date.now()}`,
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

  return (
    <div className="fixed bottom-6 right-6" style={{ zIndex: 9999 }}>
      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl w-80 sm:w-96 h-[560px] flex flex-col mb-4 overflow-hidden transition-all duration-300 transform origin-bottom-right">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6" />
              <h3 className="font-semibold text-lg">Cost AI Assistant</h3>
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle quick queries */}
              <button
                onClick={() => setShowQuickQueries((v) => !v)}
                title="Quick queries"
                className="hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <Zap className="w-4 h-4" />
              </button>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
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
                {QUICK_QUERIES.map((q) => (
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
                <div className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none shadow-sm dark:shadow-gray-900/20'
                }`}>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
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