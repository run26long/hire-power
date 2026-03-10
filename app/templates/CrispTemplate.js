// CrispTemplate.js — Clean serif | Free tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function CrispTemplate({ resumeData, font, fontSize, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;

  const s = {
    page: {
      fontFamily: font || 'Georgia, "Times New Roman", serif',
      fontSize: `${base}px`,
      lineHeight: '1.45',
      color: '#1a1a1a',
      padding: '48px 52px',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    name: {
      fontSize: `${base + 13}px`,
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: '6px',
    },
    contact: {
      textAlign: 'center',
      fontSize: `${base - 1}px`,
      color: '#444',
      marginBottom: '16px',
    },
    hr: { border: 'none', borderBottom: '1.5px solid #1a1a1a', margin: '0 0 7px 0' },
    sh: {
      fontSize: `${base - 1}px`,
      fontWeight: '700',
      letterSpacing: '1.8px',
      textTransform: 'uppercase',
      marginBottom: '3px',
      marginTop: '13px',
    },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontWeight: '700', fontSize: `${base}px` },
    dt: { fontSize: `${base - 1}px`, color: '#555' },
    co: { fontStyle: 'italic', color: '#555', marginBottom: '3px', fontSize: `${base - 1}px` },
    li: { margin: '2px 0 2px 14px', listStyle: 'disc' },
    sm: { fontSize: `${base - 1}px`, color: '#444', margin: '3px 0' },
  };

  const contactParts = [
    resumeData.phone,
    resumeData.email,
    resumeData.location,
    resumeData.linkedin,
    resumeData.portfolio,
  ].filter(Boolean);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.name}>{resumeData.fullName}</div>
      <div style={s.contact}>{contactParts.join(' • ')}</div>
      <hr style={s.hr} />

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <>
          <div style={s.sh}>Professional Summary</div>
          <hr style={s.hr} />
          <p style={{ fontSize: `${base}px`, color: '#333', margin: '0 0 4px' }}>{resumeData.summary}</p>
        </>
      )}

      {/* Experience */}
      {resumeData.experience?.length > 0 && (
        <>
          <div style={s.sh}>Experience</div>
          <hr style={s.hr} />
          {resumeData.experience.map((job, i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <div style={s.row}>
                <span style={s.jt}>{job.title}</span>
                <span style={s.dt}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</span>
              </div>
              <div style={s.co}>{[job.company, job.location].filter(Boolean).join(' | ')}</div>
              {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
              {job.bullets?.length > 0 && (
                <ul style={{ margin: 0, padding: 0 }}>
                  {job.bullets.map((b, k) => <li key={k} style={s.li}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {/* Education */}
      {resumeData.education?.length > 0 && (
        <>
          <div style={s.sh}>Education</div>
          <hr style={s.hr} />
          {resumeData.education.map((ed, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={s.row}>
                <span style={s.jt}>{ed.school}</span>
                <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
              </div>
              <div style={s.co}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
              {ed.lines?.map((l, k) => <div key={k} style={{ fontSize: `${base - 1}px`, color: '#555' }}>{l}</div>)}
            </div>
          ))}
        </>
      )}

      {/* Skills */}
      {Object.keys(skills).length > 0 && (
        <>
          <div style={s.sh}>Skills</div>
          <hr style={s.hr} />
          {Object.entries(skills).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '3px' }}>
              {Object.keys(skills).length > 1
                ? <><span style={{ fontWeight: '700', fontSize: `${base - 1}px` }}>{cat}: </span>
                    <span style={{ fontSize: `${base - 1}px`, color: '#333' }}>{items.join(' • ')}</span></>
                : <span style={{ fontSize: `${base - 1}px`, color: '#333' }}>{items.join(' • ')}</span>
              }
            </div>
          ))}
        </>
      )}

      {/* Certifications */}
      {resumeData.certifications?.length > 0 && (
        <>
          <div style={s.sh}>Certifications</div>
          <hr style={s.hr} />
          {resumeData.certifications.map((c, i) => (
            <div key={i} style={{ fontSize: `${base - 1}px`, marginBottom: '3px' }}>
              <strong>{c.name}</strong>{c.details ? ` – ${c.details}` : ''}
            </div>
          ))}
        </>
      )}

      {/* Volunteer */}
      {resumeData.volunteer?.length > 0 && (
        <>
          <div style={s.sh}>Volunteer Experience</div>
          <hr style={s.hr} />
          {resumeData.volunteer.map((v, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: '700', fontSize: `${base}px` }}>{v.organization}</div>
              <div style={{ fontSize: `${base - 1}px`, color: '#444' }}>{v.description}</div>
            </div>
          ))}
        </>
      )}

      {/* Projects */}
      {resumeData.projects?.length > 0 && (
        <>
          <div style={s.sh}>Projects</div>
          <hr style={s.hr} />
          {resumeData.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: '700', fontSize: `${base}px` }}>{p.name}{p.link ? ` — ${p.link}` : ''}</div>
              <div style={{ fontSize: `${base - 1}px`, color: '#444' }}>{p.description}</div>
            </div>
          ))}
        </>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <>
          <div style={s.sh}>Languages</div>
          <hr style={s.hr} />
          <div style={{ fontSize: `${base - 1}px`, color: '#333' }}>
            {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
          </div>
        </>
      )}
    </div>
  );
}
