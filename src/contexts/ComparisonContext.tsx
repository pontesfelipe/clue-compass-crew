import { createContext, useContext, useState, ReactNode } from "react";

interface ComparisonMember {
  id: string;
  name: string;
  party: "D" | "R" | "I" | "L";
  state: string;
  chamber: string;
  imageUrl?: string | null;
}

interface ComparisonContextType {
  members: ComparisonMember[];
  addMember: (member: ComparisonMember) => void;
  removeMember: (memberId: string) => void;
  clearMembers: () => void;
  isMemberSelected: (memberId: string) => boolean;
  canAddMore: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

const MAX_COMPARISON_MEMBERS = 4;

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<ComparisonMember[]>([]);

  const addMember = (member: ComparisonMember) => {
    if (members.length >= MAX_COMPARISON_MEMBERS) return;
    if (members.some((m) => m.id === member.id)) return;
    setMembers((prev) => [...prev, member]);
  };

  const removeMember = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const clearMembers = () => {
    setMembers([]);
  };

  const isMemberSelected = (memberId: string) => {
    return members.some((m) => m.id === memberId);
  };

  const canAddMore = members.length < MAX_COMPARISON_MEMBERS;

  return (
    <ComparisonContext.Provider
      value={{
        members,
        addMember,
        removeMember,
        clearMembers,
        isMemberSelected,
        canAddMore,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (context === undefined) {
    throw new Error("useComparison must be used within a ComparisonProvider");
  }
  return context;
}
