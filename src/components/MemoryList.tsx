
import React from 'react';
import MemoryCard, { MemoryCardProps } from './MemoryCard';
import { useNavigate } from 'react-router-dom';

export interface Memory {
  id: string;
  image: string;
  caption?: string;
  date: Date;
  location?: string;
  likes: number;
  isLiked: boolean;
}

interface MemoryListProps {
  memories: Memory[];
}

const MemoryList: React.FC<MemoryListProps> = ({ memories }) => {
  const navigate = useNavigate();
  
  const handleLike = (id: string) => {
    console.log(`Liked memory ${id}`);
    // In a real app, this would make an API call to toggle the like status
  };

  const handleViewDetail = (id: string) => {
    navigate(`/memory/${id}`);
  };

  return (
    <div className="px-4 pt-4 pb-20">
      {memories.map((memory) => (
        <MemoryCard
          key={memory.id}
          {...memory}
          onLike={handleLike}
          onViewDetail={handleViewDetail}
        />
      ))}
    </div>
  );
};

export default MemoryList;
