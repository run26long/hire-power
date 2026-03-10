// SharpTemplate.js — Clean sans-serif | Free tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function SharpTemplate({ resumeData, font, fontSize, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;

  const s = {
    page: {
      fontFamily: font || '"Trebuchet MS", "Helvetica Neue", Arial, sans-serif',
      fontSize: `${base}px`,
      lineHeight: '1.5',
      color: '#222',
      padding: '44px 52px',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    hdr: { marginBottom: '14px', borderBottom: '2px solid #222', paddingBottom: '12px' },
    name: { fontSize: `${base + 15}px`, fontWeight: '700', letterSpacing: '0.5px', marginBottom: '5px' },
    contact: { fontSize: `${base - 1.5}px`, color: '#555', display: 'flex', gap: '14px', flexWrap: 'wrap' },
    sh: {
      fontSize: `${base}px`,
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      borderBottom: '1px solid #ddd',
      paddingBottom: '3px',
      marginBottom: '8px',
      marginTop: '14px',
      color: '#222',
    },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontWeight: '700', fontSize: `${base}px` },
    dt: { fontSize: `${base - 1}px`, color: '#666' },
    co: { fontSize: `${base - 1}px`, color: '#555', marginBottom: '4px' },
    li: { margin: '2px 0 2px 16px', listStyle: 'square' },
    sm: { fontSize: `${base - 1}px`, color: '#444', margin: '3px 0' },
    grid: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
    sc: { flex: '1 1 160px' },
    scn: { fontWeight: '700', fontSize: `${base - 1}px`, marginBottom: '3px' },
    si: { fontSize: `${base - 1}px`, color: '#444', margin: '1px 0' },
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
          {contactParts.map((p, i) => <span key={i}>{p}</span>)}
        </div>
      </div>

      {resumeData.summary && !resumeData.hideSummary && (
        <>
          <div style={s.sh}>Professional Summary</div>
          <p style={{ fontSize: `${base}px`, color: '#333', margin: '0 0 2px' }}>{resumeData.summary}</p>
        </>
      )}

      {resumeData.experience?.length > 0 && (
        <>
          <div style={s.sh}>Professional Experience</div>
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
  );
}
