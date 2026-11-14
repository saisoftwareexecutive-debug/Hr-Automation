-- HireFlow Seed SQL Script
-- 2 Sample Jobs and 30 Fictional Candidates across hiring stages with scores and form answers

-- Insert Admin & HR Executive Profiles
INSERT INTO profiles (id, email, full_name, role)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'admin@hireflow.internal', 'Rajesh Sharma (Admin)', 'admin'),
    ('a0000000-0000-0000-0000-000000000002', 'hr.priya@hireflow.internal', 'Priya Menon (HR Exec)', 'hr_executive')
ON CONFLICT (email) DO NOTHING;

-- Sample Job 1: Customer Support Executive
INSERT INTO jobs (id, title, department, city, openings, min_exp_years, max_exp_years, min_salary, max_salary, shift_type, required_skills, required_languages, status)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Customer Support Executive (Blended - Inbound/Chat)',
    'Customer Operations',
    'Bengaluru',
    8,
    0.5,
    3.0,
    20000,
    32000,
    'rotational',
    '["Customer Service", "Chat Support", "Email Writing", "CRM Handling", "Problem Solving"]'::jsonb,
    '["Hindi", "English", "Kannada"]'::jsonb,
    'active'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO scoring_rules (job_id, weights, criteria)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    '{"city_weight": 20, "exp_weight": 25, "skills_weight": 25, "salary_weight": 15, "notice_weight": 10, "shift_weight": 5}'::jsonb,
    '{"preferred_cities": ["Bengaluru", "Bangalore", "Mysuru"], "max_acceptable_salary": 35000, "max_notice_days": 30, "mandatory_skills": ["Customer Service"]}'::jsonb
) ON CONFLICT (job_id) DO NOTHING;

-- Sample Job 2: Field Sales & Operations Representative
INSERT INTO jobs (id, title, department, city, openings, min_exp_years, max_exp_years, min_salary, max_salary, shift_type, required_skills, required_languages, status)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'Field Sales & Operations Representative',
    'Direct Sales',
    'Mumbai',
    12,
    1.0,
    4.0,
    22000,
    38000,
    'day',
    '["Field Sales", "Lead Generation", "Merchant Onboarding", "Negotiation", "B2B Sales"]'::jsonb,
    '["Hindi", "Marathi", "English"]'::jsonb,
    'active'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO scoring_rules (job_id, weights, criteria)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    '{"city_weight": 20, "exp_weight": 25, "skills_weight": 25, "salary_weight": 15, "notice_weight": 10, "shift_weight": 5}'::jsonb,
    '{"preferred_cities": ["Mumbai", "Thane", "Navi Mumbai"], "max_acceptable_salary": 40000, "max_notice_days": 15, "mandatory_skills": ["Field Sales"]}'::jsonb
) ON CONFLICT (job_id) DO NOTHING;

