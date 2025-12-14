-- Allow admins to update data_anomalies (to resolve them)
CREATE POLICY "Admins can update data anomalies" 
ON public.data_anomalies 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));