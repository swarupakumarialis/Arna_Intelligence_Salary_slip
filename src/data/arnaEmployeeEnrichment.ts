import { Employee } from '../types';

/**
 * One-time enrichment patch for the ARNA Team Directory.
 *
 * seedEmployeesIfEmpty() only ever runs against an empty directory, so
 * updating arnaTeamSeed.ts alone does not reach installations that were
 * already seeded before this data became available. This patch set is
 * applied once (via applyEmployeeEnrichment() in utils/employeeStore.ts,
 * gated by ARNA_EMPLOYEE_ENRICHMENT_FLAG) to bring existing seeded
 * records up to date without touching Employee IDs, names, employment
 * types, or any field not listed below.
 *
 * Deliberately excludes ARNA/CONT006 (Ritek Sharma) and any "Ayush
 * Verma" record — both are intentionally kept out of the ARNA Team
 * Directory per explicit instruction.
 */
export const ARNA_EMPLOYEE_ENRICHMENT: Record<string, Partial<Employee>> = {
  'ARNA/INT001': {
    email: 'swarupakumari062@gmail.com',
    phone: '8787413004',
    address: 'Village Baghauna, PO: Baghauna, Siwan, Bihar - 841210',
    designation: 'AI Systems & Operations Intern',
    doj: '2026-03-09',
  },
  'ARNA/CONT001': {
    email: 'laxmiarun@alis-global.com',
    phone: '9449033576',
    address: '1468, 7th Cross, Krishnamurthypuram, Mysore',
    designation: 'Strategic Contributor',
    doj: '2025-10-20',
  },
  'ARNA/CONT002': {
    email: 'debankamaiti1990@gmail.com',
    phone: '9130564451',
    address: 'A-301, Wisteria CHS, Manjari Road, Keshav Nagar, Mundhwa, Pune, Maharashtra - 411036',
    designation: 'Chief Operating Officer',
    doj: '2026-02-01',
  },
  'ARNA/CONT003': {
    email: 'niharikaofficial.2023@gmail.com',
    phone: '07683001610',
    address: 'Amma Ashram Lane D-48, Naveli, Vasant Kunj, Delhi - 110070',
    designation: 'Strategic Contributor',
    doj: '2026-04-03',
  },
  'ARNA/CONT005': {
    email: 'sushmakarnati14@gmail.com',
    phone: '9182002801',
    address: 'Hayathnagar, Hyderabad',
    designation: 'AI-Native Full-Stack & Middleware Engineer',
    doj: '2026-06-09',
  },
  'ARNA/CONT007': {
    email: 'shashank.shekhar2k17@gmail.com',
    phone: '9956820045',
    address: '18 Satya Puram Colony, Balaganj, Lucknow, Uttar Pradesh - 226003',
    designation: 'Fullstack Engineer',
    doj: '2026-06-22',
  },
  'ARNA/CONT008': {
    email: 'thoratrohit25@gmail.com',
    phone: '9082873256',
    address: 'Flat No. 808, Siddhivinayak Society, Siddharth Nagar, Kopri Colony, Thane East, Maharashtra',
    designation: 'Strategic Contributor',
    doj: '2000-10-25',
  },
};

export const ARNA_EMPLOYEE_ENRICHMENT_FLAG = 'arna_employee_enrichment_v1';
