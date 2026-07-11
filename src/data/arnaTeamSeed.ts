import { Employee } from '../types';

/**
 * Seed roster for Arnas Learning Intelligence Studio ("ARNA").
 *
 * Loaded once via seedEmployeesIfEmpty() in utils/employeeStore.ts,
 * and only when the employee directory is completely empty — it never
 * overwrites employees that already exist, whether seeded or entered
 * by a user.
 *
 * To bootstrap a *different* company instead of ARNA:
 *   1. Add a sibling file, e.g. src/data/acmeTeamSeed.ts, exporting an
 *      Employee[] in this same shape.
 *   2. In App.tsx, change the single ACTIVE_EMPLOYEE_SEED import to
 *      point at the new file (and update TEAM_DIRECTORY_TITLE if the
 *      module's display name should change too).
 * No changes are needed anywhere else — employeeStore.ts, the
 * Employee type, and the EmployeeMaster UI are all company-agnostic.
 */
export const arnaTeamSeed: Employee[] = [
  {
    id: 'seed-arna-int001',
    employeeId: 'ARNA/INT001',
    name: 'Swarupa Kumari',
    email: 'swarupakumari062@gmail.com',
    phone: '8787413004',
    address: 'Village Baghauna, PO: Baghauna, Siwan, Bihar - 841210',
    department: '',
    designation: 'AI Systems & Operations Intern',
    employmentType: 'Intern',
    doj: '2026-03-09',
    status: 'Active',
  },
  {
    id: 'seed-arna-cont001',
    employeeId: 'ARNA/CONT001',
    name: 'Laxmi Arun',
    email: 'laxmiarun@alis-global.com',
    phone: '9449033576',
    address: '1468, 7th Cross, Krishnamurthypuram, Mysore',
    department: '',
    designation: 'Strategic Contributor',
    employmentType: 'Contract',
    doj: '2025-10-20',
    status: 'Active',
  },
  {
    id: 'seed-arna-cont002',
    employeeId: 'ARNA/CONT002',
    name: 'Debanka Maiti',
    email: 'debankamaiti1990@gmail.com',
    phone: '9130564451',
    address: 'A-301, Wisteria CHS, Manjari Road, Keshav Nagar, Mundhwa, Pune, Maharashtra - 411036',
    department: '',
    designation: 'Chief Operating Officer',
    employmentType: 'Contract',
    doj: '2026-02-01',
    status: 'Active',
  },
  {
    id: 'seed-arna-cont003',
    employeeId: 'ARNA/CONT003',
    name: 'Niharika Sarkar',
    email: 'niharikaofficial.2023@gmail.com',
    phone: '07683001610',
    address: 'Amma Ashram Lane D-48, Naveli, Vasant Kunj, Delhi - 110070',
    department: '',
    designation: 'Strategic Contributor',
    employmentType: 'Contract',
    doj: '2026-04-03',
    status: 'Active',
  },
  {
    id: 'seed-arna-cont004',
    employeeId: 'ARNA/CONT004',
    name: 'Sunitha Vaidya',
    email: 'sunithavaidya@alis-global.com',
    department: '',
    designation: '',
    employmentType: 'Contract',
    doj: '',
    status: 'Active',
  },
  {
    id: 'seed-arna-cont005',
    employeeId: 'ARNA/CONT005',
    name: 'Sushma Karnati',
    email: 'sushmakarnati14@gmail.com',
    phone: '9182002801',
    address: 'Hayathnagar, Hyderabad',
    department: '',
    designation: 'AI-Native Full-Stack & Middleware Engineer',
    employmentType: 'Contract',
    doj: '2026-06-09',
    status: 'Active',
  },
  {
    id: 'seed-arna-cont007',
    employeeId: 'ARNA/CONT007',
    name: 'Shashank Sekhar',
    email: 'shashank.shekhar2k17@gmail.com',
    phone: '9956820045',
    address: '18 Satya Puram Colony, Balaganj, Lucknow, Uttar Pradesh - 226003',
    department: '',
    designation: 'Fullstack Engineer',
    employmentType: 'Contract',
    doj: '2026-06-22',
    status: 'Active',
  },
  {
    id: 'seed-arna-cont008',
    employeeId: 'ARNA/CONT008',
    name: 'Rohit Throat',
    email: 'thoratrohit25@gmail.com',
    phone: '9082873256',
    address: 'Flat No. 808, Siddhivinayak Society, Siddharth Nagar, Kopri Colony, Thane East, Maharashtra',
    department: '',
    designation: 'Strategic Contributor',
    employmentType: 'Contract',
    doj: '2000-10-25',
    status: 'Active',
  },
];
