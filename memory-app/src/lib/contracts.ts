export interface Fragment {
  id: string;
  original: string;
  text: string;
  revisions: string[];
  createdAt: string;
}
export interface Interview {
  id: string;
  title: string;
  photoUrl: string;
  isSample: boolean;
  stage: "interview" | "postcard" | "memoir";
  createdAt: string;
  updatedAt: string;
  fragments: Fragment[];
  postcardText: string;
  memoirText: string;
  memoirApproved: boolean;
  question?: string;
  questionSource?: "ollama" | "guided";
  memoirSources?: { fragmentId: string; revision: number }[];
}
export interface ProviderConfig {
  mode: "local" | "api";
  baseUrl: string;
  model: string;
  apiKey?: string;
  hasKey?: boolean;
}
export interface Settings {
  largeText: boolean;
  theme: "light" | "dark" | "system";
  silenceSeconds: 3 | 5 | 7;
  inputMode: "voice" | "text";
  stt: ProviderConfig;
  tts: ProviderConfig & { voice: string };
  llm: { baseUrl: string; model: string };
  image: { model: string; apiKey?: string; hasKey?: boolean };
}
export interface ModelState {
  status: "missing" | "downloading" | "ready" | "error";
  detail?: string;
}
export interface Health {
  speech: { online: boolean; stt: ModelState; tts: ModelState };
  llm: { online: boolean };
  storage: "sqlite";
}
