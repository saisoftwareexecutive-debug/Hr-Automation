import { describe, it, expect } from 'vitest';
import { createJob, updateJob, getJobs } from '../db';
import { renderTemplate, createCandidateMessage, ALLOWED_VARIABLES } from '../templates';
import { Job } from '@/types';
import { COMPANY_NAME } from '../brand';

describe('Part A: Job Location & Google Maps Link', () => {
  it('includes {{job_location}} and {{map_link}} in ALLOWED_VARIABLES', () => {
    expect(ALLOWED_VARIABLES).toContain('{{job_location}}');
    expect(ALLOWED_VARIABLES).toContain('{{map_link}}');
  });

  it('creates a job with valid location and auto-generated maps search link', async () => {
    const job = await createJob({
      title: 'Store Operations Supervisor',
      department: 'Retail Ops',
      city: 'Pune',
      location: 'FC Road, Deccan Gymkhana',
      openings: 3,
      min_exp_years: 1,
      max_exp_years: 3,
      min_salary: 22000,
      max_salary: 32000,
      shift_type: 'day',
      required_skills: ['Inventory', 'Customer Service'],
      required_languages: ['Hindi', 'Marathi', 'English'],
      status: 'active',
      created_by: 'Alex',
    });

    expect(job.id).toBeDefined();
    expect(job.location).toBe('FC Road, Deccan Gymkhana');
    expect(job.map_url).toContain('google.com/maps/search');
    expect(job.map_url).toContain(encodeURIComponent('FC Road, Deccan Gymkhana, Pune'));
  });

  it('preserves custom https map_url when supplied', async () => {
    const customMap = 'https://maps.google.com/?q=custom+landmark+pune';
    const job = await createJob({
      title: 'Warehouse Executive',
      department: 'Logistics',
      city: 'Pune',
      location: 'Chakan MIDC Phase 2',
      map_url: customMap,
      openings: 5,
      min_exp_years: 1,
      max_exp_years: 4,
      min_salary: 25000,
      max_salary: 35000,
      shift_type: 'rotational',
      required_skills: ['Warehouse Management'],
      required_languages: ['Hindi', 'English'],
      status: 'active',
      created_by: 'Alex',
    });

    expect(job.location).toBe('Chakan MIDC Phase 2');
    expect(job.map_url).toBe(customMap);
  });

  it('trims and limits location to 200 characters on update', async () => {
    const jobs = await getJobs();
    const target = jobs[0];

    const longLocation = 'A'.repeat(250);
    const updated = await updateJob(target.id, {
      location: `   ${longLocation}   `,
    });

    expect(updated).not.toBeNull();
    expect(updated?.location?.length).toBe(200);
    expect(updated?.location?.startsWith('A')).toBe(true);
  });

  it('renders templates with job_location and map_link present', () => {
    const template = `Interview for {{job_title}} at {{company_name}}
Date: {{interview_date}} at {{interview_time}}
Venue: {{interview_location}}
Workplace: {{job_location}}
Map: {{map_link}}
Contact: {{hr_phone}}`;

    const rendered = renderTemplate(template, {
      job_title: 'Customer Executive',
      company_name: COMPANY_NAME,
      interview_date: 'Tomorrow',
      interview_time: '11:00 AM',
      interview_location: 'Head Office',
      job_location: 'Andheri East, near Marol Naka metro station',
      map_link: 'https://maps.google.com/?q=Andheri+East+Mumbai',
      hr_phone: '+91 98200 12345',
    });

    expect(rendered).toContain('Workplace: Andheri East, near Marol Naka metro station');
    expect(rendered).toContain('Map: https://maps.google.com/?q=Andheri+East+Mumbai');
    expect(rendered).not.toContain('undefined');
  });

  it('cleanly removes job_location and map_link lines when empty without blank lines or undefined', () => {
    const template = `Interview for {{job_title}} at {{company_name}}
Date: {{interview_date}} at {{interview_time}}
Venue: {{interview_location}}
Workplace: {{job_location}}
Map: {{map_link}}
Contact: {{hr_phone}}`;

    const rendered = renderTemplate(template, {
      job_title: 'Customer Executive',
      company_name: COMPANY_NAME,
      interview_date: 'Tomorrow',
      interview_time: '11:00 AM',
      interview_location: 'Head Office',
      job_location: '',
      map_link: '',
      hr_phone: '+91 98200 12345',
    });

    expect(rendered).not.toContain('Workplace:');
    expect(rendered).not.toContain('Map:');
    expect(rendered).not.toContain('undefined');
    // Ensure no triple or double empty line breaks
    expect(rendered).not.toMatch(/\n{3,}/);
    expect(rendered).toContain('Venue: Head Office\nContact: +91 98200 12345');
  });

  it('defaults interview_location to job_location in createCandidateMessage when interview_location is omitted', () => {
    const msg = createCandidateMessage(
      'interview_invite',
      'en',
      'Rohan Sharma',
      'Support Associate',
      '+919876543210',
      'tok123',
      'Tomorrow at 2:00 PM',
      'http://localhost:3000',
      undefined,
      {
        company_name: COMPANY_NAME,
        job_city: 'Mumbai',
        job_location: 'Andheri East, near Marol Naka metro station',
      }
    );

    expect(msg.text).toContain('Andheri East, near Marol Naka metro station');
    expect(msg.text).not.toContain('undefined');
  });

  it('safely handles legacy jobs without location in getJobs()', async () => {
    const allJobs = await getJobs();
    for (const job of allJobs) {
      expect(job.location).toBeDefined();
      expect(typeof job.location).toBe('string');
      expect(job.location).not.toBe('undefined');
    }
  });
});

