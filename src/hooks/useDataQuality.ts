import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DataQualityMetric {
  metricName: string;
  metricDescription: string;
  currentValue: number;
  thresholdWarning: number;
  thresholdCritical: number;
  status: 'healthy' | 'warning' | 'critical';
  category: string;
  checkedAt: string;
}

export function useDataQualityMetrics() {
  return useQuery({
    queryKey: ['data-quality-metrics'],
    queryFn: async (): Promise<DataQualityMetric[]> => {
      // Get latest metrics (most recent check for each metric)
      const { data, error } = await supabase
        .from('data_quality_metrics')
        .select('*')
        .order('checked_at', { ascending: false });

      if (error) throw error;

      // Get only the most recent entry for each metric
      const latestMetrics = new Map<string, any>();
      for (const metric of data || []) {
        if (!latestMetrics.has(metric.metric_name)) {
          latestMetrics.set(metric.metric_name, metric);
        }
      }

      return Array.from(latestMetrics.values()).map(m => ({
        metricName: m.metric_name,
        metricDescription: m.metric_description,
        currentValue: Number(m.current_value),
        thresholdWarning: Number(m.threshold_warning),
        thresholdCritical: Number(m.threshold_critical),
        status: m.status as 'healthy' | 'warning' | 'critical',
        category: m.category,
        checkedAt: m.checked_at
      }));
    },
    refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
  });
}

export function useMemberCompleteness() {
  return useQuery({
    queryKey: ['member-completeness-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_data_completeness')
        .select('completeness_percentage, finance_data_complete, score_data_valid');

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const total = data.length;
      const avgCompleteness = data.reduce((sum, m) => sum + Number(m.completeness_percentage), 0) / total;
      const withFinance = data.filter(m => m.finance_data_complete).length;
      const withValidScores = data.filter(m => m.score_data_valid).length;

      return {
        totalMembers: total,
        averageCompleteness: avgCompleteness,
        percentWithFinance: (withFinance / total) * 100,
        percentWithValidScores: (withValidScores / total) * 100
      };
    },
    refetchInterval: 5 * 60 * 1000
  });
}
