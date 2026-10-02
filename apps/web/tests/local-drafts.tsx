import React from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../src/context/ToastContext';
import { Announcements } from '../src/components/admin/pages/Announcements';
import { LearningContent } from '../src/components/admin/pages/LearningContent';
import { Challenges } from '../src/components/admin/pages/Challenges';
import { Events } from '../src/components/admin/pages/Events';
import { Redeem } from '../src/components/admin/pages/Redeem';
import '../src/index.css';

const params = new URLSearchParams(location.search);
localStorage.setItem('ecobud_admin_user', JSON.stringify({ id: params.get('user') || 'draft-test', role: 'admin' }));
localStorage.setItem('ecobud_admin_token', 'test-only');
const pages = { announcements: Announcements, learning: LearningContent, challenges: Challenges, events: Events, redeem: Redeem };
const Page = pages[params.get('section') as keyof typeof pages] || Announcements;
createRoot(document.getElementById('root')!).render(<ToastProvider><Page /></ToastProvider>);
