import React, { useState } from 'react';
import Fuse from 'fuse.js';

const FuzzySearch = ({ data, onSelect }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const fuse = new Fuse(data, { keys: ['title'], threshold: 0.3 });

  const handleChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (value) {
      const results = fuse.search(value).map(res => res.item);
      setSuggestions(results.slice(0, 5)); // show top 5 suggestions
    } else {
      setSuggestions([]);
    }
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
      <input
        type="text"
        placeholder="Search FAQs or departments..."
        value={query}
        onChange={handleChange}
        className="w-full p-2 rounded border dark:bg-gray-700"
      />
      {suggestions.length > 0 && (
        <ul className="mt-2 bg-white dark:bg-gray-700 border rounded shadow">
          {suggestions.map((item, i) => (
            <li
              key={i}
              className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
              onClick={() => {
                onSelect(item.title);
                setQuery('');
                setSuggestions([]);
              }}
            >
              Did you mean: <strong>{item.title}</strong>?
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FuzzySearch;
