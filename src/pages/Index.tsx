
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
        const parsedMemories = JSON.parse(savedMemories);
        // Ensure dates are properly parsed as Date objects
        const processedMemories = parsedMemories.map((memory: any) => ({
          ...memory,
          date: new Date(memory.date),
          // Ensure older records have a type (default to 'memory' if not set)
          type: memory.type || 'memory'
        }));
        setMemories(processedMemories);
      } catch (error) {
        console.error('Error parsing saved memories:', error);
      }
    }
  }, []);

  const handleDeleteMemory = (id: string) => {
    const updatedMemories = memories.filter(memory => memory.id !== id);
    setMemories(updatedMemories);
    localStorage.setItem('memories', JSON.stringify(updatedMemories));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1">
        {memories.length === 0 ? (
          <EmptyState />
        ) : (
          <MemoryList memories={memories} onDeleteMemory={handleDeleteMemory} />
        )}
      </main>
      
      <Footer activeTab="timeline" />
    </div>
  );
};

export default Index;
