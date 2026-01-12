import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MemberDataCompleteness {
  basicInfoComplete: boolean;
  contactInfoComplete: boolean;
  financeDataComplete: boolean;
  committeeDataComplete: boolean;
  voteDataComplete: boolean;
  billsDataComplete: boolean;
  scoreDataValid: boolean;
  completenessPercentage: number;
  missingFields: string[];
  lastValidatedAt: string;
}

export function useMemberDataCompleteness(memberId: string | undefined) {
  return useQuery({
    queryKey: ['member-data-completeness', memberId],
    queryFn: async (): Promise<MemberDataCompleteness | null> => {
      if (!memberId) return null;

      const { data, error } = await supabase
        .from('member_data_completeness')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        basicInfoComplete: data.basic_info_complete,
        contactInfoComplete: data.contact_info_complete,
        financeDataComplete: data.finance_data_complete,
        committeeDataComplete: data.committee_data_complete,
        voteDataComplete: data.vote_data_complete,
        billsDataComplete: data.bills_data_complete,
        scoreDataValid: data.score_data_valid,
        completenessPercentage: Number(data.completeness_percentage),
        missingFields: data.missing_fields || [],
        lastValidatedAt: data.last_validated_at
      };
    },
    enabled: !!memberId
  });
}
