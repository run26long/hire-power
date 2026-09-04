-- ============================================================================
-- INTERVIEWER QUESTIONS — question bank seed
-- Run once in the Supabase SQL editor. The tables already exist; this only
-- fills the bank.
--
-- Idempotent, assuming question_text is unique. If it isn't, re-running this
-- duplicates every row, so add the constraint first:
--   alter table interviewer_questions_bank
--     add constraint interviewer_questions_bank_text_key unique (question_text);
-- ============================================================================

insert into interviewer_questions_bank (question_text, category, context_hint) values
  -- ROLE
  ('What does exceptional success in this role look like a year from now?',
   'role', 'all roles'),
  ('What is the biggest problem you''re hoping the person you hire will solve?',
   'role', 'all roles'),
  ('What tends to be the hardest part of this role that someone wouldn''t know from reading the job description?',
   'role', 'all roles'),
  ('If I started tomorrow, what would you want me focused on first?',
   'role', 'all roles'),
  ('What does a typical week in this role look like?',
   'role', 'all roles'),
  ('What''s the most surprising thing people learn about this role after they start?',
   'role', 'all roles'),
  ('What does the team need most from this hire that isn''t in the job description?',
   'role', 'all roles'),

  -- SUCCESS
  ('What would make you look back a year from now and say you made the right hire?',
   'success', 'all roles'),
  ('What separates someone who is good in this role from someone who is exceptional?',
   'success', 'all roles'),
  ('How will my performance be measured?',
   'success', 'all roles'),
  ('What would you want me to accomplish in my first 90 days?',
   'success', 'all roles'),

  -- TEAM
  ('What do the people who thrive here have in common?',
   'team', 'all roles'),
  ('How does this team handle disagreements or competing priorities?',
   'team', 'skip for solo contributor roles'),
  ('Who would I collaborate with most closely outside my immediate team?',
   'team', 'skip for small companies or solo roles'),
  ('What has kept you personally excited about working here?',
   'team', 'all roles'),

  -- COMPANY
  ('What are the biggest priorities or changes ahead for the team over the next year?',
   'company', 'all roles'),
  ('Where have successful people in this role typically moved on to within the company?',
   'company', 'skip for companies under 50 employees'),
  ('What learning or development opportunities does the team take advantage of most?',
   'company', 'skip for very small companies'),

  -- CLOSER
  ('Based on our conversation today, is there anything about my background that gives you hesitation about my fit for this role?',
   'closer', 'all roles'),
  ('Is there anything else I can provide that would be helpful?',
   'closer', 'all roles')
on conflict (question_text) do nothing;
