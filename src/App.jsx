//app.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FaPaperPlane, FaTrash, FaSun, FaMoon } from 'react-icons/fa';
import bgImage from './assets/ssn-campus.jpeg';
import logo from './assets/logo.png';
import './index.css';
import Fuse from 'fuse.js';

const faqData = [
  { title: 'Admissions' },
  { title: 'Departments' },
  { title: 'Scholarships' },
  { title: 'Placements' },
  { title: 'Events' },
];

function App() {
  const userId = useMemo(() => {
    const storedId = localStorage.getItem('chatbotUserId');
    if (storedId) return storedId;
    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatbotUserId', newId);
    return newId;
  }, []);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [historyTitles, setHistoryTitles] = useState([]);
  const [lastButtonClick, setLastButtonClick] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [userName, setUserName] = useState('');
  const [authStep, setAuthStep] = useState('phone');
  const [token, setToken] = useState(localStorage.getItem('jwtToken') || '');
  const chatContainerRef = useRef(null);

  const rasaUrl = 'http://localhost:5005/webhooks/rest/webhook';
  const proxyUrl = 'http://localhost:3000';

  const fuse = new Fuse([...faqData, ...historyTitles], {
    keys: ['title'],
    threshold: 0.4,
  });

  useEffect(() => {
    const storedMode = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const enableDark = storedMode === 'dark' || (!storedMode && prefersDark);
    setIsDarkMode(enableDark);
    document.documentElement.classList.toggle('dark', enableDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    checkAuthentication();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (input.length > 1 && isAuthenticated) {
      const results = fuse.search(input).map(r => r.item.title);
      const uniqueSuggestions = [...new Set(results.map(
        title => title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()
      ))];
      setSuggestions(uniqueSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [input, isAuthenticated]);

  const checkAuthentication = async () => {
    const storedToken = localStorage.getItem('jwtToken');
    if (!storedToken) {
      setMessages([
        { text: 'Hello! Welcome to the SSN College Chatbot. Please provide your phone number to begin.', isUser: false, timestamp: new Date().toISOString() }
      ]);
      return;
    }

    try {
      const res = await fetch(`${proxyUrl}/api/user/${userId}`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      if (res.ok) {
        const user = await res.json();
        setToken(storedToken);
        setIsAuthenticated(true);
        setUserName(user.name);
        setPhoneNumber(user.number);
        await loadChatHistory();
        setMessages(prev => [...prev, { text: `Welcome, ${user.name}! How can I assist you today?`, isUser: false, timestamp: new Date().toISOString() }]);
        setAuthStep('query');
      } else {
        setToken('');
        localStorage.removeItem('jwtToken');
        setMessages([
          { text: 'Hello! Welcome to the SSN College Chatbot. Please provide your phone number to begin.', isUser: false, timestamp: new Date().toISOString() }
        ]);
        setAuthStep('phone');
      }
    } catch (err) {
      console.error('Auth check error:', err.message);
      setToken('');
      localStorage.removeItem('jwtToken');
      setMessages([
        { text: 'Hello! Welcome to the SSN College Chatbot. Please provide your phone number to begin.', isUser: false, timestamp: new Date().toISOString() }
      ]);
      setAuthStep('phone');
    }
  };

  const loadChatHistory = async () => {
    try {
      const res = await fetch(`${proxyUrl}/api/chat/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load history');
      const history = await res.json();

      setMessages(prev => [
        ...prev,
        ...history.map(msg => ({
          text: msg.text,
          isUser: msg.isUser,
          timestamp: msg.timestamp,
          buttons: msg.buttons || [],
          image: msg.image || null
        }))
      ]);

      const titles = Array.from(
        new Set(
          history.filter(msg => msg.isUser).map(msg => ({ title: msg.text }))
        )
      );
      setHistoryTitles(titles);
    } catch (err) {
      console.error('Load history error:', err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${proxyUrl}/api/chat/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setMessages([
        { text: 'You have been logged out. Hello! Welcome to the SSN College Chatbot. Please provide your phone number to begin.', isUser: false, timestamp: new Date().toISOString() }
      ]);
      setIsAuthenticated(false);
      setToken('');
      setPhoneNumber('');
      setOtp('');
      setUserName('');
      setAuthStep('phone');
      setSuggestions([]);
      setLastButtonClick(null);
      localStorage.removeItem('jwtToken');
    } catch (err) {
      console.error('Logout error:', err.message);
      setMessages(prev => [...prev, { text: 'Error during logout. Please try again.', isUser: false, timestamp: new Date().toISOString() }]);
    }
  };

  const handleSend = async (message) => {
    if (!message.trim()) return;

    if (message.toLowerCase() === 'logout' && isAuthenticated) {
      await handleLogout();
      setInput('');
      return;
    }

    if (!isAuthenticated) {
      if (authStep === 'phone') {
        setPhoneNumber(message);
        setMessages(prev => [...prev, { text: message, isUser: true, timestamp: new Date().toISOString() }]);
        await sendOtp(message);
        // Do not change authStep here; let sendOtp handle the next step
      } else if (authStep === 'otp') {
        setOtp(message);
        setMessages(prev => [...prev, { text: message, isUser: true, timestamp: new Date().toISOString() }]);
        await verifyOtp(message);
      } else if (authStep === 'name') {
        setUserName(message);
        setMessages(prev => [...prev, { text: message, isUser: true, timestamp: new Date().toISOString() }]);
        await saveUser(message);
        setIsAuthenticated(true);
        setMessages(prev => [...prev, { text: `Welcome, ${message}! How can I assist you today?`, isUser: false, timestamp: new Date().toISOString() }]);
        setAuthStep('query');
      }
      setInput('');
      return;
    }

    const grammarCorrected = await correctGrammar(message);
    const userMessage = {
      text: grammarCorrected,
      isUser: true,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    setSuggestions([]);

    try {
      const rasaResponse = await fetch(rasaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: userId, message: grammarCorrected })
      });

      if (!rasaResponse.ok) throw new Error(`HTTP error! status: ${rasaResponse.status}`);
      const data = await rasaResponse.json();

      let combinedText = '';
      let imageUrl = null;
      data.forEach((response) => {
        if (response.text) combinedText += (combinedText ? '\n' : '') + response.text;
        if (response.image) imageUrl = response.image;
      });

      const botTextLines = combinedText.split('\n').map((line, index) => (
        <p key={index} className="whitespace-pre-wrap">{line.trim()}</p>
      ));

      const botMessage = {
        text: botTextLines,
        isUser: false,
        timestamp: new Date().toISOString(),
        buttons: data[0]?.buttons || [],
        image: imageUrl
      };

      setMessages(prev => [...prev, botMessage]);

      await fetch(`${proxyUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, ...userMessage })
      });
    } catch (err) {
      console.error('Error in handleSend:', err.message);
      setMessages(prev => [...prev, {
        text: 'Error communicating with the chatbot. Please try again later.',
        isUser: false,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const sendOtp = async (phone) => {
    console.log(`Sending OTP for phone number: ${phone}`); // Debug log
    try {
      const res = await fetch(`${proxyUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone })
      });
      const data = await res.json(); // Parse JSON response
      if (res.ok) {
        setMessages(prev => [...prev, { text: 'An OTP has been sent to your phone. Please enter it.', isUser: false, timestamp: new Date().toISOString() }]);
        setAuthStep('otp');
      } else {
        setMessages(prev => [...prev, { text: `Failed to send OTP: ${data.error || '❌ Unknown error'}. Please try again.`, isUser: false, timestamp: new Date().toISOString() }]);
        setAuthStep('phone');
      }
    } catch (err) {
      console.error('Send OTP error:', err.message);
      setMessages(prev => [...prev, { text: `Failed to send OTP: ❌ Invalid phone number format. Please try again.`, isUser: false, timestamp: new Date().toISOString() }]);
      setAuthStep('phone');
    }
  };

  const verifyOtp = async (otpInput) => {
    try {
      const res = await fetch(`${proxyUrl}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp: otpInput })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.existingUser) {
          setAuthStep(data.authStep);
          setUserName(data.name);
          setMessages(prev => [...prev, { text: `Welcome, ${data.name}! How can I assist you today?`, isUser: false, timestamp: new Date().toISOString() }]);
          await saveUser(data.name);
          setIsAuthenticated(true);
        } else {
          setAuthStep(data.authStep);
          setMessages(prev => [...prev, { text: 'OTP verified! Please enter your name.', isUser: false, timestamp: new Date().toISOString() }]);
        }
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Invalid OTP');
      }
    } catch (err) {
      console.error('Verify OTP error:', err.message);
      setMessages(prev => [...prev, { text: `Error verifying OTP: ${err.message}. Please try again.`, isUser: false, timestamp: new Date().toISOString() }]);
    }
  };

  const saveUser = async (name) => {
    try {
      const res = await fetch(`${proxyUrl}/api/user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name, number: phoneNumber })
      });
      if (!res.ok) throw new Error('Failed to save user');
      const data = await res.json();
      setToken(data.token);
      localStorage.setItem('jwtToken', data.token);
      await loadChatHistory();
      setIsAuthenticated(true);
      setAuthStep(data.authStep);
    } catch (err) {
      console.error('Save user error:', err.message);
      setMessages(prev => [...prev, { text: `Error saving user: ${err.message}. Please try again.`, isUser: false, timestamp: new Date().toISOString() }]);
    }
  };

  const handleButtonClick = (button) => {
    const userMessage = { text: button.title, isUser: true, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMessage]);

    if (lastButtonClick === button.payload && messages.some(msg => msg.text === button.title)) {
      console.log('Avoiding recursive call for:', button.payload);
      return;
    }

    setLastButtonClick(button.payload);

    fetch(rasaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: userId, message: button.payload || button.title }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        let combinedText = '';
        let imageUrl = null;
        data.forEach((response) => {
          if (response.text) combinedText += (combinedText ? '\n' : '') + response.text;
          if (response.image) imageUrl = response.image;
        });

        const botTextLines = combinedText.split('\n').map((line, index) => (
          <p key={index} className="whitespace-pre-wrap">{line.trim()}</p>
        ));

        setMessages((prev) => [
          ...prev,
          { text: botTextLines, isUser: false, timestamp: new Date().toISOString(), buttons: data[0]?.buttons || [], image: imageUrl },
        ]);
      })
      .catch((err) => console.error("Error from Rasa:", err.message));
  };

  const correctGrammar = async (text) => {
    try {
      const response = await fetch('https://api.languagetoolplus.com/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, language: 'en-US' })
      });

      const data = await response.json();
      let corrected = text;
      for (const match of data.matches.reverse()) {
        if (match.replacements && match.replacements.length > 0) {
          corrected = corrected.slice(0, match.offset) + match.replacements[0].value + corrected.slice(match.offset + match.length);
        }
      }
      return corrected;
    } catch (err) {
      console.warn('Grammar correction failed:', err);
      return text;
    }
  };

  const clearChat = async () => {
    setMessages([]);
    setLastButtonClick(null);
    try {
      await fetch(`${proxyUrl}/api/chat/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Clear chat error:', err.message);
    }
  };

  const toggleDarkMode = () => setIsDarkMode(prev => {
    const newMode = !prev;
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    return newMode;
  });

  return (
    <div className="min-h-screen w-full bg-cover bg-center flex items-center justify-center transition-colors duration-300" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="flex flex-col w-full max-w-4xl h-[95vh] bg-white/80 dark:bg-gray-800/80 rounded-xl shadow-lg overflow-hidden backdrop-blur-sm border border-gray-200 dark:border-gray-700">
        <header className="bg-blue-100/70 dark:bg-blue-900/70 shadow p-4 flex justify-between items-center" role="banner">
          <div className="flex items-center space-x-2" aria-label="SSN College Chatbot Header">
            <img src={logo} alt="SSN College Logo" className="h-8 w-auto" />
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">SSN College Chatbot</h1>
          </div>
          <div className="flex space-x-4" aria-label="Chatbot Controls">
            <button onClick={clearChat} className="text-gray-600 dark:text-gray-300 hover:text-red-500" aria-label="Clear Chat">
              <FaTrash />
            </button>
            <button onClick={toggleDarkMode} className="text-gray-600 dark:text-gray-300 hover:text-yellow-500" aria-label="Toggle Dark Mode">
              {isDarkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </header>

        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} animate-fade-in transition-opacity duration-300`}>
              <div className={`max-w-xs md:max-w-md p-3 rounded-lg shadow ${msg.isUser ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white'}`}>
                {!msg.isUser ? (
                  <>
                    {Array.isArray(msg.text) ? msg.text : <p className="whitespace-pre-wrap">{msg.text}</p>}
                    {msg.image && <img src={msg.image} alt="Related image" className="mt-2 w-full max-h-48 object-cover rounded" />}
                    {msg.buttons?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.buttons.map((btn, i) => (
                          btn.url ? (
                            <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-full text-sm transition-colors duration-200" aria-label={`Visit ${btn.title}`}>
                              {btn.title}
                            </a>
                          ) : (
                            <button key={i} onClick={() => handleButtonClick(btn)} className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold py-1 px-3 rounded-full text-sm transition-colors duration-200" aria-label={`Select ${btn.title}`}>
                              {btn.title}
                            </button>
                          )
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-xs md:max-w-md p-3 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-500 italic">
                SSN Chatbot is typing...
              </div>
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="px-4 pb-2">
            <div className="w-full bg-white dark:bg-gray-700 border rounded-md p-2 shadow-sm">
              {suggestions.map((s, i) => (
                <div key={i} onClick={() => handleSend(s)} className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 rounded-md text-sm transition-colors duration-200" role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && handleSend(s)} aria-label={`Suggest ${s}`}>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-white/80 dark:bg-gray-800/80">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend(input)}
              placeholder={
                authStep === 'phone' ? 'Enter your phone number' :
                authStep === 'otp' ? 'Enter OTP' :
                authStep === 'name' ? 'Enter your name' :
                'Type your query or \'logout\' to close the session'
              }
              className="flex-1 p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600"
              aria-label="Chat input"
              role="textbox"
            />
            <button onClick={() => handleSend(input)} className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-500 transition-colors duration-200" aria-label="Send Message">
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;