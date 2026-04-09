import { create } from "zustand";
import { apiRequest } from "../api/client";

export type ComponentScore = {
  name: string;
  label: string;
  score: number;
  weight: number;
  detail: string;
  status: string;
  has_data: boolean;
};

export type HealthScoreHistoryPoint = {
  date: string;
  score: number;
  grade: string;
};

export type BenchmarkInsight = {
  category: string;
  title: string;
  description: string;
  percentile: number | null;
  comparison: string;
  source: string;
  age_bracket_label: string;
};

type HealthScoreResponse = {
  overall_score: number;
  grade: string;
  components: ComponentScore[];
  data_completeness: number;
  missing_data: string[];
  insights: BenchmarkInsight[];
  calculated_at: string;
};

type HealthScoreHistoryResponse = {
  period: string;
  scores: HealthScoreHistoryPoint[];
};

type HealthScoreState = {
  overallScore: number | null;
  grade: string | null;
  components: ComponentScore[];
  dataCompleteness: number;
  missingData: string[];
  insights: BenchmarkInsight[];
  calculatedAt: string | null;
  history: HealthScoreHistoryPoint[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: string | null;

  load: () => Promise<void>;
  loadHistory: (period?: string) => Promise<void>;
};

export const useHealthScoreStore = create<HealthScoreState>((set) => ({
  overallScore: null,
  grade: null,
  components: [],
  dataCompleteness: 0,
  missingData: [],
  insights: [],
  calculatedAt: null,
  history: [],
  isLoading: false,
  isLoadingHistory: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiRequest<HealthScoreResponse>("/v1/health-score");
      set({
        overallScore: data.overall_score,
        grade: data.grade,
        components: data.components,
        dataCompleteness: data.data_completeness,
        missingData: data.missing_data,
        insights: data.insights ?? [],
        calculatedAt: data.calculated_at,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to load health score",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  loadHistory: async (period = "3M") => {
    set({ isLoadingHistory: true });
    try {
      const data = await apiRequest<HealthScoreHistoryResponse>(
        `/v1/health-score/history?period=${period}`
      );
      set({ history: data.scores });
    } catch {
      // History is non-critical, don't set error
    } finally {
      set({ isLoadingHistory: false });
    }
  },
}));
