import fs from 'fs';
import path from 'path';

const DB_FILE = process.env.HIREFLOW_DATA_FILE
  ? path.resolve(process.env.HIREFLOW_DATA_FILE)
  : path.join(process.cwd(), 'data', 'hireflow_db.json');

console.log('Seeding optional sample demo data into:', DB_FILE);

if (!fs.existsSync(DB_FILE)) {
  console.error('Target database file does not exist yet. Please run the app once first.');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));

// Sample jobs and candidates definitions
const SAMPLE_JOBS = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    title: 'Customer Support Executive (Blended - Inbound/Chat)',
    department: 'Customer Operations',
    city: 'Bengaluru',
    location: 'Koramangala 4th Block, 80 Feet Road',
    map_url: 'https://maps.google.com/?q=Koramangala+4th+Block+Bengaluru',
    openings: 8,
    min_exp_years: 0.5,
    max_exp_years: 3.0,
    min_salary: 20000,
    max_salary: 32000,
    shift_type: 'rotational',
    required_skills: ['Customer Service', 'Chat Support', 'Email Writing', 'CRM Handling', 'Problem Solving'],
    required_languages: ['Hindi', 'English', 'Kannada'],
    status: 'active',
    created_by: 'Alex',
    created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    scoring_rules: {
      id: 'sr_001',
      job_id: 'b0000000-0000-0000-0000-000000000001',
      weights: { city_weight: 20, exp_weight: 25, skills_weight: 25, salary_weight: 15, notice_weight: 10, shift_weight: 5 },
      criteria: { preferred_cities: ['Bengaluru', 'Bangalore', 'Mysuru'], max_acceptable_salary: 35000, max_notice_days: 30, mandatory_skills: ['Customer Service'] }
    }
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    title: 'Field Sales & Operations Representative',
    department: 'Direct Sales',
    city: 'Mumbai',
    location: 'Andheri East, near Marol Naka metro station',
    map_url: 'https://maps.google.com/?q=Andheri+East+Marol+Naka+Mumbai',
    openings: 12,
    min_exp_years: 1.0,
    max_exp_years: 4.0,
    min_salary: 22000,
    max_salary: 38000,
    shift_type: 'day',
    required_skills: ['Field Sales', 'Lead Generation', 'Merchant Onboarding', 'Negotiation', 'B2B Sales'],
    required_languages: ['Hindi', 'Marathi', 'English'],
    status: 'active',
    created_by: 'Alex',
    created_at: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    scoring_rules: {
      id: 'sr_002',
      job_id: 'b0000000-0000-0000-0000-000000000002',
      weights: { city_weight: 20, exp_weight: 25, skills_weight: 25, salary_weight: 15, notice_weight: 10, shift_weight: 5 },
      criteria: { preferred_cities: ['Mumbai', 'Thane', 'Navi Mumbai'], max_acceptable_salary: 40000, max_notice_days: 15, mandatory_skills: ['Field Sales'] }
    }
  }
];

if (!db.jobs) db.jobs = [];
SAMPLE_JOBS.forEach(sj => {
  if (!db.jobs.some(j => j.id === sj.id)) {
    db.jobs.push(sj);
  }
});

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
console.log('✓ Sample developer dataset populated into target database.');

