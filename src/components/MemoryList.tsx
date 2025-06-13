import React from 'react';
import MemoryCard, { MemoryCardProps } from './MemoryCard';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Memory } from '@/lib/types';

interface MemoryListProps {
  memories: Memory[];
  onDeleteMemory?: (id: string) => void;
  onUpdateMemory?: (id: string, updates: Partial<Memory>) => void;
}

const MemoryList: React.FC<MemoryListProps> = ({ memories, onDeleteMemory, onUpdateMemory }) => {
  const navigate = useNavigate();
  
  const handleLike = (id: string, newLikes: number, newIsLiked: boolean) => {
    // Update the memory in the parent component
    if (onUpdateMemory) {
      onUpdateMemory(id, { likes: newLikes, isLiked: newIsLiked });
    }
  };

  const handleViewDetail = (id: string, accessCode: string) => {
    navigate(`/memory/${id}`, { state: { accessCode } });
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
          onViewDetail={() => handleViewDetail(memory.id, memory.accessCode)}
          onDelete={handleDelete}
          createdBy={memory.createdBy}
          accessCode={memory.accessCode}
        />
      ))}
    </div>
  );
};

export default MemoryList;