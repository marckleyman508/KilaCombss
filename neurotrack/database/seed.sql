-- NeuroTrack Seed Data
-- Passwords are bcrypt hash of 'Password123!'

INSERT INTO users (id, email, password_hash, first_name, last_name, role, specialty, license_number) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'admin@neurotrack.dev',  '$2b$10$rIC2L8o6Qa3kfBkHPRFx3.TlXj6JvBhEpDfUaWLkimCMBjhZhGJoi', 'Sarah',   'Okonkwo',  'admin',  NULL,                  NULL),
  ('a1000000-0000-0000-0000-000000000002', 'drchen@neurotrack.dev', '$2b$10$rIC2L8o6Qa3kfBkHPRFx3.TlXj6JvBhEpDfUaWLkimCMBjhZhGJoi', 'Michael', 'Chen',     'doctor', 'Neurology',           'NL-2021-0042'),
  ('a1000000-0000-0000-0000-000000000003', 'drpatel@neurotrack.dev','$2b$10$rIC2L8o6Qa3kfBkHPRFx3.TlXj6JvBhEpDfUaWLkimCMBjhZhGJoi', 'Priya',   'Patel',    'doctor', 'Geriatric Psychiatry', 'GP-2019-0187'),
  ('a1000000-0000-0000-0000-000000000004', 'drgomez@neurotrack.dev','$2b$10$rIC2L8o6Qa3kfBkHPRFx3.TlXj6JvBhEpDfUaWLkimCMBjhZhGJoi', 'Carlos',  'Gomez',    'doctor', 'Movement Disorders',  'MD-2020-0311');

INSERT INTO patients (id, mrn, first_name, last_name, date_of_birth, gender, email, phone,
  primary_doctor_id, diagnosis_type, diagnosis_date, disease_stage) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'MRN-2024-0001', 'Eleanor', 'Whitfield', '1945-03-12', 'female', 'e.whitfield@email.com', '555-0101', 'a1000000-0000-0000-0000-000000000002', 'alzheimers', '2022-06-15', 'moderate'),
  ('b1000000-0000-0000-0000-000000000002', 'MRN-2024-0002', 'Harold',  'Kasprzak',  '1950-08-27', 'male',   'h.kasprzak@email.com',  '555-0102', 'a1000000-0000-0000-0000-000000000002', 'parkinsons', '2021-11-03', 'moderate'),
  ('b1000000-0000-0000-0000-000000000003', 'MRN-2024-0003', 'Dorothy', 'Nkrumah',   '1938-12-05', 'female', 'd.nkrumah@email.com',   '555-0103', 'a1000000-0000-0000-0000-000000000003', 'alzheimers', '2020-02-20', 'advanced'),
  ('b1000000-0000-0000-0000-000000000004', 'MRN-2024-0004', 'Robert',  'Tanaka',    '1955-05-18', 'male',   'r.tanaka@email.com',    '555-0104', 'a1000000-0000-0000-0000-000000000004', 'parkinsons', '2023-01-10', 'early'),
  ('b1000000-0000-0000-0000-000000000005', 'MRN-2024-0005', 'Margaret','Svensson',  '1942-09-30', 'female', 'm.svensson@email.com',  '555-0105', 'a1000000-0000-0000-0000-000000000003', 'alzheimers', '2021-07-22', 'moderate'),
  ('b1000000-0000-0000-0000-000000000006', 'MRN-2024-0006', 'James',   'Obi',       '1948-11-14', 'male',   'j.obi@email.com',       '555-0106', 'a1000000-0000-0000-0000-000000000004', 'parkinsons', '2022-04-05', 'moderate');

INSERT INTO medical_history (patient_id, condition_name, onset_date, is_ongoing, recorded_by) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Hypertension',      '2010-01-01', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000001', 'Type 2 Diabetes',   '2015-06-01', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000002', 'Hypertension',      '2012-03-01', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000002', 'Anxiety Disorder',  '2019-05-01', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000003', 'Atrial Fibrillation','2016-09-01', true,  'a1000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000004', 'Hyperlipidemia',    '2018-01-01', true,  'a1000000-0000-0000-0000-000000000004');

