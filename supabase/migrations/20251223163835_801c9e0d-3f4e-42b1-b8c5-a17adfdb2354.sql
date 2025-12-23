-- Create bill_tracking table (similar to member_tracking)
CREATE TABLE public.bill_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, bill_id)
);

-- Enable RLS
ALTER TABLE public.bill_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own tracked bills
CREATE POLICY "Users can view their own tracked bills"
ON public.bill_tracking
FOR SELECT
USING (auth.uid() = user_id);

-- Users can track bills
CREATE POLICY "Users can track bills"
ON public.bill_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can untrack bills
CREATE POLICY "Users can untrack bills"
ON public.bill_tracking
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_bill_tracking_user_id ON public.bill_tracking(user_id);
CREATE INDEX idx_bill_tracking_bill_id ON public.bill_tracking(bill_id);