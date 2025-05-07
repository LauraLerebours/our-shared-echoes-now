
import React, { useState } from 'react';
import Header from '@/components/Header';
import MemoryList from '@/components/MemoryList';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import { Memory } from '@/components/MemoryList';

const Index = () => {
  // In a real app, this data would come from an API
  const [memories, setMemories] = useState<Memory[]>([
    {
      id: '1',
      image: 'https://images.unsplash.com/photo-1470813740244-df37b8c1edcb',
      caption: 'Our first stargazing night. I\'ll never forget the way the sky looked that evening.',
      date: new Date('2024-04-15'),
      location: 'Redwood National Park',
      likes: 2,
      comments: 1,
      isLiked: true,
    },
    {
      id: '2',
      image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21',
      caption: 'Beach day! The waves were perfect.',
      date: new Date('2024-03-20'),
      location: 'Malibu Beach',
      likes: 1,
      comments: 0,
      isLiked: false,
    },
    {
      id: '3',
      image: 'https://images.unsplash.com/photo-1582562124811-c09040d0a901',
      caption: 'Remember when we adopted Whiskers? Best decision ever.',
      date: new Date('2024-02-05'),
      likes: 3,
      comments: 2,
      isLiked: true,
    },
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