-- 30 Fictional Candidates
INSERT INTO candidates (id, full_name, phone, email, city, total_experience_months, current_salary, source)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Amit Kumar Verma', '+919876500001', 'amit.verma@example.com', 'Bengaluru', 24, 24000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000002', 'Priya S. Patel', '+919876500002', 'priya.patel@example.com', 'Bengaluru', 18, 22000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000003', 'Rahul Dev Roy', '+919876500003', 'rahul.roy@example.com', 'Bengaluru', 36, 28000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000004', 'Sneha M. Iyer', '+919876500004', 'sneha.iyer@example.com', 'Bengaluru', 12, 19000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000005', 'Vikram Pratap Singh', '+919876500005', 'vikram.singh@example.com', 'Bengaluru', 30, 27000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000006', 'Pooja R. Nair', '+919876500006', 'pooja.nair@example.com', 'Bengaluru', 6, 16000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000007', 'Rohan K. Joshi', '+919876500007', 'rohan.joshi@example.com', 'Bengaluru', 20, 25000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000008', 'Meera N. Desai', '+919876500008', 'meera.desai@example.com', 'Bengaluru', 15, 21000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000009', 'Karan H. Malhotra', '+919876500009', 'karan.malhotra@example.com', 'Mysuru', 28, 26000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000010', 'Neha B. Gupta', '+919876500010', 'neha.gupta@example.com', 'Bengaluru', 10, 18000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000011', 'Suresh V. Reddy', '+919876500011', 'suresh.reddy@example.com', 'Bengaluru', 40, 31000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000012', 'Divya C. Pillai', '+919876500012', 'divya.pillai@example.com', 'Chennai', 24, 25000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000013', 'Arjun S. Mehra', '+919876500013', 'arjun.mehra@example.com', 'Bengaluru', 14, 20000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000014', 'Kavita L. Yadav', '+919876500014', 'kavita.yadav@example.com', 'Bengaluru', 22, 23000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000015', 'Deepak T. Solanki', '+919876500015', 'deepak.solanki@example.com', 'Bengaluru', 8, 17000, 'workindia'),
    
    -- Candidates for Job 2 (Mumbai)
    ('c0000000-0000-0000-0000-000000000016', 'Rajesh G. Solanki', '+919876500016', 'rajesh.solanki@example.com', 'Mumbai', 24, 26000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000017', 'Sunita A. Chauhan', '+919876500017', 'sunita.chauhan@example.com', 'Mumbai', 18, 24000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000018', 'Vivek S. Patil', '+919876500018', 'vivek.patil@example.com', 'Thane', 36, 32000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000019', 'Shalini P. Rao', '+919876500019', 'shalini.rao@example.com', 'Mumbai', 15, 23000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000020', 'Manish R. Tiwari', '+919876500020', 'manish.tiwari@example.com', 'Navi Mumbai', 30, 30000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000021', 'Ritu K. Chawla', '+919876500021', 'ritu.chawla@example.com', 'Mumbai', 12, 21000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000022', 'Harish D. Hegde', '+919876500022', 'harish.hegde@example.com', 'Mumbai', 26, 28000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000023', 'Swati V. Kulkarni', '+919876500023', 'swati.kulkarni@example.com', 'Pune', 20, 25000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000024', 'Nitin G. Bhat', '+919876500024', 'nitin.bhat@example.com', 'Mumbai', 38, 35000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000025', 'Preeti S. Das', '+919876500025', 'preeti.das@example.com', 'Mumbai', 14, 22000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000026', 'Akash N. Choudhury', '+919876500026', 'akash.c@example.com', 'Mumbai', 22, 27000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000027', 'Jyoti M. Sen', '+919876500027', 'jyoti.sen@example.com', 'Mumbai', 16, 23000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000028', 'Alok R. Saxena', '+919876500028', 'alok.saxena@example.com', 'Mumbai', 48, 42000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000029', 'Bhavna K. Trivedi', '+919876500029', 'bhavna.trivedi@example.com', 'Mumbai', 24, 26000, 'workindia'),
    ('c0000000-0000-0000-0000-000000000030', 'Gaurav H. Nambiar', '+919876500030', 'gaurav.n@example.com', 'Mumbai', 10, 20000, 'workindia')
ON CONFLICT (phone) DO NOTHING;

-- Applications with diverse pipeline stages
-- Stage 1: Selected & Shortlisted with Form Answers & High Scores
INSERT INTO applications (id, candidate_id, job_id, status, score, score_breakdown, token, token_expires_at, form_sent_at, replied_at)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'selected', 95.0, 
    '{"city_score": 20, "exp_score": 25, "skills_score": 25, "salary_score": 15, "notice_score": 10, "shift_score": 0, "notes": ["Exact city match", "2 yrs exp", "All 5 skills", "Expected salary 28k", "Immediate joiner"]}'::jsonb,
    'token_sample_001_amit', now() + interval '7 days', now() - interval '3 days', now() - interval '2 days'),

    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'interview', 88.0, 
    '{"city_score": 20, "exp_score": 22, "skills_score": 20, "salary_score": 15, "notice_score": 6, "shift_score": 5, "notes": ["Bengaluru resident", "1.5 yrs exp", "4 skills match", "15 days notice"]}'::jsonb,
    'token_sample_002_priya', now() + interval '7 days', now() - interval '2 days', now() - interval '1 day'),

    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'shortlisted', 91.0, 
    '{"city_score": 20, "exp_score": 25, "skills_score": 25, "salary_score": 11, "notice_score": 10, "shift_score": 0, "notes": ["Strong customer service bg", "3 yrs exp", "Immediate joiner"]}'::jsonb,
    'token_sample_003_rahul', now() + interval '7 days', now() - interval '2 days', now() - interval '1 day'),

    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'replied', 79.0, 
    '{"city_score": 20, "exp_score": 18, "skills_score": 18, "salary_score": 15, "notice_score": 8, "shift_score": 0, "notes": ["Good fit", "1 yr exp", "3 skills match"]}'::jsonb,
    'token_sample_004_sneha', now() + interval '7 days', now() - interval '1 day', now() - interval '4 hours'),

    ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', 'form_sent', 0.0, 
    '{}'::jsonb,
    'token_sample_005_vikram', now() + interval '6 days', now() - interval '26 hours', NULL), -- >24h reminder candidate

    ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', 'form_sent', 0.0, 
    '{}'::jsonb,
    'token_sample_006_pooja', now() + interval '7 days', now() - interval '5 hours', NULL),

    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', 'new', 0.0, 
    '{}'::jsonb,
    'token_sample_007_rohan', now() + interval '7 days', NULL, NULL),

    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000008', 'b0000000-0000-0000-0000-000000000001', 'new', 0.0, 
    '{}'::jsonb,
    'token_sample_008_meera', now() + interval '7 days', NULL, NULL),

    ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000001', 'rejected', 42.0, 
    '{"city_score": 10, "exp_score": 15, "skills_score": 5, "salary_score": 2, "notice_score": 5, "shift_score": 5, "notes": ["Salary ask too high (45k)", "Notice period 60 days"]}'::jsonb,
    'token_sample_009_karan', now() + interval '5 days', now() - interval '4 days', now() - interval '3 days'),

    ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000010', 'b0000000-0000-0000-0000-000000000001', 'replied', 74.0, 
    '{"city_score": 20, "exp_score": 16, "skills_score": 18, "salary_score": 15, "notice_score": 5, "shift_score": 0, "notes": ["Bengaluru based", "0.8 yrs exp"]}'::jsonb,
    'token_sample_010_neha', now() + interval '7 days', now() - interval '1 day', now() - interval '2 hours'),

    -- Mumbai Job Applications
    ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000016', 'b0000000-0000-0000-0000-000000000002', 'selected', 94.0, 
    '{"city_score": 20, "exp_score": 25, "skills_score": 25, "salary_score": 14, "notice_score": 10, "shift_score": 0, "notes": ["Top candidate", "Mumbai resident", "Immediate joiner", "Merchant onboarding expert"]}'::jsonb,
    'token_sample_016_rajesh', now() + interval '7 days', now() - interval '3 days', now() - interval '2 days'),

    ('d0000000-0000-0000-0000-000000000017', 'c0000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000002', 'interview', 89.0, 
    '{"city_score": 20, "exp_score": 23, "skills_score": 21, "salary_score": 15, "notice_score": 10, "shift_score": 0, "notes": ["Immediate joiner", "1.5 yrs b2b sales"]}'::jsonb,
    'token_sample_017_sunita', now() + interval '7 days', now() - interval '2 days', now() - interval '1 day'),

    ('d0000000-0000-0000-0000-000000000018', 'c0000000-0000-0000-0000-000000000018', 'b0000000-0000-0000-0000-000000000002', 'shortlisted', 92.0, 
    '{"city_score": 20, "exp_score": 25, "skills_score": 25, "salary_score": 12, "notice_score": 10, "shift_score": 0, "notes": ["Thane resident", "3 yrs exp", "Strong negotiation"]}'::jsonb,
    'token_sample_018_vivek', now() + interval '7 days', now() - interval '2 days', now() - interval '1 day'),

    ('d0000000-0000-0000-0000-000000000019', 'c0000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000002', 'form_sent', 0.0, 
    '{}'::jsonb,
    'token_sample_019_shalini', now() + interval '6 days', now() - interval '28 hours', NULL), -- >24h reminder candidate

    ('d0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000020', 'b0000000-0000-0000-0000-000000000002', 'new', 0.0, 
    '{}'::jsonb,
    'token_sample_020_manish', now() + interval '7 days', NULL, NULL)
