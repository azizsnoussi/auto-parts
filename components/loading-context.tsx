'use client'

import React, { createContext, useState, useContext } from 'react';

// Create a context for loading state
const LoadingContext = createContext({
  isLoading: false,
  setIsLoading: (isLoading: boolean) => {},
});

export const useLoading = () => useContext(LoadingContext);

// Provide the context globally
export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <LoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {children}
    </LoadingContext.Provider>
  );
};
