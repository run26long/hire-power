// CommandTemplate.js — Bold color header | Pro tier
import { formatDate, formatDateRange, getSkillsDisplay } from './templateUtils';

export default function CommandTemplate({ resumeData, font, fontSize, spacing = 1, accentColor, dateFormat = 'short' }) {
  if (!resumeData) return null;
  const skills = getSkillsDisplay(resumeData);
  const base = fontSize || 11;
  const sp = spacing || 1;
  const color = accentColor || '#5b4fcf';
  const fontFamily = font || 'Arial, Helvetica, sans-serif';

  const px = (n) => `${Math.round(n * sp)}px`;

  const s = {
    page: {
      fontFamily,
      fontSize: `${base}pt`,
      lineHeight: '1.1',
      color: '#1a1a1a',
      background: '#fff',
      width: '100%',
      boxSizing: 'border-box',
    },
    hdr: {
      background: color,
      color: '#fff',
      padding: `${px(24)} ${px(52)} ${px(18)}`,
    },
    name: {
      fontFamily,
      fontSize: '22pt',
      fontWeight: '700',
      letterSpacing: '1px',
      marginBottom: px(4),
      lineHeight: '1.1',
      color: '#fff',
    },
    contact: {
      fontFamily,
      fontSize: `${base}pt`,
      color: 'rgba(255,255,255,0.9)',
      display: 'flex',
      flexWrap: 'wrap',
      gap: px(10),
      lineHeight: '1.1',
    },
    body: {
      padding: `${px(16)} ${px(52)} ${px(36)}`,
    },
    section: {
      marginTop: px(14),
    },
    sh: {
      fontFamily,
      fontSize: '13pt',
      fontWeight: '700',
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: color,
      borderBottom: `2px solid ${color}`,
      paddingBottom: px(2),
      marginBottom: px(5),
      marginTop: '0',
      lineHeight: '1.1',
    },
    entry: { marginBottom: px(10) },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
    jt: { fontFamily, fontWeight: '700', fontSize: `${base}pt`, lineHeight: '1.1', color: '#111' },
    dt: { fontFamily, fontSize: `${base}pt`, color: '#666', lineHeight: '1.1' },
    co: { fontFamily, fontSize: `${base}pt`, color: '#555', marginBottom: px(2), lineHeight: '1.1' },
    li: { fontFamily, margin: `${px(1)} 0`, fontSize: `${base}pt`, display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.1' },
    sm: { fontFamily, fontSize: `${base}pt`, color: '#444', margin: `${px(2)} 0`, lineHeight: '1.1' },
    bodyText: { fontFamily, fontSize: `${base}pt`, color: '#333', margin: `0 0 ${px(2)}`, lineHeight: '1.1' },
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
      <div style={s.hdr}>
        <div style={s.name}>{resumeData.fullName}</div>
        <div style={s.contact}>
          {contactParts.map((p, i) => (
            <span key={i}>{i > 0 && <span style={{ opacity: 0.5, marginRight: px(10) }}>|</span>}{p}</span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={s.body}>

        {/* Summary */}
        {resumeData.summary && !resumeData.hideSummary && (
          <div style={s.section}>
            <div style={s.sh}>Professional Summary</div>
            <p style={s.bodyText}>{resumeData.summary}</p>
          </div>
        )}

        {/* Experience */}
        {resumeData.experience?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Experience</div>
            {resumeData.experience.map((job, i) => (
              <div key={i} style={i < resumeData.experience.length - 1 ? s.entry : {}}>
                <div style={s.row}>
                  <span style={s.jt}>{job.title}</span>
                  <span style={s.dt}>{formatDateRange(job.startDate, job.endDate, job.current, dateFormat)}</span>
                </div>
                <div style={s.co}>{[job.company, job.location].filter(Boolean).join(' | ')}</div>
                {job.summary && !job.summaryDismissed && <p style={s.sm}>{job.summary}</p>}
                {job.bullets?.length > 0 && (
                  <div style={{ marginTop: px(2) }}>
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
          </div>
        )}

        {/* Education */}
        {resumeData.education?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Education</div>
            {resumeData.education.map((ed, i) => (
              <div key={i} style={i < resumeData.education.length - 1 ? s.entry : {}}>
                <div style={s.row}>
                  <span style={s.jt}>{ed.school}</span>
                  <span style={s.dt}>{formatDate(ed.graduationDate, dateFormat)}</span>
                </div>
                <div style={s.co}>{[ed.degree, ed.field].filter(Boolean).join(', ')}</div>
                {ed.lines?.map((l, k) => <div key={k} style={{ fontFamily, fontSize: `${base}pt`, color: '#333', lineHeight: '1.1' }}>{l}</div>)}
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {Object.keys(skills).length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Skills</div>
            {Object.entries(skills).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: px(3) }}>
                {Object.keys(skills).length > 1
                  ? <><span style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{cat}: </span>
                      <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span></>
                  : <span style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>{items.join(' • ')}</span>
                }
              </div>
            ))}
          </div>
        )}

        {/* Certifications */}
        {resumeData.certifications?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Certifications</div>
            {resumeData.certifications.map((c, i) => (
              <div key={i} style={i < resumeData.certifications.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontSize: `${base}pt` }}>
                  <strong>{c.name}</strong>{c.details ? ` | ${c.details}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Volunteer */}
        {resumeData.volunteer?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Volunteer Experience</div>
            {resumeData.volunteer.map((v, i) => (
              <div key={i} style={i < resumeData.volunteer.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{v.organization}</div>
                <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{v.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Projects */}
        {resumeData.projects?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Projects</div>
            {resumeData.projects.map((p, i) => (
              <div key={i} style={i < resumeData.projects.length - 1 ? s.entry : {}}>
                <div style={{ fontFamily, fontWeight: '700', fontSize: `${base}pt` }}>{p.name}{p.link ? ` — ${p.link}` : ''}</div>
                <div style={{ fontFamily, fontSize: `${base}pt`, color: '#444' }}>{p.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* Additional Information */}
      {resumeData.additionalInfo?.length > 0 && (
        <div style={s.section}>
          <div style={s.sh}>Additional Information</div>
          {resumeData.additionalInfo.map((item, i) => (
            <div key={i} style={i < resumeData.additionalInfo.length - 1 ? { marginBottom: px(3) } : {}}>
              <div style={{ fontFamily, fontSize: `${base}pt`, lineHeight: '1.1', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <strong>{item.label}</strong>
                {item.detail && <span style={{ color: '#555' }}>| {item.detail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Languages */}
      {resumeData.languages?.length > 0 && (
          <div style={s.section}>
            <div style={s.sh}>Languages</div>
            <div style={{ fontFamily, fontSize: `${base}pt`, color: '#333' }}>
              {resumeData.languages.map(l => `${l.language} (${l.proficiency})`).join(' • ')}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}