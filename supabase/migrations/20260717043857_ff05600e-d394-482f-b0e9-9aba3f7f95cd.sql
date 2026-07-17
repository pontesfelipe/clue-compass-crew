
CREATE POLICY "Admins can view all user answers" ON public.user_answers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all member tracking" ON public.member_tracking FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all bill tracking" ON public.bill_tracking FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all user priorities" ON public.user_issue_priorities FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all user alignment" ON public.user_politician_alignment FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
