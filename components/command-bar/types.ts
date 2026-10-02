import { CommandCard } from "@/lib/agent/command";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  card?: CommandCard;
  isStreaming?: boolean;
}

export interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  businessName?: string;
}

export const SUGGESTED_CHIPS = [
  "What renews in the next 30 days?",
  "Which contracts have the biggest savings?",
  "What is pending my approval?",
  "How much have we saved this month?",
];
