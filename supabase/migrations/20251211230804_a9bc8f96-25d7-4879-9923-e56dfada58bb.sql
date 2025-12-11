-- Create table to track all AI usage across the app
CREATE TABLE public.ai_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL, -- 'member_summary', 'bill_impact', 'issue_classification', 'admin_chat'
  tokens_used INTEGER,
  model TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_ai_usage_log_created_at ON public.ai_usage_log(created_at DESC);
CREATE INDEX idx_ai_usage_log_operation_type ON public.ai_usage_log(operation_type);

-- Enable RLS
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view AI usage logs
CREATE POLICY "Admins can view AI usage logs"
ON public.ai_usage_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Service role can insert (for edge functions)
CREATE POLICY "Service role can insert AI usage logs"
ON public.ai_usage_log
FOR INSERT
WITH CHECK (true);