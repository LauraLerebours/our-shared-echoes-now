
import React from 'react';
import MemoryCard, { MemoryCardProps } from './MemoryCard';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

export interface Memory {
  id: string;
  image: string;
  caption?: string;
  date: Date;
  location?: string;
  likes: number;
  isLiked: boolean;
  isVideo?: boolean;
}

interface MemoryListProps {
  memories: Memory[];
  onDeleteMemory?: (id: string) => void;
}

const MemoryList: React.FC<MemoryListProps> = ({ memories, onDeleteMemory }) => {
  const navigate = useNavigate();
  
  const handleLike = (id: string) => {
    console.log(`Liked memory ${id}`);
    // In a real app, this would make an API call to toggle the like status
  };

  const handleViewDetail = (id: string) => {
    navigate(`/memory/${id}`);
  };

  const handleDelete = (id: string) => {
    if (onDeleteMemory) {
      onDeleteMemory(id);
      toast({
        title: "Memory deleted",
        description: "Your memory has been deleted successfully",
      });
    }
  };

  // Sort memories by date, with most recent first
  const sortedMemories = [...memories].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="px-4 pt-4 pb-20">
      {sortedMemories.map((memory) => (
        <MemoryCard
          key={memory.id}
          {...memory}
          onLike={handleLike}
          onViewDetail={handleViewDetail}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};

export default MemoryList;
