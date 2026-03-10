// SignatureTemplate.js — Palatino italic colored headers | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function SignatureTemplate({ resumeData, font, fontSize, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const color = accentColor || '#5b4fcf';

  const s = {
    page: {
      fontFamily: font || '"Palatino Linotype", Palatino, "Book Antiqua", serif',
      fontSize: `${base}px`,
      lineHeight: '1.5',
      color: '#1a1a1a',
      padding: '44px 52px',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    hdr: {
      textAlign: 'center',
      marginBottom: '16px',
      paddingBottom: '14px',
      borderBottom: `2px solid ${color}`,
    },
    name: {
      fontSize: `${base + 17}px`,
      fontWeight: '700',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: '5px',
    },
    contact: {
      fontSize: `${base - 1.5}px`,
      color: '#555',
      display: 'flex',
      justifyContent: 'center',
      gap: '14px',
      flexWrap: 'wrap',
    },
    sh: {
      fontSize: `${base + 2}px`,
      fontWeight: '700',
      color: color,
      letterSpacing: '0.5px',
      marginBottom: '2px',
      marginTop: '16px',
      fontStyle: 'italic',
    },
    rule: { border: 'none', borderTop: '0.5px solid #ddd', margin: '0 0 8px' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontWeight: '700', fontSize: `${base}px` },
    dt: { fontSize: `${base - 1}px`, color: '#666' },
    co: { fontSize: `${base - 1}px`, color: '#666', marginBottom: '4px' },
    li: { margin: '2px 0 2px 0', listStyle: 'none', display: 'flex', gap: '6px' },
    dot: { color: color, flexShrink: 0, fontSize: `${base - 2}px`, marginTop: '2px' },
    sm: { fontSize: `${base}px`, color: '#444', margin: '3px 0', fontStyle: 'italic' },
    scr: { marginBottom: '4px' },
    scn: { fontWeight: '700', fontSize: `${base - 1}px`, color: color },
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
      <div style={s.hdr}>
        <div style={s.name}>{resumeData.fullName}</div>
        <div style={s.contact}>
          {contactParts.map((p, i) => (
            <span key={i}>{i > 0 && <span style={{ margin: '0 0 0 -7px' }}>•</span>}{i > 0 ? ' ' : ''}{p}</span>
          ))}
        </div>
      </div>

      {resumeData.summary && !resumeData.hideSummary && (
        <>
          <div style={s.sh}>Professional Summary</div>
          <hr style={s.rule} />
          <p style={{ fontSize: `${base}px`, color: '#333', margin: '0 0 2px', fontStyle: 'italic' }}>{resumeData.summary}</p>
        </>
      )}

      {resumeData.experience?.length > 0 && (
        <>
          <div style={s.sh}>Professional Experience</div>
          <hr style={s.rule} />
          {resumeData.experience.map((job, i) => (
            <div key={i} style={{ marginBottom: '13px' }}>
              <div style={s.row}>
                <span style={s.jt}>{job.title}</span>
                <span style={s.dt}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</span>
              </div>
              <div style={s.co}>{[job.company, job.location].filter(Boolean).join(' | ')}</div>
              {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
              {job.bullets?.length > 0 && (
                <ul style={{ margin: 0, padding: 0 }}>
                  {job.bullets.map((b, k) => (
                    <li key={k} style={s.li}>
                      <span style={s.dot}>◆</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </>
      )}

      {resumeData.education?.length > 0 && (
        <>
          <div style={s.sh}>Education</div>
          <hr style={s.rule} />
          {resumeData.education.map((ed, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={s.row}>
                <span style={s.jt}>{ed.school}</span>
                <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
              </div>
              <div style={s.co}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
              {ed.lines?.map((l, k) => <div key={k} style={{ fontSize: `${base - 1}px`, color: '#666' }}>{l}</div>)}
            </div>
          ))}
        </>
      )}

      {Object.keys(skills).length > 0 && (
        <>
          <div style={s.sh}>Skills</div>
          <hr style={s.rule} />
          {Object.entries(skills).map(([cat, items]) => (
            <div key={cat} style={s.scr}>
              {Object.keys(skills).length > 1
                ? <><span style={s.scn}>{cat}: </span><span style={{ fontSize: `${base - 1}px`, color: '#444' }}>{items.join(' • ')}</span></>
                : <span style={{ fontSize: `${base - 1}px`, color: '#444' }}>{items.join(' • ')}</span>
              }
            </div>
          ))}
        </>
      )}

      {resumeData.certifications?.length > 0 && (
        <>
          <div style={s.sh}>Certifications</div>
          <hr style={s.rule} />
          {resumeData.certifications.map((c, i) => (
            <div key={i} style={{ fontSize: `${base - 1}px`, marginBottom: '3px' }}>
              <strong>{c.name}</strong>{c.details ? ` — ${c.details}` : ''}
            </div>
          ))}
        </>
      )}

      {resumeData.volunteer?.length > 0 && (
        <>
          <div style={s.sh}>Volunteer Experience</div>
          <hr style={s.rule} />
          {resumeData.volunteer.map((v, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: '700', fontSize: `${base}px` }}>{v.organization}</div>
              <div style={{ fontSize: `${base - 1}px`, color: '#444' }}>{v.description}</div>
            </div>
          ))}
        </>
      )}

      {resumeData.projects?.length > 0 && (
        <>
          <div style={s.sh}>Projects</div>
          <hr style={s.rule} />
          {resumeData.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontWeight: '700', fontSize: `${base}px` }}>{p.name}{p.link ? ` — ${p.link}` : ''}</div>
              <div style={{ fontSize: `${base - 1}px`, color: '#444' }}>{p.description}</div>
            </div>
          ))}
        </>
      )}

      {resumeData.languages?.length > 0 && (
        <>
          <div style={s.sh}>Languages</div>
          <hr style={s.rule} />
          <div style={{ fontSize: `${base - 1}px`, color: '#333' }}>
            {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
          </div>
        </>
      )}
    </div>
  );
}
