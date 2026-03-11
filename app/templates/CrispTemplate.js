// CrispTemplate.js — Clean serif | Free tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function CrispTemplate({ resumeData, font, fontSize, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const fontFamily = font || 'Georgia, "Times New Roman", serif';

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.1',
      color: '#1a1a1a',
      padding: '36px 64px',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    name: {
      fontFamily,
      fontSize: '20pt',
      fontWeight: '700',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      textAlign: 'center',
      marginBottom: '0px',
      lineHeight: '1.1',
    },
    contact: {
      fontFamily,
      textAlign: 'center',
      fontSize: `${base}pt`,
      color: '#444',
      marginBottom: '8px',
      lineHeight: '1.1',
    },
    hr: { border: 'none', borderBottom: '1.5px solid #1a1a1a', margin: '0 0 0 0' },
    hrSection: { border: 'none', borderBottom: '1.5px solid #1a1a1a', margin: '0 0 4px 0' },
    sh: {
      fontFamily,
      fontSize: '13pt',
      fontWeight: '700',
      letterSpacing: '0.5px',
      textTransform: 'uppercase',
      marginBottom: '2px',
      marginTop: '10px',
      lineHeight: '1.1',
    },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontFamily, fontWeight: '700', fontSize: `${base}pt`, lineHeight: '1.1' },
    dt: { fontFamily, fontSize: `${base}pt`, color: '#555', lineHeight: '1.1' },
    co: { fontFamily, fontStyle: 'italic', color: '#555', marginBottom: '2px', fontSize: `${base}pt`, lineHeight: '1.1' },
    li: { fontFamily, margin: '1px 0', fontSize: `${base}pt`, display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.1' },
    sm: { fontFamily, fontSize: `${base}pt`, color: '#444', margin: '2px 0', lineHeight: '1.1' },
    body: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: '0 0 3px', lineHeight: '1.1' },
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

      {/* Summary */}
      {resumeData.summary && !resumeData.hideSummary && (
        <>
          <div style={s.sh}>Professional Summary</div>
          <hr style={s.hrSection} />
          <p style={s.body}>{resumeData.summary}</p>
        </>
      )}

      {/* Experience */}
      {resumeData.experience?.length > 0 && (
        <>
          <div style={s.sh}>Experience</div>
          <hr style={s.hrSection} />
          {resumeData.experience.map((job, i) => (
            <div key={i} style={{ marginBottom: '12px' }}>
              <div style={s.row}>
                <span style={s.jt}>{job.title}</span>
                <span style={s.dt}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</span>
              </div>
              <div style={s.co}>{[job.company, job.location].filter(Boolean).join(' | ')}</div>
              {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
              {job.bullets?.length > 0 && (
                <div style={{ marginTop: '2px' }}>
                  {job.bullets.map((b, k) => (
                    <div key={k} style={s.li}>
                      <span style={{ flexShrink: 0 }}>•</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Education */}
      {resumeData.education?.length > 0 && (
        <>
          <div style={s.sh}>Education</div>
          <hr style={s.hrSection} />
          {resumeData.education.map((ed, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={s.row}>
                <span style={s.jt}>{ed.school}</span>
                <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
              </div>
              <div style={s.co}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
              {ed.lines?.map((l, k) => <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#555' }}>{l}</div>)}
            </div>
          ))}
        </>
      )}

      {/* Skills */}
      {Object.keys(skills).length > 0 && (
        <>
          <div style={s.sh}>Skills</div>
          <hr style={s.hrSection} />
          {Object.entries(skills).map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: '3px' }}>
              {Object.keys(skills).length > 1
                ? <><span style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{cat}: </span>
                    <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span></>
                : <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span>
              }
            </div>
          ))}
        </>
      )}

      {/* Certifications */}
      {resumeData.certifications?.length > 0 && (
        <>
          <div style={s.sh}>Certifications</div>
          <hr style={s.hrSection} />
          {resumeData.certifications.map((c, i) => (
            <div key={i} style={{ fontFamily, fontSize: `${base}pt`, marginBottom: '3px' }}>
              <strong>{c.name}</strong>{c.details ? ` – ${c.details}` : ''}
            </div>
          ))}
        </>
      )}

      {/* Volunteer */}
      {resumeData.volunteer?.length > 0 && (
        <>
          <div style={s.sh}>Volunteer Experience</div>
          <hr style={s.hrSection} />
          {resumeData.volunteer.map((v, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{v.organization}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
            </div>
          ))}
        </>
      )}

      {/* Projects */}
      {resumeData.projects?.length > 0 && (
        <>
          <div style={s.sh}>Projects</div>
          <hr style={s.hrSection} />
          {resumeData.projects.map((p, i) => (
            <div key={i} style={{ marginBottom: '6px' }}>
              <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{p.name}{p.link ? ` — ${p.link}` : ''}</div>
              <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
            </div>
          ))}
        </>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
        <>
          <div style={s.sh}>Languages</div>
          <hr style={s.hrSection} />
          <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
            {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
          </div>
        </>
      )}
    </div>
  );
}