ON CONFLICT (candidate_id, job_id) DO NOTHING;

-- Form Answers for Replied / Shortlisted / Interview Candidates
INSERT INTO form_answers (application_id, current_city, experience_years, matched_skills, expected_salary, notice_period_days, shift_preference, languages, preferred_interview_slot, consent_given, consent_text)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'Bengaluru', 2.0, '["Customer Service", "Chat Support", "Email Writing", "CRM Handling", "Problem Solving"]'::jsonb, 26000, 0, 'rotational', '["Hindi", "English", "Kannada"]'::jsonb, 'Tomorrow 11:00 AM - 1:00 PM', true, 'I give consent to HireFlow for processing my job application data under the India DPDP Act 2023.'),
    ('d0000000-0000-0000-0000-000000000002', 'Bengaluru', 1.5, '["Customer Service", "Chat Support", "CRM Handling", "Problem Solving"]'::jsonb, 25000, 15, 'rotational', '["Hindi", "English"]'::jsonb, 'Tomorrow 3:00 PM - 5:00 PM', true, 'I give consent to HireFlow for processing my job application data under the India DPDP Act 2023.'),
    ('d0000000-0000-0000-0000-000000000003', 'Bengaluru', 3.0, '["Customer Service", "Email Writing", "CRM Handling", "Problem Solving"]'::jsonb, 30000, 0, 'rotational', '["Hindi", "English", "Kannada"]'::jsonb, 'Wednesday 10:00 AM', true, 'I give consent to HireFlow for processing my job application data under the India DPDP Act 2023.'),
    ('d0000000-0000-0000-0000-000000000004', 'Bengaluru', 1.0, '["Customer Service", "Chat Support", "Email Writing"]'::jsonb, 22000, 7, 'day', '["Hindi", "English"]'::jsonb, 'Thursday 2:00 PM', true, 'I give consent to HireFlow for processing my job application data under the India DPDP Act 2023.'),
    ('d0000000-0000-0000-0000-000000000016', 'Mumbai', 2.0, '["Field Sales", "Lead Generation", "Merchant Onboarding", "Negotiation", "B2B Sales"]'::jsonb, 30000, 0, 'day', '["Hindi", "Marathi", "English"]'::jsonb, 'Tomorrow 10:00 AM', true, 'I give consent to HireFlow for processing my job application data under the India DPDP Act 2023.'),
    ('d0000000-0000-0000-0000-000000000017', 'Mumbai', 1.5, '["Field Sales", "Lead Generation", "Merchant Onboarding", "Negotiation"]'::jsonb, 28000, 0, 'day', '["Hindi", "Marathi"]'::jsonb, 'Tomorrow 2:00 PM', true, 'I give consent to HireFlow for processing my job application data under the India DPDP Act 2023.'),
    ('d0000000-0000-0000-0000-000000000018', 'Thane', 3.0, '["Field Sales", "Lead Generation", "Negotiation", "B2B Sales"]'::jsonb, 34000, 0, 'day', '["Hindi", "Marathi", "English"]'::jsonb, 'Friday 11:00 AM', true, 'I give consent to HireFlow for processing my job application data under the India DPDP Act 2023.')
