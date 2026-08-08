/** Shared by seedDemoData.js and removeDemoData.js — kept in its own
    side-effect-free module (rather than exported from seedDemoData.js
    itself) specifically so importing this constant can never also
    trigger seedDemoData.js's top-level run() call. Every record either
    script touches is tagged with exactly this value. */
export const DEMO_SOURCE = 'ARNA_DEMO';
