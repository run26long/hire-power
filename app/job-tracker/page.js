'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import MainNav from '../components/MainNav';
import JobCardModal from '../components/JobCardModal';
import ErrorToast from '../components/ErrorToast';
import { fetchJSON } from '@/lib/fetchJSON';

async function fireJT3OnOptIn(supabase, cardId) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()
    await supabase
      .from('applications')
      .update({ follow_up_reminder_opt_in: true })
      .eq('id', cardId)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        followUpReminderSet: now
      })
    })
  } catch (e) {
    console.error('JT3 trigger failed (non-blocking):', e)
  }
}

async function fireJT6(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ first_hired_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        firstHiredAt: now
      })
    })
  } catch (e) {
    console.error('JT6 trigger failed (non-blocking):', e)
  }
}

async function fireJT2IfFirst(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_applied_at')
      .eq('id', user.id)
      .single()
    if (!profile || profile.first_applied_at) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ first_applied_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        firstAppliedAt: now
      })
    })
  } catch (e) {
    console.error('JT2 trigger failed (non-blocking):', e)
  }
}

async function fireJT1IfFirst(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_card_created_at')
      .eq('id', user.id)
      .single()
    if (!profile || profile.first_card_created_at) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ first_card_created_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        firstCardCreatedAt: now
      })
    })
  } catch (e) {
    console.error('JT1 trigger failed (non-blocking):', e)
  }
}

async function syncTrackerActivity(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const now = new Date().toISOString()
    await supabase.from('profiles').update({ last_tracker_activity_at: now }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        lastTrackerActivityAt: now
      })
    })
  } catch (e) {
    console.error('Tracker activity sync failed (non-blocking):', e)
  }
}

async function updateAppliedCardCount(supabase) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { count } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('current_status', 'applied')
    await supabase.from('profiles').update({ applied_card_count: count || 0 }).eq('id', user.id)
    await fetch('/api/loops/sync-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        userId: user.id,
        appliedCardCount: count || 0
      })
    })
  } catch (e) {
    console.error('Applied card count sync failed (non-blocking):', e)
  }
}

const COLUMNS = [
  { id: 'resume_in_progress', label: 'Prepping', color: '#7c3aed', bg: 'rgba(124,58,237,0.06)',  border: 'rgba(124,58,237,0.2)'  },
  { id: 'applied',            label: 'Applied',      color: '#1d4ed8', bg: 'rgba(29,78,216,0.06)',   border: 'rgba(29,78,216,0.2)'   },
  { id: 'interview',          label: 'Interview',    color: '#92400e', bg: 'rgba(146,64,14,0.06)',   border: 'rgba(146,64,14,0.2)'   },
  { id: 'rejected',           label: 'Rejected',     color: '#6b7280', bg: 'rgba(107,114,128,0.06)', border: 'rgba(107,114,128,0.2)' },
  { id: 'hired',              label: 'Hired',        color: '#15803d', bg: 'rgba(21,128,61,0.06)',   border: 'rgba(21,128,61,0.2)'   },
];