INSERT INTO surgeries (patient_id, procedure_name, procedure_date, performing_surgeon, facility, outcome, recorded_by) VALUES
  ('b1000000-0000-0000-0000-000000000002', 'Deep Brain Stimulation (DBS)', '2023-03-15', 'Dr. Nguyen', 'University Medical Center', 'successful',          'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000001', 'Hip Replacement',              '2020-08-10', 'Dr. Fischer', 'St. Mary Hospital',        'successful',          'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000006', 'Deep Brain Stimulation (DBS)', '2023-09-20', 'Dr. Nguyen', 'University Medical Center', 'ongoing_recovery',    'a1000000-0000-0000-0000-000000000004');

INSERT INTO medications (patient_id, medication_name, dosage, frequency, start_date, is_current, prescribed_by) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Donepezil',    '10mg',   'Once daily',      '2022-07-01', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000001', 'Memantine',    '20mg',   'Once daily',      '2023-01-15', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000002', 'Levodopa',     '250mg',  'Three times daily','2022-01-10', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000002', 'Carbidopa',    '25mg',   'Three times daily','2022-01-10', true,  'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000003', 'Donepezil',    '10mg',   'Once daily',      '2020-03-01', true,  'a1000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000003', 'Rivastigmine', '9.5mg',  'Patch, once daily','2021-06-01', true,  'a1000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000004', 'Pramipexole',  '0.5mg',  'Three times daily','2023-02-01', true,  'a1000000-0000-0000-0000-000000000004'),
  ('b1000000-0000-0000-0000-000000000005', 'Memantine',    '20mg',   'Once daily',      '2021-09-01', true,  'a1000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000006', 'Levodopa',     '100mg',  'Twice daily',     '2022-05-01', true,  'a1000000-0000-0000-0000-000000000004');

INSERT INTO treatments (id, name, description, treatment_type, diagnosis_type, created_by) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Cognitive Stimulation Therapy',     'Weekly structured group cognitive exercises',       'cognitive_therapy',    'alzheimers', 'a1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'Gait Training Program',             'Physical therapy focused on gait and balance',       'physical_therapy',     'parkinsons', 'a1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000003', 'Deep Brain Stimulation (DBS)',       'Surgical neurostimulation for motor control',        'surgical',             'parkinsons', 'a1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000004', 'Cholinesterase Inhibitor Therapy',  'Pharmacological treatment with donepezil/rivastigmine','pharmacological',     'alzheimers', 'a1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000005', 'Speech and Language Therapy',       'Targeted speech and swallowing rehabilitation',      'speech_therapy',       'both',       'a1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000006', 'Levodopa / Carbidopa Therapy',      'Dopamine precursor pharmacological management',      'pharmacological',      'parkinsons', 'a1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000007', 'Occupational Therapy - ADL Focus',  'Daily living skills and home safety adaptation',     'occupational_therapy', 'both',       'a1000000-0000-0000-0000-000000000001');

