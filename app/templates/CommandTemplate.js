// CommandTemplate.js — Bold color header | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function CommandTemplate({ resumeData, font, fontSize, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const color = accentColor || '#5b4fcf';

  const s = {
    page: {
      fontFamily: font || '"Trebuchet MS", Arial, sans-serif',
      fontSize: `${base}px`,
      lineHeight: '1.45',
      color: '#1a1a1a',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    hdr: { background: color, color: '#fff', padding: '28px 52px 22px' },
    name: { fontSize: `${base + 17}px`, fontWeight: '700', letterSpacing: '1px', marginBottom: '6px' },
    contact: { fontSize: `${base - 1.5}px`, opacity: 0.9, display: 'flex', flexWrap: 'wrap', gap: '10px' },
    body: { padding: '20px 52px 40px' },
    sh: {
      fontSize: `${base}px`,
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: color,
      borderBottom: `1.5px solid ${color}`,
      paddingBottom: '3px',
      marginBottom: '8px',
      marginTop: '16px',
    },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontWeight: '700', fontSize: `${base}px` },
    dt: { fontSize: `${base - 1}px`, color: '#666' },
    co: { fontSize: `${base - 1}px`, color: '#555', marginBottom: '4px' },
    li: { margin: '2px 0 2px 16px', listStyle: 'disc' },
    sm: { fontSize: `${base - 1}px`, color: '#444', margin: '3px 0' },
    grid: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
    sc: { flex: '1 1 160px' },
    scn: { fontWeight: '700', fontSize: `${base - 1}px`, marginBottom: '4px', color: color },
    si: { fontSize: `${base - 1}px`, color: '#444', margin: '2px 0' },
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
            <span key={i}>{i > 0 && <span style={{ opacity: 0.5, marginRight: '10px' }}>|</span>}{p}</span>
          ))}
        </div>
      </div>
      <div style={s.body}>
        {resumeData.summary && !resumeData.hideSummary && (
          <>
            <div style={s.sh}>Professional Summary</div>
            <p style={{ fontSize: `${base}px`, color: '#333', margin: '0 0 4px' }}>{resumeData.summary}</p>
          </>
        )}

        {resumeData.experience?.length > 0 && (
          <>
            <div style={s.sh}>Experience</div>
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
            {Object.keys(skills).length > 1 ? (
              <div style={s.grid}>
                {Object.entries(skills).map(([cat, items]) => (
                  <div key={cat} style={s.sc}>
                    <div style={s.scn}>{cat}</div>
                    {items.map((item, i) => <div key={i} style={s.si}>{item}</div>)}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: `${base - 1}px`, color: '#333' }}>
                {Object.values(skills)[0].join(' • ')}
              </div>
            )}
          </>
        )}

        {resumeData.certifications?.length > 0 && (
          <>
            <div style={s.sh}>Certifications</div>
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
            <div style={{ fontSize: `${base - 1}px`, color: '#333' }}>
              {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
