import React, { useState, useEffect, useRef } from 'react';
import { FaPaperPlane, FaTrash, FaSun, FaMoon } from 'react-icons/fa';

function App() {
  // Use persistent userId stored in localStorage to maintain session context
  const userId = React.useMemo(() => {
    const storedId = localStorage.getItem('chatbotUserId');
    if (storedId) return storedId;
    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatbotUserId', newId);
    return newId;
  }, []);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef(null);

  // Define placeholder URLs for deployment (update these after deployment)
  const rasaUrl = 'https://your-rasa-backend.onrender.com/webhooks/rest/webhook'; // Replace with Rasa deployed URL
  const proxyUrl = 'https://your-node-backend.onrender.com'; // Replace with Node.js proxy deployed URL

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    loadChatHistory(); // Load chat history on mount
  }, [isDarkMode]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`${proxyUrl}/api/chat/${userId}`);
      if (!response.ok) {
        throw new Error(`Failed to load chat history: ${response.status}`);
      }
      const history = await response.json();
      setMessages(history.map(msg => ({
        text: msg.text,
        isUser: msg.isUser,
        timestamp: msg.timestamp,
      })));
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSend = async (message) => {
    if (!message.trim()) return;

    const userMessage = { text: message, isUser: true, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setInput('');

    try {
      // Save user message to backend (MongoDB via Node.js proxy)
      const proxySaveResponse = await fetch(`${proxyUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...userMessage }),
      });
      if (!proxySaveResponse.ok) {
        throw new Error(`Failed to save message: ${proxySaveResponse.status}`);
      }

      // Send message to Rasa via REST API
      console.log('Sending to Rasa:', { sender: userId, message });
      const rasaResponse = await fetch(rasaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: userId, message }),
      });

      if (!rasaResponse.ok) {
        throw new Error(`Rasa API error: ${rasaResponse.status} - ${await rasaResponse.text()}`);
      }

      const botData = await rasaResponse.json();
      console.log('Rasa Response:', botData);
      if (botData && botData.length > 0 && botData[0].text) {
        const botMessage = { text: botData[0].text, isUser: false, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, botMessage]);

        // Save bot response to backend
        const proxyBotResponse = await fetch(`${proxyUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...botMessage }),
        });
        if (!proxyBotResponse.ok) {
          console.error(`Failed to save bot response: ${proxyBotResponse.status}`);
        }
      } else {
        const errorMessage = { text: 'Sorry, I couldn’t understand that.', isUser: false, timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, errorMessage]);
        await fetch(`${proxyUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, ...errorMessage }),
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = { text: `Error communicating with the chatbot. Please try again. (${error.message})`, isUser: false, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errorMessage]);
      await fetch(`${proxyUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...errorMessage }),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = async () => {
    setMessages([]);
    try {
      const response = await fetch(`${proxyUrl}/api/chat/${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to clear chat history: ${response.status}`);
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  };

  const toggleDarkMode = () => setIsDarkMode(prev => {
    document.documentElement.classList.toggle('dark', !prev);
    return !prev;
  });

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <img src="/logo.png" alt="SSN Logo" className="h-8 w-8" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">SSN College Chatbot</h1>
        </div>
        <div className="flex space-x-4">
          <button onClick={clearChat} className="text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors">
            <FaTrash />
          </button>
          <button onClick={toggleDarkMode} className="text-gray-600 dark:text-gray-300 hover:text-yellow-500 transition-colors">
            {isDarkMode ? <FaSun /> : <FaMoon />}
          </button>
        </div>
      </header>

      {/* Chat Container */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-100 dark:bg-gray-900">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div
              className={`max-w-xs md:max-w-md p-3 rounded-lg shadow ${
                message.isUser
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="max-w-xs md:max-w-md p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 italic">
              SSN Chatbot is typing...
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="Type your message..."
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white dark:border-gray-600"
          />
          <button
            onClick={() => handleSend(input)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors transform hover:scale-110"
          >
            <FaPaperPlane />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;