-- Progress logs over 6 months for key patients
INSERT INTO progress_logs (patient_id, recorded_by, log_date, mmse_score, moca_score, tremor_severity, mobility_score, rigidity_score, overall_condition, clinician_notes) VALUES
  -- Eleanor (Alzheimer's) - gradual cognitive decline
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','2024-01-10', 19, 16, NULL, NULL, NULL, 'stable',   'Patient oriented to place and person. Memory recall impaired for recent events.'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','2024-02-14', 18, 15, NULL, NULL, NULL, 'stable',   'Slight decrease in MMSE. Caregiver reports increased nighttime confusion.'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','2024-03-11', 17, 14, NULL, NULL, NULL, 'declined', 'Notable decline in executive function tasks. Adjusted CST frequency.'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','2024-04-09', 17, 15, NULL, NULL, NULL, 'stable',   'Stabilized. Responds well to CST. Memantine dose maintained.'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','2024-05-13', 16, 14, NULL, NULL, NULL, 'declined', 'Increased word-finding difficulty. Referral to speech therapy initiated.'),
  ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','2024-06-10', 16, 13, NULL, NULL, NULL, 'stable',   'Score plateau. Patient engaged with speech therapy. Caregiver support reinforced.'),

  -- Harold (Parkinson's) - post-DBS with improvement
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2024-01-08', 26, 24, 3, 52, 2, 'stable',   'Pre-DBS follow-up. Tremor moderate bilaterally. Levodopa effective but wearing off.'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2024-02-12', 26, 24, 2, 61, 2, 'improved', 'Post-DBS 11 months: tremor reduced. Mobility improving. Medication dose reduced 15%.'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2024-03-18', 27, 25, 2, 68, 1, 'improved', 'Excellent gait training response. Rigidity score improved. Patient ambulating independently.'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2024-04-15', 26, 25, 2, 71, 1, 'stable',   'Stable. DBS parameters unchanged. Continue current PT protocol.'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2024-05-20', 27, 25, 1, 75, 1, 'improved', 'Significant motor improvement. Tremor nearly resolved at rest. Patient reports improved QoL.'),
  ('b1000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','2024-06-17', 27, 26, 1, 78, 1, 'improved', 'Best scores to date. Considering levodopa dose reduction. Gait normal on flat surfaces.'),

  -- Dorothy (advanced Alzheimer's) - decline
  ('b1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000003','2024-01-05',  9,  7, NULL, NULL, NULL, 'declined', 'Advanced stage. Requires full ADL assistance. Recognizes primary caregiver only.'),
  ('b1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000003','2024-03-07',  8,  6, NULL, NULL, NULL, 'declined', 'Further decline. Dysphagia noted. Speech therapy consult for swallowing protocol.'),
  ('b1000000-0000-0000-0000-000000000003','a1000000-0000-0000-0000-000000000003','2024-05-09',  7,  5, NULL, NULL, NULL, 'declined', 'Minimal verbal communication. Comfort-focused care discussed with family.'),

  -- Robert (early Parkinson's)
  ('b1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000004','2024-01-22', 28, 27, 1, 88, 1, 'stable',   'Early stage. Mild resting tremor right hand. Pramipexole well-tolerated.'),
  ('b1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000004','2024-03-19', 28, 27, 1, 90, 1, 'improved', 'Gait training showing results. Patient very motivated. No progression noted.'),
  ('b1000000-0000-0000-0000-000000000004','a1000000-0000-0000-0000-000000000004','2024-05-21', 29, 28, 1, 92, 0, 'improved', 'Excellent response to therapy. Rigidity resolved. Minimal functional impairment.');

INSERT INTO research_papers (id, title, authors, publication_year, journal, doi, tags, diagnosis_relevance, summary, added_by, external_source) VALUES
  ('d1000000-0000-0000-0000-000000000001',
   'Deep Brain Stimulation for Advanced Parkinson Disease: A Randomized Controlled Trial',
   ARRAY['Deuschl G', 'Schade-Brittinger C', 'Krack P', 'Volkmann J'],
   2006, 'New England Journal of Medicine',
   '10.1056/NEJMoa060281',
   ARRAY['DBS', 'motor function', 'randomized controlled trial', 'surgical'],
   ARRAY['parkinsons'],
   'DBS of the subthalamic nucleus significantly improved motor function, quality of life, and allowed reduction in levodopa dose in advanced PD patients compared to medical therapy alone.',
   'a1000000-0000-0000-0000-000000000002', 'manual'),

  ('d1000000-0000-0000-0000-000000000002',
   'Donepezil in Patients with Severe Alzheimer Disease',
   ARRAY['Black SE', 'Doody R', 'Li H', 'McRae T'],
   2007, 'Archives of Neurology',
   '10.1001/archneur.64.8.1107',
   ARRAY['donepezil', 'cholinesterase inhibitor', 'cognitive function', 'pharmacological'],
   ARRAY['alzheimers'],
   'Donepezil demonstrated statistically significant cognitive benefits in severe Alzheimer disease versus placebo, supporting continued use in advanced stages.',
   'a1000000-0000-0000-0000-000000000003', 'manual'),

  ('d1000000-0000-0000-0000-000000000003',
   'Cognitive Stimulation Therapy for Dementia: A Systematic Review',
   ARRAY['Woods B', 'Aguirre E', 'Spector AE', 'Orrell M'],
   2012, 'Cochrane Database of Systematic Reviews',
   '10.1002/14651858.CD005562.pub2',
   ARRAY['cognitive stimulation', 'non-pharmacological', 'group therapy', 'quality of life'],
   ARRAY['alzheimers'],
   'CST provides significant benefits for cognition and quality of life in people with mild to moderate dementia, comparable in effect size to cholinesterase inhibitors.',
   'a1000000-0000-0000-0000-000000000003', 'manual'),

  ('d1000000-0000-0000-0000-000000000004',
   'Exercise and Parkinson Disease: A Systematic Review',
   ARRAY['Tomlinson CL', 'Patel S', 'Meek C', 'Herd CP'],
   2012, 'Movement Disorders',
   '10.1002/mds.25108',
   ARRAY['exercise', 'physical therapy', 'gait', 'balance', 'motor function'],
   ARRAY['parkinsons'],
   'Exercise, particularly treadmill training and physiotherapy, improves gait speed, balance, and overall motor function in Parkinson disease patients.',
   'a1000000-0000-0000-0000-000000000004', 'manual');

INSERT INTO treatment_research_links (treatment_id, research_paper_id, relevance_notes, linked_by) VALUES
  ('c1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'Primary evidence base for DBS surgical indication',       'a1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'Supports use of donepezil in moderate-to-severe AD',       'a1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003', 'CST protocol based on Cochrane meta-analysis findings',    'a1000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000004', 'Gait training program informed by systematic review',      'a1000000-0000-0000-0000-000000000004');

INSERT INTO patient_events (patient_id, event_type, event_date, title, description, recorded_by) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'diagnosis',         '2022-06-15', 'Alzheimer''s Diagnosis',          'Confirmed moderate-stage Alzheimer''s disease via neuropsychological evaluation and MRI.',           'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000001', 'medication_start',  '2022-07-01', 'Started Donepezil 10mg',          'Initiated cholinesterase inhibitor therapy.',                                                       'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000001', 'surgery',           '2020-08-10', 'Hip Replacement Surgery',         'Right total hip arthroplasty. Successful outcome.',                                                 'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000002', 'diagnosis',         '2021-11-03', 'Parkinson''s Disease Diagnosis',  'Confirmed via clinical assessment and DAT-SPECT imaging.',                                          'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000002', 'surgery',           '2023-03-15', 'Deep Brain Stimulation Surgery',  'Bilateral STN-DBS implantation at University Medical Center.',                                      'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000002', 'medication_start',  '2022-01-10', 'Started Levodopa/Carbidopa',      'Initiated dopaminergic therapy regimen.',                                                           'a1000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000004', 'diagnosis',         '2023-01-10', 'Parkinson''s Disease Diagnosis',  'Early-stage PD. Resting tremor, mild bradykinesia. UPDRS-III score 12.',                            'a1000000-0000-0000-0000-000000000004'),
  ('b1000000-0000-0000-0000-000000000004', 'treatment_start',   '2023-02-15', 'Enrolled in Gait Training Program','Bi-weekly physiotherapy sessions initiated.',                                                    'a1000000-0000-0000-0000-000000000004');
