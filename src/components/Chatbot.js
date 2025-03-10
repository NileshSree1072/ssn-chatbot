import React, { useState, useEffect } from "react";
import socket from "../socket"; // Import the socket instance

const Chatbot=() => {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Listen for incoming messages
    socket.on("newMessage", (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // Cleanup event listener on component unmount
    return () => {
      socket.off("newMessage");
    };
  }, []);

  return (
    <div>
      <h2>Chat Messages</h2>
      <ul>
        {messages.map((msg, index) => (
          <li key={index}>{msg.text}</li>
        ))}
      </ul>
    </div>
  );
};

export default Chatbot;
