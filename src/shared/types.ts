export type McqOptionKey = 'A' | 'B' | 'C' | 'D';

export interface McqQuestionData {
  question: string;
  options: Record<McqOptionKey, string>;
}

export type VerificationStatus = 'VERIFIED' | 'REVIEW_REQUIRED' | 'UNVERIFIED';

export interface AiSolveResult {
  question: string;
  options: Record<McqOptionKey, string>;
  answer: McqOptionKey | null;
  confidence: number; // 0 to 1
  explanation: string;
  ambiguous?: boolean;
  verifierAnswer?: McqOptionKey | null;
  verificationStatus: VerificationStatus;
  providerUsed?: string;
}

export interface SolverConfig {
  provider: 'demo' | 'gemini' | 'openai' | 'groq';
  apiKey?: string;
  groqKey1?: string;
  groqKey2?: string;
  geminiKey?: string;
  enableVerification?: boolean;
}

export interface SessionState {
  id: string; // 6-char code e.g. "A7K29P"
  createdAt: number;
  expiresAt: number;
  phoneConnected: boolean;
  cameraActive?: boolean; // Indicates phone camera is continuously ON and ready
  status: 'WAITING_FOR_PHONE' | 'PHONE_CONNECTED' | 'IMAGE_RECEIVED' | 'ANALYZING' | 'ANSWER_READY' | 'ERROR';
  lastImageBase64?: string;
  currentResult?: AiSolveResult;
  lastError?: string;
  solverConfig?: SolverConfig;
}

export interface HistoryItem {
  id?: number;
  timestamp: number;
  question: string;
  options: Record<McqOptionKey, string>;
  aiAnswer: McqOptionKey | null;
  finalAnswer: McqOptionKey | null;
  confidence: number;
  verificationStatus: VerificationStatus;
  explanation: string;
  imageBase64?: string;
  isOverridden?: boolean;
}

export interface ImageQualityResult {
  valid: boolean;
  error?: string;
  width?: number;
  height?: number;
  brightnessScore?: number;
  blurScore?: number;
}