ON CONFLICT (application_id) DO NOTHING;

-- Initial Status History & Audit Log
INSERT INTO status_history (application_id, old_status, new_status, changed_by, reason)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'interview', 'selected', 'Priya Menon (HR Exec)', 'Strong communication skills and clear customer focus.'),
    ('d0000000-0000-0000-0000-000000000002', 'shortlisted', 'interview', 'Rajesh Sharma (Admin)', 'Scheduled round 1 phone interview.'),
    ('d0000000-0000-0000-0000-000000000016', 'interview', 'selected', 'Rajesh Sharma (Admin)', 'Exceptional merchant onboarding track record.');

INSERT INTO candidate_notes (application_id, candidate_id, author_name, note_text)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Priya Menon', 'Spoke briefly on phone. Speaks fluent Hindi and English, very polite and enthusiastic.'),
    ('d0000000-0000-0000-0000-000000000016', 'c0000000-0000-0000-0000-000000000016', 'Rajesh Sharma', 'Has own bike and 2 wheeler license, ready to start immediately in Western suburbs.');

INSERT INTO audit_log (user_email, action, entity_type, entity_id, details)
VALUES
    ('admin@hireflow.internal', 'SYSTEM_INIT', 'system', 'sys_001', '{"message": "HireFlow system initialized with seed jobs and candidates"}'::jsonb),
    ('hr.priya@hireflow.internal', 'JOB_CREATED', 'job', 'b0000000-0000-0000-0000-000000000001', '{"title": "Customer Support Executive", "openings": 8}'::jsonb);