function StatusBadge({ status }) {
  const config = {
    resume_in_progress: { label: 'Prepping', bg: '#f5f3ff', border: '#c4b5fd', text: '#5b21b6' },
    applied:            { label: 'Applied',       bg: '#fefce8', border: '#fde047', text: '#854d0e' },
    interview:          { label: 'Interview',     bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
    hired:              { label: 'Hired',         bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    rejected:           { label: 'Rejected',      bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    archived:           { label: 'Archived',      bg: '#f9fafb', border: '#d1d5db', text: '#6b7280' },
  };
  const c = config[status] || config.applied;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide"
      style={{ background: c.bg, borderColor: c.border, color: c.text }}>
      {c.label}
    </span>
  );
}

export default function JobTrackerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [archivedCards, setArchivedCards] = useState([]);
  const [jsResumes, setJsResumes] = useState([]);
  
  const [interviewRounds, setInterviewRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [cardOpenedFromArchive, setCardOpenedFromArchive] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
 const [showHiredModal, setShowHiredModal] = useState(false);
  const [hiredCard, setHiredCard] = useState(null);
  const [rejectedPromptCard, setRejectedPromptCard] = useState(null);

  const [mobileColumn, setMobileColumn] = useState('resume_in_progress');
  const [deleteConfirmCard, setDeleteConfirmCard] = useState(null);
  const [restoringId, setRestoringId] = useState(null);
  const [toast, setToast] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const [dragCard, setDragCard] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const [newTitle, setNewTitle] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newResumeId, setNewResumeId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // AP-style title case — detects deliberate casing vs mobile auto-cap artifacts.
  // Protects "iOS Developer", "SaaS Engineer" (caps mid-word = deliberate).
  // Normalizes "Mall at millennia" from mobile auto-cap (caps only at word starts).
  function toTitleCaseOnBlur(value) {
    if (!value) return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    const words = trimmed.split(/\s+/);
    const hasMidWordCap = words.some(w => {
      for (let i = 1; i < w.length; i++) {
        if (w[i] >= 'A' && w[i] <= 'Z') return true;
      }
      return false;
    });
    if (hasMidWordCap) return trimmed;
    const smallWords = new Set(['a','an','and','as','at','but','by','for','if','in','nor','of','on','or','so','the','to','up','yet']);
    const acronyms = new Set(['hr','it','pr','qa','ui','ux','vp','ceo','cfo','coo','cto','cmo','seo','ai','ml']);
    const tokens = trimmed.toLowerCase().split(/(\s+)/);
    const wordIndices = [];
    tokens.forEach((tok, i) => { if (tok.trim() !== '') wordIndices.push(i); });
    const firstIdx = wordIndices[0];
    const lastIdx = wordIndices[wordIndices.length - 1];
    return tokens.map((tok, i) => {
      if (tok.trim() === '') return tok;
      const cleanTok = tok.replace(/[^a-z]/g, '');
      if (acronyms.has(cleanTok)) return tok.toUpperCase();
      const isFirst = i === firstIdx;
      const isLast = i === lastIdx;
      if (!isFirst && !isLast && smallWords.has(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    }).join('');
  }

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/dashboard'); return; }
        setUser(user);

        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('*').eq('id', user.id).single();
        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }
        setUserProfile(profile);

        const { data: apps, error: appsError } = await supabase
          .from('applications')
          .select('*, resumes!applications_resume_id_fkey(display_name, current_score)')
          .eq('user_id', user.id)
          .not('application_status', 'eq', 'archived')
          .order('sort_order', { ascending: true });
        if (appsError) throw appsError;
        setApplications(apps || []);

        const { data: archived, error: archivedError } = await supabase
          .from('applications')
          .select('*, resumes!applications_resume_id_fkey(id, display_name, current_score)')
          .eq('user_id', user.id)
          .eq('application_status', 'archived')
          .order('updated_at', { ascending: false });
        if (archivedError) throw archivedError;
        setArchivedCards(archived || []);

        const { data: resumes, error: resumesError } = await supabase
          .from('resumes')
          .select('id, display_name, current_score, job_title, job_company, job_description')
          .eq('user_id', user.id)
          .eq('resume_type', 'job_specific')
          .eq('is_active', true)
          .order('updated_at', { ascending: false });
        if (resumesError) throw resumesError;
        setJsResumes(resumes || []);

      } catch (err) {
        console.error('Job tracker load failed:', err);
        setErrorToast("We couldn't load your job tracker. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getColumnCards = (columnId) =>
    applications.filter(a => a.application_status === columnId);

  const handleDragStart = (e, card) => {
    setDragCard(card);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDrop = async (e, columnId) => {
    e.preventDefault();
    if (!dragCard || dragCard.application_status === columnId) {
      setDragCard(null);
      setDragOverColumn(null);
      return;
    }
    const droppedCard = dragCard;
    const previousStatus = dragCard.application_status;

    // Optimistic update
    setApplications(prev => prev.map(a =>
      a.id === dragCard.id ? { ...a, application_status: columnId } : a
    ));

    const { error } = await supabase
      .from('applications')
      .update({ application_status: columnId, updated_at: new Date().toISOString() })
      .eq('id', dragCard.id);

    if (error) {
      // Revert optimistic update
      setApplications(prev => prev.map(a =>
        a.id === droppedCard.id ? { ...a, application_status: previousStatus } : a
      ));
      setToast({ type: 'error', message: 'Move failed. Please try again.', card: null });
      setTimeout(() => setToast(null), 4000);
      setDragCard(null);
      setDragOverColumn(null);
      return;
    }

    // Sync tracker activity + applied count
    syncTrackerActivity(supabase);
    if (columnId === 'applied' || previousStatus === 'applied') {
      updateAppliedCardCount(supabase);
    }

    // Show toast for applied and interview moves
    if (columnId === 'applied') {
      fireJT2IfFirst(supabase);
      const updatedCard = { ...droppedCard, application_status: 'applied' };
      setToast({ type: 'info', message: "Moved to Applied. Open the card to schedule a follow-up or start interview prep.", card: updatedCard });
      setTimeout(() => setToast(null), 5000);
    } else if (columnId === 'interview') {
      const updatedCard = { ...droppedCard, application_status: 'interview' };
      setToast({ type: 'info', message: "Moved to Interview. Open the card to save your interview date and practice questions.", card: updatedCard });
      setTimeout(() => setToast(null), 5000);
    }

    // Rejected: show prompt to archive or keep on board
    if (columnId === 'rejected') {
      setTimeout(() => {
        setRejectedPromptCard({ ...droppedCard, previousStatus });
      }, 600);
    }

   // Hired: archive any existing hired card, write hired_at, show celebration
    if (columnId === 'hired') {
      fireJT6(supabase);
      const hiredAt = new Date().toISOString();

      // Find and archive any existing hired card — exclude the card we just moved
      const { data: existingHired, error: existingHiredError } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(display_name, current_score)')
        .eq('user_id', user.id)
        .eq('application_status', 'hired')
        .neq('id', dragCard.id)
        .maybeSingle();

      if (existingHiredError) {
        console.error('Lookup existing hired card failed:', existingHiredError);
        setErrorToast("We couldn't update your hired status. Please refresh and try again.");
        setDragCard(null);
        setDragOverColumn(null);
        return;
      }

      if (existingHired) {
        const { error: archiveError } = await supabase
          .from('applications')
          .update({ application_status: 'archived', last_active_status: 'hired', updated_at: hiredAt })
          .eq('id', existingHired.id);
        if (archiveError) {
          console.error('Archive previous hired card failed:', archiveError);
          setErrorToast("We couldn't update your hired status. Please refresh and try again.");
          setDragCard(null);
          setDragOverColumn(null);
          return;
        }
        setApplications(prev => prev.filter(a => a.id !== existingHired.id));
        setArchivedCards(prev => [...prev, { ...existingHired, application_status: 'archived', last_active_status: 'hired' }]);
      }

      // Set new card as hired
      const { error: hiredAtError } = await supabase
        .from('applications')
        .update({ hired_at: hiredAt, updated_at: hiredAt })
        .eq('id', dragCard.id);
      if (hiredAtError) {
        console.error('Set hired_at failed:', hiredAtError);
        setErrorToast("We couldn't update your hired status. Please refresh and try again.");
        setDragCard(null);
        setDragOverColumn(null);
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ search_status: 'hired' })
        .eq('id', user.id);
      if (profileError) {
        console.error('Update search_status failed:', profileError);
        setErrorToast("We couldn't update your hired status. Please refresh and try again.");
        setDragCard(null);
        setDragOverColumn(null);
        return;
      }

      setUserProfile(prev => ({ ...prev, search_status: 'hired' }));
      setShowHiredModal(true);
      setHiredCard(dragCard);
    }

    setDragCard(null);
    setDragOverColumn(null);
  };

  const handleDragEnd = () => {
    setDragCard(null);
    setDragOverColumn(null);
  };

  const handleAddCard = async () => {
    if (!newTitle || !newCompany) return;
    setAddLoading(true);

    try {
      const { data, error } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          title: newTitle,
          company: newCompany,
          description: newDescription || '',
          application_status: 'resume_in_progress',
          notes: newNotes || null,
          resume_id: newResumeId || null,
          application_date: new Date().toISOString().split('T')[0],
          sort_order: applications.length,
        })
        .select('*, resumes!applications_resume_id_fkey(display_name, current_score)')
        .single();

      if (error) {
        console.error('Job card insert error:', error);
        setErrorToast('Could not add job card. Please try again.');
      } else if (data) {
        setApplications(prev => [...prev, data]);
        syncTrackerActivity(supabase);
        setShowAddModal(false);
        setNewTitle('');
        setNewCompany('');
        setNewDescription('');
        setNewResumeId('');
        setNewNotes('');
        fireJT1IfFirst(supabase);
      }
    } catch (err) {
      console.error('Job card insert threw:', err);
      setErrorToast('Could not add job card. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleSetFollowUpReminder = async (cardId) => {
    await fireJT3OnOptIn(supabase, cardId);
    setApplications(prev => prev.map(a =>
      a.id === cardId ? { ...a, follow_up_reminder_opt_in: true } : a
    ));
    syncTrackerActivity(supabase);
  };

  const handleUpdateInterview = async (interviewId, eventData) => {
    const { error } = await supabase
      .from('application_events')
      .update(eventData)
      .eq('id', interviewId);
    if (error) {
      console.error('Update interview failed:', error);
      setErrorToast("We couldn't update your interview. Please try again.");
      throw error;
    }
    setInterviewRounds(prev => prev.map(r =>
      r.id === interviewId ? { ...r, ...eventData } : r
    ));
    syncTrackerActivity(supabase);
  };

  const handleCancelInterview = async (interviewId) => {
    const { error } = await supabase
      .from('application_events')
      .delete()
      .eq('id', interviewId);
    if (error) {
      console.error('Cancel interview failed:', error);
      setErrorToast("We couldn't cancel your interview. Please try again.");
      throw error;
    }
    setInterviewRounds(prev => prev.filter(r => r.id !== interviewId));
    syncTrackerActivity(supabase);
  };

  const handleScheduleInterview = async (cardId, eventData) => {
    const { data, error } = await supabase
      .from('application_events')
      .insert({
        application_id: cardId,
        ...eventData,
      })
      .select()
      .single();
    if (error) {
      console.error('Schedule interview failed:', error);
      setErrorToast("We couldn't save your interview. Please try again.");
      throw error;
    }
    if (data) {
      setInterviewRounds(prev => [...prev, data]);
      syncTrackerActivity(supabase);
    }
  };

  const handleLinkResume = async (cardId, resumeId) => {
    const { error } = await supabase
      .from('applications')
      .update({ resume_id: resumeId, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    if (error) {
      console.error('Link resume failed:', error);
      setErrorToast("We couldn't link your resume. Please try again.");
      return;
    }
    const resume = jsResumes.find(r => r.id === resumeId);
    setApplications(prev => prev.map(a =>
      a.id === cardId ? { ...a, resume_id: resumeId, resumes: resume || null } : a
    ));
    setSelectedCard(prev => prev ? { ...prev, resume_id: resumeId, resumes: resume || null } : prev);
    syncTrackerActivity(supabase);
  };

  const handleRestoreCard = async (cardId) => {
    // Guard against rapid double-clicks. If a restore is in flight for this
    // card, ignore subsequent clicks until it finishes.
    if (restoringId === cardId) return;
    const card = archivedCards.find(a => a.id === cardId);
    if (!card) return;
    setRestoringId(cardId);
    const { error } = await supabase
      .from('applications')
      .update({ application_status: 'resume_in_progress', last_active_status: null, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    if (error) {
      console.error('Restore card failed:', error);
      setErrorToast("We couldn't restore that card. Please try again.");
      setRestoringId(null);
      return;
    }
    setApplications(prev => [...prev, { ...card, application_status: 'resume_in_progress', last_active_status: null }]);
    setArchivedCards(prev => prev.filter(a => a.id !== cardId));
    setRestoringId(null);
  };

  const handleArchiveCard = async (cardId) => {
    const card = applications.find(a => a.id === cardId);
    if (!card) return;
    const { error } = await supabase
      .from('applications')
      .update({ application_status: 'archived', last_active_status: card.application_status, updated_at: new Date().toISOString() })
      .eq('id', cardId);
    if (error) {
      console.error('Archive card failed:', error);
      setErrorToast("We couldn't archive that card. Please try again.");
      return;
    }
    setArchivedCards(prev => [...prev, { ...card, application_status: 'archived', last_active_status: card.application_status }]);
    setApplications(prev => prev.filter(a => a.id !== cardId));
    setShowCardModal(false);
  };

  const handleMoveCard = async (card, newStatus) => {
    if (card.application_status === newStatus) return;
    const previousStatus = card.application_status;
    setApplications(prev => prev.map(a =>
      a.id === card.id ? { ...a, application_status: newStatus } : a
    ));
    setShowCardModal(false);
    const { error } = await supabase
      .from('applications')
      .update({ application_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', card.id);
    if (error) {
      setApplications(prev => prev.map(a =>
        a.id === card.id ? { ...a, application_status: previousStatus } : a
      ));
      setErrorToast('Move failed. Please try again.');
      return;
    }
    // Sync tracker activity + applied count
    syncTrackerActivity(supabase);
    if (newStatus === 'applied' || previousStatus === 'applied') {
      updateAppliedCardCount(supabase);
    }

    setMobileColumn(newStatus);
    if (newStatus === 'applied') {
      fireJT2IfFirst(supabase);
      const updatedCard = { ...card, application_status: 'applied' };
      setToast({ type: 'info', message: "Moved to Applied. Open the card to schedule a follow-up or start interview prep.", card: updatedCard });
      setTimeout(() => setToast(null), 5000);
    } else if (newStatus === 'interview') {
      const updatedCard = { ...card, application_status: 'interview' };
      setToast({ type: 'info', message: "Moved to Interview. Open the card to save your interview date and practice questions.", card: updatedCard });
      setTimeout(() => setToast(null), 5000);
    }
    if (newStatus === 'rejected') {
      setTimeout(() => setRejectedPromptCard({ ...card, previousStatus }), 600);
    }
    if (newStatus === 'hired') {
      fireJT6(supabase);
      const hiredAt = new Date().toISOString();
      const { data: existingHired, error: existingHiredError } = await supabase
        .from('applications')
        .select('*, resumes!applications_resume_id_fkey(display_name, current_score)')
        .eq('user_id', user.id)
        .eq('application_status', 'hired')
        .neq('id', card.id)
        .maybeSingle();
      if (existingHiredError) {
        console.error('Lookup existing hired card failed:', existingHiredError);
        setErrorToast("We couldn't update your hired status. Please refresh and try again.");
        return;
      }
      if (existingHired) {
        const { error: archiveError } = await supabase
          .from('applications')
          .update({ application_status: 'archived', last_active_status: 'hired', updated_at: hiredAt })
          .eq('id', existingHired.id);
        if (archiveError) {
          console.error('Archive previous hired card failed:', archiveError);
          setErrorToast("We couldn't update your hired status. Please refresh and try again.");
          return;
        }
        setApplications(prev => prev.filter(a => a.id !== existingHired.id));
        setArchivedCards(prev => [...prev, { ...existingHired, application_status: 'archived', last_active_status: 'hired' }]);
      }
      const { error: hiredAtError } = await supabase
        .from('applications')
        .update({ hired_at: hiredAt, updated_at: hiredAt })
        .eq('id', card.id);
      if (hiredAtError) {
        console.error('Set hired_at failed:', hiredAtError);
        setErrorToast("We couldn't update your hired status. Please refresh and try again.");
        return;
      }
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ search_status: 'hired' })
        .eq('id', user.id);
      if (profileError) {
        console.error('Update search_status failed:', profileError);
        setErrorToast("We couldn't update your hired status. Please refresh and try again.");
        return;
      }
      setUserProfile(prev => ({ ...prev, search_status: 'hired' }));
      setShowHiredModal(true);
      setHiredCard(card);
    }
  };

  function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  const tier = userProfile?.subscription_tier;
  const isPro = tier === 'pro';
  const totalActive = applications.length;
  const totalInterviews = applications.filter(a => a.application_status === 'interview').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex">

      {/* Sidebar */}
      <div
        className="w-64 text-white flex-col fixed left-0 top-0 shadow-lg z-40 hidden md:flex"
        style={{ background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)', height: '100vh', overflowY: 'hidden' }}
      >
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <h1 className="text-[28px] font-bold mb-1.5 tracking-tight">Job Tracker</h1>
          <p className="text-[13px] text-white leading-tight mb-0.5">Job hunting is small talk.</p>
          <p className="text-[13px] text-white leading-tight">Your career deserves a conversation.</p>
          <div className="mt-4 border-b border-white border-opacity-10"></div>
          <p className="text-[13px] font-bold text-white leading-tight tracking-tight mt-3">
            Every application in one place. Nothing slips through the cracks.
          </p>
        </div>

        <div className="flex-1 px-6 pt-2 pb-6 flex flex-col justify-between">
          <div>
            <div className="mb-5">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">WHAT TRACKER DOES</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Track every application</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Move cards as you progress</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Link your resume & cover letter</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Store and view the job posting</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Log notes along the way</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Stay organized start to finish</span></li>
              </ul>
            </div>

            <div className="mb-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-1">WHEN YOU GET HIRED</h4>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-start"><span className="mr-2">•</span><span>Card moves to Career Vault</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Job description saved</span></li>
                <li className="flex items-start"><span className="mr-2">•</span><span>Track wins from day one</span></li>
              </ul>
            </div>
            
          </div>

          <div className="mt-auto">
            <div className="mb-4 border-b border-white border-opacity-10"></div>
            <p className="text-xs text-white text-opacity-90 leading-relaxed mb-3">
              While you're building your career, we're already building your next resume.
            </p>
            <div className="flex items-center gap-2.5 text-white">
              <img src="/images/Hire_Power_icon.png" alt="Lightning" className="h-5 w-auto flex-shrink-0" />
              <p className="text-sm font-medium leading-tight">Saves to Vault when hired.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="ml-0 md:ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        <MainNav currentPage="job-tracker" userProfile={userProfile} />

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Desktop header */}
          <div className="hidden md:flex px-6 pt-4 pb-2 items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Your Job Search</h2>
              <p className="text-xs text-gray-500">Drag cards between boards as your search progresses.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchiveModal(true)}
                className="text-xs font-semibold py-1.5 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                📁 Archive ({archivedCards.length})
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-white text-xs font-bold py-1.5 px-3 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                + Add Job
              </button>
            </div>
          </div>

          {/* Mobile header */}
          <div className="md:hidden px-6 pt-4 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-gray-900">Your Job Search</h2>
              <span className="text-sm font-semibold px-3 py-1 rounded-md" style={{ backgroundColor: 'rgba(147, 51, 234, 0.08)', color: '#7e22ce' }}>Job Tracker</span>
            </div>
            <p className="text-sm text-gray-500 mb-2">Tap a board name below to view that board. <br/>Tap the board name inside a card to move it to that board.</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowArchiveModal(true)}
                className="text-sm font-semibold py-1.5 px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                📁 Archive ({archivedCards.length})
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="text-white text-sm font-bold py-1.5 px-3 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                + Add Job
              </button>
            </div>
          </div>

          {/* Mobile column picker */}
          <div className="md:hidden flex flex-wrap gap-1.5 px-4 py-3 bg-white flex-shrink-0 justify-center">
            {COLUMNS.map(col => (
              <button
                key={col.id}
                onClick={() => setMobileColumn(col.id)}
                className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
                style={{
                  background: mobileColumn === col.id ? col.color : 'transparent',
                  color: mobileColumn === col.id ? 'white' : col.color,
                  border: `1px solid ${col.color}`,
                }}
              >
                {col.label}
              </button>
            ))}
          </div>

          {/* Kanban */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 pb-4">
            <div className="flex gap-3 h-full md:min-w-[900px]">
              {COLUMNS.map(col => {
                const cards = getColumnCards(col.id);
                const isOver = dragOverColumn === col.id;

                return (
                  <div
                    key={col.id}
                    className={`flex-col flex-1 min-w-[170px] ${mobileColumn === col.id ? 'flex' : 'hidden'} md:flex`}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDrop={(e) => handleDrop(e, col.id)}
                    onDragLeave={() => setDragOverColumn(null)}
                  >
                    {/* Column header */}
                    <div
                      className="rounded-t-xl px-3 py-2 flex items-center justify-between flex-shrink-0"
                      style={{
                        background: col.bg,
                        border: `1px solid ${col.border}`,
                        borderBottom: 'none',
                      }}
                    >
                      <span className="text-sm md:text-xs" style={{ fontWeight: 800, color: col.color }}>{col.label}</span>
                      <span className="text-xs md:text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: col.border, color: col.color }}>{cards.length}</span>
                    </div>

                    {/* Column body */}
                    <div
                      className="flex-1 rounded-b-xl p-2 pt-4 overflow-y-auto flex flex-col gap-2 transition-colors"
                      style={{
                        background: isOver ? col.bg : '#f9fafb',
                        borderLeft: `1px solid ${isOver ? col.color : '#e5e7eb'}`,
                        borderRight: `1px solid ${isOver ? col.color : '#e5e7eb'}`,
                        borderBottom: `1px solid ${isOver ? col.color : '#e5e7eb'}`,
                        borderTop: 'none',
                        minHeight: 200,
                      }}
                    >
                      {cards.length === 0 && (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-xs md:text-[10px] text-gray-300 font-medium">
                            {isOver ? '↓ Drop here' : 'No cards'}
                          </p>
                        </div>
                      )}

                      {cards.map(card => (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, card)}
                          onDragEnd={handleDragEnd}
                          onClick={async () => {
            setSelectedCard(card);
            setShowCardModal(true);
            if (card.application_status === 'interview' || card.application_status === 'hired') {
              const { data, error } = await supabase
                .from('application_events')
                .select('*')
                .eq('application_id', card.id)
                .eq('status', 'interview_scheduled')
                .order('event_date', { ascending: true });
              if (error) {
                console.error('Load interview rounds failed:', error);
                setInterviewRounds([]);
              } else {
                setInterviewRounds(data || []);
              }
            } else {
              setInterviewRounds([]);
            }
          }}
                          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-200 cursor-grab active:cursor-grabbing hover:border-purple-300 hover:shadow-md transition-all flex flex-col"
                          style={{ opacity: dragCard?.id === card.id ? 0.4 : 1, height: '100px' }}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-base md:text-xs font-bold text-gray-900 leading-tight mb-0.5 line-clamp-2">{card.title}</p>
                              <p className="text-sm md:text-[11px] text-gray-500">{card.company}</p>
                            </div>
                            {card.match_score && (
                              <div className="relative flex-shrink-0" style={{ width: '32px', height: '32px' }}>
                                <svg width="32" height="32" style={{ transform: 'rotate(-90deg)' }}>
                                  <circle cx="16" cy="16" r="12" stroke="#e5e7eb" strokeWidth="2.5" fill="none" />
                                  <circle
                                    cx="16" cy="16" r="12"
                                    stroke={card.match_score >= 85 ? '#9333ea' : card.match_score >= 75 ? '#81c784' : card.match_score >= 60 ? '#ffc870' : '#e57373'}
                                    strokeWidth="2.5" fill="none"
                                    strokeDasharray={`${2 * Math.PI * 12}`}
                                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - card.match_score / 100)}`}
                                    strokeLinecap="round"
                                  />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[8px] font-bold" style={{ color: card.match_score >= 85 ? '#9333ea' : card.match_score >= 75 ? '#81c784' : card.match_score >= 60 ? '#ffc870' : '#e57373' }}>
                                    {card.match_score}%
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-auto pt-1 flex flex-wrap gap-1">
                            {card.resumes && (
                              <span className="text-xs md:text-[9px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-md font-semibold">
                                Resume linked
                              </span>
                            )}

                            {card.interview_date && (
                              <span className="text-xs md:text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.5 rounded-md font-semibold">
                                📅 {new Date(card.interview_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}

                            {card.notes && (
                              <p className="text-sm md:text-[10px] text-gray-400 leading-tight line-clamp-1 w-full">{card.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Add Job Card</h2>
                  <p className="text-purple-100 text-xs mt-0.5">Card starts in Prepping</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-white text-2xl leading-none font-light hover:opacity-70">×</button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Job Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onBlur={e => setNewTitle(toTitleCaseOnBlur(e.target.value))}
                  placeholder="e.g. Marketing Coordinator"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={e => setNewCompany(e.target.value)}
                  onBlur={e => setNewCompany(toTitleCaseOnBlur(e.target.value))}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Job Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  placeholder="Referral source, recruiter name, anything useful..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
              <div className="flex justify-center pt-1">
                <button
                  onClick={handleAddCard}
                  disabled={!newTitle || addLoading}
                  className="px-8 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                >
                  {addLoading ? 'Adding...' : 'Add Card'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejected Archive Prompt */}
      {rejectedPromptCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="bg-white shadow-2xl overflow-hidden"
            style={{ width: '364px', borderRadius: '12px' }}
          >
            <div
              className="px-6 py-5 relative"
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Move to Archive?</h2>
                  <p className="text-purple-100 text-xs">{rejectedPromptCard.title} · {rejectedPromptCard.company}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 mb-5 leading-snug">
                Do you want to archive this application? It will move out of your Job Tracker board but will always be accessible from your Career Archive.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setRejectedPromptCard(null);
                  }}
                  className="px-5 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Keep on Board
                </button>
                <button
                  onClick={async () => {
                    const { error } = await supabase
                      .from('applications')
                      .update({ application_status: 'archived', last_active_status: 'rejected', updated_at: new Date().toISOString() })
                      .eq('id', rejectedPromptCard.id);
                    if (error) {
                      console.error('Archive rejected card failed:', error);
                      setErrorToast("We couldn't archive that card. Please try again.");
                      return;
                    }
                    setArchivedCards(prev => [...prev, { ...rejectedPromptCard, application_status: 'archived', last_active_status: 'rejected' }]);
                    setApplications(prev => prev.filter(a => a.id !== rejectedPromptCard.id));
                    setRejectedPromptCard(null);
                  }}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
                >
                  Archive It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hired Celebration Modal */}
      {showHiredModal && hiredCard && (
        <>
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,900;1,900&family=DM+Sans:wght@400;500;600&display=swap');
          `}</style>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            <div
              className="flex flex-col items-center text-center overflow-hidden relative"
              style={{
                borderRadius: '20px',
                maxWidth: '440px',
                width: '100%',
                background: '#1a1033',
                border: '1px solid rgba(147,51,234,0.25)',
                boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 80px rgba(147,51,234,0.15)',
              }}
            >
              {/* Radial glow */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '500px', height: '350px',
                background: 'radial-gradient(ellipse, rgba(147,51,234,0.2) 0%, transparent 70%)',
                pointerEvents: 'none',
                zIndex: 0,
              }} />

              {/* Content */}
              <div className="relative flex flex-col items-center px-10 py-10" style={{ zIndex: 1 }}>

                {/* Checkmark */}
                <div
                  className="flex items-center justify-center mb-5"
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'rgba(147,51,234,0.2)',
                    border: '1px solid rgba(147,51,234,0.4)',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                {/* Eyebrow */}
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#a78bfa',
                  marginBottom: '12px',
                }}>Congratulations</p>

                {/* Headline */}
                <div style={{ marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 'clamp(28px,4vw,42px)',
                    fontWeight: 900,
                    lineHeight: 1.0,
                    letterSpacing: '-1.5px',
                    color: 'white',
                  }}>You got the </span>
                  <span style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: 'clamp(28px,4vw,42px)',
                    fontWeight: 900,
                    fontStyle: 'italic',
                    lineHeight: 1.0,
                    letterSpacing: '-1.5px',
                    color: '#9333ea',
                  }}>job.</span>
                </div>

                {/* Role + Company */}
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.4)',
                  marginBottom: '16px',
                  marginTop: '8px',
                  lineHeight: 1.4,
                }}>
                  {hiredCard.title} · {hiredCard.company}
                </p>

                {/* Divider */}
                <div style={{ width: '32px', height: '1px', background: 'rgba(147,51,234,0.4)', marginBottom: '16px' }} />

                {/* Body copy */}
                {isPro ? (
                  <>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.45,
                      marginBottom: '20px',
                      maxWidth: '340px',
                    }}>
                      Three years from now, you won't remember what you accomplished today. But Hire Power will.
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.9)',
                      lineHeight: 1.45,
                      marginBottom: '36px',
                      maxWidth: '340px',
                    }}>
                      Career Vault builds your next resume while you're building your career. Keeping you prepared anytime great opportunities arise.
                    </p>
                    <button
                      onClick={() => {
                        setShowHiredModal(false);
                        router.push('/career-vault');
                      }}
                      style={{
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'white',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 24px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 24px rgba(102,126,234,0.4)',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseOver={e => e.target.style.opacity = '0.9'}
                      onMouseOut={e => e.target.style.opacity = '1'}
                    >
                      Open Career Vault →
                    </button>
                  </>
                ) : (
                  <>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 400,
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.45,
                      marginBottom: '20px',
                      maxWidth: '340px',
                    }}>
                      Now the real work begins — and the wins start stacking up. Don't let them get lost.
                    </p>
                    <p style={{
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.9)',
                      lineHeight: 1.45,
                      marginBottom: '36px',
                      maxWidth: '340px',
                    }}>
                      Upgrade to Vault and we'll track your achievements as they happen — so your next resume writes itself.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={async () => {
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            if (!user) return;
                            const { data: { session } } = await supabase.auth.getSession();
                            const { data: profile } = await supabase
                              .from('profiles')
                              .select('email')
                              .eq('id', user.id)
                              .single();
                            const data = await fetchJSON('/api/stripe/checkout', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${session.access_token}`,
                              },
                              body: JSON.stringify({
                                priceId: process.env.NEXT_PUBLIC_STRIPE_VAULT_PRICE_ID,
                                userId: user.id,
                                email: profile?.email || user.email,
                              })
                            });
                            if (!data.url) {
                              throw new Error("We couldn't start checkout. Please try again in a moment.");
                            }
                            setShowHiredModal(false);
                            window.location.href = data.url;
                          } catch (err) {
                            setErrorToast(err.message);
                            setShowHiredModal(false);
                          }
                        }}
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '13px',
                          fontWeight: 700,
                          color: 'white',
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 24px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 24px rgba(102,126,234,0.4)',
                          transition: 'opacity 0.2s',
                        }}
                        onMouseOver={e => e.target.style.opacity = '0.9'}
                        onMouseOut={e => e.target.style.opacity = '1'}
                      >
                        Upgrade to Vault — $4.99/mo →
                      </button>
                      <button
                        onClick={() => setShowHiredModal(false)}
                        style={{
                          fontFamily: "'DM Sans', sans-serif",
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'rgba(255,255,255,0.4)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Stay in Job Tracker
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ARCHIVE MODAL ── */}
      {deleteConfirmCard && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setDeleteConfirmCard(null)}
        >
          <div
            className="bg-white shadow-2xl overflow-hidden"
            style={{ width: '364px', borderRadius: '12px' }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="px-6 py-5 relative"
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
            >
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-white">Delete this card?</h2>
                  <p className="text-purple-100 text-xs">{deleteConfirmCard.title} · {deleteConfirmCard.company}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 mb-5 leading-snug">
                This will permanently remove the card from your archive. This cannot be undone.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirmCard(null)}
                  className="px-5 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const { error } = await supabase.from('applications').delete().eq('id', deleteConfirmCard.id);
                    if (error) {
                      console.error('Delete card failed:', error);
                      setErrorToast("We couldn't delete that card. Please try again.");
                      return;
                    }
                    setArchivedCards(prev => prev.filter(a => a.id !== deleteConfirmCard.id));
                    setDeleteConfirmCard(null);
                  }}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity"
                  style={{ background: '#e57373' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowArchiveModal(false)}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ borderRadius: '12px', height: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{ background: 'linear-gradient(to bottom right, #667eea, #764ba2)' }}
              className="px-6 py-5 relative flex-shrink-0"
            >
              <button
                onClick={() => setShowArchiveModal(false)}
                className="absolute top-3 right-4 text-white hover:opacity-70 text-2xl leading-none font-light"
              >×</button>
              <div className="flex items-center gap-3">
                <img src="/images/Hire_Power_icon.png" alt="Hire Power" className="h-8 w-auto flex-shrink-0" />
                <div>
                  <h2 className="text-xl font-bold text-white">Career Archive</h2>
                  <p className="text-purple-100 text-xs">{archivedCards.length} past application{archivedCards.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Archived Job Cards */}
              <div>
                {archivedCards.length > 0 ? (
                  <div className="space-y-2">
                    {archivedCards.map((card) => (
                      <div key={card.id} className="border border-gray-200 rounded-lg p-4 hover:border-purple-200 transition-colors cursor-pointer" onClick={async () => {
                        setCardOpenedFromArchive(true);
                        setSelectedCard(card);
                        setShowCardModal(true);
                        if (card.application_status === 'interview' || card.application_status === 'hired') {
                          const { data, error } = await supabase
                            .from('application_events')
                            .select('*')
                            .eq('application_id', card.id)
                            .eq('status', 'interview_scheduled')
                            .order('event_date', { ascending: true });
                          if (error) {
                            console.error('Load interview rounds failed:', error);
                            setInterviewRounds([]);
                          } else {
                            setInterviewRounds(data || []);
                          }
                        } else {
                          setInterviewRounds([]);
                        }
                      }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900">{card.title}</p>
                              <StatusBadge status={card.last_active_status || card.application_status} />
                            </div>
                            <p className="text-xs text-gray-500 mb-2">
                              {card.company}{card.application_date ? ` · Applied ${formatDate(card.application_date)}` : ''}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                              {card.resumes && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); router.push(`/resume/${card.resumes.id}`); }}
                                  className="text-[10px] text-purple-600 font-semibold hover:text-purple-700"
                                >📄 View Resume</button>
                              )}
                              {card.application_status === 'hired' && (
                                <span className="text-[10px] text-gray-400">🔒 JD saved to Vault</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                await handleRestoreCard(card.id);
                              }}
                              disabled={restoringId === card.id}
                              className="text-[10px] text-purple-500 font-semibold hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >{restoringId === card.id ? 'Restoring...' : 'Restore'}</button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmCard(card);
                              }}
                              className="text-[10px] text-red-400 font-semibold hover:text-red-600"
                            >Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-gray-400">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-sm">No archived items yet</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[70] flex items-center gap-4 px-5 py-3.5 shadow-2xl"
          style={{
            transform: 'translateX(-50%)',
            borderRadius: '12px',
            background: toast.type === 'error' ? '#1a1a2e' : '#1a1033',
            border: toast.type === 'error' ? '1px solid rgba(229,115,115,0.3)' : '1px solid rgba(147,51,234,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            minWidth: '340px',
            maxWidth: '480px',
          }}
        >
          <div
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: toast.type === 'error' ? 'rgba(229,115,115,0.15)' : 'rgba(147,51,234,0.2)' }}
          >
            {toast.type === 'error' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e57373" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7"/>
              </svg>
            )}
          </div>
          <p className="text-xs text-white flex-1" style={{ opacity: 0.85, lineHeight: 1.4 }}>{toast.message}</p>
          {toast.card && (
            <button
              onClick={() => {
                setSelectedCard(toast.card);
                setShowCardModal(true);
                setToast(null);
              }}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white' }}
            >
              Open Card
            </button>
          )}
          <button
            onClick={() => setToast(null)}
            className="flex-shrink-0 text-white hover:opacity-60 transition-opacity text-lg leading-none font-light ml-1"
          >×</button>
        </div>
      )}

      <ErrorToast message={errorToast} onClose={() => setErrorToast(null)} />

      {/* Card Detail Modal */}
      {showCardModal && selectedCard && (
        <JobCardModal
          card={selectedCard}
          onClose={() => {
            setShowCardModal(false);
            if (cardOpenedFromArchive) {
              setShowArchiveModal(true);
              setCardOpenedFromArchive(false);
            }
          }}
          onArchive={handleArchiveCard}
          onSaveNotes={async (cardId, notes) => {
            const { error } = await supabase.from('applications').update({ notes }).eq('id', cardId);
            if (error) {
              console.error('Save notes failed:', error);
              setErrorToast("We couldn't save your notes. Please try again.");
              throw error;
            }
            setApplications(prev => prev.map(a => a.id === cardId ? { ...a, notes } : a));
            syncTrackerActivity(supabase);
          }}
          onLinkResume={handleLinkResume}
          onScheduleInterview={handleScheduleInterview}
          onSetFollowUpReminder={handleSetFollowUpReminder}
          onUpdateInterview={handleUpdateInterview}
          onCancelInterview={handleCancelInterview}
          jsResumes={jsResumes}
          interviewRounds={interviewRounds}
          context="tracker"
          isPro={isPro}
          onMoveCard={handleMoveCard}
        />
      )}

    </div>
  );
}