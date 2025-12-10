-- Allow service role to insert sent notifications (for edge function)
CREATE POLICY "Service role can insert sent_notifications"
  ON public.sent_notifications FOR INSERT
  WITH CHECK (true);