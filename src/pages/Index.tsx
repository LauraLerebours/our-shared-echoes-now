
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import { Memory } from '@/components/MemoryList';

const Index = () => {
  const [memories, setMemories] = useState<Memory[]>([]);
  
  // Load memories from localStorage when the component mounts
  useEffect(() => {
    const savedMemories = localStorage.getItem('memories');
    if (savedMemories) {
      try {
        setMemories(JSON.parse(savedMemories));
      } catch (error) {
        console.error('Error parsing saved memories:', error);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1">
        {memories.length === 0 ? (
          <EmptyState />
        ) : (
          <MemoryList memories={memories} />
        )}
      </main>
      
      <Footer activeTab="timeline" />
    </div>
  );
};

export default Index;
