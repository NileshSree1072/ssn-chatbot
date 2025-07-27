import React from 'react';

const Carousel = ({ items }) => {
  return (
    <div className="overflow-x-auto flex space-x-4 py-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="min-w-[200px] p-4 rounded-lg bg-white dark:bg-gray-700 shadow-md"
        >
          <h3 className="font-bold text-blue-600 dark:text-white">{item.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{item.description}</p>
        </div>
      ))}
    </div>
  );
};

export default Carousel;
