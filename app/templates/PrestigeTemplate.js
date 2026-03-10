// PrestigeTemplate.js — Tinted contact band | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function PrestigeTemplate({ resumeData, font, fontSize, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const color = accentColor || '#5b4fcf';
  const bandBg = color + '18';

  const s = {
    page: {
      fontFamily: font || 'Georgia, serif',
      fontSize: `${base}px`,
      lineHeight: '1.5',
      color: '#1a1a1a',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    nb: { padding: '30px 52px 0' },
    name: {
      fontSize: `${base + 19}px`,
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: '2px',
    },
    tl: {
      fontSize: `${base + 1}px`,
      letterSpacing: '1px',
      color: color,
      fontStyle: 'italic',
      marginBottom: '12px',
    },
    band: {
      background: bandBg,
      borderTop: `2px solid ${color}`,
      borderBottom: `1px solid ${color}33`,
      padding: '8px 52px',
      fontSize: `${base - 1.5}px`,
      color: '#444',
      display: 'flex',
      gap: '20px',
      flexWrap: 'wrap',
    },
    body: { padding: '16px 52px 40px' },
    sh: {
      fontSize: `${base}px`,
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: '2px',
      marginTop: '16px',
    },
    rule: { border: 'none', borderBottom: `1px solid ${color}`, margin: '0 0 8px' },
    row: { display: 'flex', justifyContent: 'space-between' },
    jt: { fontWeight: '700', fontSize: `${base}px` },
    dt: { fontSize: `${base - 1}px`, color: '#666', fontStyle: 'italic' },
    co: { fontSize: `${base - 1}px`, color: '#555', fontStyle: 'italic', marginBottom: '4px' },
    li: { margin: '2px 0 2px 16px', listStyle: 'disc' },
    sm: { fontSize: `${base}px`, color: '#333', margin: '3px 0' },
    scr: { marginBottom: '4px' },
    scn: { fontWeight: '700', fontSize: `${base - 1}px`, color: color },
  };

  const contactParts = [
    resumeData.location && `📍 ${resumeData.location}`,
    resumeData.phone && `📞 ${resumeData.phone}`,
    resumeData.email && `✉ ${resumeData.email}`,
    resumeData.linkedin && `🔗 ${resumeData.linkedin}`,
    resumeData.portfolio && `🌐 ${resumeData.portfolio}`,
  ].filter(Boolean);

  // Generate a title line from most recent job or generic fallback
  const titleLine = resumeData.experience?.[0]?.title || 'Professional';

  return (
    <div style={s.page}>
      <div style={s.nb}>
        <div style={s.name}>{resumeData.fullName}</div>
        <div style={s.tl}>{titleLine}</div>
      </div>
      <div style={s.band}>
        {contactParts.map((p, i) => <span key={i}>{p}</span>)}
      </div>
      <div style={s.body}>
        {resumeData.summary && !resumeData.hideSummary && (
          <>
            <div style={s.sh}>Professional Summary</div>
            <hr style={s.rule} />
            <p style={{ fontSize: `${base}px`, color: '#333', margin: '0 0 2px' }}>{resumeData.summary}</p>
          </>
        )}

        {resumeData.experience?.length > 0 && (
          <>
            <div style={s.sh}>Professional Experience</div>
            <hr style={s.rule} />
            {resumeData.experience.map((job, i) => (
              <div key={i} style={{ marginBottom: '14px' }}>
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
                {ed.lines?.map((l, k) => <div key={k} style={{ fontSize: `${base - 1}px`, color: '#555' }}>{l}</div>)}
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
    </div>
  );
}
