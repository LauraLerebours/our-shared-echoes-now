
import React, { useState } from 'react';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import { Memory } from '@/components/MemoryList';

const Index = () => {
  // In a real app, this data would come from an API
  const [memories, setMemories] = useState<Memory[]>([
    
  ]);

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
